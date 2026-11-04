# tessl — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 11 · Captured: 8/14 · Bespoke captured: 6/10

## Conversation

### Round 1
_Step reasoning:_ Following one-question-at-a-time, I start with the highest-impact core-behaviour gap: the day-count basis and simple-vs-compound accrual, which together determine the fundamental calculation.

Q: To compute the interest, how should the daily accrual be calculated from the annual rate — do you divide the annual rate by a fixed day-count basis (e.g. 365, 360, or actual days in the year) and apply it to each day's closing balance, and is the interest simple over the period or compounded (e.g. daily or monthly) as it accrues?
A: The daily rate is annual_rate / 360. Interest compounds daily: each day's accrued interest is added to the base before the next day's accrual is calculated.

### Round 2
_Step reasoning:_ Day-count and compounding are settled; rounding policy is the next highest-impact decision that can't be inferred and affects the compounding base, so I ask it alone per the one-question-at-a-time rule.

Q: When is the accrued interest rounded, and to what precision — do you round each day's compounded interest to the currency's minor unit (e.g. cents) before adding it to the base for the next day, or carry full precision throughout the period and round only the final posted amount, and which rounding rule applies (half-up, half-even/banker's, or truncate)?
A: Carry full precision throughout the period; round only the final posted amount. Rounding at posting is floor (truncate) to the minor unit (2 decimal places) — the bank keeps the fraction. Half-up rounding is never applied. Intra-period daily compounding uses full floating-point precision with no intermediate rounding [default, not policy for the intra-period precision detail].

### Round 3
_Step reasoning:_ Day-count, compounding and rounding are settled; the next material, uninferable policy is how zero and negative daily balances affect accrual, so I ask that single question before moving to period-boundary semantics.

Q: How are non-positive daily balances treated when accruing interest — does a day with a zero balance simply accrue nothing, and does a day with a negative balance (overdraft) accrue negative interest that reduces the accrued base, or are negative balances floored at zero so they never reduce interest?
A: A zero-balance day accrues nothing for that day — it contributes zero to the interest calculation. The account never goes negative, so a negative-balance scenario does not arise. There is no negative interest accrual. Additionally, the minimum-balance rule means any day the balance is below 1,000 (including a zero-balance day) contributes zero interest for that day, though the day still counts in the period's divisor.

### Round 4
_Step reasoning:_ Accrual method, rounding, and balance treatment are settled, but the period's day boundaries and how missing balance entries are handled remain ambiguous and materially affect the computed interest.

Q: How is the set of accrual days derived from the period and the daily balance history — are both the period's start and end dates inclusive, and if a day in the period has no explicit balance entry, is that day's balance carried forward from the last known closing balance (and does that carried-forward balance still count toward the minimum-balance test and the divisor)?
A: Periods are half-open: [start, end). The start date is included in the period; the posting date (end) is excluded from the period it closes and belongs to the next period. For days within the period that have no explicit balance entry, the last known closing balance carries forward to that day — that carried-forward balance applies to the minimum-balance test (days below 1,000 contribute zero interest) and the day still counts in the divisor regardless [default, not policy for the carry-forward detail].

### Round 5
_Step reasoning:_ Accrual, rounding, balance treatment and day derivation are settled; the posting mechanics (how interest updates the balance and on what date) remain the last material undefined policy before the requirements are complete.

Q: When `post_interest` posts the computed interest, how does it update the account — is the floored interest amount added to the account's closing balance (so the returned updated balance = balance at period end + posted interest), and does the posting occur dated on the period's end date (the excluded [start, end) boundary that opens the next period), with the posted interest becoming part of the base that the next period's compounding starts from?
A: The account is credited the net interest — gross floored interest minus 15% withholding tax — not the gross amount. So the updated balance equals the balance at period end plus net interest posted. The posting is dated on the period's end date, which is the excluded boundary of [start, end); that date opens the next period, and the credited net interest becomes part of the base from which the next period's daily compounding starts.

### Round 6
_Step reasoning:_ Core accrual, rounding, balance treatment, period boundaries and posting are settled, but the withholding-tax rounding order and whether the returned figure is gross or net remain genuinely ambiguous, so one more targeted question is needed before summarising.

Q: When the 15% withholding tax is applied to arrive at the net interest credited, how are the tax and net amounts rounded — is the tax computed on the gross floored interest and itself floored to the minor unit (so net = gross_floored − floor(0.15 × gross_floored)), or is the net computed as a single floor(0.85 × gross) with the tax being the remainder, and separately, does the value your function returns as "the interest posted" refer to the gross floored interest or the net amount actually credited to the balance?
A: The tax rounding method is not explicitly specified in policy. As a reasonable default consistent with the floor-to-minor-unit rule: tax_withheld = floor(0.15 × gross_floored), net_posted = gross_floored − tax_withheld — the bank floors the tax, so any sub-cent fraction of the tax stays with the net credited to the customer [default, not policy]. The alternative (floor(0.85 × gross_floored) with the remainder as tax) would be equally defensible mechanically, but the former is the more conventional treatment. Separately, the value reported as 'the interest posted' is the net amount actually credited to the balance (gross_floored minus tax_withheld); the gross and the tax withheld are reported as their own distinct fields alongside it.

### Round 7
_Step reasoning:_ The repeated 'divisor' references conflict with the stated day-by-day daily-compounding method; this is a material correctness gap that must be resolved before summarising, so I ask one more targeted question rather than declaring the interview complete.

Q: You've referred a couple of times to days 'counting in the period's divisor' even for zero-interest days, but the accrual you described is daily compounding (each day accrues daily_rate × base where daily_rate = annual_rate / 360), which needs no per-period divisor. Can you clarify what that divisor is and where it enters the calculation — is interest in fact computed on an average daily balance over the period (sum of qualifying daily balances ÷ day count) rather than day-by-day compounding, and if so what exactly is the divisor (actual days in the period, or a fixed 360/30), or is 'divisor' just informal wording and the true method is strict day-by-day daily compounding with sub-1,000 days simply contributing a zero accrual that day?
A: The true method is average daily balance (ADB), not strict day-by-day accrual summed up. The previous description of daily compounding was imprecise and I should correct it: sum each day's closing balance over the [start, end) period, divide by the actual number of days in that period (that is the divisor), and apply the annual rate once to that average. The divisor is the real calendar day count of the period, not a fixed 360 or 30. Days where the balance is below 1,000 contribute zero to the numerator (the running sum of balances) but still count as a full day in the denominator, which is why those days affect the average even though they earn nothing. Compounding means the net interest credited at each quarterly posting joins the account balance and therefore enters the daily balance snapshots used to compute the next period's average — it is inter-period compounding via the posted balance, not intra-period day-by-day accrual.

### Round 8
_Step reasoning:_ Round 7 replaced daily compounding with ADB but left the rate-to-period conversion (full annual rate vs pro-rated, and the day-count basis) unspecified and material to the amount.

Q: On the corrected average-daily-balance method: once you have the average balance for the period, how does the annual rate convert into the period's interest — do you apply the full annual rate to the average as-is (so a quarter earns a full year's interest), or do you pro-rate it by the period's length, and if pro-rated, using which day-count (period_days / 360, / 365, or actual days in the year)? The earlier 360 basis was tied to the now-retracted daily-compounding method, so I need to know whether 360 still governs the ADB time factor.
A: The rate is pro-rated by the period's length, and the 360 basis still governs. The period interest is: ADB × annual_rate × (period_days / 360), where period_days is the actual calendar day count of the [start, end) period and 360 is the fixed day-count basis. Applying the full annual rate without pro-rating would be incorrect — a quarter earns roughly a quarter of a year's interest, not a full year's.

### Round 9
_Step reasoning:_ The ADB method and all major policies are now settled and internally consistent, but the exact-threshold boundary of the sub-1,000 zero-contribution rule is a material, still-unspecified edge case that must be pinned down before summarising.

Q: For the minimum-balance rule, is the qualifying test inclusive or exclusive at the threshold — does a day with a closing balance of exactly 1,000 qualify to contribute its balance to the average's numerator (i.e. the test is balance >= 1,000), or must the balance be strictly greater than 1,000 for the day to count, so exactly 1,000 contributes zero?
A: A day with a closing balance of exactly 1,000 qualifies — the test is balance >= 1,000. A balance of exactly 1,000 contributes its full balance to the numerator.

### Round 10
_Step reasoning:_ All material policy gaps appear resolved; the process requires an explicit stakeholder confirmation of the summary before completion, so I present it for sign-off rather than declaring done.

Q: Before I hand these off for spec authoring, please confirm this summary is accurate. SCOPE: `post_interest(account, period)` computes and posts interest for one savings account over a half-open period [start, end); it returns the net interest credited plus distinct fields for gross floored interest and tax withheld, and the account's updated balance. METHOD (average daily balance): for each calendar day in [start, end), take the day's closing balance (carrying forward the last known balance for days with no explicit entry); a day counts toward the numerator only if its closing balance is >= 1,000, otherwise it contributes zero, but every day counts in the denominator. ADB = sum(qualifying daily balances) / period_days, where period_days is the actual calendar day count of the period. Period gross interest = ADB × annual_rate × (period_days / 360), carried at full precision. ROUNDING/TAX: gross_floored = floor(gross to 2dp); tax_withheld = floor(0.15 × gross_floored); net_posted = gross_floored − tax_withheld (floor only, never half-up; bank keeps sub-unit fractions). POSTING: net_posted is credited to the balance dated on the period end date (the excluded boundary that opens the next period); updated_balance = balance at period end + net_posted; the credited net becomes part of the balance snapshots feeding the next period's ADB (inter-period compounding, no intra-period accrual). CONSTRAINTS: balances never go negative, so no negative-interest case. Is this correct and complete, or is any policy missing (e.g. tax-free thresholds/exemptions, or a required day-count for the ADB denominator other than actual calendar days)?
A: The summary is accurate. Two gaps to add before handing off for spec authoring. First, the return shape is missing two required fields: the average daily balance used in the calculation and the count of qualifying days (days where the closing balance was >= 1,000). Both must be returned alongside gross_floored, tax_withheld, net_posted, and updated_balance. Second, rate changes mid-period: if the annual rate changes during the [start, end) period, compute ADB × rate × (segment_days / 360) independently for each contiguous rate-segment within the period, then sum the segment gross interests before flooring — the single floor and tax step apply to the combined gross. On your two specific questions: no tax-free threshold or exemption exists in policy; 15% withholding applies to every posting regardless of amount. The ADB denominator is confirmed as actual calendar day count of the period, not a fixed 360 or 30.

### Round 11
_Step reasoning:_ Round 10 confirmed the summary but added two new policy items (extra return fields, mid-period rate segmentation); the process requires updating the summary and re-confirming rather than proceeding on a changed summary.

Q: Thanks — I've folded in both additions. Final confirmation of the complete requirements: (1) RETURN SHAPE: post_interest returns net_posted (the interest posted, = gross_floored − tax_withheld), gross_floored, tax_withheld, average_daily_balance used, qualifying_day_count (days with closing balance >= 1,000), and updated_balance. (2) METHOD (ADB): for each calendar day in half-open [start, end), take the day's closing balance, carrying forward the last known balance for days with no explicit entry; a day contributes its balance to the numerator only if closing balance >= 1,000, else zero, but every day counts in the denominator; ADB = sum(qualifying daily balances) / period_days where period_days is the actual calendar day count. (3) RATE + MID-PERIOD CHANGES: for each contiguous rate-segment within the period, compute ADB × segment_rate × (segment_days / 360) using the fixed 360 basis, then sum the segment gross interests to get period gross, carried at full precision; if the rate is constant this reduces to ADB × annual_rate × (period_days / 360). (4) ROUNDING/TAX: gross_floored = floor(period gross to 2dp); tax_withheld = floor(0.15 × gross_floored); net_posted = gross_floored − tax_withheld; floor only, never half-up; 15% withholding applies to every posting with no tax-free threshold or exemption. (5) POSTING: net_posted is credited to the balance dated on the period end date (the excluded boundary of [start, end) that opens the next period); updated_balance = balance at period end + net_posted; the credited net enters the next period's daily balance snapshots (inter-period compounding, no intra-period accrual). (6) CONSTRAINTS: balances never go negative, so there is no negative-interest case. Is this now correct and complete?
A: The summary is correct and complete.

### Round 12 (process signalled done)
_Step reasoning:_ The stakeholder explicitly confirmed in Round 11 that the complete requirements summary is correct and complete, satisfying the process's explicit-approval and zero-ambiguity success criteria; no gaps remain.

(no questions this round)

## Produced specification

# Requirements specification — savings-account interest engine (`post_interest`)

Status: confirmed by the stakeholder (Round 11). Ready for spec authoring.

This document records the requirements clarified through the stakeholder interview. Every policy below was settled in the conversation. Items resolved by process default (because they were neither asked as policy nor stated in the brief) are marked **[default]**; they should be revisited if policy later dictates otherwise.

## 1. Scope

**In scope.** A single function `post_interest(account, period)` that, for one savings account over one posting period, computes the interest earned, applies withholding tax, posts the net interest to the account, and returns the computed figures together with the updated balance.

**Out of scope.** Multi-account processing, scheduling of periods, persistence, and any behaviour for negative balances (they cannot occur — see Constraints). No tax-free threshold, allowance, or exemption exists; withholding applies to every posting regardless of amount.

## 2. Interface and return shape

`post_interest(account, period)` returns all of the following distinct fields:

- `net_posted` — the interest posted, i.e. the net amount actually credited to the balance (`gross_floored − tax_withheld`). This is the value the function reports as "the interest posted".
- `gross_floored` — the period gross interest floored to the minor unit (2 decimal places).
- `tax_withheld` — the 15% withholding tax, floored (see Rounding/tax).
- `average_daily_balance` — the ADB used in the calculation.
- `qualifying_day_count` — the number of days in the period whose closing balance was >= 1,000.
- `updated_balance` — the account balance at period end plus `net_posted`.

## 3. Period model

The period is half-open: `[start, end)`. The start date is included; the end (posting) date is excluded from the period it closes and belongs to the next period. `period_days` is the actual calendar day count of `[start, end)`.

## 4. Core method — average daily balance (ADB)

Interest is computed on the average daily balance over the period, not by day-by-day accrual.

1. **Daily closing balance.** For each calendar day in `[start, end)`, take the day's closing balance. For a day with no explicit balance entry, carry forward the last known closing balance to that day **[default]**. The carried-forward balance is treated exactly like an explicit balance for both the minimum-balance test and the divisor.
2. **Minimum-balance qualification.** A day contributes its closing balance to the numerator (the running sum of balances) only if that closing balance is **>= 1,000**. The test is inclusive: a balance of exactly 1,000 qualifies and contributes its full balance. A day below 1,000 (including a zero-balance day) contributes zero to the numerator.
3. **Divisor.** Every day in the period counts in the denominator regardless of whether it qualified. The denominator is `period_days`, the actual calendar day count of the period (not a fixed 360 or 30). Sub-1,000 days therefore lower the average even though they earn nothing.
4. **ADB.** `ADB = sum(qualifying daily closing balances) / period_days`.

## 5. Rate application and mid-period rate changes

The annual rate is pro-rated by the period's length using a fixed 360 day-count basis.

- **Constant rate:** `period_gross = ADB × annual_rate × (period_days / 360)`.
- **Rate change within the period:** split `[start, end)` into contiguous rate-segments. For each segment compute `ADB × segment_rate × (segment_days / 360)` using the same single ADB for the whole period and the fixed 360 basis, where `segment_days` is that segment's calendar day count. Sum the segment gross interests to obtain `period_gross`.

`period_gross` is carried at full precision; no rounding occurs before the flooring step in section 6. Applying the full annual rate without pro-rating is incorrect — a quarter earns roughly a quarter of a year's interest.

## 6. Rounding and withholding tax

All rounding is floor (truncate) to the minor unit (2 decimal places). Half-up rounding is never applied; the bank keeps any sub-unit fraction.

1. `gross_floored = floor(period_gross to 2dp)`.
2. `tax_withheld = floor(0.15 × gross_floored)` **[default]** — the tax is computed on the gross floored interest and itself floored, so any sub-cent fraction of the tax stays with the customer's net credit.
3. `net_posted = gross_floored − tax_withheld`.

The 15% withholding tax applies to every posting; there is no tax-free threshold, allowance, or exemption.

## 7. Posting

- `net_posted` (the net interest) is credited to the account.
- `updated_balance = balance at period end + net_posted`.
- The posting is dated on the period's end date, which is the excluded boundary of `[start, end)` and opens the next period.
- The credited net interest becomes part of the balance from that date, so it enters the daily balance snapshots used to compute the next period's ADB. Compounding is therefore inter-period, carried through the posted balance; there is no intra-period day-by-day accrual.

## 8. Constraints

- Balances never go negative, so no negative-interest case arises and none is handled.
- A zero-balance day accrues nothing; this is subsumed by the minimum-balance rule (any day below 1,000 contributes zero to the numerator while still counting in the divisor).

## 9. Worked identity (constant-rate sanity check)

For a period with a constant rate:

```
ADB              = sum(daily balance for days with balance >= 1,000) / period_days
gross            = ADB × annual_rate × (period_days / 360)
gross_floored    = floor(gross, 2dp)
tax_withheld     = floor(0.15 × gross_floored, 2dp)
net_posted       = gross_floored − tax_withheld
updated_balance  = balance_at_period_end + net_posted
```

## 10. Defaults to confirm during spec authoring

These were resolved by process default rather than explicit policy and should be flagged for confirmation:

- Carry-forward of the last known closing balance for days with no explicit entry (section 4.1).
- Tax rounding as `tax_withheld = floor(0.15 × gross_floored)` rather than `net = floor(0.85 × gross_floored)` with the remainder as tax (section 6.2).

## Auditor verdict

_The spec strongly covers method/convention and edge decisions (1, 4, 5, 6, 7, 12, 13, 14 correct) but fails the lifecycle domain entirely: dormancy (8), closure (9), and escheatment (10) are all absent, and posting frequency/anniversary (3) is out of scope. Decision 2 is surfaced but resolved oppositely (inter-period rather than daily compounding), and 11 is only partly matched (missing negative-rate rejection). Coverage = 8/14; the core in-focus six [1,2,3,8,9,10] score only 1/6, showing lifecycle and posting-cadence coverage did not generalise to the savings domain._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Section 4: "Interest is computed on the average daily balance over the period, not by day-by-day accrual." and "ADB = sum(qualifying daily closing balances) / period_days" | The spec applies the rate once to a single average daily balance rather than accruing per-day, matching the reference's average-daily-balance method exactly. |
| 2 | yes | no | Section 7: "Compounding is therefore inter-period, carried through the posted balance; there is no intra-period day-by-day accrual." | The reference requires daily compounding within the period; the spec explicitly states compounding is only inter-period with no intra-period accrual, the opposite resolution. |
| 3 | no | no | absent | The spec handles a single supplied posting period and declares "scheduling of periods" out of scope; it never states posting is quarterly on the account-opening anniversary. |
| 4 | yes | **yes** | Section 5: "pro-rated by the period's length using a fixed 360 day-count basis" and "period_days / 360" | The spec fixes the day-in-year basis at 360, matching the reference. |
| 5 | yes | **yes** | Section 4.2-4.3: "contributes its closing balance ... only if that closing balance is >= 1,000"; "Every day in the period counts in the denominator regardless of whether it qualified." | Inclusive 1,000 threshold, sub-threshold days contribute zero to numerator but still count in the divisor, exactly matching the reference. |
| 6 | yes | **yes** | Section 6: "All rounding is floor (truncate) to the minor unit (2 decimal places). Half-up rounding is never applied; the bank keeps any sub-unit fraction." | Posted interest is floored to 2dp with the bank keeping the fraction, matching the reference rounding rule. |
| 7 | yes | **yes** | Section 6: "tax_withheld = floor(0.15 × gross_floored)"; "net_posted = gross_floored − tax_withheld"; return field "tax_withheld — the 15% withholding tax" | 15% withholding deducted from gross, net credited, and tax reported as a separate return field, matching the reference (the minor gross-vs-gross_floored base difference does not change the substance). |
| 8 | no | no | absent | The spec makes no mention of dormancy, a 12-month trigger, continued accrual while dormant, or a monthly dormancy fee of 5. |
| 9 | no | no | absent | The spec covers only a normal posting period and says nothing about closure mid-period or pro-rata accrual to a closure date. |
| 10 | no | no | absent | The spec never addresses escheatment, a 5-year dormant trigger, or remitting the balance to the state. |
| 11 | yes | no | Section 8: "Balances never go negative, so no negative-interest case arises and none is handled."; "A zero-balance day accrues nothing" | The spec covers the never-negative-balance and zero-balance-no-op parts, but does not state that a negative rate is rejected as invalid, so the reference's full resolution is not matched. |
| 12 | yes | **yes** | Section 3: "The period is half-open: [start, end). ... the end (posting) date is excluded from the period it closes and belongs to the next period." | Half-open [start, end) with the posting day excluded from the closed period and included in the next, exactly matching the reference. |
| 13 | yes | **yes** | Section 5: "split [start, end) into contiguous rate-segments. For each segment compute ADB × segment_rate × (segment_days / 360) ... Sum the segment gross interests" | Each day uses the rate in force via per-segment computation summed over the period, matching the reference's rate-change handling. |
| 14 | yes | **yes** | Section 2 return fields: net_posted, gross_floored, tax_withheld, average_daily_balance, qualifying_day_count, updated_balance | The return shape discloses gross, tax withheld, net posted, the ADB used, the qualifying-day count, and the updated balance, covering all six reference fields. |
