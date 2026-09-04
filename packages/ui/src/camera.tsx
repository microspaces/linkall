"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";
import {
  canvasFilterNames,
  parseFilterCue,
} from "@linkall/backend/convex/filterCues";
import { FilterEngine } from "./camera-filters";

const STUN = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const CANVAS_FPS = 30;
const FALLBACK_SIZE = { width: 1280, height: 720 };

type VideoFrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

function clientId() {
  if (typeof window === "undefined") return "ssr";
  const key = "linkall.cameraClientId";
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(key, id);
  }
  return id;
}



/**
 * Laptop / iOS capture page. The only place getUserMedia runs.
 *
 * Pipeline: getUserMedia → <video> (hidden) → <canvas> filter pass →
 * canvas.captureStream() → WebRTC. Publishing from the canvas even when no
 * filter is active means cues never renegotiate the peer connection.
 * Screens and Preview subscribe and see whatever the canvas shows.
 *
 * Face-tracked lenses still come from Snap Camera (select it as the device);
 * `filter` cues that resolve to Snap slots arrive here as hotkey rows for
 * visibility only — the laptop agent sends the keystroke.
 */
export function CameraCapture() {
  const screens = useQuery(api.designer.listScreens, {});
  const list = screens ?? [];
  const headFirst = [...list].sort((a, b) => {
    const ah = a.name.toLowerCase() === "head" ? 0 : 1;
    const bh = b.name.toLowerCase() === "head" ? 0 : 1;
    return ah - bh || a.name.localeCompare(b.name);
  });

  const [screenId, setScreenId] = useState<Id<"screens"> | "">("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Raw camera stream (stopped on Stop). */
  const rawRef = useRef<MediaStream | null>(null);
  /** Published stream: canvas.captureStream(). */
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<FilterEngine | null>(null);
  const frameHandle = useRef<{ kind: "rvfc" | "raf"; id: number } | null>(null);
  const liveAt = useRef(0);
  const inflightFilters = useRef(new Set<string>());
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const myId = useRef(clientId());

  const heartbeat = useMutation(api.camera.heartbeat);
  const leave = useMutation(api.camera.leave);
  const sendSignal = useMutation(api.camera.sendSignal);
  const ackSignals = useMutation(api.camera.ackSignals);
  const completeHotkey = useMutation(api.sceneCommands.completeHotkeyCommand);
  const completeFilter = useMutation(api.sceneCommands.completeFilterCommand);
  const skipStaleFilters = useMutation(api.sceneCommands.skipStaleFilterCommands);

  const peers = useQuery(
    api.camera.peers,
    screenId ? { screenId } : "skip",
  );
  const signals = useQuery(
    api.camera.signalsFor,
    screenId && live ? { screenId, clientId: myId.current } : "skip",
  );
  const hotkeys = useQuery(
    api.sceneCommands.pendingHotkeyCommands,
    live ? {} : "skip",
  );
  const filterCommands = useQuery(
    api.sceneCommands.pendingFilterCommands,
    live ? {} : "skip",
  );

  useEffect(() => {
    if (!screenId && headFirst[0]) setScreenId(headFirst[0]._id);
  }, [headFirst, screenId]);

  // Execute filter cues locally. Rows queued before this page went live are
  // stale (already skipped server-side on start; guarded here too).
  useEffect(() => {
    if (!live || !filterCommands?.length) return;
    const engine = engineRef.current;
    if (!engine) return;
    for (const row of filterCommands) {
      if (inflightFilters.current.has(row._id)) continue;
      inflightFilters.current.add(row._id);
      if (row.createdAt < liveAt.current) {
        void completeFilter({ id: row._id, error: "skipped: stale" }).finally(
          () => inflightFilters.current.delete(row._id),
        );
        continue;
      }
      const parsed = parseFilterCue(row.cue);
      if (!parsed.ok) {
        void completeFilter({ id: row._id, error: parsed.error }).finally(() =>
          inflightFilters.current.delete(row._id),
        );
        continue;
      }
      engine.apply(parsed.cue);
      void completeFilter({ id: row._id }).finally(() =>
        inflightFilters.current.delete(row._id),
      );
    }
  }, [live, filterCommands, completeFilter]);

  useEffect(() => {
    if (!live || !screenId) return;
    const id = myId.current;
    const tick = () => void heartbeat({ screenId, clientId: id, role: "publisher" });
    tick();
    const t = setInterval(tick, 4000);
    return () => {
      clearInterval(t);
      void leave({ screenId, clientId: id });
    };
  }, [live, screenId, heartbeat, leave]);

  useEffect(() => {
    if (!live || !screenId || !peers) return;
    const stream = streamRef.current;
    if (!stream) return;
    const subs = peers.filter(
      (p) => p.role === "subscriber" && p.clientId !== myId.current,
    );
    for (const sub of subs) {
      if (pcs.current.has(sub.clientId)) continue;
      const pc = new RTCPeerConnection(STUN);
      pcs.current.set(sub.clientId, pc);
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        void sendSignal({
          screenId,
          fromClientId: myId.current,
          toClientId: sub.clientId,
          kind: "ice",
          payload: JSON.stringify(ev.candidate),
        });
      };
      void pc.createOffer().then(async (offer) => {
        await pc.setLocalDescription(offer);
        await sendSignal({
          screenId,
          fromClientId: myId.current,
          toClientId: sub.clientId,
          kind: "offer",
          payload: JSON.stringify(offer),
        });
      });
    }
    for (const [id, pc] of pcs.current) {
      if (!subs.some((s) => s.clientId === id)) {
        pc.close();
        pcs.current.delete(id);
      }
    }
  }, [live, screenId, peers, sendSignal]);

  useEffect(() => {
    if (!signals?.length || !screenId) return;
    const ids = signals.map((s) => s._id);
    void (async () => {
      for (const sig of signals) {
        const pc = pcs.current.get(sig.fromClientId);
        if (!pc) continue;
        try {
          if (sig.kind === "answer") {
            const desc = JSON.parse(sig.payload) as RTCSessionDescriptionInit;
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(desc);
            }
          } else if (sig.kind === "ice") {
            await pc.addIceCandidate(JSON.parse(sig.payload) as RTCIceCandidateInit);
          }
        } catch {
          /* ignore stale */
        }
      }
      await ackSignals({ ids });
    })();
  }, [signals, screenId, ackSignals]);

  useEffect(() => {
    return () => {
      for (const pc of pcs.current.values()) pc.close();
      pcs.current.clear();
      stopFrameLoop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      rawRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const latestHotkey = (hotkeys ?? [])[0];

  function stopFrameLoop() {
    const h = frameHandle.current;
    const video = localVideo.current as VideoFrameCallbackVideo | null;
    if (h?.kind === "rvfc") video?.cancelVideoFrameCallback?.(h.id);
    if (h?.kind === "raf") cancelAnimationFrame(h.id);
    frameHandle.current = null;
  }

  /**
   * Draw loop. Prefers requestVideoFrameCallback (frame-aligned, cheaper than
   * rAF). Either way this stops when the tab is hidden, so the capture tab
   * must stay foreground on the show laptop.
   */
  function startFrameLoop() {
    const video = localVideo.current as VideoFrameCallbackVideo | null;
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!video || !canvas || !engine) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let lastShown: string | null = null;
    const tick = () => {
      // stopFrameLoop() cancels and nulls the handle; bail if it raced us.
      if (!frameHandle.current) return;
      const now = performance.now();
      engine.render(ctx, video, canvas.width, canvas.height, now);
      const shown = engine.active(now);
      if (shown !== lastShown) {
        lastShown = shown;
        setActiveFilter(shown);
      }
      schedule();
    };
    const schedule = () => {
      if (video.requestVideoFrameCallback) {
        frameHandle.current = { kind: "rvfc", id: video.requestVideoFrameCallback(tick) };
      } else {
        frameHandle.current = { kind: "raf", id: requestAnimationFrame(tick) };
      }
    };
    stopFrameLoop();
    schedule();
  }

  async function start() {
    setError(null);
    try {
      const raw = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" },
      });
      rawRef.current = raw;
      const video = localVideo.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) throw new Error("Capture elements not mounted.");
      video.srcObject = raw;
      await video.play().catch(() => {
        /* autoplay policies: muted video should still start */
      });
      const settings = raw.getVideoTracks()[0]?.getSettings();
      canvas.width = settings?.width || video.videoWidth || FALLBACK_SIZE.width;
      canvas.height = settings?.height || video.videoHeight || FALLBACK_SIZE.height;

      engineRef.current = new FilterEngine();
      // First frame before captureStream so subscribers never see an empty track.
      const ctx = canvas.getContext("2d");
      if (ctx) engineRef.current.render(ctx, video, canvas.width, canvas.height);
      streamRef.current = canvas.captureStream(CANVAS_FPS);
      startFrameLoop();

      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === "videoinput"));
      liveAt.current = Date.now();
      void skipStaleFilters({ before: liveAt.current });
      setLive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera permission denied.");
    }
  }

  function stop() {
    setLive(false);
    stopFrameLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    rawRef.current?.getTracks().forEach((t) => t.stop());
    rawRef.current = null;
    engineRef.current = null;
    setActiveFilter(null);
    if (localVideo.current) localVideo.current.srcObject = null;
    for (const pc of pcs.current.values()) pc.close();
    pcs.current.clear();
  }

  /** Operator preview buttons: same engine the cue queue drives. */
  function testFilter(cue: string) {
    const parsed = parseFilterCue(cue);
    if (!parsed.ok || !engineRef.current) return;
    engineRef.current.apply(parsed.cue);
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="text-sm font-bold">Camera</span>
        <span className="text-xs text-white/45">
          Laptop / iOS only — not the Head screen, not the phone console.
        </span>
      </header>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
        <label className="text-white/60">
          Publish to{" "}
          <select
            className="rounded bg-gray-800 px-2 py-1"
            value={screenId}
            disabled={live}
            onChange={(e) => setScreenId(e.target.value as Id<"screens">)}
          >
            {headFirst.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.width}×{s.height})
              </option>
            ))}
          </select>
        </label>
        <label className="text-white/60">
          Device{" "}
          <select
            className="rounded bg-gray-800 px-2 py-1"
            value={deviceId}
            disabled={live}
            onChange={(e) => setDeviceId(e.target.value)}
          >
            <option value="">Default (pick Snap Camera here for lenses)</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || d.deviceId.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        {live ? (
          <button
            type="button"
            className="rounded bg-red-600 px-3 py-1 font-semibold"
            onClick={stop}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="rounded bg-emerald-600 px-3 py-1 font-semibold"
            onClick={() => void start()}
          >
            Start
          </button>
        )}
        {error && <span className="text-red-400">{error}</span>}
      </div>
      {live && (
        <div className="flex flex-wrap items-center gap-1 px-3 pb-2 text-xs">
          <span className="mr-1 text-white/50">
            Filter:{" "}
            <span className="font-mono text-fuchsia-300">
              {activeFilter ?? "none"}
            </span>
          </span>
          {canvasFilterNames().map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => testFilter(name)}
              className={`rounded px-2 py-0.5 ${
                activeFilter === name
                  ? "bg-fuchsia-600 text-white"
                  : "bg-gray-800 text-white/80 hover:bg-gray-700"
              }`}
            >
              {name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => testFilter("clear")}
            className="rounded bg-gray-700 px-2 py-0.5 text-white/90 hover:bg-gray-600"
          >
            clear
          </button>
        </div>
      )}
      {latestHotkey && (
        <div className="mx-3 mb-2 rounded-lg border border-amber-400/60 bg-amber-500/20 px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200">
            Snap lens hotkey (sent by laptop agent)
          </p>
          <p className="mt-1 font-mono text-3xl font-black text-amber-100">
            {latestHotkey.hotkey}
          </p>
          <button
            type="button"
            className="mt-2 text-xs text-amber-200/80 underline"
            onClick={() => void completeHotkey({ id: latestHotkey._id })}
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="relative min-h-0 flex-1 bg-black p-3">
        {/* Hidden source. Kept in-flow (not display:none) so it keeps decoding. */}
        <video
          ref={localVideo}
          className="pointer-events-none absolute h-px w-px opacity-0"
          autoPlay
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          width={FALLBACK_SIZE.width}
          height={FALLBACK_SIZE.height}
          className="h-full w-full object-contain"
        />
        {!live && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-white/40">
            Press Start. The published feed is this canvas.
          </p>
        )}
      </div>
    </div>
  );
}

/** Head / Preview subscriber. Never calls getUserMedia. */
export function CameraSubscribe({ screenId }: { screenId: Id<"screens"> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const myId = useRef(clientId() + "-sub");
  const [hasTrack, setHasTrack] = useState(false);
  const heartbeat = useMutation(api.camera.heartbeat);
  const leave = useMutation(api.camera.leave);
  const sendSignal = useMutation(api.camera.sendSignal);
  const ackSignals = useMutation(api.camera.ackSignals);
  const signals = useQuery(api.camera.signalsFor, {
    screenId,
    clientId: myId.current,
  });

  useEffect(() => {
    const id = myId.current;
    setHasTrack(false);
    const tick = () =>
      void heartbeat({ screenId, clientId: id, role: "subscriber" });
    tick();
    const t = setInterval(tick, 4000);
    return () => {
      clearInterval(t);
      void leave({ screenId, clientId: id });
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [screenId, heartbeat, leave]);

  useEffect(() => {
    if (!signals?.length) return;
    const ids = signals.map((s) => s._id);
    void (async () => {
      for (const sig of signals) {
        try {
          if (sig.kind === "offer") {
            pcRef.current?.close();
            const pc = new RTCPeerConnection(STUN);
            pcRef.current = pc;
            pc.ontrack = (ev) => {
              setHasTrack(true);
              if (videoRef.current) videoRef.current.srcObject = ev.streams[0] ?? null;
            };
            pc.onicecandidate = (ev) => {
              if (!ev.candidate) return;
              void sendSignal({
                screenId,
                fromClientId: myId.current,
                toClientId: sig.fromClientId,
                kind: "ice",
                payload: JSON.stringify(ev.candidate),
              });
            };
            await pc.setRemoteDescription(
              JSON.parse(sig.payload) as RTCSessionDescriptionInit,
            );
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal({
              screenId,
              fromClientId: myId.current,
              toClientId: sig.fromClientId,
              kind: "answer",
              payload: JSON.stringify(answer),
            });
          } else if (sig.kind === "ice") {
            await pcRef.current?.addIceCandidate(
              JSON.parse(sig.payload) as RTCIceCandidateInit,
            );
          }
        } catch {
          /* ignore stale */
        }
      }
      await ackSignals({ ids });
    })();
  }, [signals, screenId, sendSignal, ackSignals]);

  return (
    <video
      ref={videoRef}
      className={
        hasTrack ? "h-full w-full object-cover" : "pointer-events-none h-full w-full opacity-0"
      }
      autoPlay
      playsInline
      muted
    />
  );
}
