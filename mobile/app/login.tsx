import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { homeShowcase } from "@/src/lib/luxury";
import { useSession } from "@/src/lib/session";
import { palette } from "@/src/lib/theme";

const decorativeLots = [
  { id: "042", image: homeShowcase[0].image },
  { id: "118", image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDfqOzshuX2o1j-uLvDNWdKwAJDpGJiThTMAyHITeFjgi8pomR3x8wrUrFQ5m4vlvr5MSQUz4RAvrU2ZyT2vMkLjfTu445nbuuRLlw5Fo-dj66vA5NI8ITyomqRBAvV6KCQELhRLluPq8mVYmPwpa8vUpXVXq0vcvzkPq4iw5_VmixQbkUqjz5ESaxPDnaZ-DPvb40IaFF40Xu3MmtesFMCe4yXFu60ux3kOFdp2uQoMqdqBe8R2GB86sbxJOVUi_Wygy78D4U5ALo" },
  { id: "204", image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAvfPeduue9D0zjLZB2tkgUgjjN-EQMpgXHfbRfsQk2SX6EeRlIyz2afR4gxKTpzjLlOcLMqbTu0Wwq8r8gdwIp1SxuTyVfBx1qAYWKRkbem5JW_v1CSv9AfdbwspKLI9O7Pa3U_1mekPlyGGg7ey8wq4NcCs3xE48VzWnlN827xx5RKoDePbCNcXE2oN1l_KlKRIBlzGnuMb70CtLSREa1KGnMuZy0vgDmzpBHPgo4fPsPsGmL8PQI6Bu4W5WiPSYLsdxBBlWp0kQ" }
];

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useSession();
  const [email, setEmail] = useState("p@gmail.com");
  const [password, setPassword] = useState("Platino123!");
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
      <View style={styles.ambientGlowLeft} />
      <View style={styles.ambientGlowRight} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.brand}>ATELIER</Text>
          <View style={styles.estRow}>
            <View style={styles.estLine} />
            <Text style={styles.estLabel}>EST. 1924</Text>
            <View style={styles.estLine} />
          </View>
        </View>

        <View style={styles.copyBlock}>
          <Text style={styles.title}>Bienvenido de nuevo</Text>
          <Text style={styles.subtitle}>
            Entra al atelier de subastas exclusivas y coleccionables de alto valor.
          </Text>
        </View>

        <View style={styles.formBlock}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo electronico</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="curador@atelier.com"
              placeholderTextColor={stylesTokens.placeholder}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.passwordLabelRow}>
              <Text style={styles.label}>Contrasena</Text>
              <Pressable onPress={() => router.push("/forgot-password")}>
                <Text style={styles.forgotLink}>Olvidaste?</Text>
              </Pressable>
            </View>
            <TextInput
              placeholder="••••••••"
              placeholderTextColor={stylesTokens.placeholder}
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={handleLogin} disabled={submitting}>
            <Text style={styles.primaryButtonText}>{submitting ? "Ingresando..." : "Entrar a la plataforma"}</Text>
          </Pressable>
        </View>

        <View style={styles.accessSection}>
          <View style={styles.accessDividerRow}>
            <View style={styles.accessDivider} />
            <Text style={styles.accessLabel}>Opciones de acceso</Text>
            <View style={styles.accessDivider} />
          </View>

          <Text style={styles.registerPrompt}>No tenes una cuenta?</Text>

          <Pressable style={styles.secondaryButton} onPress={() => router.push("/register")}>
            <Text style={styles.secondaryButtonText}>Registrarse</Text>
          </Pressable>
        </View>

        <View style={styles.decorativeRow}>
          {decorativeLots.map((lot) => (
            <View key={lot.id} style={styles.decorativeItem}>
              <Image source={{ uri: lot.image }} style={styles.decorativeImage} />
              <Text style={styles.decorativeCaption}>LOT {lot.id}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLink}>Politica de privacidad</Text>
          <Text style={styles.footerDot}>•</Text>
          <Text style={styles.footerLink}>Terminos del servicio</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const stylesTokens = {
  placeholder: "rgba(168, 155, 136, 0.28)"
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background
  },
  ambientGlowLeft: {
    position: "absolute",
    top: -120,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(230, 195, 131, 0.05)"
  },
  ambientGlowRight: {
    position: "absolute",
    right: -120,
    bottom: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(230, 195, 131, 0.04)"
  },
  content: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 30,
    paddingTop: 28,
    paddingBottom: 34
  },
  header: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 58
  },
  brand: {
    color: palette.accent,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: 8,
    fontFamily: "Georgia",
    fontWeight: "400"
  },
  estRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  estLine: {
    width: 28,
    height: 1,
    backgroundColor: "rgba(168, 155, 136, 0.34)"
  },
  estLabel: {
    color: palette.textMuted,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase"
  },
  copyBlock: {
    width: "100%",
    alignItems: "center",
    marginBottom: 42,
    gap: 12
  },
  title: {
    color: palette.ink,
    fontSize: 42,
    lineHeight: 48,
    fontFamily: "Georgia",
    fontWeight: "700",
    textAlign: "center"
  },
  subtitle: {
    maxWidth: 290,
    color: palette.text,
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center"
  },
  formBlock: {
    width: "100%",
    gap: 24
  },
  inputGroup: {
    gap: 10
  },
  label: {
    color: palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontSize: 11,
    fontWeight: "700"
  },
  passwordLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  forgotLink: {
    color: "#B7AEA3",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontSize: 10,
    fontWeight: "600"
  },
  input: {
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: "#1A1A1A",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(77, 70, 58, 0.15)",
    paddingHorizontal: 16,
    color: palette.ink,
    fontSize: 16
  },
  primaryButton: {
    marginTop: 6,
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: palette.accent,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: palette.accent,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6
  },
  buttonDisabled: {
    opacity: 0.7
  },
  primaryButtonText: {
    color: palette.onAccent,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 2.2
  },
  accessSection: {
    width: "100%",
    marginTop: 50,
    alignItems: "center",
    gap: 22
  },
  accessDividerRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  accessDivider: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(77, 70, 58, 0.2)"
  },
  accessLabel: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.8
  },
  registerPrompt: {
    color: "#B7AEA3",
    fontSize: 14
  },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(230, 195, 131, 0.2)",
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.8
  },
  decorativeRow: {
    marginTop: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 22
  },
  decorativeItem: {
    alignItems: "center",
    gap: 8
  },
  decorativeImage: {
    width: 42,
    height: 64,
    borderRadius: 4,
    backgroundColor: palette.surfaceWarm
  },
  decorativeCaption: {
    color: palette.textMuted,
    fontSize: 8,
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  footer: {
    marginTop: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    justifyContent: "center"
  },
  footerLink: {
    color: "#B7AEA3",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.4
  },
  footerDot: {
    color: "#B7AEA3",
    fontSize: 10
  }
});
