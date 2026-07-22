import { useMemo } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { brand } from "../src/brand";
import { CurrentUserProvider } from "../src/current-user";

export default function RootLayout() {
  const url = process.env.EXPO_PUBLIC_CONVEX_URL;
  const client = useMemo(
    () => (url ? new ConvexReactClient(url, { unsavedChangesWarning: false }) : null),
    [url],
  );

  if (!client) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontWeight: "700", fontSize: 16 }}>Backend not configured</Text>
        <Text style={{ marginTop: 8, color: "#6b7280", textAlign: "center" }}>
          Set EXPO_PUBLIC_CONVEX_URL (and EXPO_PUBLIC_BRAND) in apps/mobile/.env,
          then restart Expo.
        </Text>
      </View>
    );
  }

  return (
    <ConvexProvider client={client}>
      <CurrentUserProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: brand.colors.primary },
            headerTintColor: "#ffffff",
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="group/[id]" options={{ title: "Group" }} />
        </Stack>
      </CurrentUserProvider>
    </ConvexProvider>
  );
}
