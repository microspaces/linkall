import { selfCheck } from "./convex/sceneCues.ts";

const err = selfCheck();
if (err) {
  console.error("sceneCues self-check FAILED:", err);
  process.exit(1);
}
console.log("sceneCues self-check OK");
