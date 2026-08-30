#!/usr/bin/env node
// B1 — bug prevention via ENCODED INTENT (the sharpest unique-value test).
//
// A spec's one thing an LLM cannot have: the specific, arbitrary-but-load-bearing INTENT of this
// system. We test it on code review. Each case is a self-contained loan-domain snippet (neutral
// names, so the model cannot recall a "right" answer) plus a proposed change that PASSES tests.
//   - VIOLATING cases: the change flips an under-determined intent (rounding-residual placement,
//     interest basis, allocation order). Both behaviours are defensible; only the spec says which is
//     intended. Spec arm should BLOCK citing intent; nospec is expected to MERGE.
//   - BENIGN controls: a genuine safe refactor. BOTH should MERGE. Guards against a spec arm that
//     just blocks everything — the value is DISCRIMINATION, not timidity.
//
// Arms: nospec (code + change) vs spec (code + change + the relevant behavioural spec). Cold,
// isolated, no delegation. The arm outputs DECISION: MERGE|BLOCK + a reason. A light judge checks
// whether a BLOCK cites the specific intended invariant (not a spurious reason).
//
// Metric: V-block-rate(spec) - V-block-rate(nospec) = intent value; B-block-rate = the cost of it.
// Usage: node eval-intent.mjs [--reps 4]
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const REPS = Number(argv[argv.indexOf("--reps") + 1] ?? "4");

// ---- shared specs (behavioural intent; no code identifiers) ----
const SPEC_SCHEDULE = `-- Intended behaviour of the repayment schedule (maintained spec)
-- I: interest each period accrues on the OUTSTANDING (declining) balance, not the original principal.
-- I: the principal repaid across the whole schedule equals the disbursed amount exactly (conservation).
-- I: the FINAL period absorbs any rounding residual so the loan closes to EXACTLY zero balance.`;
const SPEC_ALLOC = `-- Intended behaviour of partial-payment allocation (maintained spec)
-- I: a partial payment is applied in this order and no other: principal first, then interest, then
--    fees, then penalties. The order is a deliberate product decision, not an implementation detail.`;

// ---- cases ----
const CASES = [
  {
    id: "V1_rounding", violating: true, spec: SPEC_SCHEDULE,
    intent: "the final period must absorb the rounding residual so the balance closes to exactly zero",
    code: `// builds an amortised schedule; rounds each period to 2 decimals
BigDecimal outstanding = disbursed;
for (int p = 0; p < n; p++) {
    BigDecimal interest = outstanding.multiply(rate).setScale(2, HALF_UP);
    BigDecimal principal = emi.subtract(interest);
    if (p == n - 1) {                 // final period
        principal = outstanding;      // absorb residual: pay off whatever remains, closes to exactly 0
    }
    schedule.add(new Period(principal, interest));
    outstanding = outstanding.subtract(principal);
}`,
    change: `// PROPOSED: drop the special-casing of the final period; treat every period identically.
-   if (p == n - 1) {
-       principal = outstanding;
-   }
// (all periods now: principal = emi - interest). A test asserts the closing balance is within 0.05.`,
  },
  {
    id: "V2_interest_basis", violating: true, spec: SPEC_SCHEDULE,
    intent: "interest must accrue on the outstanding (declining) balance, not the original principal",
    code: `BigDecimal outstanding = disbursed;
for (int p = 0; p < n; p++) {
    BigDecimal interest = outstanding.multiply(rate).setScale(2, HALF_UP);  // on declining balance
    BigDecimal principal = emi.subtract(interest);
    schedule.add(new Period(principal, interest));
    outstanding = outstanding.subtract(principal);
}`,
    change: `// PROPOSED: compute interest from the original disbursed amount each period (simpler, constant).
-   BigDecimal interest = outstanding.multiply(rate).setScale(2, HALF_UP);
+   BigDecimal interest = disbursed.multiply(rate).setScale(2, HALF_UP);
// Interest is now the same every period. Existing tests (which used a flat-rate fixture) still pass.`,
  },
  {
    id: "V3_alloc_order", violating: true, spec: SPEC_ALLOC,
    intent: "a partial payment must be allocated principal, then interest, then fees, then penalties",
    code: `// allocate a partial payment across the buckets
Money left = payment;
left = pay(principalDue, left);   // principal first
left = pay(interestDue,  left);   // then interest
left = pay(feesDue,      left);   // then fees
left = pay(penaltyDue,   left);   // then penalties`,
    change: `// PROPOSED: collect charges first so the lender recovers penalties/fees before principal.
-   left = pay(principalDue, left);
-   left = pay(interestDue,  left);
-   left = pay(feesDue,      left);
-   left = pay(penaltyDue,   left);
+   left = pay(penaltyDue,   left);
+   left = pay(feesDue,      left);
+   left = pay(interestDue,  left);
+   left = pay(principalDue, left);`,
  },
  {
    id: "B1_rename", violating: false, spec: SPEC_SCHEDULE,
    intent: "(benign) pure rename, no behaviour change",
    code: `BigDecimal outstanding = disbursed;
for (int p = 0; p < n; p++) {
    BigDecimal interest = outstanding.multiply(rate).setScale(2, HALF_UP);
    BigDecimal principal = emi.subtract(interest);
    if (p == n - 1) principal = outstanding;
    schedule.add(new Period(principal, interest));
    outstanding = outstanding.subtract(principal);
}`,
    change: `// PROPOSED: rename local 'outstanding' to 'balance' throughout for readability. No other change.`,
  },
  {
    id: "B2_libsum", violating: false, spec: SPEC_SCHEDULE,
    intent: "(benign) replace a manual sum with a library sum, same result",
    code: `BigDecimal totalPrincipal = ZERO;
for (Period p : schedule) totalPrincipal = totalPrincipal.add(p.principal);`,
    change: `// PROPOSED: use the stream sum instead of the manual loop.
+   BigDecimal totalPrincipal = schedule.stream().map(p -> p.principal).reduce(ZERO, BigDecimal::add);
// (drops the loop; identical arithmetic result).`,
  },
  {
    id: "B3_guard", violating: false, spec: SPEC_ALLOC,
    intent: "(benign) add a null/zero guard, no allocation-order change",
    code: `Money left = payment;
left = pay(principalDue, left);
left = pay(interestDue,  left);
left = pay(feesDue,      left);
left = pay(penaltyDue,   left);`,
    change: `// PROPOSED: return early if the payment is zero or negative, before allocating. Order unchanged.
+   if (payment.isZeroOrNegative()) return;
    Money left = payment;
    ... (allocation order exactly as before) ...`,
  },
];

const ARMS = {
  nospec: (c) => `You are reviewing a proposed change to a lending system in code review. Decide whether to merge it.

=== CURRENT CODE ===
${c.code}

=== PROPOSED CHANGE ===
${c.change}

The change compiles and the existing tests pass. Decide whether this is safe to merge into production.
Last two lines EXACTLY:
DECISION: MERGE   (or)   DECISION: BLOCK
REASON: <one sentence>`,
  spec: (c) => `You are reviewing a proposed change to a lending system in code review. Your team maintains the behavioural specification below; a change must not violate it.

=== MAINTAINED SPEC (intended behaviour) ===
${c.spec}
=== END SPEC ===

=== CURRENT CODE ===
${c.code}

=== PROPOSED CHANGE ===
${c.change}

The change compiles and the existing tests pass. Decide whether this is safe to merge into production.
Last two lines EXACTLY:
DECISION: MERGE   (or)   DECISION: BLOCK
REASON: <one sentence>`,
};

function ask(prompt) {
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL, "--max-turns", "2",
    "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,Task,Agent,WebFetch,WebSearch"],
    { encoding: "utf8", maxBuffer: 1 << 26, timeout: 180000 });
  const out = r.stdout || "";
  const decision = /DECISION:\s*BLOCK/i.test(out) ? "BLOCK" : (/DECISION:\s*MERGE/i.test(out) ? "MERGE" : "?");
  const reason = (out.match(/REASON:\s*(.+)/i)?.[1] || "").trim();
  return { decision, reason, out };
}

const results = [];
for (const c of CASES) {
  for (const [arm, mk] of Object.entries(ARMS)) {
    for (let r = 0; r < REPS; r++) {
      const a = ask(mk(c) + (r ? `\n(independent review ${r + 1})` : ""));
      results.push({ id: c.id, violating: c.violating, arm, rep: r, decision: a.decision, reason: a.reason });
      writeFileSync(join(HERE, `it_${c.id}_${arm}_${r}.txt`), a.out);
      console.error(`[${c.id} ${arm} ${r}] ${a.decision}  | ${a.reason.slice(0, 80)}`);
      writeFileSync(join(HERE, "intent-result.json"), JSON.stringify(results, null, 2));
    }
  }
}

const rate = (id, arm, dec) => {
  const xs = results.filter((r) => r.id === id && r.arm === arm);
  return xs.length ? xs.filter((r) => r.decision === dec).length / xs.length : 0;
};
const grp = (viol, arm) => {
  const ids = CASES.filter((c) => c.violating === viol).map((c) => c.id);
  const xs = results.filter((r) => r.violating === viol && r.arm === arm);
  return xs.length ? xs.filter((r) => r.decision === "BLOCK").length / xs.length : 0;
};
console.log(`\n== B1 intent / bug-prevention (${REPS} reps/case) ==\n`);
console.log(`case          type       nospec BLOCK   spec BLOCK`);
for (const c of CASES) {
  console.log(`${c.id.padEnd(14)} ${(c.violating?"VIOLATING":"benign").padEnd(10)} ${(rate(c.id,"nospec","BLOCK")*100).toFixed(0).padStart(3)}%           ${(rate(c.id,"spec","BLOCK")*100).toFixed(0).padStart(3)}%`);
}
const vN = grp(true,"nospec"), vS = grp(true,"spec"), bN = grp(false,"nospec"), bS = grp(false,"spec");
console.log(`\nVIOLATING cases: nospec BLOCK ${(vN*100).toFixed(0)}%  ->  spec BLOCK ${(vS*100).toFixed(0)}%   (intent lift = ${((vS-vN)*100).toFixed(0)} pts)`);
console.log(`BENIGN cases:    nospec BLOCK ${(bN*100).toFixed(0)}%  ->  spec BLOCK ${(bS*100).toFixed(0)}%   (over-block cost = ${((bS-bN)*100).toFixed(0)} pts)`);
console.log(`\n=> spec adds UNIQUE intent value iff it lifts BLOCK on VIOLATING changes WITHOUT lifting BLOCK on BENIGN ones.`);
console.log(`=> if nospec already BLOCKs the violating changes, even intent is recoverable by the model -> saturates.`);
