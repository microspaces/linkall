/**
 * Loco show formats (Comedy Loco, Battle Loco, Wrestle Loco, HeadCase, LaffUp, …).
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

export type LocoTag =
  | "comedyloco"
  | "battleloco"
  | "wrestleloco"
  | "headcase"
  | "laffup";

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
      "Wrestling comedy — Faces vs Heels, five 3-round matches, an award ceremony, and an outro.",
    listHint:
      "33-round card: five 3-round matches with breaks and celebrations, then award ceremony and outro.",
    catalogHint:
      "Matches and crowd bits for Wrestle Loco. Assign these on a performance.",
    team1: "Faces",
    team2: "Heels",
    accent: "from-blue-600 to-rose-500",
    templateRounds: [
      { round: 1, roundType: "Intro", isScored: false },
      { round: 2, roundType: "Match Round", isScored: true },
      { round: 3, roundType: "Round Break", isScored: false },
      { round: 4, roundType: "Match Round", isScored: true },
      { round: 5, roundType: "Round Break", isScored: false },
      { round: 6, roundType: "Match Round", isScored: true },
      { round: 7, roundType: "Match Celebration", isScored: false },
      { round: 8, roundType: "Match Round", isScored: true },
      { round: 9, roundType: "Round Break", isScored: false },
      { round: 10, roundType: "Match Round", isScored: true },
      { round: 11, roundType: "Round Break", isScored: false },
      { round: 12, roundType: "Match Round", isScored: true },
      { round: 13, roundType: "Match Celebration", isScored: false },
      { round: 14, roundType: "Match Round", isScored: true },
      { round: 15, roundType: "Round Break", isScored: false },
      { round: 16, roundType: "Match Round", isScored: true },
      { round: 17, roundType: "Round Break", isScored: false },
      { round: 18, roundType: "Match Round", isScored: true },
      { round: 19, roundType: "Match Celebration", isScored: false },
      { round: 20, roundType: "Match Round", isScored: true },
      { round: 21, roundType: "Round Break", isScored: false },
      { round: 22, roundType: "Match Round", isScored: true },
      { round: 23, roundType: "Round Break", isScored: false },
      { round: 24, roundType: "Match Round", isScored: true },
      { round: 25, roundType: "Match Celebration", isScored: false },
      { round: 26, roundType: "Match Round", isScored: true },
      { round: 27, roundType: "Round Break", isScored: false },
      { round: 28, roundType: "Match Round", isScored: true },
      { round: 29, roundType: "Round Break", isScored: false },
      { round: 30, roundType: "Match Round", isScored: true },
      { round: 31, roundType: "Match Celebration", isScored: false },
      { round: 32, roundType: "Award", isScored: false },
      { round: 33, roundType: "Outro", isScored: false },
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
      { name: "Singles Match", roundType: "Match Round", shortDescription: "One-on-one", suggestions: "A stipulation", description: "Pin, submission, or host call." },
      { name: "Tag Team", roundType: "Match Round", shortDescription: "Two-on-two", suggestions: "A team name", description: "Hot tags, comedy spots, one fall." },
      { name: "Triple Threat", roundType: "Match Round", shortDescription: "Three-way", suggestions: "A third wrestler", description: "First pin or submission wins. Chaos welcome." },
      { name: "Chair Shot", roundType: "Match Round", shortDescription: "Hardcore comedy", suggestions: "A prop", description: "Approved props only. Winner by pin or host." },
      { name: "Fan Referee", roundType: "Match Round", shortDescription: "Audience refs", suggestions: "A volunteer", description: "A fan makes the three-count. Host can overturn." },
      { name: "Crowd Scream", roundType: "Round Break", shortDescription: "Pop contest", suggestions: "A catchphrase", description: "Loudest side wins the bit. Unscored spectacle." },
      { name: "Promo Replay", roundType: "Round Break", shortDescription: "Mic between falls", suggestions: "A callback grudge", description: "Replay the beef. Unscored break." },
      { name: "Manager Rant", roundType: "Round Break", shortDescription: "Corner cut-in", suggestions: "A manager catchphrase", description: "Managers steal the mic. Unscored break." },
      { name: "Battle Royal", roundType: "Match Celebration", shortDescription: "Over the top", suggestions: "An elimination order", description: "Last wrestler in the ring." },
      { name: "Multi-pin", roundType: "Match Celebration", shortDescription: "Everybody in", suggestions: "A time limit", description: "Team multi-pin. Most pins wins the celebration." },
      { name: "Champion Announce", roundType: "Award", shortDescription: "Title reveal", suggestions: "A belt name", description: "Announce the night's champion. Unscored." },
      { name: "Medal Ceremony", roundType: "Award", shortDescription: "Podium bit", suggestions: "A medal color", description: "Podium, medals, and heel sabotage. Unscored." },
      { name: "Goodnight", roundType: "Outro", shortDescription: "Send-off", suggestions: "A closing chant", description: "Wave, pose, and thank the room. Unscored." },
      { name: "Autograph Circle", roundType: "Outro", shortDescription: "Meet and greet", suggestions: "A merch item", description: "Sign merch and work the rails. Unscored." },
    ],
  },
  {
    tag: "headcase",
    slug: "head-case",
    name: "HeadCase",
    blurb:
      "AI-assisted comedy bits and sketches — Humans vs Bots, written by the room.",
    listHint:
      "Bit nights: cold opens, AI sketches, crowd prompts, and a callback finale.",
    catalogHint:
      "Bits and sketches for HeadCase. Assign these on a performance.",
    team1: "Humans",
    team2: "Bots",
    accent: "from-violet-500 to-cyan-400",
    templateRounds: [
      { round: 1, roundType: "Intro", isScored: false },
      { round: 2, roundType: "Bit", isScored: true },
      { round: 3, roundType: "Sketch", isScored: true },
      { round: 4, roundType: "Crowd", isScored: true },
      { round: 5, roundType: "Bit", isScored: true },
      { round: 6, roundType: "Callback", isScored: true },
      { round: 7, roundType: "Finale", isScored: true },
    ],
    overlays: [
      "Game Instructions",
      "Vote",
      "Prompt",
      "Score",
      "Bit",
      "Games",
      "Score Rotation",
    ],
    tracks: SHARED_TRACKS,
    catalog: [
      { name: "Cold Open", roundType: "Intro", shortDescription: "Show open", suggestions: "A headline", description: "Host and bots warm up the room. Unscored." },
      { name: "Smart Fridge", roundType: "Bit", shortDescription: "AI character", suggestions: "A 2am snack", description: "A fridge with opinions about your choices." },
      { name: "GPS Therapist", roundType: "Bit", shortDescription: "Recalculating…", suggestions: "A life decision", description: "Navigation as life coaching." },
      { name: "Generated Sketch", roundType: "Sketch", shortDescription: "Room + model", suggestions: "A premise", description: "The room pitches; the bit plays out." },
      { name: "Two-Hander", roundType: "Sketch", shortDescription: "Human vs bot", suggestions: "A relationship", description: "One human, one bot, one scene." },
      { name: "Crowd Prompt", roundType: "Crowd", shortDescription: "Audience seeds the model", suggestions: "A forbidden topic", description: "The room types the next line." },
      { name: "Heckle Filter", roundType: "Crowd", shortDescription: "Live moderation bit", suggestions: "A heckle", description: "Bots remix the heckle into a joke." },
      { name: "Earlier Tonight", roundType: "Callback", shortDescription: "Callback reel", suggestions: "A missed joke", description: "Revisit the night's best wrong turns." },
      { name: "Credits Roast", roundType: "Finale", shortDescription: "Close the file", suggestions: "A credit", description: "Bots roast the humans on the way out." },
    ],
  },
  {
    tag: "laffup",
    slug: "laff-up",
    name: "LaffUp",
    blurb:
      "Open-mic stand-up showcases — Openers vs Headliners, five-minute sets.",
    listHint:
      "Mic nights: host intro, short sets, crowd work, feature, and a headliner close.",
    catalogHint:
      "Sets and crowd bits for LaffUp. Assign these on a performance.",
    team1: "Openers",
    team2: "Headliners",
    accent: "from-rose-400 to-amber-300",
    templateRounds: [
      { round: 1, roundType: "Intro", isScored: false },
      { round: 2, roundType: "Set", isScored: true },
      { round: 3, roundType: "Crowd", isScored: true },
      { round: 4, roundType: "Set", isScored: true },
      { round: 5, roundType: "Feature", isScored: true },
      { round: 6, roundType: "Headliner", isScored: true },
    ],
    overlays: [
      "Game Instructions",
      "Vote",
      "Mic",
      "Score",
      "Lineup",
      "Games",
      "Score Rotation",
    ],
    tracks: SHARED_TRACKS,
    catalog: [
      { name: "Host Open", roundType: "Intro", shortDescription: "House rules", suggestions: "A city", description: "Host warms the room. Unscored." },
      { name: "New Material", roundType: "Set", shortDescription: "Five minutes", suggestions: "A premise", description: "Fresh pages. Crowd scores the set." },
      { name: "Tight Five", roundType: "Set", shortDescription: "Cleanest five", suggestions: "A callback", description: "Best five from the notebook." },
      { name: "Crowd Work", roundType: "Crowd", shortDescription: "Talk to the room", suggestions: "A job in the front row", description: "Off-book with the audience." },
      { name: "Roast a Table", roundType: "Crowd", shortDescription: "Table work", suggestions: "An anniversary", description: "One table becomes the bit." },
      { name: "Feature Set", roundType: "Feature", shortDescription: "Mid-show set", suggestions: "A touring joke", description: "Longer set between openers and the close." },
      { name: "Headliner Set", roundType: "Headliner", shortDescription: "Close the night", suggestions: "A closer", description: "Headliner takes the room home." },
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
