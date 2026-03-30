import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FeedbackModal } from "@/src/components/FeedbackModal";
import * as api from "@/src/lib/api";
import { palette } from "@/src/lib/theme";

function isValidEmail(value: string) {
  const trimmed = value.trim();
  return trimmed.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  function showFeedback(title: string, message: string) {
    setFeedbackTitle(title);
    setFeedbackMessage(message);
    setFeedbackVisible(true);
  }

  async function handleSubmit() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      showFeedback("Mail invalido", "Ingresa un correo valido para recibir el codigo de recuperacion.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.requestPasswordReset(normalizedEmail);
      showFeedback("Correo enviado", response.message);
    } catch (error) {
      showFeedback("No se pudo enviar", error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" color={palette.accent} size={24} />
          </Pressable>
          <Text style={styles.topTitle}>Recuperar contrasena</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Te enviamos un codigo por email</Text>
          <Text style={styles.heroCopy}>
            Ingresa el correo asociado a tu cuenta y te mandaremos un codigo de recuperacion para restablecer la contrasena.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>Correo electronico</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="vos@ejemplo.com"
            placeholderTextColor={palette.textMuted}
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />

          <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.primaryButtonText}>{submitting ? "Enviando..." : "Enviar codigo"}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <FeedbackModal
        visible={feedbackVisible}
        title={feedbackTitle}
        message={feedbackMessage}
        onClose={() => {
          const shouldContinue = feedbackTitle === "Correo enviado";
          setFeedbackVisible(false);
          if (shouldContinue) {
            router.replace({ pathname: "/reset-password", params: { email: email.trim().toLowerCase() } });
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 18,
    gap: 28
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  topTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800"
  },
  hero: {
    paddingTop: 24,
    gap: 12
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -1.3
  },
  heroCopy: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 28
  },
  panel: {
    backgroundColor: palette.backgroundSoft,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 10
  },
  label: {
    color: palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: "700"
  },
  input: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 18,
    color: palette.ink,
    fontSize: 16
  },
  primaryButton: {
    marginTop: 14,
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: palette.accent,
    justifyContent: "center",
    alignItems: "center"
  },
  buttonDisabled: {
    opacity: 0.7
  },
  primaryButtonText: {
    color: palette.white,
    fontSize: 17,
    fontWeight: "800"
  }
});
