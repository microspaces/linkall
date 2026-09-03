/**
 * HeadCase phone-engagement bits. Canned options only (max 4), no free text.
 * Console drops these in like any catalog game; votes ride the existing
 * performanceGames isVoting / Vote overlay / playMatchingScene path.
 */

export type HeadcasePhoneBitKind =
  | "burn"
  | "truecap"
  | "land"
  | "caption"
  | "channel";

export type HeadcasePhoneBit = {
  sourceKey: string;
  name: string;
  roundType: string;
  shortDescription: string;
  description: string;
  kind: HeadcasePhoneBitKind;
  prompt: string;
  /** Canned choices shown on the phone. Never more than 4. */
  options: string[];
  /** Host reveal buttons (True or Cap, Will It Land). */
  hostCalls?: string[];
  /** Channel Surf: scene/overlay titles for playMatchingScene. */
  sceneCues?: string[];
};

export const HEADCASE_PHONE_BITS: HeadcasePhoneBit[] = [
  {
    sourceKey: "hc-phone:burn-roulette",
    name: "Burn Roulette",
    roundType: "Crowd",
    shortDescription: "4 burns, one winner",
    description:
      "Room votes the burn. Winner slams as a lower-third chyron; losers sit in the rejected pile.",
    kind: "burn",
    prompt: "Pick the burn.",
    options: [
      "Your personality buffers at 144p.",
      "You clap when the plane lands.",
      "Your group chat is just you.",
      "You still say hashtag out loud.",
    ],
  },
  {
    sourceKey: "hc-phone:true-or-cap",
    name: "True or Cap",
    roundType: "Crowd",
    shortDescription: "TRUE / CAP",
    description:
      "Host tells a story. Room votes TRUE or CAP. Wrong majority gets GULLIBLE; right majority gets CONFESSION.",
    kind: "truecap",
    prompt: "I once got kicked out of a museum for arguing with the audio guide.",
    options: ["TRUE", "CAP"],
    hostCalls: ["TRUE", "CAP"],
  },
  {
    sourceKey: "hc-phone:will-it-land",
    name: "Will It Land",
    roundType: "Bit",
    shortDescription: "YES / NO prediction",
    description:
      "Pre-bit YES/NO on whether this lands. Live percentages on the vote overlay. After the bit, host marks LANDED or BOMBED. Correct side wins.",
    kind: "land",
    prompt: "Will this bit land?",
    options: ["YES", "NO"],
    hostCalls: ["LANDED", "BOMBED"],
  },
  {
    sourceKey: "hc-phone:caption-fight",
    name: "Caption Fight",
    roundType: "Crowd",
    shortDescription: "4 captions, one slam",
    description: "Tap a caption. The winner slams as a full-width chyron.",
    kind: "caption",
    prompt: "Caption this face.",
    options: [
      "Loading charm… 12%.",
      "Emotionally in 480p.",
      "Unsubscribed from this conversation.",
      "My last two brain cells are on a Zoom.",
    ],
  },
  {
    sourceKey: "hc-phone:channel-surf",
    name: "Channel Surf",
    roundType: "Crowd",
    shortDescription: "Pick the channel",
    description:
      "Room picks the head's channel. Winner switches the look via the existing scene cue path.",
    kind: "channel",
    prompt: "Change the channel.",
    options: ["NEWS ANCHOR", "INFOMERCIAL", "COURT TV", "LATE NIGHT"],
    sceneCues: ["News Anchor", "Infomercial", "Court TV", "Late Night"],
  },
];

const BY_NAME = new Map(
  HEADCASE_PHONE_BITS.map((b) => [b.name.toLowerCase(), b]),
);

export function phoneBitByName(name?: string | null): HeadcasePhoneBit | undefined {
  if (!name) return undefined;
  return BY_NAME.get(name.trim().toLowerCase());
}

export function isHeadcasePhoneBit(name?: string | null): boolean {
  return phoneBitByName(name) != null;
}

/** Channel overlay titles the console can cue by hand (and vote-lock targets). */
export const HEADCASE_CHANNEL_OVERLAYS = [
  "News Anchor",
  "Infomercial",
  "Court TV",
  "Late Night",
] as const;

export function catalogSpecForPhoneBit(bit: HeadcasePhoneBit) {
  return {
    name: bit.name,
    roundType: bit.roundType,
    shortDescription: bit.shortDescription,
    suggestions: bit.options.slice(0, 4).join(" · "),
    description: bit.description,
    sourceKey: bit.sourceKey,
  };
}

export function tallyOf(
  bit: HeadcasePhoneBit,
  optionVotes?: number[] | null,
): number[] {
  const n = Math.min(4, bit.options.length);
  return Array.from({ length: n }, (_, i) => optionVotes?.[i] ?? 0);
}

export function majorityIndex(counts: number[]): number {
  let best = 0;
  for (let i = 1; i < counts.length; i++) {
    if ((counts[i] ?? 0) > (counts[best] ?? 0)) best = i;
  }
  return best;
}

export type HeadcaseVoteView = {
  kind: HeadcasePhoneBitKind;
  name: string;
  prompt: string;
  options: string[];
  counts: number[];
  total: number;
  hostCalls?: string[];
  winningOption?: number;
  hostCall?: number;
  resultLabel?: string;
  rejected: string[];
  sceneCue?: string;
  voting: boolean;
};

export function voteViewForGame(game: {
  gameName: string;
  optionVotes?: number[];
  winningOption?: number;
  hostCall?: number;
  isVoting: boolean;
}): HeadcaseVoteView | undefined {
  const bit = phoneBitByName(game.gameName);
  if (!bit) return undefined;
  const counts = tallyOf(bit, game.optionVotes);
  const total = counts.reduce((a, b) => a + b, 0);
  const winningOption = game.winningOption;
  const hostCall = game.hostCall;
  let resultLabel: string | undefined;
  if (winningOption != null) {
    if (bit.kind === "truecap" && hostCall != null) {
      resultLabel = winningOption === hostCall ? "CONFESSION" : "GULLIBLE";
    } else if (bit.kind === "land" && hostCall != null) {
      resultLabel = hostCall === 0 ? "LANDED" : "BOMBED";
    } else {
      resultLabel = bit.options[winningOption];
    }
  }
  const rejected =
    winningOption != null
      ? bit.options.filter((_, i) => i !== winningOption)
      : [];
  const sceneCue =
    bit.kind === "channel" && winningOption != null
      ? (bit.sceneCues?.[winningOption] ?? bit.options[winningOption])
      : undefined;
  return {
    kind: bit.kind,
    name: bit.name,
    prompt: bit.prompt,
    options: bit.options.slice(0, 4),
    counts,
    total,
    hostCalls: bit.hostCalls,
    winningOption,
    hostCall,
    resultLabel,
    rejected,
    sceneCue,
    voting: game.isVoting,
  };
}

export function resultOverlayForBit(
  bit: HeadcasePhoneBit,
  winningOption: number,
  hostCall?: number,
): string {
  if (bit.kind === "channel") {
    return bit.sceneCues?.[winningOption] ?? bit.options[winningOption] ?? "Vote";
  }
  if (bit.kind === "land") {
    const correct = hostCall === 1 ? 1 : 0;
    return `Winner ${bit.options[correct] ?? "YES"}`;
  }
  if (bit.kind === "truecap") return "Prompt";
  return "Bit";
}
