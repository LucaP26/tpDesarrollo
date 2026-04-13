import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as api from "@/src/lib/api";
import { useSession } from "@/src/lib/session";
import { palette } from "@/src/lib/theme";
import { Consignment } from "@/src/lib/types";

export default function SellScreen() {
  const router = useRouter();
  const { token } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState("");
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    api.listConsignments(token).then(setConsignments);
  }, [token]);

  async function handleSubmit() {
    if (!token) {
      return;
    }

    const photoList = photos
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (photoList.length < 6) {
      Alert.alert("Se necesitan mas imagenes", "Incluye al menos 6 URLs de fotos para la revision de la consignacion.");
      return;
    }

    try {
      setSubmitting(true);
      const created = await api.createConsignment(token, {
        title,
        description,
        photos: photoList
      });
      setConsignments((current) => [created, ...current]);
      setTitle("");
      setDescription("");
      setPhotos("");
      Alert.alert("Consignacion enviada", "Nuestros especialistas revisaran la pieza y te avisaran en la app.");
    } catch (error) {
      Alert.alert("No se pudo enviar", error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push("/(tabs)/home")} style={styles.backButton}>
            <Feather name="arrow-left" color={palette.ink} size={22} />
          </Pressable>
          <Text style={styles.title}>Ventas privadas</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Consigna con ATELIER</Text>
          <Text style={styles.heroTitle}>Ofrece piezas unicas a nuestros especialistas</Text>
          <Text style={styles.heroCopy}>
            Envia procedencia, fotografias y notas de estado para ubicar tu pieza en una futura sala en vivo o venta privada curada.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Nueva consignacion</Text>
          <TextInput
            placeholder="Titulo de la pieza"
            placeholderTextColor={palette.textMuted}
            style={styles.input}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            placeholder="Describe la pieza, sus materiales, procedencia y estado"
            placeholderTextColor={palette.textMuted}
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <TextInput
            placeholder="Pega al menos 6 URLs de fotos separadas por coma"
            placeholderTextColor={palette.textMuted}
            style={[styles.input, styles.textarea]}
            value={photos}
            onChangeText={setPhotos}
            multiline
          />
          <Pressable style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.submitButtonText}>{submitting ? "Enviando..." : "Enviar consignacion"}</Text>
          </Pressable>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Mis consignaciones</Text>
          <View style={styles.consignmentList}>
            {consignments.map((item) => (
              <View key={item.id} style={styles.consignmentCard}>
                <View style={styles.consignmentHeader}>
                  <Text style={styles.consignmentTitle}>{item.title}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{item.status.replaceAll("_", " ")}</Text>
                  </View>
                </View>
                <Text style={styles.consignmentDescription}>{item.description}</Text>
                <View style={styles.consignmentMeta}>
                  <Text style={styles.consignmentMetaText}>{item.photos.length} fotos</Text>
                  {item.storage_location ? <Text style={styles.consignmentMetaText}>{item.storage_location}</Text> : null}
                  {item.insurance_policy ? <Text style={styles.consignmentMetaText}>{item.insurance_policy}</Text> : null}
                </View>
              </View>
            ))}
            {!consignments.length ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Todavia no hay consignaciones</Text>
                <Text style={styles.emptyCopy}>Las piezas enviadas apareceran aqui despues de la primera revision.</Text>
              </View>
            ) : null}
          </View>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
    gap: 18
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800"
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: palette.surfaceMuted,
    padding: 24
  },
  heroEyebrow: {
    color: palette.gold,
    textTransform: "uppercase",
    letterSpacing: 2.6,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 10
  },
  heroTitle: {
    color: palette.white,
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "Georgia",
    fontWeight: "700",
    marginBottom: 10
  },
  heroCopy: {
    color: palette.text,
    lineHeight: 22
  },
  formCard: {
    borderRadius: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 18,
    gap: 12
  },
  sectionBlock: {
    gap: 14
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800"
  },
  input: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.backgroundSoft,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: palette.ink,
    fontSize: 16
  },
  textarea: {
    minHeight: 110,
    textAlignVertical: "top"
  },
  submitButton: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  submitButtonDisabled: {
    opacity: 0.72
  },
  submitButtonText: {
    color: palette.onAccent,
    fontSize: 17,
    fontWeight: "800"
  },
  consignmentList: {
    gap: 12
  },
  consignmentCard: {
    borderRadius: 20,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 18,
    gap: 10
  },
  consignmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  consignmentTitle: {
    flex: 1,
    color: palette.ink,
    fontSize: 17,
    fontWeight: "800"
  },
  statusBadge: {
    borderRadius: 999,
    backgroundColor: palette.goldSoft,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  statusBadgeText: {
    color: palette.gold,
    textTransform: "uppercase",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1
  },
  consignmentDescription: {
    color: palette.text,
    lineHeight: 22
  },
  consignmentMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  consignmentMetaText: {
    color: palette.textMuted,
    fontSize: 13
  },
  emptyState: {
    borderRadius: 20,
    backgroundColor: palette.backgroundSoft,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 22
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 8
  },
  emptyCopy: {
    color: palette.text,
    lineHeight: 22
  }
});
