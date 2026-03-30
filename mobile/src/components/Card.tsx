import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { palette } from "@/src/lib/theme";

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.parchment,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: palette.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4
  }
});
