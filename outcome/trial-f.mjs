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

// The regulation, as prose. A priority waterfall for who generates the trade UTI,
// modelled on the CPMI-IOSCO / CFTC generation logic. Six independent boolean facts.
const REG = `
UTI GENERATION WATERFALL (who mints the Unique Transaction Identifier for a trade).
Apply the following rules IN PRIORITY ORDER. The first rule whose condition holds
determines the generator; lower rules do not apply once a higher one has matched.

  1. If a UTI already exists from upstream (prior_uti), reuse it: generator = "existing".
  2. Otherwise, if the trade is cleared (cleared), the clearing house generates it:
     generator = "ccp".
  3. Otherwise, if the trade was executed on a regulated trading venue
     (platform_executed), the venue generates it: generator = "venue".
  4. Otherwise, if the trade was confirmed on a confirmation service
     (confirmed_on_service), that service generates it: generator = "confirmation".
  5. Otherwise, if exactly one counterparty is a reporting-obligated dealer, that
     party generates it. If it is counterparty 1 (cp1_reporting and not cp2_reporting):
     generator = "cp1". If it is counterparty 2 (cp2_reporting and not cp1_reporting):
     generator = "cp2".
  6. Otherwise (neither or both are reporting dealers), sort the two counterparty
     identifiers and the lower one generates it: generator = "tiebreak".

The six conditions are independent boolean facts about a trade: prior_uti, cleared,
platform_executed, confirmed_on_service, cp1_reporting, cp2_reporting. Any combination
can occur; the priority order is what resolves overlaps between them.
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
  `Read the regulation below. Write it as an Allium v4 component in a file named ` +
  `UtiGeneration.allium in the current directory. Model each generator as an action ` +
  `whose 'requires' guard captures exactly the trades that generator handles. Use the ` +
  `six conditions as observable boolean state (e.g. 'observable state cleared(Trade) : bool'). ` +
  `Because Allium actions have no implicit order, you must fold the priority order into the ` +
  `guards yourself: each tier's guard must exclude every higher tier's condition. The guards ` +
  `must be a DISJOINT and EXHAUSTIVE case-split. Output nothing but the file. Do not ask questions.\n\n` +
  PRIMER + "\n\n" + REG;

function claude(prompt, cwd) {
  return spawnSync("claude", ["-p", prompt, "--output-format", "stream-json", "--verbose",
    "--model", MODEL, "--max-turns", "20", "--permission-mode", "bypassPermissions",
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
  let it = 1;
  while (it < ITERS && (!res.parsed || res.overlap || res.gap || !res.sawCaseSplit)) {
    const feedback =
      `The Allium v4 analyser was run on your UtiGeneration.allium and reports the following ` +
      `about the case-split. Fix the guards so the case-split is DISJOINT (no state matches two ` +
      `actions) and EXHAUSTIVE (every state matches one). Rewrite the whole file. Output nothing ` +
      `but the corrected file.\n\nANALYSER OUTPUT:\n` + (res.msgs.join("\n") || "(no case-split detected — did you write >=2 guarded actions?)");
    claude(feedback, ws);
    res = analyse(spec);
    it++;
  }
  return { arm: "checker", iters: it, ...res };
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
  const bad = rs.filter((r) => !r.parsed || !r.sawCaseSplit).length;
  const avgIt = (rs.reduce((a, r) => a + r.iters, 0) / rs.length).toFixed(1);
  return { arm, n: rs.length, clean, defect, malformed: bad, avgIters: avgIt };
}
console.log("\n=== Trial F summary (model=%s, iters<=%d) ===", MODEL, ITERS);
for (const arm of ["baseline", "checker"]) { const s = summary(arm); if (s) console.log(JSON.stringify(s)); }
writeFileSync(join(RUNS, "results.json"), JSON.stringify({ model: MODEL, iters: ITERS, rows, ts: process.env.TRIAL_TS || null }, null, 2));
console.log("\nwrote", join(RUNS, "results.json"));
