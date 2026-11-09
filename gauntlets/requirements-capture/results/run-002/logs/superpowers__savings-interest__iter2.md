# superpowers — savings-interest — iteration 2

Model (author): claude-opus · Questions asked: 17 · Captured: 9/14 · Bespoke captured: 7/10

## Conversation

### Round 1
_Step reasoning:_ Brainstorming starts by resolving the most material omitted policy before any design, and the accrual/compounding/day-count convention is the core unknown that determines the computation; asking one focused question at a time per the process.

Q: To compute the interest correctly I need to pin down the method: should interest accrue on each day's closing balance (daily accrual) and, if so, does it compound during the period or is it simple interest summed and posted once at period end? Also, how is the annual rate converted to a daily figure, for example divide by 365, 360, or actual days in the year?
A: Average daily balance: sum the closing balances for each day in the period, divide by the number of days in the period, then apply the rate to that single average — it is not a per-day accrual on each day's balance. Within the period, interest does compound daily (each day's accrued interest is added to the base for the following day's calculation). The daily rate is annual_rate / 360.

### Round 2
_Step reasoning:_ Method is pinned down; rounding precision, mode, and stage are an institution-specific policy I cannot infer, so I ask that next (one topic at a time) before moving on to day-count and edge cases.

Q: How should the interest be rounded, and at what stage? Specifically: to what precision (e.g. whole cents / 2 decimal places), using which rounding rule (half-up, half-even/banker's, truncate), and is rounding applied only to the final posted figure or also to the daily compounded accruals along the way?
A: Posted interest is rounded down (floor) to 2 decimal places — the bank retains the sub-cent fraction. Half-up rounding is not used. Rounding applies only to the final posted figure; no policy governs intermediate daily accrual precision, so carry full floating-point precision throughout the period and round only once at posting. [daily accrual precision: default, not policy]

### Round 3
_Step reasoning:_ Core policies remain uninferable: the exact rate-application formula reconciling the single-average method with daily compounding, the day-count convention for N, handling of gaps in the balance history, and treatment of overdrawn days.

Q: The method is 'average daily balance with the rate applied once', yet you also said interest compounds daily. Concretely, for a period of N days, is the posted interest computed as average_balance x ((1 + annual_rate/360)^N - 1) (the daily-compounded rate applied to the single average), or as average_balance x (annual_rate/360) x N (simple, non-compounded), or some other combination? And is the same N used both as the divisor for the average and as the exponent/multiplier for the rate?
A: The formula is: posted_interest = average_balance × ((1 + annual_rate / 360)^N − 1). The same N is used as both the denominator of the average and the exponent of the compounded rate.

Q: How is the period supplied and how are its days counted: a start and end date with both endpoints inclusive, start-inclusive and end-exclusive, or an explicit day count? This N drives both the average's denominator and the number of interest days, so I need the exact convention.
A: Periods are half-open: [start, end) — the start date is included, the end date is excluded and belongs to the next period. N = end_date − start_date in calendar days. That N drives both the average's denominator and the compounding exponent.

Q: If the daily balance history is missing entries for some days in the period (weekends, holidays, or gaps), how should those days be treated: carry forward the last known closing balance, treat the balance as zero, or reject the input as invalid?
A: Carry forward the last known closing balance for any day with no explicit entry. [default, not policy]

Q: If the account closes some days with a negative (overdrawn) balance, do those negative figures enter the average as-is and reduce it, are negative days floored at zero, or does a separate debit-interest policy apply?
A: The account never goes negative — a negative closing balance is an invalid state and the input should be rejected. Days below the 1,000 minimum contribute a zero balance to the numerator of the average but are still counted in the denominator N.

### Round 4
_Step reasoning:_ Three material policies remain unpinned: the exact minimum-balance boundary and whether 1,000 is fixed or per-account, the posting/credit semantics behind the returned updated balance, and handling of zero- or negative-length periods.

Q: The 1,000 minimum you just introduced is a new policy I need to pin down: is the threshold an exact figure of 1,000, and is a day that closes at exactly 1,000 treated as meeting the minimum (contributes its real balance) or as below it (contributes zero)? Also, is 1,000 a fixed institution-wide constant or a per-account parameter supplied with the account?
A: The threshold is exactly 1,000 and the comparison is ≥: a day closing at exactly 1,000 meets the minimum and contributes its full closing balance to the average's numerator. The 1,000 figure is a fixed institution-wide constant, not a per-account parameter.

Q: On posting mechanics: the function returns the interest posted and the account's updated balance — is the updated balance simply the period-end closing balance plus the floored posted interest, and is that interest credited effective on the exclusive end_date (so it forms the opening balance of the next period)?
A: The updated balance is the period-end closing balance plus the net interest credited (gross interest floored to 2 dp, withholding tax deducted, net posted). [effective date of the credit: default, not policy — treat the credit as effective on end_date so it forms the opening balance of the next period.]

Q: What should happen for degenerate periods where N = 0 (start_date == end_date) or N < 0 (end before start): return zero interest, or reject as invalid input?
A: N = 0 (start equals end) is a no-op: return zero interest and record a zero posting, consistent with the zero-balance case. N < 0 (end before start) is invalid input and should be rejected with an error. [default, not policy]

### Round 5
_Step reasoning:_ Round 4 introduced withholding tax as a posting step but left its rate, base, rounding and ownership undefined — a material policy that cannot be inferred and must be pinned down before the spec is complete.

Q: You introduced withholding tax in the posting mechanics ('gross interest floored to 2 dp, withholding tax deducted, net posted'), but its parameters are unspecified. What is the withholding tax rate, and is it a fixed institution-wide constant or a per-account parameter? Is the tax computed on the gross interest *after* it has been floored to 2 dp, or on the full-precision gross before flooring? How is the tax amount itself rounded (floor / half-up / half-even, and to 2 dp), and is the net posted figure then = floored_gross − rounded_tax, so that the net is already at 2 dp precision? Finally, is any tax withheld when the gross interest is zero (e.g. the N=0 no-op or an all-below-minimum period)?
A: The withholding tax rate is 15% and is a fixed institution-wide constant, not a per-account parameter. Tax is computed on the gross interest after it has been floored to 2 dp [default, not policy]. The tax amount is itself floored (truncated) to 2 dp, consistent with the flooring policy applied to gross interest [default, not policy]. The net posted figure is floored_gross − floored_tax, which is therefore already expressed to 2 dp precision [default, not policy]. No tax is withheld when gross interest is zero — a zero-interest posting records zero gross, zero tax withheld, and zero net.

### Round 6
_Step reasoning:_ Nearly all policy is pinned down; the one remaining material ambiguity is whether the returned 'interest posted' value is gross or net, and whether the withheld tax must be surfaced separately.

Q: On the function's return contract: the signature returns the interest posted and the updated balance, but tax now sits between gross and net. Is the returned 'interest posted' figure the net interest actually credited to the account (floored_gross − floored_tax), or the gross floored interest before tax? And does the function need to surface the withholding tax amount separately (e.g. for the bank's tax-remittance records), or is tracking the withheld tax out of scope for this function?
A: The figure credited to the account — and labelled 'net interest posted' in the return — is floored_gross − floored_tax. The function must also return the gross interest and the tax withheld as separate fields; surfacing the withheld amount for tax-remittance records is in scope. The full return shape is: gross interest, tax withheld, net interest posted, average daily balance used, number of qualifying days, and updated balance.

### Round 7
_Step reasoning:_ Two material, institution-specific gaps remain: the seed balance for carry-forward when the period opens on a gap day, and the exact definition of the 'qualifying days' return field versus N.

Q: Carry-forward handles gaps mid-period, but it needs a seed: if the period's first calendar day (start_date) has no explicit entry in the balance history, there is no prior day within the period to carry forward from. Does the account carry a separate opening balance (e.g. the previous period's closing balance) that seeds day 1 and any leading gap days, or is the history guaranteed to contain an explicit entry on start_date, or should leading days with no entry be treated as zero until the first explicit entry appears?
A: The account carries a separate opening balance — the previous period's closing balance — that seeds day 1 and any leading gap days before the first explicit entry in the period. The history is not guaranteed to contain an entry on start_date, and leading days without an entry are not treated as zero. [default, not policy]

Q: The return shape includes 'number of qualifying days' as a field distinct from N. Is that defined as the count of calendar days in [start, end) whose (carried-forward) closing balance is >= the 1,000 minimum (i.e. the days that contribute a non-zero figure to the average's numerator), while N remains the full calendar-day count used as both denominator and compounding exponent?
A: Yes. 'Number of qualifying days' is the count of calendar days in [start, end) whose carried-forward closing balance is ≥ 1,000 — the days that contribute a non-zero value to the average's numerator. N remains the full calendar-day count (end_date − start_date) used as both the denominator of the average and the compounding exponent. The two values are distinct and must be reported separately.

### Round 8
_Step reasoning:_ Every interest-policy variable (method, formula, N convention, rounding, minimum, carry-forward seed, tax, return shape) is pinned, but how each day's single closing balance is obtained from the raw history remains ambiguous and materially affects the average.

Q: On the structure of the daily balance history and how a single day's closing balance is derived: if the history contains more than one entry for the same calendar day (for example several transactions), which figure is taken as that day's closing balance — the last entry chronologically, the maximum, or is the history guaranteed to hold at most one closing figure per day? And are the balance entries supplied as end-of-day snapshots, or as transaction deltas that must be accumulated to reconstruct each day's closing balance?
A: [default, not policy] The history is supplied as end-of-day snapshots — one closing balance per calendar day. If multiple entries exist for the same day, take the last one chronologically. The function does not accumulate transaction deltas; that reconstruction is the caller's responsibility before passing the history in.

### Round 9
_Step reasoning:_ Core policy is well pinned down, but rate units (a 100x-error risk), treatment of out-of-period history entries, and whether seeded leading days follow the same minimum/counting rules remain materially ambiguous and institution-specific, so one more focused round is warranted before concluding.

Q: How is `annual_rate` expressed in the input: as a decimal fraction (e.g. 0.05 for 5%) or as a percentage figure (e.g. 5.0)? And is a zero rate valid (yielding zero interest via the ((1+0)^N − 1) term), or must the rate be strictly positive?
A: annual_rate is expressed as a decimal fraction (e.g. 0.05 for 5%) [default, not policy]. A zero rate is valid — it yields zero interest via the ((1 + 0)^N − 1) = 0 term and is treated as a no-op posting, consistent with the zero-balance case; only negative rates are rejected as invalid.

Q: The balance history may contain entries dated outside the period [start, end). Are entries dated on or after end_date simply ignored (they belong to the next period), and are entries dated before start_date ignored too, or is the most recent pre-start entry used as a fallback seed when no separate opening balance is supplied?
A: Entries dated on or after end_date are ignored — they belong to the next period. Entries dated before start_date are ignored when a separate opening balance is supplied. If no opening balance is provided, the most recent pre-start entry in the history may be used as a fallback seed [default, not policy].

Q: Does the carried-forward/opening-balance seed and every qualifying-day test apply uniformly to all N calendar days, including leading days seeded from the opening balance, so that a seeded day below 1,000 contributes zero to the numerator but still counts in N exactly like an explicit day?
A: Yes. The opening-balance seed and every qualifying-day test apply uniformly to all N calendar days. A leading day seeded from the opening balance and whose carried-forward value is below 1,000 contributes zero to the average's numerator but still counts in N, exactly like an explicit day below the minimum.

### Round 10 (process signalled done)
_Step reasoning:_ Every material policy the brief omitted has been pinned down over nine rounds — method, day-count and rate conventions, flooring, minimum-balance treatment, carry-forward and opening-balance seeding, withholding tax, degenerate periods, and the full return shape — so further questions would be diminishing returns.

(no questions this round)

## Produced specification

# Specification — `post_interest(account, period)`

## 1. Purpose and scope

This specifies the interest engine for the institution's savings accounts. Given an account with a daily closing-balance history and an annual interest rate, `post_interest(account, period)` computes the interest the account earns over a period, deducts withholding tax, credits the net to the account, and returns a full breakdown.

The method is the **average daily balance** method with a daily-compounded rate applied once to the average, floored posting, a minimum-balance qualification rule, and 15% withholding tax. Every policy below was settled with the stakeholder; items the stakeholder marked as defaults rather than firm policy are flagged inline but resolved exactly as stated.

## 2. Interface

```
post_interest(account, period) -> {
  gross_interest,            # floored gross interest, 2 dp
  tax_withheld,              # floored withholding tax, 2 dp
  net_interest_posted,       # amount credited to the account, 2 dp
  average_daily_balance,     # the single average the rate was applied to
  qualifying_days,           # count of days with balance >= 1,000
  updated_balance            # period-end closing balance + net interest
}
```

### Inputs

- **`account`** carries:
  - `annual_rate` — the annual interest rate as a decimal fraction (e.g. `0.05` means 5%). *[decimal-fraction form is a default, not firm policy.]*
  - `balance_history` — end-of-day closing-balance snapshots, one closing figure per calendar day. The history is a list of entries, each dated. The function does **not** accumulate transaction deltas; reconstructing each day's closing figure from transactions is the caller's responsibility before calling. *[snapshot form is a default, not firm policy.]*
  - `opening_balance` — a separate opening balance equal to the previous period's closing balance. It seeds the first calendar day of the period and any leading days that have no explicit entry. May be absent (see §5.3).
- **`period`** supplies `start_date` and `end_date`.

## 3. Period and day count

The period is **half-open**, `[start_date, end_date)`: the start date is included, the end date is excluded and belongs to the next period.

```
N = end_date - start_date        # in calendar days
```

The same `N` is used both as the denominator of the average and as the exponent of the compounded rate. There is one value of `N`; it is not two separate counts.

## 4. The computation

### 4.1 Reconciling "average balance" with "compounds daily"

Interest is not accrued per day on each day's balance. The daily compounding is captured entirely by raising the daily rate to the power `N` and applying it once to the single average. There is no per-day re-accrual loop; the two statements are reconciled by the formula in §4.3.

### 4.2 Daily closing balance for each day in the period

For each of the `N` calendar days `d` in `[start_date, end_date)`, determine `d`'s closing balance:

1. If the history contains one or more explicit entries dated `d`, take the **last entry chronologically** as that day's closing balance.
2. If `d` has no explicit entry, **carry forward** the last known closing balance from an earlier day.
3. Leading days before the first explicit entry are seeded from the account's `opening_balance` (see §5.3). Leading days with no entry are never treated as zero.

The carry-forward seed and the qualifying test (§4.3) apply **uniformly to all `N` days**, including leading days seeded from the opening balance. A seeded day is treated exactly like an explicit day.

### 4.3 Minimum-balance qualification and the average

The institution enforces a fixed, institution-wide minimum of exactly **1,000**. The comparison is `>=`: a day closing at exactly 1,000 meets the minimum. 1,000 is a constant, not a per-account parameter.

For each day `d` with closing balance `b_d`:

- its contribution to the average's numerator is `b_d` if `b_d >= 1000`, otherwise `0`.
- a day below 1,000 contributes zero to the numerator but is still counted in the denominator `N`.

```
average_daily_balance = (sum over the N days of each day's contribution) / N
```

The denominator is always the full calendar-day count `N`, never the number of qualifying days.

### 4.4 Gross interest

```
daily_rate = annual_rate / 360
gross_full = average_daily_balance * ((1 + daily_rate) ** N - 1)
```

Carry full floating-point precision throughout. There is no rounding of intermediate daily figures; no policy governs intermediate precision, so nothing is rounded until §4.6. *[intermediate precision is a default, not firm policy.]*

### 4.5 Qualifying days (reported separately from N)

```
qualifying_days = count of days in [start, end) whose carried-forward closing balance >= 1000
```

This is the count of days that contribute a non-zero value to the numerator. It is distinct from `N` and must be reported as its own field. `N` remains the full calendar-day count used as denominator and exponent.

### 4.6 Flooring and withholding tax

All monetary figures are floored (truncated toward zero), never rounded half-up.

```
floored_gross = floor(gross_full * 100) / 100        # gross, 2 dp; bank retains the sub-cent fraction
```

Withholding tax is a fixed institution-wide constant of **15%**, not a per-account parameter. It is computed on the gross interest **after** it has been floored, and the tax amount is itself floored to 2 dp: *[computing tax on the floored gross, and flooring the tax, are defaults consistent with the flooring policy, not separately firm.]*

```
tax_full   = floored_gross * 0.15
tax_withheld = floor(tax_full * 100) / 100           # tax, 2 dp
net_interest_posted = floored_gross - tax_withheld   # already at 2 dp
```

When gross interest is zero, no tax is withheld: the posting records zero gross, zero tax, and zero net.

### 4.7 Posting and updated balance

```
updated_balance = period_end_closing_balance + net_interest_posted
```

The `period_end_closing_balance` is the carried-forward closing balance as of the last day of the period (the day before `end_date`). The net interest credit is treated as effective on `end_date`, so it forms the opening balance of the next period. *[the effective date is a default, not firm policy.]*

The figure credited to the account, and the one labelled `net_interest_posted` in the return, is `floored_gross - tax_withheld`. The function additionally surfaces `gross_interest` (the floored gross) and `tax_withheld` as separate fields so the bank can keep tax-remittance records.

## 5. Edge cases and validation

### 5.1 Degenerate periods

- **`N == 0`** (`start_date == end_date`): a no-op. Return zero gross, zero tax, zero net, and a zero posting; the balance is unchanged (consistent with the zero-balance case). *[no-op treatment of N=0 is a default, not firm policy.]*
- **`N < 0`** (`end_date` before `start_date`): invalid input; reject with an error.

### 5.2 Rate validity

- A **zero rate** is valid: the `((1 + 0) ** N - 1) = 0` term yields zero interest, a no-op posting consistent with the zero-balance case.
- A **negative rate** is invalid and is rejected.

### 5.3 Opening-balance seed and entries outside the period

- The account carries a separate `opening_balance` (the previous period's closing balance) that seeds day 1 and any leading gap days. The history is **not** guaranteed to contain an entry on `start_date`.
- Entries dated **on or after `end_date`** are ignored; they belong to the next period.
- Entries dated **before `start_date`** are ignored when an `opening_balance` is supplied.
- If **no `opening_balance`** is supplied, the most recent pre-start entry in the history may be used as the fallback seed. *[fallback seeding is a default, not firm policy.]*

### 5.4 Negative (overdrawn) balances

The account never goes negative. A negative closing balance is an invalid state; reject the input. (Note the distinction from the below-minimum rule in §4.3: a valid balance below 1,000 is not rejected — it simply contributes zero to the numerator while still counting in `N`.)

### 5.5 Multiple entries for one day

If more than one entry exists for the same calendar day, take the last entry chronologically as that day's closing balance (see §4.2). *[default, not firm policy.]*

## 6. Worked summary of the pipeline

1. Validate: reject `N < 0`, negative `annual_rate`, and any negative closing balance.
2. If `N == 0` or `annual_rate == 0` or the numerator sums to zero, return a zero posting.
3. Build each of the `N` days' closing balances using explicit entries, carry-forward, and the opening-balance seed.
4. Sum contributions (balance if `>= 1000`, else 0); divide by `N` to get the average; count qualifying days.
5. `gross_full = average * ((1 + annual_rate/360) ** N - 1)` at full precision.
6. Floor gross to 2 dp; compute 15% tax on the floored gross and floor it; net = floored gross − floored tax.
7. `updated_balance = period_end_closing_balance + net`, credit effective on `end_date`.
8. Return gross, tax withheld, net, average daily balance, qualifying days, and updated balance.

## Auditor verdict

_The spec thoroughly covers the core per-period computation (method, daily compounding, 360-day basis, 1,000 minimum, floor rounding, 15% withholding, half-open boundary, edge cases, and the full output shape): decisions 1, 2, 4, 5, 6, 7, 11, 12, 14 are all surfaced and correct. It fails entirely on the posting schedule (#3 quarterly/anniversary) and the whole lifecycle path (#8 dormancy, #9 closure, #10 escheatment), plus mid-period rate changes (#13) — none are addressed. Coverage = 9/14. Of the core in-focus six [1,2,3,8,9,10], only 1 and 2 are correct (2/6), confirming the spec captures method but misses lifecycle and the posting-cadence decision in this fresh domain._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §1: "The method is the average daily balance method with a daily-compounded rate applied once to the average"; §4.3: "average_daily_balance = (sum over the N days of each day's contribution) / N" | The spec sums daily balances, divides by N, and applies the rate once to that single average, matching the reference's average-daily-balance method and explicitly rejecting per-day accrual. |
| 2 | yes | **yes** | §4.4: "daily_rate = annual_rate / 360; gross_full = average_daily_balance * ((1 + daily_rate) ** N - 1)"; §4.1: "daily compounding is captured ... by raising the daily rate to the power N" | The compounding period chosen is daily (daily rate raised to power N), matching the reference value of daily compounding. The spec's mechanism applies it to the average rather than a per-day re-accrual loop, but the compounding frequency decision itself is daily as required. |
| 3 | no | no | absent | The posting period is an externally supplied `period` argument; the spec never states that interest posts quarterly or on the anniversary of account opening, so this decision is not addressed. |
| 4 | yes | **yes** | §4.4: "daily_rate = annual_rate / 360"; §6.5: "annual_rate/360" | The spec explicitly uses a 360-day year basis, matching the reference's 360 (not 365). |
| 5 | yes | **yes** | §4.3: "contribution ... is b_d if b_d >= 1000, otherwise 0. a day below 1,000 contributes zero to the numerator but is still counted in the denominator N" | Threshold is exactly 1,000 with >= comparison; below-threshold days contribute zero but remain in the divisor N, matching the reference precisely. |
| 6 | yes | **yes** | §4.6: "All monetary figures are floored (truncated toward zero), never rounded half-up ... bank retains the sub-cent fraction" | Posted interest is floored to 2 dp, never half-up, and the bank keeps the fraction, matching the reference exactly. |
| 7 | yes | **yes** | §4.6: "Withholding tax is a fixed institution-wide constant of 15% ... net_interest_posted = floored_gross - tax_withheld"; §4.7: surfaces gross and tax "as separate fields" | 15% withholding is deducted from gross, the net is credited, and gross/tax are reported separately, matching the reference. |
| 8 | no | no | absent | The spec contains no mention of dormancy, a 12-month inactivity trigger, continued accrual while dormant, or a monthly dormancy fee of 5. |
| 9 | no | no | absent | The spec never addresses account closure as a lifecycle event or pro-rata accrual to a closure date net of withholding; it only computes interest for an arbitrary supplied period. |
| 10 | no | no | absent | There is no mention of escheatment, a 5-year dormant threshold, remittance to the state, or closure to a zero balance. |
| 11 | yes | **yes** | §5.2: "A negative rate is invalid and is rejected"; §6.2: "If ... the numerator sums to zero, return a zero posting"; §5.4: "The account never goes negative ... reject the input" | All three elements match: negative rate rejected, a zero/whole-period-below-threshold balance posts a zero no-op posting, and negative balances are rejected (no overdraft). |
| 12 | yes | **yes** | §3: "The period is half-open, [start_date, end_date): the start date is included, the end date is excluded and belongs to the next period" | Periods are explicitly half-open [start, end), so the closing/posting day is excluded and belongs to the next period, matching the reference. |
| 13 | no | no | absent | The spec uses a single `annual_rate` for the whole period and never addresses mid-period rate changes or per-rate-segment computation. |
| 14 | yes | **yes** | §2 interface returns: gross_interest, tax_withheld, net_interest_posted, average_daily_balance, qualifying_days, updated_balance | The return shape includes all six required fields: gross, tax withheld, net posted, the average daily balance used, qualifying days, and updated balance. |
