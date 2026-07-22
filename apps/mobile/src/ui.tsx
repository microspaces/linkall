import { Text, View, StyleSheet } from "react-native";
import { brand } from "./brand";

export function Initials({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: brand.colors.primary,
        },
      ]}
    >
      <Text style={{ color: "white", fontSize: size * 0.4, fontWeight: "700" }}>
        {initials}
      </Text>
    </View>
  );
}

export function EmptyState({ title }: { title: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyHint}>
        Seed mock data: pnpm --filter @linkall/backend seed:{brand.id}
      </Text>
    </View>
  );
}

export function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
  empty: {
    margin: 16,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d1d5db",
    alignItems: "center",
  },
  emptyTitle: { fontWeight: "600", color: "#374151" },
  emptyHint: { marginTop: 6, fontSize: 12, color: "#9ca3af", textAlign: "center" },
});
