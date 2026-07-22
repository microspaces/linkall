import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import { brand } from "../../src/brand";
import { useCurrentUser } from "../../src/current-user";
import { EmptyState } from "../../src/ui";

export default function GroupsScreen() {
  const { userId } = useCurrentUser();
  const groups = useQuery(api.groups.list, { userId });
  const join = useMutation(api.groups.join);
  const leave = useMutation(api.groups.leave);

  return (
    <FlatList
      data={groups ?? []}
      keyExtractor={(item) => item._id}
      contentContainerStyle={{ paddingVertical: 8 }}
      ListEmptyComponent={
        groups === undefined ? null : <EmptyState title="No groups yet" />
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Link href={`/group/${item._id}`} asChild>
            <Pressable style={{ flex: 1 }}>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.body} numberOfLines={2}>
                {item.description}
              </Text>
              <Text style={styles.meta}>
                {item.kind} · {item.memberCount} members
              </Text>
            </Pressable>
          </Link>
          {userId && (
            <Pressable
              onPress={() =>
                item.isMember
                  ? leave({ groupId: item._id, userId })
                  : join({ groupId: item._id, userId })
              }
              style={[
                styles.button,
                item.isMember
                  ? styles.buttonOutline
                  : { backgroundColor: brand.colors.primary },
              ]}
            >
              <Text
                style={
                  item.isMember
                    ? styles.buttonOutlineText
                    : styles.buttonText
                }
              >
                {item.isMember ? "Leave" : "Join"}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  title: { fontWeight: "700", color: "#111827" },
  body: { marginTop: 2, color: "#6b7280", fontSize: 13 },
  meta: { marginTop: 6, color: "#9ca3af", fontSize: 12 },
  button: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  buttonText: { color: "white", fontWeight: "600", fontSize: 13 },
  buttonOutline: { borderWidth: 1, borderColor: "#d1d5db" },
  buttonOutlineText: { color: "#4b5563", fontWeight: "600", fontSize: 13 },
});
