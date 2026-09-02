import { selfCheck } from "./convex/filterCues.ts";

const err = selfCheck();
if (err) {
  console.error("filterCues self-check FAILED:", err);
  process.exit(1);
}
console.log("filterCues self-check OK");
