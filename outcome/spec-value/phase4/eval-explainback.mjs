#!/usr/bin/env node
// PHASE 4 — how do you build confidence a spec is right? Can a reviewer catch its real flaws, and does
// showing the VALIDATION REPORT (monitor faithfulness + mutation completeness) help more than eyeballing
// the spec or a prose explanation?
//
// Specimen: SPEC_LLM (distilled from informal guidance), which carries TWO real flaws found in Phase 2:
//   F1 (over-claim): `level_payment` asserts EVERY period's EMI is equal, incl. the last — false of the
//                    real code (last instalment differs; monitor residual 0.04).
//   F2 (blind spot): NO inter-period balance link (roll-forward) and no monotonicity — a corrupted
//                    running balance would slip through (mutation battery: 0% detection on those kinds).
// Arms (what the reviewer is given), all asked to find errors/omissions vs the intended behaviour:
//   spec_only  — the raw Allium spec.
//   prose      — the spec + a natural-language explanation of what it says.
//   validated  — the spec + the mechanical VALIDATION REPORT (monitor + mutation results).
// Metric: does the reviewer catch F1 and F2? Hypothesis: `validated` catches both reliably; the others
// are inconsistent. That would confirm the confidence-builder is the validation, not the explanation.
// Usage: node eval-explainback.mjs [--reps 3]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = "claude-opus-4-8";
const REPS = Number(process.argv[process.argv.indexOf("--reps") + 1] ?? "3");
const SPEC = readFileSync("/Users/hgarner/code/allium-trials/outcome/spec-value/phase2/spec_llm.allium", "utf8");

// INFORMAL intent only — the same vague guidance the spec was distilled from. A reviewer given only
// this has NO basis to flag the level_payment over-claim (the informal intent also says "equal
// instalments") nor to demand a roll-forward invariant. This is the realistic case: human intent is
// incomplete, so review-against-intent cannot catch what the code-check (monitor) can.
const INTENT = `Intended behaviour (as the product owner described it): a standard amortising loan. The customer borrows an amount and pays it back in equal periodic instalments over the term. Each instalment is part interest, part principal; interest is charged on what they still owe. Over the life of the loan they pay off exactly what they borrowed, and at the end the balance is zero.`;

const PROSE = `Explanation of the spec: it defines a Period entity with emi, interest, principal, outstanding_start and is_last. It states: each instalment equals interest plus principal; every period has the same emi; interest equals rate times outstanding_start; principal equals emi minus interest; the sum of principal over all periods equals the disbursed amount; at the last period outstanding_start equals principal; and outstanding_start and principal are non-negative.`;

const VALREPORT = `Mechanical validation report (spec run against the real code and a mutation battery):
- FAITHFULNESS (monitor over 150 real schedules): invariant \`level_payment\` (every period's emi equal) FAILS on real multi-period loans, worst residual 0.04 — the real last instalment differs from the others. Invariant \`interest_on_balance\` could not be evaluated (it references a \`given rate\` absent from the execution traces), so it is UNCHECKED.
- COMPLETENESS (mutation battery, 8 behaviour-break kinds): detection 63%. BLIND SPOTS (0% detected): a corrupted inter-period balance roll-forward, and a non-monotonic (increasing) balance — the spec has no invariant linking one period's outstanding balance to the next.`;

const ARMS = {
  spec_only: () => `${INTENT}\n\n=== SPEC UNDER REVIEW ===\n${SPEC}`,
  prose: () => `${INTENT}\n\n=== SPEC UNDER REVIEW ===\n${SPEC}\n\n${PROSE}`,
  validated: () => `${INTENT}\n\n=== SPEC UNDER REVIEW ===\n${SPEC}\n\n${VALREPORT}`,
};
const TASK = `\n\nYou are reviewing this specification to decide whether to trust it as a correct and complete statement of the intended behaviour. Identify every ERROR (something it asserts that is false of the intended behaviour) and every OMISSION (intended behaviour it fails to constrain). Be specific.`;

function ask(p) {
  const r = spawnSync("claude", ["-p", p, "--output-format", "text", "--model", MODEL, "--max-turns", "2",
    "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,Task,Agent,WebFetch,WebSearch"], { encoding: "utf8", maxBuffer: 1 << 26, timeout: 180000 });
  return r.stdout || "";
}
function judge(review) {
  const out = ask(`Below is a spec review. Answer two yes/no questions about what the reviewer identified.\nF1: did they flag that the "every instalment is equal / level payment" invariant is WRONG because the LAST instalment differs? \nF2: did they flag the OMISSION that the spec has no inter-period balance roll-forward / monotonicity link (nothing constrains how one period's outstanding balance relates to the next)?\n\n=== REVIEW ===\n${review}\n\nOutput exactly two lines: \`F1: YES|NO\` and \`F2: YES|NO\`.`);
  return { f1: /F1:\s*YES/i.test(out) ? 1 : 0, f2: /F2:\s*YES/i.test(out) ? 1 : 0 };
}
const res = {};
for (const [arm, mk] of Object.entries(ARMS)) {
  res[arm] = { f1: 0, f2: 0, n: 0 };
  for (let r = 0; r < REPS; r++) {
    const review = ask(mk() + TASK + (r ? `\n(review ${r + 1})` : ""));
    writeFileSync(join(HERE, `eb_${arm}_${r}.txt`), review);
    const j = review.trim() ? judge(review) : { f1: 0, f2: 0 };
    res[arm].f1 += j.f1; res[arm].f2 += j.f2; res[arm].n++;
    console.error(`[${arm} ${r}] F1(over-claim)=${j.f1?"caught":"missed"} F2(blind-spot)=${j.f2?"caught":"missed"}`);
    writeFileSync(join(HERE, "explainback-result.json"), JSON.stringify(res, null, 2));
  }
}
console.log(`\n== PHASE 4 explain-back: catching a spec's real flaws (${REPS} reps) ==\n`);
console.log(`arm         F1 over-claim caught   F2 blind-spot caught`);
for (const [arm, a] of Object.entries(res)) console.log(`${arm.padEnd(11)} ${a.f1}/${a.n}                  ${a.f2}/${a.n}`);
console.log(`\n=> if 'validated' catches F1/F2 where spec_only/prose miss them, the confidence-builder is the mechanical VALIDATION (monitor+mutation), not the explanation.`);
