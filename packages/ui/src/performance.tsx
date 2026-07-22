"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Doc, Id } from "@linkall/backend/convex/_generated/dataModel";
import { Loading } from "./empty-state";

/**
 * Comedy game engine pages (legacy: Crazyball Show view + game-1.0.1.js).
 *
 * PerformanceConsole — the host's "performance" page. The round grid, the
 * next-button state machine (Begin Game → Next Game → End Round → Win 1/2),
 * performers with bell bonuses, and the Overlay / Track columns.
 *
 * PerformanceScreen — the chrome-less page the venue screen displays. In the
 * legacy app the console broadcast overlay clicks over SignalR; here both
 * pages subscribe to the same reactive Convex query, so every button press
 * shows up on the screen instantly.
 */

type PerformanceView = NonNullable<FunctionReturnType<typeof api.game.get>>;
type Game = Doc<"performanceGames">;
type TabId = "shows" | "intros" | "scenes" | "game";

const TABS: { id: TabId; label: string }[] = [
  { id: "shows", label: "Shows" },
  { id: "intros", label: "Intros" },
  { id: "scenes", label: "Scenes" },
  { id: "game", label: "Game" },
];

function teamName(view: PerformanceView, teamIndex: 1 | 2) {
  return teamIndex === 1 ? view.team1 : view.team2;
}

/** Legacy UpdateRowStyles colors: lime winner, yellow playing, gray played. */
function rowClasses(game: Game) {
  if (game.isWinner) return "bg-lime-300 text-black font-semibold";
  if (game.isVoting) return "bg-amber-100 text-black";
  if (game.isPlaying) return "bg-yellow-300 text-black font-semibold";
  if (game.isPlayed) return "bg-gray-200 text-gray-600";
  return "bg-white text-gray-800";
}

// ---------------------------------------------------------------- console

export function PerformanceConsole() {
  const performances = useQuery(api.game.list, {});
  const [selectedId, setSelectedId] = useState<Id<"performances"> | null>(null);
  const [tab, setTab] = useState<TabId>("game");

  const performance =
    performances?.find((p) => p._id === selectedId) ?? performances?.[0] ?? null;
  const view = useQuery(
    api.game.get,
    performance ? { performanceId: performance._id } : "skip",
  );
  const shows = useQuery(api.shows.list, {});

  if (performances === undefined) return <Loading />;
  if (performances.length === 0)
    return (
      <p className="p-6 text-sm text-gray-500">
        No performances yet — seed the database or create one.
      </p>
    );

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-lg flex-col pb-28">
      {/* Header + performance picker */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-3 py-2">
        <h1 className="text-lg font-bold text-gray-900">Performance</h1>
        <select
          className="max-w-[55%] truncate rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-medium"
          value={performance?._id ?? ""}
          onChange={(e) => setSelectedId(e.target.value as Id<"performances">)}
        >
          {performances.map((p) => (
            <option key={p._id} value={p._id}>
              {p.title}
              {p.status === "live" ? " — LIVE" : ""}
            </option>
          ))}
        </select>
      </div>

      {view === undefined || view === null ? (
        <Loading />
      ) : (
        <Console view={view} tab={tab} shows={shows ?? []} />
      )}

      {/* Bottom tab bar (legacy nav-tabs-container) */}
      <nav className="fixed bottom-16 left-0 right-0 z-40 border-t border-gray-200 bg-gray-50 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
        <ul className="mx-auto flex max-w-lg">
          {TABS.map((t) => (
            <li key={t.id} className="flex-1">
              <button
                onClick={() => setTab(t.id)}
                className={
                  "block w-full border-t-[3px] py-3 text-center text-sm font-bold transition " +
                  (tab === t.id
                    ? "border-brand bg-white text-brand"
                    : "border-transparent text-gray-500 hover:bg-gray-100")
                }
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function Console({
  view,
  tab,
  shows,
}: {
  view: PerformanceView;
  tab: TabId;
  shows: Doc<"shows">[];
}) {
  const setOverlay = useMutation(api.game.setOverlay);
  const reset = useMutation(api.game.reset);
  const bellBonus = useMutation(api.game.bellBonus);

  const performanceId = view._id;
  const screenUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/performance/screens/${performanceId}`
      : "";

  if (tab === "shows") {
    return (
      <div className="flex-1 overflow-y-auto p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Background shows
        </p>
        {shows.map((s) => (
          <button
            key={s._id}
            onClick={() => setOverlay({ performanceId, overlay: s.title })}
            className={
              "mb-2 block w-full rounded-lg border px-3 py-3 text-left text-sm font-semibold " +
              (view.activeOverlay === s.title
                ? "border-brand bg-brand-light text-brand-dark"
                : "border-gray-200 bg-white hover:bg-gray-50")
            }
          >
            {s.title}
            {s.status === "live" && (
              <span className="ml-2 text-xs font-bold text-red-500">LIVE</span>
            )}
          </button>
        ))}
        <ScreenLinks screenUrl={screenUrl} performanceId={performanceId} reset={reset} />
      </div>
    );
  }

  if (tab === "intros") {
    return (
      <div className="flex-1 overflow-y-auto p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Performer intros
        </p>
        {view.performers.map((p) => {
          const label = `Introduction: ${p.name}`;
          const active = view.activeOverlay === label;
          return (
            <button
              key={p._id}
              onClick={() => setOverlay({ performanceId, overlay: label })}
              className={
                "mb-2 flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm " +
                (active
                  ? "border-brand bg-brand-light font-semibold"
                  : "border-gray-200 bg-white hover:bg-gray-50")
              }
            >
              <span className="flex-1 font-semibold">{p.name}</span>
              <span className="text-xs text-gray-400">{teamName(view, p.teamIndex)}</span>
            </button>
          );
        })}
        <ScreenLinks screenUrl={screenUrl} performanceId={performanceId} reset={reset} />
      </div>
    );
  }

  if (tab === "scenes") {
    return (
      <div className="flex-1 overflow-y-auto p-3">
        <OverlayTrackColumns view={view} performanceId={performanceId} />
        <ScreenLinks screenUrl={screenUrl} performanceId={performanceId} reset={reset} />
      </div>
    );
  }

  // Game tab — matches legacy tabGame layout
  return (
    <div className="flex-1 space-y-0 overflow-y-auto">
      <GameGrid view={view} />
      <PerformerBar view={view} bellBonus={bellBonus} />
      <OverlayTrackColumns view={view} performanceId={performanceId} />
      <ControlStrip view={view} />
      <div className="p-3">
        <ScreenLinks screenUrl={screenUrl} performanceId={performanceId} reset={reset} />
      </div>
    </div>
  );
}

function PerformerBar({
  view,
  bellBonus,
}: {
  view: PerformanceView;
  bellBonus: ReturnType<typeof useMutation<typeof api.game.bellBonus>>;
}) {
  const lead = view.performers[0];
  return (
    <div className="flex items-center gap-2 border-y border-gray-800 bg-gray-900 px-3 py-2 text-white">
      <span className="text-sm font-semibold">Performer</span>
      <span className="flex-1 truncate text-sm font-bold text-amber-300">
        {lead?.name ?? "—"}
      </span>
      {lead && (
        <button
          onClick={() => bellBonus({ performerId: lead._id, points: 1 })}
          className="rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950"
          title="Bell bonus"
        >
          🔔
        </button>
      )}
      <span className="text-lg font-light text-gray-400">+</span>
    </div>
  );
}

function OverlayTrackColumns({
  view,
  performanceId,
}: {
  view: PerformanceView;
  performanceId: Id<"performances">;
}) {
  const setOverlay = useMutation(api.game.setOverlay);
  const setTrack = useMutation(api.game.setTrack);

  return (
    <div className="grid grid-cols-2 gap-0 border-b border-gray-200">
      <div className="border-r border-gray-200 bg-white">
        <div className="bg-gray-900 px-2 py-1.5 text-xs font-semibold uppercase text-white">
          Overlay
        </div>
        {view.overlays.map((o) => {
          const active = view.activeOverlay === o.name;
          return (
            <button
              key={o._id}
              onClick={() =>
                setOverlay({ performanceId, overlay: active ? undefined : o.name })
              }
              className={
                "block w-full truncate border-b border-gray-100 px-2 py-2 text-left text-xs " +
                (active ? "bg-brand-light font-semibold text-brand-dark" : "hover:bg-gray-50")
              }
            >
              {o.name}
            </button>
          );
        })}
      </div>
      <div className="bg-white">
        <div className="bg-gray-900 px-2 py-1.5 text-xs font-semibold uppercase text-white">
          Track
        </div>
        {view.tracks.map((t) => {
          const active = view.activeTrack === t.name;
          return (
            <button
              key={t._id}
              onClick={() =>
                setTrack({ performanceId, track: active ? undefined : t.name })
              }
              className={
                "block w-full truncate border-b border-gray-100 px-2 py-2 text-left text-xs " +
                (active ? "bg-brand-light font-semibold text-brand-dark" : "hover:bg-gray-50")
              }
            >
              {active ? "♪ " : ""}
              {t.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScreenLinks({
  screenUrl,
  performanceId,
  reset,
}: {
  screenUrl: string;
  performanceId: Id<"performances">;
  reset: ReturnType<typeof useMutation<typeof api.game.reset>>;
}) {
  return (
    <div className="mt-4 flex items-center gap-2">
      <button
        onClick={() => navigator.clipboard.writeText(screenUrl)}
        className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-2 text-xs font-semibold hover:bg-gray-50"
      >
        Copy screen URL
      </button>
      <a
        href={`/performance/screens/${performanceId}`}
        target="_blank"
        className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-2 text-center text-xs font-semibold hover:bg-gray-50"
      >
        Open screen
      </a>
      <button
        onClick={() => reset({ performanceId })}
        className="rounded-md border border-red-200 bg-red-50 px-2 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
      >
        Reset
      </button>
    </div>
  );
}

// --------------------------------------------------------------- game grid

function GameGrid({ view }: { view: PerformanceView }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-xs">
        <thead>
          <tr className="bg-gray-900 text-left uppercase tracking-wide text-white">
            <th className="px-1.5 py-1.5">#</th>
            <th className="px-1.5 py-1.5">Type</th>
            <th className="px-1.5 py-1.5">Team</th>
            <th className="px-1.5 py-1.5">Game</th>
            <th className="px-1.5 py-1.5 text-right">V</th>
            <th className="px-1.5 py-1.5 text-right">S</th>
          </tr>
        </thead>
        <tbody>
          {view.games.map((g) => {
            const isCurrent =
              view.current !== null &&
              (g._id === view.current.game1Id || g._id === view.current.game2Id);
            return (
              <tr
                key={g._id}
                className={
                  rowClasses(g) +
                  " border-b border-gray-100" +
                  (isCurrent ? " ring-2 ring-inset ring-brand" : "")
                }
              >
                <td className="px-1.5 py-1.5">{g.round}</td>
                <td className="px-1.5 py-1.5">{g.roundType}</td>
                <td className="max-w-[4rem] truncate px-1.5 py-1.5">
                  {teamName(view, g.teamIndex)}
                </td>
                <td className="max-w-[5rem] truncate px-1.5 py-1.5">{g.gameName}</td>
                <td className="px-1.5 py-1.5 text-right">{g.votes}</td>
                <td className="px-1.5 py-1.5 text-right">
                  {g.score}
                  {g.rotation ? " ↻" : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------ control strip

/**
 * The legacy next-button logic: exactly the buttons that are valid for the
 * current phase are shown (game-1.0.1.js toggled btnCueGame / btnNextGame /
 * btnEndRound / btnWin1 / btnWin2 / btnRotation1/2 with display:none).
 */
function ControlStrip({ view }: { view: PerformanceView }) {
  const beginGame = useMutation(api.game.beginGame);
  const nextGame = useMutation(api.game.nextGame);
  const endRound = useMutation(api.game.endRound);
  const winGame = useMutation(api.game.winGame);
  const winRotation = useMutation(api.game.winRotation);

  const performanceId = view._id;
  const current = view.current;

  const btn =
    "flex-1 rounded-md px-3 py-3 text-sm font-bold shadow-sm transition active:scale-95";

  if (!current)
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 text-center text-sm font-semibold text-gray-500">
        Show complete — reset to run it again.
      </div>
    );

  const game1 = view.games.find((g) => g._id === current.game1Id)!;

  return (
    <div className="border-t border-gray-200 bg-white p-2">
      <div className="mb-2 grid grid-cols-2 gap-1">
        {([1, 2] as const).map((t) => (
          <div key={t} className="rounded border border-gray-200 px-2 py-1 text-center">
            <p className="text-[10px] font-semibold uppercase text-gray-400">
              {teamName(view, t)}
            </p>
            <p className="text-xl font-black text-brand-dark">
              {t === 1 ? view.scores.team1 : view.scores.team2}
            </p>
          </div>
        ))}
      </div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        Round {game1.round} · {game1.roundType} · {game1.gameName}
      </p>
      <div className="flex gap-1">
        {current.phase === "idle" && (
          <button
            onClick={() => beginGame({ performanceId })}
            className={btn + " bg-brand text-white hover:opacity-90"}
          >
            Begin Game
          </button>
        )}
        {current.phase === "team1" && (
          <button
            onClick={() => nextGame({ performanceId })}
            className={btn + " bg-brand text-white hover:opacity-90"}
          >
            Next Game
          </button>
        )}
        {current.phase === "team2" && (
          <>
            <button
              onClick={() => endRound({ performanceId })}
              className={btn + " bg-brand text-white hover:opacity-90"}
            >
              End Round
            </button>
            {current.sameGame && (
              <>
                <button
                  onClick={() => winRotation({ performanceId, teamIndex: 1 })}
                  className={btn + " bg-gray-100 text-gray-700 hover:bg-gray-200"}
                >
                  Rotation 1
                </button>
                <button
                  onClick={() => winRotation({ performanceId, teamIndex: 2 })}
                  className={btn + " bg-gray-100 text-gray-700 hover:bg-gray-200"}
                >
                  Rotation 2
                </button>
              </>
            )}
          </>
        )}
        {current.phase === "voting" && (
          <>
            <button
              onClick={() => winGame({ performanceId, teamIndex: 1 })}
              className={btn + " bg-yellow-400 text-yellow-950 hover:bg-yellow-300"}
            >
              Win {view.team1}
            </button>
            <button
              onClick={() => winGame({ performanceId, teamIndex: 2 })}
              className={btn + " bg-pink-500 text-white hover:bg-pink-400"}
            >
              Win {view.team2}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- screen page

/** Fullscreen venue display driven entirely by the console's overlay state. */
export function PerformanceScreen({
  performanceId,
}: {
  performanceId: Id<"performances">;
}) {
  const view = useQuery(api.game.get, { performanceId });

  if (view === undefined)
    return <div className="fixed inset-0 z-50 bg-black" />;
  if (view === null)
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-gray-500">
        Performance not found.
      </div>
    );

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <OverlayView view={view} />
      {view.activeTrack && (
        <div className="absolute bottom-4 right-6 text-sm text-white/40">
          ♪ {view.activeTrack}
        </div>
      )}
    </div>
  );
}

function OverlayView({ view }: { view: PerformanceView }) {
  const overlay = (view.activeOverlay ?? "").toLowerCase();
  const current = view.current;
  const game1 = current ? view.games.find((g) => g._id === current.game1Id) : null;
  const game2 = current ? view.games.find((g) => g._id === current.game2Id) : null;
  const playing = game2?.isPlaying ? game2 : game1?.isPlaying ? game1 : null;

  if (overlay.startsWith("introduction:"))
    return (
      <div className="px-8 text-center">
        <p className="text-3xl font-semibold uppercase tracking-widest text-white/50">
          Introducing
        </p>
        <h1 className="mt-6 text-7xl font-black text-amber-400">
          {view.activeOverlay!.replace(/^introduction:\s*/i, "")}
        </h1>
      </div>
    );

  if (overlay === "game instructions" && game1)
    return (
      <div className="px-8 text-center">
        <p className="text-2xl font-semibold uppercase tracking-widest text-white/50">
          Round {game1.round} · {game1.roundType}
        </p>
        <h1 className="mt-4 text-7xl font-black">
          {(playing ?? game1).gameName}
        </h1>
        {playing && (
          <p className="mt-6 text-4xl font-bold text-amber-400">
            Now playing: {teamName(view, playing.teamIndex)}
          </p>
        )}
      </div>
    );

  if (overlay === "vote")
    return (
      <div className="px-8 text-center">
        <h1 className="text-8xl font-black text-amber-400">VOTE!</h1>
        <div className="mt-10 flex items-center justify-center gap-12 text-5xl font-black">
          <span className="text-yellow-300">{view.team1}</span>
          <span className="text-2xl text-white/40">vs</span>
          <span className="text-pink-400">{view.team2}</span>
        </div>
        <p className="mt-8 text-2xl text-white/60">Cheer for your team!</p>
      </div>
    );

  if (overlay.startsWith("winner"))
    return (
      <div className="px-8 text-center">
        <p className="text-3xl font-semibold uppercase tracking-widest text-white/50">
          Round winner
        </p>
        <h1 className="mt-4 animate-bounce text-8xl font-black text-lime-400">
          {view.activeOverlay!.replace(/^winner\s*/i, "")}
        </h1>
        <Scoreboard view={view} className="mt-12" />
      </div>
    );

  if (overlay === "score" || overlay === "box score" || overlay === "score rotation")
    return (
      <div className="px-8 text-center">
        <h1 className="text-5xl font-black uppercase tracking-widest text-white/70">
          {overlay === "score rotation" ? "Rotation!" : "Scoreboard"}
        </h1>
        <Scoreboard view={view} className="mt-10" big />
        {overlay === "box score" && <BoxScore view={view} />}
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

  if (overlay === "games")
    return (
      <div className="px-8 text-center">
        <h1 className="text-4xl font-black uppercase tracking-widest text-white/70">
          Tonight&apos;s games
        </h1>
        <ul className="mt-8 space-y-3 text-3xl font-bold">
          {view.games
            .filter((g) => g.teamIndex === 1)
            .map((g) => (
              <li key={g._id} className={g.isPlayed ? "text-white/30 line-through" : ""}>
                {g.round}. {g.gameName}
              </li>
            ))}
        </ul>
      </div>
    );

  // Default: title card.
  return (
    <div className="px-8 text-center">
      <h1 className="text-7xl font-black">{view.title}</h1>
      <div className="mt-10 flex items-center justify-center gap-12 text-5xl font-black">
        <span className="text-yellow-300">{view.team1}</span>
        <span className="text-2xl text-white/40">vs</span>
        <span className="text-pink-400">{view.team2}</span>
      </div>
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
