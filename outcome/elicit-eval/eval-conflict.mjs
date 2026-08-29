#!/usr/bin/env node
// Second half of the elicit loop, NON-LEADING. Realistic emergent conflicts from real operator
// error modes. Crucially, NO arm is asked "are these consistent?" (that leads the witness). Each
// arm just does its normal job on the confirmed answers:
//   v4    - follow the elicit skill to ENCODE the answers as a v4 spec; `allium analyse` runs
//           automatically -> catch = it reports CONTRADICTORY / INFEASIBLE / VACUOUSLY
//   v3    - encode as a v3 spec; `allium analyse` -> catch
//   prose - write a prose spec of the behaviour, then outline the build (no consistency prompt)
//   nospec- implement the feature, giving the plan and concrete decisions (no consistency prompt)
// For prose/nospec, catch = the output SPONTANEOUSLY flags an unresolved conflict (a blind judge,
// told nothing about the planted conflict, decides FLAG vs PROCEED). Metric: catch on conflicts,
// false-alarm on clean, with reps for repeatability.
//
// Usage: node eval-conflict.mjs [--reps 2]
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "conflict-runs2"); mkdirSync(RUNS, { recursive: true });
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const REPS = Number((argv[argv.indexOf("--reps") + 1] ?? "2"));
const V4REF = readFileSync("/Users/hgarner/code/allium/skills-v4/allium/references/language-reference-v4.md", "utf8");
const V3REF = readFileSync("/Users/hgarner/code/allium/skills/allium/references/language-reference.md", "utf8");
const ELICIT_V4 = readFileSync("/Users/hgarner/code/allium/skills-v4/elicit/SKILL.md", "utf8");

const SCENARIOS = [
  { id: "conflict_floorcap", conflict: true,
    why: "the minimum fee (20) is set ABOVE the cap (10), so no single fee amount can satisfy both",
    answers: `- Late fee basis: 2% of the overdue instalment amount.\n- Cap: cap the fee at 10 per instalment.\n- Minimum: there must be a minimum fee of 20, so even small instalments carry a meaningful penalty.\n- Grace period: 10 days.\n- Recurrence: one fee per missed instalment.` },
  { id: "conflict_recurrence", conflict: true,
    why: "one answer says a SINGLE one-off fee, another says a RECURRING monthly fee until paid — the fee is both one-off and recurring",
    answers: `- Recurrence: just a single one-off fee when the instalment is first missed.\n- Escalation: if the instalment is still unpaid after a month, charge another fee, and keep charging monthly until it is paid.\n- Fee: flat 25.\n- Grace period: 5 days.` },
  { id: "conflict_monotonic", conflict: true,
    why: "unpaid fees are ADDED to the outstanding balance, but another rule says the outstanding balance must NEVER increase — adding a fee increases it",
    answers: `- Fee accrual: add the unpaid late fee to the loan's outstanding balance.\n- Balance rule: the outstanding balance should only ever go down over the life of the loan, never up.\n- Fee: flat 30 per missed instalment.\n- Grace period: 7 days.` },
  { id: "clean_flat", conflict: false,
    answers: `- Fee: flat 25 per missed instalment.\n- Grace period: 10 days.\n- Recurrence: one-off per missed instalment.\n- Cap: none.\n- Accrual: booked to a separate fee-income ledger, not added to the loan balance.` },
  { id: "clean_pct", conflict: false,
    answers: `- Fee basis: 2% of the overdue instalment.\n- Cap: 50 maximum.\n- Minimum: 5 minimum.\n- Grace period: 7 days.\n- Recurrence: one-off per missed instalment.` },
];

function claude(prompt, turns = 8) {
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL, "--max-turns", String(turns),
    "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Task"], { encoding: "utf8", maxBuffer: 1 << 27, timeout: 300000 });
  return r.stdout || "";
}
const SUFFIX = `\n\nRespond directly in this single reply; do not use tools.`;
function extractSpec(text, ver) {
  const m = text.match(/```[a-z]*\s*([\s\S]*?)```/);
  let s = m ? m[1] : text;
  if (!/^\s*--\s*allium:/m.test(s)) s = `-- allium: ${ver}\n` + s;
  return s.trim() + "\n";
}
function analyseFlags(spec, dir, tag) {
  const p = join(dir, `${tag}.allium`); writeFileSync(p, spec);
  const r = spawnSync(ALLIUM, ["analyse", p], { encoding: "utf8", maxBuffer: 1 << 26 });
  return /CONTRADICTORY|INFEASIBLE|VACUOUSLY/.test((r.stdout || "") + (r.stderr || ""));
}
// Strict spontaneous-flag judge. The ARM is blind; the JUDGE knows ground truth and requires the
// response to identify the SPECIFIC clash, not merely raise generic assumptions/sign-off caveats
// (which a careful model does on every ticket). On a clean scenario it checks for a false alarm.
function spontaneousFlag(out, sc, dir, tag) {
  writeFileSync(join(dir, `${tag}.txt`), out); // save for verification
  const prompt = sc.conflict
    ? `An engineer was given confirmed requirements for a feature and asked to build/spec it (NOT asked to check consistency). There is a specific hidden conflict: ${sc.why}. Did the engineer's response SPECIFICALLY identify this clash and treat it as needing resolution before proceeding? Merely listing assumptions or asking to confirm numbers does NOT count — it must call out THIS specific inconsistency. Answer on the last line exactly "CATCH" or "MISS".\n\n=== RESPONSE ===\n${out}`
    : `An engineer was given confirmed, mutually-CONSISTENT requirements for a feature and asked to build/spec it. Did the response wrongly claim the requirements conflict or cannot all hold together? Answer on the last line exactly "FALSEALARM" or "OK".\n\n=== RESPONSE ===\n${out}`;
  const j = claude(prompt, 2).trim().split("\n").slice(-3).join(" ");
  return sc.conflict ? /\bCATCH\b/i.test(j) : /\bFALSEALARM\b/i.test(j);
}

const ARMS = {
  v4: (sc, dir, rep) => analyseFlags(extractSpec(claude(`Follow this Allium v4 elicitation process to ENCODE the confirmed operator answers below into a v4 specification. Apply the "Encode so the spec can bite" rules exactly: encode each answer faithfully, never reconcile conflicting answers, one predicate per concept, quantify with every, and assert guarded cases are reachable. Output ONLY the final spec in a fenced block.\n\n=== PROCESS ===\n${ELICIT_V4}\n\n=== v4 REFERENCE ===\n${V4REF}\n\n=== CONFIRMED ANSWERS ===\n${sc.answers}`, 4), 4), dir, `v4_${sc.id}_${rep}`),
  v3: (sc, dir, rep) => analyseFlags(extractSpec(claude(`Encode these confirmed operator answers for a late-payment-fee feature into an Allium (v3) specification, capturing each answer faithfully as a rule. Output ONLY the spec in a fenced block.\n\n=== ANSWERS ===\n${sc.answers}\n\n=== ALLIUM REFERENCE ===\n${V3REF}`, 4), 3), dir, `v3_${sc.id}_${rep}`),
  prose: (sc, dir, rep) => spontaneousFlag(claude(`You are a senior engineer. Here are confirmed operator answers for a late-payment-fee feature. Write a clear prose specification of the intended behaviour, then outline how you will implement it.${SUFFIX}\n\n${sc.answers}`), sc, dir, `prose_${sc.id}_${rep}`),
  nospec: (sc, dir, rep) => spontaneousFlag(claude(`You are a senior engineer. Here are confirmed operator answers for a late-payment-fee feature. Implement it, ready for production; give your plan and the concrete decisions your implementation will make.${SUFFIX}\n\n${sc.answers}`), sc, dir, `nospec_${sc.id}_${rep}`),
};

const results = {};
for (const [arm, fn] of Object.entries(ARMS)) {
  results[arm] = {};
  for (const sc of SCENARIOS) {
    const dir = join(RUNS, arm); mkdirSync(dir, { recursive: true });
    const flags = [];
    for (let r = 0; r < REPS; r++) flags.push(fn(sc, dir, r) ? 1 : 0);
    results[arm][sc.id] = flags;
    console.error(`[${arm} | ${sc.id} (${sc.conflict ? "CONFLICT" : "clean"})] flagged ${flags.reduce((a, b) => a + b, 0)}/${REPS}`);
    writeFileSync(join(HERE, "conflict-result2.json"), JSON.stringify(results, null, 2));
  }
}
const rate = (arm, want) => { let h = 0, t = 0; for (const sc of SCENARIOS) if (sc.conflict === want) for (const c of results[arm][sc.id]) { t++; h += c; } return `${h}/${t}`; };
console.log(`\n== Non-leading emergent-conflict catch (3 conflict + 2 clean, ${REPS} reps) ==\n`);
console.log(`arm     conflicts-caught   false-alarms-on-clean`);
for (const arm of Object.keys(ARMS)) console.log(`${arm.padEnd(7)} ${rate(arm, true).padEnd(18)} ${rate(arm, false)}`);
console.log(`\n=> v4/v3 catch automatically via analyse; prose/nospec only if they flag spontaneously (not asked).`);
