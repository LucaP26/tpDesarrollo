import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import {
  catalogDescription,
  categoryEyebrow,
  categoryOrder,
  formatEventDate,
  memberLabel,
  profileAvatar
} from "@/src/lib/luxury";
import { buildRestrictionAlert } from "@/src/lib/restrictions";
import { useSession } from "@/src/lib/session";
import { palette } from "@/src/lib/theme";
import { AuctionSummary } from "@/src/lib/types";

type AuctionCard = AuctionSummary & {
  lotsAvailable: number;
};

export default function AuctionsScreen() {
  const router = useRouter();
  const { token, user } = useSession();
  const [search, setSearch] = useState("");
  const [cards, setCards] = useState<AuctionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadAuctions(activeRef?: { current: boolean }) {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setErrorMessage(null);
      const auctions = await api.listAuctions(token);
      const details = auctions
        .map((auction) => ({
          ...auction,
          lotsAvailable: auction.remaining_lots || auction.total_lots
        }))
        .sort((left, right) => categoryOrder[left.category] - categoryOrder[right.category]);

      if (!activeRef || activeRef.current) {
        setCards(details);
      }
    } catch (error) {
      if (!activeRef || activeRef.current) {
        setCards([]);
        setErrorMessage(error instanceof Error ? error.message : "No pudimos cargar los catalogos.");
      }
    } finally {
      if (!activeRef || activeRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const active = { current: true };
    setLoading(true);
    loadAuctions(active);
    return () => {
      active.current = false;
    };
  }, [token]);

  const filteredCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return cards;
    }

    return cards.filter((item) =>
      [
        item.title,
        item.location,
        item.auctioneer_name,
        item.preview_lot_title ?? "",
        item.category,
        memberLabel(item.category),
        categoryEyebrow(item.category)
      ].some((value) => value.toLowerCase().includes(query))
    );
  }, [cards, search]);

  function handleOpenCatalog(item: AuctionCard) {
    if (!item.can_view_catalog) {
      const alert = buildRestrictionAlert(item.view_block_reason, "catalogo");
      Alert.alert(alert.title, alert.message);
      return;
    }

    router.push({
      pathname: "/auction/[id]",
      params: { id: String(item.id) }
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push("/(tabs)/home")} style={styles.iconButton}>
            <Feather name="menu" size={24} color={palette.accent} />
          </Pressable>
          <Text style={styles.title}>Catalogos</Text>
          <Pressable onPress={() => router.push("/(tabs)/profile")} style={styles.profileButton}>
            <Image source={{ uri: profileAvatar(user?.avatar_image_url, user?.email ?? "profile@luxury.local") }} style={styles.profileImage} />
          </Pressable>
        </View>

        <View style={styles.searchBar}>
          <Feather name="search" color={palette.nav} size={22} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar catalogos o categorias"
            placeholderTextColor={palette.textMuted}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.sectionHead}>
          <View style={styles.sectionCopyWrap}>
            <Text style={styles.sectionEyebrow}>Una sala por categoria</Text>
            <Text style={styles.sectionTitle}>Catalogos curados</Text>
          </View>
          <Pressable onPress={() => setSearch("")}>
            <Text style={styles.filterLabel}>Limpiar</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={palette.accent} />
          </View>
        ) : (
          <View style={styles.cardList}>
            {errorMessage ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>No pudimos cargar las subastas</Text>
                <Text style={styles.errorCopy}>{errorMessage}</Text>
                <Pressable
                  style={styles.retryButton}
                  onPress={() => {
                    setLoading(true);
                    loadAuctions();
                  }}
                >
                  <Text style={styles.retryButtonText}>Reintentar</Text>
                </Pressable>
              </View>
            ) : null}

            {filteredCards.map((item) => {
              const accessCopy = item.can_view_catalog
                ? `${item.lotsAvailable} lotes listos para sala`
                : `Requiere categoria ${memberLabel(item.category)}`;

              return (
                <Pressable
                  key={item.id}
                  style={[styles.catalogCard, !item.can_view_catalog && styles.catalogCardLocked]}
                  onPress={() => handleOpenCatalog(item)}
                >
                  <View style={styles.catalogTopRow}>
                    <Text style={styles.catalogCategory}>{categoryEyebrow(item.category)}</Text>
                    <Text style={styles.catalogTopMeta}>{accessCopy}</Text>
                  </View>

                  <Text style={styles.catalogTitle}>{item.title}</Text>
                  <Text style={styles.catalogMeta}>
                    {item.location} - {formatEventDate(item.scheduled_at)} - {item.auctioneer_name}
                  </Text>
                  <Text style={styles.catalogCopy}>{catalogDescription(item.category)}</Text>

                  <View style={styles.catalogBottomRow}>
                    <View style={styles.catalogBottomCopy}>
                      <Text style={styles.catalogBottomLabel}>Pieza destacada</Text>
                      <Text style={styles.catalogBottomValue}>{item.preview_lot_title ?? "Catalogo premium en preparacion"}</Text>
                    </View>
                    <View style={styles.catalogCategoryChip}>
                      <Text style={styles.catalogCategoryChipText}>{memberLabel(item.category)}</Text>
                    </View>
                  </View>

                  {!item.can_view_catalog ? (
                    <Text style={styles.catalogRestriction}>{item.view_block_reason ?? "Tu categoria actual no alcanza para abrir esta sala."}</Text>
                  ) : null}
                </Pressable>
              );
            })}

            {!filteredCards.length ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No encontramos catalogos con esa busqueda</Text>
                <Text style={styles.emptyCopy}>Prueba con la categoria de la sala o limpia la busqueda para volver a ver todas.</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 26
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    flex: 1,
    color: palette.ink,
    fontSize: 22,
    fontWeight: "800",
    marginLeft: 2
  },
  profileButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface
  },
  profileImage: {
    width: 34,
    height: 34,
    borderRadius: 17
  },
  searchBar: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: palette.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10
  },
  searchInput: {
    flex: 1,
    color: palette.ink,
    fontSize: 16
  },
  sectionHead: {
    marginTop: 22,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 14
  },
  sectionCopyWrap: {
    flex: 1
  },
  sectionEyebrow: {
    color: palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2.2,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -1.2,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  filterLabel: {
    color: palette.accent,
    fontSize: 16,
    fontWeight: "700"
  },
  loaderWrap: {
    paddingVertical: 42
  },
  cardList: {
    gap: 16
  },
  catalogCard: {
    borderRadius: 28,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: 22,
    paddingVertical: 22,
    gap: 14,
    shadowColor: palette.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  catalogCardLocked: {
    backgroundColor: palette.surfaceWarm
  },
  catalogTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  catalogCategory: {
    color: palette.gold,
    textTransform: "uppercase",
    letterSpacing: 2.6,
    fontSize: 12,
    fontWeight: "800"
  },
  catalogTopMeta: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.1
  },
  catalogTitle: {
    color: palette.white,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800"
  },
  catalogMeta: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 22
  },
  catalogCopy: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 24
  },
  catalogBottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16
  },
  catalogBottomCopy: {
    flex: 1,
    gap: 4
  },
  catalogBottomLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.6
  },
  catalogBottomValue: {
    color: palette.white,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700"
  },
  catalogCategoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.ghost,
    backgroundColor: palette.goldSoft,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  catalogCategoryChipText: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2
  },
  catalogRestriction: {
    color: palette.danger,
    fontSize: 14,
    lineHeight: 21
  },
  emptyCard: {
    borderRadius: 20,
    backgroundColor: palette.backgroundSoft,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 22
  },
  errorCard: {
    borderRadius: 22,
    backgroundColor: palette.dangerSoft,
    borderWidth: 1,
    borderColor: palette.ghost,
    padding: 22,
    gap: 10
  },
  errorTitle: {
    color: palette.ink,
    fontSize: 19,
    fontWeight: "800"
  },
  errorCopy: {
    color: palette.text,
    lineHeight: 22
  },
  retryButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: palette.accent,
    paddingHorizontal: 18,
    paddingVertical: 11,
    marginTop: 4
  },
  retryButtonText: {
    color: palette.onAccent,
    fontSize: 14,
    fontWeight: "800"
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8
  },
  emptyCopy: {
    color: palette.text,
    lineHeight: 22
  }
});
