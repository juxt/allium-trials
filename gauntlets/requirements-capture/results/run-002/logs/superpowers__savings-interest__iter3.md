# superpowers — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 16 · Captured: 8/14 · Bespoke captured: 6/10

## Conversation

### Round 1
_Step reasoning:_ The brief omits every material interest-calculation policy (day-count, compounding, boundaries, rounding, negative balances, posting semantics); these cannot be reliably inferred, so I must ask the stakeholder before specifying.

Q: Day-count and accrual basis: how is the daily rate derived from the annual rate (Actual/365 fixed, Actual/360, or Actual/Actual including leap years), and which daily balance do you accrue on (start-of-day vs end-of-day)?
A: Daily rate = annual_rate / 360 (360-day basis, not Actual/365 or Actual/Actual). Which daily balance to use (start-of-day vs end-of-day) is not specified in policy — [default, not policy] use end-of-day balance for each calendar day.

Q: Simple vs compound: do you accrue simple interest on each day's balance and sum, or does interest compound within the period (e.g. daily), and if it compounds, does mid-period posted interest itself earn interest?
A: Interest compounds daily within the period: each day's accrued interest is added to the base before the next day's accrual. Mid-period interest is not separately posted, so the compounding is internal to the period only; posted interest from a prior quarter joins the principal and therefore earns interest in subsequent periods.

Q: Period boundaries: is the accrual period inclusive of both the first and last day, or half-open (include start, exclude end, or vice versa)?
A: Half-open: [start, end). The opening day of the period is included; the posting day is excluded from the period it closes and becomes day 1 of the next period.

Q: Rounding: to what precision is interest rounded (nearest cent, half-up/banker's rounding), and do you round each day's accrual or only the final posted total?
A: Only the final posted total is rounded — not each day's accrual. Rounding is floor (truncate) to 2 decimal places; never half-up or banker's rounding. The bank retains the sub-cent fraction. Intermediate day-level precision is not specified — [default, not policy] carry full floating-point precision until the final floor.

Q: Negative balances: if the daily balance is negative (overdrawn) on some days, do you still accrue (negative) interest on those days, floor them at zero, or apply a different overdraft rate?
A: The account never goes negative — the system must prevent overdrafts, so a negative daily balance should not arise. If somehow encountered, treat it as an invalid state and raise an error rather than accruing negative interest or applying an overdraft rate. (No separate overdraft-interest rate is defined in policy.)

Q: Posting mechanics: does post_interest add the computed interest to the account balance (and persist it), and what should it do if interest for this period has already been posted or the balance history is incomplete/missing days?
A: Yes: post_interest credits the net interest (gross minus 15% withholding tax) to the account balance and persists both the posting record and the updated balance. A duplicate posting for a period that has already been posted must be rejected as an error. Incomplete or missing balance history for days in the period — [default, not policy] — should be treated as a data integrity error and rejected; do not silently assume zero for missing days.

### Round 2
_Step reasoning:_ Round 1 settled accrual, compounding, boundaries, rounding, negatives and posting, but rate variability/tiering, withholding-tax rounding order, the return value's gross-vs-net meaning, and rate units remain materially ambiguous and institution-specific.

Q: Interest rate: is the annual rate a single fixed value for the whole period, or can it change mid-period (a rate schedule), and are there balance-tiered or threshold rates where different portions/levels of the balance earn different rates?
A: The rate can change mid-period: each day uses the rate in force on that day, and interest is computed per rate-segment and summed. No balance-tiered or threshold rates are defined in policy — [default, not policy] a single rate applies to the full balance on each day.

Q: Withholding tax mechanics and rounding: is the 15% computed on the full-precision gross interest or on the floored gross, is the tax amount itself floored/truncated to 2 decimals, and is the credited net = (gross minus tax) floored once, or floor(gross) minus floor(tax)? Also, is the withheld tax recorded/persisted separately?
A: The 15% tax is deducted from the gross interest at posting, and the amount withheld is recorded and reported separately. The specific sub-rounding mechanics (whether tax is computed on full-precision or already-floored gross, and whether the net is floor(gross) minus floor(tax) or floored once) are not specified in policy — [default, not policy] compute tax on the full-precision gross, floor the tax to 2 dp, and credit net = floor(gross) − floor(tax).

Q: Return value semantics: does the 'interest posted' that post_interest returns refer to the gross interest accrued or the net amount credited to the balance (gross minus withholding)?
A: The return includes gross interest, tax withheld, and net interest posted as separate fields. 'Interest posted' refers to the net amount actually credited to the balance (gross minus withholding).

Q: Rate units and source: is annual_rate expressed as a decimal fraction (e.g. 0.05) or a percentage, and is it carried on the account object, passed in, or looked up elsewhere?
A: Not specified in policy — [default, not policy] express annual_rate as a decimal fraction (e.g. 0.05) and carry it on the account object or pass it as a parameter.

### Round 3
_Step reasoning:_ Core accrual, compounding, rounding, tax and posting mechanics are settled; two genuinely institution-specific policies remain that cannot be safely inferred — an interest-eligibility balance threshold and whether post_interest must enforce period contiguity against prior postings.

Q: Eligibility threshold: is there a minimum daily (or average) balance an account must hold to earn interest, below which a day accrues nothing, or does every non-negative balance accrue from the first cent?
A: Interest accrues only on days the balance is at or above 1,000. On days the balance is below that threshold, zero interest accrues for that day, but the day still counts in the average-balance divisor (the denominator of the period).

Q: Period cadence and provenance: the `period` passed to post_interest defines [start, end) — is this always a fixed cadence (e.g. calendar quarter) the caller supplies, and must post_interest validate it against the last posted period to enforce contiguity (no gaps or overlaps between successive postings)?
A: The posting cadence is quarterly on the anniversary of account opening — not calendar quarter-ends — so the caller derives and supplies the [start, end) period. Whether post_interest must enforce contiguity (reject gaps between successive postings) is not specified in policy — [default, not policy] the caller is responsible for supplying a correctly contiguous period; post_interest must reject a period that overlaps an already-posted period (the existing duplicate-posting rule covers overlap), but gap detection is the caller's responsibility unless you choose to add it as a defensive check.

### Round 4
_Step reasoning:_ The eligibility answer introduced an 'average-balance divisor' that appears to conflict with the established per-day daily-compounding model, and tax-exemption scope remains unconfirmed; both are genuine hidden policy decisions that cannot be safely inferred.

Q: Reconcile the accrual model with the eligibility answer: interest is described as accruing per-day (daily compounding on each day's end-of-day balance), yet the threshold answer refers to an 'average-balance divisor (the denominator of the period)'. Is there a separate average-daily-balance computation in play (e.g. an average-balance eligibility gate, or interest computed on the period's average balance rather than compounded day-by-day), or was 'average-balance divisor' incidental and the model remains strict per-day accrual where sub-threshold days simply contribute zero accrual? If an average is used anywhere, what exactly is averaged and over what divisor?
A: The 'average-balance divisor' was not incidental — the interest calculation method is average daily balance (ADB): sum all end-of-day balances over the period, divide by the total number of calendar days in the period, then apply the rate once to that average. This is not day-by-day compounding within the period. Sub-threshold days (end-of-day balance below 1,000) contribute zero to the numerator (the balance sum) but still count in the denominator (the calendar-day count for the period). The earlier answer describing daily compounding within the period was incorrect; that language should be read as meaning posted quarterly interest joins the account balance and therefore affects the ADB in subsequent periods, not that interest rolls up intra-period.

Q: Withholding tax scope: is the 15% withheld on all interest for every account unconditionally, or are there exemptions or a tax-free interest allowance (e.g. account-type exemptions, or a threshold below which no tax is withheld) that post_interest must apply?
A: 15% withholding applies unconditionally at each posting for all accounts. No exemptions, account-type carve-outs, or tax-free interest allowance are defined in policy.

### Round 5
_Step reasoning:_ The ADB clarification in Round 4 contradicts the earlier per-rate-segment answer and leaves the rate-to-period conversion under the 360-day basis undefined; both are material, non-inferable policy choices worth one more round before specifying.

Q: Reconcile the rate-schedule answer with the ADB method: since interest is now average daily balance (sum of end-of-day balances / calendar days in period, rate applied once to that average) rather than per-day accrual, how does a mid-period rate change work? Do you (a) compute one ADB for the whole period and apply a day-count-weighted average rate, or (b) partition the period at each rate change into segments, and for each segment apply that segment's rate — and if so, is each segment's balance-sum divided by that segment's own day count or by the whole period's day count? The earlier 'per rate-segment and summed' answer was given under the since-retracted daily-compounding model, so I need the ADB-consistent rule.
A: Option (b): partition the period at each rate-change boundary into segments. For each segment, compute that segment's own ADB (sum of end-of-day balances within the segment divided by that segment's own calendar-day count), apply that segment's rate scaled by segment_days / 360, and sum the results across segments. Each segment uses its own day count as the divisor, not the whole period's day count. The 'per rate-segment and summed' language in the earlier answer carries over intact; the correction was to the intra-period compounding claim, not to the segmentation rule.

Q: Confirm how the 360-day annual rate maps onto the period under ADB: is period interest = ADB × annual_rate × (calendar_days_in_period / 360)? I.e. the annual rate is applied to the average balance and scaled by the actual number of period days over 360, so a roughly 90-day quarter earns about annual_rate × 90/360 on the average balance.
A: Confirmed. Period interest = ADB × annual_rate × (calendar_days_in_period / 360). The 360-day basis means the daily rate is annual_rate / 360, so multiplying by the actual calendar days in the period gives that scaling. A quarter of roughly 90 days earns approximately annual_rate × 90/360 on the average daily balance.

### Round 6 (process signalled done)
_Step reasoning:_ Five rounds have resolved every omitted policy decision (360-day basis, ADB method with segment-wise rate changes, half-open period, floor rounding, 1,000 eligibility threshold, 15% unconditional withholding with its rounding, quarterly anniversary cadence, duplicate/overlap and invalid-state handling, and return fields); no material policy ambiguity remains to infer.

(no questions this round)

## Produced specification

# Specification: `post_interest(account, period)` — savings interest engine

## 1. Purpose and scope

This document specifies the interest engine for savings accounts. The engine computes the interest an account earns over a posting period, deducts withholding tax, credits the net amount to the account, and persists the result. The single public entry point is:

```
post_interest(account, period) -> result
```

It is invoked once per posting period for a given account. The period is quarterly on the anniversary of account opening (see §8). Everything below captures the policy decisions settled with the stakeholder, together with the engineering defaults chosen where policy was silent. Default choices are marked `[default]`; everything else is institutional policy.

## 2. Function contract

### 2.1 Inputs

- `account` — the savings account. Carries at minimum its identifier, current balance, opening date, the daily balance history, the annual interest rate (or a rate schedule), and the record of previously posted periods. `[default]` The `annual_rate` is expressed as a decimal fraction (e.g. `0.05` for 5%), carried on the account object or passed as a parameter; it is not a percentage integer.
- `period` — a half-open interval `[start, end)` supplied by the caller. `start` is the first calendar day included in the accrual; `end` is excluded (see §8).

### 2.2 Return value

The function returns a result exposing, as separate fields:

- `gross_interest` — the gross interest computed for the period, floored to 2 decimal places.
- `tax_withheld` — the 15% withholding tax, floored to 2 decimal places.
- `net_interest` — the net amount actually credited to the balance, equal to `gross_interest − tax_withheld`. This is what "interest posted" means.
- `updated_balance` — the account balance after the net interest has been credited.

"Interest posted" throughout this spec refers to the net amount credited, not the gross accrued.

## 3. Calculation method: average daily balance (ADB)

Interest is computed by the **average daily balance** method. It is **not** day-by-day compounding within the period. For a period with a single rate in force throughout:

1. For each calendar day in `[start, end)`, take the **end-of-day** balance for that day. `[default]` End-of-day (rather than start-of-day) is used; policy did not specify which.
2. Form the **balance sum** (the numerator): the sum of each day's eligible end-of-day balance, where eligibility is applied per §4.
3. Form the **day count** (the denominator): the total number of calendar days in the period. Every calendar day in `[start, end)` counts, including days that contribute zero to the numerator.
4. `ADB = balance_sum / day_count`.
5. `gross_interest = ADB × annual_rate × (day_count / 360)`.

The 360-day basis is fixed policy: the daily rate is `annual_rate / 360`, so scaling the average balance by the actual number of calendar days over 360 yields the period interest. A quarter of roughly 90 days therefore earns approximately `annual_rate × 90/360` on the average daily balance.

The annual rate is **not** Actual/365, Actual/360-with-actual-year, or Actual/Actual. It is a flat 360-day divisor.

## 4. Eligibility threshold

Interest accrues only on days whose end-of-day balance is **at or above 1,000**. On a day whose end-of-day balance is below 1,000:

- The day contributes **zero** to the balance sum (the numerator of the ADB).
- The day **still counts** in the day-count denominator.

Sub-threshold days therefore drag the average down rather than being excluded. The threshold is applied to the raw end-of-day balance of each day, before averaging.

## 5. Rate schedule and mid-period rate changes

The annual rate may change mid-period. Each day uses the rate in force on that day. `[default]` A single rate applies to the full balance on each day; there are no balance-tiered or threshold rates where different portions of the balance earn different rates.

When the rate changes within a period, the period is handled by **segmentation**, consistent with the ADB method:

1. Partition `[start, end)` at each rate-change boundary into contiguous segments. Each segment has a single rate in force.
2. For each segment, compute that segment's **own** ADB: the sum of eligible end-of-day balances within the segment (§4 applied per day), divided by **that segment's own calendar-day count**, not the whole period's day count.
3. For each segment, `segment_interest = segment_ADB × segment_rate × (segment_day_count / 360)`.
4. `gross_interest = Σ segment_interest` over all segments.

Each segment's day count is its own divisor and its own `/360` numerator. A period with no rate change is the degenerate case of a single segment spanning `[start, end)`, which reduces to §3.

## 6. Rounding

- Only the **final posted total** is rounded. Per-day accruals, segment sums, and intermediate ADB values are **not** rounded. `[default]` Full floating-point precision is carried through all intermediate steps until the final floor; intermediate day-level precision was not specified by policy.
- Rounding is **floor (truncation) to 2 decimal places**. Never half-up, never banker's rounding. The bank retains the sub-cent fraction.

## 7. Withholding tax

A **15% withholding tax** is deducted from the gross interest at posting. It applies **unconditionally to every account at every posting**. There are no exemptions, no account-type carve-outs, and no tax-free interest allowance.

The tax amount is **recorded and reported separately** (persisted and exposed in the return value).

`[default]` Sub-rounding mechanics, where policy was silent:

- Tax is computed on the **full-precision gross** interest: `tax_raw = gross_full_precision × 0.15`.
- The tax is floored to 2 dp: `tax_withheld = floor(tax_raw, 2)`.
- The credited net is `floor(gross_full_precision, 2) − floor(tax_raw, 2)`, i.e. gross and tax are each floored once and then subtracted, rather than netting first and flooring once.

The reported `gross_interest` is `floor(gross_full_precision, 2)`; `tax_withheld` is `floor(tax_raw, 2)`; `net_interest` is their difference.

## 8. Period cadence and provenance

- The posting cadence is **quarterly on the anniversary of account opening**, not on calendar quarter-ends.
- The **caller** derives and supplies the `[start, end)` period. `post_interest` does not compute period boundaries itself.
- Period boundaries are **half-open `[start, end)`**: the opening day of the period is included; the posting day is excluded from the period it closes and becomes day 1 of the next period.
- `post_interest` must **reject a period that overlaps an already-posted period** (the duplicate-posting rule in §9 covers overlap).
- `[default]` **Gap detection is the caller's responsibility.** The caller must supply correctly contiguous periods. `post_interest` is not required to reject gaps between successive postings, though a defensive contiguity check against the last posted period may be added without violating policy.

## 9. Posting mechanics and persistence

On a valid call, `post_interest`:

1. Computes gross, tax, and net per §3–§7.
2. **Credits the net interest** (gross minus 15% withholding) to the account balance.
3. **Persists** both the posting record (including the separately recorded tax withheld, the gross, the net, and the period) and the updated balance.
4. Returns the result described in §2.2.

Because posted interest joins the account balance, it affects the ADB of **subsequent** periods: net interest credited in one quarter forms part of the end-of-day balances of the next quarter. This is the only sense in which interest "compounds" across periods. There is **no** intra-period compounding; interest does not roll up day-by-day within a period.

## 10. Error and invalid-state handling

`post_interest` must reject the following rather than proceeding:

- **Duplicate / overlapping posting.** A posting for a period already posted, or one overlapping an already-posted period, is rejected as an error.
- **Negative daily balance.** The account must never go negative; the surrounding system prevents overdrafts. If a negative end-of-day balance is nonetheless encountered within the period, it is an **invalid state** and must raise an error. The engine does **not** accrue negative interest, floor the day at zero, or apply any overdraft rate. No overdraft-interest rate is defined.
- **Incomplete or missing balance history.** `[default]` If the daily balance history is missing days within the period, it is treated as a **data integrity error** and the call is rejected. The engine does **not** silently assume zero for missing days. (This is distinct from a present-but-sub-threshold day, which is a legitimate zero contribution per §4.)

## 11. Worked sanity check

Single rate, 90-day quarter, every day's end-of-day balance = 2,000 (all above threshold), `annual_rate = 0.05`:

- balance_sum = 2,000 × 90 = 180,000; day_count = 90; ADB = 2,000.
- gross = 2,000 × 0.05 × (90 / 360) = 25.00.
- tax_withheld = floor(25.00 × 0.15, 2) = floor(3.75, 2) = 3.75.
- net = floor(25.00, 2) − 3.75 = 25.00 − 3.75 = 21.25.
- updated_balance = prior balance + 21.25.

If 10 of those 90 days had an end-of-day balance of 500 (below threshold), those days contribute 0 to the numerator but still count in the denominator: balance_sum = 2,000 × 80 = 160,000; day_count = 90; ADB = 1,777.78 (full precision carried); gross = ADB × 0.05 × 90/360, floored only at the end.

## 12. Decisions summary

**Policy (from the stakeholder):** 360-day basis; ADB method (not daily compounding); half-open `[start, end)`; floor to 2 dp on the final total only; threshold of 1,000 on end-of-day balance with sub-threshold days counting in the denominator but not the numerator; rate may change mid-period, handled by per-segment ADB each with its own day-count divisor and its own `/360` scaling; `gross = ADB × annual_rate × days/360`; 15% unconditional withholding, recorded separately; net = gross − tax credited and persisted; duplicate/overlapping period rejected; negative balance is an invalid-state error; quarterly cadence on the opening anniversary derived by the caller; return exposes gross, tax, and net separately with net being "interest posted".

**Engineering defaults (policy silent):** end-of-day balance used for each day; full floating-point precision carried to the final floor; missing-day history treated as a data-integrity error (no zero-fill); tax computed on full-precision gross, floored to 2 dp, net = floor(gross) − floor(tax); `annual_rate` as a decimal fraction carried on the account or passed in; single (non-tiered) rate on the full balance per day; gap detection left to the caller (overlap still rejected).

**Out of scope:** calendar-quarter alignment, overdraft interest, tax exemptions or allowances, balance-tiered rates, and intra-period compounding — none are defined and none are implemented.

## Auditor verdict

_The spec strongly covers the core calculation and convention decisions (1, 3, 4, 5, 6, 7, 12, 13 correct) but fails the lifecycle decisions entirely (8 dormancy, 9 closure, 10 escheatment all absent) and misresolves compounding (2: it rejects daily intra-period compounding, opposite the reference). Decision 11 is only partially addressed (no-overdraft yes, negative-rate rejection and zero-balance no-op missing), and the output shape (14) omits the ADB-used and qualifying-days disclosure. Coverage: 8/14 correct. On the core in-focus six [1,2,3,8,9,10] it scores only 2/6, showing method coverage held up (1, 3) but compounding and the whole lifecycle path were missed._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §3: "Interest is computed by the average daily balance method. It is not day-by-day compounding... ADB = balance_sum / day_count; gross_interest = ADB × annual_rate × (day_count / 360)." | The spec sums daily balances, divides by days in the period, and applies the rate once to the average, explicitly distinguishing this from per-day daily-balance. Matches the reference exactly. |
| 2 | yes | no | §9: "There is no intra-period compounding; interest does not roll up day-by-day within a period." §3: "It is not day-by-day compounding within the period." | The reference requires interest to compound daily within the period. The spec explicitly rejects intra-period compounding, so it addresses the decision but resolves it oppositely. |
| 3 | yes | **yes** | §8: "The posting cadence is quarterly on the anniversary of account opening, not on calendar quarter-ends." | Matches the reference's quarterly-on-opening-anniversary value precisely, including the explicit exclusion of calendar quarter-ends. |
| 4 | yes | **yes** | §3: "The 360-day basis is fixed policy: the daily rate is annual_rate / 360... It is a flat 360-day divisor." | States 360-day basis with annual_rate/360 daily rate, exactly matching the reference and explicitly rejecting 365/Actual bases. |
| 5 | yes | **yes** | §4: "Interest accrues only on days whose end-of-day balance is at or above 1,000... The day contributes zero to the balance sum... The day still counts in the day-count denominator." | Threshold of 1,000, sub-threshold days contributing zero to numerator but still counting in the divisor — matches the reference's exact mechanics. |
| 6 | yes | **yes** | §6: "Rounding is floor (truncation) to 2 decimal places. Never half-up, never banker's rounding. The bank retains the sub-cent fraction." | Floor to 2 dp, never half-up, bank keeps the fraction — exact match to the reference. |
| 7 | yes | **yes** | §7: "A 15% withholding tax is deducted from the gross interest at posting... The tax amount is recorded and reported separately." §2.2 exposes tax_withheld and net_interest. | 15% withholding deducted from gross at each posting, net credited, tax reported separately — matches the reference. |
| 8 | no | no | absent | The spec contains no mention of dormancy, a 12-month inactivity trigger, continued accrual while dormant, or a monthly dormancy fee of 5. Entirely unaddressed. |
| 9 | no | no | absent | The spec addresses mid-period rate changes via segmentation but never addresses account closure between posting dates or pro-rata accrual to a closure date. Not surfaced. |
| 10 | no | no | absent | No mention of escheatment, a 5-year dormancy-to-state trigger, or remitting funds to the state. Entirely unaddressed. |
| 11 | yes | no | §10: "The account must never go negative... If a negative end-of-day balance is nonetheless encountered... it is an invalid state and must raise an error... No overdraft-interest rate is defined." | The spec covers no-overdraft/negative-balance-as-error but never states that a negative rate is rejected as invalid, nor that a zero balance records a zero no-op posting. The full reference value is not matched. |
| 12 | yes | **yes** | §8: "Period boundaries are half-open [start, end): the opening day of the period is included; the posting day is excluded from the period it closes and becomes day 1 of the next period." | Half-open [start, end) with the posting day excluded from the closing period and included in the next — exact match to the reference. |
| 13 | yes | **yes** | §5: "Each day uses the rate in force on that day... Partition [start, end) at each rate-change boundary into... segments... compute that segment's own ADB... gross_interest = Σ segment_interest." | Each day uses the rate in force on it, with per-segment ADB computed and summed — matches the reference's rate-segment method. |
| 14 | yes | no | §2.2 returns only gross_interest, tax_withheld, net_interest, and updated_balance; no average daily balance or qualifying-days field is exposed. | The reference requires per-posting disclosure of the ADB used and the number of qualifying days in addition to gross/tax/net/balance. Those two specific fields are absent, so the output shape does not match. |
