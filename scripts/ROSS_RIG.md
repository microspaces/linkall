# HyperX Arena Ross rig (placeholders)

Switcher control for Battle Loco / Wrestle Loco at HyperX. **Inputs and dests
are placeholders** until the arena patch list lands. Change them in one file:

`packages/backend/convex/rossRig.ts`

The Node bridge (`scripts/rosstalk-bridge.mjs`) does not hardcode these — it
sends whatever command strings were stored on the scene.

## Patch list (edit here when the board is labeled)

| Role | Constant | Default | Notes |
| --- | --- | --- | --- |
| Gaming feed | `GAMING_FEED_SRC` | `IN:5` | Console / PC capture |
| Camera feed | `CAMERA_FEED_SRC` | `IN:6` | Host / house camera |
| Big screen | `BIG_SCREEN_DEST` | `ME:1:PGM` | Could be `AUX:2` |
| Key 1 | `KEY_FULL_OVERLAY` | `ME:1:KEY:1` | Full-frame overlay |
| Key 2 | `KEY_LOWER_THIRD` | `ME:1:KEY:2` | Title / host lower third |
| Key 3 | `KEY_TOP_CORNERS` | `ME:1:KEY:3` | Top-left + top-right score bugs |

RossTalk strings (via `buildCommands`):

- Crosspoint: `XPT <dest>:<src>` → e.g. `XPT ME:1:PGM:IN:5`
- Key cut: `KEYCUT ME:1:N:ON|OFF` (stored key ref `ME:1:KEY:N` is normalized)

## 3-key plan

Key **fills come from observables** — linkall overlay URL pages (browser /
capture sources), not Media Store stills.

Logical slots on the HyperX layout, on a dedicated screen **Ross Key Fills**
so they never sit on the LED walls:

1. `Key Fill: Full Overlay`
2. `Key Fill: Lower Third`
3. `Key Fill: Top Corners`

URL effects on a scene can target those names like any other logical panel.

## Cue look

Each visual scene stores a full idempotent command set (XPT + all three keys).
Music / sound-effect scenes do not.

| Scene class | Big screen | KEY 1 full | KEY 2 lower third | KEY 3 corners |
| --- | --- | --- | --- | --- |
| Gameplay (game feed, celebrations) | gaming | ON | OFF | ON if side-score cue |
| Host / camera (intro, award, outro, crowd, breaks) | camera | OFF | ON | ON if side-score cue |
| Full overlay (vote, instructions, …) | gaming (camera for winner / punishment / ring) | ON | OFF | ON if side-score cue |
| Score overlay (score, box score, rotation) | gaming | OFF | OFF | ON |
