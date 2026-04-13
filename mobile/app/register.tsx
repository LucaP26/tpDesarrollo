import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FeedbackModal } from "@/src/components/FeedbackModal";
import * as api from "@/src/lib/api";
import { countryOptions } from "@/src/lib/luxury";
import { palette } from "@/src/lib/theme";

type SelectedDocument = {
  uri: string;
  name: string;
  mimeType: string | null;
  size?: number | null;
};

const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;

function removeDigits(value: string) {
  return value.replace(/\d+/g, "");
}

function keepNumeric(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function isValidEmail(value: string) {
  const trimmed = value.trim();
  return trimmed.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function isAllowedDocument(file: SelectedDocument) {
  const lowerName = file.name.toLowerCase();
  const hasValidExtension = [".png", ".jpg", ".jpeg"].some((extension) => lowerName.endsWith(extension));
  const hasValidMimeType = file.mimeType === "image/png" || file.mimeType === "image/jpeg";
  return hasValidExtension || hasValidMimeType;
}

export default function RegisterScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState(countryOptions[0].code);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [frontDocumentFile, setFrontDocumentFile] = useState<SelectedDocument | null>(null);
  const [backDocumentFile, setBackDocumentFile] = useState<SelectedDocument | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const selectedCountry = useMemo(
    () => countryOptions.find((country) => country.code === countryCode) ?? countryOptions[0],
    [countryCode]
  );

  const hasBothDocumentSides = Boolean(frontDocumentFile && backDocumentFile);

  function showFeedback(title: string, message: string) {
    setFeedbackTitle(title);
    setFeedbackMessage(message);
    setFeedbackVisible(true);
    setFormError(message);
  }

  function hideFeedback() {
    setFeedbackVisible(false);
  }

  function handleEmailBlur() {
    if (email.trim() && !isValidEmail(email)) {
      const message = "El mail debe contener @ y un dominio valido.";
      setEmailError(message);
      showFeedback("Mail invalido", message);
      return;
    }

    setEmailError(null);
  }

  async function handlePickDocument(side: "front" | "back") {
    try {
      setFormError(null);
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/png", "image/jpeg"],
        multiple: false,
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      const nextFile: SelectedDocument = {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? null,
        size: asset.size
      };

      if (!isAllowedDocument(nextFile)) {
        showFeedback("Formato no valido", "Solo se permiten archivos PNG o JPG para el documento.");
        return;
      }

      if (nextFile.size && nextFile.size > MAX_DOCUMENT_SIZE) {
        showFeedback("Archivo demasiado grande", "El documento no puede superar los 5 MB.");
        return;
      }

      if (side === "front") {
        setFrontDocumentFile(nextFile);
        return;
      }

      setBackDocumentFile(nextFile);
    } catch (error) {
      showFeedback("No se pudo adjuntar", error instanceof Error ? error.message : "Error inesperado");
    }
  }

  async function handleSubmit() {
    const normalizedEmail = email.trim().toLowerCase();
    setFormError(null);

    if (!firstName || !lastName || !email || !street || !number || !city || !region || !postalCode) {
      showFeedback("Faltan datos", "Completa todos los campos obligatorios antes de continuar.");
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      const message = "Ingresa un mail valido que contenga @.";
      setEmailError(message);
      showFeedback("Mail invalido", message);
      return;
    }
    if (!hasBothDocumentSides) {
      showFeedback(
        "Verificacion requerida",
        "Adjunta dos imagenes de tu documento, una del frente y otra del dorso, antes de continuar."
      );
      return;
    }

    try {
      setSubmitting(true);
      const legalAddress = `${street.trim()} ${number.trim()}, ${city.trim()}, ${region.trim()}, ${postalCode.trim()}`;
      const response = await api.preRegister({
        email: normalizedEmail,
        document_number: `TMP-${Date.now().toString().slice(-6)}`,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        legal_address: legalAddress,
        country_code: selectedCountry.code,
        roles: ["cliente", "duenio"],
        document_front_image_url: frontDocumentFile!.uri,
        document_back_image_url: backDocumentFile!.uri
      });

      router.push({
        pathname: "/register-payment",
        params: { userId: String(response.user_id), email: normalizedEmail }
      });
    } catch (error) {
      showFeedback("No se pudo continuar", error instanceof Error ? error.message : "Error inesperado");
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
          <Text style={styles.topTitle}>Subastas de Lujo</Text>
          <View style={styles.topSpacer} />
        </View>

        <View style={styles.progressBlock}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.kicker}>Registro</Text>
              <Text style={styles.progressText}>Paso 1 de 2: Datos personales</Text>
            </View>
            <Text style={styles.progressValue}>50%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Crea tu cuenta</Text>
          <Text style={styles.heroCopy}>
            Completa tus datos oficiales para participar en nuestras subastas exclusivas de alto valor.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identidad</Text>
          <View style={styles.fieldList}>
            <Field label="Nombre">
              <TextInput
                placeholder="ej. Alejandro"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
                value={firstName}
                onChangeText={(value) => setFirstName(removeDigits(value))}
              />
            </Field>
            <Field label="Apellido">
              <TextInput
                placeholder="ej. Rothschild"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
                value={lastName}
                onChangeText={(value) => setLastName(removeDigits(value))}
              />
            </Field>
            <Field label="Correo electronico">
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="alejandro@prestige.com"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setEmailError(null);
                  setFormError(null);
                }}
                onBlur={handleEmailBlur}
              />
              {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
            </Field>
            <Field label="Pais de origen">
              <Pressable style={styles.selectInput} onPress={() => setCountryModalVisible(true)}>
                <Text style={styles.selectText}>{selectedCountry.label}</Text>
                <Feather name="chevron-down" color={palette.textMuted} size={20} />
              </Pressable>
            </Field>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verificacion</Text>
          <Text style={styles.helper}>
            Adjunta dos imagenes de tu documento en formato PNG o JPG, una del frente y otra del dorso, para habilitar tu perfil.
          </Text>
          <View style={[styles.uploadCard, hasBothDocumentSides && styles.uploadCardAttached]}>
            <Feather name="camera" color={palette.accent} size={30} style={styles.uploadIcon} />
            <Text style={styles.uploadTitle}>{hasBothDocumentSides ? "Documento adjuntado" : "Adjuntar documento"}</Text>
            <Text style={styles.uploadSubtitle}>
              {hasBothDocumentSides ? "Frente y dorso cargados correctamente." : "Debes cargar frente y dorso en PNG o JPG (Max. 5 MB cada uno)"}
            </Text>
            <View style={styles.documentActions}>
              <Pressable style={styles.documentButton} onPress={() => handlePickDocument("front")}>
                <Text style={styles.documentButtonLabel}>{frontDocumentFile ? "Cambiar frente" : "Cargar frente"}</Text>
              </Pressable>
              <Pressable style={styles.documentButton} onPress={() => handlePickDocument("back")}>
                <Text style={styles.documentButtonLabel}>{backDocumentFile ? "Cambiar dorso" : "Cargar dorso"}</Text>
              </Pressable>
            </View>
            <View style={styles.documentStatusList}>
              <Text style={styles.documentStatusText}>
                {frontDocumentFile ? `Frente: ${frontDocumentFile.name}` : "Frente pendiente"}
              </Text>
              <Text style={styles.documentStatusText}>
                {backDocumentFile ? `Dorso: ${backDocumentFile.name}` : "Dorso pendiente"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Domicilio</Text>
          <View style={styles.fieldList}>
            <Field label="Calle">
              <TextInput
                placeholder="Avenida Libertador"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
                value={street}
                onChangeText={(value) => setStreet(removeDigits(value))}
              />
            </Field>
            <Field label="Numero">
              <TextInput
                keyboardType="number-pad"
                placeholder="12"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
                value={number}
                onChangeText={(value) => setNumber(keepNumeric(value))}
              />
            </Field>
            <Field label="Ciudad">
              <TextInput
                placeholder="Londres"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
                value={city}
                onChangeText={(value) => setCity(removeDigits(value))}
              />
            </Field>
            <Field label="Provincia / Region">
              <TextInput
                placeholder="Gran Londres"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
                value={region}
                onChangeText={(value) => setRegion(removeDigits(value))}
              />
            </Field>
            <Field label="Codigo postal">
              <TextInput
                placeholder="W1A 1AA"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
                value={postalCode}
                onChangeText={setPostalCode}
              />
            </Field>
          </View>
        </View>

        <View style={styles.footer}>
          {formError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerTitle}>No pudimos avanzar con el registro</Text>
              <Text style={styles.errorBannerText}>{formError}</Text>
            </View>
          ) : null}
          <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.primaryButtonText}>{submitting ? "Enviando..." : "Continuar al siguiente paso"}</Text>
            <Feather name="arrow-right" color={palette.onAccent} size={18} />
          </Pressable>
          <Text style={styles.legal}>
            Al hacer clic en "Continuar", aceptas nuestros Terminos de Servicio y la Politica de Privacidad para el manejo de bienes de lujo.
          </Text>
        </View>
      </ScrollView>

      <Modal transparent visible={countryModalVisible} animationType="fade" onRequestClose={() => setCountryModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCountryModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Selecciona un pais</Text>
            {countryOptions.map((country) => (
              <Pressable
                key={country.code}
                style={styles.modalOption}
                onPress={() => {
                  setCountryCode(country.code);
                  setCountryModalVisible(false);
                }}
              >
                <Text style={styles.modalOptionText}>{country.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <FeedbackModal visible={feedbackVisible} title={feedbackTitle} message={feedbackMessage} onClose={hideFeedback} />
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
    paddingHorizontal: 22,
    paddingVertical: 12,
    paddingBottom: 42
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
    fontSize: 18,
    fontWeight: "700",
    color: palette.ink,
    letterSpacing: -0.3
  },
  topSpacer: {
    width: 32
  },
  progressBlock: {
    marginTop: 26
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12
  },
  kicker: {
    color: palette.accent,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4
  },
  progressText: {
    fontSize: 17,
    color: palette.ink
  },
  progressValue: {
    color: palette.textMuted,
    fontSize: 16
  },
  progressTrack: {
    height: 5,
    backgroundColor: palette.accentSoft,
    borderRadius: 999,
    overflow: "hidden"
  },
  progressFill: {
    width: "50%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.accent
  },
  hero: {
    alignItems: "center",
    marginTop: 34,
    marginBottom: 30,
    paddingHorizontal: 14
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    color: palette.ink,
    fontWeight: "800",
    letterSpacing: -1
  },
  heroCopy: {
    marginTop: 12,
    color: palette.text,
    textAlign: "center",
    lineHeight: 30,
    fontSize: 16
  },
  section: {
    marginBottom: 26
  },
  sectionTitle: {
    color: palette.accent,
    textTransform: "uppercase",
    letterSpacing: 2.4,
    fontSize: 13,
    fontWeight: "800",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderWarm
  },
  helper: {
    marginTop: 12,
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 22
  },
  fieldList: {
    marginTop: 16,
    gap: 16
  },
  field: {
    gap: 8
  },
  label: {
    fontSize: 16,
    color: palette.ink
  },
  fieldError: {
    color: palette.accentDeep,
    fontSize: 13,
    lineHeight: 18
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    backgroundColor: palette.surface,
    paddingHorizontal: 16,
    color: palette.ink,
    fontSize: 16
  },
  selectInput: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    backgroundColor: palette.surface,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  selectText: {
    color: palette.ink,
    fontSize: 16
  },
  uploadCard: {
    marginTop: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: palette.ghost,
    borderRadius: 18,
    paddingVertical: 28,
    alignItems: "center",
    backgroundColor: palette.backgroundSoft
  },
  uploadCardAttached: {
    borderColor: palette.accent,
    backgroundColor: palette.surfaceWarm
  },
  uploadIcon: {
    marginBottom: 8
  },
  uploadTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700"
  },
  uploadSubtitle: {
    marginTop: 6,
    color: palette.textMuted,
    fontSize: 13,
    paddingHorizontal: 18,
    textAlign: "center"
  },
  documentActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    paddingHorizontal: 18
  },
  documentButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface
  },
  documentButtonLabel: {
    color: palette.accent,
    fontSize: 14,
    fontWeight: "700"
  },
  documentStatusList: {
    marginTop: 16,
    gap: 6,
    paddingHorizontal: 18,
    alignSelf: "stretch"
  },
  documentStatusText: {
    color: palette.textMuted,
    fontSize: 13,
    textAlign: "center"
  },
  footer: {
    marginTop: 10
  },
  errorBanner: {
    borderRadius: 16,
    backgroundColor: palette.surfaceWarm,
    borderWidth: 1,
    borderColor: palette.accentSoft,
    padding: 14,
    marginBottom: 14
  },
  errorBannerTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  errorBannerText: {
    color: palette.text,
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: palette.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: palette.accent,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6
  },
  buttonDisabled: {
    opacity: 0.7
  },
  primaryButtonText: {
    color: palette.onAccent,
    fontSize: 18,
    fontWeight: "800"
  },
  legal: {
    marginTop: 14,
    color: palette.textMuted,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 20
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: palette.overlaySoft,
    justifyContent: "flex-end",
    padding: 18
  },
  modalCard: {
    backgroundColor: palette.backgroundSoft,
    borderRadius: 24,
    padding: 20,
    gap: 8
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.ink,
    marginBottom: 8
  },
  modalOption: {
    minHeight: 48,
    justifyContent: "center",
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: palette.surface
  },
  modalOptionText: {
    color: palette.ink,
    fontSize: 16
  }
});
