# superpowers — savings-interest — iteration 2

Model (author): claude-opus · Questions asked: 17 · Captured: 10/14 · Bespoke captured: 7/10

## Conversation

### Round 1
_Step reasoning:_ This is a new subsystem (architectural), so I follow the brainstorming process: ask clarifying questions one at a time, starting with the most material omitted policy — the day-count and compounding basis that determines the core calculation.

Q: Before I design this, one thing I want to pin down: how does the institution want the interest computed from the daily balance history — specifically, what day-count convention applies (e.g. actual/365, actual/360, actual/actual) and does interest compound day-to-day within the period or accrue simply and post once at period end?
A: Day-count basis is actual/360: the daily rate is annual_rate / 360, and actual calendar days are counted. Interest compounds daily within the period — each day's accrued interest is added to the balance that seeds the next day's calculation, rather than simple accrual posting only at period end.

### Round 2
_Step reasoning:_ Day-count and compounding are settled; the next material policy a model cannot infer is per-day rounding precision and the rounding rule, so I ask that single question before moving on.

Q: Now the accrual mechanics: at what precision does each day's interest carry — is each day's accrued interest rounded to the cent (currency minor unit) before it seeds the next day's balance, or is full precision carried through the period and rounding applied only once when the final interest is posted? And which rounding rule (half-up, half-even/banker's, truncate) does the institution use?
A: Full precision is carried through the period; each day's accrued interest is not rounded to the cent before seeding the next day's balance. Rounding is applied once, at posting time. The rounding rule is truncate (floor) to the minor unit — the bank retains any sub-cent fraction. Half-up and banker's rounding are not used. [intermediate precision is default, not policy; posting rounding rule is policy]

### Round 3
_Step reasoning:_ Two policy decisions remain unresolved (period boundary/day-count and which daily balance figure seeds accrual) that cannot be inferred; asking the most material one now, one question at a time per the process.

Q: How is the period's day set defined and which balance seeds each day's accrual? Specifically: is the period a half-open interval [start, end) so the end date itself is not accrued, or are both endpoints counted; and for each accrued day does the calculation use that day's closing balance (end-of-day) from the history, the opening balance, or some other figure?
A: Periods are half-open [start, end): the posting date is excluded from the period it closes and is instead the first day of the next period. Each day's accrual uses that day's end-of-day (closing) balance from the history. [end-of-day balance convention is default, not policy]

### Round 4
_Step reasoning:_ Day-count, compounding, precision/rounding, and period-interval semantics are settled; negative/zero-balance treatment is the remaining material policy that cannot be reliably inferred, so I ask it before declaring requirements complete.

Q: One more policy point before I have enough to specify correctly: how does the institution treat days where the seeding balance is zero or negative (an overdrawn or empty account)? Specifically, on a negative-balance day does the account accrue negative interest at the same rate (reducing the period's posted interest, and potentially yielding a net negative posting), does it accrue nothing (floor the day's accrual at zero) so only positive-balance days contribute, or is a negative daily balance treated as an error the function should reject?
A: The account never goes negative, so a negative-balance day is not a scenario the function needs to handle. A zero-balance day contributes zero interest — the day's accrual is zero and that zero seeds the next day's calculation. If every day in the period carries a zero balance, the posting is a no-op: zero gross interest, zero tax, zero net, still recorded.

### Round 5
_Step reasoning:_ The stakeholder's round-4 answer introduced gross/tax/net as distinct quantities, revealing an un-captured tax-withholding policy that materially changes what is posted and returned; I must resolve it before specifying.

Q: Your last answer referred to "zero tax" and "zero net" alongside gross interest, which tells me the posting distinguishes gross interest from a net amount after tax. I hadn't captured any tax policy yet, so before I specify: does the institution withhold tax on the interest at posting time, and if so — what is the rate, is it applied to the whole period's gross interest as a single deduction (rather than accrued per day), which rounding rule and direction applies to the tax figure (truncate as with interest, or something else), and does `post_interest` post and return the gross interest, the net-of-tax interest, or both (with the balance credited by the net amount)?
A: Yes, the institution withholds tax at posting time. The rate is 15%, applied as a single deduction against the whole period's gross interest at the moment of posting — not accrued day by day. The rounding rule for the tax figure is not separately specified [default, not policy]; floor to the minor unit is a reasonable default consistent with the interest rounding rule. The function returns both: gross interest, tax withheld, and net interest posted. The balance is credited by the net amount (gross minus tax withheld), and the tax withheld is reported separately rather than posted to the account.

### Round 6
_Step reasoning:_ All material non-inferable policy points appear captured; per the brainstorming discipline I write back a consolidated understanding for the stakeholder to confirm or correct before treating it as the design brief.

Q: Before I treat this as the design brief and write the spec, here is my consolidated understanding of the interest policy — please confirm it's correct or tell me what's misstated or missing: (1) day-count is actual/360, daily rate = annual_rate/360, actual calendar days counted; (2) interest compounds daily, each day's accrued interest seeds the next day's balance; (3) full precision carried through the period, no per-day rounding, rounding applied once at posting by truncation (floor) to the minor unit, bank retains the sub-cent fraction; (4) the period is half-open [start, end) — the posting/end date is excluded and becomes day one of the next period; (5) each accrued day uses that day's end-of-day (closing) balance from the history; (6) balances are never negative, a zero-balance day accrues zero and seeds zero, and an all-zero period is a recorded no-op (zero gross, tax, net); (7) at posting, tax is withheld at 15% as a single deduction on the whole period's gross interest (not accrued daily), the tax figure floored to the minor unit, and post_interest returns gross interest, tax withheld, and net interest, credits the balance by the net amount, and reports tax separately without posting it to the account. Is that a complete and accurate statement of the policy?
A: Not accurate on point 2, and the statement is incomplete.

Point 2 is wrong. The institution uses average daily balance, not daily compounding within the period. The correct method: sum the end-of-day closing balances for every calendar day in the period, divide by the number of days in the period, and apply the rate once to that average. Interest does not compound day-to-day within the period — each day's accrued interest does not seed the next day's balance. The note in round 1 that described within-period compounding was a misstatement; the authoritative method is average daily balance.

This also changes how you should read point 3. 'Full precision carried through per-day seeding' no longer applies. Full precision still governs the average-balance computation and the single rate application, and floor rounding at posting stands. But the per-day seeding framing should be dropped.

Points 1, 4, 5, 6, and 7 are correct as stated.

The statement is also incomplete — there are policy items governing this function that you have not yet asked about. I will not enumerate them unprompted, but the brief as written does not cover the full policy.

### Round 7
_Step reasoning:_ The stakeholder corrected the core method to average daily balance and stated the policy is still incomplete, so I must resolve the new arithmetic ambiguity plus the remaining uncovered policy items before specifying.

Q: Now that the method is average daily balance, I need to pin down exactly how the rate is applied to that average. Is the posted gross interest computed as average_daily_balance × (annual_rate / 360) × number_of_days_in_period (so the actual/360 day-count from point 1 still scales the single rate application by the period length), or is it average_daily_balance × (annual_rate / 360) applied once with no multiplication by the day count, or average_daily_balance × annual_rate × (days_in_period / 360)? These give materially different figures, and I want the arithmetic unambiguous.
A: The canonical formula for a single rate is: gross = average_daily_balance × annual_rate × (days_in_period / 360). The actual/360 day-count does scale by period length — multiplying by days_in_period is correct and material. All three expressions you listed are algebraically equivalent; the third form you gave is preferred because it makes the day-count scaling explicit.

Q: For the average itself: is the divisor the count of actual calendar days in the half-open [start, end) period, and does that divisor match the day count used to scale the rate — i.e. are 'days used to average' and 'days used in the actual/360 factor' always the same number? And is the average carried at full precision (no rounding of the average or the sum) before the single rate application, consistent with the full-precision rule in point 3?
A: Yes: the divisor is the count of actual calendar days in the half-open [start, end) period, and that count is the same integer used as days_in_period in the rate formula — they are always identical. Full precision is carried through the sum, the divide, and the rate multiplication; neither the running sum, the average, nor the intermediate product is rounded before the single floor at posting. [intermediate precision is default, not policy; divisor equivalence follows from the formula]

Q: The daily balance history: is it guaranteed to supply a closing balance for every calendar day in the period, or can there be gaps (days with no recorded balance)? If gaps are possible, does the institution carry forward the last known closing balance, treat a missing day as zero, or reject the input as an error?
A: Not specified. [default, not policy]: carry the last known end-of-day closing balance forward to fill any gap day — a day with no recorded transaction takes the most recent preceding closing balance. Treating a gap as zero would systematically understate the average; rejecting gaps would be impractical for accounts with infrequent activity.

Q: On posting mechanics and idempotency: what does post_interest actually record and return as the 'posting', and how does the institution handle re-invocation for a period that has already been posted — is a second call rejected, does it re-post/duplicate, or is it a defined no-op? Also, is there any minimum-gross threshold below which no interest (and no tax) is posted?
A: Each posting records and returns: gross interest, tax withheld, net interest posted, the average daily balance used, the number of qualifying days, and the updated account balance; the balance is credited by net interest. Re-invocation for an already-posted period is not specified [default, not policy]: a second call should be rejected as a duplicate rather than re-posting or silently no-oping. There is no minimum-gross threshold for suppressing a posting: zero gross still produces a recorded no-op (zero gross, zero tax, zero net).

Q: You said the statement was incomplete and there are policy items I have not yet asked about. Beyond rate-application arithmetic, history gaps, and idempotency above, are the remaining uncovered items in any of these areas — the minor-unit/currency assumption (is a fixed currency and its minor unit given, or must the function derive it from the account?), the tax treatment when gross is zero or when tax floors to zero, or the ordering of tax deduction versus the floor-rounding of gross (is gross floored first then 15% taken, or is tax taken on unrounded gross then floored)? Please point me at whichever of these (or others) I still need to resolve.
A: Among your candidates: minor-unit and currency are not separately stated policy [default, not policy] — two decimal places is the established minor unit; treat currency as a given input parameter. Tax when gross is zero follows from prior answers: zero tax, recorded no-op. The ordering of gross rounding versus tax computation is not separately specified [default, not policy]: apply 15% to the unrounded gross to obtain a raw tax figure, then floor that figure independently to the minor unit. The remaining uncovered policy items that materially affect the function are: the minimum qualifying daily balance (which is why the return shape includes 'qualifying days' rather than simply 'days in period'), the posting schedule and what triggers each posting period, mid-period account closure, and rate changes mid-period. Dormancy and escheatment may also fall within your scope depending on how broadly you are specifying the account lifecycle.

### Round 8
_Step reasoning:_ The stakeholder explicitly confirmed the policy is still incomplete and named material uncovered items (minimum qualifying balance, posting schedule, mid-period closure, rate changes, possibly dormancy/escheatment); the brainstorming process forbids writing the spec until shared understanding is complete, so I resolve these before drafting.

Q: Minimum qualifying daily balance: what is the threshold, and how does it interact with the average? Specifically — is a day 'qualifying' only if its end-of-day closing balance meets or exceeds some minimum (and if so, what amount), and do non-qualifying days get excluded from BOTH the sum and the divisor (so the average is over qualifying days only), or do they still count in the divisor as zero-contribution days? This determines whether 'qualifying days' and 'days_in_period' can differ, and how the actual/360 scaling factor is computed.
A: The threshold is 1,000 (currency units). A day is qualifying only if its end-of-day closing balance is at or above 1,000. Non-qualifying days contribute zero to the balance sum but still count in the divisor — the divisor is always the total calendar days in the half-open [start, end) period, not just the qualifying days. Qualifying days and days_in_period can therefore differ. The days_in_period figure used in the actual/360 rate scaling is the same full-period divisor, not the qualifying-day count.

Q: Posting schedule and period trigger: what defines a posting period and what triggers post_interest for it — is it a fixed calendar cadence (e.g. monthly on a statement date, quarterly, anniversary), and are start/end supplied to the function by the caller or derived from the account? I want to know whether the function owns period boundaries or receives them.
A: Interest is posted quarterly, on the anniversary of the account opening date — not on calendar quarter-ends. Period boundaries are not specified [default, not policy]: treat them as supplied by the caller; the function does not own or derive period boundaries from the account.

Q: Rate changes mid-period: if the annual_rate changes during the [start, end) period, does the function apply a single rate to the whole-period average (and if so, which rate — the rate in effect at period start, at end, or a time-weighted blend), or must it segment the period at each rate-change date and compute average-daily-balance interest per segment? And is the rate passed as a single scalar or as a dated schedule?
A: The period must be segmented at each rate-change date. Each segment is treated independently: compute the average daily balance over the segment's days, apply that segment's rate using gross = average × rate × (segment_days / 360), then sum the segment grosses to produce the period gross. The rate should be passed as a dated schedule, not a single scalar.

Q: Mid-period account closure: if the account closes before the scheduled period end, does post_interest run on the partial [start, closure) interval with the same average-daily-balance method (divisor = actual days to closure), and does closure itself trigger a final posting? Also, is the closure date treated as half-open (excluded, like the normal end date) or is it accrued through?
A: Closure between posting dates triggers a final posting. The same average-daily-balance method applies over [start, closure_date) using the half-open convention — the closure date is excluded from accrual, consistent with the normal end-date treatment. The divisor is the actual calendar days in that partial interval. The customer does not forfeit the partial period; interest is posted net of withholding as part of closing.

Q: Dormancy and escheatment: are these in scope for post_interest? Specifically — does a dormant account stop accruing interest (and from what trigger), and does escheatment (remittance of an abandoned balance) alter what this function posts or returns? If they are out of scope for this function, please confirm so I can exclude them from the spec.
A: Dormancy does not stop interest accrual — interest continues to accrue on a dormant account under the same method. A monthly dormancy fee of 5 (currency units) is charged while the account is dormant; that fee is a separate charge and does not alter what post_interest computes or returns. Escheatment closes the account to a zero balance with funds remitted to the state; no further interest accrues or is posted after escheatment. Whether post_interest is responsible for applying dormancy fees or triggering escheatment is not specified [default, not policy] — treat those as separate lifecycle concerns outside this function's boundary.

### Round 9
_Step reasoning:_ The round 6 consolidation was corrected on a material point (average daily balance, not compounding) and flagged as incomplete; every flagged item is now resolved, so one final write-back confirmation of the corrected, complete policy is required before treating it as the design brief.

Q: Here is my consolidated, corrected understanding of the full policy — please confirm it is complete and accurate, or tell me what is misstated or still missing: (1) Day-count actual/360; daily scaling via days_in_period. (2) Method is average daily balance, NOT daily compounding: sum each calendar day's end-of-day closing balance over the period, divide by the divisor, apply the rate once per segment. (3) Rate applied as gross = average_daily_balance × annual_rate × (days_in_period / 360), preferring that explicit form. (4) Period is half-open [start, end); end/posting date excluded and becomes day one of the next period; the posting date is the account-opening anniversary, posted quarterly; boundaries are supplied by the caller, not derived. (5) Each day uses that day's end-of-day closing balance; history gaps are filled by carrying the last known closing balance forward. (6) Full precision carried through sum, divide, and rate multiplication; a single floor (truncate) to two decimal places applied only at posting; bank retains the sub-cent fraction. (7) Minimum qualifying daily balance is 1,000: a day qualifies only if its closing balance ≥ 1,000; non-qualifying days contribute zero to the sum but still count in the divisor (divisor is always total calendar days in the period); qualifying days and days_in_period may differ, and days_in_period (full period) is used for the actual/360 scaling. (8) Rate is a dated schedule; the period is segmented at each rate-change date, each segment computed independently by the average-daily-balance formula over its own days and rate, and segment grosses summed to the period gross. (9) Tax withheld at 15% as a single deduction on the whole period's gross (not accrued daily): apply 15% to unrounded gross, then floor the tax independently to the minor unit; balance credited by net (gross − tax); tax reported separately, not posted to the account. (10) Balances are never negative; a zero/sub-threshold day contributes zero; an all-zero (or all-non-qualifying) period is a recorded no-op (zero gross, tax, net). (11) post_interest records and returns gross, tax withheld, net, average daily balance used, qualifying-day count, and updated balance; there is no minimum-gross suppression threshold. (12) Re-invocation for an already-posted period is rejected as a duplicate. (13) Mid-period closure triggers a final posting over [start, closure) with the same method and half-open convention (divisor = actual days to closure). (14) Currency and its two-decimal minor unit are given inputs, not derived. (15) Out of scope for this function: applying dormancy fees, triggering escheatment; dormancy does not stop accrual, and no interest accrues after escheatment. Is that a complete and accurate statement, and are there any remaining policy items I still have not asked about?
A: Confirmed: complete and accurate. All fourteen policy items are correctly stated and nothing remains uncovered. Points 1 through 15 match the authoritative policy. No further questions are needed before writing the spec.

### Round 10 (process signalled done)
_Step reasoning:_ Stakeholder confirmed in round 9 that the consolidated 15-point policy statement is complete and accurate with nothing remaining uncovered, so requirements capture is finished and the process moves to writing the spec.

(no questions this round)

## Produced specification

# Interest engine specification: `post_interest(account, period)`

## 1. Purpose and scope

This specifies the interest engine for the institution's savings accounts. The function `post_interest(account, period)` computes the interest an account earns over a posting period from its daily balance history and an annual interest rate, withholds tax, posts the net interest to the account, and returns a record of the posting.

The function owns the interest computation and the posting mechanics. It does not own the account lifecycle. The following are explicitly out of scope for this function: applying dormancy fees, and triggering escheatment. These are separate lifecycle concerns. The function's behaviour in the presence of dormancy and escheatment is defined in section 12, but the function itself does not perform either.

## 2. Inputs

- **account**: the savings account, carrying at least a daily balance history (an end-of-day closing balance per calendar day) and its currency. The currency and its minor unit are given inputs on the account, not derived by the function; the minor unit is two decimal places.
- **period**: the posting period, supplied by the caller as a half-open interval `[start, end)`. The function does not own or derive period boundaries from the account; the caller supplies them.
- **annual_rate**: supplied as a dated schedule of rates (not a single scalar), so the rate in effect on any given day within the period is determined by the schedule. See section 8 on segmentation.

Business context on scheduling (informative, not enforced by this function): interest is posted quarterly, on the anniversary of the account opening date, not on calendar quarter-ends. Because boundaries are caller-supplied, the function computes over whatever `[start, end)` it is given.

## 3. Period definition and the day set

The period is the half-open interval `[start, end)`. The end date (the posting date) is excluded from the period it closes and becomes day one of the next period. The day set of the period is therefore every calendar day from `start` up to but not including `end`.

`days_in_period` is the count of actual calendar days in `[start, end)`. This same integer is used both as the divisor for the average (section 5) and as the day count in the actual/360 rate scaling (section 6). They are always identical.

## 4. Daily balance and history gaps

Each calendar day's figure is that day's end-of-day (closing) balance from the account's daily balance history.

The history is not guaranteed to supply a closing balance for every calendar day. Gaps are filled by carrying the last known end-of-day closing balance forward: a day with no recorded balance takes the most recent preceding closing balance. A gap day is never treated as zero and never causes rejection.

Balances are never negative; the function does not need to handle a negative-balance day. A zero-balance day is valid and contributes zero (see sections 5 and 7).

## 5. Method: average daily balance

Interest is computed by the average daily balance method. It does NOT compound day to day within the period; no day's accrued interest seeds the next day's balance.

For a given span of days:

1. Sum the qualifying-day closing balances across the span (see section 7 for qualification).
2. Divide that sum by the divisor, which is the total count of actual calendar days in the span (not the count of qualifying days).
3. Apply the rate once to that average (see section 6).

The running sum, the division, and the average are all carried at full precision. Neither the sum nor the average is rounded before the rate is applied.

## 6. Rate application (actual/360)

The day-count basis is actual/360. Gross interest for a span is:

```
gross = average_daily_balance × annual_rate × (days_in_span / 360)
```

This explicit form is the canonical one: the actual/360 day-count scales the single rate application by the span length, and multiplying by the day count is material and correct. The daily rate is `annual_rate / 360`, and the algebraically equivalent forms are acceptable, but this form is preferred because it makes the day-count scaling explicit.

The intermediate product is carried at full precision and is not rounded before posting.

## 7. Minimum qualifying daily balance

The minimum qualifying daily balance is 1,000 currency units. A day qualifies only if its end-of-day closing balance is at or above 1,000.

- A non-qualifying day (closing balance below 1,000, including a zero-balance day) contributes zero to the balance sum.
- A non-qualifying day still counts in the divisor. The divisor is always the total number of calendar days in the span, never just the qualifying-day count.

Consequently the qualifying-day count and `days_in_period` may differ. The `days_in_period` figure used in the actual/360 scaling is always the full-period (full-span) day count, not the qualifying-day count.

If every day in the period is non-qualifying (including the all-zero case), the average is zero, gross is zero, and the posting is a recorded no-op (see section 11).

## 8. Rate changes mid-period: segmentation

The annual rate is supplied as a dated schedule. If the rate changes during `[start, end)`, the period is segmented at each rate-change date. Each segment is computed independently:

1. Determine the segment's day span within `[start, end)`.
2. Compute the average daily balance over the segment's days, using the segment's own divisor (the segment's total calendar days) and the qualifying rule of section 7.
3. Apply that segment's rate: `segment_gross = segment_average × segment_rate × (segment_days / 360)`.

The period gross is the sum of the segment grosses. All segment computations are carried at full precision; no per-segment rounding is applied before the single posting round (section 9). When the rate does not change during the period, there is a single segment spanning the whole period.

## 9. Precision, rounding, and tax

- **Minor unit**: two decimal places.
- **Full precision** is carried through every intermediate computation: the balance sums, the divisions, the averages, the per-segment rate products, and the summation of segment grosses. No intermediate value is rounded.
- **Gross rounding**: a single floor (truncate) to the minor unit is applied to the period gross at posting time. The bank retains any sub-cent fraction. Half-up and banker's (half-even) rounding are not used.
- **Tax**: tax is withheld at 15%, as a single deduction against the whole period's gross, at the moment of posting. It is not accrued day by day. The 15% is applied to the unrounded gross to obtain a raw tax figure, and that tax figure is then floored (truncated) independently to the minor unit.
- **Net**: net interest = gross (floored) minus tax withheld (floored). The account balance is credited by the net amount. The tax withheld is reported separately and is NOT posted to the account.

Ordering note: gross rounding and tax computation are independent. Tax is computed as 15% of the unrounded gross and then floored on its own; the floored gross and the floored tax are each derived from the unrounded gross.

## 10. Zero and no-op behaviour

There is no minimum-gross suppression threshold. A period that yields zero gross still produces a recorded posting: zero gross, zero tax, zero net. An all-zero or all-non-qualifying period is such a recorded no-op. The posting is always recorded even when every amount is zero.

## 11. Return value and posting record

Each invocation records and returns:

- gross interest (floored to the minor unit),
- tax withheld (floored to the minor unit),
- net interest posted (gross minus tax),
- the average daily balance used,
- the number of qualifying days,
- the updated account balance (prior balance credited by net interest).

The balance is credited by net interest. Tax withheld is reported but not posted to the account.

## 12. Idempotency and re-invocation

Re-invocation for a period that has already been posted is rejected as a duplicate. A second call for an already-posted period does not re-post, does not duplicate, and does not silently no-op; it is rejected.

## 13. Mid-period account closure

If the account closes before the scheduled period end, closure triggers a final posting. The function runs over the partial interval `[start, closure_date)` using the same average daily balance method. The closure date is excluded from accrual, consistent with the normal half-open end-date treatment. The divisor is the actual calendar days in that partial interval. The customer does not forfeit the partial period: interest for `[start, closure_date)` is computed and posted net of withholding as part of closing.

## 14. Dormancy and escheatment (function boundary)

- **Dormancy** does not stop interest accrual. Interest continues to accrue on a dormant account under the same method. The monthly dormancy fee of 5 currency units is a separate charge; it does not alter what `post_interest` computes or returns, and applying it is outside this function's boundary.
- **Escheatment** closes the account to a zero balance with funds remitted to the state. No further interest accrues or is posted after escheatment. Triggering escheatment is outside this function's boundary.

## 15. Worked ordering summary

For a period `[start, end)` (or `[start, closure_date)` on closure):

1. Build the day set of the interval; fill history gaps by carrying the last known closing balance forward.
2. Segment the interval at each rate-change date from the dated schedule.
3. For each segment: sum qualifying-day closing balances (day qualifies when closing balance ≥ 1,000; non-qualifying days contribute zero but still count in the divisor), divide by the segment's total calendar days to get the segment average, then compute `segment_gross = segment_average × segment_rate × (segment_days / 360)`. Carry full precision throughout.
4. Sum segment grosses to the period gross.
5. Floor the period gross to two decimal places.
6. Compute tax as 15% of the unrounded period gross, then floor the tax to two decimal places.
7. Net = floored gross minus floored tax.
8. Credit the account balance by net; report tax separately (not posted).
9. Record and return gross, tax withheld, net, average daily balance used, qualifying-day count, and updated balance. Reject the call if this period was already posted.

## Auditor verdict

_The spec covers all 14 decision classes and matches the reference on 10 of 14 (coverage 10/14). Strong method/convention/output alignment (1,3,4,5,6,7,12,13,14) and correct closure handling (9). Four misses: #2 explicitly disables daily compounding (direct contradiction); #8 omits the 12-month dormancy trigger; #10 omits the 5-year escheatment threshold; #11 never states that a negative rate is rejected. #8 and #10 get the substantive lifecycle behaviour right but drop the specific numeric thresholds, so under strict literal matching they are not full matches._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §5: "Interest is computed by the average daily balance method... Sum the qualifying-day closing balances... Divide that sum by the divisor... Apply the rate once to that average." | Spec adopts average daily balance (sum/divide/apply-once), explicitly not per-day daily-balance, matching the reference exactly. |
| 2 | yes | no | §5: "It does NOT compound day to day within the period; no day's accrued interest seeds the next day's balance." | Reference requires daily compounding; the spec explicitly disables day-to-day compounding, a direct contradiction. |
| 3 | yes | **yes** | §2: "interest is posted quarterly, on the anniversary of the account opening date, not on calendar quarter-ends." | Spec states the exact posting cadence and anchor (quarterly, opening anniversary, not calendar quarter-ends), matching the reference even though framed as informative context. |
| 4 | yes | **yes** | §6: "The day-count basis is actual/360... The daily rate is annual_rate / 360." | Spec uses 360 as the days-in-year basis, matching the reference. |
| 5 | yes | **yes** | §7: "minimum qualifying daily balance is 1,000... A day qualifies only if its end-of-day closing balance is at or above 1,000... A non-qualifying day still counts in the divisor." | Threshold of 1,000 at-or-above, sub-threshold days contribute zero but remain in the divisor, matches the reference precisely. |
| 6 | yes | **yes** | §9: "a single floor (truncate) to the minor unit... The bank retains any sub-cent fraction. Half-up and banker's (half-even) rounding are not used." | Posted interest is floored to 2dp, never half-up, bank keeps the fraction, matching the reference. |
| 7 | yes | **yes** | §9: "tax is withheld at 15%... The account balance is credited by the net amount. The tax withheld is reported separately and is NOT posted to the account." | 15% withholding deducted from gross at posting, account credited net, tax reported separately, matches the reference. |
| 8 | yes | no | §14: "Dormancy does not stop interest accrual... The monthly dormancy fee of 5 currency units is a separate charge." | Spec correctly states interest continues to accrue and the fee is 5, but omits the 12-month no-transaction dormancy trigger; the full reference value is not stated. |
| 9 | yes | **yes** | §13: "over the partial interval [start, closure_date)... The customer does not forfeit the partial period: interest for [start, closure_date) is computed and posted net of withholding as part of closing." | Pro-rata accrual to closure date, posted net of withholding, no forfeiture, matches the reference exactly. |
| 10 | yes | no | §14: "Escheatment closes the account to a zero balance with funds remitted to the state. No further interest accrues or is posted after escheatment." | Spec gets the mechanics (zero balance, remit to state, no further interest) right but omits the 5-year dormant threshold that the reference specifies; not a full literal match. |
| 11 | yes | no | §4: "Balances are never negative"; §10: zero gross "still produces a recorded posting: zero gross, zero tax, zero net." | Spec covers the zero-balance no-op and never-negative balance, but says nothing about rejecting a negative rate as invalid, so the reference's rate-rejection clause is unaddressed. |
| 12 | yes | **yes** | §3: "The end date (the posting date) is excluded from the period it closes and becomes day one of the next period." | Half-open [start, end) with the posting day excluded from the closing period and included in the next, matches the reference. |
| 13 | yes | **yes** | §8: "If the rate changes during [start, end), the period is segmented at each rate-change date. Each segment is computed independently... The period gross is the sum of the segment grosses." | Per-day rate in force via segment-wise average-balance computation summed across segments, matching the reference. |
| 14 | yes | **yes** | §11: "gross interest... tax withheld... net interest posted... the average daily balance used... the number of qualifying days... the updated account balance." | All six reference output fields (gross, tax withheld, net, average daily balance, qualifying days, updated balance) are returned, matching the reference shape. |
