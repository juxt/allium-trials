#!/usr/bin/env node
// Validates a weed fixture: the planted spec must be structurally valid
// (divergences are semantic drift vs the code, never syntax errors — a spec
// that fails `allium check` would test error recovery, not weeding), and the
// golden divergence fingerprints must be well-formed and non-generic.
//
// Usage: node validate.mjs <fixtureDataDir>   (dir with spec.allium + golden.json)

import { execFileSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import path from "path";

const dataDir = process.argv[2];
if (!dataDir) {
  console.error("usage: node validate.mjs <fixtureDataDir>");
  process.exit(2);
}
const specPath = path.join(dataDir, "spec.allium");
const goldenPath = path.join(dataDir, "golden.json");

const errors = [];
const warns = [];

if (!existsSync(specPath)) errors.push(`missing ${specPath}`);
let golden = null;
try {
  golden = JSON.parse(readFileSync(goldenPath, "utf8"));
} catch (e) {
  console.error(`golden.json: unreadable — ${e.message}`);
  process.exit(1);
}

if (!golden.divergences?.length) errors.push("no divergences defined");
const GENERIC = new Set(["spec", "code", "status", "state", "rule", "entity"]);
const seen = new Set();
for (const d of golden.divergences ?? []) {
  if (!d.id) errors.push(`divergence with no id: ${JSON.stringify(d).slice(0, 80)}`);
  if (seen.has(d.id)) errors.push(`duplicate divergence id '${d.id}'`);
  seen.add(d.id);
  if (!Array.isArray(d.must_all) || !d.must_all.length) errors.push(`${d.id}: empty must_all (cannot match)`);
  else if (d.must_all.every((t) => GENERIC.has(t.toLowerCase())))
    warns.push(`${d.id}: must_all is only generic terms ${JSON.stringify(d.must_all)} — may match the wrong finding`);
}

// the planted spec must carry no checker errors
if (existsSync(specPath)) {
  let out = "";
  try {
    out = execFileSync("allium", ["check", specPath], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    if (e.code === "ENOENT") {
      console.error("fatal: `allium` CLI not found on PATH — required to validate the planted spec.");
      process.exit(2);
    }
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim();
  }
  try {
    const diags = JSON.parse(out).diagnostics ?? [];
    const errs = diags.filter((d) => d.severity === "error");
    if (errs.length) errors.push(`spec has ${errs.length} checker error(s): ${errs[0].message}`);
  } catch {
    if (out.trim()) errors.push(`allium check output unparseable: ${out.slice(0, 200)}`);
  }
}

const fixtureName = path.basename(path.resolve(dataDir));
console.log(`[weed/${fixtureName}] ${(golden.divergences ?? []).length} planted divergences`);
for (const w of warns) console.log(`  WARN  ${w}`);
for (const e of errors) console.log(`  ERROR ${e}`);
console.log(`  => ${errors.length} errors, ${warns.length} warnings`);
process.exit(errors.length ? 1 : 0);
