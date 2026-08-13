import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireLoco, rowTag } from "./locos";

/**
 * Loco game engine (legacy: Comedy Loco Show page + game-1.0.1.js).
 *
 * Templates, catalogs, and default teams live in `locos.ts`. Performances and
 * catalog rows are tagged (`comedyloco` / `battleloco` / `wrestleloco`);
 * untagged legacy rows count as Comedy Loco.
 */

// ------------------------------------------------------------------ helpers

type Game = Doc<"performanceGames">;
type Phase = "idle" | "cued" | "team1" | "team2" | "both" | "voting";

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

function sameGame(g1: Game, g2: Game) {
  if (g1.gameId && g2.gameId) return g1.gameId === g2.gameId;
  return g1.gameName.toLowerCase() === g2.gameName.toLowerCase();
}

function isVolunteerRound(game: Game) {
  return game.roundType.toLowerCase().includes("volunteer");
}

/**
 * Legacy scoring: winner +1 (if the round is scored), rotation +1,
 * volunteer count added on Volunteer rounds, plus performer bell bonuses
 * on the team total.
 */
function rowPoints(game: Game) {
  let pts = 0;
  if (isVolunteerRound(game)) pts += game.volunteers ?? 0;
  if (game.isScored && game.isWinner) pts += 1;
  if (game.rotation) pts += 1;
  return pts;
}

async function writeScore(
  ctx: MutationCtx,
  game: Game,
  extra: Partial<Pick<Game, "isWinner" | "isVoting" | "rotation" | "volunteers">> = {},
) {
  const next = { ...game, ...extra };
  await ctx.db.patch(game._id, {
    ...extra,
    score: rowPoints(next as Game),
  });
}

async function cueTrack(
  ctx: MutationCtx,
  performanceId: Id<"performances">,
  round: number,
  overlay: string,
) {
  const tracks = await ctx.db
    .query("performanceTracks")
    .withIndex("by_performance", (q) => q.eq("performanceId", performanceId))
    .collect();
  tracks.sort((a, b) => a.order - b.order);
  const track = tracks.length ? tracks[round % tracks.length] : undefined;
  await ctx.db.patch(performanceId, {
    activeOverlay: overlay,
    ...(track ? { activeTrack: track.name } : {}),
  });
}

/**
 * The current round is the first pair where the round hasn't finished.
 * Phase within the pair mirrors GetCurrentGameRow in game-1.0.1.js:
 *   same llgameid → both teams play together (Begin Game → End Round)
 *   different games → team 1, Next Game, then team 2, End Round
 *   IsVoting → Win 1 / Win 2
 */
function currentPair(games: Game[]) {
  for (let i = 0; i + 1 < games.length; i += 2) {
    const [g1, g2] = [games[i], games[i + 1]];
    const roundDone =
      g1.isWinner ||
      g2.isWinner ||
      (!g1.isScored && g1.isPlayed && g2.isPlayed && !g1.isVoting && !g2.isVoting);
    if (roundDone) continue;
    const same = sameGame(g1, g2);
    let phase: Phase;
    if (g1.isVoting || g2.isVoting) phase = "voting";
    else if (same && (g1.isPlaying || g2.isPlaying)) phase = "both";
    else if (g2.isPlaying) phase = "team2";
    else if (g1.isPlaying) phase = "team1";
    else if (g1.isPlayed && !g2.isPlayed) phase = "team2";
    else if (g1.isCued || g2.isCued) phase = "cued";
    else phase = "idle";
    return {
      index: i,
      game1: g1,
      game2: g2,
      phase,
      sameGame: same,
    };
  }
  return null;
}

type Pair = NonNullable<ReturnType<typeof currentPair>>;

async function beginPair(
  ctx: MutationCtx,
  performanceId: Id<"performances">,
  pair: Pair,
) {
  if (pair.sameGame) {
    await ctx.db.patch(pair.game1._id, {
      isCued: false,
      isPlaying: true,
      isPlayed: false,
      isVoting: false,
    });
    await ctx.db.patch(pair.game2._id, {
      isCued: false,
      isPlaying: true,
      isPlayed: false,
      isVoting: false,
    });
  } else {
    await ctx.db.patch(pair.game1._id, {
      isCued: false,
      isPlaying: true,
    });
  }
  await ctx.db.patch(performanceId, {
    status: "live",
    activeOverlay: "Game Instructions",
  });
}

// ------------------------------------------------------------------ queries

export const list = query({
  args: { tag: v.optional(v.string()) },
  handler: async (ctx, { tag }) => {
    const performances = await ctx.db.query("performances").collect();
    const scoped = tag
      ? performances.filter((p) => rowTag(p.tag) === requireLoco(tag).tag)
      : performances;
    scoped.sort((a, b) => b._creationTime - a._creationTime);
    return scoped;
  },
});

/** Games catalog (legacy /game page — LLGame), optionally scoped to a loco. */
export const listCatalog = query({
  args: { tag: v.optional(v.string()) },
  handler: async (ctx, { tag }) => {
    const games = await ctx.db.query("comedyGames").collect();
    const scoped = tag
      ? games.filter((g) => rowTag(g.tag) === requireLoco(tag).tag)
      : games;
    scoped.sort((a, b) =>
      a.roundType === b.roundType
        ? a.name.localeCompare(b.name)
        : a.roundType.localeCompare(b.roundType),
    );
    return scoped;
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
        .reduce((sum, g) => sum + rowPoints(g), 0) +
      performers
        .filter((p) => p.teamIndex === teamIndex)
        .reduce((sum, p) => sum + p.bellBonus, 0);

    const catalogIds = [
      ...new Set(games.map((g) => g.gameId).filter(Boolean)),
    ] as Id<"comedyGames">[];
    const catalogById: Record<string, Doc<"comedyGames">> = {};
    for (const id of catalogIds) {
      const row = await ctx.db.get(id);
      if (row) catalogById[id] = row;
    }

    const playing =
      pair == null
        ? null
        : pair.phase === "team2"
          ? pair.game2
          : pair.game1;
    const catalog = playing?.gameId ? catalogById[playing.gameId] : undefined;

    return {
      ...performance,
      games: games.map((g) => ({
        ...g,
        volunteers: g.volunteers ?? 0,
        score: rowPoints(g),
        catalog: g.gameId ? catalogById[g.gameId] : undefined,
      })),
      performers,
      overlays,
      tracks,
      catalog,
      current: pair
        ? {
            pairIndex: pair.index,
            phase: pair.phase,
            sameGame: pair.sameGame,
            game1Id: pair.game1._id,
            game2Id: pair.game2._id,
            volunteerRound: isVolunteerRound(pair.game1),
            isScored: pair.game1.isScored,
          }
        : null,
      scores: { team1: teamScore(1), team2: teamScore(2) },
    };
  },
});

// ---------------------------------------------------------------- mutations

/**
 * Create a performance and seed its round grid (legacy CreatePerformanceTemplate).
 * Game names start empty so the host can fill them in; overlays and tracks are
 * the same defaults used by seed/import so the console is immediately usable.
 */
export const create = mutation({
  args: {
    title: v.string(),
    team1: v.string(),
    team2: v.string(),
    ownerId: v.id("users"),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, { title, team1, team2, ownerId, tag }) => {
    const loco = requireLoco(tag);
    const performanceId = await ctx.db.insert("performances", {
      title: title.trim(),
      team1: team1.trim() || loco.team1,
      team2: team2.trim() || loco.team2,
      status: "draft",
      ownerId,
      tag: loco.tag,
    });

    let order = 0;
    for (const round of loco.templateRounds) {
      for (const teamIndex of [1, 2] as const) {
        await ctx.db.insert("performanceGames", {
          performanceId,
          order: order++,
          round: round.round,
          roundType: round.roundType,
          teamIndex,
          gameName: "",
          votes: 0,
          score: 0,
          isPlaying: false,
          isPlayed: false,
          isVoting: false,
          isWinner: false,
          rotation: false,
          isCued: false,
          volunteers: 0,
          isScored: round.isScored,
        });
      }
    }

    for (let i = 0; i < loco.overlays.length; i++) {
      await ctx.db.insert("performanceOverlays", {
        performanceId,
        name: loco.overlays[i],
        order: i,
      });
    }
    for (let i = 0; i < loco.tracks.length; i++) {
      await ctx.db.insert("performanceTracks", {
        performanceId,
        name: loco.tracks[i],
        order: i,
      });
    }

    return performanceId;
  },
});

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

/** "Begin Game" (legacy CueGame → BeginGame). Same-game rounds start both teams. */
export const beginGame = mutation({
  args: { performanceId: v.id("performances") },
  handler: async (ctx, { performanceId }) => {
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games);
    if (!pair || (pair.phase !== "idle" && pair.phase !== "cued")) return;
    await beginPair(ctx, performanceId, pair);
  },
});

/**
 * "Next Game" (legacy EndGame → CueGame): team 1 done, team 2 starts.
 * Same-game rounds skip this — both teams are already playing.
 */
export const nextGame = mutation({
  args: { performanceId: v.id("performances") },
  handler: async (ctx, { performanceId }) => {
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games);
    if (!pair || pair.phase !== "team1") return;
    await ctx.db.patch(pair.game1._id, { isPlaying: false, isPlayed: true });
    await ctx.db.patch(pair.game2._id, { isCued: false, isPlaying: true });
    await cueTrack(ctx, performanceId, pair.game1.round, "Game Instructions");
  },
});

/**
 * "End Round": both teams played. Scored rounds go to audience voting;
 * unscored rounds (intros) complete and the next round is ready.
 */
export const endRound = mutation({
  args: { performanceId: v.id("performances") },
  handler: async (ctx, { performanceId }) => {
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games);
    if (!pair || (pair.phase !== "team2" && pair.phase !== "both")) return;
    await ctx.db.patch(pair.game1._id, {
      isPlaying: false,
      isPlayed: true,
    });
    await ctx.db.patch(pair.game2._id, {
      isPlaying: false,
      isPlayed: true,
    });
    await cueTrack(ctx, performanceId, pair.game1.round, pair.game1.isScored ? "Vote" : "Game Instructions");
    if (pair.game1.isScored) {
      await ctx.db.patch(pair.game1._id, { isVoting: true });
      await ctx.db.patch(pair.game2._id, { isVoting: true });
    }
  },
});

/**
 * Unified Next (the host's primary advance button). Dispatches to Begin /
 * Next Game / End Round based on GetCurrentGameRow phase.
 */
export const next = mutation({
  args: { performanceId: v.id("performances") },
  handler: async (ctx, { performanceId }) => {
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games);
    if (!pair || pair.phase === "voting") return;
    if (pair.phase === "idle" || pair.phase === "cued") {
      await beginPair(ctx, performanceId, pair);
      return;
    }
    if (pair.phase === "team1") {
      await ctx.db.patch(pair.game1._id, { isPlaying: false, isPlayed: true });
      await ctx.db.patch(pair.game2._id, { isCued: false, isPlaying: true });
      await cueTrack(ctx, performanceId, pair.game1.round, "Game Instructions");
      return;
    }
    await ctx.db.patch(pair.game1._id, { isPlaying: false, isPlayed: true });
    await ctx.db.patch(pair.game2._id, { isPlaying: false, isPlayed: true });
    if (pair.game1.isScored) {
      await ctx.db.patch(pair.game1._id, { isVoting: true });
      await ctx.db.patch(pair.game2._id, { isVoting: true });
      await cueTrack(ctx, performanceId, pair.game1.round, "Vote");
    } else {
      await cueTrack(ctx, performanceId, pair.game1.round, "Game Instructions");
    }
  },
});

/** "Win 1"/"Win 2": audience picked a winner. Unscored rounds skip to the next. */
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

    if (!pair.game1.isScored) {
      await ctx.db.patch(pair.game1._id, { isVoting: false, isPlayed: true });
      await ctx.db.patch(pair.game2._id, { isVoting: false, isPlayed: true });
      return;
    }

    const winner = teamIndex === 1 ? pair.game1 : pair.game2;
    const loser = teamIndex === 1 ? pair.game2 : pair.game1;
    await writeScore(ctx, winner, { isWinner: true, isVoting: false });
    await ctx.db.patch(loser._id, { isVoting: false });
    const teamName = teamIndex === 1 ? performance.team1 : performance.team2;
    await ctx.db.patch(performanceId, {
      activeOverlay: `Winner ${teamName}`,
    });
  },
});

/** "Rotation 1"/"Rotation 2" (same-game rounds): bonus rotation point. */
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
    await writeScore(ctx, game, { rotation: true });
    await ctx.db.patch(performanceId, { activeOverlay: "Score Rotation" });
  },
});

/** +/- volunteer count on the currently playing team (legacy volunteers column). */
export const addVolunteers = mutation({
  args: {
    performanceId: v.id("performances"),
    teamIndex: v.union(v.literal(1), v.literal(2)),
    delta: v.number(),
  },
  handler: async (ctx, { performanceId, teamIndex, delta }) => {
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games);
    if (!pair) return;
    const game = teamIndex === 1 ? pair.game1 : pair.game2;
    const volunteers = Math.max(0, (game.volunteers ?? 0) + delta);
    await writeScore(ctx, game, { volunteers });
  },
});

/** Assign a catalog game (legacy picking LLGame on the round row). */
export const assignGame = mutation({
  args: {
    gameRowId: v.id("performanceGames"),
    catalogId: v.optional(v.id("comedyGames")),
    gameName: v.optional(v.string()),
  },
  handler: async (ctx, { gameRowId, catalogId, gameName }) => {
    if (catalogId) {
      const catalog = await ctx.db.get(catalogId);
      if (!catalog) return;
      await ctx.db.patch(gameRowId, {
        gameId: catalogId,
        gameName: catalog.name,
      });
      return;
    }
    await ctx.db.patch(gameRowId, {
      gameId: undefined,
      gameName: (gameName ?? "").trim(),
    });
  },
});

export const createCatalogGame = mutation({
  args: {
    name: v.string(),
    roundType: v.string(),
    shortDescription: v.optional(v.string()),
    suggestions: v.optional(v.string()),
    ask: v.optional(v.string()),
    description: v.optional(v.string()),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const loco = requireLoco(args.tag);
    return await ctx.db.insert("comedyGames", {
      name: args.name.trim(),
      roundType: args.roundType.trim() || loco.templateRounds[1]?.roundType || "Bucket",
      shortDescription: args.shortDescription?.trim() || undefined,
      suggestions: args.suggestions?.trim() || undefined,
      ask: args.ask?.trim() || undefined,
      description: args.description?.trim() || undefined,
      tag: loco.tag,
    });
  },
});

export const seedCatalog = mutation({
  args: { tag: v.optional(v.string()) },
  handler: async (ctx, { tag }) => {
    const loco = requireLoco(tag);
    const existing = (await ctx.db.query("comedyGames").collect()).filter(
      (g) => rowTag(g.tag) === loco.tag,
    );
    if (existing.length > 0) return existing.length;
    for (const g of loco.catalog) {
      await ctx.db.insert("comedyGames", { ...g, tag: loco.tag });
    }
    return loco.catalog.length;
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
        isCued: false,
        volunteers: 0,
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
