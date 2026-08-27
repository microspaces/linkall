import { mutation } from "./_generated/server";
import { MutationCtx } from "./_generated/server";
import { Id, TableNames } from "./_generated/dataModel";
import { christmasMikeScenes } from "./christmasMikeData";
import {
  getLocoByTag,
  HOMESHOW_HOLIDAYS,
  isHomeShowHolidayTag,
  requireLoco,
  rowTag,
  type LocoConfig,
} from "./locos";
import {
  overlayKindForTitle,
  overlayPath,
  wantsSideScores,
  winnerCue,
} from "./sceneCues";
import {
  KEY_FILL_LOGICALS,
  KEY_FILL_FULL_OVERLAY,
  KEY_FILL_LOWER_THIRD,
  KEY_FILL_TOP_CORNERS,
  type KeyFillLogical,
  ROSS_KEY_FILLS_SCREEN,
  buildCommands,
  rigCueForScene,
} from "./rossRig";

/**
 * Mock data per brand, for testing until real data (groups etc.) is imported.
 * Run against the matching deployment, e.g.:
 *   npx convex run seed:funfirst
 * Seeding CLEARS all tables in that deployment first.
 */

const ALL_TABLES: TableNames[] = [
  "serviceOrderLines",
  "serviceOrders",
  "placeClaims",
  "menuItems",
  "places",
  "venues",
  "performanceTracks",
  "performanceOverlays",
  "performers",
  "performanceGames",
  "performances",
  "comedyGames",
  "postVotes",
  "posts",
  "groupMembers",
  "groups",
  "notifications",
  "effects",
  "panelMappings",
  "displayProfiles",
  "panels",
  "screens",
  "layouts",
  "scenes",
  "shows",
  "tickets",
  "events",
  "cartItems",
  "products",
  "resources",
  "users",
];

async function clearAll(ctx: MutationCtx) {
  for (const table of ALL_TABLES) {
    const rows = await ctx.db.query(table).collect();
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
  }
}

function avatar(seed: string) {
  return `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(seed)}`;
}

function img(seed: string) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/640/400`;
}

type UserSpec = {
  name: string;
  handle: string;
  bio: string;
  tier: "free" | "silver" | "gold" | "admin";
  state?: string;
  county?: string;
};

async function insertUsers(ctx: MutationCtx, specs: UserSpec[]) {
  const ids: Id<"users">[] = [];
  for (const spec of specs) {
    ids.push(
      await ctx.db.insert("users", { ...spec, avatarUrl: avatar(spec.handle) }),
    );
  }
  return ids;
}

type GroupSpec = {
  name: string;
  description: string;
  kind: "public" | "private" | "state" | "county";
  state?: string;
  county?: string;
  leftmenu?: 1 | 2;
  category?: string;
};

async function insertGroups(
  ctx: MutationCtx,
  specs: GroupSpec[],
  users: Id<"users">[],
) {
  const ids: Id<"groups">[] = [];
  for (let i = 0; i < specs.length; i++) {
    const creator = users[i % users.length];
    const groupId = await ctx.db.insert("groups", {
      ...specs[i],
      photoUrl: img(specs[i].name),
      createdBy: creator,
      memberCount: 0,
    });
    // Every user joins every other group for lively mock data.
    let count = 0;
    for (let u = 0; u < users.length; u++) {
      if ((u + i) % 2 === 0) {
        await ctx.db.insert("groupMembers", {
          groupId,
          userId: users[u],
          isAdmin: users[u] === creator,
        });
        count++;
      }
    }
    await ctx.db.patch(groupId, { memberCount: count });
    ids.push(groupId);
  }
  return ids;
}

async function insertPosts(
  ctx: MutationCtx,
  posts: { content: string; groupIndex?: number; isSolution?: boolean }[],
  users: Id<"users">[],
  groups: Id<"groups">[],
) {
  for (let i = 0; i < posts.length; i++) {
    const postId = await ctx.db.insert("posts", {
      authorId: users[i % users.length],
      content: posts[i].content,
      groupId:
        posts[i].groupIndex !== undefined
          ? groups[posts[i].groupIndex!]
          : undefined,
      upvotes: (i * 3) % 7,
      replyCount: i % 2,
      isSolution: posts[i].isSolution,
    });
    if (i % 2 === 1) {
      await ctx.db.insert("posts", {
        authorId: users[(i + 1) % users.length],
        content: "Totally agree — count me in!",
        parentId: postId,
        groupId:
          posts[i].groupIndex !== undefined
            ? groups[posts[i].groupIndex!]
            : undefined,
        upvotes: 1,
        replyCount: 0,
      });
    }
  }
}

async function insertShow(
  ctx: MutationCtx,
  show: {
    title: string;
    description: string;
    tag?: string;
    status: "draft" | "live" | "ended";
    owner: Id<"users">;
    scenes: { title: string; kind: "title" | "image" | "text" | "score"; content: string }[];
  },
) {
  const showId = await ctx.db.insert("shows", {
    title: show.title,
    description: show.description,
    tag: show.tag,
    status: show.status,
    currentSceneIndex: 0,
    ownerId: show.owner,
  });
  for (let i = 0; i < show.scenes.length; i++) {
    await ctx.db.insert("scenes", { showId, order: i, ...show.scenes[i] });
  }
  return showId;
}

async function insertLocoCatalog(ctx: MutationCtx, loco: LocoConfig) {
  const catalogIds: Record<string, Id<"comedyGames">> = {};
  for (const g of loco.catalog) {
    catalogIds[g.name] = await ctx.db.insert("comedyGames", {
      name: g.name,
      roundType: g.roundType,
      shortDescription: g.shortDescription,
      suggestions: g.suggestions,
      description: g.description,
      tag: loco.tag,
    });
  }
  return catalogIds;
}

async function insertLocoDemo(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  loco: LocoConfig,
  title: string,
  rounds: [number, string, string, string, boolean][],
  performers: [string, 1 | 2][],
  catalogIds: Record<string, Id<"comedyGames">>,
  showId?: Id<"shows">,
) {
  const performanceId = await ctx.db.insert("performances", {
    title,
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
  for (const [round, roundType, game1, game2, isScored] of rounds) {
    for (const teamIndex of teamIndexes) {
      const gameName = teamIndex === 1 ? game1 : game2;
      await ctx.db.insert("performanceGames", {
        performanceId,
        order: order++,
        round,
        roundType,
        teamIndex,
        gameName,
        gameId: catalogIds[gameName],
        votes: 0,
        score: 0,
        isPlaying: false,
        isPlayed: false,
        isVoting: false,
        isWinner: false,
        rotation: false,
        isCued: false,
        volunteers: 0,
        isScored: loco.mode === "setlist" ? false : isScored,
      });
    }
  }
  for (const [name, teamIndex] of performers) {
    await ctx.db.insert("performers", {
      performanceId,
      name,
      teamIndex,
      bellBonus: 0,
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
  return performanceId;
}

/** Official Battle Loco marketing stills (battleloco.com). */
const BATTLE_LOCO_IMAGES = {
  hero: "https://battleloco.com/battle-loco/images/hero.jpg",
  competitors: "https://battleloco.com/battle-loco/images/competitors.jpg",
  crowd: "https://battleloco.com/battle-loco/images/crowd.jpg",
} as const;

/** Outro LED lockups with BATTLE LOCO baked into the art. */
const BATTLE_LOCO_OUTRO_IMAGES = {
  left: "https://battleloco.com/battle-loco/images/outro-left.jpg",
  center: "https://battleloco.com/battle-loco/images/outro-center.jpg",
  right: "https://battleloco.com/battle-loco/images/outro-right.jpg",
} as const;

/**
 * “Bring the Boom” cue for HyperX Left / Center / Right.
 * Legacy mike export pointed at surroundshow.com/video/bananarama/boom*.mp4,
 * but those files 404 publicly now — use the working YouTube Boom clips instead.
 */
const BATTLE_LOCO_BOOM_VIDEOS = {
  left: "https://www.youtube.com/watch?v=btnZ-segFG0",
  center: "https://www.youtube.com/watch?v=C2ozn70nM9Y",
  right: "https://www.youtube.com/watch?v=LRF9SHSvOOc",
} as const;

const WRESTLE_LOCO_IMAGES = {
  hero: "/wrestle-loco/images/hero.jpg",
  ring: "/wrestle-loco/images/ring.jpg",
  crowd: "/wrestle-loco/images/crowd-portrait.jpg",
  faces: "/wrestle-loco/images/faces.jpg",
  heels: "/wrestle-loco/images/heels.jpg",
} as const;

const WRESTLE_LOCO_OUTRO_IMAGES = {
  left: "/wrestle-loco/images/outro-left.jpg",
  center: "/wrestle-loco/images/outro-center.jpg",
  right: "/wrestle-loco/images/outro-right.jpg",
} as const;

/** Match-celebration cue for Wrestle Stage Left / Center / Right. */
const WRESTLE_LOCO_BELL_VIDEOS = {
  left: "/wrestle-loco/videos/bell-left.mp4",
  center: "/wrestle-loco/videos/bell-center.mp4",
  right: "/wrestle-loco/videos/bell-right.mp4",
} as const;

const WRESTLE_CELEBRATION_CUE = "Hit the Bell";

const KEY_FILL_LOGICAL_SET = new Set<string>(KEY_FILL_LOGICALS);

function keyFillOverlayKind(
  title: string,
  logical: KeyFillLogical,
  opts?: { isSoundEffect?: boolean },
): string | null {
  const cue = rigCueForScene(title, opts);
  if (!cue) return null;
  if (logical === KEY_FILL_FULL_OVERLAY) {
    if (!cue.keys.fullOverlay) return null;
    return overlayKindForTitle(title) ?? "live";
  }
  if (logical === KEY_FILL_LOWER_THIRD) {
    if (!cue.keys.lowerThird) return null;
    const kind = overlayKindForTitle(title);
    if (kind === "introduction" || kind === "crowd") return kind;
    return "live";
  }
  if (logical === KEY_FILL_TOP_CORNERS) {
    if (!cue.keys.topCorners) return null;
    return "score";
  }
  return null;
}

/** Command effects and non-LED slots must survive dress / lockup rewrites. */
function isProtectedSeedEffect(e: {
  kind: string;
  logicalPanelName?: string;
}) {
  if (e.kind === "command" || e.kind === "hotkey") return true;
  const logical = e.logicalPanelName ?? "";
  return logical === "Phone" || KEY_FILL_LOGICAL_SET.has(logical);
}

type CueSceneSpec = {
  title: string;
  durationSec: number;
  isOverlay?: boolean;
  isSoundEffect?: boolean;
  accent: string;
  centerText: string;
  leftImage?: string;
  centerImage?: string;
  rightImage?: string;
  video?: string;
};

function performanceCuesFor(
  loco: LocoConfig,
  images: { hero: string; side: string; crowd: string },
  winVideo?: string,
): CueSceneSpec[] {
  const cues: CueSceneSpec[] = [
    {
      title: "Introduction",
      durationSec: 20,
      isOverlay: true,
      accent: "#1e3a8a",
      centerText: "INTRODUCING",
      centerImage: images.hero,
    },
    {
      title: "Game Instructions",
      durationSec: 30,
      isOverlay: true,
      accent: "#7c2d12",
      centerText: "PLAY THIS",
      centerImage: images.hero,
    },
    {
      title: "Vote",
      durationSec: 20,
      isOverlay: true,
      accent: "#b45309",
      centerText: "VOTE!",
    },
    {
      title: winnerCue(loco.team1),
      durationSec: 15,
      isOverlay: true,
      accent: "#ca8a04",
      centerText: `${loco.team1.toUpperCase()} WIN`,
      leftImage: images.side,
      video: winVideo,
    },
    {
      title: winnerCue(loco.team2),
      durationSec: 15,
      isOverlay: true,
      accent: "#0e7490",
      centerText: `${loco.team2.toUpperCase()} WIN`,
      rightImage: images.crowd,
      video: winVideo,
    },
    {
      title: "Score Rotation",
      durationSec: 15,
      isOverlay: true,
      accent: "#0369a1",
      centerText: "ROTATION",
    },
    {
      title: "Score",
      durationSec: 20,
      isOverlay: true,
      accent: "#0f766e",
      centerText: "SCORE",
    },
    {
      title: "Games",
      durationSec: 20,
      isOverlay: true,
      accent: "#334155",
      centerText: "TONIGHT",
    },
    {
      title: "Crowd",
      durationSec: 20,
      isOverlay: true,
      accent: "#7c3aed",
      centerText: "CROWD",
      centerImage: images.crowd,
      rightImage: images.crowd,
    },
    {
      title: "BringTheFun",
      durationSec: 180,
      isSoundEffect: true,
      accent: "#14532d",
      centerText: "♪",
    },
    {
      title: "BackNForth",
      durationSec: 180,
      isSoundEffect: true,
      accent: "#1e3a8a",
      centerText: "♪",
    },
  ];
  if (loco.tag === "battleloco") {
    cues.push({
      title: "Punishment",
      durationSec: 20,
      isOverlay: true,
      accent: "#7f1d1d",
      centerText: "PUNISHMENT",
    });
  }
  if (loco.tag === "wrestleloco") {
    cues.push({
      title: "Ring",
      durationSec: 20,
      isOverlay: true,
      accent: "#1d4ed8",
      centerText: "RING",
      centerImage: images.hero,
    });
  }
  return cues;
}

async function insertCueScenesOnShow(
  ctx: MutationCtx,
  showId: Id<"shows">,
  panelByLogical: Record<string, Id<"panels">>,
  specs: CueSceneSpec[],
  scoreLine: string,
  slug: string,
) {
  const existing = await ctx.db
    .query("scenes")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();
  const have = new Set(existing.map((s) => s.title.toLowerCase()));
  let order = existing.reduce((m, s) => Math.max(m, s.order), -1) + 1;
  let added = 0;

  const put = async (
    sceneId: Id<"scenes">,
    logical: string,
    kind: "image" | "color" | "text" | "url" | "video",
    content: string,
    startTime = 0,
    durationSec?: number,
  ) => {
    const panelId = panelByLogical[logical];
    if (!panelId) return;
    await ctx.db.insert("effects", {
      sceneId,
      panelId,
      logicalPanelName: logical,
      kind,
      content,
      startTime,
      isEnabled: true,
      ...(durationSec !== undefined ? { durationSec } : {}),
    });
  };

  for (const spec of specs) {
    if (have.has(spec.title.toLowerCase())) continue;
    const sceneId = await ctx.db.insert("scenes", {
      showId,
      order: order++,
      title: spec.title,
      kind: "panels",
      content: "",
      durationSec: spec.durationSec,
      isOverlay: spec.isOverlay,
      isSoundEffect: spec.isSoundEffect,
    });
    added++;

    if (panelByLogical.Background) {
      await put(sceneId, "Background", "color", "#0f172a");
    }
    if (panelByLogical.LeftSidebar) {
      if (wantsSideScores(spec.title)) {
        await put(sceneId, "LeftSidebar", "url", overlayPath(slug, "score-1"));
      } else if (spec.leftImage) {
        await put(sceneId, "LeftSidebar", "image", spec.leftImage);
      } else {
        await put(sceneId, "LeftSidebar", "color", spec.accent);
      }
    }
    if (panelByLogical.RightSidebar) {
      if (wantsSideScores(spec.title)) {
        await put(sceneId, "RightSidebar", "url", overlayPath(slug, "score-2"));
      } else if (spec.rightImage) {
        await put(sceneId, "RightSidebar", "image", spec.rightImage);
      } else {
        await put(sceneId, "RightSidebar", "color", spec.accent);
      }
    }
    if (panelByLogical.Scoreboard) {
      await put(sceneId, "Scoreboard", "text", scoreLine);
    }
    if (panelByLogical.MainContent) {
      const overlayKind = overlayKindForTitle(spec.title);
      if (spec.video) {
        await put(sceneId, "MainContent", "video", spec.video);
      } else if (overlayKind) {
        await put(
          sceneId,
          "MainContent",
          "url",
          overlayPath(slug, overlayKind),
        );
      } else if (spec.centerImage) {
        await put(sceneId, "MainContent", "image", spec.centerImage);
        await put(sceneId, "MainContent", "text", spec.centerText, 0, 30);
      } else {
        await put(sceneId, "MainContent", "color", spec.accent);
        await put(sceneId, "MainContent", "text", spec.centerText, 0, 30);
        await put(sceneId, "MainContent", "color", "#fbbf24", 30, 15);
      }
    }
    if (panelByLogical.Phone) {
      await put(sceneId, "Phone", "url", overlayPath(slug, "live"));
    }
  }
  return added;
}

/** Add URL / win-video effects to existing cue scenes (does not create scenes). */
async function ensureOverlayEffectsOnShow(
  ctx: MutationCtx,
  showId: Id<"shows">,
  slug: string,
  winVideo?: string,
) {
  const panels = await panelLogicalsForShow(ctx, showId);
  const main = panels.MainContent;
  if (!main) return { urls: 0, videos: 0 };
  const scenes = await ctx.db
    .query("scenes")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();
  let urls = 0;
  let videos = 0;
  for (const scene of scenes) {
    const overlayKind = overlayKindForTitle(scene.title);
    const effects = await ctx.db
      .query("effects")
      .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
      .collect();
    const hasUrl = effects.some((e) => e.kind === "url");
    const hasVideo = effects.some((e) => e.kind === "video");
    const isWinner = scene.title.toLowerCase().startsWith("winner");
    if (isWinner && winVideo && !hasVideo) {
      await ctx.db.insert("effects", {
        sceneId: scene._id,
        panelId: main,
        logicalPanelName: "MainContent",
        kind: "video",
        content: winVideo,
        startTime: 0,
        isEnabled: true,
      });
      videos++;
    } else if (overlayKind && !hasUrl && !isWinner) {
      await ctx.db.insert("effects", {
        sceneId: scene._id,
        panelId: main,
        logicalPanelName: "MainContent",
        kind: "url",
        content: overlayPath(slug, overlayKind),
        startTime: 0,
        isEnabled: true,
      });
      urls++;
    }
  }
  return { urls, videos };
}

/**
 * LinkAll8 left/right Score URLs: live team score on the wing screens
 * for Score / Vote / Game Instructions / Rotation / Winner (not Boom videos).
 */
async function ensureSideScoreEffectsOnShow(
  ctx: MutationCtx,
  showId: Id<"shows">,
  slug: string,
) {
  const panels = await panelLogicalsForShow(ctx, showId);
  const left = panels.LeftSidebar;
  const right = panels.RightSidebar;
  if (!left && !right) return { sides: 0 };

  const scenes = await ctx.db
    .query("scenes")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();

  const putUrl = async (
    sceneId: Id<"scenes">,
    logical: string,
    panelId: Id<"panels">,
    kind: string,
  ) => {
    await ctx.db.insert("effects", {
      sceneId,
      panelId,
      logicalPanelName: logical,
      kind: "url",
      content: overlayPath(slug, kind),
      startTime: 0,
      isEnabled: true,
    });
  };

  let sides = 0;
  for (const scene of scenes) {
    if (!wantsSideScores(scene.title)) continue;
    const effects = await ctx.db
      .query("effects")
      .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
      .collect();
    const hasSideVideo = effects.some(
      (e) =>
        e.kind === "video" &&
        (e.logicalPanelName === "LeftSidebar" ||
          e.logicalPanelName === "RightSidebar"),
    );
    if (hasSideVideo) continue;

    const want = [
      { logical: "LeftSidebar", panelId: left, kind: "score-1" },
      { logical: "RightSidebar", panelId: right, kind: "score-2" },
    ] as const;

    for (const side of want) {
      if (!side.panelId) continue;
      const existing = effects.filter((e) => e.logicalPanelName === side.logical);
      const already = existing.some(
        (e) => e.kind === "url" && e.content.includes(`/overlay/${side.kind}`),
      );
      if (already) continue;
      for (const e of existing) {
        if (e.kind === "image" || e.kind === "color" || e.kind === "text" || e.kind === "url") {
          await ctx.db.delete(e._id);
        }
      }
      await putUrl(scene._id, side.logical, side.panelId, side.kind);
      sides++;
    }
  }
  return { sides };
}

/**
 * Fill HyperX left / center / right for every Battle Loco cue:
 * photo wings during the night, Boom videos on all three for celebrations.
 */
async function dressBattleLocoLook(ctx: MutationCtx, showId: Id<"shows">) {
  const panels = await panelLogicalsForShow(ctx, showId);
  const left = panels.LeftSidebar;
  const center = panels.MainContent;
  const right = panels.RightSidebar;
  if (!left || !center || !right) return { dressed: 0 };

  const scenes = await ctx.db
    .query("scenes")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();

  const keepNamed = new Set(["intro", "outro"]);
  const boomNamed = new Set([
    "bring the boom",
    "winner heat",
    "winner ice",
  ]);

  const put = async (
    sceneId: Id<"scenes">,
    logical: string,
    panelId: Id<"panels">,
    kind: "image" | "video",
    content: string,
  ) => {
    await ctx.db.insert("effects", {
      sceneId,
      panelId,
      logicalPanelName: logical,
      kind,
      content,
      startTime: 0,
      isEnabled: true,
    });
  };

  let dressed = 0;
  for (const scene of scenes) {
    const title = scene.title.toLowerCase();
    if (keepNamed.has(title)) continue;

    const effects = await ctx.db
      .query("effects")
      .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
      .collect();

    if (boomNamed.has(title)) {
      for (const e of effects) {
        if (isProtectedSeedEffect(e)) continue;
        if (e.kind !== "video") await ctx.db.delete(e._id);
      }
      const leftHas = effects.some(
        (e) => e.kind === "video" && e.logicalPanelName === "LeftSidebar",
      );
      const centerHas = effects.some(
        (e) => e.kind === "video" && e.logicalPanelName === "MainContent",
      );
      const rightHas = effects.some(
        (e) => e.kind === "video" && e.logicalPanelName === "RightSidebar",
      );
      if (!leftHas)
        await put(scene._id, "LeftSidebar", left, "video", BATTLE_LOCO_BOOM_VIDEOS.left);
      if (!centerHas)
        await put(scene._id, "MainContent", center, "video", BATTLE_LOCO_BOOM_VIDEOS.center);
      if (!rightHas)
        await put(scene._id, "RightSidebar", right, "video", BATTLE_LOCO_BOOM_VIDEOS.right);
      dressed++;
      continue;
    }

    // Photo fill: competitors | hero | crowd. Keep URL overlay on center.
    // Score / Vote / Instructions / Winner get live scores on the wings instead.
    const sideScores = wantsSideScores(scene.title);
    for (const e of effects) {
      if (e.kind === "color" || e.kind === "text") await ctx.db.delete(e._id);
      if (
        sideScores &&
        e.kind === "image" &&
        (e.logicalPanelName === "LeftSidebar" ||
          e.logicalPanelName === "RightSidebar")
      ) {
        await ctx.db.delete(e._id);
      }
    }
    const after = await ctx.db
      .query("effects")
      .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
      .collect();
    const hasLeftImg = after.some(
      (e) => e.kind === "image" && e.logicalPanelName === "LeftSidebar",
    );
    const hasRightImg = after.some(
      (e) => e.kind === "image" && e.logicalPanelName === "RightSidebar",
    );
    const hasCenterImg = after.some(
      (e) => e.kind === "image" && e.logicalPanelName === "MainContent",
    );
    if (!sideScores && !hasLeftImg)
      await put(
        scene._id,
        "LeftSidebar",
        left,
        "image",
        BATTLE_LOCO_IMAGES.competitors,
      );
    if (!sideScores && !hasRightImg)
      await put(
        scene._id,
        "RightSidebar",
        right,
        "image",
        BATTLE_LOCO_IMAGES.crowd,
      );
    if (!hasCenterImg)
      await put(scene._id, "MainContent", center, "image", BATTLE_LOCO_IMAGES.hero);
    dressed++;
  }
  return { dressed };
}

/**
 * Fill Wrestle Ring left / center / right for every cue:
 * Faces | arena | crowd during the night, Hit the Bell videos on wins.
 */
async function dressWrestleLocoLook(ctx: MutationCtx, showId: Id<"shows">) {
  const panels = await panelLogicalsForShow(ctx, showId);
  const left = panels.LeftSidebar;
  const center = panels.MainContent;
  const right = panels.RightSidebar;
  if (!left || !center || !right) return { dressed: 0 };

  const scenes = await ctx.db
    .query("scenes")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();

  const keepNamed = new Set(["opening bell", "intro", "outro"]);
  const bellNamed = new Set([
    WRESTLE_CELEBRATION_CUE.toLowerCase(),
    "winner faces",
    "winner heels",
  ]);

  const put = async (
    sceneId: Id<"scenes">,
    logical: string,
    panelId: Id<"panels">,
    kind: "image" | "video",
    content: string,
  ) => {
    await ctx.db.insert("effects", {
      sceneId,
      panelId,
      logicalPanelName: logical,
      kind,
      content,
      startTime: 0,
      isEnabled: true,
    });
  };

  let dressed = 0;
  for (const scene of scenes) {
    const title = scene.title.toLowerCase();
    if (keepNamed.has(title)) continue;

    const effects = await ctx.db
      .query("effects")
      .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
      .collect();

    if (bellNamed.has(title)) {
      for (const e of effects) {
        if (isProtectedSeedEffect(e)) continue;
        if (e.kind !== "video") await ctx.db.delete(e._id);
      }
      const leftHas = effects.some(
        (e) => e.kind === "video" && e.logicalPanelName === "LeftSidebar",
      );
      const centerHas = effects.some(
        (e) => e.kind === "video" && e.logicalPanelName === "MainContent",
      );
      const rightHas = effects.some(
        (e) => e.kind === "video" && e.logicalPanelName === "RightSidebar",
      );
      if (!leftHas)
        await put(scene._id, "LeftSidebar", left, "video", WRESTLE_LOCO_BELL_VIDEOS.left);
      if (!centerHas)
        await put(scene._id, "MainContent", center, "video", WRESTLE_LOCO_BELL_VIDEOS.center);
      if (!rightHas)
        await put(scene._id, "RightSidebar", right, "video", WRESTLE_LOCO_BELL_VIDEOS.right);
      dressed++;
      continue;
    }

    const sideScores = wantsSideScores(scene.title);
    for (const e of effects) {
      if (e.kind === "color" || e.kind === "text") await ctx.db.delete(e._id);
      if (
        sideScores &&
        e.kind === "image" &&
        (e.logicalPanelName === "LeftSidebar" ||
          e.logicalPanelName === "RightSidebar")
      ) {
        await ctx.db.delete(e._id);
      }
    }
    const after = await ctx.db
      .query("effects")
      .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
      .collect();
    const hasLeftImg = after.some(
      (e) => e.kind === "image" && e.logicalPanelName === "LeftSidebar",
    );
    const hasRightImg = after.some(
      (e) => e.kind === "image" && e.logicalPanelName === "RightSidebar",
    );
    const hasCenterImg = after.some(
      (e) => e.kind === "image" && e.logicalPanelName === "MainContent",
    );
    if (!sideScores && !hasLeftImg)
      await put(scene._id, "LeftSidebar", left, "image", WRESTLE_LOCO_IMAGES.faces);
    if (!sideScores && !hasRightImg)
      await put(scene._id, "RightSidebar", right, "image", WRESTLE_LOCO_IMAGES.crowd);
    if (!hasCenterImg)
      await put(scene._id, "MainContent", center, "image", WRESTLE_LOCO_IMAGES.hero);
    dressed++;
  }
  return { dressed };
}

/** Intro photos, Hit the Bell videos, and Outro lockups on an existing show. */
async function ensureWrestleLockupScenes(
  ctx: MutationCtx,
  showId: Id<"shows">,
) {
  const panels = await panelLogicalsForShow(ctx, showId);
  const left = panels.LeftSidebar;
  const center = panels.MainContent;
  const right = panels.RightSidebar;
  if (!left || !center || !right) return { lockups: 0 };

  const scenes = await ctx.db
    .query("scenes")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();
  const byTitle = new Map(scenes.map((s) => [s.title.toLowerCase(), s]));
  let order = scenes.reduce((m, s) => Math.max(m, s.order), -1) + 1;
  let lockups = 0;

  const putWalls = async (
    sceneId: Id<"scenes">,
    kind: "image" | "video",
    byLogical: Record<string, string>,
  ) => {
    const existing = await ctx.db
      .query("effects")
      .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
      .collect();
    for (const e of existing) {
      if (isProtectedSeedEffect(e)) continue;
      await ctx.db.delete(e._id);
    }
    const walls: Array<[string, Id<"panels">]> = [
      ["LeftSidebar", left],
      ["MainContent", center],
      ["RightSidebar", right],
    ];
    for (const [logical, panelId] of walls) {
      await ctx.db.insert("effects", {
        sceneId,
        panelId,
        logicalPanelName: logical,
        kind,
        content: byLogical[logical],
        startTime: 0,
        isEnabled: true,
      });
    }
  };

  const intro = byTitle.get("opening bell") ?? byTitle.get("intro");
  if (intro) {
    await putWalls(intro._id, "image", {
      LeftSidebar: WRESTLE_LOCO_IMAGES.faces,
      MainContent: WRESTLE_LOCO_IMAGES.hero,
      RightSidebar: WRESTLE_LOCO_IMAGES.crowd,
    });
    lockups++;
  }

  let bell = byTitle.get(WRESTLE_CELEBRATION_CUE.toLowerCase());
  if (!bell) {
    const sceneId = await ctx.db.insert("scenes", {
      showId,
      order: order++,
      title: WRESTLE_CELEBRATION_CUE,
      kind: "panels",
      content: "",
      durationSec: 60,
    });
    bell = (await ctx.db.get(sceneId)) ?? undefined;
  }
  if (bell) {
    await putWalls(bell._id, "video", {
      LeftSidebar: WRESTLE_LOCO_BELL_VIDEOS.left,
      MainContent: WRESTLE_LOCO_BELL_VIDEOS.center,
      RightSidebar: WRESTLE_LOCO_BELL_VIDEOS.right,
    });
    lockups++;
  }

  let outro = byTitle.get("outro");
  if (!outro) {
    const sceneId = await ctx.db.insert("scenes", {
      showId,
      order: order++,
      title: "Outro",
      kind: "panels",
      content: "",
      durationSec: 90,
    });
    outro = (await ctx.db.get(sceneId)) ?? undefined;
  }
  if (outro) {
    await putWalls(outro._id, "image", {
      LeftSidebar: WRESTLE_LOCO_OUTRO_IMAGES.left,
      MainContent: WRESTLE_LOCO_OUTRO_IMAGES.center,
      RightSidebar: WRESTLE_LOCO_OUTRO_IMAGES.right,
    });
    lockups++;
  }

  await ctx.db.patch(showId, { status: "live" });
  return { lockups };
}

const PHONE_CANVAS = { width: 1080, height: 1920 } as const;

function slugForShow(show: { title: string; tag?: string }) {
  const loco = show.tag ? getLocoByTag(show.tag) : undefined;
  if (loco) return loco.slug;
  const t = show.title.toLowerCase();
  if (t.includes("battle")) return "battle-loco";
  if (t.includes("wrestle")) return "wrestle-loco";
  if (t.includes("comedy") || t.includes("stage cues")) return "comedy-loco";
  return null;
}

function phoneOverlayPath(slug: string | null) {
  return slug
    ? overlayPath(slug, "live")
    : "/comedy-loco/performance/overlay/live?id={performanceId}";
}

/**
 * Portrait audience phone on every show layout + display profile.
 * Live overlay URL follows Begin / Next / Win via activeOverlay.
 */
async function ensurePhoneScreenOnShow(
  ctx: MutationCtx,
  showId: Id<"shows">,
) {
  const show = await ctx.db.get(showId);
  if (!show?.layoutId) return { phone: 0, mapped: 0, urls: 0 };

  const screens = await ctx.db
    .query("screens")
    .withIndex("by_layout", (q) => q.eq("layoutId", show.layoutId!))
    .collect();
  let phone = screens.find((s) => s.name.toLowerCase() === "phone");
  let panelId: Id<"panels"> | undefined;
  if (phone) {
    if (phone.role !== "phone") await ctx.db.patch(phone._id, { role: "phone" });
    const panels = await ctx.db
      .query("panels")
      .withIndex("by_screen", (q) => q.eq("screenId", phone!._id))
      .collect();
    panelId = panels[0]?._id;
  } else {
    const order = screens.reduce((m, s) => Math.max(m, s.order), -1) + 1;
    const screenId = await ctx.db.insert("screens", {
      layoutId: show.layoutId,
      name: "Phone",
      order,
      width: PHONE_CANVAS.width,
      height: PHONE_CANVAS.height,
      role: "phone",
    });
    panelId = await ctx.db.insert("panels", {
      screenId,
      name: "Phone",
      zIndex: 0,
      points: [
        { x: 0, y: 0 },
        { x: PHONE_CANVAS.width, y: 0 },
        { x: PHONE_CANVAS.width, y: PHONE_CANVAS.height },
        { x: 0, y: PHONE_CANVAS.height },
      ],
    });
  }
  if (!panelId) return { phone: 0, mapped: 0, urls: 0 };

  let profiles = await ctx.db
    .query("displayProfiles")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();
  if (profiles.length === 0) {
    const all = await ctx.db.query("displayProfiles").collect();
    profiles = all.filter((p) => p.layoutId === show.layoutId);
  }
  let mapped = 0;
  for (const profile of profiles) {
    const existing = await ctx.db
      .query("panelMappings")
      .withIndex("by_profile_logical", (q) =>
        q.eq("displayProfileId", profile._id).eq("logicalPanelName", "Phone"),
      )
      .unique();
    if (existing) continue;
    await ctx.db.insert("panelMappings", {
      displayProfileId: profile._id,
      logicalPanelName: "Phone",
      panelId,
    });
    mapped++;
  }

  const url = phoneOverlayPath(slugForShow(show));
  const scenes = await ctx.db
    .query("scenes")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();
  let urls = 0;
  for (const scene of scenes) {
    const effects = await ctx.db
      .query("effects")
      .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
      .collect();
    const has = effects.some(
      (e) => e.logicalPanelName === "Phone" && e.kind === "url",
    );
    if (has) continue;
    await ctx.db.insert("effects", {
      sceneId: scene._id,
      panelId,
      logicalPanelName: "Phone",
      kind: "url",
      content: url,
      startTime: 0,
      isEnabled: true,
    });
    urls++;
  }
  return { phone: 1, mapped, urls };
}

const ROSS_KEY_FILL_CANVAS = { width: 1920, height: 1080 } as const;

const ROSS_KEY_FILL_TILES: Array<{
  logical: (typeof KEY_FILL_LOGICALS)[number];
  zIndex: number;
  points: { x: number; y: number }[];
}> = [
  {
    logical: KEY_FILL_FULL_OVERLAY,
    zIndex: 0,
    points: [
      { x: 0, y: 0 },
      { x: 1920, y: 0 },
      { x: 1920, y: 360 },
      { x: 0, y: 360 },
    ],
  },
  {
    logical: KEY_FILL_LOWER_THIRD,
    zIndex: 1,
    points: [
      { x: 0, y: 360 },
      { x: 1920, y: 360 },
      { x: 1920, y: 720 },
      { x: 0, y: 720 },
    ],
  },
  {
    logical: KEY_FILL_TOP_CORNERS,
    zIndex: 2,
    points: [
      { x: 0, y: 720 },
      { x: 1920, y: 720 },
      { x: 1920, y: 1080 },
      { x: 0, y: 1080 },
    ],
  },
];

async function upsertLogicalMapping(
  ctx: MutationCtx,
  displayProfileId: Id<"displayProfiles">,
  logicalPanelName: string,
  panelId: Id<"panels">,
) {
  const existing = await ctx.db
    .query("panelMappings")
    .withIndex("by_profile_logical", (q) =>
      q
        .eq("displayProfileId", displayProfileId)
        .eq("logicalPanelName", logicalPanelName),
    )
    .unique();
  if (existing) {
    if (existing.panelId !== panelId) {
      await ctx.db.patch(existing._id, { panelId });
    }
    return;
  }
  await ctx.db.insert("panelMappings", {
    displayProfileId,
    logicalPanelName,
    panelId,
  });
}

/**
 * Ross key-fill observables on HyperX: one off-wall screen with three
 * logical panels (full overlay / lower third / top corners). Shared by
 * Battle Loco + Wrestle Loco.
 */
async function ensureRossKeyFillsOnHyperX(
  ctx: MutationCtx,
): Promise<Record<string, Id<"panels">>> {
  const layouts = await ctx.db.query("layouts").collect();
  const layout = layouts.find((l) => l.name === "HyperX Arena");
  if (!layout) return {};

  const screens = await ctx.db
    .query("screens")
    .withIndex("by_layout", (q) => q.eq("layoutId", layout._id))
    .collect();
  let screen = screens.find((s) => s.name === ROSS_KEY_FILLS_SCREEN);
  if (!screen) {
    const order = screens.reduce((m, s) => Math.max(m, s.order), -1) + 1;
    const screenId = await ctx.db.insert("screens", {
      layoutId: layout._id,
      name: ROSS_KEY_FILLS_SCREEN,
      order,
      width: ROSS_KEY_FILL_CANVAS.width,
      height: ROSS_KEY_FILL_CANVAS.height,
    });
    const created = await ctx.db.get(screenId);
    if (!created) return {};
    screen = created;
  }

  const panels = await ctx.db
    .query("panels")
    .withIndex("by_screen", (q) => q.eq("screenId", screen!._id))
    .collect();
  const byName = new Map(panels.map((p) => [p.name, p]));
  const result: Record<string, Id<"panels">> = {};
  for (const tile of ROSS_KEY_FILL_TILES) {
    const existing = byName.get(tile.logical);
    if (existing) {
      result[tile.logical] = existing._id;
      continue;
    }
    result[tile.logical] = await ctx.db.insert("panels", {
      screenId: screen._id,
      name: tile.logical,
      zIndex: tile.zIndex,
      points: tile.points,
    });
  }

  const profiles = await ctx.db.query("displayProfiles").collect();
  for (const profile of profiles) {
    if (profile.layoutId !== layout._id) continue;
    for (const [logical, panelId] of Object.entries(result)) {
      await upsertLogicalMapping(ctx, profile._id, logical, panelId);
    }
  }

  return result;
}

/** RossTalk command effects for every visual cue on a HyperX show. */
async function ensureSceneCommandsOnShow(
  ctx: MutationCtx,
  showId: Id<"shows">,
) {
  const scenes = await ctx.db
    .query("scenes")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();
  let scenesTouched = 0;
  let commands = 0;
  for (const scene of scenes) {
    const cue = rigCueForScene(scene.title, {
      isSoundEffect: scene.isSoundEffect,
    });
    const wanted = cue ? buildCommands(cue) : [];
    const effects = await ctx.db
      .query("effects")
      .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
      .collect();
    const existing = effects.filter((e) => e.kind === "command");
    const have = existing.map((e) => e.content.trim());
    const same =
      have.length === wanted.length &&
      wanted.every((cmd, i) => have[i] === cmd);
    if (same) continue;
    for (const e of existing) await ctx.db.delete(e._id);
    for (const content of wanted) {
      await ctx.db.insert("effects", {
        sceneId: scene._id,
        kind: "command",
        content,
        startTime: 0,
        isEnabled: true,
      });
      commands++;
    }
    scenesTouched++;
  }
  return { commandScenes: scenesTouched, commands };
}

/** URL effects on key-fill logicals so Ross observables have overlay pages. */
async function ensureKeyFillUrlEffectsOnShow(
  ctx: MutationCtx,
  showId: Id<"shows">,
  slug: string,
) {
  const panels = await panelLogicalsForShow(ctx, showId);
  const have = KEY_FILL_LOGICALS.filter((logical) => panels[logical]);
  if (have.length === 0) return { keyFills: 0 };

  const scenes = await ctx.db
    .query("scenes")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();
  let keyFills = 0;
  for (const scene of scenes) {
    const effects = await ctx.db
      .query("effects")
      .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
      .collect();
    for (const logical of have) {
      const kind = keyFillOverlayKind(scene.title, logical, {
        isSoundEffect: scene.isSoundEffect,
      });
      const existing = effects.filter((e) => e.logicalPanelName === logical);
      if (!kind) {
        for (const e of existing) await ctx.db.delete(e._id);
        continue;
      }
      const content = overlayPath(slug, kind);
      const already = existing.find(
        (e) => e.kind === "url" && e.content === content,
      );
      if (already) continue;
      for (const e of existing) await ctx.db.delete(e._id);
      await ctx.db.insert("effects", {
        sceneId: scene._id,
        panelId: panels[logical],
        logicalPanelName: logical,
        kind: "url",
        content,
        startTime: 0,
        isEnabled: true,
      });
      keyFills++;
    }
  }
  return { keyFills };
}

async function applyHyperXSwitcherOnShow(
  ctx: MutationCtx,
  showId: Id<"shows">,
  slug: string,
) {
  const fills = await ensureRossKeyFillsOnHyperX(ctx);
  const commands = await ensureSceneCommandsOnShow(ctx, showId);
  const urls = await ensureKeyFillUrlEffectsOnShow(ctx, showId, slug);
  return {
    keyFillPanels: Object.keys(fills).length,
    ...commands,
    ...urls,
  };
}

async function panelLogicalsForShow(
  ctx: MutationCtx,
  showId: Id<"shows">,
): Promise<Record<string, Id<"panels">>> {
  const profiles = await ctx.db
    .query("displayProfiles")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();
  const profile = profiles.find((p) => p.isDefault) ?? profiles[0];
  const map: Record<string, Id<"panels">> = {};
  if (profile) {
    const mappings = await ctx.db
      .query("panelMappings")
      .withIndex("by_profile", (q) => q.eq("displayProfileId", profile._id))
      .collect();
    for (const m of mappings) map[m.logicalPanelName] = m.panelId;
  }
  if (Object.keys(map).length > 0) return map;

  const show = await ctx.db.get(showId);
  if (!show?.layoutId) return map;
  const screens = await ctx.db
    .query("screens")
    .withIndex("by_layout", (q) => q.eq("layoutId", show.layoutId!))
    .collect();
  screens.sort((a, b) => a.order - b.order);
  const fallbackLogicals = [
    "LeftSidebar",
    "MainContent",
    "RightSidebar",
    "Phone",
  ];
  for (let i = 0; i < screens.length; i++) {
    const panels = await ctx.db
      .query("panels")
      .withIndex("by_screen", (q) => q.eq("screenId", screens[i]._id))
      .collect();
    panels.sort((a, b) => a.zIndex - b.zIndex);
    const panel = panels[0];
    if (panel) map[fallbackLogicals[i] ?? `Panel${i}`] = panel._id;
  }
  return map;
}

async function bindPerformancesToShow(
  ctx: MutationCtx,
  tag: string,
  showId: Id<"shows">,
) {
  const performances = await ctx.db.query("performances").collect();
  let bound = 0;
  for (const p of performances) {
    if (rowTag(p.tag) !== tag) continue;
    if (p.showId === showId) continue;
    await ctx.db.patch(p._id, { showId });
    bound++;
  }
  return bound;
}

/**
 * HyperX Arena three-LED setup for Battle Loco.
 * Screen canvas sizes match the physical LED walls so /screens/[id]
 * aspect ratios line up with the arena outputs.
 */
async function insertBattleLoco(
  ctx: MutationCtx,
  ownerId: Id<"users">,
): Promise<{
  showId: Id<"shows">;
  layoutId: Id<"layouts">;
  screenIds: {
    left: Id<"screens">;
    center: Id<"screens">;
    right: Id<"screens">;
  };
}> {
  const layoutId = await ctx.db.insert("layouts", {
    name: "HyperX Arena",
    ownerId,
  });

  // Physical LED sizes: left/right portrait 1152×1920, center 1920×1080.
  const screenSpecs: {
    key: "left" | "center" | "right";
    name: string;
    order: number;
    width: number;
    height: number;
    logical: string;
    image: string;
  }[] = [
    {
      key: "left",
      name: "HyperX Stage Left",
      order: 0,
      width: 1152,
      height: 1920,
      logical: "LeftSidebar",
      image: BATTLE_LOCO_IMAGES.competitors,
    },
    {
      key: "center",
      name: "HyperX Stage Center",
      order: 1,
      width: 1920,
      height: 1080,
      logical: "MainContent",
      image: BATTLE_LOCO_IMAGES.hero,
    },
    {
      key: "right",
      name: "HyperX Stage Right",
      order: 2,
      width: 1152,
      height: 1920,
      logical: "RightSidebar",
      image: BATTLE_LOCO_IMAGES.crowd,
    },
  ];

  const screenIds = {} as {
    left: Id<"screens">;
    center: Id<"screens">;
    right: Id<"screens">;
  };
  const panelByLogical: Record<string, Id<"panels">> = {};

  for (const spec of screenSpecs) {
    const screenId = await ctx.db.insert("screens", {
      layoutId,
      name: spec.name,
      order: spec.order,
      width: spec.width,
      height: spec.height,
    });
    screenIds[spec.key] = screenId;
    // Full-bleed panel covering the LED canvas.
    panelByLogical[spec.logical] = await ctx.db.insert("panels", {
      screenId,
      name: spec.name,
      zIndex: 0,
      points: [
        { x: 0, y: 0 },
        { x: spec.width, y: 0 },
        { x: spec.width, y: spec.height },
        { x: 0, y: spec.height },
      ],
    });
  }

  const showId = await ctx.db.insert("shows", {
    title: "Battle Loco",
    description:
      "HyperX Arena · Luxor — Intro, Bring the Boom, and branded Outro lockups.",
    tag: "battleloco",
    status: "live",
    currentSceneIndex: 0,
    sceneStartedAt: Date.now(),
    layoutId,
    ownerId,
  });

  const introId = await ctx.db.insert("scenes", {
    showId,
    order: 0,
    title: "Intro",
    kind: "panels",
    content: "",
    durationSec: 120,
  });

  for (const spec of screenSpecs) {
    await ctx.db.insert("effects", {
      sceneId: introId,
      panelId: panelByLogical[spec.logical],
      logicalPanelName: spec.logical,
      kind: "image",
      content: spec.image,
      startTime: 0,
      isEnabled: true,
    });
  }

  // Migrated “Bring the Boom” — one video per LED wall.
  const boomId = await ctx.db.insert("scenes", {
    showId,
    order: 1,
    title: "Bring the Boom",
    kind: "panels",
    content: "",
    durationSec: 60,
  });
  const boomByLogical: Record<string, string> = {
    LeftSidebar: BATTLE_LOCO_BOOM_VIDEOS.left,
    MainContent: BATTLE_LOCO_BOOM_VIDEOS.center,
    RightSidebar: BATTLE_LOCO_BOOM_VIDEOS.right,
  };
  for (const spec of screenSpecs) {
    await ctx.db.insert("effects", {
      sceneId: boomId,
      panelId: panelByLogical[spec.logical],
      logicalPanelName: spec.logical,
      kind: "video",
      content: boomByLogical[spec.logical],
      startTime: 0,
      isEnabled: true,
    });
  }

  // Outro — branded LED stills with BATTLE LOCO in the artwork.
  const outroId = await ctx.db.insert("scenes", {
    showId,
    order: 2,
    title: "Outro",
    kind: "panels",
    content: "",
    durationSec: 90,
  });
  const outroByLogical: Record<string, string> = {
    LeftSidebar: BATTLE_LOCO_OUTRO_IMAGES.left,
    MainContent: BATTLE_LOCO_OUTRO_IMAGES.center,
    RightSidebar: BATTLE_LOCO_OUTRO_IMAGES.right,
  };
  for (const spec of screenSpecs) {
    await ctx.db.insert("effects", {
      sceneId: outroId,
      panelId: panelByLogical[spec.logical],
      logicalPanelName: spec.logical,
      kind: "image",
      content: outroByLogical[spec.logical],
      startTime: 0,
      isEnabled: true,
    });
  }

  const profileId = await ctx.db.insert("displayProfiles", {
    name: "HyperX Arena",
    description:
      "Stage Left / Center / Right LED walls at HyperX Arena (Luxor).",
    showId,
    layoutId,
    isDefault: true,
    ownerId,
  });
  const keyFills = await ensureRossKeyFillsOnHyperX(ctx);
  Object.assign(panelByLogical, keyFills);

  for (const spec of screenSpecs) {
    await ctx.db.insert("panelMappings", {
      displayProfileId: profileId,
      logicalPanelName: spec.logical,
      panelId: panelByLogical[spec.logical],
    });
  }
  for (const logical of KEY_FILL_LOGICALS) {
    const panelId = panelByLogical[logical];
    if (!panelId) continue;
    await upsertLogicalMapping(ctx, profileId, logical, panelId);
  }

  await insertCueScenesOnShow(
    ctx,
    showId,
    panelByLogical,
    performanceCuesFor(
      requireLoco("battleloco"),
      {
        hero: BATTLE_LOCO_IMAGES.hero,
        side: BATTLE_LOCO_IMAGES.competitors,
        crowd: BATTLE_LOCO_IMAGES.crowd,
      },
      BATTLE_LOCO_BOOM_VIDEOS.center,
    ),
    "Heat 0 – 0 Ice",
    "battle-loco",
  );

  await ensurePhoneScreenOnShow(ctx, showId);
  await applyHyperXSwitcherOnShow(ctx, showId, "battle-loco");

  return { showId, layoutId, screenIds };
}

/** Shared HyperX Arena walls (Battle Loco + Wrestle Loco). */
async function hyperXArenaFor(ctx: MutationCtx): Promise<{
  layoutId: Id<"layouts">;
  panelByLogical: Record<string, Id<"panels">>;
  screenIds: {
    left: Id<"screens">;
    center: Id<"screens">;
    right: Id<"screens">;
    phone?: Id<"screens">;
  };
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
  const phone = screens.find((s) => s.name.toLowerCase() === "phone");
  const lp = await panelOf(left);
  const cp = await panelOf(center);
  const rp = await panelOf(right);
  const pp = await panelOf(phone);
  if (!left || !center || !right || !lp || !cp || !rp) return null;
  const panelByLogical: Record<string, Id<"panels">> = {
    LeftSidebar: lp,
    MainContent: cp,
    RightSidebar: rp,
  };
  if (pp) panelByLogical.Phone = pp;
  const keyFills = screens.find((s) => s.name === ROSS_KEY_FILLS_SCREEN);
  if (keyFills) {
    const fillPanels = await ctx.db
      .query("panels")
      .withIndex("by_screen", (q) => q.eq("screenId", keyFills._id))
      .collect();
    for (const panel of fillPanels) {
      if (KEY_FILL_LOGICAL_SET.has(panel.name)) {
        panelByLogical[panel.name] = panel._id;
      }
    }
  }
  return {
    layoutId: layout._id,
    panelByLogical,
    screenIds: {
      left: left._id,
      center: center._id,
      right: right._id,
      ...(phone ? { phone: phone._id } : {}),
    },
  };
}

/** Point an existing show at HyperX Left / Center / Right / Phone. */
async function bindShowToHyperX(ctx: MutationCtx, showId: Id<"shows">) {
  const hyperx = await hyperXArenaFor(ctx);
  if (!hyperx) return { bound: false as const };
  const show = await ctx.db.get(showId);
  if (!show) return { bound: false as const };

  await ctx.db.patch(showId, { layoutId: hyperx.layoutId });

  const profiles = await ctx.db
    .query("displayProfiles")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();
  for (const profile of profiles) {
    await ctx.db.patch(profile._id, {
      layoutId: hyperx.layoutId,
      name: "HyperX Arena",
      description:
        "HyperX Stage Left / Center / Right + Phone — shared with Battle Loco.",
    });
    const mappings = await ctx.db
      .query("panelMappings")
      .withIndex("by_profile", (q) => q.eq("displayProfileId", profile._id))
      .collect();
    for (const m of mappings) await ctx.db.delete(m._id);
    for (const [logical, panelId] of Object.entries(hyperx.panelByLogical)) {
      await ctx.db.insert("panelMappings", {
        displayProfileId: profile._id,
        logicalPanelName: logical,
        panelId,
      });
    }
  }

  const scenes = await ctx.db
    .query("scenes")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();
  let retargeted = 0;
  for (const scene of scenes) {
    const effects = await ctx.db
      .query("effects")
      .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
      .collect();
    for (const e of effects) {
      const next = e.logicalPanelName
        ? hyperx.panelByLogical[e.logicalPanelName]
        : undefined;
      if (next && next !== e.panelId) {
        await ctx.db.patch(e._id, { panelId: next });
        retargeted++;
      }
    }
  }

  return {
    bound: true as const,
    layoutId: hyperx.layoutId,
    retargeted,
    ...hyperx.screenIds,
  };
}

function bitKindForRoundType(roundType: string): "bit" | "sketch" {
  return roundType.toLowerCase().includes("sketch") ? "sketch" : "bit";
}

const HEAD_CANVAS = { width: 1080, height: 1920 } as const;

/** Dedicated HeadCase output — one screen named Head, not HyperX. */
async function ensureHeadLayout(
  ctx: MutationCtx,
  ownerId: Id<"users">,
): Promise<{
  layoutId: Id<"layouts">;
  panelId: Id<"panels">;
  screenId: Id<"screens">;
}> {
  const layouts = await ctx.db.query("layouts").collect();
  let layout = layouts.find(
    (l) => l.name === "Head" || l.name === "HeadCase",
  );
  if (!layout) {
    const layoutId = await ctx.db.insert("layouts", {
      name: "Head",
      ownerId,
    });
    layout = (await ctx.db.get(layoutId))!;
  }
  const screens = await ctx.db
    .query("screens")
    .withIndex("by_layout", (q) => q.eq("layoutId", layout._id))
    .collect();
  let screen = screens.find((s) => s.name.toLowerCase() === "head");
  if (!screen) {
    const order = screens.reduce((m, s) => Math.max(m, s.order), -1) + 1;
    const screenId = await ctx.db.insert("screens", {
      layoutId: layout._id,
      name: "Head",
      order,
      width: HEAD_CANVAS.width,
      height: HEAD_CANVAS.height,
    });
    screen = (await ctx.db.get(screenId))!;
  }
  const panels = await ctx.db
    .query("panels")
    .withIndex("by_screen", (q) => q.eq("screenId", screen._id))
    .collect();
  let panelId = panels[0]?._id;
  if (!panelId) {
    panelId = await ctx.db.insert("panels", {
      screenId: screen._id,
      name: "Head",
      zIndex: 0,
      points: [
        { x: 0, y: 0 },
        { x: HEAD_CANVAS.width, y: 0 },
        { x: HEAD_CANVAS.width, y: HEAD_CANVAS.height },
        { x: 0, y: HEAD_CANVAS.height },
      ],
    });
  }
  return { layoutId: layout._id, panelId, screenId: screen._id };
}

async function bindHeadCaseShowsToHead(
  ctx: MutationCtx,
  ownerId: Id<"users">,
) {
  const head = await ensureHeadLayout(ctx, ownerId);
  const shows = (await ctx.db.query("shows").collect()).filter(
    (s) =>
      s.tag === "headcase" && (s.kind === "bit" || s.kind === "sketch"),
  );
  let bound = 0;
  for (const show of shows) {
    await ctx.db.patch(show._id, { layoutId: head.layoutId });
    const profiles = await ctx.db
      .query("displayProfiles")
      .withIndex("by_show", (q) => q.eq("showId", show._id))
      .collect();
    if (profiles.length === 0) {
      const profileId = await ctx.db.insert("displayProfiles", {
        name: "Head",
        description: "HeadCase output — screen Head.",
        showId: show._id,
        layoutId: head.layoutId,
        isDefault: true,
        ownerId,
      });
      await ctx.db.insert("panelMappings", {
        displayProfileId: profileId,
        logicalPanelName: "MainContent",
        panelId: head.panelId,
      });
    } else {
      for (const profile of profiles) {
        await ctx.db.patch(profile._id, {
          layoutId: head.layoutId,
          name: "Head",
          description: "HeadCase output — screen Head.",
        });
        const mappings = await ctx.db
          .query("panelMappings")
          .withIndex("by_profile", (q) =>
            q.eq("displayProfileId", profile._id),
          )
          .collect();
        for (const m of mappings) await ctx.db.delete(m._id);
        await ctx.db.insert("panelMappings", {
          displayProfileId: profile._id,
          logicalPanelName: "MainContent",
          panelId: head.panelId,
        });
      }
    }
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", show._id))
      .collect();
    for (const scene of scenes) {
      const effects = await ctx.db
        .query("effects")
        .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
        .collect();
      for (const e of effects) {
        if (
          e.logicalPanelName === "LeftSidebar" ||
          e.logicalPanelName === "RightSidebar" ||
          e.logicalPanelName === "Phone"
        ) {
          await ctx.db.delete(e._id);
          continue;
        }
        if (e.panelId !== head.panelId) {
          await ctx.db.patch(e._id, {
            panelId: head.panelId,
            logicalPanelName: "MainContent",
          });
        }
      }
    }
    bound++;
  }
  let cameras = 0;
  for (const show of shows) {
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", show._id))
      .collect();
    scenes.sort((a, b) => a.order - b.order);
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]!;
      const effects = await ctx.db
        .query("effects")
        .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
        .collect();
      if (!effects.some((e) => e.kind === "camera")) {
        await ctx.db.insert("effects", {
          sceneId: scene._id,
          panelId: head.panelId,
          logicalPanelName: "MainContent",
          kind: "camera",
          content: "live",
          startTime: 0,
          isEnabled: true,
        });
        cameras++;
      }
      for (const e of effects) {
        if (
          e.kind === "command" &&
          e.content.toLowerCase().startsWith("key:")
        ) {
          await ctx.db.patch(e._id, {
            kind: "hotkey",
            content: e.content.replace(/^key:\s*/i, ""),
          });
        }
      }
      const after = await ctx.db
        .query("effects")
        .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
        .collect();
      if (!after.some((e) => e.kind === "hotkey")) {
        await ctx.db.insert("effects", {
          sceneId: scene._id,
          kind: "hotkey",
          content: `ctrl+${(i % 9) + 1}`,
          startTime: 0,
          isEnabled: true,
        });
      }
    }
  }
  return { bound, cameras, screenId: head.screenId, layoutId: head.layoutId };
}

/** One Show per catalog bit/sketch (jokes = scenes, gags = effects). */
async function insertBitLibrary(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  loco: LocoConfig,
) {
  const head =
    loco.tag === "headcase" ? await ensureHeadLayout(ctx, ownerId) : null;
  const hyperx = loco.tag === "headcase" ? null : await hyperXArenaFor(ctx);
  const existing = (await ctx.db.query("shows").collect()).filter(
    (s) =>
      s.tag === loco.tag && (s.kind === "bit" || s.kind === "sketch"),
  );
  const have = new Set(existing.map((s) => s.title.toLowerCase()));
  const ids: Record<string, Id<"shows">> = {};
  for (const s of existing) ids[s.title] = s._id;

  let added = 0;
  for (const spec of loco.catalog) {
    if (have.has(spec.name.toLowerCase())) continue;
    const kind = bitKindForRoundType(spec.roundType);
    const layoutId = head?.layoutId ?? hyperx?.layoutId;
    const showId = await ctx.db.insert("shows", {
      title: spec.name,
      description: spec.description,
      tag: loco.tag,
      kind,
      roundType: spec.roundType,
      status: "draft",
      currentSceneIndex: 0,
      layoutId,
      ownerId,
    });
    if (head) {
      const profileId = await ctx.db.insert("displayProfiles", {
        name: "Head",
        description: "HeadCase output — screen Head.",
        showId,
        layoutId: head.layoutId,
        isDefault: true,
        ownerId,
      });
      await ctx.db.insert("panelMappings", {
        displayProfileId: profileId,
        logicalPanelName: "MainContent",
        panelId: head.panelId,
      });
    } else if (hyperx) {
      const profileId = await ctx.db.insert("displayProfiles", {
        name: "HyperX Arena",
        description:
          "HyperX Stage Left / Center / Right + Phone — shared with Battle Loco.",
        showId,
        layoutId: hyperx.layoutId,
        isDefault: true,
        ownerId,
      });
      for (const [logical, panelId] of Object.entries(hyperx.panelByLogical)) {
        await ctx.db.insert("panelMappings", {
          displayProfileId: profileId,
          logicalPanelName: logical,
          panelId,
        });
      }
    }
    const jokes = [
      { title: "Setup", text: spec.description },
      { title: "Turn", text: spec.suggestions || spec.shortDescription },
      { title: "Button", text: spec.shortDescription },
    ];
    const mainPanel = head?.panelId ?? hyperx?.panelByLogical.MainContent;
    for (let i = 0; i < jokes.length; i++) {
      const sceneId = await ctx.db.insert("scenes", {
        showId,
        order: i,
        title: jokes[i].title,
        kind: "panels",
        content: "",
        durationSec: 60,
      });
      if (mainPanel) {
        await ctx.db.insert("effects", {
          sceneId,
          panelId: mainPanel,
          logicalPanelName: "MainContent",
          kind: "text",
          content: jokes[i].text,
          startTime: 0,
          isEnabled: true,
        });
        if (head) {
          await ctx.db.insert("effects", {
            sceneId,
            panelId: mainPanel,
            logicalPanelName: "MainContent",
            kind: "camera",
            content: "live",
            startTime: 0,
            isEnabled: true,
          });
          await ctx.db.insert("effects", {
            sceneId,
            kind: "hotkey",
            content: `ctrl+${i + 1}`,
            startTime: 0,
            isEnabled: true,
          });
        }
      }
      if (!head && hyperx) {
        const putColor = async (logical: string) => {
          const panelId = hyperx.panelByLogical[logical];
          if (!panelId) return;
          await ctx.db.insert("effects", {
            sceneId,
            panelId,
            logicalPanelName: logical,
            kind: "color",
            content: "#1e1b4b",
            startTime: 0,
            isEnabled: true,
          });
        };
        await putColor("LeftSidebar");
        await putColor("RightSidebar");
      }
    }
    if (!head) await ensurePhoneScreenOnShow(ctx, showId);
    ids[spec.name] = showId;
    added++;
  }
  return { added, ids };
}

async function bindSetlistRowsToBits(
  ctx: MutationCtx,
  tag: string,
  ids: Record<string, Id<"shows">>,
) {
  const performances = await ctx.db.query("performances").collect();
  let bound = 0;
  for (const p of performances) {
    if (rowTag(p.tag) !== tag) continue;
    const rows = await ctx.db
      .query("performanceGames")
      .withIndex("by_performance", (q) => q.eq("performanceId", p._id))
      .collect();
    const byName = new Map(
      Object.entries(ids).map(([name, id]) => [name.toLowerCase(), id]),
    );
    const shows = await ctx.db.query("shows").collect();
    const library = shows.filter(
      (s) =>
        (s.tag === tag || (tag === "homeshow" && isHomeShowHolidayTag(s.tag))) &&
        (s.kind === "bit" || s.kind === "sketch") &&
        ids[s.title],
    );
    const used = new Set(
      rows.map((r) => r.bitShowId).filter(Boolean) as Id<"shows">[],
    );
    for (const row of rows) {
      if (row.bitShowId) continue;
      let showId = row.gameName
        ? byName.get(row.gameName.toLowerCase())
        : undefined;
      if (!showId && row.gameId) {
        const catalog = await ctx.db.get(row.gameId);
        if (catalog) showId = byName.get(catalog.name.toLowerCase());
      }
      if (!showId) {
        const match = library.find(
          (s) =>
            !used.has(s._id) &&
            (!s.roundType ||
              s.roundType.toLowerCase() === row.roundType.toLowerCase()),
        );
        showId = match?._id;
      }
      if (!showId) continue;
      used.add(showId);
      const title =
        Object.entries(ids).find(([, id]) => id === showId)?.[0] ??
        row.gameName;
      await ctx.db.patch(row._id, {
        bitShowId: showId,
        ...(title ? { gameName: title } : {}),
      });
      bound++;
    }
  }
  return bound;
}

/** Tag leftover imported HeadCase/LaffUp shows as sketches (one show, many jokes). */
async function tagImportedSketchShows(ctx: MutationCtx) {
  const night = /night|performance|mic|championship/i;
  const shows = await ctx.db.query("shows").collect();
  let tagged = 0;
  for (const show of shows) {
    if (show.kind) continue;
    if (show.tag !== "headcase" && show.tag !== "laffup") continue;
    if (night.test(show.title)) continue;
    await ctx.db.patch(show._id, {
      kind: "sketch",
      roundType: show.tag === "laffup" ? "Set" : "Sketch",
    });
    tagged++;
  }
  return tagged;
}

/**
 * Wrestle Loco on the HyperX Arena walls (same screens as Battle Loco)
 * when that layout exists; otherwise a standalone Wrestle Ring.
 */
async function insertWrestleLoco(
  ctx: MutationCtx,
  ownerId: Id<"users">,
): Promise<{
  showId: Id<"shows">;
  layoutId: Id<"layouts">;
  screenIds: {
    left: Id<"screens">;
    center: Id<"screens">;
    right: Id<"screens">;
  };
}> {
  const screenSpecs: {
    key: "left" | "center" | "right";
    name: string;
    order: number;
    width: number;
    height: number;
    logical: string;
    image: string;
  }[] = [
    {
      key: "left",
      name: "HyperX Stage Left",
      order: 0,
      width: 1152,
      height: 1920,
      logical: "LeftSidebar",
      image: WRESTLE_LOCO_IMAGES.faces,
    },
    {
      key: "center",
      name: "HyperX Stage Center",
      order: 1,
      width: 1920,
      height: 1080,
      logical: "MainContent",
      image: WRESTLE_LOCO_IMAGES.hero,
    },
    {
      key: "right",
      name: "HyperX Stage Right",
      order: 2,
      width: 1152,
      height: 1920,
      logical: "RightSidebar",
      image: WRESTLE_LOCO_IMAGES.crowd,
    },
  ];

  await ensureRossKeyFillsOnHyperX(ctx);
  const existingHyperX = await hyperXArenaFor(ctx);
  let layoutId: Id<"layouts">;
  let panelByLogical: Record<string, Id<"panels">>;
  let screenIds: {
    left: Id<"screens">;
    center: Id<"screens">;
    right: Id<"screens">;
  };

  if (existingHyperX) {
    layoutId = existingHyperX.layoutId;
    panelByLogical = existingHyperX.panelByLogical;
    screenIds = {
      left: existingHyperX.screenIds.left,
      center: existingHyperX.screenIds.center,
      right: existingHyperX.screenIds.right,
    };
  } else {
    layoutId = await ctx.db.insert("layouts", {
      name: "HyperX Arena",
      ownerId,
    });
    screenIds = {} as {
      left: Id<"screens">;
      center: Id<"screens">;
      right: Id<"screens">;
    };
    panelByLogical = {};
    for (const spec of screenSpecs) {
      const screenId = await ctx.db.insert("screens", {
        layoutId,
        name: spec.name,
        order: spec.order,
        width: spec.width,
        height: spec.height,
      });
      screenIds[spec.key] = screenId;
      panelByLogical[spec.logical] = await ctx.db.insert("panels", {
        screenId,
        name: spec.name,
        zIndex: 0,
        points: [
          { x: 0, y: 0 },
          { x: spec.width, y: 0 },
          { x: spec.width, y: spec.height },
          { x: 0, y: spec.height },
        ],
      });
    }
  }

  const showId = await ctx.db.insert("shows", {
    title: "Wrestle Loco",
    description:
      "HyperX Arena — Opening Bell, Hit the Bell, and branded Outro lockups.",
    tag: "wrestleloco",
    status: "live",
    currentSceneIndex: 0,
    layoutId,
    ownerId,
  });

  const walkId = await ctx.db.insert("scenes", {
    showId,
    order: 0,
    title: "Opening Bell",
    kind: "panels",
    content: "",
    durationSec: 90,
  });
  for (const spec of screenSpecs) {
    await ctx.db.insert("effects", {
      sceneId: walkId,
      panelId: panelByLogical[spec.logical],
      logicalPanelName: spec.logical,
      kind: "image",
      content: spec.image,
      startTime: 0,
      isEnabled: true,
    });
  }

  const bellId = await ctx.db.insert("scenes", {
    showId,
    order: 1,
    title: WRESTLE_CELEBRATION_CUE,
    kind: "panels",
    content: "",
    durationSec: 60,
  });
  const bellByLogical: Record<string, string> = {
    LeftSidebar: WRESTLE_LOCO_BELL_VIDEOS.left,
    MainContent: WRESTLE_LOCO_BELL_VIDEOS.center,
    RightSidebar: WRESTLE_LOCO_BELL_VIDEOS.right,
  };
  for (const spec of screenSpecs) {
    await ctx.db.insert("effects", {
      sceneId: bellId,
      panelId: panelByLogical[spec.logical],
      logicalPanelName: spec.logical,
      kind: "video",
      content: bellByLogical[spec.logical],
      startTime: 0,
      isEnabled: true,
    });
  }

  const outroId = await ctx.db.insert("scenes", {
    showId,
    order: 2,
    title: "Outro",
    kind: "panels",
    content: "",
    durationSec: 90,
  });
  const outroByLogical: Record<string, string> = {
    LeftSidebar: WRESTLE_LOCO_OUTRO_IMAGES.left,
    MainContent: WRESTLE_LOCO_OUTRO_IMAGES.center,
    RightSidebar: WRESTLE_LOCO_OUTRO_IMAGES.right,
  };
  for (const spec of screenSpecs) {
    await ctx.db.insert("effects", {
      sceneId: outroId,
      panelId: panelByLogical[spec.logical],
      logicalPanelName: spec.logical,
      kind: "image",
      content: outroByLogical[spec.logical],
      startTime: 0,
      isEnabled: true,
    });
  }

  const keyFills = await ensureRossKeyFillsOnHyperX(ctx);
  Object.assign(panelByLogical, keyFills);

  const profileId = await ctx.db.insert("displayProfiles", {
    name: "HyperX Arena",
    description:
      "HyperX Stage Left / Center / Right + Phone — shared with Battle Loco.",
    showId,
    layoutId,
    isDefault: true,
    ownerId,
  });
  for (const spec of screenSpecs) {
    await ctx.db.insert("panelMappings", {
      displayProfileId: profileId,
      logicalPanelName: spec.logical,
      panelId: panelByLogical[spec.logical],
    });
  }
  if (panelByLogical.Phone) {
    await ctx.db.insert("panelMappings", {
      displayProfileId: profileId,
      logicalPanelName: "Phone",
      panelId: panelByLogical.Phone,
    });
  }
  for (const logical of KEY_FILL_LOGICALS) {
    const panelId = panelByLogical[logical];
    if (!panelId) continue;
    await upsertLogicalMapping(ctx, profileId, logical, panelId);
  }

  await insertCueScenesOnShow(
    ctx,
    showId,
    panelByLogical,
    performanceCuesFor(
      requireLoco("wrestleloco"),
      {
        hero: WRESTLE_LOCO_IMAGES.hero,
        side: WRESTLE_LOCO_IMAGES.faces,
        crowd: WRESTLE_LOCO_IMAGES.crowd,
      },
      WRESTLE_LOCO_BELL_VIDEOS.center,
    ),
    "Faces 0 – 0 Heels",
    "wrestle-loco",
  );

  await ensurePhoneScreenOnShow(ctx, showId);
  await applyHyperXSwitcherOnShow(ctx, showId, "wrestle-loco");

  return { showId, layoutId, screenIds };
}

/** Generic F&B venue — not tied to a loco. Additive-safe helper. */
async function seedVenueService(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  opts: { name: string; layoutId?: Id<"layouts"> },
) {
  const existing = await ctx.db.query("venues").collect();
  if (existing.length > 0) return existing[0]!._id;

  const venueId = await ctx.db.insert("venues", {
    name: opts.name,
    layoutId: opts.layoutId,
    phoneOrdering: true,
    phoneAsScreen: true,
    tabletOrdering: true,
    tabletAsScreen: true,
    ownerId,
  });

  const places: Array<{
    name: string;
    kind: "seat" | "zone" | "booth" | "pickup";
    code: string;
  }> = [
    { name: "GA Left", kind: "zone", code: "L" },
    { name: "GA Center", kind: "zone", code: "C" },
    { name: "GA Right", kind: "zone", code: "R" },
    { name: "Bar pickup", kind: "pickup", code: "BAR" },
  ];
  for (let i = 1; i <= 12; i++) {
    places.push({ name: `Seat ${i}`, kind: "seat", code: String(i) });
  }
  for (let i = 1; i <= 4; i++) {
    places.push({ name: `Booth ${i}`, kind: "booth", code: `B${i}` });
  }
  for (let i = 0; i < places.length; i++) {
    await ctx.db.insert("places", {
      venueId,
      name: places[i]!.name,
      kind: places[i]!.kind,
      code: places[i]!.code,
      order: i,
    });
  }

  const menu: Array<{
    name: string;
    description: string;
    priceCents: number;
    category: string;
  }> = [
    { name: "House beer", description: "Draft pint", priceCents: 800, category: "Drinks" },
    { name: "House wine", description: "Red or white", priceCents: 1000, category: "Drinks" },
    { name: "Soda", description: "Coke, sprite, water", priceCents: 400, category: "Drinks" },
    { name: "Pretzel", description: "Salted, mustard on the side", priceCents: 700, category: "Food" },
    { name: "Nachos", description: "Chips, cheese, jalapeños", priceCents: 1100, category: "Food" },
  ];
  for (let i = 0; i < menu.length; i++) {
    await ctx.db.insert("menuItems", {
      venueId,
      ...menu[i]!,
      isAvailable: true,
      sort: i,
    });
  }
  return venueId;
}

// ---------------------------------------------------------------- brands

export const surroundshow = mutation({
  args: {},
  handler: async (ctx) => {
    await clearAll(ctx);

    const users = await insertUsers(ctx, [
      { name: "Ava Winters", handle: "ava", bio: "Holiday show designer. My yard is famous in three counties.", tier: "admin" },
      { name: "Max Chen", handle: "maxc", bio: "Projection mapping nerd.", tier: "gold" },
      { name: "Priya Natarajan", handle: "priya", bio: "Sells the best snowfall loops on the marketplace.", tier: "silver" },
      { name: "Tom Delgado", handle: "tomd", bio: "First Halloween show this year, send help.", tier: "free" },
      { name: "June Park", handle: "june", bio: "Screens on every window since 2019.", tier: "silver" },
    ]);

    const groups = await insertGroups(
      ctx,
      [
        // Holiday set mirrors production surroundshow.com groupChat (SiteId 1).
        // leftmenu 1 = Top, 2 = Hot — same assignments as live.
        { name: "4th of July", description: "Fireworks, flags and summer night projection shows.", kind: "public", category: "july4" },
        { name: "Christmas", description: "Holiday show scenes, loops and projection ideas.", kind: "public", leftmenu: 1, category: "christmas" },
        { name: "Easter", description: "Spring holiday projections and pastel palettes.", kind: "public", category: "easter" },
        { name: "Halloween", description: "Spooky yards, haunted windows and fright-night playlists.", kind: "public", leftmenu: 1, category: "halloween" },
        { name: "Mardi Gras", description: "Beads, brass bands and balcony vibes.", kind: "public", category: "mardigras" },
        { name: "New Year's", description: "Countdown scenes and midnight party screens.", kind: "public", leftmenu: 2, category: "newyear" },
        { name: "St. Pats", description: "Green lights, shamrocks and parade energy.", kind: "public", category: "stpatricks" },
        { name: "Thanksgiving", description: "Autumn ambience and gratitude-themed shows.", kind: "public", leftmenu: 2, category: "thanksgiving" },
        { name: "Valentine's", description: "Romantic scenes for date-night displays.", kind: "public", category: "valentines" },
        { name: "Holiday Show Producers", description: "Share setups, timing tricks and playlists for the big nights.", kind: "public" },
        { name: "Screen Designers", description: "Scene design critiques and template swaps.", kind: "public" },
        { name: "Marketplace Sellers", description: "For creators selling scenes, loops and effect packs.", kind: "private" },
      ] as GroupSpec[],
      users,
    );

    await insertPosts(
      ctx,
      [
        { content: "Halloween Spooktacular is LIVE tonight at 8pm — tune your screens to the show page!", groupIndex: 3 },
        { content: "Just published a new fog-and-lightning loop to the marketplace. Feedback welcome.", groupIndex: 11 },
        { content: "What projector are people using for garage-door scenes?", groupIndex: 9 },
        { content: "Scene pacing tip: never hold a static image longer than 20 seconds.", groupIndex: 10 },
        { content: "Countdown template for New Year is ready — grab it before the 31st!", groupIndex: 5 },
        { content: "Christmas garage-door scene is looking incredible this year!", groupIndex: 1 },
      ],
      users,
      groups,
    );

    await insertShow(ctx, {
      title: "Halloween Spooktacular",
      description: "A three-window synchronized haunt: ghosts, storms and a singing pumpkin finale.",
      tag: "halloween",
      status: "live",
      owner: users[0],
      scenes: [
        { title: "Opening", kind: "title", content: "The Haunting Begins…" },
        { title: "Ghost Window", kind: "image", content: img("ghost-window") },
        { title: "Storm", kind: "text", content: "Thunder rolls. Lightning flashes across every screen." },
        { title: "Pumpkin Finale", kind: "image", content: img("pumpkin-finale") },
      ],
    });

    // --- Designer demo: Garage screen with panels + a panel-based show ---
    const layoutId = await ctx.db.insert("layouts", {
      name: "Home Front",
      ownerId: users[0],
    });
    const garageId = await ctx.db.insert("screens", {
      layoutId,
      name: "Garage",
      order: 0,
      width: 800,
      height: 600,
    });
    const porchId = await ctx.db.insert("screens", {
      layoutId,
      name: "Porch",
      order: 1,
      width: 800,
      height: 600,
    });
    const panelSpecs: [string, Id<"screens">, number, { x: number; y: number }[]][] = [
      ["Garage Triangle", garageId, 0, [{ x: 160, y: 230 }, { x: 640, y: 230 }, { x: 400, y: 100 }]],
      ["Garage Top Left", garageId, 1, [{ x: 60, y: 220 }, { x: 400, y: 50 }, { x: 400, y: 90 }, { x: 120, y: 240 }]],
      ["Garage Top Right", garageId, 2, [{ x: 400, y: 50 }, { x: 740, y: 220 }, { x: 680, y: 240 }, { x: 400, y: 90 }]],
      ["Column Left", garageId, 3, [{ x: 180, y: 250 }, { x: 240, y: 250 }, { x: 240, y: 560 }, { x: 180, y: 560 }]],
      ["Column Right", garageId, 4, [{ x: 560, y: 250 }, { x: 620, y: 250 }, { x: 620, y: 560 }, { x: 560, y: 560 }]],
      ["Garage Door", garageId, 5, [{ x: 270, y: 310 }, { x: 530, y: 310 }, { x: 530, y: 540 }, { x: 270, y: 540 }]],
      ["Porch Window", porchId, 0, [{ x: 120, y: 140 }, { x: 680, y: 140 }, { x: 680, y: 460 }, { x: 120, y: 460 }]],
      ["Porch Banner", porchId, 1, [{ x: 80, y: 480 }, { x: 720, y: 480 }, { x: 720, y: 560 }, { x: 80, y: 560 }]],
    ];
    const panelIds: Record<string, Id<"panels">> = {};
    for (const [name, screenId, zIndex, points] of panelSpecs) {
      panelIds[name] = await ctx.db.insert("panels", {
        screenId,
        name,
        zIndex,
        points,
      });
    }

    // Logical slot → physical panel (legacy DisplayProfile / PanelMapping).
    const garageLogical: Record<string, string> = {
      Background: "Garage Triangle",
      Header: "Garage Top Left",
      Overlay: "Garage Top Right",
      LeftSidebar: "Column Left",
      RightSidebar: "Column Right",
      MainContent: "Garage Door",
      SecondaryContent: "Porch Window",
      Footer: "Porch Banner",
    };

    const christmasShowId = await ctx.db.insert("shows", {
      title: "Christmas",
      description: "Six-scene garage projection show: candy-stripe roof, video door, glowing gable.",
      tag: "christmas",
      status: "draft",
      currentSceneIndex: 0,
      layoutId,
      ownerId: users[0],
    });
    // Full LinkAll8 Christmas garage effects (YouTube, GIFs, timed Grinch colors).
    const christmasTitles = [
      "I Wish It Was Christmas Today",
      "Elf Clip",
      "Grinch Pentatonix",
      "Christmas Mom",
      "Christmas Tree",
      "Beat Saber",
    ];
    for (let s = 0; s < christmasMikeScenes.length; s++) {
      const mike = christmasMikeScenes[s];
      const sceneId = await ctx.db.insert("scenes", {
        showId: christmasShowId,
        order: s,
        title: christmasTitles[s] ?? mike.title,
        kind: "panels",
        content: "",
        durationSec: mike.durationSec,
      });
      for (const effect of mike.effects) {
        const panelId = panelIds[effect.panelName];
        if (!panelId) continue;
        await ctx.db.insert("effects", {
          sceneId,
          panelId,
          logicalPanelName: effect.logicalPanelName,
          kind: effect.kind,
          content: effect.content,
          startTime: effect.startTime,
          isEnabled: true,
          ...(effect.videoStartSec !== undefined
            ? { videoStartSec: effect.videoStartSec }
            : {}),
        });
      }
    }

    const garageProfileId = await ctx.db.insert("displayProfiles", {
      name: "Home Front (default)",
      description: "Garage + porch projection mapping for the Christmas show.",
      showId: christmasShowId,
      layoutId,
      isDefault: true,
      ownerId: users[0],
    });
    for (const [logical, panelName] of Object.entries(garageLogical)) {
      await ctx.db.insert("panelMappings", {
        displayProfileId: garageProfileId,
        logicalPanelName: logical,
        panelId: panelIds[panelName],
      });
    }

    // Alternate layout + profile: retarget the same logical slots indoors.
    const livingLayoutId = await ctx.db.insert("layouts", {
      name: "Living Room",
      ownerId: users[0],
    });
    const livingScreenId = await ctx.db.insert("screens", {
      layoutId: livingLayoutId,
      name: "TV Wall",
      order: 0,
      width: 1920,
      height: 1080,
    });
    const livingPanelSpecs: [string, number, { x: number; y: number }[]][] = [
      ["Wall", 0, [{ x: 0, y: 0 }, { x: 1920, y: 0 }, { x: 1920, y: 1080 }, { x: 0, y: 1080 }]],
      ["TV", 1, [{ x: 360, y: 180 }, { x: 1560, y: 180 }, { x: 1560, y: 900 }, { x: 360, y: 900 }]],
      ["Mantel Left", 2, [{ x: 80, y: 200 }, { x: 320, y: 200 }, { x: 320, y: 880 }, { x: 80, y: 880 }]],
      ["Mantel Right", 3, [{ x: 1600, y: 200 }, { x: 1840, y: 200 }, { x: 1840, y: 880 }, { x: 1600, y: 880 }]],
      ["Shelf", 4, [{ x: 400, y: 40 }, { x: 1520, y: 40 }, { x: 1520, y: 140 }, { x: 400, y: 140 }]],
    ];
    const livingPanelIds: Record<string, Id<"panels">> = {};
    for (const [name, zIndex, points] of livingPanelSpecs) {
      livingPanelIds[name] = await ctx.db.insert("panels", {
        screenId: livingScreenId,
        name,
        zIndex,
        points,
      });
    }
    const livingLogical: Record<string, string> = {
      Background: "Wall",
      MainContent: "TV",
      LeftSidebar: "Mantel Left",
      RightSidebar: "Mantel Right",
      Header: "Shelf",
      Overlay: "Shelf",
      SecondaryContent: "TV",
      Footer: "Shelf",
    };
    const livingProfileId = await ctx.db.insert("displayProfiles", {
      name: "Living Room",
      description: "Retarget Christmas logical panels onto the indoor TV wall layout.",
      showId: christmasShowId,
      layoutId: livingLayoutId,
      isDefault: false,
      ownerId: users[0],
    });
    for (const [logical, panelName] of Object.entries(livingLogical)) {
      await ctx.db.insert("panelMappings", {
        displayProfileId: livingProfileId,
        logicalPanelName: logical,
        panelId: livingPanelIds[panelName],
      });
    }

    // Vendor-testing copy — FunFirst has its own Battle Loco with separate IDs.
    await insertBattleLoco(ctx, users[0]);

    await insertShow(ctx, {
      title: "New Year Countdown",
      description: "Synchronized countdown across every screen in the house.",
      tag: "newyear",
      status: "draft",
      owner: users[0],
      scenes: [
        { title: "Party Loop", kind: "image", content: img("party") },
        { title: "Countdown", kind: "score", content: JSON.stringify({ from: 10, to: 0 }) },
        { title: "Happy New Year", kind: "title", content: "HAPPY NEW YEAR!" },
      ],
    });

    const holidayName = Object.fromEntries(
      HOMESHOW_HOLIDAYS.map((h) => [h.tag, h.name]),
    );
    const allShows = await ctx.db.query("shows").collect();
    for (const show of allShows) {
      if (!isHomeShowHolidayTag(show.tag)) continue;
      await ctx.db.patch(show._id, {
        kind: "bit",
        roundType: holidayName[show.tag!] ?? show.tag,
      });
    }

    const homeshow = requireLoco("homeshow");
    const homeshowCatalog = await insertLocoCatalog(ctx, homeshow);
    const homeshowId = await insertLocoDemo(
      ctx,
      users[0],
      homeshow,
      "HomeShow · Holiday House",
      [
        [1, "Intro", "Welcome Home", "", false],
        [2, "Christmas", "Christmas", "", false],
        [3, "Halloween", "Halloween", "", false],
        [4, "New Year", "New Year", "", false],
        [5, "Outro", "Goodnight", "", false],
      ],
      [
        ["Ava", 1],
        ["Max", 2],
      ],
      homeshowCatalog,
      christmasShowId,
    );
    const homeRows = await ctx.db
      .query("performanceGames")
      .withIndex("by_performance", (q) => q.eq("performanceId", homeshowId))
      .collect();
    const holidayShows = (await ctx.db.query("shows").collect()).filter((s) =>
      isHomeShowHolidayTag(s.tag),
    );
    for (const row of homeRows) {
      const bit = holidayShows.find(
        (s) =>
          s.roundType?.toLowerCase() === row.roundType.toLowerCase() ||
          s.title.toLowerCase() === row.gameName.toLowerCase() ||
          s.tag === row.roundType.toLowerCase().replace(/\s+/g, ""),
      );
      if (bit) await ctx.db.patch(row._id, { bitShowId: bit._id, gameName: bit.title });
    }

    const products: [string, string, number, string][] = [
      ["Haunted Window Pack", "Six ghost scenes tuned for rear projection.", 4900, "halloween"],
      ["Storm & Lightning Loop", "Seamless 10-minute storm with sound cues.", 1900, "halloween"],
      ["Snowfall Loop Bundle", "Four snow densities, loops perfectly.", 2400, "christmas"],
      ["Santa Flyover Scene", "Multi-screen sleigh crossing with bells.", 2900, "christmas"],
      ["Countdown Mega Pack", "New Year countdowns in five styles.", 1500, "newyear"],
      ["Fireworks Finale", "Rooftop fireworks loop for midnight.", 2200, "newyear"],
    ];
    for (const [name, description, priceCents, holiday] of products) {
      await ctx.db.insert("products", {
        name,
        description,
        priceCents,
        holiday,
        imageUrl: img(name),
      });
    }

    await seedVenueService(ctx, users[0], {
      name: "House",
      layoutId,
    });

    return "Seeded SurroundShow: 5 users, 12 groups, 4 shows (2 designer), HomeShow holiday bits, 3 layouts, 3 display profiles, Battle Loco HyperX, 6 products, venue service";
  },
});

export const funfirst = mutation({
  args: {},
  handler: async (ctx) => {
    await clearAll(ctx);

    const users = await insertUsers(ctx, [
      { name: "Mia Martinez", handle: "mia", bio: "Comedy Loco referee and part-time banana.", tier: "admin" },
      { name: "Dev Okafor", handle: "dev", bio: "HeadCase head writer. The AI does the easy jokes.", tier: "gold" },
      { name: "Sammy Kwan", handle: "sammy", bio: "WWCCE ring announcer. YES I talk like this in real life.", tier: "silver" },
      { name: "Lola Reyes", handle: "lola", bio: "Open-mic regular at LaffUp nights.", tier: "free" },
      { name: "Gus Papadopoulos", handle: "gus", bio: "I run the scoreboard. Do not ask me to overturn a call.", tier: "silver" },
      { name: "Nina Volkov", handle: "nina", bio: "Front-row heckler, reformed. Mostly.", tier: "free" },
    ]);

    // Comedy network set mirrors production laffupalunga.com groupChat (SiteId 2).
    // leftmenu 1 = Top, 2 = Hot — same assignments as live.
    const groups = await insertGroups(
      ctx,
      [
        { name: "Comedy Loco", description: "League of Laughs Competitive Comedy", kind: "public", leftmenu: 1, category: "comedyloco" },
        { name: "Headcase", description: "Robot Comedy Army", kind: "public", leftmenu: 1, category: "headcase" },
        { name: "Laff-up", description: "Sketch Comedy Live!", kind: "public", leftmenu: 2, category: "laffup" },
        { name: "News", description: "Laffupalunga Comedy Network News", kind: "public", category: "news" },
        { name: "Stageshow", description: "Direct a TV broadcast from a Zoom meeting", kind: "public", category: "stageshow" },
        { name: "Superstars", description: "Superstars & Superfans", kind: "public", leftmenu: 2, category: "superstars" },
        { name: "WWCCE", description: "Bring the Action!", kind: "public", leftmenu: 1, category: "wwcce" },
      ] as GroupSpec[],
      users,
    );

    await insertPosts(
      ctx,
      [
        { content: "Comedy Loco Championship goes LIVE Friday — Bananas need this one.", groupIndex: 0 },
        { content: "New HeadCase bit in the show queue: 'My Smart Fridge Judges Me'.", groupIndex: 1 },
        { content: "WWCCE title match ended with a folding-chair pun. Cinema.", groupIndex: 6 },
        { content: "Five spots left for Thursday open mic — sign up in the events page!", groupIndex: 2 },
        { content: "Audience vote decided the last round by 3 points. Your phone is the game.", groupIndex: 5 },
        { content: "Who else is going to FunFirst Comedy Night at the Chuckle Hut?", groupIndex: 3 },
      ],
      users,
      groups,
    );

    await insertShow(ctx, {
      title: "Comedy Loco Championship",
      description: "Bananas vs Berries. Three rounds, live audience voting, one champion.",
      tag: "comedyloco",
      status: "live",
      owner: users[0],
      scenes: [
        { title: "Team Intros", kind: "title", content: "BANANAS vs BERRIES" },
        { title: "Round 1", kind: "text", content: "Improv relay — audience picks the scenario." },
        { title: "Scoreboard", kind: "score", content: JSON.stringify({ bananas: 12, berries: 9 }) },
        { title: "Round 2", kind: "text", content: "Physical challenge: the Great Fruit Carry." },
        { title: "Final Score", kind: "score", content: JSON.stringify({ bananas: 21, berries: 19 }) },
      ],
    });

    await insertShow(ctx, {
      title: "HeadCase: Bits Night",
      description: "AI-assisted sketch comedy, written by the room, judged by you.",
      tag: "headcase",
      status: "draft",
      owner: users[1],
      scenes: [
        { title: "Cold Open", kind: "title", content: "HEADCASE PRESENTS" },
        { title: "Bit: Smart Fridge", kind: "text", content: "A fridge with opinions about your 2am choices." },
        { title: "Bit: GPS Therapist", kind: "text", content: "Recalculating… your life decisions." },
      ],
    });

    await insertShow(ctx, {
      title: "WWCCE Grand Slam",
      description: "Wrestling comedy championship — scripted chaos, real laughs.",
      tag: "wwcce",
      status: "ended",
      owner: users[2],
      scenes: [
        { title: "Ring Intro", kind: "title", content: "LET'S GET READY TO CHUCKLE" },
        { title: "Main Event", kind: "text", content: "The Pun-isher vs Captain Kayfabe." },
      ],
    });

    // --- Designer demo: stage layout with panel-based cue show ---
    const layoutId = await ctx.db.insert("layouts", {
      name: "Main Stage",
      ownerId: users[0],
    });
    const stageScreenId = await ctx.db.insert("screens", {
      layoutId,
      name: "Stage",
      order: 0,
      width: 1920,
      height: 1080,
    });
    const ffPanelSpecs: [string, number, { x: number; y: number }[]][] = [
      ["Backdrop", 0, [{ x: 0, y: 0 }, { x: 1920, y: 0 }, { x: 1920, y: 1080 }, { x: 0, y: 1080 }]],
      ["Left Wing", 1, [{ x: 40, y: 120 }, { x: 420, y: 120 }, { x: 420, y: 960 }, { x: 40, y: 960 }]],
      ["Right Wing", 2, [{ x: 1500, y: 120 }, { x: 1880, y: 120 }, { x: 1880, y: 960 }, { x: 1500, y: 960 }]],
      ["Scoreboard", 3, [{ x: 560, y: 40 }, { x: 1360, y: 40 }, { x: 1360, y: 220 }, { x: 560, y: 220 }]],
      ["Center Spot", 4, [{ x: 560, y: 280 }, { x: 1360, y: 280 }, { x: 1360, y: 900 }, { x: 560, y: 900 }]],
    ];
    const ffPanelIds: Record<string, Id<"panels">> = {};
    for (const [name, zIndex, points] of ffPanelSpecs) {
      ffPanelIds[name] = await ctx.db.insert("panels", {
        screenId: stageScreenId,
        name,
        zIndex,
        points,
      });
    }

    const stageShowId = await ctx.db.insert("shows", {
      title: "Comedy Loco Stage Cues",
      description: "Panel-based stage cues for the main house screen — designer / timeline demo.",
      tag: "comedyloco",
      status: "draft",
      currentSceneIndex: 0,
      layoutId,
      ownerId: users[0],
    });
    const stageScenes: [
      string,
      number,
      string,
      string,
      boolean?,
      boolean?,
    ][] = [
      ["Warmup", 60, "#14532d", "WARMUP"],
      ["Introduction", 20, "#1e3a8a", "INTRODUCING", true],
      ["Team Intros", 90, "#1e3a8a", "BANANAS vs BERRIES"],
      ["Game Instructions", 30, "#7c2d12", "PLAY THIS", true],
      ["Round 1", 120, "#7c2d12", "ROUND 1"],
      ["Vote", 20, "#b45309", "VOTE!", true],
      ["Winner Bananas", 15, "#ca8a04", "BANANAS WIN", true],
      ["Winner Berries", 15, "#db2777", "BERRIES WIN", true],
      ["Score Rotation", 15, "#0369a1", "ROTATION", true],
      ["Score", 20, "#0f766e", "SCORE", true],
      ["Halftime", 45, "#4c1d95", "HALFTIME"],
      ["Finale", 90, "#831843", "CHAMPIONS"],
      ["BringTheFun", 180, "#14532d", "♪", false, true],
      ["BackNForth", 180, "#1e3a8a", "♪", false, true],
    ];
    for (let s = 0; s < stageScenes.length; s++) {
      const [title, durationSec, wingColor, centerText, isOverlay, isSoundEffect] =
        stageScenes[s];
      const sceneId = await ctx.db.insert("scenes", {
        showId: stageShowId,
        order: s,
        title,
        kind: "panels",
        content: "",
        durationSec,
        isOverlay,
        isSoundEffect,
      });
      const ffLogical: Record<string, string> = {
        Background: "Backdrop",
        LeftSidebar: "Left Wing",
        RightSidebar: "Right Wing",
        Scoreboard: "Scoreboard",
        MainContent: "Center Spot",
      };
      const sceneEffects: [string, "color" | "text", string, number, number | undefined][] = [
        ["Background", "color", "#0f172a", 0, undefined],
        ["LeftSidebar", "color", wingColor, 0, undefined],
        ["RightSidebar", "color", wingColor, 0, undefined],
        ["Scoreboard", "text", `Bananas ${10 + s} – ${8 + s} Berries`, 0, undefined],
        ["MainContent", "text", centerText, 0, 30],
        ["MainContent", "color", "#fbbf24", 30, 15],
      ];
      for (const [logical, kind, content, startTime, duration] of sceneEffects) {
        await ctx.db.insert("effects", {
          sceneId,
          panelId: ffPanelIds[ffLogical[logical]],
          logicalPanelName: logical,
          kind,
          content,
          startTime,
          isEnabled: true,
          ...(duration !== undefined ? { durationSec: duration } : {}),
        });
      }
    }

    const stageProfileId = await ctx.db.insert("displayProfiles", {
      name: "Main Stage (default)",
      description: "Default logical → physical mapping for Comedy Loco stage cues.",
      showId: stageShowId,
      layoutId,
      isDefault: true,
      ownerId: users[0],
    });
    const stageLogical: [string, string][] = [
      ["Background", "Backdrop"],
      ["LeftSidebar", "Left Wing"],
      ["RightSidebar", "Right Wing"],
      ["Scoreboard", "Scoreboard"],
      ["MainContent", "Center Spot"],
    ];
    for (const [logical, panelName] of stageLogical) {
      await ctx.db.insert("panelMappings", {
        displayProfileId: stageProfileId,
        logicalPanelName: logical,
        panelId: ffPanelIds[panelName],
      });
    }

    // --- Loco game-engine demos ---
    const comedy = requireLoco("comedyloco");
    const comedyIds = await insertLocoCatalog(ctx, comedy);
    await insertLocoDemo(
      ctx,
      users[0],
      comedy,
      "Friday Night Comedy Loco",
      [
        [1, "Intro", "Top This", "Top This", false],
        [2, "Bucket", "Countdown", "More For Me", true],
        [3, "Choice", "Oscar", "Club Intro", true],
        [4, "Audience", "Sound Effects", "Sound Effects", true],
        [5, "Joke", "Freeze Tag", "Freeze Tag", true],
      ],
      [
        ["BellBoy", 1],
        ["Slapstick Sally", 1],
        ["Captain Chuckles", 2],
        ["Deadpan Dana", 2],
      ],
      comedyIds,
      stageShowId,
    );

    const battle = requireLoco("battleloco");
    const battleIds = await insertLocoCatalog(ctx, battle);
    const battleShow = await insertBattleLoco(ctx, users[0]);
    await insertLocoDemo(
      ctx,
      users[0],
      battle,
      "Saturday Battle Loco",
      [
        [1, "Intro", "Face Off", "Face Off", false],
        [2, "Gaming", "Smash Bros", "Mario Kart", true],
        [3, "Challenge", "Minute to Win It", "Trivia Blitz", true],
        [4, "Crowd", "Crowd Control", "Crowd Control", true],
        [5, "Finale", "Finale Gauntlet", "Finale Gauntlet", true],
      ],
      [
        ["Blaze", 1],
        ["Spark", 1],
        ["Frost", 2],
        ["Glacier", 2],
      ],
      battleIds,
      battleShow.showId,
    );

    const wrestle = requireLoco("wrestleloco");
    const wrestleIds = await insertLocoCatalog(ctx, wrestle);
    const wrestleShow = await insertWrestleLoco(ctx, users[2]);
    await insertLocoDemo(
      ctx,
      users[2],
      wrestle,
      "Friday Wrestle Loco",
      [
        [1, "Intro", "Opening Bell", "Opening Bell", false],
        [2, "Match", "Singles Match", "Tag Team", true],
        [3, "Crowd", "Crowd Scream", "Crowd Scream", false],
        [4, "Weapons", "Chair Shot", "Chair Shot", true],
        [5, "Finale", "Finale Gauntlet", "Finale Gauntlet", true],
      ],
      [
        ["The Smile", 1],
        ["Good Sport", 1],
        ["Cheap Heat", 2],
        ["The Heel Turn", 2],
      ],
      wrestleIds,
      wrestleShow.showId,
    );

    const headcase = requireLoco("headcase");
    const headcaseIds = await insertLocoCatalog(ctx, headcase);
    const headcaseBits = await insertBitLibrary(ctx, users[1], headcase);
    await insertLocoDemo(
      ctx,
      users[1],
      headcase,
      "Thursday HeadCase Bits",
      [
        [1, "Intro", "Cold Open", "Cold Open", false],
        [2, "Bit", "Smart Fridge", "GPS Therapist", true],
        [3, "Sketch", "Generated Sketch", "Two-Hander", true],
        [4, "Crowd", "Crowd Prompt", "Heckle Filter", true],
        [5, "Finale", "Credits Roast", "Credits Roast", true],
      ],
      [
        ["Dev Okafor", 1],
        ["Prompt Queen", 1],
        ["HAL 9001", 2],
        ["Clippy", 2],
      ],
      headcaseIds,
    );
    await bindSetlistRowsToBits(ctx, "headcase", headcaseBits.ids);

    const laffup = requireLoco("laffup");
    const laffupIds = await insertLocoCatalog(ctx, laffup);
    const laffupBits = await insertBitLibrary(ctx, users[3], laffup);
    await insertLocoDemo(
      ctx,
      users[3],
      laffup,
      "Wednesday LaffUp Mic",
      [
        [1, "Intro", "Host Open", "Host Open", false],
        [2, "Set", "New Material", "Tight Five", true],
        [3, "Crowd", "Crowd Work", "Roast a Table", true],
        [4, "Feature", "Feature Set", "Feature Set", true],
        [5, "Headliner", "Headliner Set", "Headliner Set", true],
      ],
      [
        ["Lola Reyes", 1],
        ["First Timer", 1],
        ["Touring Act", 2],
        ["Mic Killer", 2],
      ],
      laffupIds,
    );
    await bindSetlistRowsToBits(ctx, "laffup", laffupBits.ids);

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const events: [string, string, string, number, number, number, number][] = [
      ["FunFirst Comedy Night", "Stand-up showcase with five headliners.", "The Chuckle Hut, Austin TX", now + 3 * day, 2500, 120, 74],
      ["Comedy Loco Live Championship", "Bananas vs Berries with live audience voting.", "Rialto Arena, Austin TX", now + 7 * day, 3500, 400, 312],
      ["LaffUp Open Mic", "Ten five-minute sets. Sign up at the door.", "LaffUp Basement Stage", now + 1 * day, 1000, 60, 41],
      ["HeadCase Bits Night", "AI-assisted sketches, written by the room.", "HeadCase Lab, Austin TX", now + 5 * day, 2000, 80, 51],
      ["WWCCE: Winter Brawl-ha-ha", "Wrestling comedy title matches all night.", "Eastside Ballroom", now + 14 * day, 3000, 250, 96],
      ["Battle Loco: Heat vs Ice", "Gaming, stunts, crowd control. Loser spins the wheel.", "HyperX Arena, Luxor Las Vegas", now + 10 * day, 4500, 500, 218],
      ["Wrestle Loco: Faces vs Heels", "Comedy wrestling, fan refs, multi-pin finale.", "Location TBA, Las Vegas", now + 21 * day, 4000, 400, 142],
    ];
    for (const [title, description, venue, startsAt, priceCents, capacity, ticketsSold] of events) {
      await ctx.db.insert("events", { title, description, venue, startsAt, priceCents, capacity, ticketsSold });
    }

    await seedVenueService(ctx, users[0], {
      name: "Main Room",
      layoutId,
    });

    return "Seeded FunFirst: 6 users, 7 groups, 6 shows (3 designer), 3 layouts, 3 display profiles, 5 loco performances bound to cue shows, 7 events, venue service";
  },
});

export const redwave = mutation({
  args: {},
  handler: async (ctx) => {
    await clearAll(ctx);

    const users = await insertUsers(ctx, [
      { name: "Hank Ellison", handle: "hank", bio: "Precinct captain, Travis County.", tier: "admin", state: "Texas", county: "Travis" },
      { name: "Carol Briggs", handle: "carol", bio: "County committee volunteer coordinator.", tier: "gold", state: "Texas", county: "Williamson" },
      { name: "Ray Sutton", handle: "ray", bio: "Poll watcher trainer, 12 elections and counting.", tier: "silver", state: "Florida", county: "Duval" },
      { name: "Dana Whitfield", handle: "dana", bio: "New volunteer — tell me where to show up.", tier: "free", state: "Texas", county: "Travis" },
      { name: "Pete Alvarez", handle: "pete", bio: "Runs the candidate vetting surveys.", tier: "silver", state: "Ohio", county: "Franklin" },
    ]);

    const groups = await insertGroups(
      ctx,
      [
        { name: "Texas", description: "Statewide organizing hub for Texas.", kind: "state", state: "Texas", leftmenu: 1 },
        { name: "Texas — Travis County", description: "Travis County precinct operations.", kind: "county", state: "Texas", county: "Travis", leftmenu: 1 },
        { name: "Florida", description: "Statewide organizing hub for Florida.", kind: "state", state: "Florida", leftmenu: 2 },
        { name: "Ohio", description: "Statewide organizing hub for Ohio.", kind: "state", state: "Ohio", leftmenu: 2 },
        { name: "Precinct Captains", description: "Cross-state best practices for precinct leaders.", kind: "public", leftmenu: 1 },
        { name: "Vetting Committee", description: "Candidate survey review. Members only.", kind: "private" },
      ],
      users,
    );

    await insertPosts(
      ctx,
      [
        { content: "New precinct walk lists are up in Resources → Precinct Strategy. Print before Saturday.", groupIndex: 1 },
        { content: "Welcome to the 14 new Travis County volunteers who joined this week!", groupIndex: 1 },
        { content: "Candidate vetting surveys for the March primary close Friday.", groupIndex: 5 },
        { content: "Florida folks: county chair training moved to the 19th.", groupIndex: 2 },
        { content: "Statewide call this Sunday 7pm — platform priorities for the session.", groupIndex: 0 },
        {
          content:
            "Remain in Mexico worked: southwest encounters dropped about 61% from the prior-year peak while it was enforced. Keep that standard locally.",
          groupIndex: 0,
          isSolution: true,
        },
      ],
      users,
      groups,
    );

    const eventId = await ctx.db.insert("posts", {
      authorId: users[0],
      content:
        "Travis County released several violent repeat offenders pretrial this week. What actually reverses that?",
      groupId: groups[1],
      upvotes: 4,
      replyCount: 1,
    });
    await ctx.db.insert("posts", {
      authorId: users[4],
      content:
        "End cashless bail for violent repeat offenders and publish 30/90-day rearrest numbers. That's the working local play.",
      parentId: eventId,
      groupId: groups[1],
      upvotes: 8,
      replyCount: 0,
      isSolution: true,
    });
    await ctx.db.patch(eventId, { hasSolutionReply: true });

    // Resource library (legacy Resource → ResourceChild → ResourceGrandChild)
    const platform = await ctx.db.insert("resources", {
      title: "Platform",
      body: "Where we stand: planks, priorities and scorecards.",
      kind: "category",
      order: 0,
    });
    const integrity = await ctx.db.insert("resources", {
      title: "Election Integrity",
      body: "Poll watching, canvassing law and reporting procedures.",
      kind: "category",
      order: 1,
    });
    const precinct = await ctx.db.insert("resources", {
      title: "Precinct Strategy",
      body: "The precinct playbook: organize your neighborhood block by block.",
      kind: "category",
      order: 2,
    });

    const articles: [Id<"resources">, string, string][] = [
      [platform, "Legislative Scorecard", "How incumbents voted on the ten priority issues this session, with sources for every vote."],
      [platform, "Litmus Test Questions", "The candidate questionnaire used by the vetting committee, with scoring guidance."],
      [integrity, "Poll Watcher Field Guide", "What you may observe, what you must not do, and exactly how to file an incident report."],
      [integrity, "Canvassing Law Basics", "Door-knocking rules by county: hours, posted-property rules and HOA considerations."],
      [precinct, "Precinct Captain Playbook", "The 90-day plan: build your walk list, recruit two block captains, host one meet-up."],
      [precinct, "Blueprint: County Committees", "Standing committees every county org needs and how to staff them."],
    ];
    for (let i = 0; i < articles.length; i++) {
      const [parentId, title, body] = articles[i];
      await ctx.db.insert("resources", {
        title,
        body,
        kind: "article",
        parentId,
        order: i,
      });
    }
    await ctx.db.insert("resources", {
      title: "State Legislature Tracker",
      body: "Live bill tracking portal.",
      kind: "link",
      url: "https://www.congress.gov",
      parentId: platform,
      order: 9,
    });

    return "Seeded RedWave: 5 users, 6 groups, 3 resource categories + 7 items";
  },
});

/**
 * Insert Battle Loco + HyperX Arena into the current deployment without
 * wiping anything. If the show already exists, return its IDs and leave
 * every document untouched — Convex push and re-runs must not change
 * existing show/screen IDs (SurroundShow's copy is in vendor testing).
 *
 *   pnpm --filter @linkall/backend seed:battleLoco
 */
export const battleLoco = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const ownerId =
      users.find((u) => u.tier === "admin")?._id ?? users[0]?._id;
    if (!ownerId) {
      throw new Error("No users in deployment — run seed:funfirst first.");
    }

    const shows = await ctx.db.query("shows").collect();
    const existingShow = shows.find(
      (show) => show.title === "Battle Loco" || show.tag === "battleloco",
    );
    if (existingShow) {
      const layouts = await ctx.db.query("layouts").collect();
      const layout =
        layouts.find((l) => l._id === existingShow.layoutId) ??
        layouts.find((l) => l.name === "HyperX Arena");
      const screens = layout
        ? await ctx.db
            .query("screens")
            .withIndex("by_layout", (q) => q.eq("layoutId", layout._id))
            .collect()
        : [];
      const byName = (name: string) =>
        screens.find((s) => s.name === name)?._id;
      const panels = await panelLogicalsForShow(ctx, existingShow._id);
      const added = await insertCueScenesOnShow(
        ctx,
        existingShow._id,
        panels,
        performanceCuesFor(
          requireLoco("battleloco"),
          {
            hero: BATTLE_LOCO_IMAGES.hero,
            side: BATTLE_LOCO_IMAGES.competitors,
            crowd: BATTLE_LOCO_IMAGES.crowd,
          },
          BATTLE_LOCO_BOOM_VIDEOS.center,
        ),
        "Heat 0 – 0 Ice",
        "battle-loco",
      );
      const bound = await bindPerformancesToShow(
        ctx,
        "battleloco",
        existingShow._id,
      );
      const fx = await ensureOverlayEffectsOnShow(
        ctx,
        existingShow._id,
        "battle-loco",
        BATTLE_LOCO_BOOM_VIDEOS.center,
      );
      const dress = await dressBattleLocoLook(ctx, existingShow._id);
      const sides = await ensureSideScoreEffectsOnShow(
        ctx,
        existingShow._id,
        "battle-loco",
      );
      const phone = await ensurePhoneScreenOnShow(ctx, existingShow._id);
      const switcher = await applyHyperXSwitcherOnShow(
        ctx,
        existingShow._id,
        "battle-loco",
      );
      return {
        message:
          "Battle Loco already exists — added missing cue scenes and bound performances",
        showId: existingShow._id,
        layoutId: layout?._id,
        addedScenes: added,
        boundPerformances: bound,
        ...fx,
        ...dress,
        ...sides,
        phone,
        switcher,
        screenIds: {
          left: byName("HyperX Stage Left"),
          center: byName("HyperX Stage Center"),
          right: byName("HyperX Stage Right"),
        },
      };
    }

    const created = await insertBattleLoco(ctx, ownerId);
    const bound = await bindPerformancesToShow(ctx, "battleloco", created.showId);
    return {
      message:
        "Seeded Battle Loco · HyperX Arena (Left/Right 1152×1920 portrait, Center 1920×1080)",
      boundPerformances: bound,
      ...created,
    };
  },
});

/**
 * Create / upgrade Battle Loco + Wrestle Loco designed shows with
 * performance cue scenes, and bind every existing performance of those
 * locos. Does not wipe data.
 *
 *   pnpm --filter @linkall/backend seed:locoCueShows
 */
export const locoCueShows = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const ownerId =
      users.find((u) => u.tier === "admin")?._id ?? users[0]?._id;
    if (!ownerId) {
      throw new Error("No users in deployment — run seed:funfirst first.");
    }

    const shows = await ctx.db.query("shows").collect();

    let battleShow = shows.find(
      (s) => s.tag === "battleloco" || s.title === "Battle Loco",
    );
    let battleCreated = false;
    let battleAdded = 0;
    if (!battleShow) {
      const created = await insertBattleLoco(ctx, ownerId);
      battleShow = (await ctx.db.get(created.showId)) ?? undefined;
      battleCreated = true;
    } else {
      const panels = await panelLogicalsForShow(ctx, battleShow._id);
      battleAdded = await insertCueScenesOnShow(
        ctx,
        battleShow._id,
        panels,
        performanceCuesFor(
          requireLoco("battleloco"),
          {
            hero: BATTLE_LOCO_IMAGES.hero,
            side: BATTLE_LOCO_IMAGES.competitors,
            crowd: BATTLE_LOCO_IMAGES.crowd,
          },
          BATTLE_LOCO_BOOM_VIDEOS.center,
        ),
        "Heat 0 – 0 Ice",
        "battle-loco",
      );
    }
    const battleBound = battleShow
      ? await bindPerformancesToShow(ctx, "battleloco", battleShow._id)
      : 0;
    const battleFx = battleShow
      ? await ensureOverlayEffectsOnShow(
          ctx,
          battleShow._id,
          "battle-loco",
          BATTLE_LOCO_BOOM_VIDEOS.center,
        )
      : { urls: 0, videos: 0 };
    const battleDress = battleShow
      ? await dressBattleLocoLook(ctx, battleShow._id)
      : { dressed: 0 };
    const battleSides = battleShow
      ? await ensureSideScoreEffectsOnShow(ctx, battleShow._id, "battle-loco")
      : { sides: 0 };
    const battlePhone = battleShow
      ? await ensurePhoneScreenOnShow(ctx, battleShow._id)
      : { phone: 0, mapped: 0, urls: 0 };
    const battleSwitcher = battleShow
      ? await applyHyperXSwitcherOnShow(ctx, battleShow._id, "battle-loco")
      : { keyFillPanels: 0, commandScenes: 0, commands: 0, keyFills: 0 };

    let wrestleShow = shows.find(
      (s) => s.tag === "wrestleloco" || s.title === "Wrestle Loco",
    );
    let wrestleCreated = false;
    let wrestleAdded = 0;
    if (!wrestleShow) {
      const created = await insertWrestleLoco(ctx, ownerId);
      wrestleShow = (await ctx.db.get(created.showId)) ?? undefined;
      wrestleCreated = true;
    } else {
      const panels = await panelLogicalsForShow(ctx, wrestleShow._id);
      wrestleAdded = await insertCueScenesOnShow(
        ctx,
        wrestleShow._id,
        panels,
        performanceCuesFor(
          requireLoco("wrestleloco"),
          {
            hero: WRESTLE_LOCO_IMAGES.hero,
            side: WRESTLE_LOCO_IMAGES.faces,
            crowd: WRESTLE_LOCO_IMAGES.crowd,
          },
          WRESTLE_LOCO_BELL_VIDEOS.center,
        ),
        "Faces 0 – 0 Heels",
        "wrestle-loco",
      );
    }
    const wrestleBound = wrestleShow
      ? await bindPerformancesToShow(ctx, "wrestleloco", wrestleShow._id)
      : 0;
    const wrestleFx = wrestleShow
      ? await ensureOverlayEffectsOnShow(ctx, wrestleShow._id, "wrestle-loco")
      : { urls: 0, videos: 0 };
    const wrestleLockups = wrestleShow
      ? await ensureWrestleLockupScenes(ctx, wrestleShow._id)
      : { lockups: 0 };
    const wrestleDress = wrestleShow
      ? await dressWrestleLocoLook(ctx, wrestleShow._id)
      : { dressed: 0 };
    const wrestleSides = wrestleShow
      ? await ensureSideScoreEffectsOnShow(ctx, wrestleShow._id, "wrestle-loco")
      : { sides: 0 };
    const wrestleHyperX = wrestleShow
      ? await bindShowToHyperX(ctx, wrestleShow._id)
      : { bound: false as const };
    const wrestlePhone = wrestleShow
      ? await ensurePhoneScreenOnShow(ctx, wrestleShow._id)
      : { phone: 0, mapped: 0, urls: 0 };
    const wrestleSwitcher = wrestleShow
      ? await applyHyperXSwitcherOnShow(ctx, wrestleShow._id, "wrestle-loco")
      : { keyFillPanels: 0, commandScenes: 0, commands: 0, keyFills: 0 };

    const comedyShow =
      shows.find((s) => s.title.toLowerCase().includes("stage cues")) ??
      shows.find((s) => s.tag === "comedyloco") ??
      shows.find((s) => s.title.toLowerCase().includes("comedy loco"));
    let comedyAdded = 0;
    if (comedyShow) {
      const panels = await panelLogicalsForShow(ctx, comedyShow._id);
      comedyAdded = await insertCueScenesOnShow(
        ctx,
        comedyShow._id,
        panels,
        performanceCuesFor(requireLoco("comedyloco"), {
          hero: BATTLE_LOCO_IMAGES.hero,
          side: BATTLE_LOCO_IMAGES.competitors,
          crowd: BATTLE_LOCO_IMAGES.crowd,
        }),
        "Bananas 0 – 0 Berries",
        "comedy-loco",
      );
    }
    const comedyFx = comedyShow
      ? await ensureOverlayEffectsOnShow(ctx, comedyShow._id, "comedy-loco")
      : { urls: 0, videos: 0 };
    const comedySides = comedyShow
      ? await ensureSideScoreEffectsOnShow(ctx, comedyShow._id, "comedy-loco")
      : { sides: 0 };
    const comedyPhone = comedyShow
      ? await ensurePhoneScreenOnShow(ctx, comedyShow._id)
      : { phone: 0, mapped: 0, urls: 0 };
    const comedyBound = comedyShow
      ? await bindPerformancesToShow(ctx, "comedyloco", comedyShow._id)
      : 0;

    return {
      battle: {
        showId: battleShow?._id,
        created: battleCreated,
        addedScenes: battleAdded,
        boundPerformances: battleBound,
        ...battleFx,
        ...battleDress,
        ...battleSides,
        phone: battlePhone,
        switcher: battleSwitcher,
      },
      wrestle: {
        showId: wrestleShow?._id,
        created: wrestleCreated,
        addedScenes: wrestleAdded,
        boundPerformances: wrestleBound,
        ...wrestleFx,
        ...wrestleLockups,
        ...wrestleDress,
        ...wrestleSides,
        phone: wrestlePhone,
        hyperx: wrestleHyperX,
        switcher: wrestleSwitcher,
      },
      comedy: {
        showId: comedyShow?._id,
        addedScenes: comedyAdded,
        boundPerformances: comedyBound,
        ...comedyFx,
        ...comedySides,
        phone: comedyPhone,
      },
    };
  },
});

/** Same as locoCueShows but only the Wrestle Loco show + bind. */
export const wrestleLoco = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const ownerId =
      users.find((u) => u.tier === "admin")?._id ?? users[0]?._id;
    if (!ownerId) {
      throw new Error("No users in deployment — run seed:funfirst first.");
    }
    const shows = await ctx.db.query("shows").collect();
    const existing = shows.find(
      (s) => s.tag === "wrestleloco" || s.title === "Wrestle Loco",
    );
    if (existing) {
      const panels = await panelLogicalsForShow(ctx, existing._id);
      const added = await insertCueScenesOnShow(
        ctx,
        existing._id,
        panels,
        performanceCuesFor(
          requireLoco("wrestleloco"),
          {
            hero: WRESTLE_LOCO_IMAGES.hero,
            side: WRESTLE_LOCO_IMAGES.faces,
            crowd: WRESTLE_LOCO_IMAGES.crowd,
          },
          WRESTLE_LOCO_BELL_VIDEOS.center,
        ),
        "Faces 0 – 0 Heels",
        "wrestle-loco",
      );
      const bound = await bindPerformancesToShow(ctx, "wrestleloco", existing._id);
      const fx = await ensureOverlayEffectsOnShow(ctx, existing._id, "wrestle-loco");
      const lockups = await ensureWrestleLockupScenes(ctx, existing._id);
      const dress = await dressWrestleLocoLook(ctx, existing._id);
      const sides = await ensureSideScoreEffectsOnShow(
        ctx,
        existing._id,
        "wrestle-loco",
      );
      const hyperx = await bindShowToHyperX(ctx, existing._id);
      const phone = await ensurePhoneScreenOnShow(ctx, existing._id);
      const switcher = await applyHyperXSwitcherOnShow(
        ctx,
        existing._id,
        "wrestle-loco",
      );
      return {
        message: "Wrestle Loco already exists — added missing cue scenes and bound performances",
        showId: existing._id,
        addedScenes: added,
        boundPerformances: bound,
        ...fx,
        ...lockups,
        ...dress,
        ...sides,
        phone,
        hyperx,
        switcher,
      };
    }
    const created = await insertWrestleLoco(ctx, ownerId);
    const bound = await bindPerformancesToShow(ctx, "wrestleloco", created.showId);
    return {
      message: "Seeded Wrestle Loco · HyperX Arena (shared with Battle Loco)",
      boundPerformances: bound,
      ...created,
    };
  },
});

/**
 * Add the portrait Phone screen to every show that has a layout.
 *   pnpm --filter @linkall/backend exec convex run seed:phoneScreens --env-file .env.funfirst
 */
/**
 * Create HeadCase + LaffUp bit/sketch shows (Show → Scene → Effect) and
 * attach them to existing set-list performance rows.
 *
 *   pnpm --filter @linkall/backend exec convex run seed:setlistBits --env-file .env.funfirst
 */
export const setlistBits = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const ownerId =
      users.find((u) => u.tier === "admin")?._id ?? users[0]?._id;
    if (!ownerId) {
      throw new Error("No users in deployment — run seed:funfirst first.");
    }
    const tagged = await tagImportedSketchShows(ctx);
    const head = await bindHeadCaseShowsToHead(ctx, ownerId);
    const headcase = await insertBitLibrary(
      ctx,
      ownerId,
      requireLoco("headcase"),
    );
    const laffup = await insertBitLibrary(
      ctx,
      ownerId,
      requireLoco("laffup"),
    );
    const headcaseBound = await bindSetlistRowsToBits(
      ctx,
      "headcase",
      headcase.ids,
    );
    const laffupBound = await bindSetlistRowsToBits(ctx, "laffup", laffup.ids);
    const performances = await ctx.db.query("performances").collect();
    const setlistTags = performances
      .filter(
        (p) => rowTag(p.tag) === "headcase" || rowTag(p.tag) === "laffup",
      )
      .map((p) => ({ title: p.title, tag: p.tag }));
    return {
      taggedSketches: tagged,
      head,
      headcase,
      laffup,
      boundRows: { headcase: headcaseBound, laffup: laffupBound },
      setlistPerformances: setlistTags,
    };
  },
});

export const phoneScreens = mutation({
  args: {},
  handler: async (ctx) => {
    const shows = await ctx.db.query("shows").collect();
    const results: Array<{
      showId: Id<"shows">;
      title: string;
      phone: number;
      mapped: number;
      urls: number;
    }> = [];
    for (const show of shows) {
      const out = await ensurePhoneScreenOnShow(ctx, show._id);
      results.push({ showId: show._id, title: show.title, ...out });
    }
    return {
      shows: results.length,
      phones: results.reduce((n, r) => n + r.phone, 0),
      mapped: results.reduce((n, r) => n + r.mapped, 0),
      urls: results.reduce((n, r) => n + r.urls, 0),
      results,
    };
  },
});

/** Additive: venue + places + menu if none exist yet. */
export const venueService = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const owner = users[0];
    if (!owner) throw new Error("Seed users first");
    const layouts = await ctx.db.query("layouts").collect();
    const id = await seedVenueService(ctx, owner._id, {
      name: "Main Room",
      layoutId: layouts[0]?._id,
    });
    return { venueId: id };
  },
});
