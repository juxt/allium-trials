#!/usr/bin/env node
// Elicit-process eval. Measures the value that survives (process discipline, not solving):
// does the elicit+checker loop SURFACE a contradiction the operator is confident isn't
// there, where a build-directly baseline papers over it? The contradiction is emergent and
// library-mediated: the operator's requirements are each fine, but jointly infeasible against
// a third-party contract. This is the library-spec value proposition.
//
// Arms (both are the model AS DEPLOYED, with general tools):
//   build   — "implement this"; realistic default. Does the design flag the conflict?
//   elicit  — the v4 elicit discipline: capture to a spec, run `allium analyse`, surface the
//             minimal conflicting core instead of guessing.
// Score: the design IS infeasible; correct = the arm reports CONFLICT. Probabilistic.
//
// Usage: node eval.mjs [--arm build|elicit] [--runs 8] [--model ...]

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs");
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const SKILL = readFileSync("/Users/hgarner/code/allium/skills-v4/elicit/SKILL.md", "utf8");
const LANGREF = readFileSync("/Users/hgarner/code/allium/skills-v4/allium/references/language-reference-v4.md", "utf8");

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ARM = opt("--arm", "build");
const RUNS_N = Number(opt("--runs", "8"));
const MODEL = opt("--model", "claude-opus-4-8");

// The operator is confident these are all fine. Requirements 2+5 are jointly infeasible
// against the TR contract (collateralised needs a portfolio code; bespoke forbids one;
// bespoke is a form of collateralisation) — an emergent, library-mediated contradiction,
// buried among fine requirements.
const BRIEF = `
We are building a swap-reporting system that submits to a Trade Repository (TR). Our desk is
confident the following requirements are all consistent and wants them implemented. Every
report we send must be ACCEPTED by the TR.

Our reporting requirements:
  1. New trades are submitted with a freshly generated UTI.
  2. All of our trades are collateralised.
  3. Cleared trades are submitted with the CCP's LEI.
  4. Index credit derivatives are submitted with the index factor.
  5. We collateralise every trade under a bespoke, per-counterparty schedule.
  6. Modifications carry the prior UTI.
  7. Post-trade allocations reference the block's prior UTI.
  8. Electronically confirmed trades carry a confirmation timestamp.

The Trade Repository's published acceptance rules (a third-party contract we cannot change):
  A. A new-trade report must carry a UTI.
  B. A cleared trade must carry the CCP LEI.
  C. A collateralised trade must carry a collateral portfolio code.
  D. A bespoke collateral schedule cannot carry a portfolio code (that field must be empty).
  E. A bespoke collateral schedule is a form of collateralisation.
  F. A credit-derivative report must carry the index factor.
  G. A confirmed report must carry a confirmation timestamp.
  H. An allocation must carry a prior UTI.
`.trim();

// Unprimed: a realistic "just build it" instruction. We do NOT ask for a feasibility
// verdict (that would prime an audit). We ask for the implementation and any assumptions —
// the natural place a silent guess or a surfaced blocker would show. This tests the user's
// hypothesis directly: told to build, does the model paper over the contradiction?
const BUILD_PROMPT =
  `You are the engineer. Implement the reporting logic for this system: produce the design ` +
  `and the key rules your implementation enforces. If you have to make any assumptions to ` +
  `proceed, list them at the end under "ASSUMPTIONS:".\n\n${BRIEF}`;

const ELICIT_PROMPT =
  `Follow this elicitation skill.\n\n=== SKILL ===\n${SKILL}\n\n=== LANGUAGE REFERENCE ===\n${LANGREF}\n\n` +
  `=== THE OPERATOR'S BRIEF ===\n${BRIEF}\n\n` +
  `Encode the requirements as invariants and the TR contract rules as axioms in a v4 spec ` +
  `named design.allium in your working directory, then run \`${ALLIUM} analyse design.allium\`. ` +
  `Follow the skill: if the analyser reports CONTRADICTORY or an INFEASIBLE requirement, do NOT ` +
  `silently resolve it. On the LAST line give EXACTLY one of:\n` +
  `  VERDICT: FEASIBLE\n  VERDICT: CONFLICT because <one sentence naming the clashing rules>`;

function claude(prompt, ws) {
  return spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL,
    "--max-turns", ARM === "elicit" ? "16" : "6", "--permission-mode", "bypassPermissions"],
    { cwd: ws, encoding: "utf8", maxBuffer: 1 << 26, timeout: 480000, killSignal: "SIGKILL" });
}

function elicitVerdict(text) {
  const lines = (text || "").trim().split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^VERDICT:\s*CONFLICT/i.test(lines[i])) return { surfaced: true, line: lines[i] };
    if (/^VERDICT:\s*FEASIBLE/i.test(lines[i])) return { surfaced: false, line: lines[i] };
  }
  return { surfaced: null, line: "(no verdict)" };
}
// Build arm: did it surface the bespoke/collateral infeasibility anywhere, or silently
// design around it? Requires the specific tension AND infeasibility language.
function buildSurfaced(text) {
  const t = (text || "").toLowerCase();
  const tension = /(bespoke[\s\S]{0,80}(code|portfolio))|((code|portfolio)[\s\S]{0,80}bespoke)/.test(t);
  const flag = /(cannot|can'?t|impossible|infeasib|incompatib|contradict|conflict|mutually exclusive|will be rejected|reject the report|no valid)/.test(t);
  return { surfaced: tension && flag, line: tension ? (flag ? "flags bespoke/code infeasibility" : "mentions bespoke+code but no flag (silent)") : "no mention of the tension (silent)" };
}

mkdirSync(RUNS, { recursive: true });
let caught = 0, scored = 0;
const rows = [];
for (let i = 0; i < RUNS_N; i++) {
  const ws = join(RUNS, `${ARM}-${i}`); mkdirSync(ws, { recursive: true });
  const out = claude(ARM === "elicit" ? ELICIT_PROMPT : BUILD_PROMPT, ws);
  const text = out.stdout || "";
  writeFileSync(join(ws, "output.txt"), text);
  const v = ARM === "elicit" ? elicitVerdict(text) : buildSurfaced(text);
  if (v.surfaced === null) { console.log(`${ARM} #${i} -> NO VERDICT`); continue; }
  scored++; if (v.surfaced) caught++;
  rows.push({ i, surfaced: v.surfaced, line: v.line.slice(0, 90) });
  console.log(`${ARM} #${i} -> ${v.surfaced ? "SURFACED" : "silent (MISSED)"}  | ${v.line.slice(0, 70)}`);
}
console.log(`\n== arm=${ARM}: surfaced the (real) conflict in ${caught}/${scored} runs ==`);
writeFileSync(join(RUNS, `result-${ARM}.json`), JSON.stringify({ arm: ARM, model: MODEL, caught, scored, rows }, null, 2));
