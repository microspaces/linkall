import { selfCheck } from "./convex/venueLogic.ts";

const err = selfCheck();
if (err) {
  console.error("venue logic self-check FAILED:", err);
  process.exit(1);
}
console.log("venue logic self-check OK");
