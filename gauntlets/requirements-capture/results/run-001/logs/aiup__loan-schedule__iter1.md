# aiup — loan-schedule — iteration 1

Model (author): claude-opus · Questions asked: 11 · Captured: 11/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: The structured question tool isn't cooperating in this environment, so I'll put the questions to you directly in prose. The brief leaves every material policy decision open, and these are the ones I can't safely infer, each has several plausible answers and your institution has presumably picked specific ones. Please answer what you can.

**The four that most affect the numbers:**

1. **Amortisation method.** How is each instalment composed?
   - (a) Equal instalments / annuity (EMI): same total each period, standard consumer method.
   - (b) Equal principal: constant principal, declining total.
   - (c) Interest-only with a bullet principal repayment at the end.

2. **Interest basis / day-count convention.** How is the monthly interest derived from the annual nominal rate?
   - (a) Nominal ÷ 12 (30/360): every month treated as equal.
   - (b) Actual/365: accrues on actual days between due dates.
   - (c) Actual/360.

3. **Rounding and residual.** To what precision (2 dp / currency minor units, or whole units), and where does the accumulated rounding residual land so the balance closes exactly at zero, the final instalment or the first?

4. **First instalment timing.** Is the first instalment due exactly one calendar month after disbursement (clean first period), or on a fixed calendar day of the month (which can create a shorter or longer broken first period)?

**Three more that shape edge cases:**

5. **Broken/stub first period.** If the first period isn't a whole month (relevant only if you pick a fixed due-day or actual-days basis), how is its interest handled, pro-rata on actual days, or ignored (treated as a full period)?

6. **Business-day adjustment.** If a due date falls on a weekend or public holiday, does the schedule roll it (e.g. to the next business day), and does that shift affect interest accrual? Or are due dates left on calendar dates untouched?

7. **Currency and inputs.** What currency (and hence minor-unit precision)? And can I assume the rate is a positive annual percentage, principal positive, and term a whole number of months ≥ 1, or do you need zero-interest or other boundary cases handled explicitly?

Answer as many as you can and I'll pin down the rest or state the default I've chosen and why.
A: 1. **Amortisation: equal principal (b).** A constant principal slice (P/n) each period, interest computed on the reducing balance, so the total instalment decreases over the term. Not EMI/annuity.

2. **Day-count: 30/360 (a).** Monthly interest = annual nominal rate ÷ 12. Every month is treated as equal; actual calendar days between due dates are irrelevant to accrual.

3. **Rounding: whole shilling, residual in the final instalment.** Each instalment is rounded to the whole shilling (no cents). The accumulated rounding difference is absorbed by the final instalment, which is set to whatever closes the balance exactly to zero.

4. **First instalment: disbursement date + one calendar month.** Subsequent instalments monthly thereafter. The first period is clean — no fixed-day-of-month rule.

5. **Stub period: charged if it arises.** Interest accrues from the disbursement date. If disbursement precedes the first period start for any reason, a stub interest charge is levied for those extra days. Partial-period interest is allowed and charged.

6. **Business-day adjustment: [default, not policy].** No roll. Due dates are left on calendar dates; if a date falls on a weekend or public holiday, it is not shifted and accrual is unaffected.

7. **Currency: Kenyan shilling (KES).** Rate must be a positive annual percentage, principal must be positive, term must be a whole number of months ≥ 1. Zero or negative principal or term is rejected as invalid.

### Round 2
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in the working directory.

It captures the seven policy decisions you confirmed, in the terms you gave them:

- **Equal-principal amortisation** (constant principal slice, interest on the reducing balance, declining total).
- **30/360 interest** (monthly rate = annual ÷ 12, calendar days irrelevant to accrual).
- **Whole-shilling rounding**, round-half-up, with the residual absorbed by the final instalment so the balance closes to exactly zero.
- **First instalment one calendar month after disbursement**, monthly thereafter, clean first period.
- **Stub interest** as a conditional provision, flagged because it can't fire under the chosen timing.
- **No business-day roll**, marked as a default rather than stated policy.
- **KES, whole shillings**, with positive principal, positive rate, and integer term ≥ 1 enforced.

The document has the AI-UP structure from the requirements skill: eight functional requirements in user-story form, six measurable NFRs (balance closes to zero, principal conservation, determinism, and so on), five constraints, plus a normative worked example (100,000 KES at 12% over 12 months, disbursed 2026-01-15) that gives an implementer a row-by-row oracle to test against.

Two things worth your eye in section 9. First, the tension I flagged earlier: your clean-first-period rule (answer 4) means the stub rule (answer 5) can never actually fire, so I've kept it as a conditional provision and asked you to confirm how stub days would be counted under 30/360 if it ever did. Second, a handful of smaller defaults I had to choose to make the spec computable, round-half-up, month-end handling for disbursement on the 29th–31st, and the no-roll convention. All are listed as open items for you to confirm or override.
A: Acknowledged. Three of the four open items are defaults I haven't set as policy, so you may keep them as written. On the one that touches the interest model:

**Stub day-count under 30/360:** if a stub period arises, count the actual calendar days elapsed and apply them as actual_days / 360 × annual rate × principal. That is consistent with the 30/360 convention (year = 360 days) without inventing a fractional-month construct.

**Round-half-up:** [default, not policy] — keep it.

**Month-end handling (disbursement on 29th–31st):** [default, not policy] — keep whatever you chose.

**No business-day roll:** already confirmed as a default in my earlier answer — keep it.

The spec sounds complete on the policy side. The stub provision being unreachable under the current timing rule is a fair observation; keeping it as a conditional is the right call.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is complete and updated. `spec.md` now reflects your final call on the stub day-count.

The one substantive change: stub interest is now confirmed policy in section 4.6, computed as `principal × annual_nominal_rate × (actual_days_elapsed ÷ 360)`, actual calendar days against a 360-day year. Section 9 is retitled to reflect that nothing is left open: it lists the confirmed defaults (round-half-up, no business-day roll, month-end falls on the last day of a shorter month) and the single note on interest rounding.

The spec is done and internally consistent: every policy decision that drives the numbers is pinned, the worked example gives implementers a row-by-row oracle, and the NFRs make the invariants (balance closes to zero, principal conserved, exactly `term_months` rows) testable.
A: Confirmed. The specification is complete.

## Produced specification

# Repayment schedule engine — requirements specification

## 1. Overview

This specification defines `generate_schedule(loan)`, a function that produces the full
repayment schedule for a disbursed loan. Given the loan's principal, annual nominal
interest rate, term in monthly instalments, and disbursement date, the function returns an
ordered schedule in which each instalment carries the interest due, the principal due, the
total instalment, its due date, and the running balance after payment.

The loan product uses the **equal-principal (reducing-balance)** method: a constant slice of
principal is repaid each period and interest is charged on the balance outstanding at the
start of that period, so the total instalment declines over the term.

All policy decisions below were confirmed with the product stakeholder. Where a decision was
a sensible default rather than stated policy, it is marked as such. Open items are listed in
section 9.

## 2. Domain glossary

| Term | Meaning |
|------|---------|
| Principal | The disbursed loan amount, in Kenyan shillings (KES). Positive. |
| Annual nominal rate | The stated yearly interest rate, not compounded within the year. Positive percentage. |
| Term | Number of monthly instalments, a whole number ≥ 1. |
| Disbursement date | The calendar date the funds were released. |
| Monthly rate | Annual nominal rate ÷ 12 (30/360 convention). |
| Instalment | One scheduled repayment: a principal component plus an interest component. |
| Running balance | Principal outstanding after an instalment has been applied. |
| Stub period | A first period shorter or longer than one whole month (does not arise under current timing policy; see §6.5 and §9). |

## 3. Inputs and validation

The function accepts a single `loan` value with these fields.

| Field | Type | Rule |
|-------|------|------|
| `principal` | decimal (KES) | Must be > 0. Zero or negative is rejected as invalid. |
| `annual_nominal_rate` | decimal (percentage per year) | Must be > 0. Zero or negative is rejected as invalid. |
| `term_months` | integer | Must be a whole number ≥ 1. Non-integer, zero, or negative is rejected as invalid. |
| `disbursement_date` | date | A valid calendar date. |

Invalid input is rejected before any schedule is computed (see FR-006, NFR-004).

## 4. Computation policy

The rules below fully determine every figure in the schedule. They are the heart of this
specification; the functional requirements in §5 restate them as testable obligations.

**4.1 Amortisation — equal principal.** The scheduled principal component is the same each
period: `principal ÷ term_months`, rounded to the whole shilling (§4.4). The final instalment's
principal is not this fixed slice but whatever closes the balance to exactly zero (§4.4).

**4.2 Interest basis — 30/360.** The monthly rate is `annual_nominal_rate ÷ 12`. Every period
is treated as one equal month. Actual calendar days between due dates are irrelevant to accrual.
Interest for a period is `opening_balance × monthly_rate`, rounded to the whole shilling, where
`opening_balance` is the principal outstanding at the start of that period (before that period's
principal is applied).

**4.3 Ordering within a period.** For each instalment k: compute interest on the opening balance,
apply the principal component, then reduce the balance by the principal component. Interest is
never capitalised; it is charged and paid within the same period.

**4.4 Rounding — whole shilling, residual in the final instalment.** Every instalment amount is
rounded to the whole shilling (no cents), using round-half-up. Because rounding the fixed
principal slice across the term will not generally sum back to the exact principal, the **final
instalment absorbs the accumulated residual**: its principal component is set to the remaining
outstanding balance, so the running balance closes to exactly zero. The final instalment's
interest is still computed normally on its opening balance.

**4.5 Instalment timing.** The first instalment is due exactly **one calendar month after the
disbursement date**. Each subsequent instalment is due one calendar month after the previous
one. There is no fixed-day-of-month rule; the first period is a clean whole month.

**4.6 Stub interest (conditional).** Interest accrues from the disbursement date. If, for any
reason, the disbursement date precedes the start of the first period so that a partial period
arises, a stub interest charge is levied for that partial period; partial-period interest is
permitted. The stub charge is `principal × annual_nominal_rate × (actual_days_elapsed ÷ 360)`,
where `actual_days_elapsed` is the actual calendar days from the disbursement date to the first
period start. This counts real days against a 360-day year, consistent with the 30/360
convention, without introducing a fractional-month construct. Under the timing policy in §4.5 the
first period is always exactly one month, so no stub arises in normal operation. This provision
only takes effect if a first due date is ever configured independently of the disbursement date.

**4.7 Business-day adjustment — none (default, not stated policy).** Due dates are left on their
calendar dates. A due date falling on a weekend or public holiday is not shifted, and accrual is
unaffected.

**4.8 Currency.** All amounts are Kenyan shillings (KES), whole shillings only.

## 5. Functional requirements

| ID | Title | User Story | Priority | Status |
|----|-------|-----------|----------|--------|
| FR-001 | Generate full schedule | As a loan servicing system, I want `generate_schedule(loan)` to return one row per instalment for the whole term so that the borrower's repayment plan is fully defined. | High | Open |
| FR-002 | Equal-principal split | As a loan officer, I want each instalment's principal component to be a constant slice (`principal ÷ term`) with interest on the reducing balance so that the schedule follows the product's equal-principal method. | High | Open |
| FR-003 | 30/360 interest | As a loan officer, I want each period's interest computed as `opening_balance × (annual_nominal_rate ÷ 12)` so that accrual follows the 30/360 convention independent of calendar days. | High | Open |
| FR-004 | Whole-shilling rounding with final-instalment residual | As a finance controller, I want every amount rounded to the whole shilling and the final instalment adjusted so that the running balance closes to exactly zero. | High | Open |
| FR-005 | Due dates | As a borrower, I want the first instalment dated one calendar month after disbursement and each later one a month after the previous so that I know when each payment falls due. | High | Open |
| FR-006 | Input validation | As a loan servicing system, I want loans with non-positive principal, non-positive rate, or a term that is not a whole number ≥ 1 to be rejected so that no invalid schedule is produced. | High | Open |
| FR-007 | Running balance per row | As an auditor, I want each row to report the principal outstanding after that instalment so that the balance can be reconciled period by period. | Medium | Open |
| FR-008 | Stub interest when a partial first period arises | As a loan officer, I want a stub interest charge levied if the disbursement date precedes the first period start so that interest is charged from disbursement even for a partial period. | Low | Open |

## 6. Worked example (normative)

Loan: `principal = 100,000 KES`, `annual_nominal_rate = 12%`, `term_months = 12`,
`disbursement_date = 2026-01-15`.

Monthly rate = 12% ÷ 12 = 1.0%. Fixed principal slice = 100,000 ÷ 12 = 8,333.33 → **8,333**
per period for periods 1–11; period 12 takes the remaining balance.

| # | Due date | Opening balance | Interest | Principal | Total instalment | Running balance |
|---|----------|-----------------|----------|-----------|------------------|-----------------|
| 1 | 2026-02-15 | 100,000 | 1,000 | 8,333 | 9,333 | 91,667 |
| 2 | 2026-03-15 | 91,667 | 917 | 8,333 | 9,250 | 83,334 |
| 3 | 2026-04-15 | 83,334 | 833 | 8,333 | 9,166 | 75,001 |
| 4 | 2026-05-15 | 75,001 | 750 | 8,333 | 9,083 | 66,668 |
| 5 | 2026-06-15 | 66,668 | 667 | 8,333 | 9,000 | 58,335 |
| 6 | 2026-07-15 | 58,335 | 583 | 8,333 | 8,916 | 50,002 |
| 7 | 2026-08-15 | 50,002 | 500 | 8,333 | 8,833 | 41,669 |
| 8 | 2026-09-15 | 41,669 | 417 | 8,333 | 8,750 | 33,336 |
| 9 | 2026-10-15 | 33,336 | 333 | 8,333 | 8,666 | 25,003 |
| 10 | 2026-11-15 | 25,003 | 250 | 8,333 | 8,583 | 16,670 |
| 11 | 2026-12-15 | 16,670 | 167 | 8,333 | 8,500 | 8,337 |
| 12 | 2027-01-15 | 8,337 | 83 | 8,337 | 8,420 | 0 |

Notes: interest is round-half-up of `opening_balance × 0.01`. The fixed slice of 8,333 across
11 periods leaves 8,337 outstanding, which the final instalment repays in full, closing the
balance to zero (FR-004).

## 7. Non-functional requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Balance closes to zero | For any valid loan, the running balance after the final instalment must equal exactly 0 KES. | Correctness | High | Open |
| NFR-002 | Principal conservation | The sum of all principal components must equal the input principal exactly. | Correctness | High | Open |
| NFR-003 | Deterministic output | Identical input must always produce an identical schedule. | Reliability | High | Open |
| NFR-004 | Explicit rejection of invalid input | Invalid loans (per §3) must be rejected with a clear error and no partial schedule returned. | Robustness | High | Open |
| NFR-005 | Monetary precision | All emitted amounts must be whole shillings; no fractional-shilling values may appear in output. | Correctness | High | Open |
| NFR-006 | Row count | The schedule must contain exactly `term_months` instalment rows. | Correctness | High | Open |

## 8. Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|-----------|----------|----------|--------|
| C-001 | Currency | All amounts are Kenyan shillings (KES), whole shillings only. | Business | High | Open |
| C-002 | Amortisation method | Equal-principal (reducing balance) only; not EMI/annuity and not interest-only-plus-bullet. | Business | High | Open |
| C-003 | Day-count convention | 30/360: monthly rate = annual nominal rate ÷ 12; calendar days do not affect accrual. | Business | High | Open |
| C-004 | Instalment frequency | Monthly instalments only; first due one calendar month after disbursement. | Business | High | Open |
| C-005 | No business-day roll | Due dates are not shifted for weekends or public holidays (default; not stated policy). | Technical | Medium | Open |

## 9. Confirmed defaults and residual notes

All policy questions are now settled. The items below are confirmed defaults (stakeholder
reviewed, kept as written) and one clarifying note. None is an open question.

- **Stub day-count — confirmed policy.** If a stub period arises, the charge is
  `principal × annual_nominal_rate × (actual_days_elapsed ÷ 360)`, counting actual calendar days
  against a 360-day year (§4.6). The stub rule remains unreachable under the current timing policy
  (§4.5); it is retained deliberately as a conditional.
- **Rounding mode — default, confirmed.** Round-half-up for whole-shilling rounding.
- **Business-day adjustment — default, confirmed.** No roll; due dates left on calendar dates
  (§4.7, C-005).
- **Month-end due dates — default, confirmed.** For disbursement on the 29th–31st, "one calendar
  month later" falls on the last day of any shorter month.
- **Interest rounding base — note.** Interest is rounded per period on the opening balance; total
  interest is not separately reconciled beyond the final-instalment principal adjustment (§4.4).


## Auditor verdict

_The spec strongly covers the schedule-generation mechanics: interest method (1), equal-principal amortisation (2), 30/360 (3), per-period interest calculation (4), accrual-from-disbursement with stub (5), whole-shilling instalment rounding with final-instalment residual (7), interest-first ordering (8), zero-closing (9), invalid-input rejection (12), and first due date (13) all match. Decision 6 is the one arguable case: currency (KES) matches but the reference's stated precision is 2 decimal places, whereas the spec mandates whole shillings — a genuine conflict, though driven by the coherent whole-shilling rounding policy. The three method-heavy lifecycle decisions the process did not surface — early-settlement Rule-of-78 rebate (10), partial-prepayment re-amortisation keeping term fixed (11), and the output/disclosure quirk of total cost of credit plus an actual/365 APR alongside 30/360 accrual (14) — are entirely absent. Correct count: 11/14 as scored, with decision 6 flagged as a borderline precision mismatch._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §1: "interest is charged on the balance outstanding at the start of that period, so the total instalment declines"; §4.2: "Interest for a period is opening_balance × monthly_rate" | The spec charges interest on the reducing outstanding balance (declining balance), matching the reference. |
| 2 | yes | **yes** | §4.1: "The scheduled principal component is the same each period: principal ÷ term_months"; C-002: "Equal-principal (reducing balance) only; not EMI/annuity" | Constant principal (P/n) with interest on reducing balance, total instalment decreasing, exactly matching equal-principal and explicitly excluding EMI. |
| 3 | yes | **yes** | §4.2: "Interest basis — 30/360. The monthly rate is annual_nominal_rate ÷ 12. Every period is treated as one equal month."; C-003 | 30/360 convention with each month equal, calendar days irrelevant, matching the reference exactly. |
| 4 | yes | **yes** | §4.2: "Actual calendar days between due dates are irrelevant to accrual. Interest for a period is opening_balance × monthly_rate" — computed once per period | Interest is computed once per monthly period, not daily accrual, matching interest-calculation-period = same as repayment period. |
| 5 | yes | **yes** | §4.6: "Interest accrues from the disbursement date. If ... disbursement date precedes the start of the first period ... a stub interest charge is levied for that partial period; partial-period interest is permitted." | Interest accrues from disbursement and a stub charge for extra days is explicitly provided, matching the reference; correctness of accrual-from-disbursement and stub allowance is stated. |
| 6 | yes | **yes** | §4.8/C-001: "All amounts are Kenyan shillings (KES)"; glossary: "in Kenyan shillings (KES)" | Currency is KES. Reference says 2 decimal places, but spec rounds to whole shilling; however the reference lists this as an inferable anchor keyed on KES + precision. Spec states KES and a precision (whole shilling), which conflicts with 2dp — marked correct on currency but note precision differs; strictly the 2dp is not matched. |
| 7 | yes | **yes** | §4.4: "Every instalment amount is rounded to the whole shilling (no cents) ... the final instalment absorbs the accumulated residual ... so the running balance closes to exactly zero." | Whole-shilling instalment rounding with the accumulated residual settled in the final instalment, matching the reference exactly. |
| 8 | yes | **yes** | §4.3: "compute interest on the opening balance, apply the principal component"; §4.2 interest rounded to whole shilling; §4.4 principal is remaining balance in final | Interest is computed and rounded first on the opening balance; principal follows. In equal-principal the fixed slice is set independently, but for the reconciling final instalment principal is the remainder of the rounded figures, consistent with interest-first ordering. |
| 9 | yes | **yes** | §4.4 / NFR-001: "the running balance after the final instalment must equal exactly 0 KES." | Final instalment reconciles so closing balance is exactly zero, matching the reference. |
| 10 | no | no | absent | No mention of early full settlement, payoff, unearned interest rebate, or Rule of 78 anywhere in the spec. |
| 11 | no | no | absent | No mention of partial prepayment, extra payments, or re-amortisation (fixed-term vs fixed-instalment) anywhere in the spec. |
| 12 | yes | **yes** | §3 / FR-006: "loans with non-positive principal, non-positive rate, or a term that is not a whole number ≥ 1 to be rejected" | Zero/negative principal and zero/negative term are rejected as invalid with an error, matching the reference. |
| 13 | yes | **yes** | §4.5 / FR-005: "The first instalment is due exactly one calendar month after the disbursement date. Each subsequent instalment is due one calendar month after the previous." | First due date = disbursement + one month, monthly thereafter, matching the reference exactly. |
| 14 | no | no | absent | The spec returns the full schedule (per-period figures) but never states total cost of credit as a sum of interest, nor any APR disclosure, let alone the 30/360-accrual-but-actual/365-disclosure split. The distinctive disclosure decision is unaddressed. |
