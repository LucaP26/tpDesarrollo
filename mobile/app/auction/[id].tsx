import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as api from "@/src/lib/api";
import { browseArtwork, categoryEyebrow, formatEventDate, formatMoney, homeShowcase, profileAvatar } from "@/src/lib/luxury";
import { buildRestrictionAlert } from "@/src/lib/restrictions";
import { useSession } from "@/src/lib/session";
import { palette } from "@/src/lib/theme";
import { AuctionDetail, AuctionLot } from "@/src/lib/types";

function resolveLotImage(source: string | undefined, index: number) {
  if (!source || source.includes("images.example.com") || source.includes("placehold.co")) {
    if (index < homeShowcase.length) {
      return homeShowcase[index].image;
    }
    return browseArtwork[index % browseArtwork.length];
  }
  return source;
}

function lotStatus(lot: AuctionLot, currentLotId?: number | null) {
  if (lot.sold) {
    return {
      label: lot.sold_to_company ? "Adjudicado a la casa" : "Adjudicado",
      tone: "soft" as const
    };
  }

  if (lot.id === currentLotId) {
    return {
      label: "En vivo",
      tone: "live" as const
    };
  }

  return {
    label: "Siguiente",
    tone: "queue" as const
  };
}

export default function AuctionRoomScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const auctionId = Number(params.id);
  const { token, user, updateUser } = useSession();
  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [offerInput, setOfferInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAuction() {
      if (!token || Number.isNaN(auctionId)) {
        return;
      }

      try {
        const [joinResult, detail] = await Promise.all([api.joinAuction(token, auctionId), api.getAuction(token, auctionId)]);
        if (!active) {
          return;
        }
        updateUser({ category: joinResult.user_category });
        setAuction(detail);
        setOfferInput(detail.current_lot ? String(detail.current_lot.min_bid) : "");
      } catch (error) {
        if (!active) {
          return;
        }
        const alert = buildRestrictionAlert(error instanceof Error ? error.message : undefined, "catalogo");
        Alert.alert(alert.title, alert.message, [{ text: "Volver", onPress: () => router.back() }]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAuction();
    return () => {
      active = false;
    };
  }, [auctionId, token, router, updateUser]);

  const currentLot = auction?.current_lot ?? null;
  const lots = useMemo(() => auction?.lots ?? [], [auction]);
  const avatarUri = profileAvatar(user?.avatar_image_url, user?.email ?? "profile@luxury.local");

  function confirmLeaveAuction() {
    if (!token || !auction || leaving) {
      return;
    }

    Alert.alert(
      "Abandonar sala",
      "Si sales de esta subasta, tu ultima puja activa se eliminara y podras ingresar a otra sala.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Abandonar",
          style: "destructive",
          onPress: async () => {
            try {
              setLeaving(true);
              const response = await api.leaveAuction(token, auction.id);
              Alert.alert("Saliste de la subasta", response.message, [
                {
                  text: "Entendido",
                  onPress: () => router.replace("/(tabs)/auctions")
                }
              ]);
            } catch (error) {
              Alert.alert("No se pudo abandonar la subasta", error instanceof Error ? error.message : "Error inesperado");
            } finally {
              setLeaving(false);
            }
          }
        }
      ]
    );
  }

  async function handleBid() {
    if (!token || !auction || !currentLot) {
      return;
    }

    if (!currentLot.can_bid) {
      const alert = buildRestrictionAlert(currentLot.block_reason, "puja");
      Alert.alert(alert.title, alert.message);
      return;
    }

    const amount = Number(offerInput.replace(",", ".").trim());
    if (Number.isNaN(amount)) {
      Alert.alert("Monto invalido", "Ingresa un monto numerico valido para continuar.");
      return;
    }
    if (amount < currentLot.min_bid) {
      Alert.alert(
        "Monto inferior al minimo",
        `La oferta ingresada es menor al minimo admitido para este lote.\n\nMinimo permitido: ${formatMoney(auction.currency, currentLot.min_bid)}.`
      );
      return;
    }
    if (currentLot.max_bid !== null && currentLot.max_bid !== undefined && amount > currentLot.max_bid) {
      Alert.alert(
        "Monto superior al maximo",
        `La oferta ingresada es mayor al maximo admitido para este lote.\n\nMaximo permitido: ${formatMoney(auction.currency, currentLot.max_bid)}.`
      );
      return;
    }

    try {
      await api.placeBid(token, auction.id, currentLot.id, amount);
      const refreshed = await api.getAuction(token, auction.id);
      setAuction(refreshed);
      setOfferInput(refreshed.current_lot ? String(refreshed.current_lot.min_bid) : "");
      Alert.alert("Puja confirmada", "Tu oferta se registro correctamente.");
    } catch (error) {
      Alert.alert("No se pudo registrar la puja", error instanceof Error ? error.message : "Error inesperado");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Cargando catalogo...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!auction) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>No se encontro la subasta.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.replace("/(tabs)/home")} style={styles.backArrowButton}>
            <Text style={styles.backArrowText}>{"\u2190"}</Text>
          </Pressable>
          <Text style={styles.topTitle}>Catalogo de sala</Text>
          <Pressable onPress={() => router.push("/(tabs)/profile")} style={styles.profileButton}>
            <Image source={{ uri: avatarUri }} style={styles.profileImage} />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroEyebrow}>{categoryEyebrow(auction.category)}</Text>
            <Pressable
              style={[styles.leaveAuctionChip, leaving && styles.leaveAuctionChipDisabled]}
              onPress={confirmLeaveAuction}
              disabled={leaving}
            >
              <Text style={styles.leaveAuctionChipText}>{leaving ? "Saliendo..." : "Abandonar sala"}</Text>
            </Pressable>
          </View>
          <Text style={styles.heroTitle}>{auction.title}</Text>
          <Text style={styles.heroMeta}>
            {auction.location} - {formatEventDate(auction.scheduled_at)} - {auction.auctioneer_name}
          </Text>
          <Text style={styles.heroCopy}>
            La sala muestra un lote a la vez. Cuando se adjudica el lote en exhibicion, la subasta avanza al siguiente.
          </Text>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Lotes del catalogo</Text>
          <Text style={styles.sectionMeta}>{lots.length} piezas</Text>
        </View>

        <View style={styles.catalogList}>
          {lots.map((lot, index) => {
            const status = lotStatus(lot, currentLot?.id);
            return (
              <View key={lot.id} style={styles.lotCard}>
                <Image source={{ uri: resolveLotImage(lot.image_urls[0], index) }} style={styles.lotImage} />

                <View
                  style={[
                    styles.lotInfo,
                    status.tone === "live" && styles.lotInfoLive,
                    status.tone === "queue" && styles.lotInfoQueue,
                    status.tone === "soft" && styles.lotInfoSoft
                  ]}
                >
                  <View
                    style={[
                      styles.lotBadge,
                      status.tone === "queue" && styles.lotBadgeQueue,
                      status.tone === "soft" && styles.lotBadgeSoft
                    ]}
                  >
                    <Text
                      style={[
                        styles.lotBadgeText,
                        status.tone === "soft" && styles.lotBadgeTextSoft
                      ]}
                    >
                      {status.label}
                    </Text>
                  </View>

                  <Text style={styles.lotId}>{lot.piece_number}</Text>
                  <Text style={styles.lotTitle}>{lot.title}</Text>
                  <Text style={styles.lotDescription}>{lot.description}</Text>

                  <View style={styles.lotFooter}>
                    <Text style={styles.lotPrice}>Base {formatMoney(auction.currency, lot.base_price)}</Text>
                    {lot.current_bid ? (
                      <Text style={styles.lotCurrentBid}>Actual {formatMoney(auction.currency, lot.current_bid)}</Text>
                    ) : null}
                  </View>
                </View>

                {currentLot?.id === lot.id ? (
                  <View style={styles.bidPanel}>
                    <View style={styles.metricRow}>
                      <Metric label="Base" value={formatMoney(auction.currency, currentLot.base_price)} />
                      <Metric label="Actual" value={formatMoney(auction.currency, currentLot.current_bid ?? currentLot.base_price)} />
                    </View>
                    <View style={styles.metricRow}>
                      <Metric label="Minimo" value={formatMoney(auction.currency, currentLot.min_bid)} />
                      <Metric label="Maximo" value={currentLot.max_bid ? formatMoney(auction.currency, currentLot.max_bid) : "Sin limite"} />
                    </View>

                    {currentLot.story ? <Text style={styles.storyCopy}>{currentLot.story}</Text> : null}
                    {!currentLot.can_bid && currentLot.block_reason ? <Text style={styles.blockCopy}>{currentLot.block_reason}</Text> : null}

                    <TextInput
                      style={styles.bidInput}
                      keyboardType="numeric"
                      value={offerInput}
                      onChangeText={setOfferInput}
                      placeholder="Ingresa tu oferta"
                      placeholderTextColor={palette.textMuted}
                    />

                    <Pressable
                      style={[styles.bidButton, !currentLot.can_bid && styles.bidButtonDisabled]}
                      onPress={handleBid}
                    >
                      <Text style={styles.bidButtonText}>{currentLot.can_bid ? "Pujar por este lote" : "Ver motivo"}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24
  },
  loadingText: {
    color: palette.text,
    fontSize: 16
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    minHeight: 44
  },
  backArrowButton: {
    width: 42,
    height: 42,
    alignItems: "flex-start",
    justifyContent: "center"
  },
  backArrowText: {
    color: palette.ink,
    fontSize: 30,
    lineHeight: 30,
    fontWeight: "500"
  },
  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.backgroundSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.surface
  },
  topTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800"
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: palette.surfaceMuted,
    padding: 24,
    marginBottom: 22
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14
  },
  heroEyebrow: {
    color: palette.gold,
    textTransform: "uppercase",
    letterSpacing: 2.4,
    fontSize: 12,
    fontWeight: "800"
  },
  leaveAuctionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.ghost,
    backgroundColor: palette.surfaceWarm,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  leaveAuctionChipDisabled: {
    opacity: 0.65
  },
  leaveAuctionChipText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  heroTitle: {
    color: palette.white,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800"
  },
  heroMeta: {
    marginTop: 10,
    color: palette.text,
    lineHeight: 22
  },
  heroCopy: {
    marginTop: 12,
    color: palette.text,
    lineHeight: 22
  },
  sectionHead: {
    marginBottom: 14,
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800"
  },
  sectionMeta: {
    color: palette.textMuted,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: "700"
  },
  catalogList: {
    gap: 18
  },
  lotCard: {
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border
  },
  lotImage: {
    width: "100%",
    height: 240,
    backgroundColor: palette.surfaceWarm
  },
  lotInfo: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 8
  },
  lotInfoLive: {
    backgroundColor: "#3A3834"
  },
  lotInfoQueue: {
    backgroundColor: "#2A2826"
  },
  lotInfoSoft: {
    backgroundColor: "#26211D"
  },
  lotBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: palette.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 6
  },
  lotBadgeQueue: {
    backgroundColor: palette.surfaceMuted
  },
  lotBadgeSoft: {
    backgroundColor: palette.ghost
  },
  lotBadgeText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  lotBadgeTextSoft: {
    color: palette.ink
  },
  lotId: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.6
  },
  lotTitle: {
    color: palette.white,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800"
  },
  lotDescription: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 24
  },
  lotFooter: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  lotPrice: {
    color: palette.white,
    fontSize: 15,
    fontWeight: "800"
  },
  lotCurrentBid: {
    color: palette.gold,
    fontSize: 15,
    fontWeight: "800"
  },
  bidPanel: {
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: palette.surface
  },
  metricRow: {
    flexDirection: "row",
    gap: 10
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: palette.backgroundSoft,
    padding: 14,
    gap: 6
  },
  metricLabel: {
    color: palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    fontSize: 11,
    fontWeight: "800"
  },
  metricValue: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800"
  },
  storyCopy: {
    color: palette.text,
    lineHeight: 22
  },
  blockCopy: {
    color: palette.accent,
    lineHeight: 22
  },
  bidInput: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.backgroundSoft,
    paddingHorizontal: 16,
    color: palette.ink,
    fontSize: 16
  },
  bidButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  bidButtonDisabled: {
    backgroundColor: palette.nav
  },
  bidButtonText: {
    color: palette.white,
    fontSize: 17,
    fontWeight: "800"
  }
});
