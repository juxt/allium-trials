# bmad — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 12 · Captured: 8/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured question prompt didn't go through. Let me just ask them in plain text — answer inline however is easiest for you.

These are the policy decisions that change the actual numbers in the schedule, so I need your institution's specific choices rather than my guesses.

**Round 1 — how interest and instalments are computed**

1. **Amortization method** — how is each instalment split into interest vs principal?
   - (a) **Equal instalment / annuity** — fixed total payment each month (the "French" method); interest share falls, principal share rises.
   - (b) **Equal principal** — fixed principal each month; total payment starts high and declines.
   - (c) **Interest-only + balloon** — pay interest only, full principal in the last instalment.
   - (d) **Bullet** — everything (principal + accrued interest) due at the end.

2. **Periodic rate basis** — how do you convert the *annual nominal* rate to a monthly rate?
   - (a) **Nominal / 12** (simple division — the usual meaning of "nominal annual compounded monthly").
   - (b) **Effective conversion** — `(1 + annual)^(1/12) − 1`.

3. **Day-count convention** — how much interest accrues per period?
   - (a) **30/360** — every month = exactly 1/12 of a year (interest = balance × periodic rate).
   - (b) **Actual/365** — interest scales by actual days in the period (months differ).
   - (c) **Actual/360**.

4. **Rounding & residual** —
   - (a) Round to **2dp each period, absorb the residual in the final instalment** (closing balance exactly 0).
   - (b) Round to 2dp, **no final adjustment** (small residual may remain).
   - (c) **Full precision**, no rounding.

**Round 2 — timing and edge cases** (answer now if you like, or after Round 1)

5. **First instalment date** — when is instalment #1 due relative to the disbursement date? Exactly **one month after**? A **fixed day of the month**? Something else?

6. **Odd/stub first period** — if disbursement doesn't line up with the payment day, is the first period always treated as a **full month**, or is **stub interest pro-rated** by actual days for the short/long first period?

7. **Payment timing** — instalments in **arrears** (end of period, standard) or **in advance** (annuity due)?

Once I have these, I'll write the full requirements spec to `spec.md`.
A: 1. **(b) Equal principal.** Fixed principal portion each period (P/n); interest on the reducing balance; total instalment decreases over the term.

2. **(a) Nominal / 12** — simple division of the annual nominal rate.

3. **(a) 30/360** — every month is exactly 1/12 of the year; no adjustment for actual days.

4. Neither (a) nor (b) exactly: instalments round to the **whole shilling** (no cents), and the accumulated rounding difference is settled in the **final instalment** so the closing balance is exactly zero.

5. Disbursement date **plus one month**; subsequent instalments monthly thereafter.

6. **Stub interest is charged.** If disbursement precedes the first period start, a partial-period interest charge is levied for those extra days.

7. **Arrears** (standard end-of-period). [default, not policy]

### Round 2
_Step reasoning:_ (live agent turn)

Q: Got it — captured. Before I write the spec, answers 5 and 6 interact in a way I need to pin down, because together they decide the single trickiest part of the engine (the stub), and the brief only gives the function four inputs (principal, annual nominal rate, term in months, disbursement date).

The tension: if instalment #1 is simply *disbursement + 1 month* (answer 5), then the first period is already exactly one month and no stub ever arises. For a stub to exist (answer 6), there must be a **first-period-start / due-day anchor** that is distinct from the disbursement date, with the gap between them being the stub. So:

**8. What defines the "first period start" (and therefore the stub length)?**
   - (a) A **fixed due-day-of-month** the loan bills on (e.g. always the 1st) — stub = disbursement → next occurrence of that day.
   - (b) An explicit **first-period-start date** carried on the loan object.
   - (c) Something else — please describe.
   - And: is this value an **additional field on `loan`** beyond the four named in the brief? (If stubs exist, the function needs it from somewhere.)

**9. Stub interest day-count & rate** — using 30/360, is the stub charged as `balance × (annual/12) × (stub_days / 30)`, or as `balance × annual × (stub_days / 360)`? (These are the same under pure 30/360, but differ if the stub spans a month boundary — tell me which formula is canonical.)

**10. How is the stub billed?**
   - (a) **Added to instalment #1** (first instalment = P/n + one month's interest + stub interest).
   - (b) A **separate charge collected at disbursement** (not a schedule row).
   - (c) Its own **schedule row** (an extra line, e.g. row 0).

**11. Does the stub change amortization?** I'm assuming principal still amortizes as **P/n over the n regular instalments** and the stub is **interest-only** (no principal, doesn't add an instalment to the term). Correct?

**12. Due date of instalment #1** — given the anchor: is it **disbursement + 1 month**, or **first-period-start + 1 month**?
A: 8. **(b) Explicit first-period-start date** carried on the loan object. Stub = disbursement date → first-period-start date. Yes, this is an additional field beyond the four named in the brief; the engine needs it to compute the stub.

9. Canonical formula: `balance × annual_rate × (stub_days / 360)`. (This is identical to `balance × (annual_rate / 12) × (stub_days / 30)` — the two are algebraically the same under pure 30/360, so either form may be used in code, but the 360-denominator form is the reference.)

10. **(a) Added to instalment #1.** The first instalment = stub interest + (P/n) + one full month's interest on the opening balance. [default, not policy]

11. **Correct.** The stub is interest-only. Principal still amortises as P/n across the n regular instalments; the stub does not add an instalment or alter the term.

12. **First-period-start + 1 month.** Instalment #1 is due one month after the first-period-start date, not one month after disbursement.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md`.

## What I did

Following the PRD skill's **Discovery → Finalize** discipline, I treated this as a focused component spec and spent the effort where it mattered: eliciting the material policy decisions the brief deliberately omitted, rather than inferring them. I asked you twelve questions across three rounds; your answers are now the authoritative core of the spec (§3, PD-1 through PD-8).

The decisions that drive the numbers — and that a model would otherwise have had to guess:

- **Equal principal** amortization (not annuity)
- Monthly rate = **nominal / 12** (not effective conversion)
- **30/360** day-count
- Round to the **whole shilling**, residual settled in the final instalment
- **Stub interest** charged for the disbursement→first-period gap, via `balance × annual_rate × stub_days/360`, folded into instalment #1, interest-only
- A **required fifth `loan` field** — `first_period_start` — which the brief's four inputs couldn't support
- Instalment #1 due at **first_period_start + 1 month**, in arrears

## What's in the file

Interface & I/O schema, the authoritative decision table, 16 numbered functional requirements, a reference algorithm, a fully hand-checkable worked example (closing balance lands exactly on zero), NFRs, and a short Open Items list where I flagged the handful of implementation choices you didn't explicitly rule on (rounding tie-break, 30/360 variant, month-end date rolling) as visible `[ASSUMPTION]`s rather than silent guesses.

One thing worth your eye: **OI-1** (round-half-up vs banker's rounding, and whether rounding applies per-component or to the total) is the assumption most likely to shift a shilling here and there — confirm it before implementation if precision is audited.
A: Noted. The spec looks well-structured — the assumption flags are exactly the right approach for OI-1. Confirm round-half-up with the operations team before implementation begins.

## Produced specification

---
title: Repayment Schedule Engine — Requirements Specification
status: draft
created: 2026-11-08
updated: 2026-11-08
component: generate_schedule(loan)
---

# Repayment Schedule Engine — Requirements Specification

## 1. Overview

The repayment schedule engine computes the full amortization schedule for a
disbursed loan. Given the loan terms, it produces one row per instalment giving
the interest due, the principal due, the total payment, and the running
(outstanding) balance, such that the balance reaches exactly zero at the final
instalment.

This is a deterministic, pure computation: the same `loan` always yields the
same schedule. There is no persistence, I/O, or external state in scope.

### 1.1 Why this spec exists

The originating brief named only the domain and the interface and left every
material policy decision open. Those decisions are not inferable — each has
several industry-standard answers that produce *different numbers*. They were
resolved with the product stakeholder and are recorded in §3. Any
implementation that deviates from §3 is incorrect, not merely different.

## 2. Interface & Scope

### 2.1 Signature

```
generate_schedule(loan) -> Schedule
```

A single function. No side effects.

### 2.2 Inputs — the `loan` object

| Field                | Type        | Notes |
|----------------------|-------------|-------|
| `principal`          | money       | Disbursed principal `P`, in shillings. Must be > 0. |
| `annual_rate`        | decimal     | Annual **nominal** interest rate (e.g. `0.12` for 12%). Must be ≥ 0. |
| `term_months`        | integer `n` | Number of monthly instalments. Must be ≥ 1. |
| `disbursement_date`  | date        | Date funds were released. |
| `first_period_start` | date        | **Additional field beyond the brief's four.** The anchor date on which the regular monthly periods begin. Must be ≥ `disbursement_date`. |

> **FR note:** The brief listed only four inputs. The stub-interest policy (§3,
> PD-5) requires a distinct first-period-start anchor, so `first_period_start`
> is a required fifth field on `loan`. The engine cannot compute a correct
> schedule without it. [DEPENDENCY — confirmed with stakeholder]

### 2.3 Output — the `Schedule`

An ordered list of `n` instalment rows (instalments `1..n`). Each row:

| Field               | Meaning |
|---------------------|---------|
| `instalment_number` | 1-based index, `1..n`. |
| `due_date`          | Date the instalment falls due (§3 PD-7). |
| `opening_balance`   | Outstanding principal at the start of the period. |
| `interest_due`      | Interest charged for the instalment (row 1 also includes the stub — §3 PD-5, PD-6). |
| `principal_due`     | Principal repaid in the instalment. |
| `total_instalment`  | `interest_due + principal_due`. |
| `closing_balance`   | `opening_balance − principal_due`. The final row's `closing_balance` is exactly `0`. |

## 3. Domain Policy Decisions (authoritative)

These are the stakeholder-confirmed policies. They are the reason this spec is
correct rather than plausible.

| ID    | Decision area              | Chosen policy |
|-------|----------------------------|---------------|
| PD-1  | **Amortization method**    | **Equal principal.** A fixed principal portion `P/n` each period; interest charged on the reducing balance; the total instalment therefore declines over the term. |
| PD-2  | **Periodic rate basis**    | **Nominal / 12 (simple division).** `monthly_rate = annual_rate / 12`. Not an effective-rate conversion. |
| PD-3  | **Day-count convention**   | **30/360.** Every month is treated as exactly 1/12 of a year; no adjustment for the actual number of calendar days in a month. |
| PD-4  | **Rounding & residual**    | Each instalment is rounded to the **whole shilling** (no cents). The accumulated rounding difference is settled in the **final instalment** so the closing balance is exactly zero. |
| PD-5  | **Stub interest**          | If `disbursement_date` precedes `first_period_start`, a partial-period ("stub") interest charge is levied for those extra days. The stub is **added to instalment #1**. |
| PD-6  | **Stub formula**           | `stub_interest = opening_balance × annual_rate × (stub_days / 360)`. (Algebraically identical to `balance × (annual_rate/12) × (stub_days/30)` under 30/360; the 360-denominator form is canonical.) |
| PD-7  | **Schedule timing**        | Instalment #1 is due **`first_period_start` + 1 month**; each subsequent instalment one month later. Instalments are paid **in arrears** (end of period). |
| PD-8  | **Stub & amortization**    | The stub is **interest-only**. Principal still amortizes as `P/n` across the `n` regular instalments; the stub adds no instalment and does not alter the term. |

## 4. Functional Requirements

### 4.1 Core computation

- **FR-1** — The engine SHALL compute the monthly periodic rate as
  `monthly_rate = annual_rate / 12` (PD-2).
- **FR-2** — The engine SHALL compute the regular per-period principal as
  `P / n` and apply it to every instalment, except that the final instalment's
  principal SHALL be whatever amount brings `closing_balance` to exactly `0`
  (PD-1, PD-4).
- **FR-3** — For each period, the engine SHALL compute regular interest as
  `opening_balance × monthly_rate` (PD-2, PD-3). Because every period is exactly
  one month under 30/360, no per-month day scaling is applied to regular
  interest.
- **FR-4** — `opening_balance` of instalment 1 SHALL equal `principal`. For each
  subsequent instalment, `opening_balance` SHALL equal the previous instalment's
  `closing_balance`.
- **FR-5** — `closing_balance` SHALL equal `opening_balance − principal_due`.
- **FR-6** — `total_instalment` SHALL equal `interest_due + principal_due`.

### 4.2 Stub interest

- **FR-7** — The engine SHALL compute `stub_days` as the number of days between
  `disbursement_date` (inclusive) and `first_period_start` (exclusive) using the
  30/360 day-count convention (PD-3, PD-6).
- **FR-8** — When `stub_days > 0`, the engine SHALL compute
  `stub_interest = principal × annual_rate × (stub_days / 360)` and add it to
  the `interest_due` of instalment #1 (PD-5, PD-6). The stub is computed on the
  full opening principal, as it accrues before any principal repayment.
- **FR-9** — When `disbursement_date == first_period_start`, `stub_days` SHALL be
  `0` and no stub interest SHALL be charged.
- **FR-10** — The stub SHALL NOT add an instalment, SHALL NOT change the term,
  and SHALL NOT carry any principal (PD-8).

### 4.3 Dates

- **FR-11** — The `due_date` of instalment `k` (for `k` in `1..n`) SHALL be
  `first_period_start` plus `k` months (PD-7).

### 4.4 Rounding

- **FR-12** — `interest_due` and `principal_due` SHALL each be rounded to the
  whole shilling (PD-4). [ASSUMPTION — see OI-1: rounding is applied at the
  component level, half-up.]
- **FR-13** — The accumulated effect of rounding SHALL be absorbed entirely in
  the final instalment's `principal_due`, chosen so that the final
  `closing_balance` is exactly `0` (PD-4). This may make the final principal
  differ from `P/n`.
- **FR-14** — The sum of all `principal_due` across the schedule SHALL equal
  `principal` exactly.

### 4.5 Validation

- **FR-15** — The engine SHALL reject (raise/return an error for) a `loan` where
  `principal ≤ 0`, `term_months < 1`, `annual_rate < 0`, or
  `first_period_start < disbursement_date`.
- **FR-16** — When `annual_rate == 0`, the engine SHALL produce a schedule with
  zero interest in every row (stub included) and equal-principal repayment.

## 5. Computation Specification (reference algorithm)

Precise ordering, to remove ambiguity:

```
monthly_rate   = annual_rate / 12
regular_princ  = round_to_shilling(principal / n)

stub_days      = days_30_360(disbursement_date, first_period_start)
stub_interest  = round_to_shilling(principal * annual_rate * stub_days / 360)

balance = principal
for k in 1..n:
    opening = balance
    interest = round_to_shilling(opening * monthly_rate)
    if k == 1:
        interest = interest + stub_interest        # PD-5: stub folded into row 1
    if k < n:
        principal_due = regular_princ
    else:
        principal_due = opening                     # PD-4/FR-13: zero the balance
    balance = opening - principal_due
    emit row(k, first_period_start + k months, opening, interest, principal_due,
             interest + principal_due, balance)
```

Notes:
- `round_to_shilling` rounds to an integer number of shillings (no minor units).
- The final `principal_due = opening` guarantees `closing_balance == 0` and that
  `Σ principal_due == principal`, regardless of accumulated rounding (FR-13/14).
- Regular interest is **not** day-scaled; only the stub is (PD-3/PD-6).

## 6. Worked Example

Inputs:

| Field                | Value |
|----------------------|-------|
| `principal`          | 10,000 |
| `annual_rate`        | 0.12 (12%) |
| `term_months`        | 3 |
| `disbursement_date`  | 2026-01-21 |
| `first_period_start` | 2026-02-01 |

Derived:
- `monthly_rate = 0.12 / 12 = 0.01`
- `stub_days` (30/360, 2026-01-21 → 2026-02-01) = `(1 month × 30) + (1 − 21) = 10`
- `stub_interest = 10,000 × 0.12 × 10 / 360 = 33.33 → 33` shillings
- `regular_princ = 10,000 / 3 = 3,333.33 → 3,333`

Schedule:

| # | Due date   | Opening | Interest           | Principal | Total | Closing |
|---|------------|---------|--------------------|-----------|-------|---------|
| 1 | 2026-03-01 | 10,000  | 133 (100 + 33 stub)| 3,333     | 3,466 | 6,667   |
| 2 | 2026-04-01 | 6,667   | 67 (66.67→67)      | 3,333     | 3,400 | 3,334   |
| 3 | 2026-05-01 | 3,334   | 33 (33.34→33)      | 3,334     | 3,367 | 0       |

Checks: principal sums to `3,333 + 3,333 + 3,334 = 10,000`; final principal was
adjusted from 3,333 to 3,334 to zero the balance (FR-13); final closing balance
is exactly 0.

## 7. Non-Functional Requirements

- **NFR-1 — Determinism.** The function is pure: identical input ⇒ identical
  output, no I/O or wall-clock/locale dependence.
- **NFR-2 — Monetary precision.** Monetary math SHOULD use a decimal/fixed-point
  type, not binary floating point, to make the shilling rounding exact and
  reproducible. [ASSUMPTION — OI-2]
- **NFR-3 — Scale.** Terms are small (tens to low hundreds of instalments);
  no special performance handling is required.

## 8. Open Items & Assumptions

These were not explicitly ruled on by the stakeholder and are stated as
assumptions so they are visible and cheap to change. None alter the policies in
§3.

- **OI-1 — Rounding tie-break & level.** Assumed **round half up**, applied to
  each component (`interest_due`, `principal_due`) independently. If the
  institution uses banker's rounding (round half to even), or rounds the total
  instalment rather than its components, FR-12 changes. *Needs confirmation.*
- **OI-2 — Numeric type.** Assumed decimal/fixed-point arithmetic internally
  (NFR-2). *Recommendation, not confirmed.*
- **OI-3 — 30/360 variant.** `days_30_360` assumed to be the US 30U/360 rule
  (if `D1 = 31` then `D1 → 30`; if `D2 = 31` and `D1 ∈ {30,31}` then `D2 → 30`).
  For the end-of-month anchors typical here this rarely matters, but the exact
  variant should be confirmed if anchors can land on the 31st. *Needs
  confirmation.*
- **OI-4 — Month-addition at month-end.** `first_period_start + k months` for an
  anchor like the 31st is assumed to roll to the last valid day of the target
  month (e.g. 31 Jan + 1 month → 28/29 Feb). *Needs confirmation if anchors can
  be late-month dates.*
- **OI-5 — Stub transparency.** The stub is folded into instalment #1's
  `interest_due` per PD-5. Recommend *also* surfacing an optional
  `stub_interest` field on row 1 for auditability. Does not change the totals.
  *Optional enhancement.*
- **OI-6 — Currency unit.** "Whole shilling" implies shillings as the minor-unit
  of record; assumed single-currency, no FX. *Confirmed implicitly via PD-4.*


## Auditor verdict

_The spec strongly covers the amortisation and accrual core: it correctly resolves decisions 1,2,3,4,5,7,9,12 (declining balance, equal principal, 30/360, per-period interest, stub-from-disbursement, whole-shilling rounding with residual in the final instalment, zero-balance closing, and validation). It misses or diverges on 6 (treats the shilling as 0-dp rather than KES to 2 dp), 8 (rounds components independently rather than interest-first-principal-as-remainder), 13 (anchors first due on first_period_start + 1 month instead of disbursement + 1 month), and 14 (omits total cost of credit and the actual/365 APR disclosure quirk). Decisions 10 and 11 (Rule-of-78 rebate and fixed-term re-amortisation on prepayment) are entirely out of scope and unaddressed. Coverage = 8/14; the gap concentrates on the bespoke off-default method and disclosure decisions, as the reference anticipated._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | PD-1: 'interest charged on the reducing balance'; FR-3: 'interest as opening_balance × monthly_rate' | Spec explicitly uses declining-balance interest on the reducing principal, matching the reference method. |
| 2 | yes | **yes** | PD-1: 'Equal principal. A fixed principal portion P/n each period; interest charged on the reducing balance; the total instalment therefore declines over the term.' | Exactly the reference: constant P/n principal, declining total instalment, explicitly not EMI. |
| 3 | yes | **yes** | PD-3: '30/360. Every month is treated as exactly 1/12 of a year.' | Day-count convention is stated as 30/360, matching the reference. |
| 4 | yes | **yes** | FR-3: 'Because every period is exactly one month under 30/360, no per-month day scaling is applied to regular interest.' | Interest is computed once per monthly period on opening balance, not daily accrual, matching the reference. |
| 5 | yes | **yes** | PD-5: 'If disbursement_date precedes first_period_start, a partial-period ("stub") interest charge is levied for those extra days.'; FR-8 charges stub on principal | Interest accrues from disbursement with a charged partial-period stub, matching the reference. |
| 6 | yes | no | PD-4: 'rounded to the whole shilling (no cents)'; OI-6: 'shillings as the minor-unit of record' | Reference requires KES to 2 decimal places; the spec never names KES and treats the shilling as the minor unit (0 dp, no cents), contradicting the 2-dp precision. |
| 7 | yes | **yes** | PD-4: 'Each instalment is rounded to the whole shilling (no cents). The accumulated rounding difference is settled in the final instalment.' | Whole-shilling instalments with the accumulated residual absorbed in the final instalment, matching the reference. |
| 8 | yes | no | FR-12 + OI-1: rounding 'applied to each component (interest_due, principal_due) independently'; total_instalment = interest_due + principal_due | Reference requires interest rounded first with principal as the remainder of the rounded instalment; the spec instead rounds both components independently and derives the total from them, a different ordering. |
| 9 | yes | **yes** | PD-4/FR-13: final principal 'chosen so that the final closing_balance is exactly 0' | Final instalment reconciles to a closing balance of exactly zero, matching the reference. |
| 10 | no | no | absent | The spec covers only schedule generation and never addresses early full settlement or any unearned-interest rebate, so Rule of 78 is unaddressed. |
| 11 | no | no | absent | No mention of partial prepayment, principal application, or re-amortisation strategy anywhere in the spec. |
| 12 | yes | **yes** | FR-15: 'reject ... a loan where principal ≤ 0, term_months < 1, annual_rate < 0, or first_period_start < disbursement_date' | Zero/negative principal and zero/invalid term are rejected as errors, matching the reference. |
| 13 | yes | no | PD-7/FR-11: 'Instalment #1 is due first_period_start + 1 month'; worked example: disbursement 2026-01-21 → first due 2026-03-01 | Reference sets the first due date at disbursement + one month; the spec anchors it at first_period_start + one month, which differs whenever a stub exists (example gives Mar 1, not Feb 21). |
| 14 | yes | no | §2.3 lists per-row schedule fields; no mention of 'total cost of credit' or disclosed APR on actual/365 | The per-period schedule shape matches, but the spec omits the total cost of credit and the key regulatory quirk (APR disclosed on actual/365 while accrual uses 30/360), so the resolution is incomplete. |
