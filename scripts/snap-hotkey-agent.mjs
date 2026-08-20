/**
 * Laptop agent: drain hotkey effects and send them as OS keystrokes
 * so Snap Camera can change lenses. Run on the same machine as Snap Camera.
 *
 *   CONVEX_URL=https://….convex.cloud node scripts/snap-hotkey-agent.mjs
 *
 * Windows uses System.Windows.Forms.SendKeys. macOS uses osascript.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ConvexClient } from "convex/browser";
import { anyApi } from "convex/server";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function parseEnvFile(filePath) {
  const out = {};
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    return out;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function walkEnvFiles(dir, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkEnvFiles(full, acc);
    else if (entry.isFile() && entry.name.startsWith(".env")) acc.push(full);
  }
}

function discoverConvexUrl() {
  if (process.env.CONVEX_URL) return process.env.CONVEX_URL;
  const files = [];
  walkEnvFiles(ROOT, files);
  for (const f of files) {
    const map = parseEnvFile(f);
    const url =
      map.CONVEX_URL ||
      map.NEXT_PUBLIC_CONVEX_URL ||
      map.VITE_CONVEX_URL;
    if (url) return url;
  }
  return null;
}

function toSendKeys(spec) {
  const parts = spec
    .toLowerCase()
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  let mods = "";
  let key = "";
  for (const p of parts) {
    if (p === "ctrl" || p === "control") mods += "^";
    else if (p === "alt") mods += "%";
    else if (p === "shift") mods += "+";
    else if (p === "win" || p === "meta" || p === "cmd") mods += "^";
    else key = p.length === 1 ? p : `{${p.toUpperCase()}}`;
  }
  return mods + (key || "");
}

async function sendHotkey(spec) {
  const platform = process.platform;
  if (platform === "win32") {
    const send = toSendKeys(spec);
    const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${send.replace(/'/g, "''")}')`;
    await execFileAsync("powershell.exe", ["-NoProfile", "-Command", ps]);
    return;
  }
  const parts = spec.toLowerCase().split("+").map((p) => p.trim());
  const key = parts.pop() || "";
  const mods = parts
    .map((p) => {
      if (p === "ctrl" || p === "control") return "control down";
      if (p === "alt") return "option down";
      if (p === "shift") return "shift down";
      if (p === "cmd" || p === "meta") return "command down";
      return "";
    })
    .filter(Boolean);
  const using = mods.length ? ` using {${mods.join(", ")}}` : "";
  const script = `tell application "System Events" to keystroke "${key}"${using}`;
  await execFileAsync("osascript", ["-e", script]);
}

const convexUrl = discoverConvexUrl();
if (!convexUrl) {
  console.error("Set CONVEX_URL");
  process.exit(1);
}

log(`snap-hotkey-agent convex=${convexUrl}`);
const client = new ConvexClient(convexUrl, { unsavedChangesWarning: false });

const inflight = new Set();

const unsubscribe = client.onUpdate(
  anyApi.sceneCommands.pendingHotkeyCommands,
  {},
  (rows) => {
    const list = Array.isArray(rows) ? rows : [];
    for (const row of list) {
      if (inflight.has(row._id)) continue;
      inflight.add(row._id);
      const spec = String(row.hotkey || "");
      void (async () => {
        try {
          log(`hotkey ${spec}`);
          await sendHotkey(spec);
          await client.mutation(anyApi.sceneCommands.completeHotkeyCommand, {
            id: row._id,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log(`ERROR ${spec}: ${message}`);
          await client.mutation(anyApi.sceneCommands.completeHotkeyCommand, {
            id: row._id,
            error: message,
          });
        } finally {
          inflight.delete(row._id);
        }
      })();
    }
  },
  (err) => log(`subscribe error: ${err.message}`),
);

log("listening for hotkey effects");
process.on("SIGINT", () => {
  try {
    unsubscribe();
  } catch {
    /* ignore */
  }
  process.exit(0);
});
