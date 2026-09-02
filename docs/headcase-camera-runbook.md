# HeadCase camera runbook

How the performer's face gets to the Head screen, how filters are cued, and
what to lock down on the show laptop.

## Pipeline

```
webcam ─► Snap Camera (virtual cam, lenses) ─► /camera capture page
            ▲ OS hotkeys                         getUserMedia → <canvas> filter pass
            │                                    canvas.captureStream() → WebRTC
   scripts/snap-hotkey-agent.mjs                          │
            ▲                                             ▼
   Convex hotkeyCommands                       Head / Preview (CameraSubscribe)
            ▲
   designer effect ─ kind `hotkey` or `filter` ─► Convex filterCommands ─► capture page
```

Two executors, one cue vocabulary:

| Executor | What it renders | Cued by |
|---|---|---|
| Snap Camera (desktop, kept alive by `ptrumpis/snap-camera-server`) | Face-tracked lenses built in Lens Studio | `hotkey` effect, or `filter` effect naming `snap-1` … `snap-9` |
| Capture page canvas (`packages/ui/src/camera-filters.ts`) | Whole-frame effects: invert, grayscale, sepia, pixelate, freeze, zoom, spin, mirror, bsod, buffering, bars, call | `filter` effect naming a canvas filter |

Bits and scenes only reference the cue. If the Snap engine is ever swapped,
change `packages/backend/convex/filterCues.ts`, not the show content.

## Filter cue grammar

Effect kind **Camera filter cue**, content is one of:

```
invert                      # same as `set invert`; sticky
set pixelate
flash bsod 800              # one-shot, back to previous after 800 ms (default 800)
seq invert,pixelate,spin 2000   # each for 2 s, then clear (canvas names only)
clear
snap-3                      # sends ctrl+alt+3 to Snap Camera via the agent
```

Priority when several are live: flash > seq > set. `clear` only affects canvas
filters; Snap has no "clear", so bind a plain "no lens" favourite to a slot.

Cues queued while no capture page is live are marked skipped when the page
starts, so reloading mid-show never replays a backlog onto the Head.

## Snap Camera on the show laptop

Snap shut the official servers down in January 2023. The app runs against a
local server: https://github.com/ptrumpis/snap-camera-server (Docker, hosts
redirect, self-signed cert, signature-patched binary). Follow its README and
the **Lens Creator Guide** wiki page for importing your own lenses.

Author lenses in **Lens Studio 4.36.1** (https://ar.snap.com/download/v4-36-1).
Snap Camera's engine is Camera Kit 1.21, which runs Lens Studio ≤ 4.43 natively;
5.x lenses need the unofficial `CoreResources.bundle` transplant and often
still fail. Archive the 4.36.1 installer somewhere you control.

### Hotkeys

Favourite each show lens in Snap Camera and bind it to **ctrl+alt+1 … ctrl+alt+9**
(`snapSlotHotkey` in `filterCues.ts`). Do not use plain ctrl+digit: the agent
sends keystrokes to whatever window has focus, and Chrome treats ctrl+1…9 as
"switch to tab". The seed migrates legacy `ctrl+N` effects automatically.

Slot count is limited, so plan a lens set per show, not per bit, and hand-cycle
inside "face-filter stack" bits as the tech notes already assume.

### Hardening

- Dedicated show laptop. Freeze OS updates (Windows 11 24H2 and macOS Sequoia
  have crash reports against Snap Camera). Image the disk once it works.
- Second laptop cloned from that image.
- Docker Desktop and `snap-camera-server` start at login; the hotkey agent runs
  as a startup task with `CONVEX_URL` set.
- Keep the `/camera` tab in the foreground. The canvas draw loop pauses when the
  tab is hidden, which freezes the published feed.
- Dedicated 1080p camera at fixed exposure and white balance. Front light on the
  performer: Snap's tracker and every other tracker need it.
- The Snap hotkey banner on `/camera` and the designer's Preview are the only
  confirmation a lens actually changed. Watch Preview during the set.

## Latency check (before the audience-mirror bits)

Target from the bits: under ~200 ms camera-to-Head.

1. Put a running stopwatch in frame.
2. Photograph the Head and the stopwatch in one shot.
3. Difference between the two readings is the chain latency.

The canvas pass adds one frame (16–33 ms). If you are over budget, the
suspects are Wi-Fi between laptop and Head and the Head TV's own processing
mode; put the TV in game/PC mode and wire the laptop.

## Fallbacks

- Snap Camera dead mid-show: select the raw webcam in the `/camera` device
  picker; canvas filters keep working.
- Capture page dead: reload `/camera`, press Start. Persistent filters are lost;
  re-fire the scene.
- Agent dead: the hotkey banner on `/camera` shows the intended slot; press the
  combo by hand.
