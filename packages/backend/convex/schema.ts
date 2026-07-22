import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Shared schema used by every brand. Each brand runs its OWN Convex
 * deployment, so there is no SiteId column anywhere: tenant isolation is
 * physical, not row-level. Tables a brand doesn't use simply stay empty
 * (e.g. `products` on RedWave).
 */
export default defineSchema({
  // ---- social core (legacy: AspNetUsers, Group, Comment, Followers) ----
  users: defineTable({
    name: v.string(),
    handle: v.string(),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    tier: v.union(
      v.literal("free"),
      v.literal("silver"),
      v.literal("gold"),
      v.literal("admin"),
    ),
    state: v.optional(v.string()),
    county: v.optional(v.string()),
  }).index("by_handle", ["handle"]),

  groups: defineTable({
    name: v.string(),
    description: v.string(),
    photoUrl: v.optional(v.string()),
    // "state"/"county" replace the legacy Ω-prefixed geographic groups.
    kind: v.union(
      v.literal("public"),
      v.literal("private"),
      v.literal("state"),
      v.literal("county"),
    ),
    state: v.optional(v.string()),
    county: v.optional(v.string()),
    /** Legacy left menu bucket: 1 = Top, 2 = Hot. */
    leftmenu: v.optional(v.union(v.literal(1), v.literal(2))),
    /** Holiday / category slug for brand sidebars (e.g. "christmas"). */
    category: v.optional(v.string()),
    createdBy: v.id("users"),
    memberCount: v.number(),
  }).index("by_kind", ["kind"]),

  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    isAdmin: v.boolean(),
    /** Starred in the left/right Favorites column (legacy isFavorite). */
    isFavorite: v.optional(v.boolean()),
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_user", ["groupId", "userId"]),

  // Threaded posts: global feed (no groupId), group chat (groupId set),
  // replies (parentId set). Replaces the legacy Comment table.
  posts: defineTable({
    authorId: v.id("users"),
    groupId: v.optional(v.id("groups")),
    parentId: v.optional(v.id("posts")),
    content: v.string(),
    upvotes: v.number(),
    replyCount: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_parent", ["parentId"]),

  postVotes: defineTable({
    postId: v.id("posts"),
    userId: v.id("users"),
  }).index("by_post_user", ["postId", "userId"]),

  notifications: defineTable({
    userId: v.id("users"),
    message: v.string(),
    isRead: v.boolean(),
  }).index("by_user", ["userId"]),

  // ---- live show engine (legacy: Show/Scene/Effect + SignalR DisplayHub) ----
  shows: defineTable({
    title: v.string(),
    description: v.string(),
    /** Sub-brand tag, e.g. "crazyball" | "headcase" | "halloween". */
    tag: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("live"), v.literal("ended")),
    currentSceneIndex: v.number(),
    /** Epoch ms when the current scene started, for effect start-time playback. */
    sceneStartedAt: v.optional(v.number()),
    /** Physical layout this show is designed for (legacy Show.ScreenId). */
    layoutId: v.optional(v.id("layouts")),
    ownerId: v.id("users"),
  }).index("by_status", ["status"]),

  scenes: defineTable({
    showId: v.id("shows"),
    order: v.number(),
    title: v.string(),
    kind: v.union(
      v.literal("title"),
      v.literal("image"),
      v.literal("text"),
      v.literal("score"),
      // Panel-based scene: content unused, visuals come from `effects`.
      v.literal("panels"),
    ),
    /** Text content, image URL, or JSON payload depending on kind. */
    content: v.string(),
    /** Scene length in seconds (legacy Scene.Duration), drives the timeline. */
    durationSec: v.optional(v.number()),
  }).index("by_show", ["showId"]),

  // ---- designer: physical screens (legacy: Layout → Screen → Panel) ----
  layouts: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
  }),

  screens: defineTable({
    layoutId: v.id("layouts"),
    name: v.string(),
    order: v.number(),
    /** Canvas size the panel coordinates are expressed in. */
    width: v.number(),
    height: v.number(),
    /**
     * When set, the physical output page shows this panel in calibration
     * mode (flat colors + numbered corners) instead of the live show —
     * the legacy "tap a panel on the Player to align it" SignalR flow.
     */
    alignPanelId: v.optional(v.id("panels")),
  }).index("by_layout", ["layoutId"]),

  // A panel is a projection surface: a polygon (3–5 points in the legacy
  // X1..X5/Y1..Y5 columns, here an array) drawn on its screen's canvas.
  panels: defineTable({
    screenId: v.id("screens"),
    name: v.string(),
    zIndex: v.number(),
    points: v.array(v.object({ x: v.number(), y: v.number() })),
  }).index("by_screen", ["screenId"]),

  // An effect fills one panel for one scene starting at startTime seconds
  // (legacy Effect: Image/Video/Color/Html payload + StartTime + IsEnabled).
  effects: defineTable({
    sceneId: v.id("scenes"),
    panelId: v.id("panels"),
    kind: v.union(
      v.literal("image"),
      v.literal("video"),
      v.literal("color"),
      v.literal("text"),
    ),
    /** Image/video URL, CSS color, or text depending on kind. */
    content: v.string(),
    startTime: v.number(),
    isEnabled: v.boolean(),
  })
    .index("by_scene", ["sceneId"])
    .index("by_panel", ["panelId"]),

  // ---- comedy game engine (legacy: Crazyball LLPerformance* tables +
  //      the game-1.0.1.js next-button state machine) ----
  performances: defineTable({
    title: v.string(),
    team1: v.string(),
    team2: v.string(),
    status: v.union(v.literal("draft"), v.literal("live"), v.literal("ended")),
    /** Overlay currently shown on the screen page (legacy overlay click). */
    activeOverlay: v.optional(v.string()),
    /** Music track currently cued (legacy SceneLayoutMusic click). */
    activeTrack: v.optional(v.string()),
    ownerId: v.id("users"),
  }),

  // One row per (round, team) — the legacy LLPerformanceRoundTeamGame grid.
  // Rows come in pairs per round: team 1 plays first, then team 2.
  performanceGames: defineTable({
    performanceId: v.id("performances"),
    order: v.number(),
    round: v.number(),
    roundType: v.string(),
    teamIndex: v.union(v.literal(1), v.literal(2)),
    gameName: v.string(),
    votes: v.number(),
    score: v.number(),
    isPlaying: v.boolean(),
    isPlayed: v.boolean(),
    isVoting: v.boolean(),
    isWinner: v.boolean(),
    rotation: v.boolean(),
    /** Whether this round counts toward the score (legacy IsScored). */
    isScored: v.boolean(),
  }).index("by_performance", ["performanceId"]),

  performers: defineTable({
    performanceId: v.id("performances"),
    name: v.string(),
    teamIndex: v.union(v.literal(1), v.literal(2)),
    /** Bell bonus points (legacy WinJoke / bellbonus column). */
    bellBonus: v.number(),
  }).index("by_performance", ["performanceId"]),

  performanceOverlays: defineTable({
    performanceId: v.id("performances"),
    name: v.string(),
    order: v.number(),
  }).index("by_performance", ["performanceId"]),

  performanceTracks: defineTable({
    performanceId: v.id("performances"),
    name: v.string(),
    order: v.number(),
  }).index("by_performance", ["performanceId"]),

  // ---- events & tickets (legacy: Laffupalunga/Crazyball tickets pages) ----
  events: defineTable({
    title: v.string(),
    description: v.string(),
    venue: v.string(),
    startsAt: v.number(),
    priceCents: v.number(),
    capacity: v.number(),
    ticketsSold: v.number(),
  }).index("by_startsAt", ["startsAt"]),

  tickets: defineTable({
    eventId: v.id("events"),
    userId: v.id("users"),
    quantity: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_event", ["eventId"]),

  // ---- marketplace (legacy: Surroundshow Product/Cart) ----
  products: defineTable({
    name: v.string(),
    description: v.string(),
    priceCents: v.number(),
    imageUrl: v.optional(v.string()),
    holiday: v.optional(v.string()),
  }).index("by_holiday", ["holiday"]),

  cartItems: defineTable({
    userId: v.id("users"),
    productId: v.id("products"),
    quantity: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_product", ["userId", "productId"]),

  // ---- resource library (legacy: Resource/ResourceChild/... hierarchy) ----
  resources: defineTable({
    title: v.string(),
    body: v.string(),
    kind: v.union(v.literal("category"), v.literal("article"), v.literal("link")),
    url: v.optional(v.string()),
    parentId: v.optional(v.id("resources")),
    order: v.number(),
  }).index("by_parent", ["parentId"]),
});
