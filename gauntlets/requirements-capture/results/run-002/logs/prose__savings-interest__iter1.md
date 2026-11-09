# prose — savings-interest — iteration 1

Model (author): claude-opus · Questions asked: 11 · Captured: 6/14 · Bespoke captured: 5/10

## Conversation

### Round 1
_Step reasoning:_ The brief omits several interest-policy decisions that cannot be reliably inferred, so I must ask the stakeholder before writing the spec.

Q: Day-count convention: how should the annual rate be converted to a daily rate (actual/365, actual/360, 30/360, or actual/actual with leap-year handling)?
A: actual/360 — the daily rate is annual_rate / 360.

Q: Compounding: is interest simple over the period, or does it compound, and if so at what frequency (daily, monthly) and does accrued interest join the balance before the period ends?
A: Compounds daily; each day's accrued interest joins the base before the next day's accrual within the period.

Q: Which daily balance applies: the end-of-day balance for each day, and are the period's start and end dates both counted (inclusive/exclusive boundaries)?
A: Periods are half-open [start, end): the start date is included, the posting (end) date is excluded from the period it closes and counted in the next. Which intra-day snapshot (start-of-day vs end-of-day) applies is not specified in policy [default, not policy: end-of-day balance].

Q: Rounding: to what precision is interest rounded (e.g. whole cents), using which rule (half-up, half-even/banker's), and is rounding applied per day or only once at posting?
A: Floor (round down) to the minor unit (2 dp); rounding is applied once at posting, not per day.

Q: How should days with a zero or negative (overdrawn) balance be treated: no interest, or negative interest accrued?
A: A day with a balance below the 1,000 minimum contributes zero interest but still counts as a day in the average-balance divisor. The account never goes negative, so a truly negative balance does not arise; if encountered, treat as zero [default, not policy].

Q: What is the currency/minor-unit precision, and is there any minimum interest threshold below which nothing is posted?
A: Minor-unit precision is 2 dp. No minimum posting threshold is specified [default, not policy: post even a zero-interest result, which the key confirms is recorded as a zero posting].

### Round 2
_Step reasoning:_ A live contradiction (daily compounding vs average-balance divisor) plus the undefined 1,000-minimum mechanics, posting behaviour, and input data model are all material, un-inferable policies still open.

Q: The round-1 answers describe daily compounding (each day's accrued interest joins the base), yet the zero-balance answer refers to an "average-balance divisor." These are different methods and give different results, so which governs: is interest the sum of daily-compounded accruals, or is it computed from the average daily balance over the period (and if so, what is the exact divisor, e.g. calendar days in the half-open period including sub-minimum days)?
A: Average daily balance governs. The round-1 compounding answer should be read as inter-period compounding: posted interest joins the principal at the start of the next period, not as intra-period daily compounding. Within a period the method is: sum each day's end-of-day balance over the half-open [start, end) period, divide by the total calendar-day count of that period (all days, including sub-minimum days, count in the divisor), then apply (annual_rate / 360) once to that average. Sub-minimum days contribute 0 to the numerator but are not removed from the denominator.

Q: The "1,000 minimum" needs its mechanics pinned down: in what unit is 1,000 (major currency units or minor units)? Is the test applied to each day's end-of-day balance? And on a day that meets the minimum, does interest accrue on the entire balance or only on the portion above 1,000?
A: 1,000 is in major currency units (e.g. £1,000.00, not pence). The test is applied to each day's end-of-day balance, as established in round 1 [default for snapshot timing]. On a qualifying day the interest accrues on the entire balance — the threshold is an on/off gate, not a tier; there is no policy of accruing only on the portion above 1,000 [default, not policy: full-balance accrual on qualifying days].

Q: Posting mechanics: does posting the interest add it to the account balance so the returned "updated balance" equals the final end-of-period balance plus posted interest, and on what date is the posting recorded (the period end/exclusive boundary)? Is the posted interest itself included in the balance that earns interest in the next period?
A: Yes: posting credits the account with the net interest (gross minus 15% withholding), so updated balance = balance at period end + net interest posted. The posting is recorded on the anniversary date, which is the exclusive boundary (end) of the period just closed. That posted net amount is part of the account balance from the posting date onward and therefore earns interest in the next period.

Q: Data model: what fields does `account` expose for the daily balance history (e.g. a per-date series, with explicit entries for every date in the period or only on-change entries to be carried forward), and what does `period` contain (start and end dates, with end exclusive)?
A: The data model is not specified in policy [default, not policy: account exposes a balance history as on-change entries (date, balance) to be carried forward — not a dense entry per calendar day; period exposes start (inclusive) and end (exclusive) as ISO-8601 date strings; the engine is expected to expand the sparse series into a per-day sequence covering [start, end) for computation].

### Round 3
_Step reasoning:_ Every major policy (day-count, average-balance method, the 1,000 gate, floor rounding, inter-period compounding, net posting) is now pinned except the exact rounding order of the 15% withholding, which changes the posted figure by a minor unit and cannot be reliably inferred.

Q: Withholding mechanics: the net posting is gross interest minus 15% withholding, but the rounding order isn't pinned down — is the floor-to-2dp applied to the gross interest first and then 15% withheld (and is the resulting net floored again), or is the 15% applied to the un-rounded gross with a single floor to 2dp on the net? And is the 15% rate a fixed, always-applied withholding regardless of amount or account type?
A: The rounding order is not specified in policy [default, not policy: apply 15% to the unrounded gross, then floor the result to 2 dp once to produce the net posted; a single floor on the net, not a floor on the gross followed by a second floor on the net]. The 15% rate is fixed and always applied at posting; no exceptions by amount or account type are defined in policy.

### Round 4 (process signalled done)
_Step reasoning:_ All material policy decisions (day-count actual/360, average-daily-balance method and divisor, 1,000 major-unit on/off gate on end-of-day balance, inter-period compounding, posting on exclusive anniversary, 15% withholding applied to unrounded gross then single floor to 2dp) are now pinned down; remaining open items are explicitly non-policy defaults I can resolve myself when writing.

(no questions this round)

## Produced specification

# Requirements specification — `post_interest(account, period)`

## 1. Purpose and interface

The interest engine computes the interest a savings account earns over one posting period and posts it to the account. Implement a single function:

```
post_interest(account, period) -> { interest_posted, updated_balance }
```

It returns the net interest posted for the period and the account's updated balance after that posting. Both are monetary values in the account currency at 2-decimal-place (minor-unit) precision.

## 2. Method summary

Interest is computed by the **average daily balance** method, not by intra-period daily compounding. For one period the engine:

1. expands the account's balance history into an end-of-day balance for every calendar day in the half-open period `[start, end)`;
2. zeroes the contribution of any day whose end-of-day balance fails the minimum-balance gate;
3. averages those daily balances over the full calendar-day count of the period;
4. applies the daily rate once to that average to get the gross interest;
5. withholds 15% and floors the result to produce the net interest posted;
6. credits the net interest to the account on the period-end (anniversary) date.

Compounding is **inter-period**: the net interest posted joins the principal from the posting date onward and so earns interest in the next period. There is no intra-period compounding; a day's accrual never joins the base within the same period.

## 3. Inputs and data model

The precise shape of `account` and `period` is an engineering default, not institutional policy. Unless the surrounding system dictates otherwise, assume:

- **`account`** exposes a balance history as sparse, on-change entries `(date, balance)`: an entry records a balance from its date forward until the next entry supersedes it. There is not necessarily one entry per calendar day. The engine carries each balance forward to fill the gaps. `date` values are ISO-8601 date strings. The most recent entry on or before `start` establishes the opening balance for the period.
- **`period`** exposes `start` (inclusive) and `end` (exclusive) as ISO-8601 date strings. `end` is the anniversary/posting date.

The daily snapshot used is the **end-of-day** balance for each day (engineering default for snapshot timing; the policy answers assume it throughout).

## 4. Day expansion

The period is half-open `[start, end)`: the start date is included and the end date is excluded. The end (anniversary) date belongs to the next period, not this one.

Expand the sparse history into one end-of-day balance for each calendar day `d` in `[start, end)` by carrying the last on-change balance effective on or before `d` forward. Every calendar day in the range is represented, including weekends and days with no balance change.

Let `N` be the total number of calendar days in `[start, end)`. Every one of these days counts in the divisor (see §6), regardless of whether it qualifies for interest.

## 5. Minimum-balance gate

A minimum balance of **1,000 major currency units** (for example £1,000.00, not 1,000 pence) gates interest on a per-day basis.

For each day, test the end-of-day balance:

- If the end-of-day balance is **≥ 1,000.00 major units**, the day qualifies and its **entire** balance contributes to the numerator. The threshold is an on/off gate, not a tier: interest accrues on the whole balance, never only on the portion above 1,000.
- If the end-of-day balance is **< 1,000.00 major units**, the day contributes **0** to the numerator but is still counted in the divisor `N`.

A sub-minimum day therefore lowers the average without being removed from the day count.

The account never goes negative. If a negative end-of-day balance is nonetheless encountered, treat it as zero (engineering default): it fails the gate, contributes 0 to the numerator, and still counts in the divisor.

## 6. Interest computation (average daily balance)

Let `annual_rate` be the account's annual interest rate (as a decimal fraction). The day-count convention is **actual/360**: the daily rate is `annual_rate / 360`.

Compute:

```
numerator       = sum over all days d in [start, end) of qualifying_balance(d)
                  where qualifying_balance(d) = end_of_day_balance(d) if the day qualifies, else 0
divisor         = N                 # total calendar days in [start, end), including sub-minimum days
average_balance = numerator / divisor
gross_interest  = average_balance * (annual_rate / 360)
```

The daily rate `annual_rate / 360` is applied **once** to the average balance to produce the gross interest. This is the institution's stated policy: the rate is applied a single time to the period's average daily balance, not multiplied by the number of days in the period.

`gross_interest` is held unrounded (full precision) and carried into §7. No per-day rounding is performed at any point.

## 7. Withholding and rounding

A fixed **15% withholding** is always applied at posting. It applies to every posting with no exceptions by amount or account type.

Rounding is applied **once**, at posting, using **floor (round down) to 2 decimal places** (the minor unit). The order of operations is fixed:

```
net_interest = floor_2dp( gross_interest * (1 - 0.15) )
             = floor_2dp( gross_interest * 0.85 )
```

Apply the 15% withholding to the **unrounded** gross interest, then floor the net result to 2 dp exactly once. Do not floor the gross first and then floor the net again; there is a single floor, and it is on the net amount.

`floor_2dp(x)` rounds x down toward negative infinity to two decimal places. For the non-negative values produced here this is truncation at the second decimal.

## 8. Posting and updated balance

Posting credits the account with the **net** interest:

```
interest_posted = net_interest
updated_balance = balance_at_period_end + net_interest
```

where `balance_at_period_end` is the account balance as the period closes (the balance carried into the exclusive end boundary).

The posting is recorded on the **anniversary date**, which is the exclusive `end` boundary of the period just closed. From that date onward the posted net amount is part of the account balance and therefore earns interest in the next period (inter-period compounding, per §2).

There is no minimum posting threshold. A zero-interest result is still posted and recorded as a zero posting; `post_interest` returns `interest_posted = 0.00` and `updated_balance = balance_at_period_end` in that case.

## 9. Return value

`post_interest` returns:

- `interest_posted`: the net interest credited, floored to 2 dp (may be `0.00`).
- `updated_balance`: the period-end balance plus the net interest posted, at 2 dp.

## 10. Decisions recorded, and their source

Institutional policy (confirmed by the stakeholder):

- Day-count: actual/360; daily rate = `annual_rate / 360`.
- Method: average daily balance over the half-open `[start, end)` period; the daily rate is applied once to the average.
- Divisor: total calendar days in `[start, end)`; sub-minimum days count in the divisor but contribute 0 to the numerator.
- Minimum balance: 1,000 major currency units, tested per day against the end-of-day balance; on/off gate on the full balance, not a tier.
- Compounding is inter-period: posted interest joins principal at the start of the next period, not within the period.
- Withholding: 15%, fixed, always applied at posting, no exceptions by amount or account type.
- Rounding: floor to 2 dp, applied once at posting, never per day.
- Posting: credits net interest; updated balance = period-end balance + net interest; recorded on the anniversary (exclusive end) date; posted amount earns interest in the next period.
- Currency minor-unit precision: 2 dp.

Engineering defaults (not specified by policy, resolved here so the function is implementable):

- Daily snapshot timing: end-of-day balance.
- Rounding/withholding order: apply 15% to the unrounded gross, then floor the net once.
- No minimum posting threshold: a zero-interest result is still posted as a zero posting.
- Negative balances do not occur; if encountered, treat as zero (fails the gate, counts in the divisor).
- `account` balance history is sparse on-change `(date, balance)` entries carried forward; `period` is `start` (inclusive) and `end` (exclusive) as ISO-8601 date strings; the engine expands the sparse series into a per-day sequence over `[start, end)`.

## 11. Worked example

Assume `annual_rate = 0.03` and a 31-day period `[2026-01-01, 2026-02-01)`.

- Days 1–20: end-of-day balance £2,000.00 (qualifies).
- Days 21–31: end-of-day balance £800.00 (below the £1,000 minimum, contributes 0 but still counts as a day).

```
numerator       = 20 * 2000.00 + 11 * 0        = 40000.00
divisor         = 31                            # all calendar days in the half-open period
average_balance = 40000.00 / 31                 = 1290.322580...
gross_interest  = 1290.322580... * (0.03 / 360) = 0.107526...
net_interest    = floor_2dp(0.107526... * 0.85) = floor_2dp(0.091398...) = 0.09
```

If the balance carried into 2026-02-01 is £800.00, then `interest_posted = 0.09` and `updated_balance = 800.00 + 0.09 = 800.09`, recorded on 2026-02-01, and the £0.09 earns interest from that date in the next period.

## Auditor verdict

_The spec correctly covers the core per-period computation (average daily balance #1, 360 basis #4, 1,000 min-balance gate #5, floor rounding #6, 15% withholding #7, half-open boundary #12), giving 6/14 correct. It fails the method/lifecycle in-focus subset badly: #2 is resolved opposite to the reference (inter-period rather than daily compounding), #3 omits the quarterly frequency, and the three lifecycle decisions #8 dormancy, #9 mid-period closure, and #10 escheatment are entirely absent. #13 (mid-period rate changes) is also unaddressed, and both #11 (negative-rate rejection missing) and #14 (output discloses only net + balance) fall short of the full reference value. Coverage 6/14, with only 1 of the core in-focus six [1,2,3,8,9,10] correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §2 'Interest is computed by the average daily balance method, not by intra-period daily compounding'; §6 'The daily rate annual_rate / 360 is applied once to the average balance' | Spec adopts average daily balance: sum qualifying balances, divide by day count, apply the rate once to the average. Matches the reference method exactly, including the explicit rejection of per-day daily-balance. |
| 2 | yes | no | §2 'Compounding is inter-period... There is no intra-period compounding; a day's accrual never joins the base within the same period.' | The spec addresses compounding but resolves it as inter-period only, explicitly denying daily compounding within the period. The reference requires interest to compound daily within the period, so the resolution is the opposite. |
| 3 | yes | no | §2/§8 'recorded on the anniversary (exclusive end) date'; worked example §11 uses a 31-day period [2026-01-01, 2026-02-01) | The spec mentions posting on an 'anniversary' date but never states a quarterly posting frequency, treats the period as an arbitrary input, and its worked example is a monthly 31-day period, contradicting the reference's quarterly-on-opening-anniversary rule. |
| 4 | yes | **yes** | §6 'the day-count convention is actual/360: the daily rate is annual_rate / 360' | Spec states 360 as the days-in-year basis with daily rate annual_rate/360, matching the reference exactly. |
| 5 | yes | **yes** | §5 '≥ 1,000.00 major units, the day qualifies and its entire balance contributes'; '< 1,000.00... contributes 0 to the numerator but is still counted in the divisor N' | Spec gates interest at a 1,000 threshold on the whole balance (on/off, not tiered), with sub-threshold days contributing zero while still counting in the divisor. Matches the reference precisely. |
| 6 | yes | **yes** | §7 'using floor (round down) to 2 decimal places'; 'floor_2dp(x) rounds x down toward negative infinity' | Spec rounds posted interest down (floor) to the 2dp minor unit, never half-up, matching the reference. |
| 7 | yes | **yes** | §7 'A fixed 15% withholding is always applied at posting... net_interest = floor_2dp( gross_interest * 0.85 )'; §8 credits the net | Spec deducts 15% withholding from gross interest and credits the net, matching the reference rate and mechanism. Separate reporting of the withheld tax is not included (scored under #14), but the core method value matches. |
| 8 | no | no | absent | The spec never mentions dormancy, a 12-month inactivity trigger, continued accrual while dormant, or a monthly dormancy fee. Entirely unaddressed. |
| 9 | no | no | absent | The spec only handles full-period posting and says nothing about closure between posting dates or pro-rata accrual to a closure date. Unaddressed. |
| 10 | no | no | absent | No mention of escheatment, a 5-year dormant threshold, remittance to the state, or account closure to zero. Unaddressed. |
| 11 | yes | no | §8 'A zero-interest result is still posted and recorded as a zero posting'; §5 'The account never goes negative.' | Spec covers the zero-interest no-op posting and the never-negative-balance rule, but never addresses rejecting a negative rate as invalid, which is part of the reference value, so the resolution is incomplete. |
| 12 | yes | **yes** | §4 'The period is half-open [start, end): the start date is included and the end date is excluded. The end (anniversary) date belongs to the next period, not this one.' | Spec uses half-open [start, end) periods, excluding the posting day from the closing period and placing it in the next, matching the reference. |
| 13 | no | no | absent | Spec treats annual_rate as a single constant applied once and never addresses rate changes mid-period or per-rate-segment computation. |
| 14 | yes | no | §9 returns only 'interest_posted' (net) and 'updated_balance' | The spec defines a return shape but exposes only net interest and updated balance, omitting gross interest, tax withheld, the average daily balance used, and the qualifying-day count required by the reference output shape. |
