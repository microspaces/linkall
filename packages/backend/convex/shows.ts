import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Live show engine. In the legacy app this was the Show → Scene → Effect SQL
 * stack with Designer / Player / Screen pages synced via the SignalR
 * DisplayHub. Here, Convex subscriptions give every connected player/screen
 * the new scene automatically when an operator advances the show.
 */

export const list = query({
  args: { tag: v.optional(v.string()) },
  handler: async (ctx, { tag }) => {
    const shows = await ctx.db.query("shows").collect();
    const filtered = tag ? shows.filter((s) => s.tag === tag) : shows;
    // Live shows first, then drafts, then ended.
    const rank = { live: 0, draft: 1, ended: 2 } as const;
    return filtered.sort((a, b) => rank[a.status] - rank[b.status]);
  },
});

export const get = query({
  args: { showId: v.id("shows") },
  handler: async (ctx, { showId }) => {
    const show = await ctx.db.get(showId);
    if (!show) return null;
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", showId))
      .collect();
    scenes.sort((a, b) => a.order - b.order);
    return { ...show, scenes };
  },
});

export const setStatus = mutation({
  args: {
    showId: v.id("shows"),
    status: v.union(v.literal("draft"), v.literal("live"), v.literal("ended")),
  },
  handler: async (ctx, { showId, status }) => {
    await ctx.db.patch(showId, {
      status,
      ...(status === "live"
        ? { currentSceneIndex: 0, sceneStartedAt: Date.now() }
        : {}),
    });
  },
});

export const setScene = mutation({
  args: { showId: v.id("shows"), index: v.number() },
  handler: async (ctx, { showId, index }) => {
    const show = await ctx.db.get(showId);
    if (!show) throw new Error("Show not found");
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", showId))
      .collect();
    const clamped = Math.max(0, Math.min(index, scenes.length - 1));
    await ctx.db.patch(showId, {
      currentSceneIndex: clamped,
      sceneStartedAt: Date.now(),
    });
  },
});

/**
 * One-tap play from the Player console: makes the show live (if it isn't)
 * and jumps to the given scene. Every subscribed Screen page follows.
 */
export const playScene = mutation({
  args: { showId: v.id("shows"), index: v.number() },
  handler: async (ctx, { showId, index }) => {
    const show = await ctx.db.get(showId);
    if (!show) throw new Error("Show not found");
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", showId))
      .collect();
    const clamped = Math.max(0, Math.min(index, scenes.length - 1));
    await ctx.db.patch(showId, {
      status: "live",
      currentSceneIndex: clamped,
      sceneStartedAt: Date.now(),
    });
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    tag: v.optional(v.string()),
    layoutId: v.optional(v.id("layouts")),
    ownerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("shows", {
      ...args,
      status: "draft",
      currentSceneIndex: 0,
    });
  },
});

export const addScene = mutation({
  args: {
    showId: v.id("shows"),
    title: v.string(),
    kind: v.union(
      v.literal("title"),
      v.literal("image"),
      v.literal("text"),
      v.literal("score"),
    ),
    content: v.string(),
  },
  handler: async (ctx, { showId, title, kind, content }) => {
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", showId))
      .collect();
    return await ctx.db.insert("scenes", {
      showId,
      title,
      kind,
      content,
      order: scenes.length,
    });
  },
});
