"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Doc, Id } from "@linkall/backend/convex/_generated/dataModel";
import { PANEL_FILLS, PanelStage } from "./designer";
import { Loading } from "./empty-state";

/**
 * Legacy mobile Player + Screen pages.
 *
 * ShowRemote — the compact operator console: tap a scene on the Shows tab to
 * push it to every output; tap a panel on the Screens tab to put the physical
 * output into calibration mode and nudge its corners into alignment.
 *
 * ScreenOutput — the chrome-less page a projector or LED wall displays.
 * It subscribes to one reactive query, so scene taps, panel nudges and
 * alignment toggles all show up instantly (this replaces SignalR DisplayHub).
 */

type Point = { x: number; y: number };
type Panel = Doc<"panels">;
type ScreenWithPanels = Doc<"screens"> & { panels: Panel[] };

// ------------------------------------------------------------- calibration

/**
 * Calibration render: every panel in a flat color, the selected panel
 * highlighted with numbered corner markers — shown on the physical output
 * while the operator aligns the projection with the real surface.
 */
export function CalibrationStage({
  screen,
  alignPanelId,
}: {
  screen: ScreenWithPanels;
  alignPanelId: Id<"panels">;
}) {
  return (
    <svg
      viewBox={`0 0 ${screen.width} ${screen.height}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {screen.panels.map((p, i) => {
        const isSel = p._id === alignPanelId;
        return (
          <g key={p._id}>
            <polygon
              points={p.points.map((pt) => `${pt.x},${pt.y}`).join(" ")}
              fill={isSel ? "#facc15" : PANEL_FILLS[i % PANEL_FILLS.length]}
              stroke="#fff"
              strokeWidth={isSel ? 4 : 1.5}
            />
            {isSel &&
              p.points.map((pt, pi) => (
                <g key={pi}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={screen.width / 45}
                    fill="#22c55e"
                    stroke="#052e16"
                    strokeWidth={2}
                  />
                  <text
                    x={pt.x}
                    y={pt.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#fff"
                    fontWeight="bold"
                    fontSize={screen.width / 45}
                  >
                    {pi + 1}
                  </text>
                </g>
              ))}
          </g>
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------------ screen output

/** Fullscreen output for one physical screen (projector / LED wall). */
export function ScreenOutput({ screenId }: { screenId: Id<"screens"> }) {
  const view = useQuery(api.designer.screenView, { screenId });
  const [clockSec, setClockSec] = useState(0);

  const startedAt = view?.show?.sceneStartedAt;
  useEffect(() => {
    if (startedAt === undefined) return;
    const tick = () => setClockSec((Date.now() - startedAt) / 1000);
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [startedAt]);

  if (view === undefined)
    return <div className="fixed inset-0 z-50 bg-black" />;
  if (view === null)
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-gray-500">
        Screen not found.
      </div>
    );

  const { screen, show, scene, effects } = view;
  const aligning =
    screen.alignPanelId !== undefined &&
    screen.panels.some((p) => p._id === screen.alignPanelId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div
        className="max-h-full w-full"
        style={{ aspectRatio: `${screen.width} / ${screen.height}` }}
      >
        {aligning ? (
          <CalibrationStage
            screen={screen}
            alignPanelId={screen.alignPanelId!}
          />
        ) : show && scene ? (
          <PanelStage screen={screen} effects={effects} clockSec={clockSec} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-600">
            <p className="text-2xl font-semibold">{screen.name}</p>
            <p className="text-sm">Waiting for a show…</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- player page

function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ShowRemote() {
  const [tab, setTab] = useState<"shows" | "screens">("shows");

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Player</h1>
      </div>
      <div className="mt-4 flex gap-1 border-b border-gray-200">
        {(["shows", "screens"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "rounded-t-lg px-4 py-2 text-sm font-semibold capitalize " +
              (tab === t
                ? "border border-b-0 border-gray-200 bg-white text-brand-dark"
                : "text-gray-500 hover:text-gray-800")
            }
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === "shows" ? <PlayTab /> : <AlignTab />}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- shows tab

function PlayTab() {
  const shows = useQuery(api.shows.list, {});
  const [selectedShowId, setSelectedShowId] = useState<Id<"shows"> | null>(null);
  const playScene = useMutation(api.shows.playScene);
  const setStatus = useMutation(api.shows.setStatus);

  const show =
    shows?.find((s) => s._id === selectedShowId) ?? shows?.[0] ?? null;
  const scenes = useQuery(
    api.designer.getShowScenes,
    show ? { showId: show._id } : "skip",
  );
  const layout = useQuery(
    api.designer.getLayout,
    show?.layoutId ? { layoutId: show.layoutId } : "skip",
  );
  const liveScene =
    show && scenes ? (scenes[show.currentSceneIndex] ?? null) : null;
  const effects = useQuery(
    api.designer.getSceneEffects,
    show?.status === "live" && liveScene ? { sceneId: liveScene._id } : "skip",
  );

  // Live clock synced to when the operator switched scenes.
  const [clockSec, setClockSec] = useState(0);
  const startedAt = show?.sceneStartedAt;
  useEffect(() => {
    if (startedAt === undefined) return;
    const tick = () => setClockSec((Date.now() - startedAt) / 1000);
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [startedAt]);

  if (shows === undefined) return <Loading />;

  const screen = layout?.screens[0] ?? null;

  return (
    <div className="space-y-4">
      <select
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium"
        value={show?._id ?? ""}
        onChange={(e) => setSelectedShowId(e.target.value as Id<"shows">)}
      >
        {shows.map((s) => (
          <option key={s._id} value={s._id}>
            {s.title}
            {s.status === "live" ? " — LIVE" : ""}
          </option>
        ))}
      </select>

      {/* Mini preview of what the outputs are showing */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-950">
        {show?.status === "live" && screen && effects ? (
          <PanelStage screen={screen} effects={effects} clockSec={clockSec} />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center text-sm text-gray-500">
            {show ? "Tap a scene to go live" : "No shows yet"}
          </div>
        )}
      </div>

      {show?.status === "live" && liveScene && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm">
          <span className="font-semibold text-red-700">
            ● {liveScene.title}
          </span>
          <span className="text-red-400">
            {formatClock(clockSec)}
            {liveScene.durationSec ? ` / ${formatClock(liveScene.durationSec)}` : ""}
          </span>
        </div>
      )}

      {/* Tap a scene to push it to every screen */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between bg-brand-dark px-3 py-2">
          <span className="text-sm font-semibold text-white">Scenes</span>
          {show?.status === "live" && (
            <button
              onClick={() => setStatus({ showId: show._id, status: "ended" })}
              className="rounded bg-white/10 px-2 py-0.5 text-xs font-semibold text-white hover:bg-white/20"
            >
              End show
            </button>
          )}
        </div>
        {scenes?.length === 0 && (
          <p className="p-3 text-xs text-gray-400">
            This show has no scenes yet — add them in the Designer.
          </p>
        )}
        {scenes?.map((scene, i) => {
          const isLive = show?.status === "live" && i === show.currentSceneIndex;
          return (
            <button
              key={scene._id}
              onClick={() => show && playScene({ showId: show._id, index: i })}
              className={
                "flex w-full items-center gap-3 border-b border-gray-100 px-3 py-3 text-left text-sm " +
                (isLive
                  ? "bg-red-50 font-semibold text-red-700"
                  : "hover:bg-gray-50 active:bg-brand-light")
              }
            >
              <span className="w-5 text-gray-400">{i + 1}</span>
              <span className="flex-1 truncate">{scene.title}</span>
              <span className="text-xs text-gray-400">
                {scene.durationSec ? formatClock(scene.durationSec) : ""}
              </span>
              {isLive && <span className="text-xs">● LIVE</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- screens tab

const NUDGE_STEPS = [1, 5, 20];

function AlignTab() {
  const layouts = useQuery(api.designer.listLayouts);
  const [selectedLayoutId, setSelectedLayoutId] = useState<Id<"layouts"> | null>(null);
  const [selectedScreenId, setSelectedScreenId] = useState<Id<"screens"> | null>(null);
  const [target, setTarget] = useState<"panel" | "point" | "side">("panel");
  const [pointIndex, setPointIndex] = useState(0);
  const [step, setStep] = useState(5);
  const [snapToGrid, setSnapToGrid] = useState(false);

  const layoutDoc =
    layouts?.find((l) => l._id === selectedLayoutId) ?? layouts?.[0] ?? null;
  const layout = useQuery(
    api.designer.getLayout,
    layoutDoc ? { layoutId: layoutDoc._id } : "skip",
  );
  const screens: ScreenWithPanels[] = layout?.screens ?? [];
  const screen =
    screens.find((s) => s._id === selectedScreenId) ?? screens[0] ?? null;
  const alignedPanel =
    screen?.panels.find((p) => p._id === screen.alignPanelId) ?? null;

  const setAlignPanel = useMutation(api.designer.setAlignPanel);
  const updatePanel = useMutation(api.designer.updatePanel);

  const snapVal = (v: number) => (snapToGrid ? Math.round(v / 10) * 10 : v);

  const nudge = async (dx: number, dy: number) => {
    if (!screen || !alignedPanel) return;
    const n = alignedPanel.points.length;
    const moving =
      target === "panel"
        ? alignedPanel.points.map((_, i) => i)
        : target === "point"
          ? [Math.min(pointIndex, n - 1)]
          : [Math.min(pointIndex, n - 1), (Math.min(pointIndex, n - 1) + 1) % n];
    const points = alignedPanel.points.map((p, i) =>
      moving.includes(i)
        ? {
            x: Math.max(0, Math.min(screen.width, snapVal(p.x + dx))),
            y: Math.max(0, Math.min(screen.height, snapVal(p.y + dy))),
          }
        : p,
    );
    await updatePanel({ panelId: alignedPanel._id, points });
  };

  // Keyboard arrow support (mirrors Designer PanelEditor)
  useEffect(() => {
    if (!alignedPanel || !screen) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as Element)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const apply = (dx: number, dy: number) => {
        e.preventDefault();
        void nudge(dx, dy);
      };
      switch (e.key) {
        case "ArrowUp":
          apply(0, -step); break;
        case "ArrowDown":
          apply(0, step); break;
        case "ArrowLeft":
          apply(-step, 0); break;
        case "ArrowRight":
          apply(step, 0); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [alignedPanel, screen, step, target, pointIndex, snapToGrid]);

  if (layouts === undefined) return <Loading />;

  const screenUrl =
    typeof window !== "undefined" && screen
      ? `${window.location.origin}/screens/${screen._id}`
      : "";

  return (
    <div className="space-y-4">
      {layouts.length > 1 && (
        <select
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium"
          value={layoutDoc?._id ?? ""}
          onChange={(e) => {
            setSelectedLayoutId(e.target.value as Id<"layouts">);
            setSelectedScreenId(null);
          }}
        >
          {layouts.map((l) => (
            <option key={l._id} value={l._id}>
              {l.name}
            </option>
          ))}
        </select>
      )}
      {screens.length > 1 && (
        <select
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium"
          value={screen?._id ?? ""}
          onChange={(e) => {
            setSelectedScreenId(e.target.value as Id<"screens">);
          }}
        >
          {screens.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      {!screen && (
        <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-400">
          No screens yet — create a layout with screens in the Designer first.
        </p>
      )}

      {screen && (
        <>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-500">
            Open this on the projector / LED wall device:
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-700">
                {screenUrl}
              </code>
              <button
                onClick={() => navigator.clipboard?.writeText(screenUrl)}
                className="rounded border border-gray-300 px-2 py-1 font-semibold text-gray-600 hover:bg-gray-50"
              >
                Copy
              </button>
              <a
                href={screen ? `/screens/${screen._id}` : "#"}
                target="_blank"
                className="rounded border border-gray-300 px-2 py-1 font-semibold text-gray-600 hover:bg-gray-50"
              >
                Open
              </a>
            </div>
          </div>

          {/* Mirror of what the output shows while aligning */}
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-950">
            {alignedPanel ? (
              <div
                style={{ aspectRatio: `${screen.width} / ${screen.height}` }}
              >
                <CalibrationStage
                  screen={screen}
                  alignPanelId={alignedPanel._id}
                />
              </div>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center text-sm text-gray-500">
                Tap a panel below to align it on the output
              </div>
            )}
          </div>

          {/* Panel list — tapping puts the output into calibration mode */}
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between bg-brand-dark px-3 py-2">
              <span className="text-sm font-semibold text-white">Panels</span>
              {alignedPanel && (
                <button
                  onClick={() => setAlignPanel({ screenId: screen._id })}
                  className="rounded bg-white/10 px-2 py-0.5 text-xs font-semibold text-white hover:bg-white/20"
                >
                  Done aligning
                </button>
              )}
            </div>
            {screen.panels.map((p, i) => (
              <button
                key={p._id}
                onClick={() => {
                  setAlignPanel({ screenId: screen._id, panelId: p._id });
                  setPointIndex(0);
                }}
                className={
                  "flex w-full items-center gap-3 border-b border-gray-100 px-3 py-3 text-left text-sm " +
                  (alignedPanel?._id === p._id
                    ? "bg-yellow-50 font-semibold text-yellow-800"
                    : "hover:bg-gray-50")
                }
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: PANEL_FILLS[i % PANEL_FILLS.length] }}
                />
                <span className="flex-1 truncate">{p.name}</span>
                {alignedPanel?._id === p._id && (
                  <span className="text-xs">aligning</span>
                )}
              </button>
            ))}
          </div>

          {/* Nudge controls */}
          {alignedPanel && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                {(["panel", "point", "side"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTarget(t)}
                    className={
                      "rounded-full px-3 py-1 text-xs font-semibold capitalize " +
                      (target === t
                        ? "bg-brand text-white"
                        : "border border-gray-300 text-gray-600")
                    }
                  >
                    Move {t === "panel" ? "entire panel" : t}
                  </button>
                ))}
                <label className="ml-auto flex items-center gap-1.5 text-xs font-medium text-gray-600">
                  <input
                    type="checkbox"
                    checked={snapToGrid}
                    onChange={(e) => setSnapToGrid(e.target.checked)}
                    className="accent-brand"
                  />
                  Snap to 10px grid
                </label>
              </div>

              {target !== "panel" && (
                <div className="mt-3 flex items-center gap-1">
                  <span className="mr-1 text-xs text-gray-400">
                    {target === "point" ? "Corner" : "Side from corner"}:
                  </span>
                  {alignedPanel.points.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPointIndex(i)}
                      className={
                        "h-7 w-7 rounded-full text-xs font-bold " +
                        (pointIndex === i
                          ? "bg-green-500 text-white"
                          : "border border-gray-300 text-gray-600")
                      }
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-center gap-6">
                <div className="grid grid-cols-3 gap-1">
                  <span />
                  <NudgeButton label="↑" onClick={() => nudge(0, -step)} />
                  <span />
                  <NudgeButton label="←" onClick={() => nudge(-step, 0)} />
                  <span className="flex h-10 w-10 items-center justify-center text-xs text-gray-300">
                    {step}px
                  </span>
                  <NudgeButton label="→" onClick={() => nudge(step, 0)} />
                  <span />
                  <NudgeButton label="↓" onClick={() => nudge(0, step)} />
                  <span />
                </div>
                <div className="flex flex-col gap-1">
                  {NUDGE_STEPS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStep(s)}
                      className={
                        "rounded px-2 py-1 text-xs font-semibold " +
                        (step === s
                          ? "bg-brand text-white"
                          : "border border-gray-300 text-gray-600")
                      }
                    >
                      {s}px
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-center text-[11px] text-gray-400">
                Tip: keyboard arrows also nudge
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NudgeButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-lg text-gray-700 hover:bg-gray-100 active:bg-brand-light"
    >
      {label}
    </button>
  );
}
