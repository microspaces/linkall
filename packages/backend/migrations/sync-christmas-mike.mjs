/**
 * Sync Christmas show effects from the LinkAll8 export into the local Convex DB,
 * and regenerate christmasMikeData.ts for seed:surroundshow.
 *
 * Usage:
 *   node packages/backend/migrations/sync-christmas-mike.mjs
 *   node packages/backend/migrations/sync-christmas-mike.mjs --url http://127.0.0.1:3212
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const exportPath = join(__dirname, "mike-surroundshow-export.json");
const dataTsPath = join(__dirname, "../convex/christmasMikeData.ts");
const MEDIA = "https://www.surroundshow.com/images/surroundshow/scenes/";

const PANEL_TO_LOGICAL = {
  "Garage Triangle": "Background",
  "Garage Top Left": "Header",
  "Garage Top Right": "Overlay",
  "Column Left": "LeftSidebar",
  "Column Right": "RightSidebar",
  "Garage Door": "MainContent",
};

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

function mediaKind(f) {
  const video = field(f, "video", "Video");
  const image = field(f, "image", "Image");
  const color = field(f, "color", "Color");
  const html = field(f, "html", "Html");
  if (video) return { kind: "video", content: String(video) };
  if (image) {
    const name = String(image);
    return {
      kind: "image",
      content: /^https?:\/\//i.test(name) ? name : MEDIA + name,
    };
  }
  if (color) return { kind: "color", content: String(color) };
  if (html) return { kind: "text", content: String(html) };
  return null;
}

function extractScenes(raw) {
  const show = (raw.shows || []).find(
    (s) => String(s.name || "").toLowerCase() === "christmas",
  );
  if (!show) throw new Error("Christmas show not found in export");
  const scenes = [];
  for (const scene of show.scenes || []) {
    const effects = [];
    for (const effect of scene.effects || []) {
      const f = effect.fields || {};
      const panelName = String(field(f, "Name", "name") || "");
      const logicalPanelName = PANEL_TO_LOGICAL[panelName];
      if (!logicalPanelName) continue;
      const media = mediaKind(f);
      if (!media) continue;
      if (String(field(f, "isenabled", "IsEnabled")).toLowerCase() === "false") {
        continue;
      }
      const videoStart = Number(
        field(f, "videostarttime", "VideoStartTime") || 0,
      );
      effects.push({
        panelName,
        logicalPanelName,
        kind: media.kind,
        content: media.content,
        startTime: Number(field(f, "starttime", "StartTime") || 0),
        ...(media.kind === "video" && videoStart > 0
          ? { videoStartSec: videoStart }
          : {}),
      });
    }
    const duration = Number(
      field(scene.fields || {}, "Duration", "duration") || 0,
    );
    scenes.push({
      title: scene.name,
      ...(duration > 0 ? { durationSec: duration } : {}),
      effects,
    });
  }
  return scenes;
}

function writeSeedModule(scenes) {
  const body =
    `/** Auto-generated from mike-surroundshow-export.json — do not edit by hand. */\n` +
    `export type MikeEffect = {\n` +
    `  panelName: string;\n` +
    `  logicalPanelName: string;\n` +
    `  kind: "image" | "video" | "color" | "text";\n` +
    `  content: string;\n` +
    `  startTime: number;\n` +
    `  videoStartSec?: number;\n` +
    `};\n` +
    `export type MikeScene = {\n` +
    `  title: string;\n` +
    `  durationSec?: number;\n` +
    `  effects: MikeEffect[];\n` +
    `};\n` +
    `export const christmasMikeScenes: MikeScene[] = ${JSON.stringify(scenes, null, 2)};\n`;
  writeFileSync(dataTsPath, body);
}

async function syncToConvex(scenes, convexUrl) {
  const client = new ConvexHttpClient(convexUrl);
  const shows = await client.query("shows:list", {});
  const christmas = shows.find((s) => s.title === "Christmas");
  if (!christmas) throw new Error("Christmas show not in Convex — run seed first");
  if (!christmas.layoutId) throw new Error("Christmas show has no layoutId");

  const layout = await client.query("designer:getLayout", {
    layoutId: christmas.layoutId,
  });
  const panelByName = new Map();
  for (const screen of layout.screens || []) {
    for (const panel of screen.panels || []) {
      panelByName.set(panel.name, panel._id);
    }
  }

  const dbScenes = await client.query("designer:getShowScenes", {
    showId: christmas._id,
  });
  const byTitle = new Map(dbScenes.map((s) => [s.title.toLowerCase(), s]));

  let created = 0;
  let deleted = 0;

  for (const scene of scenes) {
    // Export titles use slightly different casing ("I wish..." vs "I Wish...").
    const dbScene =
      byTitle.get(scene.title.toLowerCase()) ||
      [...byTitle.values()].find(
        (s) => s.title.toLowerCase() === scene.title.toLowerCase(),
      );
    if (!dbScene) {
      console.warn(`Skip missing scene: ${scene.title}`);
      continue;
    }

    const existing = await client.query("designer:getSceneEffects", {
      sceneId: dbScene._id,
    });
    for (const e of existing) {
      await client.mutation("designer:deleteEffect", { effectId: e._id });
      deleted++;
    }

    for (const effect of scene.effects) {
      const panelId = panelByName.get(effect.panelName);
      if (!panelId) {
        console.warn(`  missing panel ${effect.panelName}`);
        continue;
      }
      await client.mutation("designer:createEffect", {
        sceneId: dbScene._id,
        panelId,
        logicalPanelName: effect.logicalPanelName,
        kind: effect.kind,
        content: effect.content,
        startTime: effect.startTime,
        ...(effect.videoStartSec !== undefined
          ? { videoStartSec: effect.videoStartSec }
          : {}),
      });
      created++;
    }
    console.log(
      `${scene.title}: ${existing.length} removed → ${scene.effects.length} imported`,
    );
  }

  return { created, deleted };
}

const urlArgIdx = process.argv.indexOf("--url");
const convexUrl =
  (urlArgIdx >= 0 && process.argv[urlArgIdx + 1]) ||
  process.env.CONVEX_URL ||
  "http://127.0.0.1:3212";

const raw = JSON.parse(readFileSync(exportPath, "utf8"));
const scenes = extractScenes(raw);
writeSeedModule(scenes);
console.log(
  `Wrote ${dataTsPath} (${scenes.reduce((n, s) => n + s.effects.length, 0)} effects)`,
);

const result = await syncToConvex(scenes, convexUrl);
console.log("Sync result:", result);
