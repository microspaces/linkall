import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";
import { brand } from "../../src/brand";
import { loadGuestKey } from "../../src/guest-key";
import { EmptyState } from "../../src/ui";

type Cart = Record<string, number>;

export default function OrderScreen() {
  const [guestKey, setGuestKey] = useState("");
  const [code, setCode] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void loadGuestKey().then(setGuestKey);
  }, []);

  const guest = useQuery(
    api.venue.guestView,
    guestKey ? { guestKey } : "skip",
  );
  const myOrders = useQuery(
    api.venue.myOrders,
    guestKey ? { guestKey } : "skip",
  );
  const claimPlace = useMutation(api.venue.claimPlace);
  const placeOrder = useMutation(api.venue.placeOrder);

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const item of guest?.menu ?? []) {
      if (!seen.includes(item.category)) seen.push(item.category);
    }
    return seen;
  }, [guest?.menu]);

  if (!brand.features.venueService) {
    return <EmptyState title="Venue service is off for this brand" />;
  }
  if (!guestKey || guest === undefined) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }
  if (!guest) {
    return <EmptyState title="No venue yet" />;
  }
  if (!guest.phonesOn) {
    return (
      <EmptyState title="Phone features are off tonight" />
    );
  }
  if (!guest.canOrder) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Phone ordering is off</Text>
        <Text style={styles.muted}>
          Join-as-screen can still be used on the web /order page.
        </Text>
      </View>
    );
  }

  const setQty = (id: string, delta: number) => {
    setCart((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const send = async () => {
    setError(null);
    const lines = Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([menuItemId, quantity]) => ({
        menuItemId: menuItemId as Id<"menuItems">,
        quantity,
      }));
    try {
      await placeOrder({
        venueId: guest.venue._id,
        guestKey,
        lines,
      });
      setCart({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.kicker}>{guest.venue.name}</Text>
      <Text style={styles.title}>
        {guest.claim?.placeName ?? "Where are you?"}
      </Text>

      {!guest.claim && (
        <View style={styles.row}>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Seat / zone code"
            placeholderTextColor="#9ca3af"
            style={styles.input}
            autoCapitalize="characters"
          />
          <Pressable
            style={styles.primary}
            onPress={() => {
              if (!code.trim()) return;
              void claimPlace({
                venueId: guest.venue._id,
                guestKey,
                code,
              })
                .then(() => setCode(""))
                .catch((e: unknown) =>
                  setError(e instanceof Error ? e.message : "Claim failed"),
                );
            }}
          >
            <Text style={styles.primaryText}>Claim</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.chips}>
        {guest.places.slice(0, 24).map((p) => (
          <Pressable
            key={p._id}
            onPress={() =>
              void claimPlace({
                venueId: guest.venue._id,
                guestKey,
                placeId: p._id,
              })
            }
            style={[
              styles.chip,
              guest.claim?.placeId === p._id && {
                backgroundColor: brand.colors.primary,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                guest.claim?.placeId === p._id && { color: "#fff" },
              ]}
            >
              {p.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {categories.map((cat) => (
        <View key={cat} style={{ marginTop: 16 }}>
          <Text style={styles.cat}>{cat}</Text>
          {guest.menu
            .filter((item) => item.category === cat)
            .map((item) => (
              <View key={item._id} style={styles.item}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.muted}>
                    ${(item.priceCents / 100).toFixed(2)}
                    {!item.isAvailable ? " · 86’d" : ""}
                  </Text>
                </View>
                {item.isAvailable && (
                  <View style={styles.stepper}>
                    <Pressable onPress={() => setQty(item._id, -1)} style={styles.step}>
                      <Text style={styles.stepText}>−</Text>
                    </Pressable>
                    <Text style={styles.qty}>{cart[item._id] ?? 0}</Text>
                    <Pressable onPress={() => setQty(item._id, 1)} style={styles.step}>
                      <Text style={styles.stepText}>+</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
        </View>
      ))}

      {error && <Text style={styles.err}>{error}</Text>}

      <Pressable
        style={[
          styles.send,
          { backgroundColor: brand.colors.primary },
          Object.values(cart).every((q) => q <= 0) && { opacity: 0.4 },
        ]}
        disabled={Object.values(cart).every((q) => q <= 0)}
        onPress={() => void send()}
      >
        <Text style={styles.primaryText}>Send to bar</Text>
      </Pressable>

      {(myOrders ?? []).slice(0, 5).map((o) => (
        <View key={o._id} style={styles.ticket}>
          <Text style={styles.itemName}>
            {o.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}
          </Text>
          <Text style={styles.muted}>{o.status}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  kicker: { fontSize: 12, color: "#6b7280", textTransform: "uppercase" },
  title: { fontSize: 22, fontWeight: "800", color: "#111827", marginTop: 4 },
  muted: { color: "#6b7280", fontSize: 13, marginTop: 4 },
  row: { flexDirection: "row", gap: 8, marginTop: 16 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  primary: {
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  chipText: { fontSize: 13, fontWeight: "600", color: "#111827" },
  cat: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  itemName: { fontWeight: "700", color: "#111827" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  step: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontSize: 18, fontWeight: "700" },
  qty: { width: 18, textAlign: "center", fontWeight: "700" },
  err: { color: "#dc2626", marginTop: 12 },
  send: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ticket: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
});
