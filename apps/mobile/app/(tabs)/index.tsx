import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import { brand } from "../../src/brand";
import { EmptyState } from "../../src/ui";

/**
 * Brand-aware home: shows for show brands, resources for RedWave.
 */
export default function HomeScreen() {
  const shows = useQuery(
    api.shows.list,
    brand.features.shows ? {} : "skip",
  );
  const resources = useQuery(
    api.resources.children,
    brand.features.resources ? {} : "skip",
  );

  const header = (
    <View>
      <View style={[styles.hero, { backgroundColor: brand.colors.primary }]}>
        <Text style={styles.heroTitle}>{brand.tagline}</Text>
        <Text style={styles.heroBody}>{brand.description}</Text>
      </View>
      {brand.features.shows && (
        <Link href="/calibrate" asChild>
          <Pressable style={styles.calibrate}>
            <Text style={styles.calibrateTitle}>Calibrate Dual Projectors</Text>
            <Text style={styles.calibrateBody}>
              Line up a stacked cabinet with the phone camera
            </Text>
          </Pressable>
        </Link>
      )}
    </View>
  );

  if (brand.features.resources) {
    return (
      <FlatList
        data={resources ?? []}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          resources === undefined ? null : <EmptyState title="No resources yet" />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
          </View>
        )}
      />
    );
  }

  return (
    <FlatList
      data={shows ?? []}
      keyExtractor={(item) => item._id}
      ListHeaderComponent={header}
      ListEmptyComponent={
        shows === undefined ? null : <EmptyState title="No shows yet" />
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.status === "live" && (
              <Text style={styles.liveBadge}>● LIVE</Text>
            )}
          </View>
          <Text style={styles.cardBody}>{item.description}</Text>
          {item.tag && <Text style={styles.tag}>#{item.tag}</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  hero: { padding: 24, paddingBottom: 32 },
  heroTitle: { color: "white", fontSize: 24, fontWeight: "800" },
  heroBody: { color: "rgba(255,255,255,0.85)", marginTop: 8, lineHeight: 20 },
  card: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  cardTitle: { fontWeight: "700", fontSize: 15, color: "#111827", flex: 1 },
  cardBody: { marginTop: 4, color: "#6b7280", fontSize: 13, lineHeight: 18 },
  liveBadge: { color: "#dc2626", fontWeight: "700", fontSize: 12 },
  tag: { marginTop: 8, fontSize: 12, color: "#9ca3af" },
  calibrate: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#111827",
  },
  calibrateTitle: { color: "#fff", fontWeight: "800", fontSize: 16 },
  calibrateBody: { color: "rgba(255,255,255,0.7)", marginTop: 4, fontSize: 13 },
});
