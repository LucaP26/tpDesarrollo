import { Pressable, StyleSheet, Text } from "react-native";

import { palette } from "@/src/lib/theme";

export function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: palette.amberDeep,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: "center"
  },
  label: {
    color: palette.white,
    fontSize: 16,
    fontWeight: "700"
  }
});
