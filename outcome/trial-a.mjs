#!/usr/bin/env node
// Trial A — elicit → build quality.
//
// Measures the quality of code produced via Allium versus a no-Allium baseline,
// against a HIDDEN acceptance suite the loop never sees.
//
//  0. operator: an operator agent reads the hidden acceptance suite and writes a
//     prose requirements brief (behaviours, invariants, failure modes; NO test
//     code). This is the stakeholder's knowledge. Cached.
//  1. allium arm:  elicit(brief) → Allium spec;  build(spec ONLY) → ledger.py + tests.
//  2. baseline arm: build(brief ONLY, no plugin) → ledger.py + tests.
//  3. score: run the hidden acceptance suite against each arm's ledger.py.
//
// The batch brief is a headless approximation of the interactive operator answering
// the elicit loop; the fully interactive version is a later refinement. Each phase
// spawns `claude` (slow). Use --model to pick a faster model, --skip-operator to
// reuse a cached brief.

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = process.env.ALLIUM_PLUGIN || "/Users/hgarner/code/allium";
const SYS = join(HERE, "systems", "ledger");
const ACCEPTANCE = join(SYS, "acceptance");
const RUNS = join(HERE, "runs", "trial-a");

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MODEL = opt("--model", "claude-opus-4-8");
const MAX_TURNS = opt("--max-turns", "60");
const skipOperator = argv.includes("--skip-operator");

function claude(prompt, cwd, { plugin = true } = {}) {
  const args = ["-p", prompt, "--output-format", "stream-json", "--verbose",
    "--model", MODEL, "--max-turns", MAX_TURNS, "--permission-mode", "bypassPermissions",
    "--setting-sources", "project"];
  if (plugin) args.push("--plugin-dir", PLUGIN);
  spawnSync("claude", args, { cwd, encoding: "utf8", maxBuffer: 1 << 28, timeout: 900000, killSignal: "SIGKILL" });
}
const reset = (d) => { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); };

// Run the hidden acceptance suite against an implementation dir. Returns {tests, passed, failed}.
function score(implDir) {
  const r = spawnSync("python3", ["-m", "unittest", "discover", "-s", ACCEPTANCE, "-p", "test_*.py"],
    { encoding: "utf8", env: { ...process.env, PYTHONPATH: implDir } });
  const out = (r.stderr || "") + (r.stdout || "");
  const total = Number((out.match(/Ran (\d+) tests/) || [])[1] || 0);
  const fails = Number((out.match(/failures=(\d+)/) || [])[1] || 0);
  const errs = Number((out.match(/errors=(\d+)/) || [])[1] || 0);
  const runnable = total > 0;
  return { tests: total, failed: fails + errs, passed: runnable ? total - fails - errs : 0, runnable };
}

// --- 0. operator brief -------------------------------------------------------
const briefDir = join(RUNS, "operator");
const brief = join(briefDir, "brief.md");
if (!skipOperator || !existsSync(brief)) {
  reset(briefDir);
  cpSync(ACCEPTANCE, join(briefDir, "acceptance"), { recursive: true });
  console.log("• operator writing requirements brief from the hidden suite …");
  claude(
    "You are the operator / stakeholder. Read the acceptance tests under acceptance/ and write brief.md: a " +
    "natural-language requirements brief for this system — its purpose, the operations, the invariants that must " +
    "always hold, and the failure modes (what must be rejected). Describe BEHAVIOUR in prose a stakeholder would " +
    "give. Do NOT include any test code, assertions, or Python — only prose requirements. Work autonomously.",
    briefDir, { plugin: false });
  if (!existsSync(brief)) { console.error("  operator produced no brief.md — aborting"); process.exit(1); }
}
console.log("• brief:", brief, `(${readFileSync(brief, "utf8").length} bytes)`);

// --- 1. allium arm: elicit → spec, then build from spec only -----------------
const aElicit = join(RUNS, "allium", "elicit");
reset(aElicit);
cpSync(brief, join(aElicit, "brief.md"));
mkdirSync(join(aElicit, "spec"), { recursive: true });
console.log("• allium: elicit spec from brief …");
claude(
  "Use the elicit skill to produce an Allium specification at spec/ledger.allium. The stakeholder's requirements " +
  "are in brief.md — treat brief.md as the answers to every question the elicit skill would ask, and do not ask " +
  "the user anything. Write the finished spec to spec/ledger.allium.",
  aElicit);
const aSpec = join(aElicit, "spec", "ledger.allium");

const aBuild = join(RUNS, "allium", "build");
reset(aBuild);
mkdirSync(join(aBuild, "spec"), { recursive: true });
if (existsSync(aSpec)) cpSync(aSpec, join(aBuild, "spec", "ledger.allium"));
console.log("• allium: build implementation from the spec only …");
claude(
  "Implement the system as ledger.py in the current directory, exposing a `Ledger` class, plus a test file. " +
  "Work ONLY from the Allium specification in spec/ledger.allium. Do not ask questions.",
  aBuild);

// --- 2. baseline arm: build from brief only, no Allium -----------------------
const bBuild = join(RUNS, "baseline", "build");
reset(bBuild);
cpSync(brief, join(bBuild, "brief.md"));
console.log("• baseline: build implementation from the brief only (no Allium) …");
claude(
  "Implement the system as ledger.py in the current directory, exposing a `Ledger` class, plus a test file. " +
  "Work from the requirements in brief.md. Do not ask questions.",
  bBuild, { plugin: false });

// --- 3. score both against the hidden acceptance suite -----------------------
const allium = score(aBuild);
const baseline = score(bBuild);
const summary = { trial: "A", system: "ledger", model: MODEL,
  allium: { ...allium, spec_produced: existsSync(aSpec) }, baseline };
writeFileSync(join(RUNS, "summary.json"), JSON.stringify(summary, null, 2));
console.log("\nTrial A — elicit→build quality (hidden acceptance suite):");
const pct = (s) => s.runnable ? `${s.passed}/${s.tests} (${Math.round(100 * s.passed / s.tests)}%)` : "impl did not run";
console.log(`  Allium arm   : ${pct(allium)}   spec produced: ${existsSync(aSpec)}`);
console.log(`  Baseline arm : ${pct(baseline)}`);
console.log(`(model ${MODEL}; batch-brief approximation of the interactive operator)`);
