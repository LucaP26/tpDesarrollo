import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef } from "react";
import { Animated, Image, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { palette } from "@/src/lib/theme";

const splashArtwork = require("../src/assets/images/curator-splash-reference.png");

export default function IndexScreen() {
  const router = useRouter();
  const enteredRef = useRef(false);
  const dragY = useRef(new Animated.Value(0)).current;

  const handleEnter = useCallback(() => {
    if (enteredRef.current) {
      return;
    }
    enteredRef.current = true;
    router.push("/login");
  }, [router]);

  const resetDrag = useCallback(() => {
    Animated.spring(dragY, {
      toValue: 0,
      tension: 70,
      friction: 10,
      useNativeDriver: true
    }).start();
  }, [dragY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_event, gestureState) => {
          dragY.setValue(Math.min(0, Math.max(gestureState.dy, -88)));
        },
        onPanResponderRelease: (_event, gestureState) => {
          if (gestureState.dy < -60 || gestureState.vy < -0.85) {
            handleEnter();
            return;
          }
          resetDrag();
        },
        onPanResponderTerminate: resetDrag
      }),
    [dragY, handleEnter, resetDrag]
  );

  const artworkTranslateY = dragY.interpolate({
    inputRange: [-88, 0],
    outputRange: [-18, 0],
    extrapolate: "clamp"
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen} {...panResponder.panHandlers}>
        <Animated.View style={[styles.artworkWrap, { transform: [{ translateY: artworkTranslateY }] }]}>
          <Image source={splashArtwork} resizeMode="stretch" style={styles.artwork} />
        </Animated.View>

        <Pressable
          accessibilityLabel="Entrar a la galeria"
          accessibilityRole="button"
          hitSlop={24}
          onPress={handleEnter}
          style={styles.enterHitArea}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background
  },
  screen: {
    flex: 1,
    backgroundColor: palette.background,
    overflow: "hidden"
  },
  artworkWrap: {
    flex: 1
  },
  artwork: {
    width: "100%",
    height: "100%"
  },
  enterHitArea: {
    position: "absolute",
    right: 70,
    bottom: 120,
    left: 70,
    height: 110
  }
});
