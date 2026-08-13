/**
 * Loco show formats (Comedy Loco, Battle Loco, Wrestle Loco, …).
 *
 * Templates, catalogs, default teams, overlays, and tracks live here so a new
 * loco is data — not a new page tree. Operator routes are
 * `/locos/[slug]/{performances,performance,games}`.
 *
 * `tag` is the short id stored on performances / comedyGames (legacy comedy
 * rows with no tag count as `comedyloco`). `slug` is the URL segment.
 *
 * Keep this file free of Convex function wrappers so the UI can import it.
 */

export type LocoTag = "comedyloco" | "battleloco" | "wrestleloco";

export type CatalogGameSpec = {
  name: string;
  roundType: string;
  shortDescription: string;
  suggestions: string;
  description: string;
};

export type TemplateRound = {
  round: number;
  roundType: string;
  isScored: boolean;
};

export type LocoConfig = {
  tag: LocoTag;
  slug: string;
  name: string;
  blurb: string;
  listHint: string;
  catalogHint: string;
  team1: string;
  team2: string;
  accent: string;
  templateRounds: TemplateRound[];
  overlays: string[];
  tracks: string[];
  catalog: CatalogGameSpec[];
};

const SHARED_OVERLAYS = [
  "Game Instructions",
  "Vote",
  "Suggestions",
  "Score",
  "Box Score",
  "Games",
  "Score Rotation",
];

const SHARED_TRACKS = [
  "BackNForth",
  "BringTheFun",
  "BubbleGumGirl",
  "CockatooInTheGrass",
  "DressedInPink",
  "DrivingYourVibes",
];

export const LOCOS: LocoConfig[] = [
  {
    tag: "comedyloco",
    slug: "comedy-loco",
    name: "Comedy Loco",
    blurb:
      "Team game show: Bananas vs Berries, live scoring and audience votes.",
    listHint:
      "Live comedy game nights — run the console, drive overlays, and push the venue screen.",
    catalogHint:
      "Assign these on a performance so the console knows the type and how to score the round.",
    team1: "Bananas",
    team2: "Berries",
    accent: "from-amber-400 to-orange-500",
    templateRounds: [
      { round: 1, roundType: "Intro", isScored: false },
      { round: 2, roundType: "Bucket", isScored: true },
      { round: 3, roundType: "Choice", isScored: true },
      { round: 4, roundType: "Audience", isScored: true },
      { round: 5, roundType: "Line", isScored: true },
      { round: 6, roundType: "Music", isScored: true },
      { round: 7, roundType: "Challenge", isScored: true },
      { round: 8, roundType: "Volunteer", isScored: true },
      { round: 9, roundType: "Guessing", isScored: true },
      { round: 10, roundType: "Line", isScored: true },
      { round: 11, roundType: "Choice", isScored: true },
      { round: 12, roundType: "Joke", isScored: true },
    ],
    overlays: SHARED_OVERLAYS,
    tracks: SHARED_TRACKS,
    catalog: [
      { name: "Top This", roundType: "Intro", shortDescription: "Warm-up boasts", suggestions: "A job, a hometown", description: "Each team tops the last boast. Unscored." },
      { name: "Countdown", roundType: "Bucket", shortDescription: "Scenes on a timer", suggestions: "A place, a relationship", description: "Play the scene before the countdown hits zero." },
      { name: "More For Me", roundType: "Bucket", shortDescription: "Greedier each beat", suggestions: "A prize, a vice", description: "Every line has to want more than the last." },
      { name: "Oscar", roundType: "Choice", shortDescription: "Awards-show scene", suggestions: "A movie genre", description: "Play the nominated scene in the given genre." },
      { name: "Club Intro", roundType: "Choice", shortDescription: "Club announcement", suggestions: "A club name", description: "Introduce the night's fictional club." },
      { name: "Sound Effects", roundType: "Audience", shortDescription: "Audience makes the FX", suggestions: "A location", description: "The other team (or the room) supplies live sound effects." },
      { name: "World's Worst", roundType: "Line", shortDescription: "Line game", suggestions: "A profession", description: "Worst possible person for the suggestion." },
      { name: "Forward Reverse", roundType: "Line", shortDescription: "Rewind the scene", suggestions: "A first date", description: "Host calls forward and reverse." },
      { name: "Song Fragments", roundType: "Music", shortDescription: "Sung scene", suggestions: "A decade, a feeling", description: "Scene that keeps breaking into song." },
      { name: "Duet", roundType: "Music", shortDescription: "Two-person song", suggestions: "A relationship", description: "Make up a duet about the suggestion." },
      { name: "Debate", roundType: "Challenge", shortDescription: "Point-counterpoint", suggestions: "A ridiculous law", description: "Teams argue opposite sides." },
      { name: "Helping Hands", roundType: "Volunteer", shortDescription: "Volunteer arms", suggestions: "A skilled job", description: "Volunteer supplies the arms; score is volunteer count." },
      { name: "Expert", roundType: "Volunteer", shortDescription: "Endowment interview", suggestions: "An expertise", description: "Volunteer is interviewed as an expert." },
      { name: "Five Things", roundType: "Guessing", shortDescription: "List under pressure", suggestions: "A category", description: "Name five things in the category." },
      { name: "Blind Line", roundType: "Guessing", shortDescription: "Mystery lines", suggestions: "Audience one-liners", description: "Players justify lines they have never seen." },
      { name: "Freeze Tag", roundType: "Joke", shortDescription: "Tap in, new scene", suggestions: "A pose", description: "Freeze, tag, justify the pose." },
    ],
  },
  {
    tag: "battleloco",
    slug: "battle-loco",
    name: "Battle Loco",
    blurb:
      "Esports, physical chaos, and crowd control — Heat vs Ice, Vegas-style.",
    listHint:
      "Competitive Vegas nights — gaming, challenges, crowd votes, and punishments.",
    catalogHint:
      "Gaming, physical, and crowd rounds for Battle Loco. Assign these on a performance.",
    team1: "Heat",
    team2: "Ice",
    accent: "from-sky-400 to-fuchsia-500",
    templateRounds: [
      { round: 1, roundType: "Intro", isScored: false },
      { round: 2, roundType: "Gaming", isScored: true },
      { round: 3, roundType: "Challenge", isScored: true },
      { round: 4, roundType: "Physical", isScored: true },
      { round: 5, roundType: "Crowd", isScored: true },
      { round: 6, roundType: "Punishment", isScored: false },
      { round: 7, roundType: "Finale", isScored: true },
    ],
    overlays: [
      "Game Instructions",
      "Vote",
      "Crowd",
      "Score",
      "Punishment",
      "Games",
      "Score Rotation",
    ],
    tracks: SHARED_TRACKS,
    catalog: [
      { name: "Face Off", roundType: "Intro", shortDescription: "Trash-talk intro", suggestions: "A rivalry", description: "Teams warm up the room. Unscored." },
      { name: "Smash Bros", roundType: "Gaming", shortDescription: "Console showdown", suggestions: "A character", description: "Best-of set on the big screens." },
      { name: "Mario Kart", roundType: "Gaming", shortDescription: "Race night", suggestions: "A cup", description: "Rainbow Road energy, live crowd items." },
      { name: "Trivia Blitz", roundType: "Challenge", shortDescription: "Fast facts", suggestions: "A decade", description: "Buzzer trivia — wrong answers cost you." },
      { name: "Minute to Win It", roundType: "Challenge", shortDescription: "Party stunts", suggestions: "A household object", description: "60 seconds, one ridiculous task." },
      { name: "Relay Race", roundType: "Physical", shortDescription: "Team sprint", suggestions: "A handicap", description: "Physical relay with a silly constraint." },
      { name: "Tug of War", roundType: "Physical", shortDescription: "Pull contest", suggestions: "A wager", description: "Old-school pull. Crowd picks the rope handicap." },
      { name: "Crowd Control", roundType: "Crowd", shortDescription: "Audience runs it", suggestions: "A chant", description: "The room votes, heckles, and changes the rules." },
      { name: "Roast the Loser", roundType: "Crowd", shortDescription: "Crowd roast", suggestions: "A nickname", description: "Audience supplies the lines." },
      { name: "Punishment Wheel", roundType: "Punishment", shortDescription: "Spin the cost", suggestions: "A dare", description: "Loser spins. Spectacle, not a scored round." },
      { name: "Finale Gauntlet", roundType: "Finale", shortDescription: "Last stand", suggestions: "A sudden-death game", description: "Winner-take-the-night mix of game and stunt." },
    ],
  },
  {
    tag: "wrestleloco",
    slug: "wrestle-loco",
    name: "Wrestle Loco",
    blurb:
      "Wrestling comedy — Faces vs Heels, crowd refs, and a multi-pin finale.",
    listHint:
      "Team matches scored by wins. Crowd bits, fan refs, weapons, and a multi-pin close.",
    catalogHint:
      "Matches and crowd bits for Wrestle Loco. Assign these on a performance.",
    team1: "Faces",
    team2: "Heels",
    accent: "from-blue-600 to-rose-500",
    templateRounds: [
      { round: 1, roundType: "Intro", isScored: false },
      { round: 2, roundType: "Match", isScored: true },
      { round: 3, roundType: "Crowd", isScored: false },
      { round: 4, roundType: "Match", isScored: true },
      { round: 5, roundType: "Weapons", isScored: true },
      { round: 6, roundType: "Fan Ref", isScored: true },
      { round: 7, roundType: "Finale", isScored: true },
    ],
    overlays: [
      "Game Instructions",
      "Vote",
      "Crowd",
      "Score",
      "Ring",
      "Games",
      "Score Rotation",
    ],
    tracks: SHARED_TRACKS,
    catalog: [
      { name: "Opening Bell", roundType: "Intro", shortDescription: "Ring walk", suggestions: "An entrance song", description: "Promos and ring intros. Unscored." },
      { name: "Promo Cut", roundType: "Intro", shortDescription: "Mic work", suggestions: "A grudge", description: "Each side cuts a promo. Unscored." },
      { name: "Singles Match", roundType: "Match", shortDescription: "One-on-one", suggestions: "A stipulation", description: "Pin, submission, or host call." },
      { name: "Tag Team", roundType: "Match", shortDescription: "Two-on-two", suggestions: "A team name", description: "Hot tags, comedy spots, one fall." },
      { name: "Crowd Scream", roundType: "Crowd", shortDescription: "Pop contest", suggestions: "A catchphrase", description: "Loudest side wins the bit. Unscored spectacle." },
      { name: "Chair Shot", roundType: "Weapons", shortDescription: "Hardcore comedy", suggestions: "A prop", description: "Approved props only. Winner by pin or host." },
      { name: "Fan Referee", roundType: "Fan Ref", shortDescription: "Audience refs", suggestions: "A volunteer", description: "A fan makes the three-count. Host can overturn." },
      { name: "Battle Royal", roundType: "Finale", shortDescription: "Over the top", suggestions: "An elimination order", description: "Last wrestler in the ring." },
      { name: "Multi-pin", roundType: "Finale", shortDescription: "Everybody in", suggestions: "A time limit", description: "Team multi-pin finale. Most pins wins." },
    ],
  },
];

export function requireLoco(tag?: string | null): LocoConfig {
  const t = tag || "comedyloco";
  const loco = LOCOS.find((l) => l.tag === t);
  if (!loco) throw new Error(`Unknown loco tag "${t}"`);
  return loco;
}

export function getLocoBySlug(slug: string | string[] | undefined): LocoConfig | undefined {
  const s = Array.isArray(slug) ? slug[0] : slug;
  if (!s) return undefined;
  return LOCOS.find((l) => l.slug === s) ?? LOCOS.find((l) => l.tag === s);
}

export function getLocoByTag(tag: string): LocoConfig | undefined {
  return LOCOS.find((l) => l.tag === tag);
}

/** Untagged legacy rows belong to Comedy Loco. */
export function rowTag(tag?: string | null): string {
  return tag || "comedyloco";
}

export function locoRoundTypes(loco: LocoConfig): string[] {
  const types = new Set<string>();
  for (const r of loco.templateRounds) types.add(r.roundType);
  for (const g of loco.catalog) types.add(g.roundType);
  return [...types];
}

export function locoPaths(slug: string) {
  const base = `/locos/${slug}`;
  return {
    hub: "/locos",
    performances: `${base}/performances`,
    performance: `${base}/performance`,
    games: `${base}/games`,
    screen: (id: string) => `${base}/performance/screens/${id}`,
  };
}
