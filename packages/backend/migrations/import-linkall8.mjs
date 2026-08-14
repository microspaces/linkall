/**
 * Import LinkAll8 export JSON into a Convex deployment.
 *
 *   node packages/backend/migrations/import-linkall8.mjs --site 3 --url http://127.0.0.1:3216 --include-omega --users
 *
 * Site 1 = SurroundShow, 2 = FunFirst, 3 = RedWave.
 * Ω state/county groups are skipped unless --include-omega.
 * --users reads linkall8-users-siteN.json and follows public + home geo groups.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const exportPath = join(__dirname, "linkall8-export.json");

const siteIdx = process.argv.indexOf("--site");
const urlIdx = process.argv.indexOf("--url");
const includeOmega = process.argv.includes("--include-omega");
const importUsers = process.argv.includes("--users");
const siteId = siteIdx >= 0 ? Number(process.argv[siteIdx + 1]) : 3;
const convexUrl =
  (urlIdx >= 0 && process.argv[urlIdx + 1]) ||
  process.env.CONVEX_URL ||
  (siteId === 1
    ? "http://127.0.0.1:3212"
    : siteId === 3
      ? "http://127.0.0.1:3216"
      : "http://127.0.0.1:3214");

const raw = JSON.parse(readFileSync(exportPath, "utf8").replace(/^\uFEFF/, ""));
const allSite = (raw.groups || []).filter((g) => g.siteId === siteId);
const omega = allSite.filter(
  (g) => g.kind === "state" || g.kind === "county",
);
const groups = includeOmega
  ? allSite
  : allSite.filter((g) => g.kind !== "state" && g.kind !== "county");

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function cleanGroup(g, photoByName) {
  const { siteId: _s, ...rest } = g;
  const row = { ...rest };
  if (row.leftmenu !== 1 && row.leftmenu !== 2) delete row.leftmenu;
  if (!row.state) delete row.state;
  if (!row.county) delete row.county;
  if (!row.category) delete row.category;
  const photoUrl = photoByName.get(row.name);
  if (photoUrl) row.photoUrl = photoUrl;
  return row;
}

function toHandle(userName, used) {
  let base = String(userName || "user")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
  if (!base) base = "user";
  let handle = base;
  let n = 2;
  while (used.has(handle)) {
    handle = `${base}${n}`;
    n++;
  }
  used.add(handle);
  return handle;
}

function displayName(userName) {
  return String(userName || "Member")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TIER = { 0: "free", 1: "free", 2: "silver", 3: "gold", 4: "admin" };

const photoMapPath = join(__dirname, `linkall8-group-photos-site${siteId}.json`);
const photoByName = new Map();
if (existsSync(photoMapPath)) {
  for (const row of JSON.parse(readFileSync(photoMapPath, "utf8"))) {
    if (row.name && row.photoUrl) photoByName.set(row.name, row.photoUrl);
  }
}

const client = new ConvexHttpClient(convexUrl);
console.log(
  `Site ${siteId} -> ${convexUrl}: importing ${groups.length} groups (omega in this run: ${includeOmega ? omega.length : "skipped " + omega.length})${photoByName.size ? `, photos=${photoByName.size}` : ""}`,
);

const idMap = {};
let groupInserted = 0;
let groupUpdated = 0;
for (const batch of chunk(groups, 40)) {
  const result = await client.mutation("importLinkAll8:groups", {
    groups: batch.map((g) => cleanGroup(g, photoByName)),
  });
  groupInserted += result.inserted;
  groupUpdated += result.updated;
  Object.assign(idMap, result.idMap);
  process.stdout.write(".");
}
console.log(
  `\nGroups inserted=${groupInserted} updated=${groupUpdated} mapped=${Object.keys(idMap).length}`,
);

const mapPath = join(__dirname, `linkall8-idmap-site${siteId}.json`);
writeFileSync(mapPath, JSON.stringify(idMap, null, 2));

if (importUsers) {
  const usersPath = join(__dirname, `linkall8-users-site${siteId}.json`);
  if (!existsSync(usersPath)) {
    throw new Error(`Missing ${usersPath}. Export users first.`);
  }
  const userRows = JSON.parse(readFileSync(usersPath, "utf8").replace(/^\uFEFF/, ""));
  const usedHandles = new Set();
  const cleaned = userRows.map((u) => {
    const row = {
      legacyId: u.legacyId,
      name: displayName(u.userName),
      handle: toHandle(u.userName, usedHandles),
      tier: TIER[u.tier] || "free",
    };
    if (u.email) row.email = u.email;
    if (u.bio) row.bio = u.bio;
    if (u.zipCode) row.zipCode = String(u.zipCode).slice(0, 10);
    if (u.state) row.state = u.state;
    if (u.county) row.county = u.county;
    return row;
  });
  const userIdMap = {};
  let userInserted = 0;
  let userUpdated = 0;
  for (const batch of chunk(cleaned, 40)) {
    const result = await client.mutation("importLinkAll8:users", {
      users: batch,
    });
    userInserted += result.inserted;
    userUpdated += result.updated;
    Object.assign(userIdMap, result.idMap);
    process.stdout.write("u");
  }
  console.log(
    `\nUsers inserted=${userInserted} updated=${userUpdated} mapped=${Object.keys(userIdMap).length}`,
  );

  const convexUserIds = Object.values(userIdMap);
  let membershipJoined = 0;
  for (const batch of chunk(convexUserIds, 15)) {
    const result = await client.mutation("importLinkAll8:followPublicAndHome", {
      userIds: batch,
    });
    membershipJoined += result.joined;
    process.stdout.write("m");
  }
  console.log(`\nMemberships added=${membershipJoined}`);
  writeFileSync(
    join(__dirname, `linkall8-usermap-site${siteId}.json`),
    JSON.stringify(userIdMap, null, 2),
  );
}

console.log("Done.");
