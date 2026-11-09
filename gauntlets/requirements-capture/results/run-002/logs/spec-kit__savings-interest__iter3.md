# spec-kit — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 5 · Captured: 5/14 · Bespoke captured: 3/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like that interactive prompt didn't go through. Let me put the questions to you directly in text — please answer by number. I have more than four material decisions, so here they are grouped. Answer what you can; for any you don't care about, say "default" and I'll pick a sensible, clearly-documented default.

## Round 1 — decisions that directly change the computed interest amount

**Q1 — Day-count convention** (how the annual rate becomes a daily rate)
- **A.** Actual/365 fixed (÷365 always)
- **B.** Actual/Actual (÷365, but ÷366 in leap years)
- **C.** Actual/360 (money-market basis; ~1.4% more interest)
- **D.** 30/360

**Q2 — Simple vs. compound**
- **A.** Simple — sum each day's `balance × daily rate`, post once; accrued interest doesn't earn within the period
- **B.** Daily compounding
- **C.** Monthly compounding

**Q3 — Rounding** (to the currency minor unit, e.g. cents)
- **A.** Accrue at full precision, round the final total once, **half-up**
- **B.** Full precision, round final once, **banker's (half-even)**
- **C.** Round each day's accrual, then sum
- **D.** Truncate (always round down)

**Q4 — Negative / overdrawn daily balances**
- **A.** Days with balance ≤ 0 earn nothing (no debit either)
- **B.** Accrue negative interest at the same rate (can reduce total)
- **C.** Treat a negative balance as invalid input → error

## Round 2 — period boundaries and policy

**Q5 — Period boundaries / day counting.** Given a period with a start and end date, which days accrue? 
- **A.** Both endpoints inclusive (count start day *and* end day)
- **B.** Half-open — include start, exclude end (standard for interest accrual)
- **C.** Include end, exclude start

**Q6 — The daily balance used for a day.** Is each entry in the balance history the **end-of-day** balance that earns that day's interest, and if a date in the period has **no entry**, what happens?
- **A.** Entries are end-of-day; carry the last known balance forward for gap days
- **B.** Entries are end-of-day; a missing day is an error (history must be complete)
- **C.** Something else (describe)

**Q7 — Rate structure & representation.**
- Is the annual rate a **single flat rate** for the whole period, or can it be **tiered by balance** and/or **change mid-period**?
- Is it supplied as a **decimal** (0.05) or a **percentage** (5.0)?

**Q8 — Tax withholding.** Should the engine withhold tax on interest at posting (e.g. a withholding-tax rate), or is interest posted gross with tax handled elsewhere?
- **A.** Gross — no tax handling here
- **B.** Withhold tax at a configured rate and post net (plus report the amount withheld)

And three smaller ones so the result is unambiguous:

**Q9 — Minimum balance to earn interest.** Is there a threshold below which no interest accrues (e.g. must hold ≥ X)? (A: none / B: yes, configurable threshold)

**Q10 — "Updated balance" semantics.** I'm assuming `post_interest` **adds** the posted interest to the closing balance and returns that, and that posting is **idempotent-safe** isn't guaranteed (i.e. calling twice posts twice). Confirm, or tell me the posting should be recorded/guarded against double-posting.

**Q11 — Currency / precision.** What's the minor unit — standard 2-decimal currency (cents), or something else (0-decimal like JPY, 3-decimal, or a defined smallest-unit)?

Once you answer, I'll encode everything into `spec.md` (with any "default" choices explicitly flagged as assumptions).
A: Answering Q1–Q5; that is the 5-question budget for this turn. Finalise Q6–Q11 using your own documented defaults.

**Q1 — Day-count convention:** C. Actual/360. Daily rate = annual_rate ÷ 360.

**Q2 — Simple vs. compound:** B. Daily compounding — each day's accrued interest joins the principal base for the following day's accrual within the period.

**Q3 — Rounding:** D. Truncate (floor to the minor unit). The bank retains the sub-unit fraction; never half-up.

**Q4 — Negative / overdrawn daily balances:** A. Days with balance ≤ 0 earn nothing and no debit is charged. (The account design means a negative balance should not arise, but if it does, treat it as zero contribution.)

**Q5 — Period boundaries:** B. Half-open [start, end) — the start day is included, the end (posting) day is excluded from the closing period and counted in the next one.

That is all the clarification I can give this turn. Use your own clearly-flagged defaults for Q6–Q11.

### Round 2
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as **`spec.md`** in this directory (the canonical copy also lives at `specs/001-savings-interest-engine/spec.md`, with a passing quality checklist alongside it).

## What I did

The brief named only the domain and the interface and left every material policy decision out. For a money calculation, guessing those silently would produce results that look right but are financially wrong, so my process surfaced them as questions rather than inventing answers. You confirmed the five that most change the computed figure; I finalized the rest as clearly-flagged defaults.

**Confirmed by you (Q1–Q5):**
- **Actual/360** day count (`daily_rate = annual_rate / 360`)
- **Daily compounding** within the period
- **Truncate** to the minor unit — bank retains the sub-unit fraction
- Days with balance **≤ 0 earn nothing, no debit**
- **Half-open `[start, end)`** period

**My documented defaults (Q6–Q11 + rounding timing), each flagged `[DEFAULT]` and listed in Assumptions:**
- Full-precision accrual, truncate once at posting
- End-of-day balances with last-known carried forward over gaps; error if no balance known at/before start
- Single flat decimal rate; gross (no tax); no minimum balance; non-idempotent posting; 2-dp minor unit (parameterizable)

The spec includes a **normative worked example** (10,000.00 at 9% over `[Jan 1, Jan 4)` → interest **7.50**, updated balance **10,007.50**) so the math is unambiguous and testable, plus functional requirements, acceptance scenarios, edge cases, and measurable success criteria.

One thing worth flagging: I resolved **Q3's rounding *timing*** myself (truncate once at posting, not per-day). With daily compounding this choice shifts the posted figure slightly, so if your institution truncates each day's accrual instead, tell me and I'll adjust FR-007 and the worked example. The next step in my normal flow would be `/speckit-plan`.
A: I've answered the 5 clarifying question(s) your process is allotted; I can't take more. Please finalise the specification now — use your process's own defaults or reasonable assumptions for anything still open — save it as spec.md, and tell me when it's done.

## Produced specification

# Feature Specification: Savings Account Interest Engine

**Feature Branch**: `001-savings-interest-engine`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Interest engine for savings accounts. Build a function `post_interest(account, period)` that, given an account with a daily balance history over a period and an annual interest rate, computes the interest the account earns over the period and posts it, returning the interest posted and the account's updated balance."

## Overview

The interest engine computes the interest a savings account earns over a defined period from its daily
balance history and its annual interest rate, posts that interest to the account, and returns both the
interest posted and the account's updated balance.

Because this is a money-handling calculation, every policy decision that affects the posted amount is
stated explicitly below. The decisions flagged **[STAKEHOLDER-CONFIRMED]** were confirmed by the product
stakeholder. The decisions flagged **[DEFAULT]** are reasonable defaults chosen where the stakeholder
deferred; each is called out again in the Assumptions section so it can be revisited.

### Confirmed policy decisions (the heart of the calculation)

| # | Decision | Choice | Flag |
|---|----------|--------|------|
| 1 | Day-count convention | **Actual/360** — `daily_rate = annual_rate / 360` | [STAKEHOLDER-CONFIRMED] |
| 2 | Simple vs. compound | **Daily compounding** within the period — each day's accrued interest joins the earning base for the next day | [STAKEHOLDER-CONFIRMED] |
| 3 | Rounding mode | **Truncate (floor)** to the currency minor unit — the bank retains the sub-unit fraction; never half-up | [STAKEHOLDER-CONFIRMED] |
| 3b | Rounding timing | Accrue at **full precision internally**; truncate **once at posting** | [DEFAULT] |
| 4 | Non-positive daily balances | Days with balance **≤ 0 earn nothing and incur no debit** | [STAKEHOLDER-CONFIRMED] |
| 5 | Period boundaries | **Half-open `[start, end)`** — start day included, end (posting) day excluded | [STAKEHOLDER-CONFIRMED] |
| 6 | Daily balance semantics / gaps | Each entry is the **end-of-day** earning balance; missing days **carry the last known balance forward** | [DEFAULT] |
| 7 | Rate structure & format | **Single flat annual rate**, supplied as a **decimal fraction** (0.09 = 9%) | [DEFAULT] |
| 8 | Tax withholding | **Gross** — no withholding performed by this engine | [DEFAULT] |
| 9 | Minimum balance to earn | **None** | [DEFAULT] |
| 10 | Posting semantics | Adds truncated interest to the closing balance; **not idempotent** (double-posting guard is the caller's responsibility) | [DEFAULT] |
| 11 | Currency minor unit | **Two decimal places** by default, parameterizable | [DEFAULT] |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Post interest for a steady-balance account (Priority: P1)

As the savings platform, at the end of an interest period I need to compute and post the interest an
account earned on its balances so the customer is credited the correct amount and the account balance
reflects it.

**Why this priority**: This is the core of the feature. Without correct computation and posting of
interest on a straightforward account, the engine has no value.

**Independent Test**: Provide an account with a constant positive balance across a known period and a
known annual rate; call `post_interest`; verify the returned interest equals the daily-compounded,
Actual/360, truncated result and that the updated balance equals the closing balance plus that interest.

**Acceptance Scenarios**:

1. **Given** an account with a balance of 10,000.00 on every day of a 3-day period `[Jan 1, Jan 4)` and
   an annual rate of 0.09, **When** `post_interest` is called, **Then** the interest posted is 7.50 and
   the updated balance is 10,007.50. *(See Worked Example below.)*
2. **Given** the same account, **When** `post_interest` returns, **Then** it returns both the interest
   posted (7.50) and the updated balance (10,007.50).

---

### User Story 2 - Account whose balance changes during the period (Priority: P1)

As the savings platform, I need interest computed correctly when the daily balance varies (deposits,
withdrawals) during the period, including days with no recorded transaction.

**Why this priority**: Real accounts change balance; a correct engine must handle varying daily balances
and sparse histories, not just a constant balance.

**Independent Test**: Provide a history where the balance changes partway through the period and where
some in-period dates have no entry; verify each day uses the correct end-of-day balance (carrying the
last known balance forward across gap days) and that compounding uses `recorded_balance + accrued`.

**Acceptance Scenarios**:

1. **Given** a history with an entry on the first day and a later deposit mid-period but no entries on the
   intervening days, **When** interest is computed, **Then** each gap day earns on the last known balance
   carried forward.
2. **Given** a day whose end-of-day balance is 0 or negative, **When** interest is computed, **Then** that
   day contributes no interest and no debit, while previously accrued interest is retained.

---

### User Story 3 - Degenerate and boundary inputs (Priority: P2)

As the savings platform, I need predictable, safe behavior for empty or boundary periods and invalid
inputs so posting never silently produces a wrong credit.

**Why this priority**: Correct handling of edge inputs prevents incorrect credits/debits and makes the
engine safe to run unattended across millions of accounts.

**Independent Test**: Exercise zero-length periods, a period with no earning days, and inputs with no
known starting balance; verify interest of 0 where appropriate and a clear error where the input is
unusable.

**Acceptance Scenarios**:

1. **Given** a period where `start == end` (zero accrual days), **When** `post_interest` is called,
   **Then** interest posted is 0 and the balance is unchanged.
2. **Given** a period in which every earning day has a balance ≤ 0, **When** `post_interest` is called,
   **Then** interest posted is 0 and the balance is unchanged.
3. **Given** a period whose start has no known balance at or before it, **When** `post_interest` is
   called, **Then** the engine raises an error rather than assuming a balance.

---

### Edge Cases

- **Zero-length period** (`start == end`): no earning days → interest 0, balance unchanged.
- **All earning days non-positive**: interest 0, no debit, balance unchanged.
- **Sparse history (gap days)**: carry the last known end-of-day balance forward to each gap day.
- **No balance known at or before `start`**: error — the engine must not invent an opening balance.
- **Balance history entries outside the period**: ignored for accrual, except the latest entry at or
  before `start` establishes the opening earning balance.
- **Sub-minor-unit total** (e.g. computed 0.004 for a 2-dp currency): truncates to 0.00 → interest 0.
- **Negative annual rate**: out of scope for v1 (see Assumptions); treat as invalid input.
- **Fraction retained**: the difference between the full-precision accrual and the truncated posted
  amount is retained by the institution and is not credited to the customer.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The engine MUST accept an account exposing a daily balance history and an annual interest
  rate, and a period defined by a start date and an end date.
- **FR-002**: The engine MUST interpret the period as half-open `[start, end)` — the start day is an
  earning day and the end (posting) day is excluded. *(Decision 5)*
- **FR-003**: The engine MUST convert the annual rate to a daily rate using the **Actual/360** convention:
  `daily_rate = annual_rate / 360`. *(Decision 1)*
- **FR-004**: For each earning day in the period, the engine MUST determine that day's end-of-day balance
  from the history, carrying the last known balance forward across days with no entry. *(Decision 6)*
- **FR-005**: The engine MUST compound interest daily within the period: the earning base for a day is the
  day's end-of-day balance **plus** interest accrued on prior days of the same period (not yet posted).
  *(Decision 2)*
- **FR-006**: For any day whose end-of-day balance is ≤ 0, the engine MUST accrue no interest and apply no
  debit for that day; previously accrued interest MUST be retained. *(Decision 4)*
- **FR-007**: The engine MUST accrue at full precision internally and MUST truncate (floor) the final
  accrued total to the currency's minor unit exactly once, at posting. It MUST NOT round half-up or to
  nearest. *(Decisions 3, 3b)*
- **FR-008**: The engine MUST post the truncated interest by adding it to the account's closing balance and
  MUST return both the interest posted and the resulting updated balance. *(Decision 10)*
- **FR-009**: The engine MUST return an interest of 0 and leave the balance unchanged when there are no
  earning days or when no earning day has a positive balance.
- **FR-010**: The engine MUST raise an error when no balance is known at or before the period start.
  *(Edge case)*
- **FR-011**: The engine MUST treat the annual rate as a single flat decimal fraction applicable to the
  whole period. Tiered, variable, or mid-period rate changes are out of scope for v1. *(Decision 7)*
- **FR-012**: The engine MUST NOT withhold tax; interest is posted gross. *(Decision 8)*
- **FR-013**: The engine MUST apply no minimum-balance threshold; every day with a positive balance earns.
  *(Decision 9)*
- **FR-014**: The currency minor unit MUST default to two decimal places and MUST be parameterizable to
  support other precisions (e.g. 0-decimal currencies). *(Decision 11)*
- **FR-015**: Posting is NOT guaranteed idempotent; calling the engine twice for the same period posts
  interest twice. Preventing double-posting is the caller's responsibility. *(Decision 10)*

### Computation Model (normative)

Let `r` = annual rate (decimal), `d = r / 360` (daily rate). Process earning days in chronological order
over `[start, end)`. Maintain `accrued = 0` at full precision.

For each earning day `t`:
1. `balance_t` = end-of-day balance for `t` (last known value carried forward).
2. If `balance_t > 0`: `base_t = balance_t + accrued`; `interest_t = base_t * d`; `accrued += interest_t`.
3. Else (`balance_t ≤ 0`): no change to `accrued`.

After the last earning day: `interest_posted = truncate(accrued, minor_unit)`;
`updated_balance = closing_balance + interest_posted`, where `closing_balance` is the account's balance
as of the end of the period. Return `(interest_posted, updated_balance)`.

### Worked Example (normative test vector)

- Annual rate `r = 0.09` → daily rate `d = 0.09 / 360 = 0.00025`.
- Period `[Jan 1, Jan 4)` → earning days: Jan 1, Jan 2, Jan 3 (Jan 4 excluded).
- Balance = 10,000.00 on every earning day; currency minor unit = 2 dp.

| Day | Base (balance + accrued) | Interest (base × 0.00025) | Accrued (full precision) |
|-----|--------------------------|---------------------------|--------------------------|
| Jan 1 | 10,000.000000 | 2.500000 | 2.500000 |
| Jan 2 | 10,002.500000 | 2.500625 | 5.000625 |
| Jan 3 | 10,005.000625 | 2.501250… | 7.501875… |

`interest_posted = truncate(7.501875…, 2) = 7.50`;
`updated_balance = 10,000.00 + 7.50 = 10,007.50`.

### Key Entities *(include if feature involves data)*

- **Account**: Represents a customer's savings account. Exposes a daily balance history (dated end-of-day
  balances), an annual interest rate (decimal fraction), a currency minor unit (decimal places), and a
  current/closing balance. Receives posted interest.
- **Daily Balance History**: An ordered set of dated end-of-day balances. May be sparse; gaps are filled by
  carrying the last known balance forward. The latest entry at or before the period start establishes the
  opening earning balance.
- **Period**: A half-open date range `[start, end)` over which interest is computed and at whose end
  interest is posted.
- **Interest Posting Result**: The pair `(interest_posted, updated_balance)` returned to the caller.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For the normative Worked Example, the engine returns interest 7.50 and updated balance
  10,007.50 — exactly, with no rounding drift.
- **SC-002**: 100% of posted amounts are at or below the full-precision accrued value (truncation never
  over-credits the customer).
- **SC-003**: For any period with no earning days or no positive-balance earning day, the engine returns
  interest 0 and leaves the balance unchanged in 100% of cases.
- **SC-004**: Re-running computation on identical inputs produces an identical posted amount every time
  (deterministic; no floating-point nondeterminism in the posted figure).
- **SC-005**: Every policy decision affecting the posted amount (day-count, compounding, rounding, boundary,
  non-positive handling) is covered by at least one acceptance test with a hand-verified expected value.
- **SC-006**: An input with no balance known at or before the period start is rejected with a clear error
  in 100% of cases (never silently assumes a balance).

## Assumptions

The following were chosen as defaults because the stakeholder confirmed Q1–Q5 but deferred the rest. Each
is flagged **[DEFAULT]** and can be revisited without changing the confirmed core math.

- **[DEFAULT] Rounding timing**: Interest is accrued at full precision and truncated to the minor unit
  exactly once, at posting — not truncated per day. This maximizes accuracy while honoring the confirmed
  "truncate, bank retains the fraction" rule.
- **[DEFAULT] Balance semantics & gaps (Q6)**: Each history entry is an end-of-day balance that earns that
  day's interest; days with no entry carry the last known balance forward. The latest entry at or before
  `start` sets the opening balance; if none exists, the engine errors.
- **[DEFAULT] Rate structure & format (Q7)**: A single flat annual rate for the whole period, supplied as a
  decimal fraction (0.09 = 9%). Tiered-by-balance rates, mid-period rate changes, and percentage-form input
  are out of scope for v1.
- **[DEFAULT] Tax (Q8)**: Interest is posted gross; no withholding tax is computed or deducted here.
- **[DEFAULT] Minimum balance (Q9)**: No minimum-balance threshold; any positive daily balance earns.
- **[DEFAULT] Posting semantics & idempotency (Q10)**: `post_interest` adds the truncated interest to the
  account's closing balance and returns `(interest_posted, updated_balance)`. It does not record a posting
  marker or guard against being called twice for the same period; preventing double-posting is the caller's
  responsibility.
- **[DEFAULT] Currency minor unit (Q11)**: Two decimal places by default, parameterizable for other
  currencies (e.g. 0-decimal).
- **[DEFAULT] Negative annual rate**: Out of scope for v1; treated as invalid input.
- **[DEFAULT] Single currency per account**: The account's balances and rate share one currency; no FX.

### Dependencies

- Requires the account to expose its daily balance history, annual rate, currency minor unit, and closing
  balance to the engine.
- Persisting the posted interest and the updated balance (and any double-posting guard) is the
  responsibility of the surrounding system, not this engine.


## Auditor verdict

_The spec matches the reference on the control/convention decisions it inherited by coincidence of the engineer's defaults — day-count 360 (4), daily compounding (2), floor rounding (6), half-open boundaries (12), and the inferable edge handling (11). It fails the bespoke method and lifecycle decisions: it uses per-day daily-balance rather than average daily balance (1), posts gross instead of 15% withholding (7), applies no minimum balance instead of 1,000 (5), punts mid-period rate changes out of scope instead of per-segment (13), and returns a two-field result instead of the six-field disclosure (14). The three lifecycle decisions (8 dormancy, 9 closure, 10 escheatment) and the posting-period/anniversary decision (3) are entirely absent — the spec treats the posting period as an input and never models the account lifecycle. Coverage: 5/14 correct (2, 4, 6, 11, 12). Of the core in-focus six [1,2,3,8,9,10] only decision 2 is correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | no | FR-005: 'The engine MUST compound interest daily within the period: the earning base for a day is the day's end-of-day balance plus interest accrued'; Computation Model: 'interest_t = base_t * d; accrued += interest_t' | The spec computes interest per-day on each day's own balance (daily-balance method with compounding), not by averaging the daily balances over the period and applying the rate once. Reference requires average daily balance, which the spec explicitly does not use. |
| 2 | yes | **yes** | Decision 2: 'Daily compounding within the period — each day's accrued interest joins the earning base for the next day'; FR-005 | Spec states daily compounding within the period, matching the reference exactly. |
| 3 | no | no | absent | The spec takes the posting period as a given input argument and never specifies posting frequency; quarterly posting on the account-opening anniversary is not addressed anywhere. |
| 4 | yes | **yes** | FR-003: 'convert the annual rate to a daily rate using the Actual/360 convention: daily_rate = annual_rate / 360' | Spec specifies 360-day basis with daily rate = annual_rate/360, matching the reference. |
| 5 | yes | no | Decision 9 / FR-013: 'Minimum balance to earn: None'; 'The engine MUST apply no minimum-balance threshold; every day with a positive balance earns' | Spec addresses the minimum-balance threshold but sets it to None, whereas the reference requires a 1,000 threshold. Different value, so not correct. |
| 6 | yes | **yes** | Decision 3: 'Truncate (floor) to the currency minor unit — the bank retains the sub-unit fraction; never half-up'; FR-007 | Spec specifies floor/truncate to 2dp with the institution keeping the fraction, matching the reference precisely. |
| 7 | yes | no | Decision 8 / FR-012: 'Gross — no withholding performed by this engine'; 'The engine MUST NOT withhold tax; interest is posted gross' | Spec addresses withholding tax but explicitly posts gross with no withholding, the opposite of the reference's 15% withholding at posting. Not correct. |
| 8 | no | no | absent | No mention of dormancy, a 12-month inactivity trigger, continued accrual while dormant, or a monthly dormancy fee anywhere in the spec. |
| 9 | no | no | absent | The spec handles partial/half-open periods generically but never addresses account closure mid-period or pro-rata accrual-and-post on closure. |
| 10 | no | no | absent | No mention of escheatment, a 5-year dormancy-to-state trigger, or remitting the balance to the state. |
| 11 | yes | **yes** | Edge Cases: 'Negative annual rate: out of scope for v1 ... treat as invalid input'; FR-006 days ≤0 'accrue no interest and apply no debit'; FR-009 returns interest 0 for no positive-balance days | Spec rejects negative rate as invalid, posts zero interest for a zero/non-positive balance, and never debits (no overdraft), matching the reference's inferable anchor. |
| 12 | yes | **yes** | FR-002: 'interpret the period as half-open [start, end) — the start day is an earning day and the end (posting) day is excluded' | Spec uses half-open [start, end) boundaries with the posting day excluded, matching the reference's period-boundary rule. |
| 13 | yes | no | FR-011: 'Tiered, variable, or mid-period rate changes are out of scope for v1' | Spec mentions mid-period rate changes but declares them out of scope rather than computing per-rate-segment with each day using the rate in force. Opposite resolution, not correct. |
| 14 | yes | no | FR-008 / Interest Posting Result: returns 'the pair (interest_posted, updated_balance)' | Spec returns only interest posted and updated balance; it omits gross interest, tax withheld, net interest, the average daily balance used, and the number of qualifying days required by the reference output shape. |
