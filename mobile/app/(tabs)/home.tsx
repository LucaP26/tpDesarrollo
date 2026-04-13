import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

const departments = [
  { label: "Arte", icon: "image" as const },
  { label: "Relojes", icon: "clock" as const },
  { label: "Joyas", icon: "star" as const },
  { label: "Diseno", icon: "grid" as const },
  { label: "Coleccion", icon: "hexagon" as const }
];

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
        if (active) {
          setFeaturedCards(fallbackFeaturedCards());
          setLoading(false);
        }
        return;
      }

      try {
        const auctions = await api.listAuctions(token);
        const nextCards = await Promise.all(
          auctions.slice(0, 4).map(async (auction, index) => {
            const fallback = homeShowcase[index % homeShowcase.length];

            try {
              const detail = await api.getAuction(token, auction.id);
              const firstLot = detail.lots[0];
              return {
                auctionId: auction.id,
                title: firstLot?.title ?? fallback.title,
                subtitle: firstLot?.story ?? detail.location,
                badge: auction.best_offer ? "Cierre activo" : fallback.badge,
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
                badge: auction.best_offer ? "Cierre activo" : fallback.badge,
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
  const cardsToDisplay = useMemo(() => (featuredCards.length ? featuredCards : fallbackFeaturedCards()), [featuredCards]);
  const heroCard = cardsToDisplay[0];
  const closingCards = (cardsToDisplay.length > 1 ? cardsToDisplay.slice(1) : cardsToDisplay).slice(0, 3);

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
        <View style={styles.topBar}>
          <View style={styles.brandBlock}>
            <Text style={styles.brand}>ATELIER</Text>
            <Text style={styles.brandCaption}>Casa privada de subastas</Text>
          </View>

          <View style={styles.memberBlock}>
            <View>
              <Text style={styles.memberEyebrow}>Categoria</Text>
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

        <Pressable style={styles.heroCard} onPress={() => handleFeaturedPress(heroCard)}>
          <ImageBackground source={{ uri: heroCard.image }} style={styles.heroImage} imageStyle={styles.heroImageRadius}>
            <View style={styles.heroOverlay} />
            <View style={styles.heroShade} />

            <View style={styles.heroContent}>
              <Text style={styles.heroEyebrow}>Subasta en vivo · lote destacado</Text>
              <Text style={styles.heroTitle}>{heroCard.title}</Text>
              <Text style={styles.heroSubtitle}>{heroCard.subtitle}</Text>

              <View style={styles.heroStats}>
                <View style={styles.heroStatCard}>
                  <Text style={styles.heroStatLabel}>Oferta actual</Text>
                  <Text style={styles.heroStatValue}>{heroCard.price}</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStatCard}>
                  <Text style={styles.heroStatLabel}>Acceso</Text>
                  <Text style={styles.heroStatValueSmall}>{heroCard.canViewCatalog ? "Disponible" : "Restringido"}</Text>
                </View>
              </View>
            </View>
          </ImageBackground>
        </Pressable>

        <View style={styles.departmentsSection}>
          <Text style={styles.sectionEyebrow}>Departamentos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.departmentsRow}>
            {departments.map((item) => (
              <View key={item.label} style={styles.departmentItem}>
                <View style={styles.departmentBubble}>
                  <Feather name={item.icon} size={20} color={palette.accent} />
                </View>
                <Text style={styles.departmentLabel}>{item.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionEyebrow}>Cierres proximos</Text>
          <Pressable onPress={() => router.push("/(tabs)/auctions")}>
            <Text style={styles.sectionLink}>Ver todos</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loaderBlock}>
            <ActivityIndicator color={palette.accent} />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.closingRow}>
            {closingCards.map((card, index) => (
              <Pressable key={`${card.title}-${index}`} style={styles.closingCard} onPress={() => handleFeaturedPress(card)}>
                <ImageBackground source={{ uri: card.image }} style={styles.closingImage} imageStyle={styles.closingImageRadius}>
                  <View style={styles.closingBadge}>
                    <Text style={styles.closingBadgeText}>{index === 0 ? "Live" : "Curado"}</Text>
                  </View>
                  <View style={styles.closingEye}>
                    <Feather name="eye" size={16} color={palette.ink} />
                  </View>
                </ImageBackground>

                <View style={styles.closingBody}>
                  <Text style={styles.closingMeta}>Coleccion privada</Text>
                  <Text style={styles.closingTitle}>{card.title}</Text>
                  <Text style={styles.closingCopy}>{card.subtitle}</Text>

                  <View style={styles.closingFooter}>
                    <View>
                      <Text style={styles.closingFooterLabel}>Oferta actual</Text>
                      <Text style={styles.closingFooterValue}>{card.price}</Text>
                    </View>
                    <Text style={styles.closingFooterTime}>{index === 0 ? "Finaliza hoy" : "Proximo evento"}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Pressable style={styles.catalogCard} onPress={() => router.push("/(tabs)/auctions")}>
          <View style={styles.catalogCopyBlock}>
            <Text style={styles.catalogEyebrow}>Vista privada</Text>
            <Text style={styles.catalogTitle}>Ver catalogos</Text>
            <Text style={styles.catalogCopy}>Explora salas en vivo y catalogos programados elegidos para {firstName}.</Text>
          </View>

          <View style={styles.catalogArrow}>
            <Feather name="arrow-right" color={palette.onAccent} size={28} />
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

        <View style={styles.editorialCard}>
          <Text style={styles.editorialEyebrow}>Mirada curatorial</Text>
          <Text style={styles.editorialTitle}>ATELIER protege procedencia, custodia y piezas de alta deseabilidad.</Text>
          <Text style={styles.editorialCopy}>
            Descubre catalogos premium, sigue la subasta activa y administra tu perfil de comprador desde una sola galeria privada.
          </Text>
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
    paddingBottom: 34
  },
  topBar: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 18
  },
  brandBlock: {
    flex: 1,
    gap: 6
  },
  brand: {
    color: palette.accent,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: 5,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  brandCaption: {
    color: palette.textMuted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 2
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
    letterSpacing: 1.8,
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
    backgroundColor: palette.goldSoft
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
  heroCard: {
    marginHorizontal: 18,
    borderRadius: 34,
    overflow: "hidden",
    backgroundColor: palette.surfaceMuted,
    minHeight: 560
  },
  heroImage: {
    minHeight: 560,
    justifyContent: "flex-end"
  },
  heroImageRadius: {
    borderRadius: 34
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(14, 14, 14, 0.22)"
  },
  heroShade: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: "58%",
    backgroundColor: "rgba(14, 14, 14, 0.52)"
  },
  heroContent: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 10
  },
  heroEyebrow: {
    color: palette.accent,
    textTransform: "uppercase",
    letterSpacing: 3,
    fontSize: 11,
    fontWeight: "800"
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 38,
    lineHeight: 42,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  heroSubtitle: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 280
  },
  heroStats: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 18
  },
  heroStatCard: {
    gap: 4
  },
  heroStatLabel: {
    color: palette.textMuted,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    fontWeight: "700"
  },
  heroStatValue: {
    color: palette.accent,
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  heroStatValueSmall: {
    color: palette.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700"
  },
  heroDivider: {
    width: 1,
    height: 42,
    backgroundColor: palette.border
  },
  departmentsSection: {
    marginTop: 28
  },
  departmentsRow: {
    paddingHorizontal: 22,
    paddingTop: 14,
    gap: 18
  },
  departmentItem: {
    width: 78,
    alignItems: "center",
    gap: 10
  },
  departmentBubble: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: palette.surfaceWarm,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center"
  },
  departmentLabel: {
    color: palette.textMuted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: "700",
    textAlign: "center"
  },
  sectionHead: {
    marginTop: 34,
    marginBottom: 18,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionEyebrow: {
    color: palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2.2,
    fontSize: 12,
    fontWeight: "800"
  },
  sectionLink: {
    color: palette.accent,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "700"
  },
  loaderBlock: {
    height: 260,
    alignItems: "center",
    justifyContent: "center"
  },
  closingRow: {
    paddingHorizontal: 22,
    gap: 18
  },
  closingCard: {
    width: 292,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border
  },
  closingImage: {
    height: 240,
    justifyContent: "space-between"
  },
  closingImageRadius: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24
  },
  closingBadge: {
    marginTop: 14,
    marginLeft: 14,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(215, 142, 119, 0.22)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  closingBadgeText: {
    color: palette.danger,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.6
  },
  closingEye: {
    alignSelf: "flex-end",
    marginRight: 14,
    marginBottom: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(28, 27, 27, 0.72)",
    alignItems: "center",
    justifyContent: "center"
  },
  closingBody: {
    padding: 20,
    gap: 8
  },
  closingMeta: {
    color: palette.textMuted,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: "700"
  },
  closingTitle: {
    color: palette.ink,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  closingCopy: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 44
  },
  closingFooter: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10
  },
  closingFooterLabel: {
    color: palette.textMuted,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: "700"
  },
  closingFooterValue: {
    marginTop: 4,
    color: palette.accent,
    fontSize: 20,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  closingFooterTime: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  catalogCard: {
    marginTop: 34,
    marginHorizontal: 22,
    borderRadius: 26,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 22,
    paddingVertical: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
  },
  catalogCopyBlock: {
    flex: 1
  },
  catalogEyebrow: {
    color: palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2.3,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 10
  },
  catalogTitle: {
    color: palette.ink,
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  catalogCopy: {
    marginTop: 10,
    color: palette.text,
    lineHeight: 22
  },
  catalogArrow: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  actionRow: {
    marginTop: 18,
    marginHorizontal: 22,
    flexDirection: "row",
    gap: 14
  },
  tile: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 22,
    alignItems: "center"
  },
  tileEyebrow: {
    color: palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2.2,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 8
  },
  tileTitle: {
    color: palette.ink,
    fontSize: 24,
    lineHeight: 28,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  editorialCard: {
    marginTop: 28,
    marginHorizontal: 22,
    borderRadius: 28,
    backgroundColor: palette.backgroundSoft,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 22,
    gap: 10
  },
  editorialEyebrow: {
    color: palette.accent,
    textTransform: "uppercase",
    letterSpacing: 2.4,
    fontSize: 11,
    fontWeight: "800"
  },
  editorialTitle: {
    color: palette.ink,
    fontSize: 27,
    lineHeight: 34,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  editorialCopy: {
    color: palette.text,
    lineHeight: 24
  }
});
