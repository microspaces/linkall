import puppeteer from "puppeteer";
import fs from "fs";

const outDir = "c:/Users/AI/Repos/linkall/test-screenshots";
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const results = [];

function pass(step, ok, extra = {}) {
  results.push({ step, ok, ...extra });
  console.log(`${ok ? "PASS" : "FAIL"} — ${step}`, extra);
}

// 1) /screens picker
await page.goto("http://localhost:3001/screens", {
  waitUntil: "networkidle2",
  timeout: 60000,
});
await page.waitForFunction(
  () => document.body.innerText.includes("Select a screen"),
  { timeout: 30000 },
);
const pickerText = await page.evaluate(() => document.body.innerText);
pass(
  "picker loads with layouts",
  ["HOME FRONT", "HYPERX ARENA", "LIVING ROOM"].every((t) =>
    pickerText.includes(t),
  ),
);
await page.screenshot({ path: `${outDir}/screens-test-1-picker.png` });

// 2) open Garage
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
  page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.innerText.includes("Garage"),
    );
    btn.click();
  }),
]);
pass(
  "navigate to /screens/{id}",
  /\/screens\/[^/]+/.test(page.url()),
  { url: page.url() },
);
await page.waitForFunction(
  () => document.body.innerText.includes("Garage"),
  { timeout: 15000 },
);
await new Promise((r) => setTimeout(r, 600));

// 3) ensure Setup panel open
const setupOpen = await page.evaluate(() =>
  document.body.innerText.includes("SHOW"),
);
if (!setupOpen) {
  await page.click('button[aria-label="Screen setup"]');
  await new Promise((r) => setTimeout(r, 400));
}
const panelText = await page.evaluate(() => document.body.innerText);
pass(
  "setup has Show control",
  panelText.includes("SHOW") && /select a show/i.test(panelText),
);
pass(
  "setup has Screen control",
  /SCREEN/i.test(panelText),
);

// 4) select a show → Display profile appears
const showOptions = await page.$$eval("select", (selects) => {
  const show = selects[0];
  return [...show.options].map((o) => ({ value: o.value, text: o.text }));
});
const pick =
  showOptions.find((o) => o.value && /christmas/i.test(o.text)) ||
  showOptions.find((o) => o.value);
if (pick) {
  await page.select("select", pick.value);
  await new Promise((r) => setTimeout(r, 900));
  const after = await page.evaluate(() => document.body.innerText);
  pass("select show", true, { show: pick.text });
  pass(
    "display profile appears after show",
    /display profile/i.test(after),
  );
} else {
  pass("select show", false, { reason: "no show options" });
  pass("display profile appears after show", false);
}
await page.screenshot({ path: `${outDir}/screens-test-2-setup.png` });

// 5) back to /screens
const hasLink = await page.$('a[href="/screens"]');
if (hasLink) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
    hasLink.click(),
  ]);
  const lastUsed = await page.evaluate(() =>
    document.body.innerText.includes("last used"),
  );
  pass("return to /screens picker", page.url().includes("/screens"), {
    url: page.url(),
    lastUsed,
  });
  await page.screenshot({
    path: `${outDir}/screens-test-3-last-used.png`,
  });
} else {
  pass("return to /screens picker", false, { reason: "no /screens link" });
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log("\n" + (failed.length ? `FAILED ${failed.length}` : "ALL PASSED"));
process.exit(failed.length ? 1 : 0);
