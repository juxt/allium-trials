#!/usr/bin/env node
// Elicit eval, expanded: 4 arms (nospec, prose, v3elicit, v4elicit) x 2 underspecified features
// x N reps. Blind judge scores each output against that task's hidden rubric: SURFACED vs GUESSED
// vs ABSENT. Value = high surfaced, low guessed. Puts v4 against v3, prose, and none, repeatably.
//
// Usage: node eval-elicit2.mjs [--reps 3]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const REPS = Number((argv[argv.indexOf("--reps") + 1] ?? "3"));

const ELICIT_V4 = readFileSync("/Users/hgarner/code/allium/skills-v4/elicit/SKILL.md", "utf8");
const ELICIT_V3 = readFileSync("/Users/hgarner/code/allium/skills/elicit/SKILL.md", "utf8");

const TASKS = [
  { id: "A", task: readFileSync(join(HERE, "TASK.md"), "utf8"), rubric: readFileSync(join(HERE, "RUBRIC.md"), "utf8") },
  { id: "B", task: readFileSync(join(HERE, "taskB.md"), "utf8"), rubric: readFileSync(join(HERE, "rubricB.md"), "utf8") },
  { id: "C", task: readFileSync(join(HERE, "taskC.md"), "utf8"), rubric: readFileSync(join(HERE, "rubricC.md"), "utf8") },
  { id: "D", task: readFileSync(join(HERE, "taskD.md"), "utf8"), rubric: readFileSync(join(HERE, "rubricD.md"), "utf8") },
];

const SUFFIX = `\n\nRespond directly in prose in this single reply. Do not use any tools; write your full answer as text now.`;
const ARMS = {
  nospec: (t) => `You are a senior engineer. Implement this feature, ready for production. State the concrete behaviour and decisions your implementation will have.\n\n${t}`,
  prose: (t) => `You are a senior engineer. Before you implement, write a clear specification of the intended behaviour of this feature, then summarise how you will implement it.\n\n${t}`,
  v3elicit: (t) => `You are a senior engineer using the Allium elicitation process below to turn a feature request into a precise specification. Follow the process exactly.\n\n=== ELICITATION PROCESS ===\n${ELICIT_V3}\n\n=== FEATURE REQUEST ===\n${t}`,
  v4elicit: (t) => `You are a senior engineer using the Allium v4 elicitation process below to turn a feature request into a precise specification. Follow the process exactly.\n\n=== ELICITATION PROCESS ===\n${ELICIT_V4}\n\n=== FEATURE REQUEST ===\n${t}`,
};

function claude(prompt, turns) {
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL, "--max-turns", String(turns),
    "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Task"], { encoding: "utf8", maxBuffer: 1 << 27, timeout: 300000 });
  return r.stdout || "";
}
function judge(rubric, output) {
  const prompt = `You are an impartial reviewer. A process was asked to handle a deliberately underspecified feature. ` +
    `Using ONLY the rubric below, classify how the process output handled each of the 10 planted decisions.\n\n${rubric}\n\n` +
    `=== PROCESS OUTPUT TO SCORE ===\n${output}\n\nFor EACH decision D1..D10 output exactly one line: \`D<n>: SURFACED\` or \`D<n>: GUESSED\` or \`D<n>: ABSENT\`. Output nothing else.`;
  const out = claude(prompt, 2);
  const c = { SURFACED: 0, GUESSED: 0, ABSENT: 0 };
  for (const m of out.matchAll(/D\d+:\s*(SURFACED|GUESSED|ABSENT)/gi)) c[m[1].toUpperCase()]++;
  return c;
}

const results = {}; // arm -> list of {task, rep, counts}
for (const T of TASKS) {
  for (const [arm, mk] of Object.entries(ARMS)) {
    results[arm] ||= [];
    for (let r = 0; r < REPS; r++) {
      const out = claude(mk(T.task) + SUFFIX + (r ? `\n(attempt ${r + 1})` : ""), 8);
      const c = judge(T.rubric, out);
      results[arm].push({ task: T.id, rep: r, ...c });
      writeFileSync(join(HERE, `out2_${T.id}_${arm}_${r}.txt`), out);
      console.error(`[task ${T.id} | ${arm} ${r}] surfaced=${c.SURFACED} guessed=${c.GUESSED} absent=${c.ABSENT}`);
      writeFileSync(join(HERE, "elicit-result2.json"), JSON.stringify(results, null, 2));
    }
  }
}

const mean = (a, k) => (a.reduce((s, x) => s + x[k], 0) / a.length).toFixed(1);
console.log(`\n== Elicit eval (expanded): ${TASKS.length} tasks x ${REPS} reps, 10 decisions each ==\n`);
console.log(`arm        surfaced  guessed  absent`);
for (const [arm, a] of Object.entries(results)) {
  console.log(`${arm.padEnd(10)} ${mean(a, "SURFACED").padEnd(9)} ${mean(a, "GUESSED").padEnd(8)} ${mean(a, "ABSENT")}`);
}
console.log(`\nPer task:`);
for (const T of TASKS) {
  console.log(` task ${T.id}: ` + Object.entries(results).map(([arm, a]) => { const s = a.filter((x) => x.task === T.id); return `${arm}=${mean(s, "SURFACED")}/${mean(s, "GUESSED")}`; }).join("  ") + "  (surfaced/guessed)");
}
console.log(`\n=> nospec vs prose = does any spec help; {v3,v4}elicit vs prose = does the elicit skill help; v4 vs v3 = version delta.`);
