#!/usr/bin/env node
// Spec-grounded safe evolution — arguably the central AI-coding promise: ship a new feature
// without silently breaking existing behaviour. We test whether the spec, by making the
// SALIENT behaviours explicit, lets the AI tell load-bearing from incidental and preserve it.
//
// The feature (a `supersede` correction) forces a refactor of the report-creation path, so
// the subtle existing behaviours (below-threshold-submitted, rebook-idempotent, trade-time
// timestamp, amend-queue, cancel-noop, UTI uniqueness) are genuinely at risk.
//
//   nospec — evolve with only the code
//   spec   — evolve grounded in ReportEngine.allium (the salient behaviours to preserve)
// Score: the hidden suite (test_report_engine.py) run on the AI's edited engine; regressions
// = original behaviours broken. Usage: node evolution.mjs [--arm nospec|spec] [--runs 5]

import { spawnSync } from "node:child_process";
import { mkdirSync, cpSync, existsSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs");
const ENGINE = join(HERE, "..", "distill-v4", "report_engine.py");
const SUITE = join(HERE, "test_report_engine.py");
const SPEC = join(HERE, "ReportEngine.allium");
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ARM = opt("--arm", "nospec");
const N = Number(opt("--runs", "5"));
const MODEL = opt("--model", "claude-opus-4-8");

const FEATURE =
  `report_engine.py is a trade-reporting engine. Add a new method ` +
  `supersede(self, trade_id, **fields): it issues a CORRECTION — a new report that supersedes ` +
  `the latest report for the trade, carries that report's UTI as its 'prior', and preserves ` +
  `the trade's original trade time. To keep the code clean, refactor new_trade, amend and ` +
  `supersede so they build their report through ONE shared internal helper. Edit ` +
  `report_engine.py in place.`;

function claude(prompt, cwd) {
  return spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL,
    "--max-turns", "24", "--permission-mode", "bypassPermissions", "--setting-sources", "project"],
    { cwd, encoding: "utf8", maxBuffer: 1 << 28, timeout: 600000, killSignal: "SIGKILL" });
}

function runSuite(implDir) {
  const r = spawnSync("python3", ["-m", "pytest", SUITE, "-q", "--no-header", "-p", "no:cacheprovider"],
    { encoding: "utf8", env: { ...process.env, IMPL_DIR: implDir }, maxBuffer: 1 << 26 });
  const out = (r.stdout || "") + (r.stderr || "");
  const passed = Number((out.match(/(\d+) passed/) || [])[1] || 0);
  const failed = Number((out.match(/(\d+) failed/) || [])[1] || 0);
  const errors = Number((out.match(/(\d+) error/) || [])[1] || 0);
  // which tests failed (behaviour ids)
  const failedIds = [...out.matchAll(/test_(\w+)\s+FAILED|FAILED[^\n]*::test_(\w+)/g)].map((m) => m[1] || m[2]);
  return { passed, failed: failed + errors, failedIds, broke: passed < 9 };
}

rmSync(join(RUNS, ARM), { recursive: true, force: true });
mkdirSync(join(RUNS, ARM), { recursive: true });
let totalRegressions = 0, catastrophic = 0, featureAdded = 0, scored = 0;
const rows = [];
for (let i = 0; i < N; i++) {
  const ws = join(RUNS, ARM, `${i}`); mkdirSync(ws, { recursive: true });
  cpSync(ENGINE, join(ws, "report_engine.py"));
  let prompt = FEATURE;
  if (ARM === "spec") { cpSync(SPEC, join(ws, "ReportEngine.allium")); prompt = `The file ReportEngine.allium specifies the behaviours this engine MUST preserve — read it first, and ensure every one still holds after your change.\n\n${FEATURE}`; }
  claude(prompt, ws);
  const engineFile = readFileSync(join(ws, "report_engine.py"), "utf8");
  const hasFeature = /def\s+supersede\s*\(/.test(engineFile);
  if (hasFeature) featureAdded++;
  const res = runSuite(ws);
  scored++;
  totalRegressions += res.failed;
  if (res.broke && res.passed === 0) catastrophic++;
  rows.push({ i, hasFeature, passed: res.passed, failed: res.failed, failedIds: res.failedIds });
  console.log(`${ARM} #${i}: feature=${hasFeature ? "yes" : "NO"}  suite ${res.passed}/9 passed  regressions=${res.failed} [${res.failedIds.join(",")}]`);
}
console.log(`\n== arm=${ARM} over ${scored} runs ==`);
console.log(`  feature added: ${featureAdded}/${scored}`);
console.log(`  total regressions (behaviours broken): ${totalRegressions}  (avg ${(totalRegressions / scored).toFixed(1)}/run)`);
console.log(`  clean runs (9/9 preserved): ${rows.filter((r) => r.failed === 0).length}/${scored}`);
writeFileSync(join(RUNS, `result-${ARM}.json`), JSON.stringify({ arm: ARM, scored, featureAdded, totalRegressions, rows }, null, 2));
