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

/** Overlay page slug for a designed scene title (legacy URL-in-effect). */
export function overlayKindForTitle(title: string): string | null {
  const t = normalizeCue(title);
  if (t === "game instructions" || t === "instructions") return "instructions";
  if (t === "vote") return "vote";
  if (t === "score") return "score";
  if (t === "box score") return "box-score";
  if (t === "score rotation") return "rotation";
  if (t.startsWith("winner")) return "winner";
  if (t === "games") return "games";
  if (t === "introduction" || t.startsWith("introduction")) return "introduction";
  if (t === "suggestions") return "suggestions";
  if (t === "crowd") return "crowd";
  if (t === "punishment") return "punishment";
  if (t === "ring") return "ring";
  return null;
}

export function overlayPath(slug: string, kind: string) {
  return `/${slug}/performance/overlay/${kind}?id={performanceId}`;
}

/** Scenes that put a live team score on the left / right screens (legacy Score/Vote URLs). */
export function wantsSideScores(title: string) {
  const t = normalizeCue(title);
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

/**
 * Full-frame overlay pages keyed on Ross KEY 1 (vote, instructions, winner,
 * games, …). Host looks like Introduction / Crowd use a lower third instead.
 */
export function isFullOverlayCue(title: string): boolean {
  const kind = overlayKindForTitle(title);
  return (
    kind === "instructions" ||
    kind === "vote" ||
    kind === "winner" ||
    kind === "games" ||
    kind === "suggestions" ||
    kind === "punishment" ||
    kind === "ring"
  );
}

/**
 * Scoreboard / corner-score overlay cues keyed on Ross KEY 3
 * (Score, Box Score, Score Rotation).
 */
export function isScoreOverlayCue(title: string): boolean {
  const kind = overlayKindForTitle(title);
  return kind === "score" || kind === "box-score" || kind === "rotation";
}

/** Tokens shared by URL effects and RossTalk command effects. */
export type EffectTokenContext = {
  performanceId?: string;
  score1?: string | number;
  score2?: string | number;
  team1?: string;
  team2?: string;
};

/**
 * Expand LinkAll8-style tokens. URL effects URI-encode team names; command
 * effects pass them through (RossTalk is not a URL).
 */
export function expandEffectTokens(
  raw: string,
  ctx: EffectTokenContext,
  opts?: { encodeTeams?: boolean },
) {
  const encodeTeam = (value: string) =>
    opts?.encodeTeams ? encodeURIComponent(value) : value;
  let out = raw;
  if (ctx.performanceId) {
    out = out.replaceAll("{performanceId}", ctx.performanceId);
    out = out.replaceAll("[performanceId]", ctx.performanceId);
  }
  if (ctx.score1 !== undefined) {
    out = out.replaceAll("[Score1]", String(ctx.score1));
    out = out.replaceAll("{score1}", String(ctx.score1));
  }
  if (ctx.score2 !== undefined) {
    out = out.replaceAll("[Score2]", String(ctx.score2));
    out = out.replaceAll("{score2}", String(ctx.score2));
  }
  if (ctx.team1) {
    out = out.replaceAll("[Team1]", encodeTeam(ctx.team1));
    out = out.replaceAll("{team1}", encodeTeam(ctx.team1));
  }
  if (ctx.team2) {
    out = out.replaceAll("[Team2]", encodeTeam(ctx.team2));
    out = out.replaceAll("{team2}", encodeTeam(ctx.team2));
  }
  return out;
}

/** Expand LinkAll8-style tokens in a URL effect. */
export function expandEffectUrl(raw: string, ctx: EffectTokenContext) {
  return expandEffectTokens(raw, ctx, { encodeTeams: true });
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
  if (!wantsSideScores("Score") || !wantsSideScores("Vote")) {
    return "Score and Vote should show side scores";
  }
  if (!wantsSideScores("Game Instructions") || !wantsSideScores("Winner Bananas")) {
    return "Instructions and Winner should show side scores";
  }
  if (wantsSideScores("Crowd") || wantsSideScores("BringTheFun")) {
    return "Crowd / music should not show side scores";
  }
  if (!isFullOverlayCue("Vote") || !isFullOverlayCue("Game Instructions")) {
    return "Vote / Instructions should be full-overlay cues";
  }
  if (isFullOverlayCue("Score") || isFullOverlayCue("Introduction")) {
    return "Score / Introduction should not be full-overlay cues";
  }
  if (!isScoreOverlayCue("Score") || !isScoreOverlayCue("Score Rotation")) {
    return "Score / Score Rotation should be score-overlay cues";
  }
  if (isScoreOverlayCue("Vote") || isScoreOverlayCue("Crowd")) {
    return "Vote / Crowd should not be score-overlay cues";
  }
  const url = expandEffectUrl("/x?id={performanceId}&t=[Team1]", {
    performanceId: "abc",
    team1: "A B",
  });
  if (url !== "/x?id=abc&t=A%20B") {
    return `URL tokens expected encoded team, got ${url}`;
  }
  const cmd = expandEffectTokens("XPT AUX:2:{team1} [Score1]", {
    team1: "A B",
    score1: 7,
  });
  if (cmd !== "XPT AUX:2:A B 7") {
    return `command tokens should not URI-encode teams, got ${cmd}`;
  }
  return null;
}
