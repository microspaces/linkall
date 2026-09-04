"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getLocoByRoute, getLocoBySlug } from "@linkall/backend/convex/locos";
import { useBrand } from "./brand-context";

const PAGE_LABEL: Record<string, string> = {
  performances: "Performances",
  performance: "Performance",
  preview: "Preview",
  designer: "Designer",
  player: "Player",
  games: "Games",
  overlay: "Overlay",
  screens: "Screen",
  order: "Order",
  bar: "Bar",
  venue: "Venue",
  feed: "Feed",
  people: "People",
  events: "Events & Tickets",
  shows: "Shows",
  camera: "Camera",
  locos: "Locos",
  market: "Marketplace",
  resources: "Resources",
  states: "States",
  signin: "Sign in",
  verify: "Check your email",
};

const MARKETING_TITLES: Record<string, string> = {
  "/battle-loco": "Battle Loco | Hyperex Arena · Luxor Las Vegas",
  "/wrestle-loco": "Wrestle Loco | Location TBA Las Vegas",
};

function overlayLabel(kind: string) {
  const known: Record<string, string> = {
    live: "Live",
    vote: "Vote",
    score: "Score",
    instructions: "Instructions",
    "box-score": "Box Score",
    rotation: "Score Rotation",
    winner: "Winner",
    games: "Games",
    introduction: "Introduction",
    suggestions: "Suggestions",
    crowd: "Crowd",
    punishment: "Punishment",
    ring: "Ring",
    prompt: "Prompt",
    bit: "Bit",
    "news-anchor": "News Anchor",
    infomercial: "Infomercial",
    "court-tv": "Court TV",
    "late-night": "Late Night",
  };
  if (known[kind]) return known[kind];
  return kind
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function locoFromPath(parts: string[]) {
  if (parts.length >= 2) {
    const nested = getLocoByRoute(parts[0], parts[1]);
    if (nested) return { loco: nested, rest: parts.slice(2) };
  }
  const top = getLocoBySlug(parts[0]);
  if (top) return { loco: top, rest: parts.slice(1) };
  return { loco: undefined, rest: parts };
}

function pageLabel(rest: string[], groupsLabel: string) {
  if (rest.includes("overlay")) {
    const kind = rest[rest.indexOf("overlay") + 1];
    return kind ? overlayLabel(kind) : "Overlay";
  }
  if (rest.includes("preview")) return "Preview";
  if (rest.includes("screens")) {
    const i = rest.indexOf("screens");
    return rest[i + 1] ? "Screen" : "Screens";
  }
  const last = rest[rest.length - 1];
  if (!last) return undefined;
  if (last === "groups") return groupsLabel;
  return PAGE_LABEL[last];
}

export function titleForPathname(
  pathname: string,
  brand: { name: string; groupsLabel: string; designerLabel: string },
) {
  const path = pathname.split("?")[0] ?? pathname;
  if (MARKETING_TITLES[path]) return MARKETING_TITLES[path];
  if (path === "/" || path === "") return brand.name;

  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "wedding-loco" && parts.length === 1) {
    return `Wedding Loco · ${brand.name}`;
  }

  const { loco, rest } = locoFromPath(parts);
  const page = pageLabel(rest, brand.groupsLabel);

  if (loco && page) return `${loco.name} · ${page}`;
  if (loco) return loco.name;

  const root = parts[0] ?? "";
  if (root === "groups") return `${brand.groupsLabel} · ${brand.name}`;
  if (root === "designer") return `${brand.designerLabel} · ${brand.name}`;
  if (root === "locos") {
    return brand.name === "SurroundShow"
      ? `Shows · ${brand.name}`
      : `Locos · ${brand.name}`;
  }
  const label = PAGE_LABEL[root];
  if (label) return `${label} · ${brand.name}`;
  return brand.name;
}

/** Set while a preview page is mounted so DocumentTitle does not overwrite it. */
let previewTabTitleOverride: string | null = null;

/** `${showTitle} · Preview`, else performance title, else `fallback`. */
export function showPreviewTabTitle(
  showTitle?: string | null,
  performanceTitle?: string | null,
  fallback = "Preview",
) {
  const show = showTitle?.trim();
  if (show) return `${show} · Preview`;
  if (performanceTitle != null) {
    return `${performanceTitle.trim() || "Performance"} · Preview`;
  }
  return fallback;
}

/** Sets document.title for preview pages. Does not restore on unmount. */
export function useShowPreviewTitle(
  showTitle?: string | null,
  performanceTitle?: string | null,
) {
  const pathname = usePathname();
  const brand = useBrand();
  const fallback = titleForPathname(pathname ?? "/", brand);
  const title = showPreviewTabTitle(showTitle, performanceTitle, fallback);

  useEffect(() => {
    previewTabTitleOverride = title;
    document.title = title;
    return () => {
      previewTabTitleOverride = null;
    };
  }, [title]);
}

export function PreviewDocumentTitle({
  showTitle,
  performanceTitle,
}: {
  showTitle?: string | null;
  performanceTitle?: string | null;
}) {
  useShowPreviewTitle(showTitle, performanceTitle);
  return null;
}

/** Keeps the browser tab in sync with the current show and page. */
export function DocumentTitle() {
  const pathname = usePathname();
  const brand = useBrand();
  const title = titleForPathname(pathname ?? "/", brand);

  useEffect(() => {
    document.title = previewTabTitleOverride ?? title;
  }, [title]);

  return null;
}
