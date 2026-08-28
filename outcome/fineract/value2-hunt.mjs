#!/usr/bin/env node
// Value 2 — property-based divergence hunt. Run the arithmetic schedule monitor over EVERY
// real Fineract trace and ask, per distilled invariant: does it hold on real output, and
// exactly or only up to rounding? A hard failure (residual well past a rounding unit) is a
// genuine divergence: either a bug in the code or an over-strong invariant in the spec.
//
// Usage: node value2-hunt.mjs
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const SPEC = join(HERE, "LoanScheduleInvariants.allium");
const TRACES = join(HERE, "traces");
const ROUNDING_TOL = 0.005; // half a minor unit
const HARD = 0.05; // a residual past this is not mere rounding

const files = readdirSync(TRACES).filter((f) => f.endsWith(".trace"));
const agg = new Map(); // invariant -> {held, total, maxRes, worst}
const hardFails = [];

for (const f of files) {
  let out;
  try {
    out = execFileSync(ALLIUM, ["monitor-schedule", SPEC, join(TRACES, f), "--tol", String(ROUNDING_TOL)], {
      encoding: "utf8",
    });
  } catch (e) {
    out = e.stdout || ""; // non-zero exit on violation still prints the report
  }
  let rep;
  try {
    rep = JSON.parse(out);
  } catch {
    console.error(`parse fail ${f}: ${out.slice(0, 80)}`);
    continue;
  }
  for (const r of rep.results) {
    const a = agg.get(r.invariant) || { held: 0, total: 0, maxRes: 0, worst: "" };
    a.total++;
    if (r.holds) a.held++;
    if (r.max_residual > a.maxRes) {
      a.maxRes = r.max_residual;
      a.worst = `${f}: ${r.witness}`;
    }
    agg.set(r.invariant, a);
    if (!r.holds && r.max_residual > HARD) hardFails.push({ f, inv: r.invariant, res: r.max_residual, w: r.witness });
  }
}

console.log(`\n== Value 2: distilled invariants vs ${files.length} real Fineract schedules ==\n`);
console.log(`invariant                 held/total   max-residual   verdict`);
for (const [inv, a] of agg) {
  const verdict =
    a.held === a.total && a.maxRes === 0
      ? "EXACT law"
      : a.held === a.total
        ? `holds up to rounding (<= ${a.maxRes.toFixed(4)})`
        : `FAILS on ${a.total - a.held} (residual ${a.maxRes.toFixed(4)})`;
  console.log(`${inv.padEnd(25)} ${String(a.held + "/" + a.total).padEnd(12)} ${a.maxRes.toFixed(6).padEnd(14)} ${verdict}`);
}
console.log(`\nHard divergences (residual > ${HARD}, i.e. not rounding): ${hardFails.length}`);
for (const h of hardFails.slice(0, 12)) console.log(`  ${h.f}  ${h.inv}  residual=${h.res.toFixed(4)}  ${h.w}`);
console.log(
  hardFails.length === 0
    ? "\n=> No code bug surfaced: the load-bearing laws hold on every real schedule (exactly or up to a rounding unit)."
    : `\n=> ${hardFails.length} schedules diverge beyond rounding — inspect: code bug or over-strong invariant.`,
);
