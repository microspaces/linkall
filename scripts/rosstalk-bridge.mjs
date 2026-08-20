/**
 * RossTalk bridge: drain pending scene command effects to a Ross Video
 * switcher over TCP (port 7788, CRLF-terminated ASCII).
 *
 * HyperX 3-key rig (placeholders — change in packages/backend/convex/rossRig.ts,
 * documented in scripts/ROSS_RIG.md):
 *   Big screen dest     ME:1:PGM     gaming IN:5 / camera IN:6
 *   KEY 1 full overlay  ME:1:KEY:1   full-frame overlay page
 *   KEY 2 lower third   ME:1:KEY:2   title / host
 *   KEY 3 top corners   ME:1:KEY:3   score bugs
 * Fills come from linkall overlay observables, not Media Store stills.
 *
 *   ROSSTALK_DRY_RUN=1 node scripts/rosstalk-bridge.mjs
 *   ROSSTALK_HOST=10.0.0.10 node scripts/rosstalk-bridge.mjs
 *
 * Env:
 *   CONVEX_URL          (else VITE_CONVEX_URL / NEXT_PUBLIC_CONVEX_URL,
 *                        else discovered from app and backend .env files)
 *   ROSSTALK_HOST       required unless dry-run
 *   ROSSTALK_PORT       default 7788
 *   ROSSTALK_DRY_RUN    1 / true → log and mark sent, no socket
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexClient } from "convex/browser";
import { anyApi } from "convex/server";

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
    if (entry.isDirectory()) {
      walkEnvFiles(full, acc);
    } else if (entry.isFile() && entry.name.startsWith(".env")) {
      acc.push(full);
    }
  }
}

function urlFromMap(map) {
  return (
    map.CONVEX_URL ||
    map.VITE_CONVEX_URL ||
    map.NEXT_PUBLIC_CONVEX_URL ||
    ""
  ).trim();
}

function discoverConvexUrl() {
  const fromEnv = urlFromMap(process.env);
  if (fromEnv) return { url: fromEnv, source: "process.env" };

  const files = [];
  const backendEnv = path.join(ROOT, "packages", "backend");
  for (const name of [".env.local", ".env.funfirst", ".env"]) {
    const p = path.join(backendEnv, name);
    if (fs.existsSync(p)) files.push(p);
  }
  walkEnvFiles(path.join(ROOT, "apps"), files);

  const candidates = [];
  for (const file of files) {
    const url = urlFromMap(parseEnvFile(file));
    if (url) candidates.push({ url, source: path.relative(ROOT, file) });
  }
  const cloud = candidates.find((c) => c.url.includes(".convex.cloud"));
  if (cloud) return cloud;
  if (candidates[0]) return candidates[0];
  return { url: "", source: "" };
}

function isDryRun(value) {
  const v = (value ?? "").toString().trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function sendRossTalk(host, port, command) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    let reply = "";
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve(reply);
    };
    socket.setEncoding("utf8");
    socket.setTimeout(2000);
    socket.on("connect", () => {
      socket.write(`${command}\r\n`);
      setTimeout(() => finish(), 150);
    });
    socket.on("data", (chunk) => {
      reply += chunk;
    });
    socket.on("timeout", () => finish());
    socket.on("error", (err) => finish(err));
    socket.on("close", () => finish());
  });
}

const { url: convexUrl, source: urlSource } = discoverConvexUrl();
const dryRun = isDryRun(process.env.ROSSTALK_DRY_RUN);
const host = (process.env.ROSSTALK_HOST ?? "").trim();
const port = Number(process.env.ROSSTALK_PORT) || 7788;

if (!convexUrl) {
  console.error(
    "Missing CONVEX_URL (or VITE_CONVEX_URL / NEXT_PUBLIC_CONVEX_URL).",
  );
  process.exit(1);
}
if (!dryRun && !host) {
  console.error("ROSSTALK_HOST is required unless ROSSTALK_DRY_RUN=1.");
  process.exit(1);
}

log("RossTalk bridge starting");
log(`convex=${convexUrl} (from ${urlSource || "env"})`);
log(`mode=${dryRun ? "dry-run" : "live"}`);
if (!dryRun) log(`host=${host}`);
log(`port=${port}`);

const client = new ConvexClient(convexUrl, { unsavedChangesWarning: false });

let shuttingDown = false;
let busy = false;
let latest = [];
const inflight = new Set();

async function complete(id, error) {
  await client.mutation(anyApi.sceneCommands.completeSceneCommand, {
    id,
    ...(error ? { error } : {}),
  });
}

async function handle(row) {
  const label = `${row.command}  (show=${row.showId} scene=${row.sceneId})`;
  try {
    if (dryRun) {
      log(`DRY RUN would send: ${label}`);
      await complete(row._id);
      log(`marked sent (dry-run) id=${row._id}`);
      return;
    }
    log(`sending ${label}`);
    const reply = await sendRossTalk(host, port, row.command);
    if (reply.trim()) log(`reply: ${reply.trim()}`);
    await complete(row._id);
    log(`marked sent id=${row._id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`ERROR ${label}: ${message}`);
    try {
      await complete(row._id, message);
      log(`marked error id=${row._id}`);
    } catch (completeErr) {
      const cm =
        completeErr instanceof Error ? completeErr.message : String(completeErr);
      log(`failed to mark error id=${row._id}: ${cm}`);
    }
  }
}

async function pump() {
  if (busy || shuttingDown) return;
  busy = true;
  try {
    while (!shuttingDown) {
      const next = latest.find((row) => !inflight.has(row._id));
      if (!next) break;
      inflight.add(next._id);
      await handle(next);
    }
  } finally {
    busy = false;
  }
}

const unsubscribe = client.onUpdate(
  anyApi.sceneCommands.pendingSceneCommands,
  {},
  (rows) => {
    latest = Array.isArray(rows) ? rows : [];
    log(`pending queue: ${latest.length}`);
    void pump();
  },
  (err) => {
    log(`subscribe error: ${err.message}`);
  },
);

log("subscribed to pendingSceneCommands");

const unsubConn = client.subscribeToConnectionState((state) => {
  if (state.hasEverConnected) {
    log(
      `websocket ${state.isWebSocketConnected ? "connected" : "disconnected"} (connections=${state.connectionCount})`,
    );
  }
});

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`shutting down (${signal})`);
  try {
    unsubscribe();
  } catch {
    /* ignore */
  }
  try {
    unsubConn();
  } catch {
    /* ignore */
  }
  try {
    await client.close();
  } catch {
    /* ignore */
  }
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
