import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Redirect, Tabs } from "expo-router";
import { Text } from "react-native";

import { useSession } from "@/src/lib/session";
import { palette } from "@/src/lib/theme";

export default function TabsLayout() {
  const { token } = useSession();
  const [iconFontsLoaded] = useFonts({
    ...Feather.font,
    ...MaterialCommunityIcons.font
  });

  function renderTabFallback(symbol: string, color: string, size: number) {
    return (
      <Text
        style={{
          color,
          fontSize: size,
          lineHeight: size + 2,
          fontWeight: "700"
        }}
      >
        {symbol}
      </Text>
    );
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.background },
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          height: 82,
          paddingTop: 10,
          paddingBottom: 12
        },
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.nav,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2
        }
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) =>
            iconFontsLoaded ? <Feather name="home" color={color} size={size} /> : renderTabFallback("⌂", color, size)
        }}
      />
      <Tabs.Screen
        name="auctions"
        options={{
          title: "Subastas",
          tabBarIcon: ({ color, size }) =>
            iconFontsLoaded ? (
              <MaterialCommunityIcons name="gavel" color={color} size={size} />
            ) : (
              renderTabFallback("⚒", color, size)
            )
        }}
      />
      <Tabs.Screen
        name="bids"
        options={{
          title: "Pujas",
          tabBarIcon: ({ color, size }) =>
            iconFontsLoaded ? (
              <MaterialCommunityIcons name="ticket-confirmation-outline" color={color} size={size} />
            ) : (
              renderTabFallback("◈", color, size)
            )
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) =>
            iconFontsLoaded ? <Feather name="user" color={color} size={size} /> : renderTabFallback("◉", color, size)
        }}
      />
      <Tabs.Screen name="sell" options={{ href: null }} />
    </Tabs>
  );
}
