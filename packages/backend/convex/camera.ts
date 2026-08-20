import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const HEARTBEAT_STALE_MS = 15_000;

/**
 * Signaling for a remote camera fill. The laptop/iOS capture page is the
 * only publisher. Head / Preview pages subscribe — they never getUserMedia.
 */

export const peers = query({
  args: { screenId: v.id("screens") },
  handler: async (ctx, { screenId }) => {
    const rows = await ctx.db
      .query("cameraPeers")
      .withIndex("by_screen", (q) => q.eq("screenId", screenId))
      .collect();
    const now = Date.now();
    return rows.filter((p) => now - p.heartbeatAt < HEARTBEAT_STALE_MS);
  },
});

export const signalsFor = query({
  args: { screenId: v.id("screens"), clientId: v.string() },
  handler: async (ctx, { screenId, clientId }) => {
    return await ctx.db
      .query("cameraSignals")
      .withIndex("by_screen_to", (q) =>
        q.eq("screenId", screenId).eq("toClientId", clientId),
      )
      .collect();
  },
});

export const heartbeat = mutation({
  args: {
    screenId: v.id("screens"),
    clientId: v.string(),
    role: v.union(v.literal("publisher"), v.literal("subscriber")),
  },
  handler: async (ctx, { screenId, clientId, role }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("cameraPeers")
      .withIndex("by_screen_client", (q) =>
        q.eq("screenId", screenId).eq("clientId", clientId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { role, heartbeatAt: now });
      return existing._id;
    }
    if (role === "publisher") {
      const peers = await ctx.db
        .query("cameraPeers")
        .withIndex("by_screen", (q) => q.eq("screenId", screenId))
        .collect();
      for (const p of peers) {
        if (p.role === "publisher" && now - p.heartbeatAt >= HEARTBEAT_STALE_MS) {
          await ctx.db.delete(p._id);
        }
      }
    }
    return await ctx.db.insert("cameraPeers", {
      screenId,
      clientId,
      role,
      heartbeatAt: now,
    });
  },
});

export const leave = mutation({
  args: { screenId: v.id("screens"), clientId: v.string() },
  handler: async (ctx, { screenId, clientId }) => {
    const existing = await ctx.db
      .query("cameraPeers")
      .withIndex("by_screen_client", (q) =>
        q.eq("screenId", screenId).eq("clientId", clientId),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    const inbound = await ctx.db
      .query("cameraSignals")
      .withIndex("by_screen_to", (q) =>
        q.eq("screenId", screenId).eq("toClientId", clientId),
      )
      .collect();
    for (const s of inbound) await ctx.db.delete(s._id);
  },
});

export const sendSignal = mutation({
  args: {
    screenId: v.id("screens"),
    fromClientId: v.string(),
    toClientId: v.string(),
    kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("cameraSignals", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const ackSignals = mutation({
  args: { ids: v.array(v.id("cameraSignals")) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) {
      const row = await ctx.db.get(id);
      if (row) await ctx.db.delete(id);
    }
  },
});
