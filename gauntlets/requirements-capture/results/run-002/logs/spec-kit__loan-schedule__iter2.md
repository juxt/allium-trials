# spec-kit — loan-schedule — iteration 2

Model (author): claude-opus · Questions asked: 5 · Captured: 9/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the interactive prompt was dismissed. Let me put the same questions in writing so you can answer however is easiest — just reply with your choices (e.g. "Q1: A, Q2: B…") or your own wording.

These are the material policy decisions the brief leaves open. Each has several plausible answers that produce *different* schedules, so I need your call rather than a guess.

## Q1: Amortization method
How should each instalment be split into interest and principal?

| Option | Answer | Implications |
|--------|--------|--------------|
| A | **Equal instalment (annuity / French)** | Every instalment is the same total; interest share falls, principal share rises. Uses the standard annuity formula. |
| B | **Equal principal (straight-line)** | Principal portion constant; total instalment declines each month as interest on the balance shrinks. |
| C | **Interest-only + balloon** | Instalments pay interest only; whole principal repaid in the final instalment. |

## Q2: Interest basis (rate convention + day-count)
How is each period's interest computed?

| Option | Answer | Implications |
|--------|--------|--------------|
| A | **Nominal ÷ 12, whole months** | Monthly rate = annual nominal ÷ 12, applied to opening balance; every period is one month regardless of dates. |
| B | **Actual days / 365** | Daily accrual at annual ÷ 365 over actual days between payment dates; period amounts vary. |
| C | **30/360** | Months = 30 days, year = 360 days. |

## Q3: First instalment timing / stub period
When is the first instalment due, and does the disbursement-to-first-payment gap accrue interest?

| Option | Answer | Implications |
|--------|--------|--------------|
| A | **One month after, full period** | First instalment one month after disbursement; first period is a normal full month; no stub. |
| B | **Fixed billing day + stub interest** | Instalments on a fixed day-of-month; odd first period from disbursement to first due date accrues pro-rated interest. |
| C | **Dates cosmetic only** | Disbursement date only labels rows; never affects interest; every period one clean month. |

## Q4: Rounding & residual reconciliation
What precision/mode, and how does the balance reach exactly zero?

| Option | Answer | Implications |
|--------|--------|--------------|
| A | **2 dp, half-up, adjust final instalment** | Round to minor units (2 dp) half-up; final instalment absorbs accumulated residual so closing balance = 0.00. |
| B | **2 dp, bankers' rounding, adjust final** | As A but round-half-to-even. |
| C | **No rounding** | Full precision throughout; balance zeroes analytically. |

Once I have these four, I may have one short follow-up round (e.g. handling of a 0% rate, and the exact shape of the returned schedule), then I'll write the complete `spec.md`.
A: Q1: **B — Equal principal.** Constant principal portion (P/n) each period; interest on the reducing balance; total instalment decreases over the term. Not an annuity/EMI.

Q2: **C — 30/360.** Every month counts as 30 days, year as 360. Interest computed once per monthly period (no daily accrual).

Q3: **A with stub.** First instalment is due disbursement date + one month. However, if disbursement precedes the first period start, a stub interest charge is levied for those extra days — partial-period interest is both permitted and required.

Q4: **A variant.** Instalments are rounded to the whole shilling (zero decimal places, no cents), half-up. Interest is computed and rounded first; principal is the remainder for that period. The accumulated rounding difference is absorbed in the final instalment so the closing balance is exactly zero.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Thanks — that's clear on four of the five, but your answers to Q1 and Q4 pull in opposite directions, and the stub mechanics in Q3 need pinning down before I can write something testable. Three focused follow-ups.

## Q5: Reconcile principal computation (Q1 vs Q4)
Q1 (equal principal) makes the **principal** the fixed quantity — `P/n` each period — with interest riding on top, so the *total* instalment varies. But Q4 says "interest is computed and rounded first; **principal is the remainder** for that period," which is the annuity pattern (fixed total, principal = total − interest). Those can't both hold. Which did you mean?

| Option | Answer | Implications |
|--------|--------|--------------|
| A | **Principal is fixed `P/n`** (Q4 wording was generic) | Each period: principal = round(P/n) to whole shilling; interest = round(balance × rate × 30/360); total = principal + interest (varies). Final instalment adjusts principal to zero the balance. This is true equal-principal. |
| B | **Principal is the remainder of a fixed total** | Reverts to annuity behaviour — contradicts choosing equal principal. Pick only if you actually want EMI. |

## Q6: Stub period mechanics
You said the first instalment is due `disbursement + 1 month`, yet a stub charge applies when "disbursement precedes the first period start." I need the trigger and the arithmetic. Please confirm or correct each part:

1. **What anchors the "first period start"?** e.g. a fixed billing day-of-month (say the 1st), so a loan disbursed on the 10th accrues a stub for the 20 remaining days of that month before the first full period begins? Or something else?
2. **Stub day count:** computed on the 30/360 basis (days from disbursement to first period start, each month = 30 days)?
3. **Stub placement:** is the stub interest (a) folded into the first instalment's interest, (b) a separate interest-only row at period 0 (no principal), or (c) added to principal? 
4. **Does the regular `P/n` schedule still run for the full `n` instalments** alongside the stub, or does the stub consume one of them?

A concrete example of the output you'd expect for, say, principal 120,000 / 12 months / 12% nominal / disbursed on a date that produces a stub would nail this down completely.

## Q7: Returned schedule shape & a couple of edge cases
To make the spec testable I'll assume each schedule row carries: instalment number, due date, opening balance, interest due, principal due, total payment, closing balance. 

1. Is that row shape right, or do you want fewer/more fields (e.g. drop due date, add cumulative interest)?
2. **Zero interest rate** (0% loan): interest = 0 every period, principal = P/n, no stub charge — acceptable?
3. **Principal not divisible by term** (e.g. 100,000 / 12): constant principal = round(P/n) each period with the final instalment absorbing the remainder — consistent with Q4, correct?

Once I have Q5–Q7 I'll write the full `spec.md`.
A: Q5: **A — Principal is the fixed P/n.** The Q4 wording was imprecise; the intent is: compute interest on the opening balance and round it first; principal is the fixed P/n portion, also rounded to the whole shilling; the total instalment is the sum of the two (and varies). The final instalment adjusts principal to bring the closing balance to exactly zero. True equal-principal throughout — option B would contradict Q1.

That is the one clarification I can give this turn. Please finalise Q6 and Q7 using your own defaults — the spec should not wait on me for those.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is done. It's saved at `spec.md` in the working directory.

## What it covers

A complete requirements spec for the repayment schedule engine, built from your decisions rather than guesses. The brief deliberately omitted every material computation policy, so I asked and you answered:

- **Equal-principal** amortization (constant `P/n`, declining total) — not an annuity
- **30/360** interest basis
- **Stub interest** required when disbursement precedes the first-period start
- **Principal is the fixed `P/n`**, interest rides on top (reconciled the Q1/Q4 tension)
- **Whole-shilling, half-up** rounding with the residual absorbed in the final instalment

For the two items you delegated (Q6 stub mechanics, Q7 row shape / edge cases) I committed to defensible defaults and flagged them explicitly in the spec as author-chosen, so you can see at a glance which decisions are yours versus mine (the table at the top and the two-part Assumptions section mark the provenance of every policy).

The spec includes three prioritized, independently-testable user stories, 17 functional requirements, correctness invariants (balance closes to exactly zero; principal sums to the original), three worked numeric examples for test authoring, measurable success criteria, and the edge cases (0% rate, term = 1, non-divisible principal, over-long stub, invalid inputs).

One thing worth your eye: I defaulted the **first-period start to the disbursement date**, which means the stub is zero in the ordinary case and only fires when a later billing anchor is supplied. If your real product has a fixed billing day-of-month that routinely produces stubs, tell me and I'll adjust FR-012/FR-013 and the default accordingly.
A: I've answered the 5 clarifying question(s) your process is allotted; I can't take more. Please finalise the specification now — use your process's own defaults or reasonable assumptions for anything still open — save it as spec.md, and tell me when it's done.

## Produced specification

# Feature Specification: Repayment Schedule Engine

**Feature Branch**: `001-repayment-schedule`

**Created**: 2026-11-08

**Status**: Draft (requirements agreed with stakeholder)

**Input**: User description: "We're building the repayment schedule engine for our loan product. Given a disbursed loan (principal, an annual nominal interest rate, a term in monthly instalments, and a disbursement date), produce the full repayment schedule: for each instalment, the interest and the principal due, and the running balance. Build a function `generate_schedule(loan)` that returns the schedule."

---

## Overview

Given a disbursed loan, `generate_schedule(loan)` produces a complete, deterministic repayment
schedule. Each row states, for one instalment, the interest due, the principal due, and the
running balance, such that the balance reaches exactly zero at the final instalment.

The computation policy below was **not** present in the original brief; each material decision was
confirmed with the product stakeholder (or, where explicitly delegated, defaulted and flagged as
such). The decisions are:

| Policy | Decision | Source |
|--------|----------|--------|
| Amortization method | **Equal principal** (constant `P/n`; declining total instalment) | Stakeholder (Q1) |
| Interest basis / day-count | **30/360** (every month = 30 days, year = 360 days) | Stakeholder (Q2) |
| First instalment timing | **One month after the first-period start**; stub interest permitted/required | Stakeholder (Q3) |
| Principal vs interest derivation | **Principal is the fixed `P/n`**; interest rides on top; total varies | Stakeholder (Q5) |
| Rounding | **Whole shilling (0 dp), half-up**; interest rounded first; residual absorbed in final instalment | Stakeholder (Q4) |
| Stub mechanics | Interest-only on full principal, 30/360 pro-rata, folded into first instalment | Default (delegated, Q6) |
| Returned row shape | #, due date, opening balance, interest, principal, total, closing balance | Default (delegated, Q7) |
| Zero-rate / non-divisible principal | See edge cases | Default (delegated, Q7) |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a standard equal-principal schedule (Priority: P1)

A loan officer has a disbursed loan (principal, annual nominal rate, term in monthly instalments,
disbursement date). They call `generate_schedule(loan)` and receive every instalment with its
interest, principal, and running balance, with the balance ending at exactly zero.

**Why this priority**: This is the core deliverable. Without it there is no product. It is the
minimum viable slice: a correct schedule for the ordinary case (no stub, principal divisible by
term).

**Independent Test**: Disburse 120,000 over 12 months at 12% nominal with the first-period start on
the disbursement date. Verify constant principal of 10,000, interest declining by 100 each period
(1,200 → 100), totals declining from 11,200 to 10,100, and closing balance of 0 on instalment 12.

**Acceptance Scenarios**:

1. **Given** principal 120,000, term 12, rate 12% nominal, no stub, **When** `generate_schedule` is
   called, **Then** every instalment has principal = 10,000, interest = opening balance × 1%, total
   = principal + interest, and the closing balance decreases monotonically to exactly 0.
2. **Given** any valid loan, **When** the schedule is produced, **Then** the number of rows equals
   the term, the opening balance of row 1 equals the principal, and each row's opening balance
   equals the previous row's closing balance.
3. **Given** any valid loan, **When** the schedule is produced, **Then** the sum of all principal
   amounts equals the original principal and the final closing balance is exactly 0.

---

### User Story 2 - Correct interest on a stub (odd first) period (Priority: P2)

A loan is disbursed before the start of its first billing period, so interest must be charged for
the extra days between disbursement and the first-period start.

**Why this priority**: Partial-period ("stub") interest is explicitly required by the institution's
policy; omitting it under-charges interest and mis-states the first instalment. It builds on P1 but
is independently testable.

**Independent Test**: Disburse 120,000 over 12 months at 12% nominal on 2026-01-10 with a
first-period start of 2026-02-01 (20 stub days on 30/360). Verify the first instalment's interest =
regular month interest (1,200) + stub interest (800) = 2,000, principal still 10,000, and the
remaining 11 instalments identical to the no-stub case.

**Acceptance Scenarios**:

1. **Given** a loan whose first-period start is after the disbursement date, **When** the schedule
   is produced, **Then** the first instalment's interest includes stub interest =
   `round(principal × annual_rate × stub_days / 360)` where `stub_days` is the 30/360 day count from
   disbursement to the first-period start.
2. **Given** a loan whose first-period start equals the disbursement date (the default), **When**
   the schedule is produced, **Then** stub interest is 0 and the first period is a normal full
   month.
3. **Given** a loan with a stub, **When** the schedule is produced, **Then** the schedule still
   contains exactly `term` instalments and the constant `P/n` principal is unaffected by the stub.

---

### User Story 3 - Deterministic rounding to whole shillings with a clean close (Priority: P3)

A loan's principal is not evenly divisible by its term, and/or interest amounts are fractional.
Every amount must be a whole shilling and the balance must still close to exactly zero.

**Why this priority**: Correct money arithmetic is required for any real disbursement, but it
refines P1/P2 rather than standing alone.

**Independent Test**: Disburse 100,000 over 12 months at 12% nominal. Verify principal of 8,333 for
instalments 1–11 and 8,337 for instalment 12 (absorbing the 4-shilling residual), all interest
values whole shillings, and a final closing balance of exactly 0.

**Acceptance Scenarios**:

1. **Given** a principal not divisible by the term, **When** the schedule is produced, **Then**
   instalments 1..n-1 each carry principal = `round(principal / term)` and instalment n carries
   principal = its opening balance, bringing the closing balance to exactly 0.
2. **Given** any instalment, **When** interest is computed, **Then** it is rounded to the nearest
   whole shilling (half-up) **before** the total is formed, and the total = rounded principal +
   rounded interest.
3. **Given** the full schedule, **When** summed, **Then** total principal repaid = original
   principal and total paid = total principal + total interest, with no fractional shillings in any
   row.

---

### Edge Cases

- **Zero interest rate (0%)**: interest is 0 in every period (including any stub), principal is the
  constant `P/n`, totals equal the principal portions, and the balance closes to 0.
- **Single instalment (term = 1)**: one row repays the entire principal plus one month's interest
  (plus stub interest if applicable); closing balance 0.
- **Principal not divisible by term**: handled per User Story 3 (final instalment absorbs the
  residual). The final principal may differ from `round(P/n)`.
- **Rounding residual sign**: the residual absorbed by the final instalment may be positive or
  negative (final principal slightly larger or smaller than `round(P/n)`); the engine MUST handle
  both and still close to exactly 0.
- **Stub longer than one month**: if a configured first-period start is more than one month after
  disbursement, stub interest accrues over the full 30/360 day count for that gap (it is a pure
  interest charge; no principal is amortised during the stub).
- **Invalid inputs**: non-positive principal, non-positive term, negative interest rate, or a
  first-period start before the disbursement date MUST be rejected with a clear error rather than
  producing a schedule.

---

## Requirements *(mandatory)*

### Functional Requirements

**Inputs & interface**

- **FR-001**: The system MUST expose `generate_schedule(loan)` that accepts a single loan input and
  returns the complete repayment schedule as an ordered collection of instalment rows.
- **FR-002**: The loan input MUST provide: principal amount, annual nominal interest rate, term as a
  number of monthly instalments, and disbursement date. It MAY provide a first-period start date
  (billing anchor); when omitted this defaults to the disbursement date.
- **FR-003**: The system MUST validate inputs and reject (with a clear error) any loan with
  non-positive principal, non-positive/zero term, negative interest rate, or a first-period start
  earlier than the disbursement date.

**Schedule structure**

- **FR-004**: The schedule MUST contain exactly `term` instalment rows, numbered 1..term in due-date
  order.
- **FR-005**: Each row MUST contain: instalment number, due date, opening balance, interest due,
  principal due, total payment (= interest due + principal due), and closing balance.
- **FR-006**: Row 1's opening balance MUST equal the principal; each subsequent row's opening balance
  MUST equal the prior row's closing balance; each row's closing balance MUST equal its opening
  balance minus its principal due.
- **FR-007**: The due date of the first instalment MUST be one calendar month after the first-period
  start; each subsequent instalment MUST be due one calendar month after the previous one.

**Amortization (equal principal)**

- **FR-008**: The principal portion MUST be the constant `round(principal / term)` (whole shilling,
  half-up) for instalments 1..term-1.
- **FR-009**: The principal portion of the final instalment MUST equal its opening balance, so that
  the final closing balance is exactly zero and the accumulated rounding residual is absorbed there.
- **FR-010**: The total instalment amount MUST be the sum of that period's interest due and principal
  due, and will therefore decline over the term as interest on the reducing balance falls (except
  where a stub raises the first instalment).

**Interest (30/360) & stub**

- **FR-011**: Regular (full-month) interest for a period MUST be computed on the 30/360 basis as
  `opening balance × annual_nominal_rate / 12`, then rounded to the nearest whole shilling (half-up)
  before being used in the total.
- **FR-012**: When the first-period start is later than the disbursement date, the system MUST levy
  stub interest = `round(principal × annual_nominal_rate × stub_days / 360)`, where `stub_days` is
  the 30/360 day count from the disbursement date to the first-period start, computed on the full
  disbursed principal.
- **FR-013**: Stub interest MUST be added to the first instalment's interest due (not a separate row,
  and carrying no principal); when the first-period start equals the disbursement date, stub interest
  is zero.
- **FR-014**: Interest MUST be rounded to the whole shilling *first*; the principal portion is
  determined independently per FR-008/FR-009; the total is the sum of the two rounded components.

**Correctness invariants**

- **FR-015**: The sum of all principal portions across the schedule MUST equal the original
  principal, and the final closing balance MUST be exactly zero.
- **FR-016**: Every monetary value in every row MUST be a whole shilling (no fractional units).
- **FR-017**: For a given loan input, `generate_schedule` MUST be deterministic — identical inputs
  always produce an identical schedule.

### Key Entities *(include if feature involves data)*

- **Loan (input)**: A disbursed loan. Attributes: principal amount (whole shillings), annual nominal
  interest rate (e.g. 0.12 for 12%), term (count of monthly instalments), disbursement date, and an
  optional first-period start date (defaults to disbursement date).
- **Instalment (output row)**: One scheduled payment. Attributes: instalment number, due date,
  opening balance, interest due, principal due, total payment, closing balance.
- **Schedule (output)**: The ordered collection of instalment rows returned by `generate_schedule`,
  one per instalment over the term.

---

## Worked Examples *(for test authoring)*

**Example A — standard, no stub, divisible** (principal 120,000, term 12, rate 12% nominal,
first-period start = disbursement date; monthly rate 1%):

| # | Opening | Interest | Principal | Total | Closing |
|---|---------|----------|-----------|-------|---------|
| 1 | 120,000 | 1,200 | 10,000 | 11,200 | 110,000 |
| 2 | 110,000 | 1,100 | 10,000 | 11,100 | 100,000 |
| … | … | (−100/period) | 10,000 | … | … |
| 12 | 10,000 | 100 | 10,000 | 10,100 | 0 |

**Example B — rounding, non-divisible** (principal 100,000, term 12, rate 12% nominal, no stub;
`round(100,000/12)` = 8,333):

- Instalments 1–11: principal 8,333 each (sum 91,663); interest = opening × 1% (rounded).
- Instalment 12: opening 8,337 → principal 8,337 (absorbs the 4-shilling residual), interest
  `round(8,337 × 1%)` = 83, total 8,420, closing 0.

**Example C — stub** (principal 120,000, term 12, rate 12% nominal, disbursed 2026-01-10,
first-period start 2026-02-01 ⇒ 20 stub days on 30/360):

- Stub interest = `round(120,000 × 0.12 × 20/360)` = 800.
- Instalment 1 (due 2026-03-01): opening 120,000, interest 1,200 + 800 = 2,000, principal 10,000,
  total 12,000, closing 110,000.
- Instalments 2–12: identical to Example A rows 2–12.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every valid loan, the generated schedule's final closing balance is exactly zero
  and the sum of principal portions equals the original principal (100% of cases).
- **SC-002**: Every monetary amount in every row is a whole shilling — zero fractional-unit values
  across all generated schedules.
- **SC-003**: The schedule contains exactly one row per instalment over the term, in correct
  chronological order, for 100% of valid loans.
- **SC-004**: Interest totals match an independent hand-calculation on the 30/360 basis (including
  the stub, where present) to the whole shilling for the three worked examples and a representative
  sample of randomised loans.
- **SC-005**: Repeated invocation with identical inputs yields byte-identical schedules
  (deterministic) in 100% of cases.
- **SC-006**: Invalid inputs (non-positive principal/term, negative rate, first-period start before
  disbursement) are rejected with a clear error in 100% of cases, with no schedule produced.

---

## Assumptions

Decisions explicitly **confirmed by the stakeholder** (do not revisit without their sign-off):

- Amortization is **equal principal**: constant `P/n` principal, interest on the reducing balance,
  declining total instalment — not an annuity/EMI (Q1, Q5).
- Interest uses the **30/360** convention; a full month's interest is therefore `balance × annual
  rate / 12`, and partial periods pro-rate by `days/360` (Q2).
- Interest is computed and **rounded first**; principal is the fixed `P/n` (also rounded); the total
  is their sum (Q4, Q5).
- Rounding is to the **whole shilling, half-up**; the accumulated residual is absorbed in the **final
  instalment** so the balance closes to exactly zero (Q4).
- The first instalment is due **one month after the first-period start**, and **partial-period (stub)
  interest is both permitted and required** when disbursement precedes the first-period start (Q3).

Decisions **delegated to the author** by the stakeholder and defaulted here (open to change):

- **First-period start / billing anchor** defaults to the **disbursement date**, so the ordinary case
  has no stub. A stub is produced only when a later first-period start is supplied. Stub interest is
  interest-only on the full principal, 30/360 pro-rata, **folded into the first instalment** (not a
  separate row), and does not alter the constant `P/n` principal or the instalment count (Q6).
- **Returned row shape**: instalment number, due date, opening balance, interest due, principal due,
  total payment, closing balance (Q7).
- **Zero interest rate**: interest is 0 every period (no stub charge), principal is `P/n` (Q7).
- **Principal not divisible by term**: `round(P/n)` per period with the final instalment absorbing
  the remainder (Q7).

Other reasonable defaults:

- Principal and all amounts are denominated in whole shillings; the annual nominal rate is expressed
  as a decimal fraction (e.g. 0.12 for 12%).
- "One calendar month" advances the same day-of-month; month-end overflow (e.g. the 31st in a
  shorter month) rolls to the last valid day of the target month. (Affects due-date labelling only,
  not 30/360 interest, which treats every month as 30 days.)
- `generate_schedule` is a pure, side-effect-free computation over the loan input.


## Auditor verdict

_The spec strongly covers the amortisation/interest mechanics: equal principal (#2), declining balance (#1), 30/360 (#3), per-period interest (#4), stub/disbursement-date accrual (#5), whole-shilling instalment rounding with final-instalment residual (#7), zero close (#9), input rejection (#12), and first due date (#13) all match. Five decisions fail strict matching: currency precision is 0 dp not KES-2dp (#6); within-period order makes principal fixed rather than the remainder of the rounded instalment (#8); and the Rule-of-78 rebate (#10), fixed-term re-amortised partial prepayment (#11), and the total-cost-of-credit plus actual/365 APR disclosure (#14) are absent or incomplete. Coverage = 9/14 correct. The gap concentrates on the bespoke, non-inferable policies (10, 11, 14) plus the two interlocked rounding/precision subtleties (6, 8)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "interest = opening balance × 1%"; FR-011 "interest ... on the reducing balance"; "declining total instalment" | Interest is computed on the reducing opening balance each period, i.e. declining balance on reducing principal, matching the reference. |
| 2 | yes | **yes** | Policy table: "Equal principal (constant P/n; declining total instalment)"; Assumptions: "not an annuity/EMI" | Spec explicitly states equal principal with constant P/n, interest on reducing balance, declining total instalment, exactly the reference answer and explicitly ruling out EMI. |
| 3 | yes | **yes** | "Interest basis / day-count: 30/360 (every month = 30 days, year = 360 days)" | Spec adopts 30/360 verbatim, matching the reference and ruling out actual/365. |
| 4 | yes | **yes** | FR-011: "Regular (full-month) interest for a period MUST be computed ... as opening balance × annual_nominal_rate / 12" | Interest is computed once per monthly period (balance × rate/12), i.e. same as the repayment period rather than daily accrual, matching the reference. |
| 5 | yes | **yes** | FR-012/FR-013: stub interest from disbursement date to first-period start, 30/360 pro-rata, folded into first instalment; "partial-period (stub) interest is both permitted and required" | Spec charges partial-period interest for the days between disbursement and the first-period start, so interest effectively accrues from disbursement, matching the reference. |
| 6 | yes | no | Assumptions: "all amounts are denominated in whole shillings"; Policy: "Whole shilling (0 dp)" | Spec addresses currency/precision but sets 0 dp (whole shilling) and never names KES; reference requires Kenyan shilling to 2 decimal places, so the precision is wrong and currency unnamed. |
| 7 | yes | **yes** | Policy: "Whole shilling (0 dp), half-up; ... residual absorbed in final instalment"; FR-009 | Each instalment is rounded to the whole shilling and the accumulated residual is settled in the final instalment, matching the reference exactly. |
| 8 | yes | no | FR-014: "Interest MUST be rounded ... first; the principal portion is determined independently per FR-008/FR-009; the total is the sum of the two rounded components" | Spec rounds interest first (matches), but makes principal the fixed P/n with total as the sum; the reference requires principal to be the remainder of the rounded instalment, a different derivation. |
| 9 | yes | **yes** | FR-009/FR-015: "final closing balance is exactly zero"; SC-001 | The final instalment reconciles so the closing balance is exactly zero, matching the reference. |
| 10 | no | no | absent | The spec never addresses early full settlement or any unearned-interest rebate, so the Rule of 78 policy is neither surfaced nor resolved. |
| 11 | no | no | absent | The spec never addresses partial prepayment or re-amortisation, so the apply-to-principal, fixed-term re-amortisation policy is absent. |
| 12 | yes | **yes** | FR-003: reject "non-positive principal, non-positive/zero term, negative interest rate" | Zero/negative principal and zero/negative term are rejected with a clear error, matching the reference. |
| 13 | yes | **yes** | FR-007: "first instalment MUST be one calendar month after the first-period start"; first-period start "defaults to the disbursement date" | With the default first-period start equal to disbursement, the first due date is disbursement + one month with monthly instalments thereafter, matching the reference. |
| 14 | yes | no | FR-005 row shape (#, due date, opening, interest, principal, total, closing); no mention of total cost of credit or APR | Spec defines the per-period output shape but omits the total cost of credit and the disclosed APR on an actual/365 basis, so the material disclosure quirk is unmet. |
