import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireLoco } from "./locos";
import { overlayKindForTitle } from "./sceneCues";

/**
 * Idempotent Luxor Night 1 Comedy Loco show + performance.
 *
 *   pnpm --filter @linkall/backend exec convex run comedylocoLuxor:seed --env-file .env.funfirst
 *   pnpm --filter @linkall/backend exec convex run seed:comedyLocoLuxor --env-file .env.funfirst
 *
 * Scene titles match sceneCues.ts. Visuals use kind "panels" + image/video
 * effects (scene.kind has no "video"; walls come from effects like boom videos).
 * Winner titles use exact comedyloco team names: Winner Banana Peels /
 * Winner Comedy Clubtrotters. Re-running seed skips existing scene/performance
 * rows — use renameComedyTeams to patch live Luxor data.
 */

export const SHOW_SOURCE_KEY = "cl-luxor:show";
export const SHOW_TITLE = "Comedy Loco — Luxor Night 1";
export const SHOW_DESCRIPTION =
  "Luxor Las Vegas — Banana Peels vs Comedy Clubtrotters. Fast comedy, games, points that count.";
export const PERFORMANCE_TITLE = "Comedy Loco — Luxor Night 1";

const FX = "/comedy-loco/effects";

type MediaKind = "image" | "video";
type Asset = { kind: MediaKind; content: string };

const ASSETS = {
  sweep: { kind: "video" as const, content: `${FX}/spotlight-sweep.mp4` },
  flythrough: { kind: "video" as const, content: `${FX}/club-flythrough.mp4` },
  club: { kind: "image" as const, content: `${FX}/club-night.jpg` },
  logo: { kind: "video" as const, content: `${FX}/logo-slam.mp4` },
  bananas: { kind: "image" as const, content: `${FX}/bananas-persona.jpg` },
  berries: { kind: "image" as const, content: `${FX}/berries-persona.jpg` },
  mic: { kind: "image" as const, content: `${FX}/mic.jpg` },
  thanks: { kind: "image" as const, content: `${FX}/outro-thanks.jpg` },
  sparks: { kind: "video" as const, content: `${FX}/banana-sparks.mp4` },
  smoke: { kind: "video" as const, content: `${FX}/berry-smoke.mp4` },
  confetti: { kind: "video" as const, content: `${FX}/confetti-loop.mp4` },
};

type Dress = "bananas" | "berries" | "award" | "venue" | "house" | "stage";

type VisualSpec = {
  title: string;
  durationSec: number;
  isOverlay?: boolean;
  center: Asset;
  dress: Dress;
};

const VISUAL_SCENES: VisualSpec[] = [
  { title: "House Loop", durationSec: 120, center: ASSETS.sweep, dress: "house" },
  {
    title: "Introduction",
    durationSec: 20,
    isOverlay: true,
    center: ASSETS.club,
    dress: "venue",
  },
  {
    title: "Game Instructions",
    durationSec: 30,
    isOverlay: true,
    center: ASSETS.club,
    dress: "venue",
  },
  { title: "Vote", durationSec: 20, isOverlay: true, center: ASSETS.club, dress: "venue" },
  { title: "Score", durationSec: 20, isOverlay: true, center: ASSETS.club, dress: "venue" },
  {
    title: "Score Rotation",
    durationSec: 15,
    isOverlay: true,
    center: ASSETS.club,
    dress: "venue",
  },
  {
    title: "Box Score",
    durationSec: 20,
    isOverlay: true,
    center: ASSETS.club,
    dress: "venue",
  },
  { title: "Games", durationSec: 20, isOverlay: true, center: ASSETS.logo, dress: "venue" },
  {
    title: "Suggestions",
    durationSec: 20,
    isOverlay: true,
    center: ASSETS.club,
    dress: "venue",
  },
  {
    title: "Punishment",
    durationSec: 20,
    isOverlay: true,
    center: ASSETS.club,
    dress: "venue",
  },
  {
    title: "Winner Banana Peels",
    durationSec: 15,
    isOverlay: true,
    center: ASSETS.bananas,
    dress: "bananas",
  },
  {
    title: "Winner Comedy Clubtrotters",
    durationSec: 15,
    isOverlay: true,
    center: ASSETS.berries,
    dress: "berries",
  },
  { title: "Banana Peels Arena", durationSec: 60, center: ASSETS.bananas, dress: "bananas" },
  { title: "Comedy Clubtrotters Arena", durationSec: 60, center: ASSETS.berries, dress: "berries" },
  { title: "Luxor Stage", durationSec: 60, center: ASSETS.flythrough, dress: "stage" },
  { title: "Award Ceremony", durationSec: 90, center: ASSETS.mic, dress: "award" },
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
  return `cl-luxor:scene:${String(n).padStart(2, "0")}`;
}

function effectKey(n: number, panel: string) {
  return `cl-luxor:effect:scene${String(n).padStart(2, "0")}:${panel}`;
}

function wings(dress: Dress): { left: Asset; right: Asset } {
  switch (dress) {
    case "bananas":
      return { left: ASSETS.sparks, right: ASSETS.sparks };
    case "berries":
      return { left: ASSETS.smoke, right: ASSETS.smoke };
    case "award":
      return { left: ASSETS.confetti, right: ASSETS.confetti };
    case "house":
      return { left: ASSETS.flythrough, right: ASSETS.flythrough };
    case "stage":
      return { left: ASSETS.club, right: ASSETS.club };
    default:
      return { left: ASSETS.sparks, right: ASSETS.smoke };
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

async function countEffectsForShow(ctx: MutationCtx | QueryCtx, showId: Id<"shows">) {
  const scenes = await ctx.db
    .query("scenes")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();
  let effectCount = 0;
  for (const scene of scenes) {
    const effects = await ctx.db
      .query("effects")
      .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
      .collect();
    effectCount += effects.length;
  }
  return { sceneCount: scenes.length, effectCount };
}

/**
 * Insert or reuse the Luxor Night 1 designed show. Re-runs patch in place
 * and never duplicate rows. Returns the showId.
 */
export async function seedComedyLocoLuxor(
  ctx: MutationCtx,
  ownerId: Id<"users">,
): Promise<Id<"shows">> {
  const result = await seedComedyLocoLuxorDetailed(ctx, ownerId);
  return result.showId;
}

export async function seedComedyLocoLuxorDetailed(
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
      .withIndex("by_tag", (q) => q.eq("tag", "comedyloco"))
      .collect();
    show = tagged.find((s) => s.title === SHOW_TITLE);
  }

  let showInserted = false;
  if (!show) {
    const showId = await ctx.db.insert("shows", {
      title: SHOW_TITLE,
      description: SHOW_DESCRIPTION,
      tag: "comedyloco",
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
      tag: "comedyloco",
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

  for (const title of MUSIC_SCENES) {
    n += 1;
    const scene = await upsertScene(ctx, show._id, existingScenes, {
      order: order++,
      n,
      title,
      kind: "text",
      content: title,
      durationSec: 180,
      isSoundEffect: true,
    });
    if (scene.inserted) scenesInserted++;
    else scenesSkipped++;
  }

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

  const counts = await countEffectsForShow(ctx, show._id);

  return {
    showId: show._id,
    layoutId: hyperx?.layoutId,
    showInserted,
    scenesInserted,
    scenesSkipped,
    effectsInserted,
    effectsSkipped,
    sceneCount: counts.sceneCount,
    effectCount: counts.effectCount,
  };
}

/**
 * Same insert shape as game.create (title, team1, team2, ownerId, tag, showId).
 * Inlined because a mutation cannot call another mutation. Expands the
 * comedyloco templateRounds into the two-team grid.
 */
async function ensureLuxorPerformance(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  showId: Id<"shows">,
) {
  const performances = await ctx.db.query("performances").collect();
  const existing = performances.find(
    (p) => p.title === PERFORMANCE_TITLE && p.tag === "comedyloco",
  );
  if (existing) {
    if (existing.showId !== showId) {
      await ctx.db.patch(existing._id, { showId });
    }
    return { performanceId: existing._id, inserted: false };
  }

  const loco = requireLoco("comedyloco");
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

export async function runComedyLocoLuxorSeed(ctx: MutationCtx) {
  const owner = await resolveOwner(ctx);
  console.log(
    `seedComedyLocoLuxor owner: ${owner.handle} (${owner.tier}) ${owner._id}`,
  );
  const show = await seedComedyLocoLuxorDetailed(ctx, owner._id);
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
    ownerId: owner._id,
    ownerHandle: owner.handle,
    ownerTier: owner.tier,
    layoutId: show.layoutId ?? null,
    sceneCount: show.sceneCount,
    effectCount: show.effectCount,
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
  handler: async (ctx) => runComedyLocoLuxorSeed(ctx),
});

export const seedComedyLocoLuxorRun = mutation({
  args: { ownerId: v.optional(v.id("users")) },
  handler: async (ctx, { ownerId }) => {
    const owner = ownerId
      ? await ctx.db.get(ownerId)
      : await resolveOwner(ctx);
    if (!owner) throw new Error("Owner user not found.");
    console.log(
      `seedComedyLocoLuxor owner: ${owner.handle} (${owner.tier}) ${owner._id}`,
    );
    const show = await seedComedyLocoLuxorDetailed(ctx, owner._id);
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
      effectCount: show.effectCount,
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
      .withIndex("by_tag", (q) => q.eq("tag", "comedyloco"))
      .collect();
    const show =
      shows.find((s) => s.sourceKey === SHOW_SOURCE_KEY) ??
      shows.find((s) => s.title === SHOW_TITLE);
    if (!show) {
      return { found: false as const, comedylocoShows: shows.map((s) => s.title) };
    }
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", show._id))
      .collect();
    scenes.sort((a, b) => a.order - b.order);
    const counts = await countEffectsForShow(ctx, show._id);
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
      sceneCount: counts.sceneCount,
      effectCount: counts.effectCount,
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
        team1: p.team1,
        team2: p.team2,
      })),
    };
  },
});

/**
 * Patch already-seeded Luxor Comedy Loco rows. The seeder upserts by
 * sourceKey and skips existing scenes/performances, so team renames never
 * land on live data unless this runs. Safe to run twice: second call is a
 * no-op (changes: 0).
 *
 *   pnpm --filter @linkall/backend exec convex run comedylocoLuxor:renameComedyTeams --env-file .env.funfirst
 */
const SCENE_RENAMES: Array<{ from: string; to: string }> = [
  { from: "Winner Bananas", to: "Winner Banana Peels" },
  { from: "Winner Berries", to: "Winner Comedy Clubtrotters" },
  { from: "Bananas Arena", to: "Banana Peels Arena" },
  { from: "Berries Arena", to: "Comedy Clubtrotters Arena" },
];

export const renameComedyTeams = mutation({
  args: {},
  handler: async (ctx) => {
    const loco = requireLoco("comedyloco");
    const byKey = await ctx.db
      .query("shows")
      .withIndex("by_sourceKey", (q) => q.eq("sourceKey", SHOW_SOURCE_KEY))
      .collect();
    const tagged = await ctx.db
      .query("shows")
      .withIndex("by_tag", (q) => q.eq("tag", "comedyloco"))
      .collect();
    const show =
      byKey[0] ??
      tagged.find((s) => s.sourceKey === SHOW_SOURCE_KEY) ??
      tagged.find((s) => s.title === SHOW_TITLE);

    if (!show) {
      return {
        found: false as const,
        changes: 0,
        show: null,
        scenes: [],
        performances: [],
      };
    }

    let changes = 0;
    const descriptionBefore = show.description ?? "";
    const descriptionChanged = descriptionBefore !== SHOW_DESCRIPTION;
    if (descriptionChanged) {
      await ctx.db.patch(show._id, { description: SHOW_DESCRIPTION });
      changes += 1;
    }

    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", show._id))
      .collect();

    const sceneResults: Array<{
      sourceKey?: string;
      before: string;
      after: string;
      changed: boolean;
    }> = [];

    for (const rename of SCENE_RENAMES) {
      const scene = scenes.find((s) => {
        if (s.sourceKey && !s.sourceKey.startsWith("cl-luxor:scene:")) return false;
        return s.title === rename.from || s.title === rename.to;
      });
      if (!scene) {
        sceneResults.push({
          before: rename.from,
          after: rename.to,
          changed: false,
        });
        continue;
      }
      const before = scene.title;
      const changed = before !== rename.to;
      if (changed) {
        await ctx.db.patch(scene._id, { title: rename.to });
        scene.title = rename.to;
        changes += 1;
      }
      sceneResults.push({
        sourceKey: scene.sourceKey,
        before,
        after: rename.to,
        changed,
      });
    }

    const performances = (await ctx.db.query("performances").collect()).filter(
      (p) => p.tag === "comedyloco" && p.title === PERFORMANCE_TITLE,
    );
    const performanceResults: Array<{
      _id: Id<"performances">;
      title: string;
      before: { team1: string; team2: string };
      after: { team1: string; team2: string };
      changed: boolean;
    }> = [];

    for (const p of performances) {
      const before = { team1: p.team1, team2: p.team2 };
      const after = { team1: loco.team1, team2: loco.team2 };
      const changed = before.team1 !== after.team1 || before.team2 !== after.team2;
      if (changed) {
        await ctx.db.patch(p._id, after);
        changes += 1;
      }
      performanceResults.push({
        _id: p._id,
        title: p.title,
        before,
        after,
        changed,
      });
    }

    return {
      found: true as const,
      changes,
      show: {
        _id: show._id,
        title: show.title,
        sourceKey: show.sourceKey,
        description: {
          before: descriptionBefore,
          after: SHOW_DESCRIPTION,
          changed: descriptionChanged,
        },
      },
      scenes: sceneResults,
      performances: performanceResults,
    };
  },
});
