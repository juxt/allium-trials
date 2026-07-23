#!/usr/bin/env node
// Regression tests for the deterministic scorer and manifest validator —
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
const HARNESS_DIR = path.dirname(TESTS_DIR);
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

// --- scorer cases against expected.json --------------------------------------
const casesDir = path.join(TESTS_DIR, "cases");
for (const name of readdirSync(casesDir).sort()) {
  const caseDir = path.join(casesDir, name);
  const expectedPath = path.join(caseDir, "expected.json");
  if (!existsSync(expectedPath)) continue; // not a scorer case (e.g. bad-manifest)
  const proc = spawnSync(
    process.execPath,
    [path.join(HARNESS_DIR, "score.mjs"), path.join(caseDir, "spec.allium"), path.join(caseDir, "golden.json")],
    { encoding: "utf8", env: { ...process.env, PATH: STUB_PATH } }
  );
  let report;
  try {
    report = JSON.parse(proc.stdout);
  } catch {
    fail(`score/${name}`, `scorer did not emit JSON (exit ${proc.status}): ${proc.stderr?.slice(0, 300)}`);
    continue;
  }
  const expected = JSON.parse(readFileSync(expectedPath, "utf8"));
  const mismatches = Object.entries(expected)
    .filter(([k, v]) => get(report, k) !== v)
    .map(([k, v]) => `${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(get(report, k))}`);
  if (mismatches.length) fail(`score/${name}`, mismatches.join("; "));
  else ok(`score/${name}`);
}

// --- missing allium CLI must be fatal, not a silent pass ---------------------
{
  const proc = spawnSync(
    process.execPath,
    [path.join(HARNESS_DIR, "score.mjs"), path.join(casesDir, "perfect", "spec.allium"), path.join(casesDir, "perfect", "golden.json")],
    { encoding: "utf8", env: { ...process.env, PATH: "/var/empty" } }
  );
  if (proc.status !== 2) fail("score/missing-cli", `expected exit 2, got ${proc.status}`);
  else if (!/not found/.test(proc.stderr ?? "")) fail("score/missing-cli", `stderr does not explain the missing CLI: ${proc.stderr?.slice(0, 200)}`);
  else ok("score/missing-cli");
}

// --- manifest validator ------------------------------------------------------
{
  const run = (dir) => spawnSync(process.execPath, [path.join(HARNESS_DIR, "validate-manifest.mjs"), dir], { encoding: "utf8" });
  const good = run(path.join(casesDir, "perfect"));
  if (good.status !== 0) fail("validate/good-manifest", `expected exit 0, got ${good.status}: ${good.stdout}`);
  else ok("validate/good-manifest");
  const bad = run(path.join(casesDir, "bad-manifest"));
  if (bad.status === 0) fail("validate/bad-manifest", "expected non-zero exit for a transition to an undeclared state");
  else if (!/not in states/.test(bad.stdout)) fail("validate/bad-manifest", `error does not name the bad endpoint: ${bad.stdout}`);
  else ok("validate/bad-manifest");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
