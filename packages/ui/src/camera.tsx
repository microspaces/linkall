"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";


const STUN = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

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
 * Publishes to a screen (Head). Screens and Preview subscribe.
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
  const localVideo = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const myId = useRef(clientId());

  const heartbeat = useMutation(api.camera.heartbeat);
  const leave = useMutation(api.camera.leave);
  const sendSignal = useMutation(api.camera.sendSignal);
  const ackSignals = useMutation(api.camera.ackSignals);
  const completeHotkey = useMutation(api.sceneCommands.completeHotkeyCommand);

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

  useEffect(() => {
    if (!screenId && headFirst[0]) setScreenId(headFirst[0]._id);
  }, [headFirst, screenId]);

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
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const latestHotkey = (hotkeys ?? [])[0];

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" },
      });
      streamRef.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === "videoinput"));
      setLive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera permission denied.");
    }
  }

  function stop() {
    setLive(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    for (const pc of pcs.current.values()) pc.close();
    pcs.current.clear();
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
            <option value="">Default (pick Snap Camera here)</option>
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
      {latestHotkey && (
        <div className="mx-3 mb-2 rounded-lg border border-amber-400/60 bg-amber-500/20 px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200">
            Snap / hotkey
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
      <div className="min-h-0 flex-1 bg-black p-3">
        <video
          ref={localVideo}
          className="h-full w-full object-contain"
          autoPlay
          playsInline
          muted
        />
      </div>
    </div>
  );
}

/** Head / Preview subscriber. Never calls getUserMedia. */
export function CameraSubscribe({ screenId }: { screenId: Id<"screens"> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const myId = useRef(clientId() + "-sub");
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
      className="h-full w-full object-cover"
      autoPlay
      playsInline
      muted
    />
  );
}
