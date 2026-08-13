import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Import LinkAll8 SQL data (groups, performances, comments).
 * Does not insert or delete shows, screens, layouts, or panels.
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
});

const gameSpec = v.object({
  order: v.number(),
  round: v.number(),
  roundType: v.string(),
  teamIndex: v.union(v.literal(1), v.literal(2)),
  gameName: v.string(),
  isScored: v.boolean(),
});

const performerSpec = v.object({
  name: v.string(),
  teamIndex: v.union(v.literal(1), v.literal(2)),
});

const performanceSpec = v.object({
  legacyId: v.number(),
  title: v.string(),
  team1: v.string(),
  team2: v.string(),
  games: v.array(gameSpec),
  performers: v.array(performerSpec),
});

const postSpec = v.object({
  groupId: v.optional(v.string()),
  content: v.string(),
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

export const groups = mutation({
  args: { groups: v.array(groupSpec) },
  handler: async (ctx, { groups }) => {
    const ownerId = await importerUser(ctx);
    const existing = await ctx.db.query("groups").collect();
    const byName = new Map(existing.map((g) => [g.name.toLowerCase(), g]));
    let inserted = 0;
    let updated = 0;
    const idMap: Record<string, string> = {};

    for (const g of groups) {
      const key = g.name.toLowerCase();
      const found = byName.get(key);
      if (found) {
        await ctx.db.patch(found._id, {
          description: g.description || found.description,
          kind: g.kind,
          state: g.state,
          county: g.county,
          leftmenu: g.leftmenu,
          memberCount: Math.max(found.memberCount, g.memberCount),
          category: g.category ?? found.category,
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
          createdBy: ownerId,
          memberCount: g.memberCount,
        });
        byName.set(key, { name: g.name, _id: groupId } as never);
        idMap[g.legacyId] = groupId;
        inserted++;
      }
    }
    return { inserted, updated, ownerId, idMap };
  },
});

export const performances = mutation({
  args: { performances: v.array(performanceSpec) },
  handler: async (ctx, { performances }) => {
    const ownerId = await importerUser(ctx);
    const existing = await ctx.db.query("performances").collect();
    const byTitle = new Set(existing.map((p) => p.title.toLowerCase()));
    let inserted = 0;
    let skipped = 0;
    let renamed = 0;

    for (const row of existing) {
      if (!/crazyball/i.test(row.title)) continue;
      await ctx.db.patch(row._id, {
        title: row.title.replace(/Crazyball/gi, "Comedy Loco"),
      });
      renamed++;
    }

    const overlayNames = [
      "Game Instructions",
      "Vote",
      "Suggestions",
      "Score",
      "Box Score",
      "Games",
      "Score Rotation",
    ];
    const trackNames = [
      "BackNForth",
      "BringTheFun",
      "BubbleGumGirl",
      "CockatooInTheGrass",
      "DressedInPink",
      "DrivingYourVibes",
    ];

    for (const p of performances) {
      if (byTitle.has(p.title.toLowerCase())) {
        skipped++;
        continue;
      }
      if (p.games.length === 0) {
        skipped++;
        continue;
      }
      const title = p.title.replace(/Crazyball/gi, "Comedy Loco");
      const performanceId = await ctx.db.insert("performances", {
        title,
        team1: p.team1,
        team2: p.team2,
        status: "draft",
        ownerId,
      });
      for (const game of p.games) {
        await ctx.db.insert("performanceGames", {
          performanceId,
          order: game.order,
          round: game.round,
          roundType: game.roundType,
          teamIndex: game.teamIndex,
          gameName: game.gameName.replace(/Crazyball/gi, "Comedy Loco"),
          votes: 0,
          score: 0,
          isPlaying: false,
          isPlayed: false,
          isVoting: false,
          isWinner: false,
          rotation: false,
          isScored: game.isScored,
        });
      }
      for (const performer of p.performers) {
        await ctx.db.insert("performers", {
          performanceId,
          name: performer.name,
          teamIndex: performer.teamIndex,
          bellBonus: 0,
        });
      }
      for (let i = 0; i < overlayNames.length; i++) {
        await ctx.db.insert("performanceOverlays", {
          performanceId,
          name: overlayNames[i],
          order: i,
        });
      }
      for (let i = 0; i < trackNames.length; i++) {
        await ctx.db.insert("performanceTracks", {
          performanceId,
          name: trackNames[i],
          order: i,
        });
      }
      byTitle.add(p.title.toLowerCase());
      inserted++;
    }
    return { inserted, skipped, renamed, ownerId };
  },
});

export const posts = mutation({
  args: {
    posts: v.array(postSpec),
  },
  handler: async (ctx, { posts }) => {
    const ownerId = await importerUser(ctx);
    let inserted = 0;
    for (const p of posts) {
      const content = p.content.trim();
      if (content.length < 8) continue;
      let groupId: Id<"groups"> | undefined;
      if (p.groupId) {
        groupId = p.groupId as Id<"groups">;
      }
      await ctx.db.insert("posts", {
        authorId: ownerId,
        content,
        groupId,
        upvotes: 0,
        replyCount: 0,
      });
      inserted++;
    }
    return { inserted, ownerId };
  },
});
