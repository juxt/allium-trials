# spec-kit — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 14 · Captured: 6/14 · Bespoke captured: 3/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like that structured-question format didn't go through. Let me just ask you directly in text. These are the decisions that materially change the interest figure, so I'd rather get them from you than guess.

## Round 1 — the arithmetic core

**Q1. Day-count convention** — how the daily rate is derived from the annual rate.

| Option | Meaning |
|--------|---------|
| A | **Actual/365 fixed** — annual ÷ 365 every day, leap years ignored (common UK retail) |
| B | **Actual/actual** — annual ÷ 366 in a leap year, ÷ 365 otherwise |
| C | **Actual/360** — annual ÷ 360 |
| D | **30/360** — every month treated as 30 days |

**Q2. Accrual method** — simple or compounding within the period.

| Option | Meaning |
|--------|---------|
| A | **Simple** — daily interest = balance × daily rate, summed over the period, posted once |
| B | **Daily compounding** — each day's interest joins the balance and earns interest the next day |
| C | **Monthly compounding** — compound at each month boundary |

**Q3. Rounding mode** (assume to the currency minor unit / 2dp unless you say otherwise).

| Option | Meaning |
|--------|---------|
| A | **Half-up** — round half away from zero |
| B | **Half-even (banker's)** — round half to nearest even, reduces cumulative bias |
| C | **Truncate** — always round down toward zero |
| D | **Higher precision** — keep more than 2dp (tell me how many) |

**Q4. Balance basis** — which balance each day earns interest.

| Option | Meaning |
|--------|---------|
| A | **End-of-day closing** — balance after that day's transactions |
| B | **Start-of-day opening** — balance before that day's transactions |

You can answer tersely, e.g. "Q1: A, Q2: A, Q3: B, Q4: A". Once I have these I'll ask a second round covering rate representation, negative balances, gaps in the history, and the period boundaries.
A: Q1: C — annual ÷ 360. Q2: B — daily compounding; each day's interest joins the base. Q3: C — truncate (floor to 2 dp; the bank keeps the fraction). Q4: A — end-of-day closing balance.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Got it. Noting one interaction already: daily compounding with truncation means I need to know *when* the truncation happens, since flooring each day before it joins the base gives a different figure than accruing at full precision and flooring once. That's in this round.

## Round 2 — rate, timing, edges

**Q5. Rate representation and type** — how is the annual rate supplied, and what kind of rate is it?

| Option | Meaning |
|--------|---------|
| A | Decimal, nominal (e.g. `0.05` = 5%, which we then compound daily) |
| B | Percentage, nominal (e.g. `5.0` = 5%, compounded daily) |
| C | It's an AER/effective rate that must be converted to a daily rate so the year compounds up to it |

**Q6. Rounding timing** (given daily compounding + truncate to 2dp).

| Option | Meaning |
|--------|---------|
| A | **Truncate each day** — floor the day's interest to 2dp before it joins the base |
| B | **Accrue at full precision, truncate once** — carry unrounded interest through the period, floor only at posting |

**Q7. Negative closing balance on a day** — how is it treated?

| Option | Meaning |
|--------|---------|
| A | **Floor at zero** — negative days earn no interest |
| B | **Charge debit interest** — apply the same rate to the negative balance (reduces interest) |
| C | Negative balances cannot occur / out of scope (I'll assert this as a precondition) |

**Q8. Gaps in the daily balance history** — a day in the period with no balance recorded.

| Option | Meaning |
|--------|---------|
| A | **Carry forward** the last known closing balance |
| B | **Treat as zero** for that day |
| C | **Error** — the history must be complete and contiguous, else reject |

**Q9. Period boundaries** — the period is given as a start and end date. Which days accrue?

| Option | Meaning |
|--------|---------|
| A | Both endpoints inclusive — every calendar day from start to end earns |
| B | Start inclusive, end exclusive (half-open) |
| C | Deposit day earns, withdrawal/close day does not (or vice versa — tell me) |

Same terse format is fine.
A: Q5: A — decimal nominal (e.g. `0.05` for 5%); the daily rate is simply `annual_rate / 360`. No AER conversion. [Input format — decimal vs percentage string — is not policy; adjust on the way in.]

Q6: B — accrue at full precision throughout the period, truncate once at posting. The rounding rule governs the posted figure; daily compounding carries unrounded intermediate balances.

Q7: C — negative balances cannot occur; treat as a precondition violation and reject. The account never goes negative.

Q8: A — carry forward the last known closing balance. [Not explicitly policy; this is the standard retail assumption.]

Q9: B — half-open [start, end). The posting date is excluded from the period it closes and opens the next one.

### Round 3
_Step reasoning:_ (live agent turn)

Q: Clear. One consequence worth stating back so we're aligned: with Q3 truncate + Q6 truncate-once, the customer receives the floored interest and the bank retains the sub-penny remainder; the updated balance is the last closing balance plus that floored figure. Compounding runs on unrounded intermediates.

Last round, mostly scope and posting mechanics.

## Round 3 — scope and posting

**Q10. Is the annual rate constant for the whole period?** The brief says "an annual interest rate" (singular).

| Option | Meaning |
|--------|---------|
| A | Constant single rate for the entire period |
| B | Rate can change mid-period (schedule of rate + effective date) — in scope |
| C | Constant now, but design should not preclude adding B later |

**Q11. Tiered rates by balance band** (e.g. higher rate above £50k)?

| Option | Meaning |
|--------|---------|
| A | No tiering — one rate applies to the whole balance |
| B | Tiered/banded rates — in scope (I'll give the bands) |

**Q12. Re-posting / idempotency** — what if `post_interest` is called for a period that's already been posted?

| Option | Meaning |
|--------|---------|
| A | Reject — refuse to post the same period twice |
| B | Idempotent — return the previously posted result, no double credit |
| C | Not a concern for this function / out of scope |

**Q13. Rate sign and zero.**

| Option | Meaning |
|--------|---------|
| A | Rate is ≥ 0; a 0% rate yields zero interest and no meaningful posting |
| B | Negative rates are possible (charging on balances) — in scope |

**Q14. Currency precision** — the "2dp / minor unit" assumption.

| Option | Meaning |
|--------|---------|
| A | Single currency, 2 decimal places (pennies/cents) |
| B | Multi-currency; minor-unit precision varies by currency (e.g. JPY 0dp) — in scope |

After this I'll write the spec and save it.
A: Q10: B — rate can change mid-period. Each day uses the rate in force on that day; compute interest per rate-segment and sum.

Q11: A — no tiering; one rate applies to the whole balance. [default, not policy]

Q12: A — reject; refuse to post the same period twice. [default, not policy]

Q13: A — rate is ≥ 0; a negative rate is rejected as invalid. A zero rate posts zero interest but still records the zero posting as a no-op.

Q14: A — single currency, 2 decimal places. [default, not policy]

### Round 4
_Step reasoning:_ (live agent turn)

Q: It is done. `spec.md` is saved in this directory (and mirrored to `specs/001-interest-engine/spec.md`).

## What I did

The brief named the interface and nothing else, so before writing a line I pinned the decisions that actually change the posted figure. None of them had a safe default I could infer, so I asked you rather than guess. The fourteen questions resolved to:

- **Actual/360** day count, daily rate = annual ÷ 360, leap years included in the count but the divisor stays 360.
- **Daily compounding** on the end-of-day closing balance plus interest accrued so far.
- **Full-precision accrual, truncated once** to 2dp at posting; the bank keeps the sub-penny remainder.
- **Decimal nominal rate**, ≥ 0, negative rejected; **rate may change mid-period**, each day uses the rate in force.
- **Half-open period** `[start, end)`; the end date is the posting date and opens the next period.
- **Carry forward** the last known balance across gaps; **reject** if there's no opening balance, if a day is negative, or if the period was already posted.
- Single currency at 2dp, no tiering, zero rate still records a zero posting.

## What's in the spec

Three prioritised user stories (flat period, moving balance, rate change) with Given/When/Then scenarios, eight edge cases, 23 functional requirements grouped by concern, the key entities including the rate schedule, and six measurable success criteria built around a hand-computed reference figure and the "truncation never over-credits" invariant.

## Two things I flagged rather than decided

The spec leaves these to planning, since they're implementation shape rather than interest policy: which argument actually carries the rate schedule (account, period, or a rate service), and how postings are persisted and serialised so a period is posted at most once.

Ready for `/speckit-clarify` if you want a second pass, or `/speckit-plan` to move to design.
A: Received. The spec reflects the decisions correctly.

## Produced specification

# Feature Specification: Savings interest engine

**Feature Branch**: `001-interest-engine`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Interest engine for savings accounts. Given an account with a daily balance history over a period and an annual interest rate, compute the interest earned and post it. Build a function `post_interest(account, period)` that returns the interest posted and the account's updated balance."

## Overview

The engine computes the interest a savings account earns over a period and posts it to the account. It reads the account's daily balance history and the annual interest rate in force on each day, accrues interest with daily compounding, and credits a single rounded figure at the end of the period. The public interface is `post_interest(account, period)`, which returns the interest posted and the account's updated balance.

All material policy decisions below were confirmed with the product stakeholder rather than inferred. They are recorded in the Requirements and Assumptions sections and drive the acceptance scenarios.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Post interest for a straightforward period (Priority: P1)

An operator runs interest posting for a savings account at the end of an interest period. The account has a known balance on each day of the period and a single annual rate in force. The engine accrues interest day by day with daily compounding, floors the result to the penny, credits it to the account, and reports both the interest posted and the new balance.

**Why this priority**: This is the core of the engine. Without it there is no product. It delivers the primary value on its own: correct interest, correctly posted.

**Independent Test**: Provide an account with a flat balance across a fixed period and a single rate, call `post_interest`, and check the returned interest and updated balance against a hand-computed reference figure.

**Acceptance Scenarios**:

1. **Given** an account holding 1,000.00 with a closing balance of 1,000.00 on every day of a 3-day half-open period and an annual rate of 0.05, **When** `post_interest` is called, **Then** interest accrues at 0.05 / 360 per day compounding daily on the running base, the accrued total is truncated to 2 decimal places, and the returned updated balance equals the opening balance plus that truncated interest.
2. **Given** the same account after a successful posting, **When** the returned figures are read, **Then** the function reports both the posted interest amount and the updated balance, and the posted interest is never greater than the true accrued amount (truncation only ever rounds down).

---

### User Story 2 - Balance changes during the period (Priority: P1)

The account's balance moves during the period because the customer pays in and takes out. Each day's interest is based on that day's end-of-day closing balance, plus interest accrued so far, so deposits and withdrawals change the base from the day they land.

**Why this priority**: Real accounts are not static. Handling a moving daily balance correctly is essential to the engine being usable at all, so it sits alongside Story 1 as P1.

**Independent Test**: Provide a balance history with at least one deposit and one withdrawal on known dates, call `post_interest`, and check the accrual reflects the changed closing balance from each transaction date onward.

**Acceptance Scenarios**:

1. **Given** a period where the closing balance rises partway through, **When** interest is computed, **Then** days before the change accrue on the lower balance and days from the change onward accrue on the higher balance, each compounding on the running base.
2. **Given** a period with a day that has no recorded balance, **When** interest is computed, **Then** the last known closing balance is carried forward for that day.

---

### User Story 3 - Rate changes during the period (Priority: P2)

The annual rate changes partway through the period. Each day uses the rate in force on that day. Interest still compounds daily across the rate change, so the running base carries over the boundary.

**Why this priority**: Rate changes are common but less frequent than daily balance movement. The engine must handle them, but a first usable slice exists without this path exercised.

**Independent Test**: Provide a rate schedule with one change date inside the period, call `post_interest`, and check that days before the change use the old rate and days from the change onward use the new rate, with accrual carried across the boundary.

**Acceptance Scenarios**:

1. **Given** a rate schedule of 0.05 until a change date and 0.04 from that date, **When** interest is computed for a period spanning the change, **Then** each day applies its in-force rate divided by 360, and the accrued interest carried into the change date continues compounding under the new rate.

---

### Edge Cases

- **Zero rate**: a rate of 0 in force for the whole period yields zero interest. A zero posting is still recorded as a no-op.
- **Empty period**: a half-open period covering zero days (start equals end) yields zero interest.
- **Negative rate**: rejected as invalid input. The engine does not post.
- **Negative closing balance**: a negative end-of-day closing balance on any day in the period is a precondition violation. The engine rejects the request and posts nothing. Accounts are assumed never to go negative.
- **Missing opening balance**: if no closing balance is known on or before the period start, there is nothing to carry forward. The engine rejects the request.
- **Gap in the history**: a day inside the period with no recorded balance carries forward the last known closing balance.
- **Re-posting a period**: a period already posted is rejected. The engine refuses to credit the same period twice.
- **Sub-penny remainder**: the fraction below 2 decimal places left by truncation is retained by the institution and is never credited to the customer.

## Requirements *(mandatory)*

### Functional Requirements

**Interface**

- **FR-001**: The engine MUST expose `post_interest(account, period)` that computes, posts, and returns the interest earned for the period together with the account's updated balance.
- **FR-002**: The function MUST return two values: the interest posted (a monetary amount at 2 decimal places) and the updated account balance after posting.

**Rate and day count**

- **FR-003**: The daily rate MUST be the annual rate divided by 360 (Actual/360 day count). The divisor is 360 regardless of calendar year length, including leap years.
- **FR-004**: The annual rate MUST be treated as a decimal nominal rate (for example 0.05 means 5%). No AER or effective-rate conversion is performed. Input supplied as a percentage or string is a formatting concern to be normalised to a decimal on the way in, not a policy matter.
- **FR-005**: The annual rate MUST be greater than or equal to zero. A negative rate MUST be rejected as invalid input, and nothing is posted.
- **FR-006**: The rate MAY change within a period. The engine MUST apply, for each day, the annual rate in force on that day, taken from a rate schedule keyed by effective date. The daily rate for that day is that day's annual rate divided by 360.

**Accrual and compounding**

- **FR-007**: Interest MUST compound daily. Each day's accrued interest joins the base on which subsequent days accrue.
- **FR-008**: The base for a given day MUST be that day's end-of-day closing balance plus interest accrued so far in the period. Compounding carries across both balance changes and rate changes.
- **FR-009**: The balance used for each day MUST be the end-of-day closing balance, that is the balance after that day's transactions have posted.
- **FR-010**: Intermediate accrual MUST be carried at full precision. No rounding is applied to daily interest or to the running base during the period.

**Period boundaries**

- **FR-011**: The period MUST be treated as half-open `[start, end)`. Every calendar day from the start date inclusive to the day before the end date accrues interest. The end date is the posting date; it does not accrue in the period it closes and opens the next period.
- **FR-012**: A period covering zero days (start equal to end) MUST yield zero interest.

**Rounding and posting**

- **FR-013**: The posted interest MUST be the full-precision accrued total truncated (floored toward zero) to 2 decimal places. Truncation happens once, at posting, not per day.
- **FR-014**: The sub-penny remainder left by truncation MUST be retained by the institution and MUST NOT be credited to the customer.
- **FR-015**: The updated balance MUST equal the account's balance at posting (the last known closing balance) plus the truncated posted interest.
- **FR-016**: A posting MUST be recorded against the account dated at the period end (the exclusive `end` date).
- **FR-017**: A zero interest result (from a zero rate or a zero-day period) MUST still be recorded as a zero posting (a no-op record), not silently skipped.

**History handling**

- **FR-018**: A day inside the period with no recorded balance MUST carry forward the last known closing balance.
- **FR-019**: If no closing balance is known on or before the period start, the engine MUST reject the request, because there is no seed to carry forward.
- **FR-020**: A negative end-of-day closing balance on any day in the period MUST be treated as a precondition violation. The engine MUST reject the request and post nothing.

**Idempotency and scope**

- **FR-021**: The engine MUST reject an attempt to post a period that has already been posted for the account. It MUST NOT double-credit.
- **FR-022**: A single rate applies to the whole balance. Tiered or banded rates by balance are out of scope.
- **FR-023**: The engine operates in a single currency with 2 decimal places (minor unit). Multi-currency and variable minor-unit precision are out of scope.

### Key Entities *(include if feature involves data)*

- **Account**: the savings account. Holds a current balance at 2 decimal places, a daily balance history, and enough posting record to tell whether a given period has already been posted. Assumed never to hold a negative balance.
- **Daily balance history**: the end-of-day closing balance per date. May have gaps; a gap carries forward the last known closing balance. Must contain at least one known balance on or before the period start.
- **Period**: a half-open date range `[start, end)`. The `end` date is the posting date and belongs to the next period.
- **Rate schedule**: one or more entries of (effective date, annual rate as a decimal ≥ 0). Each day of the period resolves to the rate in force on that day. A single-entry schedule is the constant-rate case.
- **Interest posting**: the record of a credit to the account. Carries the truncated interest amount, the period it covers, and the posting date. A zero posting is a valid record.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a defined set of reference scenarios (flat balance, moving balance, rate change, leap-year span, zero rate, zero-day period), the posted interest matches an independently hand-computed figure to the penny.
- **SC-002**: Posted interest is never greater than the true full-precision accrued amount, in every scenario. Truncation only ever rounds down.
- **SC-003**: Calling `post_interest` twice for the same period credits interest at most once; the second call is rejected and the balance is unchanged.
- **SC-004**: Given identical inputs, the engine returns identical outputs on every run (deterministic, no dependence on wall-clock time or evaluation order).
- **SC-005**: A period spanning a leap-year boundary uses a 360 divisor throughout, and the result matches the reference figure computed on the same basis.
- **SC-006**: Invalid inputs (negative rate, negative closing balance, missing opening balance, already-posted period) are rejected without any change to the account balance.

## Assumptions

- **Truncation retains the fraction**: interest is floored to 2 decimal places at posting and the institution keeps the sub-penny remainder. Confirmed with the stakeholder.
- **Carry-forward for gaps**: a missing day uses the last known closing balance. Taken as the standard retail assumption, confirmed with the stakeholder.
- **Input format is not policy**: whether the rate arrives as a decimal, a percentage, or a string is a normalisation concern handled on input and does not change the computation.
- **No tiering, single currency at 2dp, reject double-posting**: confirmed as defaults for this version rather than deep policy, and in scope as stated.
- **Rate schedule is available to the function**: the rate in force on each day is resolvable from data reachable through the `account` or `period` arguments. The exact carrier (account, period, or a rate service) is an implementation detail left to planning.
- **Accounts never go negative**: enforced as a precondition, not handled as debit interest.
- **Posting persistence and concurrency**: how postings are stored and how concurrent posting attempts are serialised are implementation concerns for the planning phase. The behavioural requirement is that a period is posted at most once.


## Auditor verdict

_The spec covers the method/convention/edge decisions well (compounding daily #2, 360 basis #4, floor rounding #6, edge handling #11, half-open boundary #12, per-day in-force rate #13), but diverges on the core calculation method (#1: uses per-day daily-balance compounding rather than average daily balance) and entirely omits the withholding tax (#7), all three lifecycle decisions (dormancy #8, closure #9, escheatment #10), the minimum-balance threshold (#5), quarterly anniversary posting (#3), and the richer output shape (#14). Correct on 7 of 14; the lifecycle and tax dimensions, plus the average-balance method, are unsurfaced._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | no | FR-007/FR-008: "Interest MUST compound daily. Each day's accrued interest joins the base... The base for a given day MUST be that day's end-of-day closing balance plus interest accrued so far in the period." | The spec uses a per-day daily-balance compounding method, applying the rate to each day's closing balance. The reference requires average daily balance: sum daily balances, divide by days, apply the rate once to the average. These are different methods, so incorrect. |
| 2 | yes | **yes** | FR-007: "Interest MUST compound daily. Each day's accrued interest joins the base on which subsequent days accrue." | The spec explicitly states daily compounding, matching the reference's daily compounding within the period. |
| 3 | no | no | FR-016: "A posting MUST be recorded against the account dated at the period end (the exclusive `end` date)." No posting frequency or anniversary anchoring is stated. | The spec treats the posting period as an externally-supplied argument and never specifies quarterly posting on the anniversary of account opening. The reference requires quarterly, anniversary-anchored posting, which is absent. |
| 4 | yes | **yes** | FR-003: "The daily rate MUST be the annual rate divided by 360 (Actual/360 day count). The divisor is 360 regardless of calendar year length, including leap years." | The spec explicitly uses a 360 days-in-year basis, matching the reference exactly. |
| 5 | no | no | absent | The spec never mentions a minimum balance threshold (1,000) for earning interest, nor days-below-threshold contributing zero. No such requirement or edge case appears. |
| 6 | yes | **yes** | FR-013: "The posted interest MUST be the full-precision accrued total truncated (floored toward zero) to 2 decimal places"; FR-014: sub-penny remainder retained by the institution. | The spec floors posted interest to 2dp and the institution keeps the fraction, matching the reference's floor/round-down and retained fraction. |
| 7 | no | no | absent | The spec contains no withholding tax provision. There is no 15% deduction, no net/gross distinction, and no separate tax reporting. The reference requires all of this. |
| 8 | no | no | absent | The spec addresses no dormancy lifecycle: no 12-month inactivity trigger, no continued accrual while dormant, no monthly dormancy fee of 5. Entirely absent. |
| 9 | no | no | absent | The spec does not handle account closure mid-period or pro-rata accrual to a closure date. Closure is never mentioned; only ordinary period posting is covered. |
| 10 | no | no | absent | The spec contains no escheatment provision: no 5-year dormant rule, no remittance to the state, no zero-balance closure. Entirely absent. |
| 11 | yes | **yes** | Edge Cases: "Negative rate: rejected as invalid input." "Zero rate... yields zero interest. A zero posting is still recorded as a no-op." "Accounts are assumed never to go negative." | The spec rejects negative rates, treats a zero balance/rate as a zero no-op posting, and disallows negative balances (no overdraft), matching all three parts of the reference. |
| 12 | yes | **yes** | FR-011: "The period MUST be treated as half-open `[start, end)`... The end date is the posting date; it does not accrue in the period it closes and opens the next period." | The spec excludes the posting day from the period it closes and includes it in the next period via half-open [start, end) semantics, matching the reference exactly. |
| 13 | yes | **yes** | FR-006: "The engine MUST apply, for each day, the annual rate in force on that day, taken from a rate schedule keyed by effective date." FR-008: compounding carries across rate changes. | The spec applies the in-force rate per day from a schedule and accrues per rate-segment across the change, matching the reference's per-day in-force rate approach. |
| 14 | yes | no | FR-002: returns "the interest posted (a monetary amount at 2 decimal places) and the updated account balance after posting." | The spec returns only posted interest and updated balance. It omits tax withheld, net vs gross, the average daily balance used, and the number of qualifying days that the reference requires in the output shape. |
