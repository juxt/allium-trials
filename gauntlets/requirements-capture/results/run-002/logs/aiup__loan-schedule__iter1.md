# aiup — loan-schedule — iteration 1

Model (author): claude-opus · Questions asked: 10 · Captured: 11/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the interactive prompt didn't go through. Let me put the questions to you directly in text — please answer each by number, and I'll build the spec from your answers.

These are the policy decisions the brief leaves open that I cannot safely infer, because each has several plausible answers and your institution has presumably standardized on specific ones:

**1. Amortization method** — how is each instalment structured?
- (a) Equal total instalments (annuity / EMI) — same total each period, interest portion shrinks, principal grows
- (b) Equal principal — same principal each period, total instalment declines over time
- (c) Interest-only + balloon — interest each period, full principal in the final instalment

**2. Interest basis** — how is the per-instalment rate derived from the annual nominal rate?
- (a) Monthly rate = annual / 12, applied to outstanding balance (ignores calendar days)
- (b) Actual/365 — balance × rate × actual days in period / 365
- (c) 30/360
- (d) Actual/360

**3. Rounding** — precision, rounding mode, and where the residual lands?
- (a) 2 decimals, round-half-up, residual absorbed in the final instalment (balance closes exactly at 0)
- (b) 2 decimals, round-half-even (banker's), residual in final instalment
- (c) 2 decimals, round-half-up, no final adjustment (accept small non-zero closing balance)

**4. Instalment due dates** — when is the first one due and how are later dates generated?
- (a) Exactly one month after disbursement, same day-of-month, no business-day adjustment
- (b) One month after, but month-end clamped (e.g. 31st → last day of Feb)
- (c) One month after, rolled to next business day if it lands on a weekend/holiday

And three more that also materially change the output:

**5. First-period interest** — if the gap between disbursement and the first instalment isn't exactly one standard period, does the first period accrue a prorated ("stub") interest amount based on actual days, or is every period treated as one full standard period regardless?

**6. Rate input units** — is the annual nominal rate supplied as a percentage (e.g. `7.5` meaning 7.5%) or as a decimal fraction (e.g. `0.075`)?

**7. Representation** — for money amounts, do you want the schedule returned in major units as decimals (e.g. `100.50`) or in integer minor units (e.g. cents / `10050`)? And should interest and principal be rounded independently, or principal derived as `instalment − interest` so the two always reconcile to the instalment?

If any of these have an obvious house answer you'd rather I just adopt, say so; otherwise pick an option per number.
A: 1. **(b) Equal principal.** A constant principal portion each period (P/n), interest on the reducing balance, so the total instalment decreases over the term. Not an annuity/EMI structure.

2. **(c) 30/360.** Every month is treated as 30 days, the year as 360. Not actual/365 or actual/360.

3. Closest to **(a)**, with one correction: instalments are rounded to the **whole shilling** (zero cents, not 2 decimal places). Round-half-up. The accumulated rounding difference is settled in the final instalment so the closing balance is exactly zero. Interest is computed and rounded first; principal for each period is derived as `instalment − interest`.

4. **(a).** First instalment is due exactly one calendar month after disbursement, same day-of-month, no business-day adjustment.

5. **Stub interest applies.** If disbursement precedes the first period start, a partial-period (stub) interest charge is levied for those extra days. Interest accrues from the disbursement date.

6. **[default, not policy]** Percentage — e.g. `7.5` meaning 7.5%.

7. **Major units as decimals** (e.g. `100.00`), KES to 2 decimal places. Principal is derived as `instalment − interest` each period so the two always reconcile to the instalment total.

### Round 2
_Step reasoning:_ (live agent turn)

Q: The interactive prompt isn't rendering in your environment — I'll ask in plain text again. Two clarifications before I finalize:

**A. Equal-principal generative rule.** I want to confirm my reading of answers 1, 3 and 7 combined:
- Constant principal portion = `round(P / n)` to the whole shilling, used for periods 1…n−1.
- Each period's instalment = that principal portion + that period's rounded interest (so the total instalment declines as the balance falls).
- The final period's principal = whatever balance remains, so the schedule closes to exactly zero and absorbs the accumulated `P/n` rounding drift.
- "Principal = instalment − interest" is then just the reconciliation identity (it holds automatically).

Is that exactly right? (If instead there's a *fixed total instalment* that stays constant — i.e. a true annuity/EMI — tell me, but that would contradict "equal principal, declining instalment".)

**B. The stub, given first instalment is exactly one month after disbursement.** Which of these is the policy?
- **(i)** First-period interest = balance × annual rate × (30/360 days from disbursement to first instalment ÷ 360). With same-day-of-month this is normally a full 30-day month; a non-full "stub" only arises in 30/360 edge cases (e.g. disbursed on the 31st, or February). There is no separate pre-period — just the 30/360 day count applied from the disbursement date.
- **(ii)** Instalment dates anchor to a *fixed calendar day that can differ from the disbursement day*, and the days between disbursement and that first anchor form an extra stub charge on top of the n regular instalments. (If so, tell me the anchor-day rule.)
- **(iii)** The first period is always a flat full month regardless of exact days; the stub provision is only a safety note and never changes the common-case figure.

Answer A (yes/no + correction) and B (i / ii / iii), and I'll write the spec.
A: A. Yes, that is exactly right. Constant principal = round(P/n) to the whole shilling, used for periods 1…n−1. Each period's instalment = that principal portion + that period's rounded interest (interest computed and rounded first, principal derived as the remainder). The final period's principal = whatever balance remains, absorbing accumulated rounding drift so the closing balance is exactly zero. The reconciliation identity holds automatically; it is not a separate rule.

B. (i). Instalment dates are always disbursement date + one calendar month (same day-of-month), so the first period runs from disbursement to that date and 30/360 is applied directly over that span. In the common case that is exactly 30 days under 30/360, giving a full standard period with no separate stub. A non-full first period arises only from 30/360 edge cases (e.g. disbursement on the 31st, or February), not from a fixed anchor day. There is no extra pre-period charge on top of the n instalments.

### Round 3
_Step reasoning:_ (live agent turn)

Q: Last one, then I'll write the spec. "30/360" has more than one standard variant, and they differ precisely in the edge cases you named (the 31st and February), so this isn't inferable:

**30/360 variant** — which day-count rule applies when a date lands on the 31st or on a February month-end?

- **(i) European 30E/360** — any day-of-month of 31 is set to 30 (both start and end dates), independently. February's actual last day is used as-is (not extended to 30). Simple and symmetric.
- **(ii) US / NASD 30/360** — sequencing rules: if the start day is the last day of February, it's treated as the 30th; a 31 end-date is only reduced to 30 if the start day is 30 or 31; etc.
- **(iii) Just divide the annual rate by 12 for every whole month**, and only fall back to an explicit day count for a genuinely partial first period — in which case use (i) European 30E/360 for that partial count.

Which one? (If you're not sure, (i) European 30E/360 is the most common choice for this style of product and the one I'd recommend.)
A: (i) European 30E/360. [default, not policy — the answer key specifies 30/360 but does not name a variant; adopting your recommendation.]

### Round 4
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md`.

## What it covers

The brief gave only the domain and the interface. Everything that actually determines the numbers was left open, so I surfaced each omitted policy and locked it to your answers before writing a line of spec. The document captures:

- **Interface & data model** — `generate_schedule(loan)` inputs/outputs with exact units and types.
- **Requirements catalog** — 7 functional requirements (user-story form), 6 non-functional requirements (all measurable), and 7 constraints.
- **Business rules** — precise rules for 30E/360 interest, due-date generation, whole-shilling rounding, and the equal-principal / final-instalment drift settlement.
- **Reference algorithm** in pseudocode, plus a full **12-row worked example** (and a stub-period edge example) so the behaviour is testable, not just described.
- **Decision log** mapping all 11 confirmed policies, and an **open-items** list.

## The policy decisions it pins down

1. **Equal-principal** (constant `round(P/n)`, declining instalment) — *not* annuity/EMI.
2. **30E/360** interest, with the European variant chosen explicitly.
3. **Whole-shilling, round-half-up**; interest rounded first, drift absorbed by the final instalment so the balance closes to exactly `0.00`.
4. **Disbursement + k months, same day-of-month**, no business-day adjustment.
5. **Stub interest from the disbursement date** via the 30E/360 day count.

Three items I want to flag as genuinely secondary and not locked by policy — I adopted recommended defaults and listed them under **Open Items** (Section 14): the European-vs-US 30/360 variant (OI-3), rate supplied as percentage vs fraction (OI-2), and month-end anchoring after a clamped due date (OI-1). If any of those have a different house standard, tell me and I'll adjust — none of the others change.
A: Noted. No questions pending.

## Produced specification

# Repayment Schedule Engine — Requirements Specification

**Feature:** `generate_schedule(loan)` — repayment schedule generation for the loan product
**Status:** Draft for implementation
**Date:** 2026-11-09
**Currency:** KES (Kenyan shilling)

---

## 1. Overview

Given a disbursed loan, the engine produces the full repayment schedule: for each
instalment, the due date, the opening balance, the interest due, the principal due,
the total instalment, and the running (closing) balance. The schedule repays the
principal in full, closing to an exactly zero balance on the final instalment.

The product uses an **equal-principal** (declining-instalment) structure, **30E/360**
(European) interest, and **whole-shilling** rounding. These and the other policies
below were confirmed with the product stakeholder; see the **Decision Log**
(Section 10). Items marked *[default]* were not fixed by stakeholder policy and adopt
a stated default — change them freely if the house standard differs.

---

## 2. Interface

```
generate_schedule(loan) -> Schedule
```

### 2.1 Input — `loan`

| Field               | Type               | Units / Format                        | Notes                                                        |
|---------------------|--------------------|---------------------------------------|--------------------------------------------------------------|
| `principal`         | decimal            | KES, major units (e.g. `100000.00`)   | Original disbursed amount. Must be > 0.                       |
| `annual_rate`       | decimal            | Percent, e.g. `7.5` means 7.5% *[default: percentage, not fraction]* | Nominal annual interest rate. Must be ≥ 0.  |
| `term`              | integer            | Count of monthly instalments (`n`)    | Must be ≥ 1.                                                  |
| `disbursement_date` | date               | Calendar date                         | Date the loan funds were disbursed; interest accrues from here. |

### 2.2 Output — `Schedule`

An ordered list of `n` instalment rows (instalment `1 … n`). Each row:

| Field             | Type    | Units                | Definition                                                     |
|-------------------|---------|----------------------|----------------------------------------------------------------|
| `number`          | integer | 1 … n                | Instalment sequence number.                                    |
| `due_date`        | date    | Calendar date        | Date this instalment is due (Section 7).                       |
| `opening_balance` | decimal | KES, 2 dp (`.00`)    | Outstanding principal at the start of the period.              |
| `interest`        | decimal | KES, 2 dp (`.00`)    | Interest due this instalment (Section 6).                      |
| `principal`       | decimal | KES, 2 dp (`.00`)    | Principal repaid this instalment (Section 5).                  |
| `instalment`      | decimal | KES, 2 dp (`.00`)    | Total due = `interest + principal`.                            |
| `closing_balance` | decimal | KES, 2 dp (`.00`)    | `opening_balance − principal`. Zero on the final row.          |

All monetary values are whole-shilling amounts (Section 8) carried at 2 decimal
places, so the cents are always `.00`.

---

## 3. Functional Requirements

| ID     | Title                        | User Story                                                                                                                                                         | Priority | Status |
|--------|------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|--------|
| FR-001 | Generate full schedule       | As a loan servicing system, I want to generate a complete repayment schedule from a disbursed loan so that every instalment's interest, principal, and running balance are known. | High     | Open   |
| FR-002 | Equal-principal structure    | As a loan product owner, I want each instalment to repay a constant principal portion with interest charged on the reducing balance so that the total instalment declines over the term. | High     | Open   |
| FR-003 | Per-instalment breakdown     | As a borrower, I want each instalment to show the interest due, the principal due, and the remaining balance so that I can see how my loan amortizes.             | High     | Open   |
| FR-004 | Close balance to zero        | As a finance controller, I want the final instalment to repay the exact remaining balance so that the schedule closes to a zero balance with no residual.         | High     | Open   |
| FR-005 | Generate due dates           | As a loan servicing system, I want instalment due dates generated one calendar month apart from the disbursement date so that payments fall on the same day each month. | High     | Open   |
| FR-006 | Charge first-period interest from disbursement | As a finance controller, I want first-period interest computed from the disbursement date under 30E/360 so that a partial first period is charged for the days actually elapsed. | Medium   | Open   |
| FR-007 | Validate loan input          | As a loan servicing system, I want invalid loan inputs rejected with a clear error so that no malformed schedule is produced.                                     | High     | Open   |

---

## 4. Non-Functional Requirements

| ID      | Title                    | Requirement                                                                                                                             | Category      | Priority | Status |
|---------|--------------------------|----------------------------------------------------------------------------------------------------------------------------------------|---------------|----------|--------|
| NFR-001 | Determinism              | Identical input must always produce byte-identical output; the computation uses no wall-clock, locale, or random state.                 | Reliability   | High     | Open   |
| NFR-002 | Exact principal recovery | The sum of `principal` across all `n` rows must equal `loan.principal` exactly, and the final `closing_balance` must equal `0.00`.      | Correctness   | High     | Open   |
| NFR-003 | Per-row reconciliation   | For every row: `interest + principal = instalment` exactly, and `closing_balance = opening_balance − principal` exactly.                | Correctness   | High     | Open   |
| NFR-004 | Rounding precision       | Every monetary output is rounded to the whole shilling using round-half-up, and represented to exactly 2 decimal places.                | Correctness   | High     | Open   |
| NFR-005 | Performance              | A schedule of up to 600 instalments must be computed in under 50 ms on a standard server core.                                          | Performance   | Medium   | Open   |
| NFR-006 | Precision of arithmetic  | Interest computation must use exact decimal arithmetic (not binary floating point) to avoid representation drift before rounding.        | Correctness   | High     | Open   |

---

## 5. Constraints

| ID    | Title                   | Constraint                                                                                               | Category  | Priority | Status |
|-------|-------------------------|---------------------------------------------------------------------------------------------------------|-----------|----------|--------|
| C-001 | Interface signature     | The engine must expose `generate_schedule(loan)` returning the schedule.                                 | Technical | High     | Open   |
| C-002 | Amortization method     | Must use equal-principal (constant `P/n` principal, declining instalment); not annuity/EMI.              | Business  | High     | Open   |
| C-003 | Day-count convention    | Interest must use 30E/360 (European): each whole month is 30 days, the year is 360 days.                 | Business  | High     | Open   |
| C-004 | Rounding granularity    | Monetary amounts must be rounded to the whole shilling (0 cents), round-half-up.                         | Business  | High     | Open   |
| C-005 | Due-date rule           | Instalment dates are disbursement date + k calendar months, same day-of-month, no business-day adjustment. | Business  | High     | Open   |
| C-006 | Rate input units        | `annual_rate` is supplied as a percentage number (e.g. `7.5` = 7.5%). *[default]*                        | Technical | Medium   | Open   |
| C-007 | Representation          | Amounts are returned in KES major units as decimals to 2 dp.                                             | Technical | Medium   | Open   |

---

## 6. Business Rules — Interest

**BR-INT-1 — Convention.** Interest uses the **30E/360 (European)** day-count
convention. The 30E/360 day count between a start date `(D1/M1/Y1)` and an end date
`(D2/M2/Y2)` is:

```
d1 = min(D1, 30)
d2 = min(D2, 30)
days = 360 * (Y2 - Y1) + 30 * (M2 - M1) + (d2 - d1)
```

The 31st of any month is treated as the 30th (both start and end dates,
independently). February's actual last day is used as-is and is **not** extended to
30. (This is the European 30E/360 rule, *[default]* adopted because the stakeholder
specified 30/360 without naming a variant.)

**BR-INT-2 — Period interest.** For each instalment `i`, the interest charged is:

```
rate       = annual_rate / 100            # percent -> fraction
days_i     = days30E360(period_start_i, due_date_i)
interest_i = ROUND_SHILLING( opening_balance_i * rate * days_i / 360 )
```

where `period_start_i = disbursement_date` for `i = 1`, and
`period_start_i = due_date_(i-1)` for `i > 1`.

**BR-INT-3 — Interest is computed and rounded first**, before the principal portion
is attached (see BR-PRN-3).

**BR-INT-4 — Full regular periods.** Because every instalment date shares the same
day-of-month, the 30E/360 day count between two consecutive instalment dates is
always 30, so a regular period's interest reduces to
`opening_balance × rate / 12`.

**BR-INT-5 — First-period / stub interest.** Interest accrues from the
`disbursement_date`. The first period runs from the disbursement date to the first
instalment date, with 30E/360 applied directly over that span. In the common case
(first instalment exactly one calendar month later, same day-of-month) this is 30
days — a full standard period. A *partial* first period (fewer than 30 days) arises
only from 30E/360 edge cases — e.g. disbursement on the 31st, or a first instalment
landing on a short February month-end — and is charged pro rata via BR-INT-2. There
is **no** separate pre-period charge added on top of the `n` instalments.

---

## 7. Business Rules — Due Dates

**BR-DATE-1 — Spacing.** Instalment `i` is due on `disbursement_date + i` calendar
months, keeping the same day-of-month as the disbursement date. There are `n`
instalments, `i = 1 … n`.

**BR-DATE-2 — No business-day adjustment.** Dates are **not** adjusted for weekends
or public holidays; a due date may fall on any calendar day.

**BR-DATE-3 — Non-existent day-of-month.** When the target month has no matching
day-of-month (e.g. the 31st in a 30-day month, or the 29th–31st in February), the
due date resolves to the **last day of that month**. This is the only sensible
calendar resolution and is what produces the partial-first-period edge case in
BR-INT-5. Subsequent dates remain anchored to the disbursement day-of-month (a
single clamped month does not shift later anchors). *[Adopted resolution — derived
from the stub discussion; confirm if a different month-end anchoring is intended.]*

---

## 8. Business Rules — Rounding

**BR-RND-1 — Granularity and mode.** All monetary amounts are rounded to the **whole
shilling** (integer KES, zero cents) using **round-half-up** (a `.5` fraction rounds
away from zero). `ROUND_SHILLING(x)` denotes this operation.

**BR-RND-2 — Representation.** Rounded whole-shilling values are returned as decimals
to 2 decimal places; the cents are therefore always `.00`.

**BR-RND-3 — Drift settlement.** Accumulated rounding drift from the constant
principal portion is settled entirely in the **final instalment** (BR-PRN-4), so the
schedule closes to exactly `0.00`.

---

## 9. Business Rules — Principal & Instalment (Equal-Principal)

**BR-PRN-1 — Constant principal portion.** The scheduled principal for each of the
first `n − 1` instalments is constant:

```
principal_const = ROUND_SHILLING(loan.principal / n)
```

**BR-PRN-2 — Regular instalments (`i = 1 … n-1`).**

```
opening_balance_i = balance carried in (opening_balance_1 = loan.principal)
interest_i        = per BR-INT-2
principal_i       = principal_const
instalment_i      = principal_i + interest_i
closing_balance_i = opening_balance_i - principal_i
```

Because the total instalment is `principal_const + interest_i` and interest falls as
the balance declines, the total instalment **decreases** over the term.

**BR-PRN-3 — Reconciliation identity.** Interest is rounded first, then the principal
portion is attached, so `principal_i = instalment_i − interest_i` holds
automatically on every row. It is a consequence of the construction, not a separate
computation.

**BR-PRN-4 — Final instalment (`i = n`).** The final instalment repays the entire
remaining balance, absorbing all accumulated `P/n` rounding drift:

```
principal_n       = opening_balance_n          # whatever balance remains
interest_n        = per BR-INT-2
instalment_n      = principal_n + interest_n
closing_balance_n = 0.00                        # exact
```

**BR-PRN-5 — Invariants.**
- `Σ principal_i = loan.principal` (exactly).
- `closing_balance_n = 0.00` (exactly).
- Every row satisfies `interest_i + principal_i = instalment_i` and
  `closing_balance_i = opening_balance_i − principal_i`.

---

## 10. Reference Algorithm (pseudocode)

```
function generate_schedule(loan):
    validate(loan)                                  # FR-007 / Section 11

    rate            = loan.annual_rate / 100
    principal_const = ROUND_SHILLING(loan.principal / loan.term)
    balance         = loan.principal
    schedule        = []
    prev_date       = loan.disbursement_date

    for i in 1 .. loan.term:
        due_date = add_months(loan.disbursement_date, i)   # BR-DATE-1..3
        days     = days30E360(prev_date, due_date)         # BR-INT-1
        interest = ROUND_SHILLING(balance * rate * days / 360)   # BR-INT-2

        if i < loan.term:
            principal = principal_const                    # BR-PRN-2
        else:
            principal = balance                            # BR-PRN-4 (drift + close to 0)

        instalment = principal + interest
        closing    = balance - principal

        schedule.append(row(i, due_date, balance, interest, principal, instalment, closing))

        balance   = closing
        prev_date = due_date

    return schedule
```

---

## 11. Input Validation (FR-007)

| Rule                                   | On violation            |
|----------------------------------------|-------------------------|
| `principal > 0`                        | Reject with clear error |
| `term` is an integer ≥ 1               | Reject with clear error |
| `annual_rate ≥ 0`                      | Reject with clear error |
| `disbursement_date` is a valid date    | Reject with clear error |

A zero `annual_rate` is valid and yields a schedule with zero interest on every row.

---

## 12. Worked Example

**Input:** `principal = 100,000.00 KES`, `annual_rate = 12`, `term = 12`,
`disbursement_date = 2026-01-15`.

- `rate = 0.12`; regular monthly factor `= 0.12 / 12 = 0.01`.
- `principal_const = ROUND_SHILLING(100000 / 12) = ROUND_SHILLING(8333.33) = 8333`.
- Every regular period is a full 30E/360 month (same day-of-month, the 15th), so
  `interest_i = opening_balance_i × 0.01`.

| # | Due date   | Opening     | Interest | Principal | Instalment | Closing    |
|---|------------|-------------|----------|-----------|------------|------------|
| 1 | 2026-02-15 | 100,000.00  | 1,000.00 | 8,333.00  | 9,333.00   | 91,667.00  |
| 2 | 2026-03-15 | 91,667.00   | 917.00   | 8,333.00  | 9,250.00   | 83,334.00  |
| 3 | 2026-04-15 | 83,334.00   | 833.00   | 8,333.00  | 9,166.00   | 75,001.00  |
| 4 | 2026-05-15 | 75,001.00   | 750.00   | 8,333.00  | 9,083.00   | 66,668.00  |
| 5 | 2026-06-15 | 66,668.00   | 667.00   | 8,333.00  | 9,000.00   | 58,335.00  |
| 6 | 2026-07-15 | 58,335.00   | 583.00   | 8,333.00  | 8,916.00   | 50,002.00  |
| 7 | 2026-08-15 | 50,002.00   | 500.00   | 8,333.00  | 8,833.00   | 41,669.00  |
| 8 | 2026-09-15 | 41,669.00   | 417.00   | 8,333.00  | 8,750.00   | 33,336.00  |
| 9 | 2026-10-15 | 33,336.00   | 333.00   | 8,333.00  | 8,666.00   | 25,003.00  |
| 10| 2026-11-15 | 25,003.00   | 250.00   | 8,333.00  | 8,583.00   | 16,670.00  |
| 11| 2026-12-15 | 16,670.00   | 167.00   | 8,333.00  | 8,500.00   | 8,337.00   |
| 12| 2027-01-15 | 8,337.00    | 83.00    | 8,337.00  | 8,420.00   | 0.00       |

Notes illustrated:
- Interest is round-half-up to the whole shilling (`916.67 → 917`, `83.37 → 83`).
- The total instalment declines each period.
- The first 11 instalments repay `8,333 × 11 = 91,663`; the final instalment repays
  the remaining `8,337` (absorbing the `+4` drift from rounding `100000/12` down to
  `8333`), closing the balance to exactly `0.00`.

**Stub edge example (for reference):** disbursement `2026-01-31`, first instalment
resolves to `2026-02-28` (BR-DATE-3). 30E/360 day count: `d1 = min(31,30) = 30`,
`d2 = 28` → `days = 30 + (28 − 30) = 28`. First-period interest is therefore
`opening × rate × 28/360` — a partial period — while all later full months use
`× 30/360`.

---

## 13. Decision Log

Each policy below was omitted from the brief and confirmed with the product
stakeholder. *[default]* marks items the stakeholder left to a stated default rather
than fixing as policy.

| # | Decision                     | Resolution                                                                                                   |
|---|------------------------------|--------------------------------------------------------------------------------------------------------------|
| 1 | Amortization method          | Equal principal: constant `round(P/n)` per period, interest on reducing balance, declining total instalment. |
| 2 | Interest day-count           | 30/360, treating each month as 30 days and the year as 360.                                                   |
| 3 | 30/360 variant               | European **30E/360** *[default — stakeholder specified 30/360 without naming a variant]*.                     |
| 4 | Rounding granularity & mode  | Whole shilling (0 cents), round-half-up.                                                                      |
| 5 | Rounding — order             | Interest computed and rounded first; principal attached as the constant portion; identity holds.             |
| 6 | Rounding — drift             | Settled in the final instalment; closing balance exactly zero.                                               |
| 7 | Due dates                    | Disbursement date + k months, same day-of-month, **no** business-day adjustment.                             |
| 8 | Non-existent day-of-month    | Resolve to month-end *[adopted resolution derived from the stub discussion]*.                                |
| 9 | First-period / stub interest | Interest accrues from disbursement; first period via 30E/360 day count (full month in the common case).      |
| 10| Rate input units             | Percentage, e.g. `7.5` = 7.5% *[default]*.                                                                    |
| 11| Representation               | KES major units, decimals to 2 dp (values are whole shillings).                                              |

---

## 14. Open Items / To Confirm

- **OI-1 (BR-DATE-3):** Confirm month-end anchoring when a due date clamps to
  month-end — the spec assumes later instalments revert to the original
  disbursement day-of-month rather than continuing from the clamped date.
- **OI-2 (C-006):** Confirm `annual_rate` is passed as a percentage (`7.5`) and not a
  fraction (`0.075`) — currently a default, not stakeholder-fixed policy.
- **OI-3 (BR-INT-1):** Confirm 30**E**/360 (European) vs US/NASD 30/360 — adopted
  European as a recommended default; only the named edge cases (31st, February)
  differ between the two.
```

## Auditor verdict

_The spec surfaces and correctly resolves 11 of 14 decisions (1-9, 12, 13), including the bespoke amortisation, 30/360, period, stub, and rounding-order/drift choices. It misses three: early-settlement Rule-of-78 rebate (#10) and partial-prepayment re-amortisation (#11) are entirely absent, and the output decision (#14) covers the schedule rows but omits the total cost of credit and the actual/365 APR disclosure. Coverage = 11/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | FR-002 'interest charged on the reducing balance'; C-002 equal-principal with declining instalment; BR-INT-2 interest = opening_balance × rate × days/360 | Interest is computed on the reducing/outstanding balance each period, which is declining-balance on reducing principal. Matches the reference exactly. |
| 2 | yes | **yes** | C-002 'Must use equal-principal (constant P/n principal, declining instalment); not annuity/EMI'; FR-002; BR-PRN-1 principal_const = ROUND_SHILLING(loan.principal / n) | Spec explicitly adopts equal-principal: constant P/n principal, interest on reducing balance, total instalment decreasing, and explicitly rules out EMI. Exact match. |
| 3 | yes | **yes** | C-003 'Interest must use 30E/360 (European): each whole month is 30 days, the year is 360 days'; BR-INT-1 | Reference requires 30/360 (month=30, year=360, not actual/365). Spec adopts the 30E/360 variant, which satisfies month=30/year=360; the European-vs-US distinction is not part of the reference answer. |
| 4 | yes | **yes** | BR-INT-4 'a regular period's interest reduces to opening_balance × rate / 12'; BR-INT-2 computes interest once per instalment period, not daily | Interest is computed once per monthly repayment period (balance × rate × days/360), not daily accrual. Matches 'same as the repayment period'. |
| 5 | yes | **yes** | BR-INT-5 'Interest accrues from the disbursement_date... A partial first period (fewer than 30 days)... is charged pro rata via BR-INT-2'; stub edge example in Section 12 | Spec accrues interest from disbursement and charges partial-period (stub) interest pro rata in edge cases, matching the reference decision that partial-period interest is allowed and charged. The 'no separate pre-period charge' caveat just means it is folded into the first instalment, consistent with first-due = disbursement+1 month shared by both. |
| 6 | yes | **yes** | Header 'Currency: KES'; Section 2.2 'KES, 2 dp'; C-007 'KES major units as decimals to 2 dp' | Kenyan shilling with amounts to 2 decimal places, matching the reference exactly. |
| 7 | yes | **yes** | BR-RND-1 round to 'whole shilling (integer KES, zero cents)'; BR-RND-3 'Accumulated rounding drift... settled entirely in the final instalment'; BR-PRN-4 | Each instalment is rounded to the whole shilling (no cents) and the accumulated rounding difference is absorbed in the final instalment. Exact match. |
| 8 | yes | **yes** | BR-INT-3 'Interest is computed and rounded first, before the principal portion is attached'; BR-PRN-3 'principal_i = instalment_i − interest_i holds automatically' | Interest is computed and rounded first; principal is then the remainder of the instalment. Matches the reference's interest-first ordering. |
| 9 | yes | **yes** | FR-004; NFR-002; BR-PRN-4 'closing_balance_n = 0.00 # exact'; BR-PRN-5 invariants | Final instalment reconciles the remaining balance so closing balance is exactly zero. Exact match. |
| 10 | no | no | absent | The spec covers only schedule generation; early full settlement, unearned-interest rebate, and the Rule of 78 are not mentioned anywhere. |
| 11 | no | no | absent | Partial prepayment, re-amortisation, and the keep-term-fixed strategy are not addressed by the spec at all. |
| 12 | yes | **yes** | Section 11 validation table: 'principal > 0 → Reject', 'term is an integer ≥ 1 → Reject'; FR-007 | Zero/negative principal and zero/invalid term are rejected as invalid with a clear error. Matches the reference. |
| 13 | yes | **yes** | BR-DATE-1 'Instalment i is due on disbursement_date + i calendar months'; FR-005; C-005 | First due date is disbursement + one month with subsequent instalments monthly. Exact match. |
| 14 | yes | no | Section 2.2 defines the full schedule rows (due date, opening, interest, principal, instalment, closing), but there is no total cost of credit and no APR; actual/365 disclosure is absent | The full per-period schedule is correctly specified, but the reference also requires the total cost of credit (sum of interest) and a disclosed APR on an actual/365 basis distinct from the 30/360 accrual. Those disclosure elements are entirely missing, so the decision is not correctly resolved. |
