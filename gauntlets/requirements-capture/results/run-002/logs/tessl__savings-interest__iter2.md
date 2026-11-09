# tessl — savings-interest — iteration 2

Model (author): claude-opus · Questions asked: 13 · Captured: 7/14 · Bespoke captured: 6/10

## Conversation

### Round 1
_Step reasoning:_ Compounding vs simple interest is the highest-impact core-behaviour decision and determines the fundamental calculation formula, so I ask it first, one question at a time.

Q: When interest accrues over the period, does it compound daily (each day's interest added to the balance so later days earn interest on it) or is it simple interest (each day's interest computed on that day's recorded balance and summed, with no compounding until it's posted)?
A: Interest compounds daily: each day's interest is added to the running balance so that subsequent days within the period earn interest on it.

### Round 2
_Step reasoning:_ Compounding is settled; the next highest-impact policy is the day-count divisor, which materially changes the daily rate and total interest.

Q: To convert the annual rate into a daily rate, what day-count convention should I use: divide the annual rate by 365 every day, by 366 in leap years (actual/actual), or by a fixed 360 (actual/360)?
A: Divide by a fixed 360 (actual/360): daily_rate = annual_rate / 360.

### Round 3
_Step reasoning:_ Rounding timing and rule is a material, institution-specific policy that changes the computed figure and cannot be reliably inferred; asking it next before edge cases like inclusive dates and negative balances.

Q: When is the interest amount rounded: do you round each day's accrued interest to the nearest cent before adding it to the running balance (so rounding compounds daily), or keep full precision throughout the period and round only the final total once at posting time? And in either case, which rounding rule applies (round half up, round half to even/banker's rounding, or truncate)?
A: Keep full precision throughout the compounding period and round only once at posting time. The rounding rule is truncation (floor to 2 decimal places) — never half-up. The bank retains any sub-cent fraction.

### Round 4
_Step reasoning:_ Compounding, day-count and rounding are settled; the period's day-count boundaries and which daily balance accrues are still undefined and cannot be safely inferred, so I ask that next before moving to negative-balance and gap handling.

Q: How is the set of accruing days defined for a period running from a start date to an end date: do both the start and end dates accrue interest (inclusive on both ends), is it inclusive of the start but exclusive of the end (or vice versa), and for each such day which balance is used, the end-of-day closing balance recorded for that date?
A: Periods are half-open [start, end): the start date accrues interest and the end date does not — it is excluded from the closing period and included in the next one. For each accruing day, the balance used is the end-of-day closing balance recorded for that date [default, not policy].

### Round 5
_Step reasoning:_ Core accrual mechanics are settled; the remaining material policy gap a model cannot infer is how overdrawn or zero-balance days are treated, so I ask that before closing.

Q: If a day's recorded closing balance is zero or negative (the account is overdrawn), how should that day be treated: does it accrue no interest (accrual floored at zero on non-positive balances), or does a negative balance accrue negative interest that reduces the running balance, and if interest only accrues on positive balances is there a minimum balance threshold below which no interest accrues?
A: No interest accrues on any day the balance is below 1,000 — that threshold applies regardless of whether the balance is zero, negative, or simply sub-threshold. Those days contribute zero to the accrual but still count in the divisor when computing the average daily balance. The account never goes negative (a negative balance is not a valid state), so negative accrual does not arise in practice.

### Round 6
_Step reasoning:_ Round 5 introduced 'average daily balance' with a divisor, which conflicts with the daily-compounding method fixed in Round 1; this method contradiction is material and cannot be inferred, so it must be resolved before any summary.

Q: In your last answer you referred to sub-threshold days still counting 'in the divisor when computing the average daily balance', but earlier we established the interest is daily-compounded on each day's closing balance. These are two different methods. Which governs: (a) daily compounding where each qualifying day's interest is balance x (annual_rate/360) added to the running balance, and the average-daily-balance remark was incidental, or (b) the interest is actually computed from an average daily balance (sum of each day's closing balance divided by the day count in the period), and if so is that average then multiplied by the daily rate over the number of days, and do sub-threshold days contribute 0 to the numerator but still increment the divisor?
A: (b) governs. The correct method is average daily balance: sum each day's end-of-day closing balance over the period, divide by the number of days in the period to get the ADB, then apply the rate once — net_interest = ADB × (annual_rate / 360) × days_in_period. My Round 1 answer describing per-day compounding onto a running balance was incorrect; I should have drawn on the calculation-method rule rather than the compounding-period entry. Sub-threshold days (balance below 1,000) contribute zero to the numerator (their closing balance is treated as 0 for the sum) but still increment the divisor — consistent with what I stated in Round 5.

### Round 7
_Step reasoning:_ The stated ADB formula has the divisor and multiplier cancelling, which would nullify the sub-threshold divisor rule, so the exact day counts and gap handling must be clarified before the method is well-defined.

Q: In your formula net_interest = ADB × (annual_rate / 360) × days_in_period, the ADB is itself defined as (sum of daily closing balances) ÷ (number of days in the period). If the divisor used for the average and the days_in_period multiplier are the same count, they cancel and the result is simply (sum of qualifying balances) × (annual_rate / 360) — which would make the 'sub-threshold days still increment the divisor' rule have no effect on the answer. So I need to pin down the two counts precisely: (a) for the ADB divisor, exactly which days are counted — every calendar day in the half-open [start, end) interval, or only days that have a recorded closing balance, or only qualifying (≥1,000) days? and (b) is the days_in_period multiplier the same count as that divisor, or a different one (e.g. the full calendar length of [start, end) even if the divisor is something narrower)? And relatedly, if a calendar day within [start, end) has no recorded closing balance in the history at all (a gap), is it treated as balance 0, carried forward from the previous recorded day, or excluded from both numerator and divisor?
A: (a) The ADB divisor is every calendar day in the half-open [start, end) interval — all calendar days, regardless of whether the day is sub-threshold or has a recorded balance. Sub-threshold days contribute zero to the numerator but still increment this divisor. (b) The days_in_period multiplier in the formula is the same count — the full calendar length of [start, end). Your cancellation observation is therefore correct: net_interest = sum_of_qualifying_balances × (annual_rate / 360), and the 'sub-threshold days still increment the divisor' rule is mechanically redundant given this structure (it matters only as a statement of method, not as an independent numerical constraint). For gap days (a calendar day within [start, end) with no recorded closing balance in history): the balance is carried forward from the most recent recorded day [default, not policy]; it is not treated as zero unless the account genuinely had a zero balance on that day.

### Round 8
_Step reasoning:_ Calculation is fully pinned, but the interface itself — how interest is posted, to which balance, dated when, and what exactly is returned — remains unspecified and cannot be reliably inferred.

Q: Now that the interest amount is settled (net_interest = sum of qualifying daily closing balances × annual_rate/360, truncated to 2 dp at posting), I need to pin down what `post_interest` actually does to the account and what it returns. Specifically: (a) to which balance is the truncated interest added to produce the 'updated balance' — the account's end-of-period closing balance (the balance on the day before `end`), the recorded balance as of the `end` date, or some stored current balance on the account object? (b) On what date is the interest posted/dated — the `end` date of the half-open period, the last accruing day, or the first day of the next period? (c) Is the posted interest itself recorded as a balance-history entry/transaction on the account, or only returned by the function without mutating the stored history? And (d) is the returned 'interest posted' the truncated net figure, and does the sub-cent remainder the bank retains need to be returned or recorded anywhere?
A: (a) The interest is added to the account's stored current balance, which at the moment of posting is the closing balance on the last accruing day (the day immediately before `end`). [default, not policy — the key does not specify the exact field; the natural read is whatever balance the account holds at the instant of posting.] (b) The interest is dated on `end` — the half-open endpoint that closes the period. That date is excluded from the period just closed and becomes the first day of the next period. (c) [default, not policy] The posting should be recorded as a balance-history entry (transaction) on the account dated `end`, so that subsequent period calculations can read it as a closing balance on that day. (d) The figure credited to the account — and returned as 'net interest posted' — is the gross interest less 15% withholding tax (per the withholding-tax rule), with the final net amount truncated to 2 dp. The sub-cent fraction the bank retains does not need to be returned or recorded anywhere; the required return fields are gross interest, tax withheld, net interest posted, the average daily balance used, the number of qualifying days, and the updated balance.

### Round 9
_Step reasoning:_ Round 8 introduced a 15% withholding tax but left its arithmetic, rounding order across the three reported figures, and exemption/variability unspecified — all material policy that cannot be inferred.

Q: You've now introduced a 15% withholding tax, with required return fields of gross interest, tax withheld, and net interest posted. I need to pin down the arithmetic and rounding order precisely: (a) is gross interest computed as sum_of_qualifying_balances x (annual_rate/360) at full precision, then tax withheld = 15% x gross, then net = gross - tax? (b) The truncation-to-2dp rule we agreed earlier (floor, never half-up) — does it apply to each of the three reported figures independently (truncate gross, truncate tax, truncate net), or is only one figure truncated and the others derived from it (e.g. truncate gross, truncate tax, and net = truncated_gross - truncated_tax)? (c) Is the 15% rate a fixed institutional constant, or a per-account/per-period input that can vary? And (d) does any below-threshold condition (e.g. a very small gross interest amount) exempt the interest from withholding, or is tax always withheld whenever gross interest is positive?
A: (a) Yes: gross = sum_of_qualifying_balances × (annual_rate / 360) held at full precision; tax_withheld = 0.15 × gross at full precision; net = gross − tax at full precision. Truncation is applied after all three are derived at full precision, not before.

### Round 10
_Step reasoning:_ Round 9 answered only sub-part (a); the truncation order across the three figures (b) is still open and directly affects the returned numbers, so I ask it alone before the remaining (c) rate-variability and (d) withholding-exemption questions.

Q: On rounding the three reported figures: you confirmed gross, tax, and net are each derived at full precision and truncation is applied only after. When the truncation-to-2dp (floor, never half-up) is then applied, is it applied to each of the three figures independently (truncate gross, truncate tax, truncate net as separately computed), or is net defined as truncated_gross minus truncated_tax so the three always reconcile exactly? I ask because truncating net independently can leave net != gross - tax by a cent.
A: Truncation is applied to each of the three figures independently: truncate gross, truncate tax, truncate net as separately computed at full precision. Net may therefore differ from truncated_gross minus truncated_tax by at most one cent; that discrepancy accrues to the bank, consistent with the bank-keeps-the-fraction principle from the rounding rule. [default, not policy — the key does not explicitly specify the reconciliation treatment; this is the natural read given the stated rounding rule.]

### Round 11
_Step reasoning:_ Arithmetic and rounding of the withholding tax are settled, but whether the 15% rate is a fixed constant or a variable input (Round 9c) and whether any below-threshold exemption applies (Round 9d) were never answered; the rate's variability is material because it affects the function's inputs.

Q: The 15% withholding tax — is that a fixed institutional constant baked into the engine, or a per-account/per-period input that can vary (e.g. passed in or read from the account, differing by customer tax status or jurisdiction)? This was part (c) of my Round 9 question but the answer only covered the arithmetic in part (a), so it's still open.
A: 15% is a fixed institutional constant — it is not a per-account or per-period input and does not vary by customer tax status or jurisdiction.

### Round 12
_Step reasoning:_ Part (d) of Round 9 (a withholding exemption threshold) was never answered and is a material policy decision I cannot infer, so I must resolve it before concluding.

Q: Returning to part (d) of my Round 9 question, which is still open: does any below-threshold condition exempt the interest from withholding tax — for example, is tax waived when gross (or net) interest falls below some minimum amount, or when the qualifying-day count or ADB is below some floor — or is the 15% always withheld whenever gross interest is positive, however small?
A: 15% withholding tax is always applied whenever gross interest is positive, however small. There is no below-threshold exemption — no minimum gross amount, qualifying-day count, or ADB floor that waives withholding.

### Round 13
_Step reasoning:_ The computation, posting mechanics, and tax are fully pinned down; the one remaining material policy with two plausible institution-specific answers is whether the 1,000 threshold is inclusive or exclusive at the exact boundary.

Q: To make the 1,000 minimum-balance threshold exact: is the comparison inclusive or exclusive at the boundary — i.e. does a day whose closing balance is exactly 1,000 qualify for interest (threshold is 'balance >= 1,000 qualifies', so only strictly-below-1,000 days are excluded), or is exactly 1,000 itself treated as sub-threshold and excluded (only 'balance > 1,000' qualifies)?
A: A day with a closing balance of exactly 1,000 qualifies: the threshold is balance >= 1,000. Only days strictly below 1,000 are excluded.

### Round 14 (process signalled done)
_Step reasoning:_ All material policy decisions the brief omitted are now pinned down — ADB calculation method, actual/360 day-count, independent truncation rounding, half-open period boundaries, the 1,000 inclusive qualifying threshold with carry-forward gap handling, and the fixed 15% always-applied withholding tax with its return fields — so no ambiguous requirements remain and I can hand off to spec authoring.

(no questions this round)

## Produced specification

# Requirements specification — savings-account interest engine

## Function under specification

`post_interest(account, period)` computes the interest a savings account earns over a period, truncates and withholds tax on it, posts it to the account, and returns a breakdown. The function both mutates the account (updated balance plus a new history entry) and returns a structured result.

## Scope

**In scope**
- Computing interest from a daily closing-balance history over a half-open period.
- Applying a minimum-balance qualifying threshold per day.
- Converting the annual rate to a daily rate on a fixed-360 basis.
- Withholding a fixed institutional tax on the interest.
- Truncating the reported money figures to 2 decimal places.
- Posting the net interest to the account balance and recording it in the balance history.
- Returning a defined set of result fields.

**Out of scope / not decided by the stakeholder** (do not implement beyond the brief)
- Per-account or per-period tax variation, tax status, jurisdiction.
- Any below-threshold waiver of tax.
- Negative-balance / overdraft accrual (a negative balance is not a valid account state).
- Multi-currency, fee handling, or statement rendering.

## Calculation method (authoritative)

The interest is computed by the **average daily balance (ADB)** method. An earlier description of per-day compounding onto a running balance was explicitly retracted by the stakeholder (Round 6) and MUST NOT be implemented.

Definitions for a period `[start, end)` (half-open: `start` accrues, `end` does not):

- **Calendar days in period** `D` = the number of calendar days in the half-open interval `[start, end)`. This single count is used both as the ADB divisor and as the `days_in_period` multiplier.
- For each calendar day `d` in `[start, end)`, take that day's **end-of-day closing balance** `b(d)`.
  - If `d` has no recorded closing balance in the history (a gap day), carry forward the most recent recorded closing balance before `d`. A gap day is NOT treated as zero unless the account genuinely held a zero balance that day. *(Default, not an explicit stakeholder policy.)*
- A day **qualifies** if its closing balance `b(d) >= 1000`. The comparison is inclusive at the boundary: exactly `1000` qualifies; only balances strictly below `1000` are excluded. The threshold applies regardless of whether a sub-threshold balance is zero, negative, or merely small.
- **Qualifying-day sum** `S` = sum of `b(d)` over days that qualify. Sub-threshold days contribute `0` to this sum but still count toward `D`.
- **ADB** = `S / D`.
- **days_in_period** = `D`.

### Gross interest

```
gross = ADB * (annual_rate / 360) * days_in_period
```

Because the ADB divisor and the `days_in_period` multiplier are the same count `D`, they cancel exactly, so equivalently:

```
gross = S * (annual_rate / 360)
```

The day-count convention is fixed **actual/360**: `daily_rate = annual_rate / 360`, every day, including in leap years. The "sub-threshold days still increment the divisor" rule is mechanically redundant given this cancellation; it is retained as a statement of method, not as an independent numerical constraint.

### Withholding tax

A fixed institutional withholding tax of **15%** applies. It is a constant baked into the engine, not a per-account or per-period input, and does not vary by customer tax status or jurisdiction.

Tax is withheld whenever `gross` is positive, however small. There is no below-threshold exemption: no minimum gross amount, qualifying-day count, or ADB floor waives it.

All three money figures are derived at **full precision first**:

```
gross = S * (annual_rate / 360)        # full precision
tax_withheld = 0.15 * gross            # full precision
net = gross - tax_withheld             # full precision
```

### Rounding

Rounding is applied **only after** the three full-precision figures are derived. The rule is **truncation (floor) to 2 decimal places** — never round half-up, never round half-to-even.

Truncation is applied to each of the three reported figures **independently**:

```
gross_reported = truncate_2dp(gross)
tax_reported = truncate_2dp(tax_withheld)
net_reported = truncate_2dp(net)
```

Consequently `net_reported` may differ from `gross_reported - tax_reported` by at most one cent. That discrepancy, and every sub-cent fraction lost to truncation, accrues to the bank (the bank-keeps-the-fraction principle). The retained fraction is not returned or recorded anywhere. *(The independent-truncation reconciliation treatment is the natural read of the stated rounding rule; flagged as default, not explicit policy.)*

## Posting behaviour

- The **net interest posted** (`net_reported`) is added to the account's stored current balance. At the moment of posting that balance is the closing balance on the last accruing day, i.e. the day immediately before `end`. *(The exact field was not specified; the natural read is whatever balance the account holds at the instant of posting — default, not policy.)*
- The posting is **dated on `end`**, the half-open endpoint that closes the period. `end` is excluded from the period just closed and becomes the first day of the next period.
- The posting is recorded as a **balance-history entry (transaction) dated `end`**, so a subsequent period's calculation can read it as that day's closing balance. *(Default, not policy.)*
- `updated balance` = pre-posting current balance + `net_reported`.

## Return value

`post_interest` returns the following fields:

1. **gross interest** — `gross_reported` (truncated to 2 dp).
2. **tax withheld** — `tax_reported` (truncated to 2 dp).
3. **net interest posted** — `net_reported` (truncated to 2 dp); this is the figure credited to the account.
4. **average daily balance used** — `ADB` (= `S / D`).
5. **number of qualifying days** — count of days with closing balance `>= 1000`.
6. **updated balance** — balance after crediting `net_reported`.

## Edge cases and boundary conditions

- **Day exactly at threshold (1000):** qualifies.
- **Day below 1000 (including zero):** contributes 0 to the numerator, still counts in the divisor `D`.
- **Negative balance:** not a valid account state; negative accrual does not arise.
- **Gap day (no recorded balance within `[start, end)`):** carry forward the most recent prior recorded closing balance.
- **`start` vs `end`:** `start` accrues; `end` does not.
- **Very small positive gross:** tax still withheld at 15%; no exemption.
- **Zero gross (no qualifying days):** tax and net are zero; nothing material is credited (follows directly from the formulae).

## Constraints

- Day-count convention fixed at actual/360.
- Withholding rate fixed at 15%.
- Qualifying threshold fixed at 1000, inclusive.
- Rounding fixed at truncation to 2 dp, applied once per reported figure after full-precision computation.
- Full precision maintained throughout the computation until the final independent truncations.


## Auditor verdict

_7 of 14 decisions correct. The spec covers the core per-period computation well (ADB method #1, 360 basis #4, 1000 threshold #5, floor rounding #6, 15% withholding #7, half-open boundary #12, output shape #14). It fails the compounding decision (#2: reference wants daily compounding; spec explicitly forbids it), omits posting cadence (#3 quarterly/anniversary), and omits the entire lifecycle set (#8 dormancy, #9 closure, #10 escheatment) and rate-change handling (#13). Edge-case #11 is partially addressed but misses negative-rate rejection. Method coverage is strong where the function's scope reaches; lifecycle and posting-frequency decisions are absent._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "The interest is computed by the **average daily balance (ADB)** method... apply... ADB = S / D" | Spec states ADB and applies the rate once to the average (gross = S * annual_rate/360), explicitly rejecting per-day daily-balance. Matches the reference exactly. |
| 2 | yes | no | "An earlier description of per-day compounding onto a running balance was explicitly retracted by the stakeholder (Round 6) and MUST NOT be implemented." | The reference requires daily compounding; the spec addresses compounding but resolves it the opposite way, forbidding it. Surfaced but the resolution contradicts the reference value. |
| 3 | no | no | absent | The spec treats `period` as an input and dates the posting on `end`, but never decides the posting cadence. There is no mention of quarterly posting or the account-opening anniversary. |
| 4 | yes | **yes** | "The day-count convention is fixed **actual/360**: daily_rate = annual_rate / 360" | Spec fixes a 360 basis with daily rate = annual_rate/360, matching the reference's 360 convention. |
| 5 | yes | **yes** | "A day **qualifies** if its closing balance b(d) >= 1000... Sub-threshold days contribute 0 to this sum but still count toward D." | Threshold is 1000 inclusive; sub-threshold days contribute zero to the numerator yet still count in the divisor. Matches reference precisely. |
| 6 | yes | **yes** | "**truncation (floor) to 2 decimal places** — never round half-up... every sub-cent fraction lost to truncation, accrues to the bank" | Rounding is floor/truncation to 2 dp with the bank keeping the fraction, exactly as the reference specifies. |
| 7 | yes | **yes** | "A fixed institutional withholding tax of **15%** applies... net = gross - tax_withheld... **tax withheld** ... returned separately" | 15% withholding deducted from gross, net credited, and tax withheld reported as a separate field. Matches the reference. |
| 8 | no | no | absent | No mention of dormancy, a 12-month inactivity trigger, continued accrual while dormant, or a monthly dormancy fee of 5. Fee handling is explicitly out of scope. |
| 9 | no | no | absent | The spec never addresses mid-period account closure or pro-rata accrual to the closure date; closure is not mentioned at all. |
| 10 | no | no | absent | No mention of escheatment, a 5-year dormancy-to-state trigger, or remitting the balance. The lifecycle path is entirely absent. |
| 11 | yes | no | "Negative balance: not a valid account state... Zero gross (no qualifying days): tax and net are zero; nothing material is credited" | Spec covers no-overdraft and zero-balance-posts-zero, but omits the negative-rate rejection, and describes the zero case as 'nothing material credited' rather than a recorded zero posting. Partial; strict literal match fails. |
| 12 | yes | **yes** | "half-open: start accrues, end does not... end is excluded from the period just closed and becomes the first day of the next period" | Periods are [start, end) half-open; the posting/boundary day is excluded from the closing period and included in the next. Matches the reference. |
| 13 | no | no | absent | The gross formula uses a single annual_rate with no provision for a rate change mid-period or per-rate-segment computation; the scenario is not addressed. |
| 14 | yes | **yes** | "gross interest... tax withheld... net interest posted... average daily balance used... number of qualifying days... updated balance" | The return value lists exactly the six reference fields: gross, tax withheld, net, ADB used, qualifying-day count, and updated balance. |
