/**
 * Shared loco-format registry, brand-scoped per app.
 *
 * All formats live in one array (Comedy Loco, Battle Loco, Wrestle Loco,
 * HeadCase, LaffUp, This Game Show, Wedding Loco, Bar Loco, …). Each entry
 * has a `brand` so FunFirst and SurroundShow only list their own locos.
 * Direct `/locos/[slug]/...` routes still resolve any slug.
 *
 * Two engine modes (`mode` on each format):
 *   competition — two teams play each round; scored rounds go to audience voting.
 *     comedyloco, battleloco, wrestleloco, thisgameshow.
 *   setlist — one segment at a time; no opponents, scores, or winners.
 *     headcase, laffup, weddingloco, barloco. `team1`/`team2` are cast labels.
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

import type { BrandId } from "@linkall/brands";

export type LocoTag =
  | "comedyloco"
  | "battleloco"
  | "wrestleloco"
  | "headcase"
  | "laffup"
  | "thisgameshow"
  | "weddingloco"
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
  /** competition = paired teams + voting; setlist = one segment at a time. */
  mode: "competition" | "setlist";
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
    brand: "funfirst",
    mode: "competition",
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
    tag: "weddingloco",
    slug: "wedding-loco",
    name: "Wedding Loco",
    brand: "surroundshow",
    mode: "setlist",
    blurb:
      "Reception set list — step through the night's segments from grand entrance to send-off.",
    listHint:
      "14-segment card: grand entrance, toasts, dinner sets, dances, crowd games, cake cutting, and send-off.",
    catalogHint:
      "Entrance, toasts, dinner sets, dances, crowd games, cake, and send-off bits for a Wedding Loco set list. Assign these on a performance.",
    team1: "Bride",
    team2: "Groom",
    accent: "from-pink-300 to-rose-200",
    templateRounds: [
      { round: 1, roundType: "Intro", isScored: false },
      { round: 2, roundType: "Toast", isScored: false },
      { round: 3, roundType: "Set", isScored: false },
      { round: 4, roundType: "Game", isScored: false },
      { round: 5, roundType: "Dance", isScored: false },
      { round: 6, roundType: "Set", isScored: false },
      { round: 7, roundType: "Game", isScored: false },
      { round: 8, roundType: "Ceremony", isScored: false },
      { round: 9, roundType: "Dance", isScored: false },
      { round: 10, roundType: "Set", isScored: false },
      { round: 11, roundType: "Dance", isScored: false },
      { round: 12, roundType: "Set", isScored: false },
      { round: 13, roundType: "Dance", isScored: false },
      { round: 14, roundType: "Outro", isScored: false },
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
      { name: "Grand Entrance", roundType: "Intro", shortDescription: "Couple walk-in", suggestions: "An entrance song", description: "DJ announces the couple. Unscored." },
      { name: "Wedding Party Walk", roundType: "Intro", shortDescription: "Party walk-in", suggestions: "A walk-up song", description: "Bridal party hits the floor. Unscored." },
      { name: "Best Man Toast", roundType: "Toast", shortDescription: "Best man mic", suggestions: "A story", description: "Best man takes the mic. Unscored." },
      { name: "Maid of Honor Toast", roundType: "Toast", shortDescription: "Maid of honor mic", suggestions: "A story", description: "Maid of honor takes the mic. Unscored." },
      { name: "Dinner Playlist", roundType: "Set", shortDescription: "Dinner music", suggestions: "A decade", description: "Soft dinner set while tables eat. Unscored." },
      { name: "Open Floor Set", roundType: "Set", shortDescription: "Dance floor open", suggestions: "A request", description: "Open-floor bangers. Unscored." },
      { name: "Shoe Game", roundType: "Game", shortDescription: "Who knows who", suggestions: "A question", description: "Couple holds shoes and answers." },
      { name: "Bouquet and Garter", roundType: "Game", shortDescription: "Toss and catch", suggestions: "A volunteer", description: "Bouquet toss and garter hunt." },
      { name: "First Dance", roundType: "Dance", shortDescription: "Couple first dance", suggestions: "A first-dance song", description: "Bride and groom take the floor. Unscored." },
      { name: "Parent Dances", roundType: "Dance", shortDescription: "Family dances", suggestions: "A parent song", description: "Parents take their dances. Unscored." },
      { name: "Anniversary Dance", roundType: "Dance", shortDescription: "Longest married", suggestions: "A year", description: "Couples stay on the floor by years. Unscored." },
      { name: "Cake Cutting", roundType: "Ceremony", shortDescription: "Cake bit", suggestions: "A flavor", description: "Cut the cake and feed the bit. Unscored." },
      { name: "Sparkler Send-off", roundType: "Outro", shortDescription: "Exit the venue", suggestions: "A last song", description: "Sparklers, bubbles, and goodnight. Unscored." },
      { name: "Getaway Wave", roundType: "Outro", shortDescription: "Car send-off", suggestions: "A getaway song", description: "Wave them out the door. Unscored." },
    ],
  },
  {
    tag: "barloco",
    slug: "bar-loco",
    name: "Bar Loco",
    brand: "surroundshow",
    mode: "setlist",
    blurb:
      "Bar night set list — step through the night's segments from doors to last call.",
    listHint:
      "12-segment card: doors, happy-hour sets, crowd warmup, trivia, prime set, singalong, bar games, late set, last call, and close.",
    catalogHint:
      "Doors, sets, crowd bits, trivia, bar games, last call, and close bits for a Bar Loco set list. Assign these on a performance.",
    team1: "Regulars",
    team2: "Newcomers",
    accent: "from-teal-400 to-amber-600",
    templateRounds: [
      { round: 1, roundType: "Intro", isScored: false },
      { round: 2, roundType: "Set", isScored: false },
      { round: 3, roundType: "Crowd", isScored: false },
      { round: 4, roundType: "Game", isScored: false },
      { round: 5, roundType: "Break", isScored: false },
      { round: 6, roundType: "Set", isScored: false },
      { round: 7, roundType: "Crowd", isScored: false },
      { round: 8, roundType: "Game", isScored: false },
      { round: 9, roundType: "Set", isScored: false },
      { round: 10, roundType: "Break", isScored: false },
      { round: 11, roundType: "Set", isScored: false },
      { round: 12, roundType: "Outro", isScored: false },
    ],
    overlays: [
      "Game Instructions",
      "Vote",
      "Crowd",
      "Score",
      "Timeline",
      "Games",
      "Score Rotation",
    ],
    tracks: SHARED_TRACKS,
    catalog: [
      { name: "Doors Open", roundType: "Intro", shortDescription: "House lights up", suggestions: "A welcome song", description: "Doors, specials, and first pours. Unscored." },
      { name: "Happy Hour Set", roundType: "Set", shortDescription: "Early floor filler", suggestions: "A decade", description: "Easy set while the room fills. Unscored." },
      { name: "Prime Time Set", roundType: "Set", shortDescription: "Peak-hour set", suggestions: "A request", description: "Prime set when the room is full. Unscored." },
      { name: "Late Set", roundType: "Set", shortDescription: "After-peak set", suggestions: "A last-hour request", description: "Louder, later, stickier songs. Unscored." },
      { name: "Crowd Warmup", roundType: "Crowd", shortDescription: "Host works the room", suggestions: "A regular's name", description: "Host and bartenders warm the room. Unscored." },
      { name: "Singalong", roundType: "Crowd", shortDescription: "Room sings the chorus", suggestions: "A chorus", description: "The room takes the chorus. Unscored." },
      { name: "Roast a Regular", roundType: "Crowd", shortDescription: "Table work", suggestions: "A nickname", description: "One regular becomes the bit. Unscored." },
      { name: "Bar Trivia", roundType: "Game", shortDescription: "Pub quiz", suggestions: "A category", description: "The room buzzes in on bar trivia." },
      { name: "Bar Olympics", roundType: "Game", shortDescription: "Bar stunts", suggestions: "A bar trick", description: "Timed bar games and stunts." },
      { name: "Drink Specials", roundType: "Break", shortDescription: "Specials board", suggestions: "A house pour", description: "Call the specials and reset. Unscored." },
      { name: "Last Call", roundType: "Break", shortDescription: "Last round", suggestions: "A last-call chant", description: "Last call and tab check. Unscored." },
      { name: "Closing Time", roundType: "Outro", shortDescription: "Lights up", suggestions: "A closing song", description: "Last song, lights, and goodnight. Unscored." },
      { name: "Last Song", roundType: "Outro", shortDescription: "One more song", suggestions: "A closer", description: "One more song and out the door. Unscored." },
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
