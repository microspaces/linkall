import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { expandStateName } from "./geo";

/**
 * Import LinkAll8 SQL data (groups, users, default memberships).
 */

const groupSpec = v.object({
  legacyId: v.string(),
  name: v.string(),
  description: v.string(),
  kind: v.union(
    v.literal("public"),
    v.literal("private"),
    v.literal("state"),
    v.literal("county"),
  ),
  state: v.optional(v.string()),
  county: v.optional(v.string()),
  leftmenu: v.optional(v.union(v.literal(1), v.literal(2))),
  memberCount: v.number(),
  category: v.optional(v.string()),
  photoUrl: v.optional(v.string()),
});

const userSpec = v.object({
  legacyId: v.string(),
  name: v.string(),
  handle: v.string(),
  email: v.optional(v.string()),
  bio: v.optional(v.string()),
  zipCode: v.optional(v.string()),
  state: v.optional(v.string()),
  county: v.optional(v.string()),
  tier: v.union(
    v.literal("free"),
    v.literal("silver"),
    v.literal("gold"),
    v.literal("admin"),
  ),
});

async function importerUser(ctx: MutationCtx): Promise<Id<"users">> {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_handle", (q) => q.eq("handle", "linkall8"))
    .unique();
  if (existing) return existing._id;
  return await ctx.db.insert("users", {
    name: "LinkAll8 Import",
    handle: "linkall8",
    bio: "Imported from the legacy LinkAll8 SQL database.",
    tier: "admin",
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/png?seed=linkall8",
  });
}

async function joinIfNeeded(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  userId: Id<"users">,
) {
  const existing = await ctx.db
    .query("groupMembers")
    .withIndex("by_group_user", (q) =>
      q.eq("groupId", groupId).eq("userId", userId),
    )
    .unique();
  if (existing) return false;
  const group = await ctx.db.get(groupId);
  if (!group) return false;
  await ctx.db.insert("groupMembers", {
    groupId,
    userId,
    isAdmin: false,
  });
  await ctx.db.patch(groupId, { memberCount: group.memberCount + 1 });
  return true;
}

export async function joinPublicAndHomeGroups(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!user) return { joined: 0 };
  let joined = 0;

  const publicGroups = await ctx.db
    .query("groups")
    .withIndex("by_kind", (q) => q.eq("kind", "public"))
    .collect();
  for (const group of publicGroups) {
    if (await joinIfNeeded(ctx, group._id, userId)) joined++;
  }

  const stateName = expandStateName(user.state);
  if (stateName) {
    const inState = await ctx.db
      .query("groups")
      .withIndex("by_state", (q) => q.eq("state", stateName))
      .collect();
    const stateGroup = inState.find((g) => g.kind === "state");
    if (stateGroup && (await joinIfNeeded(ctx, stateGroup._id, userId))) {
      joined++;
    }
    if (user.county) {
      const countyName = user.county.trim();
      const countyGroup = inState.find(
        (g) =>
          g.kind === "county" &&
          (g.county || "").toLowerCase() === countyName.toLowerCase(),
      );
      if (countyGroup && (await joinIfNeeded(ctx, countyGroup._id, userId))) {
        joined++;
      }
    }
  }
  return { joined };
}

export const groups = mutation({
  args: { groups: v.array(groupSpec) },
  handler: async (ctx, { groups }) => {
    const ownerId = await importerUser(ctx);
    let inserted = 0;
    let updated = 0;
    const idMap: Record<string, string> = {};

    for (const g of groups) {
      const found = await ctx.db
        .query("groups")
        .withIndex("by_name", (q) => q.eq("name", g.name))
        .unique();
      if (found) {
        await ctx.db.patch(found._id, {
          description: g.description || found.description,
          kind: g.kind,
          state: g.state,
          county: g.county,
          leftmenu: g.leftmenu,
          memberCount: Math.max(found.memberCount, g.memberCount),
          category: g.category ?? found.category,
          photoUrl: g.photoUrl ?? found.photoUrl,
        });
        idMap[g.legacyId] = found._id;
        updated++;
      } else {
        const groupId = await ctx.db.insert("groups", {
          name: g.name,
          description: g.description,
          kind: g.kind,
          state: g.state,
          county: g.county,
          leftmenu: g.leftmenu,
          category: g.category,
          photoUrl: g.photoUrl,
          createdBy: ownerId,
          memberCount: g.memberCount,
        });
        idMap[g.legacyId] = groupId;
        inserted++;
      }
    }
    return { inserted, updated, ownerId, idMap };
  },
});

export const users = mutation({
  args: { users: v.array(userSpec) },
  handler: async (ctx, { users }) => {
    let inserted = 0;
    let updated = 0;
    const idMap: Record<string, string> = {};

    for (const u of users) {
      const byLegacy = u.legacyId
        ? await ctx.db
            .query("users")
            .withIndex("by_legacyId", (q) => q.eq("legacyId", u.legacyId))
            .unique()
        : null;
      const byHandle = await ctx.db
        .query("users")
        .withIndex("by_handle", (q) => q.eq("handle", u.handle))
        .unique();
      const found = byLegacy ?? byHandle;
      const state = expandStateName(u.state);
      const fields = {
        name: u.name,
        handle: u.handle,
        email: u.email,
        bio: u.bio,
        zipCode: u.zipCode,
        state,
        county: u.county,
        tier: u.tier,
        legacyId: u.legacyId,
        avatarUrl: `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(u.handle)}`,
      };
      if (found) {
        await ctx.db.patch(found._id, fields);
        idMap[u.legacyId] = found._id;
        updated++;
      } else {
        const userId = await ctx.db.insert("users", fields);
        idMap[u.legacyId] = userId;
        inserted++;
      }
    }
    return { inserted, updated, idMap };
  },
});

export const followPublicAndHome = mutation({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, { userIds }) => {
    let joined = 0;
    for (const userId of userIds) {
      joined += (await joinPublicAndHomeGroups(ctx, userId)).joined;
    }
    return { joined, users: userIds.length };
  },
});

const SEED_GROUP_NAMES = [
  "Texas — Travis County",
  "Precinct Captains",
  "Vetting Committee",
];
const SEED_HANDLES = ["hank", "carol", "ray", "dana", "pete"];

/** Remove leftover RedWave demo rows after a LinkAll8 import. */
export const cleanupSeed = mutation({
  args: {},
  handler: async (ctx) => {
    let groupsDeleted = 0;
    let usersDeleted = 0;
    let leftmenuCleared = 0;

    for (const name of SEED_GROUP_NAMES) {
      const group = await ctx.db
        .query("groups")
        .withIndex("by_name", (q) => q.eq("name", name))
        .unique();
      if (!group) continue;
      const members = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();
      for (const m of members) await ctx.db.delete(m._id);
      const posts = await ctx.db
        .query("posts")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();
      for (const p of posts) await ctx.db.delete(p._id);
      await ctx.db.delete(group._id);
      groupsDeleted++;
    }

    const geoNames = ["Texas", "Florida", "Ohio"];
    for (const name of geoNames) {
      const g = await ctx.db
        .query("groups")
        .withIndex("by_name", (q) => q.eq("name", name))
        .unique();
      if (!g || g.leftmenu === undefined) continue;
      const { _id, _creationTime, leftmenu: _left, ...rest } = g;
      await ctx.db.replace(_id, rest);
      leftmenuCleared++;
    }

    const allPosts = await ctx.db.query("posts").collect();
    for (const handle of SEED_HANDLES) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_handle", (q) => q.eq("handle", handle))
        .unique();
      if (!user) continue;
      const memberships = await ctx.db
        .query("groupMembers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const m of memberships) await ctx.db.delete(m._id);
      for (const p of allPosts) {
        if (p.authorId === user._id) await ctx.db.delete(p._id);
      }
      await ctx.db.delete(user._id);
      usersDeleted++;
    }

    return { groupsDeleted, usersDeleted, leftmenuCleared };
  },
});

/** Attach static icon URLs copied from LinkAll8 Group.Photo. */
export const setPhotoUrls = mutation({
  args: {
    updates: v.array(
      v.object({
        name: v.string(),
        photoUrl: v.string(),
      }),
    ),
  },
  handler: async (ctx, { updates }) => {
    let patched = 0;
    for (const u of updates) {
      const group = await ctx.db
        .query("groups")
        .withIndex("by_name", (q) => q.eq("name", u.name))
        .unique();
      if (!group) continue;
      await ctx.db.patch(group._id, { photoUrl: u.photoUrl });
      patched++;
    }
    return { patched, requested: updates.length };
  },
});

/** Delete leftover demo groups that are not in the LinkAll8 catalog. */
export const deleteGroupsByName = mutation({
  args: { names: v.array(v.string()) },
  handler: async (ctx, { names }) => {
    let deleted = 0;
    for (const name of names) {
      const group = await ctx.db
        .query("groups")
        .withIndex("by_name", (q) => q.eq("name", name))
        .unique();
      if (!group) continue;
      const members = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();
      for (const m of members) await ctx.db.delete(m._id);
      const posts = await ctx.db
        .query("posts")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();
      for (const p of posts) await ctx.db.delete(p._id);
      await ctx.db.delete(group._id);
      deleted++;
    }
    return { deleted };
  },
});
