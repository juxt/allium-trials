#!/usr/bin/env node
// B4 — brownfield surfacing: on an underspecified change to EXISTING code, does the spec/elicit
// process surface the human decisions the code cannot answer, instead of guessing them?
//
// Greenfield surfacing is already proven judge-robust (elicit >> prose >> none; prose worse than
// none). The brownfield question: with existing code/conventions available to infer from, does the
// surfacing value survive, or does the code answer the decisions so the gap closes? The change here
// is genuinely NEW policy that the existing late-fee code does not determine.
//
// Arms: nospec (implement) / prose (spec then implement) / v4elicit (the elicit process). A blind
// judge scores each planted decision SURFACED / GUESSED / ABSENT against a hidden rubric.
// Usage: node eval-surface.mjs [--reps 3]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const REPS = Number(argv[argv.indexOf("--reps") + 1] ?? "3");
const ELICIT = readFileSync("/Users/hgarner/code/allium/skills-v4/elicit/SKILL.md", "utf8");

const CONTEXT = `Existing system (Apache Fineract, loan servicing). Today: when a repayment instalment is not paid by its due date, a late-payment penalty begins to accrue immediately from the due date, per the loan product's penalty charge configuration (a fixed amount or a percentage). Penalties post to the ledger like any other charge. Delinquency classification and reporting key off days-past-due from the due date.`;

const CHANGE = `Change request from the product team: "Add a late-payment grace period so borrowers aren't penalised the instant they're a day late."`;

const RUBRIC = `# Judge rubric — planted decisions the EXISTING CODE does NOT determine (JUDGE ONLY)
The change "add a late-payment grace period" is underspecified. These are genuine policy decisions a
responsible process must settle with the human; none is fixed by the current code. For each, classify
the output: SURFACED (asks / flags as open / records as a decision to confirm), GUESSED (silently
picks one option and proceeds), or ABSENT (not addressed).
D1 Grace length and its default (e.g. 3/5/10 days) and unit.
D2 Calendar days or business days.
D3 Per-instalment or per-loan (does each missed instalment get its own grace?).
D4 Does grace SUPPRESS penalty accrual entirely, or only DEFER the start of accrual.
D5 If payment misses the grace window, is the penalty charged from the original due date (retroactive)
   or only from grace-end.
D6 Interaction with the existing penalty charge config (override it, stack, or replace).
D7 Scope of configuration: global, per-loan-product, or per-loan.
D8 Grandfathering: does it apply to existing active loans or only new ones.
D9 Effect on delinquency / NPL classification and regulatory reporting (does days-past-due now count
   from due date or from grace-end).
D10 Borrower notification/communication during the grace window.`;

const SUFFIX = `\n\nRespond directly in prose in this single reply. Do not use any tools; write your full answer now.`;
const ARMS = {
  nospec: () => `You are a senior engineer. Implement this change, ready for production. State the concrete behaviour and the decisions your implementation makes.\n\n=== SYSTEM ===\n${CONTEXT}\n\n=== CHANGE ===\n${CHANGE}`,
  prose: () => `You are a senior engineer. Before you implement, write a clear specification of the intended behaviour of this change, then summarise how you will implement it.\n\n=== SYSTEM ===\n${CONTEXT}\n\n=== CHANGE ===\n${CHANGE}`,
  v4elicit: () => `You are a senior engineer using the Allium v4 elicitation process below to turn this change request into a precise specification. Follow the process exactly.\n\n=== ELICITATION PROCESS ===\n${ELICIT}\n\n=== SYSTEM ===\n${CONTEXT}\n\n=== CHANGE ===\n${CHANGE}`,
};

function claude(prompt, turns) {
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL, "--max-turns", String(turns),
    "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,Task,Agent,WebFetch,WebSearch"], { encoding: "utf8", maxBuffer: 1 << 27, timeout: 300000 });
  return r.stdout || "";
}
function judge(output) {
  const prompt = `You are an impartial reviewer. A process handled a deliberately underspecified change to an existing system. Using ONLY the rubric, classify how the output handled each planted decision.\n\n${RUBRIC}\n\n=== PROCESS OUTPUT ===\n${output}\n\nFor EACH decision D1..D10 output exactly one line: \`D<n>: SURFACED\` or \`D<n>: GUESSED\` or \`D<n>: ABSENT\`. Nothing else.`;
  const out = claude(prompt, 2);
  const c = { SURFACED: 0, GUESSED: 0, ABSENT: 0 };
  for (const m of out.matchAll(/D\d+:\s*(SURFACED|GUESSED|ABSENT)/gi)) c[m[1].toUpperCase()]++;
  return c;
}

const results = {};
for (const [arm, mk] of Object.entries(ARMS)) {
  results[arm] = [];
  for (let r = 0; r < REPS; r++) {
    const out = claude(mk() + SUFFIX + (r ? `\n(attempt ${r + 1})` : ""), 8);
    writeFileSync(join(HERE, `sf_${arm}_${r}.txt`), out);
    const c = judge(out);
    results[arm].push({ rep: r, ...c });
    console.error(`[${arm} ${r}] surfaced=${c.SURFACED} guessed=${c.GUESSED} absent=${c.ABSENT}`);
    writeFileSync(join(HERE, "surface-result.json"), JSON.stringify(results, null, 2));
  }
}
const mean = (a, k) => (a.reduce((s, x) => s + x[k], 0) / a.length).toFixed(1);
console.log(`\n== B4 brownfield surfacing (1 Fineract change, ${REPS} reps, 10 decisions) ==\n`);
console.log(`arm        surfaced  guessed  absent`);
for (const [arm, a] of Object.entries(results)) console.log(`${arm.padEnd(10)} ${mean(a,"SURFACED").padEnd(9)} ${mean(a,"GUESSED").padEnd(8)} ${mean(a,"ABSENT")}`);
console.log(`\n=> does elicit surface the new-policy decisions while nospec/prose guess them, on a brownfield change?`);
