"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Doc, Id } from "@linkall/backend/convex/_generated/dataModel";
import { PanelStage } from "./designer";

type PerformanceView = NonNullable<FunctionReturnType<typeof api.game.get>>;

/**
 * Operator run-through wall: every physical screen in the selected display
 * profile, live, on one page — so you don't open a tab per LED / projector.
 */

function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DisplayPreview({
  initialShowId,
  initialProfileId,
  performanceId,
}: {
  initialShowId?: Id<"shows"> | null;
  initialProfileId?: Id<"displayProfiles"> | null;
  performanceId?: Id<"performances"> | null;
} = {}) {
  const shows = useQuery(api.shows.list, {});
  const performance = useQuery(
    api.game.get,
    performanceId ? { performanceId } : "skip",
  );
  const [selectedShowId, setSelectedShowId] = useState<Id<"shows"> | null>(
    initialShowId ?? null,
  );
  const [selectedProfileId, setSelectedProfileId] = useState<
    Id<"displayProfiles"> | null
  >(initialProfileId ?? null);
  const [soundOn, setSoundOn] = useState(false);
  const [pickedPerformanceId, setPickedPerformanceId] =
    useState<Id<"performances"> | null>(performanceId ?? null);

  const allPerformances = useQuery(api.game.list, {});
  const activePerformanceId = performanceId ?? pickedPerformanceId;
  const pickedPerformance = useQuery(
    api.game.get,
    !performanceId && pickedPerformanceId
      ? { performanceId: pickedPerformanceId }
      : "skip",
  );
  const performanceView = performance ?? pickedPerformance ?? null;

  const lockedShowId = performanceView?.showId ?? null;

  useEffect(() => {
    if (initialShowId) setSelectedShowId(initialShowId);
  }, [initialShowId]);

  useEffect(() => {
    if (lockedShowId) setSelectedShowId(lockedShowId);
  }, [lockedShowId]);

  const show =
    shows?.find((s) => s._id === (lockedShowId ?? selectedShowId)) ??
    shows?.[0] ??
    null;

  const profiles = useQuery(
    api.designer.listShowProfiles,
    show ? { showId: show._id } : "skip",
  );
  const profile =
    profiles?.find((p) => p._id === selectedProfileId) ??
    profiles?.find((p) => p.isDefault) ??
    profiles?.[0] ??
    null;

  useEffect(() => {
    setSelectedProfileId(null);
  }, [show?._id]);

  const scenes = useQuery(
    api.designer.getShowScenes,
    show ? { showId: show._id } : "skip",
  );
  const layoutId = profile?.layoutId ?? show?.layoutId;
  const layout = useQuery(
    api.designer.getLayout,
    layoutId ? { layoutId } : "skip",
  );

  const liveScene =
    show && scenes ? (scenes[show.currentSceneIndex] ?? null) : null;
  const effects = useQuery(
    api.designer.getSceneEffects,
    show?.status === "live" && liveScene
      ? {
          sceneId: liveScene._id,
          ...(profile ? { displayProfileId: profile._id } : {}),
        }
      : "skip",
  );

  const playScene = useMutation(api.shows.playScene);
  const setStatus = useMutation(api.shows.setStatus);
  const advanceIfDue = useMutation(api.shows.advanceIfDue);

  const [clockSec, setClockSec] = useState(0);
  const startedAt = show?.sceneStartedAt;
  useEffect(() => {
    if (startedAt === undefined) return;
    const tick = () => setClockSec((Date.now() - startedAt) / 1000);
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [startedAt]);

  useEffect(() => {
    if (
      !show ||
      show.status !== "live" ||
      !liveScene?.durationSec ||
      clockSec < liveScene.durationSec
    ) {
      return;
    }
    void advanceIfDue({ showId: show._id });
  }, [show, liveScene?.durationSec, clockSec, advanceIfDue]);

  const screens = useMemo(() => {
    const list = layout?.screens ?? [];
    return [...list].sort((a, b) => a.order - b.order);
  }, [layout?.screens]);

  const urlContext = {
    performanceId:
      activePerformanceId ?? show?.cuedByPerformanceId ?? undefined,
  };

  const performancesForShow = (allPerformances ?? []).filter((p) =>
    show ? p.showId === show._id : true,
  );

  if (shows === undefined) return <div className="fixed inset-0 bg-black" />;

  const isLive = show?.status === "live";

  return (
    <div className="flex h-screen flex-col bg-black text-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-gray-950 px-3 py-2">
        <span className="text-sm font-bold tracking-wide">Preview</span>
        <select
          className="max-w-[40%] truncate rounded bg-gray-800 px-2 py-1 text-sm"
          value={show?._id ?? ""}
          disabled={!!lockedShowId}
          onChange={(e) => setSelectedShowId(e.target.value as Id<"shows">)}
        >
          {shows.map((s) => (
            <option key={s._id} value={s._id}>
              {s.title}
              {s.status === "live" ? " — LIVE" : ""}
            </option>
          ))}
        </select>
        {!performanceId && performancesForShow.length > 0 && (
          <select
            className="max-w-[28%] truncate rounded bg-gray-800 px-2 py-1 text-sm"
            value={activePerformanceId ?? ""}
            onChange={(e) =>
              setPickedPerformanceId(
                (e.target.value || null) as Id<"performances"> | null,
              )
            }
            title="Performance"
          >
            <option value="">Show only</option>
            {performancesForShow.map((p) => (
              <option key={p._id} value={p._id}>
                {p.title}
                {p.status === "live" ? " — LIVE" : ""}
              </option>
            ))}
          </select>
        )}
        {profiles && profiles.length > 0 && (
          <select
            className="rounded bg-gray-800 px-2 py-1 text-sm"
            value={profile?._id ?? ""}
            onChange={(e) =>
              setSelectedProfileId(e.target.value as Id<"displayProfiles">)
            }
            title="Display profile"
          >
            {profiles.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
                {p.isDefault ? " ★" : ""}
                {p.layoutName ? ` · ${p.layoutName}` : ""}
              </option>
            ))}
          </select>
        )}
        {isLive && liveScene && (
          <span className="text-xs font-semibold text-red-400">
            ● {liveScene.title} · {formatClock(clockSec)}
            {liveScene.durationSec
              ? ` / ${formatClock(liveScene.durationSec)}`
              : ""}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
          >
            {soundOn ? "Sound on" : "Muted"}
          </button>
          {show && !isLive && (
            <button
              type="button"
              onClick={() => setStatus({ showId: show._id, status: "live" })}
              className="rounded bg-red-600 px-2 py-1 text-xs font-semibold hover:bg-red-500"
            >
              Go live
            </button>
          )}
          {show && isLive && (
            <button
              type="button"
              onClick={() => setStatus({ showId: show._id, status: "ended" })}
              className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
            >
              End
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center gap-3 overflow-hidden p-3">
        {screens.length === 0 ? (
          <p className="text-sm text-white/40">
            {show
              ? "This profile has no screens. Assign a layout in the Designer."
              : "Pick a show."}
          </p>
        ) : isLive && effects ? (
          screens.map((screen) => (
            <PreviewTile
              key={screen._id}
              screen={screen}
              effects={effects}
              clockSec={clockSec}
              muted={!soundOn}
              urlContext={urlContext}
            />
          ))
        ) : (
          <p className="text-sm text-white/40">
            {isLive ? "Loading scene…" : "Go live or tap a scene below."}
          </p>
        )}
      </div>

      {performanceView && (
        <PreviewPerformanceBar view={performanceView} />
      )}

      <nav className="shrink-0 overflow-x-auto border-t border-white/10 bg-gray-950 px-2 py-2">
        <div className="flex min-w-min gap-1">
          {(scenes ?? []).map((scene, i) => {
            const live = isLive && i === show?.currentSceneIndex;
            return (
              <button
                key={scene._id}
                type="button"
                onClick={() =>
                  show && playScene({ showId: show._id, index: i })
                }
                className={
                  "shrink-0 rounded px-2 py-1.5 text-left text-xs " +
                  (live
                    ? "bg-red-600 font-semibold text-white"
                    : "bg-white/5 text-white/70 hover:bg-white/10")
                }
              >
                <span className="mr-1 text-white/40">{i + 1}</span>
                {scene.title}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function PreviewTile({
  screen,
  effects,
  clockSec,
  muted,
  urlContext,
}: {
  screen: Doc<"screens"> & { panels: Doc<"panels">[] };
  effects: Parameters<typeof PanelStage>[0]["effects"];
  clockSec: number;
  muted: boolean;
  urlContext: { performanceId?: string };
}) {
  const ar = screen.width / Math.max(screen.height, 1);
  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col"
      style={{
        flex: `${ar} 1 0`,
        maxWidth: ar >= 1 ? "100%" : "28%",
      }}
    >
      <p className="mb-1 truncate text-center text-[10px] font-semibold uppercase tracking-wide text-white/45">
        {screen.name}
        <span className="ml-1 font-normal text-white/25">
          {screen.width}×{screen.height}
        </span>
      </p>
      <div className="min-h-0 flex-1">
        <PanelStage
          screen={screen}
          effects={effects}
          clockSec={clockSec}
          muted={muted}
          urlContext={urlContext}
        />
      </div>
    </div>
  );
}

function PreviewPerformanceBar({ view }: { view: PerformanceView }) {
  const beginGame = useMutation(api.game.beginGame);
  const nextGame = useMutation(api.game.nextGame);
  const endRound = useMutation(api.game.endRound);
  const next = useMutation(api.game.next);
  const winGame = useMutation(api.game.winGame);
  const winRotation = useMutation(api.game.winRotation);
  const reset = useMutation(api.game.reset);

  const performanceId = view._id;
  const current = view.current;
  const setlist = view.mode === "setlist";
  const btn =
    "rounded px-3 py-1.5 text-xs font-bold transition active:scale-95";

  if (!current) {
    return (
      <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-gray-900 px-3 py-2">
        <p className="text-xs text-white/50">Performance complete.</p>
        <button
          type="button"
          onClick={() => reset({ performanceId })}
          className={btn + " border border-red-400/40 text-red-300"}
        >
          Reset
        </button>
      </div>
    );
  }

  const game1 = view.games.find((g) => g._id === current.game1Id);
  const game2 = view.games.find((g) => g._id === current.game2Id);
  const playing = current.phase === "team2" ? game2 : game1;
  const phase = current.phase;
  const showBegin = phase === "idle" || phase === "cued";
  const showNextGame = !setlist && phase === "team1";
  const showEndRound =
    setlist ? phase === "team1" : phase === "team2" || phase === "both";
  const showWin = !setlist && phase === "voting";
  const showRotation =
    !setlist && current.sameGame && (phase === "both" || phase === "team2");
  const showNext = !showWin;

  return (
    <div className="shrink-0 border-t border-white/10 bg-gray-900 px-3 py-2">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <p className="text-xs font-semibold text-white/80">
          {view.title}
          {game1
            ? ` · ${setlist ? "Segment" : "Round"} ${game1.round} ${game1.roundType}`
            : ""}
          {playing?.gameName ? ` · ${playing.gameName}` : ""}
        </p>
        {!setlist && (
          <p className="text-xs text-white/50">
            <span className="text-amber-300">{view.team1}</span> {view.scores.team1}
            <span className="mx-1 text-white/25">–</span>
            <span className="text-pink-300">{view.team2}</span> {view.scores.team2}
          </p>
        )}
        {view.activeOverlay && (
          <p className="text-[11px] text-white/40">
            Overlay: {view.activeOverlay}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {showBegin && (
          <button
            type="button"
            onClick={() => beginGame({ performanceId })}
            className={btn + " bg-orange-500 text-white"}
          >
            {setlist ? "Begin Segment" : "Begin Game"}
          </button>
        )}
        {showNextGame && (
          <button
            type="button"
            onClick={() => nextGame({ performanceId })}
            className={btn + " bg-orange-500 text-white"}
          >
            Next Game
          </button>
        )}
        {showEndRound && (
          <button
            type="button"
            onClick={() => endRound({ performanceId })}
            className={btn + " bg-orange-500 text-white"}
          >
            {setlist ? "End Segment" : "End Round"}
          </button>
        )}
        {showRotation && (
          <>
            <button
              type="button"
              onClick={() => winRotation({ performanceId, teamIndex: 1 })}
              className={btn + " bg-white/10 text-white"}
            >
              Rotation {view.team1}
            </button>
            <button
              type="button"
              onClick={() => winRotation({ performanceId, teamIndex: 2 })}
              className={btn + " bg-white/10 text-white"}
            >
              Rotation {view.team2}
            </button>
          </>
        )}
        {showWin && (
          <>
            <button
              type="button"
              onClick={() => winGame({ performanceId, teamIndex: 1 })}
              className={btn + " bg-yellow-400 text-yellow-950"}
            >
              Win {view.team1}
            </button>
            <button
              type="button"
              onClick={() => winGame({ performanceId, teamIndex: 2 })}
              className={btn + " bg-pink-500 text-white"}
            >
              Win {view.team2}
            </button>
          </>
        )}
        {showNext && (
          <button
            type="button"
            onClick={() => next({ performanceId })}
            className={btn + " border border-orange-400/60 text-orange-200"}
          >
            {setlist ? "Next Segment" : "Next"}
          </button>
        )}
      </div>
    </div>
  );
}
