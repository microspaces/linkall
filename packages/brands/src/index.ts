/**
 * Brand (tenant) registry.
 *
 * In the legacy ASP.NET app, tenancy was resolved from the request domain into
 * a numeric SiteId (1=Surroundshow, 2=Laffupalunga/FunFirst, 3=RedWaveApp) and
 * every query filtered on it. In the new architecture each brand is a separate
 * app + separate Convex deployment, and this registry is the single source of
 * truth for brand identity, theming and feature flags shared by web and mobile.
 */

export type BrandId = "surroundshow" | "funfirst" | "redwave";

export interface NavItem {
  label: string;
  href: string;
}

export interface ShowTag {
  tag: string;
  label: string;
  blurb: string;
}

export interface Brand {
  id: BrandId;
  name: string;
  tagline: string;
  description: string;
  domain: string;
  /** Names this brand was known by in the legacy system. */
  legacyNames: string[];
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    accent: string;
  };
  features: {
    /** Live show engine (designer / player / screen). */
    shows: boolean;
    /** Product marketplace / store. */
    marketplace: boolean;
    /** Ticketed events. */
    events: boolean;
    /** Hierarchical resource library. */
    resources: boolean;
    /** State / county organizing groups. */
    states: boolean;
  };
  nav: NavItem[];
  /** Sub-brands surfaced as show categories (legacy Site 2 brands). */
  showTags: ShowTag[];
  /** Left-sidebar Designer link label (legacy Surroundshow vs Laffupalunga). */
  designerLabel: string;
  /** Left-sidebar Info link label — "Groups" (Surroundshow) or "Solutions" (Laffupalunga). */
  groupsLabel: string;
}

export const brands: Record<BrandId, Brand> = {
  surroundshow: {
    id: "surroundshow",
    name: "SurroundShow",
    tagline: "Turn your home into the show.",
    description:
      "Design, play and display immersive holiday shows on every screen in the house, and shop the marketplace for ready-made scenes and effects.",
    domain: "surroundshow.com",
    legacyNames: ["Surroundshow (SiteId 1)", "weddingloco.com"],
    colors: {
      primary: "#4f46e5",
      primaryDark: "#3730a3",
      primaryLight: "#eef2ff",
      accent: "#f59e0b",
    },
    features: {
      shows: true,
      marketplace: true,
      events: false,
      resources: false,
      states: false,
    },
    nav: [
      { label: "Shows", href: "/shows" },
      { label: "Designer", href: "/designer" },
      { label: "Player", href: "/player" },
      { label: "Marketplace", href: "/market" },
      { label: "Groups", href: "/groups" },
      { label: "Feed", href: "/feed" },
      { label: "People", href: "/people" },
    ],
    showTags: [
      { tag: "halloween", label: "Halloween", blurb: "Spooky window and yard projections." },
      { tag: "christmas", label: "Christmas", blurb: "Snow, lights and holiday scenes." },
      { tag: "newyear", label: "New Year", blurb: "Countdown and party screens." },
    ],
    designerLabel: "Designer",
    groupsLabel: "Groups",
  },
  funfirst: {
    id: "funfirst",
    name: "FunFirst",
    tagline: "Comedy first. Everything else second.",
    description:
      "Live comedy game shows, stand-up nights and audience-driven mayhem from the FunFirst family: Comedy Loco, Battle Loco, Wrestle Loco, HeadCase, WWCCE and more.",
    domain: "funfirst.com",
    legacyNames: [
      "Laffupalunga (SiteId 2)",
      "laffup.com",
      "comedyloco.com",
      "headcaseai.com",
      "wwcce.com",
      "clubtrotters.com",
      "ThisGameShow.com",
    ],
    colors: {
      primary: "#ea580c",
      primaryDark: "#9a3412",
      primaryLight: "#fff7ed",
      accent: "#db2777",
    },
    features: {
      shows: true,
      marketplace: false,
      events: true,
      resources: false,
      states: false,
    },
    nav: [
      { label: "Shows", href: "/shows" },
      { label: "Designer", href: "/designer" },
      { label: "Player", href: "/player" },
      { label: "Locos", href: "/locos" },
      { label: "Events & Tickets", href: "/events" },
      { label: "Solutions", href: "/groups" },
      { label: "Feed", href: "/feed" },
      { label: "People", href: "/people" },
    ],
    showTags: [
      { tag: "comedyloco", label: "Comedy Loco", blurb: "Team game show: Bananas vs Berries, live scoring and audience votes." },
      { tag: "battleloco", label: "Battle Loco", blurb: "Esports, physical chaos, and crowd control — Heat vs Ice." },
      { tag: "wrestleloco", label: "Wrestle Loco", blurb: "Wrestling comedy — Faces vs Heels, crowd refs, multi-pin finale." },
      { tag: "headcase", label: "HeadCase", blurb: "AI-assisted comedy bits and sketches." },
      { tag: "wwcce", label: "WWCCE", blurb: "Wrestling comedy championship extravaganza." },
      { tag: "laffup", label: "LaffUp", blurb: "Open-mic stand-up showcases." },
    ],
    designerLabel: "Show Designer",
    groupsLabel: "Solutions",
  },
  redwave: {
    id: "redwave",
    name: "RedWave",
    tagline: "Organize your precinct. Move your state.",
    description:
      "Grassroots organizing: state and county groups, precinct playbooks, candidate vetting and a library of political resources.",
    domain: "redwaveapp.com",
    legacyNames: ["RedWaveApp (SiteId 3)", "primaryplan.org", "demhistory.org"],
    colors: {
      primary: "#dc2626",
      primaryDark: "#991b1b",
      primaryLight: "#fef2f2",
      accent: "#1e3a8a",
    },
    features: {
      shows: false,
      marketplace: false,
      events: false,
      resources: true,
      states: true,
    },
    nav: [
      { label: "Resources", href: "/resources" },
      { label: "States", href: "/states" },
      { label: "Groups", href: "/groups" },
      { label: "Feed", href: "/feed" },
      { label: "People", href: "/people" },
    ],
    showTags: [],
    designerLabel: "Designer",
    groupsLabel: "Groups",
  },
};

export function getBrand(id: string | undefined | null): Brand {
  if (id && id in brands) {
    return brands[id as BrandId];
  }
  throw new Error(
    `Unknown brand "${id}". Expected one of: ${Object.keys(brands).join(", ")}`,
  );
}

export const allBrands: Brand[] = Object.values(brands);
