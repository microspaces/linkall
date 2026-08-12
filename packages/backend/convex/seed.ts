import { mutation } from "./_generated/server";
import { MutationCtx } from "./_generated/server";
import { Id, TableNames } from "./_generated/dataModel";
import { christmasMikeScenes } from "./christmasMikeData";

/**
 * Mock data per brand, for testing until real data (groups etc.) is imported.
 * Run against the matching deployment, e.g.:
 *   npx convex run seed:funfirst
 * Seeding CLEARS all tables in that deployment first.
 */

const ALL_TABLES: TableNames[] = [
  "performanceTracks",
  "performanceOverlays",
  "performers",
  "performanceGames",
  "performances",
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
  posts: { content: string; groupIndex?: number }[],
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
  for (const spec of screenSpecs) {
    await ctx.db.insert("panelMappings", {
      displayProfileId: profileId,
      logicalPanelName: spec.logical,
      panelId: panelByLogical[spec.logical],
    });
  }

  return { showId, layoutId, screenIds };
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

    return "Seeded SurroundShow: 5 users, 12 groups, 4 shows (2 designer), 3 layouts, 3 display profiles, Battle Loco HyperX, 6 products";
  },
});

export const funfirst = mutation({
  args: {},
  handler: async (ctx) => {
    await clearAll(ctx);

    const users = await insertUsers(ctx, [
      { name: "Mia Martinez", handle: "mia", bio: "Crazyball referee and part-time banana.", tier: "admin" },
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
        { name: "Crazyball", description: "League of Laughs Competitive Comedy", kind: "public", leftmenu: 1, category: "crazyball" },
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
        { content: "Crazyball Championship goes LIVE Friday — Bananas need this one.", groupIndex: 0 },
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
      title: "Crazyball Championship",
      description: "Bananas vs Berries. Three rounds, live audience voting, one champion.",
      tag: "crazyball",
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
      title: "Crazyball Stage Cues",
      description: "Panel-based stage cues for the main house screen — designer / timeline demo.",
      tag: "crazyball",
      status: "draft",
      currentSceneIndex: 0,
      layoutId,
      ownerId: users[0],
    });
    const stageScenes: [string, number, string, string][] = [
      ["Warmup", 60, "#14532d", "WARMUP"],
      ["Team Intros", 90, "#1e3a8a", "BANANAS vs BERRIES"],
      ["Round 1", 120, "#7c2d12", "ROUND 1"],
      ["Halftime", 45, "#4c1d95", "HALFTIME"],
      ["Finale", 90, "#831843", "CHAMPIONS"],
    ];
    for (let s = 0; s < stageScenes.length; s++) {
      const [title, durationSec, wingColor, centerText] = stageScenes[s];
      const sceneId = await ctx.db.insert("scenes", {
        showId: stageShowId,
        order: s,
        title,
        kind: "panels",
        content: "",
        durationSec,
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
      description: "Default logical → physical mapping for Crazyball stage cues.",
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

    // Battle Loco is a FunFirst show. SurroundShow keeps a separate copy
    // for vendor testing — this insert creates FunFirst's own IDs.
    await insertBattleLoco(ctx, users[0]);

    // --- Comedy game engine demo (legacy Crazyball Show page) ---
    const performanceId = await ctx.db.insert("performances", {
      title: "Friday Night Crazyball",
      team1: "Bananas",
      team2: "Berries",
      status: "draft",
      ownerId: users[0],
    });

    // Pairs of rows per round: team 1 then team 2 (legacy round grid).
    const rounds: [number, string, string, string, boolean][] = [
      // round, type, team1 game, team2 game, isScored
      [1, "Intro", "Top This", "Top This", false],
      [2, "Buck", "Countdown", "More For Me", true],
      [3, "Choice", "Oscar", "Club Intro", true],
      [4, "Buck", "Sound Effects", "Sound Effects", true],
      [5, "Finale", "Freeze Tag", "Freeze Tag", true],
    ];
    let order = 0;
    for (const [round, roundType, game1, game2, isScored] of rounds) {
      for (const [teamIndex, gameName] of [[1, game1], [2, game2]] as const) {
        await ctx.db.insert("performanceGames", {
          performanceId,
          order: order++,
          round,
          roundType,
          teamIndex,
          gameName,
          votes: 0,
          score: 0,
          isPlaying: false,
          isPlayed: false,
          isVoting: false,
          isWinner: false,
          rotation: false,
          isScored,
        });
      }
    }

    const performerSpecs: [string, 1 | 2][] = [
      ["BellBoy", 1],
      ["Slapstick Sally", 1],
      ["Captain Chuckles", 2],
      ["Deadpan Dana", 2],
    ];
    for (const [name, teamIndex] of performerSpecs) {
      await ctx.db.insert("performers", {
        performanceId,
        name,
        teamIndex,
        bellBonus: 0,
      });
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
    for (let i = 0; i < overlayNames.length; i++) {
      await ctx.db.insert("performanceOverlays", {
        performanceId,
        name: overlayNames[i],
        order: i,
      });
    }

    const trackNames = [
      "BackNForth", "BringTheFun", "BubbleGumGirl", "CockatooInTheGrass",
      "DressedInPink", "DrivingYourVibes",
    ];
    for (let i = 0; i < trackNames.length; i++) {
      await ctx.db.insert("performanceTracks", {
        performanceId,
        name: trackNames[i],
        order: i,
      });
    }

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const events: [string, string, string, number, number, number, number][] = [
      ["FunFirst Comedy Night", "Stand-up showcase with five headliners.", "The Chuckle Hut, Austin TX", now + 3 * day, 2500, 120, 74],
      ["Crazyball Live Championship", "Bananas vs Berries with live audience voting.", "Rialto Arena, Austin TX", now + 7 * day, 3500, 400, 312],
      ["LaffUp Open Mic", "Ten five-minute sets. Sign up at the door.", "LaffUp Basement Stage", now + 1 * day, 1000, 60, 41],
      ["WWCCE: Winter Brawl-ha-ha", "Wrestling comedy title matches all night.", "Eastside Ballroom", now + 14 * day, 3000, 250, 96],
    ];
    for (const [title, description, venue, startsAt, priceCents, capacity, ticketsSold] of events) {
      await ctx.db.insert("events", { title, description, venue, startsAt, priceCents, capacity, ticketsSold });
    }

    return "Seeded FunFirst: 6 users, 7 groups, 5 shows (2 designer), 2 layouts, 2 display profiles, Battle Loco HyperX, 1 performance (5 rounds), 4 events";
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
        { name: "Texas", description: "Statewide organizing hub for Texas.", kind: "state", state: "Texas" },
        { name: "Texas — Travis County", description: "Travis County precinct operations.", kind: "county", state: "Texas", county: "Travis" },
        { name: "Florida", description: "Statewide organizing hub for Florida.", kind: "state", state: "Florida" },
        { name: "Ohio", description: "Statewide organizing hub for Ohio.", kind: "state", state: "Ohio" },
        { name: "Precinct Captains", description: "Cross-state best practices for precinct leaders.", kind: "public" },
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
      ],
      users,
      groups,
    );

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
      return {
        message:
          "Battle Loco already exists — left existing show/screen IDs unchanged",
        showId: existingShow._id,
        layoutId: layout?._id,
        screenIds: {
          left: byName("HyperX Stage Left"),
          center: byName("HyperX Stage Center"),
          right: byName("HyperX Stage Right"),
        },
      };
    }

    const created = await insertBattleLoco(ctx, ownerId);
    return {
      message:
        "Seeded Battle Loco · HyperX Arena (Left/Right 1152×1920 portrait, Center 1920×1080)",
      ...created,
    };
  },
});
