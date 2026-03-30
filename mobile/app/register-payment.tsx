import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useSession } from "@/src/lib/session";
import { palette } from "@/src/lib/theme";
import { BankIssuer, Currency, PaymentMethod, PaymentType } from "@/src/lib/types";

const currencyOptions: Array<{ label: string; value: Currency }> = [
  { label: "Pesos argentinos (ARS)", value: "ARS" },
  { label: "Dolares estadounidenses (USD)", value: "USD" }
];

const bankIssuerOptions: Array<{ label: string; value: BankIssuer }> = [
  { label: "Galicia", value: "Galicia" },
  { label: "Macro", value: "Macro" },
  { label: "BNA", value: "BNA" },
  { label: "Santander", value: "Santander" },
  { label: "BBVA", value: "BBVA" },
  { label: "Patagonia", value: "Patagonia" },
  { label: "Banco Provincia", value: "Banco Provincia" },
  { label: "ICBC", value: "ICBC" },
  { label: "HSBC", value: "HSBC" },
  { label: "Ciudad", value: "Ciudad" }
];

const paymentTypeOptions: Array<{ label: string; value: PaymentType }> = [
  { label: "Tarjeta de credito", value: "tarjeta_credito" },
  { label: "Cuenta bancaria", value: "cuenta_bancaria" },
  { label: "Cheque certificado", value: "cheque_certificado" }
];

function keepNumeric(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function removeDigits(value: string) {
  return value.replace(/\d+/g, "");
}

function defaultAvailableAmount(currency: Currency) {
  return currency === "USD" ? 25000 : 5000000;
}

function holderFullName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

function formatExpirationDate(value: string) {
  const digits = keepNumeric(value).slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function isValidExpirationDate(value: string) {
  return /^(0[1-9]|1[0-2])\/\d{2}$/.test(value.trim());
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function RegisterPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string; email?: string; mode?: string; paymentId?: string }>();
  const { authenticate, token, updateUser } = useSession();
  const [paymentType, setPaymentType] = useState<PaymentType>("tarjeta_credito");
  const [holderFirstName, setHolderFirstName] = useState("");
  const [holderLastName, setHolderLastName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [issuingBank, setIssuingBank] = useState<BankIssuer>("Galicia");
  const [checkAmount, setCheckAmount] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processingVisible, setProcessingVisible] = useState(false);
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(params.mode === "edit");

  const mode = params.mode === "edit" ? "edit" : params.mode === "create" ? "create" : "register";
  const isRegistrationFlow = mode === "register";
  const userId = Number(params.userId);
  const paymentId = Number(params.paymentId);
  const selectedCurrency = useMemo(
    () => currencyOptions.find((item) => item.value === currency) ?? currencyOptions[0],
    [currency]
  );
  const selectedBank = useMemo(
    () => bankIssuerOptions.find((item) => item.value === issuingBank) ?? bankIssuerOptions[0],
    [issuingBank]
  );

  function showFeedback(title: string, message: string) {
    setFeedbackTitle(title);
    setFeedbackMessage(message);
    setFeedbackVisible(true);
    setFormError(message);
  }

  useEffect(() => {
    if (mode !== "edit") {
      setLoadingExisting(false);
      return;
    }

    if (!token || !paymentId || Number.isNaN(paymentId)) {
      showFeedback("Medio de pago invalido", "No encontramos el medio de pago que querias editar.");
      setLoadingExisting(false);
      return;
    }

    let active = true;

    api
      .listPaymentMethods(token)
      .then((methods) => {
        if (!active) {
          return;
        }
        const existingPayment = methods.find((item) => item.id === paymentId);
        if (!existingPayment) {
          throw new Error("No encontramos el medio de pago que querias editar.");
        }

        setPaymentType(existingPayment.type);
        setHolderFirstName(existingPayment.holder_first_name ?? "");
        setHolderLastName(existingPayment.holder_last_name ?? "");
        setCurrency(existingPayment.currency);
        setIssuingBank((existingPayment.issuing_bank as BankIssuer | undefined) ?? "Galicia");
        setExpirationDate(existingPayment.expiration_date ?? "");
        setCheckAmount(
          existingPayment.type === "cheque_certificado" ? String(Math.round(existingPayment.available_amount)) : ""
        );
        setCardNumber("");
        setSecurityCode("");
        setFormError(null);
      })
      .catch((error) => {
        if (active) {
          showFeedback("No se pudo abrir", error instanceof Error ? error.message : "Error inesperado");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingExisting(false);
        }
      });

    return () => {
      active = false;
    };
  }, [mode, paymentId, token]);

  function handleCardNumberBlur() {
    if (paymentType === "tarjeta_credito" && cardNumber.trim() && cardNumber.trim().length !== 16) {
      showFeedback("Numero de tarjeta invalido", "El numero de tarjeta debe tener exactamente 16 digitos.");
    }
  }

  function buildPaymentPayload(normalizedFirstName: string, normalizedLastName: string) {
    const fullName = holderFullName(normalizedFirstName, normalizedLastName);

    if (paymentType === "tarjeta_credito") {
      return {
        type: paymentType,
        display_name: `Tarjeta de credito de ${fullName}`,
        currency: "ARS" as Currency,
        issuer_country: "AR",
        available_amount: defaultAvailableAmount("ARS"),
        last_four: cardNumber.slice(-4),
        holder_first_name: normalizedFirstName,
        holder_last_name: normalizedLastName,
        expiration_date: expirationDate.trim()
      };
    }

    if (paymentType === "cuenta_bancaria") {
      return {
        type: paymentType,
        display_name: `Cuenta ${selectedBank.label} de ${fullName}`,
        currency,
        issuer_country: "AR",
        available_amount: defaultAvailableAmount(currency),
        holder_first_name: normalizedFirstName,
        holder_last_name: normalizedLastName,
        issuing_bank: selectedBank.value
      };
    }

    return {
      type: paymentType,
      display_name: `Cheque certificado de ${fullName}`,
      currency,
      issuer_country: "AR",
      available_amount: Number(checkAmount),
      holder_first_name: normalizedFirstName,
      holder_last_name: normalizedLastName
    };
  }

  async function handleSubmit() {
    const normalizedFirstName = holderFirstName.trim();
    const normalizedLastName = holderLastName.trim();
    setFormError(null);

    if (isRegistrationFlow && (!userId || Number.isNaN(userId))) {
      showFeedback("Registro invalido", "No se encontro el usuario del paso anterior. Vuelve a empezar el registro.");
      return;
    }
    if (!normalizedFirstName || !normalizedLastName) {
      showFeedback("Faltan datos", "Completa el nombre y apellido del titular antes de continuar.");
      return;
    }
    if (isRegistrationFlow && (!password || !confirmPassword)) {
      showFeedback("Faltan datos", "Completa la contrasena y su confirmacion para continuar.");
      return;
    }
    if (isRegistrationFlow && password.length < 6) {
      showFeedback("Contrasena demasiado corta", "La contrasena debe tener al menos 6 caracteres.");
      return;
    }
    if (isRegistrationFlow && password !== confirmPassword) {
      showFeedback("Contrasenas distintas", "La confirmacion no coincide con la contrasena ingresada.");
      return;
    }
    if (paymentType === "tarjeta_credito" && cardNumber.length !== 16) {
      showFeedback("Numero de tarjeta invalido", "El numero de tarjeta debe tener exactamente 16 digitos.");
      return;
    }
    if (paymentType === "tarjeta_credito" && securityCode.length !== 3) {
      showFeedback("Codigo de seguridad invalido", "Ingresa un codigo de seguridad de 3 digitos.");
      return;
    }
    if (paymentType === "tarjeta_credito" && !isValidExpirationDate(expirationDate)) {
      showFeedback("Vencimiento invalido", "Ingresa la fecha de vencimiento con formato MM/AA.");
      return;
    }
    if (paymentType === "cuenta_bancaria" && !issuingBank) {
      showFeedback("Banco emisor requerido", "Selecciona el banco emisor de la cuenta bancaria.");
      return;
    }
    if (paymentType === "cheque_certificado" && (!checkAmount || Number(checkAmount) <= 0)) {
      showFeedback("Monto invalido", "Ingresa un monto valido para el cheque certificado.");
      return;
    }

    const paymentPayload = buildPaymentPayload(normalizedFirstName, normalizedLastName);

    try {
      setSubmitting(true);
      if (isRegistrationFlow) {
        setProcessingVisible(true);
        await delay(3000);

        const auth = await api.completeRegistration({
          user_id: userId,
          password
        });
        authenticate(auth);
        await api.createPaymentMethod(auth.access_token, paymentPayload);
        const profile = await api.getProfile(auth.access_token);
        updateUser(profile);
        router.replace("/(tabs)/profile");
        return;
      }

      if (!token) {
        showFeedback("Sesion expirada", "Vuelve a iniciar sesion para guardar el medio de pago.");
        return;
      }

      if (mode === "edit") {
        if (!paymentId || Number.isNaN(paymentId)) {
          showFeedback("Medio de pago invalido", "No encontramos el medio de pago que querias editar.");
          return;
        }
        await api.updatePaymentMethod(token, paymentId, paymentPayload);
      } else {
        await api.createPaymentMethod(token, paymentPayload);
      }

      const profile = await api.getProfile(token);
      updateUser(profile);
      router.replace("/(tabs)/profile");
    } catch (error) {
      showFeedback("No se pudo finalizar", error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setProcessingVisible(false);
      setSubmitting(false);
    }
  }

  function handleDelete() {
    if (mode !== "edit" || !token || !paymentId || Number.isNaN(paymentId)) {
      return;
    }

    (async () => {
      try {
        setSubmitting(true);
        await api.deletePaymentMethod(token, paymentId);
        const profile = await api.getProfile(token);
        updateUser(profile);
        router.replace("/(tabs)/profile");
      } catch (error) {
        showFeedback("No se pudo eliminar", error instanceof Error ? error.message : "Error inesperado");
      } finally {
        setSubmitting(false);
      }
    })();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {loadingExisting ? (
        <View style={styles.processingScreen}>
          <ActivityIndicator color={palette.accent} size="large" />
          <Text style={styles.processingTitle}>Cargando medio de pago</Text>
          <Text style={styles.processingCopy}>Estamos preparando los datos para que puedas editarlo.</Text>
        </View>
      ) : null}
      {!loadingExisting ? (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" color={palette.accent} size={24} />
          </Pressable>
          <Text style={styles.topTitle}>Subastas de Lujo</Text>
          <View style={styles.topSpacer} />
        </View>

        {isRegistrationFlow ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.kicker}>Registro</Text>
                <Text style={styles.progressText}>Paso 2 de 2: Medio de pago</Text>
              </View>
              <Text style={styles.progressValue}>100%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
          </View>
        ) : null}

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            {isRegistrationFlow ? "Registra tu medio de pago" : mode === "edit" ? "Editar medio de pago" : "Agregar medio de pago"}
          </Text>
          <Text style={styles.heroCopy}>
            {isRegistrationFlow
              ? "Tu usuario ya fue creado. Completa este paso para dejar lista tu cuenta y enviar el medio de pago a verificacion."
              : mode === "edit"
                ? "Actualiza los datos del medio de pago y lo enviaremos nuevamente a verificacion."
                : "Carga un medio de pago real para usarlo en pujas y compras dentro de tu cuenta."}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medio de pago</Text>
          <View style={styles.optionRow}>
            {paymentTypeOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.chip, paymentType === option.value && styles.chipActive]}
                onPress={() => setPaymentType(option.value)}
              >
                <Text style={[styles.chipText, paymentType === option.value && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>

          <Field label="Nombre del titular">
            <TextInput
              placeholder="Ej. Alejandro"
              placeholderTextColor={palette.textMuted}
              style={styles.input}
              value={holderFirstName}
              onChangeText={(value) => setHolderFirstName(removeDigits(value))}
            />
          </Field>

          <Field label="Apellido del titular">
            <TextInput
              placeholder="Ej. Rothschild"
              placeholderTextColor={palette.textMuted}
              style={styles.input}
              value={holderLastName}
              onChangeText={(value) => setHolderLastName(removeDigits(value))}
            />
          </Field>

          {paymentType === "tarjeta_credito" ? (
            <>
              <Field label="Numero de tarjeta">
                <TextInput
                  keyboardType="number-pad"
                  placeholder="1234123412341234"
                  placeholderTextColor={palette.textMuted}
                  style={styles.input}
                  value={cardNumber}
                  onChangeText={(value) => setCardNumber(keepNumeric(value))}
                  onBlur={handleCardNumberBlur}
                />
              </Field>

              <Field label="Codigo de seguridad">
                <TextInput
                  keyboardType="number-pad"
                  placeholder="123"
                  placeholderTextColor={palette.textMuted}
                  style={styles.input}
                  value={securityCode}
                  onChangeText={(value) => setSecurityCode(keepNumeric(value).slice(0, 3))}
                />
              </Field>

              <Field label="Fecha de vencimiento">
                <TextInput
                  keyboardType="number-pad"
                  placeholder="MM/AA"
                  placeholderTextColor={palette.textMuted}
                  style={styles.input}
                  value={expirationDate}
                  onChangeText={(value) => setExpirationDate(formatExpirationDate(value))}
                />
              </Field>
            </>
          ) : null}

          {paymentType === "cuenta_bancaria" ? (
            <>
              <Field label="Moneda">
                <Pressable style={styles.selectInput} onPress={() => setCurrencyModalVisible(true)}>
                  <Text style={styles.selectText}>{selectedCurrency.label}</Text>
                  <Feather name="chevron-down" color={palette.textMuted} size={20} />
                </Pressable>
              </Field>

              <Field label="Banco emisor">
                <Pressable style={styles.selectInput} onPress={() => setBankModalVisible(true)}>
                  <Text style={styles.selectText}>{selectedBank.label}</Text>
                  <Feather name="chevron-down" color={palette.textMuted} size={20} />
                </Pressable>
              </Field>
            </>
          ) : null}

          {paymentType === "cheque_certificado" ? (
            <>
              <Field label="Moneda">
                <Pressable style={styles.selectInput} onPress={() => setCurrencyModalVisible(true)}>
                  <Text style={styles.selectText}>{selectedCurrency.label}</Text>
                  <Feather name="chevron-down" color={palette.textMuted} size={20} />
                </Pressable>
              </Field>

              <Field label="Monto">
                <TextInput
                  keyboardType="number-pad"
                  placeholder="150000"
                  placeholderTextColor={palette.textMuted}
                  style={styles.input}
                  value={checkAmount}
                  onChangeText={(value) => setCheckAmount(keepNumeric(value))}
                />
              </Field>
            </>
          ) : null}
        </View>

        {isRegistrationFlow ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Acceso</Text>
            <Field label="Contrasena">
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
          </View>
        ) : null}

        <View style={styles.footer}>
          {formError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerTitle}>No pudimos guardar el medio de pago</Text>
              <Text style={styles.errorBannerText}>{formError}</Text>
            </View>
          ) : null}
          <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting}>
            <MaterialCommunityIcons name="credit-card-check-outline" color={palette.white} size={20} />
            <Text style={styles.primaryButtonText}>
              {submitting ? "Guardando..." : isRegistrationFlow ? "Finalizar registro" : mode === "edit" ? "Guardar cambios" : "Guardar medio de pago"}
            </Text>
          </Pressable>
          <Text style={styles.legal}>
            {isRegistrationFlow
              ? "Al finalizar, el medio de pago quedara pendiente de revision por la empresa antes de habilitar las pujas."
              : "Al guardar, el medio de pago quedara pendiente de revision por la empresa antes de volver a habilitar las pujas."}
          </Text>
          {mode === "edit" ? (
            <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={submitting}>
              <Text style={styles.deleteButtonText}>Eliminar medio de pago</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      ) : null}

      <Modal transparent visible={currencyModalVisible} animationType="fade" onRequestClose={() => setCurrencyModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCurrencyModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Selecciona una moneda</Text>
            {currencyOptions.map((option) => (
              <Pressable
                key={option.value}
                style={styles.modalOption}
                onPress={() => {
                  setCurrency(option.value);
                  setCurrencyModalVisible(false);
                }}
              >
                <Text style={styles.modalOptionText}>{option.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={bankModalVisible} animationType="fade" onRequestClose={() => setBankModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBankModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Selecciona un banco</Text>
            {bankIssuerOptions.map((option) => (
              <Pressable
                key={option.value}
                style={styles.modalOption}
                onPress={() => {
                  setIssuingBank(option.value);
                  setBankModalVisible(false);
                }}
              >
                <Text style={styles.modalOptionText}>{option.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={processingVisible && isRegistrationFlow} animationType="fade" transparent={false}>
        <View style={styles.processingScreen}>
          <ActivityIndicator color={palette.accent} size="large" />
          <Text style={styles.processingTitle}>Verificando medio de pago</Text>
          <Text style={styles.processingCopy}>Estamos validando la informacion ingresada antes de guardar tu cuenta.</Text>
        </View>
      </Modal>

      <FeedbackModal
        visible={feedbackVisible}
        title={feedbackTitle}
        message={feedbackMessage}
        onClose={() => setFeedbackVisible(false)}
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
    width: "100%",
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
    letterSpacing: -1,
    textAlign: "center"
  },
  heroCopy: {
    marginTop: 12,
    color: palette.text,
    textAlign: "center",
    lineHeight: 28,
    fontSize: 16
  },
  section: {
    marginBottom: 26,
    gap: 16
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
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  chipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.surfaceWarm
  },
  chipText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "600"
  },
  chipTextActive: {
    color: palette.accent,
    fontWeight: "800"
  },
  field: {
    gap: 8
  },
  label: {
    fontSize: 16,
    color: palette.ink
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
    color: palette.white,
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
  deleteButton: {
    marginTop: 16,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D89A95",
    backgroundColor: "#FFF4F3",
    alignItems: "center",
    justifyContent: "center"
  },
  deleteButtonText: {
    color: "#C0443E",
    fontSize: 16,
    fontWeight: "800"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 24, 38, 0.25)",
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
  },
  processingScreen: {
    flex: 1,
    backgroundColor: palette.backgroundSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32
  },
  processingTitle: {
    marginTop: 18,
    color: palette.ink,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center"
  },
  processingCopy: {
    marginTop: 12,
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center"
  }
});
