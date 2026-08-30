#!/usr/bin/env node
// HARDER emergent conflicts — infeasibility that only emerges after composing 4-5 numeric
// constraints (algebraic chains, allocation sums, band-vs-computed-value), the kind that is hard
// to eyeball in-head. Tests whether v4's deterministic analyse catches conflicts the model MISSES
// while building. If the model still catches them all, conflict-detection saturates too (honest).
// Arms: v4 (skill-encode -> analyse), nospec, prose (strict spontaneous-flag judge). NON-LEADING.
//
// Usage: node eval-conflict-hard.mjs [--reps 2]
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "conflict-hard-runs"); mkdirSync(RUNS, { recursive: true });
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const MODEL = "claude-opus-4-8";
const REPS = Number((process.argv[process.argv.indexOf("--reps") + 1] ?? "2"));
const V4REF = readFileSync("/Users/hgarner/code/allium/skills-v4/allium/references/language-reference-v4.md", "utf8");
const ELICIT_V4 = readFileSync("/Users/hgarner/code/allium/skills-v4/elicit/SKILL.md", "utf8");

const SCENARIOS = [
  { id: "hard_chain", conflict: true,
    why: "composing the definitions forces fee = 7% of overdue (2% base + 1% of outstanding, with outstanding = 5x overdue = 5%), which cannot also equal the stated 4% of overdue",
    answers: `- The late fee is a base charge plus a surcharge.\n- The base charge is 2% of the overdue amount.\n- The surcharge is 1% of the total outstanding balance.\n- For an overdue instalment, the total outstanding balance is five times the overdue amount.\n- The late fee should come out to 4% of the overdue amount.` },
  { id: "hard_alloc", conflict: true,
    why: "the five allocation percentages sum to 101.5%, not 100%, so they cannot account for exactly the whole payment",
    answers: `- Each repayment is split across five buckets, which together must account for the entire payment.\n- 41.5% goes to principal.\n- 28.5% goes to interest.\n- 18.5% goes to fees.\n- 8.5% goes to escrow.\n- 4.5% goes to insurance.` },
  { id: "hard_band", conflict: true,
    why: "3% of a 500 instalment is 15, which falls outside the required 10-to-12 fee band",
    answers: `- The late fee is 3% of the instalment amount.\n- Instalments are 500 each.\n- The late fee must land between 10 and 12 inclusive.` },
  { id: "clean_chain", conflict: false,
    why: "consistent",
    answers: `- The late fee is a base charge plus a surcharge.\n- The base is 2% of the overdue amount.\n- The surcharge is 1% of the overdue amount.\n- The late fee should come out to 3% of the overdue amount.` },
  { id: "clean_alloc", conflict: false,
    why: "consistent (sums to 100)",
    answers: `- Each repayment is split across five buckets that together account for the whole payment.\n- 40% principal, 30% interest, 20% fees, 7% escrow, 3% insurance.` },
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
    ? `An engineer was given confirmed requirements and asked to build/spec a feature (NOT asked to check consistency). There is a specific hidden conflict: ${sc.why}. Did the response SPECIFICALLY identify this clash and treat it as needing resolution before proceeding? Merely listing assumptions does NOT count. Last line exactly "CATCH" or "MISS".\n\n=== RESPONSE ===\n${out}`
    : `An engineer was given confirmed, mutually-CONSISTENT requirements and asked to build/spec a feature. Did the response wrongly claim the requirements conflict or cannot all hold? Last line exactly "FALSEALARM" or "OK".\n\n=== RESPONSE ===\n${out}`;
  const j = claude(prompt, 2).trim().split("\n").slice(-3).join(" ");
  return sc.conflict ? /\bCATCH\b/i.test(j) : /\bFALSEALARM\b/i.test(j);
}
const ARMS = {
  v4: (sc, dir, rep) => analyseFlags(extractSpec(claude(`Follow this Allium v4 elicitation process to ENCODE the confirmed operator answers into a v4 specification. Apply the "Encode so the spec can bite" rules: encode each answer faithfully, never reconcile, one predicate per concept, quantify with every, assert guarded cases reachable. Output ONLY the final spec in a fenced block.\n\n=== PROCESS ===\n${ELICIT_V4}\n\n=== v4 REFERENCE ===\n${V4REF}\n\n=== CONFIRMED ANSWERS ===\n${sc.answers}`, 4)), dir, `v4_${sc.id}_${rep}`),
  nospec: (sc, dir, rep) => spontaneousFlag(claude(`You are a senior engineer. Here are confirmed operator answers for a late-payment-fee feature. Implement it, ready for production; give your plan and the concrete decisions your implementation will make.${SUFFIX}\n\n${sc.answers}`), sc, dir, `nospec_${sc.id}_${rep}`),
  prose: (sc, dir, rep) => spontaneousFlag(claude(`You are a senior engineer. Here are confirmed operator answers for a late-payment-fee feature. Write a clear prose specification of the intended behaviour, then outline how you will implement it.${SUFFIX}\n\n${sc.answers}`), sc, dir, `prose_${sc.id}_${rep}`),
};
const results = {};
for (const [arm, fn] of Object.entries(ARMS)) {
  results[arm] = {};
  for (const sc of SCENARIOS) {
    const dir = join(RUNS, arm); mkdirSync(dir, { recursive: true });
    const flags = []; for (let r = 0; r < REPS; r++) flags.push(fn(sc, dir, r) ? 1 : 0);
    results[arm][sc.id] = flags;
    console.error(`[${arm} | ${sc.id} (${sc.conflict ? "CONFLICT" : "clean"})] flagged ${flags.reduce((a, b) => a + b, 0)}/${REPS}`);
    writeFileSync(join(HERE, "conflict-hard-result.json"), JSON.stringify(results, null, 2));
  }
}
const rate = (arm, want) => { let h = 0, t = 0; for (const sc of SCENARIOS) if (sc.conflict === want) for (const c of results[arm][sc.id]) { t++; h += c; } return `${h}/${t}`; };
console.log(`\n== HARDER multi-constraint conflict catch (3 conflict + 2 clean, ${REPS} reps) ==\n`);
console.log(`arm     conflicts-caught   false-alarms-on-clean`);
for (const arm of Object.keys(ARMS)) console.log(`${arm.padEnd(7)} ${rate(arm, true).padEnd(18)} ${rate(arm, false)}`);
console.log(`\n=> if the model MISSES a hard conflict that v4 catches, that is v4's unique value; if the model still catches all, conflict-detection saturates.`);
