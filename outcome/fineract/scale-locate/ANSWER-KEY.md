# Answer key — load-bearing sites for double-entry on the loan posting path (JUDGE ONLY)

The task: over the full Fineract repo (~985k LOC Java, cannot be held in one context), locate the
code that is load-bearing for the invariant "for every posted loan transaction, Σ debit legs =
Σ credit legs". Established ground truth from a prior manual scout. Score how much of this the arm
recovered, and at what token cost. The arm never sees this key.

## Structural sites (localization — did they find WHERE the legs are posted)

- **S1 Entry/bridge.** The loan path enters accounting at
  `JournalEntryWritePlatformServiceJpaRepositoryImpl.createJournalEntriesForLoan(...)`
  (`.../accounting/journalentry/service/JournalEntryWritePlatformServiceJpaRepositoryImpl.java`, ~line 540).
- **S2 Cash-basis processor.** `CashBasedAccountingProcessorForLoan.java` splits the transaction into
  principal/interest/fee/penalty/overpayment legs and posts paired debit/credit rows.
- **S3 Accrual-basis processor.** `AccrualBasedAccountingProcessorForLoan.java` — same, accrual basis.
- **S4 Posting primitives + accumulators.** `AccountingProcessorHelper.java`,
  `createDebitJournalEntryForLoan` / `createCreditJournalEntryForLoan` (~lines 934-947, 969+).

## Deep insights (comprehension — did they find WHY a silent break is possible)

- **D1 The guard-gap (the load-bearing insight).** The double-entry check
  `checkDebitAndCreditAmounts(...)` (throws `DEBIT_CREDIT_SUM_MISMATCH`) guards ONLY the manual
  journal-entry REST path. The loan path calls the processor directly and NEVER invokes it. So the
  invariant is NOT enforced on loan-generated postings.
- **D2 The concrete break surface.** In `createJournalEntriesForChargeOffLoanRepayments`
  (`CashBasedAccountingProcessorForLoan.java`, ~527-725) credits come from a `GLAccountBalanceHolder`
  map while debits are a separately-accumulated `totalDebitAmount`; the two sides are never
  reconciled, so adding to one and forgetting the other posts unbalanced silently.

## Scoring (the judge outputs these)

- `RECALL_STRUCT`: of S1..S4, how many the arm correctly identified (0-4).
- `RECALL_INSIGHT`: of D1..D2, how many (0-2). D1 is the important one.
- `PRECISION`: FEW / SOME / MANY irrelevant or wrong sites asserted (fewer is better).
- `GUARD_GAP`: YES/NO — did the arm state that the loan path is NOT covered by the debit=credit check.
