import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * Shared schema used by every brand. Each brand runs its OWN Convex
 * deployment, so there is no SiteId column anywhere: tenant isolation is
 * physical, not row-level. Tables a brand doesn't use simply stay empty
 * (e.g. `products` on RedWave).
 *
 * `authTables` (sessions, accounts, verification codes, …) come from
 * Convex Auth. `users` is inlined so we can keep LinkAll profile fields
 * while satisfying Convex Auth's required `email` / `phone` indexes.
 */
export default defineSchema({
  ...authTables,

  // ---- social core (legacy: AspNetUsers, Group, Comment, Followers) ----
  users: defineTable({
    name: v.string(),
    handle: v.string(),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    zipCode: v.optional(v.string()),
    /** Legacy AspNetUsers.Id, for re-import / later auth linking. */
    legacyId: v.optional(v.string()),
    tier: v.union(
      v.literal("free"),
      v.literal("silver"),
      v.literal("gold"),
      v.literal("admin"),
    ),
    state: v.optional(v.string()),
    county: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_handle", ["handle"])
    .index("by_legacyId", ["legacyId"]),

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
  })
    .index("by_kind", ["kind"])
    .index("by_name", ["name"])
    .index("by_state", ["state"]),

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
  // `isSolution` can be set on the original post or any reply (RedWave).
  // `hasSolutionReply` is denormalized on top-level posts for filtering.
  posts: defineTable({
    authorId: v.id("users"),
    groupId: v.optional(v.id("groups")),
    parentId: v.optional(v.id("posts")),
    content: v.string(),
    upvotes: v.number(),
    replyCount: v.number(),
    isSolution: v.optional(v.boolean()),
    hasSolutionReply: v.optional(v.boolean()),
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
    /** Sub-brand tag, e.g. "comedyloco" | "headcase" | "halloween" | "homeshow". */
    tag: v.optional(v.string()),
    /** Set-list library unit: a bit or sketch (HeadCase, LaffUp, HomeShow holidays). */
    kind: v.optional(v.union(v.literal("bit"), v.literal("sketch"))),
    /** Catalog bucket this bit/sketch belongs to (Intro, Bit, Set, …). */
    roundType: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("live"), v.literal("ended")),
    currentSceneIndex: v.number(),
    /** Epoch ms when the current scene started, for effect start-time playback. */
    sceneStartedAt: v.optional(v.number()),
    /** Physical layout this show is designed for (legacy Show.ScreenId). */
    layoutId: v.optional(v.id("layouts")),
    /** Performance that last cued this show — expands {performanceId} in URL effects. */
    cuedByPerformanceId: v.optional(v.id("performances")),
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
    /** Legacy Scene.IsOverlay — performance console Overlay bucket + cue. */
    isOverlay: v.optional(v.boolean()),
    /** Legacy Scene.IsSoundEffect — Music / Sounds buckets, no visual steal. */
    isSoundEffect: v.optional(v.boolean()),
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
    /**
     * How this output participates at a venue. Missing = infer from name,
     * else wall. Tablets steal to order; ticket outputs show the bar board;
     * phone is the shared audience-phone canvas (not a per-guest steal).
     */
    role: v.optional(
      v.union(
        v.literal("wall"),
        v.literal("table"),
        v.literal("phone"),
        v.literal("ticket"),
      ),
    ),
    /** Local steal on a table screen. Align still uses alignPanelId. */
    mode: v.optional(v.union(v.literal("show"), v.literal("order"))),
  }).index("by_layout", ["layoutId"]),

  /**
   * Dual-projector cabinet warp. One row per Projector-2 screen: a 3×3
   * homography (normalized [0,1] coords) that maps P2 onto P1, plus a
   * reactive `markersOn` flag the phone flips so both outputs show corner
   * crosshairs during capture. Additive — existing screen/panel rows are
   * unchanged.
   */
  screenWarps: defineTable({
    /** Projector 2 — the output that is pre-warped. */
    screenId: v.id("screens"),
    /** Projector 1 — the reference output. */
    referenceScreenId: v.id("screens"),
    /** Row-major 3×3 homography in normalized [0,1] coordinates. */
    matrix: v.optional(v.array(v.number())),
    capturedAt: v.optional(v.number()),
    imageWidth: v.optional(v.number()),
    imageHeight: v.optional(v.number()),
    /** When true, both cabinet screens show corner markers. */
    markersOn: v.optional(v.boolean()),
  })
    .index("by_screen", ["screenId"])
    .index("by_reference", ["referenceScreenId"]),

  // A panel is a projection surface: a polygon (3–5 points in the legacy
  // X1..X5/Y1..Y5 columns, here an array) drawn on its screen's canvas.
  panels: defineTable({
    screenId: v.id("screens"),
    name: v.string(),
    zIndex: v.number(),
    points: v.array(v.object({ x: v.number(), y: v.number() })),
  }).index("by_screen", ["screenId"]),

  effects: defineTable({
    sceneId: v.id("scenes"),
    /**
     * Physical panel fallback when no logical mapping resolves.
     * Optional: command effects are non-visual and have no panel.
     */
    panelId: v.optional(v.id("panels")),
    /**
     * Logical slot name (legacy Effect.LogicalPanelName). When a display
     * profile maps this name to a panel, playback uses that panel instead.
     */
    logicalPanelName: v.optional(v.string()),
    kind: v.union(
      v.literal("image"),
      v.literal("video"),
      v.literal("color"),
      v.literal("text"),
      v.literal("url"),
      v.literal("html"),
      /** RossTalk switcher command; content is the raw command string. */
      v.literal("command"),
      /** Snap Camera / OS hotkey for the laptop agent; content is ctrl+1. */
      v.literal("hotkey"),
      /**
       * Live remote camera fill. Content is unused (room = this panel's
       * screen). The capture page publishes; Head / Preview subscribe.
       */
      v.literal("camera"),
    ),
    content: v.string(),
    startTime: v.number(),
    isEnabled: v.boolean(),
    /** Optional duration in seconds; null = runs to end of scene. */
    durationSec: v.optional(v.number()),
    /**
     * Offset into the media file/stream (legacy Effect.VideoStartTime).
     * For YouTube this is the embed `start=` second; for <video> it's currentTime.
     */
    videoStartSec: v.optional(v.number()),
  })
    .index("by_scene", ["sceneId"])
    .index("by_panel", ["panelId"]),

  /**
   * RossTalk commands enqueued when a scene becomes current. The bridge
   * (`scripts/rosstalk-bridge.mjs`) drains `pending` rows over TCP.
   */
  sceneCommands: defineTable({
    showId: v.id("shows"),
    sceneId: v.id("scenes"),
    effectId: v.id("effects"),
    /** Token-expanded command string, without the trailing CRLF. */
    command: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("error"),
    ),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_status_created", ["status", "createdAt"])
    .index("by_show", ["showId"]),

  /** Laptop Snap/hotkey queue — separate from RossTalk sceneCommands. */
  hotkeyCommands: defineTable({
    showId: v.id("shows"),
    sceneId: v.id("scenes"),
    effectId: v.id("effects"),
    hotkey: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("error"),
    ),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_status_created", ["status", "createdAt"])
    .index("by_show", ["showId"]),

  /** WebRTC camera mesh: one publisher (laptop/iOS), many subscribers (Head, Preview). */
  cameraPeers: defineTable({
    screenId: v.id("screens"),
    clientId: v.string(),
    role: v.union(v.literal("publisher"), v.literal("subscriber")),
    heartbeatAt: v.number(),
  })
    .index("by_screen", ["screenId"])
    .index("by_screen_client", ["screenId", "clientId"]),

  cameraSignals: defineTable({
    screenId: v.id("screens"),
    fromClientId: v.string(),
    toClientId: v.string(),
    kind: v.union(
      v.literal("offer"),
      v.literal("answer"),
      v.literal("ice"),
    ),
    payload: v.string(),
    createdAt: v.number(),
  }).index("by_screen_to", ["screenId", "toClientId"]),

  // ---- display profiles (legacy DisplayProfile → PanelMapping) ----
  // Show-scoped binding of a logical layout onto a physical Layout:
  // effects carry logicalPanelName; mappings retarget those slots onto panels.
  displayProfiles: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    showId: v.id("shows"),
    layoutId: v.id("layouts"),
    isDefault: v.boolean(),
    ownerId: v.id("users"),
  })
    .index("by_show", ["showId"])
    .index("by_owner", ["ownerId"]),

  panelMappings: defineTable({
    displayProfileId: v.id("displayProfiles"),
    logicalPanelName: v.string(),
    panelId: v.id("panels"),
  })
    .index("by_profile", ["displayProfileId"])
    .index("by_profile_logical", ["displayProfileId", "logicalPanelName"]),

  // ---- comedy game engine (legacy: Comedy Loco LLPerformance* tables +
  //      the game-1.0.1.js next-button state machine) ----
  // Catalog of games (legacy LLGame + Games page). Performance rounds pick from here.
  comedyGames: defineTable({
    name: v.string(),
    /** Round bucket this game belongs to: Intro, Bucket, Choice, Volunteer, … */
    roundType: v.string(),
    shortDescription: v.optional(v.string()),
    suggestions: v.optional(v.string()),
    ask: v.optional(v.string()),
    description: v.optional(v.string()),
    /** Loco format this catalog row belongs to (default: comedyloco). */
    tag: v.optional(v.string()),
  })
    .index("by_roundType", ["roundType"])
    .index("by_tag", ["tag"]),

  performances: defineTable({
    title: v.string(),
    team1: v.string(),
    team2: v.string(),
    status: v.union(v.literal("draft"), v.literal("live"), v.literal("ended")),
    /** Overlay currently shown on the screen page (legacy overlay click). */
    activeOverlay: v.optional(v.string()),
    /** Music track currently cued (legacy SceneLayoutMusic click). */
    activeTrack: v.optional(v.string()),
    /** Designed show this performance cues (legacy Show click on the board). */
    showId: v.optional(v.id("shows")),
    /** Last visual scene cued from that show. */
    activeSceneId: v.optional(v.id("scenes")),
    ownerId: v.id("users"),
    /** Loco format (competition: comedyloco / battleloco / wrestleloco / thisgameshow; setlist: headcase / laffup / homeshow / weddingceremony / weddingreception / barloco). Untagged = comedyloco. */
    tag: v.optional(v.string()),
  }).index("by_tag", ["tag"]),

  // Competition: one row per (round, team) — pairs per round, team 1 then team 2.
  // Set list: one row per template round (teamIndex 1).
  performanceGames: defineTable({
    performanceId: v.id("performances"),
    order: v.number(),
    round: v.number(),
    roundType: v.string(),
    teamIndex: v.union(v.literal(1), v.literal(2)),
    gameName: v.string(),
    /** Optional link to the Games catalog (legacy LLGameId). */
    gameId: v.optional(v.id("comedyGames")),
    /** Set list: designed bit/sketch show this segment plays (Show → Scene → Effect). */
    bitShowId: v.optional(v.id("shows")),
    votes: v.number(),
    score: v.number(),
    isPlaying: v.boolean(),
    isPlayed: v.boolean(),
    isVoting: v.boolean(),
    isWinner: v.boolean(),
    rotation: v.boolean(),
    /** Cue flag (legacy IsCued) — round is lined up, not yet playing. */
    isCued: v.optional(v.boolean()),
    /** Volunteer count (legacy VolunteerBonus / volunteers column). */
    volunteers: v.optional(v.number()),
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

  // ---- events & tickets (legacy: Laffupalunga/Comedy Loco tickets pages) ----
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

  // ---- venue service (seats / booths / phones / tablets → bar tickets) ----
  // Not bound to a loco or show. Operator toggles phone vs tablet features
  // per venue. Event `tickets` stay admission; these are F&B service tickets.
  venues: defineTable({
    name: v.string(),
    layoutId: v.optional(v.id("layouts")),
    phoneOrdering: v.boolean(),
    phoneAsScreen: v.boolean(),
    tabletOrdering: v.boolean(),
    tabletAsScreen: v.boolean(),
    ownerId: v.id("users"),
  })
    .index("by_owner", ["ownerId"])
    .index("by_layout", ["layoutId"]),

  places: defineTable({
    venueId: v.id("venues"),
    name: v.string(),
    kind: v.union(
      v.literal("seat"),
      v.literal("zone"),
      v.literal("booth"),
      v.literal("pickup"),
    ),
    /** Sticker / QR code guests type (e.g. "14", "L", "BAR"). */
    code: v.optional(v.string()),
    order: v.number(),
    /** Booth tablet bound to this place, if any. */
    screenId: v.optional(v.id("screens")),
  })
    .index("by_venue", ["venueId"])
    .index("by_venue_code", ["venueId", "code"])
    .index("by_screen", ["screenId"]),

  menuItems: defineTable({
    venueId: v.id("venues"),
    name: v.string(),
    description: v.optional(v.string()),
    priceCents: v.number(),
    category: v.string(),
    isAvailable: v.boolean(),
    sort: v.number(),
  }).index("by_venue", ["venueId"]),

  placeClaims: defineTable({
    venueId: v.id("venues"),
    placeId: v.id("places"),
    guestKey: v.string(),
    userId: v.optional(v.id("users")),
    claimedAt: v.number(),
  })
    .index("by_venue_guest", ["venueId", "guestKey"])
    .index("by_place", ["placeId"]),

  serviceOrders: defineTable({
    venueId: v.id("venues"),
    placeId: v.id("places"),
    placeName: v.string(),
    guestKey: v.string(),
    userId: v.optional(v.id("users")),
    screenId: v.optional(v.id("screens")),
    status: v.union(
      v.literal("new"),
      v.literal("making"),
      v.literal("ready"),
      v.literal("delivered"),
      v.literal("canceled"),
    ),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_venue", ["venueId"])
    .index("by_venue_status", ["venueId", "status"])
    .index("by_place", ["placeId"])
    .index("by_venue_guest", ["venueId", "guestKey"]),

  serviceOrderLines: defineTable({
    orderId: v.id("serviceOrders"),
    menuItemId: v.optional(v.id("menuItems")),
    name: v.string(),
    priceCents: v.number(),
    quantity: v.number(),
  }).index("by_order", ["orderId"]),
}, { schemaValidation: false });
