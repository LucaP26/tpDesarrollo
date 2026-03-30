import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as api from "@/src/lib/api";
import { formatMoney, homeShowcase, memberLabel, profileAvatar } from "@/src/lib/luxury";
import { buildRestrictionAlert } from "@/src/lib/restrictions";
import { useSession } from "@/src/lib/session";
import { palette } from "@/src/lib/theme";

type FeaturedCard = {
  auctionId?: number;
  title: string;
  subtitle: string;
  badge: string;
  price: string;
  image: string;
  canViewCatalog: boolean;
  viewBlockReason?: string | null;
};

function resolveFeatureImage(source: string | undefined, fallback: string) {
  if (!source || source.includes("images.example.com")) {
    return fallback;
  }
  return source;
}

function fallbackFeaturedCards(): FeaturedCard[] {
  return homeShowcase.map((item) => ({
    ...item,
    canViewCatalog: true,
    viewBlockReason: null
  }));
}

export default function HomeScreen() {
  const router = useRouter();
  const { token, user } = useSession();
  const [featuredCards, setFeaturedCards] = useState<FeaturedCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadFeatured() {
      if (!token) {
        return;
      }

      try {
        const auctions = await api.listAuctions(token);
        const nextCards = await Promise.all(
          auctions.slice(0, 2).map(async (auction, index) => {
            const fallback = homeShowcase[index % homeShowcase.length];

            try {
              const detail = await api.getAuction(token, auction.id);
              const firstLot = detail.lots[0];
              return {
                auctionId: auction.id,
                title: firstLot?.title ?? fallback.title,
                subtitle: firstLot?.story ?? detail.location,
                badge: auction.best_offer ? "Cierra pronto" : fallback.badge,
                price: formatMoney(detail.currency, firstLot?.current_bid ?? firstLot?.base_price ?? auction.best_offer),
                image: resolveFeatureImage(firstLot?.image_urls[0], fallback.image),
                canViewCatalog: auction.can_view_catalog,
                viewBlockReason: auction.view_block_reason
              };
            } catch {
              return {
                auctionId: auction.id,
                title: auction.current_lot_title ?? fallback.title,
                subtitle: auction.title,
                badge: auction.best_offer ? "Cierra pronto" : fallback.badge,
                price: formatMoney(auction.currency, auction.best_offer),
                image: fallback.image,
                canViewCatalog: auction.can_view_catalog,
                viewBlockReason: auction.view_block_reason
              };
            }
          })
        );

        if (active) {
          setFeaturedCards(nextCards.length ? nextCards : fallbackFeaturedCards());
        }
      } catch {
        if (active) {
          setFeaturedCards(fallbackFeaturedCards());
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadFeatured();
    return () => {
      active = false;
    };
  }, [token]);

  const firstName = user?.full_name.split(" ")[0] ?? "Miembro";
  const avatarUri = profileAvatar(user?.avatar_image_url, user?.email ?? "guest@luxury.local");

  function handleFeaturedPress(card: FeaturedCard) {
    if (!card.auctionId) {
      router.push("/(tabs)/auctions");
      return;
    }
    if (!card.canViewCatalog) {
      const alert = buildRestrictionAlert(card.viewBlockReason, "catalogo");
      Alert.alert(alert.title, alert.message);
      return;
    }
    router.push(`/auction/${card.auctionId}`);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.brand}>ELITE</Text>
          <View style={styles.memberBlock}>
            <View>
              <Text style={styles.memberEyebrow}>Categoría</Text>
              <Text style={styles.memberValue}>{memberLabel(user?.category)}</Text>
            </View>
            <Pressable style={styles.avatarWrap} onPress={() => router.push("/(tabs)/profile")}>
              <View style={styles.avatarRing}>
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              </View>
              <View style={styles.presenceDot} />
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.eyebrow}>Subastas destacadas</Text>
            <Text style={styles.sectionTitle}>Piezas seleccionadas</Text>
          </View>
          <View style={styles.pager}>
            <View style={styles.pagerActive} />
            <View style={styles.pagerDot} />
            <View style={styles.pagerDot} />
          </View>
        </View>

        {loading ? (
          <View style={styles.loaderBlock}>
            <ActivityIndicator color={palette.accent} />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
            {featuredCards.map((card, index) => (
              <Pressable
                key={`${card.title}-${index}`}
                style={styles.featureCard}
                onPress={() => handleFeaturedPress(card)}
              >
                <ImageBackground source={{ uri: card.image }} style={styles.featureImage} imageStyle={styles.featureImageRadius}>
                  <View style={styles.overlay} />
                  <View style={styles.featureContent}>
                    <Text style={styles.badge}>{card.badge}</Text>
                    <Text style={styles.featureTitle}>{card.title}</Text>
                    <Text style={styles.featureSubtitle}>{card.subtitle}</Text>
                    <Text style={styles.featurePrice}>{card.price}</Text>
                  </View>
                </ImageBackground>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Pressable style={styles.catalogCard} onPress={() => router.push("/(tabs)/auctions")}>
          <View>
            <Text style={styles.catalogEyebrow}>Descubrir</Text>
            <Text style={styles.catalogTitle}>Ver catalogo</Text>
            <Text style={styles.catalogCopy}>Explora salas en vivo y catalogos programados elegidos para {firstName}.</Text>
          </View>
          <View style={styles.catalogArrow}>
            <Feather name="arrow-right" color={palette.gold} size={34} />
          </View>
        </Pressable>

        <View style={styles.actionRow}>
          <Pressable style={styles.tile} onPress={() => router.push("/(tabs)/auctions")}>
            <Text style={styles.tileEyebrow}>En vivo</Text>
            <Text style={styles.tileTitle}>Subastas</Text>
          </Pressable>
          <Pressable style={styles.tile} onPress={() => router.push("/(tabs)/sell")}>
            <Text style={styles.tileEyebrow}>Privadas</Text>
            <Text style={styles.tileTitle}>Ventas</Text>
          </Pressable>
        </View>

        <View style={styles.trustRow}>
          <Text style={styles.trustText}>Autenticidad garantizada</Text>
          <Text style={styles.trustText}>Custodia segura</Text>
        </View>
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
    paddingBottom: 24
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24
  },
  brand: {
    fontSize: 48,
    lineHeight: 48,
    letterSpacing: -3,
    color: palette.ink,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  memberBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  memberEyebrow: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 2,
    textAlign: "right"
  },
  memberValue: {
    color: palette.gold,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "800",
    textAlign: "right"
  },
  avatarWrap: {
    position: "relative"
  },
  avatarRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 3,
    backgroundColor: palette.gold
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 29,
    backgroundColor: palette.surface
  },
  presenceDot: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.success,
    borderWidth: 3,
    borderColor: palette.backgroundSoft
  },
  sectionHead: {
    paddingHorizontal: 24,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between"
  },
  eyebrow: {
    color: palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 3,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -1.4,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 8
  },
  pagerActive: {
    width: 42,
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.gold
  },
  pagerDot: {
    width: 14,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#D9DDE4"
  },
  loaderBlock: {
    height: 420,
    alignItems: "center",
    justifyContent: "center"
  },
  carousel: {
    paddingHorizontal: 24,
    gap: 18
  },
  featureCard: {
    width: 330,
    height: 420,
    borderRadius: 34,
    overflow: "hidden"
  },
  featureImage: {
    flex: 1,
    justifyContent: "flex-end"
  },
  featureImageRadius: {
    borderRadius: 34
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 10, 0.24)"
  },
  featureContent: {
    paddingHorizontal: 24,
    paddingBottom: 26
  },
  badge: {
    alignSelf: "flex-start",
    marginBottom: 18,
    backgroundColor: palette.gold,
    color: palette.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: "800",
    overflow: "hidden",
    textTransform: "uppercase"
  },
  featureTitle: {
    color: palette.white,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -1.3,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  featureSubtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
    lineHeight: 22
  },
  featurePrice: {
    marginTop: 16,
    color: palette.gold,
    fontSize: 20,
    fontWeight: "800"
  },
  catalogCard: {
    marginTop: 34,
    marginHorizontal: 24,
    borderRadius: 28,
    backgroundColor: "#1E1D1D",
    paddingHorizontal: 24,
    paddingVertical: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18
  },
  catalogEyebrow: {
    color: "rgba(255,255,255,0.56)",
    textTransform: "uppercase",
    letterSpacing: 3,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 10
  },
  catalogTitle: {
    color: palette.white,
    fontSize: 24,
    lineHeight: 26,
    letterSpacing: -1,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  catalogCopy: {
    marginTop: 10,
    color: "rgba(255,255,255,0.64)",
    lineHeight: 22,
    maxWidth: 220
  },
  catalogArrow: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(211, 171, 47, 0.16)",
    alignItems: "center",
    justifyContent: "center"
  },
  actionRow: {
    marginTop: 18,
    marginHorizontal: 24,
    flexDirection: "row",
    gap: 14
  },
  tile: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: palette.backgroundSoft,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 22,
    alignItems: "center"
  },
  tileEyebrow: {
    color: palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2.2,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8
  },
  tileTitle: {
    color: palette.ink,
    fontSize: 24,
    lineHeight: 26,
    letterSpacing: -1,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  trustRow: {
    marginTop: 34,
    flexDirection: "row",
    justifyContent: "center",
    gap: 24
  },
  trustText: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5
  }
});
