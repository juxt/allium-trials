# spec-kit — savings-interest — iteration 1

Model (author): claude-opus · Questions asked: 13 · Captured: 8/14 · Bespoke captured: 5/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured question form didn't go through. Let me just ask you directly in plain text. These are the policy decisions I can't safely infer, and getting any of them wrong produces silently incorrect interest. I've grouped them and given my recommended default for each, but I need your call.

**The arithmetic**

1. **Day-count convention.** How does the annual rate become a daily rate? Options: actual/365 fixed (rate ÷ 365 every day, leap years pay an extra day); actual/actual (÷365 or ÷366 so a full year sums exactly to the annual rate); or actual/360. *My default: actual/365 fixed, the usual GBP retail convention.*

2. **Simple vs compound within a period.** Do you sum each day's interest and post it once at period end (simple accrual), or does each day's interest get added to the balance daily so later days earn on it (daily compounding)? If compounding, is the quoted annual rate nominal (÷ n) or the effective annual rate (AER, converted to a daily equivalent)? *My default: simple accrual, no intra-period compounding.*

3. **Rounding.** Precision, mode, and timing. To the penny (2 dp)? Half-up, banker's (half-to-even), or truncate? And is rounding applied per-day as it accrues, or only once on the period total? *My default: round half-up to 2 dp, applied once on the final total; accrue at full precision.*

4. **Period boundaries.** Which days accrue? Half-open [start, end) so consecutive periods don't double-count the boundary day; both ends inclusive; or (start, end]? *My default: inclusive start, exclusive end.*

**The edges**

5. **Negative daily balances.** Can a day's balance be negative in the history, and if so does it accrue negative interest (a charge), accrue zero, or should the function reject it as invalid?

6. **The rate itself.** A single flat annual rate for the whole period, or should the engine support tiered/banded rates or a rate that changes mid-period? *My default: single flat rate passed in, constant across the period.*

7. **What "post" means and returns.** Posting adds the interest to the balance and (I assume) records it as a transaction dated at the period end. Does posted interest become part of the balance that earns in the *next* period (yes, once posted)? And should `post_interest` be idempotent, i.e. refuse or no-op if interest was already posted for that period?

8. **Data and validity.** What does the daily balance history look like, and what should happen at the edges: missing days in the history (carry forward the last known balance, or error?), a period with zero or one day, an empty history, or a balance/rate that's zero? Any currency other than GBP, or is single-currency fine?

Answer as much or as little as you like; for anything you don't care about I'll take the default I've flagged and record it as an explicit assumption in the spec.
A: Answering each in order:

**1. Day-count convention.** actual/360. Daily rate = annual_rate ÷ 360, every day, no leap-year variation.

**2. Simple vs compound.** Daily compounding within the period: each day's interest is added to the running balance before the next day accrues on it. The quoted rate is a nominal annual rate; the daily rate is rate ÷ 360 applied to that day's compounding balance.

**3. Rounding.** Floor (truncate) to 2 dp at posting, never half-up. The bank keeps the sub-penny fraction. Accrue at full precision daily; round only once on the posted total.

**4. Period boundaries.** [start, end) half-open. The posting day is excluded from the period it closes and opens the next one. Consecutive periods do not double-count.

**5. Negative daily balances.** The account never goes negative by design. A negative balance in the history is invalid input; reject it. Note also: days where the balance is below 1,000 contribute zero interest but still count in the period-length divisor (they are not skipped).

**6. Rate changes mid-period.** Support them. Each day uses the rate in force on that day; compute interest per rate-segment and sum the segments.

**7. What post means and returns.** Posted interest is credited to the balance and does earn in the next period. For the return value, provide per posting: gross interest, tax withheld (15% withholding deducted before crediting), net interest posted, the average daily balance used, the number of qualifying days (days at or above the 1,000 minimum), and the updated balance. On idempotency: [default, not policy] — I would recommend refusing a second post for the same period rather than silently no-op'ing.

**8. Data and validity.** Missing days: [default, not policy] carry forward the last known balance. A period with zero balance the whole time: post zero, but still record the posting. Zero rate: posts zero. Negative rate: reject as invalid. Empty history or a single-day period: valid edge cases, handle gracefully (a one-day period posts normally). Single currency GBP: [default, not policy] fine for now.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Good, that pins down most of it. Your answers introduced a few things (the £1,000 threshold, 15% withholding, average daily balance, per-day compounding on top of a given balance history) that create interactions I need to close before the spec is unambiguous. Four last things, then I'll write it.

**A. Compounding base, and what the £1,000 test looks at.** The account already has a *daily balance history* (reflecting the customer's deposits and withdrawals), and interest also compounds daily. So on a given day, which balance accrues interest, and which is tested against the £1,000 threshold?
   - My reading: the day's interest accrues on *that day's balance from the history plus interest accrued earlier in this period*, and the £1,000 qualifying test is applied to that same compounding balance. Alternatively the test could look only at the raw history balance, ignoring accrued interest. Which?

**B. Order of operations for gross, tax and net.** So the three reported figures reconcile exactly, I propose: accrue daily at full precision to get gross; floor gross to 2 dp; tax = 15% × floored-gross, floored to 2 dp; net = gross − tax (already 2 dp); credited amount and balance update use net. That way gross − tax = net with no residual. Is that the order you want, or should tax be computed on the full-precision gross before flooring?

**C. Average daily balance, definition.** It's a reported figure. Is it the mean over *every* day in the period, or only over *qualifying* days (≥ £1,000)? And is it the mean of the raw history balances or of the compounding balances? My default: mean of the raw daily history balances over every day in the period.

**D. Where the rate schedule comes from.** For mid-period rate changes, is the schedule of rate-effective-dates part of the `account`, part of the `period`, or a separate input to `post_interest`? My default: it's supplied on the `account` (or alongside it), as a series of (effective-date, annual-rate) entries, and each day uses the latest entry in force.

That's everything. Answer these and I'll write the spec.
A: **A. Compounding base and £1,000 test.** Both use the raw history balance, not the compounding balance. The interest calculation is average daily balance: sum the raw daily history balances across the period, divide by the number of days in the period (including sub-threshold days in the divisor), apply the rate once to that average. The £1,000 qualifying test is applied to the raw history balance for each day. Accrued-but-unposted interest within the period does not fold back into the day's accrual base; that within-period compounding does not occur. Compounding means posted interest is credited to the balance and forms part of the raw history that the *next* period accrues on.

**B. Order of operations.** [default, not policy] Your proposed order is acceptable: accrue at full precision to produce gross; floor gross to 2 dp; tax = floor(15% × floored gross) to 2 dp; net = floored gross − floored tax. That gives exact reconciliation. Use that.

**C. Average daily balance definition.** Mean of the raw daily history balances over every day in the period — all days, including sub-threshold ones. That is the divisor and the numerator both count every day; the sub-threshold days contribute a zero to interest but their raw balance still enters the average. Your default matches.

**D. Rate schedule source.** [default, not policy] Your default is fine: a series of (effective-date, annual-rate) pairs supplied on or alongside the account; each day picks the latest entry whose effective-date is on or before that day.

### Round 3
_Step reasoning:_ (live agent turn)

Q: Before I write it, one reconciliation. Two of your statements are in surface tension and I want to resolve them the right way rather than guess, because they define the core formula.

You said sub-threshold days *contribute zero interest*, and separately that interest is *the average daily balance with the rate applied once*. Those diverge exactly when a day sits below £1,000, because a pure "average of all raw balances × rate" would let that sub-threshold balance contribute to interest, which you've said it must not.

Here's how I intend to resolve it. The operative interest rule is per-day, and the reported average is a separate figure:

- **Gross interest** = sum over each day in `[start, end)` of `qualifying_balance(day) × rate_in_force(day) / 360`, accrued at full precision, where `qualifying_balance(day)` is the raw history balance if it's ≥ £1,000 and zero otherwise. This makes sub-threshold days contribute nothing to interest, and handles mid-period rate changes naturally (each day picks its own rate, so segments just sum).
- **Reported average daily balance** = sum of *all* raw daily balances (including sub-threshold ones) ÷ number of days in the period. This is a reported figure, not the interest base.
- **Qualifying days** = count of days with balance ≥ £1,000.

Worked example, 3-day period, flat 3.6% annual (daily = 0.0001), balances £2,000 / £500 / £2,000:
- Gross = 2000×0.0001 + 0 + 2000×0.0001 = **£0.40** (the £500 day contributes nothing).
- Reported average daily balance = (2000+500+2000)/3 = **£1,500**.
- Qualifying days = **2**.

So the £1,500 average is shown to the customer but is *not* what's multiplied to get the £0.40. If instead you want the average itself (£1,500) multiplied by the rate, the £500 day would contribute and gross would be £0.45. I'm going with the £0.40 (per-day, sub-threshold zeroed) reading.

If that's right, say so and I'll write the spec. If you actually want the reported average to *be* the interest base, tell me and I'll flip it.
A: Your £0.40 reading is correct. The per-day sum with qualifying_balance zeroed on sub-threshold days is the right formula, and the reported average daily balance (£1,500 in your example) is a separate reported figure, not the interest multiplier. Write the spec on that basis.

### Round 4
_Step reasoning:_ (live agent turn)

Q: The specification is done. It's saved at `spec.md` in the working directory.

It captures every policy decision you made, and flags the four you offered as defaults (carry-forward for missing days, rate-schedule source, refuse-on-repost, single-currency GBP) as revisable assumptions rather than firm policy.

The parts worth double-checking, since they're where money goes wrong:

- **Interest formula.** Per-day sum of `qualifying_balance(day) × annual_rate/360` over `[start, end)`, sub-threshold days zeroed. No within-period compounding; compounding is the cross-period effect of crediting net interest. The reported average daily balance is a separate figure, not the multiplier, with the £0.40-vs-£1,500 worked example written in so nobody re-conflates them later.
- **Rounding and tax.** Floor to 2 dp, applied once: `gross_posted = floor(gross)`, `tax = floor(0.15 × gross_posted)`, `net = gross_posted − tax`, which reconciles exactly.
- **Return contract.** Gross, tax withheld, net, average daily balance, qualifying days, updated balance.

Two things I decided and marked as defaults rather than leaving open, so flag them if you disagree: a zero-length or reversed period is treated as invalid input, and an account with no determinable balance at the period start is rejected. Everything else traces directly to your answers.
A: Noted. The two defaults you marked (zero-length/reversed period as invalid, no determinable start balance as rejected) are reasonable; no objection. Spec accepted.

## Produced specification

# Requirements specification: savings interest engine

**Feature:** interest calculation and posting for savings accounts
**Interface:** `post_interest(account, period)`
**Status:** ready for planning
**Currency:** GBP (single currency)

## Overview

The interest engine computes the interest a savings account earns over a period from its daily
balance history and an annual interest rate, withholds tax, credits the net to the account, and
records the posting. The single entry point is `post_interest(account, period)`. It returns the
figures for the posting and the account's updated balance.

Interest is computed by a per-day method on the raw daily balances, annualised on an actual/360
basis. There is no compounding within a period. Compounding happens across periods: net interest
credited by one posting becomes part of the balance the next period accrues on.

Every policy decision below was fixed by the product stakeholder. Items marked *(default)* were
offered by the stakeholder as sensible defaults rather than firm policy, and are recorded as
assumptions in the [Assumptions](#assumptions) section. They can be revised without disturbing the
rest of the specification.

## Inputs

### `account`

Represents a single savings account and carries everything needed to value its interest.

- **Daily balance history.** A record from which the balance on any given day can be determined.
  It reflects the customer's own activity (deposits and withdrawals). It need not carry an entry
  for every day: the balance for a day is the most recent entry dated on or before that day
  (carry forward, *(default)*). The account must have a determinable balance as of the period
  start; if none exists the input is invalid.
- **Rate schedule.** A series of `(effective_date, annual_rate)` entries supplied on or alongside
  the account *(default)*. For any given day the applicable rate is the entry with the latest
  effective date on or before that day. A single flat rate is the degenerate case of a
  one-entry schedule.
- **Closing balance.** The balance the account holds at the period boundary, to which net interest
  is credited.
- **Posting record.** Enough history of prior postings to enforce idempotency (see FR-13).

### `period`

A half-open date range `[start, end)`: accrual runs from `start` up to but not including `end`.
`end` is the posting date. It is excluded from the period it closes and becomes the first day of
the next period, so consecutive periods never double-count the boundary day. `end` must be strictly
after `start`; a zero-length or reversed period is invalid input *(default)*.

## The interest model

### Day-count convention

The daily rate is the annual rate in force on that day divided by 360, with no leap-year variation.

```
daily_rate(day) = annual_rate_in_force(day) / 360
```

### Qualifying balance and the £1,000 threshold

A day earns interest only if its raw history balance is at or above £1,000. Days below the
threshold earn nothing but are not removed from the period; they still count toward the period
length and still enter the reported average daily balance.

```
qualifying_balance(day) = raw_balance(day)      if raw_balance(day) >= 1000
                        = 0                      otherwise
```

### Gross interest

Gross interest is the sum, across every day in the period, of that day's qualifying balance times
that day's daily rate. It accrues at full precision (no intermediate rounding). Because each day
takes the rate in force on that day, a mid-period rate change is handled without special cases: the
segments simply sum.

```
gross = sum over day in [start, end) of  qualifying_balance(day) * daily_rate(day)
```

There is no within-period compounding. A day's accrual base is its raw history balance, never the
raw balance plus interest accrued earlier in the same period. Compounding is a cross-period effect
only: net interest credited at posting joins the balance history the next period accrues on.

### Rounding, tax and net

Rounding is applied once, at posting, by flooring (truncating toward zero) to two decimal places.
The bank retains the sub-penny fraction. Tax is a flat 15% withholding taken before the interest is
credited. The order of operations is fixed so the three reported figures reconcile exactly:

```
gross_posted = floor_2dp(gross)
tax          = floor_2dp(0.15 * gross_posted)
net          = gross_posted - tax
```

`net` is already at two decimal places, so `gross_posted - tax = net` holds with no residual.

### Crediting and the updated balance

The net interest is credited to the account on the posting date and forms part of the balance the
next period accrues on.

```
updated_balance = closing_balance + net
```

## Return contract

`post_interest(account, period)` returns, for the posting:

| Field                   | Meaning                                                                      |
|-------------------------|------------------------------------------------------------------------------|
| `gross_interest`        | `gross_posted`, floored to 2 dp                                              |
| `tax_withheld`          | 15% withholding, floored to 2 dp                                            |
| `net_interest`          | Amount credited to the account (`gross_interest - tax_withheld`)            |
| `average_daily_balance` | Mean of the raw daily balances over every day in the period (see below)     |
| `qualifying_days`       | Count of days in the period with raw balance at or above £1,000            |
| `updated_balance`       | `closing_balance + net_interest`                                            |

### Average daily balance (reported figure)

The average daily balance is the mean of the raw daily history balances over every day in the
period, including sub-threshold days. It is a reported figure only. It is **not** the base the rate
is applied to.

```
average_daily_balance = (sum over day in [start, end) of raw_balance(day)) / number_of_days
```

Worked illustration. A three-day period at a flat 3.6% annual rate (daily rate 0.0001), with raw
balances £2,000, £500, £2,000:

- Gross interest = 2000 × 0.0001 + 0 (the £500 day is below threshold) + 2000 × 0.0001 = **£0.40**.
- Average daily balance = (2000 + 500 + 2000) / 3 = **£1,500**.
- Qualifying days = **2**.

The £1,500 average is reported to the customer but is not multiplied to obtain the £0.40. Applying
the rate to the average would let the sub-threshold £500 contribute and is not what happens.

## Functional requirements

Each requirement is testable.

- **FR-1.** The daily rate for a day is that day's annual rate in force divided by 360, with no
  leap-year adjustment.
- **FR-2.** A day accrues interest only if its raw balance is at or above £1,000; otherwise it
  accrues zero.
- **FR-3.** Gross interest is the sum over each day in `[start, end)` of `qualifying_balance(day) ×
  daily_rate(day)`, computed at full precision with no intermediate rounding.
- **FR-4.** The period is half-open `[start, end)`: the day `end` is excluded and no day is counted
  in two consecutive periods.
- **FR-5.** A day's applicable annual rate is the rate-schedule entry with the latest effective date
  on or before that day. Mid-period rate changes are supported by per-day rate selection.
- **FR-6.** There is no within-period compounding; each day's accrual base is its raw history
  balance, unaffected by interest accrued earlier in the same period.
- **FR-7.** Net interest credited by a posting becomes part of the balance the next period accrues
  on (cross-period compounding).
- **FR-8.** Gross interest is floored to two decimal places at posting. No half-up or banker's
  rounding is used.
- **FR-9.** Tax withheld is `floor_2dp(0.15 × gross_posted)`; net interest is `gross_posted −
  tax_withheld`; the three figures reconcile exactly.
- **FR-10.** The updated balance is the account's closing balance plus net interest.
- **FR-11.** The function returns gross interest, tax withheld, net interest, average daily balance,
  qualifying days, and the updated balance.
- **FR-12.** The average daily balance is the mean of raw daily balances over every day in the
  period, including sub-threshold days, and is not used as the interest base.
- **FR-13.** A second posting for a period that has already been posted is refused rather than
  silently ignored.
- **FR-14.** Qualifying days is the count of days in the period whose raw balance is at or above
  £1,000.

## Validation and edge cases

| Case                                | Behaviour                                                                                  |
|-------------------------------------|--------------------------------------------------------------------------------------------|
| Negative daily balance in history   | Invalid input. Reject. The account cannot go negative by design.                          |
| Negative annual rate                | Invalid input. Reject.                                                                     |
| Zero annual rate                    | Valid. Gross interest is zero; the posting is still recorded.                              |
| Balance zero for the whole period   | Valid. Gross, tax and net are zero; the posting is still recorded.                         |
| All days below £1,000               | Valid. Gross is zero; qualifying days is zero; the posting is still recorded.              |
| Missing days in history             | Carry forward the most recent balance dated on or before the day *(default)*.              |
| No determinable balance at start    | Invalid input. Reject.                                                                     |
| Empty history with a known balance  | Use that balance for every day in the period.                                             |
| Single-day period                   | Valid. One day in `[start, end)`; posts normally.                                          |
| Zero-length or reversed period      | Invalid input (`end` must be strictly after `start`) *(default)*.                          |
| Period already posted               | Refused (FR-13).                                                                           |
| Currency other than GBP             | Out of scope; single-currency GBP only *(default)*.                                        |

## Assumptions

These were confirmed by the stakeholder as defaults rather than firm policy and can be revised
without reworking the model.

- Missing days in the balance history carry forward the last known balance.
- The rate schedule is a series of `(effective_date, annual_rate)` entries supplied on or alongside
  the account; each day uses the latest entry in force.
- A second posting for an already-posted period is refused rather than being a silent no-op.
- A zero-length or reversed period (`end` not strictly after `start`) is invalid input.
- The engine is single-currency GBP.

## Success criteria

- **SC-1.** For any period, `gross_interest − tax_withheld` equals `net_interest` exactly, with no
  sub-penny residual.
- **SC-2.** Given the worked illustration (balances £2,000, £500, £2,000; flat 3.6% annual), the
  engine returns gross £0.40, average daily balance £1,500 and qualifying days 2.
- **SC-3.** A day whose balance falls below £1,000 contributes zero to interest while still counting
  toward both the period length and the reported average daily balance.
- **SC-4.** Splitting one period at a rate-change date and posting the two sub-periods yields the
  same total gross interest as posting the whole period against the rate schedule (segment
  additivity).
- **SC-5.** Posting the same period twice is refused; the account is credited once.
- **SC-6.** Net interest credited by one posting is included in the balance the next period accrues
  on.
- **SC-7.** Invalid inputs (negative balance, negative rate, no determinable opening balance,
  zero-length period) are rejected rather than producing a posting.

## Out of scope

- Currencies other than GBP.
- Tax treatments other than a flat 15% withholding (allowances, account-type variations, reclaims).
- Statement rendering, notification, or downstream ledger integration beyond recording the posting.
- Reversal or correction of a posting once made.
- Tiered or banded rates within a single day (the rate schedule varies by date, not by balance band).


## Auditor verdict

_The spec is strong on conventions, thresholds, rounding, tax, edge cases, period boundary, rate changes and output shape (decisions 4, 5, 6, 7, 11, 12, 13, 14 correct). It fails the two core method decisions: it uses per-day daily-balance accrual with no within-period compounding, the opposite of the reference's average-daily-balance method (1) and daily compounding (2). It entirely omits the lifecycle decisions: posting cadence/anniversary (3), dormancy (8), mid-period closure (9) and escheatment (10) are absent. Correct: 4, 5, 6, 7, 11, 12, 13, 14 = 8/14. The in-focus method/lifecycle subset [1,2,3,8,9,10] scores 0/6._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | no | "Interest is computed by a per-day method on the raw daily balances... Gross interest is the sum, across every day in the period, of that day's qualifying balance times that day's daily rate" (The interest model / Gross interest); FR-12: average daily balance "is not used as the interest base" | The reference requires average daily balance as the interest calculation method (apply rate once to the average). The spec explicitly uses per-day daily-balance accrual and states the average is a reported figure only, not the base. This is the opposite method, so incorrect. |
| 2 | yes | no | "There is no compounding within a period" and FR-6: "There is no within-period compounding; each day's accrual base is its raw history balance, unaffected by interest accrued earlier in the same period." | The reference requires daily compounding within the period. The spec explicitly denies any within-period compounding, so it does not match. |
| 3 | no | no | absent | The spec takes the posting period as an externally supplied `[start, end)` and never states the posting cadence (quarterly) or that posting falls on the account-opening anniversary. The posting frequency decision is not addressed. |
| 4 | yes | **yes** | "The daily rate is the annual rate in force on that day divided by 360, with no leap-year variation"; FR-1: "divided by 360" | Reference requires 360 days-in-year basis with daily rate = annual/360. The spec states exactly this. |
| 5 | yes | **yes** | "A day earns interest only if its raw history balance is at or above £1,000. Days below the threshold earn nothing but are not removed from the period; they still count toward the period length and still enter the reported average daily balance." | Reference sets the threshold at 1,000, with sub-threshold days contributing zero interest but still counting as days in the divisor. The spec matches this exactly, including the divisor treatment. |
| 6 | yes | **yes** | "Rounding is applied once, at posting, by flooring (truncating toward zero) to two decimal places. The bank retains the sub-penny fraction."; FR-8 | Reference requires floor rounding to 2dp with the bank keeping the fraction, never half-up. The spec states floor to 2dp, bank retains fraction, no half-up. Matches. |
| 7 | yes | **yes** | "Tax is a flat 15% withholding taken before the interest is credited"; return contract reports `gross_interest`, `tax_withheld`, `net_interest` separately | Reference requires 15% withholding deducted at posting, account credited net, tax reported separately. The spec applies 15% withholding, credits net, and reports gross/tax/net separately. Matches. |
| 8 | no | no | absent | Dormancy (12 months of inactivity, dormant accounts still accrue interest, monthly dormancy fee of 5) is nowhere addressed in the spec. Not surfaced. |
| 9 | no | no | absent | Closure mid-period with pro-rata accrual to the closure date is not addressed. The spec explicitly lists "Reversal or correction of a posting once made" as out of scope but says nothing about mid-period closure and pro-rata posting. Not surfaced. |
| 10 | no | no | absent | Escheatment (5 years dormant, balance remitted to the state, account closed to zero) is not mentioned anywhere. Not surfaced. |
| 11 | yes | **yes** | "Negative annual rate \| Invalid input. Reject."; "Balance zero for the whole period \| Valid. Gross, tax and net are zero; the posting is still recorded."; "Negative daily balance in history \| Invalid input. Reject. The account cannot go negative by design." | Reference: negative rate rejected, zero balance posts zero as a recorded no-op, account never goes negative. The spec covers all three: negative rate rejected, zero-balance whole period valid with zero and still recorded, negative balance rejected / no overdraft. Matches. |
| 12 | yes | **yes** | "A half-open date range `[start, end)`... `end` is the posting date. It is excluded from the period it closes and becomes the first day of the next period"; FR-4 | Reference requires the posting day excluded from the period it closes and included in the next, periods half-open [start, end). The spec states this exactly. |
| 13 | yes | **yes** | "because each day takes the rate in force on that day, a mid-period rate change is handled without special cases: the segments simply sum"; FR-5; SC-4 (segment additivity) | Reference requires each day to use the rate in force on that day, computed per rate-segment and summed. The spec uses per-day rate selection with segment additivity. Matches the mid-period rate-change resolution. |
| 14 | yes | **yes** | Return contract table: `gross_interest`, `tax_withheld`, `net_interest`, `average_daily_balance`, `qualifying_days`, `updated_balance`; FR-11 | Reference requires per posting: gross, tax withheld, net posted, average daily balance used, number of qualifying days, updated balance. The spec's return contract lists all six fields, including average daily balance and qualifying days. Matches. |
