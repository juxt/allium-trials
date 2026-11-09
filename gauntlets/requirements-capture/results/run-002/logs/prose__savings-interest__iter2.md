# prose — savings-interest — iteration 2

Model (author): claude-opus · Questions asked: 8 · Captured: 6/14 · Bespoke captured: 5/10

## Conversation

### Round 1
_Step reasoning:_ The brief omits day-count, compounding, rounding, balance basis and posting semantics, each of which has several plausible answers only the stakeholder can pin down, so I ask before specifying.

Q: Day-count convention: should the daily rate be annual_rate/365, annual_rate/360, actual/actual (so 366 in leap years), or 30/360?
A: annual_rate / 360

Q: Simple or compound accrual: does each day's interest accrue on principal only (simple, summed over the period), or does interest compound daily on the prior day's accrued-plus-balance?
A: Compound daily: each day's interest joins the base for the next day's accrual within the period.

Q: Rounding: to what precision (e.g. whole cents / 2 dp), using which rounding mode (half-up, half-even/banker's, truncate), and is rounding applied per-day or once at posting time?
A: 2 decimal places (minor unit); floor/truncate — never half-up; rounding applied once at posting time, not per day.

Q: Which daily balance drives each day's accrual (closing/end-of-day balance, opening balance), and are the period's start and end dates both inclusive?
A: End-of-day (closing) balance drives each day's accrual [default, not policy on opening vs closing]. Periods are half-open [start, end): start date inclusive, end date exclusive — the posting day is excluded from the period it closes and included in the next.

Q: Does posting add the interest to the account balance (and should post_interest return that new balance), and is interest ever withheld for tax or subject to a minimum/threshold before posting?
A: Yes, net interest is credited to the account balance; return the updated balance. 15% withholding tax is deducted from gross interest at each posting — the account receives the net, tax is reported separately. Interest accrues only on days the balance is at or above 1,000; on days below that threshold the day contributes zero interest but still counts in the average-balance divisor.

### Round 2
_Step reasoning:_ The sub-threshold answer introduced an 'average-balance divisor' that conflicts with the earlier 'compound daily' method; this plus tax/rounding order and the balance-history data shape must be resolved before I can write an implementable spec.

Q: You said interest compounds daily (each day's interest joins the base for the next day), but you also referred to an "average-balance divisor" when describing the sub-1,000 threshold. These imply two different methods. Which governs the accrual: (a) true daily compounding where each qualifying day accrues rate/360 on the prior running base, with sub-threshold days simply contributing zero; or (b) an average-balance method where we sum qualifying daily balances, divide by a divisor (the count of days in the period, including sub-threshold days), and apply the rate to that average? If (b), exactly which days count in the divisor numerator vs denominator, and over what period length?
A: Method (b), average daily balance, governs. The earlier statement about daily compounding was an error. Correct method: for each day d in [start, end), take the closing balance if it is at or above 1,000, otherwise treat that day's contribution as 0; sum those values to form the numerator. The denominator is the total count of all calendar days in [start, end), regardless of whether any given day is sub-threshold. Average daily balance = numerator / denominator. Gross interest = average_daily_balance × (annual_rate / 360) × days_in_period. Sub-threshold days reduce the average (by contributing 0 to the numerator) but are not removed from the divisor.

Q: At posting, in what order are the floor-to-2dp rounding, the gross interest, and the 15% withholding tax applied? For example: compute gross at full precision, floor gross to 2dp, then compute tax as 15% of floored gross and floor the tax to 2dp, with net = gross - tax? Or compute tax on unrounded gross and floor only the net once? I want to pin down the precision and rounding of both the reported tax figure and the net amount credited.
A: The answer key does not specify the sequencing of rounding steps relative to tax. [default, not policy] Recommended order: (1) compute gross interest at full floating-point precision; (2) floor gross to 2 dp — this is the reported gross figure; (3) compute tax as floored_gross × 0.15 at full precision, then floor that to 2 dp — this is the reported tax withheld figure; (4) net = floored_gross − floored_tax — this is the amount credited to the account. Both the gross and tax figures are individually floored before the net is derived, so the bank retains any sub-cent fractions at each step.

Q: How is the account's daily balance history represented (what fields, what granularity), and how should days within [start, end) with no explicit balance record be treated: carry forward the previous closing balance, or treat as zero?
A: The answer key does not specify the balance-history data model. [default, not policy] Treat the account's balance history as an ordered list of (effective_date, closing_balance) records, one per date on which a transaction occurred. For any day in [start, end) with no explicit record, carry forward the most recent prior closing balance. If no prior record exists (i.e. the day falls before the first transaction), treat the balance as 0.

### Round 3 (process signalled done)
_Step reasoning:_ All material policy decisions (day-count, average-daily-balance accrual, threshold-and-divisor treatment, floor rounding, tax sequencing, balance-history model) are now pinned; remaining items were answered as non-policy defaults, so I'm ready to write the spec.

(no questions this round)

## Produced specification

# Requirements specification: `post_interest(account, period)`

## 1. Purpose

Compute the interest a savings account earns over a period from its daily balance history and an annual interest rate, deduct withholding tax, credit the net to the account, and return the posted figures together with the updated balance.

## 2. Interface

```
post_interest(account, period) -> result
```

- `account`: a savings account carrying at least an annual interest rate, a current balance, and a daily balance history (see §3).
- `period`: a date range with a `start` and an `end`, interpreted as the half-open interval `[start, end)` — `start` inclusive, `end` exclusive (see §4).
- `result`: the interest posted and the account's updated balance (see §8).

Posting mutates the account: the net interest is credited to its balance.

## 3. Data model

> Note: the balance-history representation was not fixed by the stakeholder. The following is the resolved default and should be treated as the contract unless the account type dictates otherwise.

The account's balance history is an ordered list of `(effective_date, closing_balance)` records, one record per date on which a transaction occurred. Records are ordered by `effective_date`.

Resolving the closing balance for any calendar day `d`:

1. If a record exists with `effective_date == d`, use its `closing_balance`.
2. Otherwise carry forward the `closing_balance` of the most recent record whose `effective_date < d`.
3. If no record exists on or before `d` (i.e. `d` precedes the first transaction), the balance for `d` is `0`.

The balance that drives each day's accrual is the end-of-day (closing) balance for that day.

All monetary amounts are in the account's minor unit and are handled at 2 decimal places where rounded (see §7). The annual interest rate is expressed as an annual decimal rate (e.g. `0.05` for 5%).

## 4. Period semantics

The period is the half-open interval `[start, end)`:

- `start` is included.
- `end` is excluded. The posting day is excluded from the period it closes and is included in the next period.
- `days_in_period` is the total count of calendar days in `[start, end)`, i.e. every day from `start` up to but not including `end`, with no exclusions.

## 5. Day-count convention

The daily rate is `annual_rate / 360` (ACT/360). The divisor is always 360 regardless of calendar year length or leap years.

## 6. Accrual method — average daily balance

Interest is computed by the average daily balance method. Daily compounding is **not** used.

For each calendar day `d` in `[start, end)`:

- Resolve the day's closing balance per §3.
- The day's contribution to the numerator is the closing balance **if it is at or above the threshold of 1,000**, otherwise `0`.

Then:

```
numerator           = sum over d in [start, end) of day_contribution(d)
denominator         = days_in_period   # count of all calendar days in [start, end)
average_daily_balance = numerator / denominator
gross_interest      = average_daily_balance * (annual_rate / 360) * days_in_period
```

Threshold rule: a day whose closing balance is below 1,000 contributes `0` to the numerator but is still counted in the denominator. Sub-threshold days therefore lower the average rather than being removed from the divisor. The comparison is inclusive: a closing balance exactly equal to 1,000 qualifies and contributes its full value.

All of the above is computed at full floating-point precision; no rounding occurs until posting (§7).

## 7. Rounding, tax and posting order

> Note: the exact sequencing of rounding relative to tax was not fixed by the stakeholder. The order below is the resolved default and is the contract. Rounding is floor/truncate to 2 decimal places — never half-up, never banker's rounding — and is applied at posting time, not per day.

Withholding tax is 15% of gross interest. Apply the steps in this exact order:

1. Compute `gross_interest` at full floating-point precision (§6).
2. `reported_gross = floor(gross_interest, 2dp)` — this is the reported gross interest figure.
3. `tax = floor(reported_gross * 0.15, 2dp)` — compute `reported_gross * 0.15` at full precision, then floor to 2 dp. This is the reported tax-withheld figure.
4. `net = reported_gross - tax` — this is the amount credited to the account.

Both the gross and the tax figures are individually floored before the net is derived, so any sub-cent fractions are retained by the bank at each step. Flooring truncates toward zero at the 2-dp (minor-unit) boundary.

## 8. Posting and return value

Posting credits the **net** interest to the account:

```
updated_balance = account_balance_before_posting + net
```

The account's balance is updated to `updated_balance`. The tax withheld is reported separately and is not credited to the account.

`post_interest` returns:

- the interest posted (the net amount credited), and
- the account's updated balance.

It should additionally surface the reported gross interest and the tax withheld so the tax can be reported separately:

```
result = {
  gross_interest:  reported_gross,   # floored to 2dp
  tax_withheld:    tax,              # floored to 2dp
  net_interest:    net,             # amount credited, = reported_gross - tax
  updated_balance: updated_balance  # balance after crediting net
}
```

## 9. Worked logic summary

1. Enumerate every calendar day in `[start, end)`.
2. For each day, resolve its closing balance (carry-forward; 0 before first record).
3. Numerator = sum of closing balances on days where the balance is >= 1,000; sub-threshold days add 0.
4. Denominator = count of all days in `[start, end)`.
5. `average_daily_balance = numerator / denominator`.
6. `gross_interest = average_daily_balance * (annual_rate / 360) * days_in_period` (full precision).
7. `reported_gross = floor_2dp(gross_interest)`.
8. `tax = floor_2dp(reported_gross * 0.15)`.
9. `net = reported_gross - tax`.
10. Credit `net` to the balance; return `{gross, tax, net, updated_balance}`.

## 10. Edge cases

- **Empty period** (`start == end`, so `days_in_period == 0`): the denominator is 0. Division is undefined; treat gross interest as 0, tax 0, net 0, balance unchanged. (Not covered by the stakeholder; resolved as the only coherent behaviour.)
- **All days sub-threshold**: numerator 0, so average daily balance 0, gross 0, net 0, balance unchanged.
- **No prior record for early days**: those days have balance 0 and are sub-threshold, contributing 0 to the numerator while still counting in the denominator.
- **Flooring is toward zero** at 2 dp; since all amounts here are non-negative this is equivalent to truncation of fractional cents.

## Auditor verdict

_The spec strongly covers the core per-period computation and conventions (decisions 1, 4, 5, 6, 7, 12 correct) but inverts the compounding method (2: states daily compounding is NOT used, opposite of reference) and omits the entire lifecycle path and posting cadence. Posting period (3), dormancy (8), closure (9), escheatment (10), and mid-period rate changes (13) are absent. Edge-case handling (11) is partial (zero-balance no-op present, negative-rate rejection and no-overdraft absent), and the output shape (14) omits the average daily balance and qualifying-days disclosures. Correct: 1, 4, 5, 6, 7, 12 (6 of 14). Of the in-focus core six [1,2,3,8,9,10], only decision 1 is correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §6 'Accrual method — average daily balance' and 'gross_interest = average_daily_balance * (annual_rate / 360) * days_in_period'; §6 'Daily compounding is **not** used.' | The spec computes a single average daily balance over the period and applies the rate once, matching the reference's average daily balance (not per-day daily balance). |
| 2 | yes | no | §6 'Daily compounding is **not** used.' | The reference requires interest to compound daily; the spec explicitly states daily compounding is not used, so the resolution is the opposite of the reference value. |
| 3 | no | no | absent | The spec never specifies a posting period/frequency. It takes an arbitrary `period` argument and says nothing about quarterly posting on the account-opening anniversary, so the quarterly-anniversary decision is neither surfaced nor resolved. |
| 4 | yes | **yes** | §5 'The daily rate is `annual_rate / 360` (ACT/360). The divisor is always 360 regardless of calendar year length or leap years.' | The spec fixes the days-in-year basis at 360, exactly matching the reference. |
| 5 | yes | **yes** | §6 'closing balance **if it is at or above the threshold of 1,000**, otherwise `0`' and 'a day whose closing balance is below 1,000 contributes `0` to the numerator but is still counted in the denominator.' | Matches the reference exactly: threshold of 1,000, inclusive, sub-threshold days contribute zero but still count in the divisor. |
| 6 | yes | **yes** | §7 'Rounding is floor/truncate to 2 decimal places — never half-up, never banker's rounding'; 'any sub-cent fractions are retained by the bank.' | Posted interest is floored (rounded down) to 2 dp with the bank keeping the fraction, matching the reference's floor rule. |
| 7 | yes | **yes** | §7 'Withholding tax is 15% of gross interest'; §8 'the net interest is credited'; 'The tax withheld is reported separately and is not credited to the account.' | 15% withholding tax is deducted from gross at posting, the net is credited, and the tax is reported separately, matching the reference. |
| 8 | no | no | absent | The spec contains no dormancy concept: no 12-month inactivity trigger, no continued accrual while dormant, and no monthly dormancy fee of 5. The lifecycle decision is entirely unaddressed. |
| 9 | no | no | absent | The spec never addresses account closure mid-period or pro-rata accrual to a closure date. It only handles a generic period, so the closure decision is not surfaced. |
| 10 | no | no | absent | There is no mention of escheatment, a 5-year dormant threshold, remittance to the state, or closing to zero balance. The decision is absent. |
| 11 | yes | no | §10 'All days sub-threshold: numerator 0, so average daily balance 0, gross 0, net 0, balance unchanged.' and 'Empty period ... treat gross interest as 0.' No mention of negative rate or no-overdraft. | The spec covers the zero-balance no-op (zero posting), but does not reject a negative rate as invalid nor state the account never goes negative, so the full reference resolution is not matched. |
| 12 | yes | **yes** | §4 'The posting day is excluded from the period it closes and is included in the next period.'; period is half-open `[start, end)`. | The spec adopts half-open [start, end) intervals and explicitly excludes the posting day from the closing period and includes it in the next, matching the reference exactly. |
| 13 | no | no | absent | The spec assumes a single annual_rate for the whole period and never addresses mid-period rate changes or per-segment computation, so the decision is not surfaced. |
| 14 | yes | no | §8 result = { gross_interest, tax_withheld, net_interest, updated_balance }. | The spec returns gross, tax withheld, net, and updated balance, but omits the average daily balance used and the number of qualifying days, so the reporting shape does not fully match the reference. |
