import { selfCheck } from "./dual-calib.ts";

const err = selfCheck();
if (err) {
  console.error("dual-calib self-check FAILED:", err);
  process.exit(1);
}
console.log("dual-calib self-check OK");
