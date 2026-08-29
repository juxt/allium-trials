#!/usr/bin/env node
// Elicit eval: does a spec in the loop make an underspecified feature more correct, by forcing
// the unknowable decisions into the open instead of guessing them? Three arms on the same
// deliberately-underspecified feature request:
//   nospec   — "implement it" (the default helpful-and-proceed disposition)
//   prose    — "write a spec, then implement" (spec-first, no formalism)
//   v4elicit — follow the Allium v4 elicit process (spec-first + formalism + refuse-to-guess)
// A blind judge scores each output against 10 hidden planted decisions: SURFACED vs GUESSED vs
// ABSENT. Value = HIGH surfaced, LOW guessed (a guess is a confident unasked requirement).
// Repeatable: fixed task, fixed rubric, K reps per arm, deterministic tally.
//
// Usage: node eval-elicit.mjs [--reps 3]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const REPS = Number((argv[argv.indexOf("--reps") + 1] ?? "3"));

const TASK = readFileSync(join(HERE, "TASK.md"), "utf8");
const RUBRIC = readFileSync(join(HERE, "RUBRIC.md"), "utf8");
const ELICIT = readFileSync("/Users/hgarner/code/allium/skills-v4/elicit/SKILL.md", "utf8");

const ARMS = {
  nospec: () =>
    `You are a senior engineer. Implement this feature, ready for production. Give your implementation plan and state the concrete behaviour and decisions your implementation will have.\n\n${TASK}`,
  prose: () =>
    `You are a senior engineer. Before you implement, write a clear specification of the intended behaviour of this feature, then summarise how you will implement it.\n\n${TASK}`,
  v4elicit: () =>
    `You are a senior engineer using the Allium v4 elicitation process below to turn a feature request into a precise specification. Follow the process exactly.\n\n=== ELICITATION PROCESS ===\n${ELICIT}\n\n=== FEATURE REQUEST ===\n${TASK}`,
};

function claude(prompt, turns = 1) {
  const args = ["-p", prompt, "--output-format", "text", "--model", MODEL, "--max-turns", String(turns),
    "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Task"];
  const r = spawnSync("claude", args, { encoding: "utf8", maxBuffer: 1 << 27, timeout: 300000 });
  return r.stdout || "";
}

function judge(output) {
  const prompt =
    `You are an impartial reviewer. A process was asked to handle a deliberately underspecified feature. ` +
    `Using ONLY the rubric below, classify how the process output handled each of the 10 planted decisions.\n\n` +
    `${RUBRIC}\n\n=== PROCESS OUTPUT TO SCORE ===\n${output}\n\n` +
    `For EACH decision D1..D10 output exactly one line: \`D<n>: SURFACED\` or \`D<n>: GUESSED\` or \`D<n>: ABSENT\`. ` +
    `Then a final line: \`TOTALS surfaced=<n> guessed=<n> absent=<n>\`. Output nothing else.`;
  const out = claude(prompt, 1);
  const counts = { SURFACED: 0, GUESSED: 0, ABSENT: 0 };
  for (const m of out.matchAll(/D\d+:\s*(SURFACED|GUESSED|ABSENT)/gi)) counts[m[1].toUpperCase()]++;
  return counts;
}

const results = {};
for (const [arm, mk] of Object.entries(ARMS)) {
  results[arm] = [];
  for (let r = 0; r < REPS; r++) {
    const suffix = `\n\nRespond directly in prose in this single reply. Do not use any tools; write your full answer as text now.${r ? `\n(attempt ${r + 1})` : ""}`;
    const out = claude(mk() + suffix, 8);
    const c = judge(out);
    results[arm].push(c);
    writeFileSync(join(HERE, `out_${arm}_${r}.txt`), out);
    console.error(`[${arm} ${r}] surfaced=${c.SURFACED} guessed=${c.GUESSED} absent=${c.ABSENT}`);
    writeFileSync(join(HERE, "elicit-result.json"), JSON.stringify(results, null, 2));
  }
}

const avg = (a, k) => (a.reduce((s, x) => s + x[k], 0) / a.length).toFixed(1);
console.log(`\n== Elicit eval: surfacing the unknowable (10 planted decisions, ${REPS} reps) ==\n`);
console.log(`arm       surfaced  guessed  absent   (mean of ${REPS})`);
for (const [arm, a] of Object.entries(results)) {
  console.log(`${arm.padEnd(9)} ${avg(a, "SURFACED").padEnd(9)} ${avg(a, "GUESSED").padEnd(8)} ${avg(a, "ABSENT")}`);
}
console.log(`\n=> higher surfaced + lower guessed = the spec-in-the-loop forcing the unknowable into the open.`);
console.log(`   nospec vs {prose,v4elicit} = does a spec help; prose vs v4elicit = does the formalism/elicit skill help.`);
