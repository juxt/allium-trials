# prose — savings-interest — iteration 1

Model (author): claude-opus · Questions asked: 12 · Captured: 6/14 · Bespoke captured: 5/10

## Conversation

### Round 1
_Step reasoning:_ The brief omits every material interest policy; these are institution-specific choices I cannot reliably infer, so I ask before specifying.

Q: Day-count / accrual basis: how is the daily interest fraction computed? Actual/365, Actual/360, Actual/actual (so leap years use 366), or 30/360? And is the quoted annual rate a simple nominal rate divided across days, or an effective annual rate that must be de-compounded to a daily rate?
A: 360-day basis: daily rate = annual_rate / 360. The annual rate is a nominal rate divided straight across days — it is not an effective annual rate requiring de-compounding.

Q: Compounding within the period: does accrued interest compound (daily or at some interval, so earlier accruals earn interest) or is it simple interest on the daily balances summed and posted once at period end?
A: Interest compounds daily: each day's accrued interest is added to the principal base before the next day's accrual. It is not simple interest summed and posted once at period end.

Q: Which daily balance is used for each day's accrual (opening/start-of-day, closing/end-of-day, or a specific cutoff), and how are the period's boundary days treated (are both the first and last day counted, i.e. inclusive/exclusive endpoints)?
A: The period is half-open [start, end): the posting day is excluded from the period it closes and included in the next period. Which intraday snapshot (opening vs closing balance) is used for each day is [default, not policy]: end-of-day balance.

Q: Rounding: to what precision is interest rounded (e.g. whole cents / 2dp), using which rule (half-up, half-even/bankers', truncate), and is rounding applied once at posting or at each daily accrual step?
A: Rounding is applied once, at posting. Precision is 2 decimal places (minor unit), using floor (truncate down). Half-up rounding is not used; the bank retains any sub-cent fraction.

Q: Negative or zero balances: if the account goes negative or zero on some days, is interest zero for those days, does it accrue negatively (a debit), or is the whole period floored at zero?
A: The account never goes negative. Days with a zero balance contribute zero interest for that day but still count as days in the divisor for the average daily balance calculation.

Q: Minimum balance / eligibility thresholds or tiered rates: is there a minimum balance below which no interest is earned, or rate tiers that vary the annual rate by balance band, or is it a single flat rate across all balances?
A: A single minimum balance threshold of 1,000 applies. Days where the balance is below 1,000 contribute zero to interest accrual but still count as days in the average-balance divisor. There are no tiered rates — the rate is flat above the threshold.

Q: Posting mechanics: does post_interest add the computed interest to the account balance and return the new balance, and is it idempotent / guarded against double-posting if called twice for the same period?
A: post_interest credits net interest (gross minus 15% withholding tax) to the account balance and returns the updated balance. Whether the operation is guarded against double-posting for the same period is [default, not policy]: callers are expected to invoke it exactly once per period.

### Round 2
_Step reasoning:_ The gross/tax rounding order, the apparent conflict between 'daily compounding' and 'average daily balance', the threshold-vs-compounded-base interaction, and the account/period/return shapes are all material and cannot be reliably inferred, so one more targeted round is warranted before writing the spec.

Q: Withholding-tax mechanics: is the 15% computed on the gross accrued interest and then subtracted, and at what precision/rule is each amount rounded? Specifically — do we floor the gross interest to 2dp first and then floor the 15% tax (or the net) separately, or compute gross at full precision, take net = gross * 0.85, and floor only the net once at posting?
A: The key specifies floor-to-2dp at posting and 15% withholding on gross interest, but does not prescribe the exact rounding sequence between gross and tax. [default, not policy]: compute gross at full floating-point precision, derive tax = gross × 0.15 at full precision, net = gross × 0.85 at full precision, then floor the net once to 2dp at posting. Tax withheld is reported as gross − net (also exact at that point). Neither gross nor tax is floored independently before arriving at the net.

Q: Reconciling the accrual model: earlier you said interest compounds daily (each day's accrued interest is added to the principal base before the next day's accrual), but the threshold/zero-balance answers describe an 'average daily balance' with a 'divisor'. Which governs — true daily compounding on each day's end-of-day balance (with the 1,000 threshold and zero days contributing zero that day), or a simple average-daily-balance figure that is then subjected to a single rate application? If it is genuinely daily compounding, is the 'average-balance divisor' language just describing that every calendar day in [start, end) counts, including sub-threshold and zero days?
A: True daily compounding governs: each day's accrued interest is added to the running balance before the next day's accrual, exactly as stated in the compounding-period rule. The 'average daily balance' language describes a reported output statistic (it appears as a required return field), not the calculation method. Every calendar day in [start, end) counts when computing that reported average — including sub-threshold and zero-balance days — which is why those days still contribute to the divisor. The earlier 'apply the rate once to that average' phrasing was describing the reporting metric, not overriding the daily-compounding accrual mechanic.

Q: Threshold and compounding interaction: on a day where the end-of-day balance is below 1,000 (or zero), that day accrues zero interest — but does the previously accrued interest already folded into the principal base still carry forward and continue compounding on later eligible days, or is the eligibility test applied to the raw deposited balance only?
A: The threshold eligibility test is applied to the end-of-day balance as it stands each day, including any interest already compounded into it from prior days. On an ineligible day (end-of-day balance < 1,000) the day's accrual is zero, but the accumulated running balance — which includes all previously compounded interest — is carried forward unchanged. Compounding resumes in full on the next day the balance clears the threshold. The eligibility test does not strip out prior accruals; it simply adds nothing new for that day.

Q: Interface/data shapes: what are the concrete structures of `account` (fields it exposes, e.g. current balance, currency/minor-unit) and `period` (how start/end are supplied), and what exactly does post_interest return — just the net interest posted and the new balance, or a richer breakdown (gross, tax, net)?
A: Concrete field shapes for `account` and `period` are [default, not policy]. For `post_interest` the return structure is specified: gross interest, tax withheld, net interest posted, the average daily balance used (reported statistic), the number of qualifying days (days on which the balance was at or above 1,000), and the updated account balance after crediting the net interest.

### Round 3
_Step reasoning:_ One material ambiguity remains: how the externally supplied daily balance history combines with the daily-compounded interest accumulator, which is underdetermined and cannot be inferred.

Q: Reconciling the supplied daily balance history with the daily-compounding running balance: the balance history gives an end-of-day balance for each day (reflecting the customer's deposits/withdrawals), yet interest compounds daily into a running balance. How do the two combine? Specifically, is each day's accrual base (and threshold-eligibility figure) the deposited end-of-day balance for that day PLUS all interest accrued on prior days (i.e. the history supplies the principal and a separate accumulator tracks compounded interest on top), or does each day's figure from the history overwrite the running balance (so external balances are treated as authoritative and prior accrued interest is not re-based onto them)? A concrete example: day 1 end-of-day balance 1,000 accrues ~0.03; day 2's history shows 2,000 — is day 2's base 2,000.03 or 2,000?
A: The answer key does not explicitly govern how a supplied balance history combines with the daily-compounding accumulator. [default, not policy]: the balance history supplies the principal component for each day (reflecting customer-initiated deposits and withdrawals), and compounded interest accrues into a separate running accumulator that sits on top of it. Each day's accrual base is therefore the deposited end-of-day balance for that day plus all interest compounded from prior days in the period that has not yet been posted. In your concrete example: day 1 base = 1,000, day 1 accrual ≈ 0.03, accumulated interest carry-forward ≈ 0.03; day 2 deposited balance = 2,000, so day 2 accrual base = 2,000.03. The external balance does not overwrite the running accumulator — it provides only the principal component, and the previously compounded interest is added to it. This is consistent with the stated rule that the threshold eligibility test applies to the end-of-day balance 'including any interest already compounded into it from prior days'.

### Round 4 (process signalled done)
_Step reasoning:_ All material policy decisions (day-count, daily compounding, half-open period, floor-to-2dp rounding, zero/negative handling, 1,000 threshold, withholding tax and rounding sequence, accrual-vs-average reconciliation, threshold/carry-forward interaction, return shape, and history/accumulator combination) are now resolved; the last several answers returned defaults rather than policy, signalling the specific institutional choices have been exhausted.

(no questions this round)

## Produced specification

# Requirements Specification: Savings Account Interest Engine

## 1. Overview

Implement `post_interest(account, period)`. The function computes the interest a savings account earns over a period from its daily balance history and a nominal annual interest rate, applies daily compounding subject to a minimum-balance threshold, deducts 15% withholding tax, credits the net interest to the account, and returns a breakdown together with the updated balance.

This document records every policy decision confirmed with the stakeholder. Decisions marked **[default]** were not fixed by stakeholder policy and are resolved here by engineering judgement; they must not be treated as institution policy but are the behaviour to implement.

## 2. Inputs

### 2.1 `account`
Exposes at least:
- the current account balance (in minor units / 2 decimal places), which the net interest is credited to and which forms the base returned;
- the nominal annual interest rate (see 3.1).

**[default]** The concrete field names and structure of `account` are not stakeholder policy. Implement against a straightforward shape: a numeric `balance` and a numeric `annual_rate` (expressed as a decimal fraction, e.g. 0.05 for 5%). Currency/minor-unit metadata may be present but only 2dp minor units are assumed (see 6).

### 2.2 `period`
Defines a half-open date interval `[start, end)` and supplies a **daily balance history**: for each calendar day in the period, the customer's **end-of-day** deposited balance (reflecting that day's deposits and withdrawals).

**[default]** The concrete representation of `start`, `end`, and the daily balance history is not stakeholder policy. Implement against: `start` and `end` as dates, and a per-day mapping from each date in `[start, end)` to that day's end-of-day deposited balance.

## 3. Accrual basis

### 3.1 Day-count and rate
- 360-day basis. The daily interest fraction is `daily_rate = annual_rate / 360`.
- The annual rate is a **nominal** rate divided straight across days. It is **not** an effective annual rate; no de-compounding is performed.

### 3.2 Compounding
- Interest **compounds daily**. Each day's accrued interest is added to the running interest accumulator before the next day's accrual, so earlier accruals earn interest on later eligible days.
- This is genuine daily compounding, not simple interest summed and posted once. (The "average daily balance" concept in section 5.3 is a reported statistic only, not the accrual method.)

### 3.3 Period boundaries and intraday snapshot
- The period is **half-open `[start, end)`**: the posting day (`end`) is excluded from the period it closes and is included in the next period.
- Each day's accrual and threshold test use that day's **end-of-day** balance. **[default]** the choice of end-of-day (rather than opening) is not stakeholder policy.

## 4. Daily balance model and the accrual base

Two balances are tracked distinctly:

1. **Principal component** — supplied by the daily balance history. Each day's history value is the customer's end-of-day deposited balance for that day (reflecting customer-initiated deposits and withdrawals). The history is authoritative for principal; it is **not** overwritten by accrued interest.
2. **Interest accumulator** — a separate running total of interest compounded within this period that has not yet been posted. It starts at 0 at `start`.

**[default]** How the supplied history combines with the compounding accumulator is not stakeholder policy; it is resolved as follows.

For each day `d` in `[start, end)`, in chronological order:
- `accrual_base(d) = deposited_balance(d) + interest_accumulator_before(d)` where `interest_accumulator_before(d)` is the accumulated, un-posted compounded interest carried in from all prior days of the period.

Worked example: day 1 deposited balance 1,000 accrues ≈ 0.03; the accumulator carries ≈ 0.03 forward. Day 2 deposited balance is 2,000, so day 2's accrual base is 2,000.03 (not 2,000).

## 5. Daily computation

Process each calendar day `d` in `[start, end)` in order. Let `base = accrual_base(d)` as defined in section 4.

### 5.1 Threshold eligibility
- A single minimum-balance threshold of **1,000** applies. There are **no** rate tiers; the rate is flat above the threshold.
- The eligibility test is applied to the **end-of-day accrual base** as it stands that day, **including any interest already compounded into it from prior days**.
- If `base >= 1000`, the day is **eligible (qualifying)**:
  - `day_interest = base * daily_rate`
  - add `day_interest` to the interest accumulator.
- If `base < 1000` (including a zero balance), the day is **ineligible**:
  - `day_interest = 0`;
  - the accumulator (all previously compounded interest) is carried forward unchanged. Prior accruals are never stripped out.
  - Compounding resumes in full on the next day the base clears the threshold.

### 5.2 Zero and negative balances
- The account never goes negative (a stated precondition).
- A zero-balance day contributes zero interest but still counts as a day in the average-daily-balance divisor (section 5.3).

### 5.3 Average daily balance (reported statistic only)
- The average daily balance is a **reported output**, not part of the accrual calculation.
- It is the arithmetic mean of the daily figures over **every calendar day in `[start, end)`** — the divisor is the total number of days in the period, including sub-threshold days and zero-balance days.
- **[default]** The daily figure averaged is the day's end-of-day deposited balance (consistent with the end-of-day snapshot used throughout). Compute `average_daily_balance = sum(deposited_balance(d) for d in [start, end)) / number_of_days_in_period`.

### 5.4 Qualifying-day count
- `qualifying_days` = the number of days on which the balance (the accrual base tested in 5.1) was at or above 1,000.

## 6. Gross, tax, net and rounding

After processing all days, let `gross` be the final interest accumulator value (full precision).

Rounding is applied **once, at posting**, to 2 decimal places (minor unit), using **floor / truncate-down**. Half-up is not used; the bank retains any sub-cent fraction. No rounding is applied at any intermediate daily step.

**[default]** The rounding sequence between gross, tax and net is resolved as follows (it is not stakeholder policy beyond "floor-to-2dp at posting, 15% withholding on gross"):
- Compute `gross` at full floating-point precision.
- `tax = gross * 0.15` at full precision.
- `net = gross * 0.85` at full precision.
- Floor **`net`** once to 2dp at posting: `net_posted = floor(net * 100) / 100`.
- Neither gross nor tax is floored independently before arriving at the net.
- **Tax withheld** is reported as `gross - net` (exact at that point). Do not report a separately-floored tax figure.

## 7. Posting mechanics

- `post_interest` credits the **net interest** (`net_posted`) to the account balance: `updated_balance = account.balance + net_posted`.
- **[default]** The function is **not** guarded against double-posting for the same period. Callers are expected to invoke it exactly once per period; no idempotency key or replay guard is required.

## 8. Return value

`post_interest` returns a structure containing:
- **gross interest** — the full-precision accrued interest before tax (section 6);
- **tax withheld** — `gross - net` (section 6);
- **net interest posted** — `net_posted`, the floored 2dp amount credited;
- **average daily balance used** — the reported statistic (section 5.3);
- **number of qualifying days** — days with balance at or above 1,000 (section 5.4);
- **updated account balance** — the balance after crediting the net interest (section 7).

## 9. Worked reference (illustrative)

Given `annual_rate = 0.05`, `daily_rate = 0.05 / 360 ≈ 0.000138889`, period `[2026-01-01, 2026-01-03)` (2 days), history: day 1 = 1,000, day 2 = 2,000.
- Day 1: base 1,000 ≥ 1,000, eligible. `day_interest ≈ 0.138889`. Accumulator ≈ 0.138889. Qualifying day.
- Day 2: base = 2,000 + 0.138889 = 2,000.138889 ≥ 1,000, eligible. `day_interest ≈ 0.277797`. Accumulator ≈ 0.416686. Qualifying day.
- `gross ≈ 0.416686`; `net = gross * 0.85 ≈ 0.354183`; `net_posted = floor(0.354183 * 100)/100 = 0.35`; `tax withheld = gross - net ≈ 0.062503`.
- Average daily balance = (1,000 + 2,000) / 2 = 1,500. Qualifying days = 2. Updated balance = prior balance + 0.35.

(Figures illustrate the mechanics; exact values depend on floating-point evaluation. The rate is illustrative and not stakeholder-supplied.)

## 10. Edge cases and invariants

- Empty period (`start == end`): no days processed; gross = 0, tax = 0, net_posted = 0.00, average daily balance over zero days is undefined — **[default]** return 0 for the average in that case; qualifying days = 0; updated balance unchanged.
- All days below threshold: gross = 0, net_posted = 0.00, qualifying_days = 0; the average daily balance is still computed over all days.
- The account is guaranteed non-negative; no negative-accrual or period-flooring logic is required.
- No intermediate rounding: all daily accruals and the accumulator are carried at full precision until the single floor at posting.


## Auditor verdict

_The spec covers the per-day mechanics well (daily compounding #2, 360-basis #4, 1,000 threshold #5, floor rounding #6, 15% withholding #7, half-open boundary #12, and the full six-field output shape #14 all match). But it fundamentally misses the core accrual method: the reference requires average daily balance (#1, apply rate once to the averaged balance), while the spec explicitly implements per-day daily-balance compounding and demotes average daily balance to a reported statistic — the exact inverse. All three lifecycle decisions (#8 dormancy, #9 mid-period closure, #10 escheatment), the posting period/anniversary (#3), and mid-period rate changes (#13) are entirely absent, as post_interest is scoped to a single supplied period with no lifecycle. #11 is partially handled (zero-balance no-op, non-negative) but omits negative-rate rejection. Correct: #2, #4, #5, #6, #7, #12, #14 (7/14). The method decision was inverted and the lifecycle subset was not surfaced at all._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | no | Section 3.2: "This is genuine daily compounding, not simple interest summed and posted once. (The "average daily balance" concept in section 5.3 is a reported statistic only, not the accrual method.)"; Section 1: "applies daily compounding" | The reference method is average daily balance: average the daily balances and apply the rate once. The spec explicitly rejects average daily balance as the accrual method, using per-day compounding on each day's balance instead. This is the opposite of the reference, so incorrect. |
| 2 | yes | **yes** | Section 3.2: "Interest compounds daily. Each day's accrued interest is added to the running interest accumulator before the next day's accrual, so earlier accruals earn interest on later eligible days." | Reference #2 requires daily compounding within the period. The spec states interest compounds daily with each day's interest joining the base. Matches. |
| 3 | no | no | absent | The reference requires quarterly posting on the anniversary of account opening. The spec never states the posting period or frequency; post_interest simply operates over a supplied period with no statement of quarterly/anniversary posting. Not surfaced, not correct. |
| 4 | yes | **yes** | Section 3.1: "360-day basis. The daily interest fraction is daily_rate = annual_rate / 360." | Reference #4 requires 360-day basis with daily rate = annual/360. The spec matches exactly. |
| 5 | yes | no | Section 5.1: "If base >= 1000... eligible"; "the day is ineligible: day_interest = 0"; Section 5.3: divisor is "total number of days in the period, including sub-threshold days" | Reference #5: threshold 1,000, sub-threshold days contribute zero but still count in the divisor. The threshold value and the divisor treatment match. However, the reference tests the threshold on the day's balance, whereas the spec tests the accrual base including compounded interest, and combined with the wrong accrual method (per-day compounding rather than average balance) the reference's meaning of 'days at or above 1,000' diverges. The threshold=1000 and zero-contribution-but-counted-in-divisor are matched, but the reference frames it around the average-balance method (#1) which the spec rejects. On the literal decision — threshold 1,000, below contributes zero, still counts as a day in the average divisor — the spec matches. Marking correct on the literal threshold decision. |
| 6 | yes | **yes** | Section 6: "Rounding is applied once, at posting, to 2 decimal places (minor unit), using floor / truncate-down. Half-up is not used; the bank retains any sub-cent fraction." | Reference #6 requires floor (round down) to 2dp, never half-up, bank keeps the fraction. The spec matches exactly, including the bank-keeps-fraction detail. |
| 7 | yes | **yes** | Section 6: "15% withholding on gross"; "the account is credited the net"; Section 8: "tax withheld" reported separately as gross - net | Reference #7: 15% withholding tax deducted from gross at posting, account credited net, tax reported separately. The spec deducts 15%, credits net, and reports tax withheld separately. Matches. (The spec floors net rather than gross, but the reference decision is about the 15%/net/separate-reporting, all of which match.) |
| 8 | no | no | absent | Reference #8: after 12 months of no customer transaction the account becomes dormant, interest continues to accrue, monthly dormancy fee of 5. The spec contains no dormancy concept at all. Not surfaced, not correct. |
| 9 | no | no | absent | Reference #9: on closure mid-period, interest accrued pro-rata to closure date and posted net of withholding. The spec has no closure handling; it only posts over a given period. Not surfaced, not correct. |
| 10 | no | no | absent | Reference #10: after 5 years dormant the balance is escheated to the state, account closed to zero, no further interest. The spec has no escheatment concept. Not surfaced, not correct. |
| 11 | yes | no | Section 5.2: "The account never goes negative (a stated precondition)."; Section 10: "All days below threshold: gross = 0, net_posted = 0.00"; a zero-balance day contributes zero interest | Reference #11: negative rate rejected as invalid; zero balance whole period posts zero (a no-op that still records a zero posting); account never goes negative. The spec covers zero-balance-posts-zero and never-negative, but does NOT reject a negative rate as invalid (no validation stated). Since the reference bundles negative-rate rejection into this decision and the spec omits it, it is not fully correct. |
| 12 | yes | **yes** | Section 3.3: "The period is half-open [start, end): the posting day (end) is excluded from the period it closes and is included in the next period." | Reference #12: posting day excluded from the period it closes, included in the next, periods are [start, end). The spec matches verbatim in intent. |
| 13 | no | no | absent | Reference #13: if the annual rate changes mid-period, each day uses the rate in force that day, computed per rate-segment and summed. The spec uses a single annual_rate throughout with no handling of mid-period rate changes. Not surfaced, not correct. |
| 14 | yes | **yes** | Section 8: returns "gross interest", "tax withheld", "net interest posted", "average daily balance used", "number of qualifying days", "updated account balance". | Reference #14 requires per posting: gross, tax withheld, net posted, average daily balance used, qualifying days, updated balance. The spec's return value lists all six items. Matches. |
