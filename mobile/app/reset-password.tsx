import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FeedbackModal } from "@/src/components/FeedbackModal";
import * as api from "@/src/lib/api";
import { palette } from "@/src/lib/theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    if (!normalizedEmail || !code.trim() || !password || !confirmPassword) {
      showFeedback("Faltan datos", "Completa el correo, el codigo y la nueva contrasena.");
      return;
    }
    if (password.length < 6) {
      showFeedback("Contrasena demasiado corta", "La contrasena nueva debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      showFeedback("Contrasenas distintas", "La confirmacion no coincide con la contrasena ingresada.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.confirmPasswordReset(normalizedEmail, code.trim(), password);
      showFeedback("Contrasena actualizada", response.message);
    } catch (error) {
      showFeedback("No se pudo actualizar", error instanceof Error ? error.message : "Error inesperado");
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
          <Text style={styles.topTitle}>Nueva contrasena</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Ingresa el codigo que recibiste</Text>
          <Text style={styles.heroCopy}>
            Escribe el codigo enviado a tu correo y define una nueva contrasena para volver a entrar a la app.
          </Text>
        </View>

        <View style={styles.panel}>
          <Field label="Correo electronico">
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
          </Field>

          <Field label="Codigo de recuperacion">
            <TextInput
              keyboardType="number-pad"
              placeholder="123456"
              placeholderTextColor={palette.textMuted}
              style={styles.input}
              value={code}
              onChangeText={setCode}
            />
          </Field>

          <Field label="Nueva contrasena">
            <TextInput
              secureTextEntry
              placeholder="Minimo 6 caracteres"
              placeholderTextColor={palette.textMuted}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
          </Field>

          <Field label="Confirmar contrasena">
            <TextInput
              secureTextEntry
              placeholder="Repite la contrasena"
              placeholderTextColor={palette.textMuted}
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </Field>

          <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.primaryButtonText}>{submitting ? "Actualizando..." : "Guardar nueva contrasena"}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <FeedbackModal
        visible={feedbackVisible}
        title={feedbackTitle}
        message={feedbackMessage}
        onClose={() => {
          const goToLogin = feedbackTitle === "Contrasena actualizada";
          setFeedbackVisible(false);
          if (goToLogin) {
            router.replace("/login");
          }
        }}
      />
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
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
    gap: 16
  },
  field: {
    gap: 8
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
    marginTop: 8,
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
    color: palette.onAccent,
    fontSize: 17,
    fontWeight: "800"
  }
});
