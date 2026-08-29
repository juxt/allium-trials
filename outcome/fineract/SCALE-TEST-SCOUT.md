# Scale-test scout: cross-module accounting invariant in Fineract loan code

Substrate: Fineract 1.15.0 at `/Users/hgarner/code/allium-trials/outcome/fineract/checkout`
(JDK 21, Gradle 8.14.5). Read-only scout. No code modified.

Verdict up front: **FEASIBLE, cheap path (a) is real.** The loan -> journal-entry code
is unit-testable with pure Mockito, no DB, no Spring. The double-entry invariant is
genuinely cross-module, has independent authority, and is **not enforced anywhere on the
loan-generated posting path** so silent breaks are possible. Per-edit check cost is
~10-25s warm.

---

## 1. The invariant

**Double-entry balance per loan transaction posting.** For every loan transaction that
produces accounting, the sum of the debit journal entries it emits equals the sum of the
credit journal entries it emits (in the transaction's currency):

```
for a given (loanId, transactionId):  Σ debit amounts  ==  Σ credit amounts
```

This is the first law of double-entry bookkeeping. It is true regardless of what Fineract's
code says. It is not the EMI/annuity formula and not any property distilled from the loan
schedule code. It is an external accounting law: a posted transaction that does not balance
is a corrupt ledger.

Modules it spans (the two ends are far apart):

- **Producer end (loan domain).** A loan operation builds a `LoanTransaction` and, on
  commit, hands an accounting bridge DTO to the accounting layer.
  Bridge entry: `JournalEntryWritePlatformServiceJpaRepositoryImpl.createJournalEntriesForLoan(AccountingBridgeDataDTO)`
  at `fineract-provider/.../accounting/journalentry/service/JournalEntryWritePlatformServiceJpaRepositoryImpl.java:540`.
- **Effect end (accounting domain).** The processor splits the transaction into
  principal / interest / fees / penalties / overpayment legs and emits paired debit and
  credit `JournalEntry` rows to the general ledger:
  - `fineract-provider/.../accounting/journalentry/service/CashBasedAccountingProcessorForLoan.java` (1014 lines)
  - `fineract-provider/.../accounting/journalentry/service/AccrualBasedAccountingProcessorForLoan.java` (2243 lines)
  - Posting primitives + the per-transaction accumulators in
    `AccountingProcessorHelper.java` (`createDebitJournalEntryForLoan` /
    `createCreditJournalEntryForLoan`, lines 934-947, 969+).

The developer who edits a loan feature touches the loan/portfolio side or the
per-leg branching inside the processor. The balance is only observable when you sum across
all legs of a transaction, which no single edit site shows you. See span check (§4).

### The load-bearing finding: the invariant is NOT enforced on the loan path

There are two double-entry checks in the codebase, and **neither guards the loan-generated
postings**:

- `checkDebitAndCreditAmounts(...)` (`JournalEntryWritePlatformServiceJpaRepositoryImpl.java:306-326`,
  throws `DEBIT_CREDIT_SUM_MISMATCH`) guards only the **manual journal-entry REST API**
  path (`SingleDebitOrCreditEntryCommand[]`, called at lines 197/217/651). The loan path
  at line 540-549 calls `accountingProcessorForLoan.createJournalEntriesForLoan(loanDTO)`
  directly and **never calls it**.
- The "Meltdown in advanced accounting" check in `AccountingProcessorHelper.java:427-440`
  only validates that split **charge** credits/debits each sum to the charge total. It does
  not cover the principal/interest/fee/penalty/overpayment legs of a normal repayment, and
  it does not compare total debits against total credits across the transaction.

In `createJournalEntriesForChargeOffLoanRepayments`
(`CashBasedAccountingProcessorForLoan.java:527-725`), credits come from a
`GLAccountBalanceHolder` map while the debit side is a **separately accumulated**
`totalDebitAmount` (or a per-account debit map). The two accumulators are never reconciled.
Add an amount to one accumulator and forget the other and the transaction posts unbalanced,
silently. This is exactly the silent-break surface the experiment wants.

---

## 2. Checkability + cost — the critical question

Ranked, best first.

### (a) Pure unit-level check — REAL, and this is the recommended oracle.

The journal-entry creation for a loan transaction is fully testable with no running app and
no DB. Proof: two such tests already ship and pass:

- `fineract-provider/src/test/java/org/apache/fineract/accounting/journalentry/CreateJournalEntriesForChargeOffLoanTest.java`
- `fineract-provider/src/test/java/org/apache/fineract/accounting/journalentry/CreateJournalEntriesForTransferLoanTest.java`

They are `@ExtendWith(MockitoExtension.class)`, `@Mock AccountingProcessorHelper helper`,
`@InjectMocks ...ProcessorForLoan processor`, build a `LoanDTO`/`LoanTransactionDTO` by hand,
call `processor.createJournalEntriesForLoan(loanDTO)`, and `verify(...)` the helper calls.

The existing tests only assert *which* debit/credit calls happen. For our invariant we make
the mock **accumulate** instead of just record: a spy/`Answer` on the `AccountingProcessorHelper`
that captures the `amount` argument of every `createDebitJournalEntryForLoan*` /
`createCreditJournalEntryForLoan*` / paired-`createJournalEntriesForLoan(...)` call into a
per-transaction debit and credit tally, then asserts `Σdebits.compareTo(Σcredits) == 0`.
(The paired `createJournalEntriesForLoan(debitAcct, creditAcct, ..., amount)` helper posts
one debit and one credit of the same `amount`, so it is inherently balanced; count it as
`+amount` to both sides. The single-sided `createDebit.../createCredit...` calls are where
drift enters and must each be tallied on their one side.) The oracle then runs a fixed
battery of `LoanDTO` fixtures (repayment, charge-off repayment, disbursement, write-off,
refund, transfer) and fails if any transaction is unbalanced.

Cost (measured, warm Gradle daemon, JDK 21):

- Actual test execution: **1.3s** for the 7 existing tests.
- Warm no-op invocation: ~5s Gradle overhead.
- **After editing one leaf file in the processor and re-running the two tests: ~10-25s
  wall clock** (incremental compile of the changed file + its dependency closure, ~1.3s
  test run, Gradle graph overhead).
- Cold / first run (full module compile): **~1m 9s**.
- Worst case: editing a widely-depended-on class (core interface, base entity) recompiles a
  large closure and approaches the cold ~1m. Loan-processor files are leaf-ish, so the
  common case is the ~10-25s figure.

Command:
```
./gradlew :fineract-provider:test \
  --tests "org.apache.fineract.accounting.journalentry.CreateJournalEntriesForChargeOffLoanTest" \
  --tests "org.apache.fineract.accounting.journalentry.CreateJournalEntriesForTransferLoanTest"
```
Swap in our oracle test class name once written. Module: `fineract-provider`
(~2456 main + ~257 test source files; Gradle incremental compiler recompiles only the
changed file and dependents, verified, not the whole module).

**Caveat on oracle authority.** Because the existing unit tests mock the helper, our oracle
also mocks it. That means the oracle checks that **the processor emits balanced debit/credit
amounts** for a transaction. It does NOT exercise the real DB persistence. That is the right
altitude for this experiment: the invariant lives in the processor's arithmetic, and a blind
edit to the processor is exactly what we are measuring. We are not claiming to test the JDBC
writes.

### (b) Existing integration test that exercises loan + accounting together — exists, heavy.

There is a large integration-test surface (`integration-tests/`, `fineract-e2e-tests-*`)
that boots the full provider against a DB and drives loans through disbursement/repayment
with accounting enabled. These are the authoritative end-to-end checks but they need the
whole Spring context + a database (H2/embedded for some, MariaDB for the full suite) and run
in minutes, not seconds. Overkill as a per-edit oracle for a fan-out experiment. Use only as
a one-off sanity confirmation of the design, not as the grader.

### (c) Not cheaply checkable without full runtime — N/A.

Path (a) removes this concern for the arithmetic invariant.

---

## 3. Threatening edits (realistic local loan-feature tasks, blind to the invariant)

Each is the kind of ticket a developer gets, touching the processor or an adjacent leg,
where the balance can silently break. All target
`CashBasedAccountingProcessorForLoan` / `AccrualBasedAccountingProcessorForLoan` /
`AccountingProcessorHelper`.

1. **"Add a new fee bucket to repayment postings."** Developer adds the fee to the debit
   `totalDebitAmount` accumulator but forgets to `populateCreditDebitMaps` for the credit
   leg (or vice versa). Debits and credits diverge.
2. **"Route goodwill-credit interest to a different income account."** Developer changes the
   credit account and, while refactoring the branch, drops one leg's credit call. Silent
   one-sided posting.
3. **"Change rounding of the interest leg to 2dp / half-even."** Developer rounds the amount
   fed to the debit leg but the credit leg keeps the unrounded value; the two legs no longer
   sum equal.
4. **"Suppress zero-amount legs to reduce GL noise."** Developer adds a
   `> 0` guard on the credit side but the debit total already included the amount (or the
   guard threshold differs between sides). Balance drifts.
5. **"Support partial overpayment refund."** Developer subtracts the refunded portion from
   the credit leg but leaves `totalDebitAmount` unchanged.
6. **"Split fee income into net + tax liability."** Developer credits net income + tax
   liability but debits the gross once, or debits both, mismatching the credit total
   (`chargeTaxPayments`, `LoanTransactionDTO`).
7. **"Add merchant-issued-refund handling to a leg that lacked it."** New branch posts a
   credit without the matching debit accumulation.
8. **"Change charge-off repayment to net principal against recovery income."** Developer
   edits the credit map population but not the parallel `totalDebitAmount`, exactly the
   `createJournalEntriesForChargeOffLoanRepayments` dual-accumulator trap.
9. **"Reverse the debit/credit direction for a corrected transfer."** Developer flips one
   side's account but not the amount source, or flips only one of the paired calls.
10. **"Amortise a deferred fee over periods."** Per-period credit legs sum to more/less than
    the single debit posted for the period.

Each ticket names a loan/accounting *feature*, not a balance rule. A developer implementing
it need never think about "does this still net to zero across all legs", which is the point.

---

## 4. Span check — the invariant is not visible from a local edit

Confirmed. The edit site and the assertion site are different code:

- The developer edits **one leg** of a transaction (e.g. the interest branch of
  `createJournalEntriesForChargeOffLoanRepayments`, or a `populateCreditDebitMaps` call, or a
  rounding helper). Each leg call is locally self-consistent-looking: it names an account and
  an amount.
- The invariant only shows up when you **sum every leg's debit against every leg's credit
  for the whole transaction**, which happens across the credit-map loop
  (`CashBasedAccountingProcessorForLoan.java:691-712`) and the separately accumulated
  `totalDebitAmount`, then across the real persistence. No single edit site displays the sum.
- Crucially there is **no assertion at all** on this path (§1): nothing in the loan posting
  code recomputes `Σdebits == Σcredits`. So the local editor cannot "see" the invariant even
  by reading nearby code; there is no guard to notice. The only place that concept is written
  down (`checkDebitAndCreditAmounts`) is in a different method on the manual-JE API path the
  editor has no reason to open.

This is a genuine cross-module, cross-file invariant with an unguarded gap between the two
ends. Ideal for the silent-break measurement.

---

## 5. Feasibility verdict and concrete design

**The cheap (a) version is real. Go.**

Concrete test design:

- **Invariant:** per-loan-transaction double-entry balance, Σdebits == Σcredits, in the
  processor's emitted amounts.
- **Oracle (grader):** a JUnit 5 + Mockito test class in
  `fineract-provider/src/test/java/org/apache/fineract/accounting/journalentry/`, modelled on
  `CreateJournalEntriesForChargeOffLoanTest`. Replace the plain `@Mock` verification with an
  `AccountingProcessorHelper` mock whose `createDebit*`/`createCredit*`/paired
  `createJournalEntriesForLoan(...)` stubs accumulate `amount` into per-`transactionId`
  debit and credit tallies (via `Answer`/`ArgumentCaptor`). After
  `processor.createJournalEntriesForLoan(loanDTO)`, assert each transaction's tallies are
  equal. Drive a fixed battery of `LoanDTO` fixtures covering repayment, charge-off
  repayment, disbursement, write-off, refund/credit-balance-refund, and transfer. This is
  deterministic and independent of the edit.
- **Oracle command:**
  `./gradlew :fineract-provider:test --tests "<OurBalanceOracleTest FQCN>"`
  (warm ~10-25s after a leaf edit; ~1.3s execution).
- **Blind edits:** hand each agent one ticket from §3, scoped to the loan/accounting
  processor files, with the oracle test class hidden/removed from the working tree so the
  agent cannot read the balance assertion. Grade by restoring the oracle and running it.
- **Baseline:** the two shipped tests currently pass, confirming the harness compiles and the
  fixtures are constructible (`LoanTransactionDTO` is a Lombok `@Getter`/`@RequiredArgsConstructor`
  class; the existing tests show the exact constructor call).

Lightest viable fallback (not needed, but on record): if the cross-module accounting oracle
were somehow too heavy, the same harness shape gives a within-processor cross-leg invariant
(each transaction's per-leg debit total equals its per-leg credit total, checked on the same
mock). It is strictly a subset of what (a) already does, so there is no cheaper fallback to
reach for; (a) is already at unit-test cost.

Honesty notes:

- The oracle mocks the persistence helper, so it grades the processor's arithmetic, not JDBC
  writes. That is the correct scope for measuring blind-edit breaks in the processor.
- Worst-case per-edit cost rises toward ~1m if an agent edits a foundational class; loan
  processor files are leaf-ish so this is rare.
- The absence of any runtime double-entry guard on the loan path is the feature that makes
  silent breaks possible and the experiment meaningful; it is also, separately, a real gap in
  Fineract.
