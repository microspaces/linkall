/**
 * HeadCase camera filter cues.
 *
 * A `filter` effect is a generic cue. The designer writes a name (or a
 * short cue string); the executor is decided here, not by the author:
 *
 *  - `canvas`  → the capture page (`packages/ui/src/camera.tsx`) applies the
 *                effect locally on the getUserMedia → canvas → WebRTC pass.
 *  - `hotkey`  → the laptop agent (`scripts/snap-hotkey-agent.mjs`) sends an
 *                OS keystroke so Snap Camera changes lens.
 *
 * Scenes, bits and the designer only ever see the cue. If the Snap engine is
 * ever replaced, only the catalog changes.
 *
 * Cue grammar (case-insensitive, whitespace tolerant):
 *
 *   <name>                    same as `set <name>`
 *   set <name>                persistent until the next set/clear
 *   flash <name> [ms]         one-shot, auto-clears after ms (default 800)
 *   seq a,b,c [ms]            each name in turn for ms (default 2000), then clear
 *   clear                     back to the plain camera feed
 *
 * A `:` may be used instead of a space after the verb (`set:invert`).
 */

export type FilterExecutor =
  | { kind: "canvas" }
  | { kind: "hotkey"; hotkey: string };

export type FilterDef = {
  name: string;
  label: string;
  executor: FilterExecutor;
  /** Short operator note for the designer modal. */
  hint: string;
};

/** Snap Camera favourite slots. Bind each favourite lens to this hotkey. */
export const SNAP_SLOT_COUNT = 9;

/**
 * Default hotkey for Snap slot n (1-based). ctrl+alt avoids Chrome's
 * ctrl+<digit> "switch to tab" binding, which the old ctrl+N defaults hit
 * whenever the capture page had focus.
 */
export function snapSlotHotkey(n: number): string {
  return `ctrl+alt+${n}`;
}

const CANVAS: Array<Omit<FilterDef, "executor">> = [
  { name: "invert", label: "Invert", hint: "Negative image." },
  { name: "grayscale", label: "Grayscale", hint: "Black and white." },
  { name: "sepia", label: "Sepia", hint: "Old-photo grade." },
  { name: "pixelate", label: "Pixelate", hint: "Blocky scramble." },
  { name: "freeze", label: "Freeze", hint: "Hold the current frame." },
  { name: "zoom", label: "Zoom", hint: "Punch in ~1.8x on the face." },
  { name: "spin", label: "Spin", hint: "Slow full-frame rotation." },
  { name: "mirror", label: "Mirror", hint: "Flip horizontally." },
  { name: "bsod", label: "BSOD", hint: "Blue-screen crash card over the face." },
  { name: "buffering", label: "Buffering", hint: "Dim feed + spinner." },
  { name: "bars", label: "Test pattern", hint: "SMPTE colour bars." },
  { name: "call", label: "Incoming call", hint: "FaceTime-style call chrome." },
];

export const FILTER_CATALOG: readonly FilterDef[] = [
  ...CANVAS.map((f) => ({ ...f, executor: { kind: "canvas" } as const })),
  ...Array.from({ length: SNAP_SLOT_COUNT }, (_, i) => {
    const n = i + 1;
    return {
      name: `snap-${n}`,
      label: `Snap lens ${n}`,
      executor: { kind: "hotkey", hotkey: snapSlotHotkey(n) } as const,
      hint: `Snap Camera favourite bound to ${snapSlotHotkey(n)}.`,
    };
  }),
];

const BY_NAME = new Map(FILTER_CATALOG.map((f) => [f.name, f]));

export function getFilter(name: string): FilterDef | undefined {
  return BY_NAME.get(name.trim().toLowerCase());
}

export function canvasFilterNames(): string[] {
  return FILTER_CATALOG.filter((f) => f.executor.kind === "canvas").map(
    (f) => f.name,
  );
}

export type FilterCue =
  | { op: "set"; name: string }
  | { op: "flash"; name: string; ms: number }
  | { op: "seq"; names: string[]; ms: number }
  | { op: "clear" };

export const FLASH_DEFAULT_MS = 800;
export const SEQ_DEFAULT_MS = 2000;

function parseMs(raw: string | undefined, fallback: number): number | null {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 50 || n > 600_000) return null;
  return Math.round(n);
}

export type ParsedFilterCue =
  | { ok: true; cue: FilterCue }
  | { ok: false; error: string };

const fail = (error: string): ParsedFilterCue => ({ ok: false, error });
const okCue = (cue: FilterCue): ParsedFilterCue => ({ ok: true, cue });

/** Parse a cue string. Returns an error message instead of throwing. */
export function parseFilterCue(raw: string): ParsedFilterCue {
  const text = raw.trim().toLowerCase().replace(/^(\w+):/, "$1 ");
  if (!text) return fail("Empty cue.");
  const [verbRaw, ...rest] = text.split(/\s+/);
  const verb = verbRaw ?? "";

  if (verb === "clear") {
    if (rest.length) return fail("`clear` takes no arguments.");
    return okCue({ op: "clear" });
  }

  if (verb === "set" || verb === "flash") {
    const name = rest[0];
    if (!name) return fail(`\`${verb}\` needs a filter name.`);
    if (!getFilter(name)) return fail(`Unknown filter "${name}".`);
    if (verb === "set") {
      if (rest.length > 1) return fail("`set` takes one name.");
      return okCue({ op: "set", name });
    }
    const ms = parseMs(rest[1], FLASH_DEFAULT_MS);
    if (ms === null) return fail("flash duration must be 50–600000 ms.");
    if (rest.length > 2) return fail("`flash <name> [ms]`");
    return okCue({ op: "flash", name, ms });
  }

  if (verb === "seq") {
    // Trailing integer token is the step; everything else is the list, which
    // may have spaces around its commas.
    const tokens = [...rest];
    let msRaw: string | undefined;
    if (tokens.length > 1 && /^\d+$/.test(tokens[tokens.length - 1] ?? "")) {
      msRaw = tokens.pop();
    }
    const names = tokens
      .join("")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return fail("`seq` needs a comma-separated list.");
    for (const n of names) {
      const def = getFilter(n);
      if (!def) return fail(`Unknown filter "${n}".`);
      if (def.executor.kind !== "canvas") {
        return fail(`"${n}" is a Snap lens; seq only runs canvas filters.`);
      }
    }
    const ms = parseMs(msRaw, SEQ_DEFAULT_MS);
    if (ms === null) return fail("seq step must be 50–600000 ms.");
    return okCue({ op: "seq", names, ms });
  }

  // Bare name → set.
  if (rest.length === 0 && getFilter(verb)) {
    return okCue({ op: "set", name: verb });
  }
  return fail(
    `Unknown cue "${raw.trim()}". Use a filter name, set/flash/seq, or clear.`,
  );
}

/**
 * Decide where a cue runs. Snap-backed `set`/`flash` become a hotkey; every
 * other cue (canvas names, clear, seq) goes to the capture page. Snap has no
 * "clear", so `clear` after a Snap lens is the operator's job.
 */
export function routeFilterCue(
  cue: FilterCue,
): { to: "hotkey"; hotkey: string } | { to: "canvas" } {
  if (cue.op === "set" || cue.op === "flash") {
    const def = getFilter(cue.name);
    if (def?.executor.kind === "hotkey") {
      return { to: "hotkey", hotkey: def.executor.hotkey };
    }
  }
  return { to: "canvas" };
}

/** Human summary for list rows. */
export function describeFilterCue(raw: string): string {
  const parsed = parseFilterCue(raw);
  if (!parsed.ok) return `invalid cue`;
  const c = parsed.cue;
  if (c.op === "clear") return "clear filter";
  if (c.op === "set") return `filter ${getFilter(c.name)?.label ?? c.name}`;
  if (c.op === "flash") return `flash ${getFilter(c.name)?.label ?? c.name} ${c.ms}ms`;
  return `seq ${c.names.join(" → ")} ${c.ms}ms`;
}

/** Cheap assertions run by `filterCues.check.ts`. */
export function selfCheck(): string | null {
  const cases: Array<[string, FilterCue | null]> = [
    ["invert", { op: "set", name: "invert" }],
    ["set:pixelate", { op: "set", name: "pixelate" }],
    ["SET  Zoom", { op: "set", name: "zoom" }],
    ["flash bsod", { op: "flash", name: "bsod", ms: FLASH_DEFAULT_MS }],
    ["flash bsod 1500", { op: "flash", name: "bsod", ms: 1500 }],
    ["seq invert,pixelate , spin 2000", { op: "seq", names: ["invert", "pixelate", "spin"], ms: 2000 }],
    ["clear", { op: "clear" }],
    ["snap-3", { op: "set", name: "snap-3" }],
    ["nope", null],
    ["seq snap-1,invert", null],
    ["flash invert 5", null],
  ];
  for (const [input, want] of cases) {
    const got = parseFilterCue(input);
    if (want === null) {
      if (got.ok) return `expected error for "${input}"`;
      continue;
    }
    if (!got.ok) return `unexpected error for "${input}": ${got.error}`;
    if (JSON.stringify(got.cue) !== JSON.stringify(want)) {
      return `parse "${input}": got ${JSON.stringify(got.cue)} want ${JSON.stringify(want)}`;
    }
  }
  const snap = routeFilterCue({ op: "set", name: "snap-2" });
  if (snap.to !== "hotkey" || snap.hotkey !== "ctrl+alt+2") {
    return `snap-2 should route to ctrl+alt+2, got ${JSON.stringify(snap)}`;
  }
  if (routeFilterCue({ op: "set", name: "invert" }).to !== "canvas") {
    return "invert should route to canvas";
  }
  if (routeFilterCue({ op: "clear" }).to !== "canvas") {
    return "clear should route to canvas";
  }
  return null;
}
