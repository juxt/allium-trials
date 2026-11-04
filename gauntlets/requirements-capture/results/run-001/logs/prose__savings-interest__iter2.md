# prose — savings-interest — iteration 2

Model (author): claude-opus · Questions asked: 11 · Captured: 7/14 · Bespoke captured: 5/10

## Conversation

### Round 1
_Step reasoning:_ The brief omits several material policy decisions (day count, compounding, balance basis, boundaries, rounding, negatives) that cannot be reliably inferred, so I must ask before specifying.

Q: Day-count convention: how is the daily rate derived from the annual rate — actual/365, actual/360, 30/360, or actual/actual (leap-year aware)?
A: Actual/360 — the daily rate is annual_rate / 360, regardless of whether the year is a leap year.

Q: Accrual basis: is interest simple (each day's balance × daily rate, summed) or does it compound daily within the period?
A: Compounds daily within the period: each day's accrued interest is added to the running balance before the next day's accrual is calculated.

Q: Which balance applies to each day — the start-of-day (opening) balance or the end-of-day (closing) balance after that day's transactions?
A: [default, not policy] End-of-day (closing) balance after that day's transactions.

Q: Period boundaries: are the period's start and end dates both inclusive, and does the posting day itself accrue interest?
A: Half-open [start, end): the start date is inclusive; the posting date is excluded from the period it closes and is instead the first day of the next period. The posting day itself does not accrue interest for the period being closed.

Q: Rounding: to what precision (e.g. whole cents) and using which rule (half-up, half-even/banker's), and is rounding applied per day or once on the summed total at posting?
A: Floor (round down) to 2 decimal places (minor unit), applied once to the aggregate total at posting — never half-up; the bank retains the residual fraction. No per-day rounding.

Q: Negative balances: if an account is overdrawn on some days, do those days accrue negative interest, accrue at a different rate, or contribute zero?
A: The account never goes negative per policy, so true overdraft days do not arise. Days where the balance falls below the 1,000 minimum threshold contribute zero interest for that day but still count in the divisor for the average daily balance calculation.

Q: Posting effect: should the posted interest itself be added to the account balance (and if so, does it begin earning interest immediately or only in the next period)?
A: The net interest (gross interest minus 15% withholding tax) is credited to the account balance. Because the posting day is the first day of the next half-open period, the credited amount is included in that period's accruing balance from the outset and begins earning interest immediately.

### Round 2
_Step reasoning:_ Later answers introduced an average-daily-balance method, a 1,000 threshold, and a 15% withholding tax that conflict with or underspecify the earlier daily-compounding and rounding rules; these must be reconciled before the spec is correct.

Q: The day-count/accrual answers describe daily compounding (each day's interest added to the running balance before the next day accrues), but the negative-balance answer refers to an "average daily balance calculation" and a "divisor" for below-threshold days. These are two different methods. Which governs: true daily compounding on the running balance, or interest computed on the average daily balance over the period (sum of daily balances / day count)?
A: Average daily balance governs. The method is: sum each day's end-of-day balance over the half-open period [start, end), divide by the number of calendar days in that period to obtain the average daily balance, then apply the rate once — ADB × (annual_rate / 360) × days / 360 is not right; the single application is ADB × (annual_rate / 360 × days). 'Not per-day daily-balance' is the explicit policy. The earlier 'compounds daily' answer was an error in the prior round; what point 2 actually means is that interest posted at the close of one period is credited to the balance and therefore enters the ADB calculation for the next period — compounding occurs between periods via the posted credit, not by re-applying the rate to a running total within the period.

Q: The minimum-balance threshold: is it exactly 1,000 in the account's major currency unit, evaluated against each day's end-of-day balance, and is it a fixed constant or configurable per account/product?
A: The threshold is exactly 1,000 in the account's major currency unit, evaluated against each day's end-of-day (closing) balance. Days where the closing balance is at or above 1,000 qualify; days below contribute zero to the interest numerator but still count in the divisor. Whether the threshold is configurable per account or product is not specified in policy; treat it as a fixed constant [default, not policy].

Q: Withholding tax order of operations: is the 15% applied to the gross interest and then the net floored to 2 dp, or is gross floored first then tax applied? And is the withheld tax amount itself rounded (and by which rule), or only the net credited amount?
A: Gross interest is computed at full precision. The 15% withholding tax is then deducted from that full-precision gross to produce a full-precision net. The floor-to-2-dp rounding is applied once to the net credited amount — that floored figure is what is posted to the account. The rounding treatment of the withheld tax amount reported separately is not specified in policy [default, not policy]: apply the same floor convention for consistency.

Q: Is the annual interest rate a single flat rate supplied as input to post_interest, or is it tiered by balance band (e.g. a different rate above/below the 1,000 threshold)?
A: Single flat rate — no balance tiers. The 1,000 minimum-balance threshold determines whether a day qualifies for interest at all; once it qualifies, the same rate applies regardless of how large the balance is. The rate can change over time (each day uses the rate in force on that day), but that is temporal, not tiered. Whether the rate is passed as a direct argument or looked up from stored configuration is not specified in policy [default, not policy].

### Round 3 (process signalled done)
_Step reasoning:_ All material hidden policies are resolved — day-count (actual/360), ADB method (reconciled from the earlier compounding contradiction), end-of-day balances, half-open period, floor-to-2dp on the net, 1,000 threshold (zero to numerator, still in divisor), 15% withholding order of operations, and flat non-tiered rate; remaining items are marked default-not-policy, so I'm ready to write the spec.

(no questions this round)

## Produced specification

# Requirements specification: savings-account interest engine

## 1. Purpose and interface

Implement `post_interest(account, period)`. The function computes the interest an account earns over a period, applies withholding tax, posts the net interest to the account balance, and returns both the interest posted and the account's updated balance.

Return value: the function returns (a) the net interest posted (the floored, credited figure) and (b) the account's updated balance after the credit. The gross interest and the withheld tax amount should also be made available on the returned result so the posting can be reported.

## 2. Domain method (authoritative)

Interest is computed on the **average daily balance (ADB)** over the period. This is the governing method. Any earlier notion of true daily compounding on a running balance within the period is explicitly **not** the policy and must not be implemented. Compounding occurs *between* periods only: the net interest posted at the close of one period is credited to the balance and therefore enters the ADB of the next period.

## 3. Period boundaries

The period is **half-open, `[start, end)`**:

- The start date is inclusive.
- The end date (the posting date) is **excluded** from the period being closed. It does not accrue interest for that period.
- The posting date is instead the first day of the *next* half-open period.

Let `N` = the number of calendar days in `[start, end)`. Every calendar day in this range is counted, leap years included (see day-count convention).

## 4. Daily balance basis

For each calendar day `d` in the period, the balance used is the **end-of-day (closing) balance**, i.e. the balance after that day's transactions have been applied. [default, not policy: end-of-day was selected as the day-balance basis.]

## 5. Minimum-balance threshold

- The threshold is exactly **1,000** in the account's major currency unit.
- It is evaluated against each day's **end-of-day (closing) balance**.
- A day **qualifies** for interest when its closing balance is **at or above 1,000**.
- A day **below 1,000** contributes **zero** to the interest numerator but **still counts in the divisor** `N` for the average-daily-balance calculation.
- The threshold is treated as a **fixed constant**. [default, not policy: configurability per account/product was not specified; treat as a fixed constant.]

The account never goes negative per policy, so true overdraft days do not arise and no negative-interest handling is required. Below-threshold days are the only zero-contribution case.

## 6. Day-count convention

**Actual/360.** The daily rate is `annual_rate / 360`, regardless of whether the year is a leap year. Actual calendar days are counted in the period (`N`); the annualisation divisor is always 360.

## 7. Interest rate

- A **single flat rate** applies. There are **no balance tiers**: once a day qualifies (closing balance >= 1,000), the same rate applies regardless of how large the balance is.
- The rate may **change over time**. Each day uses the rate in force on that day. This is a temporal variation, not a tier.
- [default, not policy: whether the rate is passed as a direct argument to `post_interest` or looked up from stored configuration was not specified. Either is acceptable; the computation below is unaffected.]

## 8. Gross interest calculation

Define, over the period `[start, end)`:

- `N` = number of calendar days in the period (the divisor).
- For each day `d`, `B_d` = end-of-day closing balance.
- A day qualifies iff `B_d >= 1000`; non-qualifying days contribute `0`.

Average daily balance:

```
ADB = (sum of B_d over qualifying days only) / N
```

Gross interest, single application (no per-day rate re-application to a running total):

```
gross_interest = ADB * (annual_rate / 360 * N)
```

Equivalently, `gross_interest = (sum of qualifying-day balances) * annual_rate / 360`, since the `N` in the ADB divisor and the `N` day-count factor cancel. The forms `ADB * (annual_rate / 360) * N / 360` and any per-day compounding of a running balance are **incorrect** and must not be used.

Temporal rate handling: when the rate changes within the period, apply each qualifying day's closing balance against the daily rate (`rate_in_force_that_day / 360`) in force on that day and sum those contributions; with a constant rate this reduces exactly to the single-application formula above. This follows from the rule that each day uses the rate in force on that day.

All of the above is computed at **full precision** with no intermediate rounding.

## 9. Withholding tax

- A **15% withholding tax** applies.
- `gross_interest` is computed at full precision (section 8).
- The 15% is deducted from the **full-precision gross** to produce a **full-precision net**:

```
net_interest_full = gross_interest * (1 - 0.15)
```

- The withheld tax amount is `gross_interest * 0.15` at full precision.

## 10. Rounding

- Rounding rule: **floor (round down)** to **2 decimal places** (the currency minor unit). Never half-up, never half-even.
- Rounding is applied **once**, to the **aggregate net credited amount**, at posting time. There is **no per-day rounding** and no rounding of intermediate values.

```
net_interest_posted = floor(net_interest_full, 2dp)
```

- The bank retains the residual fraction discarded by the floor.
- The separately reported withheld-tax amount: [default, not policy: its rounding treatment was not specified.] For consistency, apply the **same floor-to-2dp** convention to the reported tax figure. This reported figure is for reporting only; it is not what drives the credit.

`net_interest_posted` is the figure actually credited to the account.

## 11. Posting effect and inter-period compounding

- `net_interest_posted` (the floored net, section 10) is **credited to the account balance**.
- Because the posting date is the **first day of the next half-open period**, the credited amount is part of that next period's balance **from its outset** and therefore enters the next period's ADB and begins earning interest immediately.
- This is the sole compounding mechanism: compounding happens **between periods** through the posted credit, never by re-applying the rate to a running balance within a period.

```
updated_balance = balance_before_posting + net_interest_posted
```

## 12. Worked order of operations (summary)

1. Enumerate calendar days in `[start, end)`; `N` = count.
2. For each day, take the end-of-day closing balance `B_d`.
3. Sum `B_d` over days where `B_d >= 1000` (below-threshold days add 0 to this sum).
4. `ADB = (that sum) / N`.
5. `gross_interest = ADB * (annual_rate / 360 * N)` at full precision (per-day rates summed if the rate varies within the period).
6. `net_interest_full = gross_interest * 0.85` at full precision.
7. `net_interest_posted = floor(net_interest_full, 2dp)`.
8. Credit `net_interest_posted` to the balance; the posting date becomes day 1 of the next period.
9. Return `net_interest_posted` and `updated_balance` (with gross and floored withheld-tax available for reporting).

## 13. Non-goals / explicitly excluded

- No true intra-period daily compounding.
- No half-up or banker's rounding; no per-day rounding.
- No balance-tiered rates.
- No negative-balance / overdraft interest handling (cannot occur per policy).
- No accrual on the posting date for the period being closed.

## Auditor verdict

_The spec strongly covers the core computation method and conventions (decisions 1, 4, 5, 6, 7, 12, 13 correct) but misses key lifecycle decisions entirely: dormancy (8), closure mid-period (9), and escheatment (10) are all absent. Posting cadence (3, quarterly on anniversary) is also absent. Decision 2 is surfaced but wrong: the spec explicitly forbids the daily intra-period compounding the reference requires. Decisions 11 and 14 are partially addressed but incomplete against the strict reference. Coverage: 8/14 correct (1, 4, 5, 6, 7, 12, 13, and none of the lifecycle group)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Section 2: "Interest is computed on the average daily balance (ADB) over the period. This is the governing method. Any earlier notion of true daily compounding on a running balance within the period is explicitly not the policy" | The spec states average daily balance as the method and explicitly rejects per-day daily-balance compounding, matching the reference exactly. |
| 2 | yes | no | Section 2: "Compounding occurs between periods only... never by re-applying the rate to a running balance within a period." Section 8: "any per-day compounding of a running balance are incorrect and must not be used." | The reference requires interest to compound DAILY within the period. The spec explicitly forbids intra-period daily compounding and allows compounding only between periods, directly contradicting the reference answer. |
| 3 | no | no | absent | The spec never states the posting period frequency (quarterly) nor that posting occurs on the anniversary of account opening. It only refers abstractly to a 'period' and 'posting date' without defining cadence. |
| 4 | yes | **yes** | Section 6: "Actual/360. The daily rate is annual_rate / 360... the annualisation divisor is always 360." | The spec specifies 360 days-in-year basis with daily rate = annual_rate/360, matching the reference exactly. |
| 5 | yes | **yes** | Section 5: "A day qualifies for interest when its closing balance is at or above 1,000. A day below 1,000 contributes zero to the interest numerator but still counts in the divisor N" | The spec matches the reference: threshold of 1,000, at-or-above qualifies, below contributes zero but still counts in the divisor. |
| 6 | yes | **yes** | Section 10: "Rounding rule: floor (round down) to 2 decimal places... Never half-up... The bank retains the residual fraction discarded by the floor." | The spec matches the reference: floor to 2dp, never half-up, bank keeps the fraction. |
| 7 | yes | **yes** | Section 9: "A 15% withholding tax applies... net_interest_full = gross_interest * (1 - 0.15)" and the withheld tax is reported separately; Section 1 credits the net. | The spec deducts 15% withholding tax from gross, credits the net, and reports the tax separately, matching the reference. |
| 8 | no | no | absent | The spec does not address dormancy at all: no 12-month trigger, no continued accrual while dormant, and no monthly dormancy fee of 5. |
| 9 | no | no | absent | The spec does not address closure mid-period, pro-rata accrual to the closure date, or posting net interest as part of closing. |
| 10 | no | no | absent | The spec does not mention escheatment, the 5-year dormancy trigger, remitting funds to the state, or closing to a zero balance. |
| 11 | yes | no | Section 5: "The account never goes negative per policy, so true overdraft days do not arise and no negative-interest handling is required." Section 13: "No negative-balance / overdraft interest handling (cannot occur per policy)." | The spec covers no-overdraft/no-negative-balance, but does not address a negative rate being rejected as invalid, nor the zero-balance zero-posting no-op that still records a zero posting. Reference requires all three; the rate-rejection and zero-noop recording are not stated, so not fully correct. |
| 12 | yes | **yes** | Section 3: "The period is half-open, [start, end)... The end date (the posting date) is excluded from the period being closed... The posting date is instead the first day of the next half-open period." | The spec matches the reference: half-open [start, end) periods, posting day excluded from the closing period and included in the next. |
| 13 | yes | **yes** | Section 7/8: "The rate may change over time. Each day uses the rate in force on that day." Section 8: "apply each qualifying day's closing balance against the daily rate (rate_in_force_that_day / 360) in force on that day and sum those contributions" | The spec matches the reference: each day uses the rate in force on that day, computed per rate-segment and summed. |
| 14 | yes | no | Section 1/9/12: returns net_interest_posted and updated_balance, with gross interest and floored withheld tax 'available for reporting'. No mention of average daily balance used or number of qualifying days in the output. | The spec surfaces gross, tax withheld, net, and updated balance, but omits two required output fields: the average daily balance used and the number of qualifying days. Reference requires all six, so the output shape does not fully match. |
