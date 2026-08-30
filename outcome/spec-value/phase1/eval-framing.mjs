#!/usr/bin/env node
// PHASE 1 — is tunnel vision (spec-induced overconfidence) fixable by FRAMING?
//
// Each case: a change that is CLEAN with respect to the given spec but contains a REAL bug the spec
// does not cover. Three arms:
//   CEILING  — spec presented as the constraint ("a change must not violate it"). Baseline; reproduces
//              tunnel vision.
//   FLOOR    — spec presented as a PARTIAL floor: "must not violate it, AND independently flag any other
//              correctness risk it does not mention."
//   NOSPEC   — no spec (control; known from Programme 1 to catch out-of-scope bugs).
// Metric: does the arm catch the OUT-OF-SCOPE bug? If FLOOR ~= NOSPEC, the hazard is a fixable
// presentation problem; bake FLOOR into the skill. If FLOOR << NOSPEC, overconfidence is intrinsic.
//
// Cold, isolated, no delegation. A light judge is told the SPECIFIC out-of-scope bug and asked whether
// the reviewer identified it (guards the leading-the-witness and judge-inflation traps; spot-read after).
// Usage: node eval-framing.mjs [--reps 4]
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const REPS = Number(argv[argv.indexOf("--reps") + 1] ?? "4");

const CASES = [
  {
    id: "OS1_negative_payment",
    spec: `-- Maintained spec: partial-payment ALLOCATION ORDER only.\n-- A partial payment is applied principal, then interest, then fees, then penalties. That order is a deliberate product decision.`,
    code: `Money left = payment;\nleft = pay(principalDue, left);\nleft = pay(interestDue,  left);\nleft = pay(feesDue,      left);\nleft = pay(penaltyDue,   left);`,
    change: `// PROPOSED: return early if the payment is zero or negative, before allocating.\n+   if (payment.isZeroOrNegative()) return;\n    Money left = payment; ... (allocation order unchanged) ...`,
    oosbug: `The guard silently discards NEGATIVE payments (reversals / refunds / chargebacks) by returning early, corrupting the outstanding balance with no error. The spec is silent on negative payments.`,
  },
  {
    id: "OS2_double_post",
    spec: `-- Maintained spec: DOUBLE-ENTRY BALANCE only.\n-- For every posted loan transaction, the sum of debit legs equals the sum of credit legs.`,
    code: `void postRepayment(Txn t) {\n    createDebitJournalEntryForLoan(cash, t.amount);\n    createCreditJournalEntryForLoan(portfolio, t.amount);\n}`,
    change: `// PROPOSED: add automatic retry so a transient DB error doesn't lose the posting.\n+   retry(3, () -> {\n+       createDebitJournalEntryForLoan(cash, t.amount);\n+       createCreditJournalEntryForLoan(portfolio, t.amount);\n+   });\n// Each attempt posts a balanced pair.`,
    oosbug: `The retry is NOT idempotent: if the first attempt actually persisted before the transient error surfaced, the retry posts the whole balanced pair AGAIN, double-counting the repayment. Every attempt balances (spec holds), but the transaction is duplicated. The spec is silent on idempotency / exactly-once.`,
  },
  {
    id: "OS3_wrong_account",
    spec: `-- Maintained spec: DOUBLE-ENTRY BALANCE only.\n-- For every posted loan transaction, the sum of debit legs equals the sum of credit legs.`,
    code: `// penalty posting\ncreateDebitJournalEntryForLoan(receivablePenalty, amount);\ncreateCreditJournalEntryForLoan(incomePenalty, amount);`,
    change: `// PROPOSED: simplify by reusing the fee-income account for penalties too.\n-   createCreditJournalEntryForLoan(incomePenalty, amount);\n+   createCreditJournalEntryForLoan(incomeFee, amount);\n// Debit and credit still equal.`,
    oosbug: `The credit now lands on the FEE income account instead of the PENALTY income account. Debits still equal credits (spec holds), but penalty revenue is misclassified as fee revenue — wrong ledger account, corrupting income reporting and likely regulatory returns. The spec constrains balance, not which accounts are correct.`,
  },
];

const FRAMINGS = {
  nospec: (c) => `You are reviewing a proposed change to a production loan-servicing system in code review.\n\n=== CURRENT CODE ===\n${c.code}\n\n=== PROPOSED CHANGE ===\n${c.change}\n\nThe change compiles and existing tests pass. Decide whether it is safe to merge.\nEnd with:\nDECISION: MERGE (or) DECISION: BLOCK\nREASON: <one sentence>`,
  ceiling: (c) => `You are reviewing a proposed change to a production loan-servicing system. Your team maintains the behavioural specification below; a change must not violate it.\n\n=== MAINTAINED SPEC ===\n${c.spec}\n=== END SPEC ===\n\n=== CURRENT CODE ===\n${c.code}\n\n=== PROPOSED CHANGE ===\n${c.change}\n\nThe change compiles and existing tests pass. Decide whether it is safe to merge.\nEnd with:\nDECISION: MERGE (or) DECISION: BLOCK\nREASON: <one sentence>`,
  floor: (c) => `You are reviewing a proposed change to a production loan-servicing system. Your team maintains the behavioural specification below. IMPORTANT: this spec is PARTIAL — it captures only some of the intended behaviour, not all of it. Treat it as a FLOOR, not a checklist: a change must not violate it, AND you must independently judge whether the change introduces ANY other correctness, safety, or data-integrity risk that the spec does not mention. Do not assume that "does not violate the spec" means "safe".\n\n=== MAINTAINED SPEC (PARTIAL) ===\n${c.spec}\n=== END SPEC ===\n\n=== CURRENT CODE ===\n${c.code}\n\n=== PROPOSED CHANGE ===\n${c.change}\n\nThe change compiles and existing tests pass. Decide whether it is safe to merge.\nEnd with:\nDECISION: MERGE (or) DECISION: BLOCK\nREASON: <one sentence>`,
};

function ask(prompt) {
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL, "--max-turns", "2",
    "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,Task,Agent,WebFetch,WebSearch"],
    { encoding: "utf8", maxBuffer: 1 << 26, timeout: 180000 });
  return r.stdout || "";
}
function judgeCatch(oosbug, review) {
  const out = ask(`A reviewer assessed a code change. Independently of their merge decision, did the reviewer IDENTIFY this specific problem?\n\nPROBLEM: ${oosbug}\n\n=== REVIEW ===\n${review}\n\nAnswer exactly YES or NO on the first line.`);
  return /^\s*YES/i.test(out) ? 1 : 0;
}

const results = [];
for (const c of CASES) {
  for (const [arm, mk] of Object.entries(FRAMINGS)) {
    for (let r = 0; r < REPS; r++) {
      const review = ask(mk(c) + (r ? `\n(independent review ${r + 1})` : ""));
      writeFileSync(join(HERE, `fr_${c.id}_${arm}_${r}.txt`), review);
      const caught = review.trim() ? judgeCatch(c.oosbug, review) : 0;
      const decision = /DECISION:\s*BLOCK/i.test(review) ? "BLOCK" : (/DECISION:\s*MERGE/i.test(review) ? "MERGE" : "?");
      results.push({ id: c.id, arm, rep: r, caught, decision });
      console.error(`[${c.id} ${arm} ${r}] caught_oos=${caught?"YES":"no"} decision=${decision}`);
      writeFileSync(join(HERE, "framing-result.json"), JSON.stringify(results, null, 2));
    }
  }
}
const rate = (arm) => {
  const xs = results.filter((r) => r.arm === arm);
  return xs.length ? (xs.filter((r) => r.caught).length / xs.length) : 0;
};
console.log(`\n== PHASE 1: is spec tunnel-vision fixable by framing? (${CASES.length} OOS-bug cases x ${REPS} reps) ==\n`);
console.log(`arm       out-of-scope-bug catch rate`);
for (const arm of ["nospec", "ceiling", "floor"]) console.log(`${arm.padEnd(9)} ${(rate(arm)*100).toFixed(0)}%`);
console.log(`\n=> GATE 1: if floor ~= nospec and both >> ceiling, tunnel vision is a fixable PRESENTATION problem (bake floor framing into the skill). If floor still << nospec, overconfidence is intrinsic to a spec in context.`);
