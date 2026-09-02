/**
 * Local (capture-page) camera filter engine.
 *
 * The capture page draws getUserMedia → <canvas> every frame and publishes
 * `canvas.captureStream()` over WebRTC, so everything here lands on the Head
 * with no downstream changes. Filters are whole-frame canvas ops; face-tracked
 * lenses stay in Snap Camera and are cued through the hotkey queue instead.
 *
 * Cue semantics (see filterCues.ts): `set` is sticky, `flash` overrides for a
 * few hundred ms, `seq` steps through names then clears. Priority when
 * several are live: flash > seq > set.
 */
import type { FilterCue } from "@linkall/backend/convex/filterCues";

type Source = HTMLVideoElement | HTMLCanvasElement;

const SPIN_PERIOD_MS = 3000;
const PIXELATE_BLOCK = 24;
const ZOOM_FACTOR = 1.8;

export class FilterEngine {
  private base: string | null = null;
  private flash: { name: string; until: number } | null = null;
  private seq: { names: string[]; ms: number; startedAt: number } | null = null;
  private frozen: HTMLCanvasElement | null = null;
  private scratch: HTMLCanvasElement | null = null;
  private lastActive: string | null = null;
  private activeSince = 0;
  private readonly supportsCtxFilter: boolean;

  constructor() {
    this.supportsCtxFilter =
      typeof document !== "undefined" &&
      (() => {
        const c = document.createElement("canvas");
        const ctx = c.getContext("2d");
        return !!ctx && "filter" in ctx;
      })();
  }

  apply(cue: FilterCue, now = performance.now()) {
    switch (cue.op) {
      case "clear":
        this.base = null;
        this.flash = null;
        this.seq = null;
        break;
      case "set":
        this.base = cue.name;
        this.seq = null;
        break;
      case "flash":
        this.flash = { name: cue.name, until: now + cue.ms };
        break;
      case "seq":
        this.seq = { names: cue.names, ms: cue.ms, startedAt: now };
        break;
    }
  }

  /** Name of the filter that will render this frame, or null for passthrough. */
  active(now = performance.now()): string | null {
    if (this.flash) {
      if (now < this.flash.until) return this.flash.name;
      this.flash = null;
    }
    if (this.seq) {
      const idx = Math.floor((now - this.seq.startedAt) / this.seq.ms);
      if (idx < this.seq.names.length) return this.seq.names[idx] ?? null;
      this.seq = null;
    }
    return this.base;
  }

  /** Sticky filter (what `clear` would remove). */
  current(): string | null {
    return this.base;
  }

  render(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    now = performance.now(),
  ) {
    const name = this.active(now);
    if (name !== this.lastActive) {
      this.lastActive = name;
      this.activeSince = now;
      if (name !== "freeze") this.frozen = null;
    }
    const ready = video.readyState >= 2 && video.videoWidth > 0;

    if (name === "freeze") {
      if (!this.frozen && ready) {
        const f = document.createElement("canvas");
        f.width = w;
        f.height = h;
        f.getContext("2d")?.drawImage(video, 0, 0, w, h);
        this.frozen = f;
      }
    }
    const src: Source | null = this.frozen ?? (ready ? video : null);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "none";
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    if (!src) {
      ctx.restore();
      return;
    }

    const elapsed = now - this.activeSince;
    switch (name) {
      case null:
      case "freeze":
        ctx.drawImage(src, 0, 0, w, h);
        break;
      case "invert":
      case "grayscale":
      case "sepia":
        this.drawGraded(ctx, src, w, h, name);
        break;
      case "pixelate":
        this.drawPixelated(ctx, src, w, h);
        break;
      case "zoom":
        ctx.translate(w / 2, h / 2);
        ctx.scale(ZOOM_FACTOR, ZOOM_FACTOR);
        ctx.drawImage(src, -w / 2, -h / 2, w, h);
        break;
      case "spin": {
        const angle = ((elapsed % SPIN_PERIOD_MS) / SPIN_PERIOD_MS) * Math.PI * 2;
        ctx.translate(w / 2, h / 2);
        ctx.rotate(angle);
        ctx.scale(1.4, 1.4);
        ctx.drawImage(src, -w / 2, -h / 2, w, h);
        break;
      }
      case "mirror":
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(src, 0, 0, w, h);
        break;
      case "bsod":
        drawBsod(ctx, w, h, elapsed);
        break;
      case "buffering":
        ctx.drawImage(src, 0, 0, w, h);
        drawBuffering(ctx, w, h, elapsed);
        break;
      case "bars":
        drawBars(ctx, w, h);
        break;
      case "call":
        ctx.drawImage(src, 0, 0, w, h);
        drawCall(ctx, w, h, elapsed);
        break;
      default:
        // Unknown (e.g. a Snap slot that was routed here by mistake): passthrough.
        ctx.drawImage(src, 0, 0, w, h);
    }
    ctx.restore();
  }

  private drawGraded(
    ctx: CanvasRenderingContext2D,
    src: Source,
    w: number,
    h: number,
    name: "invert" | "grayscale" | "sepia",
  ) {
    if (this.supportsCtxFilter) {
      ctx.filter =
        name === "invert" ? "invert(1)" : name === "grayscale" ? "grayscale(1)" : "sepia(1)";
      ctx.drawImage(src, 0, 0, w, h);
      ctx.filter = "none";
      return;
    }
    // Safari fallback: per-pixel pass.
    ctx.drawImage(src, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i]!;
      const g = d[i + 1]!;
      const b = d[i + 2]!;
      if (name === "invert") {
        d[i] = 255 - r;
        d[i + 1] = 255 - g;
        d[i + 2] = 255 - b;
      } else if (name === "grayscale") {
        const y = 0.299 * r + 0.587 * g + 0.114 * b;
        d[i] = d[i + 1] = d[i + 2] = y;
      } else {
        d[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
        d[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
        d[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  private drawPixelated(
    ctx: CanvasRenderingContext2D,
    src: Source,
    w: number,
    h: number,
  ) {
    const sw = Math.max(1, Math.round(w / PIXELATE_BLOCK));
    const sh = Math.max(1, Math.round(h / PIXELATE_BLOCK));
    if (!this.scratch) this.scratch = document.createElement("canvas");
    const s = this.scratch;
    if (s.width !== sw || s.height !== sh) {
      s.width = sw;
      s.height = sh;
    }
    const sctx = s.getContext("2d");
    if (!sctx) return;
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(src, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(s, 0, 0, sw, sh, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
  }
}

function drawBsod(ctx: CanvasRenderingContext2D, w: number, h: number, elapsed: number) {
  ctx.fillStyle = "#0078d7";
  ctx.fillRect(0, 0, w, h);
  const unit = Math.min(w, h) / 20;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "top";
  ctx.font = `${unit * 5}px system-ui, Segoe UI, sans-serif`;
  ctx.fillText(":(", unit * 2, unit * 2);
  ctx.font = `${unit * 1.1}px system-ui, Segoe UI, sans-serif`;
  const lines = [
    "Your head ran into a problem and needs to restart.",
    "We're just collecting some error info, and then",
    "we'll restart for you.",
  ];
  lines.forEach((line, i) => ctx.fillText(line, unit * 2, unit * 8.5 + i * unit * 1.5));
  const pct = Math.min(100, Math.floor(elapsed / 120) % 101);
  ctx.fillText(`${pct}% complete`, unit * 2, unit * 13.5);
  ctx.font = `${unit * 0.7}px system-ui, Segoe UI, sans-serif`;
  ctx.fillText("Stop code: HEADCASE_EXCEPTION_NOT_HANDLED", unit * 2, unit * 16);
}

function drawBuffering(ctx: CanvasRenderingContext2D, w: number, h: number, elapsed: number) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, w, h);
  const r = Math.min(w, h) / 9;
  const cx = w / 2;
  const cy = h / 2;
  const a = ((elapsed % 1200) / 1200) * Math.PI * 2;
  ctx.lineWidth = r / 5;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx, cy, r, a, a + Math.PI * 1.2);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = `${r * 0.6}px system-ui, Segoe UI, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const dots = ".".repeat(1 + (Math.floor(elapsed / 400) % 3));
  ctx.fillText(`Buffering${dots}`, cx, cy + r * 1.6);
}

const BAR_COLORS = ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"];

function drawBars(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bw = w / BAR_COLORS.length;
  const top = h * 0.67;
  BAR_COLORS.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * bw, 0, bw + 1, top);
  });
  const mid = h * 0.08;
  const lower = ["#0000c0", "#131313", "#c000c0", "#131313", "#00c0c0", "#131313", "#c0c0c0"];
  lower.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * bw, top, bw + 1, mid);
  });
  const y = top + mid;
  const bottom = h - y;
  const seg = w / 6;
  const bottomColors = ["#00214c", "#ffffff", "#32006a", "#131313", "#000000", "#262626"];
  bottomColors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * seg, y, seg + 1, bottom);
  });
}

function drawCall(ctx: CanvasRenderingContext2D, w: number, h: number, elapsed: number) {
  const unit = Math.min(w, h) / 20;
  // Top caller card.
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, unit, unit, w - unit * 2, unit * 3.2, unit * 0.6);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `600 ${unit * 1.2}px system-ui, Segoe UI, sans-serif`;
  ctx.fillText("Unknown Caller", unit * 1.8, unit * 1.5);
  ctx.font = `${unit * 0.8}px system-ui, Segoe UI, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  const dots = ".".repeat(1 + (Math.floor(elapsed / 500) % 3));
  ctx.fillText(`FaceTime Video${dots}`, unit * 1.8, unit * 2.9);
  // Bottom answer / decline.
  const cy = h - unit * 3;
  const r = unit * 1.4;
  const pulse = 1 + 0.08 * Math.sin(elapsed / 180);
  ctx.fillStyle = "#e5342b";
  ctx.beginPath();
  ctx.arc(w / 2 - unit * 4, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#34c759";
  ctx.beginPath();
  ctx.arc(w / 2 + unit * 4, cy, r * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${r * 1.1}px system-ui, Segoe UI, sans-serif`;
  ctx.fillText("✕", w / 2 - unit * 4, cy + r * 0.05);
  ctx.fillText("✆", w / 2 + unit * 4, cy + r * 0.05);
  ctx.font = `${unit * 0.7}px system-ui, Segoe UI, sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText("Decline", w / 2 - unit * 4, cy + r * 1.3);
  ctx.fillText("Accept", w / 2 + unit * 4, cy + r * 1.3);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
