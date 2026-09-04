"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Doc, Id } from "@linkall/backend/convex/_generated/dataModel";
import { showIsHostCued } from "@linkall/backend/convex/locos";
import { PanelStage } from "./designer";
import { OverlayView, overlayCueFromScene } from "./overlays";
import { TextSceneFallback } from "./shows";

type PerformanceView = NonNullable<FunctionReturnType<typeof api.game.get>>;
type PreviewScreen = Doc<"screens"> & { panels: Doc<"panels">[] };

/**
 * Operator run-through wall: every physical screen in the selected display
 * profile, live, on one page — so you don't open a tab per LED / projector.
 */

function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Per-layout tile order + hidden ids for the preview wall only. */
const ARRANGEMENT_STORAGE_PREFIX = "linkall.preview.arrangement.v1";

type PreviewArrangement = {
  order: string[];
  hidden: string[];
};

const EMPTY_ARRANGEMENT: PreviewArrangement = { order: [], hidden: [] };

function arrangementStorageKey(layoutId: string) {
  return `${ARRANGEMENT_STORAGE_PREFIX}:${layoutId}`;
}

function readArrangement(layoutId: string): PreviewArrangement {
  if (typeof window === "undefined") return EMPTY_ARRANGEMENT;
  try {
    const raw = window.localStorage.getItem(arrangementStorageKey(layoutId));
    if (!raw) return EMPTY_ARRANGEMENT;
    const parsed = JSON.parse(raw) as PreviewArrangement;
    if (!Array.isArray(parsed?.order) || !Array.isArray(parsed?.hidden)) {
      return EMPTY_ARRANGEMENT;
    }
    return {
      order: parsed.order.filter((id) => typeof id === "string"),
      hidden: parsed.hidden.filter((id) => typeof id === "string"),
    };
  } catch {
    return EMPTY_ARRANGEMENT;
  }
}

function writeArrangement(layoutId: string, next: PreviewArrangement) {
  if (typeof window === "undefined") return;
  try {
    const empty = next.order.length === 0 && next.hidden.length === 0;
    const key = arrangementStorageKey(layoutId);
    if (empty) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

function mergeScreenOrder(screenIds: string[], savedOrder: string[]) {
  const remaining = new Set(screenIds);
  const ordered: string[] = [];
  for (const id of savedOrder) {
    if (!remaining.has(id)) continue;
    ordered.push(id);
    remaining.delete(id);
  }
  for (const id of screenIds) {
    if (remaining.has(id)) ordered.push(id);
  }
  return ordered;
}

function arrangeScreens(
  screens: PreviewScreen[],
  arrangement: PreviewArrangement,
) {
  const byId = new Map(screens.map((s) => [s._id as string, s]));
  const order = mergeScreenOrder(
    screens.map((s) => s._id),
    arrangement.order,
  );
  const hidden = new Set(
    arrangement.hidden.filter((id) => byId.has(id)),
  );
  const ordered = order
    .map((id) => byId.get(id))
    .filter((s): s is PreviewScreen => !!s);
  return {
    ordered,
    visible: ordered.filter((s) => !hidden.has(s._id)),
    hidden: ordered.filter((s) => hidden.has(s._id)),
  };
}

function usePreviewArrangement(layoutId: string | undefined) {
  const [arrangement, setArrangementState] =
    useState<PreviewArrangement>(EMPTY_ARRANGEMENT);

  useEffect(() => {
    setArrangementState(layoutId ? readArrangement(layoutId) : EMPTY_ARRANGEMENT);
  }, [layoutId]);

  const setArrangement = (next: PreviewArrangement) => {
    setArrangementState(next);
    if (layoutId) writeArrangement(layoutId, next);
  };

  return { arrangement, setArrangement };
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
  const [screenMenuOpen, setScreenMenuOpen] = useState(false);
  const [dragScreenId, setDragScreenId] = useState<string | null>(null);
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

  useEffect(() => {
    setScreenMenuOpen(false);
    setDragScreenId(null);
  }, [layoutId]);

  const liveScene =
    show && scenes ? (scenes[show.currentSceneIndex] ?? null) : null;
  const overlayCue = overlayCueFromScene(liveScene);
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
      showIsHostCued(show) ||
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

  const { arrangement, setArrangement } = usePreviewArrangement(layoutId);
  const arranged = useMemo(
    () => arrangeScreens(screens, arrangement),
    [screens, arrangement],
  );

  const persistOrder = (order: string[], hidden = arrangement.hidden) => {
    const known = new Set(screens.map((s) => s._id as string));
    setArrangement({
      order: mergeScreenOrder(
        screens.map((s) => s._id),
        order,
      ),
      hidden: hidden.filter((id) => known.has(id)),
    });
  };

  const toggleScreenHidden = (screenId: string) => {
    const hidden = arrangement.hidden.includes(screenId)
      ? arrangement.hidden.filter((id) => id !== screenId)
      : [...arrangement.hidden, screenId];
    persistOrder(
      mergeScreenOrder(
        screens.map((s) => s._id),
        arrangement.order,
      ),
      hidden,
    );
  };

  const moveScreen = (screenId: string, dir: -1 | 1) => {
    const order = mergeScreenOrder(
      screens.map((s) => s._id),
      arrangement.order,
    );
    const from = order.indexOf(screenId);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= order.length) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    persistOrder(next);
  };

  const moveScreenBefore = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const order = mergeScreenOrder(
      screens.map((s) => s._id),
      arrangement.order,
    );
    const from = order.indexOf(fromId);
    const to = order.indexOf(toId);
    if (from < 0 || to < 0) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    persistOrder(next);
  };

  const moveVisibleBefore = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const order = mergeScreenOrder(
      screens.map((s) => s._id),
      arrangement.order,
    );
    const hiddenSet = new Set(arrangement.hidden);
    const visibleIds = order.filter((id) => !hiddenSet.has(id));
    const from = visibleIds.indexOf(fromId);
    const to = visibleIds.indexOf(toId);
    if (from < 0 || to < 0) return;
    const nextVisible = [...visibleIds];
    const [item] = nextVisible.splice(from, 1);
    nextVisible.splice(to, 0, item);
    let i = 0;
    persistOrder(
      order.map((id) => (hiddenSet.has(id) ? id : nextVisible[i++]!)),
    );
  };

  const resetArrangement = () => setArrangement(EMPTY_ARRANGEMENT);

  const urlContext = {
    performanceId:
      activePerformanceId ?? show?.cuedByPerformanceId ?? undefined,
  };

  const performancesForShow = (allPerformances ?? []).filter((p) =>
    show ? p.showId === show._id : true,
  );

  if (shows === undefined) return <div className="fixed inset-0 bg-black" />;

  const isLive = show?.status === "live";
  const fallbackScene =
    liveScene &&
    (liveScene.kind === "title" ||
      liveScene.kind === "text" ||
      liveScene.kind === "score") &&
    liveScene.content.trim()
      ? liveScene
      : null;
  const wallPainted = (effects ?? []).some(
    (e) =>
      e.isEnabled &&
      e.panelId &&
      (e.kind === "image" ||
        e.kind === "video" ||
        e.kind === "color" ||
        e.kind === "url" ||
        e.kind === "html"),
  );

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
        {screens.length > 0 && (
          <PreviewScreenMenu
            open={screenMenuOpen}
            onOpenChange={setScreenMenuOpen}
            ordered={arranged.ordered}
            hiddenIds={arranged.hidden.map((s) => s._id)}
            visibleCount={arranged.visible.length}
            onToggle={toggleScreenHidden}
            onMove={moveScreen}
            onReorder={moveScreenBefore}
            onReset={resetArrangement}
            canReset={
              arrangement.order.length > 0 || arrangement.hidden.length > 0
            }
            dragScreenId={dragScreenId}
            setDragScreenId={setDragScreenId}
          />
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

      {arranged.hidden.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 bg-gray-950 px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/35">
            Hidden
          </span>
          {arranged.hidden.map((screen) => (
            <button
              key={screen._id}
              type="button"
              onClick={() => toggleScreenHidden(screen._id)}
              className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/70 hover:bg-white/10"
              title={`Show ${screen.name} on the preview wall`}
            >
              {screen.name}
              <span className="ml-1 text-white/35">show</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 items-center justify-center gap-3 overflow-hidden p-3">
        {screens.length > 0 && arranged.visible.length === 0 ? (
          <p className="text-sm text-white/40">
            All screens are hidden. Open Screens to show some on this wall.
          </p>
        ) : isLive &&
          effects &&
          arranged.visible.length > 0 &&
          (wallPainted || !fallbackScene) ? (
          arranged.visible.map((screen) => (
            <PreviewTile
              key={screen._id}
              screen={screen}
              effects={effects}
              clockSec={clockSec}
              muted={!soundOn}
              urlContext={urlContext}
              overlayCue={overlayCue}
              overlayView={performanceView}
              dragging={dragScreenId === screen._id}
              dropTarget={
                dragScreenId !== null && dragScreenId !== screen._id
              }
              onHide={() => toggleScreenHidden(screen._id)}
              onDragStart={() => setDragScreenId(screen._id)}
              onDragEnd={() => setDragScreenId(null)}
              onDropOn={() => {
                if (dragScreenId) moveVisibleBefore(dragScreenId, screen._id);
                setDragScreenId(null);
              }}
            />
          ))
        ) : fallbackScene ? (
          <div className="h-full w-full max-w-4xl overflow-hidden rounded-lg">
            <TextSceneFallback scene={fallbackScene} />
          </div>
        ) : screens.length === 0 ? (
          <p className="text-sm text-white/40">
            {show
              ? "This profile has no screens. Assign a layout in the Designer."
              : "Pick a show."}
          </p>
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

function PreviewScreenMenu({
  open,
  onOpenChange,
  ordered,
  hiddenIds,
  visibleCount,
  onToggle,
  onMove,
  onReorder,
  onReset,
  canReset,
  dragScreenId,
  setDragScreenId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordered: PreviewScreen[];
  hiddenIds: string[];
  visibleCount: number;
  onToggle: (screenId: string) => void;
  onMove: (screenId: string, dir: -1 | 1) => void;
  onReorder: (fromId: string, toId: string) => void;
  onReset: () => void;
  canReset: boolean;
  dragScreenId: string | null;
  setDragScreenId: (id: string | null) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hidden = new Set(hiddenIds);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={
          "whitespace-nowrap rounded border px-2 py-1 text-xs hover:bg-white/10 " +
          (open || hidden.size > 0
            ? "border-white/40 bg-white/10"
            : "border-white/20")
        }
        title="Hide or rearrange screens on this preview wall"
      >
        Screens
        {ordered.length > 0 ? (
          <span className="ml-1 text-white/50">
            {visibleCount}/{ordered.length}
          </span>
        ) : null}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Arrange preview screens"
          className="absolute left-0 top-full z-30 mt-1 w-[min(22rem,calc(100vw-1.5rem))] rounded-md border border-white/15 bg-gray-900 p-2 shadow-xl"
        >
          <p className="px-1 text-[11px] leading-snug text-white/50">
            Hide or reorder tiles on this wall. Live outputs stay the same.
          </p>
          <ul className="mt-2 max-h-[min(24rem,70vh)] space-y-1 overflow-y-auto">
            {ordered.map((screen, i) => {
              const isHidden = hidden.has(screen._id);
              return (
                <li
                  key={screen._id}
                  onDragOver={(e) => {
                    if (!dragScreenId || dragScreenId === screen._id) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from =
                      dragScreenId ?? e.dataTransfer.getData("text/plain");
                    if (from) onReorder(from, screen._id);
                    setDragScreenId(null);
                  }}
                  className={
                    "flex items-center gap-1 rounded px-1 py-0.5 " +
                    (dragScreenId === screen._id
                      ? "bg-white/10"
                      : "hover:bg-white/5")
                  }
                >
                  <span
                    draggable
                    onDragStart={(e) => {
                      setDragScreenId(screen._id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", screen._id);
                    }}
                    onDragEnd={() => setDragScreenId(null)}
                    className="cursor-grab px-1 text-white/30 active:cursor-grabbing"
                    title="Drag to reorder"
                    aria-label={`Drag ${screen.name}`}
                  >
                    ⋮⋮
                  </span>
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => onToggle(screen._id)}
                      className="accent-white"
                    />
                    <span
                      className={
                        "truncate text-xs " +
                        (isHidden ? "text-white/35 line-through" : "")
                      }
                    >
                      {screen.name}
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => onMove(screen._id, -1)}
                    className="rounded px-1.5 text-xs text-white/70 hover:bg-white/10 disabled:opacity-25"
                    title="Move left"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={i === ordered.length - 1}
                    onClick={() => onMove(screen._id, 1)}
                    className="rounded px-1.5 text-xs text-white/70 hover:bg-white/10 disabled:opacity-25"
                    title="Move right"
                  >
                    →
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center justify-end gap-2 border-t border-white/10 pt-2">
            <button
              type="button"
              onClick={onReset}
              disabled={!canReset}
              className="rounded px-2 py-1 text-xs text-white/70 hover:bg-white/10 disabled:opacity-30"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewTile({
  screen,
  effects,
  clockSec,
  muted,
  urlContext,
  overlayCue,
  overlayView,
  dragging,
  dropTarget,
  onHide,
  onDragStart,
  onDragEnd,
  onDropOn,
}: {
  screen: PreviewScreen;
  effects: Parameters<typeof PanelStage>[0]["effects"];
  clockSec: number;
  muted: boolean;
  urlContext: { performanceId?: string };
  overlayCue: string | null;
  overlayView: PerformanceView | null;
  dragging: boolean;
  dropTarget: boolean;
  onHide: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOn: () => void;
}) {
  const ar = screen.width / Math.max(screen.height, 1);
  return (
    <div
      className={
        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded " +
        (dragging ? "opacity-50 " : "") +
        (dropTarget ? "ring-2 ring-white/40 " : "")
      }
      style={{
        flex: `${ar} 1 0`,
        maxWidth: ar >= 1 ? "100%" : "28%",
      }}
      onDragOver={(e) => {
        if (!dropTarget) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropOn();
      }}
    >
      <div className="mb-1 flex shrink-0 items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-white/45">
        <p
          draggable
          onDragStart={(e) => {
            onDragStart();
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", screen._id);
          }}
          onDragEnd={onDragEnd}
          className="min-w-0 cursor-grab truncate active:cursor-grabbing"
          title="Drag to reorder"
        >
          {screen.name}
          <span className="ml-1 font-normal text-white/25">
            {screen.width}×{screen.height}
          </span>
        </p>
        <button
          type="button"
          onClick={onHide}
          className="shrink-0 rounded px-1.5 text-[11px] font-medium leading-none normal-case tracking-normal text-white/40 hover:bg-white/10 hover:text-white"
          title={`Hide ${screen.name} from this preview`}
          aria-label={`Hide ${screen.name}`}
        >
          Hide
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="relative w-full">
          <PanelStage
            screen={screen}
            effects={effects}
            clockSec={clockSec}
            muted={muted}
            urlContext={urlContext}
          />
          {overlayCue ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end">
              <div className="bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-10">
                <OverlayView
                  view={overlayView}
                  overlayCue={overlayCue}
                  compact
                />
              </div>
            </div>
          ) : null}
        </div>
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
  const resolveVote = useMutation(api.game.resolveVote);
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
  const voteBit = view.voteBit;
  const headcaseVoting = setlist && phase === "voting" && !!voteBit?.voting;
  const showVoteLock = headcaseVoting && !voteBit?.hostCalls;
  const showVoteCall = headcaseVoting && !!voteBit?.hostCalls;
  const showEndRound = headcaseVoting
    ? false
    : setlist
      ? phase === "team1"
      : phase === "team2" || phase === "both";
  const showWin = !setlist && phase === "voting";
  const showRotation =
    !setlist && current.sameGame && (phase === "both" || phase === "team2");
  const bitCount = current.bitSceneCount ?? 0;
  const bitIndex = current.bitSceneIndex ?? 0;
  const showNextJoke =
    setlist && phase === "team1" && bitCount > 0 && bitIndex < bitCount - 1;
  // LinkAll8: hide unified Next when Begin / Next Game / End Round / Win is required.
  const showNext =
    !showBegin &&
    !showNextGame &&
    !showEndRound &&
    !showWin &&
    !showNextJoke &&
    !showVoteLock &&
    !showVoteCall;

  return (
    <div className="shrink-0 border-t border-white/10 bg-gray-900 px-3 py-2">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <p className="text-xs font-semibold text-white/80">
          {view.title}
          {game1
            ? ` · ${setlist ? "Segment" : "Round"} ${game1.round} ${game1.roundType}`
            : ""}
          {playing?.gameName ? ` · ${playing.gameName}` : ""}
          {setlist && bitCount > 0 ? ` · joke ${bitIndex + 1}/${bitCount}` : ""}
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
        {showNextJoke && (
          <button
            type="button"
            onClick={() => next({ performanceId })}
            className={btn + " bg-orange-500 text-white"}
          >
            Next Joke
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
        {showVoteLock && (
          <button
            type="button"
            onClick={() => resolveVote({ performanceId })}
            className={btn + " bg-violet-600 text-white"}
          >
            Lock Votes
          </button>
        )}
        {showVoteCall &&
          voteBit?.hostCalls?.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => resolveVote({ performanceId, hostCall: i })}
              className={
                btn + (i === 0 ? " bg-lime-400 text-lime-950" : " bg-rose-500 text-white")
              }
            >
              {label}
            </button>
          ))}
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
