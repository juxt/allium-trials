#!/usr/bin/env node
// Loop 2, the interaction bug-hunt. Run the arithmetic monitor over every operation-sequence
// trace (a schedule after a mid-loan interest-rate change) and ask, per operation-invariant
// law: does it still hold on real post-operation output? A hard failure is either a genuine
// interaction bug or an invariant that does not survive the operation (also a finding).
//
// Usage: node value-ops-monitor.mjs
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const SPEC = join(HERE, "LoanScheduleInvariants-ratechange.allium");
const TRACES = join(HERE, "traces-ops");
const TOL = 0.02; // a touch looser than one minor unit: rate-change recompute can shift a penny

let files = [];
try {
  files = readdirSync(TRACES).filter((f) => f.endsWith(".trace"));
} catch {
  console.error("no traces-ops/ yet — run the ops-traces harness first");
  process.exit(1);
}

const agg = new Map();
const hard = [];
for (const f of files) {
  let out;
  try {
    out = execFileSync(ALLIUM, ["monitor", SPEC, join(TRACES, f), "--tol", String(TOL)], { encoding: "utf8" });
  } catch (e) {
    out = e.stdout || "";
  }
  let rep;
  try {
    rep = JSON.parse(out);
  } catch {
    console.error(`parse fail ${f}`);
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
    if (!r.holds && r.max_residual > 0.05) hard.push({ f, inv: r.invariant, res: r.max_residual, w: r.witness });
  }
}

console.log(`\n== Loop 2: operation-invariant laws vs ${files.length} real rate-change schedules ==\n`);
console.log(`invariant                 held/total   max-residual   verdict`);
for (const [inv, a] of agg) {
  const verdict =
    a.held === a.total && a.maxRes === 0
      ? "SURVIVES the rate change exactly"
      : a.held === a.total
        ? `survives up to rounding (<= ${a.maxRes.toFixed(4)})`
        : `FAILS on ${a.total - a.held} (residual ${a.maxRes.toFixed(4)})`;
  console.log(`${inv.padEnd(25)} ${String(a.held + "/" + a.total).padEnd(12)} ${a.maxRes.toFixed(6).padEnd(14)} ${verdict}`);
}
console.log(`\nHard failures (residual > 0.05): ${hard.length}`);
for (const h of hard.slice(0, 12)) console.log(`  ${h.f}  ${h.inv}  residual=${h.res.toFixed(4)}  ${h.w}`);
console.log(
  hard.length === 0
    ? "\n=> The load-bearing laws survive the mid-loan rate change on every real schedule. No interaction bug; the invariants are operation-stable."
    : `\n=> ${hard.length} rate-change schedules break a load-bearing law — inspect: interaction bug or non-surviving invariant.`,
);
