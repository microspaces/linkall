import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireLoco } from "./locos";
import { overlayKindForTitle } from "./sceneCues";

/**
 * Idempotent Luxor Oct 17 Battle Loco show + performance.
 *
 *   pnpm --filter @linkall/backend exec convex run battlelocoLuxor:seed --env-file .env.funfirst
 *   pnpm --filter @linkall/backend exec convex run seed:battleLocoLuxor --env-file .env.funfirst
 *
 * Scene titles match sceneCues.ts. Visuals use kind "panels" + image/video
 * effects (scene.kind has no "video"; walls come from effects like boom videos).
 */

export const SHOW_SOURCE_KEY = "bl-luxor:show";
export const SHOW_TITLE = "Battle Loco — Luxor Oct 17";
export const SHOW_DESCRIPTION =
  "Luxor Las Vegas — Heat vs Ice. Five games, award ceremony, outro.";
export const PERFORMANCE_TITLE = "Battle Loco — Luxor Oct 17";
/** Date lives in the title; performances have no scheduled-date field. */
export const PERFORMANCE_DATE = "2026-10-17";

const FX = "/battle-loco/effects";

type MediaKind = "image" | "video";
type Asset = { kind: MediaKind; content: string };

const ASSETS = {
  flythrough: { kind: "video" as const, content: `${FX}/arena-flythrough.mp4` },
  venue: { kind: "image" as const, content: `${FX}/venue-night.jpg` },
  logo: { kind: "video" as const, content: `${FX}/logo-slam.mp4` },
  wheel: { kind: "image" as const, content: `${FX}/punishment-wheel.jpg` },
  heat: { kind: "image" as const, content: `${FX}/heat-persona.jpg` },
  ice: { kind: "image" as const, content: `${FX}/ice-persona.jpg` },
  confetti: { kind: "video" as const, content: `${FX}/confetti-loop.mp4` },
  thanks: { kind: "image" as const, content: `${FX}/outro-thanks.jpg` },
  embers: { kind: "video" as const, content: `${FX}/embers-loop.mp4` },
  frost: { kind: "video" as const, content: `${FX}/frost-loop.mp4` },
};

type Dress = "heat" | "ice" | "award" | "venue" | "house";

type VisualSpec = {
  title: string;
  durationSec: number;
  isOverlay?: boolean;
  center: Asset;
  dress: Dress;
};

const VISUAL_SCENES: VisualSpec[] = [
  { title: "House Loop", durationSec: 120, center: ASSETS.flythrough, dress: "house" },
  {
    title: "Introduction",
    durationSec: 20,
    isOverlay: true,
    center: ASSETS.venue,
    dress: "venue",
  },
  {
    title: "Game Instructions",
    durationSec: 30,
    isOverlay: true,
    center: ASSETS.venue,
    dress: "venue",
  },
  { title: "Vote", durationSec: 20, isOverlay: true, center: ASSETS.venue, dress: "venue" },
  { title: "Score", durationSec: 20, isOverlay: true, center: ASSETS.venue, dress: "venue" },
  {
    title: "Score Rotation",
    durationSec: 15,
    isOverlay: true,
    center: ASSETS.venue,
    dress: "venue",
  },
  {
    title: "Box Score",
    durationSec: 20,
    isOverlay: true,
    center: ASSETS.venue,
    dress: "venue",
  },
  { title: "Games", durationSec: 20, isOverlay: true, center: ASSETS.logo, dress: "venue" },
  {
    title: "Suggestions",
    durationSec: 20,
    isOverlay: true,
    center: ASSETS.wheel,
    dress: "venue",
  },
  {
    title: "Punishment",
    durationSec: 20,
    isOverlay: true,
    center: ASSETS.wheel,
    dress: "venue",
  },
  {
    title: "Winner Heat",
    durationSec: 15,
    isOverlay: true,
    center: ASSETS.heat,
    dress: "heat",
  },
  {
    title: "Winner Ice",
    durationSec: 15,
    isOverlay: true,
    center: ASSETS.ice,
    dress: "ice",
  },
  { title: "Heat Arena", durationSec: 60, center: ASSETS.heat, dress: "heat" },
  { title: "Ice Arena", durationSec: 60, center: ASSETS.ice, dress: "ice" },
  { title: "Luxor Stage", durationSec: 60, center: ASSETS.venue, dress: "venue" },
  { title: "Award Ceremony", durationSec: 90, center: ASSETS.confetti, dress: "award" },
  { title: "Outro", durationSec: 90, center: ASSETS.thanks, dress: "award" },
];

const MUSIC_SCENES = [
  "BringTheFun",
  "BackNForth",
  "BubbleGumGirl",
  "CockatooInTheGrass",
  "DressedInPink",
  "DrivingYourVibes",
] as const;

const SOUND_SCENES = [
  "Bell Sting",
  "Air Horn",
  "Crowd Cheer",
  "Buzzer",
  "Drum Roll",
] as const;

function sceneKey(n: number) {
  return `bl-luxor:scene:${String(n).padStart(2, "0")}`;
}

function effectKey(n: number, panel: string) {
  return `bl-luxor:effect:scene${String(n).padStart(2, "0")}:${panel}`;
}

function wings(dress: Dress): { left: Asset; right: Asset } {
  switch (dress) {
    case "heat":
      return { left: ASSETS.embers, right: ASSETS.embers };
    case "ice":
      return { left: ASSETS.frost, right: ASSETS.frost };
    case "award":
      return { left: ASSETS.confetti, right: ASSETS.confetti };
    case "house":
      return { left: ASSETS.embers, right: ASSETS.frost };
    default:
      return { left: ASSETS.venue, right: ASSETS.venue };
  }
}

/** Same HyperX lookup seed.ts uses (hyperXArenaFor is private there). */
async function hyperXArenaFor(ctx: MutationCtx): Promise<{
  layoutId: Id<"layouts">;
  panelByLogical: Record<string, Id<"panels">>;
} | null> {
  const layouts = await ctx.db.query("layouts").collect();
  const layout = layouts.find((l) => l.name === "HyperX Arena");
  if (!layout) return null;
  const screens = await ctx.db
    .query("screens")
    .withIndex("by_layout", (q) => q.eq("layoutId", layout._id))
    .collect();
  const byName = (name: string) => screens.find((s) => s.name === name);
  const panelOf = async (screen: { _id: Id<"screens"> } | undefined) => {
    if (!screen) return undefined;
    const panels = await ctx.db
      .query("panels")
      .withIndex("by_screen", (q) => q.eq("screenId", screen._id))
      .collect();
    panels.sort((a, b) => a.zIndex - b.zIndex);
    return panels[0]?._id;
  };
  const left = byName("HyperX Stage Left");
  const center = byName("HyperX Stage Center");
  const right = byName("HyperX Stage Right");
  const lp = await panelOf(left);
  const cp = await panelOf(center);
  const rp = await panelOf(right);
  if (!left || !center || !right || !lp || !cp || !rp) return null;
  return {
    layoutId: layout._id,
    panelByLogical: {
      LeftSidebar: lp,
      MainContent: cp,
      RightSidebar: rp,
    },
  };
}

async function ensureDisplayProfile(
  ctx: MutationCtx,
  showId: Id<"shows">,
  ownerId: Id<"users">,
  hyperx: { layoutId: Id<"layouts">; panelByLogical: Record<string, Id<"panels">> },
) {
  const profiles = await ctx.db
    .query("displayProfiles")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();
  let profile = profiles.find((p) => p.isDefault) ?? profiles[0];
  if (!profile) {
    const profileId = await ctx.db.insert("displayProfiles", {
      name: "HyperX Arena",
      description:
        "Stage Left / Center / Right LED walls at HyperX Arena (Luxor).",
      showId,
      layoutId: hyperx.layoutId,
      isDefault: true,
      ownerId,
    });
    profile = (await ctx.db.get(profileId))!;
  } else if (profile.layoutId !== hyperx.layoutId) {
    await ctx.db.patch(profile._id, { layoutId: hyperx.layoutId });
  }
  const mappings = await ctx.db
    .query("panelMappings")
    .withIndex("by_profile", (q) => q.eq("displayProfileId", profile._id))
    .collect();
  const have = new Set(mappings.map((m) => m.logicalPanelName));
  for (const [logical, panelId] of Object.entries(hyperx.panelByLogical)) {
    if (have.has(logical)) continue;
    await ctx.db.insert("panelMappings", {
      displayProfileId: profile._id,
      logicalPanelName: logical,
      panelId,
    });
  }
}

type SceneRow = {
  _id: Id<"scenes">;
  title: string;
  sourceKey?: string;
};

async function upsertScene(
  ctx: MutationCtx,
  showId: Id<"shows">,
  existing: SceneRow[],
  spec: {
    order: number;
    n: number;
    title: string;
    kind: "panels" | "text";
    content: string;
    durationSec: number;
    isOverlay?: boolean;
    isSoundEffect?: boolean;
  },
): Promise<{ id: Id<"scenes">; inserted: boolean }> {
  const sourceKey = sceneKey(spec.n);
  const have =
    existing.find((s) => s.sourceKey === sourceKey) ??
    existing.find((s) => s.title === spec.title);
  const fields = {
    order: spec.order,
    title: spec.title,
    kind: spec.kind,
    content: spec.content,
    durationSec: spec.durationSec,
    isOverlay: spec.isOverlay,
    isSoundEffect: spec.isSoundEffect,
    sourceKey,
  };
  if (have) {
    await ctx.db.patch(have._id, fields);
    have.title = spec.title;
    have.sourceKey = sourceKey;
    return { id: have._id, inserted: false };
  }
  const id = await ctx.db.insert("scenes", { showId, ...fields });
  existing.push({ _id: id, title: spec.title, sourceKey });
  return { id, inserted: true };
}

async function upsertEffect(
  ctx: MutationCtx,
  sceneId: Id<"scenes">,
  n: number,
  logical: string,
  asset: Asset,
  panelId: Id<"panels"> | undefined,
): Promise<boolean> {
  const sourceKey = effectKey(n, logical);
  const effects = await ctx.db
    .query("effects")
    .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
    .collect();
  const have =
    effects.find((e) => e.sourceKey === sourceKey) ??
    effects.find((e) => e.logicalPanelName === logical);
  const fields = {
    panelId,
    logicalPanelName: logical,
    kind: asset.kind,
    content: asset.content,
    startTime: 0,
    isEnabled: true,
    sourceKey,
  };
  if (have) {
    await ctx.db.patch(have._id, fields);
    return false;
  }
  await ctx.db.insert("effects", { sceneId, ...fields });
  return true;
}

async function resolveOwner(ctx: MutationCtx | QueryCtx) {
  const users = await ctx.db.query("users").collect();
  const owner =
    users.find((u) => u.tier === "admin") ??
    users.find((u) => u.handle === "dev") ??
    users[0];
  if (!owner) {
    throw new Error("No users in deployment — run seed:funfirst first.");
  }
  return owner;
}

/**
 * Insert or reuse the Luxor Oct 17 designed show. Re-runs patch in place
 * and never duplicate rows. Returns the showId.
 */
export async function seedBattleLocoLuxor(
  ctx: MutationCtx,
  ownerId: Id<"users">,
): Promise<Id<"shows">> {
  const result = await seedBattleLocoLuxorDetailed(ctx, ownerId);
  return result.showId;
}

export async function seedBattleLocoLuxorDetailed(
  ctx: MutationCtx,
  ownerId: Id<"users">,
) {
  const hyperx = await hyperXArenaFor(ctx);

  const byKey = await ctx.db
    .query("shows")
    .withIndex("by_sourceKey", (q) => q.eq("sourceKey", SHOW_SOURCE_KEY))
    .collect();
  let show: Doc<"shows"> | undefined = byKey[0];
  if (!show) {
    const tagged = await ctx.db
      .query("shows")
      .withIndex("by_tag", (q) => q.eq("tag", "battleloco"))
      .collect();
    show = tagged.find((s) => s.title === SHOW_TITLE);
  }

  let showInserted = false;
  if (!show) {
    const showId = await ctx.db.insert("shows", {
      title: SHOW_TITLE,
      description: SHOW_DESCRIPTION,
      tag: "battleloco",
      status: "draft",
      currentSceneIndex: 0,
      ownerId,
      sourceKey: SHOW_SOURCE_KEY,
      ...(hyperx ? { layoutId: hyperx.layoutId } : {}),
    });
    show = (await ctx.db.get(showId))!;
    showInserted = true;
  } else {
    await ctx.db.patch(show._id, {
      title: SHOW_TITLE,
      description: SHOW_DESCRIPTION,
      tag: "battleloco",
      status: show.status === "ended" ? "draft" : show.status,
      ownerId,
      sourceKey: SHOW_SOURCE_KEY,
      ...(hyperx ? { layoutId: hyperx.layoutId } : {}),
    });
  }

  if (hyperx) {
    await ensureDisplayProfile(ctx, show._id, ownerId, hyperx);
  }

  const existingScenes = (
    await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", show._id))
      .collect()
  ).map((s) => ({ _id: s._id, title: s.title, sourceKey: s.sourceKey }));

  let scenesInserted = 0;
  let scenesSkipped = 0;
  let effectsInserted = 0;
  let effectsSkipped = 0;
  let order = 0;
  let n = 0;

  for (const spec of VISUAL_SCENES) {
    n += 1;
    const overlay =
      spec.isOverlay === true || overlayKindForTitle(spec.title) != null;
    const scene = await upsertScene(ctx, show._id, existingScenes, {
      order: order++,
      n,
      title: spec.title,
      kind: "panels",
      content: spec.center.content,
      durationSec: spec.durationSec,
      isOverlay: overlay || spec.isOverlay,
    });
    if (scene.inserted) scenesInserted++;
    else scenesSkipped++;

    const side = wings(spec.dress);
    const walls: Array<["LeftSidebar" | "MainContent" | "RightSidebar", Asset]> =
      [
        ["LeftSidebar", side.left],
        ["MainContent", spec.center],
        ["RightSidebar", side.right],
      ];
    for (const [logical, asset] of walls) {
      const inserted = await upsertEffect(
        ctx,
        scene.id,
        n,
        logical,
        asset,
        hyperx?.panelByLogical[logical],
      );
      if (inserted) effectsInserted++;
      else effectsSkipped++;
    }
  }

  // Do not insert soundtrack cue scenes. Keep the scene-number / order gap
  // so SOUND_SCENES stay bl-luxor:scene:24–28 on re-run.
  n += MUSIC_SCENES.length;
  order += MUSIC_SCENES.length;

  for (const title of SOUND_SCENES) {
    n += 1;
    const scene = await upsertScene(ctx, show._id, existingScenes, {
      order: order++,
      n,
      title,
      kind: "text",
      content: title,
      durationSec: 5,
      isSoundEffect: true,
    });
    if (scene.inserted) scenesInserted++;
    else scenesSkipped++;
  }

  const sceneCount = (
    await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", show._id))
      .collect()
  ).length;

  return {
    showId: show._id,
    layoutId: hyperx?.layoutId,
    showInserted,
    scenesInserted,
    scenesSkipped,
    effectsInserted,
    effectsSkipped,
    sceneCount,
  };
}

/**
 * Same insert shape as game.create (title, team1, team2, ownerId, tag, showId).
 * Inlined because a mutation cannot call another mutation. No date/slug args
 * exist on performances — Oct 17 stays in the title.
 */
async function ensureLuxorPerformance(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  showId: Id<"shows">,
) {
  const performances = await ctx.db.query("performances").collect();
  const existing = performances.find(
    (p) => p.title === PERFORMANCE_TITLE && p.tag === "battleloco",
  );
  if (existing) {
    if (existing.showId !== showId) {
      await ctx.db.patch(existing._id, { showId });
    }
    return { performanceId: existing._id, inserted: false };
  }

  const loco = requireLoco("battleloco");
  const performanceId = await ctx.db.insert("performances", {
    title: PERFORMANCE_TITLE,
    team1: loco.team1,
    team2: loco.team2,
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

  return { performanceId, inserted: true };
}

export async function runBattleLocoLuxorSeed(ctx: MutationCtx) {
  const owner = await resolveOwner(ctx);
  console.log(
    `seedBattleLocoLuxor owner: ${owner.handle} (${owner.tier}) ${owner._id}`,
  );
  const show = await seedBattleLocoLuxorDetailed(ctx, owner._id);
  const performance = await ensureLuxorPerformance(
    ctx,
    owner._id,
    show.showId,
  );
  return {
    showId: show.showId,
    showTitle: SHOW_TITLE,
    performanceId: performance.performanceId,
    performanceTitle: PERFORMANCE_TITLE,
    performanceDate: PERFORMANCE_DATE,
    ownerId: owner._id,
    ownerHandle: owner.handle,
    ownerTier: owner.tier,
    layoutId: show.layoutId ?? null,
    sceneCount: show.sceneCount,
    inserted: {
      show: show.showInserted,
      scenes: show.scenesInserted,
      effects: show.effectsInserted,
      performance: performance.inserted,
    },
    skipped: {
      show: !show.showInserted,
      scenes: show.scenesSkipped,
      effects: show.effectsSkipped,
      performance: !performance.inserted,
    },
  };
}

export const seed = mutation({
  args: {},
  handler: async (ctx) => runBattleLocoLuxorSeed(ctx),
});

export const seedBattleLocoLuxorRun = mutation({
  args: { ownerId: v.optional(v.id("users")) },
  handler: async (ctx, { ownerId }) => {
    const owner = ownerId
      ? await ctx.db.get(ownerId)
      : await resolveOwner(ctx);
    if (!owner) throw new Error("Owner user not found.");
    console.log(
      `seedBattleLocoLuxor owner: ${owner.handle} (${owner.tier}) ${owner._id}`,
    );
    const show = await seedBattleLocoLuxorDetailed(ctx, owner._id);
    const performance = await ensureLuxorPerformance(
      ctx,
      owner._id,
      show.showId,
    );
    return {
      showId: show.showId,
      performanceId: performance.performanceId,
      ownerId: owner._id,
      ownerHandle: owner.handle,
      ownerTier: owner.tier,
      sceneCount: show.sceneCount,
      inserted: {
        show: show.showInserted,
        scenes: show.scenesInserted,
        effects: show.effectsInserted,
        performance: performance.inserted,
      },
      skipped: {
        show: !show.showInserted,
        scenes: show.scenesSkipped,
        effects: show.effectsSkipped,
        performance: !performance.inserted,
      },
    };
  },
});

export const inspect = query({
  args: {},
  handler: async (ctx) => {
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_tag", (q) => q.eq("tag", "battleloco"))
      .collect();
    const show =
      shows.find((s) => s.sourceKey === SHOW_SOURCE_KEY) ??
      shows.find((s) => s.title === SHOW_TITLE);
    if (!show) {
      return { found: false as const, battlelocoShows: shows.map((s) => s.title) };
    }
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", show._id))
      .collect();
    scenes.sort((a, b) => a.order - b.order);
    const performances = (await ctx.db.query("performances").collect()).filter(
      (p) => p.showId === show._id || p.title === PERFORMANCE_TITLE,
    );
    return {
      found: true as const,
      showId: show._id,
      showTitle: show.title,
      showStatus: show.status,
      sourceKey: show.sourceKey,
      layoutId: show.layoutId ?? null,
      sceneCount: scenes.length,
      scenes: scenes.map((s) => ({
        order: s.order,
        title: s.title,
        kind: s.kind,
        isOverlay: s.isOverlay ?? false,
        isSoundEffect: s.isSoundEffect ?? false,
        sourceKey: s.sourceKey,
      })),
      performances: performances.map((p) => ({
        _id: p._id,
        title: p.title,
        tag: p.tag,
        showId: p.showId,
        status: p.status,
      })),
    };
  },
});

const SHOWDOWN_PERFORMANCE_ID =
  "ms7c1s7d9922rbcqkf8j3xx2198djq2t" as Id<"performances">;

/** Creator Showdown Las Vegas 2026 order. Game rounds only (2/5/8/11/14). */
const SHOWDOWN_GAMES: Array<{ round: number; gameName: string }> = [
  { round: 2, gameName: "Rivals" },
  { round: 5, gameName: "Chained" },
  { round: 8, gameName: "Dueling Grounds" },
  { round: 11, gameName: "Racket Rivals" },
  { round: 14, gameName: "Knockout" },
];

async function findShowdownPerformance(ctx: MutationCtx | QueryCtx) {
  const byId = await ctx.db.get(SHOWDOWN_PERFORMANCE_ID);
  if (byId) return byId;
  const performances = await ctx.db.query("performances").collect();
  return performances.find(
    (p) => p.title === PERFORMANCE_TITLE && p.tag === "battleloco",
  );
}

/**
 * Patch Battle Loco — Luxor Oct 17 Game rounds to the Creator Showdown
 * lineup. Only writes `gameName` when it differs, so a second run is a
 * no-op (changes: 0).
 *
 *   pnpm --filter @linkall/backend exec convex run battlelocoLuxor:setShowdownGames --env-file .env.funfirst
 */
export const setShowdownGames = internalMutation({
  args: {},
  handler: async (ctx) => {
    const performance = await findShowdownPerformance(ctx);
    if (!performance) {
      return {
        found: false as const,
        changes: 0,
        games: [],
      };
    }

    const rows = await ctx.db
      .query("performanceGames")
      .withIndex("by_performance", (q) =>
        q.eq("performanceId", performance._id),
      )
      .collect();

    let changes = 0;
    const games: Array<{
      round: number;
      teamIndex: 1 | 2;
      before: string;
      after: string;
      changed: boolean;
    }> = [];

    for (const spec of SHOWDOWN_GAMES) {
      const roundRows = rows
        .filter((r) => r.round === spec.round)
        .sort((a, b) => a.teamIndex - b.teamIndex);
      for (const row of roundRows) {
        const before = row.gameName;
        const after = spec.gameName;
        const changed = before !== after;
        if (changed) {
          await ctx.db.patch(row._id, { gameName: after });
          changes += 1;
        }
        games.push({
          round: spec.round,
          teamIndex: row.teamIndex,
          before,
          after,
          changed,
        });
      }
    }

    return {
      found: true as const,
      performanceId: performance._id,
      performanceTitle: performance.title,
      changes,
      games,
    };
  },
});

export const inspectShowdownGames = query({
  args: {},
  handler: async (ctx) => {
    const performance = await findShowdownPerformance(ctx);
    if (!performance) {
      return { found: false as const, games: [] };
    }
    const rows = await ctx.db
      .query("performanceGames")
      .withIndex("by_performance", (q) =>
        q.eq("performanceId", performance._id),
      )
      .collect();
    const rounds = new Set(SHOWDOWN_GAMES.map((g) => g.round));
    const games = rows
      .filter((r) => rounds.has(r.round))
      .sort((a, b) => a.round - b.round || a.teamIndex - b.teamIndex)
      .map((r) => ({
        round: r.round,
        teamIndex: r.teamIndex,
        gameName: r.gameName,
        roundType: r.roundType,
      }));
    return {
      found: true as const,
      performanceId: performance._id,
      performanceTitle: performance.title,
      games,
    };
  },
});
