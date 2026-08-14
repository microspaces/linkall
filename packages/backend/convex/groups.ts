import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { joinPublicAndHomeGroups } from "./importLinkAll8";

async function withMembership(
  ctx: QueryCtx,
  groups: Doc<"groups">[],
  userId?: Id<"users">,
) {
  const memberships = userId
    ? await ctx.db
        .query("groupMembers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    : [];
  const memberOf = new Map(memberships.map((m) => [m.groupId, m]));

  return groups.map((g) => {
    const m = memberOf.get(g._id);
    return {
      ...g,
      isMember: m !== undefined,
      isFavorite: m?.isFavorite ?? false,
    };
  });
}

export const list = query({
  args: {
    userId: v.optional(v.id("users")),
    kind: v.optional(
      v.union(
        v.literal("public"),
        v.literal("private"),
        v.literal("state"),
        v.literal("county"),
      ),
    ),
  },
  handler: async (ctx, { userId, kind }) => {
    const groups = kind
      ? await ctx.db
          .query("groups")
          .withIndex("by_kind", (q) => q.eq("kind", kind))
          .collect()
      : await ctx.db.query("groups").collect();

    return await withMembership(ctx, groups, userId);
  },
});

function byName<T extends { name: string }>(a: T, b: T) {
  return a.name.localeCompare(b.name);
}

/** Left + right sidebar buckets (legacy Top/Hot/Favorites + Followed/Not Followed). */
export const sidebar = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, { userId }) => {
    const groups = await ctx.db.query("groups").collect();
    const rows = await withMembership(ctx, groups, userId);

    let top = rows
      .filter((g) => g.leftmenu === 1 && g.kind === "public")
      .sort(byName);
    let hot = rows
      .filter((g) => g.leftmenu === 2 && g.kind === "public")
      .sort(byName);
    const favorites = rows.filter((g) => g.isFavorite).sort(byName);
    // Followed includes home state/county; Not Followed is public groups only
    // (Ω geo groups stay out of the general list, same as LinkAll8).
    const followed = rows
      .filter((g) => g.isMember)
      .sort(byName);
    const notFollowed = rows
      .filter((g) => !g.isMember && g.kind === "public")
      .sort(byName);

    return { top, hot, favorites, followed, notFollowed };
  },
});

export const get = query({
  args: { groupId: v.id("groups"), userId: v.optional(v.id("users")) },
  handler: async (ctx, { groupId, userId }) => {
    const group = await ctx.db.get(groupId);
    if (!group) return null;

    const membership = userId
      ? await ctx.db
          .query("groupMembers")
          .withIndex("by_group_user", (q) =>
            q.eq("groupId", groupId).eq("userId", userId),
          )
          .unique()
      : null;

    return {
      ...group,
      isMember: membership !== null,
      isAdmin: membership?.isAdmin ?? false,
      isFavorite: membership?.isFavorite ?? false,
    };
  },
});

export const members = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const rows = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    const users = await Promise.all(rows.map((r) => ctx.db.get(r.userId)));
    return rows
      .map((r, i) => ({ ...r, user: users[i] }))
      .filter((r) => r.user !== null);
  },
});

export const join = mutation({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, { groupId, userId }) => {
    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_user", (q) =>
        q.eq("groupId", groupId).eq("userId", userId),
      )
      .unique();
    if (existing) return;

    const group = await ctx.db.get(groupId);
    if (!group) throw new Error("Group not found");

    await ctx.db.insert("groupMembers", { groupId, userId, isAdmin: false });
    await ctx.db.patch(groupId, { memberCount: group.memberCount + 1 });
  },
});

export const leave = mutation({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, { groupId, userId }) => {
    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_user", (q) =>
        q.eq("groupId", groupId).eq("userId", userId),
      )
      .unique();
    if (!existing) return;

    const group = await ctx.db.get(groupId);
    await ctx.db.delete(existing._id);
    if (group) {
      await ctx.db.patch(groupId, {
        memberCount: Math.max(0, group.memberCount - 1),
      });
    }
  },
});

/** Star / unstar a joined group (legacy Favorites column). */
export const toggleFavorite = mutation({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, { groupId, userId }) => {
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_user", (q) =>
        q.eq("groupId", groupId).eq("userId", userId),
      )
      .unique();
    if (!membership) throw new Error("Join the group first");
    await ctx.db.patch(membership._id, {
      isFavorite: !(membership.isFavorite ?? false),
    });
  },
});

/**
 * Legacy behavior: auto-subscribe to all public groups, plus the user's
 * state and county (from zip at registration).
 */
export const ensureMembership = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await joinPublicAndHomeGroups(ctx, userId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, { name, description, userId }) => {
    const groupId = await ctx.db.insert("groups", {
      name,
      description,
      kind: "public",
      createdBy: userId,
      memberCount: 1,
    });
    await ctx.db.insert("groupMembers", { groupId, userId, isAdmin: true });
    return groupId;
  },
});
