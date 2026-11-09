# superpowers — savings-interest — iteration 1

Model (author): claude-opus · Questions asked: 13 · Captured: 9/14 · Bespoke captured: 7/10

## Conversation

### Round 1
_Step reasoning:_ The brief fixes only the domain and interface; the material accrual policies (day-count, compounding, rounding, which daily balance, edge cases, posting mechanics) cannot be reliably inferred and must come from the stakeholder before any spec.

Q: What day-count convention should the calculation use, and how is the period defined at its boundaries? (e.g. actual/365 vs actual/360 vs 30/360, and whether the first and/or last day of the period are counted)
A: 360-day year: the daily rate is annual_rate / 360. Periods are half-open [start, end): the first day of the period is included; the posting day is excluded from the period it closes and becomes the first day of the next period.

Q: Should interest compound within the period or is it simple interest on each day's balance? If it compounds, at what frequency (daily, monthly) and does posted interest start earning interest immediately?
A: Daily compounding within the period: each day's accrued interest is added to the running base before the next day's calculation. Once interest is posted at the quarterly date it joins the account balance and immediately becomes the base for the following period.

Q: How should amounts be rounded: to what precision (e.g. whole cents), using which rounding mode (half-up, half-even/banker's, truncate), and at what point, per day or only on the final posted total?
A: Rounding is applied once, to the final posted gross total only — not per day. Mode is floor (truncate) to 2 decimal places; the bank retains the sub-cent fraction. Half-up is not used.

Q: Which daily balance figure should drive the accrual for each day, the opening balance, the closing balance, or something else, and how are days with multiple transactions treated?
A: Accrual is driven by the average daily balance: sum all daily balances over the period, divide by the number of days in the period, apply the rate to that average. [default, not policy] For days with multiple intraday transactions, use the end-of-day closing balance as that day's figure.

Q: How should non-standard balances be handled, for instance days where the balance is zero or negative, should negative balances accrue a (possibly different) debit rate or simply earn nothing?
A: Days where the balance is below 1,000 — including zero — contribute zero interest for that day, but the day still counts in the divisor when computing the average balance. Negative rates are rejected as invalid. The account never accrues a debit interest charge on low or zero balances.

Q: When and how is the interest posted to the account: on what date within or after the period, and does posting update the balance that any subsequent period would build on?
A: Interest is posted quarterly on the anniversary of account opening, not on calendar quarter-ends. At posting, the net amount (gross interest less 15% withholding tax, floored to 2 dp) is credited to the account balance; that updated balance is the base from which the next period accrues.

### Round 2
_Step reasoning:_ Two prior answers describe incompatible accrual methods (daily compounding vs average-daily-balance), and the rounding/tax sequencing and period-to-posting relationship remain materially ambiguous, so I must resolve these before specifying.

Q: There's a tension between two answers I need to reconcile: you described daily compounding within the period (each day's accrued interest added to the running base before the next day), but also said accrual is driven by the average daily balance (sum the daily balances, divide by the number of days, apply the rate to that single average). These are different computations — one compounds day to day, the other applies the rate once to an average and so doesn't compound within the period. Which governs the per-period accrual, and if it's the average-balance method, what does 'daily compounding' refer to (only the posting-to-posting roll-forward between periods)?
A: Average daily balance governs intra-period accrual: sum the daily closing balances over the period, divide by the number of days in the period, apply the rate once to that single average. That is the complete per-period calculation — the rate is not applied day by day. 'Daily compounding' refers only to inter-period roll-forward: when interest is posted at the quarterly date, the net credited amount joins the account balance and becomes the starting base for the next period. There is no intra-period compounding.

Q: On rounding: you said the gross total is floored to 2 dp once, and separately that the net (gross less 15% withholding) is floored to 2 dp. Is the floor applied twice (floor the gross, compute tax, then floor the net), or should I compute net from the unrounded gross and floor only once at the end? And is the 15% withholding tax computed on the floored gross or the raw gross?
A: Floor is applied twice. First, floor the raw computed gross to 2 dp — the bank retains the sub-cent fraction and that floored figure is the gross posted interest. Second, compute the 15% withholding on that floored gross, then floor the resulting tax amount to 2 dp. Net credited = floored gross − floored tax. [The two-floor sequence and the use of floored gross as the tax base are not explicitly in policy; this is the most natural banking interpretation of the stated rules.]

Q: Does the `period` passed to `post_interest` always correspond to exactly one posting interval (a single quarter on the opening anniversary), or can it span multiple quarters — in which case the function must post at each anniversary inside the period and compound each posted net into the base before continuing?
A: A single call must handle any span: for each posting anniversary that falls strictly inside the period, accrue using the average-daily-balance method over that segment, post the net (after withholding), credit it to the balance, and use the updated balance as the base for the next segment. Each anniversary triggers a discrete posting. The function does not assume the input period equals exactly one quarter. [default, not policy]

### Round 3
_Step reasoning:_ Core accrual, rounding, posting and multi-quarter policies are settled; the remaining material ambiguities are the return-value semantics across multiple postings and how the trailing sub-anniversary stub is treated, neither of which can be safely inferred.

Q: When a single call posts at one or more anniversaries, what exactly should the returned 'interest posted' value be: the sum of the net (after-withholding) amounts credited across all postings in the period, the sum of the gross floored amounts, or a per-posting breakdown? And should it report gross, net, or both?
A: Per the reporting shape (policy item 14), return a per-posting breakdown: each anniversary that triggers a posting within the period produces one record containing gross interest (floored), tax withheld (floored), net interest credited, average daily balance used, number of qualifying days in that segment, and the updated account balance after crediting. The function does not collapse these into a single aggregate figure; callers that want totals may sum across the returned records.

Q: For the span after the last anniversary up to the period's `end` (a tail with no further anniversary), is any interest accrued-but-unposted for that stub, and if so should the function return it separately and/or reflect it in the returned balance, or is that trailing accrual simply ignored until the next call reaches its anniversary?
A: The trailing stub after the last anniversary inside the period — from that anniversary up to `end` — is neither posted nor reflected in the returned balance. No anniversary has been reached so no posting is due; that accrual is simply deferred and will be picked up in a future call whose period contains the next anniversary. The returned balance is updated only by the net amounts actually credited at posting dates within the call's span. [default, not policy]

### Round 4
_Step reasoning:_ Two material policy points remain genuinely ambiguous — the numerator treatment of sub-1,000 days under the average method (currently self-contradictory) and anniversary-date resolution for month-end/leap openings — so I ask rather than invent.

Q: On the sub-1,000 rule inside the average-daily-balance method: a day below 1,000 is said to 'contribute zero interest' yet 'still counts in the divisor'. Under the average method there is no per-day interest, so I need the numerator treatment made explicit. When summing daily balances for the average, is a sub-1,000 day's balance entered as 0 in the numerator sum (while still counting as 1 in the divisor, thus dragging the average down), or is its actual balance included in the sum and the 'zero interest' effect achieved some other way? And is the 1,000 threshold strictly '< 1000 contributes zero, >= 1000 counts in full'?
A: A sub-1,000 day's actual balance is replaced with 0 in the numerator sum; it is not included. The day still counts as 1 in the divisor. This is the only interpretation consistent with the stated rule that such a day 'contributes zero interest': under the average-daily-balance method, zeroing the numerator contribution is the mechanism by which the effect is achieved. The threshold is strict: balance < 1,000 → 0 in numerator; balance >= 1,000 → actual closing balance in numerator.

Q: How is each quarterly anniversary date computed when the opening day has no exact counterpart in the target month, e.g. an account opened on the 31st (or 29/30 Feb)? Does the anniversary roll to the last day of the shorter month, roll forward into the next month, or follow another rule? This fixes both the posting dates and the per-segment day counts for multi-quarter spans.
A: Anniversary date computation for short-month edge cases is not in policy. [default, not policy] Use last-day-of-month clamping: if the opening day-of-month does not exist in the target month, the anniversary falls on the last calendar day of that month. For example, an account opened on 31 January has quarterly anniversaries on 30 April, 31 July, 31 October, 31 January. An account opened on 29 February has anniversaries on 29 May, 29 August, 29 November, and 28 February (or 29 in a leap year). The day count for each segment is determined by the actual calendar dates computed this way, consistent with the half-open [start, end) period rule.

### Round 5 (process signalled done)
_Step reasoning:_ Four rounds have pinned every material policy the brief omitted — day-count and half-open boundaries, average-daily-balance accrual (reconciled against the compounding wording), the sub-1,000 numerator treatment, double-floor rounding and the floored-gross tax base, 15% withholding, quarterly anniversary posting with last-day-of-month clamping, multi-quarter segmentation, the per-posting return shape, and the deferred trailing stub; nothing material remains to infer.

(no questions this round)

## Produced specification

# Specification — Savings Account Interest Engine (`post_interest`)

## 1. Purpose and scope

This document specifies the interest engine for the bank's savings accounts. It defines a single function, `post_interest(account, period)`, that computes the interest an account earns over a supplied period, posts it at each applicable posting date, updates the account balance, and returns a per-posting breakdown.

Every policy decision below is fixed by the stakeholder. Where a point was not covered by policy, it is resolved here with the chosen interpretation and flagged explicitly as a default rather than policy, so a reader can tell the two apart.

## 2. Interface

```
post_interest(account, period) -> list of posting records
```

- `account` carries, at minimum: the daily balance history over the period (an end-of-day closing balance for each calendar day), the account opening date (which fixes the posting anniversaries), the annual interest rate, and the current account balance that the period builds on.
- `period` is a half-open date interval `[start, end)`.
- The function returns a list of posting records (see section 9). It does not return a single aggregate figure; callers that want totals sum across the records themselves.
- The function mutates/returns the account's updated balance as the net amounts are credited (section 8). The returned balance reflects only amounts actually credited at posting dates inside the call's span.

## 3. Day-count convention and period boundaries

- The year is a fixed 360-day year. The daily rate is `annual_rate / 360`.
- Periods and segments are half-open, `[start, end)`. The first day of the period is included; the posting (anniversary) day is excluded from the period it closes and becomes the first day of the next period. No day is counted twice.
- The number of days in a segment, used as the divisor of the average and for any day counting, is the actual count of calendar days in that half-open segment, consistent with the dates computed in section 10.

## 4. Accrual method — average daily balance

The average-daily-balance method governs all intra-period accrual. For each segment:

1. Form the numerator by summing the daily closing balances over the segment, with the sub-threshold substitution of section 6 applied.
2. Divide the numerator by the number of days in the segment (the divisor of section 3) to obtain the average daily balance.
3. Apply the rate to that single average once. The rate is **not** applied day by day.

Accrued gross for a segment = average daily balance × daily rate × number of days in the segment. There is no intra-period compounding; the rate touches the balance exactly once per segment, through the average.

For any day with multiple intraday transactions, the figure used for that day is the **end-of-day closing balance**. (The choice of average-daily-balance accrual is policy; using the end-of-day closing balance for multi-transaction days was marked by the stakeholder as a default, not policy.)

## 5. Compounding

There is **no** compounding within a period. "Daily compounding" refers only to inter-period roll-forward: when interest is posted at a quarterly anniversary, the net credited amount joins the account balance and becomes the starting base from which the next segment accrues. Compounding therefore occurs posting to posting, never day to day.

## 6. Sub-1,000 balance rule

A strict threshold of 1,000 applies to the numerator of the average:

- A day whose closing balance is **below 1,000** (strictly `< 1000`), including zero and any negative balance, contributes **0** to the numerator sum. Its actual balance is not included.
- A day whose closing balance is **1,000 or more** (`>= 1000`) contributes its actual closing balance to the numerator sum.
- Either way, the day still counts as 1 in the divisor (the number of days in the segment).

Zeroing the numerator contribution is the mechanism by which a sub-threshold day "contributes zero interest" while still dragging the average down through the divisor. The account never accrues a debit interest charge on low, zero, or negative balances.

## 7. Rate validation

A negative annual rate is rejected as invalid. (No alternative debit rate exists; negative balances simply contribute zero per section 6.)

## 8. Rounding, withholding tax, and crediting

All rounding is **floor (truncate) to 2 decimal places**. Half-up is never used. The bank retains the sub-cent fraction. Rounding is applied per posting, in two floors, in this order:

1. **Floor the gross.** Floor the raw computed gross accrual for the segment to 2 dp. This floored figure is the gross posted interest.
2. **Floor the tax.** Compute the 15% withholding tax on the **floored gross**, then floor the resulting tax amount to 2 dp.
3. **Net credited** = floored gross − floored tax.

The net amount is credited to the account balance. That updated balance is the base from which the next segment accrues (section 5).

(The single-floor-on-final-gross and the 15% withholding rate are policy. The two-floor sequence and the use of the floored gross as the tax base were marked by the stakeholder as the most natural banking interpretation of the stated rules, not explicit policy.)

## 9. Posting schedule and multi-quarter spans

- Interest is posted **quarterly on the anniversary of the account opening date**, not on calendar quarter-ends.
- A single call must handle any span, not just one quarter. For **each posting anniversary that falls strictly inside the period** `[start, end)`:
 1. Accrue over the segment ending at that anniversary, using the average-daily-balance method (sections 3, 4, 6).
 2. Compute gross, tax, and net with the two-floor rule (section 8).
 3. Credit the net to the balance.
 4. Use the updated balance as the base for the next segment.
- Each anniversary triggers a discrete posting. The first segment runs from `start` (or the previous anniversary) up to the first qualifying anniversary; each subsequent segment runs from one anniversary to the next, all half-open. (That a single call spans multiple quarters is policy; the segment-by-segment roll-forward follows from sections 3-8.)

## 10. Anniversary date computation (short-month clamping)

Short-month edge cases were not in policy; the following is a default, not policy.

Quarterly anniversary dates use **last-day-of-month clamping**: if the opening day-of-month does not exist in the target month, the anniversary falls on the last calendar day of that month.

- An account opened on 31 January has anniversaries on 30 April, 31 July, 31 October, and 31 January.
- An account opened on 29 February has anniversaries on 29 May, 29 August, 29 November, and 28 February (29 February in a leap year).

The day count for each segment is determined by the actual calendar dates computed this way, consistent with the half-open `[start, end)` rule of section 3.

## 11. Return shape — per-posting breakdown

The function returns one record per anniversary that triggers a posting within the period. Each record contains:

- **gross interest** — the floored gross (section 8 step 1);
- **tax withheld** — the floored 15% withholding (section 8 step 2);
- **net interest credited** — floored gross − floored tax (section 8 step 3);
- **average daily balance used** — the average computed for that segment (section 4);
- **number of qualifying days in that segment** — the count of days contributing to the numerator, i.e. days with closing balance `>= 1000` (the divisor remains the total number of days in the segment, per section 3);
- **updated account balance** — the account balance after crediting that posting's net.

Records are not collapsed into a single aggregate. (This reporting shape is policy — reporting item 14.)

## 12. Trailing stub after the last anniversary

The trailing stub from the last anniversary inside the period up to `end`, where no further anniversary is reached, is **neither posted nor reflected in the returned balance**. No posting is due, so that accrual is simply deferred; it is picked up by a future call whose period contains the next anniversary. The returned balance is updated only by net amounts actually credited at posting dates within the call's span. (Marked by the stakeholder as a default, not policy.)

## 13. Worked ordering summary

For a call over `[start, end)`:

1. Validate the annual rate (reject if negative).
2. Enumerate the opening anniversaries that fall strictly inside `[start, end)`, using last-day-of-month clamping.
3. Partition the span into half-open segments at those anniversaries.
4. For each segment ending at an anniversary, in chronological order:
 a. Build the numerator (sub-1,000 days → 0; others → closing balance) and divide by the segment's day count to get the average daily balance.
 b. Gross = average × (annual_rate / 360) × segment day count; floor to 2 dp.
 c. Tax = 15% of floored gross; floor to 2 dp.
 d. Net = floored gross − floored tax; credit to balance.
 e. Emit the record of section 11 with the post-credit balance.
5. Leave any trailing stub after the last anniversary unposted (section 12).
6. Return the list of records.

## 14. Decisions explicitly flagged as defaults (not stakeholder policy)

- End-of-day closing balance for multi-transaction days (section 4).
- The two-floor sequence and use of floored gross as the tax base (section 8).
- Single call handling an arbitrary multi-quarter span via segment roll-forward (the handling rule itself was given; the stakeholder tagged it a default).
- Trailing-stub deferral (section 12).
- Last-day-of-month anniversary clamping (section 10).

## Auditor verdict

_The spec covers the day-count, threshold, rounding, withholding, posting cadence, period-boundary, edge-rate and output-shape decisions correctly (1,3,4,5,6,7,11,12,14). It fails the compounding decision outright: it explicitly denies daily intra-period compounding (#2) where the reference requires it. All three lifecycle decisions (dormancy #8, mid-period closure #9, escheatment #10) and mid-period rate changes (#13) are entirely absent. Of the core in-focus six [1,2,3,8,9,10], only 1 and 3 are correct (2/6), and all lifecycle items are missing, so method/lifecycle coverage did not generalise to this savings domain. Overall correct: 9/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Section 4: "The average-daily-balance method governs all intra-period accrual... Divide the numerator by the number of days in the segment... Apply the rate to that single average once. The rate is not applied day by day." | Spec adopts average daily balance (sum daily balances, divide by days, apply rate once) and explicitly rejects per-day application, exactly matching the reference. |
| 2 | yes | no | Section 5: "There is no compounding within a period. 'Daily compounding' refers only to inter-period roll-forward... Compounding therefore occurs posting to posting, never day to day." | Reference requires interest to compound daily within the period (each day's interest joins the next day's base). The spec directly denies any daily compounding, so the resolution contradicts the reference. |
| 3 | yes | **yes** | Section 9: "Interest is posted quarterly on the anniversary of the account opening date, not on calendar quarter-ends." | Quarterly posting on the opening anniversary rather than calendar quarter-ends matches the reference verbatim. |
| 4 | yes | **yes** | Section 3: "The year is a fixed 360-day year. The daily rate is annual_rate / 360." | 360-day basis with daily rate = annual_rate/360 matches the reference exactly. |
| 5 | yes | **yes** | Section 6: "A day whose closing balance is below 1,000 (strictly < 1000)... contributes 0... A day whose closing balance is 1,000 or more (>= 1000) contributes its actual closing balance... Either way, the day still counts as 1 in the divisor." | Threshold at 1,000 with >=1000 earning, sub-threshold days contributing zero but still counting in the divisor, matches the reference's at-or-above-1,000 rule and divisor treatment. |
| 6 | yes | **yes** | Section 8: "All rounding is floor (truncate) to 2 decimal places. Half-up is never used. The bank retains the sub-cent fraction." | Floor to 2 dp, never half-up, bank keeps the fraction, matches the reference precisely. |
| 7 | yes | **yes** | Section 8: "Compute the 15% withholding tax... Net credited = floored gross - floored tax"; Section 11: "tax withheld - the floored 15% withholding" reported separately. | 15% withholding deducted from gross at posting, net credited, and tax reported separately all match the reference. |
| 8 | no | no | absent | The spec never mentions dormancy, a 12-month inactivity trigger, continued accrual while dormant, or a monthly dormancy fee of 5. Entirely unaddressed. |
| 9 | no | no | absent | The spec never addresses account closure between posting dates or pro-rata accrual to a closure date; section 12 only defers an unposted trailing stub to a future call, which is a different case and does not cover closure. |
| 10 | no | no | absent | No mention of escheatment, a 5-year dormancy threshold, remitting funds to the state, or closing to zero. Entirely unaddressed. |
| 11 | yes | **yes** | Section 7: "A negative annual rate is rejected as invalid."; Section 6: "The account never accrues a debit interest charge on low, zero, or negative balances." | Spec rejects negative rates and handles zero/negative balances by contributing zero (a zero-balance period yields zero gross), matching the reference's reject/zero-no-op anchors, though it does not explicitly describe recording a zero posting or overdraft prevention. |
| 12 | yes | **yes** | Section 3: "Periods and segments are half-open, [start, end). The first day of the period is included; the posting (anniversary) day is excluded from the period it closes and becomes the first day of the next period." | Half-open [start, end) with the posting day excluded from the closing period and included in the next matches the reference exactly. |
| 13 | no | no | absent | The account carries a single annual rate and segments are defined solely by posting anniversaries; the spec never handles a mid-period rate change or per-rate-segment computation using the rate in force each day. |
| 14 | yes | **yes** | Section 11: returns "gross interest", "tax withheld", "net interest credited", "average daily balance used", "number of qualifying days in that segment", and "updated account balance". | All six reference disclosure fields (gross, tax withheld, net, average daily balance used, qualifying days, updated balance) are returned per posting, matching the reference shape. |
