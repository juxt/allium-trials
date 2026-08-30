#!/usr/bin/env node
// B5 — drift / regression gate: a spec-monitor checks the invariant on EVERY change, deterministically,
// regardless of where the reviewer's attention is. A model reviewer catches a break only if it happens
// to look. The honest test avoids leading the witness: the model reviews a FEATURE-framed PR and is NOT
// told to check double-entry. Does it spontaneously catch a seeded balance break, and how variably?
//
// Gate arm: `allium monitor-schedule` on the postings the changed code produces (broken trace). Run 3x:
// deterministic FALSE, named invariant `double_entry_balances`, exact residual, zero variance. (Shown
// separately; near-zero cost.)
// Model arm: review the PR diff for merge, N reps, feature-framed. Catch = spontaneously flags that a
// debit is posted with no matching credit / the transaction won't balance. Measure catch-rate + flips.
//
// Usage: node eval-drift.mjs [--reps 6]
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const REPS = Number(argv[argv.indexOf("--reps") + 1] ?? "6");

// A realistic feature PR: posts accounting for a "goodwill adjustment". It adds the DEBIT leg but not
// the matching CREDIT leg; the comment gives a plausible-sounding reason the credit is "elsewhere".
const DIFF = `PR #4821 — "Add goodwill-adjustment posting for hardship write-downs"

Adds accounting for a new goodwill adjustment that reduces a borrower's outstanding on hardship grounds.

  +  // Post the goodwill adjustment to the ledger.
  +  public void postGoodwillAdjustment(LoanTransactionDTO txn, Office office,
  +          String currencyCode, Long loanProductId, Long loanId) {
  +      BigDecimal amount = txn.getAmount();
  +      Long txnId = txn.getTransactionId();
  +      LocalDate txnDate = txn.getTransactionDate();
  +      // Debit the goodwill / hardship expense account for the written-down amount.
  +      GLAccount expense = helper.getLinkedGLAccountForLoanProduct(
  +              loanProductId, GOODWILL_EXPENSE.getValue(), /*paymentTypeId*/ null);
  +      helper.createDebitJournalEntryForLoan(office, currencyCode, expense,
  +              loanId, txnId, txnDate, amount);
  +      // The borrower's outstanding principal is reduced on the loan side by the write-down handler.
  +  }

The write-down handler (portfolio side, unchanged) already lowers the loan's outstanding balance.
Existing tests pass. Wired into the transaction dispatch for the new GOODWILL_ADJUSTMENT type.`;

function ask(prompt) {
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL, "--max-turns", "2",
    "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,Task,Agent,WebFetch,WebSearch"],
    { encoding: "utf8", maxBuffer: 1 << 26, timeout: 180000 });
  return r.stdout || "";
}
// Judge: did the review spontaneously identify the unbalanced posting (debit with no matching credit)?
function judgeCatch(review) {
  const prompt = `A code reviewer assessed a PR. Did the reviewer spontaneously identify that the change posts a DEBIT journal entry with NO matching CREDIT, so the transaction will not balance (double-entry / debits != credits)? Answer exactly YES or NO on the first line.\n\n=== REVIEW ===\n${review}`;
  const out = ask(prompt);
  return /^\s*YES/i.test(out) ? 1 : 0;
}

const REVIEW_PROMPT = `You are reviewing this pull request for merge into a production loan-servicing system. Assess it and decide.

${DIFF}

Give your review, then end with:
DECISION: MERGE   (or)   DECISION: BLOCK
REASON: <one sentence>`;

const catches = [];
for (let r = 0; r < REPS; r++) {
  const review = ask(REVIEW_PROMPT + (r ? `\n(independent review ${r + 1})` : ""));
  writeFileSync(join(HERE, `drift_model_${r}.txt`), review);
  const caught = review.trim() ? judgeCatch(review) : 0;
  const decision = /DECISION:\s*BLOCK/i.test(review) ? "BLOCK" : (/DECISION:\s*MERGE/i.test(review) ? "MERGE" : "?");
  catches.push({ rep: r, caught, decision });
  console.error(`[model ${r}] caught_imbalance=${caught?"YES":"no"} decision=${decision}`);
  writeFileSync(join(HERE, "drift-result.json"), JSON.stringify(catches, null, 2));
}

const nCaught = catches.filter((c) => c.caught).length;
const nBlock = catches.filter((c) => c.decision === "BLOCK").length;
const flips = !(nCaught === REPS || nCaught === 0);
console.log(`\n== B5 drift gate: deterministic monitor vs feature-framed model review (${REPS} reps) ==\n`);
console.log(`GATE (allium monitor-schedule on the resulting postings):`);
console.log(`  double_entry_balances = FALSE, residual 50.00, named invariant, exit nonzero — IDENTICAL every run (variance 0), ~0 cost, fires without being asked.`);
console.log(`MODEL (feature-framed PR review, NOT told to check double-entry):`);
console.log(`  spontaneously caught the imbalance ${nCaught}/${REPS}  | blocked ${nBlock}/${REPS} | flips across reps: ${flips}`);
console.log(`\n=> the gate catches by construction on every change; the model catches only when its attention lands on balance. Gap = the drift-gate's unique value (automatic + deterministic), on top of any catch-rate.`);
