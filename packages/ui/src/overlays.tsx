"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@linkall/backend/convex/_generated/api";

type PerformanceView = NonNullable<FunctionReturnType<typeof api.game.get>>;
type HeadcaseVoteBit = NonNullable<PerformanceView["voteBit"]>;

/**
 * Overlay page slug → cue string OverlayView matches on.
 * Shared by the performance player (forceKind) and the preview wall
 * (title-based inference via overlayCueFromTitle).
 */
export const OVERLAY_KIND_TO_CUE: Record<string, string> = {
  instructions: "game instructions",
  "game-instructions": "game instructions",
  vote: "vote",
  score: "score",
  "score-1": "score-1",
  "score-2": "score-2",
  "score-team1": "score-1",
  "score-team2": "score-2",
  "box-score": "box score",
  rotation: "score rotation",
  "score-rotation": "score rotation",
  winner: "winner",
  games: "games",
  introduction: "introduction",
  suggestions: "suggestions",
  crowd: "crowd",
  punishment: "punishment",
  ring: "ring",
  live: "",
  phone: "",
  bit: "bit",
  prompt: "prompt",
  "news-anchor": "news anchor",
  infomercial: "infomercial",
  "court-tv": "court tv",
  "late-night": "late night",
};

const KNOWN_CUES = new Set(
  Object.values(OVERLAY_KIND_TO_CUE).filter((cue) => cue.length > 0),
);

export function normalizeOverlayCue(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Infer the overlay cue OverlayView matches on from a designed scene title.
 * "Game Instructions" → "game instructions", "Winner X" keeps the full cue
 * so the winner name can be stripped for display.
 */
export function overlayCueFromTitle(title: string): string | null {
  const t = normalizeOverlayCue(title);
  if (!t) return null;
  const fromKind = OVERLAY_KIND_TO_CUE[t];
  if (fromKind) return fromKind;
  if (KNOWN_CUES.has(t)) return t;
  // Keep original casing so Winner / Introduction labels strip cleanly.
  if (t.startsWith("winner") || t.startsWith("introduction")) return title.trim();
  return null;
}

/** Title mapping first; `isOverlay` only as a fallback for unknown titles. */
export function overlayCueFromScene(scene: {
  title: string;
  isOverlay?: boolean;
} | null | undefined): string | null {
  if (!scene) return null;
  const fromTitle = overlayCueFromTitle(scene.title);
  if (fromTitle) return fromTitle;
  if (scene.isOverlay) return scene.title.trim();
  return null;
}

function teamName(view: PerformanceView, teamIndex: 1 | 2) {
  return teamIndex === 1 ? view.team1 : view.team2;
}

function votePercents(voteBit: HeadcaseVoteBit) {
  return voteBit.counts.map((c) =>
    voteBit.total ? Math.round((c / voteBit.total) * 100) : 0,
  );
}

function HeadcasePhoneBitOverlay({
  view,
  voteBit,
  compact,
  interactive,
}: {
  view: PerformanceView;
  voteBit: HeadcaseVoteBit;
  compact: boolean;
  interactive: boolean;
}) {
  const voteOption = useMutation(api.game.voteOption);
  const [picked, setPicked] = useState<number | null>(null);
  const storageKey = `linkall.headcaseVote.${view._id}.${voteBit.name}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw != null && raw !== "") setPicked(Number(raw));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  if (!voteBit.voting && voteBit.winningOption != null) {
    return <HeadcaseBitResult voteBit={voteBit} compact={compact} />;
  }

  const percents = votePercents(voteBit);
  const twoCol = voteBit.options.length <= 2;
  const canTap = interactive && voteBit.voting && picked == null;

  return (
    <div className={compact ? "px-4 text-center" : "px-6 text-center sm:px-10"}>
      <p
        className={
          compact
            ? "text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300/80"
            : "text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300/80"
        }
      >
        {voteBit.name}
      </p>
      <h1
        className={
          compact
            ? "mt-2 text-2xl font-black text-white"
            : "mt-4 text-4xl font-black text-white sm:text-6xl"
        }
      >
        {voteBit.prompt}
      </h1>
      <div
        className={
          "mx-auto mt-6 grid max-w-3xl gap-3 " +
          (twoCol ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")
        }
      >
        {voteBit.options.map((label, i) => {
          const selected = picked === i;
          return (
            <button
              key={label}
              type="button"
              disabled={!canTap}
              onClick={() => {
                if (!canTap) return;
                setPicked(i);
                try {
                  window.localStorage.setItem(storageKey, String(i));
                } catch {
                  /* ignore */
                }
                void voteOption({
                  performanceId: view._id,
                  optionIndex: i,
                });
              }}
              className={
                "rounded-2xl border px-4 py-4 text-left transition " +
                (selected
                  ? "border-cyan-300 bg-cyan-400/20 text-white"
                  : canTap
                    ? "border-white/20 bg-white/5 text-white hover:border-cyan-300/70 hover:bg-white/10"
                    : "border-white/10 bg-white/5 text-white/90")
              }
            >
              <span
                className={
                  compact ? "text-lg font-black" : "text-2xl font-black"
                }
              >
                {label}
              </span>
              <span className="mt-1 block text-sm font-semibold tabular-nums text-cyan-200">
                {percents[i]}%
                {voteBit.kind === "land" || voteBit.total > 0
                  ? ` · ${voteBit.counts[i]}`
                  : ""}
              </span>
            </button>
          );
        })}
      </div>
      {voteBit.kind === "land" && (
        <p className="mt-4 text-sm uppercase tracking-widest text-white/50">
          Live prediction
        </p>
      )}
    </div>
  );
}

function HeadcaseBitResult({
  voteBit,
  compact,
}: {
  voteBit: HeadcaseVoteBit;
  compact: boolean;
}) {
  const winner = voteBit.options[voteBit.winningOption ?? 0] ?? "";
  const percents = votePercents(voteBit);

  if (voteBit.kind === "truecap") {
    const gullible = voteBit.resultLabel === "GULLIBLE";
    return (
      <div className="px-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-white/50">
          {voteBit.prompt}
        </p>
        <div
          className={
            "mx-auto mt-8 inline-block rotate-[-8deg] rounded-md border-8 px-10 py-6 font-black uppercase tracking-widest " +
            (gullible
              ? "border-red-500 text-red-500"
              : "border-amber-300 text-amber-200")
          }
        >
          <p className={compact ? "text-5xl" : "text-8xl"}>
            {voteBit.resultLabel ?? "CONFESSION"}
          </p>
        </div>
        <p className="mt-8 text-xl text-white/70">
          Majority {voteBit.options[voteBit.winningOption ?? 0]} ·{" "}
          {percents[voteBit.winningOption ?? 0]}%
        </p>
      </div>
    );
  }

  if (voteBit.kind === "land") {
    return (
      <div className="px-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-white/50">
          Will it land?
        </p>
        <h1
          className={
            "mt-4 animate-bounce font-black text-lime-400 " +
            (compact ? "text-5xl" : "text-8xl")
          }
        >
          {voteBit.resultLabel === "LANDED" ? "Winner YES" : "Winner NO"}
        </h1>
        <p className="mt-4 text-3xl font-black uppercase tracking-widest text-white">
          {voteBit.resultLabel}
        </p>
        <div className="mt-8 flex items-center justify-center gap-10 text-2xl font-black">
          {voteBit.options.map((label, i) => (
            <span key={label} className="text-white/80">
              {label} {percents[i]}%
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (voteBit.kind === "channel") {
    return <HeadcaseChannelLook cue={voteBit.sceneCue ?? winner} compact={compact} />;
  }

  const fullWidth = voteBit.kind === "caption";
  return (
    <div className={compact && !fullWidth ? "px-2" : "px-0"}>
      {voteBit.rejected.length > 0 && !compact && (
        <ul className="mb-6 space-y-1 text-center text-lg text-white/35 line-through">
          {voteBit.rejected.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <div
        className={
          "w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-400 px-6 py-4 text-center shadow-[0_0_40px_rgba(168,85,247,0.45)] " +
          (fullWidth ? "" : "mx-auto max-w-5xl rounded-xl")
        }
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-black/70">
          {voteBit.kind === "caption" ? "Winning caption" : "Winning burn"}
        </p>
        <p
          className={
            "font-black leading-tight text-black " +
            (compact ? "text-2xl" : fullWidth ? "text-5xl sm:text-7xl" : "text-4xl sm:text-6xl")
          }
        >
          {winner}
        </p>
      </div>
    </div>
  );
}

const CHANNEL_LOOK: Record<
  string,
  { kicker: string; title: string; className: string }
> = {
  "news anchor": {
    kicker: "LIVE",
    title: "NEWS ANCHOR",
    className: "from-red-700 to-red-900",
  },
  infomercial: {
    kicker: "BUT WAIT",
    title: "INFOMERCIAL",
    className: "from-yellow-400 to-fuchsia-600",
  },
  "court tv": {
    kicker: "ON THE RECORD",
    title: "COURT TV",
    className: "from-emerald-800 to-stone-900",
  },
  "late night": {
    kicker: "TONIGHT",
    title: "LATE NIGHT",
    className: "from-indigo-700 to-violet-950",
  },
};

function HeadcaseChannelLook({
  cue,
  compact,
}: {
  cue: string;
  compact: boolean;
}) {
  const look =
    CHANNEL_LOOK[cue.trim().toLowerCase()] ?? {
      kicker: "ON AIR",
      title: cue,
      className: "from-violet-600 to-cyan-700",
    };
  return (
    <div
      className={
        "w-full bg-gradient-to-r px-6 py-5 text-center " + look.className
      }
    >
      <p className="text-sm font-black uppercase tracking-[0.4em] text-white/80">
        {look.kicker}
      </p>
      <h1
        className={
          "mt-2 font-black uppercase tracking-widest text-white " +
          (compact ? "text-3xl" : "text-6xl sm:text-8xl")
        }
      >
        {look.title}
      </h1>
    </div>
  );
}

function isHeadcaseBitOverlay(
  overlay: string,
  voteBit: NonNullable<PerformanceView["voteBit"]>,
) {
  if (overlay === "vote") return true;
  if (voteBit.voting) return overlay === "vote" || overlay === "";
  if (voteBit.kind === "burn" || voteBit.kind === "caption") return overlay === "bit";
  if (voteBit.kind === "truecap") return overlay === "prompt";
  if (voteBit.kind === "land") return overlay.startsWith("winner");
  if (voteBit.kind === "channel") {
    const names = [voteBit.sceneCue, ...voteBit.options]
      .filter((s): s is string => !!s)
      .map((s) => s.trim().toLowerCase());
    return names.includes(overlay);
  }
  return false;
}

/** Venue / preview overlay HUD. Player passes `view`; preview may pass only `overlayCue`. */
export function OverlayView({
  view,
  compact = false,
  forceKind,
  interactive = false,
  overlayCue,
}: {
  view?: PerformanceView | null;
  compact?: boolean;
  forceKind?: string;
  interactive?: boolean;
  overlayCue?: string | null;
}) {
  const overlay = (
    (forceKind && OVERLAY_KIND_TO_CUE[forceKind]) ||
    overlayCue ||
    view?.activeOverlay ||
    ""
  ).toLowerCase();
  const labelCue = overlayCue || view?.activeOverlay || overlay;
  const titleCls = compact ? "text-4xl font-black" : "text-7xl font-black";
  const subCls = compact
    ? "text-lg font-semibold uppercase tracking-widest text-white/60"
    : "text-3xl font-semibold uppercase tracking-widest text-white/50";
  const current = view?.current;
  const game1 =
    view && current
      ? (view.games.find((g) => g._id === current.game1Id) ?? null)
      : null;
  const game2 =
    view && current
      ? (view.games.find((g) => g._id === current.game2Id) ?? null)
      : null;
  const playing = game2?.isPlaying ? game2 : game1?.isPlaying ? game1 : null;
  const voteBit = view?.voteBit;
  const simple = !view;

  if (view && voteBit && isHeadcaseBitOverlay(overlay, voteBit)) {
    return (
      <HeadcasePhoneBitOverlay
        view={view}
        voteBit={voteBit}
        compact={compact}
        interactive={interactive}
      />
    );
  }

  if ((overlay === "score-1" || overlay === "score-2") && view)
    return (
      <TeamSideScore
        view={view}
        team={overlay === "score-1" ? 1 : 2}
        compact={compact}
      />
    );

  if (overlay.startsWith("introduction:"))
    return (
      <div className="px-8 text-center">
        <p className={subCls}>Introducing</p>
        <h1 className={"mt-4 text-amber-400 " + titleCls}>
          {labelCue.replace(/^introduction:\s*/i, "")}
        </h1>
      </div>
    );

  if (overlay === "game instructions" && game1 && view)
    return (
      <div className="px-8 text-center">
        <p className={subCls}>
          Round {game1.round} · {game1.roundType}
        </p>
        <h1 className={"mt-4 " + titleCls}>
          {(playing ?? game1).gameName}
        </h1>
        {playing && (
          <p className="mt-6 text-4xl font-bold text-amber-400">
            Now playing: {teamName(view, playing.teamIndex)}
          </p>
        )}
      </div>
    );

  if (overlay === "game instructions" && (simple || overlayCue))
    return (
      <div className="px-8 text-center">
        <h1 className={titleCls}>Game Instructions</h1>
      </div>
    );

  if (overlay === "vote" && view?.mode !== "setlist")
    return (
      <div className="px-8 text-center">
        <h1 className={"text-amber-400 " + (compact ? "text-5xl font-black" : "text-8xl font-black")}>
          VOTE!
        </h1>
        <div className="mt-10 flex items-center justify-center gap-12 text-5xl font-black">
          <span className="text-yellow-300">{view?.team1 ?? "Team 1"}</span>
          <span className="text-2xl text-white/40">vs</span>
          <span className="text-pink-400">{view?.team2 ?? "Team 2"}</span>
        </div>
        <p className="mt-8 text-2xl text-white/60">Cheer for your team!</p>
      </div>
    );

  if (overlay.startsWith("winner") && view?.mode !== "setlist")
    return (
      <div className="px-8 text-center">
        <p className="text-3xl font-semibold uppercase tracking-widest text-white/50">
          Round winner
        </p>
        <h1
          className={
            "mt-4 animate-bounce text-lime-400 " +
            (compact ? "text-5xl font-black" : "text-8xl font-black")
          }
        >
          {labelCue.replace(/^winner\s*/i, "")}
        </h1>
        {view && <Scoreboard view={view} className="mt-12" />}
      </div>
    );

  if (
    view?.mode !== "setlist" &&
    (overlay === "score" || overlay === "box score" || overlay === "score rotation")
  )
    return (
      <div className="px-8 text-center">
        <h1 className="text-5xl font-black uppercase tracking-widest text-white/70">
          {overlay === "score rotation" ? "Rotation!" : "Scoreboard"}
        </h1>
        {view && <Scoreboard view={view} className="mt-10" big />}
        {overlay === "box score" && view && <BoxScore view={view} />}
      </div>
    );

  if (overlay === "suggestions")
    return (
      <div className="px-8 text-center">
        <h1 className="text-7xl font-black text-sky-400">Suggestions?</h1>
        <p className="mt-6 text-3xl text-white/70">
          Shout out a place, a job, and a problem!
        </p>
      </div>
    );

  if (overlay === "crowd")
    return (
      <div className="px-8 text-center">
        <h1 className={"text-fuchsia-400 " + titleCls}>CROWD</h1>
        <p className="mt-6 text-3xl text-white/70">Make some noise!</p>
      </div>
    );

  if (overlay === "punishment")
    return (
      <div className="px-8 text-center">
        <h1 className={"text-red-500 " + titleCls}>PUNISHMENT</h1>
      </div>
    );

  if (overlay === "ring")
    return (
      <div className="px-8 text-center">
        <h1 className={"text-sky-400 " + titleCls}>RING</h1>
      </div>
    );

  if (overlay === "introduction" || overlay.startsWith("introduction"))
    return (
      <div className="px-8 text-center">
        <p className={subCls}>Introducing</p>
        <h1 className={"mt-4 text-amber-400 " + titleCls}>
          {(labelCue || "Introduction").replace(/^introduction:\s*/i, "")}
        </h1>
      </div>
    );

  if (overlay === "games")
    return (
      <div className="px-8 text-center">
        <h1 className="text-4xl font-black uppercase tracking-widest text-white/70">
          Tonight&apos;s games
        </h1>
        {view && (
          <ul className="mt-8 space-y-3 text-3xl font-bold">
            {view.games
              .filter((g) => g.teamIndex === 1)
              .map((g) => (
                <li key={g._id} className={g.isPlayed ? "text-white/30 line-through" : ""}>
                  {g.round}. {g.gameName}
                </li>
              ))}
          </ul>
        )}
      </div>
    );

  // Default: title card (hidden when a designed scene is already filling the screen).
  if (compact) {
    if (overlayCue) {
      return (
        <div className="px-8 text-center">
          <h1 className={titleCls}>{overlayCue}</h1>
        </div>
      );
    }
    return null;
  }
  if (!view) return null;
  return (
    <div className="px-8 text-center">
      <h1 className={titleCls}>{view.title}</h1>
      {view.mode === "setlist" ? (
        <p className="mt-10 text-3xl font-semibold uppercase tracking-widest text-white/50">
          Set list
        </p>
      ) : (
        <div className="mt-10 flex items-center justify-center gap-12 text-5xl font-black">
          <span className="text-yellow-300">{view.team1}</span>
          <span className="text-2xl text-white/40">vs</span>
          <span className="text-pink-400">{view.team2}</span>
        </div>
      )}
    </div>
  );
}

/** Portrait left/right LED: one team name + live score (legacy ScoreBananas / ScoreBerries). */
function TeamSideScore({
  view,
  team,
  compact = false,
}: {
  view: PerformanceView;
  team: 1 | 2;
  compact?: boolean;
}) {
  const name = teamName(view, team);
  const score = team === 1 ? view.scores.team1 : view.scores.team2;
  const accent = team === 1 ? "text-yellow-300" : "text-pink-400";
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <p
        className={
          "font-black uppercase tracking-widest " +
          accent +
          (compact ? " text-2xl" : " text-4xl sm:text-5xl")
        }
      >
        {name}
      </p>
      <p
        className={
          "mt-4 font-black leading-none tabular-nums " +
          (compact ? "text-7xl" : "text-[clamp(6rem,28vw,14rem)]")
        }
      >
        {score}
      </p>
    </div>
  );
}

function Scoreboard({
  view,
  className = "",
  big = false,
}: {
  view: PerformanceView;
  className?: string;
  big?: boolean;
}) {
  return (
    <div className={"flex items-center justify-center gap-16 " + className}>
      {([1, 2] as const).map((t) => (
        <div key={t} className="text-center">
          <p
            className={
              "font-bold " +
              (t === 1 ? "text-yellow-300" : "text-pink-400") +
              (big ? " text-4xl" : " text-2xl")
            }
          >
            {teamName(view, t)}
          </p>
          <p className={"font-black " + (big ? "text-9xl" : "text-6xl")}>
            {t === 1 ? view.scores.team1 : view.scores.team2}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Per-round results table (legacy Box Score overlay). */
function BoxScore({ view }: { view: PerformanceView }) {
  const rounds = [...new Set(view.games.map((g) => g.round))];
  return (
    <table className="mx-auto mt-10 text-2xl">
      <thead>
        <tr className="text-white/50">
          <th className="px-4 py-1 text-left">Round</th>
          <th className="px-4 py-1 text-yellow-300">{view.team1}</th>
          <th className="px-4 py-1 text-pink-400">{view.team2}</th>
        </tr>
      </thead>
      <tbody>
        {rounds.map((r) => {
          const g1 = view.games.find((g) => g.round === r && g.teamIndex === 1);
          const g2 = view.games.find((g) => g.round === r && g.teamIndex === 2);
          return (
            <tr key={r}>
              <td className="px-4 py-1 text-left text-white/70">
                {r}. {g1?.roundType}
              </td>
              <td className="px-4 py-1 font-bold">{g1?.score ?? 0}</td>
              <td className="px-4 py-1 font-bold">{g2?.score ?? 0}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
