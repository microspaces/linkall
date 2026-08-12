/**
 * Transform the surroundshow.com export and import into SurroundShow Convex.
 *
 * Usage:
 *   node packages/backend/migrations/import-mike.mjs
 *   node packages/backend/migrations/import-mike.mjs --url https://upbeat-capybara-284.convex.cloud
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const exportPath = join(__dirname, "mike-surroundshow-export.json");
const compactPath = join(__dirname, "mike-surroundshow-compact.json");

const MEDIA_BASE = "https://www.surroundshow.com/images/surroundshow/scenes/";

function field(obj, ...names) {
  if (!obj) return undefined;
  for (const name of names) {
    if (obj[name] !== undefined && obj[name] !== null && obj[name] !== "") {
      return obj[name];
    }
    const lower = name.toLowerCase();
    for (const key of Object.keys(obj)) {
      if (key.toLowerCase() === lower) {
        const v = obj[key];
        if (v !== undefined && v !== null && v !== "") return v;
      }
    }
  }
  return undefined;
}

function num(v, fallback = 0) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v, fallback = true) {
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "boolean") return v;
  return String(v).toLowerCase() === "true";
}

function panelPoints(fields) {
  const pts = [];
  for (let i = 1; i <= 5; i++) {
    const x = field(fields, `X${i}`, `x${i}`);
    const y = field(fields, `Y${i}`, `y${i}`);
    if (x === undefined || y === undefined || x === "" || y === "") continue;
    pts.push({ x: num(x), y: num(y) });
  }
  if (pts.length < 3) {
    return [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 300 },
      { x: 100, y: 300 },
    ];
  }
  return pts;
}

function screenSize(panels) {
  let maxX = 800;
  let maxY = 600;
  for (const panel of panels) {
    for (const p of panel.points) {
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return {
    width: Math.ceil(maxX / 10) * 10 + 20,
    height: Math.ceil(maxY / 10) * 10 + 20,
  };
}

function effectKindAndContent(fields, mediaBase) {
  const video = field(fields, "video", "Video");
  const image = field(fields, "image", "Image");
  const color = field(fields, "color", "Color");
  const html = field(fields, "html", "Html");
  const url = field(fields, "url", "Url");

  if (video) return { kind: "video", content: String(video) };
  if (image) {
    const name = String(image);
    const content = /^https?:\/\//i.test(name) ? name : mediaBase + name;
    return { kind: "image", content };
  }
  if (color) return { kind: "color", content: String(color) };
  if (html) return { kind: "text", content: String(html) };
  if (url) {
    const u = String(url);
    if (/\.(mp4|webm|mov)(\?|$)/i.test(u) || /youtube\.com|youtu\.be/i.test(u)) {
      return { kind: "video", content: u };
    }
    if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(u)) {
      return { kind: "image", content: u };
    }
    return { kind: "text", content: u };
  }
  // Empty legacy rows (no media/color) used to become #000000 and cover GIFs.
  return null;
}

function showTag(name) {
  const n = name.toLowerCase();
  if (n.includes("christmas")) return "christmas";
  if (n.includes("halloween")) return "halloween";
  if (n.includes("headcase")) return "headcase";
  if (n.includes("laffup")) return "laffup";
  if (n.includes("league") || n.includes("laugh")) return "comedyloco";
  if (n.includes("westport")) return "westport";
  return undefined;
}

function inferLegacyLayoutId(show, layouts) {
  const panelIds = new Set();
  for (const scene of show.scenes) {
    for (const effect of scene.effects) {
      const id = field(effect.fields, "PanelId", "panelid");
      if (id !== undefined) panelIds.add(String(num(id)));
    }
  }
  const scores = new Map();
  for (const layout of layouts) {
    let score = 0;
    for (const screen of layout.screens) {
      for (const panel of screen.panels) {
        const id = String(
          panel.legacyId || num(field(panel.fields, "PanelId", "panelid")),
        );
        if (panelIds.has(id)) score++;
      }
    }
    scores.set(layout.legacyId, score);
  }
  let best;
  let bestScore = 0;
  for (const [legacyId, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = legacyId;
    }
  }
  if (best === undefined) {
    const tag = showTag(show.name);
    if (tag === "christmas" || tag === "halloween" || tag === "westport") {
      return layouts.find((l) => /house/i.test(l.name))?.legacyId;
    }
    return layouts.find((l) => /stage/i.test(l.name))?.legacyId;
  }
  return best;
}

function transform(raw) {
  const mediaBase = raw.mediaBase || MEDIA_BASE;
  const layouts = raw.layouts.map((layout) => {
    const screens = layout.screens.map((screen, screenIndex) => {
      const panels = screen.panels.map((panel) => {
        const fields = panel.fields || {};
        return {
          legacyId: panel.legacyId || num(field(fields, "PanelId", "panelid")),
          name: panel.name || String(field(fields, "Name", "name") || "Panel"),
          zIndex: num(field(fields, "ZIndex", "zindex"), 0),
          points: panelPoints(fields),
        };
      });
      const size = screenSize(panels);
      return {
        legacyId: screen.legacyId,
        name: screen.name,
        order: num(field(screen.fields, "Order", "order"), screenIndex) || screenIndex,
        width: size.width,
        height: size.height,
        panels,
      };
    });
    return { legacyId: layout.legacyId, name: layout.name, screens };
  });

  const shows = raw.shows.map((show) => {
    const scenes = [...show.scenes]
      .map((scene, index) => {
        const fields = scene.fields || {};
        const order = num(field(fields, "Order", "order"), index);
        const duration = num(field(fields, "Duration", "duration"), 0);
        const effects = scene.effects
          .map((effect) => {
            const ef = effect.fields || {};
            const legacyPanelId = num(field(ef, "PanelId", "panelid"), NaN);
            if (!Number.isFinite(legacyPanelId)) return null;
            const media = effectKindAndContent(ef, mediaBase);
            if (!media) return null;
            const duration = num(field(ef, "Duration", "duration"), 0);
            const videoStart = num(
              field(ef, "VideoStartTime", "videostarttime"),
              0,
            );
            return {
              legacyPanelId,
              kind: media.kind,
              content: media.content,
              startTime: num(field(ef, "StartTime", "starttime"), 0),
              isEnabled: bool(field(ef, "IsEnabled", "isenabled"), true),
              ...(duration > 0 ? { durationSec: duration } : {}),
              ...(media.kind === "video" && videoStart > 0
                ? { videoStartSec: videoStart }
                : {}),
            };
          })
          .filter(Boolean);
        return {
          legacyId: scene.legacyId,
          title: scene.name || String(field(fields, "Name", "name") || "Scene"),
          order,
          durationSec: duration > 0 ? duration : undefined,
          effects,
        };
      })
      .sort((a, b) => a.order - b.order)
      .map((scene, index) => ({ ...scene, order: index }));

    return {
      legacyId: show.legacyId,
      title: show.name,
      description: `Imported from surroundshow.com (legacy ShowId ${show.legacyId})`,
      tag: showTag(show.name),
      legacyLayoutId: inferLegacyLayoutId(show, layouts),
      scenes,
    };
  });

  return {
    user: {
      name: raw.user?.name || "Mike",
      handle: raw.user?.handle || "mike",
      bio: `SurroundShow account ${raw.user?.email || "mike@surroundshow.com"}`,
      tier: "admin",
    },
    layouts,
    shows,
    replaceOwned: true,
  };
}

const urlArgIdx = process.argv.indexOf("--url");
const convexUrl =
  (urlArgIdx >= 0 && process.argv[urlArgIdx + 1]) ||
  process.env.CONVEX_URL ||
  "http://127.0.0.1:3212";

const raw = JSON.parse(readFileSync(exportPath, "utf8"));
const data = transform(raw);
writeFileSync(compactPath, JSON.stringify({ data }, null, 2));

const effectTotal = data.shows.reduce(
  (n, s) => n + s.scenes.reduce((m, sc) => m + sc.effects.length, 0),
  0,
);
console.log(
  `Compact payload: ${data.layouts.length} layouts, ${data.shows.length} shows, ${effectTotal} effects`,
);
console.log(`Target: ${convexUrl}`);

const client = new ConvexHttpClient(convexUrl);
const result = await client.mutation("importLegacy:mike", { data });
console.log("Import result:", JSON.stringify(result, null, 2));
