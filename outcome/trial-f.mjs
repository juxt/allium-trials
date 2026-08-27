#!/usr/bin/env node
// Trial F — priority waterfall → disjoint case-split (design-time value of v4 analyse).
//
// Regulations are written as PRIORITY WATERFALLS: "if A do X; else if B do Y; else ...".
// Allium actions have NO implicit order, so a faithful encoding must fold the priority
// into each guard: tier k must explicitly exclude tiers 1..k-1. Dropping one exclusion
// leaves two actions firing in the same state (an ambiguous classification) or a state
// no action covers (a silent fall-through). Over ~6 tiers this is exactly the error a
// strong model makes and cannot reliably catch by re-reading — but v4 `analyse` settles
// it soundly by enumeration (the conditions are independent booleans, so exact).
//
// Two arms, measured PROBABILISTICALLY over N reruns:
//   baseline  — one-shot draft, NO checker. The non-saturated target: how often does a
//               strong model leave a real gap/overlap?
//   checker   — draft, run `allium analyse`, feed the diagnostics back, redraft, loop
//               until clean or K iterations. The design-time value of v4.
//
// Score is v4 analyse itself (sound + exact for these independent boolean guards):
//   overlap  = "NOT disjoint"     gap = "uncovered"     clean = DISJOINT & no gap.
//
// Usage: node trial-f.mjs [--runs 6] [--arm baseline|checker|both] [--model ...] [--iters 4]

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs", "trial-f");
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MODEL = opt("--model", "claude-opus-4-8");
const N = Number(opt("--runs", "6"));
const ARM = opt("--arm", "both");
const ITERS = Number(opt("--iters", "4"));

// The regulation, verbatim: CPMI-IOSCO Technical Guidance on the Harmonisation of the
// UTI (Feb 2017), Table 1 — the decision table for which entity generates the UTI.
// Externally authored, so the difficulty is not self-seeded. It is NOT a linear
// waterfall: the control flow is a graph. Step 4 jumps to step 10; steps 5/6/10 all
// route into step 7/11; the confirmation-platform outcome is reachable from BOTH step 6
// and step 12 (the same predicate); the agreed-entity outcome is reachable three ways.
// Deriving one disjoint, exhaustive guard per terminal outcome means tracing every path.
const REG = `
CPMI-IOSCO Technical Guidance, Table 1 — Responsibility for UTI generation. Work through
the steps; each step's answer either names the responsible entity or sends you to another
step ("see step N"). Apply it to a single transaction.

  Step 1.  Is a CCP a counterparty to this transaction?
           If so, the CCP. Otherwise, see step 2.
  Step 2.  Is a counterparty to this transaction a clearing member of a CCP, and if so is
           that clearing member acting in its clearing member capacity for this transaction?
           If so, the clearing member. Otherwise, see step 3.
  Step 3.  Was the transaction executed on a trading platform?
           If so, the trading platform. Otherwise, see step 4.
  Step 4.  Is the transaction cross-jurisdictional (ie are the counterparties to the
           transaction subject to more than one jurisdiction's reporting rules)?
           If so, see step 10. Otherwise, see step 5.
  Step 5.  Do both counterparties have reporting obligations?
           If so, see step 6. Otherwise, see step 7.
  Step 6.  Has the transaction been electronically confirmed or will it be and, if so, is
           the confirmation platform able, willing and permitted to generate a UTI within
           the required time frame under the applicable rules?
           If so, the confirmation platform. Otherwise, see step 7.
  Step 7.  Does the jurisdiction employ a counterparty-status-based approach (eg, rule
           definition or registration status) for determining which entity should have
           responsibility for generating the UTI?
           If so, see step 8. Otherwise, see step 11.
  Step 8.  Do the counterparties have the same regulatory status for UTI generation
           purposes under the relevant jurisdiction?
           If so, see step 11. Otherwise, see step 9.
  Step 9.  Do the applicable rules determine which entity should have responsibility for
           generating the UTI?
           If so, the assigned entity. Otherwise, see step 12.
  Step 10. Does one of the jurisdictions have a sooner deadline for reporting than the
           other(s)?
           If so, the UTI generation rules of the jurisdiction with the sooner reporting
           deadline should be followed. Otherwise, see step 11.
  Step 11. Do the counterparties have an agreement governing which entity should have
           responsibility for generating the UTI for this transaction?
           If so, the agreed entity. Otherwise, see step 12.
  Step 12. Has the transaction been electronically confirmed or will it be and, if so, is
           the confirmation platform able, willing and permitted to generate a UTI within
           the required time frame under the applicable rules?
           If so, the confirmation platform. Otherwise, see step 13.
  Step 13. Is there a single TR to which reports relating to the transaction have to be
           made, and is that TR able, willing and permitted to generate UTIs under the
           applicable rules?
           If so, the TR. Otherwise, one of the counterparties, based on sorting the
           identifiers of the counterparties with the characters reversed and picking the
           counterparty that comes first in this sort sequence.

Each step tests a boolean fact about the transaction; any combination of facts can occur.
`.trim();

const PRIMER = `
ALLIUM v4 SYNTAX (a behavioural spec language). A worked example in an UNRELATED domain:

-- allium: 4
component DoorController
  entity Door
  observable state locked(Door) : bool
  observable state alarmed(Door) : bool
  action open_normally(d : Door) requires not locked(d) and not alarmed(d) ; ensures opened(d)
  action open_override(d : Door) requires locked(d) and not alarmed(d) ; ensures opened(d)
end

Notes:
- Each 'action' has a 'requires' GUARD (a boolean predicate over the observable state)
  and an 'ensures' clause. Guards combine conditions with 'and', 'or', 'not'.
- Actions have NO implicit ordering. If two guards can both hold in the same state, both
  actions fire there. A well-formed case-split has guards that are mutually exclusive
  (no state satisfies two) and exhaustive (every state satisfies one).
`.trim();

const TASK =
  `Read the decision table below. Write it as an Allium v4 component in a file named ` +
  `UtiGeneration.allium in the current directory. Identify each terminal outcome (the entity ` +
  `that ends up responsible: the CCP, the clearing member, the trading platform, and so on) ` +
  `and model it as one action whose 'requires' guard captures exactly the transactions that ` +
  `reach that outcome. Represent each step's fact as observable boolean state (e.g. ` +
  `'observable state cross_jurisdictional(Trade) : bool'). Allium actions have no implicit ` +
  `order, so each guard must stand alone. The guards must form a DISJOINT case-split (no ` +
  `transaction reaches two outcomes) that is EXHAUSTIVE (every transaction reaches one). ` +
  `Output nothing but the file. Do not ask questions.\n\n` +
  PRIMER + "\n\n" + REG;

function claude(prompt, cwd) {
  return spawnSync("claude", ["-p", prompt, "--output-format", "stream-json", "--verbose",
    "--model", MODEL, "--max-turns", "30", "--permission-mode", "bypassPermissions",
    "--plugin-dir", "/Users/hgarner/code/allium", "--setting-sources", "project"],
    { cwd, encoding: "utf8", maxBuffer: 1 << 28, timeout: 600000, killSignal: "SIGKILL" });
}
const reset = (d) => { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); };

// Score the drafted spec with v4 analyse. Returns {parsed, overlap, gap, clean, msgs}.
function analyse(specPath) {
  if (!existsSync(specPath)) return { parsed: false, overlap: false, gap: false, clean: false, msgs: ["no file"] };
  const r = spawnSync(ALLIUM, ["analyse", specPath], { encoding: "utf8", maxBuffer: 1 << 26 });
  let diags = [];
  try { diags = JSON.parse(r.stdout).diagnostics || []; } catch { return { parsed: false, overlap: false, gap: false, clean: false, msgs: ["unparseable analyse output"] }; }
  const msgs = diags.map((d) => `[${d.severity}] ${d.message}`);
  const parseErr = diags.some((d) => d.severity === "error");
  const cs = msgs.filter((m) => m.includes("case-split"));
  const overlap = cs.some((m) => m.includes("NOT disjoint"));
  const gap = cs.some((m) => m.includes("uncovered"));
  const disjoint = cs.some((m) => m.includes("is DISJOINT (sound"));
  const sawCaseSplit = cs.length > 0;
  return { parsed: !parseErr, overlap, gap, clean: sawCaseSplit && !parseErr && disjoint && !gap, sawCaseSplit, msgs: cs };
}

function runBaseline(ws) {
  reset(ws);
  claude(TASK, ws);
  const res = analyse(join(ws, "UtiGeneration.allium"));
  return { arm: "baseline", iters: 1, ...res };
}

function runChecker(ws) {
  reset(ws);
  const spec = join(ws, "UtiGeneration.allium");
  claude(TASK, ws);
  let res = analyse(spec);
  const first = { overlap: res.overlap, gap: res.gap, parsed: res.parsed, sawCaseSplit: res.sawCaseSplit };
  let it = 1;
  while (it < ITERS && (!res.parsed || res.overlap || res.gap || !res.sawCaseSplit)) {
    const feedback =
      `The Allium v4 analyser was run on your UtiGeneration.allium and reports the following ` +
      `about the case-split. Fix the guards so the case-split is DISJOINT (no state matches two ` +
      `actions) and EXHAUSTIVE (every state matches one). If a coverage gap is only apparent ` +
      `because some conditions cannot co-occur, state that as an 'axiom <name> means <predicate>' ` +
      `item so the analyser can use it. Rewrite the whole file. Output nothing but the corrected ` +
      `file.\n\nANALYSER OUTPUT:\n` + (res.msgs.join("\n") || "(no case-split detected — did you write >=2 guarded actions?)");
    claude(feedback, ws);
    res = analyse(spec);
    it++;
  }
  return { arm: "checker", iters: it, first, ...res };
}

reset(RUNS);
const rows = [];
for (let i = 1; i <= N; i++) {
  if (ARM === "baseline" || ARM === "both") { const r = runBaseline(join(RUNS, `base-${i}`)); rows.push(r); log(i, r); }
  if (ARM === "checker" || ARM === "both") { const r = runChecker(join(RUNS, `chk-${i}`)); rows.push(r); log(i, r); }
}
function log(i, r) {
  const v = !r.parsed ? "PARSE-FAIL" : !r.sawCaseSplit ? "NO-CASE-SPLIT" : r.overlap && r.gap ? "OVERLAP+GAP" : r.overlap ? "OVERLAP" : r.gap ? "GAP" : "clean";
  console.log(`run ${i} ${r.arm.padEnd(8)} iters=${r.iters} -> ${v}`);
}

function summary(arm) {
  const rs = rows.filter((r) => r.arm === arm);
  if (!rs.length) return null;
  const clean = rs.filter((r) => r.clean).length;
  const defect = rs.filter((r) => r.parsed && r.sawCaseSplit && (r.overlap || r.gap)).length;
  const overlap = rs.filter((r) => r.overlap).length;
  const bad = rs.filter((r) => !r.parsed || !r.sawCaseSplit).length;
  const avgIt = (rs.reduce((a, r) => a + r.iters, 0) / rs.length).toFixed(1);
  const s = { arm, n: rs.length, clean, defect, overlap, malformed: bad, avgIters: avgIt };
  if (arm === "checker") {
    const fd = rs.filter((r) => r.first && (r.first.overlap || r.first.gap || !r.first.parsed || !r.first.sawCaseSplit)).length;
    s.firstDraftDefect = fd; // defective before the loop; `defect` is after
  }
  return s;
}
console.log("\n=== Trial F summary (model=%s, iters<=%d) ===", MODEL, ITERS);
for (const arm of ["baseline", "checker"]) { const s = summary(arm); if (s) console.log(JSON.stringify(s)); }
writeFileSync(join(RUNS, "results.json"), JSON.stringify({ model: MODEL, iters: ITERS, rows, ts: process.env.TRIAL_TS || null }, null, 2));
console.log("\nwrote", join(RUNS, "results.json"));
