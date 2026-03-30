import { Feather } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { palette } from "@/src/lib/theme";

interface FeedbackModalProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export function FeedbackModal({ visible, title, message, onClose }: FeedbackModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Feather name="alert-circle" size={24} color={palette.accent} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Entendido</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 24, 38, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: palette.backgroundSoft,
    padding: 24,
    borderWidth: 1,
    borderColor: palette.border
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  title: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "800"
  },
  message: {
    marginTop: 10,
    color: palette.text,
    fontSize: 15,
    lineHeight: 24
  },
  button: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20
  },
  buttonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: "800"
  }
});
