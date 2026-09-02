import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireLoco } from "./locos";
import { overlayKindForTitle } from "./sceneCues";

/**
 * Idempotent Wedding Loco setlist shows + template performances.
 *
 *   pnpm --filter @linkall/backend exec convex run weddingShows:seed --env-file .env.surroundshow
 *   pnpm --filter @linkall/backend seed:weddingShows
 *
 * Setlist nights (no team scoring, no winner cues). Visuals use kind "panels"
 * + image/video effects — same wall pattern as barlocoHolidays (L / C / R).
 * Reuses existing /bar-loco/effects romantic assets. No catalog inserts.
 */

const FX = "/bar-loco/effects";

type MediaKind = "image" | "video";
type Asset = { kind: MediaKind; content: string };

function img(file: string): Asset {
  return { kind: "image", content: `${FX}/${file}` };
}
function vid(file: string): Asset {
  return { kind: "video", content: `${FX}/${file}` };
}

type WallSpec = {
  title: string;
  durationSec: number;
  isOverlay?: boolean;
  center: Asset;
  left: Asset;
  right: Asset;
};

type WeddingId = "cer" | "rec";

type WeddingSpec = {
  id: WeddingId;
  prefix: string;
  tag: "weddingceremony" | "weddingreception";
  showTitle: string;
  showDescription: string;
  performanceTitle: string;
  walls: WallSpec[];
  rounds: string[];
};

const CEREMONY: WeddingSpec = {
  id: "cer",
  prefix: "wed-cer",
  tag: "weddingceremony",
  showTitle: "Wedding Ceremony — Chapel",
  showDescription:
    "Immersive chapel — arrival, first look, theme, processional, vows, rings, pronouncement, recessional, chapel first dance, photos, send to reception.",
  performanceTitle: "Wedding Ceremony — Template",
  walls: [
    {
      title: "Arrival",
      durationSec: 60,
      center: img("val-venue.jpg"),
      left: vid("val-shimmer.mp4"),
      right: vid("val-shimmer.mp4"),
    },
    {
      title: "First Look",
      durationSec: 90,
      center: img("val-photo.jpg"),
      left: vid("val-petals.mp4"),
      right: vid("val-petals.mp4"),
    },
    {
      title: "Theme Moment",
      durationSec: 60,
      center: img("val-venue.jpg"),
      left: vid("val-shimmer.mp4"),
      right: vid("val-shimmer.mp4"),
    },
    {
      title: "Processional",
      durationSec: 180,
      center: vid("val-flythrough.mp4"),
      left: vid("val-petals.mp4"),
      right: vid("val-petals.mp4"),
    },
    {
      title: "Vows",
      durationSec: 180,
      center: img("val-venue.jpg"),
      left: vid("val-shimmer.mp4"),
      right: vid("val-shimmer.mp4"),
    },
    {
      title: "Readings",
      durationSec: 120,
      center: img("val-venue.jpg"),
      left: vid("val-shimmer.mp4"),
      right: vid("val-shimmer.mp4"),
    },
    {
      title: "Ring Exchange",
      durationSec: 90,
      center: img("val-venue.jpg"),
      left: vid("val-shimmer.mp4"),
      right: vid("val-shimmer.mp4"),
    },
    {
      title: "Pronouncement",
      durationSec: 60,
      center: vid("val-confetti.mp4"),
      left: vid("val-petals.mp4"),
      right: vid("val-petals.mp4"),
    },
    {
      title: "Recessional",
      durationSec: 120,
      center: vid("val-flythrough.mp4"),
      left: vid("val-confetti.mp4"),
      right: vid("val-confetti.mp4"),
    },
    {
      title: "Chapel First Dance",
      durationSec: 180,
      center: vid("val-shimmer.mp4"),
      left: vid("val-petals.mp4"),
      right: vid("val-petals.mp4"),
    },
    {
      title: "Flower Wall Photos",
      durationSec: 90,
      center: img("val-photo.jpg"),
      left: vid("val-flythrough.mp4"),
      right: vid("val-flythrough.mp4"),
    },
    {
      title: "Send to Reception",
      durationSec: 60,
      center: img("val-venue.jpg"),
      left: vid("val-confetti.mp4"),
      right: vid("val-confetti.mp4"),
    },
    {
      title: "Theme",
      durationSec: 20,
      isOverlay: true,
      center: img("val-venue.jpg"),
      left: vid("val-shimmer.mp4"),
      right: vid("val-shimmer.mp4"),
    },
    {
      title: "Aisle",
      durationSec: 20,
      isOverlay: true,
      center: vid("val-flythrough.mp4"),
      left: vid("val-petals.mp4"),
      right: vid("val-petals.mp4"),
    },
    {
      title: "Photo",
      durationSec: 20,
      isOverlay: true,
      center: img("val-photo.jpg"),
      left: vid("val-flythrough.mp4"),
      right: vid("val-flythrough.mp4"),
    },
    {
      title: "Timeline",
      durationSec: 20,
      isOverlay: true,
      center: img("val-venue.jpg"),
      left: vid("val-shimmer.mp4"),
      right: vid("val-shimmer.mp4"),
    },
  ],
  rounds: [
    "Arrival",
    "First Look",
    "Theme Moment",
    "Processional",
    "Vows",
    "Readings",
    "Ring Exchange",
    "Pronouncement",
    "Recessional",
    "Chapel First Dance",
    "Flower Wall Photos",
    "Send to Reception",
  ],
};

const RECEPTION: WeddingSpec = {
  id: "rec",
  prefix: "wed-rec",
  tag: "weddingreception",
  showTitle: "Wedding Reception — DJ",
  showDescription:
    "DJ reception — cocktail mix, entrance, first dance, dinner mix, toasts, parent dances, open floor, games, cake, late mix, last dance, send-off.",
  performanceTitle: "Wedding Reception — Template",
  walls: [
    {
      title: "Cocktail Hour",
      durationSec: 180,
      center: vid("val-flythrough.mp4"),
      left: vid("val-shimmer.mp4"),
      right: vid("val-shimmer.mp4"),
    },
    {
      title: "Grand Entrance",
      durationSec: 60,
      center: vid("val-confetti.mp4"),
      left: vid("val-petals.mp4"),
      right: vid("val-petals.mp4"),
    },
    {
      title: "First Dance",
      durationSec: 180,
      center: vid("val-shimmer.mp4"),
      left: vid("val-flythrough.mp4"),
      right: vid("val-flythrough.mp4"),
    },
    {
      title: "Dinner Mix",
      durationSec: 180,
      center: img("val-venue.jpg"),
      left: vid("val-shimmer.mp4"),
      right: vid("val-shimmer.mp4"),
    },
    {
      title: "Toasts",
      durationSec: 180,
      center: img("val-venue.jpg"),
      left: vid("val-shimmer.mp4"),
      right: vid("val-shimmer.mp4"),
    },
    {
      title: "Parent Dances",
      durationSec: 180,
      center: vid("val-shimmer.mp4"),
      left: vid("val-petals.mp4"),
      right: vid("val-petals.mp4"),
    },
    {
      title: "Dance Floor Open",
      durationSec: 180,
      center: vid("val-flythrough.mp4"),
      left: vid("val-confetti.mp4"),
      right: vid("val-confetti.mp4"),
    },
    {
      title: "Shoe Game",
      durationSec: 120,
      center: img("val-photo.jpg"),
      left: vid("val-confetti.mp4"),
      right: vid("val-confetti.mp4"),
    },
    {
      title: "Peak Mix",
      durationSec: 180,
      center: vid("val-flythrough.mp4"),
      left: vid("val-confetti.mp4"),
      right: vid("val-confetti.mp4"),
    },
    {
      title: "Cake Cutting",
      durationSec: 90,
      center: img("val-venue.jpg"),
      left: vid("val-petals.mp4"),
      right: vid("val-petals.mp4"),
    },
    {
      title: "Bouquet and Garter",
      durationSec: 120,
      center: img("val-prize.jpg"),
      left: vid("val-confetti.mp4"),
      right: vid("val-confetti.mp4"),
    },
    {
      title: "Late Mix",
      durationSec: 180,
      center: vid("val-flythrough.mp4"),
      left: vid("val-confetti.mp4"),
      right: vid("val-confetti.mp4"),
    },
    {
      title: "Last Dance",
      durationSec: 180,
      center: vid("val-shimmer.mp4"),
      left: vid("val-petals.mp4"),
      right: vid("val-petals.mp4"),
    },
    {
      title: "Sparkler Send-off",
      durationSec: 90,
      center: img("val-photo.jpg"),
      left: vid("val-confetti.mp4"),
      right: vid("val-confetti.mp4"),
    },
    {
      title: "Timeline",
      durationSec: 20,
      isOverlay: true,
      center: img("val-venue.jpg"),
      left: vid("val-shimmer.mp4"),
      right: vid("val-shimmer.mp4"),
    },
    {
      title: "Dedication",
      durationSec: 20,
      isOverlay: true,
      center: img("val-photo.jpg"),
      left: vid("val-petals.mp4"),
      right: vid("val-petals.mp4"),
    },
    {
      title: "Guest Wall",
      durationSec: 20,
      isOverlay: true,
      center: img("val-photo.jpg"),
      left: vid("val-flythrough.mp4"),
      right: vid("val-flythrough.mp4"),
    },
    {
      title: "Games",
      durationSec: 20,
      isOverlay: true,
      center: img("val-prize.jpg"),
      left: vid("val-confetti.mp4"),
      right: vid("val-confetti.mp4"),
    },
    {
      title: "Vote",
      durationSec: 20,
      isOverlay: true,
      center: img("val-photo.jpg"),
      left: vid("val-petals.mp4"),
      right: vid("val-petals.mp4"),
    },
    {
      title: "Score Rotation",
      durationSec: 15,
      isOverlay: true,
      center: img("val-prize.jpg"),
      left: vid("val-confetti.mp4"),
      right: vid("val-confetti.mp4"),
    },
  ],
  rounds: [
    "Cocktail Hour",
    "Grand Entrance",
    "First Dance",
    "Dinner Mix",
    "Toasts",
    "Parent Dances",
    "Dance Floor Open",
    "Shoe Game",
    "Peak Mix",
    "Cake Cutting",
    "Bouquet and Garter",
    "Late Mix",
    "Last Dance",
    "Sparkler Send-off",
  ],
};

const WEDDINGS: WeddingSpec[] = [CEREMONY, RECEPTION];

function showKey(prefix: string) {
  return `${prefix}:show`;
}
function sceneKey(prefix: string, n: number) {
  return `${prefix}:scene:${String(n).padStart(2, "0")}`;
}
function effectKey(prefix: string, n: number, panel: string) {
  return `${prefix}:effect:scene${String(n).padStart(2, "0")}:${panel}`;
}

/** HyperX 3-wall first; Home Front garage columns (christmasMike) as fallback. */
async function wallsFor(ctx: MutationCtx): Promise<{
  layoutId: Id<"layouts">;
  layoutName: string;
  panelByLogical: Record<string, Id<"panels">>;
} | null> {
  const layouts = await ctx.db.query("layouts").collect();

  const hyperx = layouts.find((l) => l.name === "HyperX Arena");
  if (hyperx) {
    const screens = await ctx.db
      .query("screens")
      .withIndex("by_layout", (q) => q.eq("layoutId", hyperx._id))
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
    if (left && center && right && lp && cp && rp) {
      return {
        layoutId: hyperx._id,
        layoutName: hyperx.name,
        panelByLogical: {
          LeftSidebar: lp,
          MainContent: cp,
          RightSidebar: rp,
        },
      };
    }
  }

  const home = layouts.find((l) => l.name === "Home Front");
  if (!home) return null;
  const screens = await ctx.db
    .query("screens")
    .withIndex("by_layout", (q) => q.eq("layoutId", home._id))
    .collect();
  const garage = screens.find((s) => s.name === "Garage") ?? screens[0];
  if (!garage) return null;
  const panels = await ctx.db
    .query("panels")
    .withIndex("by_screen", (q) => q.eq("screenId", garage._id))
    .collect();
  const byPanel = (name: string) => panels.find((p) => p.name === name);
  const lp = byPanel("Column Left");
  const cp = byPanel("Garage Door");
  const rp = byPanel("Column Right");
  if (!lp || !cp || !rp) return null;
  return {
    layoutId: home._id,
    layoutName: home.name,
    panelByLogical: {
      LeftSidebar: lp._id,
      MainContent: cp._id,
      RightSidebar: rp._id,
    },
  };
}

async function ensureDisplayProfile(
  ctx: MutationCtx,
  showId: Id<"shows">,
  ownerId: Id<"users">,
  walls: {
    layoutId: Id<"layouts">;
    layoutName: string;
    panelByLogical: Record<string, Id<"panels">>;
  },
) {
  const profiles = await ctx.db
    .query("displayProfiles")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();
  let profile = profiles.find((p) => p.isDefault) ?? profiles[0];
  if (!profile) {
    const profileId = await ctx.db.insert("displayProfiles", {
      name: walls.layoutName,
      description: `Wedding Loco walls on ${walls.layoutName}.`,
      showId,
      layoutId: walls.layoutId,
      isDefault: true,
      ownerId,
    });
    profile = (await ctx.db.get(profileId))!;
  } else if (profile.layoutId !== walls.layoutId) {
    await ctx.db.patch(profile._id, { layoutId: walls.layoutId });
  }
  const mappings = await ctx.db
    .query("panelMappings")
    .withIndex("by_profile", (q) => q.eq("displayProfileId", profile._id))
    .collect();
  const have = new Set(mappings.map((m) => m.logicalPanelName));
  for (const [logical, panelId] of Object.entries(walls.panelByLogical)) {
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
  prefix: string,
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
  const sourceKey = sceneKey(prefix, spec.n);
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
  prefix: string,
  n: number,
  logical: string,
  asset: Asset,
  panelId: Id<"panels"> | undefined,
): Promise<boolean> {
  const sourceKey = effectKey(prefix, n, logical);
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
    throw new Error(
      "No users in SurroundShow deployment — run seed:surroundshow first.",
    );
  }
  return owner;
}

async function findShow(
  ctx: MutationCtx,
  spec: WeddingSpec,
): Promise<Doc<"shows"> | undefined> {
  const byKey = await ctx.db
    .query("shows")
    .withIndex("by_sourceKey", (q) => q.eq("sourceKey", showKey(spec.prefix)))
    .collect();
  if (byKey[0]) return byKey[0];

  const tagged = await ctx.db
    .query("shows")
    .withIndex("by_tag", (q) => q.eq("tag", spec.tag))
    .collect();
  return tagged.find((s) => s.title === spec.showTitle);
}

async function seedWeddingShow(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  spec: WeddingSpec,
  walls: Awaited<ReturnType<typeof wallsFor>>,
) {
  const existingShow = await findShow(ctx, spec);

  let show = existingShow;
  let showInserted = false;
  const sourceKey = showKey(spec.prefix);
  if (!show) {
    const showId = await ctx.db.insert("shows", {
      title: spec.showTitle,
      description: spec.showDescription,
      tag: spec.tag,
      status: "draft",
      currentSceneIndex: 0,
      ownerId,
      sourceKey,
      ...(walls ? { layoutId: walls.layoutId } : {}),
    });
    show = (await ctx.db.get(showId))!;
    showInserted = true;
  } else {
    await ctx.db.patch(show._id, {
      title: spec.showTitle,
      description: spec.showDescription,
      tag: spec.tag,
      status: show.status === "ended" ? "draft" : show.status,
      ownerId,
      sourceKey,
      ...(walls ? { layoutId: walls.layoutId } : {}),
    });
  }

  if (walls) {
    await ensureDisplayProfile(ctx, show._id, ownerId, walls);
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

  for (const wall of spec.walls) {
    n += 1;
    const overlay =
      wall.isOverlay === true || overlayKindForTitle(wall.title) != null;
    const scene = await upsertScene(ctx, show._id, existingScenes, spec.prefix, {
      order: order++,
      n,
      title: wall.title,
      kind: "panels",
      content: wall.center.content,
      durationSec: wall.durationSec,
      isOverlay: overlay || wall.isOverlay,
    });
    if (scene.inserted) scenesInserted++;
    else scenesSkipped++;

    const trio: Array<["LeftSidebar" | "MainContent" | "RightSidebar", Asset]> =
      [
        ["LeftSidebar", wall.left],
        ["MainContent", wall.center],
        ["RightSidebar", wall.right],
      ];
    for (const [logical, asset] of trio) {
      const inserted = await upsertEffect(
        ctx,
        scene.id,
        spec.prefix,
        n,
        logical,
        asset,
        walls?.panelByLogical[logical],
      );
      if (inserted) effectsInserted++;
      else effectsSkipped++;
    }
  }

  const loco = requireLoco(spec.tag);
  for (const title of loco.tracks) {
    n += 1;
    const scene = await upsertScene(ctx, show._id, existingScenes, spec.prefix, {
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

  const sceneCount = (
    await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", show._id))
      .collect()
  ).length;

  const wallCount = spec.walls.filter((w) => !w.isOverlay).length;
  const overlayCount = spec.walls.filter((w) => w.isOverlay).length;

  return {
    showId: show._id,
    showTitle: spec.showTitle,
    sourceKey,
    tag: spec.tag,
    showInserted,
    scenesInserted,
    scenesSkipped,
    effectsInserted,
    effectsSkipped,
    sceneCount,
    wallCount,
    overlayCount,
    trackCount: loco.tracks.length,
  };
}

async function findPerformance(
  ctx: MutationCtx,
  spec: WeddingSpec,
): Promise<Doc<"performances"> | undefined> {
  const performances = await ctx.db.query("performances").collect();
  return performances.find(
    (p) => p.tag === spec.tag && p.title === spec.performanceTitle,
  );
}

async function ensurePerformance(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  showId: Id<"shows">,
  spec: WeddingSpec,
) {
  const existing = await findPerformance(ctx, spec);
  if (existing) {
    if (existing.showId !== showId) {
      await ctx.db.patch(existing._id, { showId });
    }
    return {
      performanceId: existing._id,
      title: existing.title,
      tag: spec.tag,
      inserted: false,
    };
  }

  const loco = requireLoco(spec.tag);
  const performanceId = await ctx.db.insert("performances", {
    title: spec.performanceTitle,
    team1: loco.team1,
    team2: loco.team2,
    status: "draft",
    ownerId,
    tag: loco.tag,
    showId,
  });

  const catalog = await ctx.db
    .query("comedyGames")
    .withIndex("by_tag", (q) => q.eq("tag", spec.tag))
    .collect();
  const catalogByName = new Map(catalog.map((g) => [g.name, g._id]));

  let order = 0;
  for (const round of loco.templateRounds) {
    const gameName = spec.rounds[round.round - 1] ?? "";
    await ctx.db.insert("performanceGames", {
      performanceId,
      order: order++,
      round: round.round,
      roundType: round.roundType,
      teamIndex: 1,
      gameName,
      gameId: gameName ? catalogByName.get(gameName) : undefined,
      votes: 0,
      score: 0,
      isPlaying: false,
      isPlayed: false,
      isVoting: false,
      isWinner: false,
      rotation: false,
      isCued: false,
      volunteers: 0,
      isScored: false,
    });
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

  return {
    performanceId,
    title: spec.performanceTitle,
    tag: spec.tag,
    inserted: true,
  };
}

export async function seedWeddingShows(
  ctx: MutationCtx,
  ownerId: Id<"users">,
) {
  return seedWeddingShowsDetailed(ctx, ownerId);
}

export async function seedWeddingShowsDetailed(
  ctx: MutationCtx,
  ownerId: Id<"users">,
) {
  const walls = await wallsFor(ctx);
  const shows = [];
  const performances = [];

  let scenesInserted = 0;
  let scenesSkipped = 0;
  let effectsInserted = 0;
  let effectsSkipped = 0;
  let showsInserted = 0;
  let showsSkipped = 0;
  let performancesInserted = 0;
  let performancesSkipped = 0;

  for (const spec of WEDDINGS) {
    const show = await seedWeddingShow(ctx, ownerId, spec, walls);
    shows.push(show);
    scenesInserted += show.scenesInserted;
    scenesSkipped += show.scenesSkipped;
    effectsInserted += show.effectsInserted;
    effectsSkipped += show.effectsSkipped;
    if (show.showInserted) showsInserted++;
    else showsSkipped++;

    const performance = await ensurePerformance(
      ctx,
      ownerId,
      show.showId,
      spec,
    );
    performances.push({
      ...performance,
      showTitle: show.showTitle,
    });
    if (performance.inserted) performancesInserted++;
    else performancesSkipped++;
  }

  return {
    layoutName: walls?.layoutName ?? null,
    layoutId: walls?.layoutId ?? null,
    shows,
    performances,
    inserted: {
      catalog: 0,
      shows: showsInserted,
      scenes: scenesInserted,
      effects: effectsInserted,
      performances: performancesInserted,
    },
    skipped: {
      catalog: 0,
      shows: showsSkipped,
      scenes: scenesSkipped,
      effects: effectsSkipped,
      performances: performancesSkipped,
    },
  };
}

export async function runWeddingShowsSeed(ctx: MutationCtx) {
  const owner = await resolveOwner(ctx);
  console.log(
    `seedWeddingShows owner: ${owner.handle} (${owner.tier}) ${owner._id}`,
  );
  const result = await seedWeddingShowsDetailed(ctx, owner._id);
  return {
    ownerId: owner._id,
    ownerHandle: owner.handle,
    ownerName: owner.name,
    ownerTier: owner.tier,
    ...result,
  };
}

export const seed = mutation({
  args: {},
  handler: async (ctx) => runWeddingShowsSeed(ctx),
});

export const seedWeddingShowsRun = mutation({
  args: { ownerId: v.optional(v.id("users")) },
  handler: async (ctx, { ownerId }) => {
    const owner = ownerId
      ? await ctx.db.get(ownerId)
      : await resolveOwner(ctx);
    if (!owner) throw new Error("Owner user not found.");
    console.log(
      `seedWeddingShows owner: ${owner.handle} (${owner.tier}) ${owner._id}`,
    );
    const result = await seedWeddingShowsDetailed(ctx, owner._id);
    return {
      ownerId: owner._id,
      ownerHandle: owner.handle,
      ownerName: owner.name,
      ownerTier: owner.tier,
      ...result,
    };
  },
});

export const inspect = query({
  args: {},
  handler: async (ctx) => {
    const owner = await resolveOwner(ctx);
    const performances = (await ctx.db.query("performances").collect()).filter(
      (p) => p.tag === "weddingceremony" || p.tag === "weddingreception",
    );

    const shows = [];
    for (const spec of WEDDINGS) {
      const tagged = await ctx.db
        .query("shows")
        .withIndex("by_tag", (q) => q.eq("tag", spec.tag))
        .collect();
      const show =
        tagged.find((s) => s.sourceKey === showKey(spec.prefix)) ??
        tagged.find((s) => s.title === spec.showTitle);
      if (!show) {
        shows.push({
          prefix: spec.prefix,
          found: false as const,
          expectedTitle: spec.showTitle,
        });
        continue;
      }
      const scenes = await ctx.db
        .query("scenes")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      scenes.sort((a, b) => a.order - b.order);
      shows.push({
        prefix: spec.prefix,
        found: true as const,
        showId: show._id,
        showTitle: show.title,
        sourceKey: show.sourceKey,
        tag: show.tag,
        layoutId: show.layoutId,
        sceneCount: scenes.length,
        scenes: scenes.map((s) => ({
          order: s.order,
          title: s.title,
          kind: s.kind,
          isOverlay: s.isOverlay ?? false,
          isSoundEffect: s.isSoundEffect ?? false,
          sourceKey: s.sourceKey,
        })),
      });
    }

    return {
      owner: {
        id: owner._id,
        handle: owner.handle,
        name: owner.name,
        tier: owner.tier,
      },
      shows,
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
