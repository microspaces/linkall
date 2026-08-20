import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireLoco, rowTag, type LocoConfig } from "./locos";
import {
  bucketScenes,
  GAME_INSTRUCTION_CUE,
  matchSceneIndex,
  sceneBucket,
  SCORE_ROTATION_CUE,
  VOTE_CUE,
  winnerCue,
} from "./sceneCues";
import { enqueueSceneCommands } from "./sceneCommands";

/**
 * Loco game engine (legacy: Comedy Loco Show page + game-1.0.1.js).
 *
 * Templates, catalogs, and default teams live in `locos.ts`. Each format has a
 * `mode`:
 *   competition — two `performanceGames` rows per template round (team 1, then
 *     team 2). Host flow: team1 plays → team2 plays → scored rounds vote → Win.
 *   setlist — one row per template round (`teamIndex: 1`). Host flow: begin
 *     segment → end segment → next segment. No opponents, scores, or winners.
 *
 * Performances and catalog rows are tagged (`comedyloco` / `battleloco` /
 * `wrestleloco` / `headcase` / `laffup` / `thisgameshow` / `weddingloco` /
 * `barloco`); untagged legacy rows count as Comedy Loco.
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

async function scenesForShow(
  ctx: { db: QueryCtx["db"] },
  showId: Id<"shows">,
) {
  const scenes = await ctx.db
    .query("scenes")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();
  scenes.sort((a, b) => a.order - b.order);
  return scenes;
}

async function cycleMusicTrack(
  ctx: MutationCtx,
  performance: Doc<"performances">,
  round: number,
): Promise<string | undefined> {
  if (performance.showId) {
    const designed = (await scenesForShow(ctx, performance.showId)).filter(
      (s) =>
        sceneBucket(s, {
          team1: performance.team1,
          team2: performance.team2,
        }) === "music",
    );
    if (designed.length) {
      return designed[round % designed.length].title;
    }
  }
  const tracks = await ctx.db
    .query("performanceTracks")
    .withIndex("by_performance", (q) => q.eq("performanceId", performance._id))
    .collect();
  tracks.sort((a, b) => a.order - b.order);
  return tracks.length ? tracks[round % tracks.length].name : undefined;
}

/**
 * Play the designed scene whose title matches `cue` (legacy row click).
 * Overlay / intro / background scenes go live on the bound show so every
 * /screens page follows. Music / sound scenes only set activeTrack so they
 * don't steal the visual.
 */
async function playMatchingScene(
  ctx: MutationCtx,
  performance: Doc<"performances">,
  cue: string,
): Promise<Id<"scenes"> | undefined> {
  if (!performance.showId) return undefined;
  const scenes = await scenesForShow(ctx, performance.showId);
  const index = matchSceneIndex(scenes, cue);
  if (index < 0) return undefined;
  const scene = scenes[index];
  const bucket = sceneBucket(scene, {
    team1: performance.team1,
    team2: performance.team2,
  });
  if (bucket === "music" || bucket === "sound") {
    return undefined;
  }
  await ctx.db.patch(performance.showId, {
    status: "live",
    currentSceneIndex: index,
    sceneStartedAt: Date.now(),
    cuedByPerformanceId: performance._id,
  });
  await enqueueSceneCommands(ctx, {
    showId: performance.showId,
    sceneId: scene._id,
    performanceId: performance._id,
  });
  return scene._id;
}

/** Cue an overlay (and optional music) the way LinkAll8 clicked scene rows. */
async function cueTrack(
  ctx: MutationCtx,
  performanceId: Id<"performances">,
  round: number,
  overlay: string,
) {
  const performance = await ctx.db.get(performanceId);
  if (!performance) return;
  const track = await cycleMusicTrack(ctx, performance, round);
  const activeSceneId = await playMatchingScene(ctx, performance, overlay);
  await ctx.db.patch(performanceId, {
    activeOverlay: overlay,
    ...(track ? { activeTrack: track } : {}),
    ...(activeSceneId ? { activeSceneId } : {}),
  });
}

function isSetlist(tag?: string | null) {
  return requireLoco(tag).mode === "setlist";
}

function celebrationOrInstructions(
  performance: Doc<"performances">,
  roundType: string,
) {
  if (roundType.toLowerCase().includes("celebration")) {
    if (performance.tag === "battleloco") return "Bring the Boom";
    if (performance.tag === "wrestleloco") return "Hit the Bell";
  }
  return GAME_INSTRUCTION_CUE;
}

/**
 * The current round is the first unfinished group.
 *
 * Competition: rows come in pairs (team 1, then team 2). Phase mirrors
 * GetCurrentGameRow in game-1.0.1.js:
 *   same llgameid → both teams play together (Begin Game → End Round)
 *   different games → team 1, Next Game, then team 2, End Round
 *   IsVoting → Win 1 / Win 2
 *
 * Set list: one row per template round (teamIndex 1). Phase is idle/cued →
 * playing (team1) → complete. No opponent step, no voting.
 */
function currentPair(games: Game[], setlist = false) {
  if (setlist) {
    for (let i = 0; i < games.length; i++) {
      const g = games[i];
      if (g.teamIndex !== 1) continue;
      if (g.isWinner || (g.isPlayed && !g.isVoting)) continue;
      let phase: Phase;
      if (g.isVoting) phase = "voting";
      else if (g.isPlaying) phase = "team1";
      else if (g.isCued) phase = "cued";
      else phase = "idle";
      return {
        index: i,
        game1: g,
        game2: g,
        phase,
        sameGame: false,
        single: true as const,
      };
    }
    return null;
  }

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
      single: false as const,
    };
  }
  return null;
}

type Pair = NonNullable<ReturnType<typeof currentPair>>;

function allowedRoundTypes(loco: LocoConfig) {
  const types = new Set<string>();
  for (const r of loco.templateRounds) types.add(r.roundType);
  for (const g of loco.catalog) types.add(g.roundType);
  return types;
}

/** Most common template type; ties go to the last template type of that count. */
function mostCommonRoundType(loco: LocoConfig) {
  const rounds = loco.templateRounds;
  if (rounds.length === 0) return "Bit";
  const counts = new Map<string, number>();
  for (const r of rounds) {
    counts.set(r.roundType, (counts.get(r.roundType) ?? 0) + 1);
  }
  let best = rounds[rounds.length - 1].roundType;
  let bestCount = -1;
  for (const r of rounds) {
    const n = counts.get(r.roundType) ?? 0;
    if (n >= bestCount) {
      bestCount = n;
      best = r.roundType;
    }
  }
  return best;
}

function resolveRoundType(loco: LocoConfig, roundType?: string) {
  const trimmed = roundType?.trim();
  if (trimmed) {
    if (!allowedRoundTypes(loco).has(trimmed)) {
      throw new Error(`Unknown round type "${trimmed}"`);
    }
    return trimmed;
  }
  return loco.mode === "competition" ? "Game" : mostCommonRoundType(loco);
}

/** Scored only when this competition type is scored in the template. */
function isScoredRoundType(loco: LocoConfig, roundType: string) {
  if (loco.mode !== "competition") return false;
  return loco.templateRounds.some(
    (r) => r.roundType === roundType && r.isScored,
  );
}

function isRoundActive(rows: Game[]) {
  return rows.some((g) => g.isPlaying || g.isCued || g.isVoting);
}

async function beginPair(
  ctx: MutationCtx,
  performanceId: Id<"performances">,
  pair: Pair,
) {
  if (pair.single) {
    await ctx.db.patch(pair.game1._id, {
      isCued: false,
      isPlaying: true,
      isPlayed: false,
      isVoting: false,
    });
  } else if (pair.sameGame) {
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
  const performance = await ctx.db.get(performanceId);
  if (!performance) return;
  if (pair.single && pair.game1.bitShowId) {
    const activeSceneId = await playBitShow(
      ctx,
      performanceId,
      pair.game1.bitShowId,
      0,
    );
    await ctx.db.patch(performanceId, {
      status: "live",
      showId: pair.game1.bitShowId,
      activeOverlay: pair.game1.gameName || undefined,
      ...(activeSceneId ? { activeSceneId } : {}),
    });
    return;
  }
  const activeSceneId = await playMatchingScene(
    ctx,
    performance,
    GAME_INSTRUCTION_CUE,
  );
  await ctx.db.patch(performanceId, {
    status: "live",
    activeOverlay: GAME_INSTRUCTION_CUE,
    ...(activeSceneId ? { activeSceneId } : {}),
  });
}

/** Make a bit/sketch the live show and play joke `index`. */
async function playBitShow(
  ctx: MutationCtx,
  performanceId: Id<"performances">,
  showId: Id<"shows">,
  index: number,
) {
  const scenes = await scenesForShow(ctx, showId);
  if (scenes.length === 0) {
    await ctx.db.patch(showId, {
      status: "live",
      currentSceneIndex: 0,
      sceneStartedAt: Date.now(),
      cuedByPerformanceId: performanceId,
    });
    return undefined;
  }
  const clamped = Math.max(0, Math.min(index, scenes.length - 1));
  const scene = scenes[clamped]!;
  await ctx.db.patch(showId, {
    status: "live",
    currentSceneIndex: clamped,
    sceneStartedAt: Date.now(),
    cuedByPerformanceId: performanceId,
  });
  await enqueueSceneCommands(ctx, {
    showId,
    sceneId: scene._id,
    performanceId,
  });
  await ctx.db.patch(performanceId, {
    showId,
    activeOverlay: scene.title,
    activeSceneId: scene._id,
  });
  return scene._id;
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

/** Designed bits/sketches the set-list picker can assemble into a night. */
export const listBits = query({
  args: { tag: v.optional(v.string()) },
  handler: async (ctx, { tag }) => {
    const want = tag ? requireLoco(tag).tag : undefined;
    const shows = await ctx.db.query("shows").collect();
    const bits = shows.filter((s) => {
      if (s.kind !== "bit" && s.kind !== "sketch") return false;
      if (want && s.tag !== want) return false;
      return true;
    });
    bits.sort((a, b) => a.title.localeCompare(b.title));
    const rows = [];
    for (const s of bits) {
      const scenes = await scenesForShow(ctx, s._id);
      rows.push({
        _id: s._id,
        title: s.title,
        kind: s.kind,
        roundType: s.roundType,
        tag: s.tag,
        sceneCount: scenes.length,
      });
    }
    return rows;
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

    const setlist = isSetlist(performance.tag);
    const pair = currentPair(games, setlist);
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

    const bitShowIds = [
      ...new Set(games.map((g) => g.bitShowId).filter(Boolean)),
    ] as Id<"shows">[];
    const bitShowById: Record<
      string,
      { _id: Id<"shows">; title: string; kind?: string; roundType?: string; sceneCount: number }
    > = {};
    for (const id of bitShowIds) {
      const row = await ctx.db.get(id);
      if (!row) continue;
      const scenes = await scenesForShow(ctx, id);
      bitShowById[id] = {
        _id: row._id,
        title: row.title,
        kind: row.kind,
        roundType: row.roundType,
        sceneCount: scenes.length,
      };
    }

    const bitShowId =
      setlist && pair?.game1.bitShowId ? pair.game1.bitShowId : undefined;
    const showId = bitShowId ?? performance.showId;
    const show = showId ? await ctx.db.get(showId) : null;
    const designed = show ? await scenesForShow(ctx, show._id) : [];
    const teams = { team1: performance.team1, team2: performance.team2 };
    const sceneBuckets = bucketScenes(designed, teams);
    const bitSceneIndex = show?.currentSceneIndex ?? 0;

    return {
      ...performance,
      show,
      scenes: designed.map((s, index) => ({
        ...s,
        index,
        bucket: sceneBucket(s, teams),
      })),
      sceneBuckets,
      games: games.map((g) => ({
        ...g,
        volunteers: g.volunteers ?? 0,
        score: rowPoints(g),
        catalog: g.gameId ? catalogById[g.gameId] : undefined,
        bitShow: g.bitShowId ? bitShowById[g.bitShowId] : undefined,
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
            single: pair.single,
            game1Id: pair.game1._id,
            game2Id: pair.game2._id,
            volunteerRound: isVolunteerRound(pair.game1),
            isScored: pair.game1.isScored,
            bitShowId: pair.game1.bitShowId,
            bitSceneIndex,
            bitSceneCount: designed.length,
          }
        : null,
      mode: requireLoco(performance.tag).mode,
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
    showId: v.optional(v.id("shows")),
  },
  handler: async (ctx, { title, team1, team2, ownerId, tag, showId }) => {
    const loco = requireLoco(tag);
    const performanceId = await ctx.db.insert("performances", {
      title: title.trim(),
      team1: team1.trim() || loco.team1,
      team2: team2.trim() || loco.team2,
      status: "draft",
      ownerId,
      tag: loco.tag,
      showId,
    });

    let order = 0;
    const teamIndexes =
      loco.mode === "setlist" ? ([1] as const) : ([1, 2] as const);
    for (const round of loco.templateRounds) {
      for (const teamIndex of teamIndexes) {
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
    const performance = await ctx.db.get(performanceId);
    if (!performance) return;
    const activeSceneId =
      overlay !== undefined
        ? await playMatchingScene(ctx, performance, overlay)
        : undefined;
    await ctx.db.patch(performanceId, {
      activeOverlay: overlay,
      ...(overlay === undefined
        ? { activeSceneId: undefined }
        : activeSceneId
          ? { activeSceneId }
          : {}),
    });
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

/** Bind a designed show. Subsequent game cues play matching scenes on it. */
export const setShow = mutation({
  args: {
    performanceId: v.id("performances"),
    showId: v.optional(v.id("shows")),
  },
  handler: async (ctx, { performanceId, showId }) => {
    await ctx.db.patch(performanceId, {
      showId,
      activeSceneId: undefined,
    });
  },
});

/**
 * Operator tapped a designed scene (legacy Scene row click). Overlay /
 * background / intro scenes go live; music / sound only set the track.
 */
export const playPerformanceScene = mutation({
  args: {
    performanceId: v.id("performances"),
    sceneId: v.id("scenes"),
  },
  handler: async (ctx, { performanceId, sceneId }) => {
    const performance = await ctx.db.get(performanceId);
    const scene = await ctx.db.get(sceneId);
    if (!performance || !scene) return;
    if (performance.showId && scene.showId !== performance.showId) return;
    const bucket = sceneBucket(scene, {
      team1: performance.team1,
      team2: performance.team2,
    });
    if (bucket === "music" || bucket === "sound") {
      await ctx.db.patch(performanceId, { activeTrack: scene.title });
      return;
    }
    const scenes = await scenesForShow(ctx, scene.showId);
    const index = scenes.findIndex((s) => s._id === sceneId);
    if (index < 0) return;
    await ctx.db.patch(scene.showId, {
      status: "live",
      currentSceneIndex: index,
      sceneStartedAt: Date.now(),
      cuedByPerformanceId: performanceId,
    });
    await enqueueSceneCommands(ctx, {
      showId: scene.showId,
      sceneId: scene._id,
      performanceId,
    });
    await ctx.db.patch(performanceId, {
      showId: scene.showId,
      activeOverlay: scene.title,
      activeSceneId: scene._id,
    });
  },
});

/** "Begin Game" / "Begin Segment". Same-game competition rounds start both teams. */
export const beginGame = mutation({
  args: { performanceId: v.id("performances") },
  handler: async (ctx, { performanceId }) => {
    const performance = await ctx.db.get(performanceId);
    if (!performance) return;
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games, isSetlist(performance.tag));
    if (!pair || (pair.phase !== "idle" && pair.phase !== "cued")) return;
    await beginPair(ctx, performanceId, pair);
  },
});

/**
 * "Next Game" (legacy EndGame → CueGame): team 1 done, team 2 starts.
 * Same-game rounds and set-list segments skip this — no opponent step.
 */
export const nextGame = mutation({
  args: { performanceId: v.id("performances") },
  handler: async (ctx, { performanceId }) => {
    const performance = await ctx.db.get(performanceId);
    if (!performance) return;
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games, isSetlist(performance.tag));
    if (!pair || pair.single || pair.phase !== "team1") return;
    await ctx.db.patch(pair.game1._id, { isPlaying: false, isPlayed: true });
    await ctx.db.patch(pair.game2._id, { isCued: false, isPlaying: true });
    await cueTrack(ctx, performanceId, pair.game1.round, GAME_INSTRUCTION_CUE);
  },
});

/**
 * "End Round" / "End Segment". Competition: both teams played; scored rounds
 * go to audience voting, unscored rounds complete. Set list: mark the
 * current segment played and cue the next (never voting).
 */
export const endRound = mutation({
  args: { performanceId: v.id("performances") },
  handler: async (ctx, { performanceId }) => {
    const performance = await ctx.db.get(performanceId);
    if (!performance) return;
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games, isSetlist(performance.tag));
    if (!pair) return;
    if (pair.single) {
      if (pair.phase !== "team1") return;
      await ctx.db.patch(pair.game1._id, { isPlaying: false, isPlayed: true });
      if (!pair.game1.bitShowId) {
        await cueTrack(
          ctx,
          performanceId,
          pair.game1.round,
          celebrationOrInstructions(performance, pair.game1.roundType),
        );
      }
      return;
    }
    if (pair.phase !== "team2" && pair.phase !== "both") return;
    await ctx.db.patch(pair.game1._id, {
      isPlaying: false,
      isPlayed: true,
    });
    await ctx.db.patch(pair.game2._id, {
      isPlaying: false,
      isPlayed: true,
    });
    await cueTrack(
      ctx,
      performanceId,
      pair.game1.round,
      pair.game1.isScored
        ? VOTE_CUE
        : celebrationOrInstructions(performance, pair.game1.roundType),
    );
    if (pair.game1.isScored) {
      await ctx.db.patch(pair.game1._id, { isVoting: true });
      await ctx.db.patch(pair.game2._id, { isVoting: true });
    }
  },
});

/**
 * Unified Next (the host's primary advance button).
 *
 * Competition: dispatches to Begin / Next Game / End Round based on
 * GetCurrentGameRow phase. Scored rounds land in voting.
 *
 * Set list: idle/cued → begin the segment; playing → mark played and cue
 * the next segment. Never voting, never a team-2 step.
 */
export const next = mutation({
  args: { performanceId: v.id("performances") },
  handler: async (ctx, { performanceId }) => {
    const performance = await ctx.db.get(performanceId);
    if (!performance) return;
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games, isSetlist(performance.tag));
    if (!pair || pair.phase === "voting") return;
    if (pair.phase === "idle" || pair.phase === "cued") {
      await beginPair(ctx, performanceId, pair);
      return;
    }
    if (pair.single) {
      if (pair.game1.bitShowId) {
        const bit = await ctx.db.get(pair.game1.bitShowId);
        const scenes = await scenesForShow(ctx, pair.game1.bitShowId);
        const idx = bit?.currentSceneIndex ?? 0;
        if (idx + 1 < scenes.length) {
          await playBitShow(ctx, performanceId, pair.game1.bitShowId, idx + 1);
          return;
        }
      }
      await ctx.db.patch(pair.game1._id, { isPlaying: false, isPlayed: true });
      if (!pair.game1.bitShowId) {
        await cueTrack(
          ctx,
          performanceId,
          pair.game1.round,
          celebrationOrInstructions(performance, pair.game1.roundType),
        );
      }
      return;
    }
    if (pair.phase === "team1") {
      await ctx.db.patch(pair.game1._id, { isPlaying: false, isPlayed: true });
      await ctx.db.patch(pair.game2._id, { isCued: false, isPlaying: true });
      await cueTrack(ctx, performanceId, pair.game1.round, GAME_INSTRUCTION_CUE);
      return;
    }
    await ctx.db.patch(pair.game1._id, { isPlaying: false, isPlayed: true });
    await ctx.db.patch(pair.game2._id, { isPlaying: false, isPlayed: true });
    if (pair.game1.isScored) {
      await ctx.db.patch(pair.game1._id, { isVoting: true });
      await ctx.db.patch(pair.game2._id, { isVoting: true });
      await cueTrack(ctx, performanceId, pair.game1.round, VOTE_CUE);
    } else {
      await cueTrack(
        ctx,
        performanceId,
        pair.game1.round,
        celebrationOrInstructions(performance, pair.game1.roundType),
      );
    }
  },
});

/** "Win 1"/"Win 2": audience picked a winner. Unreachable no-op for set lists. */
export const winGame = mutation({
  args: {
    performanceId: v.id("performances"),
    teamIndex: v.union(v.literal(1), v.literal(2)),
  },
  handler: async (ctx, { performanceId, teamIndex }) => {
    const performance = await ctx.db.get(performanceId);
    if (!performance || isSetlist(performance.tag)) return;
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games, false);
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
    const overlay = winnerCue(teamName);
    const visual =
      performance.tag === "battleloco"
        ? "Bring the Boom"
        : performance.tag === "wrestleloco"
          ? "Hit the Bell"
          : overlay;
    const activeSceneId =
      (await playMatchingScene(ctx, performance, visual)) ??
      (await playMatchingScene(ctx, performance, overlay));
    await ctx.db.patch(performanceId, {
      activeOverlay: overlay,
      ...(activeSceneId ? { activeSceneId } : {}),
    });
  },
});

/** "Rotation 1"/"Rotation 2" (same-game rounds): bonus rotation point. No-op for set lists. */
export const winRotation = mutation({
  args: {
    performanceId: v.id("performances"),
    teamIndex: v.union(v.literal(1), v.literal(2)),
  },
  handler: async (ctx, { performanceId, teamIndex }) => {
    const performance = await ctx.db.get(performanceId);
    if (!performance || isSetlist(performance.tag)) return;
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games, false);
    if (!pair) return;
    const game = teamIndex === 1 ? pair.game1 : pair.game2;
    await writeScore(ctx, game, { rotation: true });
    const activeSceneId = await playMatchingScene(
      ctx,
      performance,
      SCORE_ROTATION_CUE,
    );
    await ctx.db.patch(performanceId, {
      activeOverlay: SCORE_ROTATION_CUE,
      ...(activeSceneId ? { activeSceneId } : {}),
    });
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
    const performance = await ctx.db.get(performanceId);
    if (!performance) return;
    const games = await gamesInOrder(ctx, performanceId);
    const pair = currentPair(games, isSetlist(performance.tag));
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
    bitShowId: v.optional(v.id("shows")),
  },
  handler: async (ctx, { gameRowId, catalogId, gameName, bitShowId }) => {
    if (bitShowId) {
      const show = await ctx.db.get(bitShowId);
      if (!show) return;
      await ctx.db.patch(gameRowId, {
        bitShowId,
        gameName: show.title,
        gameId: undefined,
      });
      return;
    }
    if (catalogId) {
      const catalog = await ctx.db.get(catalogId);
      if (!catalog) return;
      await ctx.db.patch(gameRowId, {
        gameId: catalogId,
        gameName: catalog.name,
        bitShowId: undefined,
      });
      return;
    }
    await ctx.db.patch(gameRowId, {
      gameId: undefined,
      bitShowId: undefined,
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

/**
 * Insert a round after `afterRound` (new number afterRound+1) or at the end.
 * Competition writes both team rows; set list writes one. Subsequent
 * `round` / `order` values shift so they stay sequential (team 1 then 2).
 */
export const addRound = mutation({
  args: {
    performanceId: v.id("performances"),
    roundType: v.optional(v.string()),
    afterRound: v.optional(v.number()),
  },
  handler: async (ctx, { performanceId, roundType, afterRound }) => {
    const performance = await ctx.db.get(performanceId);
    if (!performance) throw new Error("Performance not found");
    const loco = requireLoco(performance.tag);
    const type = resolveRoundType(loco, roundType);
    const isScored = isScoredRoundType(loco, type);
    const teamIndexes =
      loco.mode === "setlist" ? ([1] as const) : ([1, 2] as const);
    const stride = teamIndexes.length;

    const games = await gamesInOrder(ctx, performanceId);
    const maxRound = games.reduce((m, g) => Math.max(m, g.round), 0);
    const newRound =
      afterRound !== undefined ? afterRound + 1 : maxRound + 1;

    for (const game of games) {
      if (game.round >= newRound) {
        await ctx.db.patch(game._id, {
          round: game.round + 1,
          order: game.order + stride,
        });
      }
    }

    let order = games.filter((g) => g.round < newRound).length;
    for (const teamIndex of teamIndexes) {
      await ctx.db.insert("performanceGames", {
        performanceId,
        order: order++,
        round: newRound,
        roundType: type,
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
        isScored,
      });
    }
  },
});

/**
 * Remove a round and close the gap. Refuses if any of its rows are
 * playing, cued, or voting.
 */
export const deleteRound = mutation({
  args: {
    performanceId: v.id("performances"),
    round: v.number(),
  },
  handler: async (ctx, { performanceId, round }) => {
    const performance = await ctx.db.get(performanceId);
    if (!performance) throw new Error("Performance not found");
    const games = await gamesInOrder(ctx, performanceId);
    const rows = games.filter((g) => g.round === round);
    if (rows.length === 0) return;
    if (isRoundActive(rows)) throw new Error("Round is active");

    for (const row of rows) await ctx.db.delete(row._id);

    const stride = rows.length;
    for (const game of games) {
      if (game.round > round) {
        await ctx.db.patch(game._id, {
          round: game.round - 1,
          order: game.order - stride,
        });
      }
    }
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
      activeSceneId: undefined,
    });
  },
});
