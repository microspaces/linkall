/**
 * How a performance cues scenes designed in a Show.
 *
 * Legacy LinkAll8: the console clicked a Scene row whose Name matched the
 * game event ("game instructions", "vote", "winner bananas", …). Overlay vs
 * music vs sound used Scene.IsOverlay / Scene.IsSoundEffect. That click
 * pushed sceneid to every Screen via DisplayHub.
 *
 * Here the same contract is title + optional flags. Game mutations call
 * `matchSceneIndex` and `playScene` on the performance's bound show.
 */

export type SceneBucket =
  | "overlay"
  | "music"
  | "sound"
  | "intro"
  | "background";

export type SceneCueFields = {
  title: string;
  isOverlay?: boolean;
  isSoundEffect?: boolean;
};

export const GAME_INSTRUCTION_CUE = "Game Instructions";
export const VOTE_CUE = "Vote";
export const SCORE_ROTATION_CUE = "Score Rotation";
export const INTRODUCTION_CUE = "Introduction";

/** Overlay names the game engine cues. Scene titles should match these. */
export const KNOWN_OVERLAY_CUES = [
  "game instructions",
  "vote",
  "suggestions",
  "score",
  "box score",
  "games",
  "score rotation",
  "crowd",
  "punishment",
  "ring",
  "prompt",
  "bit",
  "mic",
  "lineup",
];

const MUSIC_HINTS = [
  "music",
  "track",
  "song",
  "underscore",
  "backnforth",
  "bringthefun",
  "bubblegum",
  "cockatoo",
  "dressedinpink",
  "drivingyourvibes",
];

const SOUND_HINTS = ["sound", "sfx", "sting", "bell", "horn", "applause", "cheer"];

export function normalizeCue(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function winnerCue(teamName: string) {
  return `Winner ${teamName.trim()}`;
}

function compact(name: string) {
  return normalizeCue(name).replace(/[^a-z0-9]+/g, "");
}

function isIntroTitle(title: string) {
  return (
    title === "introduction" ||
    title === "intro" ||
    title.startsWith("introduction") ||
    title.startsWith("intro ")
  );
}

function isOverlayTitle(
  title: string,
  teams?: { team1: string; team2: string },
) {
  if (KNOWN_OVERLAY_CUES.includes(title)) return true;
  if (title.startsWith("winner")) return true;
  if (!teams) return false;
  const t1 = normalizeCue(teams.team1);
  const t2 = normalizeCue(teams.team2);
  return title === `winner ${t1}` || title === `winner ${t2}`;
}

function looksLikeMusic(title: string) {
  const c = compact(title);
  return MUSIC_HINTS.some((h) => c.includes(h));
}

function looksLikeSound(title: string) {
  const c = compact(title);
  return SOUND_HINTS.some((h) => c.includes(h));
}

/** Classify a designed scene into a performance-console bucket. */
export function sceneBucket(
  scene: SceneCueFields,
  teams?: { team1: string; team2: string },
): SceneBucket {
  const title = normalizeCue(scene.title);
  if (scene.isSoundEffect) {
    return looksLikeMusic(title) ? "music" : "sound";
  }
  if (isIntroTitle(title)) return "intro";
  if (scene.isOverlay || isOverlayTitle(title, teams)) return "overlay";
  if (looksLikeMusic(title)) return "music";
  if (looksLikeSound(title)) return "sound";
  return "background";
}

/**
 * Find the designed scene that should play for a cue name.
 * Exact title match first, then "starts with" / "includes".
 */
export function matchSceneIndex(
  scenes: SceneCueFields[],
  cue: string,
): number {
  const want = normalizeCue(cue);
  if (!want) return -1;
  const exact = scenes.findIndex((s) => normalizeCue(s.title) === want);
  if (exact >= 0) return exact;
  const starts = scenes.findIndex((s) =>
    normalizeCue(s.title).startsWith(want),
  );
  if (starts >= 0) return starts;
  return scenes.findIndex((s) => {
    const have = normalizeCue(s.title);
    return have.includes(want) || want.includes(have);
  });
}

export function bucketScenes<T extends SceneCueFields>(
  scenes: T[],
  teams?: { team1: string; team2: string },
) {
  const buckets: Record<SceneBucket, Array<T & { index: number; bucket: SceneBucket }>> =
    {
      overlay: [],
      music: [],
      sound: [],
      intro: [],
      background: [],
    };
  scenes.forEach((scene, index) => {
    const bucket = sceneBucket(scene, teams);
    buckets[bucket].push({ ...scene, index, bucket });
  });
  return buckets;
}

/** Returns an error string, or null if the cue contract still holds. */
export function selfCheck(): string | null {
  const teams = { team1: "Bananas", team2: "Berries" };
  const scenes = [
    { title: "Game Instructions", isOverlay: true },
    { title: "Vote", isOverlay: true },
    { title: "Winner Bananas", isOverlay: true },
    { title: "Introduction" },
    { title: "BringTheFun", isSoundEffect: true },
    { title: "Warmup" },
    { title: "Bell sting", isSoundEffect: true },
  ];
  const expect: Array<[string, SceneBucket]> = [
    ["Game Instructions", "overlay"],
    ["Vote", "overlay"],
    ["Winner Bananas", "overlay"],
    ["Introduction", "intro"],
    ["BringTheFun", "music"],
    ["Warmup", "background"],
    ["Bell sting", "sound"],
  ];
  for (const [title, bucket] of expect) {
    const scene = scenes.find((s) => s.title === title)!;
    const got = sceneBucket(scene, teams);
    if (got !== bucket) return `${title} classified as ${got}, expected ${bucket}`;
  }
  if (matchSceneIndex(scenes, "Game Instructions") !== 0) {
    return "Game Instructions should match index 0";
  }
  if (matchSceneIndex(scenes, "Introduction: Alice") < 0) {
    return "Introduction: Alice should match the Introduction scene";
  }
  if (matchSceneIndex(scenes, winnerCue("Bananas")) < 0) {
    return "Winner Bananas cue should match";
  }
  return null;
}
