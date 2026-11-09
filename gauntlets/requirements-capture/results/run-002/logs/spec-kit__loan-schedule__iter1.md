# spec-kit — loan-schedule — iteration 1

Model (author): claude-opus · Questions asked: 5 · Captured: 9/14 · Bespoke captured: 2/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the interactive prompt didn't go through. Let me lay the questions out in plain text so you can answer directly in your reply. These are the material policy decisions the brief leaves open — each one changes the numbers the engine produces, and none can be safely guessed.

## Round 1 — structural decisions

**Q1. Amortization method** (how each instalment splits into interest vs. principal)
| Option | Meaning |
|--------|---------|
| A | **Equal instalment / annuity (EMI)** — constant total payment; interest portion shrinks, principal grows. Common for retail loans. |
| B | **Equal principal** — same principal each period; interest on declining balance; total payment falls over time. |
| C | **Interest-only + balloon** — instalments pay interest only; full principal repaid at the final instalment. |
| D | **Bullet** — single payment of principal + all accrued interest at maturity. |

**Q2. Periodic rate derivation** (monthly rate from the annual nominal rate)
| Option | Meaning |
|--------|---------|
| A | **Nominal ÷ 12** — simple division; standard for a nominal annual rate compounded monthly. |
| B | **Effective** — monthly rate = (1 + annual)^(1/12) − 1. |

**Q3. Day-count / accrual basis** (how a period's interest is measured)
| Option | Meaning |
|--------|---------|
| A | **Per-period (1/12 year)** — each month = exactly 1/12 year; calendar days ignored for accrual. |
| B | **Actual/365** — balance × annual rate × (actual days ÷ 365). |
| C | **Actual/360** — actual days ÷ 360. |
| D | **30/360** — every month = 30 days, year = 360. |

**Q4. First instalment timing & due-date convention**
| Option | Meaning |
|--------|---------|
| A | **One month after disbursement**, then monthly on the same day-of-month; no grace. |
| B | **Fixed day-of-month** (e.g., the 1st); first due date is the next occurrence → short/long first period. |
| C | **Grace period then monthly** — define the length (e.g., 30/60/90 days). |

I have a **second round** ready (rounding mode & precision, how the rounding residual is reconciled so the balance closes to exactly zero, and odd first-period/stub interest handling), which I'll tailor based on your answers above — for example, the stub-interest question only matters if accrual is calendar-date based.

Please answer Q1–Q4 (e.g., "Q1: A, Q2: A, Q3: A, Q4: A"), and feel free to add any constraints I haven't surfaced.
A: Q1: B — equal principal. Each period carries the same principal slice (P/n); interest is charged on the declining balance; the total instalment falls over the term. Equal-instalment/EMI is explicitly not the method.

Q2: A — nominal ÷ 12. [default, not policy — the key does not address this directly, but 30/360 monthly accrual is standard paired with simple nominal division rather than effective conversion.]

Q3: D — 30/360. Every month is treated as 30 days and the year as 360. Actual/365 is not used for accrual (though it is used for the disclosed APR — but that is a disclosure question, not an accrual question).

Q4: A — one month after disbursement, then monthly on the same day-of-month; no grace period.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Clear — equal-principal with 30/360 accrual, simple nominal/12, first instalment one month after disbursement. Here's the second round.

## Round 2 — rounding, residual, and calendar edge cases

**Q5. Monetary rounding — precision & mode**
| Option | Meaning |
|--------|---------|
| A | **2 decimals, half-up** — round each line's interest/principal to currency minor units (0.01), rounding halves away from zero. |
| B | **2 decimals, banker's (half-even)** — round to 0.01, halves to nearest even. |
| C | **2 decimals, truncate** — drop beyond 0.01 without rounding. |
| D | **Other precision** — e.g., 0-decimal currency, or full-precision (no rounding). Tell me. |

Also: should each period's **interest be computed on the exact declining balance** (full precision) and only the *displayed* figures rounded, or should interest accrue on the **rounded** running balance each period? (I'll default to: interest computed on the exact remaining principal, line items rounded for presentation — say if you want otherwise.)

**Q6. Residual reconciliation** (equal-principal slices of P/n rarely divide evenly, and rounding leaves pennies — how does the balance close to exactly zero?)
| Option | Meaning |
|--------|---------|
| A | **Adjust final instalment** — last period's principal = whatever balance remains, absorbing all accumulated rounding so the ending balance is exactly 0. |
| B | **Front-load residual** — put the odd pennies in the first instalment instead. |
| C | **Distribute** — spread the residual across all instalments as evenly as possible. |

**Q7. Month-end / day-of-month due dates** (e.g., disbursed on the 31st → months with no 31st; or Jan 31 → Feb)
| Option | Meaning |
|--------|---------|
| A | **Last-day-of-month roll** — if the anchor day doesn't exist, use the last day of that month (end-of-month convention). |
| B | **Clamp to nearest valid day** without end-of-month stickiness. |
| C | **Not applicable / don't care** — 30/360 makes accrual identical regardless; due-date labels are cosmetic for this engine. |

Please answer Q5–Q7 (plus the sub-question on exact vs. rounded accrual). Then I'll write the full `spec.md`.
A: Q5: D — whole shilling, no cents. Instalments are rounded to the nearest whole KES (zero decimal places), not to 0.01. On the sub-question: interest is computed and rounded first; principal is then the remainder of the rounded instalment for that period — so principal is derived, not independently rounded.

That is the one clarification I can give this turn. Please apply your own defaults for Q6 and Q7 and proceed to the spec.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as **`spec.md`** in this directory (a copy also lives at `specs/001-repayment-schedule/spec.md` with a quality checklist).

## What I did

My process (spec-kit) treats under-specified policy as something to *ask about*, not guess — and this brief was almost entirely policy. I raised the material decisions in two rounds and encoded your answers:

| Decision | Your answer |
|----------|-------------|
| Amortization | **Equal principal** (constant `P/n` slice, declining instalment — not EMI) |
| Periodic rate | **Nominal ÷ 12** |
| Day-count | **30/360** (accrual date-independent; factor is exactly 1/12) |
| First instalment | **One month after disbursement**, same day-of-month, no grace |
| Precision | **Whole KES**, zero decimals |
| Rounding order | **Interest rounded first; principal = instalment − interest** (derived, not independently rounded) |

Three items you deferred carry **explicitly-flagged defaults** (not silent guesses) for you to confirm: residual reconciliation → absorbed in the **final instalment**; missing day-of-month → **end-of-month roll**; tie-rule → **half-up**.

## One thing worth your eye

Your Q1 ("equal principal, same slice `P/n`") and Q5 ("principal is the remainder of the rounded instalment, derived not independently rounded") pull in slightly different directions. I reconciled them as: **instalment = round(`P/n` + exact interest), then principal = instalment − rounded interest** — so the principal slice stays ~`P/n` but varies by ±1 KES as interest rounding shifts, keeping each row internally consistent (interest + principal = instalment exactly). I documented this interpretation and included a full 12-row worked example (10,000 KES @ 12%, 12 months) as a golden-master fixture. **If you intended the principal slice to be a fixed constant each period with interest as the balancing figure instead, flag it** — that's the one spot where a different reading would change the numbers.

The spec contains: prioritized user stories with acceptance scenarios, 14 functional requirements, edge cases, key entities, measurable success criteria, and the assumptions/out-of-scope list. Ready for `/speckit-plan` whenever you want to proceed.
A: I've answered the 5 clarifying question(s) your process is allotted; I can't take more. Please finalise the specification now — use your process's own defaults or reasonable assumptions for anything still open — save it as spec.md, and tell me when it's done.

## Produced specification

# Feature Specification: Repayment Schedule Engine

**Feature Branch**: `001-repayment-schedule`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "Build a repayment schedule engine for a loan product. Given a disbursed loan (principal, annual nominal interest rate, term in monthly instalments, disbursement date), produce the full repayment schedule: for each instalment, the interest and principal due, and the running balance. Implement `generate_schedule(loan)`."

---

## Overview

Given a disbursed loan, the engine produces the complete repayment schedule as an ordered list of instalments. Each schedule row states the due date, the interest due, the principal due, the total instalment, and the running (closing) balance after the instalment is applied. The final row must leave a running balance of exactly zero.

All monetary policy choices below were confirmed with the product stakeholder; they are not inferred defaults unless explicitly marked as an **[ASSUMPTION]**.

### Confirmed loan policy (stakeholder decisions)

| Decision | Policy | Source |
|----------|--------|--------|
| Amortization method | **Equal principal.** Each period repays a constant principal slice `P / n`; interest is charged on the declining balance; the total instalment falls over the term. (Equal-instalment/EMI is explicitly **not** used.) | Stakeholder Q1 |
| Periodic rate | **Simple nominal division.** Monthly rate `r = annual_nominal_rate / 12`. No effective-rate conversion. | Stakeholder Q2 |
| Day-count / accrual basis | **30/360.** Every month is treated as 30 days and the year as 360 days. Combined with `r = annual/12`, every period's accrual factor is exactly `1/12`, so interest for a period is `opening_balance × annual_nominal_rate / 12`, independent of actual calendar days. (Actual/365 may apply to a disclosed APR, but APR disclosure is out of scope for this engine.) | Stakeholder Q3 |
| First instalment timing | **One month after disbursement**, then monthly on the same day-of-month. **No grace period.** | Stakeholder Q4 |
| Monetary precision | **Whole shillings (KES), zero decimal places.** Instalments are rounded to the nearest whole KES, never to 0.01. | Stakeholder Q5 |
| Rounding order within a period | **Interest first, principal derived.** Interest is computed and rounded to whole KES first; the principal portion is the remainder of the (rounded) instalment for that period. Principal is therefore **derived, not independently rounded**. | Stakeholder Q5 |
| Residual reconciliation | **[ASSUMPTION — stakeholder deferred]** Adjust the **final instalment**: the last period repays the entire remaining balance so the running balance closes to exactly zero, absorbing all accumulated rounding. | Default applied (Q6) |
| Due-date calendar roll | **[ASSUMPTION — stakeholder deferred]** Last-day-of-month roll (end-of-month convention) when the anchor day does not exist in a month. Affects due-date labels only; with 30/360 accrual it never changes amounts. | Default applied (Q7) |
| Rounding tie-rule | **[ASSUMPTION]** Round half away from zero (half-up) for the whole-KES rounding. Stakeholder specified whole-shilling precision but not the tie-rule. | Default applied |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a correct equal-principal schedule (Priority: P1)

As a loan servicing system, when a loan is disbursed I need the full repayment schedule so that the borrower can be billed the correct interest and principal each month and the loan is fully repaid by the final instalment.

**Why this priority**: This is the entire purpose of the engine. Without a correct schedule there is nothing to bill, reconcile, or report. It is the MVP.

**Independent Test**: Call `generate_schedule(loan)` with a fully specified loan and verify that (a) there are exactly `n` instalments, (b) each row's interest equals the opening balance times `annual/12` rounded to whole KES, (c) each principal equals that row's instalment minus its interest, (d) the running balance declines monotonically, and (e) the final running balance is exactly zero.

**Acceptance Scenarios**:

1. **Given** a loan of principal 10,000 KES, annual nominal rate 12%, term 12 months, disbursed 2026-01-15, **When** `generate_schedule(loan)` is called, **Then** the schedule has 12 rows, the first interest is 100 KES (10,000 × 1%), the first principal is 833 KES (933 − 100), the first closing balance is 9,167 KES, and the 12th row closes the balance to exactly 0.
2. **Given** any valid loan, **When** the schedule is generated, **Then** for every row `interest + principal = instalment` exactly (in whole KES) and `closing_balance = previous_balance − principal`.
3. **Given** any valid loan, **When** the schedule is generated, **Then** the sum of all principal amounts equals the original principal exactly, and the final row's closing balance is exactly 0.
4. **Given** a loan where `principal / n` is not a whole number, **When** the schedule is generated, **Then** the per-period principal varies by at most 1 KES around `principal / n` and the final instalment absorbs the accumulated rounding residual.

---

### User Story 2 - Correct due dates for each instalment (Priority: P2)

As a billing system, I need each instalment dated correctly so that statements and arrears calculations line up with the borrower's billing cycle.

**Why this priority**: Amounts are the core; dating is required for billing but does not change the monetary computation under 30/360.

**Independent Test**: Generate a schedule and verify the first due date is exactly one month after disbursement and each subsequent due date advances by one calendar month on the same day-of-month (with end-of-month roll where needed).

**Acceptance Scenarios**:

1. **Given** a loan disbursed 2026-01-15 with term 3, **When** the schedule is generated, **Then** the due dates are 2026-02-15, 2026-03-15, 2026-04-15.
2. **Given** a loan disbursed 2026-01-31 with term 3, **When** the schedule is generated, **Then** the due dates roll to the last day of each month: 2026-02-28, 2026-03-31, 2026-04-30.
3. **Given** two loans identical except for disbursement day-of-month, **When** both schedules are generated, **Then** the interest and principal amounts are identical row-for-row (30/360 accrual is date-independent); only the due-date labels differ.

---

### User Story 3 - Reject or clearly handle invalid loans (Priority: P3)

As an operator, I need the engine to reject malformed loan inputs rather than silently produce a wrong schedule.

**Why this priority**: Protects data integrity but is secondary to producing correct schedules for valid loans.

**Independent Test**: Supply each invalid input in turn and verify the engine refuses with a clear, specific error rather than returning a schedule.

**Acceptance Scenarios**:

1. **Given** a loan with term `n = 0` or negative, **When** `generate_schedule(loan)` is called, **Then** the engine rejects it with a validation error.
2. **Given** a loan with principal ≤ 0, **When** called, **Then** the engine rejects it.
3. **Given** a loan with a negative annual rate, **When** called, **Then** the engine rejects it.

---

### Edge Cases

- **Zero interest rate (0%)**: Every period's interest is 0; each instalment is the principal slice only; the schedule still closes to zero with the final-instalment residual rule.
- **Term of 1 month (`n = 1`)**: A single instalment repays the full principal plus one month's interest; closing balance 0.
- **`principal / n` not whole** (e.g., 10,000 / 12): principal slices vary by ±1 KES; final instalment absorbs the residual (see Scenario 1.4).
- **Rounding accumulation**: The sum of independently rounded interest amounts, plus derived principals, must still net to the exact original principal because the final instalment is forced to the remaining balance.
- **Disbursement on the 29th/30th/31st**: due dates use end-of-month roll; amounts unchanged.
- **Very small principal** (e.g., smaller than `n` KES): some periods may have principal of 0 or 1 KES after rounding; the balance must still reach exactly 0 by the final instalment.
- **Leap-year February**: 30/360 ignores actual day counts, so interest is unaffected; a 2026-01-31 disbursement in a leap year would date to Feb 29 if applicable (end-of-month roll).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The engine MUST expose `generate_schedule(loan)` that accepts a loan (principal, annual nominal interest rate, term in whole monthly instalments, disbursement date) and returns an ordered list of instalment rows.
- **FR-002**: The engine MUST produce exactly `n` instalment rows, where `n` is the loan term in months.
- **FR-003**: The engine MUST use the **equal-principal** method: the nominal principal slice per period is `principal / n`; it MUST NOT use equal-instalment/EMI amortization.
- **FR-004**: For each period `t` (1…n), the engine MUST compute interest on the **opening balance** of that period as `interest_t = round_whole(opening_balance_t × annual_nominal_rate / 12)`, using whole-KES rounding (half-up).
- **FR-005**: For each period `t`, the engine MUST compute the instalment total as `instalment_t = round_whole(principal / n + exact_interest_t)` and derive the principal as `principal_t = instalment_t − interest_t`. Principal MUST NOT be rounded independently; it is the remainder of the rounded instalment after the rounded interest is removed.
- **FR-006**: For each period `t`, the engine MUST compute the closing/running balance as `closing_balance_t = opening_balance_t − principal_t`, where `opening_balance_1 = principal` and `opening_balance_{t+1} = closing_balance_t`.
- **FR-007**: The engine MUST ensure the final row's closing balance is exactly 0. The **final instalment** MUST repay the entire remaining balance (final principal = remaining opening balance), absorbing all accumulated rounding residual; the final instalment total is that principal plus the final period's rounded interest.
- **FR-008**: The sum of all `principal_t` across the schedule MUST equal the original principal exactly.
- **FR-009**: All monetary outputs (interest, principal, instalment, balance) MUST be whole KES amounts (zero decimal places).
- **FR-010**: The engine MUST set the first instalment's due date to exactly one month after the disbursement date, with each subsequent due date advancing one calendar month on the same day-of-month. There is no grace period.
- **FR-011**: When the anchor day-of-month does not exist in a target month, the engine MUST roll the due date to the last day of that month (end-of-month convention). Date rolling MUST NOT alter any monetary amount (30/360 accrual is calendar-independent).
- **FR-012**: Each returned instalment row MUST contain, at minimum: the instalment number, the due date, the interest due, the principal due, the total instalment, and the closing (running) balance.
- **FR-013**: The engine MUST reject invalid inputs with a clear, specific error rather than returning a schedule. Invalid inputs include: term ≤ 0, principal ≤ 0, and negative annual rate.
- **FR-014**: The engine MUST handle a 0% annual rate correctly (all interest zero) and a 1-month term correctly (single instalment repays principal plus one month's interest, closing to zero).

### Key Entities

- **Loan (input)**: The disbursed loan. Attributes: `principal` (positive whole KES amount), `annual_nominal_rate` (non-negative, e.g., 0.12 for 12%), `term` (`n`, positive whole number of monthly instalments), `disbursement_date` (calendar date).
- **Instalment Row (output)**: One scheduled payment. Attributes: `number` (1…n), `due_date`, `interest` (whole KES), `principal` (whole KES), `instalment` (whole KES, = interest + principal), `closing_balance` (whole KES, running balance after this payment).
- **Schedule (output)**: The ordered collection of `n` Instalment Rows returned by `generate_schedule(loan)`.

---

## Worked Example (reference for test fixtures)

Loan: principal 10,000 KES, annual nominal 12% (monthly 1%), term 12, disbursed 2026-01-15. Principal slice = 10,000 / 12 = 833.33…

| # | Due date | Opening balance | Interest | Instalment | Principal | Closing balance |
|---|----------|-----------------|----------|------------|-----------|-----------------|
| 1 | 2026-02-15 | 10,000 | 100 | 933 | 833 | 9,167 |
| 2 | 2026-03-15 | 9,167 | 92 | 925 | 833 | 8,334 |
| 3 | 2026-04-15 | 8,334 | 83 | 917 | 834 | 7,500 |
| 4 | 2026-05-15 | 7,500 | 75 | 908 | 833 | 6,667 |
| 5 | 2026-06-15 | 6,667 | 67 | 900 | 833 | 5,834 |
| 6 | 2026-07-15 | 5,834 | 58 | 892 | 834 | 5,000 |
| 7 | 2026-08-15 | 5,000 | 50 | 883 | 833 | 4,167 |
| 8 | 2026-09-15 | 4,167 | 42 | 875 | 833 | 3,334 |
| 9 | 2026-10-15 | 3,334 | 33 | 867 | 834 | 2,500 |
| 10 | 2026-11-15 | 2,500 | 25 | 858 | 833 | 1,667 |
| 11 | 2026-12-15 | 1,667 | 17 | 850 | 833 | 834 |
| 12 | 2027-01-15 | 834 | 8 | 842 | 834 | 0 |

Notes: interest each period = round(opening × 1%); instalment = round(833.33 + exact interest); principal = instalment − interest. Sum of principal = 10,000. The final instalment's principal (834) equals the remaining balance, closing to exactly 0.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of valid loans, the final instalment's running balance is exactly 0.
- **SC-002**: For 100% of valid loans, the sum of principal amounts equals the original principal exactly, and `interest + principal = instalment` holds for every row.
- **SC-003**: For 100% of valid loans, each row's interest equals the opening balance × (annual rate / 12) rounded to whole KES, and each principal is the derived remainder of the rounded instalment.
- **SC-004**: Two loans differing only in disbursement day-of-month produce row-for-row identical monetary amounts (date-independence of 30/360 accrual), with only due-date labels differing.
- **SC-005**: 100% of invalid loans (term ≤ 0, principal ≤ 0, negative rate) are rejected with a specific error and never return a schedule.
- **SC-006**: The worked example above reproduces exactly, row for row, when used as a golden-master test fixture.

---

## Assumptions

- **[Stakeholder-deferred] Residual reconciliation**: The final instalment absorbs all accumulated rounding so the balance closes to exactly zero (chosen over front-loading or distributing the residual). Confirm if a different reconciliation is required.
- **[Stakeholder-deferred] Due-date calendar roll**: End-of-month (last-day) roll when the anchor day is absent. Confirm if clamp-without-stickiness is preferred.
- **[Assumption] Rounding tie-rule**: Half-up (round half away from zero) for whole-KES rounding. Confirm if banker's rounding (half-even) is required.
- **[Assumption] Currency**: Kenyan Shilling (KES), whole units, as implied by "whole shilling." No multi-currency or minor-unit handling.
- **[Assumption] Interest on exact declining balance**: Because principal and interest are whole KES each period, the running balance is always an integer; interest is computed on that integer opening balance and rounded. There is no separate full-precision shadow balance.
- **[Assumption] Output shape**: `generate_schedule(loan)` returns an ordered collection of instalment rows; the row data model (FR-012) is the contract. Serialization format (object list, table, etc.) is an implementation choice.
- **[Assumption] Input types**: Principal and term are provided as whole numbers; the annual nominal rate is provided as a decimal fraction (0.12 = 12%). Validation per FR-013.
- **Out of scope**: APR/EAR disclosure calculations (which the stakeholder noted may use Actual/365), fees, insurance, taxes, prepayments, arrears/penalty interest, payment reallocation, and schedule re-amortization after disbursement.


## Auditor verdict

_The spec matches 9 of 14 reference decisions (coverage 9/14 ≈ 0.64): correct on interest method (1), equal-principal amortisation (2), 30/360 (3), per-period interest calc (4), instalment rounding to whole shilling with final-instalment residual (7), interest-first rounding order (8), zero closing balance (9), reject invalid inputs (12), and first due date (13). It misses on: #5 (no stub/partial-period interest for disbursement preceding the first period), #6 (states zero decimal places vs the reference's 2dp currency precision), #10 and #11 (early-settlement Rule-of-78 rebate and partial-prepayment re-amortisation both excluded as out of scope), and #14 (omits total cost of credit and the actual/365 APR disclosure, declaring APR out of scope, and does not require opening balance in the row). The gap concentrates on the bespoke, non-inferable method and disclosure decisions (5, 10, 11, 14) plus the precision value (6)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "interest is charged on the declining balance" (Confirmed loan policy, Amortization row); FR-004 computes interest on the opening (reducing) balance. | The spec explicitly charges interest on the declining/reducing principal, matching declining-balance method. |
| 2 | yes | **yes** | "Equal principal. Each period repays a constant principal slice `P / n`; interest is charged on the declining balance; the total instalment falls over the term. (Equal-instalment/EMI is explicitly not used.)" | Exact match: constant principal P/n, interest on reducing balance, decreasing instalment, EMI explicitly rejected. |
| 3 | yes | **yes** | "30/360. Every month is treated as 30 days and the year as 360 days." (Day-count row, FR-004) | Matches 30/360 convention exactly, not actual/365. |
| 4 | yes | **yes** | "interest for a period is `opening_balance × annual_nominal_rate / 12`, independent of actual calendar days" (Day-count row); FR-004 computes interest once per period. | Interest is computed once per monthly repayment period (factor 1/12), not by daily accrual, matching 'same as repayment period'. |
| 5 | yes | no | FR-010: "first instalment's due date to exactly one month after the disbursement date... No grace period." No mention of stub/partial-period interest. | The spec fixes the first period at exactly one month and never models a stub charge for days between disbursement and first period start; partial-period interest is not addressed, so the bespoke stub rule is not matched. |
| 6 | yes | no | "Whole shillings (KES), zero decimal places. Instalments are rounded to the nearest whole KES, never to 0.01." (Monetary precision row) | Currency (KES) matches, but the reference sets precision at 2 decimal places whereas the spec explicitly states zero decimal places; under strict literal matching the precision value differs. |
| 7 | yes | **yes** | "Instalments are rounded to the nearest whole KES"; FR-007: "The final instalment MUST repay the entire remaining balance... absorbing all accumulated rounding residual." | Instalments rounded to whole shilling and the accumulated rounding difference settled in the final instalment, matching exactly. |
| 8 | yes | **yes** | FR-005: "Interest is computed and rounded to whole KES first; the principal portion is the remainder of the (rounded) instalment... Principal MUST NOT be rounded independently." | Interest rounded first, principal derived as the remainder, matching the ordering rule exactly. |
| 9 | yes | **yes** | FR-007: "The engine MUST ensure the final row's closing balance is exactly 0."; SC-001. | Final instalment reconciles the closing balance to exactly zero, matching. |
| 10 | no | no | "Out of scope: ...prepayments" (Assumptions). No mention of early-settlement rebate or Rule of 78. | Early full-settlement rebate is not surfaced as a decision; prepayments are blanket-excluded and the Rule-of-78 policy is absent. |
| 11 | no | no | "Out of scope: ...prepayments... schedule re-amortization after disbursement" (Assumptions). | Partial prepayment handling (principal-first, re-amortise keeping term fixed) is explicitly out of scope and never resolved. |
| 12 | yes | **yes** | FR-013: "reject invalid inputs... Invalid inputs include: term ≤ 0, principal ≤ 0, and negative annual rate." | Zero/negative principal and term are rejected as invalid, matching the reject rule. |
| 13 | yes | **yes** | FR-010: "first instalment's due date to exactly one month after the disbursement date, with each subsequent due date advancing one calendar month." | First due date = disbursement + one month with monthly instalments thereafter, matching exactly. |
| 14 | yes | no | FR-012 row fields: "instalment number, the due date, the interest due, the principal due, the total instalment, and the closing (running) balance." APR: "APR disclosure is out of scope for this engine"; "Out of scope: APR/EAR disclosure calculations (which the stakeholder noted may use Actual/365)." | Full per-period schedule is provided, but opening balance is not a required row field, the total cost of credit (sum of interest) is not output, and the disclosed APR on an actual/365 basis is explicitly out of scope rather than produced, so the required output/disclosure shape is not matched. |
