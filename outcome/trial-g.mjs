#!/usr/bin/env node
// Trial G — integration against a third-party contract (design-time value of v4, the
// other half of the hypothesis). A dealer integrates its swap-reporting system with a
// Trade Repository whose acceptance rules are published (GATEWAY-RULES.md, formalised as
// the pristine axioms in GATEWAY-CONTRACT.allium, which the integrator never edits).
//
// The integrator declares, as `requirement` items, the report scenarios its system emits.
// A requirement is INFEASIBLE if no acceptable report satisfies it together with the
// contract — the system would emit reports the TR rejects, a design-time defect. The
// feasibility check is SOUND (bounded joint-SAT, exact for these boolean rules) and names
// the blocking-rule core. One scenario in the brief is EMERGENTLY infeasible: posting
// bespoke collateral on collateralised trades violates rules 7 and 8 together, with no
// single rule forbidding it.
//
// Measured PROBABILISTICALLY over N reruns:
//   baseline — model encodes the scenarios AND states which it believes cannot be
//     accepted. We compare its claim to the checker's sound verdict: the MISS-RATE (an
//     infeasible scenario the model did not flag) is the non-saturated target.
//   The checker catches every infeasible scenario deterministically (it is sound), so the
//     design-time value is exactly the baseline miss-rate.
//
// Usage: node trial-g.mjs [--runs 8] [--model ...]

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SYS = join(HERE, "systems", "tr-gateway");
const CONTRACT = readFileSync(join(SYS, "GATEWAY-CONTRACT.allium"), "utf8");
const RULES = readFileSync(join(SYS, "GATEWAY-RULES.md"), "utf8");
const RUNS = join(HERE, "runs", "trial-g");
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MODEL = opt("--model", "claude-opus-4-8");
const N = Number(opt("--runs", "8"));

const BRIEF = `
Our rates-and-credit desk reports to the trade repository. The reporting system emits
these kinds of report, and we want each kind to be accepted:

  - new trades, submitted with a freshly generated UTI;
  - modifications to existing trades, carrying the prior UTI;
  - cleared trades: eligible trades are cleared through a CCP and we submit the CCP's LEI;
  - collateralised trades: we collateralise these under bespoke, per-counterparty schedules;
  - index credit derivatives, submitted with the index factor;
  - post-trade allocations to client sub-accounts, referencing the block's prior UTI.
`.trim();

const TASK =
  `You are integrating our reporting system with the trade repository. Read the repository's ` +
  `submission rules and our desk's brief below. Write an Allium v4 file named Integration.allium ` +
  `in the current directory. Model EACH kind of report in the brief as a 'requirement' item over ` +
  `the repository's field vocabulary. Always use 'r' as the report variable, e.g.:\n` +
  `  requirement cleared_trade means cleared(r) and has_ccp_lei(r)\n` +
  `Each requirement captures the fields that kind of report populates. Use the exact field names ` +
  `from the rules. ` +
  `Wrap the requirements in 'component Integration\\n  entity Report\\n  ... \\nend'. Then, on the ` +
  `LAST line of the file as an Allium comment, write exactly:\n` +
  `  -- INFEASIBLE: <comma-separated requirement names that CANNOT be accepted under the rules, or NONE>\n` +
  `Judge feasibility yourself against the rules. Output nothing but the file. Do not ask questions.\n\n` +
  "=== REPOSITORY SUBMISSION RULES ===\n" + RULES + "\n\n=== DESK BRIEF ===\n" + BRIEF;

function claude(prompt, cwd) {
  return spawnSync("claude", ["-p", prompt, "--output-format", "stream-json", "--verbose",
    "--model", MODEL, "--max-turns", "20", "--permission-mode", "bypassPermissions",
    "--plugin-dir", "/Users/hgarner/code/allium", "--setting-sources", "project"],
    { cwd, encoding: "utf8", maxBuffer: 1 << 28, timeout: 600000, killSignal: "SIGKILL" });
}
const reset = (d) => { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); };

// Extract the model's `requirement ... means ...` lines and its INFEASIBLE claim.
function parseDraft(text) {
  const reqs = [...text.matchAll(/^\s*requirement\s+(\w+)\s+means\s+(.+?)\s*$/gm)].map((m) => ({ name: m[1], body: m[2] }));
  const claim = (text.match(/INFEASIBLE:\s*(.+?)\s*$/m) || [])[1] || "";
  const claimed = /none/i.test(claim) ? [] : claim.split(/[,\s]+/).filter(Boolean);
  return { reqs, claimed };
}

// Merge the model's requirements into the pristine contract and run the sound checker.
function checkFeasibility(reqs, ws) {
  const merged = CONTRACT.replace(/\nend\s*$/, "\n" + reqs.map((r) => `  requirement ${r.name} means ${r.body}`).join("\n") + "\nend\n");
  const path = join(ws, "Merged.allium");
  writeFileSync(path, merged);
  const r = spawnSync(ALLIUM, ["analyse", path], { encoding: "utf8", maxBuffer: 1 << 26 });
  let diags = [];
  try { diags = JSON.parse(r.stdout).diagnostics || []; } catch { return { infeasible: [], parsed: false }; }
  const infeasible = [];
  for (const d of diags) {
    const m = (d.message || "").match(/requirement `(\w+)`.*INFEASIBLE.*Blocked by: ([^.]+)/);
    if (m) infeasible.push({ name: m[1], blockedBy: m[2].trim() });
  }
  return { infeasible, parsed: true };
}

function runBaseline(ws) {
  reset(ws);
  claude(TASK, ws);
  const spec = join(ws, "Integration.allium");
  if (!existsSync(spec)) return { arm: "baseline", ok: false, reason: "no file" };
  const { reqs, claimed } = parseDraft(readFileSync(spec, "utf8"));
  const { infeasible, parsed } = checkFeasibility(reqs, ws);
  const truth = infeasible.map((x) => x.name);
  const missed = truth.filter((n) => !claimed.includes(n)); // infeasible but model said fine
  const falseAlarm = claimed.filter((n) => !truth.includes(n));
  return { arm: "baseline", ok: parsed, nReqs: reqs.length, truth, claimed, missed, falseAlarm, infeasible };
}

mkdirSync(RUNS, { recursive: true });
const rows = [];
for (let i = 1; i <= N; i++) {
  const r = runBaseline(join(RUNS, `base-${i}`));
  rows.push(r);
  const v = !r.ok ? "BAD" : r.missed.length ? `MISS(${r.missed.join(",")})` : "caught";
  console.log(`run ${i} baseline reqs=${r.nReqs ?? "?"} truth=[${(r.truth || []).join(",")}] claimed=[${(r.claimed || []).join(",")}] -> ${v}`);
}

const scored = rows.filter((r) => r.ok);
const withInfeasible = scored.filter((r) => r.truth.length > 0);
const missed = scored.filter((r) => r.missed && r.missed.length > 0);
console.log("\n=== Trial G summary (model=%s) ===", MODEL);
console.log(JSON.stringify({
  n: rows.length, scored: scored.length,
  runsWithAnInfeasibleScenario: withInfeasible.length,
  runsWhereModelMissedIt: missed.length,
  baselineMissRate: withInfeasible.length ? +(missed.length / withInfeasible.length).toFixed(2) : null,
}, null, 2));
writeFileSync(join(RUNS, "results-baseline.json"), JSON.stringify({ model: MODEL, rows }, null, 2));
console.log("wrote", join(RUNS, "results-baseline.json"));
