# spec-kit — savings-interest — iteration 2

Model (author): claude-opus · Questions asked: 5 · Captured: 5/14 · Bespoke captured: 3/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured prompt didn't go through. Let me put the questions to you in plain text instead — please answer by number. These are the material policy decisions the brief leaves open; each has several plausible answers and the computed interest depends on which one your institution uses.

## Clarification questions

**Q1 — Day-count convention (annual → daily rate)**
- **A.** Actual/365 fixed: daily rate = annual_rate / 365 every day (incl. leap years)
- **B.** Actual/360: daily rate = annual_rate / 360
- **C.** Actual/Actual: /365 in normal years, /366 in leap years

**Q2 — Accrual method**
- **A.** Simple, posted once: sum each day's (balance × daily rate), post one amount at period end; accrued interest doesn't earn interest within the period
- **B.** Daily compounding: each day's interest capitalized and earns interest on later days in the period
- **C.** Monthly compounding: simple within a month, capitalize at month boundaries

**Q3 — Rounding**
- **A.** Round final posted amount to nearest minor unit (cent/penny), half-up
- **B.** Round final amount, banker's rounding (half-to-even)
- **C.** Round each day's accrual to the minor unit, then sum
- (also: what precision — nearest penny? and does interest accrue at full precision until posting?)

**Q4 — Daily balance basis & day counting**
- **A.** End-of-day (closing) balance; both start and end dates inclusive (N+1 days)
- **B.** End-of-day balance; start inclusive, end exclusive (N days, half-open)
- **C.** Start-of-day (opening) balance; both ends inclusive

**Q5 — Negative / overdraft balances**
- **A.** Accrue negative interest on negative daily balances (same rate)
- **B.** Treat negative daily balances as zero for interest (no interest earned, none charged)
- **C.** Overdraft isn't possible / out of scope — treat as an error

**Q6 — Posting mechanics**
- Does `post_interest` **add the computed interest to the account balance** (capitalize it into principal), or just record it as a separate posted-interest figure?
- Should it **mutate** the passed-in account, or return a new/updated account value leaving the input unchanged?
- What **date** is the interest posted on (last day of period? first day of next period?), and does `post_interest` guard against **double-posting** if called twice for the same period?

**Q7 — Rate structure**
- The brief says "an annual interest rate" (singular). Confirm: a **single flat rate**, constant across the whole period? Or can the rate be **tiered by balance** or **change mid-period**?

**Q8 — Zero / empty inputs**
- How should an empty period, a period with no balance history, or a zero rate behave — return zero interest, or an error?

Answer whichever you have a position on (e.g. "Q1: A, Q2: A, Q3: A nearest penny, …"). For any you'd rather I pick a sensible default on, say so and I'll record it as a documented assumption. Once I have your answers I'll finalize `spec.md`.
A: Q1: B — Actual/360. Daily rate = annual_rate / 360, every day regardless of leap year.

Q2: B — Daily compounding. Each day's interest is capitalised into the running balance for the following day's accrual within the period.

Q3: Neither A nor B exactly. Floor to the minor unit (2 dp) — the bank retains any sub-penny fraction. Do not round half-up or use banker's rounding. Accrual accumulates at full precision internally; only the final posted figure is floored.

Q4: B — End-of-day (closing) balance; half-open interval [start, end). The posting date is excluded from the period it closes and belongs to the next period.

Q5: C — The account cannot go negative; a negative balance is an error condition, out of scope for this product.

That is 5 questions, which is the limit I can answer this turn. Please apply your own documented defaults for Q6, Q7, and Q8 and finalise the spec accordingly.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Done. The specification is complete and saved.

## `spec.md` is ready

**Deliverable**: `spec.md` (in this directory). Also mirrored into the spec-kit structure at `specs/001-interest-engine/spec.md`, with a passing quality checklist at `specs/001-interest-engine/checklists/requirements.md`.

### How I got here
The brief was deliberately silent on every material policy decision, and in a financial interest calculation those choices *change the number* — so rather than guess and bury assumptions, I put them to you as the stakeholder. You confirmed five:

| # | Decision | Your policy |
|---|----------|-------------|
| Q1 | Day count | **Actual/360** — daily rate = `annual/360`, leap years included |
| Q2 | Accrual | **Daily compounding** within the period |
| Q3 | Rounding | **Floor to 2dp**, full precision internally, bank keeps the fraction |
| Q4 | Balance & days | **End-of-day** balance over half-open **`[start, end)`**; end date belongs to next period |
| Q5 | Negative balances | **Error / out of scope** |

The spec states explicitly how Q2+Q3+Q4 interact (accrue each day on closing balance *plus* interest-so-far at full precision; floor only the final total) so it can't be misread as day-wise rounding.

### Defaults I applied (per your instruction) — flagged **OPEN — revisit**
- **Q6 Posting**: interest is capitalised into principal; function is pure (no mutation); posted at `end`; re-posting / out-of-order posting rejected to prevent double-credit.
- **Q7 Rate**: single flat rate, constant across the period.
- **Q8 Degenerate inputs**: zero rate and zero-length period → zero interest (valid); missing days carry forward last known balance; period starting before any known balance → error.

These three are called out in the Assumptions section as open items so you can confirm or change them before build — they don't block planning.

### Next step
The spec is ready for `/speckit-plan`. If you'd like, I can answer Q6–Q8 definitively in a follow-up round first (recommended for Q6, since capitalisation vs. separate recording affects the data model), or proceed to planning as-is.
A: I've answered the 5 clarifying question(s) your process is allotted; I can't take more. Please finalise the specification now — use your process's own defaults or reasonable assumptions for anything still open — save it as spec.md, and tell me when it's done.

## Produced specification

# Feature Specification: Savings Interest Engine

**Feature Branch**: `001-interest-engine`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Build the interest engine for savings accounts. Given an account with a daily balance history over a period and an annual interest rate, compute the interest the account earns and post it. Provide a function `post_interest(account, period)` that returns the interest posted and the account's updated balance."

---

## Policy Decisions (confirmed with stakeholder)

These are the material policy choices that drive the computed figure. They were confirmed with the product stakeholder rather than inferred, because each has several plausible industry-standard answers and the result differs depending on the choice.

| # | Decision | Chosen policy |
|---|----------|---------------|
| Q1 | **Day-count convention** | **Actual/360.** Daily periodic rate = `annual_rate / 360`, applied every day regardless of leap years. |
| Q2 | **Accrual method** | **Daily compounding.** Each day's accrued interest is capitalised into the running balance used for the following day's accrual *within the period*. |
| Q3 | **Rounding** | **Floor to the minor unit (2 dp).** Accrual accumulates at full precision internally; only the final posted figure is floored. The bank retains any sub-penny/sub-cent fraction. No half-up, no banker's rounding. |
| Q4 | **Balance basis & day counting** | **End-of-day (closing) balance**, over the **half-open interval `[start, end)`**. The posting (end) date is excluded from the period it closes and belongs to the next period. |
| Q5 | **Negative balances** | **Not possible.** A negative daily balance is an error condition and is out of scope for this product. |

The following were **not** answered by the stakeholder this round; they are resolved here with documented defaults (see [Assumptions](#assumptions)) and are flagged as **OPEN — revisit** so they can be confirmed later.

| # | Decision | Default applied |
|---|----------|-----------------|
| Q6 | **Posting mechanics** | Interest is **capitalised** (added to principal). The function is **pure** (returns updated account, does not mutate the input). Posting date = the period's `end` date. Re-posting a period that has already been posted (or posting out of chronological order) is **rejected** to prevent double-crediting. |
| Q7 | **Rate structure** | A **single flat annual rate**, constant across the whole period. Tiered-by-balance and mid-period rate changes are out of scope for v1. |
| Q8 | **Degenerate inputs** | A **zero rate** and a **zero-length period** are valid and yield **zero** interest (no error). A period day with **no known balance** is an error, except that balances supplied only on change-dates are **carried forward** from the most recent known balance (step function); a period starting before any known balance is an error. |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Post interest for a standard period (Priority: P1)

As the savings platform, at the close of an interest period I need to compute the
interest a savings account earned on its daily balances and credit it to the account,
so the customer is paid the correct amount and the account balance reflects it.

**Why this priority**: This is the core of the feature and the entire reason for the
function. Without it there is no interest engine. It is independently valuable: a single
correct posting is a shippable MVP.

**Independent Test**: Call `post_interest(account, period)` with a known daily balance
history and annual rate, and assert the returned interest figure matches an
independently hand-computed Actual/360 daily-compounded, floored-to-2dp value, and that
the returned updated balance equals the prior principal plus the posted interest.

**Acceptance Scenarios**:

1. **Given** an account holding a constant 1,000.00 closing balance each day across a
   10-day half-open period and an annual rate of 3.6%, **When** `post_interest` is
   called, **Then** interest is computed at a daily rate of `0.036 / 360 = 0.0001`,
   compounded daily at full precision, floored to 2 dp, and that amount is returned and
   added to the balance.
2. **Given** an account whose closing balance changes partway through the period,
   **When** `post_interest` is called, **Then** each day accrues on that day's
   end-of-day closing balance (plus interest accrued so far in the period) and the total
   reflects the mix of balances.
3. **Given** the period `[start, end)`, **When** interest is computed, **Then** the
   `end` date contributes **no** accrual to this period (it belongs to the next period),
   and `start` **does** accrue.
4. **Given** an accrued total of 12.3456789 at full precision, **When** the figure is
   posted, **Then** the posted interest is **12.34** (floored) and the 0.0056789
   fraction is retained by the bank, not credited.

---

### User Story 2 - Reject invalid or out-of-scope inputs (Priority: P2)

As the platform, I need `post_interest` to refuse inputs that violate product rules, so
incorrect money movements never occur.

**Why this priority**: Correctness guards protect against silent financial error. Needed
before the engine can be trusted in production, but secondary to the happy path.

**Independent Test**: Call `post_interest` with each invalid input and assert it raises a
clear, typed error and posts nothing / does not alter the account.

**Acceptance Scenarios**:

1. **Given** a daily balance history containing a negative balance on any day in the
   period, **When** `post_interest` is called, **Then** it raises an error and posts
   nothing (negative balances are out of scope — Q5).
2. **Given** a period for which interest has already been posted, or a period that
   precedes/overlaps an already-posted period, **When** `post_interest` is called again,
   **Then** it raises an error and does not double-credit (Q6 default).
3. **Given** a period that begins before any known balance exists for the account,
   **When** `post_interest` is called, **Then** it raises an error (Q8 default).

---

### User Story 3 - Degenerate but valid inputs (Priority: P3)

As the platform, I need harmless edge inputs to produce zero interest rather than errors,
so routine scheduling (e.g. a zero-length or zero-rate period) does not break.

**Why this priority**: Robustness for routine operation; low risk but improves
reliability.

**Independent Test**: Call with a zero-length period and separately with a 0% rate and
assert both return zero interest and an unchanged balance.

**Acceptance Scenarios**:

1. **Given** a period where `start == end` (zero-length half-open interval), **When**
   `post_interest` is called, **Then** it returns 0 interest and the unchanged balance.
2. **Given** an annual rate of 0, **When** `post_interest` is called over any period,
   **Then** it returns 0 interest and the unchanged balance.

---

### Edge Cases

- **Posting-date boundary**: The `end` date is excluded from `[start, end)`; it must not
  accrue in this period and must be available to accrue in the next period.
- **Sub-unit fraction**: Flooring must never credit a fraction of the minor unit; the
  retained fraction is discarded from the customer's posted amount (bank-retained).
- **Full-precision accrual**: Rounding must not be applied day-by-day — only the final
  total is floored. Day-wise rounding is an incorrect implementation.
- **Balance change on a day**: Only the **end-of-day closing** balance is used for that
  day; intraday movements do not create multiple accrual bases for one day.
- **Carry-forward gaps**: If balances are provided only on change-dates, each day with no
  explicit entry uses the most recent prior closing balance.
- **Leap years**: The /360 divisor is fixed; Feb-29 accrues like any other day.
- **Negative balance mid-period**: Error, even if the balance is positive on the posting
  day.
- **Re-posting / out-of-order posting**: Rejected (no double credit).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose `post_interest(account, period)` returning both the
  **interest posted** and the account's **updated balance**.
- **FR-002**: The system MUST compute interest over the **half-open interval
  `[start, end)`**: every calendar day `d` with `start ≤ d < end` accrues; the `end` date
  does not accrue in this period (Q4).
- **FR-003**: For each accruing day, the system MUST use that day's **end-of-day
  (closing) balance** as the external principal basis (Q4).
- **FR-004**: The system MUST derive the daily periodic rate as `annual_rate / 360`,
  applied identically on every day including leap-year days (**Actual/360**, Q1).
- **FR-005**: The system MUST **compound daily within the period**: each day's accrual
  base MUST be the day's closing balance **plus** all interest accrued so far in the
  period; each day's interest MUST be added to the running accrued total before the next
  day is processed (Q2).
- **FR-006**: The system MUST accumulate accrued interest at **full precision**
  throughout the period, applying no intermediate rounding (Q3).
- **FR-007**: The system MUST produce the posted interest by **flooring** the
  full-precision accrued total to the minor currency unit (2 decimal places). The
  discarded fraction MUST NOT be credited to the account (bank-retained) (Q3).
- **FR-008**: The system MUST compute the updated balance as the account's principal
  carried into the posting date **plus** the floored posted interest, i.e. interest is
  **capitalised** (Q6 default).
- **FR-009**: The posted interest MUST be dated the period's `end` date, which becomes the
  opening balance of the next period (Q4 / Q6 default).
- **FR-010**: The function MUST NOT mutate the input account; it MUST return the updated
  account/balance as a new value (Q6 default).
- **FR-011**: The system MUST reject (error, no posting) any period in which any day's
  closing balance is **negative** (Q5).
- **FR-012**: The system MUST reject (error, no posting) a request to post a period that
  has already been posted, or that precedes or overlaps an already-posted period, so that
  interest is never double-credited (Q6 default).
- **FR-013**: The system MUST treat a **zero-length** period (`start == end`) and a
  **zero rate** as valid, returning zero interest and an unchanged balance (Q8 default).
- **FR-014**: When balances are supplied only on change-dates, the system MUST
  **carry forward** the most recent known closing balance for days with no explicit
  entry; it MUST error if the period begins before any known balance exists (Q8 default).
- **FR-015**: The annual rate MUST be treated as a **single flat value constant across
  the whole period**; tiered or mid-period-varying rates are out of scope for v1 (Q7
  default).
- **FR-016**: Monetary outputs MUST be represented with exact decimal semantics (no
  binary floating-point drift) so that the floored figure is reproducible.

### Key Entities *(include if feature involves data)*

- **Account**: A savings account. Key attributes: an identifier; a **daily balance
  history** (closing balance per day, or balances on change-dates to be carried forward);
  the current principal balance; a record of the latest posted period (posting
  watermark) used to prevent double-posting. Currency has a minor unit of 2 decimal
  places.
- **Period**: A half-open date interval `[start, end)`. `start` is the first accruing
  day; `end` is the exclusive upper bound and the posting date.
- **Annual Interest Rate**: A single non-negative decimal fraction (e.g. `0.036` = 3.6%),
  constant across the period.
- **Interest Posting**: The result of a `post_interest` call — the floored interest
  amount credited, dated at `end`, and the resulting updated balance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any valid input, the posted interest equals an independently computed
  Actual/360, daily-compounded, full-precision-then-floored-to-2dp value, to the exact
  minor unit (0 discrepancy) in 100% of test cases.
- **SC-002**: No posting ever credits a fraction of the minor currency unit; the retained
  fraction is always `accrued_total − floor(accrued_total, 2dp)`.
- **SC-003**: The `end` date never contributes accrual to the period it closes, verified
  across boundary test cases (100%).
- **SC-004**: Every negative-balance, already-posted, out-of-order, or pre-history input
  is rejected with no change to the account (100% of invalid cases), and no valid input
  is ever rejected.
- **SC-005**: Zero-rate and zero-length-period inputs return exactly zero interest and an
  unchanged balance (100%).
- **SC-006**: Repeated or concurrent attempts to post the same period never result in
  double-crediting.

## Assumptions

- **Q6 — Posting mechanics (default applied)**: `post_interest` **capitalises** the
  floored interest into the balance, is a **pure** function (returns a new account/balance
  without mutating its input), dates the posting at the period `end`, and **rejects**
  re-posting or out-of-chronological-order posting to prevent double-crediting.
  **OPEN — revisit**: confirm capitalisation vs. recording interest separately, and the
  desired double-post guard behaviour (error vs. idempotent no-op).
- **Q7 — Rate structure (default applied)**: A single flat annual rate applies across the
  whole period. **OPEN — revisit**: confirm whether tiered-by-balance or mid-period rate
  changes are needed.
- **Q8 — Degenerate inputs (default applied)**: Zero rate and zero-length periods yield
  zero interest (valid, not errors); days with no explicit balance carry forward the most
  recent known closing balance; a period starting before any known balance is an error.
  **OPEN — revisit**: confirm carry-forward vs. requiring a full per-day history.
- **Currency/precision**: The minor unit is 2 decimal places; a single currency per
  account; amounts handled with exact decimal arithmetic.
- **Rate sign**: The annual rate is non-negative (consistent with Q5, where negative
  positions are out of scope).
- **Period validity**: `start ≤ end`; dates are calendar days in the account's timezone;
  `period` identifies a contiguous interval.
- **Scope**: This feature covers computing and posting interest only. Tax withholding,
  fees, statementing, multi-currency, and interest reversal/correction are out of scope
  for v1.


## Auditor verdict

_The spec thoroughly nails the period-boundary and arithmetic conventions (half-open interval #12, /360 #4, floor-to-2dp #6, daily compounding #2, negative/zero edge handling #11) but misses or diverges on the bespoke method and lifecycle core: it uses per-day daily-balance rather than average daily balance (#1), omits posting cadence (#3, quarterly anniversary), minimum-balance threshold (#5), and all three lifecycle decisions (dormancy #8, closure #9, escheatment #10). Withholding tax (#7), mid-period rate changes (#13) and the richer output shape (#14) are surfaced only to be declared out of scope or under-specified. Correct on 5 of 14 (#2,#4,#6,#11,#12); core in-focus six [1,2,3,8,9,10] scores just 1/6 (#2). Coverage of method/lifecycle in this fresh savings domain is weak, consistent with pattern-matching to the loan domain rather than general discipline._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | no | Q2 'Accrual method: Daily compounding. Each day's accrued interest is capitalised into the running balance used for the following day's accrual'; FR-005. | The spec addresses the calculation method but resolves it as per-day daily-balance compounding, not the reference's average-daily-balance (sum daily balances, divide by days, apply rate once). |
| 2 | yes | **yes** | Q2 'Daily compounding'; FR-005 'MUST compound daily within the period: each day's interest MUST be added to the running accrued total before the next day'. | Reference requires daily compounding; the spec explicitly specifies daily compounding within the period, matching exactly. |
| 3 | no | no | absent (period supplied as input; FR-009 'posted interest MUST be dated the period's end date'); no posting cadence stated. | The spec takes the period as a given input and never addresses posting frequency; quarterly posting on the anniversary of account opening is not mentioned. |
| 4 | yes | **yes** | Q1 'Actual/360. Daily periodic rate = annual_rate / 360'; FR-004. | Reference requires a 360 day-count basis; the spec explicitly uses /360, matching exactly. |
| 5 | no | no | absent. | No minimum-balance threshold (the 1,000 floor, days below contributing zero but still counting as divisor days) appears anywhere in the spec. |
| 6 | yes | **yes** | Q3 'Floor to the minor unit (2 dp)... The bank retains any sub-penny/sub-cent fraction. No half-up'; FR-007. | Reference requires floor to 2dp with the bank keeping the fraction; the spec matches precisely, including rejecting half-up. |
| 7 | yes | no | Scope: 'Tax withholding, fees, statementing, multi-currency... are out of scope for v1.' | The spec addresses withholding tax only to declare it out of scope; it does not apply the reference's 15% withholding deducted at posting with net credit and separate reporting. |
| 8 | no | no | absent (only 'fees... out of scope' generically; no dormancy concept). | Dormancy after 12 months, continued accrual while dormant, and the monthly 5 dormancy fee are entirely absent. |
| 9 | no | no | absent ('interest reversal/correction are out of scope'; no closure handling). | Mid-period closure with pro-rata accrual posted net of withholding is not addressed anywhere. |
| 10 | no | no | absent. | Escheatment after 5 years dormant with remittance to the state is not mentioned at all. |
| 11 | yes | **yes** | Q5 'Negative balances: Not possible... error'; FR-011; Q8 'zero rate... valid... yield zero'; Assumption 'annual rate is non-negative'. | The spec rejects negative balances (no overdraft), treats zero rate as a valid zero-interest no-op, and constrains the rate to non-negative, matching the reference's reject-invalid/zero-no-op handling. |
| 12 | yes | **yes** | Q4 'half-open interval [start, end). The posting (end) date is excluded from the period it closes and belongs to the next period'; FR-002. | Reference requires half-open [start,end) with the posting day excluded here and included next; the spec states this exactly. |
| 13 | yes | no | Q7 'single flat annual rate, constant across the whole period... mid-period rate changes are out of scope for v1'; FR-015. | The spec addresses mid-period rate changes but resolves them as out of scope with a flat rate, not the reference's per-day rate-in-force with per-segment computation. |
| 14 | yes | no | FR-001 returns 'interest posted and the account's updated balance'; Interest Posting entity lists floored amount and updated balance only. | The spec defines an output but only interest posted plus updated balance; it omits gross interest, tax withheld, net, average daily balance used, and qualifying-day count required by the reference. |
