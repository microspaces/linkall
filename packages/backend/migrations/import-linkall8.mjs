/**
 * Import LinkAll8 export JSON into a Convex deployment.
 *
 *   node packages/backend/migrations/import-linkall8.mjs --site 2 --url https://....convex.cloud
 *   node packages/backend/migrations/import-linkall8.mjs --site 3 --url http://127.0.0.1:3216
 *
 * Site 1 = SurroundShow, 2 = FunFirst, 3 = RedWave.
 * Never writes shows/screens/layouts/panels.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const exportPath = join(__dirname, "linkall8-export.json");

const siteIdx = process.argv.indexOf("--site");
const urlIdx = process.argv.indexOf("--url");
const siteId = siteIdx >= 0 ? Number(process.argv[siteIdx + 1]) : 2;
const convexUrl =
  (urlIdx >= 0 && process.argv[urlIdx + 1]) ||
  process.env.CONVEX_URL ||
  (siteId === 1
    ? "http://127.0.0.1:3212"
    : siteId === 3
      ? "http://127.0.0.1:3216"
      : "http://127.0.0.1:3214");

const raw = JSON.parse(readFileSync(exportPath, "utf8").replace(/^\uFEFF/, ""));
const groups = (raw.groups || []).filter((g) => g.siteId === siteId);
const performances = siteId === 2 ? raw.performances || [] : [];
const groupIds = new Set(groups.map((g) => g.legacyId));
const posts = (raw.posts || []).filter(
  (p) => !p.legacyGroupId || groupIds.has(p.legacyGroupId),
);

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const client = new ConvexHttpClient(convexUrl);
console.log(
  `Site ${siteId} -> ${convexUrl}: ${groups.length} groups, ${performances.length} performances, ${posts.length} posts`,
);

const idMap = {};
let groupInserted = 0;
let groupUpdated = 0;
for (const batch of chunk(groups, 80)) {
  const cleaned = batch.map(({ siteId: _s, ...g }) => {
    const row = { ...g };
    if (row.leftmenu !== 1 && row.leftmenu !== 2) delete row.leftmenu;
    if (!row.state) delete row.state;
    if (!row.county) delete row.county;
    if (!row.category) delete row.category;
    return row;
  });
  const result = await client.mutation("importLinkAll8:groups", {
    groups: cleaned,
  });
  groupInserted += result.inserted;
  groupUpdated += result.updated;
  Object.assign(idMap, result.idMap);
  process.stdout.write(".");
}
console.log(
  `\nGroups inserted=${groupInserted} updated=${groupUpdated} mapped=${Object.keys(idMap).length}`,
);

if (performances.length) {
  let perfInserted = 0;
  let perfSkipped = 0;
  for (const batch of chunk(performances, 5)) {
    const result = await client.mutation("importLinkAll8:performances", {
      performances: batch,
    });
    perfInserted += result.inserted;
    perfSkipped += result.skipped;
    process.stdout.write("p");
  }
  console.log(`\nPerformances inserted=${perfInserted} skipped=${perfSkipped}`);
}

if (posts.length) {
  let postInserted = 0;
  for (const batch of chunk(posts, 50)) {
    const result = await client.mutation("importLinkAll8:posts", {
      posts: batch.map((p) => ({
        content: p.content,
        ...(p.legacyGroupId && idMap[p.legacyGroupId]
          ? { groupId: idMap[p.legacyGroupId] }
          : {}),
      })),
    });
    postInserted += result.inserted;
    process.stdout.write("c");
  }
  console.log(`\nPosts inserted=${postInserted}`);
}

const mapPath = join(__dirname, `linkall8-idmap-site${siteId}.json`);
writeFileSync(mapPath, JSON.stringify(idMap, null, 2));
console.log("Done. Show/screen/layout rows were not modified.");
