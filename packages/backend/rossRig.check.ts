import { commandsForScene, selfCheck } from "./convex/rossRig.ts";

const err = selfCheck();
if (err) {
  console.error("rossRig self-check FAILED:", err);
  process.exit(1);
}
console.log("rossRig self-check OK");

const examples: Array<{ title: string; note: string; isSoundEffect?: boolean }> =
  [
    { title: "Intro", note: "host / camera" },
    { title: "Bring the Boom", note: "gameplay" },
    { title: "Vote", note: "full overlay + corners" },
    { title: "Score", note: "score / corners" },
    { title: "Outro", note: "host / camera" },
    { title: "BringTheFun", note: "audio (no commands)", isSoundEffect: true },
  ];

for (const example of examples) {
  const cmds = commandsForScene(example.title, {
    isSoundEffect: example.isSoundEffect,
  });
  console.log(`\n# ${example.title}  (${example.note})`);
  if (cmds.length === 0) {
    console.log("(none)");
    continue;
  }
  for (const cmd of cmds) console.log(cmd);
}
