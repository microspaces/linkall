import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireLoco } from "./locos";
import { overlayKindForTitle } from "./sceneCues";

/**
 * Idempotent Bar Loco holiday shows + month-long performances.
 *
 *   pnpm --filter @linkall/backend exec convex run barlocoHolidays:seed --env-file .env.surroundshow
 *   pnpm --filter @linkall/backend seed:barlocoHolidays
 *
 * Setlist nights (no team scoring). Visuals use kind "panels" + image/video
 * effects — same wall pattern as christmasMikeData / boom videos (L / C / R).
 * Performances have no scheduled-date field; windows live in the title.
 */

const TAG = "barloco";
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

type HolidayId = "hal" | "xmas" | "val";

type HolidaySpec = {
  id: HolidayId;
  prefix: string;
  showTitle: string;
  showDescription: string;
  performanceTitle: string;
  performanceWindow: string;
  /** Reuse an existing Jingle Bar show instead of rebuilding scenes. */
  keepExistingShow?: boolean;
  walls: WallSpec[];
  rounds: string[];
};

function holidayWalls(a: {
  hero: Asset;
  venue: Asset;
  prize: Asset;
  photo: Asset;
  outro: Asset;
  menu: Asset;
  spotlight: Asset;
  flythrough: Asset;
  confetti: Asset;
  titles: {
    doors: string;
    break1: string;
    set1: string;
    crowd1: string;
    game1: string;
    crowd2: string;
    set2: string;
    game2: string;
    crowd3: string;
    crowd4: string;
    break2: string;
    outro: string;
  };
}): WallSpec[] {
  const t = a.titles;
  return [
    {
      title: "House Loop",
      durationSec: 120,
      center: a.spotlight,
      left: a.flythrough,
      right: a.flythrough,
    },
    {
      title: t.doors,
      durationSec: 60,
      center: a.hero,
      left: a.venue,
      right: a.venue,
    },
    {
      title: t.break1,
      durationSec: 45,
      center: a.menu,
      left: a.spotlight,
      right: a.spotlight,
    },
    {
      title: t.set1,
      durationSec: 180,
      center: a.venue,
      left: a.menu,
      right: a.menu,
    },
    {
      title: t.crowd1,
      durationSec: 90,
      center: a.photo,
      left: a.hero,
      right: a.hero,
    },
    {
      title: t.game1,
      durationSec: 120,
      center: a.menu,
      left: a.venue,
      right: a.venue,
    },
    {
      title: t.crowd2,
      durationSec: 90,
      center: a.photo,
      left: a.hero,
      right: a.hero,
    },
    {
      title: t.set2,
      durationSec: 180,
      center: a.venue,
      left: a.menu,
      right: a.menu,
    },
    {
      title: t.game2,
      durationSec: 120,
      center: a.menu,
      left: a.venue,
      right: a.venue,
    },
    {
      title: t.crowd3,
      durationSec: 90,
      center: a.photo,
      left: a.hero,
      right: a.hero,
    },
    {
      title: t.crowd4,
      durationSec: 90,
      center: a.photo,
      left: a.hero,
      right: a.hero,
    },
    {
      title: "Prize Time",
      durationSec: 60,
      center: a.prize,
      left: a.confetti,
      right: a.confetti,
    },
    {
      title: t.break2,
      durationSec: 45,
      center: a.menu,
      left: a.spotlight,
      right: a.spotlight,
    },
    {
      title: t.outro,
      durationSec: 90,
      center: a.outro,
      left: a.confetti,
      right: a.confetti,
    },
    {
      title: "Game Instructions",
      durationSec: 30,
      isOverlay: true,
      center: a.menu,
      left: a.venue,
      right: a.venue,
    },
    {
      title: "Vote",
      durationSec: 20,
      isOverlay: true,
      center: a.photo,
      left: a.hero,
      right: a.hero,
    },
    {
      title: "Crowd",
      durationSec: 20,
      isOverlay: true,
      center: a.photo,
      left: a.hero,
      right: a.hero,
    },
    {
      title: "Photo",
      durationSec: 20,
      isOverlay: true,
      center: a.photo,
      left: a.hero,
      right: a.hero,
    },
    {
      title: "Carols",
      durationSec: 20,
      isOverlay: true,
      center: a.hero,
      left: a.venue,
      right: a.venue,
    },
    {
      title: "Timeline",
      durationSec: 20,
      isOverlay: true,
      center: a.menu,
      left: a.venue,
      right: a.venue,
    },
    {
      title: "Games",
      durationSec: 20,
      isOverlay: true,
      center: a.menu,
      left: a.venue,
      right: a.venue,
    },
    {
      title: "Score Rotation",
      durationSec: 15,
      isOverlay: true,
      center: a.prize,
      left: a.confetti,
      right: a.confetti,
    },
  ];
}

const HALLOWEEN: HolidaySpec = {
  id: "hal",
  prefix: "bar-hal",
  showTitle: "Haunted Bar Loco",
  showDescription:
    "Bar Loco Halloween night — doors, haunt soundtrack, costume contest, prizes, last call.",
  performanceTitle: "Haunted Bar Loco — October 2026 (Oct 1–31)",
  performanceWindow: "2026-10-01/2026-10-31",
  walls: holidayWalls({
    hero: img("hal-hero.jpg"),
    venue: img("hal-venue.jpg"),
    prize: img("hal-prize.jpg"),
    photo: img("hal-photo.jpg"),
    outro: img("hal-outro.jpg"),
    menu: img("hal-menu.jpg"),
    spotlight: vid("hal-spotlight.mp4"),
    flythrough: vid("hal-flythrough.mp4"),
    confetti: vid("hal-confetti.mp4"),
    titles: {
      doors: "Doors Open",
      break1: "Welcome Pour",
      set1: "Haunt Set",
      crowd1: "Costume Parade",
      game1: "Trick or Treat",
      crowd2: "Photo Op",
      set2: "Monster Mix",
      game2: "Witch Hunt",
      crowd3: "Costume Contest",
      crowd4: "Midnight Hour",
      break2: "Last Call",
      outro: "Closing Time",
    },
  }),
  rounds: [
    "Doors Open",
    "Welcome Pour",
    "Party Hits",
    "Costume Contest",
    "",
    "Miracle Makers",
    "Party Hits",
    "",
    "Prize Time",
    "Best Dressed",
    "Last Call",
    "Closing Time",
  ],
};

const CHRISTMAS: HolidaySpec = {
  id: "xmas",
  prefix: "bar-xmas",
  showTitle: "Jingle Bar",
  showDescription:
    "The Jingle Bar — doors, welcome pour, classics, hosts, games, Bad Elf, best dressed, carols, last call.",
  performanceTitle: "Jingle Bar — Nov 25–Dec 25, 2026",
  performanceWindow: "2026-11-25/2026-12-25",
  keepExistingShow: true,
  walls: holidayWalls({
    hero: img("xmas-hero.jpg"),
    venue: img("xmas-venue.jpg"),
    prize: img("xmas-prize.jpg"),
    photo: img("xmas-photo.jpg"),
    outro: img("xmas-outro.jpg"),
    menu: img("xmas-menu.jpg"),
    spotlight: vid("xmas-snow.mp4"),
    flythrough: vid("xmas-flythrough.mp4"),
    confetti: vid("xmas-confetti.mp4"),
    titles: {
      doors: "Doors Open",
      break1: "Welcome Pour",
      set1: "Christmas Classics",
      crowd1: "Miracle Makers",
      game1: "Elf Bingo",
      crowd2: "Bad Elf",
      set2: "Party Hits",
      game2: "Reindeer Ring Toss",
      crowd3: "Best Dressed",
      crowd4: "Cocktails & Carols",
      break2: "Last Call",
      outro: "Closing Time",
    },
  }),
  rounds: [
    "Doors Open",
    "Welcome Pour",
    "Christmas Classics",
    "Miracle Makers",
    "Elf Bingo",
    "Bad Elf",
    "Party Hits",
    "Reindeer Ring Toss",
    "Best Dressed",
    "Cocktails & Carols",
    "Last Call",
    "Closing Time",
  ],
};

const VALENTINES: HolidaySpec = {
  id: "val",
  prefix: "bar-val",
  showTitle: "The Big L♥ve Show",
  showDescription:
    "Bar Loco Valentine's night — doors, love songs, couples quiz, prizes, last call.",
  performanceTitle: "The Big L♥ve Show — Jan 14–Feb 14, 2027",
  performanceWindow: "2027-01-14/2027-02-14",
  walls: holidayWalls({
    hero: img("val-hero.jpg"),
    venue: img("val-venue.jpg"),
    prize: img("val-prize.jpg"),
    photo: img("val-photo.jpg"),
    outro: img("val-outro.jpg"),
    menu: img("val-menu.jpg"),
    spotlight: vid("val-shimmer.mp4"),
    flythrough: vid("val-flythrough.mp4"),
    confetti: vid("val-confetti.mp4"),
    titles: {
      doors: "Doors Open",
      break1: "Welcome Pour",
      set1: "Love Songs",
      crowd1: "Couples Mixer",
      game1: "Heart Toss",
      crowd2: "Photo Op",
      set2: "Slow Dance",
      game2: "Cupid's Arrow",
      crowd3: "Couples Quiz",
      crowd4: "Kiss Cam",
      break2: "Last Call",
      outro: "Closing Time",
    },
  }),
  rounds: [
    "Doors Open",
    "Welcome Pour",
    "Party Hits",
    "Couples Quiz",
    "",
    "Miracle Makers",
    "Party Hits",
    "",
    "Prize Time",
    "Karaoke",
    "Last Call",
    "Closing Time",
  ],
};

const HOLIDAYS: HolidaySpec[] = [HALLOWEEN, CHRISTMAS, VALENTINES];

function showKey(prefix: string) {
  return `${prefix}:show`;
}
function sceneKey(prefix: string, n: number) {
  return `${prefix}:scene:${String(n).padStart(2, "0")}`;
}
function effectKey(prefix: string, n: number, panel: string) {
  return `${prefix}:effect:scene${String(n).padStart(2, "0")}:${panel}`;
}

function isJingleBarTitle(title: string) {
  const t = title.toLowerCase();
  return t.includes("jingle bar") || t.includes("jingle-bar");
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
      description: `Bar Loco walls on ${walls.layoutName}.`,
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
  spec: HolidaySpec,
): Promise<Doc<"shows"> | undefined> {
  const byKey = await ctx.db
    .query("shows")
    .withIndex("by_sourceKey", (q) => q.eq("sourceKey", showKey(spec.prefix)))
    .collect();
  if (byKey[0]) return byKey[0];

  const tagged = await ctx.db
    .query("shows")
    .withIndex("by_tag", (q) => q.eq("tag", TAG))
    .collect();
  const exact = tagged.find((s) => s.title === spec.showTitle);
  if (exact) return exact;

  if (spec.keepExistingShow) {
    return tagged.find((s) => isJingleBarTitle(s.title));
  }
  return undefined;
}

async function ensureCatalog(ctx: MutationCtx) {
  const loco = requireLoco(TAG);
  const existing = await ctx.db
    .query("comedyGames")
    .withIndex("by_tag", (q) => q.eq("tag", TAG))
    .collect();
  const haveNames = new Set(existing.map((e) => e.name));
  let inserted = 0;
  let skipped = 0;
  for (const g of loco.catalog) {
    if (haveNames.has(g.name)) {
      skipped++;
      continue;
    }
    await ctx.db.insert("comedyGames", { ...g, tag: loco.tag });
    haveNames.add(g.name);
    inserted++;
  }
  return { inserted, skipped, total: loco.catalog.length };
}

async function seedHolidayShow(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  spec: HolidaySpec,
  walls: Awaited<ReturnType<typeof wallsFor>>,
) {
  const existingShow = await findShow(ctx, spec);
  const keepAsIs =
    !!spec.keepExistingShow &&
    !!existingShow &&
    existingShow.sourceKey !== showKey(spec.prefix);

  if (keepAsIs && existingShow) {
    const sceneCount = (
      await ctx.db
        .query("scenes")
        .withIndex("by_show", (q) => q.eq("showId", existingShow._id))
        .collect()
    ).length;
    return {
      showId: existingShow._id,
      showTitle: existingShow.title,
      sourceKey: existingShow.sourceKey,
      keptExisting: true,
      showInserted: false,
      scenesInserted: 0,
      scenesSkipped: sceneCount,
      effectsInserted: 0,
      effectsSkipped: 0,
      sceneCount,
    };
  }

  let show = existingShow;
  let showInserted = false;
  const sourceKey = showKey(spec.prefix);
  if (!show) {
    const showId = await ctx.db.insert("shows", {
      title: spec.showTitle,
      description: spec.showDescription,
      tag: TAG,
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
      tag: TAG,
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

  const loco = requireLoco(TAG);
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

  return {
    showId: show._id,
    showTitle: spec.showTitle,
    sourceKey,
    keptExisting: false,
    showInserted,
    scenesInserted,
    scenesSkipped,
    effectsInserted,
    effectsSkipped,
    sceneCount,
  };
}

async function findPerformance(
  ctx: MutationCtx,
  spec: HolidaySpec,
): Promise<Doc<"performances"> | undefined> {
  const performances = await ctx.db.query("performances").collect();
  const tagged = performances.filter((p) => p.tag === TAG);
  const exact = tagged.find((p) => p.title === spec.performanceTitle);
  if (exact) return exact;
  if (spec.keepExistingShow) {
    return tagged.find((p) => isJingleBarTitle(p.title));
  }
  return undefined;
}

async function ensurePerformance(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  showId: Id<"shows">,
  spec: HolidaySpec,
) {
  const existing = await findPerformance(ctx, spec);
  if (existing) {
    const patch: { showId: Id<"shows">; title?: string } = { showId };
    if (
      existing.title !== spec.performanceTitle &&
      !isJingleBarTitle(existing.title)
    ) {
      patch.title = spec.performanceTitle;
    }
    if (existing.showId !== showId || patch.title) {
      await ctx.db.patch(existing._id, patch);
    }
    return {
      performanceId: existing._id,
      title: existing.title,
      inserted: false,
      skippedEquivalent: existing.title !== spec.performanceTitle,
    };
  }

  const loco = requireLoco(TAG);
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
    .withIndex("by_tag", (q) => q.eq("tag", TAG))
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
    inserted: true,
    skippedEquivalent: false,
  };
}

export async function seedBarlocoHolidays(
  ctx: MutationCtx,
  ownerId: Id<"users">,
) {
  return seedBarlocoHolidaysDetailed(ctx, ownerId);
}

export async function seedBarlocoHolidaysDetailed(
  ctx: MutationCtx,
  ownerId: Id<"users">,
) {
  const catalog = await ensureCatalog(ctx);
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

  for (const spec of HOLIDAYS) {
    const show = await seedHolidayShow(ctx, ownerId, spec, walls);
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
      window: spec.performanceWindow,
      showTitle: show.showTitle,
    });
    if (performance.inserted) performancesInserted++;
    else performancesSkipped++;
  }

  return {
    catalog,
    layoutName: walls?.layoutName ?? null,
    layoutId: walls?.layoutId ?? null,
    shows,
    performances,
    inserted: {
      catalog: catalog.inserted,
      shows: showsInserted,
      scenes: scenesInserted,
      effects: effectsInserted,
      performances: performancesInserted,
    },
    skipped: {
      catalog: catalog.skipped,
      shows: showsSkipped,
      scenes: scenesSkipped,
      effects: effectsSkipped,
      performances: performancesSkipped,
    },
  };
}

export async function runBarlocoHolidaysSeed(ctx: MutationCtx) {
  const owner = await resolveOwner(ctx);
  console.log(
    `seedBarlocoHolidays owner: ${owner.handle} (${owner.tier}) ${owner._id}`,
  );
  const result = await seedBarlocoHolidaysDetailed(ctx, owner._id);
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
  handler: async (ctx) => runBarlocoHolidaysSeed(ctx),
});

export const seedBarlocoHolidaysRun = mutation({
  args: { ownerId: v.optional(v.id("users")) },
  handler: async (ctx, { ownerId }) => {
    const owner = ownerId
      ? await ctx.db.get(ownerId)
      : await resolveOwner(ctx);
    if (!owner) throw new Error("Owner user not found.");
    console.log(
      `seedBarlocoHolidays owner: ${owner.handle} (${owner.tier}) ${owner._id}`,
    );
    const result = await seedBarlocoHolidaysDetailed(ctx, owner._id);
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
    const taggedShows = await ctx.db
      .query("shows")
      .withIndex("by_tag", (q) => q.eq("tag", TAG))
      .collect();
    const allShows = await ctx.db.query("shows").collect();
    const jingleShows = allShows.filter(
      (s) =>
        isJingleBarTitle(s.title) ||
        (s.tag === TAG && /christmas|jingle/i.test(s.title)),
    );
    const performances = (await ctx.db.query("performances").collect()).filter(
      (p) => p.tag === TAG,
    );
    const catalog = await ctx.db
      .query("comedyGames")
      .withIndex("by_tag", (q) => q.eq("tag", TAG))
      .collect();

    const shows = [];
    for (const spec of HOLIDAYS) {
      const show =
        taggedShows.find((s) => s.sourceKey === showKey(spec.prefix)) ??
        taggedShows.find((s) => s.title === spec.showTitle) ??
        (spec.keepExistingShow
          ? jingleShows[0]
          : undefined);
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
      catalog: catalog.map((g) => ({ name: g.name, roundType: g.roundType })),
      jingleShows: jingleShows.map((s) => ({
        _id: s._id,
        title: s.title,
        tag: s.tag,
        sourceKey: s.sourceKey,
      })),
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
