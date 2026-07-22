import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import { brand } from "../../src/brand";
import { useCurrentUser } from "../../src/current-user";
import { EmptyState, Initials } from "../../src/ui";

/** Demo-user switcher, standing in for real auth while testing. */
export default function ProfileScreen() {
  const users = useQuery(api.users.list);
  const { user, setUserId } = useCurrentUser();

  return (
    <FlatList
      data={users ?? []}
      keyExtractor={(item) => item._id}
      ListHeaderComponent={
        <View style={styles.header}>
          {user && (
            <>
              <Initials name={user.name} size={64} />
              <Text style={styles.name}>{user.name}</Text>
              <Text style={styles.handle}>
                @{user.handle} · {user.tier}
              </Text>
              {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
            </>
          )}
          <Text style={styles.sectionTitle}>Switch demo user</Text>
        </View>
      }
      ListEmptyComponent={
        users === undefined ? null : <EmptyState title="No users yet" />
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => setUserId(item._id)}
          style={[
            styles.userRow,
            item._id === user?._id && {
              borderColor: brand.colors.primary,
              backgroundColor: brand.colors.primaryLight,
            },
          ]}
        >
          <Initials name={item.name} size={36} />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={styles.rowHandle}>@{item.handle}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", padding: 24 },
  name: { marginTop: 12, fontSize: 20, fontWeight: "800", color: "#111827" },
  handle: { marginTop: 2, color: "#6b7280" },
  bio: { marginTop: 8, color: "#4b5563", textAlign: "center" },
  sectionTitle: {
    alignSelf: "flex-start",
    marginTop: 24,
    fontWeight: "700",
    color: "#374151",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  rowName: { fontWeight: "600", color: "#111827" },
  rowHandle: { color: "#9ca3af", fontSize: 12 },
});
