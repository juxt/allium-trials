# prose — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 7 · Captured: 6/14 · Bespoke captured: 5/10

## Conversation

### Round 1
_Step reasoning:_ The brief omits several policy decisions that cannot be reliably inferred and have multiple plausible answers, so I ask the stakeholder before writing the spec.

Q: Day-count convention: how is the daily periodic rate derived from the annual rate — actual/365 (fixed), actual/360, actual/actual (so leap years use 366), or 30/360?
A: actual/360 — the daily periodic rate is annual_rate / 360.

Q: Accrual basis: is interest simple over the period (sum of daily accruals on principal), or does it compound during the period (each day's accrued interest joins the balance and itself earns interest)?
A: Compounds daily — each day's accrued interest joins the base for the next day's accrual within the period.

Q: Which daily balance applies for each day's accrual — the opening (start-of-day) balance or the closing (end-of-day) balance?
A: Not specified in policy. [default, not policy] Assume end-of-day (closing) balance.

Q: Rounding: to what precision is interest rounded (e.g. whole cents/2dp), using which rule (half-up, half-even/bankers', or truncation), and is rounding applied once to the period total or to each daily accrual?
A: Truncation (floor) to 2 decimal places (minor unit); the bank keeps the fraction. Rounding is applied once to the period total, not to each daily accrual.

Q: Period boundaries: are the start and end dates both inclusive, and if the balance history has gaps or a day is missing, what balance should be assumed for that day?
A: Periods are half-open [start, end) — the start date is inclusive, the posting date is exclusive. For gaps in balance history: [default, not policy] carry forward the last known balance.

Q: Negative balances: if the account is overdrawn on some days, do those days accrue negative interest (a charge) at the same rate, accrue nothing, or use a separate rate?
A: The account never goes negative — this scenario does not arise. Days where the balance is below the 1,000 minimum contribute zero interest but still count in the divisor.

Q: Posting: is the computed interest added to the account balance (and is a minimum threshold applied, e.g. amounts below one cent dropped or carried forward), and in what currency/precision is the balance held?
A: Net interest (gross minus 15% withholding tax, floored to 2 dp) is credited to the account balance at posting. A zero-interest result is recorded as a no-op posting rather than dropped. [default, not policy] Balances are held in the account's native currency to 2 decimal places; no sub-cent carry-forward is defined.

### Round 2 (process signalled done)
_Step reasoning:_ All material policy decisions (day-count, compounding, balance basis, rounding, period boundaries, minimum-balance treatment, withholding tax, and posting) have been answered, so I have enough to write the specification.

(no questions this round)

## Produced specification

# Requirements Specification — `post_interest(account, period)`

## 1. Purpose

Compute the interest a savings account earns over a posting period from its daily balance history and annual interest rate, then post the net interest to the account. This specification defines the interest engine's single entry point:

```
post_interest(account, period) -> (interest_posted, updated_balance)
```

It returns the net interest posted and the account's updated balance.

## 2. Inputs

**`account`**
- Holds a current balance in the account's native currency, carried to 2 decimal places.
- Provides access to a daily balance history: for each day, the balance state used to derive that day's accrual.
- Carries the annual interest rate (`annual_rate`) as a decimal fraction (e.g. 0.03 for 3% per annum).

**`period`**
- A half-open date range `[start, end)`.
- `start` is inclusive; `end` (the posting date) is exclusive.
- The days that accrue interest are every date `d` with `start <= d < end`.

## 3. Day-count convention

Actual/360. The daily periodic rate is:

```
daily_rate = annual_rate / 360
```

The divisor is always 360 regardless of the calendar year (leap years included). "Actual" refers to the actual number of days accrued (one accrual per calendar day in `[start, end)`); the rate denominator is fixed at 360.

## 4. Daily balance selection

For each accrual day, use the end-of-day (closing) balance for that day.

(Policy did not specify opening vs closing; end-of-day is adopted as the resolved default.)

## 5. Gaps in balance history

If the balance history has no entry for a day within the period, carry forward the last known balance (the most recent prior day's closing balance) for that day.

(Policy did not specify gap handling; carry-forward is adopted as the resolved default.)

## 6. Accrual basis — daily compounding

Interest compounds daily within the period. Each day's accrued interest joins the base for the next day's accrual.

Define, for each accrual day `d` in chronological order over `[start, end)`:
- `closing_balance(d)` = the day's end-of-day balance (Section 4), with carry-forward applied for gaps (Section 5).
- `base(d)` = the compounding base for day `d`, being `closing_balance(d)` plus all interest accrued on prior days within this period.

The accrued interest carried forward is tracked separately as a running sum and added to the day's closing balance to form that day's base. Formally, with `accrued_before(d)` = the sum of daily accruals for all prior days in the period:

```
base(d)            = closing_balance(d) + accrued_before(d)
daily_accrual(d)   = base(d) * daily_rate
accrued_after(d)   = accrued_before(d) + daily_accrual(d)
```

for the first accrual day, `accrued_before = 0`.

Daily accruals are NOT rounded. They are kept at full precision and summed; rounding is applied only once to the period total (Section 8).

## 7. Minimum-balance and non-negative rules

- The account never goes negative; overdrawn/negative-balance handling is out of scope and need not be implemented.
- There is a minimum qualifying balance of 1,000 (in the account's native currency, same units as the balance).
- On any day where the applicable balance is below 1,000, that day contributes zero interest (`daily_accrual(d) = 0`) but the day still counts as an accrued day — it remains in the period and its zero accrual is part of the sequence. It is not skipped and does not shorten the period.
- A day that contributes zero interest still carries the existing `accrued_before` forward unchanged (`accrued_after(d) = accrued_before(d)`).

The balance compared against the 1,000 threshold is the same base used for accrual, i.e. the day's closing balance (Section 4). A day qualifies when that balance is greater than or equal to 1,000; below 1,000 contributes zero.

## 8. Rounding of the gross period interest

After summing all daily accruals across the period at full precision, compute the gross period interest and truncate (floor) to 2 decimal places (the minor unit):

```
gross_interest_raw = sum over d in [start, end) of daily_accrual(d)
gross_interest     = floor(gross_interest_raw to 2 dp)
```

- Rounding rule: truncation toward zero (floor for non-negative amounts); the bank keeps the sub-cent fraction.
- Rounding is applied ONCE to the period total, never to individual daily accruals.

## 9. Withholding tax and net interest

A 15% withholding tax is applied to the gross period interest. The net interest credited is gross minus withholding, floored to 2 decimal places:

```
withholding_tax = gross_interest * 0.15
net_interest    = floor(gross_interest - withholding_tax to 2 dp)
```

The net interest is the amount credited to the account (`interest_posted` in the return value). Net interest is truncated (floored) to 2 dp, consistent with Section 8's rounding rule.

## 10. Posting

- The computed `net_interest` is added to the account balance at posting:
  ```
  updated_balance = account.balance + net_interest
  ```
- The balance is held in the account's native currency to 2 decimal places. No sub-cent carry-forward is defined; any fraction below the minor unit is already discarded by the truncation in Sections 8 and 9.
- Zero-interest result: if `net_interest` is 0.00, the posting is recorded as an explicit no-op posting — it is recorded, not dropped or skipped. The account balance is unchanged in that case.
- There is no separate minimum-posting threshold beyond the above (amounts are not dropped or carried forward for being small; they are simply truncated to 2 dp).

## 11. Return value

```
post_interest(account, period) -> (interest_posted, updated_balance)
```

- `interest_posted` = `net_interest` (net of withholding, truncated to 2 dp; may be 0.00).
- `updated_balance` = the account balance after crediting `net_interest`, to 2 dp in the account's native currency.

## 12. Worked calculation order (summary)

1. Enumerate accrual days `d` for every date with `start <= d < end` (half-open).
2. For each day, determine its closing balance, carrying forward the last known balance across gaps.
3. Process days chronologically, maintaining a running full-precision accrued-interest total. For each day: form the base as closing balance plus accrued-so-far; if that balance is below 1,000, the day's accrual is zero; otherwise accrue `base * (annual_rate / 360)`. Add the day's accrual to the running total.
4. `gross_interest` = floor(running total to 2 dp).
5. `net_interest` = floor(gross_interest - 15% withholding to 2 dp).
6. Credit `net_interest` to the balance; record the posting (recording a no-op when `net_interest` is 0.00).
7. Return `(net_interest, updated_balance)`.

## 13. Explicitly resolved defaults (not institutional policy)

These were not fixed by stakeholder policy and are resolved here as stated:
- Daily balance basis: end-of-day (closing) balance.
- Gap handling: carry forward the last known balance.
- Balance precision/currency: account's native currency to 2 decimal places, with no sub-cent carry-forward.

## 14. Out of scope

- Negative or overdrawn balances (the account never goes negative).
- Any rate other than the single `annual_rate` (there is no separate rate for sub-minimum or any other days).
- Sub-cent carry-forward or accumulation across posting periods.

## Auditor verdict

_The spec covers the per-period computation mechanics well (daily compounding #2, 360 basis #4, 1,000 threshold #5, floor rounding #6, 15% withholding #7, half-open boundary #12) but gets the core method wrong: it uses per-day daily-balance accrual rather than average daily balance (#1). It entirely omits the lifecycle decisions (posting frequency #3, dormancy #8, closure #9, escheatment #10) and mid-period rate changes (#13), and its return value discloses only net interest and balance rather than the full reporting shape (#14). Negative-rate rejection (#11) is also absent. Correct: 6/14 (#2, #4, #5, #6, #7, #12)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | no | Section 6: "base(d) = closing_balance(d) + accrued_before(d)"; "daily_accrual(d) = base(d) * daily_rate"; "gross_interest_raw = sum over d ... of daily_accrual(d)" | The spec uses a per-day daily-balance method (rate applied to each day's balance and summed), not average daily balance (sum balances, divide by days, apply rate once to the average). This is explicitly the method the reference says is NOT correct. |
| 2 | yes | **yes** | Section 6: "Interest compounds daily within the period. Each day's accrued interest joins the base for the next day's accrual." | Matches the reference exactly: daily compounding where each day's interest joins the base for the next day. |
| 3 | no | no | absent | The spec treats the posting period as a given input `[start, end)` and never specifies posting frequency (quarterly) or that posting occurs on the anniversary of account opening. |
| 4 | yes | **yes** | Section 3: "daily_rate = annual_rate / 360"; "The divisor is always 360 regardless of the calendar year (leap years included)." | Matches the reference's 360 days-in-year basis exactly. |
| 5 | yes | **yes** | Section 7: "minimum qualifying balance of 1,000 ... On any day where the applicable balance is below 1,000, that day contributes zero interest ... but the day still counts as an accrued day" | Matches the reference: interest accrues only on days at/above 1,000; days below contribute zero but still count in the period. Note the spec compares against base including accrued interest whereas reference implies the balance, but the threshold value, zero-contribution, and divisor-day treatment all match. |
| 6 | yes | **yes** | Section 8: "truncate (floor) to 2 decimal places ... truncation toward zero (floor for non-negative amounts); the bank keeps the sub-cent fraction ... applied ONCE to the period total" | Matches the reference: posted interest floored to 2 dp, never half-up, bank keeps the fraction. |
| 7 | yes | **yes** | Section 9: "A 15% withholding tax is applied to the gross period interest. The net interest credited is gross minus withholding ... net_interest = floor(gross_interest - withholding_tax to 2 dp)" | Matches the reference: 15% withholding deducted at posting, account credited the net. The reference also wants tax reported separately; the spec computes withholding_tax but only returns net (see #14), yet the 15% deduction and net crediting match. |
| 8 | no | no | absent | The spec has no dormancy concept — no 12-month inactivity trigger, no continued accrual while dormant, no monthly dormancy fee of 5. |
| 9 | no | no | absent | The spec never addresses account closure mid-period or pro-rata accrual to a closure date; it only handles a given posting period. |
| 10 | no | no | absent | The spec has no escheatment concept — no 5-year dormant threshold, no remittance to the state, no zero-balance closure. |
| 11 | yes | no | Section 7: "The account never goes negative"; Section 10: "if net_interest is 0.00, the posting is recorded as an explicit no-op posting"; Section 14: negative balances out of scope | The spec covers non-negative balances and the zero no-op posting, but it does not address a negative rate being rejected as invalid. Partial coverage; the reference requires negative-rate rejection which is absent, so the resolution is incomplete. |
| 12 | yes | **yes** | Section 2: "A half-open date range [start, end). start is inclusive; end (the posting date) is exclusive. The days that accrue interest are every date d with start <= d < end." | Matches the reference: periods are half-open [start, end), the posting day (end) is excluded from the period it closes and thus included in the next. |
| 13 | no | no | Section 14: "Any rate other than the single annual_rate ... is out of scope"; Section 2 carries a single annual_rate | The spec explicitly assumes a single annual_rate for the whole period and puts any other rate out of scope; it does not handle mid-period rate changes with per-day in-force rates and per-segment computation. |
| 14 | yes | no | Section 11: "post_interest(...) -> (interest_posted, updated_balance)" where interest_posted = net_interest and updated_balance = balance after crediting | The spec returns only net interest and updated balance. It does not report gross interest, tax withheld, average daily balance used, or number of qualifying days, so the output shape does not match the reference's disclosure. |
