#!/usr/bin/env node
// Regression tests for the trial scorers and fixture validators —
// the load-bearing components a shared benchmark cannot afford to let drift.
//
// Hermetic and free: a stub `allium` (tests/stub-bin/) serves canned
// check/model JSON from sidecar files, so no real CLI or API calls are made.
//
// Usage: node tests/run-tests.mjs

import { spawnSync } from "child_process";
import { readdirSync, readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.dirname(TESTS_DIR);
const STUB_PATH = `${path.join(TESTS_DIR, "stub-bin")}${path.delimiter}${process.env.PATH}`;

let passed = 0;
let failed = 0;
const fail = (name, msg) => {
  failed++;
  console.log(`FAIL  ${name}: ${msg}`);
};
const ok = (name) => {
  passed++;
  console.log(`ok    ${name}`);
};

const get = (obj, dotted) => dotted.split(".").reduce((o, k) => o?.[k], obj);

// runs a scorer case dir against expected.json; scorerArgs maps the case dir
// to the scorer argv
const scoreCase = (trial, name, caseDir, scorerArgs) => {
  const proc = spawnSync(process.execPath, scorerArgs(caseDir), {
    encoding: "utf8",
    env: { ...process.env, PATH: STUB_PATH },
  });
  let report;
  try {
    report = JSON.parse(proc.stdout);
  } catch {
    fail(`${trial}/${name}`, `scorer did not emit JSON (exit ${proc.status}): ${proc.stderr?.slice(0, 300)}`);
    return;
  }
  const expected = JSON.parse(readFileSync(path.join(caseDir, "expected.json"), "utf8"));
  const mismatches = Object.entries(expected)
    .filter(([k, v]) => get(report, k) !== v)
    .map(([k, v]) => `${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(get(report, k))}`);
  if (mismatches.length) fail(`${trial}/${name}`, mismatches.join("; "));
  else ok(`${trial}/${name}`);
};

const casesFor = (trial) => {
  const dir = path.join(TESTS_DIR, "cases", trial);
  return readdirSync(dir)
    .sort()
    .map((name) => [name, path.join(dir, name)])
    .filter(([, caseDir]) => existsSync(path.join(caseDir, "expected.json")));
};

// --- distill scorer ----------------------------------------------------------
const distillScore = path.join(REPO_DIR, "trials", "distill", "score.mjs");
for (const [name, caseDir] of casesFor("distill")) {
  scoreCase("distill", name, caseDir, (d) => [distillScore, path.join(d, "spec.allium"), path.join(d, "golden.json")]);
}

// --- weed scorer -------------------------------------------------------------
const weedScore = path.join(REPO_DIR, "trials", "weed", "score.mjs");
for (const [name, caseDir] of casesFor("weed")) {
  scoreCase("weed", name, caseDir, (d) => [weedScore, path.join(d, "report.md"), path.join(d, "golden.json")]);
}

// --- missing allium CLI must be fatal for the distill scorer -----------------
{
  const caseDir = path.join(TESTS_DIR, "cases", "distill", "perfect");
  const proc = spawnSync(
    process.execPath,
    [distillScore, path.join(caseDir, "spec.allium"), path.join(caseDir, "golden.json")],
    { encoding: "utf8", env: { ...process.env, PATH: "/var/empty" } }
  );
  if (proc.status !== 2) fail("distill/missing-cli", `expected exit 2, got ${proc.status}`);
  else if (!/not found/.test(proc.stderr ?? "")) fail("distill/missing-cli", `stderr does not explain the missing CLI: ${proc.stderr?.slice(0, 200)}`);
  else ok("distill/missing-cli");
}

// --- distill manifest validator ----------------------------------------------
{
  const validator = path.join(REPO_DIR, "trials", "distill", "validate-manifest.mjs");
  const run = (goldenPath) => spawnSync(process.execPath, [validator, goldenPath], { encoding: "utf8" });
  const good = run(path.join(TESTS_DIR, "cases", "distill", "perfect", "golden.json"));
  if (good.status !== 0) fail("distill/validate-good", `expected exit 0, got ${good.status}: ${good.stdout}`);
  else ok("distill/validate-good");
  const bad = run(path.join(TESTS_DIR, "cases", "distill", "bad-manifest", "golden.json"));
  if (bad.status === 0) fail("distill/validate-bad", "expected non-zero exit for a transition to an undeclared state");
  else if (!/not in states/.test(bad.stdout)) fail("distill/validate-bad", `error does not name the bad endpoint: ${bad.stdout}`);
  else ok("distill/validate-bad");
}

// --- weed fixture validator --------------------------------------------------
{
  const validator = path.join(REPO_DIR, "trials", "weed", "validate.mjs");
  // weed test case dirs carry golden.json but no spec.allium; the validator
  // must reject the missing spec (and this exercises the golden checks
  // without needing the allium CLI)
  const res = spawnSync(process.execPath, [validator, path.join(TESTS_DIR, "cases", "weed", "full-recall")], { encoding: "utf8" });
  if (res.status === 0) fail("weed/validate-missing-spec", "expected non-zero exit when spec.allium is absent");
  else if (!/missing/.test(res.stdout)) fail("weed/validate-missing-spec", `error does not mention the missing spec: ${res.stdout}`);
  else ok("weed/validate-missing-spec");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
