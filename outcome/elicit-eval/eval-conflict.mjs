#!/usr/bin/env node
// Second half of the elicit loop: once the operator answers the surfaced questions, do the answers
// hold together? The conflicts are REALISTIC and EMERGENT (individually-reasonable answers that only
// clash when composed), from real error modes: not realising numbers interact, changing one's mind,
// not seeing a knock-on. This is where v4's deterministic `analyse` should beat v3, prose, and none.
//
// Arms, per scenario:
//   v4    - model encodes the answers as a v4 spec; `allium analyse` checks -> catch = CONTRADICTORY/INFEASIBLE
//   v3    - model encodes as a v3 spec; `allium analyse` checks -> catch
//   prose - model writes the answers as prose, then judges: are they jointly consistent/feasible?
//   nospec- model is given the raw answers and asked whether any conflict
// Metric: catch on conflict scenarios, false-alarm on clean; reps for repeatability/variance.
//
// Usage: node eval-conflict.mjs [--reps 2]
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "conflict-runs"); mkdirSync(RUNS, { recursive: true });
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const REPS = Number((argv[argv.indexOf("--reps") + 1] ?? "2"));
const V4REF = readFileSync("/Users/hgarner/code/allium/skills-v4/allium/references/language-reference-v4.md", "utf8");
const V3REF = readFileSync("/Users/hgarner/code/allium/skills/allium/references/language-reference.md", "utf8");

// Realistic operator-answer sets. `conflict` marks whether the answers emergently clash, and `why`
// records the error mode + the clashing answers (for reporting only; never shown to the arms).
const SCENARIOS = [
  { id: "conflict_floorcap", conflict: true, why: "didn't realise numbers interact: min £20 > cap £10",
    answers: `- Late fee basis: 2% of the overdue instalment amount.\n- Cap: cap the fee at £10 per instalment.\n- Minimum: there must be a minimum fee of £20, so even small instalments carry a meaningful penalty.\n- Grace period: 10 days.\n- Recurrence: one fee per missed instalment.` },
  { id: "conflict_recurrence", conflict: true, why: "changed mind: one-off then monthly-recurring",
    answers: `- Recurrence: just a single one-off fee when the instalment is first missed.\n- Escalation: if the instalment is still unpaid after a month, charge another fee, and keep charging monthly until it is paid.\n- Fee: flat £25.\n- Grace period: 5 days.` },
  { id: "conflict_monotonic", conflict: true, why: "didn't see knock-on: fee added to outstanding vs balance never increases",
    answers: `- Fee accrual: add the unpaid late fee to the loan's outstanding balance.\n- Balance rule: the outstanding balance should only ever go down over the life of the loan, never up.\n- Fee: flat £30 per missed instalment.\n- Grace period: 7 days.` },
  { id: "clean_flat", conflict: false, why: "consistent",
    answers: `- Fee: flat £25 per missed instalment.\n- Grace period: 10 days.\n- Recurrence: one-off per missed instalment.\n- Cap: none.\n- Accrual: booked to a separate fee-income ledger, not added to the loan balance.\n- Waiver: a branch manager may waive it.` },
  { id: "clean_pct", conflict: false, why: "consistent (cap 50 > min 5)",
    answers: `- Fee basis: 2% of the overdue instalment.\n- Cap: £50 maximum.\n- Minimum: £5 minimum.\n- Grace period: 7 days.\n- Recurrence: one-off per missed instalment.` },
];

function claude(prompt, turns = 8) {
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL, "--max-turns", String(turns),
    "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Task"], { encoding: "utf8", maxBuffer: 1 << 27, timeout: 300000 });
  return r.stdout || "";
}
function extractSpec(text, ver) {
  const m = text.match(/```[a-z]*\s*([\s\S]*?)```/);
  let s = m ? m[1] : text;
  if (!/^\s*--\s*allium:/m.test(s)) s = `-- allium: ${ver}\n` + s;
  return s.trim() + "\n";
}
function analyseCatches(spec, dir, tag) {
  const p = join(dir, `${tag}.allium`); writeFileSync(p, spec);
  const r = spawnSync(ALLIUM, ["analyse", p], { encoding: "utf8", maxBuffer: 1 << 26 });
  const out = (r.stdout || "") + (r.stderr || "");
  return /CONTRADICTORY|INFEASIBLE/.test(out);
}

const ARMS = {
  v4: (sc, dir, rep) => {
    const spec = extractSpec(claude(`Encode these CONFIRMED operator answers for a late-payment-fee feature into an Allium v4 specification: observable states plus invariant items, one per answer, capturing each answer faithfully as a constraint. Use the reference. Output ONLY the spec in a fenced block.\n\n=== ANSWERS ===\n${sc.answers}\n\n=== ALLIUM v4 REFERENCE ===\n${V4REF}`), 4);
    return analyseCatches(spec, dir, `v4_${sc.id}_${rep}`);
  },
  v3: (sc, dir, rep) => {
    const spec = extractSpec(claude(`Encode these CONFIRMED operator answers for a late-payment-fee feature into an Allium (v3) specification, capturing each answer faithfully as a constraint/rule. Use the reference. Output ONLY the spec in a fenced block.\n\n=== ANSWERS ===\n${sc.answers}\n\n=== ALLIUM REFERENCE ===\n${V3REF}`, 4), 3);
    return analyseCatches(spec, dir, `v3_${sc.id}_${rep}`);
  },
  prose: (sc) => {
    const out = claude(`Here are CONFIRMED operator answers for a late-payment-fee feature. First write them as a short prose specification, then review: are these requirements mutually consistent and jointly satisfiable? Answer on the LAST line exactly "VERDICT: CONFLICT" if any pair cannot hold together, or "VERDICT: OK" if they are consistent.\n\n${sc.answers}`);
    return /VERDICT:\s*CONFLICT/i.test(out);
  },
  nospec: (sc) => {
    const out = claude(`Here are CONFIRMED operator answers for a late-payment-fee feature. Are they mutually consistent and jointly satisfiable, or do any of them conflict when taken together? Answer on the LAST line exactly "VERDICT: CONFLICT" or "VERDICT: OK".\n\n${sc.answers}`);
    return /VERDICT:\s*CONFLICT/i.test(out);
  },
};

const results = {};
for (const [arm, fn] of Object.entries(ARMS)) {
  results[arm] = {};
  for (const sc of SCENARIOS) {
    const dir = join(RUNS, arm); mkdirSync(dir, { recursive: true });
    const catches = [];
    for (let r = 0; r < REPS; r++) catches.push(fn(sc, dir, r) ? 1 : 0);
    results[arm][sc.id] = catches;
    console.error(`[${arm} | ${sc.id} (${sc.conflict ? "CONFLICT" : "clean"})] caught ${catches.reduce((a, b) => a + b, 0)}/${REPS}`);
    writeFileSync(join(HERE, "conflict-result.json"), JSON.stringify(results, null, 2));
  }
}

const rate = (arm, want) => {
  let hit = 0, tot = 0;
  for (const sc of SCENARIOS) if (sc.conflict === want) for (const c of results[arm][sc.id]) { tot++; hit += c; }
  return `${hit}/${tot}`;
};
console.log(`\n== Emergent-conflict catch (${SCENARIOS.filter(s=>s.conflict).length} conflict + ${SCENARIOS.filter(s=>!s.conflict).length} clean, ${REPS} reps) ==\n`);
console.log(`arm     conflicts-caught   false-alarms-on-clean`);
for (const arm of Object.keys(ARMS)) console.log(`${arm.padEnd(7)} ${rate(arm, true).padEnd(18)} ${rate(arm, false)}`);
console.log(`\n=> v4 should catch emergent conflicts deterministically (every rep) where prose/nospec vary and v3 lacks the check.`);
