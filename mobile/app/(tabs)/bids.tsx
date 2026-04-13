import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as api from "@/src/lib/api";
import { ActiveAuction, Metrics, NotificationItem } from "@/src/lib/types";
import { browseArtwork, formatEventDate, formatMoney, memberLabel } from "@/src/lib/luxury";
import { useSession } from "@/src/lib/session";
import { palette } from "@/src/lib/theme";

function resolveActiveAuctionImage(source: string | null | undefined) {
  if (!source || source.includes("images.example.com")) {
    return browseArtwork[0];
  }
  return source;
}

export default function BidsScreen() {
  const router = useRouter();
  const { token, user } = useSession();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeAuction, setActiveAuction] = useState<ActiveAuction | null>(null);

  async function loadData() {
    if (!token) {
      return;
    }

    const [metricsResponse, notificationsResponse, activeAuctionResponse] = await Promise.all([
      api.getMetrics(token),
      api.listNotifications(token),
      api.getActiveAuction(token)
    ]);

    setMetrics(metricsResponse);
    setNotifications(notificationsResponse);
    setActiveAuction(activeAuctionResponse);
  }

  useEffect(() => {
    loadData().catch(() => undefined);
  }, [token]);

  function handleEnterActiveAuction() {
    if (!activeAuction) {
      return;
    }

    router.push({
      pathname: "/auction/[id]",
      params: { id: String(activeAuction.auction_id) }
    });
  }

  function confirmLeaveAuction() {
    if (!activeAuction || !token) {
      return;
    }

    Alert.alert(
      "Abandonar subasta",
      "Se eliminara tu ultima puja activa de esta sala y podras participar en otra subasta. Si ibas ganando, la mejor oferta volvera al siguiente postor.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Abandonar",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await api.leaveAuction(token, activeAuction.auction_id);
              await loadData();
              Alert.alert("Subasta abandonada", response.message);
            } catch (error) {
              Alert.alert("No se pudo abandonar la subasta", error instanceof Error ? error.message : "Error inesperado");
            }
          }
        }
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Centro de pujas</Text>
          <Text style={styles.heroTitle}>Pulso de subastas</Text>
          <Text style={styles.heroCopy}>
            Sigue tu actividad en vivo, los compromisos de pago y la sala en la que {user?.full_name.split(" ")[0] ?? "vos"} estas participando ahora.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Subasta en curso</Text>
            <Text style={styles.sectionLink}>{activeAuction ? "Activa" : "Sin participacion"}</Text>
          </View>

          {activeAuction ? (
            <View style={styles.activeAuctionCard}>
              <Image source={{ uri: resolveActiveAuctionImage(activeAuction.current_lot_image_url) }} style={styles.activeAuctionImage} />
              <View style={styles.activeAuctionBody}>
                <Text style={styles.activeAuctionCategory}>{memberLabel(activeAuction.category).toUpperCase()}</Text>
                <Text style={styles.activeAuctionTitle}>{activeAuction.title}</Text>
                <Text style={styles.activeAuctionLot}>{activeAuction.current_lot_title ?? "Lote en espera"}</Text>
                <Text style={styles.activeAuctionMeta}>
                  {activeAuction.location} - {formatEventDate(activeAuction.scheduled_at)}
                </Text>
                <View style={styles.activeAuctionStats}>
                  <View style={styles.activeAuctionStatCard}>
                    <Text style={styles.activeAuctionStatLabel}>Precio actual</Text>
                    <Text style={styles.activeAuctionStatValue}>
                      {activeAuction.current_price != null ? formatMoney(activeAuction.currency, activeAuction.current_price) : "Sin ofertas"}
                    </Text>
                  </View>
                  <View style={styles.activeAuctionStatCard}>
                    <Text style={styles.activeAuctionStatLabel}>Tu ultima puja</Text>
                    <Text style={styles.activeAuctionStatValue}>
                      {activeAuction.my_latest_bid != null ? formatMoney(activeAuction.currency, activeAuction.my_latest_bid) : "Aun no pujaste"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.activeAuctionStatus}>
                  {activeAuction.my_is_leading ? "Actualmente vas ganando este lote." : "Tu oferta ya no es la lider."}
                </Text>

                <View style={styles.activeAuctionActions}>
                  <Pressable style={styles.enterButton} onPress={handleEnterActiveAuction}>
                    <Text style={styles.enterButtonText}>Volver a la sala</Text>
                  </Pressable>
                  <Pressable style={styles.leaveButton} onPress={confirmLeaveAuction}>
                    <Text style={styles.leaveButtonText}>Abandonar</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No estas participando en ninguna subasta</Text>
              <Text style={styles.emptyCopy}>Cuando ingreses a una sala, aqui vas a poder seguirla y abandonarla si decides salir.</Text>
              <Pressable style={styles.emptyAction} onPress={() => router.push("/(tabs)/auctions")}>
                <Text style={styles.emptyActionText}>Explorar subastas</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.grid}>
          <MetricCard value={metrics?.active_bids ?? 0} label="Pujas activas" />
          <MetricCard value={metrics?.auctions_won ?? 0} label="Ganadas" />
          <MetricCard value={metrics ? formatMoney("ARS", metrics.total_amount_bid) : "$0"} label="Total ofertado" />
          <MetricCard value={metrics ? formatMoney("ARS", metrics.total_amount_paid) : "$0"} label="Total pagado" />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Alertas recientes</Text>
            <Text style={styles.sectionLink}>{notifications.filter((item) => !item.read).length} sin leer</Text>
          </View>

          <View style={styles.alertList}>
            {notifications.map((notification) => (
              <View key={notification.id} style={styles.alertCard}>
                <View style={styles.alertIcon}>
                  <Feather name={notification.read ? "bell" : "activity"} color={palette.accent} size={18} />
                </View>
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>{notification.title}</Text>
                  <Text style={styles.alertCopy}>{notification.message}</Text>
                  <Text style={styles.alertDate}>
                    {new Date(notification.created_at).toLocaleDateString("es-AR", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit"
                    })}
                  </Text>
                </View>
              </View>
            ))}
            {!notifications.length ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Todavia no hay alertas</Text>
                <Text style={styles.emptyCopy}>Las confirmaciones de puja y recordatorios de pago apareceran aqui.</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
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
    paddingBottom: 28,
    gap: 20
  },
  heroCard: {
    borderRadius: 28,
    padding: 24,
    backgroundColor: palette.surfaceMuted
  },
  heroEyebrow: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    marginBottom: 10
  },
  heroTitle: {
    color: palette.white,
    fontSize: 30,
    fontFamily: "Georgia",
    fontWeight: "700",
    marginBottom: 10
  },
  heroCopy: {
    color: palette.text,
    lineHeight: 22,
    fontSize: 15
  },
  section: {
    gap: 14
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800"
  },
  sectionLink: {
    color: palette.accent,
    fontWeight: "700"
  },
  activeAuctionCard: {
    borderRadius: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden"
  },
  activeAuctionImage: {
    width: "100%",
    height: 220,
    backgroundColor: palette.surfaceMuted
  },
  activeAuctionBody: {
    padding: 18,
    gap: 12
  },
  activeAuctionCategory: {
    color: palette.textMuted,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "800"
  },
  activeAuctionTitle: {
    color: palette.ink,
    fontSize: 24,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  activeAuctionLot: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "700"
  },
  activeAuctionMeta: {
    color: palette.textMuted,
    lineHeight: 22
  },
  activeAuctionStats: {
    flexDirection: "row",
    gap: 12
  },
  activeAuctionStatCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: palette.backgroundSoft,
    padding: 14
  },
  activeAuctionStatLabel: {
    color: palette.textMuted,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontWeight: "800",
    marginBottom: 8
  },
  activeAuctionStatValue: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800"
  },
  activeAuctionStatus: {
    color: palette.accent,
    lineHeight: 22
  },
  activeAuctionActions: {
    flexDirection: "row",
    gap: 12
  },
  enterButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  enterButtonText: {
    color: palette.onAccent,
    fontSize: 16,
    fontWeight: "800"
  },
  leaveButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: palette.surfaceWarm,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center"
  },
  leaveButtonText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14
  },
  metricCard: {
    width: "47%",
    minHeight: 120,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 18,
    justifyContent: "space-between"
  },
  metricValue: {
    color: palette.ink,
    fontSize: 24,
    lineHeight: 28,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  metricLabel: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.6
  },
  alertList: {
    gap: 12
  },
  alertCard: {
    borderRadius: 20,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 18,
    flexDirection: "row",
    gap: 14
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surfaceWarm,
    alignItems: "center",
    justifyContent: "center"
  },
  alertContent: {
    flex: 1
  },
  alertTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6
  },
  alertCopy: {
    color: palette.text,
    lineHeight: 22
  },
  alertDate: {
    marginTop: 8,
    color: palette.textMuted,
    fontSize: 12
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
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 8
  },
  emptyCopy: {
    color: palette.text,
    lineHeight: 22
  },
  emptyAction: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyActionText: {
    color: palette.onAccent,
    fontWeight: "800",
    fontSize: 16
  }
});
