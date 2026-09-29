# bmad — savings-interest — iteration 2

Model (author): claude-opus · Questions asked: 19 · Captured: 9/14 · Bespoke captured: 6/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured question prompt didn't go through, so I'll put these to you in plain prose instead. Answer in whatever form suits you.

The brief fixes the domain and the interface and nothing else. Before I can specify `post_interest` so it computes a correct, unambiguous figure, I need your rulings on the policies below. Each has several plausible answers and only you can say which one this institution uses. I've grouped them and flagged what I'd expect as a common default, but please correct any of these.

**The four that most change the computed figure**

1. **Compounding.** Interest posts once at period end. Within the period, does it accrue *simple* (each day's interest = that day's balance × daily rate, summed), or *compound daily* (each day's rate applies to balance plus interest already accrued in the period)?

2. **Day-count convention.** How is the daily rate derived from the annual rate? Actual/365 fixed (÷365 always, even in leap years), actual/actual (÷366 in a leap year), or actual/360?

3. **Rounding.** Three sub-parts: (a) *method*, half-up or banker's (half-to-even) or truncate; (b) *when*, round each day's interest then sum, or carry full precision and round only the final total; (c) *precision*, I'm assuming the currency's minor unit (e.g. pennies/cents), confirm.

4. **Balance basis and period boundaries.** Which balance represents each day, opening or end-of-day? And are both endpoints counted, i.e. is the period inclusive of both start and end date, or half-open (start inclusive, end exclusive)?

**Four more that determine correctness at the edges**

5. **Negative balances.** If a daily balance is negative (overdrawn), does it accrue negative interest (a charge), or is the daily balance floored at zero so no interest for that day?

6. **Rate structure.** The brief says "an annual interest rate", singular. Is it genuinely a single flat rate for the whole balance, or are there tiers/thresholds (e.g. a different rate above a balance level) or a minimum balance to earn interest?

7. **Gaps or missing days in the balance history.** If the history doesn't cover every day of the period, what should happen? Carry the last known balance forward, treat missing days as zero, or reject the input as invalid?

8. **Posting semantics.** "Returns the interest posted and the updated balance." Does the posted interest simply add to the account's balance (updated balance = final balance + interest)? Is there a currency on the account I should track, and can a period post zero (or negative) interest, or is there a floor at zero?

Once you rule on these I'll write the spec. If any of them are "don't care, use the sensible default", tell me and I'll record the default explicitly as a decision rather than leave it implicit.
A: Rulings in order:

1. **Compounding.** Compound daily. Each day's accrued interest joins the running balance for the next day's calculation within the period. Not simple.

2. **Day-count convention.** Actual/360. The daily rate is annual_rate ÷ 360, always. No leap-year adjustment.

3. **Rounding.** (a) Truncate — floor to the minor unit; never half-up, never banker's rounding. The bank retains the fraction. (b) Carry full precision throughout the period; apply the floor only to the final posted figure. (c) Minor unit confirmed — two decimal places.

4. **Balance basis and period boundaries.** Periods are half-open: [start, end). The posting day is excluded from the period it closes and counted in the next. As for which balance represents a day — end-of-day [default, not policy]; the key does not prescribe this explicitly.

5. **Negative balances.** The account never goes negative, so this shouldn't arise in practice. If a daily balance were somehow zero, it contributes zero interest. There is also a minimum balance threshold (see question 6) — days below it contribute zero regardless.

6. **Rate structure.** Single flat rate, but with a minimum balance threshold of 1,000 (in account currency). Interest accrues only on days the balance is at or above 1,000. Days below that threshold contribute zero interest but still count as days in the divisor when computing the average daily balance.

7. **Gaps in balance history.** Carry the last known balance forward [default, not policy]. The key does not address this case.

8. **Posting semantics.** Net interest (gross minus 15% withholding tax) is credited to the account balance. Updated balance = closing balance + net interest. Gross interest, tax withheld, net interest, average daily balance, qualifying day count, and updated balance are all returned per posting. A period may post zero — that still records a zero posting entry. No floor concern: interest cannot be negative because the rate cannot be negative and balances do not go below zero.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Good, that pins most of it. Four of your rulings interact in ways the spec has to resolve unambiguously, and if I guess wrong the posted figure moves. Let me put these back to you before I write anything down.

**A. Daily compounding vs the average daily balance.** These sit in tension and I want to be sure I'm reading you right. You said compound daily (Q1), but you also return an *average daily balance* and describe a *divisor* for it (Q6, Q8). Two readings:

- *Reading 1:* Interest is genuinely daily-compounded. Each day's interest is computed on the running balance and added to an accrued total that itself earns interest the next day. The average daily balance is computed and returned as a **reported statistic only**, it does not drive the interest figure.
- *Reading 2:* The interest figure is actually derived from the average daily balance (gross ≈ ADB × rate/360 × qualifying days). That is a simple-interest-on-average model, which contradicts "compound daily".

I'll take **Reading 1** unless you say otherwise, but given how prominent the average daily balance is in your answers I don't want to assume silently.

**B. What the daily interest compounds on.** The account's daily balance history reflects deposits and withdrawals, not the interest we're about to post (it posts at period end). So to compound, I maintain an accrued-interest accumulator and each qualifying day compute interest on `daily_balance[d] + accrued_so_far`. Is that right, or should each day's interest be computed on the bare `daily_balance[d]` with no running accrual (which would in fact be simple accrual)?

**C. Where the £1,000 threshold is tested.** On the account's given daily balance for that day, or on the compounding base (given balance + accrued interest so far)? I'd use the given daily balance. Confirm.

**D. Truncation and tax ordering.** You said truncate to two places, applied only to the final posted figure, and that gross, tax and net are all returned. Withholding is 15%. I need the exact order, because it can shift net by a penny:

- *Option 1:* net = truncate(gross_fullprecision × 0.85). Then report gross = truncate(gross_fullprecision), tax = gross_reported − net.
- *Option 2:* gross_reported = truncate(gross_fullprecision); tax = truncate(gross_reported × 0.15); net = gross_reported − tax.
- *Option 3:* keep gross and tax at full precision, truncate only net = truncate(gross_fullprecision × 0.85); report gross and tax at full precision.

Which one? And to be explicit: is the only value that ever hits the account balance the **net** interest, and is that the single "final posted figure" the truncation applies to, or does truncation apply independently to each of gross, tax and net?

**E. "Closing balance".** For `updated balance = closing balance + net interest`, I read closing balance as the account balance carried into the posting day, i.e. the end-of-day balance of the last counted day (`end − 1`, since the period is `[start, end)`). Is that what you mean by closing balance?
A: A. Reading 2. I need to correct my earlier answer: 'compound daily' was wrong. Interest is derived from the average daily balance. ADB = sum of all daily balances across the period ÷ total days in the period. Gross interest = ADB × annual_rate × period_days ÷ 360. The rate is applied once to the average; there is no per-day accrual accumulator and no compounding within the period. The ADB is the figure that drives the calculation, not a side statistic.

B. Moot given A. Use the bare daily_balance[d] for each day. No accrued-interest accumulator exists, so there is nothing to compound on.

C. Confirmed. The 1,000 threshold is tested against the given daily account balance only. Nothing else.

D. Option 2: truncate gross to the minor unit first; then tax = truncate(gross_truncated × 0.15); then net = gross_truncated − tax. Net is the single value credited to the account. [The key does not prescribe ordering explicitly; Option 2 is the institutional standard I am confirming as policy.]

E. Confirmed. Closing balance is the end-of-day balance on the last day counted, i.e. period_end − 1 given the half-open [start, end) period. Updated balance = closing balance + net interest.

### Round 3
_Step reasoning:_ (live agent turn)

Q: That reframes the whole computation, thank you, average daily balance is the basis. One genuine contradiction has surfaced between this answer and your earlier one, and it's material for any account that ever dips below the threshold. I need you to resolve it rather than have me pick.

**The ADB numerator.** Just now (A) you defined `ADB = sum of all daily balances ÷ total days`. But earlier (Q6) you said days below the £1,000 threshold "contribute zero interest but still count as days in the divisor when computing the average daily balance", i.e. sub-threshold days are excluded from the numerator but kept in the divisor. Those two don't agree. Which holds?

- *Reading P (from Q6):* numerator = sum of daily balances **on qualifying days only** (days at/above 1,000); sub-threshold days add nothing to the numerator but still count in the divisor. Net effect: `gross = (Σ qualifying-day balances) × rate ÷ 360`. The threshold genuinely reduces interest.
- *Reading Q (from A):* numerator = sum of **all** daily balances, threshold ignored for the interest maths. In that case the threshold does nothing to the number and the "qualifying day" concept is only a reported count.

I lean to **Reading P**, since it's the only one under which the threshold rule actually bites, and Q6 was specific about it. Confirm which you want.

**Two confirmations that follow from it, so the formula is closed:**

1. In `gross = ADB × annual_rate × period_days ÷ 360`, `period_days` is the **total number of days in `[start, end)`** (the same total-days figure used as the ADB divisor), so the divisor and this multiplier cancel and gross reduces to `(numerator) × rate ÷ 360`. Correct?

2. The **total-days divisor** is every calendar day in `[start, end)` without exception, including sub-threshold days and any days whose balance was carried forward to fill a gap. And **qualifying day count** (a returned value) is the number of those days with balance ≥ 1,000. Correct?
A: Reading P holds. Sub-threshold days add nothing to the numerator but remain in the divisor. The Q6 ruling was precise and takes precedence over the shorthand in A.

1. Confirmed. ADB = qualifying_sum / total_days, and the formula multiplies by total_days / 360, so those cancel. Gross = (Σ qualifying-day balances) × annual_rate ÷ 360. That is the closed form.

2. Confirmed on both counts. The divisor is every calendar day in [start, end) without exception — sub-threshold days and gap-filled days included. Qualifying day count is the number of those days with balance ≥ 1,000.

### Round 4
_Step reasoning:_ (live agent turn)

Q: Reading P locked in. The computation is now closed. Before I write it up, three loose ends remain, two of which can actually break the function or change behaviour. Then I'll draft.

1. **Empty or zero-length period.** If `start == end`, `total_days` is 0 and `ADB = qualifying_sum ÷ total_days` is a division by zero. What's the policy: reject it as invalid input, or treat it as a valid zero posting (net 0, updated balance unchanged, ADB reported as 0 or n/a)? Same question for a period where you'd expect at least one day but the history is entirely empty.

2. **Rate.** The interface is `post_interest(account, period)` with no rate argument, so I'll treat the annual rate as a property carried on the account. And since the brief says "an annual interest rate" (singular), I'll treat it as a single constant rate across the whole period, no mid-period rate changes. Confirm both, or tell me the rate lives elsewhere / can change within a period.

3. **Re-posting and overlaps.** Should `post_interest` guard against posting the same period twice, or against periods that overlap a previously posted one (double-counting interest)? Or is that the caller's responsibility and out of scope for this function? Either answer is fine, I just need to know whether to specify a guard.
A: 1. **Empty period.** Reject as invalid input. `start == end` (or any case where `total_days` is zero) should be a hard error — a zero-length period is not a valid posting event. Same ruling for a period where the balance history is entirely absent: reject rather than post a silent zero. [default, not policy — the key does not address this case.]

2. **Rate.** I need to correct your assumption here. The rate can change mid-period. Each day uses the rate in force on that day. When the rate changes within the period, you split the period into rate-segments, compute `Σ qualifying-day balances × segment_rate ÷ 360` for each segment, then sum the results. The closed form `qualifying_sum × rate ÷ 360` only holds when the rate is constant across the whole period; the general form sums across segments. As for where the rate lives: the account carries the current rate; the rate history (effective-from dates and values) is what drives segmentation. [The key does not prescribe the exact data shape — treat that as interface design.]

3. **Re-posting and overlaps.** Caller's responsibility. The function does not guard against duplicate or overlapping postings. [default, not policy — the key does not address this.]

### Round 5
_Step reasoning:_ (live agent turn)

Q: It's done. The specification is saved at `spec.md`.

A brief note on what shaped it. The brief named only the domain and the interface, so I put every policy decision that changes the computed figure back to you rather than infer it. Along the way three of your own answers needed reconciling, and the spec follows the resolutions you gave:

- **Interest basis** flipped from "compound daily" to average-qualifying-daily-balance once you corrected it.
- **The ADB numerator** contradiction between "sum of all balances" and the threshold rule resolved to Reading P: qualifying days only in the numerator, all days in the divisor, so gross reduces to `Σ qualifying-day balances × rate ÷ 360`.
- **Mid-period rate changes** generalised the closed form to a per-qualifying-day sum, with the average daily balance kept as a rate-free reported metric.

The spec records the closed form and the general form, the Actual/360 convention, the 1,000 threshold, truncation with the gross-then-tax-then-net ordering, the half-open `[start, end)` boundary, and the net-credited-to-closing-balance posting rule. Two worked examples check the maths, including the rate-change case.

The decision register tags each ruling as **policy** (what you confirmed), **default** (reasonable choices the brief doesn't prescribe, which I flagged as you did: end-of-day balances, carry-forward for gaps, rejecting empty periods), or **interface design** (the rate-history data shape). Three items are left as open questions worth settling before build: what happens when the rate history starts after the period begins, the reporting precision of the average daily balance, and whether non-negative rate and balance should be enforced rather than assumed.
A: Received. The spec sounds well-grounded and the three open questions you've flagged are the right ones to resolve before build.

## Produced specification

# Interest posting engine — requirements specification

## Scope

This specifies the interest engine for savings accounts: how a single call to `post_interest(account, period)` computes the interest an account has earned over a period and posts it. It covers the computation, the rounding and tax treatment, the effect on the account balance, the values returned, and the input it will reject.

It does not cover how balances are recorded day to day, how the annual rate is set, statement generation, or the scheduling that decides when postings run. Guarding against duplicate or overlapping postings is out of scope by decision (see below): the caller owns that.

One sentence: given an account's daily balance history and its rate history over a half-open period, `post_interest` works out the interest earned on the average qualifying balance, withholds tax, credits the net to the account, and returns a posting record.

## Interface

```
post_interest(account, period) -> Posting
```

`account` carries at least a daily balance history, a rate history, a currency, and a current balance. `period` is a date range interpreted as half-open, `[start, end)`. The function returns a `Posting` record (fields below) and updates the account's balance by the net interest credited.

The rate is not passed as an argument. It is read from the account. The rate can change within a period, so the account holds a rate history, not a single value.

## Domain model

An **account** has a currency, a running balance, a daily balance history, and a rate history. Balances are expressed in the account's minor unit (two decimal places) and never go below zero.

A **daily balance** is the account's end-of-day balance for a given calendar day. The daily balance history supplies this for each day of the period. Where a day is missing from the history, the last known balance is carried forward to fill the gap.

A **rate history** records the annual interest rate in force from each effective date. The rate in force on a given day is the value whose effective date is the latest one on or before that day. The current rate on the account is the most recent entry.

A **period** is half-open, `[start, end)`. The start date is counted; the end date is not. The end date is the day the posting closes the period, and it belongs to the next period rather than this one. Days are whole calendar days.

A **qualifying day** is a day in the period whose daily balance is at or above the minimum balance threshold. Only qualifying days earn interest.

A **posting** is the result of one run: the net interest credited and the figures behind it.

## Policy constants

- Day-count denominator: **360**. The daily rate is always the annual rate divided by 360, with no leap-year adjustment (an Actual/360 convention).
- Minimum balance threshold: **1,000**, in the account's currency.
- Withholding tax rate: **15%** of gross interest.
- Monetary precision: **two decimal places** (the currency minor unit).
- Rounding: **truncation** toward zero (a floor, since all amounts are non-negative). Never half-up, never banker's rounding. The bank retains the truncated fraction.

## The computation

Let the period be `[start, end)`.

**1. Resolve the daily balances.** For every calendar day in `[start, end)`, take the end-of-day balance from the history, carrying the last known balance forward across any gap.

**2. Count the days.** `total_days` is the number of calendar days in `[start, end)`, which is `end - start`. Every day counts, including sub-threshold days and gap-filled days. There are no exceptions to the divisor.

**3. Identify qualifying days.** A day qualifies when its resolved daily balance is at or above 1,000. The threshold is tested against the account's daily balance for that day and nothing else. `qualifying_day_count` is the number of qualifying days.

**4. Compute the average daily balance.** The numerator is the sum of daily balances **on qualifying days only**. Sub-threshold days contribute nothing to the numerator but remain in the divisor.

```
qualifying_sum = Σ over qualifying days d of balance[d]
average_daily_balance = qualifying_sum / total_days
```

The average daily balance is a reported figure. It does not, on its own, drive the interest when the rate changes mid-period. It is computed rate-free.

**5. Compute gross interest.** Each qualifying day contributes its balance times the annual rate in force on that day, divided by 360. Sum these contributions at full precision:

```
gross_full = Σ over qualifying days d of ( balance[d] × rate_in_force(d) / 360 )
```

When the rate is constant across the whole period this collapses to the closed form `gross_full = qualifying_sum × rate / 360`, which equals `average_daily_balance × rate × total_days / 360`. When the rate changes, split the period into rate-segments and sum each segment's `Σ qualifying-day balances × segment_rate / 360`; the per-day sum above is the general statement of the same thing.

Carry full precision through the whole of steps 4 and 5. Do not round intermediate values.

**6. Truncate and tax.** Apply rounding only now, and in this order:

```
gross = truncate(gross_full, 2)
tax   = truncate(gross × 0.15, 2)
net   = gross − tax
```

Gross is truncated first. Tax is 15% of the truncated gross, itself truncated. Net is the exact difference of the two truncated figures, so `gross = net + tax` holds by construction.

**7. Post.** The net interest is the only value credited to the account. The closing balance is the end-of-day balance on the last day counted, `end - 1`.

```
updated_balance = closing_balance + net
```

The account's balance becomes `updated_balance`.

## Return value

`post_interest` returns a posting record with:

- `average_daily_balance` — from step 4.
- `qualifying_day_count` — from step 3.
- `gross_interest` — the truncated gross.
- `tax_withheld` — the truncated tax.
- `net_interest` — the value credited, also described as the interest posted.
- `updated_balance` — closing balance plus net interest.

A period may legitimately post zero, when no day qualifies. That is still a valid posting: `qualifying_sum` is 0, so gross, tax, and net are all 0, the balance is unchanged, and a zero posting record is returned.

## Preconditions and validation

The function rejects the following as hard errors rather than posting:

- A zero-length or empty period. If `total_days` is 0 (`start == end`, or `start > end`), reject. A zero-length period is not a valid posting event, and it would divide by zero.
- A period with no balance history at all. If the history supplies nothing to resolve a balance for the period, reject rather than post a silent zero.

Assumed to hold, and treated as errors if violated (see assumptions):

- A rate is in force for every day in `[start, end)`.
- Daily balances are non-negative.
- The annual rate is non-negative.

## Invariants

- Interest is never negative. Rates are non-negative and balances never fall below zero, so gross, tax, and net are all at least zero.
- `gross_interest = net_interest + tax_withheld` exactly.
- `net_interest ≤ gross_interest`.
- `updated_balance ≥ closing_balance`.
- Only qualifying days contribute to the numerator and to gross interest. Sub-threshold days and gap-filled days count in `total_days` but add nothing to interest.
- Every monetary figure returned is truncated to two decimal places; no figure is ever rounded up.

## Worked examples

**Constant rate.** Period `[2026-01-01, 2026-01-11)`, so `total_days = 10`. Five days at 2,000, three days at 1,500, two days at 500. The two 500 days are below the threshold. Annual rate 4% throughout.

```
qualifying_sum        = 5×2000 + 3×1500 = 14,500
average_daily_balance = 14,500 / 10      = 1,450.00
gross_full            = 14,500 × 0.04 / 360 = 1.61111…
gross                 = 1.61
tax                   = truncate(1.61 × 0.15) = truncate(0.2415) = 0.24
net                   = 1.61 − 0.24 = 1.37
```

With a closing balance of 2,000 on 2026-01-10, the updated balance is 2,001.37.

**Rate change mid-period.** Same period and `total_days = 10`. Balance is 2,000 every day, all qualifying. Rate is 4% for the first five days and 5% from 2026-01-06.

```
segment 1 (5 days @ 4%): 5×2000 × 0.04 / 360 = 400 / 360 = 1.11111…
segment 2 (5 days @ 5%): 5×2000 × 0.05 / 360 = 500 / 360 = 1.38888…
gross_full = 900 / 360 = 2.50
gross      = 2.50
tax        = truncate(2.50 × 0.15) = truncate(0.375) = 0.37
net        = 2.50 − 0.37 = 2.13
```

The average daily balance is reported as `20,000 / 10 = 2,000.00`, unchanged by the rate split, which is why it cannot by itself produce the gross figure here.

## Decision register

Each decision below records what was chosen and its standing: **policy** where the stakeholder confirmed an institutional rule, **default** where the stakeholder accepted a reasonable default that the underlying policy does not itself prescribe, and **interface design** where the data shape is left to implementation.

- Interest basis is the average qualifying daily balance, not daily compounding and not simple per-day accrual on the account balance. The rate is applied to balances over the period; there is no interest-on-interest. **Policy.**
- Day-count convention is Actual/360, no leap-year adjustment. **Policy.**
- Minimum balance threshold is 1,000 in account currency, tested against the account's daily balance for the day. Sub-threshold days earn nothing. **Policy.**
- The ADB numerator excludes sub-threshold days; the divisor includes them. Gross reduces to `Σ qualifying-day balances × rate / 360`. **Policy.**
- The rate can change within a period; each day uses the rate in force that day, and gross sums across rate-segments. **Policy.**
- Rounding is truncation toward zero to two decimal places, applied only to the final figures, with full precision carried throughout. **Policy.**
- Tax is 15% withholding, computed as: truncate gross, then tax = truncate(gross × 0.15), then net = gross − tax. Net is the only value credited. **Policy** (confirmed as the institutional standard; the ordering was not written in the original brief).
- Updated balance is the closing balance (end-of-day on `end - 1`) plus net interest. **Policy.**
- Zero-length or empty periods, and periods with no balance history, are rejected as hard errors. **Default.** The brief does not address this; rejecting avoids a silent zero and a division by zero.
- The daily balance representing a day is its end-of-day balance. **Default.** Not prescribed by the brief.
- Missing days in the balance history are filled by carrying the last known balance forward. **Default.** Not prescribed by the brief.
- The account carries the current rate and a rate history of effective dates and values; the rate history drives segmentation. The exact data shape is **interface design.**
- The function does not guard against duplicate or overlapping postings. The caller owns that. **Decision, out of scope.**

## Assumptions and open questions

These follow from the defaults above and would benefit from confirmation before build.

- A rate must be resolvable for every day in the period. The behaviour when the rate history begins after the period start, leaving early days with no in-force rate, is not settled. The current specification treats an unresolved rate as an error, by analogy with the empty-period rule. Confirm whether early days should instead carry the earliest known rate backward.
- The precision at which `average_daily_balance` is reported is not fixed. It is computed at full precision; whether it is returned at full precision or truncated to two places for display is open. This does not affect the interest, which never uses the reported ADB directly.
- Non-negative balances and a non-negative rate are assumed rather than enforced by the brief. If the engine could ever receive a negative rate or balance, the invariants above would need revisiting.


## Auditor verdict

_The spec covers 10 of 14 decisions correctly (coverage 10/14 = 0.71). It nails the conventions, threshold, rounding, tax, period boundary, rate-change handling, edge cases, and output shape (#4,5,6,7,11,12,13,14) and captures the average-daily-balance basis (#1). It fails the three lifecycle decisions entirely, which are absent (#8 dormancy, #9 closure, #10 escheatment), contradicts the compounding decision (#2: it forbids interest-on-interest where the reference requires daily compounding), and punts posting timing out of scope (#3). Of the core in-focus six [1,2,3,8,9,10], only #1 is correct: method partly survived but lifecycle coverage did not generalise to this savings domain._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Interest basis is the average qualifying daily balance, not daily compounding and not simple per-day accrual on the account balance"; step 4: "average_daily_balance = qualifying_sum / total_days". | The spec adopts average daily balance as the basis, applies the rate to the balances and reports ADB, matching the reference method (its per-day summation is arithmetically identical to applying the rate once to the average when uncompounded, and it explicitly rejects per-day accrual on the running balance). |
| 2 | yes | no | "not daily compounding"; "there is no interest-on-interest". | The spec directly addresses compounding but resolves it the opposite way: it forbids interest-on-interest, whereas the reference requires interest to compound daily. |
| 3 | no | no | "It does not cover ... the scheduling that decides when postings run." | The reference sets posting as quarterly on the account-opening anniversary; the spec explicitly places posting scheduling out of scope and gives no quarterly/anniversary resolution. |
| 4 | yes | **yes** | "Day-count denominator: 360. The daily rate is always the annual rate divided by 360, with no leap-year adjustment (an Actual/360 convention)." | The spec fixes the day-count basis at 360, matching the reference exactly. |
| 5 | yes | **yes** | "A qualifying day is a day ... at or above the minimum balance threshold. Only qualifying days earn interest"; "Sub-threshold days contribute nothing to the numerator but remain in the divisor." Threshold 1,000. | Threshold of 1,000 with at-or-above test, zero interest below it, and inclusion of sub-threshold days in the divisor all match the reference precisely. |
| 6 | yes | **yes** | "Rounding: truncation toward zero (a floor ...). Never half-up, never banker's rounding. The bank retains the truncated fraction." Precision two decimal places. | Floor/truncation to the minor unit (2 dp), never half-up, with the bank keeping the fraction, matches the reference exactly. |
| 7 | yes | **yes** | "Withholding tax rate: 15% of gross interest"; "tax = truncate(gross × 0.15)", "net = gross − tax", net credited; return includes "tax_withheld". | 15% withholding deducted from gross at posting, net credited to the account, and tax reported separately as tax_withheld all match the reference. |
| 8 | no | no | absent | Dormancy (12-month trigger, continued accrual, monthly fee of 5) is not mentioned anywhere in the spec. |
| 9 | no | no | absent | Account closure mid-period and pro-rata accrual to the closure date net of withholding are not addressed; the spec only handles generic periods, not closure as a lifecycle event. |
| 10 | no | no | absent | Escheatment after 5 years dormant (close to zero, remit funds, no further interest) is not mentioned in the spec. |
| 11 | yes | **yes** | "The annual rate is non-negative" ... "treated as errors if violated"; "A period may legitimately post zero ... a zero posting record is returned"; balances "never go below zero". | Negative rate treated as an error (rejected), whole-period zero balance posts a zero no-op record, and the account never goes negative all match the reference's edge-case resolutions. |
| 12 | yes | **yes** | "A period is half-open, [start, end). The start date is counted; the end date is not. The end date is the day the posting closes the period, and it belongs to the next period rather than this one." | Half-open [start, end) with the posting/end day excluded from the closing period and belonging to the next matches the reference exactly. |
| 13 | yes | **yes** | "The rate can change within a period; each day uses the rate in force that day, and gross sums across rate-segments." | Per-day rate-in-force with per-segment summation of the interest matches the reference's rate-change handling. |
| 14 | yes | **yes** | Return fields: average_daily_balance, qualifying_day_count, gross_interest, tax_withheld, net_interest, updated_balance. | All six reference output fields (gross, tax withheld, net posted, average daily balance used, qualifying-day count, updated balance) are present in the posting record. |
