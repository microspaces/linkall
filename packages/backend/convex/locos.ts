/**
 * Shared loco-format registry, brand-scoped per app.
 *
 * All formats live in one array (Comedy Loco, Battle Loco, Wrestle Loco,
 * HeadCase, LaffUp, This Game Show, Wedding Loco, Bar Loco, …). Each entry
 * has a `brand` so FunFirst and SurroundShow only list their own locos.
 * Direct `/{slug}/...` routes resolve any format (Comedy Loco, LaffUp, …).
 *
 * Two engine modes (`mode` on each format):
 *   competition — two teams play each round; scored rounds go to audience voting.
 *     comedyloco, battleloco, wrestleloco, thisgameshow.
 *   setlist — one segment at a time; no opponents, scores, or winners.
 *     headcase, laffup, homeshow, weddingceremony, weddingreception, barloco.
 * Wedding Ceremony and Wedding Reception are separate set lists.
 *
 * Templates, catalogs, default teams, overlays, and tracks live here so a new
 * loco is data — not a new page tree. Operator routes are
 * `/{slug}/{performances,performance,designer,player,games}`.
 * `/locos` is the format index. SurroundShow's named shows are HomeShow,
 * Wedding Ceremony, Wedding Reception, and Bar Loco.
 * FunFirst's are Comedy Loco, Battle Loco, Wrestle Loco, HeadCase, LaffUp,
 * and This Game Show.
 *
 * `tag` is the short id stored on performances / comedyGames (legacy comedy
 * rows with no tag count as `comedyloco`). `slug` is the URL segment.
 *
 * Keep this file free of Convex function wrappers so the UI can import it.
 */

import type { BrandId } from "@linkall/brands";

export type LocoTag =
  | "comedyloco"
  | "battleloco"
  | "wrestleloco"
  | "headcase"
  | "laffup"
  | "thisgameshow"
  | "homeshow"
  | "weddingceremony"
  | "weddingreception"
  | "barloco";

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
  /** Owning brand — hub and any list surfaces filter on this. */
  brand: BrandId;
  /** Nested under this parent slug, e.g. ceremony under wedding-loco. */
  parentSlug?: string;
  /** competition = paired teams + voting; setlist = one segment at a time; hub = parent of child formats. */
  mode: "competition" | "setlist" | "hub";
  blurb: string;
  listHint: string;
  catalogHint: string;
  team1: string;
  team2: string;
  /** Short name for scoreboard / chant copy. Comedy Loco only. */
  team1Nick?: string;
  team2Nick?: string;
  accent: string;
  templateRounds: TemplateRound[];
  overlays: string[];
  tracks: string[];
  catalog: CatalogGameSpec[];
};

/** Fallback overlay names when a performance has no designed show bound.
 *  Scene titles in the Designer should match these so game buttons cue them. */
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
    brand: "funfirst",
    mode: "competition",
    blurb:
      "Team game show: Banana Peels vs Comedy Clubtrotters, live scoring and audience votes.",
    listHint:
      "Live comedy game nights — run the console, drive overlays, and push the venue screen.",
    catalogHint:
      "Assign these on a performance so the console knows the type and how to score the round.",
    team1: "Banana Peels",
    team2: "Comedy Clubtrotters",
    team1Nick: "Bananas",
    team2Nick: "Clubtrotters",
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
    brand: "funfirst",
    mode: "competition",
    blurb:
      "Five scored games with pauses and celebrations — Heat vs Ice, then an award ceremony and outro.",
    listHint:
      "18-round card: five games with pauses and celebrations, then award ceremony and outro.",
    catalogHint:
      "Games, pauses, celebrations, award, and outro bits for Battle Loco. Assign these on a performance.",
    team1: "Heat",
    team2: "Ice",
    accent: "from-sky-400 to-fuchsia-500",
    templateRounds: [
      { round: 1, roundType: "Intro", isScored: false },
      { round: 2, roundType: "Game", isScored: true },
      { round: 3, roundType: "Pause", isScored: false },
      { round: 4, roundType: "Game Celebration", isScored: false },
      { round: 5, roundType: "Game", isScored: true },
      { round: 6, roundType: "Pause", isScored: false },
      { round: 7, roundType: "Game Celebration", isScored: false },
      { round: 8, roundType: "Game", isScored: true },
      { round: 9, roundType: "Pause", isScored: false },
      { round: 10, roundType: "Game Celebration", isScored: false },
      { round: 11, roundType: "Game", isScored: true },
      { round: 12, roundType: "Pause", isScored: false },
      { round: 13, roundType: "Game Celebration", isScored: false },
      { round: 14, roundType: "Game", isScored: true },
      { round: 15, roundType: "Pause", isScored: false },
      { round: 16, roundType: "Game Celebration", isScored: false },
      { round: 17, roundType: "Award", isScored: false },
      { round: 18, roundType: "Outro", isScored: false },
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
      { name: "Smash Bros", roundType: "Game", shortDescription: "Console showdown", suggestions: "A character", description: "Best-of set on the big screens." },
      { name: "Mario Kart", roundType: "Game", shortDescription: "Race night", suggestions: "A cup", description: "Rainbow Road energy, live crowd items." },
      { name: "Trivia Blitz", roundType: "Game", shortDescription: "Fast facts", suggestions: "A decade", description: "Buzzer trivia — wrong answers cost you." },
      { name: "Minute to Win It", roundType: "Game", shortDescription: "Party stunts", suggestions: "A household object", description: "60 seconds, one ridiculous task." },
      { name: "Relay Race", roundType: "Game", shortDescription: "Team sprint", suggestions: "A handicap", description: "Physical relay with a silly constraint." },
      { name: "Tug of War", roundType: "Game", shortDescription: "Pull contest", suggestions: "A wager", description: "Old-school pull. Crowd picks the rope handicap." },
      { name: "Crowd Control", roundType: "Game", shortDescription: "Audience runs it", suggestions: "A chant", description: "The room votes, heckles, and changes the rules." },
      { name: "Roast the Loser", roundType: "Game", shortDescription: "Crowd roast", suggestions: "A nickname", description: "Audience supplies the lines." },
      { name: "Rivals", roundType: "Game", shortDescription: "Arena shooter", suggestions: "A loadout", description: "High-flying arena shooter showdown." },
      { name: "Chained", roundType: "Game", shortDescription: "Chained obby", suggestions: "A handicap", description: "Two players, one chain, full coordination required." },
      { name: "Dueling Grounds", roundType: "Game", shortDescription: "1v1 duels", suggestions: "A weapon", description: "One-on-one weapons duels, crowd picks the vibe." },
      { name: "Racket Rivals", roundType: "Game", shortDescription: "Racket sport", suggestions: "A courtside chant", description: "Futuristic racket battles - badminton energy, trash-talk rules." },
      { name: "Knockout", roundType: "Game", shortDescription: "Platform brawl", suggestions: "A ring-out", description: "Turn-based platformer where you bump rivals off the map." },
      { name: "Punishment Wheel", roundType: "Pause", shortDescription: "Spin the cost", suggestions: "A dare", description: "Loser spins. Spectacle between games, not scored." },
      { name: "Water Break", roundType: "Pause", shortDescription: "Reset the floor", suggestions: "A hydration dare", description: "Quick reset between games. Unscored." },
      { name: "Champion Streak", roundType: "Game Celebration", shortDescription: "Winner flex", suggestions: "A victory pose", description: "Last game's winner milks the win. Unscored." },
      { name: "Victory Lap", roundType: "Game Celebration", shortDescription: "Crowd lap", suggestions: "A chant", description: "Winners work the room. Unscored celebration." },
      { name: "Trophy Reveal", roundType: "Award", shortDescription: "Title drop", suggestions: "A trophy name", description: "Announce the night's champion. Unscored." },
      { name: "Podium Photo", roundType: "Award", shortDescription: "Podium bit", suggestions: "A pose", description: "Podium, photos, and sore-loser sabotage. Unscored." },
      { name: "Goodnight", roundType: "Outro", shortDescription: "Send-off", suggestions: "A closing chant", description: "Wave, handshake, and thank the room. Unscored." },
    ],
  },
  {
    tag: "wrestleloco",
    slug: "wrestle-loco",
    name: "Wrestle Loco",
    brand: "funfirst",
    mode: "competition",
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
    brand: "funfirst",
    mode: "setlist",
    blurb:
      "AI-assisted bits and sketches, stepped through as a set list.",
    listHint:
      "Step through the night's segments — cold opens, AI sketches, crowd prompts, and a callback finale.",
    catalogHint:
      "Bits and sketches for a HeadCase set list. Assign these on a performance.",
    team1: "Humans",
    team2: "Bots",
    accent: "from-violet-500 to-cyan-400",
    templateRounds: [
      { round: 1, roundType: "Intro", isScored: false },
      { round: 2, roundType: "Bit", isScored: false },
      { round: 3, roundType: "Sketch", isScored: false },
      { round: 4, roundType: "Crowd", isScored: false },
      { round: 5, roundType: "Bit", isScored: false },
      { round: 6, roundType: "Callback", isScored: false },
      { round: 7, roundType: "Finale", isScored: false },
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
      { name: "Two-Hander", roundType: "Sketch", shortDescription: "Human and bot", suggestions: "A relationship", description: "One human, one bot, one scene." },
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
    brand: "funfirst",
    mode: "setlist",
    blurb:
      "Open-mic stand-up showcases, run as a set list.",
    listHint:
      "Step through the night's segments — host intro, short sets, crowd work, feature, and a headliner close.",
    catalogHint:
      "Sets and crowd bits for a LaffUp set list. Assign these on a performance.",
    team1: "Openers",
    team2: "Headliners",
    accent: "from-rose-400 to-amber-300",
    templateRounds: [
      { round: 1, roundType: "Intro", isScored: false },
      { round: 2, roundType: "Set", isScored: false },
      { round: 3, roundType: "Crowd", isScored: false },
      { round: 4, roundType: "Set", isScored: false },
      { round: 5, roundType: "Feature", isScored: false },
      { round: 6, roundType: "Headliner", isScored: false },
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
      { name: "New Material", roundType: "Set", shortDescription: "Five minutes", suggestions: "A premise", description: "Fresh pages. Five minutes on the mic." },
      { name: "Tight Five", roundType: "Set", shortDescription: "Cleanest five", suggestions: "A callback", description: "Best five from the notebook." },
      { name: "Crowd Work", roundType: "Crowd", shortDescription: "Talk to the room", suggestions: "A job in the front row", description: "Off-book with the audience." },
      { name: "Roast a Table", roundType: "Crowd", shortDescription: "Table work", suggestions: "An anniversary", description: "One table becomes the bit." },
      { name: "Feature Set", roundType: "Feature", shortDescription: "Mid-show set", suggestions: "A touring joke", description: "Longer set between openers and the close." },
      { name: "Headliner Set", roundType: "Headliner", shortDescription: "Close the night", suggestions: "A closer", description: "Headliner takes the room home." },
    ],
  },
  {
    tag: "thisgameshow",
    slug: "this-game-show",
    name: "This Game Show",
    brand: "funfirst",
    mode: "competition",
    blurb:
      "Studio game show night — Contestants vs Champions, host open, scored games, audience vote, prize reveal, goodnight.",
    listHint:
      "13-round card: host open, three games with pauses and celebrations, then audience vote, prize reveal, and goodnight.",
    catalogHint:
      "Games, pauses, celebrations, audience vote, prize, and outro bits for This Game Show. Assign these on a performance.",
    team1: "Contestants",
    team2: "Champions",
    accent: "from-emerald-400 to-lime-300",
    templateRounds: [
      { round: 1, roundType: "Intro", isScored: false },
      { round: 2, roundType: "Game", isScored: true },
      { round: 3, roundType: "Pause", isScored: false },
      { round: 4, roundType: "Game Celebration", isScored: false },
      { round: 5, roundType: "Game", isScored: true },
      { round: 6, roundType: "Pause", isScored: false },
      { round: 7, roundType: "Game Celebration", isScored: false },
      { round: 8, roundType: "Game", isScored: true },
      { round: 9, roundType: "Pause", isScored: false },
      { round: 10, roundType: "Game Celebration", isScored: false },
      { round: 11, roundType: "Audience Vote", isScored: true },
      { round: 12, roundType: "Prize Reveal", isScored: false },
      { round: 13, roundType: "Outro", isScored: false },
    ],
    overlays: [
      "Game Instructions",
      "Vote",
      "Contestants",
      "Score",
      "Games",
      "Score Rotation",
    ],
    tracks: SHARED_TRACKS,
    catalog: [
      { name: "Host Open", roundType: "Intro", shortDescription: "Studio welcome", suggestions: "A hometown", description: "Host warms the room and introduces the teams. Unscored." },
      { name: "Lightning Trivia", roundType: "Game", shortDescription: "Fast facts", suggestions: "A category", description: "Buzzer trivia — first correct answer scores." },
      { name: "Price Check", roundType: "Game", shortDescription: "Guess the price", suggestions: "A prize item", description: "Closest without going over wins the round." },
      { name: "Hot Potato Dash", roundType: "Game", shortDescription: "Studio stunt", suggestions: "A household object", description: "Timed physical bit on the studio floor." },
      { name: "Name That Tune", roundType: "Game", shortDescription: "Music trivia", suggestions: "A decade", description: "Buzz in on the hook. First correct title scores." },
      { name: "Commercial Break", roundType: "Pause", shortDescription: "Reset the floor", suggestions: "A fake product", description: "Sponsor bit and floor reset. Unscored." },
      { name: "Water Cooler", roundType: "Pause", shortDescription: "Host banter", suggestions: "A callback", description: "Host fills while teams reset. Unscored." },
      { name: "Winner Bell", roundType: "Game Celebration", shortDescription: "Ding the bell", suggestions: "A victory pose", description: "Last game's winner milks the ding. Unscored." },
      { name: "Confetti Toss", roundType: "Game Celebration", shortDescription: "Winner flex", suggestions: "A chant", description: "Winners work the studio. Unscored celebration." },
      { name: "Applause Meter", roundType: "Audience Vote", shortDescription: "Crowd pick", suggestions: "A favorite moment", description: "The room votes the night's favorite. Scored." },
      { name: "Crowd Favorite", roundType: "Audience Vote", shortDescription: "Audience pick", suggestions: "A standout player", description: "Audience crowns the night's favorite. Scored." },
      { name: "Showcase Showdown", roundType: "Prize Reveal", shortDescription: "Prize package", suggestions: "A dream prize", description: "Reveal the showcase. Unscored." },
      { name: "Envelope Please", roundType: "Prize Reveal", shortDescription: "Big envelope", suggestions: "A prize name", description: "Open the envelope and show the loot. Unscored." },
      { name: "Goodnight", roundType: "Outro", shortDescription: "Send-off", suggestions: "A closing wave", description: "Wave, thank the room, and hit the lights. Unscored." },
    ],
  },
  {
    tag: "homeshow",
    slug: "homeshow",
    name: "HomeShow",
    brand: "surroundshow",
    mode: "setlist",
    blurb:
      "Holiday house shows — Christmas, Halloween, New Year and the rest of the year, stepped through as a set list.",
    listHint:
      "Assign a holiday bit to each segment. Migrated Christmas, Halloween, and New Year shows are already in the library.",
    catalogHint:
      "Each holiday is a bit (designed Show → Scene → Effect), same as a HeadCase sketch.",
    team1: "House",
    team2: "Yard",
    accent: "from-emerald-500 to-red-500",
    templateRounds: [
      { round: 1, roundType: "Intro", isScored: false },
      { round: 2, roundType: "Christmas", isScored: false },
      { round: 3, roundType: "Halloween", isScored: false },
      { round: 4, roundType: "New Year", isScored: false },
      { round: 5, roundType: "Outro", isScored: false },
    ],
    overlays: [
      "Game Instructions",
      "Vote",
      "Dedication",
      "Score",
      "Timeline",
      "Games",
      "Score Rotation",
    ],
    tracks: SHARED_TRACKS,
    catalog: [
      { name: "Welcome Home", roundType: "Intro", shortDescription: "House lights up", suggestions: "A welcome song", description: "Doors, porch, and first look. Unscored." },
      { name: "Christmas", roundType: "Christmas", shortDescription: "Garage Christmas", suggestions: "A carol", description: "Migrated Christmas garage show — candy-stripe roof, video door, glowing gable." },
      { name: "Halloween", roundType: "Halloween", shortDescription: "Haunt the windows", suggestions: "A scare", description: "Migrated Halloween Spooktacular — ghosts, storms, pumpkin finale." },
      { name: "New Year", roundType: "New Year", shortDescription: "Countdown", suggestions: "A toast", description: "Migrated New Year countdown across every screen." },
      { name: "4th of July", roundType: "Holiday", shortDescription: "Fireworks night", suggestions: "A patriotic song", description: "Flags, fireworks, and summer-night projections." },
      { name: "Easter", roundType: "Holiday", shortDescription: "Spring pastels", suggestions: "A spring song", description: "Pastel palettes and spring holiday projections." },
      { name: "Mardi Gras", roundType: "Holiday", shortDescription: "Beads and brass", suggestions: "A parade song", description: "Balcony vibes and parade energy." },
      { name: "St. Patrick's", roundType: "Holiday", shortDescription: "Green lights", suggestions: "A pub song", description: "Green wash and parade screens." },
      { name: "Thanksgiving", roundType: "Holiday", shortDescription: "Autumn house", suggestions: "A hymn", description: "Warm autumn ambience for the house." },
      { name: "Valentine's", roundType: "Holiday", shortDescription: "Date-night house", suggestions: "A love song", description: "Romantic scenes for the windows." },
      { name: "Super Bowl", roundType: "Holiday", shortDescription: "Game-day party", suggestions: "A fight song", description: "Party screens for kickoff through the trophy." },
      { name: "Goodnight", roundType: "Outro", shortDescription: "Lights out", suggestions: "A closer", description: "Last look and house lights. Unscored." },
    ],
  },
  {
    tag: "weddingceremony",
    slug: "wedding-ceremony",
    name: "Wedding Ceremony",
    brand: "surroundshow",
    mode: "setlist",
    blurb:
      "Immersive chapel — wrap-around HD theme, aisle music, vows, rings, kiss, first dance in the room. Pick a theme like Elvis, flowers, forest, neon, or MARRY-OKE.",
    listHint:
      "Short chapel card: arrival, first look, theme, processional, vows, rings, pronouncement, recessional, chapel first dance, photos, send to reception.",
    catalogHint:
      "Assign a theme bit and chapel beats. Themes are designed shows (Show → Scene → Effect) on the wrap-around walls.",
    team1: "Bride",
    team2: "Groom",
    accent: "from-pink-400 to-violet-400",
    templateRounds: [
      { round: 1, roundType: "Intro", isScored: false },
      { round: 2, roundType: "Photo", isScored: false },
      { round: 3, roundType: "Theme", isScored: false },
      { round: 4, roundType: "Aisle", isScored: false },
      { round: 5, roundType: "Speech", isScored: false },
      { round: 6, roundType: "Speech", isScored: false },
      { round: 7, roundType: "Speech", isScored: false },
      { round: 8, roundType: "Speech", isScored: false },
      { round: 9, roundType: "Aisle", isScored: false },
      { round: 10, roundType: "Dance", isScored: false },
      { round: 11, roundType: "Photo", isScored: false },
      { round: 12, roundType: "Outro", isScored: false },
    ],
    overlays: [
      "Theme",
      "Aisle",
      "Vows",
      "Photo",
      "Timeline",
    ],
    tracks: SHARED_TRACKS,
    catalog: [
      { name: "Arrival", roundType: "Intro", shortDescription: "Doors and coordinator", suggestions: "A welcome cue", description: "Couple and guests arrive. Coordinator and officiant meet. Unscored." },
      { name: "First Look", roundType: "Photo", shortDescription: "Bridal room", suggestions: "A first-look song", description: "Bridal room and first-look photos. Unscored." },
      { name: "Flower Wall", roundType: "Photo", shortDescription: "Selfie wall", suggestions: "A pose", description: "Unlimited photos at the flower wall. Unscored." },
      { name: "Romantic Flowers", roundType: "Theme", shortDescription: "Wrap-around roses", suggestions: "A floral aisle song", description: "Immersive chapel theme — traditional romantic flowers on every wall." },
      { name: "Elvis", roundType: "Theme", shortDescription: "Get married by Elvis", suggestions: "Can't Help Falling in Love", description: "Immersive Elvis chapel — officiant, photos, and the Vegas tradition." },
      { name: "Lady Elvis", roundType: "Theme", shortDescription: "Lady Elvis officiant", suggestions: "A Vegas song", description: "Immersive Lady Elvis chapel." },
      { name: "MARRY-OKE", roundType: "Theme", shortDescription: "Karaoke vows", suggestions: "A karaoke duet", description: "Karaoke-style immersive ceremony. The room sings the vows." },
      { name: "Enchanted Forest", roundType: "Theme", shortDescription: "Fairy-tale woods", suggestions: "A forest cue", description: "Wrap-around enchanted forest chapel." },
      { name: "Vintage Vegas Neon", roundType: "Theme", shortDescription: "Neon signs", suggestions: "Viva Las Vegas", description: "Vintage Vegas neon chapel." },
      { name: "Candlelight", roundType: "Theme", shortDescription: "Soft candle walls", suggestions: "A candle aisle", description: "Candlelight immersive chapel." },
      { name: "Under the Sea", roundType: "Theme", shortDescription: "Ocean walls", suggestions: "An underwater cue", description: "Wrap-around under-the-sea chapel." },
      { name: "Van Gogh", roundType: "Theme", shortDescription: "Starry night", suggestions: "A starry aisle", description: "Starry Wedding Night — Van Gogh immersive." },
      { name: "Processional", roundType: "Aisle", shortDescription: "Walk the aisle", suggestions: "An aisle song", description: "Thematic aisle music. Couple and party process. Unscored." },
      { name: "Welcome", roundType: "Speech", shortDescription: "Officiant open", suggestions: "A welcome line", description: "Licensed thematic officiant welcomes the room. Unscored." },
      { name: "Vows", roundType: "Speech", shortDescription: "Thematic or own", suggestions: "A vow line", description: "Traditional/thematic vows, or the couple's own. Unscored." },
      { name: "Rings", roundType: "Speech", shortDescription: "Ring exchange", suggestions: "A ring line", description: "Rings. Unscored." },
      { name: "Pronouncement", roundType: "Speech", shortDescription: "You may kiss", suggestions: "A kiss cue", description: "Pronouncement and kiss. Unscored." },
      { name: "Recessional", roundType: "Aisle", shortDescription: "Walk out", suggestions: "A recessional song", description: "Couple walks out on the theme. Unscored." },
      { name: "Chapel First Dance", roundType: "Dance", shortDescription: "First dance in the room", suggestions: "A first-dance song", description: "Optional first dance in the immersive chapel after the ceremony. Unscored." },
      { name: "Chapel Photos", roundType: "Photo", shortDescription: "Theme photos", suggestions: "A pose", description: "Photos in the wrap-around theme. Unscored." },
      { name: "To Reception", roundType: "Outro", shortDescription: "Send to the party", suggestions: "A transition song", description: "Out of the chapel, into the DJ reception. Unscored." },
    ],
  },
  {
    tag: "weddingreception",
    slug: "wedding-reception",
    name: "Wedding Reception",
    brand: "surroundshow",
    mode: "setlist",
    blurb:
      "DJ reception — a music list with a splatter of interludes: speeches, dances, and games. Guest comments and photos on the screens come later.",
    listHint:
      "DJ card: cocktail mix, entrance, first dance, dinner mix, toasts, parent dances, open floor, games, cake, late mix, last dance, send-off.",
    catalogHint:
      "Most segments are DJ sets. Drop in speech, dance, or game interludes. Guest Wall overlay is reserved for live comments and pics.",
    team1: "Bride",
    team2: "Groom",
    accent: "from-rose-300 to-amber-200",
    templateRounds: [
      { round: 1, roundType: "Set", isScored: false },
      { round: 2, roundType: "Intro", isScored: false },
      { round: 3, roundType: "Dance", isScored: false },
      { round: 4, roundType: "Set", isScored: false },
      { round: 5, roundType: "Speech", isScored: false },
      { round: 6, roundType: "Dance", isScored: false },
      { round: 7, roundType: "Set", isScored: false },
      { round: 8, roundType: "Game", isScored: false },
      { round: 9, roundType: "Set", isScored: false },
      { round: 10, roundType: "Speech", isScored: false },
      { round: 11, roundType: "Game", isScored: false },
      { round: 12, roundType: "Set", isScored: false },
      { round: 13, roundType: "Dance", isScored: false },
      { round: 14, roundType: "Outro", isScored: false },
    ],
    overlays: [
      "Timeline",
      "Dedication",
      "Guest Wall",
      "Games",
      "Vote",
      "Score Rotation",
    ],
    tracks: SHARED_TRACKS,
    catalog: [
      { name: "Cocktail Hour", roundType: "Set", shortDescription: "Dinner-in music", suggestions: "A cocktail playlist", description: "DJ cocktail mix while guests arrive and graze. Unscored." },
      { name: "Grand Entrance", roundType: "Intro", shortDescription: "Couple walk-in", suggestions: "An entrance song", description: "DJ announces the couple and wedding party. Unscored." },
      { name: "First Dance", roundType: "Dance", shortDescription: "Couple first dance", suggestions: "A first-dance song", description: "Bride and groom take the floor. Unscored." },
      { name: "Dinner Mix", roundType: "Set", shortDescription: "Eat-to mix", suggestions: "A dinner decade", description: "Soft DJ set while tables eat. Unscored." },
      { name: "Toasts", roundType: "Speech", shortDescription: "Best man / maid of honor", suggestions: "A story", description: "Speeches. Unscored interlude." },
      { name: "Parent Dances", roundType: "Dance", shortDescription: "Family dances", suggestions: "A parent song", description: "Parents take their dances. Unscored interlude." },
      { name: "Dance Floor Open", roundType: "Set", shortDescription: "Floor filler", suggestions: "A request", description: "DJ opens the floor. Unscored." },
      { name: "Shoe Game", roundType: "Game", shortDescription: "Who knows who", suggestions: "A question", description: "Couple holds shoes and answers. Interlude." },
      { name: "Peak Mix", roundType: "Set", shortDescription: "Peak-hour bangers", suggestions: "A peak request", description: "DJ peak set. Unscored." },
      { name: "Cake Cutting", roundType: "Speech", shortDescription: "Cake bit", suggestions: "A cake song", description: "Cut the cake. Speech/photo interlude." },
      { name: "Bouquet and Garter", roundType: "Game", shortDescription: "Toss and catch", suggestions: "A volunteer", description: "Bouquet toss and garter hunt. Interlude." },
      { name: "Late Mix", roundType: "Set", shortDescription: "Late-night set", suggestions: "A last-hour request", description: "Louder, later DJ set. Unscored." },
      { name: "Last Dance", roundType: "Dance", shortDescription: "Last slow dance", suggestions: "A last-dance song", description: "Last dance. Unscored." },
      { name: "Sparkler Send-off", roundType: "Outro", shortDescription: "Exit the venue", suggestions: "A getaway song", description: "Sparklers, bubbles, and goodnight. Unscored." },
      { name: "Anniversary Dance", roundType: "Dance", shortDescription: "Longest married", suggestions: "A year", description: "Couples stay on the floor by years. Optional interlude." },
      { name: "Open Floor Set", roundType: "Set", shortDescription: "Request hour", suggestions: "A request", description: "Extra DJ block you can drop in anywhere." },
    ],
  },
  {
    tag: "barloco",
    slug: "bar-loco",
    name: "Bar Loco",
    brand: "surroundshow",
    mode: "setlist",
    blurb:
      "Christmas pop-up bar night — doors, welcome pour, classics, hosts, games, Bad Elf, best dressed, carols or karaoke, last call.",
    listHint:
      "12-segment card modeled on The Jingle Bar: walk-in, soundtrack beds, miracle-maker hosts, named games, contest, carols/karaoke, close.",
    catalogHint:
      "Assign these on a performance. Swap Cocktails & Carols vs Karaoke by night; family sessions can pick crafts and kids karaoke.",
    team1: "Naughty",
    team2: "Nice",
    accent: "from-teal-400 to-amber-600",
    templateRounds: [
      { round: 1, roundType: "Intro", isScored: false },
      { round: 2, roundType: "Break", isScored: false },
      { round: 3, roundType: "Set", isScored: false },
      { round: 4, roundType: "Crowd", isScored: false },
      { round: 5, roundType: "Game", isScored: false },
      { round: 6, roundType: "Crowd", isScored: false },
      { round: 7, roundType: "Set", isScored: false },
      { round: 8, roundType: "Game", isScored: false },
      { round: 9, roundType: "Crowd", isScored: false },
      { round: 10, roundType: "Crowd", isScored: false },
      { round: 11, roundType: "Break", isScored: false },
      { round: 12, roundType: "Outro", isScored: false },
    ],
    overlays: [
      "Game Instructions",
      "Vote",
      "Crowd",
      "Photo",
      "Carols",
      "Timeline",
      "Games",
      "Score Rotation",
    ],
    tracks: SHARED_TRACKS,
    catalog: [
      { name: "Doors Open", roundType: "Intro", shortDescription: "Walk-in wonderland", suggestions: "A welcome carol", description: "Tinsel, trees, presents, photo spots. Guests hit the room. Unscored." },
      { name: "Welcome Pour", roundType: "Break", shortDescription: "House cocktail", suggestions: "A signature pour", description: "First drink in the hand. Wednesday sessions include a house cocktail. Unscored." },
      { name: "Christmas Classics", roundType: "Set", shortDescription: "Mariah to Sinatra", suggestions: "A carol", description: "Non-stop Xmas classics bed — Mariah Carey through Frank Sinatra. Unscored." },
      { name: "Miracle Makers", roundType: "Crowd", shortDescription: "Hosts work the room", suggestions: "An elf name", description: "Christmas miracle makers run games and surprises all night. Unscored." },
      { name: "Elf Bingo", roundType: "Game", shortDescription: "Holiday bingo", suggestions: "A naughty-list square", description: "Named Jingle Bar game. Hosts call; room marks. Unscored." },
      { name: "Bad Elf", roundType: "Crowd", shortDescription: "Naughty-list bit", suggestions: "A naughty deed", description: "The Bad Elf works the room for photos, roasts, and the naughty list. Unscored." },
      { name: "Party Hits", roundType: "Set", shortDescription: "Non-carol bangers", suggestions: "A party song", description: "Party tunes under the Christmas bed to keep the floor moving. Unscored." },
      { name: "Reindeer Ring Toss", roundType: "Game", shortDescription: "Ring the antlers", suggestions: "A prize", description: "Named Jingle Bar game. Toss rings onto the reindeer. Unscored." },
      { name: "Snowball Toss", roundType: "Game", shortDescription: "Soft-ball toss", suggestions: "A target", description: "Named Jingle Bar game. Snowball toss for prizes. Unscored." },
      { name: "Best Dressed", roundType: "Crowd", shortDescription: "Ugly sweater / Grinch", suggestions: "A costume", description: "Prizes for the most festive outfits — ugly sweater or surprise Grinch. Unscored." },
      { name: "Cocktails & Carols", roundType: "Crowd", shortDescription: "Wednesday singalong", suggestions: "A carol", description: "Live carols and group singalongs. Swap this in on Wednesday nights. Unscored." },
      { name: "Karaoke", roundType: "Crowd", shortDescription: "Christmas karaoke", suggestions: "A karaoke song", description: "Fri/Sat night overlay — Christmas karaoke. Swap for Cocktails & Carols. Unscored." },
      { name: "Kids Karaoke", roundType: "Crowd", shortDescription: "Family singalong", suggestions: "A kids' carol", description: "Afternoon family sessions. Kids karaoke and singalongs. Unscored." },
      { name: "Holiday Crafts", roundType: "Crowd", shortDescription: "Make a card", suggestions: "A card line", description: "Family craft corner — make-your-own cards. Unscored." },
      { name: "Last Call", roundType: "Break", shortDescription: "Last round", suggestions: "A last-call chant", description: "Last pour and tab check. Unscored." },
      { name: "Closing Time", roundType: "Outro", shortDescription: "Lights up", suggestions: "A closing carol", description: "Last song, lights, and goodnight. Unscored." },
      { name: "Prize Time", roundType: "Crowd", shortDescription: "Prizes!", suggestions: "A winner", description: "Raffles and contest winners — costume contest, ugly sweater, couples quiz. Prize art on screen." },
      { name: "Costume Contest", roundType: "Crowd", shortDescription: "Best costume wins", suggestions: "A costume", description: "Prizes for the most festive or spooky look. Unscored." },
      { name: "Couples Quiz", roundType: "Crowd", shortDescription: "How well do they know each other", suggestions: "A couple fact", description: "Valentine's pairs game — how well do they know each other. Unscored." },
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
  return (
    LOCOS.find((l) => l.slug === s && !l.parentSlug) ??
    LOCOS.find((l) => l.slug === s) ??
    LOCOS.find((l) => l.tag === s)
  );
}

/** Resolve `/{slug}` or `/{parent}/{act}` (e.g. /wedding-loco/ceremony). */
export function getLocoByRoute(
  slug?: string,
  act?: string,
): LocoConfig | undefined {
  if (act) return LOCOS.find((l) => l.slug === act && l.parentSlug === slug);
  return getLocoBySlug(slug);
}

/** Holiday designed-shows that HomeShow treats as bits (migrated house data). */
export const HOMESHOW_HOLIDAYS: { tag: string; name: string; blurb: string }[] = [
  { tag: "christmas", name: "Christmas", blurb: "Snow, lights and holiday scenes." },
  { tag: "halloween", name: "Halloween", blurb: "Spooky window and yard projections." },
  { tag: "newyear", name: "New Year", blurb: "Countdown and party screens." },
  { tag: "july4", name: "4th of July", blurb: "Fireworks and summer night projections." },
  { tag: "easter", name: "Easter", blurb: "Spring holiday projections." },
  { tag: "mardigras", name: "Mardi Gras", blurb: "Beads, brass, balcony vibes." },
  { tag: "stpatricks", name: "St. Patrick's", blurb: "Green lights and parade energy." },
  { tag: "thanksgiving", name: "Thanksgiving", blurb: "Autumn ambience for the house." },
  { tag: "valentines", name: "Valentine's", blurb: "Romantic scenes for date night." },
  { tag: "superbowl", name: "Super Bowl", blurb: "Party screens for game day." },
];

export function isHomeShowHolidayTag(tag?: string | null): boolean {
  return !!tag && HOMESHOW_HOLIDAYS.some((h) => h.tag === tag);
}

export function getLocoByTag(tag: string): LocoConfig | undefined {
  const exact = LOCOS.find((l) => l.tag === tag);
  if (exact) return exact;
  if (isHomeShowHolidayTag(tag)) return LOCOS.find((l) => l.tag === "homeshow");
  return undefined;
}

/** Host-cued locos (Battle / Wrestle / Comedy / …) do not auto-advance. */
export function showIsHostCued(show: {
  tag?: string | null;
  cuedByPerformanceId?: string;
}) {
  if (show.cuedByPerformanceId) return true;
  return !!getLocoByTag(show.tag ?? "");
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

/** Browser tab / metadata title bits for `/{slug}` or `/{parent}/{act}`. */
export function locoLayoutTitle(slug?: string, act?: string) {
  const loco = getLocoByRoute(slug, act) ?? getLocoBySlug(slug);
  const name = loco?.name ?? "Show";
  return { default: name, template: `${name} · %s` };
}

export function locoChildren(parentSlug: string): LocoConfig[] {
  return LOCOS.filter((l) => l.parentSlug === parentSlug);
}

export function locoPaths(slug: string) {
  const loco = getLocoBySlug(slug);
  const base = loco?.parentSlug
    ? `/${loco.parentSlug}/${loco.slug}`
    : `/${loco?.slug ?? slug}`;
  return {
    hub: "/locos",
    home: base,
    performances: `${base}/performances`,
    performance: `${base}/performance`,
    designer: `${base}/designer`,
    player: `${base}/player`,
    games: `${base}/games`,
    screen: (id: string) => `${base}/performance/screens/${id}`,
    overlay: (id: string, kind: string) =>
      `${base}/performance/overlay/${kind}?id=${id}`,
    phone: (id: string) => `${base}/performance/overlay/live?id=${id}`,
    preview: (id: string) => `${base}/performance/preview?id=${id}`,
  };
}
