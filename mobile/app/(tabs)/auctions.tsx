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
import { browseArtwork, browseStatus, formatEventDate, memberLabel, profileAvatar } from "@/src/lib/luxury";
import { buildRestrictionAlert } from "@/src/lib/restrictions";
import { useSession } from "@/src/lib/session";
import { palette } from "@/src/lib/theme";
import { AuctionSummary } from "@/src/lib/types";

type AuctionCard = AuctionSummary & {
  image: string;
  lotsAvailable: number;
};

function resolveArtwork(index: number) {
  return browseArtwork[index % browseArtwork.length];
}

function resolveAuctionImage(source: string | undefined, index: number) {
  if (!source || source.includes("images.example.com")) {
    return resolveArtwork(index);
  }
  return source;
}

export default function AuctionsScreen() {
  const router = useRouter();
  const { token, user } = useSession();
  const [search, setSearch] = useState("");
  const [cards, setCards] = useState<AuctionCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadAuctions() {
      if (!token) {
        return;
      }

      try {
        const auctions = await api.listAuctions(token);
        const details = await Promise.all(
          auctions.map(async (auction, index) => {
            try {
              const detail = await api.getAuction(token, auction.id);
              return {
                ...auction,
                image: resolveAuctionImage(detail.lots[0]?.image_urls[0], index),
                lotsAvailable: detail.lots.length
              };
            } catch {
              return {
                ...auction,
                image: resolveArtwork(index),
                lotsAvailable: auction.can_view_catalog ? 24 + index * 12 : 0
              };
            }
          })
        );

        if (active) {
          setCards(details);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAuctions();
    return () => {
      active = false;
    };
  }, [token]);

  const filteredCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return cards;
    }
    return cards.filter((item) =>
      [item.title, item.location, item.current_lot_title ?? "", item.category, memberLabel(item.category)].some((value) =>
        value.toLowerCase().includes(query)
      )
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
          <Text style={styles.title}>Subastas</Text>
          <Pressable onPress={() => router.push("/(tabs)/profile")} style={styles.profileButton}>
            <Image source={{ uri: profileAvatar(user?.avatar_image_url, user?.email ?? "profile@luxury.local") }} style={styles.profileImage} />
          </Pressable>
        </View>

        <View style={styles.searchBar}>
          <Feather name="search" color={palette.nav} size={22} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar lotes, artistas, marcas o categorias"
            placeholderTextColor={palette.textMuted}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Categorias destacadas</Text>
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
            {filteredCards.map((item, index) => {
              const status = browseStatus(item.best_offer, index);
              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.imageWrap}>
                    <Image source={{ uri: item.image }} style={styles.cardImage} />
                    <View style={[styles.badge, status.tone === "slate" && styles.badgeSlate]}>
                      <Text style={styles.badgeText}>{status.tone === "accent" ? "Activa" : `Desde ${formatEventDate(item.scheduled_at)}`}</Text>
                    </View>
                  </View>
                  <View style={styles.cardFooter}>
                    <View style={styles.cardMeta}>
                      <Text style={styles.cardTitle}>{item.current_lot_title ?? item.title}</Text>
                      <Text style={styles.cardSubtitle}>
                        {item.can_view_catalog ? `${item.lotsAvailable} lotes disponibles` : "Catalogo restringido para tu categoria"}
                      </Text>
                      <Text style={styles.cardDate}>{item.location}</Text>
                    </View>
                    <Pressable
                      style={[styles.catalogButton, !item.can_view_catalog && styles.catalogButtonDisabled]}
                      onPress={() => handleOpenCatalog(item)}
                    >
                      <Text style={styles.catalogButtonText}>
                        {item.can_view_catalog ? "Ver catalogo" : `Categoria ${memberLabel(item.category)}`}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            {!filteredCards.length ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No hay subastas coincidentes</Text>
                <Text style={styles.emptyCopy}>Prueba con otra palabra o limpia la busqueda para ver las salas programadas.</Text>
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
    borderColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceWarm
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
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800"
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
  card: {
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
    shadowColor: palette.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  imageWrap: {
    position: "relative"
  },
  cardImage: {
    width: "100%",
    height: 260,
    backgroundColor: palette.surfaceMuted
  },
  badge: {
    position: "absolute",
    top: 14,
    left: 14,
    borderRadius: 8,
    backgroundColor: palette.accent,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  badgeSlate: {
    backgroundColor: "#5E6778"
  },
  badgeText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  cardFooter: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between"
  },
  cardMeta: {
    flex: 1
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    marginBottom: 4
  },
  cardSubtitle: {
    color: palette.text,
    fontSize: 16
  },
  cardDate: {
    marginTop: 4,
    color: palette.textMuted,
    fontSize: 14
  },
  catalogButton: {
    borderRadius: 12,
    backgroundColor: palette.accent,
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  catalogButtonDisabled: {
    backgroundColor: palette.nav
  },
  catalogButtonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: "800"
  },
  emptyCard: {
    borderRadius: 20,
    backgroundColor: palette.backgroundSoft,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 22
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
