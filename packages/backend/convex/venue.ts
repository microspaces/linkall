import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  DEFAULT_VENUE_FLAGS,
  ORDER_STATUS_NEXT,
  guestPhoneCanJoinShow,
  guestPhoneCanOrder,
  normalizeCode,
  screenCanStealToOrder,
  screenModeOf,
  screenPlaysShow,
  screenRoleOf,
  type OrderStatus,
  type PlaceKind,
  type VenueFlags,
} from "./venueLogic";

const flagsValidator = {
  phoneOrdering: v.boolean(),
  phoneAsScreen: v.boolean(),
  tabletOrdering: v.boolean(),
  tabletAsScreen: v.boolean(),
};

function flagsOf(venue: Doc<"venues">): VenueFlags {
  return {
    phoneOrdering: venue.phoneOrdering,
    phoneAsScreen: venue.phoneAsScreen,
    tabletOrdering: venue.tabletOrdering,
    tabletAsScreen: venue.tabletAsScreen,
  };
}

async function placesForVenue(ctx: QueryCtx | MutationCtx, venueId: Id<"venues">) {
  const places = await ctx.db
    .query("places")
    .withIndex("by_venue", (q) => q.eq("venueId", venueId))
    .collect();
  places.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return places;
}

async function menuForVenue(ctx: QueryCtx | MutationCtx, venueId: Id<"venues">) {
  const items = await ctx.db
    .query("menuItems")
    .withIndex("by_venue", (q) => q.eq("venueId", venueId))
    .collect();
  items.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  return items;
}

async function linesForOrder(
  ctx: QueryCtx | MutationCtx,
  orderId: Id<"serviceOrders">,
) {
  const lines = await ctx.db
    .query("serviceOrderLines")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .collect();
  return lines.map((l) => ({
    _id: l._id,
    name: l.name,
    priceCents: l.priceCents,
    quantity: l.quantity,
  }));
}

async function defaultVenue(ctx: QueryCtx | MutationCtx) {
  const venues = await ctx.db.query("venues").collect();
  venues.sort((a, b) => a._creationTime - b._creationTime);
  return venues[0] ?? null;
}

async function venueForLayout(
  ctx: QueryCtx | MutationCtx,
  layoutId: Id<"layouts">,
) {
  const hit = await ctx.db
    .query("venues")
    .withIndex("by_layout", (q) => q.eq("layoutId", layoutId))
    .first();
  return hit ?? (await defaultVenue(ctx));
}

async function placeForScreen(
  ctx: QueryCtx | MutationCtx,
  screenId: Id<"screens">,
) {
  return await ctx.db
    .query("places")
    .withIndex("by_screen", (q) => q.eq("screenId", screenId))
    .first();
}

async function phoneScreenOnLayout(
  ctx: QueryCtx | MutationCtx,
  layoutId: Id<"layouts">,
) {
  const screens = await ctx.db
    .query("screens")
    .withIndex("by_layout", (q) => q.eq("layoutId", layoutId))
    .collect();
  return (
    screens.find((s) => screenRoleOf(s) === "phone") ??
    screens.find((s) => s.name.toLowerCase() === "phone") ??
    null
  );
}

async function livePhoneScreen(ctx: QueryCtx | MutationCtx) {
  const live = await ctx.db
    .query("shows")
    .withIndex("by_status", (q) => q.eq("status", "live"))
    .collect();
  live.sort((a, b) => (b.sceneStartedAt ?? 0) - (a.sceneStartedAt ?? 0));
  for (const show of live) {
    if (!show.layoutId) continue;
    const phone = await phoneScreenOnLayout(ctx, show.layoutId);
    if (phone) return phone;
  }
  return null;
}

export const getDefault = query({
  args: {},
  handler: async (ctx) => {
    const venue = await defaultVenue(ctx);
    if (!venue) return null;
    return {
      ...venue,
      flags: flagsOf(venue),
      places: await placesForVenue(ctx, venue._id),
      menu: await menuForVenue(ctx, venue._id),
    };
  },
});

export const guestView = query({
  args: {
    guestKey: v.string(),
    venueId: v.optional(v.id("venues")),
  },
  handler: async (ctx, { guestKey, venueId }) => {
    const venue = venueId
      ? await ctx.db.get(venueId)
      : await defaultVenue(ctx);
    if (!venue) return null;
    const flags = flagsOf(venue);
    const places = await placesForVenue(ctx, venue._id);
    const menu = await menuForVenue(ctx, venue._id);
    const claim = guestKey
      ? await ctx.db
          .query("placeClaims")
          .withIndex("by_venue_guest", (q) =>
            q.eq("venueId", venue._id).eq("guestKey", guestKey),
          )
          .unique()
      : null;
    const place = claim ? await ctx.db.get(claim.placeId) : null;
    const livePhone = flags.phoneAsScreen ? await livePhoneScreen(ctx) : null;
    const layoutPhone =
      flags.phoneAsScreen && venue.layoutId
        ? await phoneScreenOnLayout(ctx, venue.layoutId)
        : null;
    const phoneScreen = livePhone ?? layoutPhone;
    return {
      venue: { _id: venue._id, name: venue.name, layoutId: venue.layoutId },
      flags,
      phonesOn: flags.phoneOrdering || flags.phoneAsScreen,
      canOrder: guestPhoneCanOrder(flags),
      canJoinShow: guestPhoneCanJoinShow(flags) && !!phoneScreen,
      phoneScreenId: phoneScreen?._id ?? null,
      places,
      menu,
      claim: claim
        ? {
            placeId: claim.placeId,
            placeName: place?.name ?? "",
            placeKind: place?.kind ?? ("seat" as PlaceKind),
            code: place?.code,
          }
        : null,
    };
  },
});

export const forScreen = query({
  args: { screenId: v.id("screens") },
  handler: async (ctx, { screenId }) => {
    const screen = await ctx.db.get(screenId);
    if (!screen) return null;
    const boundPlace = await placeForScreen(ctx, screenId);
    const venue = boundPlace
      ? await ctx.db.get(boundPlace.venueId)
      : await venueForLayout(ctx, screen.layoutId);
    if (!venue) {
      const role = screenRoleOf(screen);
      const flags = DEFAULT_VENUE_FLAGS;
      const mode = screenModeOf(screen);
      return {
        venue: null,
        place: boundPlace,
        flags,
        role,
        mode,
        playsShow: screenPlaysShow(role, flags, mode),
        canStealToOrder: false,
      };
    }
    const flags = flagsOf(venue);
    const role = screenRoleOf(screen);
    const mode = screenModeOf(screen);
    return {
      venue: { _id: venue._id, name: venue.name },
      place: boundPlace,
      flags,
      role,
      mode,
      playsShow: screenPlaysShow(role, flags, mode),
      canStealToOrder: screenCanStealToOrder(role, flags),
    };
  },
});

export const barBoard = query({
  args: {
    venueId: v.optional(v.id("venues")),
    status: v.optional(
      v.union(
        v.literal("new"),
        v.literal("making"),
        v.literal("ready"),
        v.literal("delivered"),
        v.literal("canceled"),
        v.literal("open"),
      ),
    ),
  },
  handler: async (ctx, { venueId, status }) => {
    const venue = venueId
      ? await ctx.db.get(venueId)
      : await defaultVenue(ctx);
    if (!venue) return null;
    let rows = await ctx.db
      .query("serviceOrders")
      .withIndex("by_venue", (q) => q.eq("venueId", venue._id))
      .collect();
    if (status === "open" || status === undefined) {
      rows = rows.filter(
        (o) =>
          o.status === "new" || o.status === "making" || o.status === "ready",
      );
    } else {
      rows = rows.filter((o) => o.status === status);
    }
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const orders = await Promise.all(
      rows.map(async (o) => ({
        ...o,
        lines: await linesForOrder(ctx, o._id),
      })),
    );
    return {
      venue: { _id: venue._id, name: venue.name, flags: flagsOf(venue) },
      orders,
    };
  },
});

export const myOrders = query({
  args: {
    guestKey: v.string(),
    venueId: v.optional(v.id("venues")),
  },
  handler: async (ctx, { guestKey, venueId }) => {
    const venue = venueId
      ? await ctx.db.get(venueId)
      : await defaultVenue(ctx);
    if (!venue || !guestKey) return [];
    const rows = await ctx.db
      .query("serviceOrders")
      .withIndex("by_venue_guest", (q) =>
        q.eq("venueId", venue._id).eq("guestKey", guestKey),
      )
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return await Promise.all(
      rows.slice(0, 20).map(async (o) => ({
        ...o,
        lines: await linesForOrder(ctx, o._id),
      })),
    );
  },
});

export const ensureVenue = mutation({
  args: {
    name: v.optional(v.string()),
    ownerId: v.id("users"),
    layoutId: v.optional(v.id("layouts")),
  },
  handler: async (ctx, { name, ownerId, layoutId }) => {
    const existing = await defaultVenue(ctx);
    if (existing) return existing._id;
    return await ctx.db.insert("venues", {
      name: name?.trim() || "Venue",
      layoutId,
      ownerId,
      ...DEFAULT_VENUE_FLAGS,
    });
  },
});

export const updateVenue = mutation({
  args: {
    venueId: v.id("venues"),
    name: v.optional(v.string()),
    layoutId: v.optional(v.union(v.id("layouts"), v.null())),
    ...flagsValidator,
  },
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (!venue) throw new Error("Venue not found");
    const patch: Partial<Doc<"venues">> = {
      phoneOrdering: args.phoneOrdering,
      phoneAsScreen: args.phoneAsScreen,
      tabletOrdering: args.tabletOrdering,
      tabletAsScreen: args.tabletAsScreen,
    };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Name required");
      patch.name = name;
    }
    if (args.layoutId !== undefined) {
      patch.layoutId = args.layoutId ?? undefined;
    }
    await ctx.db.patch(args.venueId, patch);
  },
});

export const setFlags = mutation({
  args: {
    venueId: v.id("venues"),
    ...flagsValidator,
  },
  handler: async (ctx, { venueId, ...flags }) => {
    const venue = await ctx.db.get(venueId);
    if (!venue) throw new Error("Venue not found");
    await ctx.db.patch(venueId, flags);
  },
});

export const upsertPlace = mutation({
  args: {
    placeId: v.optional(v.id("places")),
    venueId: v.id("venues"),
    name: v.string(),
    kind: v.union(
      v.literal("seat"),
      v.literal("zone"),
      v.literal("booth"),
      v.literal("pickup"),
    ),
    code: v.optional(v.string()),
    screenId: v.optional(v.union(v.id("screens"), v.null())),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new Error("Name required");
    const code = args.code ? normalizeCode(args.code) : undefined;
    if (code) {
      const clash = await ctx.db
        .query("places")
        .withIndex("by_venue_code", (q) =>
          q.eq("venueId", args.venueId).eq("code", code),
        )
        .unique();
      if (clash && clash._id !== args.placeId) {
        throw new Error(`Code ${code} is already used`);
      }
    }
    const screenId =
      args.screenId === undefined
        ? undefined
        : (args.screenId ?? undefined);
    if (args.placeId) {
      const existing = await ctx.db.get(args.placeId);
      if (!existing || existing.venueId !== args.venueId) {
        throw new Error("Place not found");
      }
      await ctx.db.patch(args.placeId, {
        name,
        kind: args.kind,
        code,
        ...(args.screenId !== undefined ? { screenId } : {}),
      });
      return args.placeId;
    }
    const places = await placesForVenue(ctx, args.venueId);
    return await ctx.db.insert("places", {
      venueId: args.venueId,
      name,
      kind: args.kind,
      code,
      order: places.length,
      screenId,
    });
  },
});

export const removePlace = mutation({
  args: { placeId: v.id("places") },
  handler: async (ctx, { placeId }) => {
    const claims = await ctx.db
      .query("placeClaims")
      .withIndex("by_place", (q) => q.eq("placeId", placeId))
      .collect();
    for (const c of claims) await ctx.db.delete(c._id);
    await ctx.db.delete(placeId);
  },
});

export const upsertMenuItem = mutation({
  args: {
    menuItemId: v.optional(v.id("menuItems")),
    venueId: v.id("venues"),
    name: v.string(),
    description: v.optional(v.string()),
    priceCents: v.number(),
    category: v.string(),
    isAvailable: v.boolean(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new Error("Name required");
    if (args.priceCents < 0) throw new Error("Price must be ≥ 0");
    const category = args.category.trim() || "Drinks";
    if (args.menuItemId) {
      const existing = await ctx.db.get(args.menuItemId);
      if (!existing || existing.venueId !== args.venueId) {
        throw new Error("Item not found");
      }
      await ctx.db.patch(args.menuItemId, {
        name,
        description: args.description,
        priceCents: args.priceCents,
        category,
        isAvailable: args.isAvailable,
      });
      return args.menuItemId;
    }
    const items = await menuForVenue(ctx, args.venueId);
    return await ctx.db.insert("menuItems", {
      venueId: args.venueId,
      name,
      description: args.description,
      priceCents: args.priceCents,
      category,
      isAvailable: args.isAvailable,
      sort: items.length,
    });
  },
});

export const removeMenuItem = mutation({
  args: { menuItemId: v.id("menuItems") },
  handler: async (ctx, { menuItemId }) => {
    await ctx.db.delete(menuItemId);
  },
});

export const claimPlace = mutation({
  args: {
    venueId: v.id("venues"),
    guestKey: v.string(),
    placeId: v.optional(v.id("places")),
    code: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (!venue) throw new Error("Venue not found");
    const guestKey = args.guestKey.trim();
    if (!guestKey) throw new Error("Guest key required");

    let place: Doc<"places"> | null = null;
    if (args.placeId) {
      place = await ctx.db.get(args.placeId);
    } else if (args.code) {
      const code = normalizeCode(args.code);
      place = await ctx.db
        .query("places")
        .withIndex("by_venue_code", (q) =>
          q.eq("venueId", args.venueId).eq("code", code),
        )
        .unique();
    }
    if (!place || place.venueId !== args.venueId) {
      throw new Error("Place not found");
    }

    const existing = await ctx.db
      .query("placeClaims")
      .withIndex("by_venue_guest", (q) =>
        q.eq("venueId", args.venueId).eq("guestKey", guestKey),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        placeId: place._id,
        claimedAt: Date.now(),
        ...(args.userId ? { userId: args.userId } : {}),
      });
      return existing._id;
    }
    return await ctx.db.insert("placeClaims", {
      venueId: args.venueId,
      placeId: place._id,
      guestKey,
      userId: args.userId,
      claimedAt: Date.now(),
    });
  },
});

export const placeOrder = mutation({
  args: {
    venueId: v.id("venues"),
    guestKey: v.string(),
    placeId: v.optional(v.id("places")),
    screenId: v.optional(v.id("screens")),
    userId: v.optional(v.id("users")),
    note: v.optional(v.string()),
    lines: v.array(
      v.object({
        menuItemId: v.id("menuItems"),
        quantity: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (!venue) throw new Error("Venue not found");
    const flags = flagsOf(venue);
    const guestKey = args.guestKey.trim();
    if (!guestKey) throw new Error("Guest key required");
    if (args.lines.length === 0) throw new Error("Add at least one item");

    let screen: Doc<"screens"> | null = null;
    if (args.screenId) {
      screen = await ctx.db.get(args.screenId);
      if (!screen) throw new Error("Screen not found");
      const role = screenRoleOf(screen);
      if (!screenCanStealToOrder(role, flags)) {
        throw new Error("Tablet ordering is off");
      }
    } else if (!guestPhoneCanOrder(flags)) {
      throw new Error("Phone ordering is off");
    }

    let place: Doc<"places"> | null = null;
    if (args.placeId) {
      place = await ctx.db.get(args.placeId);
    } else if (screen) {
      place = await placeForScreen(ctx, screen._id);
    } else {
      const claim = await ctx.db
        .query("placeClaims")
        .withIndex("by_venue_guest", (q) =>
          q.eq("venueId", args.venueId).eq("guestKey", guestKey),
        )
        .unique();
      if (claim) place = await ctx.db.get(claim.placeId);
    }
    if (!place || place.venueId !== args.venueId) {
      throw new Error("Claim a seat or booth first");
    }

    const resolved: Array<{
      menuItemId: Id<"menuItems">;
      name: string;
      priceCents: number;
      quantity: number;
    }> = [];
    for (const line of args.lines) {
      const qty = Math.floor(line.quantity);
      if (qty < 1) throw new Error("Quantity must be at least 1");
      const item = await ctx.db.get(line.menuItemId);
      if (!item || item.venueId !== args.venueId) {
        throw new Error("Menu item not found");
      }
      if (!item.isAvailable) throw new Error(`${item.name} is unavailable`);
      resolved.push({
        menuItemId: item._id,
        name: item.name,
        priceCents: item.priceCents,
        quantity: qty,
      });
    }

    const orderId = await ctx.db.insert("serviceOrders", {
      venueId: args.venueId,
      placeId: place._id,
      placeName: place.name,
      guestKey,
      userId: args.userId,
      screenId: screen?._id,
      status: "new",
      note: args.note?.trim() || undefined,
      createdAt: Date.now(),
    });
    for (const line of resolved) {
      await ctx.db.insert("serviceOrderLines", {
        orderId,
        menuItemId: line.menuItemId,
        name: line.name,
        priceCents: line.priceCents,
        quantity: line.quantity,
      });
    }
    return orderId;
  },
});

export const setOrderStatus = mutation({
  args: {
    orderId: v.id("serviceOrders"),
    status: v.union(
      v.literal("new"),
      v.literal("making"),
      v.literal("ready"),
      v.literal("delivered"),
      v.literal("canceled"),
    ),
  },
  handler: async (ctx, { orderId, status }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");
    await ctx.db.patch(orderId, { status });
  },
});

export const advanceOrder = mutation({
  args: { orderId: v.id("serviceOrders") },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");
    const next = ORDER_STATUS_NEXT[order.status as OrderStatus];
    if (!next) return order.status;
    await ctx.db.patch(orderId, { status: next });
    return next;
  },
});

export const startTabletOrder = mutation({
  args: { screenId: v.id("screens") },
  handler: async (ctx, { screenId }) => {
    const screen = await ctx.db.get(screenId);
    if (!screen) throw new Error("Screen not found");
    const boundPlace = await placeForScreen(ctx, screenId);
    const venue = boundPlace
      ? await ctx.db.get(boundPlace.venueId)
      : await venueForLayout(ctx, screen.layoutId);
    if (!venue) throw new Error("No venue for this screen");
    const role = screenRoleOf(screen);
    if (!screenCanStealToOrder(role, flagsOf(venue))) {
      throw new Error("Tablet ordering is off");
    }
    await ctx.db.patch(screenId, { mode: "order" });
  },
});

export const endTabletOrder = mutation({
  args: { screenId: v.id("screens") },
  handler: async (ctx, { screenId }) => {
    const screen = await ctx.db.get(screenId);
    if (!screen) throw new Error("Screen not found");
    await ctx.db.patch(screenId, { mode: "show" });
  },
});
