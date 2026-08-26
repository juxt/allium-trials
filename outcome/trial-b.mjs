#!/usr/bin/env node
// Trial B — distill → bug detection (weed-style).
//
// 1. Distill the CORRECT ledger codebase into an Allium spec (the golden spec).
// 2. For each planted-bug variant, run the weed skill to audit that spec against
//    the buggy code, and check whether the planted bug shows up as a divergence.
// 3. Report the bug-detection rate.
//
// This is the tractable, works-today measure (spec-as-oracle catches code drift).
// The DEEPER measure — distill+analyse of the buggy code self-identifying the
// invariant violation with no separate oracle — needs the v4 analyse layer (4c)
// and is added later.
//
// Each step spawns `claude` with the Allium plugin, exactly as trials/*/run.mjs
// does. Runs are slow; use --bugs to restrict, --model to pick a faster model.

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = process.env.ALLIUM_PLUGIN || "/Users/hgarner/code/allium";
const SYS = join(HERE, "systems", "ledger");
const RUNS = join(HERE, "runs", "trial-b");

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MODEL = opt("--model", "claude-opus-4-8");
const MAX_TURNS = opt("--max-turns", "50");
const onlyBugs = opt("--bugs", null)?.split(",");
const skipDistill = argv.includes("--skip-distill");

// A planted bug counts as detected if weed reports a divergence that mentions one
// of these signals (keyword match — crude but deterministic; an LLM judge can
// replace it later).
const SIGNALS = {
  "overdraft-in-withdraw": ["withdraw", "negative", "overdraft", "insufficient", "below zero", "non-negative"],
  "non-atomic-transfer": ["atomic", "conserv", "created", "before", "rollback", "both legs"],
  "same-account-allowed": ["same account", "same-account", "self-transfer", "src == dst", "identical"],
};

function claude(prompt, cwd) {
  const r = spawnSync("claude", [
    "-p", prompt,
    "--output-format", "stream-json",
    "--verbose",
    "--model", MODEL,
    "--max-turns", MAX_TURNS,
    "--permission-mode", "bypassPermissions",
    "--plugin-dir", PLUGIN,
    "--setting-sources", "project",
  ], { cwd, encoding: "utf8", maxBuffer: 1 << 28, timeout: 900000, killSignal: "SIGKILL" });
  return { code: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function reset(dir) { rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true }); }

// --- 1. Distill the correct codebase into a spec -----------------------------
const specDir = join(RUNS, "spec");
const specFile = join(specDir, "ledger.allium");
if (!skipDistill || !existsSync(specFile)) {
  const ws = join(RUNS, "distill");
  reset(ws);
  cpSync(join(SYS, "codebase"), ws, { recursive: true });
  mkdirSync(join(ws, "spec"), { recursive: true });
  console.log("• distilling correct ledger → spec …");
  claude(
    "Use the distill skill to extract an Allium specification from the codebase in the current directory. " +
    "Write the finished specification to spec/ledger.allium. Work fully autonomously: do not ask questions; " +
    "where the skill says to ask the user or validate with stakeholders, make the best-supported choice from the code instead.",
    ws
  );
  reset(specDir);
  const produced = join(ws, "spec", "ledger.allium");
  if (existsSync(produced)) cpSync(produced, specFile);
  else { console.error("  distill produced no spec/ledger.allium — aborting"); process.exit(1); }
}
console.log("• golden spec:", specFile, `(${readFileSync(specFile, "utf8").length} bytes)`);

// --- 2. Weed each buggy variant against the spec -----------------------------
const bugs = readdirSync(join(SYS, "bugs")).filter((b) => !onlyBugs || onlyBugs.includes(b)).sort();
const results = [];
for (const bug of bugs) {
  const ws = join(RUNS, "weed", bug);
  reset(ws);
  cpSync(join(SYS, "bugs", bug), ws, { recursive: true });   // the buggy code
  mkdirSync(join(ws, "spec"), { recursive: true });
  cpSync(specFile, join(ws, "spec", "ledger.allium"));       // the golden spec
  console.log(`• weeding ${bug} …`);
  claude(
    "Use the weed skill to audit the Allium specification in spec/ledger.allium against the implementation " +
    "in the current directory. Work fully autonomously: do not ask questions, do not modify the spec or code. " +
    "Write your findings to weed-report.md: one '## ' section per divergence (what the spec says, what the code does, where). " +
    "If spec and code fully agree, write exactly '## No divergences found'.",
    ws
  );
  const report = existsSync(join(ws, "weed-report.md")) ? readFileSync(join(ws, "weed-report.md"), "utf8") : "";
  const lc = report.toLowerCase();
  const foundDivergence = report.trim() !== "" && !lc.includes("no divergences found");
  const sig = (SIGNALS[bug] || []).some((s) => lc.includes(s.toLowerCase()));
  const detected = foundDivergence && sig;
  results.push({ bug, foundDivergence, matchedSignal: sig, detected, reportBytes: report.length });
  console.log(`    → ${detected ? "DETECTED" : foundDivergence ? "divergence, but not the planted bug" : "MISSED (no divergence)"}`);
}

// --- 3. Report ---------------------------------------------------------------
const n = results.length, hit = results.filter((r) => r.detected).length;
const summary = { trial: "B", system: "ledger", model: MODEL, bugs: n, detected: hit, results };
writeFileSync(join(RUNS, "summary.json"), JSON.stringify(summary, null, 2));
console.log(`\nTrial B — distill→bug-detection: ${hit}/${n} planted bugs detected (model ${MODEL})`);
console.log("(weed-style spec-as-oracle; the deeper distill+analyse self-detection awaits v4 4c)");
