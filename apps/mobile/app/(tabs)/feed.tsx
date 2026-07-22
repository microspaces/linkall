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
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import { brand } from "../../src/brand";
import { useCurrentUser } from "../../src/current-user";
import { EmptyState, Initials, timeAgo } from "../../src/ui";

export default function FeedScreen() {
  const { userId } = useCurrentUser();
  const posts = useQuery(api.posts.feed, { userId });
  const createPost = useMutation(api.posts.create);
  const toggleUpvote = useMutation(api.posts.toggleUpvote);
  const [content, setContent] = useState("");

  const submit = async () => {
    if (!content.trim() || !userId) return;
    await createPost({ authorId: userId, content });
    setContent("");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        data={posts ?? []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingVertical: 8 }}
        ListEmptyComponent={
          posts === undefined ? null : <EmptyState title="No posts yet" />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Initials name={item.author?.name ?? "?"} size={32} />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.author}>{item.author?.name}</Text>
                <Text style={styles.meta}>{timeAgo(item._creationTime)}</Text>
              </View>
            </View>
            <Text style={styles.content}>{item.content}</Text>
            <Pressable
              onPress={() =>
                userId && toggleUpvote({ postId: item._id, userId })
              }
            >
              <Text
                style={[
                  styles.upvote,
                  item.hasUpvoted && { color: brand.colors.primary },
                ]}
              >
                ▲ {item.upvotes}
              </Text>
            </Pressable>
          </View>
        )}
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Share something…"
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
  meta: { color: "#9ca3af", fontSize: 12 },
  content: { marginTop: 10, color: "#1f2937", lineHeight: 20 },
  upvote: { marginTop: 10, color: "#6b7280", fontWeight: "600" },
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
  send: {
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
});
