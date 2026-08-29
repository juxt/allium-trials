# Double-entry balance oracle: build + baseline report

Substrate: Fineract at `/Users/hgarner/code/allium-trials/outcome/fineract/checkout`
(JDK 21, Gradle 8.14.5, module `fineract-provider`).

## 1. The oracle

Single self-contained JUnit 5 + Mockito test class:

`/Users/hgarner/code/allium-trials/outcome/fineract/checkout/fineract-provider/src/test/java/org/apache/fineract/accounting/journalentry/DoubleEntryBalanceOracleTest.java`

**Invariant checked.** For every loan transaction a processor turns into accounting, the sum of
DEBIT amounts it emits equals the sum of CREDIT amounts, per transaction, in the transaction
currency. This is the first law of double-entry bookkeeping; it is external to the code. It is NOT
enforced anywhere on the loan-generated posting path (only the manual journal-entry REST path is
guarded by `checkDebitAndCreditAmounts`), so a blind edit to a processor leg can silently break it.

**Mechanism.** The class mocks `AccountingProcessorHelper` (exactly as the two shipped processor
unit tests do) and installs a Mockito `Answer` on every posting primitive the loan processors call.
Each call accumulates its `amount`/`totalAmount` into a per-`transactionId` tally:

- single-sided `createDebitJournalEntryForLoan*` / `createDebitJournalEntryForLoanCharges*` /
  `createDebitJournalEntryForLoanByGLAccountId` -> DEBIT tally;
- single-sided `createCreditJournalEntryForLoan*` (including the `CashAccountsForLoan` and
  `AccrualAccountsForLoan` enum overloads used for the principal/interest legs) /
  `createCreditJournalEntryForLoanCharges` / `createCreditJournalEntryForLoanByGLAccountId` ->
  CREDIT tally;
- paired `createJournalEntriesForLoan(...)` (both overloads) and `createJournalEntriesForLoanCharges(...)`
  -> BOTH tallies (inherently balanced, `+amount` each side);
- `createSplitJournalEntriesForLoan(splits, total, ...)` -> replicated leg-for-leg: each split holder
  amount (when `> 0`) to DEBIT, the total holder amount (when `> 0`) to CREDIT, matching the real
  posting logic exactly.

After `processor.createJournalEntriesForLoan(loanDTO)`, the oracle asserts for EACH transactionId
that `debitTally.compareTo(creditTally) == 0`, with a failure message naming the fixture, the
transaction, and both totals. It also fails a fixture that emitted no entries at all (guards against
a fixture that silently exercises nothing).

Every helper mock stub is `lenient()` so unused overloads on a given path do not trip strict
stubbing. GL-account lookups return a distinct non-null `GLAccount` per account type, because the
write-off and charge-off paths key balance maps by the returned account and would otherwise silently
merge legs.

Enum-overload note discovered during the build: the principal and interest CREDIT legs of a repayment
call `createCreditJournalEntryForLoan(office, ccy, CashAccountsForLoan.LOAN_PORTFOLIO, ...)` /
`... AccrualAccountsForLoan ...` (the enum-typed 3rd-arg overloads), NOT the `int` overload. Missing
those overloads made the first run under-count credits. Both enum overloads are now stubbed. The
`createCreditJournalEntryForLoan(office, ccy, GLAccount, ...)` overload is private in the helper and
never reached from a processor; the processors use the public `(loanId, ..., GLAccount)` overload.

## 2. How to run it

```
./gradlew :fineract-provider:test --tests "org.apache.fineract.accounting.journalentry.DoubleEntryBalanceOracleTest"
```

- Confirmed working. Warm wall-clock: ~9-10s (Gradle daemon overhead dominates; actual test
  execution 1.4s for the 12 fixtures).
- Cold / first compile of the module: ~1m.

Harness sanity (oracle + the two shipped processor tests together):

```
./gradlew :fineract-provider:test \
  --tests "org.apache.fineract.accounting.journalentry.DoubleEntryBalanceOracleTest" \
  --tests "org.apache.fineract.accounting.journalentry.CreateJournalEntriesForChargeOffLoanTest" \
  --tests "org.apache.fineract.accounting.journalentry.CreateJournalEntriesForTransferLoanTest"
```

Result: 19 tests, all PASSED, 1.7s execution. The two shipped tests still pass.

## 3. Baseline result: CLEAN

Against the UNEDITED code, all 12 fixtures BALANCE (oracle passes). No latent double-entry gap was
found on the paths exercised. The baseline is clean.

12 fixtures, all balanced:

| Fixture | Processor | Legs exercised |
|---|---|---|
| cash repayment | Cash | principal + interest + fees + penalties |
| cash disbursement | Cash | principal + fund-source credit |
| cash write-off | Cash | principal |
| cash refund of overpayment | Cash | paired overpayment/fund-source |
| cash charge-off repayment | Cash | dual-accumulator charge-off path (credit map vs `totalDebitAmount`) |
| cash transfer initiation | Cash | paired transfer/portfolio |
| accrual repayment | Accrual | principal + interest + fees + penalties |
| accrual disbursement | Accrual | principal + fund-source credit |
| accrual write-off | Accrual | principal + interest + fees + penalties (per-account credit map + single debit) |
| accrual transfer approval | Accrual | paired portfolio/suspense |
| accrual charge-off | Accrual | principal + interest + fees + penalties charge-off legs |
| multi-transaction loan | Cash | disbursement + repayment on one loan, each txn balances independently |

## 4. Negative control (oracle catches breaks)

To prove a green baseline is not vacuous, one CREDIT leg of the cash repayment was temporarily
inflated by 1.00 (`principalAmount.add(1.00)`). The oracle failed exactly the two repayment fixtures
with a precise message:

```
DOUBLE-ENTRY VIOLATION in fixture 'cash repayment (principal+interest+fees+penalties)',
transaction 'cash-repay': sum of debits (340.00) != sum of credits (341.00).
```

Unrelated fixtures stayed green. The edit was reverted; `git diff` on the processor is now empty.

## 5. Which processor files / methods the fixtures exercise

The oracle drives real code in these production methods (the mock helper never runs; only the
processors do):

- `CashBasedAccountingProcessorForLoan`: `createJournalEntriesForLoan` dispatch,
  `createJournalEntriesForDisbursements`, `createJournalEntriesForLoanRepayments` (the per-leg credit
  + single `totalDebitAmount` debit pattern, incl. `createCreditJournalEntryForLoanCharges` for
  fees/penalties), `createJournalEntriesForRefund`, `createJournalEntriesForChargeOffLoanRepayments`
  (the dual-accumulator trap), `createJournalEntriesForTransfers`, write-off branch,
  `populateCreditDebitMaps`.
- `AccrualBasedAccountingProcessorForLoan`: dispatch, disbursement, `createJournalEntriesForLoanRepayments`,
  `createJournalEntriesForLoanWriteOffs` (per-account credit map + single debit),
  charge-off path, transfers.
- `AccountingProcessorHelper`: all loan posting primitives are the intercepted seam; their bodies do
  not run under the mock, which is the correct altitude for grading the processor's arithmetic.

Mapping to the scout's 10 edit tickets: the oracle catches any edit that changes a debit or credit
leg amount, drops a leg, adds an unmatched leg, re-rounds one side, guards one side with a threshold,
or mis-nets a split, on any of the repayment / disbursement / write-off / charge-off / refund /
transfer paths above. That covers tickets 1 (new fee bucket), 3 (rounding one leg), 4 (zero-amount
suppression on one side), 5 (partial overpayment refund), 7 (credit without matching debit), 8
(charge-off dual-accumulator), 9 (reverse one side of a pair), and 10 (per-period amortisation sum
mismatch). Tickets 2 (goodwill-credit reroute) and 6 (fee net + tax liability split) live on
branches not populated by the current battery (goodwill-credit type; charge tax payments); an edit
that unbalances them would only be caught if the battery is extended to those branches. All catchable
tickets are caught only when the edited path is one of the fixtures' paths, which the table above
enumerates.

Scope caveat (unchanged from the scout): the oracle mocks persistence, so it grades the processor's
emitted debit/credit arithmetic, not the JDBC writes. That is the layer at which a blind processor
edit breaks the balance.
