# spec-kit — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 5 · Captured: 8/14 · Bespoke captured: 2/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: My apologies — let me put these to you directly in text so you can answer inline. These are the decisions in the brief that materially change the computed numbers and that I shouldn't guess at. I've suggested a default for each (marked ★) but need your confirmation since this institution has its own policy.

## Q1: Amortization method

How should each instalment be split into interest and principal?

| Option | Answer | Implications |
|--------|--------|--------------|
| A ★ | Equal instalment (annuity / "French") | Fixed total payment each period; interest declines, principal grows. Most common for term loans. |
| B | Equal principal (straight-line) | Fixed principal each period; total payment declines over time. |
| C | Interest-only + balloon | Only interest each period; full principal repaid in the final instalment. |

## Q2: Periodic interest rate derivation

| Option | Answer | Implications |
|--------|--------|--------------|
| A ★ | Nominal ÷ 12 | Monthly rate = annual nominal / 12 (simple proportional). Conventional reading of "nominal". |
| B | Effective compounded | Monthly rate = (1 + annual)^(1/12) − 1. |

## Q3: Day-count / accrual basis

| Option | Answer | Implications |
|--------|--------|--------------|
| A ★ | 30/360 (flat periodic) | Each period accrues exactly periodic-rate × balance; calendar dates don't affect interest. |
| B | Actual/365 | Interest = balance × annual × actual-days/365; real period length matters. |
| C | Actual/360 | Interest = balance × annual × actual-days/360. |

## Q4: First instalment due date

| Option | Answer | Implications |
|--------|--------|--------------|
| A ★ | One month after disbursement | First due exactly one calendar month later, same day-of-month; clean monthly periods, no stub. |
| B | Fixed billing day | Instalments on a fixed day (e.g. the 1st); first period may be a short/long stub. |

## Q5: Odd / stub first-period interest (only matters if Q4=B or Q3=actual)

| Option | Answer | Implications |
|--------|--------|--------------|
| A ★ | No stub — always clean monthly periods | Consistent with Q4=A; no pro-rating. |
| B | Pro-rate interest for the odd days in the first period | Short/long first period accrues interest for its actual days. |

## Q6: Rounding policy

| Option | Answer | Implications |
|--------|--------|--------------|
| A ★ | Round to 2 decimals (minor unit), half-up; adjust the **final** instalment's principal so the closing balance is exactly zero | Standard; absorbs accumulated rounding residue at the end. |
| B | Round half-even (banker's), residual in final instalment | Reduces cumulative bias; same end-balance reconciliation. |
| C | No rounding — carry full precision | Schedule values are exact reals; no reconciliation needed. |

## Q7: Currency / minor unit (only if Q6 = A or B)

| Option | Answer | Implications |
|--------|--------|--------------|
| A ★ | 2 decimal places (e.g. USD/EUR cents) | Rounding granularity = 0.01. |
| B | 0 decimal places (e.g. JPY) | Rounding granularity = 1. |
| C | Other | Specify the minor unit. |

You can answer compactly, e.g. **"Q1: A, Q2: A, Q3: B, Q4: B, Q5: B, Q6: A, Q7: A"**, and note any custom values. Once I have these I'll write the complete spec and save it as `spec.md`.
A: Q1: **B** — equal principal. Fixed principal slice each period (P/n); interest on the reducing balance; total instalment decreases over the term.

Q2: **A** — nominal ÷ 12. [default, not policy — the key does not address this explicitly, but it is consistent with the 30/360 accrual basis.]

Q3: **A** — 30/360. Each month counts as 30 days, the year as 360; calendar dates do not affect interest.

Q4: **A** — disbursement date + one month. First due exactly one calendar month after disbursement; subsequent instalments monthly thereafter.

Q5: **B** — pro-rate the stub. If disbursement precedes the first period start, a stub interest charge is levied for those extra days. Partial-period interest is charged.

That is 5 questions, which is my limit for this turn. Please apply your own defaults for Q6 and Q7 and proceed to draft the spec.

### Round 2
_Step reasoning:_ (live agent turn)

Q: The specification is **done**. It's saved as `spec.md` in this directory (and mirrored into the SpecKit feature folder).

## What I produced

- **`spec.md`** — the complete requirements specification
- `specs/001-repayment-schedule/spec.md` — SpecKit copy
- `specs/001-repayment-schedule/checklists/requirements.md` — quality checklist (all items pass)
- `.specify/feature.json` — feature pointer for downstream SpecKit steps

## How I handled the underspecification

The brief named only the domain and interface. The policy decisions that actually determine the numbers are not inferable — several standard conventions exist and each institution picks one — so I asked you rather than guessing. Your answers are locked into the spec's **Clarifications** table:

| Decision | Your policy |
|----------|-------------|
| Amortization | **Equal principal** (declining instalments) |
| Periodic rate | **Nominal ÷ 12** |
| Day-count | **30/360** |
| First due date | **Disbursement + 1 month** |
| Stub period | **Pro-rate partial-period interest** |

The two you delegated (rounding → half-up to 2dp with the final instalment absorbing residue; minor unit → 0.01) are documented as defaults.

## Two things I flagged rather than silently assumed

1. **30/360 variant** — I defaulted to 30/360 US (NASD/Bond). The European and ISDA variants give different stub day counts on some end-of-month dates. Listed in Assumptions for your confirmation.
2. **Due-date roll convention** — last-day-of-month clamping when the anchor day is absent (e.g. the 31st in February). Also flagged.

The spec includes 16 testable functional requirements, 3 prioritized user stories, edge cases (0% rate, single instalment, uneven division, end-of-month stubs), 7 measurable success criteria, and a fully worked 12-row reference schedule in Appendix A.

Next SpecKit step when you're ready: `/speckit-plan` (or `/speckit-clarify` if you want to resolve the two flagged items first).
A: I've answered the 5 clarifying question(s) your process is allotted; I can't take more. Please finalise the specification now — use your process's own defaults or reasonable assumptions for anything still open — save it as spec.md, and tell me when it's done.

## Produced specification

# Feature Specification: Repayment Schedule Engine

**Feature Branch**: `001-repayment-schedule`

**Created**: 2026-11-08

**Status**: Draft (policy decisions resolved with stakeholder)

**Input**: User description: "Repayment schedule engine for a loan product. Given a disbursed loan (principal, annual nominal interest rate, term in monthly instalments, disbursement date), produce the full repayment schedule: for each instalment, the interest due, the principal due, and the running balance. Build a function `generate_schedule(loan)` that returns the schedule."

## Overview

Given a disbursed loan, produce the complete repayment schedule: one row per instalment
listing the interest due, the principal due, and the running (closing) balance, such that the
balance is fully repaid by the final instalment.

The computation policy below was **not** inferrable from the brief; each decision was confirmed
with the product stakeholder (see [Clarifications](#clarifications)). The engine implements
**equal-principal (straight-line) amortization** on a **30/360** interest basis.

## Clarifications

Resolved with the stakeholder on 2026-11-08:

| # | Decision | Chosen policy |
|---|----------|---------------|
| Q1 | Amortization method | **Equal principal** — a fixed principal slice each period; interest on the reducing balance; total instalment declines over the term. |
| Q2 | Periodic rate derivation | **Nominal ÷ 12** — monthly rate = annual nominal rate / 12. |
| Q3 | Day-count / accrual basis | **30/360** — each whole month = 30 days, the year = 360 days; calendar dates do not affect interest for whole periods. |
| Q4 | First instalment due date | **Disbursement date + one calendar month**; every subsequent instalment one calendar month thereafter. |
| Q5 | Odd / stub first period | **Pro-rate the stub** — if the first period is not a whole 30/360 month, partial-period interest is charged for the actual (30/360) days. |
| Q6 | Rounding policy | **Round to the currency minor unit, half-up**; the final instalment absorbs the accumulated rounding residue so the closing balance is exactly zero. *(Stakeholder-delegated default.)* |
| Q7 | Currency minor unit | **2 decimal places** (granularity 0.01). *(Stakeholder-delegated default.)* |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a full repayment schedule for a standard loan (Priority: P1)

A loan servicing operator (or a downstream system) has a disbursed loan and needs the complete
instalment-by-instalment breakdown so borrowers can be billed and the account can be tracked.

**Why this priority**: This is the core deliverable. Without it there is no schedule, no billing,
and no balance tracking. It is the MVP in its entirety.

**Independent Test**: Call `generate_schedule(loan)` with a standard loan (principal divisible by
term, disbursement on a mid-month day) and confirm the returned schedule has one row per
instalment, each with interest due, principal due, and closing balance, with the final closing
balance exactly zero.

**Acceptance Scenarios**:

1. **Given** a loan of principal 12,000.00 at 12% annual nominal over 12 monthly instalments
   disbursed 2026-01-15, **When** `generate_schedule(loan)` is called, **Then** it returns 12
   rows; the principal due is 1,000.00 in every row; interest due is 120.00 in row 1 and declines
   each row; and the closing balance is 0.00 in row 12.
2. **Given** the same loan, **When** the schedule is inspected, **Then** each row's total payment
   equals interest due + principal due, and each row's closing balance equals the previous
   closing balance (or principal, for row 1) minus that row's principal due.
3. **Given** the same loan, **When** the schedule is summed, **Then** the total principal due
   across all rows equals exactly the loan principal (12,000.00).

### User Story 2 - Correct interest when principal does not divide evenly (Priority: P2)

Operators must be able to schedule loans whose principal is not an exact multiple of the term
without the balance drifting or ending at a non-zero figure.

**Why this priority**: Most real principals do not divide evenly by the term; a schedule that
leaves a residual balance or over-collects is incorrect and non-shippable, but it builds on P1.

**Independent Test**: Schedule a loan where principal / term is not an exact minor-unit amount
and confirm the principal slices sum exactly to the principal and the closing balance is 0.00.

**Acceptance Scenarios**:

1. **Given** principal 10,000.00 over 3 instalments, **When** scheduled, **Then** principal due
   is 3,333.33 in rows 1-2 and 3,333.34 in row 3 (the final row absorbs the 0.01 residue), and
   the closing balance is 0.00.
2. **Given** any loan, **When** the schedule is produced, **Then** the sum of all principal-due
   values equals the loan principal to the minor unit, with no residual balance.

### User Story 3 - Correct interest for a stub first period (Priority: P3)

When the first period is not a whole month (an end-of-month disbursement under 30/360), the
first instalment's interest must reflect only the days actually elapsed.

**Why this priority**: Affects a minority of disbursement dates (end-of-month edge cases) but is
required for interest accuracy and regulatory correctness; it refines P1 rather than replacing it.

**Independent Test**: Schedule a loan disbursed on the 31st and confirm the first instalment's
interest is pro-rated for the 30/360 day count of the stub period, while later periods charge a
full month.

**Acceptance Scenarios**:

1. **Given** principal 12,000.00 at 12% over 12 instalments disbursed 2026-01-31 with first due
   2026-02-28, **When** scheduled, **Then** the 30/360 day count of period 1 is 28 days and
   interest due in row 1 is 112.00 (= 12,000.00 × 12% × 28/360), while a full whole-month period
   on the same balance would be 120.00.
2. **Given** a loan disbursed on a day of month 1-28, **When** scheduled, **Then** every period
   including the first is a whole 30/360 month and no stub pro-rating is applied.

### Edge Cases

- **Zero interest rate (0%)**: interest due is 0.00 in every row; instalments are pure principal;
  closing balance reaches 0.00 at the final row.
- **Single instalment (term = 1)**: one row repaying the full principal plus one period's interest.
- **Principal not divisible by term**: rounding residue is carried and absorbed by the final
  instalment's principal (User Story 2).
- **End-of-month / short-month disbursement (29th, 30th, 31st)**: due dates and the stub day count
  follow the 30/360 convention and the one-calendar-month due-date rule (User Story 3).
- **Final-row reconciliation**: regardless of rounding, the final row's principal due is set to the
  outstanding balance so the closing balance is exactly 0.00.
- **Invalid inputs** (non-positive principal, negative rate, term < 1, missing disbursement date):
  rejected with a clear error; no partial schedule is returned.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose `generate_schedule(loan)` that accepts a loan with principal,
  annual nominal interest rate, term (number of monthly instalments), and disbursement date, and
  returns an ordered schedule of instalment rows.
- **FR-002**: The schedule MUST contain exactly one row per instalment, ordered from instalment 1
  to instalment N (N = term), each identified by an instalment number.
- **FR-003**: Each row MUST include: the due date, the opening balance, the interest due, the
  principal due, the total payment (interest due + principal due), and the closing (running)
  balance after that instalment.
- **FR-004**: The system MUST use **equal-principal amortization**: the base principal slice is the
  loan principal divided by the term, rounded to the minor unit, and applied identically to every
  instalment except the final one.
- **FR-005**: The final instalment's principal due MUST equal the outstanding balance immediately
  before it, so that the sum of all principal-due values equals the loan principal exactly and the
  final closing balance is exactly 0.00.
- **FR-006**: The monthly periodic interest rate MUST be the annual nominal rate divided by 12.
- **FR-007**: Interest for a **whole** period MUST be the opening balance × (annual nominal rate /
  12), equivalently opening balance × annual rate × 30/360.
- **FR-008**: Interest MUST be computed on a **30/360** day-count basis: each whole month counts as
  30 days and the year as 360 days.
- **FR-009**: The first instalment's due date MUST be exactly one calendar month after the
  disbursement date, and each subsequent due date exactly one calendar month after the previous.
- **FR-010**: Calendar-month arithmetic for due dates MUST clamp to the last valid day of the
  target month when the disbursement day does not exist in that month (e.g. the 31st in February
  resolves to Feb 28/29).
- **FR-011**: When the first period is not a whole 30/360 month (a **stub**), the first instalment's
  interest MUST be pro-rated as opening balance × annual nominal rate × (30/360 day count of the
  stub ÷ 360). When the first period is a whole month, this reduces to the FR-007 amount.
- **FR-012**: All monetary outputs (interest due, principal due, total payment, balances) MUST be
  rounded to the currency minor unit (2 decimal places) using half-up rounding.
- **FR-013**: The closing balance of each row MUST equal that row's opening balance minus that
  row's principal due; the opening balance of row 1 MUST equal the loan principal; and the opening
  balance of each later row MUST equal the previous row's closing balance.
- **FR-014**: A 0% interest rate MUST produce 0.00 interest in every row and a schedule of
  principal-only instalments.
- **FR-015**: The system MUST reject invalid loans (principal ≤ 0, annual rate < 0, term < 1, or
  missing/invalid disbursement date) with a clear error and MUST NOT return a partial schedule.
- **FR-016**: The engine MUST be deterministic: the same loan input always yields the same schedule.

### Key Entities *(include if feature involves data)*

- **Loan** (input): the disbursed loan.
  - *principal* — original disbursed amount (positive monetary value).
  - *annual nominal interest rate* — annual rate as a decimal fraction (e.g. 0.12 for 12%); ≥ 0.
  - *term* — number of monthly instalments (positive integer, N).
  - *disbursement date* — the date funds were disbursed; interest accrues from this date.
- **Schedule** (output): an ordered collection of Instalment rows, length N.
- **Instalment** (output row):
  - *instalment number* — 1-based sequence position.
  - *due date* — date the instalment is payable.
  - *opening balance* — outstanding principal before this instalment.
  - *interest due* — interest charged for this period.
  - *principal due* — principal repaid in this instalment.
  - *total payment* — interest due + principal due.
  - *closing balance* — outstanding principal after this instalment (the running balance).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every valid loan, the sum of principal due across all instalments equals the
  loan principal exactly (to the minor unit), and the final closing balance is 0.00 — verified
  across a test matrix of principals, rates, terms, and disbursement dates with 100% pass rate.
- **SC-002**: For the reference loan (12,000.00; 12%; 12 instalments; disbursed 2026-01-15), the
  schedule matches the worked example in [Appendix A](#appendix-a--worked-reference-schedule)
  exactly, row for row.
- **SC-003**: Every row satisfies total payment = interest due + principal due and closing balance
  = opening balance − principal due, with no row drifting from the running balance.
- **SC-004**: With equal-principal amortization, each instalment's total payment is less than or
  equal to the previous instalment's (strictly decreasing whenever the rate is above 0%).
- **SC-005**: For an end-of-month disbursement producing a stub, the first instalment's interest
  equals the 30/360 pro-rated amount and all later whole periods charge a full month.
- **SC-006**: Invalid loans are rejected 100% of the time with no partial schedule returned.
- **SC-007**: The schedule contains exactly `term` rows for every valid loan.

## Assumptions

- **Equal-principal, not annuity.** Per Q1, the principal slice is constant and the total
  instalment declines; this is deliberately different from a fixed-payment (annuity) loan.
- **30/360 variant.** A specific 30/360 variant was required to make stub day counts precise. The
  **30/360 US (NASD / Bond-basis)** convention is assumed: if the disbursement day is the 31st it
  is treated as the 30th; if the due day is the 31st and the disbursement day is the 30th or 31st,
  the due day is treated as the 30th. **Confirm** this is the institution's variant; 30E/360
  (European) and 30E/360 (ISDA) would yield different stub day counts for some end-of-month dates.
- **Interest accrues from the disbursement date**, and the first period spans the disbursement date
  to the first due date; its length (and thus any stub) is measured on the chosen 30/360 basis.
- **Due-date clamping (FR-010)** uses last-day-of-month when the anchor day is absent; confirm if a
  different roll convention (e.g. roll forward to the 1st, or "modified following") is preferred.
- **Rounding (Q6/Q7, stakeholder-delegated):** half-up to 2 decimal places; interest is rounded per
  period; the base principal slice is rounded; the final instalment absorbs all accumulated residue.
  Confirm if a different minor unit (e.g. 0 decimals for JPY) or rounding mode (half-even) applies.
- **Single currency / no fees.** The engine schedules principal and interest only. Fees, insurance,
  taxes, late charges, early settlement, and payment holidays are out of scope for this version.
- **No mid-schedule rate changes.** The annual nominal rate is fixed for the life of the loan
  (fixed-rate product); variable-rate reprojection is out of scope.
- **Dates are calendar dates** with no holiday/business-day adjustment of due dates.

## Out of Scope

- Annuity (equal-instalment) or interest-only/balloon amortization.
- Variable or tiered interest rates; rate resets.
- Fees, insurance, taxes, penalties, or late-payment interest.
- Early repayment, overpayment, restructuring, payment holidays, or arrears handling.
- Business-day / holiday calendar adjustment of due dates.
- Persistence, APIs, UI, or currency conversion.

## Appendix A — Worked reference schedule

Loan: principal 12,000.00; annual nominal rate 12% (monthly 1%); term 12; disbursed 2026-01-15
(first due 2026-02-15, a whole 30/360 month). Equal principal slice = 1,000.00.

| # | Due date | Opening balance | Interest due | Principal due | Total payment | Closing balance |
|---|----------|-----------------|--------------|---------------|---------------|-----------------|
| 1 | 2026-02-15 | 12,000.00 | 120.00 | 1,000.00 | 1,120.00 | 11,000.00 |
| 2 | 2026-03-15 | 11,000.00 | 110.00 | 1,000.00 | 1,110.00 | 10,000.00 |
| 3 | 2026-04-15 | 10,000.00 | 100.00 | 1,000.00 | 1,100.00 | 9,000.00 |
| 4 | 2026-05-15 | 9,000.00 | 90.00 | 1,000.00 | 1,090.00 | 8,000.00 |
| 5 | 2026-06-15 | 8,000.00 | 80.00 | 1,000.00 | 1,080.00 | 7,000.00 |
| 6 | 2026-07-15 | 7,000.00 | 70.00 | 1,000.00 | 1,070.00 | 6,000.00 |
| 7 | 2026-08-15 | 6,000.00 | 60.00 | 1,000.00 | 1,060.00 | 5,000.00 |
| 8 | 2026-09-15 | 5,000.00 | 50.00 | 1,000.00 | 1,050.00 | 4,000.00 |
| 9 | 2026-10-15 | 4,000.00 | 40.00 | 1,000.00 | 1,040.00 | 3,000.00 |
| 10 | 2026-11-15 | 3,000.00 | 30.00 | 1,000.00 | 1,030.00 | 2,000.00 |
| 11 | 2026-12-15 | 2,000.00 | 20.00 | 1,000.00 | 1,020.00 | 1,000.00 |
| 12 | 2027-01-15 | 1,000.00 | 10.00 | 1,000.00 | 1,010.00 | 0.00 |

Totals: interest 780.00; principal 12,000.00; payments 12,780.00; final balance 0.00.


## Auditor verdict

_The spec strongly captures the method and temporal core: interest method (1), equal-principal amortisation (2), 30/360 (3), per-period interest (4), disbursement-date accrual with stub interest (5), exact-zero closing (9), invalid-input rejection (12), and first-due-date+one-month (13) all match. It misses the bespoke edges: currency KES is never named though 2 dp is right (6); instalment rounding is to cents not whole shilling (7); the interest-first/principal-remainder within-period order is unaddressed (8); Rule-of-78 rebate (10) and principal-first term-fixed re-amortisation (11) are pushed out of scope; and the actual/365 APR disclosure split (14) is absent. Coverage: 8/14 correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | FR-007: "Interest for a whole period MUST be the opening balance × (annual nominal rate / 12)"; Q1 "interest on the reducing balance". | Spec computes interest on the reducing opening balance each period, i.e. declining balance on reducing principal, matching the reference. |
| 2 | yes | **yes** | Overview: "equal-principal (straight-line) amortization"; FR-004; Q1 "fixed principal slice each period... total instalment declines over the term." | Spec states a constant principal slice (P/n), interest on reducing balance, and a declining total instalment — exactly equal principal, explicitly not EMI. |
| 3 | yes | **yes** | Q3 and FR-008: "30/360 — each whole month = 30 days, the year = 360 days." | Spec adopts 30/360, matching the reference and explicitly rejecting actual/365. |
| 4 | yes | **yes** | FR-007: "Interest for a whole period MUST be the opening balance × (annual nominal rate / 12)"; no daily accrual anywhere. | Interest is computed once per monthly period (per-period, not daily accrual), matching 'same as the repayment period'. |
| 5 | yes | **yes** | Q5/FR-011 stub pro-rating; Assumptions: "Interest accrues from the disbursement date, and the first period spans the disbursement date to the first due date." | Spec has interest accrue from disbursement and charges partial-period (stub) interest for a short first period, matching the reference's allowance and charging of stub interest. |
| 6 | yes | no | Q7: "2 decimal places (granularity 0.01)"; no currency named (example cites JPY/KES not stated). | The 2 dp precision matches, but the spec is currency-agnostic and never names the Kenyan shilling (KES), so it does not match the reference's full value. |
| 7 | yes | no | Q6/FR-012: "Round to the currency minor unit... 2 decimal places (granularity 0.01)"; final instalment absorbs residue. | Spec rounds instalments to cents (0.01), not to the whole shilling; although it does settle the residue in the final instalment, the rounding granularity contradicts the reference. |
| 8 | no | no | absent | Spec treats principal as the fixed driver (P/n rounded) and computes interest separately; it never specifies that interest is rounded first with principal as the remainder of a rounded instalment. |
| 9 | yes | **yes** | FR-005: final principal "MUST equal the outstanding balance... the final closing balance is exactly 0.00." | Spec guarantees the final instalment reconciles to an exactly zero closing balance, matching the reference. |
| 10 | no | no | Out of Scope: "Early repayment... out of scope"; no rebate method stated. | Early full settlement is explicitly excluded, so the Rule-of-78 rebate policy is neither captured nor resolved. |
| 11 | no | no | Out of Scope: "overpayment... out of scope." | Partial prepayment handling is excluded; the principal-first, term-fixed re-amortisation policy is absent. |
| 12 | yes | **yes** | FR-015: "reject invalid loans (principal ≤ 0, annual rate < 0, term < 1...) with a clear error." | Spec rejects zero/negative principal and zero/sub-one term as invalid, matching the reference. |
| 13 | yes | **yes** | Q4/FR-009: "first instalment's due date MUST be exactly one calendar month after the disbursement date." | First due date = disbursement + one month with monthly instalments thereafter, matching the reference. |
| 14 | yes | no | FR-003 schedule rows (due date, opening, interest, principal, total, closing); Appendix totals interest 780.00; no APR disclosure anywhere. | The full per-period schedule and interest total are present, but the disclosed APR on an actual/365 basis — the non-obvious regulatory quirk — is entirely absent, so the output requirement is not fully matched. |
