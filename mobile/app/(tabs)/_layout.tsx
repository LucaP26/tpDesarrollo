import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";

import { useSession } from "@/src/lib/session";
import { palette } from "@/src/lib/theme";

export default function TabsLayout() {
  const { token } = useSession();

  if (!token) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.background },
        tabBarStyle: {
          backgroundColor: palette.backgroundSoft,
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
          tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="auctions"
        options={{
          title: "Subastas",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="gavel" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="bids"
        options={{
          title: "Pujas",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="ticket-confirmation-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} />
        }}
      />
      <Tabs.Screen name="sell" options={{ href: null }} />
    </Tabs>
  );
}
