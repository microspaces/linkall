import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { brand } from "../../src/brand";
import { useCurrentUser } from "../../src/current-user";
import { EmptyState, Initials } from "../../src/ui";

export default function ProfileScreen() {
  const { user, isLoading, isAuthenticated, signOut } = useCurrentUser();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <View style={styles.center}>
        <EmptyState title="You're signed out" />
        <Pressable
          onPress={() => router.push("/signin")}
          style={[styles.button, { backgroundColor: brand.colors.primary }]}
        >
          <Text style={styles.buttonText}>Sign in with email</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Initials name={user.name} size={64} />
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.handle}>
          @{user.handle} · {user.tier}
        </Text>
        {user.email ? <Text style={styles.email}>{user.email}</Text> : null}
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
      </View>
      <Pressable onPress={() => void signOut()} style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: { alignItems: "center", padding: 24 },
  name: { marginTop: 12, fontSize: 20, fontWeight: "800", color: "#111827" },
  handle: { marginTop: 2, color: "#6b7280" },
  email: { marginTop: 4, color: "#6b7280", fontSize: 13 },
  bio: { marginTop: 8, color: "#4b5563", textAlign: "center" },
  muted: { color: "#6b7280" },
  button: {
    marginTop: 16,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  signOut: {
    alignSelf: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  signOutText: { color: "#374151", fontWeight: "600" },
});
