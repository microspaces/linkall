import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";
import { brand } from "../../src/brand";
import { useCurrentUser } from "../../src/current-user";
import { EmptyState, Initials, timeAgo } from "../../src/ui";

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id as Id<"groups">;
  const { userId } = useCurrentUser();
  const group = useQuery(api.groups.get, { groupId, userId });
  const posts = useQuery(api.posts.feed, { groupId, userId });
  const createPost = useMutation(api.posts.create);
  const [content, setContent] = useState("");

  const submit = async () => {
    if (!content.trim() || !userId) return;
    await createPost({ authorId: userId, content, groupId });
    setContent("");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: group?.name ?? "Group" }} />
      <FlatList
        data={posts ?? []}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={
          group ? (
            <View style={styles.header}>
              <Text style={styles.title}>{group.name}</Text>
              <Text style={styles.body}>{group.description}</Text>
              <Text style={styles.meta}>
                {group.kind} · {group.memberCount} members
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          posts === undefined ? null : <EmptyState title="No posts yet" />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Initials name={item.author?.name ?? "?"} size={30} />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.author}>{item.author?.name}</Text>
                <Text style={styles.meta}>{timeAgo(item._creationTime)}</Text>
              </View>
            </View>
            <Text style={styles.content}>{item.content}</Text>
          </View>
        )}
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Post to the group…"
          value={content}
          onChangeText={setContent}
        />
        <Pressable
          onPress={submit}
          style={[styles.send, { backgroundColor: brand.colors.primary }]}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Post</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "white",
    padding: 20,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },
  title: { fontSize: 20, fontWeight: "800", color: "#111827" },
  body: { marginTop: 6, color: "#6b7280" },
  meta: { marginTop: 6, color: "#9ca3af", fontSize: 12 },
  card: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  row: { flexDirection: "row", alignItems: "center" },
  author: { fontWeight: "700", color: "#111827", fontSize: 14 },
  content: { marginTop: 10, color: "#1f2937", lineHeight: 20 },
  composer: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  send: { borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
});
