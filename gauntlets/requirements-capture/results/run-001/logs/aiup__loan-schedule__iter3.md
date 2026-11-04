# aiup — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 15 · Captured: 10/14 · Bespoke captured: 4/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured prompt didn't go through. I'll just ask directly, in prose. These are the policy decisions that determine the actual numbers, and none can be safely inferred from the brief. Please answer each.

**1. Amortisation method** — what stays constant across the schedule?
- (a) Equal total instalment (annuity/French: constant payment, principal share rises)
- (b) Equal principal (constant principal, falling total instalment)
- (c) Interest-only with a principal bullet at the end

**2. Interest basis / day-count** — how is the monthly interest derived from the annual nominal rate?
- (a) Nominal ÷ 12 flat (period length in days ignored)
- (b) 30/360
- (c) Actual/365 fixed (uses real days between instalment dates)
- (d) Actual/360

**3. Rounding** — precision and rule for monetary amounts?
- (a) 2 dp, round-half-up
- (b) 2 dp, round-half-even (banker's)
- (c) Whole currency units
- (d) No rounding (full precision)

**4. Residual reconciliation** — where does the accumulated rounding difference go so the balance closes at exactly zero?
- (a) Adjust the final instalment
- (b) Adjust the first instalment
- (c) Spread across the schedule
- (d) Leave the residual (balance may be a few minor units off)

**5. First instalment due date** — given the disbursement date, when is instalment 1 due? (e.g. exactly one calendar month after disbursement; a fixed day of the month such as the 1st; something else?)

**6. Odd first period** — if the gap between disbursement and the first instalment isn't a whole month, do you charge pro-rata "odd-days" interest for that stub period, or is every period treated as a full month regardless?

**7. Month-end date rule** — how are due dates rolled when the anniversary day doesn't exist (e.g. disbursed on the 31st, or 30/31 Jan → Feb)? Last-day-of-month, or roll forward/back?

**8. Zero-interest case** — if the rate is 0%, confirm the schedule is just principal ÷ term (straight-line), with the residual handled as in Q4.

**9. Output fields** — beyond interest, principal and running balance per instalment, do you want each row to also carry the instalment number, due date, and total payment? And should the function return any summary (total interest, total repayable)?

**10. Input validation** — what should `generate_schedule` reject or how should it behave on bad input (negative or zero principal, negative rate, zero or negative term, missing disbursement date)? Error, or defined default?

Answer whichever you're sure of; for any you're unsure about, say so and I'll flag it in the spec as needing confirmation rather than guessing.
A: Answers in order:

**1. Amortisation method:** (b) Equal principal. A constant principal slice each period (P/n), interest on the reducing balance, so the total instalment falls each month.

**2. Interest basis / day-count:** (b) 30/360. Every month is treated as 30 days, the year as 360. Period length in actual days is ignored for accrual purposes.

**3. Rounding:** Whole shilling — no cents in any instalment. Intermediate working values may carry 2 dp, but each instalment figure is rounded to the nearest whole shilling.

**4. Residual reconciliation:** (a) Adjust the final instalment. The accumulated rounding difference from all prior periods is absorbed into the last instalment so the closing balance is exactly zero.

**5. First instalment due date:** Exactly one calendar month after the disbursement date. Subsequent instalments monthly from there.

**6. Odd first period:** Charge it. If disbursement falls before the first full period start, a stub interest charge is levied for those extra days. Partial-period interest is allowed and collected.

**7. Month-end date rule:** [default, not policy] — I'd suggest last-day-of-month (e.g. a loan disbursed on the 31st has instalments due on the last day of each subsequent month). Flag this for confirmation if it matters to your test cases.

**8. Zero-interest case:** [default, not policy] — yes, straight-line principal division with the rounding residual in the final instalment, consistent with Q4. Confirm if you need an explicit policy here.

**9. Output fields:** Return the full schedule with, per row: due date, opening balance, interest, principal, instalment, closing balance. Also return two summary figures: total interest paid (total cost of credit) and the disclosed APR, computed on an actual/365 basis even though accrual uses 30/360. Instalment number per row is reasonable to include as well.

**10. Input validation:** Zero or negative principal, and zero or negative term, are rejected as invalid errors. [default, not policy] for negative rate and missing disbursement date — I'd suggest rejecting both with a clear error message; flag if you need a defined behaviour for the 0% rate case beyond what Q8 covers.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Thanks — that's most of it. Your answers to 7, 8 and 10 I'll adopt as stated and label explicitly as assumptions in the spec, so a reviewer can see they were defaults rather than policy. Three things you've introduced still need pinning down, because they materially change the numbers and I can't infer them.

**A. Reconciling Q5 and Q6 (the stub).** These are in tension as written. If the first instalment is *always* exactly one calendar month after disbursement (Q5), then under 30/360 every period is exactly 30 days and a stub can never arise. A stub only appears if the schedule is anchored to something *other* than the disbursement date. So which is it?
- (i) There's a fixed cycle anchor (e.g. instalments always fall on a set day of the month, or the first full period starts on a particular date), and the days between disbursement and that anchor are charged as odd-days interest. If so: what is the anchor, and how are stub days counted under 30/360 (30/360 day-count from disbursement to anchor, or actual days)?
- (ii) First instalment is genuinely always one month after disbursement, no anchor, and Q6 only bites in some other scenario you have in mind — if so, describe when.

Also: does the stub interest get **added into instalment 1**, or shown as a **separate period-zero charge** with its own row? And what rate applies to the stub — the same 30/360 monthly accrual pro-rated by days, or something else?

**B. APR method.** "Disclosed APR on an actual/365 basis" has several plausible definitions. Which do you mean?
- (i) The effective annual rate found by solving for the rate that sets the present value of the instalment cashflows equal to the principal disbursed (an IRR/XIRR over actual/365 day fractions) — the usual consumer-credit disclosure figure.
- (ii) A nominal annualised rate (periodic rate × periods), no compounding.
- (iii) Something else.

And to what precision is the disclosed APR reported (e.g. 1 decimal place, 2 dp)?

**C. Rounding tie-break and currency.** "Nearest whole shilling" — on an exact half, round half-up (0.5 → 1) or half-even? And to name it correctly in the spec: which shilling (KES / UGX / TZS / other)?

Answer these and I'll write the spec.
A: **A. Stub reconciliation:** Option (i) — there is a fixed cycle anchor (the first period start date). Disbursement can precede it, and those intervening days are charged as stub interest. The first instalment falls one month after the first period start, not one month after disbursement; item 13 was shorthand for the no-stub case. Stub days are counted using 30/360 pro-rated (same convention as regular periods: stub days ÷ 360 × annual rate × principal). Stub interest is added into instalment 1, not shown as a separate period-zero row. The same nominal rate applies.

**B. APR method:** (i) — the IRR/XIRR approach: solve for the discount rate that sets the present value of all instalment cashflows, timed by their actual calendar dates, equal to the principal disbursed. Actual/365 day-fractions are used for that discounting even though accrual uses 30/360. Precision: [default, not policy] — 2 decimal places; flag for confirmation if a specific regulatory format is required.

**C. Rounding tie-break and currency:** Currency is KES (Kenyan shilling). On an exact half-shilling, round half-up (0.5 → 1). Intermediate working values carry 2 dp; each instalment in the output is a whole shilling.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is done, saved as `spec.md` in this directory.

It captures every policy you pinned down and separates them cleanly from the handful of defaults I had to assume:

- **Confirmed policy** (§5): equal-principal amortisation, 30/360 accrual (= rate/12 for full months), stub interest folded into instalment 1, whole-KES half-up rounding, residual absorbed by the final instalment so the balance closes at zero, due dates one month after the anchor, and a disclosed APR by actual/365 IRR.
- **A worked example** (§6) with real numbers you can check the implementation against, including the stub (16 days → 800 KES) and the residual landing in instalment 6.
- **Requirements tables** (§7–9): 12 functional requirements in user-story form, 7 measurable NFRs (determinism, balance closure, principal conservation, integrality, APR accuracy), and 5 domain/business constraints.
- **Six open questions** (§10), each flagged where it sits in the spec, all defaults rather than your stated policy.

Two things worth your eye before build, because I had to choose them and they change the numbers:

1. **The anchor as an input.** Your stub logic needs a `first_period_start_date` separate from disbursement, but the brief only named four fields. I've modelled it as a fifth required input (§10.1). If instead that anchor is *derived* by a rule (next 1st of month, a fixed cycle day), tell me the rule and I'll swap the field for the derivation.
2. **The 30/360 variant.** I specified US/NASD for stub-day counting; 30E/360 (European) treats day-31 differently and would shift stub interest in edge cases (§10.3).

The other four open items (APR precision, month-end roll, zero-interest, negative-rate/missing-date rejection) are your suggested defaults, recorded as such. Confirm or override any of the six and I'll fold the change in.
A: Good summary — the spec structure looks right. On your two flagged items:

**1. Anchor as input:** [default, not policy] — model it as a fifth required input (`first_period_start_date`). No derivation rule was specified, so the caller must supply it explicitly. Flag it for confirmation if a rule emerges.

**2. 30/360 variant:** [default, not policy] — US/NASD is the safer default. Flag §10.3 for confirmation; if any due dates fall on the 31st this will produce different stub figures under 30E/360.

The four other open items (APR precision at 2 dp, last-day-of-month roll, straight-line zero-interest, reject-on-bad-input) stand as stated. No overrides.

### Round 4
_Step reasoning:_ (live agent turn)

Q: The specification is complete and confirmed. `spec.md` is saved in this directory.

Everything you decided is captured as policy, and the six items I couldn't infer from the brief are recorded as flagged defaults in §10, all confirmed to stand:

- Anchor modelled as a required fifth input, caller-supplied, no derivation rule (§3, §10.1)
- 30/360 US/NASD, with the 31st-of-month trigger now spelled out (§5.2, §5.4, §10.3)
- APR at 2 dp, last-day-of-month roll, straight-line zero-interest, reject-on-bad-input — all as stated

The spec is ready to hand to whoever builds `generate_schedule`. The worked example in §6 doubles as the first acceptance test, and §11 lists the invariants (principal conservation, zero closing balance, integrality, APR identity) an implementation must satisfy.
A: Noted. The specification is confirmed and ready for build.

## Produced specification

# Repayment schedule engine — requirements specification

## 1. Overview

This specification defines `generate_schedule(loan)`, a pure function that produces the full
repayment schedule for a disbursed loan. Given the loan terms, it returns one row per instalment
(due date, opening balance, interest, principal, instalment, closing balance) plus two summary
figures: the total cost of credit and the disclosed APR.

The engine uses **equal-principal amortisation**, **30/360 interest accrual**, **whole-shilling
(KES) rounding**, and a **stub interest charge** for any odd days between disbursement and the
first period start. Every material policy below was confirmed with the product stakeholder;
choices marked **[Assumption]** were stakeholder-suggested defaults, not stated policy, and are
listed together in §10 for confirmation.

## 2. Scope and interface

- **In scope:** deterministic computation of a repayment schedule from loan terms; interest,
  principal and balance per instalment; stub interest; total cost of credit; disclosed APR;
  input validation.
- **Out of scope:** persistence, payment collection, arrears/late-payment handling, early
  settlement, rescheduling, tax or fees beyond interest, and any UI.
- **Interface:** `generate_schedule(loan) -> Schedule`. Pure and side-effect free: identical
  input always yields identical output.

## 3. Inputs — the `loan`

| Field                     | Type            | Unit / format        | Required | Validation                                        |
|---------------------------|-----------------|----------------------|----------|---------------------------------------------------|
| `principal`               | integer         | whole KES            | Yes      | Must be > 0; else reject (see FR-011)             |
| `annual_nominal_rate`     | decimal         | fraction, e.g. 0.18  | Yes      | Must be ≥ 0; negative rejected [Assumption]       |
| `term_months`             | integer         | count of instalments | Yes      | Must be > 0; else reject                          |
| `disbursement_date`       | date            | calendar date        | Yes      | Required; missing rejected [Assumption]           |
| `first_period_start_date` | date            | calendar date        | Yes      | Must be ≥ `disbursement_date` [Assumption, §10.1] |

`first_period_start_date` is the anchor for the whole schedule. The first full monthly period
runs from this date; instalment 1 falls one calendar month after it. Any days between
`disbursement_date` and `first_period_start_date` are charged as stub interest (§5.4). When
disbursement and the anchor coincide, there is no stub and instalment 1 is one month after
disbursement, matching the simple case.

## 4. Outputs — the `Schedule`

Per-instalment rows, in due-date order:

| Field             | Type    | Unit      | Notes                                                     |
|-------------------|---------|-----------|----------------------------------------------------------|
| `instalment_no`   | integer | 1..n      | Sequential from 1.                                        |
| `due_date`        | date    | —         | Anchor + k months (§5.5).                                 |
| `opening_balance` | integer | whole KES | Balance at period start; row 1 = `principal`.            |
| `interest`        | integer | whole KES | Accrued interest for the period; row 1 includes stub.    |
| `principal`       | integer | whole KES | Principal repaid this period.                             |
| `instalment`      | integer | whole KES | `interest + principal`.                                   |
| `closing_balance` | integer | whole KES | `opening_balance − principal`; final row = 0 exactly.    |

Summary figures returned alongside the rows:

| Field            | Type    | Unit      | Definition                                                        |
|------------------|---------|-----------|------------------------------------------------------------------|
| `total_interest` | integer | whole KES | Total cost of credit: sum of `interest` across all rows.         |
| `total_repayable`| integer | whole KES | `principal + total_interest`; equals sum of `instalment`.        |
| `apr`            | decimal | percent   | Disclosed APR, IRR on actual/365 (§5.6), 2 dp [Assumption §10.2].|

## 5. Computation policy (business rules)

### 5.1 Amortisation — equal principal
A constant principal slice is repaid each period. The scheduled slice is `round(principal /
term_months)` to the nearest whole shilling. Interest is charged on the reducing balance, so the
total instalment falls over the term. The final instalment repays whatever balance remains,
absorbing all accumulated rounding residual (§5.7).

### 5.2 Interest accrual — 30/360
Every month is treated as 30 days and the year as 360. A full period's interest is therefore
`opening_balance × annual_nominal_rate × 30/360`, which equals `opening_balance ×
annual_nominal_rate / 12`. Actual calendar length of the period is ignored for accrual. The
30/360 day count uses the **US/NASD variant** for stub-day counting (§5.4) — this variant choice
is flagged for confirmation in §10.3.

### 5.3 Interest for a normal period
For period k (k ≥ 2, and k = 1 when there is no stub):
`interest_k = round( opening_balance_k × annual_nominal_rate / 12 )` to the nearest whole shilling.

### 5.4 Stub interest (first instalment only)
When `first_period_start_date > disbursement_date`, count the stub days using the 30/360 US day
count between `disbursement_date` (D1) and `first_period_start_date` (D2):

`days = 360 × (Y2 − Y1) + 30 × (M2 − M1) + (D2 − D1)`, with the US adjustments: if D1 = 31, set
D1 = 30; if D2 = 31 and D1 ∈ {30, 31}, set D2 = 30.

`stub_interest = principal × annual_nominal_rate × stub_days / 360`, at the same nominal rate.
The stub is folded into instalment 1's interest, not shown as a separate period-zero row:

`interest_1 = round( principal × annual_nominal_rate / 12 + stub_interest )` to the nearest whole
shilling. Component values are held at 2 dp before the single final rounding.

### 5.5 Due dates
`due_date_k = first_period_start_date + k months`. Where the anchor day does not exist in a target
month (e.g. the 31st in a 30-day month, or 30/31 January into February), the due date rolls to the
**last day of that month** [Assumption §10.4].

### 5.6 APR (disclosed)
The APR is the annual rate `i` that sets the present value of the actual (rounded, whole-shilling)
instalment cashflows equal to the principal disbursed, discounting on actual/365 day-fractions:

`principal = Σ_k instalment_k / (1 + i) ^ (t_k)`, where `t_k = (due_date_k − disbursement_date in
actual days) / 365`.

Solved numerically (e.g. bisection or Newton–Raphson). Actual/365 is used for discounting even
though accrual uses 30/360. Reported as a percentage to 2 dp [Assumption §10.2].

### 5.7 Rounding and residual reconciliation
Currency is **KES**; every output amount is a whole shilling. Intermediate working values may
carry 2 dp. Rounding is **half-up** (an exact half-shilling rounds away from zero: 0.5 → 1).

The scheduled principal slice `round(principal / term_months)` summed over n periods need not equal
`principal`. To guarantee closure, the **final instalment's principal equals the final period's
opening balance**, so `closing_balance` of the last row is exactly 0. All accumulated rounding
difference lands in the final instalment.

### 5.8 Zero-interest case [Assumption §10.5]
When `annual_nominal_rate = 0`, all interest (including stub) is 0 and repayment is straight-line
principal, with the residual absorbed by the final instalment per §5.7.

## 6. Worked example

Loan: `principal = 100000` KES, `annual_nominal_rate = 0.18`, `term_months = 6`,
`disbursement_date = 2026-01-15`, `first_period_start_date = 2026-01-31`.

Stub: 30/360 days from 2026-01-15 to 2026-01-31 = `(31 − 15) = 16` days.
`stub_interest = 100000 × 0.18 × 16/360 = 800`. Monthly rate = 0.18/12 = 0.015.
Scheduled principal slice = `round(100000/6) = 16667`.

| # | Due date   | Opening | Interest        | Principal | Instalment | Closing |
|---|------------|---------|-----------------|-----------|------------|---------|
| 1 | 2026-02-28 | 100000  | 2300 (1500+800) | 16667     | 18967      | 83333   |
| 2 | 2026-03-31 | 83333   | 1250            | 16667     | 17917      | 66666   |
| 3 | 2026-04-30 | 66666   | 1000            | 16667     | 17667      | 49999   |
| 4 | 2026-05-31 | 49999   | 750             | 16667     | 17417      | 33332   |
| 5 | 2026-06-30 | 33332   | 500             | 16667     | 17167      | 16665   |
| 6 | 2026-07-31 | 16665   | 250             | 16665     | 16915      | 0       |

Sum of principal = 16667 × 5 + 16665 = 100000. `total_interest = 6050` (of which 800 is stub).
`total_repayable = 106050`. `apr ≈ 19.93%` (illustrative; exact value depends on solver
precision).

## 7. Functional requirements

| ID     | Title                        | User Story                                                                                                                                                    | Priority | Status |
|--------|------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|--------|
| FR-001 | Generate schedule            | As a loan officer, I want to generate a full repayment schedule from a disbursed loan so that the borrower has a definitive instalment plan.                   | High     | Open   |
| FR-002 | Equal-principal amortisation | As a lender, I want a constant principal slice each period so that principal reduces on a straight line and instalments fall over the term.                    | High     | Open   |
| FR-003 | 30/360 accrual               | As a lender, I want interest accrued on a 30/360 basis over the reducing balance so that accrual matches our stated interest convention.                        | High     | Open   |
| FR-004 | Stub interest                | As a lender, I want odd days between disbursement and the first period start charged as stub interest folded into instalment 1 so that early days are not free. | High     | Open   |
| FR-005 | Whole-shilling rounding      | As a lender, I want every instalment figure rounded to whole KES using half-up so that no sub-shilling amounts appear.                                          | High     | Open   |
| FR-006 | Residual reconciliation      | As a lender, I want the final instalment to absorb accumulated rounding so that the closing balance is exactly zero.                                            | High     | Open   |
| FR-007 | Due-date generation          | As a borrower, I want each instalment dated one month after the last so that I know exactly when each payment falls due.                                        | High     | Open   |
| FR-008 | Zero-interest handling       | As a lender, I want a 0% loan to repay straight-line principal with no interest so that interest-free products schedule correctly.                              | Medium   | Open   |
| FR-009 | APR disclosure               | As a compliance officer, I want a disclosed APR computed by IRR on actual/365 so that we meet cost-of-credit disclosure obligations.                            | High     | Open   |
| FR-010 | Total cost of credit         | As a borrower, I want the total interest and total repayable amounts so that I understand the full cost of the loan.                                            | High     | Open   |
| FR-011 | Input validation             | As a system operator, I want invalid loans rejected with a clear error so that no schedule is produced from bad terms.                                          | High     | Open   |
| FR-012 | Schedule row detail          | As a loan officer, I want each row to carry instalment number, due date, opening balance, interest, principal, instalment and closing balance so that the schedule is fully auditable. | Medium   | Open   |

## 8. Non-functional requirements

| ID      | Title                | Requirement                                                                                                                | Category        | Priority | Status |
|---------|----------------------|---------------------------------------------------------------------------------------------------------------------------|-----------------|----------|--------|
| NFR-001 | Determinism          | Identical input must always produce byte-identical output; the function must be pure and side-effect free.                 | Reliability     | High     | Open   |
| NFR-002 | Balance closure      | The final row `closing_balance` must equal 0 for every valid loan, verified across the full test suite.                    | Correctness     | High     | Open   |
| NFR-003 | Principal conservation | The sum of per-row `principal` must equal the input `principal` exactly for every valid loan.                            | Correctness     | High     | Open   |
| NFR-004 | Instalment integrality | Every `interest`, `principal`, `instalment` and balance in the output must be a whole integer number of KES.             | Correctness     | High     | Open   |
| NFR-005 | APR accuracy         | The solved APR must satisfy the present-value identity of §5.6 to within 1e-6 of the principal.                            | Correctness     | High     | Open   |
| NFR-006 | Performance          | A schedule for a term of up to 600 instalments must be computed in under 50 ms on a standard developer machine.            | Performance     | Medium   | Open   |
| NFR-007 | APR convergence      | The APR solver must converge for any valid loan, or raise a defined error if no root exists, within 100 iterations.        | Reliability     | Medium   | Open   |

## 9. Constraints

| ID    | Title                  | Constraint                                                                                          | Category  | Priority | Status |
|-------|------------------------|----------------------------------------------------------------------------------------------------|-----------|----------|--------|
| C-001 | Currency               | All monetary amounts are Kenyan shillings (KES) expressed as whole integers; no minor units.        | Domain    | High     | Open   |
| C-002 | Accrual convention     | Interest accrual uses the 30/360 day-count convention (US/NASD variant for stub days).              | Domain    | High     | Open   |
| C-003 | APR discounting basis  | APR is computed on an actual/365 day-fraction basis, distinct from the accrual convention.           | Domain    | High     | Open   |
| C-004 | Rounding rule          | Monetary rounding is half-up to the whole shilling; intermediate working values may carry 2 dp.      | Domain    | High     | Open   |
| C-005 | Amortisation method    | The product uses equal-principal amortisation only; annuity and interest-only are out of scope.      | Business  | High     | Open   |

## 10. Assumptions and open questions

These were stakeholder-suggested defaults or engine-level choices, not stated policy. Each needs a
yes/no confirmation before build; none blocks drafting.

1. **Anchor as an input (§3).** The brief lists only four loan fields. The confirmed stub logic
   requires a `first_period_start_date` anchor distinct from disbursement. This spec models it as a
   fifth required input. If the anchor is instead *derived* (e.g. next 1st-of-month, or a fixed
   billing-cycle day), that derivation rule must be specified and this field removed.
2. **APR precision (§5.6).** Reported to 2 dp. Confirm whether a specific regulatory format
   (decimal places, rounding direction, nominal vs effective labelling) is mandated.
3. **30/360 variant (§5.2, §5.4).** US/NASD variant assumed for day counting, as the safer
   default. Confirm vs 30E/360 (European), which handles day-31 differently. Concretely: if any
   relevant date falls on the 31st, the two variants produce different stub figures; otherwise they
   agree.
4. **Month-end date roll (§5.5).** Last-day-of-month assumed when the anchor day is absent in a
   target month. Confirm against your intended test cases.
5. **Zero-interest policy (§5.8).** Treated as straight-line principal with residual in the final
   instalment. Confirm whether 0% needs any distinct handling.
6. **Negative rate and missing disbursement date (FR-011).** Both rejected with a clear error.
   Confirm this is the intended behaviour rather than a defined default.

## 11. Acceptance criteria

- Given the §6 worked example, the engine reproduces the table and summary exactly (APR to the
  agreed precision).
- For any valid loan: `sum(principal) == loan.principal`, final `closing_balance == 0`, and every
  output amount is an integer (NFR-002, NFR-003, NFR-004).
- With `first_period_start_date == disbursement_date`, stub interest is 0 and instalment 1 carries
  one full month of interest.
- With `annual_nominal_rate == 0`, all interest is 0 and principal repays straight-line to a zero
  closing balance.
- Invalid inputs (principal ≤ 0, term ≤ 0, negative rate, missing disbursement date) raise a
  defined error and produce no schedule.
- The APR satisfies the present-value identity of §5.6 to within the NFR-005 tolerance.


## Auditor verdict

_The spec cleanly captures the core method and convention decisions (declining balance, equal-principal, 30/360, per-period accrual, stub interest, whole-shilling rounding with final-instalment residual, zero closing, validation, and notably the 30/360-accrual-but-actual/365-disclosure APR split). It misses three: within-period rounding order (#8, principal computed independently rather than as the instalment remainder), and both early-settlement rebate (#10, Rule of 78) and partial prepayment re-amortisation (#11), which are declared out of scope and never resolved. First due date (#13) is surfaced but diverges: the spec anchors to a separate first_period_start_date input rather than disbursement + one month, differing in the stub case. Coverage = 10/14 correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §5.1 'Interest is charged on the reducing balance'; §5.2 'interest accrued on a 30/360 basis over the reducing balance' (FR-003) | The spec explicitly charges interest on the reducing/declining balance, matching the reference's declining-balance method. |
| 2 | yes | **yes** | §5.1 'Amortisation — equal principal. A constant principal slice is repaid each period... so the total instalment falls over the term'; C-005 'equal-principal amortisation only' | Exactly matches the reference: constant principal portion, interest on reducing balance, decreasing total instalment; explicitly not EMI. |
| 3 | yes | **yes** | §5.2 '30/360. Every month is treated as 30 days and the year as 360'; C-002 | Day-count convention is 30/360, matching the reference exactly and rejecting actual/365. |
| 4 | yes | **yes** | §5.2/5.3 'A full period's interest is opening_balance × annual_nominal_rate × 30/360... interest_k = round(opening_balance_k × rate / 12)' | Interest is computed once per monthly period on the opening balance, not accrued daily, matching the reference's same-as-repayment-period choice. |
| 5 | yes | **yes** | §5.4 'When first_period_start_date > disbursement_date... charged as stub interest... folded into instalment 1'; §3 'days between disbursement_date and first_period_start_date are charged as stub interest' | Interest accrues from disbursement and a partial-period stub is levied for the extra days, matching the reference. |
| 6 | yes | **yes** | §5.7 'Currency is KES... Intermediate working values may carry 2 dp'; C-001 'Kenyan shillings (KES)' | Currency KES is stated and 2-decimal precision is carried at the working level, matching the reference's currency-and-precision decision (the whole-shilling output is the separate rounding decision #7). |
| 7 | yes | **yes** | §5.7 'every output amount is a whole shilling... All accumulated rounding difference lands in the final instalment'; FR-005, FR-006 | Instalments round to the whole shilling and the accumulated residual is settled in the final instalment, matching the reference exactly. |
| 8 | yes | no | §5.1 'scheduled slice is round(principal / term_months)'; §5.3 'interest_k = round(opening_balance × rate / 12)'; §4 'instalment = interest + principal' | The spec rounds interest and principal (round(P/n)) independently and sums them; the reference requires interest rounded first with principal as the remainder of the rounded instalment. Different rounding-order model, so not a match. |
| 9 | yes | **yes** | §5.7 'the final instalment's principal equals the final period's opening balance, so closing_balance of the last row is exactly 0'; NFR-002 | Final instalment reconciles the schedule to an exactly zero closing balance, matching the reference. |
| 10 | no | no | §2 'Out of scope: ... early settlement' | Early full settlement is declared out of scope; the Rule-of-78 rebate decision is never addressed or resolved. |
| 11 | no | no | §2 'Out of scope: ... early settlement, rescheduling' | Partial prepayment / re-amortisation is out of scope; the principal-application and fixed-term re-amortisation decision is not addressed. |
| 12 | yes | **yes** | §3 'principal Must be > 0; else reject', 'term_months Must be > 0; else reject'; FR-011; §11 'Invalid inputs (principal ≤ 0, term ≤ 0...) raise a defined error' | Zero or negative principal/term is rejected as invalid with an error, matching the reference. |
| 13 | yes | no | §5.5 'due_date_k = first_period_start_date + k months'; §6 example: disbursement 2026-01-15, first due 2026-02-28 | The reference sets the first due date at disbursement + one month; the spec anchors due dates to a separate first_period_start_date, so in the stub case (worked example) the first due is 2026-02-28 rather than 2026-02-15. Monthly cadence matches but the anchor/value diverges. |
| 14 | yes | **yes** | §4 rows (due date, opening, interest, principal, instalment, closing) + total_interest 'total cost of credit' + apr; §5.6 'Actual/365 is used for discounting even though accrual uses 30/360'; C-003 | The output includes the full per-period schedule, total cost of credit, and a disclosed APR on actual/365 while accrual uses 30/360, capturing the non-obvious dual day-count disclosure quirk exactly. |
