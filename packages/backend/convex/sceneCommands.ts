import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { expandEffectTokens, type EffectTokenContext } from "./sceneCues";
import { parseFilterCue, routeFilterCue } from "./filterCues";

/**
 * RossTalk command queue. When a scene becomes current, enabled `command`
 * effects are inserted as pending rows (tokens expanded). The Node bridge
 * subscribes to `pendingSceneCommands` and marks each row sent/error.
 * Snap/laptop hotkeys are a separate effect kind (`hotkey`) and table.
 * `filter` effects are routed here: Snap-backed names become hotkey rows,
 * everything else becomes a `filterCommands` row for the capture page.
 */

function rowPoints(game: {
  isScored: boolean;
  isWinner: boolean;
  rotation: boolean;
  volunteers?: number;
  roundType: string;
}) {
  let pts = 0;
  if (game.roundType.toLowerCase().includes("volunteer")) {
    pts += game.volunteers ?? 0;
  }
  if (game.isScored && game.isWinner) pts += 1;
  if (game.rotation) pts += 1;
  return pts;
}

async function tokenContextForShow(
  ctx: MutationCtx,
  showId: Id<"shows">,
  performanceId?: Id<"performances">,
): Promise<EffectTokenContext> {
  const show = await ctx.db.get(showId);
  const resolvedId = performanceId ?? show?.cuedByPerformanceId;
  if (!resolvedId) return {};
  const performance = await ctx.db.get(resolvedId);
  if (!performance) return { performanceId: resolvedId };

  const games = await ctx.db
    .query("performanceGames")
    .withIndex("by_performance", (q) => q.eq("performanceId", resolvedId))
    .collect();
  const performers = await ctx.db
    .query("performers")
    .withIndex("by_performance", (q) => q.eq("performanceId", resolvedId))
    .collect();

  const teamScore = (teamIndex: 1 | 2) =>
    games
      .filter((g) => g.teamIndex === teamIndex)
      .reduce((sum, g) => sum + rowPoints(g), 0) +
    performers
      .filter((p) => p.teamIndex === teamIndex)
      .reduce((sum, p) => sum + p.bellBonus, 0);

  return {
    performanceId: resolvedId,
    team1: performance.team1,
    team2: performance.team2,
    score1: teamScore(1),
    score2: teamScore(2),
  };
}

/** Insert pending RossTalk rows for every enabled command effect on the scene. */
export async function enqueueSceneCommands(
  ctx: MutationCtx,
  args: {
    showId: Id<"shows">;
    sceneId: Id<"scenes">;
    performanceId?: Id<"performances">;
  },
) {
  const effects = await ctx.db
    .query("effects")
    .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
    .collect();
  const commands = effects.filter(
    (e) => e.kind === "command" && e.isEnabled && e.content.trim(),
  );
  const hotkeys = effects.filter(
    (e) => e.kind === "hotkey" && e.isEnabled && e.content.trim(),
  );
  const filters = effects.filter(
    (e) => e.kind === "filter" && e.isEnabled && e.content.trim(),
  );
  if (commands.length === 0 && hotkeys.length === 0 && filters.length === 0) {
    return;
  }

  const tokenCtx = await tokenContextForShow(
    ctx,
    args.showId,
    args.performanceId,
  );
  const createdAt = Date.now();
  for (const effect of commands) {
    await ctx.db.insert("sceneCommands", {
      showId: args.showId,
      sceneId: args.sceneId,
      effectId: effect._id,
      command: expandEffectTokens(effect.content.trim(), tokenCtx),
      status: "pending",
      createdAt,
    });
  }
  for (const effect of hotkeys) {
    await ctx.db.insert("hotkeyCommands", {
      showId: args.showId,
      sceneId: args.sceneId,
      effectId: effect._id,
      hotkey: effect.content.trim(),
      status: "pending",
      createdAt,
    });
  }
  // Filters fire in startTime order so a bit's cue stack lands as authored.
  filters.sort((a, b) => a.startTime - b.startTime);
  for (const effect of filters) {
    const cue = effect.content.trim();
    const parsed = parseFilterCue(cue);
    if (!parsed.ok) {
      await ctx.db.insert("filterCommands", {
        showId: args.showId,
        sceneId: args.sceneId,
        effectId: effect._id,
        cue,
        status: "error",
        createdAt,
        sentAt: createdAt,
        errorMessage: parsed.error,
      });
      continue;
    }
    const route = routeFilterCue(parsed.cue);
    if (route.to === "hotkey") {
      await ctx.db.insert("hotkeyCommands", {
        showId: args.showId,
        sceneId: args.sceneId,
        effectId: effect._id,
        hotkey: route.hotkey,
        status: "pending",
        createdAt,
      });
    } else {
      await ctx.db.insert("filterCommands", {
        showId: args.showId,
        sceneId: args.sceneId,
        effectId: effect._id,
        cue,
        status: "pending",
        createdAt,
      });
    }
  }
}

export const pendingFilterCommands = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("filterCommands")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(50);
  },
});

export const completeFilterCommand = mutation({
  args: {
    id: v.id("filterCommands"),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { id, error }) => {
    const row = await ctx.db.get(id);
    if (!row) throw new Error("filter command not found");
    if (row.status !== "pending") return;
    await ctx.db.patch(id, {
      status: error ? "error" : "sent",
      sentAt: Date.now(),
      ...(error ? { errorMessage: error } : {}),
    });
  },
});

/**
 * Called by the capture page when it goes live: anything queued while no
 * publisher was listening is stale and must not replay onto the Head.
 */
export const skipStaleFilterCommands = mutation({
  args: { before: v.number() },
  handler: async (ctx, { before }) => {
    const rows = await ctx.db
      .query("filterCommands")
      .withIndex("by_status_created", (q) =>
        q.eq("status", "pending").lt("createdAt", before),
      )
      .take(200);
    const now = Date.now();
    for (const row of rows) {
      await ctx.db.patch(row._id, {
        status: "error",
        sentAt: now,
        errorMessage: "skipped: no capture page was live",
      });
    }
    return rows.length;
  },
});

export const pendingHotkeyCommands = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("hotkeyCommands")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(50);
  },
});

export const completeHotkeyCommand = mutation({
  args: {
    id: v.id("hotkeyCommands"),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { id, error }) => {
    const row = await ctx.db.get(id);
    if (!row) throw new Error("hotkey command not found");
    if (row.status !== "pending") return;
    await ctx.db.patch(id, {
      status: error ? "error" : "sent",
      sentAt: Date.now(),
      ...(error ? { errorMessage: error } : {}),
    });
  },
});

export const pendingSceneCommands = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("sceneCommands")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(50);
  },
});

export const completeSceneCommand = mutation({
  args: {
    id: v.id("sceneCommands"),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { id, error }) => {
    const row = await ctx.db.get(id);
    if (!row) throw new Error("scene command not found");
    if (row.status !== "pending") return;
    await ctx.db.patch(id, {
      status: error ? "error" : "sent",
      sentAt: Date.now(),
      ...(error ? { errorMessage: error } : {}),
    });
  },
});
