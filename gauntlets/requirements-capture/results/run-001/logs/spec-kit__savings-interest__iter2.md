# spec-kit — savings-interest — iteration 2

Model (author): claude-opus · Questions asked: 16 · Captured: 9/14 · Bespoke captured: 7/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the interactive question tool isn't available in this session, so I'll ask in plain text. Please answer each by number; anything you don't care about, say so and I'll note a default with its rationale.

These are the decisions that actually change the money. The brief left every one of them open, and none has a safe default I'd trust without your say-so.

**Round 1 — the core computation**

**Q1. Day-count convention (annual rate → daily rate).**
- (a) Actual/365 fixed: annual/365 every day, leap years earn a 366th day
- (b) Actual/360: annual/360, yields ~1.4% more than nominal
- (c) Actual/Actual: /365 in normal years, /366 in leap years
- (d) 30/360: every month is 30 days, year is 360

**Q2. Compounding within the period.**
- (a) Simple: sum each day's accrual on that day's balance, no interest-on-interest until posted
- (b) Daily compounding: each day's accrued interest joins the base the next day accrues on
- (c) Monthly compounding: accrued interest capitalises at each month boundary

**Q3. Rounding — mode and timing.**
- (a) Round once at posting: full precision through every day, round the total to the minor unit (e.g. 2dp) at posting
- (b) Round each day then sum: round every day's accrual to the minor unit, then add
- (c) Truncate at posting: full precision, then round the total down to the minor unit
- Also tell me the rounding *mode* if you have one (half-up, half-even/banker's, down) and the currency / number of minor-unit decimals.

**Q4. Zero or negative (overdrawn) balance days.**
- (a) No interest, floor at zero: days with balance ≤ 0 accrue nothing, interest is only ever credited
- (b) Charge debit interest at the same rate: negative balances reduce the posted amount
- (c) Separate overdraft rate: negative days accrue at a distinct debit rate you'd specify

Once I have these four I'll ask a short second round (period-boundary inclusivity, whether posted interest joins the principal and compounds next period, tax withholding, and tiered/banded rates).
A: Q1: (b) Actual/360. The daily rate is annual_rate / 360 every day, full stop.

Q2: (b) Daily compounding. Each day's accrued interest joins the base before the next day accrues.

Q3: (c) Truncate at posting — full precision carried through every day, then floor to the minor unit at the moment of posting. Rounding mode is floor (down), never half-up. The bank keeps the sub-unit fraction. Currency is 2 decimal places.

Q4: (a) No interest, floor at zero. Days where the balance is below the minimum threshold accrue nothing; the account never goes negative and there is no debit interest at this rate. Note there is also a minimum balance threshold relevant here, but I'll hold that for your next round if it falls under period-boundary or accrual-eligibility questions.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Those are clear. One flag from Q4: you mentioned a minimum balance threshold as the accrual gate, so I'll pin that down properly below rather than assume it's a simple zero-floor.

**Round 2 — accrual eligibility, boundaries, posting, and rate shape**

**Q5. Period boundaries and the daily balance.**
The period has a start and end. Which days accrue, and what balance represents a day?
- (a) Which days: every day from start to end **inclusive** (both endpoints), start-inclusive/end-exclusive, or something else?
- (b) What is "the balance" for a day: the end-of-day balance, the start-of-day balance, or is the supplied daily history already the definitive one-value-per-day figure I should use as-is?

**Q6. Minimum balance threshold — the accrual gate you flagged.** Three things:
- (a) What is the threshold, and is it a fixed policy constant, a per-account attribute, or a parameter to the function?
- (b) How does it gate: on days below the threshold the day earns **nothing** (all-or-nothing per day), or does the account earn only on the portion **above** the threshold?
- (c) Which figure is compared against the threshold — the customer's recorded daily balance, or the compounding base (recorded balance **plus** accrued-but-unposted interest)? And likewise, which figure does the daily rate apply to once a day qualifies?

**Q7. Posting mechanics.**
- (a) Updated balance = prior balance + the truncated interest posted (bank keeps the sub-unit fraction) — confirm.
- (b) Does `post_interest` **mutate** the passed account, or return a new value? And must it be **idempotent / guarded** against double-posting the same period?
- (c) Is interest posted once at the end of the period, or at intervals within it (e.g. monthly capitalisation events that are actual postings)?

**Q8. Tax.** Is any tax withheld at posting (e.g. withholding on interest), or is that out of scope for this engine?

**Q9. Rate shape.**
- (a) Is the annual rate a single flat rate for the whole account, or **tiered/banded** by balance?
- (b) Is the rate **constant across the whole period**, or can it change day to day within the period (so the history would need per-day rates)?

If any of these is out of scope, just say so and I'll record it as an explicit exclusion.
A: Q5.
(a) Periods are half-open: [start, end). The posting day is excluded from the period it closes and included in the next one.
(b) [default, not policy] — treat end-of-day balance as the definitive daily figure. If the supplied history already carries one value per calendar day, use it as-is.

Q6.
(a) The threshold is 1,000. It is a fixed policy constant, not a per-account attribute or a runtime parameter.
(b) All-or-nothing per day. A day where the balance is below 1,000 contributes zero interest. Importantly, that day still counts as a day in the divisor when computing the average daily balance — it is not skipped.
(c) The threshold comparison is made against the customer's recorded daily balance, not the compounding base. On days that qualify, the daily rate is applied to the compounding base (recorded balance plus accrued-but-unposted interest accumulated from prior days in the same period).

Q7.
(a) Confirmed. Updated balance = prior balance + net interest posted. Net interest is gross interest less 15% withholding (see Q8), then truncated to 2dp. The bank retains the sub-unit fraction.
(b) [default, not policy] — prefer returning a new value rather than mutating. An idempotency guard against double-posting the same period is strongly recommended but is not stated policy.
(c) Interest is posted once at the end of the quarterly period, on the anniversary of account opening. There are no intra-period capitalisation events.

Q8. In scope. 15% withholding tax is deducted from gross interest at each posting. The account is credited the net amount; the gross, tax withheld, and net are all reported separately.

Q9.
(a) [default, not policy] — a single flat rate for the whole account. No tiered or banded structure is defined.
(b) The rate can change mid-period. Each day uses the rate in force on that day; interest is computed per contiguous rate-segment and the segment totals are summed.

### Round 3
_Step reasoning:_ (live agent turn)

Q: Two of those answers surfaced a genuine contradiction I won't paper over, plus a couple of reconciliation points that change reported figures. A short third round and I'll have enough.

**Round 3 — reconciling the accrual method, rate segments, and tax reporting**

**Q10. Daily compounding vs average daily balance — these conflict, and I need to know which governs.**
Q2 and Q6(c) describe a day-by-day method: each qualifying day applies the daily rate to a compounding base (recorded balance + accrued-but-unposted interest), so the base grows daily. But Q6(b) refers to "the divisor when computing the **average daily balance**". Those are two different methods that produce different numbers. Which is it?
- (a) **Daily compounding governs.** There is no average-daily-balance calculation. Your Q6(b) remark just means a sub-threshold day contributes zero interest but is *not* removed from the timeline: the base carries forward unchanged and the next day still compounds. (This is what Q2 + Q6(c) describe.)
- (b) **Average daily balance governs.** Interest = f(average daily balance over the period), where the divisor is the full day count including sub-threshold days. If so, I need to discard the daily-compounding model from Q2 and you'll need to state the exact ADB formula.
- (c) Something hybrid — please describe.

**Q11. Rate segments and compounding continuity (from Q9b).**
When the rate changes mid-period, does the compounding base **carry continuously** across the segment boundary (the second segment starts from the base including interest accrued in the first), or is each segment computed **independently** and only the totals added at the end?
- (a) Continuous: one unbroken daily-compounding run, the only thing that changes day to day is which rate is plugged in. "Per-segment" is just bookkeeping.
- (b) Independent: each rate-segment computed on its own, no compounding across the boundary, then summed.

**Q12. Tax figure rounding and reconciliation.**
You want gross, tax withheld, and net reported separately, with net truncated to 2dp. To make the report reconcile:
- (a) Are **gross** and **tax withheld** also expressed to 2dp? If so, how is each rounded (truncate/floor like net, or standard rounding)?
- (b) Must the identity **gross − tax = net** hold exactly at 2dp? If truncation is applied independently to each, it can break by a cent. Tell me which figure is the residual (e.g. compute gross and net, and tax = gross − net), or that a one-cent reconciliation difference is acceptable.

**Q13. Return shape.** Confirm the "interest posted" that the function returns is the **net** (credited) amount, and that the full result exposes gross, tax withheld, net, and the updated balance as distinct fields.

That should close it. If Q10 is (a) as I suspect, I'll write the spec around daily compounding and record the average-daily-balance phrasing as a non-normative note.
A: Q10: (b). Average daily balance governs. Discard the daily-compounding-base model from Q2 and Q6(c) — those answers were wrong. The correct method: sum the customer's recorded daily balances across the period, divide by the total number of days in the period (sub-threshold days count in the denominator but contribute a zero balance), apply the rate to that single average once. 'Daily compounding' from Q2 refers to the compounding period between postings — posted interest joins principal for the next quarterly period — not to an intra-period day-by-day compounding base.

Q11: (b). Independent. Each rate-segment computes its own average daily balance (sum of balances within the segment divided by the total days in the full period, to preserve the correct weight), applies its segment rate over its segment days on a 360-day basis, and the segment results are summed. No compounding carries across the segment boundary.

Q12: (a) Gross is carried at full precision (no rounding). Tax withheld is floor(gross × 0.15, 2 dp). Net is floor(gross − unrounded_tax, 2 dp). (b) Exact reconciliation at 2 dp is not required. The net credited figure is authoritative; a one-cent difference between gross minus reported-tax and reported-net is acceptable. The bank's books balance on what was actually credited.

Q13: Confirmed. The credited amount is the net (gross less withholding, truncated to 2 dp). The result exposes as distinct fields: gross interest, tax withheld, net interest posted, average daily balance used, number of qualifying days, and updated account balance.

### Round 4
_Step reasoning:_ (live agent turn)

Q: That last pair of answers changed the whole method, and Q11 as literally stated is internally inconsistent in a way that doubles or halves the result. I want to resolve it with a concrete number rather than guess, then confirm two small boundary points, and I'll have everything.

**Q14. The one that decides the money — a worked example of multi-segment interest.**

Q11 says each segment's average daily balance is "sum of balances within the segment **divided by the total days in the full period**" and then the rate is applied "**over its segment days** on a 360-day basis." Dividing by the full-period day count *and* multiplying by segment days applies the day-weight twice, which under-counts unless there's only one segment. Consider:

- Period of 4 days, `[Jan 1, Jan 5)`, so N = 4.
- Recorded balance is 1,000 on all four days (all qualify).
- Two rate segments: Jan 1–2 at 3.6% annual, Jan 3–4 at 7.2% annual.

- **Reading A (day-weight applied once):** interest = Σ (daily balance × daily rate) = 2×(1000×0.036/360) + 2×(1000×0.072/360) = 0.20 + 0.40 = **0.60**. Equivalent to: segment ADB = segment-sum ÷ *segment* days, times segment days ÷ 360.
- **Reading B (your wording taken literally):** segment ADB = 2000 ÷ 4 = 500 each; interest = 500×0.036×2/360 + 500×0.072×2/360 = 0.10 + 0.20 = **0.30**.

Which total is correct for a period like this, 0.60 or 0.30? (If it's neither, give me the number and the arithmetic.)

**Q15. Threshold boundary.** A day qualifies when the recorded balance is **≥ 1,000** (so exactly 1,000 earns), and only balances **strictly below** 1,000 contribute zero — correct? Or is the cutoff strictly greater than 1,000?

**Q16. How are the rates supplied?** Where does the engine read the per-day rate from — an effective-dated rate schedule carried on the account (a list of `{from_date, annual_rate}` that the engine slices into segments over the period), a single rate passed as an argument, or some other source? This decides what the function reads to build the segments.
A: Q14: 0.60. Reading A is correct. The Q11 wording was wrong to say "divided by total days in the full period". The correct per-segment method is: segment ADB = sum of recorded daily balances within the segment ÷ segment day count; segment interest = segment_ADB × (segment_days / 360) × segment_annual_rate. Sum the segments. For your example: segment 1 ADB = 2000/2 = 1000, interest = 1000 × (2/360) × 0.036 = 0.20; segment 2 ADB = 2000/2 = 1000, interest = 1000 × (2/360) × 0.072 = 0.40; total = 0.60.

Q15: Correct. The qualifying condition is balance ≥ 1,000. A day with exactly 1,000 earns. A day strictly below 1,000 contributes zero to interest but still counts in the segment day count.

Q16: [default, not policy] — an effective-dated rate schedule carried on the account: a list of {from_date, annual_rate} entries. The engine slices that schedule over the period to build the segments.

### Round 5
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved to `spec.md` in the working directory.

## What I did

I treated the brief as deliberately underspecified and, rather than guessing, asked you to pin down every material policy decision across four rounds. That surfaced things a default would have got wrong, including two that reversed earlier answers:

- **The accrual method.** You initially described daily compounding; the correct method is **average daily balance** on an **Actual/360** basis, with compounding only between quarterly postings.
- **The multi-segment formula.** Q11 as first stated was internally inconsistent (it applied the day-weight twice). The worked example in Q14 settled it: per-segment ADB divided by *segment* days, giving 0.60 not 0.30 for the test case. That example is now pinned in the spec as FR-014 so any implementation can be checked against it.

Firm policy captured: the 1,000 minimum-balance gate (all-or-nothing per day, sub-threshold days still count in the denominator), floor rounding to the minor unit with the bank keeping the fraction, 15% withholding with gross/tax/net reported separately and net authoritative, half-open periods, and the return shape.

Six items where you deferred are recorded as `(assumption)` and kept visually distinct from stated policy, so an implementer knows exactly which lines are firm: end-of-day balance, return-new vs mutate, the idempotency guard, flat (non-banded) rate, the effective-dated rate schedule as rate source, and the two-decimal minor unit.

## Structure

`spec.md` carries a clarifications log of the decisions, acceptance scenarios and edge cases, 24 testable functional requirements, a normative computation model with the exact formulas, key entities, technology-agnostic success criteria, and explicit out-of-scope boundaries.

One thing worth a later look: you described the posting cadence as "quarterly, on the anniversary of account opening". Anniversary reads as annual; I've taken it as quarterly boundaries anchored to the opening date. The period is an input to the function, so it doesn't affect the computation, but you may want to tidy that wording when the period-generation logic is specified. It's noted in the spec.
A: Acknowledged. The specification is complete. On the anniversary note: your reading is correct — quarterly periods anchored to the account opening date, not annual. 'Anniversary' here means the recurring quarterly date (e.g. opened 15 March, periods close 15 June, 15 September, 15 December, 15 March), not a once-a-year event. The wording in the spec can be tightened when the period-generation logic is written.

## Produced specification

# Feature specification: savings interest engine

**Feature**: `post_interest(account, period)` — compute and post interest on a savings account
**Status**: ready for planning
**Created**: 2026-09-29
**Input**: an account carrying a daily balance history and an effective-dated rate schedule, plus a posting period

## Summary

The engine computes the interest a savings account earns over a posting period and posts it. Interest
is calculated by the **average daily balance** method on an **Actual/360** basis, split into
rate segments where the rate changes mid-period. A **minimum balance threshold** gates each day: days
below the threshold earn nothing but still count as days. Gross interest has **15% withholding tax**
deducted, and the **net** amount is credited to the account. All monetary outputs are floored to the
minor unit; the bank keeps the sub-unit fraction.

This document records the policy decisions that the brief left open. Each was confirmed by the product
stakeholder. Items marked *(assumption)* are reasonable defaults chosen where the stakeholder deferred,
and an implementer may revisit them; every other line is firm policy.

## Clarifications

### Session 2026-09-29

Confirmed policy (firm):

- **Accrual method**: average daily balance, not day-by-day compounding. Sum the qualifying daily
  balances, divide by the day count, apply the rate once per segment.
- **Day-count convention**: Actual/360. The daily rate is `annual_rate / 360`, every day, including in
  leap years.
- **Compounding**: only between postings. Posted (net) interest joins the principal and forms the
  opening balance for the next quarterly period. There is no intra-period day-by-day compounding.
- **Minimum balance threshold**: 1,000, a fixed policy constant (not a per-account attribute, not a
  runtime parameter). A day qualifies when its recorded balance is **>= 1,000**. A day strictly below
  1,000 contributes a zero balance to the interest sum but **still counts in the day count**.
- **Rate segments**: when the rate changes mid-period, each contiguous rate segment is computed
  independently on its own days and the segment results are summed. No compounding carries across a
  segment boundary.
- **Rounding**: gross interest is carried at full precision. Tax and net are floored (rounded down) to
  two decimal places at posting. Rounding mode is floor, never half-up. The bank retains the sub-unit
  fraction.
- **Withholding tax**: 15% of gross interest, deducted at each posting. Gross, tax withheld, and net are
  reported separately. Exact reconciliation at 2 dp is not required; the net credited figure is
  authoritative.
- **Negative balances**: cannot occur. There is no debit interest and no overdraft rate at this
  product. Days below the threshold (which includes any non-positive balance) simply contribute zero.
- **Posting cadence**: once at the end of a quarterly period, anchored to the account opening date. No
  intra-period capitalisation events.
- **Period boundaries**: half-open, `[start, end)`. The posting day is excluded from the period it
  closes and included in the next one.
- **Return shape**: the credited amount is the net interest. The result exposes gross interest, tax
  withheld, net interest posted, average daily balance used, number of qualifying days, and the updated
  account balance as distinct fields.

Defaults chosen where the stakeholder deferred *(assumption, revisitable)*:

- The definitive per-day figure is the **end-of-day balance**. If the supplied history already carries
  one value per calendar day, it is used as-is.
- `post_interest` **returns a new value** rather than mutating the passed account.
- An **idempotency guard** against double-posting the same period is recommended but is not stated
  policy.
- The rate is a **single flat rate** for the account at any given time (no tiered or banded structure).
  It may change over time via the schedule; it is not banded by balance.
- Rates are read from an **effective-dated rate schedule** carried on the account: a list of
  `{from_date, annual_rate}` entries, sliced over the period to build the segments.
- Currency uses **two decimal places** for its minor unit. The engine is currency-agnostic beyond that.

## User scenarios and testing

### Primary flow

As the interest posting process, at the close of a quarterly period I call `post_interest(account,
period)` so that the account is credited the correct net interest and the posting is reported in full
(gross, tax, net) for the customer statement and the bank's tax records.

### Acceptance scenarios

1. **Single rate, all days qualify.** Given a 90-day period where the balance is 10,000 every day and
   the rate is 3.6% throughout, when interest is posted, then gross = `10,000 × 90 / 360 × 0.036 =
   90.00`, tax withheld = `13.50`, net = `76.50`, and the updated balance = `10,076.50`.

2. **A day below the threshold.** Given a period where one day's balance is 900 and all other qualifying
   days are 2,000, when interest is posted, then the 900 day contributes zero to the interest sum but is
   still counted in the day count (it lowers the average daily balance without being removed from the
   denominator).

3. **Rate change mid-period.** Given the worked example in FR-014 (two segments), when interest is
   posted, then the segment results are summed to 0.60 with no compounding across the boundary.

4. **Exactly at the threshold.** Given a day with a balance of exactly 1,000, when interest is computed,
   then that day qualifies and its 1,000 is included in the interest sum.

5. **Sub-unit fraction.** Given a gross interest of `90.007`, when net is computed, then tax withheld =
   `floor(90.007 × 0.15) = 13.50`, net = `floor(90.007 − 13.50105) = 76.50`, and the fraction below the
   cent is retained by the bank, not credited.

### Edge cases

- **Empty period** (`start == end`, day count 0): gross, tax and net are all 0.00, the average daily
  balance reported is 0, qualifying days is 0, and the balance is unchanged. No division by zero occurs.
- **No qualifying days** (every day below 1,000): gross = 0.00, tax = 0.00, net = 0.00, balance
  unchanged.
- **Gross too small to yield a cent of net** (e.g. gross = 0.05): tax = `floor(0.0075) = 0.00`, net =
  `floor(0.0425) = 0.04`.
- **Missing balance for a day in the period**: this is an input error, not a zero. See FR-016.
- **Rate schedule does not cover every day in the period**: input error. See FR-017.

## Requirements

### Functional requirements

- **FR-001**: The engine MUST compute interest by the average daily balance method over the posting
  period, not by day-by-day compounding within the period.
- **FR-002**: The period MUST be treated as half-open, `[start, end)`. The day count `N` is the number
  of whole days from `start` up to but excluding `end`.
- **FR-003**: For each day in the period the engine MUST use the recorded end-of-day balance as that
  day's balance.
- **FR-004**: A day MUST be treated as qualifying when its recorded balance is greater than or equal to
  the minimum balance threshold of **1,000**. A day whose balance is strictly below 1,000 MUST
  contribute a balance of zero to the interest calculation.
- **FR-005**: A day below the threshold MUST still be counted in the day count. Sub-threshold days lower
  the average daily balance but are never removed from the denominator.
- **FR-006**: The minimum balance threshold MUST be a fixed policy constant of 1,000. It MUST NOT be a
  per-account attribute or a runtime parameter.
- **FR-007**: Interest MUST be computed on an Actual/360 basis. The effective daily rate is the annual
  rate divided by 360, applied to actual days, including in leap years.
- **FR-008**: Where the annual rate changes within the period, the engine MUST partition the period into
  maximal contiguous **rate segments**, compute each segment's interest independently on its own days,
  and sum the segment results.
- **FR-009**: For each segment, the segment interest MUST be
  `segment_ADB × (segment_days / 360) × segment_annual_rate`, where
  `segment_ADB = (sum of qualifying daily balances in the segment) / segment_days`. Equivalently,
  segment interest = `(sum of qualifying daily balances in the segment) × segment_annual_rate / 360`.
- **FR-010**: No compounding MUST carry across a segment boundary. Segments are independent.
- **FR-011**: Gross interest MUST be the sum of segment interests, carried at full precision with no
  intermediate rounding.
- **FR-012**: Tax withheld MUST be `floor(gross × 0.15, 2dp)` — 15% of gross, rounded down to two
  decimal places.
- **FR-013**: Net interest MUST be `floor(gross − (gross × 0.15), 2dp)`, i.e. gross less the unrounded
  15% withholding, rounded down to two decimal places. Net is the credited amount.
- **FR-014**: Worked example the engine MUST reproduce. Period `[Jan 1, Jan 5)` (`N = 4`), balance 1,000
  on all four days, segment A = Jan 1–2 at 3.6%, segment B = Jan 3–4 at 7.2%. Segment A: ADB = 1,000,
  interest = `1,000 × (2/360) × 0.036 = 0.20`. Segment B: ADB = 1,000, interest =
  `1,000 × (2/360) × 0.072 = 0.40`. Gross = `0.60`.
- **FR-015**: The updated account balance MUST be `prior_balance + net_interest`. The sub-unit fraction
  discarded by flooring MUST NOT be credited (the bank retains it).
- **FR-016**: If the balance history does not supply a balance for every day in `[start, end)`, the
  engine MUST raise an input error rather than assuming zero or carrying a balance forward.
- **FR-017**: If the rate schedule does not cover every day in `[start, end)`, the engine MUST raise an
  input error rather than defaulting the rate.
- **FR-018**: The function MUST return a result exposing, as distinct fields: gross interest, tax
  withheld, net interest posted, the average daily balance used, the number of qualifying days, and the
  updated account balance.
- **FR-019**: The reported average daily balance MUST be `(sum of qualifying daily balances over the
  whole period) / N`, and 0 when `N = 0`.
- **FR-020**: The reported number of qualifying days MUST be the count of days in the period whose
  recorded balance is greater than or equal to 1,000.
- **FR-021**: When `N = 0` or no day qualifies, the engine MUST return gross, tax and net of 0.00, an
  average daily balance of 0, zero qualifying days, and an unchanged balance, without error and without
  dividing by zero.
- **FR-022** *(assumption)*: `post_interest` SHOULD return a new account value rather than mutating the
  account passed in.
- **FR-023** *(assumption)*: The engine SHOULD guard against posting interest twice for the same period.
  Exact double-posting semantics are not stated policy and are left to design.
- **FR-024**: Posted net interest MUST become part of the principal for the next period. Compounding
  happens only between postings, at the quarterly boundary.

### Computation model (normative)

For a period `[start, end)` with day count `N = end − start`:

For each day `d`:

- `b_d` = recorded end-of-day balance.
- `r_d` = annual rate in force on `d` (from the schedule).
- qualifying: `q_d = 1` if `b_d >= 1000`, else `0`.
- contributing balance: `c_d = q_d × b_d`.

Partition the days into maximal contiguous segments of equal `r_d`. For a segment with day set `D_s`,
day count `n_s`, segment rate `r_s` and segment sum `S_s = Σ (c_d for d in D_s)`:

```
segment_ADB_s   = S_s / n_s
segment_interest_s = segment_ADB_s × (n_s / 360) × r_s
                   = S_s × r_s / 360
```

Then:

```
gross          = Σ segment_interest_s        (full precision)
tax_withheld   = floor(gross × 0.15, 2dp)
net_interest   = floor(gross − gross × 0.15, 2dp)
updated_balance= prior_balance + net_interest
reported_ADB   = (Σ c_d for all d in period) / N     (0 when N = 0)
qualifying_days= Σ q_d
```

where `floor(x, 2dp) = floor(x × 100) / 100`.

## Key entities

- **Account**: holds the current balance (principal), a daily balance history (one end-of-day balance
  per calendar day), an effective-dated rate schedule, and the account opening date (which anchors the
  quarterly posting boundaries).
- **Rate schedule**: an ordered list of `{from_date, annual_rate}` entries. The rate in force on a day
  is the entry with the latest `from_date` on or before that day. *(assumption: this is the rate source)*
- **Period**: a half-open date range `[start, end)` for which interest is being posted. Normally one
  quarter anchored to the opening date.
- **Posting result**: gross interest, tax withheld, net interest posted, average daily balance used,
  number of qualifying days, and updated account balance.

## Success criteria

- **SC-001**: For any single-rate period where every day qualifies, posted gross equals
  `(sum of daily balances) × annual_rate / 360` to full precision.
- **SC-002**: The multi-segment worked example in FR-014 produces a gross of exactly 0.60.
- **SC-003**: A day below 1,000 changes the result only by contributing zero to the interest sum while
  remaining in the day count; it is never dropped from the denominator.
- **SC-004**: The net credited amount never exceeds `gross × 0.85`, and any sub-cent fraction is
  retained by the bank rather than credited.
- **SC-005**: Empty and all-sub-threshold periods post 0.00 net, leave the balance unchanged, and never
  raise a division error.
- **SC-006**: Missing balances or uncovered rate days are surfaced as input errors, never silently
  defaulted.
- **SC-007**: Every posting reports gross, tax withheld, and net as separate figures suitable for the
  customer statement and the bank's tax records.

## Out of scope

- Debit interest, overdraft rates, and any handling of negative balances (they cannot occur on this
  product).
- Tiered or balance-banded interest rates.
- Intra-period capitalisation events (interest capitalises only at the quarterly posting).
- Selecting or generating the posting period. The period is supplied to the function.
- Tax treatment beyond flat 15% withholding (no allowances, exemptions, or gross-up).
- Currency conversion and multi-currency accounts.

## Assumptions

The `(assumption)` markers throughout this document flag defaults chosen where the stakeholder deferred:
end-of-day balance as the day figure, returning a new value rather than mutating, an idempotency guard
as a recommendation, a single flat (non-banded) rate, the effective-dated rate schedule as the rate
source, and a two-decimal minor unit. Each is a reasonable default an implementer may revisit; none is
stated policy. Every other requirement is confirmed policy.


## Auditor verdict

_The spec covers 9 of 14 decisions correctly (1, 3, 4, 5, 6, 7, 12, 13, 14). Decision 2 is surfaced but resolved oppositely (no intra-period compounding vs the reference's daily compounding). Decision 11 is partially addressed (zero balance and no-overdraft) but omits negative-rate rejection, so it fails strict matching. The three lifecycle decisions (8 dormancy, 9 closure, 10 escheatment) are entirely absent, the spec being scoped only to normal period posting. Coverage = 9/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Accrual method: average daily balance, not day-by-day compounding. Sum the qualifying daily balances, divide by the day count, apply the rate once per segment." (FR-001, FR-009) | The spec explicitly adopts the average daily balance method and contrasts it with per-day daily-balance compounding, matching the reference exactly. |
| 2 | yes | no | "Compounding: only between postings... There is no intra-period day-by-day compounding." (FR-024) | The reference requires interest to compound daily within the period; the spec explicitly denies any intra-period compounding and confines compounding to between postings, the opposite resolution. |
| 3 | yes | **yes** | "Posting cadence: once at the end of a quarterly period, anchored to the account opening date." (FR-024) | Quarterly posting anchored to account opening date matches the reference's anniversary-based quarterly posting, distinct from calendar quarter-ends. |
| 4 | yes | **yes** | "Day-count convention: Actual/360. The daily rate is annual_rate / 360..." (FR-007) | 360-day basis with daily rate = annual_rate/360 matches the reference exactly. |
| 5 | yes | **yes** | "A day qualifies when its recorded balance is >= 1,000. A day strictly below 1,000 contributes a zero balance to the interest sum but still counts in the day count." (FR-004, FR-005) | Threshold of 1,000 at-or-above, zero contribution below, and retention in the divisor all match the reference precisely. |
| 6 | yes | **yes** | "Rounding mode is floor, never half-up. The bank retains the sub-unit fraction." (FR-012, FR-013) | Floor rounding to 2 dp with the bank keeping the fraction matches the reference. |
| 7 | yes | **yes** | "Withholding tax: 15% of gross interest, deducted at each posting. Gross, tax withheld, and net are reported separately." (FR-012, FR-013) | 15% withholding at posting, net credited, tax reported separately, all match the reference. |
| 8 | no | no | absent | The spec never mentions dormancy, a dormancy trigger period, or a dormancy fee; the 12-month/fee-of-5 policy is entirely unaddressed. |
| 9 | no | no | absent | The spec covers only normal period posting; account closure mid-period and pro-rata accrual on closure are not addressed anywhere. |
| 10 | no | no | absent | There is no mention of escheatment, a 5-year dormant threshold, or remittance to the state. |
| 11 | yes | no | "Negative balances: cannot occur. There is no debit interest and no overdraft rate..." plus empty/all-sub-threshold edge cases posting 0.00 (FR-021) | The spec covers the zero-balance no-op and the no-overdraft/no-negative-balance rule, but never states that a negative rate is rejected as invalid, so the compound resolution is not fully matched. |
| 12 | yes | **yes** | "Period boundaries: half-open, [start, end). The posting day is excluded from the period it closes and included in the next one." (FR-002) | Half-open [start, end) boundaries with the posting day excluded then included next period match the reference exactly. |
| 13 | yes | **yes** | "Rate segments: when the rate changes mid-period, each contiguous rate segment is computed independently on its own days and the segment results are summed." (FR-008, FR-009) | Per-segment computation using the rate in force on each day, summed with no cross-boundary compounding, matches the reference. |
| 14 | yes | **yes** | "The result exposes gross interest, tax withheld, net interest posted, average daily balance used, number of qualifying days, and the updated account balance as distinct fields." (FR-018) | All six required output fields are enumerated exactly as in the reference, including the average daily balance and qualifying-days disclosure. |
