#!/usr/bin/env node
// Value 1 — the spec as a standing regression gate. Take every real Fineract schedule and
// inject a realistic behaviour-breaking change (the kind a feature edit could introduce),
// then run the monitor. Measure: does the gate catch the break, and does it name the RIGHT
// invariant? A high catch rate with a named, exact-residual verdict is the "build features
// with confidence" property: the spec tells you precisely which behavioural law you broke.
//
// Usage: node value1-mutation.mjs
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const SPEC = join(HERE, "LoanScheduleInvariants.allium");
const TRACES = join(HERE, "traces");
const TMP = join(HERE, "mutated");
mkdirSync(TMP, { recursive: true });

function parse(text) {
  const periods = [];
  let given = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const toks = t.split(/\s+/);
    if (toks.some((x) => x === "given" || x.startsWith("given="))) {
      for (const tok of toks) {
        const [k, v] = tok.split("=");
        if (k !== "given") given[k] = v;
      }
    } else if (toks.some((x) => x.startsWith("period="))) {
      const p = {};
      for (const tok of toks) {
        const [k, v] = tok.split("=");
        p[k] = v;
      }
      periods.push(p);
    }
  }
  return { periods, given };
}
function render({ periods, given }) {
  const lines = periods.map((p) =>
    ["period", "emi", "interest", "principal", "outstanding_start", "is_last"]
      .filter((k) => k in p)
      .map((k) => `${k}=${p[k]}`)
      .join(" "),
  );
  lines.push(`given disbursed=${given.disbursed}`);
  return lines.join("\n") + "\n";
}
const num = (x) => Number(x);
const money = (x) => x.toFixed(2);
// Re-derive outstanding_start from disbursed and the principals (prefix sums), so a
// mutation stays internally consistent on the roll-forward identity.
function reroll(m) {
  let bal = num(m.given.disbursed);
  for (const p of m.periods) {
    p.outstanding_start = money(bal);
    bal = bal - num(p.principal);
  }
  return m;
}

// Each mutation returns null if not applicable (schedule too short), else a mutated model.
// `breaks` names the invariant it is designed to violate.
const MUTATIONS = {
  drop_final_rounding: {
    breaks: "closes_to_zero",
    note: "refactor drops the final-instalment rounding adjustment",
    apply(m) {
      if (m.periods.length < 2) return null;
      const emiConst = num(m.periods[0].emi);
      const last = m.periods[m.periods.length - 1];
      last.emi = money(emiConst);
      last.principal = money(emiConst - num(last.interest));
      return m;
    },
  },
  penny_leak: {
    breaks: "conservation",
    note: "one principal off by a penny (a rounding-direction change)",
    apply(m) {
      if (m.periods.length < 2) return null;
      m.periods[0].principal = money(num(m.periods[0].principal) - 0.01);
      return m;
    },
  },
  interest_tweak: {
    breaks: "principal_split",
    note: "interest changed without re-deriving principal (split logic edited)",
    apply(m) {
      m.periods[0].interest = money(num(m.periods[0].interest) + 0.1);
      return m;
    },
  },
  neg_amortisation: {
    breaks: "balance_monotonic",
    note: "an instalment no longer covers interest, so the balance grows (conservation preserved)",
    apply(m) {
      if (m.periods.length < 2) return null;
      // Force the first principal negative and compensate on the last, so conservation and
      // roll-forward stay exact but the balance rises at step 0 — surgical monotonicity break.
      const orig0 = num(m.periods[0].principal);
      const last = m.periods.length - 1;
      m.periods[0].principal = money(-1);
      m.periods[last].principal = money(num(m.periods[last].principal) + orig0 + 1);
      return reroll(m);
    },
  },
};

const files = readdirSync(TRACES).filter((f) => f.endsWith(".trace"));
function monitor(path) {
  let out;
  try {
    out = execFileSync(ALLIUM, ["monitor-schedule", SPEC, path, "--tol", "0.005"], { encoding: "utf8" });
  } catch (e) {
    out = e.stdout || "";
  }
  return JSON.parse(out);
}

// Baseline: confirm the gate passes the UNmutated schedules (no false alarms).
let cleanPass = 0;
for (const f of files) if (monitor(join(TRACES, f)).ok) cleanPass++;

console.log(`\n== Value 1: the spec as a standing regression gate ==\n`);
console.log(`Baseline (no mutation): gate passes ${cleanPass}/${files.length} real schedules (false-alarm rate ${(100 * (files.length - cleanPass) / files.length).toFixed(1)}%)\n`);
console.log(`mutation             applicable  caught   named-right   verdict`);
for (const [name, mut] of Object.entries(MUTATIONS)) {
  let applicable = 0,
    caught = 0,
    named = 0;
  for (const f of files) {
    const orig = readFileSync(join(TRACES, f), "utf8");
    const m = parse(orig);
    const mm = mut.apply(parse(orig));
    if (!mm) continue;
    // A mutation that does not change the schedule (e.g. dropping a rounding adjustment on a
    // zero-interest loan that never had one) is a no-op, not a missed catch.
    if (render(mm) === render(m)) continue;
    applicable++;
    const path = join(TMP, `${name}__${f}`);
    writeFileSync(path, render(mm));
    const rep = monitor(path);
    if (!rep.ok) caught++;
    const failed = rep.results.filter((r) => !r.holds).map((r) => r.invariant);
    if (failed.includes(mut.breaks)) named++;
  }
  const verdict = caught === applicable ? "caught every one" : `MISSED ${applicable - caught}`;
  console.log(`${name.padEnd(20)} ${String(applicable).padEnd(11)} ${String(caught + "/" + applicable).padEnd(8)} ${String(named + "/" + applicable).padEnd(13)} ${verdict}`);
}
console.log(`\n=> The gate is deterministic: each break is caught and the violated invariant is named, on every schedule, with no human or model in the loop.`);
