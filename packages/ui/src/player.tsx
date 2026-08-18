"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Doc, Id } from "@linkall/backend/convex/_generated/dataModel";
import {
  homographyToMatrix3d,
  isValidMatrix,
  markerColor,
  markerCornersNorm,
  markerLabel,
  type DualCalibRole,
} from "@linkall/backend/dual-calib";
import { PANEL_FILLS, PanelStage } from "./designer";
import { Loading } from "./empty-state";
import { useCurrentUser } from "./current-user";

/**
 * Legacy mobile Player + Screen pages.
 *
 * ShowRemote — the compact operator console: tap a scene on the Shows tab to
 * push it to every output; tap a panel on the Screens tab to put the physical
 * output into calibration mode and nudge its corners into alignment.
 *
 * ScreenOutput — the chrome-less page a projector or LED wall displays.
 * It subscribes to one reactive query, so scene taps, panel nudges,
 * dual-projector markers, and alignment toggles all show up instantly
 * (this replaces SignalR DisplayHub).
 */

type Point = { x: number; y: number };
type Panel = Doc<"panels">;
type ScreenWithPanels = Doc<"screens"> & { panels: Panel[] };

type ScreenBinding = {
  showId: Id<"shows">;
  displayProfileId?: Id<"displayProfiles">;
};

const BINDING_STORAGE_PREFIX = "linkall.screenBinding.v1";
const LAST_SCREEN_STORAGE_PREFIX = "linkall.lastScreen.v1";
/** Per-output mute preference for screen pages (legacy mute / unmute). */
const SCREEN_SOUND_STORAGE_KEY = "linkall.screenSound.v1";

function readScreenSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(SCREEN_SOUND_STORAGE_KEY);
    if (v === null) return true; // default: unmuted like LinkAll8 /screen
    return v === "1";
  } catch {
    return true;
  }
}

function writeScreenSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SCREEN_SOUND_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function bindingStorageKey(
  userId: Id<"users"> | undefined,
  screenId: Id<"screens">,
) {
  return `${BINDING_STORAGE_PREFIX}:${userId ?? "anon"}:${screenId}`;
}

function lastScreenStorageKey(userId: Id<"users"> | undefined) {
  return `${LAST_SCREEN_STORAGE_PREFIX}:${userId ?? "anon"}`;
}

function readLastScreenId(
  userId: Id<"users"> | undefined,
): Id<"screens"> | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(
      lastScreenStorageKey(userId),
    ) as Id<"screens"> | null;
  } catch {
    return null;
  }
}

function writeLastScreenId(
  userId: Id<"users"> | undefined,
  screenId: Id<"screens">,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lastScreenStorageKey(userId), screenId);
  } catch {
    /* ignore quota / private mode */
  }
}

function goToScreen(screenId: Id<"screens">) {
  const url = new URL(window.location.href);
  // Preserve show/profile query when jumping between screens.
  window.location.href = `/screens/${screenId}${url.search}`;
}

function readBinding(
  userId: Id<"users"> | undefined,
  screenId: Id<"screens">,
): ScreenBinding | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      bindingStorageKey(userId, screenId),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScreenBinding;
    if (!parsed?.showId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeBinding(
  userId: Id<"users"> | undefined,
  screenId: Id<"screens">,
  binding: ScreenBinding | null,
) {
  if (typeof window === "undefined") return;
  const key = bindingStorageKey(userId, screenId);
  if (binding) window.localStorage.setItem(key, JSON.stringify(binding));
  else window.localStorage.removeItem(key);
}

function readUrlBinding(): ScreenBinding | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const showId = params.get("show") as Id<"shows"> | null;
  if (!showId) return null;
  const profile = params.get("profile") as Id<"displayProfiles"> | null;
  return {
    showId,
    ...(profile ? { displayProfileId: profile } : {}),
  };
}

function syncUrlBinding(binding: ScreenBinding | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (binding?.showId) {
    url.searchParams.set("show", binding.showId);
    if (binding.displayProfileId) {
      url.searchParams.set("profile", binding.displayProfileId);
    } else {
      url.searchParams.delete("profile");
    }
  } else {
    url.searchParams.delete("show");
    url.searchParams.delete("profile");
  }
  window.history.replaceState(null, "", url.toString());
}

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

/**
 * Four saturated corner crosshairs the phone camera detects. Cyan = P1
 * (reference), magenta = P2 (the output that will be warped).
 */
export function DualCalibMarkers({
  role,
  width,
  height,
}: {
  role: DualCalibRole;
  width: number;
  height: number;
}) {
  const color = markerColor(role);
  const corners = markerCornersNorm();
  const arm = Math.min(width, height) * 0.055;
  const stroke = Math.max(6, Math.min(width, height) * 0.014);
  const r = Math.max(10, Math.min(width, height) * 0.022);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      preserveAspectRatio="none"
      style={{ background: "#000" }}
    >
      <text
        x={width / 2}
        y={height * 0.08}
        textAnchor="middle"
        fill="#f8fafc"
        fontWeight="700"
        fontSize={Math.min(width, height) * 0.045}
      >
        {markerLabel(role)}
      </text>
      {corners.map((c, i) => {
        const x = c.x * width;
        const y = c.y * height;
        return (
          <g key={i}>
            <line
              x1={x - arm}
              y1={y}
              x2={x + arm}
              y2={y}
              stroke="#000"
              strokeWidth={stroke + 6}
              strokeLinecap="square"
            />
            <line
              x1={x}
              y1={y - arm}
              x2={x}
              y2={y + arm}
              stroke="#000"
              strokeWidth={stroke + 6}
              strokeLinecap="square"
            />
            <line
              x1={x - arm}
              y1={y}
              x2={x + arm}
              y2={y}
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="square"
            />
            <line
              x1={x}
              y1={y - arm}
              x2={x}
              y2={y + arm}
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="square"
            />
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={color}
              stroke="#000"
              strokeWidth={3}
            />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#000"
              fontWeight="bold"
              fontSize={r * 1.1}
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function useHomographyStyle(matrix: number[] | null): {
  ref: RefObject<HTMLDivElement | null>;
  style: CSSProperties;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  useEffect(() => {
    const el = ref.current;
    if (!el || !isValidMatrix(matrix)) {
      setStyle({});
      return;
    }
    const apply = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 2 || h < 2) return;
      setStyle({
        transform: homographyToMatrix3d(matrix, w, h),
        transformOrigin: "0 0",
      });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [matrix]);

  return { ref, style };
}

// ------------------------------------------------------------ screen output

/** Chromeless picker when visiting /screens with no id. */
function ScreenPicker() {
  const { user, userId } = useCurrentUser();
  const screens = useQuery(api.designer.listScreens, {});
  const [lastId, setLastId] = useState<Id<"screens"> | null>(null);

  useEffect(() => {
    setLastId(readLastScreenId(userId));
  }, [userId]);

  if (screens === undefined) {
    return <div className="fixed inset-0 z-50 bg-black" />;
  }

  const byLayout = new Map<string, typeof screens>();
  for (const s of screens) {
    const list = byLayout.get(s.layoutName) ?? [];
    list.push(s);
    byLayout.set(s.layoutName, list);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black px-4 py-8 text-white">
      <div className="w-full max-w-md">
        <p className="text-2xl font-semibold">Select a screen</p>
        <p className="mt-1 text-sm text-white/50">
          Open this on the projector or LED wall, then pick which physical
          output it is.
          {user ? ` · ${user.name}` : ""}
        </p>

        {screens.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-white/20 p-4 text-sm text-white/40">
            No screens yet — create a layout with screens in the Designer
            first.
          </p>
        ) : (
          <div className="mt-6 max-h-[70vh] space-y-5 overflow-y-auto pr-1">
            {[...byLayout.entries()].map(([layoutName, layoutScreens]) => (
              <div key={layoutName}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                  {layoutName}
                </p>
                <div className="space-y-2">
                  {layoutScreens.map((s) => {
                    const isLast = s._id === lastId;
                    return (
                      <button
                        key={s._id}
                        type="button"
                        onClick={() => {
                          writeLastScreenId(userId, s._id);
                          goToScreen(s._id);
                        }}
                        className={
                          "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition " +
                          (isLast
                            ? "border-white/40 bg-white/15"
                            : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10")
                        }
                      >
                        <span>
                          <span className="block text-sm font-semibold">
                            {s.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-white/45">
                            {s.width}×{s.height}
                            {s.height > s.width ? " · portrait" : " · landscape"}
                            {isLast ? " · last used" : ""}
                          </span>
                        </span>
                        <span className="text-xs font-semibold text-white/50">
                          Open →
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Fullscreen output for one physical screen (projector / LED wall).
 * Visit /screens with no id to pick which screen this output is.
 */
export function ScreenOutput({
  screenId,
}: {
  screenId?: Id<"screens">;
}) {
  if (!screenId) return <ScreenPicker />;
  return <ScreenOutputBound screenId={screenId} />;
}

function ScreenOutputBound({ screenId }: { screenId: Id<"screens"> }) {
  const { user, userId } = useCurrentUser();
  const [binding, setBinding] = useState<ScreenBinding | null>(null);
  const [bindingReady, setBindingReady] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [clockSec, setClockSec] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const advanceIfDue = useMutation(api.shows.advanceIfDue);
  const allScreens = useQuery(api.designer.listScreens, {});

  // Remember this output so /screens can highlight last used.
  useEffect(() => {
    writeLastScreenId(userId, screenId);
  }, [userId, screenId]);

  useEffect(() => {
    setSoundOn(readScreenSoundEnabled());
  }, []);

  // URL wins on first load; otherwise restore per-user preference (shared
  // across tabs via localStorage). Demo user id is also shared across tabs.
  useEffect(() => {
    const fromUrl = readUrlBinding();
    const fromStore = readBinding(userId, screenId);
    const initial = fromUrl ?? fromStore;
    setBinding(initial);
    if (fromUrl) writeBinding(userId, screenId, fromUrl);
    setBindingReady(true);
  }, [userId, screenId]);

  // Keep other tabs in sync when this user changes a binding.
  useEffect(() => {
    const key = bindingStorageKey(userId, screenId);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      try {
        setBinding(e.newValue ? (JSON.parse(e.newValue) as ScreenBinding) : null);
      } catch {
        setBinding(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId, screenId]);

  const viewArgs = useMemo(() => {
    if (!bindingReady) return "skip" as const;
    return {
      screenId,
      ...(binding?.showId ? { showId: binding.showId } : {}),
      ...(binding?.displayProfileId
        ? { displayProfileId: binding.displayProfileId }
        : {}),
    };
  }, [bindingReady, screenId, binding?.showId, binding?.displayProfileId]);

  const view = useQuery(
    api.designer.screenView,
    viewArgs === "skip" ? "skip" : viewArgs,
  );
  const options = useQuery(
    api.designer.screenBindingOptions,
    bindingReady
      ? { screenId, ...(userId ? { ownerId: userId } : {}) }
      : "skip",
  );

  const applyBinding = (next: ScreenBinding | null) => {
    setBinding(next);
    writeBinding(userId, screenId, next);
    syncUrlBinding(next);
  };

  const selectShow = (showId: Id<"shows">) => {
    const showOpt = options?.shows.find((s) => s.showId === showId);
    const profiles = showOpt?.profiles ?? [];
    // Keep the same profile when the new show reuses this layout under the
    // same profile id; otherwise prefer default / sole profile for the layout.
    const keep =
      binding?.displayProfileId &&
      profiles.some((p) => p._id === binding.displayProfileId)
        ? binding.displayProfileId
        : undefined;
    const fallback =
      profiles.find((p) => p.isDefault)?._id ?? profiles[0]?._id;
    applyBinding({
      showId,
      ...(keep || fallback
        ? { displayProfileId: keep ?? fallback }
        : {}),
    });
  };

  const selectProfile = (displayProfileId: Id<"displayProfiles">) => {
    if (!binding?.showId) return;
    applyBinding({ showId: binding.showId, displayProfileId });
  };

  const startedAt = view?.show?.sceneStartedAt;
  useEffect(() => {
    if (startedAt === undefined) return;
    const tick = () => setClockSec((Date.now() - startedAt) / 1000);
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [startedAt]);

  // Screens also request advance so a show progresses even with no Player open.
  useEffect(() => {
    const show = view?.show;
    const scene = view?.scene;
    if (
      !show ||
      show.status !== "live" ||
      !scene?.durationSec ||
      clockSec < scene.durationSec
    ) {
      return;
    }
    void advanceIfDue({ showId: show._id });
  }, [view?.show, view?.scene?.durationSec, clockSec, advanceIfDue]);

  // Auto-open the picker when idle / unbound so setup is obvious.
  const isLiveContent = Boolean(
    view?.show && view.show.status === "live" && view.scene,
  );
  useEffect(() => {
    if (!bindingReady || view === undefined) return;
    if (view?.dualCalibRole) {
      setPickerOpen(false);
      return;
    }
    if (!isLiveContent && !binding) setPickerOpen(true);
  }, [bindingReady, view, isLiveContent, binding]);

  const dualCalibRole = view?.dualCalibRole ?? null;
  const warpMatrix =
    view && !dualCalibRole && isValidMatrix(view.warp?.matrix)
      ? view.warp.matrix
      : null;
  const { ref: warpRef, style: warpStyle } = useHomographyStyle(warpMatrix);

  if (!bindingReady || view === undefined)
    return <div className="fixed inset-0 z-50 bg-black" />;
  if (view === null)
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-gray-500">
        Screen not found.
      </div>
    );

  const { screen, show, scene, effects, layoutName } = view;
  const aligning =
    !dualCalibRole &&
    screen.alignPanelId !== undefined &&
    screen.panels.some((p) => p._id === screen.alignPanelId);
  const selectedShowOpt = options?.shows.find((s) => s.showId === binding?.showId);
  const profileChoices = selectedShowOpt?.profiles ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div
        ref={warpRef}
        className="max-h-full w-full overflow-hidden"
        style={{
          aspectRatio: `${screen.width} / ${screen.height}`,
          ...warpStyle,
        }}
      >
        {dualCalibRole ? (
          <DualCalibMarkers
            role={dualCalibRole}
            width={screen.width}
            height={screen.height}
          />
        ) : aligning ? (
          <CalibrationStage
            screen={screen}
            alignPanelId={screen.alignPanelId!}
          />
        ) : show && scene && show.status === "live" ? (
          <PanelStage
            screen={screen}
            effects={effects}
            clockSec={clockSec}
            muted={!soundOn}
            urlContext={{
              performanceId: show.cuedByPerformanceId,
            }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-600">
            <p className="text-2xl font-semibold">{screen.name}</p>
            <p className="text-sm">
              {show
                ? show.status === "live"
                  ? "Waiting for a scene…"
                  : `Bound to “${show.title}” — not live yet`
                : "Waiting for a show…"}
            </p>
            <p className="text-xs text-gray-700">
              {layoutName ? `${layoutName} · ` : ""}
              {screen.width}×{screen.height}
            </p>
          </div>
        )}
      </div>

      {/* Corner affordance — stays out of the projection until opened */}
      <button
        type="button"
        aria-label={pickerOpen ? "Hide screen setup" : "Screen setup"}
        onClick={() => setPickerOpen((o) => !o)}
        className="absolute right-3 top-3 z-[60] rounded bg-white/10 px-2 py-1 text-[11px] font-semibold tracking-wide text-white/70 backdrop-blur hover:bg-white/20 hover:text-white"
      >
        {pickerOpen ? "Hide" : "Setup"}
      </button>

      {pickerOpen && (
        <div className="absolute bottom-4 left-4 right-4 z-[60] mx-auto max-w-md rounded-lg border border-white/15 bg-black/80 p-4 text-white shadow-xl backdrop-blur-md">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{screen.name}</p>
              <p className="text-xs text-white/50">
                {layoutName || "Layout"}
                {" · "}
                {screen.width}×{screen.height}
                {screen.height > screen.width ? " portrait" : " landscape"}
                {user ? ` · ${user.name}` : ""}
              </p>
            </div>
            {binding && (
              <button
                type="button"
                onClick={() => applyBinding(null)}
                className="text-[11px] font-medium text-white/50 hover:text-white"
              >
                Auto-bind
              </button>
            )}
          </div>

          <label className="block text-[11px] font-semibold uppercase tracking-wide text-white/40">
            Sound
          </label>
          <button
            type="button"
            onClick={() => {
              setSoundOn((prev) => {
                const next = !prev;
                writeScreenSoundEnabled(next);
                return next;
              });
            }}
            className="mt-1 flex w-full items-center justify-between rounded-md border border-white/20 bg-black/60 px-3 py-2 text-sm"
          >
            <span>{soundOn ? "On — video audio plays" : "Muted"}</span>
            <span className="text-[11px] font-semibold text-white/50">
              {soundOn ? "Mute" : "Unmute"}
            </span>
          </button>
          <p className="mt-1 text-[11px] text-white/35">
            Browser autoplay starts muted, then unmutes on this screen (same as
            LinkAll8). Click Setup once if sound is blocked.
          </p>

          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-white/40">
            Show
          </label>
          <select
            className="mt-1 w-full rounded-md border border-white/20 bg-black/60 px-3 py-2 text-sm"
            value={binding?.showId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) applyBinding(null);
              else selectShow(v as Id<"shows">);
            }}
          >
            <option value="">
              {options?.shows.some((s) => s.status === "live")
                ? "Auto (first live match)"
                : "Select a show…"}
            </option>
            {(options?.shows ?? []).map((s) => (
              <option key={s.showId} value={s.showId}>
                {s.status === "live" ? "● " : ""}
                {s.title}
                {s.status !== "live" ? ` (${s.status})` : ""}
              </option>
            ))}
          </select>

          {binding?.showId && profileChoices.length > 0 && (
            <>
              <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-white/40">
                Display profile
              </label>
              <select
                className="mt-1 w-full rounded-md border border-white/20 bg-black/60 px-3 py-2 text-sm"
                value={binding.displayProfileId ?? profileChoices[0]?._id ?? ""}
                onChange={(e) =>
                  selectProfile(e.target.value as Id<"displayProfiles">)
                }
              >
                {profileChoices.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                    {p.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-white/35">
                Same screen can serve multiple shows — profile sticks until you
                change shows.
              </p>
            </>
          )}

          {((allScreens && allScreens.length > 1) ||
            (options && options.myScreens.length > 1)) && (
            <>
              <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-white/40">
                Screen
              </label>
              <select
                className="mt-1 w-full rounded-md border border-white/20 bg-black/60 px-3 py-2 text-sm"
                value={screenId}
                onChange={(e) => {
                  const id = e.target.value as Id<"screens">;
                  if (id && id !== screenId) {
                    writeLastScreenId(userId, id);
                    goToScreen(id);
                  }
                }}
              >
                {(allScreens && allScreens.length > 0
                  ? allScreens
                  : (options?.myScreens ?? [])
                ).map((s) => (
                  <option key={s._id} value={s._id}>
                    {"layoutName" in s ? `${s.layoutName} · ` : ""}
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-white/35">
                Or open{" "}
                <a href="/screens" className="underline hover:text-white">
                  /screens
                </a>{" "}
                to pick from the full list.
              </p>
            </>
          )}
        </div>
      )}
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
    <div className="mx-auto max-w-2xl">
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
  const [selectedProfileId, setSelectedProfileId] = useState<
    Id<"displayProfiles"> | null
  >(null);
  const playScene = useMutation(api.shows.playScene);
  const setStatus = useMutation(api.shows.setStatus);

  const show =
    shows?.find((s) => s._id === selectedShowId) ?? shows?.[0] ?? null;
  const profiles = useQuery(
    api.designer.listShowProfiles,
    show ? { showId: show._id } : "skip",
  );
  const profile =
    profiles?.find((p) => p._id === selectedProfileId) ??
    profiles?.find((p) => p.isDefault) ??
    profiles?.[0] ??
    null;
  const scenes = useQuery(
    api.designer.getShowScenes,
    show ? { showId: show._id } : "skip",
  );
  // Profile layout wins (same as Designer) so multi-room mappings preview correctly.
  const previewLayoutId = profile?.layoutId ?? show?.layoutId;
  const layout = useQuery(
    api.designer.getLayout,
    previewLayoutId ? { layoutId: previewLayoutId } : "skip",
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

  // Reset profile when the operator switches shows.
  useEffect(() => {
    setSelectedProfileId(null);
  }, [show?._id]);

  // Live clock synced to when the operator switched scenes.
  const [clockSec, setClockSec] = useState(0);
  const startedAt = show?.sceneStartedAt;
  const advanceIfDue = useMutation(api.shows.advanceIfDue);
  useEffect(() => {
    if (startedAt === undefined) return;
    const tick = () => setClockSec((Date.now() - startedAt) / 1000);
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [startedAt]);

  // Auto-advance when the live scene's duration elapses (legacy show runner).
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

  if (shows === undefined) return <Loading />;

  const screens: ScreenWithPanels[] = layout?.screens ?? [];
  const isLive = show?.status === "live";

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

      {/* Live multi-screen preview + display profile (mirrors Designer Shows tab) */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 bg-gray-900 px-3 py-2">
          <span className="text-sm font-semibold text-white">
            {screens.length > 1
              ? "All screens"
              : (screens[0]?.name ?? "Preview")}
          </span>
          {profiles && profiles.length > 0 && (
            <select
              className="rounded bg-gray-700 px-1.5 py-0.5 text-xs text-white"
              value={profile?._id ?? ""}
              onChange={(e) =>
                setSelectedProfileId(e.target.value as Id<"displayProfiles">)
              }
              title="Display profile (panel mapping)"
            >
              {profiles.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                  {p.isDefault ? " ★" : ""}
                </option>
              ))}
            </select>
          )}
          {isLive && liveScene && (
            <span className="ml-auto text-xs text-red-300">
              ● {liveScene.title} · {formatClock(clockSec)}
              {liveScene.durationSec
                ? ` / ${formatClock(liveScene.durationSec)}`
                : ""}
            </span>
          )}
        </div>
        <div className="bg-gray-950 p-2">
          {isLive && screens.length > 0 && effects ? (
            <div
              className={
                screens.length > 1
                  ? "flex flex-wrap justify-center gap-2"
                  : "mx-auto w-full max-w-[200px]"
              }
            >
              {screens.map((s) => (
                <div
                  key={s._id}
                  className={
                    screens.length > 1 ? "w-[110px] sm:w-[128px]" : undefined
                  }
                >
                  {screens.length > 1 && (
                    <p className="mb-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      {s.name}
                    </p>
                  )}
                  <PanelStage
                    screen={s}
                    effects={effects}
                    clockSec={clockSec}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[72px] items-center justify-center px-4 py-3 text-center text-sm text-gray-500">
              {!show
                ? "No shows yet"
                : isLive && !previewLayoutId
                  ? "This show has no layout — assign one in the Designer"
                  : isLive && screens.length === 0
                    ? "Layout has no screens yet"
                    : isLive && effects === undefined
                      ? "Loading preview…"
                      : "Tap a scene to go live"}
            </div>
          )}
        </div>
      </div>

      {/* Tap a scene to push it to every screen */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between bg-brand-dark px-3 py-2">
          <span className="text-sm font-semibold text-white">Scenes</span>
          {isLive && show && (
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
          const sceneIsLive = isLive && i === show?.currentSceneIndex;
          return (
            <button
              key={scene._id}
              onClick={() => show && playScene({ showId: show._id, index: i })}
              className={
                "flex w-full items-center gap-3 border-b border-gray-100 px-3 py-3 text-left text-sm " +
                (sceneIsLive
                  ? "bg-red-50 font-semibold text-red-700"
                  : "hover:bg-gray-50 active:bg-brand-light")
              }
            >
              <span className="w-5 text-gray-400">{i + 1}</span>
              <span className="flex-1 truncate">{scene.title}</span>
              <span className="text-xs text-gray-400">
                {scene.durationSec ? formatClock(scene.durationSec) : ""}
              </span>
              {sceneIsLive && <span className="text-xs">● LIVE</span>}
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
  const setDualCalibMarkers = useMutation(api.designer.setDualCalibMarkers);
  const clearDualCalibMarkers = useMutation(api.designer.clearDualCalibMarkers);
  const clearScreenWarp = useMutation(api.designer.clearScreenWarp);
  const [p2ScreenId, setP2ScreenId] = useState<Id<"screens"> | null>(null);
  const [dualBusy, setDualBusy] = useState(false);
  const [dualMsg, setDualMsg] = useState<string | null>(null);

  const partnerScreens = screens.filter((s) => s._id !== screen?._id);
  const p2 =
    partnerScreens.find((s) => s._id === p2ScreenId) ?? partnerScreens[0] ?? null;
  const p2Warp = useQuery(
    api.designer.getScreenWarp,
    p2 ? { screenId: p2._id } : "skip",
  );

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

          {partnerScreens.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900">
                Dual-projector cabinet
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Stack two outputs for brightness. The phone camera flow lives
                in the Expo app; here you can put both projectors into marker
                mode and clear a saved warp.
              </p>
              <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Projector 2 (warped)
              </label>
              <select
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value={p2?._id ?? ""}
                onChange={(e) =>
                  setP2ScreenId(e.target.value as Id<"screens">)
                }
              >
                {partnerScreens.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500">
                Projector 1 (reference):{" "}
                <span className="font-semibold text-gray-700">
                  {screen.name}
                </span>
                {" · "}
                {p2Warp?.matrix && p2Warp.matrix.length === 9
                  ? `Warp saved${
                      p2Warp.capturedAt
                        ? ` ${new Date(p2Warp.capturedAt).toLocaleString()}`
                        : ""
                    }`
                  : "No warp stored"}
                {p2Warp?.markersOn ? " · markers on" : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!p2 || dualBusy}
                  onClick={async () => {
                    if (!p2) return;
                    setDualBusy(true);
                    setDualMsg(null);
                    try {
                      await setDualCalibMarkers({
                        p1ScreenId: screen._id,
                        p2ScreenId: p2._id,
                      });
                      setDualMsg("Markers on both outputs. Capture from the phone.");
                    } catch (err) {
                      setDualMsg(
                        err instanceof Error ? err.message : "Could not show markers",
                      );
                    } finally {
                      setDualBusy(false);
                    }
                  }}
                  className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
                >
                  Show corner markers
                </button>
                <button
                  type="button"
                  disabled={dualBusy}
                  onClick={async () => {
                    setDualBusy(true);
                    setDualMsg(null);
                    try {
                      await clearDualCalibMarkers(
                        p2 ? { p2ScreenId: p2._id } : {},
                      );
                      setDualMsg("Markers hidden.");
                    } catch (err) {
                      setDualMsg(
                        err instanceof Error ? err.message : "Could not hide markers",
                      );
                    } finally {
                      setDualBusy(false);
                    }
                  }}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Hide markers
                </button>
                <button
                  type="button"
                  disabled={!p2 || dualBusy || !p2Warp}
                  onClick={async () => {
                    if (!p2) return;
                    setDualBusy(true);
                    setDualMsg(null);
                    try {
                      await clearScreenWarp({ screenId: p2._id });
                      setDualMsg("Alignment cleared.");
                    } catch (err) {
                      setDualMsg(
                        err instanceof Error ? err.message : "Could not clear warp",
                      );
                    } finally {
                      setDualBusy(false);
                    }
                  }}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Clear alignment
                </button>
              </div>
              {dualMsg && (
                <p className="mt-2 text-xs text-gray-600">{dualMsg}</p>
              )}
              {p2 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="overflow-hidden rounded border border-gray-200 bg-black">
                    <DualCalibMarkers
                      role="p1"
                      width={screen.width}
                      height={screen.height}
                    />
                  </div>
                  <div className="overflow-hidden rounded border border-gray-200 bg-black">
                    <DualCalibMarkers
                      role="p2"
                      width={p2.width}
                      height={p2.height}
                    />
                  </div>
                </div>
              )}
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
