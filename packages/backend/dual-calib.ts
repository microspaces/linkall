/**
 * Dual-projector calibration math.
 *
 * Pure TS: marker geometry, a saturated-color centroid detector, DLT
 * homography, and the CSS matrix3d mapping. Shared by the Expo capture
 * flow and the projector ScreenOutput page. No React, no Convex.
 */

export type Point = { x: number; y: number };

/** Row-major 3×3. */
export type Mat3 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type DualCalibRole = "p1" | "p2";

export type RgbaImage = {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
};

/** Inset from each edge so markers sit inside typical projector overscan. */
export const MARKER_INSET = 0.14;

export const P1_COLOR = "#22d3ee";
export const P2_COLOR = "#e879f9";
export const P1_LABEL = "P1 · CYAN";
export const P2_LABEL = "P2 · MAGENTA";

/** TL, TR, BR, BL in normalized [0,1] projector space. */
export function markerCornersNorm(inset = MARKER_INSET): Point[] {
  return [
    { x: inset, y: inset },
    { x: 1 - inset, y: inset },
    { x: 1 - inset, y: 1 - inset },
    { x: inset, y: 1 - inset },
  ];
}

export function markerColor(role: DualCalibRole): string {
  return role === "p1" ? P1_COLOR : P2_COLOR;
}

export function markerLabel(role: DualCalibRole): string {
  return role === "p1" ? P1_LABEL : P2_LABEL;
}

// ----------------------------------------------------------------- matrix

export function identityMat3(): Mat3 {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

export function mulMat3(a: Mat3, b: Mat3): Mat3 {
  const r: number[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
    }
  }
  return r as Mat3;
}

export function applyMat3(m: Mat3, p: Point): Point {
  const w = m[6] * p.x + m[7] * p.y + m[8];
  if (Math.abs(w) < 1e-12) return { x: NaN, y: NaN };
  return {
    x: (m[0] * p.x + m[1] * p.y + m[2]) / w,
    y: (m[3] * p.x + m[4] * p.y + m[5]) / w,
  };
}

export function invertMat3(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = c * h - b * i;
  const C = b * f - c * e;
  const D = f * g - d * i;
  const E = a * i - c * g;
  const F = c * d - a * f;
  const G = d * h - e * g;
  const H = b * g - a * h;
  const I = a * e - b * d;
  const det = a * A + b * D + c * G;
  if (Math.abs(det) < 1e-12) {
    throw new Error("Homography is not invertible");
  }
  const inv = 1 / det;
  return [A * inv, B * inv, C * inv, D * inv, E * inv, F * inv, G * inv, H * inv, I * inv];
}

export function detMat3(m: Mat3): number {
  return (
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6])
  );
}

/** Normalize so h33 = 1 when possible — resolution-independent storage. */
export function normalizeHomography(m: Mat3): Mat3 {
  const s = m[8];
  if (Math.abs(s) < 1e-12) return m;
  return m.map((v) => v / s) as Mat3;
}

// ----------------------------------------------------------- linear solve

function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    let best = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > best) {
        best = v;
        pivot = r;
      }
    }
    if (best < 1e-12) throw new Error("Could not solve homography (singular)");
    if (pivot !== col) {
      const tmp = M[col];
      M[col] = M[pivot];
      M[pivot] = tmp;
    }
    const div = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

function similarityNormalize(pts: Point[]): { T: Mat3; norm: Point[] } {
  const n = pts.length;
  const cx = pts.reduce((s, p) => s + p.x, 0) / n;
  const cy = pts.reduce((s, p) => s + p.y, 0) / n;
  const meanDist =
    pts.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / n;
  const scale = meanDist > 1e-9 ? Math.SQRT2 / meanDist : 1;
  const T: Mat3 = [scale, 0, -scale * cx, 0, scale, -scale * cy, 0, 0, 1];
  return { T, norm: pts.map((p) => applyMat3(T, p)) };
}

/**
 * 4-point DLT homography (Hartley-normalized). Maps `src` → `dst`.
 * `src`/`dst` are TL, TR, BR, BL.
 */
export function findHomography(src: Point[], dst: Point[]): Mat3 {
  if (src.length < 4 || dst.length < 4) {
    throw new Error("Homography needs 4 point pairs");
  }
  const sN = similarityNormalize(src);
  const dN = similarityNormalize(dst);
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = sN.norm[i];
    const { x: xp, y: yp } = dN.norm[i];
    A.push([x, y, 1, 0, 0, 0, -xp * x, -xp * y]);
    b.push(xp);
    A.push([0, 0, 0, x, y, 1, -yp * x, -yp * y]);
    b.push(yp);
  }
  const h = solveLinear(A, b);
  const Hn: Mat3 = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  const H = mulMat3(invertMat3(dN.T), mulMat3(Hn, sN.T));
  return normalizeHomography(H);
}

/**
 * Warp applied to Projector 2 so its output lands on Projector 1.
 *
 * H1 maps P1 framebuffer → camera, H2 maps P2 framebuffer → camera.
 * CSS transform W on P2 satisfies H2 · W = H1, so W = H2⁻¹ · H1.
 * Stored in normalized [0,1] coordinates (marker space).
 */
export function computeP2Warp(p1Cam: Point[], p2Cam: Point[]): Mat3 {
  const src = markerCornersNorm();
  const H1 = findHomography(src, p1Cam);
  const H2 = findHomography(src, p2Cam);
  return normalizeHomography(mulMat3(invertMat3(H2), H1));
}

/**
 * Convert a normalized-space homography to the pixel-space matrix for an
 * element of size (width, height), then to a CSS `matrix3d(...)` string.
 */
export function homographyToMatrix3d(
  mNorm: number[],
  width: number,
  height: number,
): string {
  if (mNorm.length !== 9 || width <= 0 || height <= 0) {
    return "none";
  }
  const S: Mat3 = [width, 0, 0, 0, height, 0, 0, 0, 1];
  const Sinv: Mat3 = [1 / width, 0, 0, 0, 1 / height, 0, 0, 0, 1];
  const m = mulMat3(S, mulMat3(mNorm as Mat3, Sinv));
  const [h11, h12, h13, h21, h22, h23, h31, h32, h33] = m;
  return `matrix3d(${[
    h11,
    h21,
    0,
    h31,
    h12,
    h22,
    0,
    h32,
    0,
    0,
    1,
    0,
    h13,
    h23,
    0,
    h33,
  ].join(",")})`;
}

export function isValidMatrix(m: unknown): m is number[] {
  return (
    Array.isArray(m) &&
    m.length === 9 &&
    m.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

// -------------------------------------------------------------- detector

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/** Cyan / aqua — Projector 1. */
export function isCyanPixel(r: number, g: number, b: number): boolean {
  const { h, s, v } = rgbToHsv(r, g, b);
  return h >= 160 && h <= 205 && s >= 0.4 && v >= 0.35;
}

/** Magenta / fuchsia — Projector 2. */
export function isMagentaPixel(r: number, g: number, b: number): boolean {
  const { h, s, v } = rgbToHsv(r, g, b);
  return h >= 275 && h <= 330 && s >= 0.4 && v >= 0.35;
}

function collectColor(
  image: RgbaImage,
  pred: (r: number, g: number, b: number) => boolean,
): Point[] {
  const { data, width, height } = image;
  const step = Math.max(1, Math.floor(Math.max(width, height) / 480));
  const pts: Point[] = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (pred(data[i], data[i + 1], data[i + 2])) {
        pts.push({ x, y });
      }
    }
  }
  return pts;
}

function centroid(pts: Point[]): Point {
  const n = pts.length || 1;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / n,
    y: pts.reduce((s, p) => s + p.y, 0) / n,
  };
}

/** Split color pixels into 4 spatial bins around their centroid → TL TR BR BL. */
function cornersFromPixels(pts: Point[]): Point[] {
  if (pts.length < 8) {
    throw new Error("Not enough marker pixels to locate 4 corners");
  }
  const c = centroid(pts);
  const bins: Point[][] = [[], [], [], []];
  for (const p of pts) {
    const right = p.x >= c.x;
    const bottom = p.y >= c.y;
    const idx = bottom ? (right ? 2 : 3) : right ? 1 : 0;
    bins[idx].push(p);
  }
  const min = Math.max(3, Math.floor(pts.length / 40));
  if (bins.some((b) => b.length < min)) {
    throw new Error("Could not separate all 4 corner markers — reframe and retry");
  }
  const corners = bins.map(centroid);
  return orderCorners(corners);
}

function orderCorners(pts: Point[]): Point[] {
  const sorted = [...pts].sort((a, b) => a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bot = sorted.slice(2).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bot[1], bot[0]];
}

export type DetectResult = {
  p1: Point[];
  p2: Point[];
  stats: { cyan: number; magenta: number };
};

/**
 * Find the 8 corner markers in a still frame. Throws if either color
 * set cannot be resolved into 4 corners.
 */
export function detectDualMarkers(image: RgbaImage): DetectResult {
  const cyan = collectColor(image, isCyanPixel);
  const magenta = collectColor(image, isMagentaPixel);
  if (cyan.length < 16) {
    throw new Error("Cyan (Projector 1) markers not visible — check framing");
  }
  if (magenta.length < 16) {
    throw new Error("Magenta (Projector 2) markers not visible — check framing");
  }
  return {
    p1: cornersFromPixels(cyan),
    p2: cornersFromPixels(magenta),
    stats: { cyan: cyan.length, magenta: magenta.length },
  };
}

// -------------------------------------------------------------- self-check

/** Returns null on success, or an error string. Used by the verify script. */
export function selfCheck(): string | null {
  const src = markerCornersNorm();
  // Known warp: slight scale + shear + translation in normalized space.
  const Wtrue: Mat3 = normalizeHomography([1.06, 0.04, -0.02, -0.03, 0.95, 0.03, 0.02, -0.015, 1]);
  // Camera = 1000× scale of P1 framebuffer (H1).
  const H1: Mat3 = [1000, 0, 0, 0, 1000, 0, 0, 0, 1];
  const H2 = mulMat3(H1, invertMat3(Wtrue));
  const p1Cam = src.map((p) => applyMat3(H1, p));
  const p2Cam = src.map((p) => applyMat3(H2, p));
  const West = computeP2Warp(p1Cam, p2Cam);
  for (const p of src) {
    const a = applyMat3(Wtrue, p);
    const b = applyMat3(West, p);
    if (Math.hypot(a.x - b.x, a.y - b.y) > 1e-4) {
      return `warp mismatch at (${p.x},${p.y}): ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
    }
  }

  // Detector: draw two colored 5×5 blobs at known corners and recover them.
  const w = 200;
  const h = 160;
  const data = new Uint8Array(w * h * 4);
  const paint = (nx: number, ny: number, rgb: [number, number, number]) => {
    const cx = Math.round(nx * (w - 1));
    const cy = Math.round(ny * (h - 1));
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = (y * w + x) * 4;
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
        data[i + 3] = 255;
      }
    }
  };
  const corners = markerCornersNorm();
  for (const p of corners) paint(p.x, p.y, [0, 220, 255]);
  // Offset magenta so clusters don't share pixels.
  for (const p of corners) paint(p.x + 0.04, p.y + 0.03, [255, 0, 255]);
  const det = detectDualMarkers({ data, width: w, height: h });
  if (det.p1.length !== 4 || det.p2.length !== 4) return "detector missed corners";
  for (let i = 0; i < 4; i++) {
    const exp = {
      x: corners[i].x * (w - 1),
      y: corners[i].y * (h - 1),
    };
    if (Math.hypot(det.p1[i].x - exp.x, det.p1[i].y - exp.y) > 4) {
      return `cyan corner ${i} off: ${JSON.stringify(det.p1[i])} vs ${JSON.stringify(exp)}`;
    }
  }
  return null;
}
