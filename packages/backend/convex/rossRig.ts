/**
 * HyperX Arena Ross Video rig map — single source of truth.
 *
 * Inputs, dests, and key numbers are PLACEHOLDERS pending the arena's
 * actual patch list. Renumbering the board is a one-file edit: change the
 * constants below (and nothing in seed / scene effects).
 *
 * 3-key plan (fills come from linkall overlay / observable pages, not
 * Media Store stills):
 *   KEY 1  Full Screen Overlay   — full-frame overlay page
 *   KEY 2  Lower Third           — title / host lower third
 *   KEY 3  Top Corners           — top-left + top-right score bugs
 *
 * See `scripts/ROSS_RIG.md`.
 */

/** Gaming PC / console capture. Placeholder until the patch list lands. */
export const GAMING_FEED_SRC = "IN:5";
/** House / host camera. Placeholder until the patch list lands. */
export const CAMERA_FEED_SRC = "IN:6";
/** Big-screen program dest (ME PGM). Could become AUX:2. */
export const BIG_SCREEN_DEST = "ME:1:PGM";

export const KEY_FULL_OVERLAY = "ME:1:KEY:1";
export const KEY_LOWER_THIRD = "ME:1:KEY:2";
export const KEY_TOP_CORNERS = "ME:1:KEY:3";

/** Logical panel slots for the three key-fill observables. */
export const KEY_FILL_FULL_OVERLAY = "Key Fill: Full Overlay";
export const KEY_FILL_LOWER_THIRD = "Key Fill: Lower Third";
export const KEY_FILL_TOP_CORNERS = "Key Fill: Top Corners";

export const KEY_FILL_LOGICALS = [
  KEY_FILL_FULL_OVERLAY,
  KEY_FILL_LOWER_THIRD,
  KEY_FILL_TOP_CORNERS,
] as const;

export type KeyFillLogical = (typeof KEY_FILL_LOGICALS)[number];

/** Dedicated layout screen so key-fill panels never sit on the LED walls. */
export const ROSS_KEY_FILLS_SCREEN = "Ross Key Fills";

export type RigFeed = "gaming" | "camera";

export type RigKeyState = {
  fullOverlay: boolean;
  lowerThird: boolean;
  topCorners: boolean;
};

export type RigCue = {
  feed: RigFeed;
  keys: RigKeyState;
};

/** `XPT <dest>:<src>` — e.g. `XPT ME:1:PGM:IN:5`. */
export function xpt(dest: string, src: string): string {
  return `XPT ${dest}:${src}`;
}

/**
 * RossTalk key cut. Stored key refs are `ME:1:KEY:N`; the verified command
 * form is `KEYCUT ME:1:N:ON|OFF`.
 */
export function keyCut(key: string, on: boolean): string {
  const ref = key.replace(/:KEY:/i, ":");
  return `KEYCUT ${ref}:${on ? "ON" : "OFF"}`;
}

/** Classify a scene title and return its RossTalk command list (empty if audio). */
export function commandsForScene(
  title: string,
  opts?: { isSoundEffect?: boolean },
): string[] {
  const cue = rigCueForScene(title, opts);
  return cue ? buildCommands(cue) : [];
}

/**
 * Idempotent command set for one cue: big-screen XPT plus all three key
 * states. Re-cueing re-fires the same strings, which is intended.
 */
export function buildCommands(cue: RigCue): string[] {
  const src = cue.feed === "gaming" ? GAMING_FEED_SRC : CAMERA_FEED_SRC;
  return [
    xpt(BIG_SCREEN_DEST, src),
    keyCut(KEY_FULL_OVERLAY, cue.keys.fullOverlay),
    keyCut(KEY_LOWER_THIRD, cue.keys.lowerThird),
    keyCut(KEY_TOP_CORNERS, cue.keys.topCorners),
  ];
}

function normalizeTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Same title set as `wantsSideScores` in sceneCues — corners key during scored play. */
function wantsCornerKey(title: string) {
  const t = normalizeTitle(title);
  if (t.startsWith("winner")) return true;
  return (
    t === "score" ||
    t === "vote" ||
    t === "score rotation" ||
    t === "box score" ||
    t === "game instructions" ||
    t === "instructions"
  );
}

function isScoreOverlayTitle(title: string) {
  const t = normalizeTitle(title);
  return t === "score" || t === "box score" || t === "score rotation";
}

function isFullOverlayTitle(title: string) {
  const t = normalizeTitle(title);
  return (
    t === "vote" ||
    t === "game instructions" ||
    t === "instructions" ||
    t.startsWith("winner") ||
    t === "games" ||
    t === "suggestions" ||
    t === "punishment" ||
    t === "ring"
  );
}

/** Host-facing camera looks: intro, award, outro, crowd, breaks / pauses. */
export function isHostCameraTitle(title: string): boolean {
  const t = normalizeTitle(title);
  if (
    t === "intro" ||
    t === "introduction" ||
    t === "outro" ||
    t === "crowd" ||
    t === "award" ||
    t === "opening bell"
  ) {
    return true;
  }
  return (
    t.startsWith("introduction") ||
    t.startsWith("intro ") ||
    t.startsWith("award") ||
    t.startsWith("pause") ||
    t.startsWith("break")
  );
}

/**
 * Classify a designed scene into the 3-key + big-screen look.
 * Returns null for music / sound-only cues (they must not steal the switcher).
 *
 *  - host / camera  → camera feed, lower third ON, full overlay OFF
 *  - score overlay  → gaming feed, corners ON, full overlay OFF
 *  - full overlay   → full-screen key ON; corners follow `wantsSideScores`
 *  - gameplay       → gaming feed, full overlay ON; corners if scored play
 */
export function rigCueForScene(
  title: string,
  opts?: { isSoundEffect?: boolean },
): RigCue | null {
  if (opts?.isSoundEffect) return null;

  const corners = wantsCornerKey(title);

  if (isHostCameraTitle(title)) {
    return {
      feed: "camera",
      keys: {
        fullOverlay: false,
        lowerThird: true,
        topCorners: corners,
      },
    };
  }

  if (isScoreOverlayTitle(title)) {
    return {
      feed: "gaming",
      keys: {
        fullOverlay: false,
        lowerThird: false,
        topCorners: true,
      },
    };
  }

  if (isFullOverlayTitle(title)) {
    const t = normalizeTitle(title);
    const awardLike = t.startsWith("winner");
    const hostLike = t === "punishment" || t === "ring";
    return {
      feed: awardLike || hostLike ? "camera" : "gaming",
      keys: {
        fullOverlay: true,
        lowerThird: false,
        topCorners: corners,
      },
    };
  }

  return {
    feed: "gaming",
    keys: {
      fullOverlay: true,
      lowerThird: false,
      topCorners: corners,
    },
  };
}

export function selfCheck(): string | null {
  const gaming = buildCommands({
    feed: "gaming",
    keys: { fullOverlay: true, lowerThird: false, topCorners: true },
  });
  const expectGaming = [
    "XPT ME:1:PGM:IN:5",
    "KEYCUT ME:1:1:ON",
    "KEYCUT ME:1:2:OFF",
    "KEYCUT ME:1:3:ON",
  ];
  if (gaming.join("|") !== expectGaming.join("|")) {
    return `gameplay commands mismatch: ${gaming.join(" / ")}`;
  }

  const camera = buildCommands({
    feed: "camera",
    keys: { fullOverlay: false, lowerThird: true, topCorners: false },
  });
  const expectCamera = [
    "XPT ME:1:PGM:IN:6",
    "KEYCUT ME:1:1:OFF",
    "KEYCUT ME:1:2:ON",
    "KEYCUT ME:1:3:OFF",
  ];
  if (camera.join("|") !== expectCamera.join("|")) {
    return `camera commands mismatch: ${camera.join(" / ")}`;
  }

  const intro = rigCueForScene("Intro");
  if (!intro || intro.feed !== "camera" || !intro.keys.lowerThird || intro.keys.fullOverlay) {
    return "Intro should be camera + lower third, full overlay off";
  }
  const vote = rigCueForScene("Vote");
  if (
    !vote ||
    vote.feed !== "gaming" ||
    !vote.keys.fullOverlay ||
    !vote.keys.topCorners ||
    vote.keys.lowerThird
  ) {
    return "Vote should be gaming + full overlay + corners";
  }
  const score = rigCueForScene("Score");
  if (
    !score ||
    score.feed !== "gaming" ||
    score.keys.fullOverlay ||
    !score.keys.topCorners
  ) {
    return "Score should be gaming + corners, full overlay off";
  }
  const play = rigCueForScene("Bring the Boom");
  if (!play || play.feed !== "gaming" || !play.keys.fullOverlay) {
    return "Gameplay / celebration should be gaming + full overlay";
  }
  if (rigCueForScene("BringTheFun", { isSoundEffect: true }) !== null) {
    return "Sound-effect cues must not emit switcher commands";
  }
  return null;
}
