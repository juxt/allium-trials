#!/usr/bin/env node
// Trial D — reimplement from spec (spec as a stand-alone artefact).
//
// Distil the correct code into an Allium spec, then reimplement the system FROM
// SCRATCH given ONLY that spec plus minimal non-functionals — no original source.
// Score the reimplementation against the hidden acceptance suite. The pass rate is
// a measure of how far the spec stands alone as the complement of the code.
//
// Low scores are informative, not a failure. Each phase spawns `claude`.

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = process.env.ALLIUM_PLUGIN || "/Users/hgarner/code/allium";
const SYS = join(HERE, "systems", "ledger");
const ACCEPTANCE = join(SYS, "acceptance");
const RUNS = join(HERE, "runs", "trial-d");

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MODEL = opt("--model", "claude-opus-4-8");
const MAX_TURNS = opt("--max-turns", "60");
// Reuse a distilled spec from a prior Trial B run if present, else distil fresh.
const REUSE = opt("--reuse-spec", join(HERE, "runs", "trial-b", "spec", "ledger.allium"));

// Non-functionals given alongside the spec (deliberately minimal).
const NONFUNCTIONALS = " Non-functionals: Python 3, no external dependencies, amounts are " +
  "non-negative integer minor units (no floating point). The `Ledger` class must expose: " +
  "open(account_id); balance(account_id); accounts(); total(); deposit(account_id, amount); " +
  "withdraw(account_id, amount); transfer(src, dst, amount).";

function claude(prompt, cwd, { plugin = true } = {}) {
  const args = ["-p", prompt, "--output-format", "stream-json", "--verbose",
    "--model", MODEL, "--max-turns", MAX_TURNS, "--permission-mode", "bypassPermissions",
    "--setting-sources", "project"];
  if (plugin) args.push("--plugin-dir", PLUGIN);
  spawnSync("claude", args, { cwd, encoding: "utf8", maxBuffer: 1 << 28, timeout: 900000, killSignal: "SIGKILL" });
}
const reset = (d) => { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); };

function score(implDir) {
  const r = spawnSync("python3", ["-m", "unittest", "discover", "-s", ACCEPTANCE, "-p", "test_*.py"],
    { encoding: "utf8", env: { ...process.env, PYTHONPATH: implDir } });
  const out = (r.stderr || "") + (r.stdout || "");
  const total = Number((out.match(/Ran (\d+) tests/) || [])[1] || 0);
  const fails = Number((out.match(/failures=(\d+)/) || [])[1] || 0);
  const errs = Number((out.match(/errors=(\d+)/) || [])[1] || 0);
  return { tests: total, failed: fails + errs, passed: total > 0 ? total - fails - errs : 0, runnable: total > 0 };
}

// --- 1. obtain the distilled spec -------------------------------------------
const specFile = join(RUNS, "ledger.allium");
reset(RUNS);
if (existsSync(REUSE)) {
  cpSync(REUSE, specFile);
  console.log("• reusing distilled spec:", REUSE);
} else {
  const ws = join(RUNS, "distill");
  reset(ws);
  cpSync(join(SYS, "codebase"), ws, { recursive: true });
  mkdirSync(join(ws, "spec"), { recursive: true });
  console.log("• distilling correct ledger → spec …");
  claude("Use the distill skill to extract an Allium specification from the codebase in the current " +
    "directory. Write it to spec/ledger.allium. Work fully autonomously; do not ask questions.", ws);
  const produced = join(ws, "spec", "ledger.allium");
  if (!existsSync(produced)) { console.error("  distill produced no spec — aborting"); process.exit(1); }
  cpSync(produced, specFile);
}

// --- 2. reimplement from the spec ONLY --------------------------------------
const build = join(RUNS, "reimpl");
reset(build);
mkdirSync(join(build, "spec"), { recursive: true });
cpSync(specFile, join(build, "spec", "ledger.allium"));
console.log("• reimplementing from the spec only …");
claude(
  "Reimplement this system from scratch as ledger.py in the current directory, exposing a `Ledger` class. " +
  "You do NOT have the original source code. Work ONLY from the Allium specification in spec/ledger.allium." +
  NONFUNCTIONALS + " Do not ask questions.",
  build);

// --- 3. score against the hidden acceptance suite ---------------------------
const s = score(build);
writeFileSync(join(RUNS, "summary.json"), JSON.stringify({ trial: "D", system: "ledger", model: MODEL, reimpl: s }, null, 2));
const pct = s.runnable ? `${s.passed}/${s.tests} (${Math.round(100 * s.passed / s.tests)}%)` : "impl did not run";
console.log(`\nTrial D — reimplement-from-spec fidelity (hidden acceptance suite): ${pct}`);
console.log("(measures the spec as a stand-alone artefact — the complement of the code)");
