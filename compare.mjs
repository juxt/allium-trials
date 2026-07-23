#!/usr/bin/env node
// Compares two harness result labels and evaluates the quality guardrail.
//
// Usage: node compare.mjs <baseline-label> <candidate-label>
//
// Prints a median (min–max) table for cost/token/turn metrics and recall,
// then evaluates the floor rule from the README: a token win is only valid if
// no valid candidate run drops below the baseline's quality floor — recall
// held (per-metric min >= baseline min), no new confabulation, no new
// exclusion leaks. Exits 1 if the guardrail is broken, so it can gate CI.
//
// Stats are recomputed from the raw per-run rows in summary.json, so this
// works on results produced by older harness versions too.

import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const [baseLabel, candLabel] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!baseLabel || !candLabel) {
  console.error("usage: node compare.mjs <baseline-label> <candidate-label>");
  process.exit(2);
}

const load = (label) => {
  const p = path.join(HARNESS_DIR, "results", label, "summary.json");
  if (!existsSync(p)) {
    console.error(`no summary.json for label '${label}' (${p})`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(p, "utf8"));
};
const base = load(baseLabel);
const cand = load(candLabel);

// summaries written before the trial abstraction carry no trial name
const trialName = base.trial ?? "distill";
const trial = await import(path.join(HARNESS_DIR, "trials", trialName, "trial.mjs"));

// comparability warnings — differing setups make the numbers apples-to-oranges
const warnIfDiffers = (what, a, b) => {
  if (a != null && b != null && JSON.stringify(a) !== JSON.stringify(b))
    console.log(`WARN  ${what} differs: baseline=${JSON.stringify(a)} candidate=${JSON.stringify(b)}`);
};
warnIfDiffers("trial", base.trial ?? "distill", cand.trial ?? "distill");
warnIfDiffers("fixture", base.fixture, cand.fixture);
warnIfDiffers("model", base.model, cand.model);
warnIfDiffers("fixture hash", base.provenance?.fixture_sha256, cand.provenance?.fixture_sha256);
warnIfDiffers("claude CLI", base.provenance?.claude_version, cand.provenance?.claude_version);
warnIfDiffers("allium CLI", base.provenance?.allium_version, cand.provenance?.allium_version);

const validRuns = (s) => (s.runs ?? []).filter((r) => r.ok);
const bValid = validRuns(base);
const cValid = validRuns(cand);
console.log(`\nvalid runs: ${baseLabel} ${bValid.length}/${(base.runs ?? []).length}, ${candLabel} ${cValid.length}/${(cand.runs ?? []).length}`);
if (bValid.length < 3 || cValid.length < 3) {
  console.log("WARN  fewer than 3 valid runs on one side — medians are noisy, treat the comparison as indicative only");
}
if (!bValid.length || !cValid.length) {
  console.error("cannot compare: one side has no valid runs");
  process.exit(1);
}

const stat = (xs) => {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = v.length >> 1;
  const median = v.length % 2 ? v[mid] : +((v[mid - 1] + v[mid]) / 2).toFixed(4);
  return { median, min: v[0], max: v[v.length - 1] };
};

const totalInput = (r) => {
  const t = r.tokens ?? {};
  const parts = [t.input, t.cache_creation, t.cache_read].filter((x) => x != null);
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
};
const METRICS = [
  { name: "cost_usd", get: (r) => r.cost_usd, digits: 2 },
  { name: "total_input_tokens", get: totalInput, digits: 0 },
  { name: "output_tokens", get: (r) => r.tokens?.output, digits: 0 },
  { name: "num_turns", get: (r) => r.num_turns, digits: 0 },
  ...trial.qualityMetrics.map((m) => ({ name: m, get: (r) => r.quality?.[m], digits: 3 })),
];

const round = (x, digits) => (x == null ? null : +x.toFixed(digits));
const fmt = (s, digits) =>
  s == null ? "n/a" : `${round(s.median, digits)} (${round(s.min, digits)}–${round(s.max, digits)})`;
const rows = [["metric", baseLabel, candLabel, "Δ median"]];
for (const m of METRICS) {
  const b = stat(bValid.map(m.get));
  const c = stat(cValid.map(m.get));
  let delta = "n/a";
  if (b?.median != null && c?.median != null && b.median !== 0) {
    const pct = ((c.median - b.median) / b.median) * 100;
    delta = `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
  }
  rows.push([m.name, fmt(b, m.digits), fmt(c, m.digits), delta]);
}
const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
console.log();
for (const r of rows) console.log(r.map((cell, i) => String(cell).padEnd(widths[i] + 2)).join(""));

// --- quality guardrail (floor rule) -----------------------------------------
const problems = [];
for (const name of trial.guardrailFloors) {
  const bFloor = stat(bValid.map((r) => r.quality?.[name]))?.min;
  const cFloor = stat(cValid.map((r) => r.quality?.[name]))?.min;
  if (bFloor != null && cFloor != null && cFloor < bFloor - 1e-9) {
    problems.push(`${name} floor dropped: ${bFloor} -> ${cFloor}`);
  }
}
if (trial.extraGuardrails) problems.push(...trial.extraGuardrails(bValid, cValid));
const passes = (runs) => runs.filter((r) => r.quality?.quality_pass).length;
console.log(`\nquality_pass: ${baseLabel} ${passes(bValid)}/${bValid.length}, ${candLabel} ${passes(cValid)}/${cValid.length}`);

if (problems.length) {
  console.log("\nguardrail BROKEN — a token win at this quality is a regression, not an improvement:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("\nguardrail HELD: no valid candidate run drops below the baseline's quality floor");
