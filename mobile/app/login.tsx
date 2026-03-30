import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSession } from "@/src/lib/session";
import { palette } from "@/src/lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    try {
      setSubmitting(true);
      await login(email, password);
      router.replace("/(tabs)/home");
    } catch (error) {
      Alert.alert("No se pudo iniciar sesion", error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.brand}>ELITE</Text>
          <Text style={styles.title}>Subastas de lujo en tu bolsillo.</Text>
          <Text style={styles.subtitle}>
            Inicia sesion para explorar catalogos en vivo, seguir eventos programados y administrar tu perfil de comprador.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Bienvenido de nuevo</Text>
          <Text style={styles.panelCopy}>Ingresa con tus credenciales aprobadas para explorar catalogos, seguir subastas y pujar.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Correo electronico</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="vos@ejemplo.com"
              placeholderTextColor={palette.textMuted}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Contrasena</Text>
            <TextInput
              placeholder="Ingresa tu contrasena"
              placeholderTextColor={palette.textMuted}
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={handleLogin} disabled={submitting}>
            <Text style={styles.primaryButtonText}>{submitting ? "Ingresando..." : "Entrar a la plataforma"}</Text>
          </Pressable>

          <Pressable onPress={() => router.push("/forgot-password")}>
            <Text style={styles.linkAction}>Olvide mi contrasena</Text>
          </Pressable>

          <Pressable onPress={() => router.push("/register")}>
            <Text style={styles.secondaryAction}>Crear una cuenta nueva</Text>
          </Pressable>
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
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 18,
    gap: 28
  },
  hero: {
    paddingTop: 20,
    gap: 14
  },
  brand: {
    fontSize: 46,
    lineHeight: 46,
    letterSpacing: -3,
    color: palette.ink,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.6,
    color: palette.ink,
    fontWeight: "800"
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 28,
    color: palette.text
  },
  panel: {
    backgroundColor: palette.backgroundSoft,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: palette.border
  },
  panelTitle: {
    fontSize: 28,
    lineHeight: 32,
    color: palette.ink,
    fontWeight: "800",
    letterSpacing: -1
  },
  panelCopy: {
    marginTop: 8,
    color: palette.text,
    lineHeight: 24
  },
  field: {
    marginTop: 18,
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
    marginTop: 24,
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: palette.accent,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: palette.accent,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6
  },
  buttonDisabled: {
    opacity: 0.7
  },
  primaryButtonText: {
    color: palette.white,
    fontSize: 17,
    fontWeight: "800"
  },
  linkAction: {
    marginTop: 16,
    textAlign: "center",
    color: palette.ink,
    fontSize: 14,
    fontWeight: "700"
  },
  secondaryAction: {
    marginTop: 18,
    textAlign: "center",
    color: palette.accent,
    fontSize: 15,
    fontWeight: "700"
  }
});
