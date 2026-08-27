/**
 * Venue service rules — not bound to a loco or show.
 *
 * Phones and tablets are separate feature pairs the operator toggles:
 *   phones:  order from a claimed place, and/or join as the audience screen
 *   tablets: play the show when idle, and/or steal that output to take orders
 *
 * Keep this file free of Convex wrappers so the UI and self-check can import it.
 */

export const SCREEN_ROLES = ["wall", "table", "phone", "ticket"] as const;
export type ScreenRole = (typeof SCREEN_ROLES)[number];

export const PLACE_KINDS = ["seat", "zone", "booth", "pickup"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export const ORDER_STATUSES = [
  "new",
  "making",
  "ready",
  "delivered",
  "canceled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_NEXT: Record<
  OrderStatus,
  OrderStatus | null
> = {
  new: "making",
  making: "ready",
  ready: "delivered",
  delivered: null,
  canceled: null,
};

export type VenueFlags = {
  phoneOrdering: boolean;
  phoneAsScreen: boolean;
  tabletOrdering: boolean;
  tabletAsScreen: boolean;
};

export const DEFAULT_VENUE_FLAGS: VenueFlags = {
  phoneOrdering: true,
  phoneAsScreen: true,
  tabletOrdering: true,
  tabletAsScreen: true,
};

export function phonesEnabled(flags: VenueFlags): boolean {
  return flags.phoneOrdering || flags.phoneAsScreen;
}

export function tabletsEnabled(flags: VenueFlags): boolean {
  return flags.tabletOrdering || flags.tabletAsScreen;
}

export function inferScreenRole(name: string): ScreenRole {
  const n = name.trim().toLowerCase();
  if (/(^|[\s_-])phone([\s_-]|$)/.test(n)) return "phone";
  if (/(^|[\s_-])(table|booth|seat)s?([\s_-]|$)/.test(n)) return "table";
  if (/(^|[\s_-])(bar|kitchen|ticket|expo|pos)([\s_-]|$)/.test(n)) {
    return "ticket";
  }
  return "wall";
}

export function screenRoleOf(screen: {
  role?: ScreenRole | null;
  name: string;
}): ScreenRole {
  return screen.role ?? inferScreenRole(screen.name);
}

export type ScreenMode = "show" | "order" | "align";

export function screenModeOf(screen: {
  mode?: "show" | "order" | null;
  alignPanelId?: string | null;
}): ScreenMode {
  if (screen.alignPanelId) return "align";
  if (screen.mode === "order") return "order";
  return "show";
}

/** Physical output plays the live show (not a local steal / ticket board). */
export function screenPlaysShow(
  role: ScreenRole,
  flags: VenueFlags,
  mode: ScreenMode,
): boolean {
  if (mode === "order" || mode === "align") return false;
  if (role === "ticket") return false;
  if (role === "table") return flags.tabletAsScreen;
  return true;
}

/**
 * Table output can steal into ordering. The shared Phone canvas does not —
 * guest phones steal locally on /order so other phones keep the show.
 */
export function screenCanStealToOrder(
  role: ScreenRole,
  flags: VenueFlags,
): boolean {
  return role === "table" && flags.tabletOrdering;
}

export function guestPhoneCanOrder(flags: VenueFlags): boolean {
  return flags.phoneOrdering;
}

export function guestPhoneCanJoinShow(flags: VenueFlags): boolean {
  return flags.phoneAsScreen;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function selfCheck(): string | null {
  const off: VenueFlags = {
    phoneOrdering: false,
    phoneAsScreen: false,
    tabletOrdering: false,
    tabletAsScreen: false,
  };
  const phonesOnly: VenueFlags = {
    ...off,
    phoneOrdering: true,
    phoneAsScreen: true,
  };
  const tabletsOnly: VenueFlags = {
    ...off,
    tabletOrdering: true,
    tabletAsScreen: true,
  };
  const orderOnly: VenueFlags = { ...off, tabletOrdering: true };

  if (phonesEnabled(off) || tabletsEnabled(off)) {
    return "all-off should disable both device classes";
  }
  if (!phonesEnabled(phonesOnly) || tabletsEnabled(phonesOnly)) {
    return "phones-only flags";
  }
  if (!tabletsEnabled(tabletsOnly) || phonesEnabled(tabletsOnly)) {
    return "tablets-only flags";
  }

  if (inferScreenRole("Phone") !== "phone") return "infer Phone";
  if (inferScreenRole("Booth 7") !== "table") return "infer Booth";
  if (inferScreenRole("Table 2") !== "table") return "infer Table";
  if (inferScreenRole("Bar") !== "ticket") return "infer Bar";
  if (inferScreenRole("Stage") !== "wall") return "infer Stage";
  if (screenRoleOf({ name: "Phone" }) !== "phone") return "role fallback";
  if (screenRoleOf({ name: "Stage", role: "table" }) !== "table") {
    return "explicit role wins";
  }

  if (!screenPlaysShow("wall", off, "show")) return "wall always plays";
  if (screenPlaysShow("table", off, "show")) return "table off should idle";
  if (!screenPlaysShow("table", tabletsOnly, "show")) {
    return "table on should play";
  }
  if (screenPlaysShow("table", tabletsOnly, "order")) {
    return "table order should steal";
  }
  if (screenPlaysShow("ticket", tabletsOnly, "show")) {
    return "ticket never plays show";
  }
  if (screenPlaysShow("phone", off, "show") !== true) {
    return "physical phone canvas still plays the designed show";
  }

  if (screenCanStealToOrder("table", orderOnly) !== true) {
    return "table steal when tabletOrdering";
  }
  if (screenCanStealToOrder("table", off)) return "no steal when off";
  if (screenCanStealToOrder("phone", phonesOnly)) {
    return "shared phone canvas must not steal globally";
  }
  if (screenCanStealToOrder("wall", tabletsOnly)) return "walls do not order";

  if (!guestPhoneCanOrder(phonesOnly) || guestPhoneCanOrder(off)) {
    return "guest phone ordering flag";
  }
  if (!guestPhoneCanJoinShow(phonesOnly) || guestPhoneCanJoinShow(off)) {
    return "guest phone-as-screen flag";
  }

  if (normalizeCode(" 14 ") !== "14") return "normalize code";
  if (ORDER_STATUS_NEXT.new !== "making") return "status next";
  if (ORDER_STATUS_NEXT.delivered !== null) return "delivered is terminal";
  return null;
}
