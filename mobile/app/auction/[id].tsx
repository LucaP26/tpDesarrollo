import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { browseArtwork, formatEventDate, formatMoney, homeShowcase } from "@/src/lib/luxury";
import { buildRestrictionAlert } from "@/src/lib/restrictions";
import { useSession } from "@/src/lib/session";
import { palette } from "@/src/lib/theme";
import { AuctionDetail } from "@/src/lib/types";

function resolveLotImage(source: string | undefined, index: number) {
  if (!source || source.includes("images.example.com")) {
    if (index < homeShowcase.length) {
      return homeShowcase[index].image;
    }
    return browseArtwork[index % browseArtwork.length];
  }
  return source;
}

export default function AuctionRoomScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const auctionId = Number(params.id);
  const { token, updateUser } = useSession();
  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [offers, setOffers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

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
        const nextOffers: Record<number, string> = {};
        detail.lots.forEach((lot) => {
          nextOffers[lot.id] = String(lot.min_bid);
        });
        setOffers(nextOffers);
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
  }, [auctionId, token]);

  async function handleBid(lotId: number) {
    if (!token || !auction) {
      return;
    }

    const selectedLot = auction.lots.find((lot) => lot.id === lotId);
    if (!selectedLot?.can_bid) {
      const alert = buildRestrictionAlert(selectedLot?.block_reason, "puja");
      Alert.alert(alert.title, alert.message);
      return;
    }

    const amount = Number((offers[lotId] ?? "").replace(",", ".").trim());
    if (Number.isNaN(amount)) {
      Alert.alert("Monto invalido", "Ingresa un monto numerico valido para continuar.");
      return;
    }
    if (amount < selectedLot.min_bid) {
      Alert.alert(
        "Monto inferior al minimo",
        `La oferta ingresada es menor al minimo admitido para este lote.\n\nMinimo permitido: ${formatMoney(auction.currency, selectedLot.min_bid)}.`
      );
      return;
    }
    if (selectedLot.max_bid !== null && selectedLot.max_bid !== undefined && amount > selectedLot.max_bid) {
      Alert.alert(
        "Monto superior al maximo",
        `La oferta ingresada es mayor al maximo admitido para este lote.\n\nMaximo permitido: ${formatMoney(auction.currency, selectedLot.max_bid)}.`
      );
      return;
    }

    try {
      await api.placeBid(token, auction.id, lotId, amount);
      const refreshed = await api.getAuction(token, auction.id);
      setAuction(refreshed);
      setOffers((current) => ({
        ...current,
        [lotId]: String(refreshed.lots.find((lot) => lot.id === lotId)?.min_bid ?? amount)
      }));
      Alert.alert("Puja confirmada", "Tu oferta se registro correctamente.");
    } catch (error) {
      Alert.alert("No se pudo registrar la puja", error instanceof Error ? error.message : "Error inesperado");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Cargando sala de subasta...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!auction) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>No se encontro la subasta.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" color={palette.ink} size={22} />
          </Pressable>
          <Text style={styles.topTitle}>Sala de subasta</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>{auction.category.toUpperCase()}</Text>
          <Text style={styles.heroTitle}>{auction.title}</Text>
          <Text style={styles.heroMeta}>
            {auction.location} - {formatEventDate(auction.scheduled_at)} - {auction.auctioneer_name}
          </Text>
          <Text style={styles.heroCopy}>
            Catalogo en vivo con validacion de pujas, limites minimos y maximos, y reglas por categoria.
          </Text>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Lotes</Text>
          <Text style={styles.sectionMeta}>{auction.lots.length} piezas</Text>
        </View>

        <View style={styles.lotList}>
          {auction.lots.map((lot, index) => (
            <View key={lot.id} style={styles.lotCard}>
              <Image source={{ uri: resolveLotImage(lot.image_urls[0], index) }} style={styles.lotImage} />
              <View style={styles.lotContent}>
                <View style={styles.lotHeader}>
                  <View style={styles.lotHeaderText}>
                    <Text style={styles.lotPiece}>{lot.piece_number}</Text>
                    <Text style={styles.lotTitle}>{lot.title}</Text>
                  </View>
                  <View style={[styles.stateBadge, !lot.can_bid && styles.stateBadgeMuted]}>
                    <Text style={styles.stateBadgeText}>{lot.can_bid ? "Abierta" : "Restringida"}</Text>
                  </View>
                </View>

                <Text style={styles.lotDescription}>{lot.description}</Text>
                {lot.story ? <Text style={styles.lotStory}>{lot.story}</Text> : null}

                <View style={styles.metricRow}>
                  <Metric label="Base" value={formatMoney(auction.currency, lot.base_price)} />
                  <Metric label="Actual" value={formatMoney(auction.currency, lot.current_bid ?? lot.base_price)} />
                </View>
                <View style={styles.metricRow}>
                  <Metric label="Puja minima" value={formatMoney(auction.currency, lot.min_bid)} />
                  <Metric label="Puja maxima" value={lot.max_bid ? formatMoney(auction.currency, lot.max_bid) : "Sin limite"} />
                </View>

                {!lot.can_bid && lot.block_reason ? <Text style={styles.blockCopy}>{lot.block_reason}</Text> : null}

                <TextInput
                  style={styles.bidInput}
                  keyboardType="numeric"
                  value={offers[lot.id]}
                  onChangeText={(text) => setOffers((current) => ({ ...current, [lot.id]: text }))}
                  placeholder="Ingresa tu oferta"
                  placeholderTextColor={palette.textMuted}
                />

                <Pressable
                  style={[styles.bidButton, !lot.can_bid && styles.bidButtonDisabled]}
                  onPress={() => handleBid(lot.id)}
                >
                  <Text style={styles.bidButtonText}>{lot.can_bid ? "Pujar" : "Ver motivo"}</Text>
                </Pressable>
              </View>
            </View>
          ))}
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
    paddingTop: 12,
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
    marginBottom: 18
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center"
  },
  topTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800"
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: "#151515",
    padding: 24,
    marginBottom: 22
  },
  heroEyebrow: {
    color: palette.gold,
    textTransform: "uppercase",
    letterSpacing: 2.4,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 10
  },
  heroTitle: {
    color: palette.white,
    fontSize: 30,
    lineHeight: 34,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  heroMeta: {
    marginTop: 10,
    color: "rgba(255,255,255,0.78)",
    lineHeight: 22
  },
  heroCopy: {
    marginTop: 12,
    color: "rgba(255,255,255,0.66)",
    lineHeight: 22
  },
  sectionHead: {
    marginBottom: 14,
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
  lotList: {
    gap: 16
  },
  lotCard: {
    borderRadius: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden"
  },
  lotImage: {
    width: "100%",
    height: 220,
    backgroundColor: palette.surfaceMuted
  },
  lotContent: {
    padding: 18,
    gap: 14
  },
  lotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start"
  },
  lotHeaderText: {
    flex: 1
  },
  lotPiece: {
    color: palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 6
  },
  lotTitle: {
    color: palette.ink,
    fontSize: 22,
    lineHeight: 26,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  stateBadge: {
    borderRadius: 999,
    backgroundColor: palette.goldSoft,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  stateBadgeMuted: {
    backgroundColor: palette.surfaceWarm
  },
  stateBadgeText: {
    color: palette.gold,
    textTransform: "uppercase",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1
  },
  lotDescription: {
    color: palette.text,
    lineHeight: 22
  },
  lotStory: {
    color: palette.textMuted,
    lineHeight: 22
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
