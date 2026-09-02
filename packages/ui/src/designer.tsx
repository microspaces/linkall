"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Doc, Id } from "@linkall/backend/convex/_generated/dataModel";
import { expandEffectUrl } from "@linkall/backend/convex/sceneCues";
import {
  FILTER_CATALOG,
  SNAP_SLOT_COUNT,
  describeFilterCue,
  parseFilterCue,
} from "@linkall/backend/convex/filterCues";
import {
  SCREEN_ROLES,
  screenRoleOf,
  type ScreenRole,
} from "@linkall/backend/convex/venueLogic";
import { CameraSubscribe } from "./camera";
import { useCurrentUser } from "./current-user";
import { EmptyState, Loading } from "./empty-state";

/**
 * Show Designer (legacy: Homeshow/Surroundshow Designer).
 *
 * Shows tab:    Show | Scene | Effect drill-down grids + multi-screen preview + timeline.
 * Screens tab:  Layout | Screen | Panel grids + draggable polygon editor.
 * Profiles tab: Display profiles + logical→physical panel mappings.
 */

type Point = { x: number; y: number };
type Panel = Doc<"panels">;
type Screen = Doc<"screens"> & { panels: Panel[] };
type EffectRow = Doc<"effects"> & {
  panelName: string;
  screenName: string;
  zIndex: number;
  sourcePanelId?: Id<"panels">;
};

// ---------------------------------------------------------------- helpers

function polygonCss(points: Point[], width: number, height: number) {
  return `polygon(${points
    .map((p) => `${(p.x / width) * 100}% ${(p.y / height) * 100}%`)
    .join(", ")})`;
}

function bbox(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Extract a YouTube video id from watch/shorts/embed/youtu.be URLs. */
function youtubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      if (
        (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") &&
        parts[1]
      ) {
        return parts[1];
      }
    }
  } catch {
    /* not a URL */
  }
  return null;
}

function youtubeEmbedSrc(
  url: string,
  videoStartSec = 0,
  muted = true,
): string | null {
  const id = youtubeVideoId(url);
  if (!id) return null;
  const params = new URLSearchParams({
    autoplay: "1",
    mute: muted ? "1" : "0",
    controls: "0",
    rel: "0",
    loop: "1",
    playlist: id,
    playsinline: "1",
  });
  if (videoStartSec > 0) params.set("start", String(Math.floor(videoStartSec)));
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

/** Minimal YT IFrame API surface used for screen-page unmute (legacy LinkAll8). */
type YtPlayer = {
  mute: () => void;
  unMute: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
};

type YtNamespace = {
  Player: new (
    element: HTMLElement | string,
    options: {
      width?: string | number;
      height?: string | number;
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YtPlayer }) => void;
        onStateChange?: (e: { data: number; target: YtPlayer }) => void;
      };
    },
  ) => YtPlayer;
  PlayerState?: { PLAYING: number };
};

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YtNamespace> | null = null;

function loadYouTubeApi(): Promise<YtNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no window"));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube API missing Player"));
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    // API may already be mid-load; poll until ready.
    const started = Date.now();
    const t = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(t);
        resolve(window.YT);
      } else if (Date.now() - started > 15_000) {
        window.clearInterval(t);
        reject(new Error("YouTube API load timeout"));
      }
    }, 50);
  });
  return youtubeApiPromise;
}

/**
 * Screen-output YouTube player: start muted (autoplay policy), then unmute
 * once playing — matches LinkAll8 `/screen` onPlayerStateChange behavior.
 */
function YouTubeScreenPlayer({
  videoId,
  videoStartSec = 0,
}: {
  videoId: string;
  videoStartSec?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const unmutedRef = useRef(false);
  const [apiFailed, setApiFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    unmutedRef.current = false;
    setApiFailed(false);
    const host = hostRef.current;
    if (!host) return;

    void loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = "";
        const mount = document.createElement("div");
        hostRef.current.appendChild(mount);
        const start = Math.floor(videoStartSec);
        playerRef.current = new YT.Player(mount, {
          width: "100%",
          height: "100%",
          videoId,
          playerVars: {
            autoplay: 1,
            playsinline: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            fs: 0,
            loop: 1,
            playlist: videoId,
            ...(start > 0 ? { start } : {}),
          },
          events: {
            onReady: (e) => {
              e.target.mute();
              e.target.playVideo();
            },
            onStateChange: (e) => {
              const playing = YT.PlayerState?.PLAYING ?? 1;
              if (e.data === playing && !unmutedRef.current) {
                if (start > 0) e.target.seekTo(start, true);
                e.target.unMute();
                unmutedRef.current = true;
              }
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setApiFailed(true);
      });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      if (host) host.innerHTML = "";
    };
  }, [videoId, videoStartSec]);

  const embedFallback = apiFailed
    ? youtubeEmbedSrc(
        `https://www.youtube.com/watch?v=${videoId}`,
        videoStartSec,
        false,
      )
    : null;

  return (
    <>
      <div
        ref={hostRef}
        className={
          "pointer-events-none absolute left-1/2 top-1/2 h-full w-full " +
          (apiFailed ? "hidden" : "")
        }
        style={{ transform: "translate(-50%, -50%) scale(1.35)" }}
      />
      {embedFallback && (
        <iframe
          key={embedFallback}
          src={embedFallback}
          title="YouTube effect"
          className="pointer-events-none absolute left-1/2 top-1/2 border-0"
          style={{
            width: "100%",
            height: "100%",
            minWidth: "100%",
            minHeight: "100%",
            transform: "translate(-50%, -50%) scale(1.35)",
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </>
  );
}

/** When startTimes tie, keep media over solid color (legacy empty→black overlays). */
function effectStackRank(kind: string): number {
  if (kind === "url" || kind === "html") return 4;
  if (kind === "camera" || kind === "video") return 3;
  if (kind === "image") return 2;
  if (kind === "text") return 1;
  return 0;
}

/** Cue-only effects: no panel, fired when the scene becomes current. */
function isCueEffect(kind: string) {
  return kind === "command" || kind === "hotkey" || kind === "filter";
}

function isVisualEffect(kind: string) {
  return !isCueEffect(kind);
}

function panelBoxStyle(
  box: { minX: number; minY: number; w: number; h: number },
  screen: Pick<Screen, "width" | "height">,
): CSSProperties {
  return {
    position: "absolute",
    left: `${(box.minX / screen.width) * 100}%`,
    top: `${(box.minY / screen.height) * 100}%`,
    width: `${(box.w / screen.width) * 100}%`,
    height: `${(box.h / screen.height) * 100}%`,
    overflow: "hidden",
  };
}

function EffectMedia({
  kind,
  content,
  box,
  screen,
  videoStartSec = 0,
  muted = true,
  overlay = false,
  urlContext,
}: {
  kind: string;
  content: string;
  box: { minX: number; minY: number; w: number; h: number };
  screen: Pick<Screen, "_id" | "width" | "height">;
  /** Legacy VideoStartTime — offset into the media. */
  videoStartSec?: number;
  /**
   * Designer / player previews stay muted. Screen output passes false so
   * YouTube can unmute after autoplay (LinkAll8 `/screen` behavior).
   */
  muted?: boolean;
  /** When true, text sits on media below instead of a solid fill. */
  overlay?: boolean;
  urlContext?: { performanceId?: string };
}) {
  if (isCueEffect(kind)) return null;

  // Color fills the whole clipped panel (correct for irregular polygons).
  if (kind === "color") {
    return (
      <div className="h-full w-full" style={{ backgroundColor: content }} />
    );
  }

  // Images / video / text are framed to the panel bbox so a door-sized
  // YouTube clip isn't a tiny crop of a fullscreen embed.
  const frame = panelBoxStyle(box, screen);

  if (kind === "image") {
    return (
      <div style={frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={content} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }
  if (kind === "video") {
    const ytId = youtubeVideoId(content);
    if (ytId) {
      // Cover the panel: 16:9 letterboxes on tall HyperX side LEDs
      // unless we scale up (1.35 is only enough for landscape).
      const boxAr = box.w / Math.max(box.h, 1);
      const videoAr = 16 / 9;
      const coverScale = Math.max(videoAr / boxAr, boxAr / videoAr);
      return (
        <div style={{ ...frame, position: "absolute" }} className="bg-black">
          {muted ? (
            <iframe
              key={youtubeEmbedSrc(content, videoStartSec, true) ?? ytId}
              src={youtubeEmbedSrc(content, videoStartSec, true) ?? undefined}
              title="YouTube effect"
              className="pointer-events-none absolute left-1/2 top-1/2 border-0"
              style={{
                width: "100%",
                height: "100%",
                minWidth: "100%",
                minHeight: "100%",
                transform: `translate(-50%, -50%) scale(${coverScale})`,
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <YouTubeScreenPlayer
              key={`${ytId}#${videoStartSec}`}
              videoId={ytId}
              videoStartSec={videoStartSec}
            />
          )}
        </div>
      );
    }
    return (
      <div style={frame}>
        <video
          key={`${content}#${videoStartSec}#${muted ? "m" : "a"}`}
          src={content}
          autoPlay
          muted={muted}
          loop
          playsInline
          className="h-full w-full object-cover"
          onLoadedMetadata={(e) => {
            if (videoStartSec > 0) {
              e.currentTarget.currentTime = videoStartSec;
            }
            if (!muted) {
              const play = e.currentTarget.play();
              if (play) void play.catch(() => {});
            }
          }}
        />
      </div>
    );
  }
  if (kind === "camera") {
    return (
      <div style={frame} className="bg-black">
        <CameraSubscribe screenId={screen._id} />
      </div>
    );
  }
  if (kind === "url") {
    const src = expandEffectUrl(content, urlContext ?? {});
    return (
      <div style={frame} className="bg-black">
        <iframe
          src={src}
          title="Overlay"
          className="h-full w-full border-0"
          allow="autoplay; fullscreen"
        />
      </div>
    );
  }
  if (kind === "html") {
    return (
      <div
        style={frame}
        className="overflow-hidden bg-black text-white"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  return (
    <div
      className={
        overlay
          ? "h-full w-full bg-transparent"
          : "h-full w-full bg-red-900"
      }
    >
      <div className="flex items-center justify-center" style={frame}>
        <span
          className={
            overlay
              ? "px-3 text-center font-sans font-black uppercase tracking-[0.12em] text-white"
              : "px-2 text-center font-serif font-bold text-amber-100"
          }
          style={{
            fontSize: overlay
              ? "clamp(1.4rem, 8vw, 5.5rem)"
              : "clamp(0.8rem, 3vw, 2.2rem)",
            textShadow: overlay
              ? "0 0 24px rgba(0,229,255,0.55), 0 0 48px rgba(255,45,149,0.35), 0 4px 18px rgba(0,0,0,0.85)"
              : undefined,
          }}
        >
          {content}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- stage

/**
 * Renders one physical screen with its panels filled by the given effects,
 * using CSS clip-path polygons. Shared by the designer preview and the live
 * show player.
 */
export function PanelStage({
  screen,
  effects,
  clockSec,
  muted = true,
  urlContext,
}: {
  screen: Screen;
  effects: Pick<
    Doc<"effects">,
    | "panelId"
    | "kind"
    | "content"
    | "startTime"
    | "isEnabled"
    | "durationSec"
    | "videoStartSec"
  >[];
  /** Seconds into the scene; effects appear once clock passes startTime. */
  clockSec: number;
  /** When false, video effects play with audio (screen output only). */
  muted?: boolean;
  /** Expands {performanceId} in URL effects (legacy iframe overlays). */
  urlContext?: { performanceId?: string };
}) {
  // Per panel: keep every enabled effect active in the clock window, then
  // stack them (color → image/video → text) so titles can sit on media.
  // When only one effect is active, behavior matches the previous “winner”
  // model (including solid text fills).
  const active = new Map<string, Array<(typeof effects)[number]>>();
  for (const e of effects) {
    if (!isVisualEffect(e.kind) || !e.panelId) continue;
    if (!e.isEnabled || e.startTime > clockSec) continue;
    const endTime = e.startTime + (e.durationSec ?? Infinity);
    if (clockSec > endTime) continue;
    const list = active.get(e.panelId);
    if (list) list.push(e);
    else active.set(e.panelId, [e]);
  }
  for (const list of active.values()) {
    list.sort((a, b) => {
      const rank = effectStackRank(a.kind) - effectStackRank(b.kind);
      if (rank !== 0) return rank;
      return a.startTime - b.startTime;
    });
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-gray-950"
      style={{ aspectRatio: `${screen.width} / ${screen.height}` }}
    >
      {screen.panels.map((panel) => {
        const layered = active.get(panel._id);
        const clip = polygonCss(panel.points, screen.width, screen.height);
        const style: CSSProperties = {
          clipPath: clip,
          zIndex: panel.zIndex,
        };
        const box = bbox(panel.points);
        const hasMediaUnderText =
          !!layered &&
          layered.some((e) => e.kind !== "text") &&
          layered.some((e) => e.kind === "text");
        return (
          <div key={panel._id} className="absolute inset-0" style={style}>
            {layered === undefined ? (
              <div className="h-full w-full bg-gray-800/60" />
            ) : (
              layered.map((effect, i) => (
                <div
                  key={`${effect.kind}-${effect.startTime}-${i}`}
                  className="absolute inset-0"
                  style={{ zIndex: i }}
                >
                  <EffectMedia
                    kind={effect.kind}
                    content={effect.content}
                    box={box}
                    screen={screen}
                    videoStartSec={effect.videoStartSec ?? 0}
                    muted={muted}
                    overlay={effect.kind === "text" && hasMediaUnderText}
                    urlContext={urlContext}
                  />
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- modal

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none";

// ------------------------------------------------------------ grid chrome

function Column({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between bg-brand-dark px-3 py-2">
        <span className="text-sm font-semibold text-white">{title}</span>
        {onAdd && (
          <button
            onClick={onAdd}
            className="rounded px-1.5 text-lg leading-none text-white/80 hover:bg-white/10 hover:text-white"
            title={`Add ${title.toLowerCase()}`}
          >
            +
          </button>
        )}
      </div>
      <div className="max-h-72 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function Row({
  selected,
  onSelect,
  onEdit,
  onDelete,
  children,
}: {
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={
        "group flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm " +
        (selected ? "bg-brand-light text-brand-dark" : "hover:bg-gray-50")
      }
      onClick={onSelect}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="rounded p-1 text-gray-300 hover:text-brand group-hover:text-gray-400"
          title="Edit"
        >
          ✎
        </button>
      )}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm("Delete this item (and everything under it)?"))
              onDelete();
          }}
          className="rounded p-1 text-gray-300 hover:text-red-600 group-hover:text-gray-400"
          title="Delete"
        >
          🗑
        </button>
      )}
    </div>
  );
}

// ----------------------------------------------------------- effect thumb

function EffectThumb({
  kind,
  content,
  className = "h-8 w-12",
}: {
  kind: string;
  content: string;
  className?: string;
}) {
  if (kind === "command")
    return (
      <div
        className={`${className} flex shrink-0 items-center justify-center rounded border border-slate-600 bg-slate-800 px-1 text-[9px] font-semibold text-white`}
      >
        XPT
      </div>
    );
  if (kind === "hotkey")
    return (
      <div
        className={`${className} flex shrink-0 items-center justify-center rounded border border-amber-700 bg-amber-950 px-1 text-[9px] font-semibold text-amber-200`}
      >
        KEY
      </div>
    );
  if (kind === "filter")
    return (
      <div
        className={`${className} flex shrink-0 items-center justify-center rounded border border-fuchsia-700 bg-fuchsia-950 px-1 text-[9px] font-semibold text-fuchsia-200`}
      >
        FX
      </div>
    );
  if (kind === "camera")
    return (
      <div
        className={`${className} flex shrink-0 items-center justify-center rounded border border-cyan-700 bg-cyan-950 px-1 text-[9px] font-semibold text-cyan-200`}
      >
        CAM
      </div>
    );
  if (kind === "color")
    return (
      <div
        className={`${className} shrink-0 rounded border border-gray-200`}
        style={{ backgroundColor: content }}
      />
    );
  if (kind === "image")
    return (
      <div
        className={`${className} shrink-0 rounded border border-gray-200 bg-cover bg-center`}
        style={{ backgroundImage: `url(${content})` }}
      />
    );
  if (kind === "video") {
    const yt = youtubeVideoId(content);
    if (yt) {
      return (
        <div
          className={`${className} shrink-0 rounded border border-gray-200 bg-cover bg-center`}
          style={{
            backgroundImage: `url(https://img.youtube.com/vi/${yt}/mqdefault.jpg)`,
          }}
        />
      );
    }
    return (
      <div
        className={`${className} flex shrink-0 items-center justify-center rounded border border-gray-700 bg-gray-900 text-xs text-white`}
      >
        ▶
      </div>
    );
  }
  return (
    <div
      className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-amber-50 px-1 text-[9px] text-amber-800`}
    >
      {content.slice(0, 12)}
    </div>
  );
}

// ---------------------------------------------------------------- timeline

function Timeline({
  panels,
  effects,
  durationSec,
  playheadSec,
  onUpdateEffect,
  onLaneClick,
}: {
  panels: { panel: Panel; label: string }[];
  effects: EffectRow[];
  durationSec: number;
  playheadSec: number | null;
  onUpdateEffect?: (effectId: Id<"effects">, patch: { startTime?: number; durationSec?: number }) => void;
  onLaneClick?: (panelId: Id<"panels">, startTimeSec: number) => void;
}) {
  const laneRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    effectId: Id<"effects">;
    mode: "move" | "resize";
    startX: number;
    origStart: number;
    origDuration: number | null;
    laneWidth: number;
  } | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);

  const snap = (sec: number) => Math.round(sec * 2) / 2; // snap to 0.5s

  const pxToSec = (px: number, laneWidth: number) =>
    snap(Math.max(0, Math.min(durationSec, (px / laneWidth) * durationSec)));

  useEffect(() => {
    if (!dragState) return;
    const onMove = (e: PointerEvent) => {
      const lane = laneRef.current;
      if (!lane) return;
      const dx = e.clientX - dragState.startX;
      const dSec = (dx / dragState.laneWidth) * durationSec;
      if (dragState.mode === "move") {
        const newStart = snap(Math.max(0, dragState.origStart + dSec));
        setTooltip(`Start: ${formatClock(newStart)}`);
      } else {
        const newDur = snap(Math.max(0.5, (dragState.origDuration ?? durationSec - dragState.origStart) + dSec));
        setTooltip(`Duration: ${formatClock(newDur)}`);
      }
    };
    const onUp = (e: PointerEvent) => {
      const lane = laneRef.current;
      if (!lane) {
        setDragState(null);
        setTooltip(null);
        return;
      }
      const dx = e.clientX - dragState.startX;
      const dSec = (dx / dragState.laneWidth) * durationSec;
      if (dragState.mode === "move") {
        const newStart = snap(Math.max(0, dragState.origStart + dSec));
        onUpdateEffect?.(dragState.effectId, { startTime: newStart });
      } else {
        const newDur = snap(Math.max(0.5, (dragState.origDuration ?? durationSec - dragState.origStart) + dSec));
        onUpdateEffect?.(dragState.effectId, { durationSec: newDur });
      }
      setDragState(null);
      setTooltip(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragState, durationSec, onUpdateEffect]);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between bg-gray-900 px-3 py-2">
        <span className="text-sm font-semibold text-white">Timeline</span>
        <span className="text-xs text-gray-400">
          scene length {formatClock(durationSec)}
          {onUpdateEffect && " · drag blocks to retime"}
        </span>
      </div>
      <div className="relative">
        {panels.map(({ panel, label }) => {
          const rows = effects.filter(
            (e) => isVisualEffect(e.kind) && e.panelId === panel._id,
          );
          return (
            <div
              key={panel._id}
              className="flex items-stretch border-b border-gray-100"
            >
              <div className="w-28 shrink-0 border-r border-gray-100 px-2 py-2 text-xs font-semibold text-gray-600">
                {label}
              </div>
              <div
                ref={panel._id === panels[0]?.panel._id ? laneRef : undefined}
                className="relative h-9 flex-1 bg-gray-50"
                onPointerDown={(e) => {
                  if ((e.target as Element).closest("[data-effect-block]")) return;
                  if (!onLaneClick) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const sec = pxToSec(e.clientX - rect.left, rect.width);
                  onLaneClick(panel._id, sec);
                }}
              >
                {rows.map((e) => {
                  const left = Math.min((e.startTime / durationSec) * 100, 100);
                  const dur = e.durationSec ?? null;
                  const widthPct = dur !== null
                    ? Math.min((dur / durationSec) * 100, 100 - left)
                    : 100 - left;
                  return (
                    <div
                      key={e._id}
                      data-effect-block
                      className={
                        "group absolute inset-y-1 overflow-hidden rounded border " +
                        (e.isEnabled
                          ? "border-gray-300 cursor-grab"
                          : "border-dashed border-gray-300 opacity-40")
                      }
                      style={{
                        left: `${left}%`,
                        width: `${widthPct}%`,
                        ...(e.kind === "color"
                          ? { backgroundColor: e.content }
                          : e.kind === "image"
                            ? {
                                backgroundImage: `url(${e.content})`,
                                backgroundSize: "auto 100%",
                                backgroundRepeat: "repeat-x",
                              }
                            : e.kind === "video"
                              ? (() => {
                                  const yt = youtubeVideoId(e.content);
                                  return yt
                                    ? {
                                        backgroundImage: `url(https://img.youtube.com/vi/${yt}/mqdefault.jpg)`,
                                        backgroundSize: "cover",
                                        backgroundPosition: "center",
                                      }
                                    : { backgroundColor: "#111827" };
                                })()
                              : { backgroundColor: "#fef3c7" }),
                      }}
                      title={`${e.panelName} @ ${formatClock(e.startTime)}${dur !== null ? ` (${formatClock(dur)})` : ""}`}
                      onPointerDown={(ev) => {
                        if (!onUpdateEffect) return;
                        ev.stopPropagation();
                        const lane = laneRef.current;
                        if (!lane) return;
                        const rect = lane.getBoundingClientRect();
                        (ev.target as Element).setPointerCapture?.(ev.pointerId);
                        setDragState({
                          effectId: e._id,
                          mode: "move",
                          startX: ev.clientX,
                          origStart: e.startTime,
                          origDuration: dur,
                          laneWidth: rect.width,
                        });
                      }}
                    >
                      {e.kind === "video" && !youtubeVideoId(e.content) && (
                        <span className="px-1 text-[9px] text-white">
                          ▶ video
                        </span>
                      )}
                      {/* Resize handle on right edge */}
                      {onUpdateEffect && e.isEnabled && (
                        <div
                          className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-black/20 opacity-0 group-hover:opacity-100"
                          onPointerDown={(ev) => {
                            ev.stopPropagation();
                            const lane = laneRef.current;
                            if (!lane) return;
                            const rect = lane.getBoundingClientRect();
                            (ev.target as Element).setPointerCapture?.(ev.pointerId);
                            setDragState({
                              effectId: e._id,
                              mode: "resize",
                              startX: ev.clientX,
                              origStart: e.startTime,
                              origDuration: dur,
                              laneWidth: rect.width,
                            });
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {playheadSec !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-red-500"
            style={{
              left: `calc(7rem + (100% - 7rem) * ${Math.min(playheadSec / durationSec, 1)})`,
            }}
          />
        )}
        {tooltip && dragState && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded bg-black/80 px-2 py-1 text-xs text-white"
            style={{
              left: `calc(7rem + (100% - 7rem) * 0.5)`,
            }}
          >
            {tooltip}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- shows tab

function ShowsTab() {
  const { userId } = useCurrentUser();
  const shows = useQuery(api.shows.list, {});
  const layouts = useQuery(api.designer.listLayouts);

  const [selectedShowId, setSelectedShowId] = useState<Id<"shows"> | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<Id<"scenes"> | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<
    Id<"displayProfiles"> | null
  >(null);
  const [scrubClock, setScrubClock] = useState<number | null>(null);
  const [modal, setModal] = useState<
    | { type: "show"; show?: Doc<"shows"> }
    | { type: "scene"; scene?: Doc<"scenes"> }
    | { type: "effect"; effect?: EffectRow }
    | { type: "effectPrefill"; panelId: Id<"panels">; startTime: number }
    | null
  >(null);

  // Prefer a show that can preview (has layout), not the live Halloween stub.
  const show =
    shows?.find((s) => s._id === selectedShowId) ??
    shows?.find((s) => s.layoutId) ??
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
  const scenes = useQuery(
    api.designer.getShowScenes,
    show ? { showId: show._id } : "skip",
  );
  const scene =
    scenes?.find((s) => s._id === selectedSceneId) ?? scenes?.[0] ?? null;
  const effects = useQuery(
    api.designer.getSceneEffects,
    scene
      ? {
          sceneId: scene._id,
          ...(profile ? { displayProfileId: profile._id } : {}),
        }
      : "skip",
  );
  const cueEffects = useQuery(
    api.designer.getShowCueEffects,
    show
      ? {
          showId: show._id,
          ...(profile ? { displayProfileId: profile._id } : {}),
        }
      : "skip",
  );
  const previewLayoutId = profile?.layoutId ?? show?.layoutId;
  const layout = useQuery(
    api.designer.getLayout,
    previewLayoutId ? { layoutId: previewLayoutId } : "skip",
  );

  // Preview playback clock — advances to the next scene when duration elapses
  // (same behavior as the live show runner).
  const durationSec = scene?.durationSec ?? 60;
  const [playing, setPlaying] = useState(false);
  const [clock, setClock] = useState<number | null>(null);
  const playStartRef = useRef(0);
  const autoAdvanceRef = useRef(false);
  useEffect(() => {
    if (!playing) return;
    playStartRef.current = Date.now();
    setClock(0);
    const t = setInterval(() => {
      const elapsed = (Date.now() - playStartRef.current) / 1000;
      if (elapsed >= durationSec) {
        if (scenes && scene) {
          const idx = scenes.findIndex((s) => s._id === scene._id);
          if (idx >= 0 && idx < scenes.length - 1) {
            autoAdvanceRef.current = true;
            setSelectedSceneId(scenes[idx + 1]!._id);
            setScrubClock(null);
            // Keep playing — the [playing, durationSec] effect restarts the clock
            // for the new scene because durationSec changes with the scene.
            playStartRef.current = Date.now();
            setClock(0);
            return;
          }
        }
        setPlaying(false);
        setClock(null);
      } else {
        setClock(elapsed);
      }
    }, 100);
    return () => clearInterval(t);
  }, [playing, durationSec, scenes, scene]);
  // Stop playback when switching scenes manually (not auto-advance).
  useEffect(() => {
    if (autoAdvanceRef.current) {
      autoAdvanceRef.current = false;
      return;
    }
    setPlaying(false);
    setClock(null);
    setScrubClock(null);
  }, [scene?._id]);

  // Reset profile selection when the show changes.
  useEffect(() => {
    setSelectedProfileId(null);
  }, [show?._id]);

  const deleteShow = useMutation(api.designer.deleteShow);
  const deleteScene = useMutation(api.designer.deleteScene);
  const deleteEffect = useMutation(api.designer.deleteEffect);
  const updateEffectMut = useMutation(api.designer.updateEffect);
  const playScene = useMutation(api.shows.playScene);

  if (shows === undefined || layouts === undefined) return <Loading />;

  const screens: Screen[] = layout?.screens ?? [];
  const panelLanes = screens.flatMap((s) =>
    s.panels.map((panel) => ({
      panel,
      label: screens.length > 1 ? `${s.name} · ${panel.name}` : panel.name,
    })),
  );
  const previewClock = clock ?? scrubClock ?? durationSec; // stopped = fully composed scene

  return (
    <div className="space-y-4">
      {/* Preview + timeline */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 bg-gray-900 px-3 py-2">
            <span className="text-sm font-semibold text-white">
              {screens.length > 1 ? "All screens" : screens[0]?.name ?? "Preview"}
            </span>
            {profiles && profiles.length > 0 && (
              <select
                className="rounded bg-gray-700 px-1 py-0.5 text-xs text-white"
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
            <span className="ml-auto text-xs text-gray-400">
              {playing && clock !== null
                ? `${formatClock(clock)} / ${formatClock(durationSec)}`
                : scene?.title ?? ""}
            </span>
            <button
              onClick={() => setPlaying((p) => !p)}
              disabled={!scene || screens.length === 0}
              className={
                "rounded-full px-3 py-0.5 text-xs font-bold " +
                (playing
                  ? "bg-gray-600 text-white"
                  : "bg-red-600 text-white hover:bg-red-500")
              }
            >
              {playing ? "Stop" : "Play"}
            </button>
          </div>
          <div className="p-3">
            {screens.length > 0 && effects ? (
              <div
                className={
                  screens.length > 1
                    ? "grid gap-2 sm:grid-cols-2"
                    : "grid gap-2"
                }
              >
                {screens.map((s) => (
                  <div key={s._id}>
                    {screens.length > 1 && (
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {s.name}
                      </p>
                    )}
                    <PanelStage
                      screen={s}
                      effects={effects}
                      clockSec={previewClock}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
                {show
                  ? previewLayoutId
                    ? "Select a scene"
                    : "Assign a layout or create a display profile to preview panels"
                  : "Create a show to get started"}
              </div>
            )}
            {/* Preview scrubber */}
            {scene && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={durationSec}
                  step={0.5}
                  value={previewClock}
                  disabled={playing}
                  onChange={(e) => {
                    setScrubClock(Number(e.target.value));
                    setPlaying(false);
                  }}
                  className="flex-1"
                />
                <span className="w-10 text-right text-xs font-mono text-gray-500">
                  {formatClock(previewClock)}
                </span>
              </div>
            )}
          </div>
        </div>

        {scene && panelLanes.length > 0 && effects ? (
          <Timeline
            panels={panelLanes}
            effects={effects}
            durationSec={durationSec}
            playheadSec={clock ?? scrubClock}
            onUpdateEffect={(effectId, patch) => updateEffectMut({ effectId, ...patch })}
            onLaneClick={(panelId, startTimeSec) =>
              setModal({ type: "effectPrefill", panelId, startTime: startTimeSec })
            }
          />
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 text-sm text-gray-400">
            Timeline appears when a scene and layout are selected
          </div>
        )}
      </div>

      {/* Show | Scene | Effect columns */}
      <div className="flex flex-col gap-4 md:flex-row">
        <Column title="Show" onAdd={() => setModal({ type: "show" })}>
          {shows.length === 0 && (
            <p className="p-3 text-xs text-gray-400">No shows yet — add one.</p>
          )}
          {shows.map((s) => (
            <Row
              key={s._id}
              selected={show?._id === s._id}
              onSelect={() => {
                setSelectedShowId(s._id);
                setSelectedSceneId(null);
                setSelectedProfileId(null);
              }}
              onEdit={() => setModal({ type: "show", show: s })}
              onDelete={() => deleteShow({ showId: s._id })}
            >
              <span className="font-medium">{s.title}</span>
            </Row>
          ))}
        </Column>

        <Column
          title="Scene"
          onAdd={show ? () => setModal({ type: "scene" }) : undefined}
        >
          {!show && <p className="p-3 text-xs text-gray-400">Select a show.</p>}
          {scenes?.map((s, idx) => {
            const isLiveScene = show?.status === "live" && idx === show.currentSceneIndex;
            const isNext = show?.status === "live" && idx === show.currentSceneIndex + 1;
            const isFinale =
              show?.status === "live" &&
              idx === scenes.length - 1 &&
              !isLiveScene;
            const sceneCue = cueEffects?.[s._id];
            return (
              <div
                key={s._id}
                className={
                  "group relative cursor-pointer border-b border-gray-100 px-3 py-2 text-sm transition " +
                  (scene?._id === s._id
                    ? "bg-brand-light text-brand-dark"
                    : "hover:bg-gray-50")
                }
                onClick={() => {
                  setSelectedSceneId(s._id);
                  // Push to every subscribed /screens/<id> output for this layout.
                  if (show) void playScene({ showId: show._id, index: idx });
                }}
              >
                {/* Scene cue thumbnail — each card uses its own scene's effects */}
                <div className="mb-1.5 overflow-hidden rounded border border-gray-200 bg-gray-950" style={{ maxWidth: 120 }}>
                  {screens[0] && sceneCue ? (
                    <PanelStage
                      screen={screens[0]}
                      effects={sceneCue}
                      clockSec={0}
                    />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center text-[9px] text-gray-500">
                      {s.title.slice(0, 10)}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{s.title}</span>
                  <span className="text-xs text-gray-400">
                    {s.durationSec ?? "—"}
                  </span>
                </div>
                {/* UP NEXT / LIVE / FINALE badges */}
                {isLiveScene && (
                  <span className="absolute right-1 top-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    ● LIVE
                  </span>
                )}
                {isNext && !isFinale && (
                  <span className="absolute right-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    UP NEXT
                  </span>
                )}
                {isFinale && (
                  <span className="absolute right-1 top-1 rounded bg-purple-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    FINALE
                  </span>
                )}
                {/* Edit/delete buttons */}
                <div className="absolute right-1 bottom-1 flex gap-0.5 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setModal({ type: "scene", scene: s });
                    }}
                    className="rounded p-0.5 text-gray-300 hover:text-brand"
                    title="Edit"
                  >
                    ✎
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm("Delete this scene?"))
                        deleteScene({ sceneId: s._id });
                    }}
                    className="rounded p-0.5 text-gray-300 hover:text-red-600"
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </Column>

        <Column
          title="Effect"
          onAdd={scene ? () => setModal({ type: "effect" }) : undefined}
        >
          {!scene && <p className="p-3 text-xs text-gray-400">Select a scene.</p>}
          {scene && panelLanes.length === 0 && (
            <p className="p-3 text-xs text-gray-400">
              No panels yet — you can still add switcher commands.
            </p>
          )}
          {effects?.map((e) => (
            <Row
              key={e._id}
              onEdit={() => setModal({ type: "effect", effect: e })}
              onDelete={() => deleteEffect({ effectId: e._id })}
            >
              <div className="flex items-center gap-2">
                <EffectThumb kind={e.kind} content={e.content} />
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {isCueEffect(e.kind)
                      ? e.content
                      : e.logicalPanelName
                        ? `${e.logicalPanelName} → ${e.panelName}`
                        : e.panelName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {e.kind === "command"
                      ? "switcher command"
                      : e.kind === "hotkey"
                        ? "laptop hotkey"
                        : e.kind === "filter"
                          ? `camera ${describeFilterCue(e.content)}`
                      : `${e.kind} · starts ${formatClock(e.startTime)}`}
                    {e.isEnabled ? "" : " · disabled"}
                  </p>
                </div>
              </div>
            </Row>
          ))}
        </Column>
      </div>

      {/* Modals */}
      {modal?.type === "show" && userId && (
        <ShowModal
          show={modal.show}
          layouts={layouts}
          ownerId={userId}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "scene" && show && (
        <SceneModal
          showId={show._id}
          scene={modal.scene}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "effect" && scene && (
        <EffectModal
          sceneId={scene._id}
          effect={modal.effect}
          panels={panelLanes}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "effectPrefill" && scene && (
        <EffectModal
          sceneId={scene._id}
          panels={panelLanes}
          prefillPanelId={modal.panelId}
          prefillStartTime={modal.startTime}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function ShowModal({
  show,
  layouts,
  ownerId,
  onClose,
}: {
  show?: Doc<"shows">;
  layouts: Doc<"layouts">[];
  ownerId: Id<"users">;
  onClose: () => void;
}) {
  const createShow = useMutation(api.shows.create);
  const updateShow = useMutation(api.designer.updateShow);
  const [title, setTitle] = useState(show?.title ?? "");
  const [description, setDescription] = useState(show?.description ?? "");
  const [layoutId, setLayoutId] = useState<string>(
    show?.layoutId ?? layouts[0]?._id ?? "",
  );

  const save = async () => {
    if (!title.trim()) return;
    const layout = layoutId ? (layoutId as Id<"layouts">) : undefined;
    if (show) {
      await updateShow({ showId: show._id, title, description, layoutId: layout });
    } else {
      await createShow({ title, description, ownerId, layoutId: layout });
    }
    onClose();
  };

  return (
    <Modal title={show ? "Edit show" : "New show"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Description">
          <input
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="Layout">
          <select
            className={inputCls}
            value={layoutId}
            onChange={(e) => setLayoutId(e.target.value)}
          >
            <option value="">(none)</option>
            {layouts.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <button
          onClick={save}
          className="w-full rounded-md bg-brand py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

function SceneModal({
  showId,
  scene,
  onClose,
}: {
  showId: Id<"shows">;
  scene?: Doc<"scenes">;
  onClose: () => void;
}) {
  const createScene = useMutation(api.designer.createScene);
  const updateScene = useMutation(api.designer.updateScene);
  const [title, setTitle] = useState(scene?.title ?? "");
  const [duration, setDuration] = useState(String(scene?.durationSec ?? 60));
  const [isOverlay, setIsOverlay] = useState(scene?.isOverlay ?? false);
  const [isSoundEffect, setIsSoundEffect] = useState(
    scene?.isSoundEffect ?? false,
  );

  const save = async () => {
    if (!title.trim()) return;
    const durationSec = Math.max(1, Number(duration) || 60);
    if (scene) {
      await updateScene({
        sceneId: scene._id,
        title,
        durationSec,
        isOverlay,
        isSoundEffect,
      });
    } else {
      await createScene({
        showId,
        title,
        durationSec,
        isOverlay,
        isSoundEffect,
      });
    }
    onClose();
  };

  return (
    <Modal title={scene ? "Edit scene" : "New scene"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Game Instructions"
            autoFocus
          />
        </Field>
        <p className="text-[11px] text-gray-500">
          Performance cues this scene by name — use{" "}
          <span className="font-semibold">Game Instructions</span>,{" "}
          <span className="font-semibold">Vote</span>,{" "}
          <span className="font-semibold">Winner …</span>,{" "}
          <span className="font-semibold">Introduction</span>.
        </p>
        <Field label="Duration (seconds)">
          <input
            className={inputCls}
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isOverlay}
            onChange={(e) => setIsOverlay(e.target.checked)}
          />
          Overlay (performance Overlay bucket)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isSoundEffect}
            onChange={(e) => setIsSoundEffect(e.target.checked)}
          />
          Sound / music (does not replace the visual)
        </label>
        <button
          onClick={save}
          className="w-full rounded-md bg-brand py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

function EffectModal({
  sceneId,
  effect,
  panels,
  prefillPanelId,
  prefillStartTime,
  onClose,
}: {
  sceneId: Id<"scenes">;
  effect?: EffectRow;
  panels: { panel: Panel; label: string }[];
  prefillPanelId?: Id<"panels">;
  prefillStartTime?: number;
  onClose: () => void;
}) {
  const createEffect = useMutation(api.designer.createEffect);
  const updateEffect = useMutation(api.designer.updateEffect);
  const logicalTypes = useQuery(api.designer.listLogicalPanelTypes);
  const [panelId, setPanelId] = useState<string>(
    effect?.sourcePanelId ?? effect?.panelId ?? prefillPanelId ?? panels[0]?.panel._id ?? "",
  );
  const [logicalPanelName, setLogicalPanelName] = useState(
    effect?.logicalPanelName ?? "",
  );
  const [kind, setKind] = useState<
    | "image"
    | "video"
    | "color"
    | "text"
    | "url"
    | "html"
    | "command"
    | "hotkey"
    | "filter"
    | "camera"
  >(effect?.kind ?? (panels.length === 0 ? "command" : "color"));
  const [content, setContent] = useState(
    effect?.content ?? (panels.length === 0 ? "" : "#dc2626"),
  );
  const [startTime, setStartTime] = useState(
    String(effect?.startTime ?? prefillStartTime ?? 0),
  );
  const [durationVal, setDurationVal] = useState(
    effect?.durationSec !== undefined ? String(effect.durationSec) : "",
  );
  const [videoStartVal, setVideoStartVal] = useState(
    effect?.videoStartSec !== undefined ? String(effect.videoStartSec) : "",
  );
  const [isEnabled, setIsEnabled] = useState(effect?.isEnabled ?? true);

  const filterCueError = (() => {
    if (kind !== "filter") return null;
    const parsed = parseFilterCue(content);
    return parsed.ok ? null : parsed.error;
  })();

  const save = async () => {
    const cueOnly = isCueEffect(kind);
    if (!cueOnly && !panelId) return;
    if (filterCueError) return;
    const durNum = durationVal.trim() ? Math.max(0.5, Number(durationVal)) : undefined;
    const videoStartNum = videoStartVal.trim()
      ? Math.max(0, Number(videoStartVal) || 0)
      : undefined;
    const logical = cueOnly ? "" : logicalPanelName.trim();
    const args = {
      ...(!cueOnly && panelId
        ? { panelId: panelId as Id<"panels"> }
        : {}),
      kind,
      content,
      startTime: Math.max(0, Number(startTime) || 0),
      durationSec: cueOnly ? undefined : durNum,
      videoStartSec: kind === "video" ? videoStartNum : undefined,
      logicalPanelName: logical ? logical : null,
    };
    if (effect) {
      await updateEffect({ effectId: effect._id, ...args, isEnabled });
    } else {
      await createEffect({
        sceneId,
        kind: args.kind,
        content: args.content,
        startTime: args.startTime,
        durationSec: args.durationSec,
        ...(args.panelId ? { panelId: args.panelId } : {}),
        ...(args.videoStartSec !== undefined
          ? { videoStartSec: args.videoStartSec }
          : {}),
        ...(logical ? { logicalPanelName: logical } : {}),
      });
    }
    onClose();
  };

  return (
    <Modal title={effect ? "Edit effect" : "New effect"} onClose={onClose}>
      <div className="space-y-3">
        {!isCueEffect(kind) && (
          <>
            <Field label="Panel (fallback)">
              <select
                className={inputCls}
                value={panelId}
                onChange={(e) => setPanelId(e.target.value)}
              >
                {panels.map(({ panel, label }) => (
                  <option key={panel._id} value={panel._id}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Logical panel (optional)">
              <select
                className={inputCls}
                value={logicalPanelName}
                onChange={(e) => setLogicalPanelName(e.target.value)}
              >
                <option value="">(none — use physical panel)</option>
                {(logicalTypes ?? []).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                {logicalPanelName &&
                  !(logicalTypes ?? []).some((n) => n === logicalPanelName) && (
                    <option value={logicalPanelName}>{logicalPanelName}</option>
                  )}
              </select>
            </Field>
          </>
        )}
        <Field label="Type">
          <select
            className={inputCls}
            value={kind}
            onChange={(e) => {
              const k = e.target.value as typeof kind;
              setKind(k);
              if (k === "color" && !content.startsWith("#")) setContent("#dc2626");
              if (isCueEffect(k) && content.startsWith("#")) setContent("");
            }}
          >
            <option value="color">Color</option>
            <option value="image">Image URL</option>
            <option value="video">Video URL</option>
            <option value="text">Text</option>
            <option value="url">Page URL (score / vote iframe)</option>
            <option value="html">HTML</option>
            <option value="command">Switcher command (RossTalk)</option>
            <option value="hotkey">Laptop hotkey (Snap Camera)</option>
            <option value="filter">Camera filter cue (capture page / Snap)</option>
            <option value="camera">Remote camera (Head subscribe)</option>
          </select>
        </Field>
        <Field
          label={
            kind === "color"
              ? "Color"
              : kind === "text"
                ? "Text"
                : kind === "html"
                  ? "HTML"
                  : kind === "url"
                    ? "Page URL ({performanceId} allowed)"
                    : kind === "command"
                      ? "Command"
                      : kind === "hotkey"
                        ? "Hotkey"
                        : kind === "filter"
                          ? "Filter cue"
                      : `${kind[0].toUpperCase() + kind.slice(1)} URL`
          }
        >
          {kind === "color" ? (
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(content) ? content : "#dc2626"}
                onChange={(e) => setContent(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300"
              />
              <input
                className={inputCls}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          ) : (
            <input
              className={inputCls}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                kind === "text"
                  ? "Merry Christmas"
                  : kind === "command"
                    ? "XPT AUX:2:IN:6"
                    : kind === "hotkey"
                      ? "ctrl+alt+1"
                      : kind === "filter"
                        ? "invert · flash bsod 800 · seq invert,pixelate,spin 2000 · clear"
                    : "https://…"
              }
            />
          )}
        </Field>
        {kind === "command" && (
          <p className="text-xs text-gray-500">
            Examples: XPT AUX:2:IN:6 · CC 1:05 · MEAUTO ME:1
          </p>
        )}
        {kind === "hotkey" && (
          <p className="text-xs text-gray-500">
            Sent only to the laptop agent. Example: ctrl+alt+1 (Snap favourite
            slot 1). Avoid plain ctrl+digit: Chrome uses it to switch tabs.
          </p>
        )}
        {kind === "filter" && (
          <div className="space-y-1 text-xs text-gray-500">
            {filterCueError ? (
              <p className="text-red-600">{filterCueError}</p>
            ) : (
              <p className="text-emerald-700">{describeFilterCue(content)}</p>
            )}
            <p>
              Runs on the capture page:{" "}
              {FILTER_CATALOG.filter((f) => f.executor.kind === "canvas")
                .map((f) => f.name)
                .join(", ")}
              . Snap lenses: snap-1 … snap-{SNAP_SLOT_COUNT} (sent as the
              matching ctrl+alt hotkey).
            </p>
            <p>
              Verbs: <code>set</code> (default), <code>flash &lt;name&gt; [ms]</code>,{" "}
              <code>seq a,b,c [ms]</code>, <code>clear</code>.
            </p>
          </div>
        )}
        {!isCueEffect(kind) && (
          <>
            <Field label="Start time (seconds into scene)">
              <input
                className={inputCls}
                type="number"
                min={0}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </Field>
            <Field label="Duration (seconds, blank = to end of scene)">
              <input
                className={inputCls}
                type="number"
                min={0.5}
                step={0.5}
                value={durationVal}
                onChange={(e) => setDurationVal(e.target.value)}
                placeholder="blank = to end"
              />
            </Field>
          </>
        )}
        {kind === "video" && (
          <Field label="Video start (seconds into media)">
            <input
              className={inputCls}
              type="number"
              min={0}
              step={1}
              value={videoStartVal}
              onChange={(e) => setVideoStartVal(e.target.value)}
              placeholder="0 = from beginning"
            />
          </Field>
        )}
        {effect && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
            />
            Enabled
          </label>
        )}
        <button
          onClick={save}
          className="w-full rounded-md bg-brand py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

// -------------------------------------------------------------- screens tab

export const PANEL_FILLS = [
  "#f87171",
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#f472b6",
  "#38bdf8",
  "#fb923c",
];

function ScreensTab() {
  const { userId } = useCurrentUser();
  const layouts = useQuery(api.designer.listLayouts);
  const [selectedLayoutId, setSelectedLayoutId] = useState<Id<"layouts"> | null>(null);
  const [selectedScreenId, setSelectedScreenId] = useState<Id<"screens"> | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<Id<"panels"> | null>(null);

  const layoutDoc =
    layouts?.find((l) => l._id === selectedLayoutId) ?? layouts?.[0] ?? null;
  const layout = useQuery(
    api.designer.getLayout,
    layoutDoc ? { layoutId: layoutDoc._id } : "skip",
  );

  const createLayout = useMutation(api.designer.createLayout);
  const updateLayout = useMutation(api.designer.updateLayout);
  const deleteLayout = useMutation(api.designer.deleteLayout);
  const createScreen = useMutation(api.designer.createScreen);
  const updateScreen = useMutation(api.designer.updateScreen);
  const deleteScreen = useMutation(api.designer.deleteScreen);
  const createPanel = useMutation(api.designer.createPanel);
  const updatePanel = useMutation(api.designer.updatePanel);
  const deletePanel = useMutation(api.designer.deletePanel);

  if (layouts === undefined) return <Loading />;

  const screens = layout?.screens ?? [];
  const screen =
    screens.find((s) => s._id === selectedScreenId) ?? screens[0] ?? null;
  const panel =
    screen?.panels.find((p) => p._id === selectedPanelId) ?? null;

  const prompt = (label: string, current = "") => {
    const value = window.prompt(label, current);
    return value?.trim() ? value.trim() : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row">
        <Column
          title="Layout"
          onAdd={
            userId
              ? async () => {
                  const name = prompt("Layout name");
                  if (name) await createLayout({ name, ownerId: userId });
                }
              : undefined
          }
        >
          {layouts.length === 0 && (
            <p className="p-3 text-xs text-gray-400">No layouts yet — add one.</p>
          )}
          {layouts.map((l) => (
            <Row
              key={l._id}
              selected={layoutDoc?._id === l._id}
              onSelect={() => {
                setSelectedLayoutId(l._id);
                setSelectedScreenId(null);
                setSelectedPanelId(null);
              }}
              onEdit={async () => {
                const name = prompt("Layout name", l.name);
                if (name) await updateLayout({ layoutId: l._id, name });
              }}
              onDelete={() => deleteLayout({ layoutId: l._id })}
            >
              <span className="font-medium">{l.name}</span>
            </Row>
          ))}
        </Column>

        <Column
          title="Screen"
          onAdd={
            layoutDoc
              ? async () => {
                  const name = prompt("Screen name");
                  if (name)
                    await createScreen({ layoutId: layoutDoc._id, name });
                }
              : undefined
          }
        >
          {!layoutDoc && (
            <p className="p-3 text-xs text-gray-400">Select a layout.</p>
          )}
          {screens.map((s) => (
            <Row
              key={s._id}
              selected={screen?._id === s._id}
              onSelect={() => {
                setSelectedScreenId(s._id);
                setSelectedPanelId(null);
              }}
              onEdit={async () => {
                const name = prompt("Screen name", s.name);
                if (name) await updateScreen({ screenId: s._id, name });
              }}
              onDelete={() => deleteScreen({ screenId: s._id })}
            >
              <span className="font-medium">{s.name}</span>
              <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">
                {screenRoleOf(s)}
              </span>
            </Row>
          ))}
        </Column>

        <Column
          title="Panel"
          onAdd={
            screen
              ? async () => {
                  const name = prompt("Panel name");
                  if (name) await createPanel({ screenId: screen._id, name });
                }
              : undefined
          }
        >
          {!screen && (
            <p className="p-3 text-xs text-gray-400">Select a screen.</p>
          )}
          {screen?.panels.map((p, i) => (
            <Row
              key={p._id}
              selected={panel?._id === p._id}
              onSelect={() => setSelectedPanelId(p._id)}
              onEdit={async () => {
                const name = prompt("Panel name", p.name);
                if (name) await updatePanel({ panelId: p._id, name });
              }}
              onDelete={() => deletePanel({ panelId: p._id })}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: PANEL_FILLS[i % PANEL_FILLS.length] }}
                />
                <span className="truncate">{p.name}</span>
                <span className="ml-auto text-xs text-gray-400">
                  {p.points.length} pts
                </span>
              </div>
            </Row>
          ))}
        </Column>
      </div>

      {screen ? (
        <label className="flex items-center gap-2 text-xs text-gray-600">
          Role
          <select
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={screenRoleOf(screen)}
            onChange={(e) =>
              void updateScreen({
                screenId: screen._id,
                role: e.target.value as ScreenRole,
              })
            }
          >
            {SCREEN_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <span className="text-gray-400">
            Tablets play the show unless ordering. Ticket = bar board.
          </span>
        </label>
      ) : null}

      {screen ? (
        <PanelEditor
          key={screen._id}
          screen={screen}
          selectedPanelId={panel?._id ?? null}
          onSelectPanel={setSelectedPanelId}
          onSavePoints={(panelId, points) => updatePanel({ panelId, points })}
          onUpdatePanel={updatePanel}
        />
      ) : (
        <EmptyState
          title="No screen selected"
          hint="Create a layout and a screen, then add panels and drag their corners into place."
        />
      )}
    </div>
  );
}

/** SVG polygon editor: click a panel to select it, drag its corners to reshape.
 *  Includes nudge controls, keyboard arrows, snap-to-grid, and z-index controls.
 */
function PanelEditor({
  screen,
  selectedPanelId,
  onSelectPanel,
  onSavePoints,
  onUpdatePanel,
}: {
  screen: Screen;
  selectedPanelId: Id<"panels"> | null;
  onSelectPanel: (id: Id<"panels">) => void;
  onSavePoints: (panelId: Id<"panels">, points: Point[]) => void;
  onUpdatePanel: (args: {
    panelId: Id<"panels">;
    points?: Point[];
    zIndex?: number;
    name?: string;
  }) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Local override while dragging, keyed by panel id.
  const [draftPoints, setDraftPoints] = useState<Record<string, Point[]>>({});
  const dragRef = useRef<{ panelId: Id<"panels">; pointIndex: number } | null>(null);

  // Nudge state
  const [moveMode, setMoveMode] = useState<"panel" | "point" | "side">("panel");
  const [pointIndex, setPointIndex] = useState(0);
  const [step, setStep] = useState(5);
  const [snapToGrid, setSnapToGrid] = useState(false);

  const snapVal = (v: number) => (snapToGrid ? Math.round(v / 10) * 10 : v);

  const toSvgCoords = (e: { clientX: number; clientY: number }): Point => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * screen.width),
      y: Math.round(((e.clientY - rect.top) / rect.height) * screen.height),
    };
  };

  const pointsOf = (panel: Panel) => draftPoints[panel._id] ?? panel.points;

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pos = toSvgCoords(e);
    pos.x = Math.max(0, Math.min(screen.width, snapVal(pos.x)));
    pos.y = Math.max(0, Math.min(screen.height, snapVal(pos.y)));
    setDraftPoints((prev) => {
      const panel = screen.panels.find((p) => p._id === drag.panelId);
      if (!panel) return prev;
      const pts = [...(prev[drag.panelId] ?? panel.points)];
      pts[drag.pointIndex] = pos;
      return { ...prev, [drag.panelId]: pts };
    });
  };

  const endDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const pts = draftPoints[drag.panelId];
    if (pts) onSavePoints(drag.panelId, pts);
  };

  const selected = screen.panels.find((p) => p._id === selectedPanelId);

  const addPoint = () => {
    if (!selected || selected.points.length >= 5) return;
    const pts = pointsOf(selected);
    const a = pts[pts.length - 1];
    const b = pts[0];
    const mid = { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) };
    onSavePoints(selected._id, [...pts, mid]);
  };

  const removePoint = () => {
    if (!selected || selected.points.length <= 3) return;
    onSavePoints(selected._id, pointsOf(selected).slice(0, -1));
  };

  // Nudge function
  const nudge = (dx: number, dy: number) => {
    if (!selected) return;
    const n = selected.points.length;
    const moving =
      moveMode === "panel"
        ? selected.points.map((_, i) => i)
        : moveMode === "point"
          ? [Math.min(pointIndex, n - 1)]
          : [Math.min(pointIndex, n - 1), (Math.min(pointIndex, n - 1) + 1) % n];
    const points = selected.points.map((p, i) =>
      moving.includes(i)
        ? {
            x: Math.max(0, Math.min(screen.width, snapVal(p.x + dx))),
            y: Math.max(0, Math.min(screen.height, snapVal(p.y + dy))),
          }
        : p,
    );
    onSavePoints(selected._id, points);
  };

  // Keyboard arrow support
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as Element)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          nudge(0, -step); break;
        case "ArrowDown":
          e.preventDefault();
          nudge(0, step); break;
        case "ArrowLeft":
          e.preventDefault();
          nudge(-step, 0); break;
        case "ArrowRight":
          e.preventDefault();
          nudge(step, 0); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, step, moveMode, pointIndex, snapToGrid]);

  // Z-index controls
  const bringForward = () => {
    if (!selected) return;
    onUpdatePanel({ panelId: selected._id, zIndex: selected.zIndex + 1 });
  };
  const sendBackward = () => {
    if (!selected) return;
    onUpdatePanel({ panelId: selected._id, zIndex: Math.max(0, selected.zIndex - 1) });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 bg-gray-900 px-3 py-2">
        <span className="text-sm font-semibold text-white">
          {screen.name} — panel editor
        </span>
        <span className="text-xs text-gray-400">
          drag the corner handles to reshape panels
        </span>
        {selected && (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-300">{selected.name}</span>
            <button
              onClick={addPoint}
              disabled={selected.points.length >= 5}
              className="rounded bg-gray-700 px-2 py-0.5 text-xs text-white disabled:opacity-40"
            >
              + point
            </button>
            <button
              onClick={removePoint}
              disabled={selected.points.length <= 3}
              className="rounded bg-gray-700 px-2 py-0.5 text-xs text-white disabled:opacity-40"
            >
              − point
            </button>
          </span>
        )}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${screen.width} ${screen.height}`}
        className="w-full touch-none select-none bg-gray-950"
        style={{ aspectRatio: `${screen.width} / ${screen.height}` }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        tabIndex={0}
      >
        {screen.panels.map((p, i) => {
          const pts = pointsOf(p);
          const isSel = p._id === selectedPanelId;
          const fill = PANEL_FILLS[i % PANEL_FILLS.length];
          const box = bbox(pts);
          return (
            <g key={p._id}>
              <polygon
                points={pts.map((pt) => `${pt.x},${pt.y}`).join(" ")}
                fill={fill}
                fillOpacity={isSel ? 0.75 : 0.35}
                stroke={isSel ? "#fff" : fill}
                strokeWidth={isSel ? 3 : 1.5}
                className="cursor-pointer"
                onClick={() => onSelectPanel(p._id)}
              />
              <text
                x={box.minX + box.w / 2}
                y={box.minY + box.h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize={Math.max(12, screen.width / 55)}
                className="pointer-events-none font-sans"
              >
                {p.name}
              </text>
              {isSel &&
                pts.map((pt, pi) => (
                  <g key={pi}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={screen.width / 70}
                      fill={pi === pointIndex && moveMode !== "panel" ? "#22c55e" : "#fff"}
                      stroke="#111827"
                      strokeWidth={2}
                      className="cursor-grab"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        (e.target as Element).setPointerCapture?.(e.pointerId);
                        dragRef.current = { panelId: p._id, pointIndex: pi };
                      }}
                    />
                    {moveMode !== "panel" && (
                      <text
                        x={pt.x}
                        y={pt.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#111827"
                        fontSize={screen.width / 90}
                        fontWeight="bold"
                        className="pointer-events-none"
                      >
                        {pi + 1}
                      </text>
                    )}
                  </g>
                ))}
            </g>
          );
        })}
      </svg>

      {/* Nudge controls + snap + z-index */}
      {selected && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Move mode radios */}
            <div className="flex items-center gap-2">
              {(["panel", "point", "side"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setMoveMode(t)}
                  className={
                    "rounded-full px-3 py-1 text-xs font-semibold capitalize " +
                    (moveMode === t
                      ? "bg-brand text-white"
                      : "border border-gray-300 text-gray-600")
                  }
                >
                  Move {t === "panel" ? "entire panel" : t}
                </button>
              ))}
            </div>

            {/* Snap to grid */}
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <input
                type="checkbox"
                checked={snapToGrid}
                onChange={(e) => setSnapToGrid(e.target.checked)}
                className="accent-brand"
              />
              Snap to 10px grid
            </label>

            {/* Z-index controls */}
            <div className="ml-auto flex items-center gap-1">
              <span className="text-xs text-gray-400">z: {selected.zIndex}</span>
              <button
                onClick={bringForward}
                className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                title="Bring forward"
              >
                ↑ Forward
              </button>
              <button
                onClick={sendBackward}
                className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                title="Send backward"
              >
                ↓ Backward
              </button>
            </div>
          </div>

          {/* Point/side selector */}
          {moveMode !== "panel" && (
            <div className="mt-3 flex items-center gap-1">
              <span className="mr-1 text-xs text-gray-400">
                {moveMode === "point" ? "Corner" : "Side from corner"}:
              </span>
              {selected.points.map((_, i) => (
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

          {/* Arrow grid + step selector */}
          <div className="mt-3 flex items-center justify-center gap-6">
            <div className="grid grid-cols-3 gap-1">
              <span />
              <button
                onClick={() => nudge(0, -step)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-lg text-gray-700 hover:bg-gray-100 active:bg-brand-light"
              >
                ↑
              </button>
              <span />
              <button
                onClick={() => nudge(-step, 0)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-lg text-gray-700 hover:bg-gray-100 active:bg-brand-light"
              >
                ←
              </button>
              <span className="flex h-10 w-10 items-center justify-center text-xs text-gray-300">
                {step}px
              </span>
              <button
                onClick={() => nudge(step, 0)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-lg text-gray-700 hover:bg-gray-100 active:bg-brand-light"
              >
                →
              </button>
              <span />
              <button
                onClick={() => nudge(0, step)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-lg text-gray-700 hover:bg-gray-100 active:bg-brand-light"
              >
                ↓
              </button>
              <span />
            </div>
            <div className="flex flex-col gap-1">
              {[1, 5, 20].map((s) => (
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
            Tip: keyboard arrows also nudge · {moveMode === "panel" ? "moves entire panel" : moveMode === "point" ? `moves corner ${pointIndex + 1}` : `moves side from corner ${pointIndex + 1}`}
          </p>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------- profiles tab

function ProfilesTab() {
  const { userId } = useCurrentUser();
  const shows = useQuery(api.shows.list, {});
  const layouts = useQuery(api.designer.listLayouts);
  const logicalTypes = useQuery(api.designer.listLogicalPanelTypes);

  const [selectedShowId, setSelectedShowId] = useState<Id<"shows"> | null>(null);
  const [selectedProfileId, setSelectedProfileId] =
    useState<Id<"displayProfiles"> | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [mapLogical, setMapLogical] = useState("");
  const [mapPanelId, setMapPanelId] = useState("");

  const show =
    shows?.find((s) => s._id === selectedShowId) ?? shows?.[0] ?? null;
  const profiles = useQuery(
    api.designer.listShowProfiles,
    show ? { showId: show._id } : "skip",
  );
  const profileId =
    selectedProfileId && profiles?.some((p) => p._id === selectedProfileId)
      ? selectedProfileId
      : profiles?.find((p) => p.isDefault)?._id ?? profiles?.[0]?._id ?? null;
  const profile = useQuery(
    api.designer.getDisplayProfile,
    profileId ? { profileId } : "skip",
  );

  const createProfile = useMutation(api.designer.createDisplayProfile);
  const updateProfile = useMutation(api.designer.updateDisplayProfile);
  const deleteProfile = useMutation(api.designer.deleteDisplayProfile);
  const setDefault = useMutation(api.designer.setDefaultDisplayProfile);
  const upsertMapping = useMutation(api.designer.upsertPanelMapping);
  const deleteMapping = useMutation(api.designer.deletePanelMapping);
  const autoMap = useMutation(api.designer.autoMapByPanelName);
  const applyEffects = useMutation(api.designer.applyProfileToShowEffects);

  if (shows === undefined || layouts === undefined) return <Loading />;

  const layoutPanels =
    profile?.screens.flatMap((s) =>
      s.panels.map((p) => ({
        panel: p,
        label: `${s.name} · ${p.name}`,
      })),
    ) ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Display profiles retarget a show&apos;s logical panels onto a physical
        layout — switching profiles remaps effects without deleting content.
      </p>

      <div className="flex flex-col gap-4 md:flex-row">
        <Column title="Show">
          {shows.length === 0 && (
            <p className="p-3 text-xs text-gray-400">No shows yet.</p>
          )}
          {shows.map((s) => (
            <Row
              key={s._id}
              selected={show?._id === s._id}
              onSelect={() => {
                setSelectedShowId(s._id);
                setSelectedProfileId(null);
              }}
            >
              <span className="font-medium">{s.title}</span>
            </Row>
          ))}
        </Column>

        <Column
          title="Profile"
          onAdd={
            show && userId ? () => setCreateOpen(true) : undefined
          }
        >
          {!show && (
            <p className="p-3 text-xs text-gray-400">Select a show.</p>
          )}
          {profiles?.map((p) => (
            <Row
              key={p._id}
              selected={profileId === p._id}
              onSelect={() => setSelectedProfileId(p._id)}
              onEdit={async () => {
                const name = window.prompt("Profile name", p.name);
                if (name?.trim()) {
                  await updateProfile({
                    profileId: p._id,
                    name: name.trim(),
                  });
                }
              }}
              onDelete={async () => {
                if (window.confirm(`Delete profile “${p.name}”?`)) {
                  await deleteProfile({ profileId: p._id });
                  if (selectedProfileId === p._id) setSelectedProfileId(null);
                }
              }}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {p.name}
                  {p.isDefault ? (
                    <span className="ml-1 text-[10px] font-bold text-amber-600">
                      DEFAULT
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-gray-400">
                  {p.layoutName} · {p.mappingCount} mappings
                </p>
              </div>
            </Row>
          ))}
        </Column>

        <div className="min-w-0 flex-1 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          {!profile ? (
            <EmptyState
              title="No display profile"
              hint="Select a show and create a profile to map logical panels onto a layout."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {profile.name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Layout: {profile.layoutName}
                    {profile.description ? ` — ${profile.description}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!profile.isDefault && (
                    <button
                      onClick={() => setDefault({ profileId: profile._id })}
                      className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      const n = await autoMap({
                        displayProfileId: profile._id,
                      });
                      window.alert(`Mapped ${n} panel(s) by name.`);
                    }}
                    className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Auto-map
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Write resolved panel IDs onto this show’s effects? Panels are not deleted.",
                        )
                      )
                        return;
                      const n = await applyEffects({
                        showId: profile.showId,
                        displayProfileId: profile._id,
                      });
                      window.alert(`Updated ${n} effect(s).`);
                    }}
                    className="rounded bg-brand px-2 py-1 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Apply to effects
                  </button>
                </div>
              </div>

              <Field label="Layout">
                <select
                  className={inputCls}
                  value={profile.layoutId}
                  onChange={(e) =>
                    updateProfile({
                      profileId: profile._id,
                      layoutId: e.target.value as Id<"layouts">,
                    })
                  }
                >
                  {layouts.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Panel mappings
                </h3>
                {profile.mappings.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No mappings yet — use Auto-map or add one below.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-md border border-gray-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-3 py-2">Logical</th>
                          <th className="px-3 py-2">Physical</th>
                          <th className="px-3 py-2">Screen</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {profile.mappings.map((m) => (
                          <tr key={m._id} className="border-t border-gray-100">
                            <td className="px-3 py-2 font-medium">
                              {m.logicalPanelName}
                            </td>
                            <td className="px-3 py-2">{m.panelName}</td>
                            <td className="px-3 py-2 text-gray-500">
                              {m.screenName}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() =>
                                  deleteMapping({ mappingId: m._id })
                                }
                                className="text-xs text-red-500 hover:underline"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-gray-300 p-3">
                <div className="min-w-[10rem] flex-1">
                  <Field label="Logical panel">
                    <select
                      className={inputCls}
                      value={mapLogical}
                      onChange={(e) => setMapLogical(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {(logicalTypes ?? []).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="min-w-[12rem] flex-1">
                  <Field label="Physical panel">
                    <select
                      className={inputCls}
                      value={mapPanelId}
                      onChange={(e) => setMapPanelId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {layoutPanels.map(({ panel, label }) => (
                        <option key={panel._id} value={panel._id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <button
                  disabled={!mapLogical || !mapPanelId}
                  onClick={async () => {
                    await upsertMapping({
                      displayProfileId: profile._id,
                      logicalPanelName: mapLogical,
                      panelId: mapPanelId as Id<"panels">,
                    });
                    setMapLogical("");
                    setMapPanelId("");
                  }}
                  className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
                >
                  Add mapping
                </button>
              </div>

              {profile.screens.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Layout preview
                  </h3>
                  <div
                    className={
                      profile.screens.length > 1
                        ? "grid gap-2 sm:grid-cols-2"
                        : "grid gap-2"
                    }
                  >
                    {profile.screens.map((s) => (
                      <div key={s._id}>
                        {profile.screens.length > 1 && (
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            {s.name}
                          </p>
                        )}
                        <PanelStage screen={s} effects={[]} clockSec={0} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {createOpen && show && userId && (
        <ProfileCreateModal
          layouts={layouts}
          defaultLayoutId={show.layoutId ?? layouts[0]?._id}
          onClose={() => setCreateOpen(false)}
          onSave={async ({ name, layoutId, isDefault, description }) => {
            const id = await createProfile({
              showId: show._id,
              layoutId,
              name,
              description: description || undefined,
              isDefault,
              ownerId: userId,
            });
            setSelectedProfileId(id);
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ProfileCreateModal({
  layouts,
  defaultLayoutId,
  onClose,
  onSave,
}: {
  layouts: Doc<"layouts">[];
  defaultLayoutId?: Id<"layouts">;
  onClose: () => void;
  onSave: (args: {
    name: string;
    layoutId: Id<"layouts">;
    isDefault: boolean;
    description: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [layoutId, setLayoutId] = useState<string>(
    defaultLayoutId ?? layouts[0]?._id ?? "",
  );
  const [isDefault, setIsDefault] = useState(true);

  return (
    <Modal title="New display profile" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Living Room"
            autoFocus
          />
        </Field>
        <Field label="Description">
          <input
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="Layout">
          <select
            className={inputCls}
            value={layoutId}
            onChange={(e) => setLayoutId(e.target.value)}
          >
            {layouts.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          Default profile for this show
        </label>
        <button
          disabled={!name.trim() || !layoutId}
          onClick={() =>
            onSave({
              name: name.trim(),
              layoutId: layoutId as Id<"layouts">,
              isDefault,
              description,
            })
          }
          className="w-full rounded-md bg-brand py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          Create profile
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- designer

export function ShowDesigner() {
  const [tab, setTab] = useState<"shows" | "screens" | "profiles">("shows");

  return (
    <div>
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Designer</h1>
      </div>
      <div className="mt-4 flex gap-1 border-b border-gray-200">
        {(["shows", "screens", "profiles"] as const).map((t) => (
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
        {tab === "shows" ? (
          <ShowsTab />
        ) : tab === "screens" ? (
          <ScreensTab />
        ) : (
          <ProfilesTab />
        )}
      </div>
    </div>
  );
}
