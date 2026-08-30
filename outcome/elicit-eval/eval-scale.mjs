#!/usr/bin/env node
// SCALE probe: a 14-constraint loan-product config with a subtle infeasibility buried among
// DISTANT constraints (base rate #4 + penalty rate #8 + "both count toward APR" #11 exceed the
// APR cap #3). The model must cross-reference four constraints stated far apart; v4 composes the
// whole system via analyse. Question: does the model MISS the buried conflict while building (v4
// catches it = clear air at scale) or still catch it (conflict-detection saturates even here)?
// Arms: v4 (skill-encode -> analyse) vs nospec (build, spontaneous strict-judge flag). reps=4.
//
// Usage: node eval-scale.mjs [--reps 4]
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "scale-runs"); mkdirSync(RUNS, { recursive: true });
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const MODEL = "claude-opus-4-8";
const REPS = Number((process.argv[process.argv.indexOf("--reps") + 1] ?? "4"));
const V4REF = readFileSync("/Users/hgarner/code/allium/skills-v4/allium/references/language-reference-v4.md", "utf8");
const ELICIT_V4 = readFileSync("/Users/hgarner/code/allium/skills-v4/elicit/SKILL.md", "utf8");

const base = (aprCap) => `Confirmed configuration for a new consumer loan product:
1. The product is denominated in GBP.
2. Loan amounts range from 500 to 50000.
3. The total effective APR charged to a borrower must never exceed ${aprCap}%.
4. The base nominal interest rate is 1.75% per month.
5. A late instalment attracts a penalty only after a 10-day grace period.
6. All fees are booked to a separate fee-income ledger, not added to the loan balance.
7. An origination fee of 1% of the principal is charged at disbursement.
8. The late-payment penalty is 0.5% per month of the overdue amount.
9. Repayments are made monthly.
10. The loan term is between 12 and 36 months.
11. For the regulatory APR calculation, BOTH the base interest rate and the penalty rate count toward the APR.
12. All monetary amounts are rounded half-even to the nearest penny.
13. Early repayment is allowed at any time with no early-settlement fee.
14. Interest is calculated on the declining outstanding balance.`;

const SCENARIOS = [
  { id: "scale_conflict", conflict: true,
    why: "base interest 1.75%/month = 21%/year plus penalty 0.5%/month = 6%/year, both counting toward APR per rule 11, total 27% APR — exceeding the 24% APR cap in rule 3",
    answers: base(24) },
  { id: "scale_clean", conflict: false,
    why: "consistent (27% APR is within the 30% cap)",
    answers: base(30) },
];

function claude(prompt, turns = 8) {
  return (spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL, "--max-turns", String(turns),
    "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Task"], { encoding: "utf8", maxBuffer: 1 << 27, timeout: 300000 }).stdout) || "";
}
const SUFFIX = `\n\nRespond directly in this single reply; do not use tools.`;
function extractSpec(t) { const m = t.match(/```[a-z]*\s*([\s\S]*?)```/); let s = m ? m[1] : t; if (!/^\s*--\s*allium:/m.test(s)) s = "-- allium: 4\n" + s; return s.trim() + "\n"; }
function analyseFlags(spec, dir, tag) { const p = join(dir, `${tag}.allium`); writeFileSync(p, spec); const r = spawnSync(ALLIUM, ["analyse", p], { encoding: "utf8", maxBuffer: 1 << 26 }); return /CONTRADICTORY|INFEASIBLE|VACUOUSLY/.test((r.stdout || "") + (r.stderr || "")); }
function spontaneousFlag(out, sc, dir, tag) {
  writeFileSync(join(dir, `${tag}.txt`), out);
  const prompt = sc.conflict
    ? `An engineer was given a confirmed product configuration and asked to build/spec it (NOT asked to check consistency). There is a specific hidden conflict: ${sc.why}. Did the response SPECIFICALLY identify this clash (the APR cap being breached by base+penalty) and treat it as needing resolution? Merely listing assumptions does NOT count. Last line exactly "CATCH" or "MISS".\n\n=== RESPONSE ===\n${out}`
    : `An engineer was given a confirmed, mutually-CONSISTENT product configuration and asked to build/spec it. Did the response claim the requirements are mutually CONTRADICTORY (cannot all be true at once)? Only a genuine logical/numeric contradiction AMONG the requirements counts — NOT implementation concerns or requests to confirm details. Last line exactly "FALSEALARM" or "OK".\n\n=== RESPONSE ===\n${out}`;
  const j = claude(prompt, 2).trim().split("\n").slice(-3).join(" ");
  return sc.conflict ? /\bCATCH\b/i.test(j) : /\bFALSEALARM\b/i.test(j);
}
const ARMS = {
  v4: (sc, dir, rep) => analyseFlags(extractSpec(claude(`Follow this Allium v4 elicitation process to ENCODE the confirmed configuration into a v4 specification. Apply "Encode so the spec can bite": encode EACH item faithfully as a constraint, never reconcile, one predicate per concept, quantify with every, assert reachability. Output ONLY the final spec in a fenced block.\n\n=== PROCESS ===\n${ELICIT_V4}\n\n=== v4 REFERENCE ===\n${V4REF}\n\n=== CONFIRMED CONFIGURATION ===\n${sc.answers}`, 4)), dir, `v4_${sc.id}_${rep}`),
  nospec: (sc, dir, rep) => spontaneousFlag(claude(`You are a senior engineer. Here is a confirmed configuration for a new loan product. Implement it, ready for production; give your plan and the concrete decisions your implementation will make.${SUFFIX}\n\n${sc.answers}`), sc, dir, `nospec_${sc.id}_${rep}`),
};
const results = {};
for (const [arm, fn] of Object.entries(ARMS)) {
  results[arm] = {};
  for (const sc of SCENARIOS) {
    const dir = join(RUNS, arm); mkdirSync(dir, { recursive: true });
    const flags = []; for (let r = 0; r < REPS; r++) flags.push(fn(sc, dir, r) ? 1 : 0);
    results[arm][sc.id] = flags;
    console.error(`[${arm} | ${sc.id} (${sc.conflict ? "CONFLICT" : "clean"})] flagged ${flags.reduce((a, b) => a + b, 0)}/${REPS}`);
    writeFileSync(join(HERE, "scale-result.json"), JSON.stringify(results, null, 2));
  }
}
const rate = (arm, want) => { let h = 0, t = 0; for (const sc of SCENARIOS) if (sc.conflict === want) for (const c of results[arm][sc.id]) { t++; h += c; } return `${h}/${t}`; };
console.log(`\n== SCALE probe: buried conflict among 14 constraints (${REPS} reps) ==\n`);
console.log(`arm     conflict-caught   false-alarm-on-clean`);
for (const arm of Object.keys(ARMS)) console.log(`${arm.padEnd(7)} ${rate(arm, true).padEnd(17)} ${rate(arm, false)}`);
console.log(`\n=> nospec < v4 on the buried conflict would be the first catch-rate clear air (scale beyond in-head composition).`);
