import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

/**
 * Comedy game engine (legacy: Comedy Loco Show page + game-1.0.1.js).
 *
 * A performance is a sequence of rounds; each round is a PAIR of rows in
 * `performanceGames` — team 1 plays the game first, then team 2, then the
 * audience votes and the host taps the winner. The legacy engine drove this
 * with IsCued/IsPlaying/IsPlayed/IsVoting/IsWinner flags updated over AJAX
 * and overlay "clicks" broadcast over SignalR; here the same flags live in
 * Convex and every console/screen follows reactively.
 */

// ------------------------------------------------------------------ helpers

type Game = Doc<"performanceGames">;

async function gamesInOrder(
  ctx: { db: QueryCtx["db"] },
  performanceId: Id<"performances">,
) {
  const games = await ctx.db
    .query("performanceGames")
    .withIndex("by_performance", (q) => q.eq("performanceId", performanceId))
    .collect();
  games.sort((a, b) => a.order - b.order);
  return games;
}

/**
 * The current round is the first pair where the round hasn't finished.
 * Phase within the pair mirrors the legacy GetCurrentGameRow logic.
 */
function currentPair(games: Game[]) {
  for (let i = 0; i + 1 < games.length; i += 2) {
    const [g1, g2] = [games[i], games[i + 1]];
    const roundDone =
      g1.isWinner ||
      g2.isWinner ||
      (!g1.isScored && g1.isPlayed && g2.isPlayed && !g1.isVoting && !g2.isVoting);
    if (roundDone) continue;
    let phase: "idle" | "team1" | "team2" | "voting";
    if (g1.isVoting || g2.isVoting) phase = "voting";
    else if (g2.isPlaying) phase = "team2";
    else if (g1.isPlaying) phase = "team1";
    else if (g1.isPlayed && !g2.isPlayed) phase = "team2";
    else phase = "idle";
    return {
      index: i,
      game1: g1,
      game2: g2,
      phase,
      sameGame: g1.gameName.toLowerCase() === g2.gameName.toLowerCase(),
    };
  }
  return null;
}

// ------------------------------------------------------------------ queries

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("performances").collect();
  },
});

/** Everything the console and the screen need, in one reactive query. */
export const get = query({
  args: { performanceId: v.id("performances") },
  handler: async (ctx, { performanceId }) => {
    const performance = await ctx.db.get(performanceId);
    if (!performance) return null;
    const games = await gamesInOrder(ctx, performanceId);
    const performers = await ctx.db
      .query("performers")
      .withIndex("by_performance", (q) => q.eq("performanceId", performanceId))
      .collect();
    const overlays = await ctx.db
      .query("performanceOverlays")
      .withIndex("by_performance", (q) => q.eq("performanceId", performanceId))
      .collect();
    overlays.sort((a, b) => a.order - b.order);
    const tracks = await ctx.db
      .query("performanceTracks")
      .withIndex("by_performance", (q) => q.eq("performanceId", performanceId))
      .collect();
    tracks.sort((a, b) => a.order - b.order);

    const pair = currentPair(games);
    const teamScore = (teamIndex: 1 | 2) =>
      games
        .filter((g) => g.teamIndex === teamIndex)
        .reduce((sum, g) => sum + g.score, 0) +
      performers
        .filter((p) => p.teamIndex === teamIndex)
        .reduce((sum, p) => sum + p.bellBonus, 0);

    return {
      ...performance,
      games,
      performers,
      overlays,
      tracks,
      current: pair
        ? {
            pairIndex: pair.index,
            phase: pair.phase,
            sameGame: pair.sameGame,
            game1Id: pair.game1._id,
            game2Id: pair.game2._id,
          }
        : null,
      scores: { team1: teamScore(1), team2: teamScore(2) },
    };
  },
});

// ---------------------------------------------------------------- mutations

export const setOverlay = mutation({
  args: {
    performanceId: v.id("performances"),
    overlay: v.optional(v.string()),
  },
  handler: async (ctx, { performanceId, overlay }) => {
    await ctx.db.patch(performanceId, { activeOverlay: overlay });
  },
});

export const setTrack = mutation({
  args: {
    performanceId: v.id("performances"),
    track: v.optional(v.string()),
  },
  handler: async (ctx, { performanceId, track }) => {
    await ctx.db.patch(performanceId, { activeTrack: track });
  },
});

/** "Begin Game": team 1 starts playing, screen shows game instructions. */
export const beginGame = mutation({
  args: { performanceId: v.id("performances") },
  handler: async (ctx, { performanceId }) => {
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games);
    if (!pair || pair.phase !== "idle") return;
    await ctx.db.patch(pair.game1._id, { isPlaying: true });
    await ctx.db.patch(performanceId, {
      status: "live",
      activeOverlay: "Game Instructions",
    });
  },
});

/** "Next Game": team 1 done, team 2 starts (legacy EndGame → CueGame). */
export const nextGame = mutation({
  args: { performanceId: v.id("performances") },
  handler: async (ctx, { performanceId }) => {
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games);
    if (!pair || pair.phase !== "team1") return;
    await ctx.db.patch(pair.game1._id, { isPlaying: false, isPlayed: true });
    await ctx.db.patch(pair.game2._id, { isPlaying: true });
    // Legacy EndGame clicked the round's music track before cueing the next game.
    const tracks = await ctx.db
      .query("performanceTracks")
      .withIndex("by_performance", (q) => q.eq("performanceId", performanceId))
      .collect();
    tracks.sort((a, b) => a.order - b.order);
    const track = tracks[pair.game1.round % Math.max(tracks.length, 1)];
    await ctx.db.patch(performanceId, {
      activeOverlay: "Game Instructions",
      ...(track ? { activeTrack: track.name } : {}),
    });
  },
});

/**
 * "End Round": both teams played. Scored rounds go to audience voting;
 * unscored rounds (intros etc.) just complete.
 */
export const endRound = mutation({
  args: { performanceId: v.id("performances") },
  handler: async (ctx, { performanceId }) => {
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games);
    if (!pair || pair.phase !== "team2") return;
    await ctx.db.patch(pair.game2._id, { isPlaying: false, isPlayed: true });
    await ctx.db.patch(pair.game1._id, { isPlayed: true });
    if (pair.game1.isScored) {
      await ctx.db.patch(pair.game1._id, { isVoting: true });
      await ctx.db.patch(pair.game2._id, { isVoting: true });
      await ctx.db.patch(performanceId, { activeOverlay: "Vote" });
    } else {
      await ctx.db.patch(performanceId, { activeOverlay: undefined });
    }
  },
});

/** "Win 1"/"Win 2": the audience picked a winner; celebrate + score. */
export const winGame = mutation({
  args: {
    performanceId: v.id("performances"),
    teamIndex: v.union(v.literal(1), v.literal(2)),
  },
  handler: async (ctx, { performanceId, teamIndex }) => {
    const performance = await ctx.db.get(performanceId);
    if (!performance) return;
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games);
    if (!pair || pair.phase !== "voting") return;
    const winner = teamIndex === 1 ? pair.game1 : pair.game2;
    await ctx.db.patch(winner._id, {
      isWinner: true,
      isVoting: false,
      score: winner.score + 1,
    });
    const loser = teamIndex === 1 ? pair.game2 : pair.game1;
    await ctx.db.patch(loser._id, { isVoting: false });
    const teamName = teamIndex === 1 ? performance.team1 : performance.team2;
    await ctx.db.patch(performanceId, {
      activeOverlay: `Winner ${teamName}`,
    });
  },
});

/** "Rotation 1"/"Rotation 2" (same-game rounds): bonus rotation win. */
export const winRotation = mutation({
  args: {
    performanceId: v.id("performances"),
    teamIndex: v.union(v.literal(1), v.literal(2)),
  },
  handler: async (ctx, { performanceId, teamIndex }) => {
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games);
    if (!pair) return;
    const game = teamIndex === 1 ? pair.game1 : pair.game2;
    await ctx.db.patch(game._id, { rotation: true, score: game.score + 1 });
    await ctx.db.patch(performanceId, { activeOverlay: "Score Rotation" });
  },
});

/** Ring the bell for a performer (legacy WinJoke bell bonus). */
export const bellBonus = mutation({
  args: { performerId: v.id("performers"), points: v.number() },
  handler: async (ctx, { performerId, points }) => {
    const performer = await ctx.db.get(performerId);
    if (!performer) return;
    await ctx.db.patch(performerId, {
      bellBonus: performer.bellBonus + points,
    });
  },
});

export const addPerformer = mutation({
  args: {
    performanceId: v.id("performances"),
    name: v.string(),
    teamIndex: v.union(v.literal(1), v.literal(2)),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("performers", { ...args, bellBonus: 0 });
  },
});

export const removePerformer = mutation({
  args: { performerId: v.id("performers") },
  handler: async (ctx, { performerId }) => {
    await ctx.db.delete(performerId);
  },
});

/** Edit a game row from the grid (votes / score / name). */
export const updateGame = mutation({
  args: {
    gameId: v.id("performanceGames"),
    gameName: v.optional(v.string()),
    votes: v.optional(v.number()),
    score: v.optional(v.number()),
  },
  handler: async (ctx, { gameId, ...fields }) => {
    await ctx.db.patch(gameId, fields);
  },
});

/** Reset every round so the performance can be run again. */
export const reset = mutation({
  args: { performanceId: v.id("performances") },
  handler: async (ctx, { performanceId }) => {
    const games = await gamesInOrder(ctx, performanceId);
    for (const game of games) {
      await ctx.db.patch(game._id, {
        isPlaying: false,
        isPlayed: false,
        isVoting: false,
        isWinner: false,
        rotation: false,
        votes: 0,
        score: 0,
      });
    }
    const performers = await ctx.db
      .query("performers")
      .withIndex("by_performance", (q) => q.eq("performanceId", performanceId))
      .collect();
    for (const p of performers) await ctx.db.patch(p._id, { bellBonus: 0 });
    await ctx.db.patch(performanceId, {
      status: "draft",
      activeOverlay: undefined,
      activeTrack: undefined,
    });
  },
});
