import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as api from "@/src/lib/api";
import { formatMoney } from "@/src/lib/luxury";
import { useSession } from "@/src/lib/session";
import { palette } from "@/src/lib/theme";
import { Metrics, NotificationItem } from "@/src/lib/types";

export default function BidsScreen() {
  const router = useRouter();
  const { token, user } = useSession();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!token) {
      return;
    }

    api.getMetrics(token).then(setMetrics);
    api.listNotifications(token).then(setNotifications);
  }, [token]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Centro de pujas</Text>
          <Text style={styles.heroTitle}>Pulso de subastas</Text>
          <Text style={styles.heroCopy}>
            Sigue tu actividad en vivo, los compromisos de pago y las salas en las que {user?.full_name.split(" ")[0] ?? "vos"} estas participando ahora.
          </Text>
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

        <Pressable style={styles.focusCard} onPress={() => router.push("/(tabs)/auctions")}>
          <View>
            <Text style={styles.focusEyebrow}>Listo para competir</Text>
            <Text style={styles.focusTitle}>Entrar a la siguiente sala</Text>
          </View>
          <Feather name="arrow-right" color={palette.gold} size={28} />
        </Pressable>
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
    backgroundColor: "#171717"
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.56)",
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
    color: "rgba(255,255,255,0.75)",
    lineHeight: 22,
    fontSize: 15
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
  focusCard: {
    borderRadius: 24,
    backgroundColor: palette.goldSoft,
    paddingHorizontal: 22,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  focusEyebrow: {
    color: palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8
  },
  focusTitle: {
    color: palette.ink,
    fontSize: 22,
    fontFamily: "Georgia",
    fontWeight: "700"
  }
});
