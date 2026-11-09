# spec-kit — savings-interest — iteration 1

Model (author): claude-opus · Questions asked: 5 · Captured: 4/14 · Bespoke captured: 3/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the interactive prompt was dismissed — I'll put the questions directly in chat so you can answer inline. These are the policy decisions the brief leaves open; each materially changes the interest figure, and each is an institutional choice rather than something I should guess. Please answer whichever you have views on; for any you leave, I'll record a stated default and flag it as an assumption to confirm.

## Interest Engine — Policy Questions

**Q1. Day-count convention** (how the daily rate is derived from the annual rate)
| Option | Answer | Implication |
|--------|--------|-------------|
| A | Actual/365 Fixed — annual ÷ 365 every day | Simplest; leap years earn slightly more in aggregate |
| B | Actual/Actual — ÷365 or ÷366 by year length | A full year always sums exactly to the annual rate |
| C | Actual/360 | Yields ~1.4% more interest than /365 |
| D | 30/360 | Bond convention; unusual for daily-balance savings |

**Q2. Compounding within a posting period**
| Option | Answer | Implication |
|--------|--------|-------------|
| A | Simple accrual on recorded daily balances | Interest compounds only once posted |
| B | Daily compounding | Each day's interest joins principal and earns more that period |

**Q3. Rounding** (precision, mode, and when)
| Option | Answer | Implication |
|--------|--------|-------------|
| A | Round final only, half-up, 2dp | Accrue full precision; round the posted total |
| B | Round final, banker's (half-even), 2dp | As A but half-even |
| C | Round each day to 2dp, then sum | Can diverge from end-rounding |
| D | Truncate final to 2dp | Never credits a fractional cent |

**Q4. Period endpoint days** (which daily balances count)
| Option | Answer | Implication |
|--------|--------|-------------|
| A | First inclusive, last exclusive `[start, end)` | The posting/end day itself earns no interest |
| B | Both inclusive | End day earns interest |
| C | First exclusive, last inclusive `(start, end]` | Start day earns no interest |

**Q5. Rate tiering** — is the "annual interest rate" a single flat rate for the whole balance, or tiered by balance band (e.g. 1% up to £5k, 2% above)?

**Q6. Negative / zero balances** — if a day's balance is zero or negative (overdrawn), does it earn nothing (floor at zero), or accrue negative interest (a debit)?

**Q7. Rate changes mid-period** — is the annual rate fixed for the entire period, or can it change on specific dates within the period (and the engine must apply each rate to the days it covers)?

**Q8. The returned "updated balance"** — should posted interest be added to the account balance (so `updated balance = final daily balance + interest posted`), and does that posting itself begin earning interest only in the *next* period? Also: is interest posted on the end date of the period?

You can answer tersely, e.g. `Q1: A, Q2: A, Q3: A, Q4: A, Q5: flat, Q6: floor at zero, Q7: fixed, Q8: yes/next period`. Once I have your answers I'll finalise `spec.md`.
A: Q1: C — Actual/360; daily rate = annual_rate / 360.
Q2: B — daily compounding; each day's interest joins the base for the next day's accrual within the period.
Q3: D — truncate (floor) to 2 dp at posting; the bank retains the fraction.
Q4: A — [start, end); the posting day is excluded from the period it closes and opens the next.
Q5: Flat — a single rate applies to the whole balance; no tiering.

That is 5 questions, which is the limit for this turn. Please finalise Q6–Q8 using your own stated defaults and flag them as assumptions for confirmation.

### Round 2
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in this directory (canonical copy also at `specs/001-interest-engine/spec.md`).

## What it contains

The brief named only the domain and the interface — every rule that actually determines the interest figure was left open. I treated those as policy decisions to settle with you rather than guess, since each has several plausible answers and only the institution knows the right one.

**Confirmed and baked into the requirements (Q1–Q5):**
- Actual/360 day-count (daily rate = annual ÷ 360)
- Daily compounding within the period
- Truncate to 2dp at posting; institution keeps the sub-cent fraction
- Half-open `[start, end)` — posting day excluded
- Flat rate, no tiering

**Stated defaults, explicitly flagged as assumptions to confirm (you deferred these):**
- Q6 — zero/negative-balance days earn nothing (never a debit)
- Q7 — one rate fixed for the whole period
- Q8 — interest added to the end-date balance, posted on the end date, earns only from the next period
- Plus a gap-fill rule for days missing a recorded balance (carry forward last known)

Each of those four is written up with a specific "Confirm:" question so they can be ratified or overridden before planning.

The spec also includes a worked example (annual 3.6%, 10,000.00 constant, 3-day period → **3.00 posted, 10,003.00 updated balance**) so the math is verifiable, plus 15 functional requirements, prioritised user stories, edge cases, and measurable success criteria. A quality checklist is at `specs/001-interest-engine/checklists/requirements.md`.

Next step when you're ready: ratify Q6–Q8 and the gap-fill rule, then `/speckit-plan`. Want me to fold your confirmations in now?
A: I've answered the 5 clarifying question(s) your process is allotted; I can't take more. Please finalise the specification now — use your process's own defaults or reasonable assumptions for anything still open — save it as spec.md, and tell me when it's done.

## Produced specification

# Feature Specification: Savings Interest Engine

**Feature Branch**: `001-interest-engine`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Interest engine for savings accounts. Given an account with a daily balance history over a period and an annual interest rate, compute the interest the account earns and post it. Build a function `post_interest(account, period)` that returns the interest posted and the account's updated balance."

## Overview

The interest engine computes the interest a savings account earns over a defined period and posts it to the account. It operates on the account's recorded daily balance history and its annual interest rate, applying the institution's chosen conventions, and returns both the interest posted and the updated balance.

The brief fixed the domain and the interface (`post_interest(account, period)`) but left every computational policy open. The policies below were confirmed with the product stakeholder (Q1–Q5) or set as stated defaults pending confirmation (Q6–Q8, see Assumptions). They are the material decisions that determine the figure produced.

### Confirmed policy decisions

| # | Decision | Chosen policy |
|---|----------|---------------|
| Q1 | Day-count convention | **Actual/360** — daily rate = annual rate ÷ 360, applied to each accrual day |
| Q2 | Intra-period compounding | **Daily compounding** — each day's interest joins the accrual base for the next day within the period |
| Q3 | Rounding | **Truncate (floor) to 2 decimal places at posting**; the institution retains the sub-cent fraction |
| Q4 | Period endpoints | **Half-open `[start, end)`** — the start date accrues; the end (posting) date is excluded and opens the next period |
| Q5 | Rate tiering | **Flat** — a single rate applies to the entire balance; no tiers |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Post interest for a standard period (Priority: P1)

As the savings platform, at the close of an interest period I compute the interest an account has earned on its daily balances and post it, so the customer is credited correctly and the ledger stays consistent.

**Why this priority**: This is the core of the feature. Without it there is no interest engine. It delivers the complete primary value: a correct interest figure and an updated balance.

**Independent Test**: Provide an account with a known daily balance history and annual rate and a period, call `post_interest(account, period)`, and verify the returned interest and updated balance match the hand-computed expected values under the confirmed policies.

**Acceptance Scenarios**:

1. **Given** an account with annual rate 3.6% and a constant recorded daily balance of 10,000.00 for the three accrual days 2026-01-01, 2026-01-02, 2026-01-03, **When** `post_interest` is called for the period [2026-01-01, 2026-01-04), **Then** the interest posted is 3.00 (daily rate 0.0001, compounded: 1.00 + 1.0001 + 1.00020001 = 3.00030001, truncated to 3.00) and the updated balance is 10,003.00.
2. **Given** the same account, **When** the interest is posted, **Then** the sub-cent remainder (0.00030001) is NOT credited to the customer and is retained by the institution.
3. **Given** an account whose daily balance varies across the period, **When** `post_interest` is called, **Then** each accrual day uses that day's recorded balance (plus interest accrued so far in the period) as its base.

---

### User Story 2 - Handle non-standard balances and periods (Priority: P2)

As the savings platform, I must behave predictably when balances are zero/negative, when the period is empty, or when the rate is zero, so that edge conditions never produce incorrect credits or errors in the ledger.

**Why this priority**: Correctness at the boundaries protects the institution and customers from mis-postings. It builds directly on P1 and is required before the engine can be trusted in production.

**Independent Test**: Supply accounts exercising each boundary condition and verify the engine returns the specified result (zero interest, unchanged balance, or a defined error) without crediting negative interest.

**Acceptance Scenarios**:

1. **Given** an accrual day whose effective base (recorded balance plus accrued interest) is zero or negative, **When** interest is computed for that day, **Then** that day contributes zero interest (never a negative/debit amount).
2. **Given** a period where start equals end (empty period), **When** `post_interest` is called, **Then** the interest posted is 0.00 and the balance is unchanged.
3. **Given** an annual rate of 0%, **When** `post_interest` is called, **Then** the interest posted is 0.00 and the balance is unchanged.

---

### Edge Cases

- **Empty period** (`start == end`): no accrual days; interest = 0.00; balance unchanged.
- **Invalid period** (`start > end`): rejected as an error; nothing is posted.
- **Zero or negative effective daily base**: contributes zero interest for that day; accrual is floored at zero and never becomes a debit (Q6 default).
- **Zero annual rate**: interest = 0.00; balance unchanged.
- **Missing daily balance for a day within the period**: the engine MUST have a defined rule. Default assumption: carry forward the most recent known balance (see Assumptions); if no prior balance exists, the day is treated as having a zero balance.
- **Sub-cent accrual only** (total accrued interest < 0.01): truncates to 0.00; nothing is posted; balance unchanged.
- **Leap day within the period**: Feb 29 is a normal accrual day; the daily divisor remains 360 (Actual/360), so each February day earns the standard daily rate.
- **Double posting / idempotency**: posting for a period that has already been posted is out of scope for the computation itself (see Assumptions); the caller is responsible for not re-posting the same period.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST accept an account and a period and return (a) the interest posted and (b) the account's updated balance.
- **FR-002**: The system MUST derive the daily interest rate as `annual_rate / 360` (Actual/360 day-count convention, Q1).
- **FR-003**: The system MUST accrue interest for each day in the half-open interval `[period.start, period.end)` — the start date accrues; the end date is excluded (Q4).
- **FR-004**: For each accrual day, the system MUST use as the accrual base that day's recorded daily balance plus all interest accrued so far within the current period (daily compounding, Q2).
- **FR-005**: The system MUST compute each day's interest as `base × (annual_rate / 360)` at full precision, carrying unrounded accrued interest between days.
- **FR-006**: The system MUST floor each day's interest contribution at zero: if the effective base for a day is zero or negative, that day contributes zero interest and never a negative amount (Q6 default assumption).
- **FR-007**: The system MUST apply a single flat rate to the entire balance; it MUST NOT apply balance tiers (Q5).
- **FR-008**: At posting, the system MUST truncate (round toward zero / floor for non-negative amounts) the total accrued interest to 2 decimal places; the retained sub-cent fraction MUST NOT be credited to the account (Q3).
- **FR-009**: The system MUST compute the updated balance as the account's balance as of the period end date plus the truncated interest posted.
- **FR-010**: The system MUST post the interest effective on the period end date; the posted interest begins earning interest only in the next period (Q8 default assumption).
- **FR-011**: The system MUST return interest of 0.00 and leave the balance unchanged when the period is empty, the annual rate is 0, or total accrued interest truncates to 0.00.
- **FR-012**: The system MUST reject an invalid period where `start > end` without posting any interest.
- **FR-013**: The annual interest rate MUST be treated as fixed for the entire period; the engine applies one rate to all accrual days (Q7 default assumption).
- **FR-014**: All monetary amounts (balances and interest) MUST be represented and computed with exact decimal arithmetic to 2 decimal places of currency precision, avoiding binary floating-point rounding error in posted figures.
- **FR-015**: The system MUST have a defined rule for days within the period that lack a recorded balance; the default is to carry forward the most recent known balance (see Assumptions).

### Key Entities *(include if feature involves data)*

- **Account**: A savings account. Key attributes: current balance, annual interest rate (flat), and a daily balance history (a record of the end-of-day balance for each date). The balance is expressed in a single currency with 2-decimal minor units.
- **Daily balance history**: A mapping of date → end-of-day balance over the account's lifetime. The engine reads the entries falling in the accrual window.
- **Period**: A half-open date interval `[start, end)`. `start` is the first accrual day; `end` is the posting date and is excluded from accrual.
- **Posting result**: The output of the engine — the interest amount posted (2dp) and the updated account balance (2dp).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any account, daily balance history, and period, the interest posted equals the hand-computed value under the five confirmed policies (Actual/360, daily compounding, truncate-to-2dp at posting, `[start, end)`, flat rate) with zero discrepancy.
- **SC-002**: 100% of posted interest figures are expressed to exactly 2 decimal places and are never greater than the exact accrued amount (truncation never over-credits).
- **SC-003**: For every account, `updated balance − prior end-date balance` equals the interest posted, exactly, in 100% of postings.
- **SC-004**: No posting ever credits a negative interest amount; 100% of zero/negative-base days contribute zero.
- **SC-005**: Empty periods, zero rates, and sub-cent accruals produce a 0.00 posting and an unchanged balance in 100% of such cases.
- **SC-006**: Posting a full calendar year of a constant balance B at annual rate r yields interest equal to the Actual/360 daily-compounded accumulation of B (i.e. `B × ((1 + r/360)^N − 1)` for N accrual days), truncated to 2dp — verifiable against an independent calculation.

## Assumptions

The following were confirmed by the stakeholder:

- **Day-count = Actual/360** (Q1): daily rate = annual rate ÷ 360.
- **Daily compounding within the period** (Q2): each day's interest joins the base for the next day's accrual.
- **Truncate to 2dp at posting** (Q3): the institution retains the sub-cent fraction.
- **Half-open period `[start, end)`** (Q4): the posting day is excluded from the period it closes and opens the next.
- **Flat rate, no tiering** (Q5).

The following are **stated defaults pending stakeholder confirmation** — chosen as the most conventional retail-savings behaviour, and flagged here so they can be ratified or overridden:

- **Zero/negative balances earn nothing** (Q6, ASSUMPTION): a day whose effective base is ≤ 0 contributes zero interest; the engine never accrues a debit. *Confirm: should overdrawn days instead accrue negative (debit) interest?*
- **Rate fixed for the whole period** (Q7, ASSUMPTION): a single annual rate applies to all accrual days; the engine does not handle rate changes mid-period. *Confirm: can the rate change on dates within a period, requiring per-segment rates?*
- **Posting mechanics** (Q8, ASSUMPTION): posted interest is added to the balance as of the period end date (`updated balance = end-date balance + posted interest`), is posted effective on the end date, and begins earning interest only in the next period. *Confirm the posting effective date and that posted interest does not compound within the period that produced it.*
- **Missing daily balances** (ASSUMPTION, supports FR-015): if a date within the period has no recorded balance, carry forward the most recent known balance; if none exists, treat the day as zero balance. *Confirm the gap-fill rule.*
- **Currency**: all amounts are in a single currency with 2-decimal minor units; multi-currency and configurable minor-unit precision are out of scope for this version.
- **Idempotency / double-posting**: preventing re-posting of an already-posted period is the caller's responsibility and out of scope for this computation.
- **Rate sign/validity**: the annual rate is assumed to be a non-negative value; negative-rate accounts are out of scope unless confirmed.

## Worked Example *(illustrative, for verification)*

- Annual rate: 3.6% → daily rate = 0.036 ÷ 360 = 0.0001 (0.01%/day)
- Period: [2026-01-01, 2026-01-04) → 3 accrual days (Jan 1, 2, 3; Jan 4 excluded)
- Recorded end-of-day balance each accrual day: 10,000.00

| Day | Base (balance + accrued) | Day interest (base × 0.0001) | Accrued total |
|-----|--------------------------|------------------------------|---------------|
| Jan 1 | 10,000.000000 | 1.00000000 | 1.00000000 |
| Jan 2 | 10,001.000000 | 1.00010000 | 2.00010000 |
| Jan 3 | 10,002.000100 | 1.00020001 | 3.00030001 |

- Total accrued: 3.00030001 → **truncated to 2dp = 3.00 posted** (0.00030001 retained by the institution)
- Balance as of end date (2026-01-04) before posting: 10,000.00
- **Updated balance = 10,000.00 + 3.00 = 10,003.00**


## Auditor verdict

_The spec is a thorough, well-formed treatment of the core per-period computation but matches the reference on only the convention/boundary decisions, not the method or lifecycle. Correct: #2 (daily compounding), #4 (360), #6 (floor rounding), #12 (half-open period) = 4/14. The central method decision #1 diverges (per-day daily balance vs average daily balance), and #13 explicitly assumes the opposite of the per-segment rate rule. All lifecycle decisions (#8 dormancy, #9 closure, #10 escheatment) and the tax (#7), minimum-balance threshold (#5), posting frequency (#3), and reporting shape (#14) are absent. #11 is partially matched but fails on negative-rate rejection. Coverage = 4/14; the in-focus method/lifecycle subset [1,2,3,8,9,10] scores only #2._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | no | FR-004: 'For each accrual day, the system MUST use as the accrual base that day's recorded daily balance plus all interest accrued so far within the current period (daily compounding, Q2).' Worked Example applies the rate per-day to each day's balance. | The spec uses a per-day daily-balance method with daily compounding, not average daily balance (summing daily balances, dividing by days, applying the rate once). The reference explicitly excludes per-day daily-balance, so this is a plausible-but-different method. |
| 2 | yes | **yes** | Q2: 'Daily compounding — each day's interest joins the accrual base for the next day within the period'; FR-004. | Matches the reference: interest compounds daily, each day's interest joining the base for the next day's accrual within the period. |
| 3 | no | no | absent | The spec treats the posting period as a caller-supplied input [start, end) and never specifies posting frequency or timing. There is no mention of quarterly posting or anniversary-of-opening dates. |
| 4 | yes | **yes** | Q1: 'Actual/360 — daily rate = annual rate ÷ 360'; FR-002: 'derive the daily interest rate as annual_rate / 360'. | Matches the reference 360 basis with the daily rate computed as annual_rate / 360. |
| 5 | no | no | absent | The spec has no minimum-balance threshold for earning interest. Its only floor is zero/negative base (FR-006); there is no 1,000 threshold below which a day contributes zero interest. |
| 6 | yes | **yes** | Q3: 'Truncate (floor) to 2 decimal places at posting; the institution retains the sub-cent fraction'; FR-008. | Matches the reference: posted interest floored to the minor unit (2dp), never half-up, with the bank keeping the fraction. |
| 7 | no | no | absent | The spec never mentions withholding tax. There is no 15% deduction, no gross/net split, and no separate tax reporting. |
| 8 | no | no | absent | The spec contains no dormancy concept: no 12-month inactivity trigger, no continued accrual while dormant, and no monthly dormancy fee of 5. |
| 9 | no | no | absent | The spec does not address account closure mid-period or pro-rata accrual to a closure date; closure is not mentioned at all. |
| 10 | no | no | absent | The spec has no escheatment provision: no 5-year dormant trigger, no remittance to the state, no closure to zero balance. |
| 11 | yes | no | FR-006 floors zero/negative base days at zero; FR-011 posts 0.00 for zero rate/empty period; Assumptions: 'the annual rate is assumed to be a non-negative value; negative-rate accounts are out of scope unless confirmed.' | Zero balance posting zero and never going negative match, but the reference requires a negative rate to be rejected as invalid, whereas the spec leaves negative rates out of scope rather than rejecting them, so the bundle is not fully matched. |
| 12 | yes | **yes** | Q4: 'Half-open [start, end) — the start date accrues; the end (posting) date is excluded and opens the next period'; FR-003. | Matches the reference: periods are half-open [start, end) with the posting day excluded from the period it closes and included in the next. |
| 13 | yes | no | Q7 (ASSUMPTION) / FR-013: 'The annual interest rate MUST be treated as fixed for the entire period; the engine applies one rate to all accrual days.' | The spec explicitly assumes a single fixed rate and does not handle mid-period rate changes, the opposite of the reference requirement to apply the rate in force per day summed by rate-segment. |
| 14 | yes | no | FR-001 and Key Entities 'Posting result': returns only 'the interest amount posted (2dp) and the updated account balance (2dp)'. | The spec returns only interest posted and updated balance. It omits the reference's required disclosure of gross interest, tax withheld, net interest, average daily balance used, and qualifying days. |
