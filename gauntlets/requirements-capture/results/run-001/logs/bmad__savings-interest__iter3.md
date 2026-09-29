# bmad — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 13 · Captured: 7/14 · Bespoke captured: 4/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: The structured prompt didn't go through, so I'll just ask in plain text. Answer as briefly as you like, and where I've suggested a default you can just say "default" to accept it.

These are the decisions the brief leaves open that I can't safely infer. I've split them into the core arithmetic and then the boundaries and edge cases.

**Core arithmetic**

1. **Day-count basis.** How is the annual rate turned into a daily rate? Options: Actual/365 fixed (divide by 365 always), Actual/actual (365 or 366 in leap years), or Actual/360. *(Common UK retail default: Actual/365 fixed.)*

2. **Compounding within the period.** Does interest accrue simply (sum of daily balance × daily rate, accrued interest earns nothing until posted), or compound daily (each day's accrued interest joins the balance and earns interest on later days in the same period)?

3. **Rounding.** To the currency's minor unit (pennies): round once at posting or round each day? And which direction: half-up, half-even (banker's), or truncate down? *(Common default: accrue at full precision, round once at posting, half-up.)*

4. **Period boundaries.** Given a period with a start and end date, which days' balances count: start-inclusive/end-exclusive `[start, end)`, both inclusive `[start, end]`, or start-exclusive/end-inclusive `(start, end]`?

**Boundaries and edge cases**

5. **Zero or negative balances.** Can a daily balance be zero or negative, and if so does it earn zero interest, or is negative interest (a charge) applied? Or is a negative balance impossible for these accounts?

6. **Rate over the period.** Is the annual rate a single fixed value for the whole period (as the brief implies), or can it change mid-period? And is it a single flat rate, or tiered by balance band?

7. **Posting mechanics.** When interest is posted, does it capitalise (get added to the account balance so it earns interest going forward), and is the returned "updated balance" simply the closing balance plus posted interest? Is there any minimum-interest threshold below which nothing is posted?

8. **Tax or withholding.** Is any tax or withholding deducted at posting, or is that out of scope for this function?

Once I have these, I'll write the full requirements spec and save it as `spec.md`.
A: 1. **Day-count basis:** Actual/360 — the daily rate is annual_rate / 360.

2. **Compounding:** Daily compounding within the period — each day's accrued interest joins the principal and earns interest on subsequent days before posting.

3. **Rounding:** Round once at posting, truncate down (floor) to 2 dp. Never half-up. The bank retains the fraction.

4. **Period boundaries:** Half-open [start, end) — the posting day is excluded from the period it closes and opens the next period.

5. **Zero or negative balances:** The account never goes negative. A zero-balance day contributes zero interest for that day. A zero balance for an entire period still generates a posting event, recorded as zero.

6. **Rate changes:** The rate can change mid-period. Each day uses the rate in force on that day; compute the average-balance interest per rate-segment and sum. Flat rate (not tiered by balance band).

7. **Posting mechanics:** Interest capitalises — net interest is credited to the account balance. Updated balance is closing balance plus net posted interest. No minimum-interest threshold [default, not policy].

8. **Withholding tax:** In scope. 15% withholding tax is deducted from gross interest at each posting. The account is credited the net amount; tax withheld is reported separately.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Good, that pins down most of it. Four of your answers interact in ways I need to resolve before the arithmetic is unambiguous. These are follow-ups, not re-asks.

**A. Compounding vs rate segments (reconciling answers 2 and 6).** Daily compounding means iterating day by day: each day's interest is `balance_that_day × (rate_in_force / 360)`, and that interest joins the interest-bearing base for the next day. But answer 6 says "compute the average-balance interest per rate-segment and sum," which sounds like *simple* interest on an average balance within each segment. Those give different numbers. Which is it?

  - **(i)** Pure daily compounding throughout: iterate every day on the actual daily balance plus interest accrued so far; the rate just switches on its effective date. Segments are only a way of describing which rate applies. *(This is what "daily compounding" normally means, and I'd recommend it for consistency.)*
  - **(ii)** Simple interest on the average balance within each rate-segment, then sum the segments, with no compounding across days.

**B. Order of rounding for tax.** Gross accrues at full precision. Then, in what order:
  - Truncate gross to 2 dp → compute 15% withholding on that truncated gross → and is the tax itself truncated or rounded to 2 dp? → net = gross − tax.
  - Does `net + tax` have to reconcile exactly to the posted gross at 2 dp, or is a sub-penny discrepancy acceptable (bank retains it, consistent with your truncation philosophy)?

**C. Posting date and the next period.** Interest posts on the period's `end` date (the excluded day that opens the next period), correct? And the capitalised net interest becomes part of the interest-bearing balance from that date, so it earns interest in the next period. Confirm, and tell me: does the *net* amount capitalise (tax already gone), which I'll assume, rather than gross.

**D. Input model.** How are the daily balances and the rate supplied to `post_interest`?
  - Is the daily balance the **end-of-day closing balance** for each day in `[start, end)`, and is a value guaranteed for **every** day, or can days be missing (carry forward the last known balance)?
  - Is the changing rate supplied as a **schedule** of `(effective_date, annual_rate)` entries the function reads, or as something else?
A: A. Option (ii). The correct method is average daily balance: sum all daily balances in the period (or rate-segment), divide by the number of days in the full period, apply the segment's rate once to that average, and sum across segments. My earlier 'daily compounding' answer was imprecise — 'compounds' refers to posted interest capitalising into the balance for the next period, not to intra-period day-by-day accrual. Per the brief, this is explicitly not per-day daily-balance arithmetic.

B. Truncate gross to 2 dp first. Compute 15% on that truncated gross figure. Truncate the tax result to 2 dp as well. Net = truncated gross − truncated tax. Sub-penny discrepancies are acceptable; the bank retains any residual fraction, consistent with the floor-everywhere philosophy. net + tax will not necessarily reconcile exactly to a pre-truncation gross, and that is by design.

C. Confirmed. Interest posts on the end date (the day that is excluded from the closing period and opens the next). The net amount capitalises — net (after tax) is credited to the account balance from that date and earns interest in the next period. Gross does not capitalise; the withheld tax leaves the account at posting.

D. [default, not policy] End-of-day closing balance for each calendar day in [start, end), with a value guaranteed for every day — no carry-forward logic required. Rate changes are supplied as a schedule of (effective_date, annual_rate) pairs; the function resolves the rate in force on each day by finding the latest entry with effective_date ≤ that day.

### Round 3
_Step reasoning:_ (live agent turn)

Q: Almost there. One genuine ambiguity remains in how the average-daily-balance method (answer A) combines with the Actual/360 basis (answer 1): your description of the segment method didn't state where the day-count time factor enters. The cleanest way to settle it is to confirm actual numbers, so let me trace two concrete scenarios. Tell me if the figures match your intent.

**Scenario 1 — single rate.** Period `[1 Jan, 31 Jan)` = 30 days. Closing balance is exactly 10,000.00 every day. Annual rate 3.6% (0.036) throughout.

- Sum of daily balances = 300,000.00; average daily balance = 300,000 / 30 = 10,000.00
- Applying the rate on an Actual/360 basis over 30 days: gross = 10,000.00 × 0.036 × (30 / 360) = **30.00**
  *(equivalently: 300,000.00 × 0.036 / 360 = 30.00)*
- Gross truncated to 2 dp = 30.00; withholding 15% = 4.50, truncated = 4.50; **net = 25.50**
- Updated balance = 10,000.00 (last day's closing balance) + 25.50 = **10,025.50**, posted on 31 Jan.

**Scenario 2 — rate changes mid-period.** Same 30-day period and constant 10,000.00 balance. Rate is 3.6% for 1–10 Jan (10 days) and 7.2% for 11–30 Jan (20 days).

- Segment 1: (100,000 / 30) average share × 0.036 × (30/360) = 10.00 *(≡ 100,000 × 0.036 / 360)*
- Segment 2: 200,000 × 0.072 / 360 = 40.00
- gross = **50.00**; tax = 7.50; net = **42.50**; updated balance = **10,042.50**

The thing I most need you to confirm: **is the `× days / 360` time factor applied** (giving 30.00 in Scenario 1), rather than applying the annual rate directly to the average with no time scaling (which would give 360.00)? If yes to the time factor, and both scenarios' numbers look right, I have everything I need to write the spec.
A: Yes, the time factor applies. The correct formula is sum_of_daily_balances × annual_rate / 360 (equivalently, average_daily_balance × annual_rate × days/360). Both scenarios are correct.

### Round 4
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in the working directory.

It pins down every policy decision the brief left open, all confirmed with you rather than guessed:

- **Day count:** Actual/360.
- **Method:** average daily balance per rate segment, summed; intra-period compounding explicitly excluded, with compounding happening only across periods via capitalisation.
- **Rate resolution:** flat rate from a `(effective_date, annual_rate)` schedule, latest entry on or before each day; handles mid-period changes.
- **Rounding:** floor to two decimals at every step (gross, then tax on truncated gross), bank retains the residue.
- **Period bounds:** half-open `[start, end)`, posting on the `end` date.
- **Withholding:** 15% deducted from gross, net capitalises, tax reported separately.
- **Edge cases:** zero-balance days and whole zero-balance periods (still a posting event, recorded as zero), negative balances treated as a precondition violation.

It also carries invariants, three worked examples with reconciled figures, and a section separating confirmed policy from defaults you flagged as revisitable (balance model, no minimum threshold, two-decimal currency).

One note on the interface: the brief says the function "returns the interest posted and the account's updated balance." I've specified the return as a record of `gross_interest`, `tax_withheld`, `net_interest`, and `updated_balance`, taking "interest posted" to mean the net credited amount while still surfacing gross and tax so the posting reconciles. If you'd rather the return be a bare `(net_interest, updated_balance)` pair with gross and tax recorded elsewhere, that's a small change to the output section.
A: Noted. The return record you've specified is the right shape — surfacing gross, tax and net together makes the posting self-reconciling, which is preferable to a bare pair. The spec is complete.

## Produced specification

# Interest engine — requirements specification

## Scope

This specifies the interest calculation and posting engine for savings accounts, exposed through a single
function, `post_interest(account, period)`. Given an account with a daily closing-balance history over a
period and an annual interest rate that may change during the period, the function computes the interest
earned, applies withholding tax, posts the net interest to the account, and returns the outcome.

**In scope:** day-count and rate resolution, the average-daily-balance calculation, rounding and
truncation, withholding tax, capitalisation, and the posting event including the zero-interest case.

**Out of scope:** how balances and rate schedules are persisted or supplied upstream, authentication and
authorisation, statement rendering, reversal or correction of past postings, and reporting beyond the
values this function returns. Currency is assumed to be a single decimal currency with a minor unit of two
decimal places (for example pounds and pence).

## Interface

```
post_interest(account, period) -> Posting
```

The function is a command with a side effect: it posts interest to the account and returns a record of
what it posted. It is expected to be called once per account per period, at period close.

### Inputs

**`account`** exposes, for the given period, an end-of-day closing balance for every calendar day, and can
receive a credit that capitalises into its balance. A closing balance is guaranteed to exist for every day
in the period; there is no carry-forward or gap-filling logic. Balances are always zero or positive (see
invariants).

**`period`** is a half-open date interval `[start, end)`. The `start` date is included and the `end` date
is excluded. The `end` date is the posting date: it does not belong to the period being closed, and it
opens the next period.

**Rate schedule.** The annual interest rate is supplied as a schedule of `(effective_date, annual_rate)`
entries. The rate in force on a given day is the `annual_rate` of the entry with the greatest
`effective_date` that is less than or equal to that day. The rate may change one or more times within a
period. The rate is flat, not tiered by balance band. A rate must be in force on every day of the period;
a day with no applicable schedule entry is a precondition violation.

### Output

`post_interest` returns a `Posting` record containing:

- `gross_interest` — the interest earned before tax, truncated to the minor unit.
- `tax_withheld` — the withholding tax deducted, truncated to the minor unit.
- `net_interest` — the amount actually credited to the account (`gross_interest − tax_withheld`).
- `updated_balance` — the account balance after the net interest is credited.

The "interest posted" referred to in the brief is `net_interest`, the amount credited to the balance;
`gross_interest` and `tax_withheld` are reported alongside it so the posting fully reconciles.

## Definitions

- **N** — the number of days in the period, equal to the count of dates in `[start, end)`.
- **B\_d** — the end-of-day closing balance on day `d`.
- **r\_d** — the annual interest rate in force on day `d`, resolved from the rate schedule.
- **Rate segment** — a maximal run of consecutive days within the period that share the same in-force
  annual rate. If the rate never changes, the whole period is a single segment.
- **Minor unit** — the smallest currency denomination, two decimal places.

## Interest calculation

### Day-count basis

The basis is **Actual/360**. Interest for a set of days accrues at `annual_rate / 360` per day, applied to
the actual number of days. There is no adjustment for leap years; every calendar day counts as one day and
the divisor is always 360.

### Method: average daily balance, per rate segment

Interest is computed by the average-daily-balance method, evaluated per rate segment and summed. It is
**not** day-by-day compounding arithmetic. Within a period, accrued interest does not itself earn interest;
compounding happens only across periods, when posted net interest capitalises into the balance and earns
interest in the following period.

For each rate segment `s` with day set `D_s` and annual rate `r_s`:

1. Sum the daily closing balances in the segment: `S_s = Σ (B_d for d in D_s)`.
2. Take the segment's share of the average daily balance by dividing by the full-period day count:
   `A_s = S_s / N`.
3. Apply the segment rate on the Actual/360 basis over the period:
   `interest_s = A_s × r_s × (N / 360)`.

Total gross interest is the sum across all segments:

```
gross_raw = Σ interest_s
```

The `N` in steps 2 and 3 cancels, so this is arithmetically identical to the following closed form, which
implementations may use directly:

```
gross_raw = ( Σ over all days d in [start, end) of ( B_d × r_d ) ) / 360
```

Equivalently again, for a single-rate period: `gross_raw = average_daily_balance × annual_rate × N / 360`.

All of the above is computed at full precision. No rounding or truncation is applied to any intermediate
value. Monetary arithmetic must use exact decimal arithmetic, not binary floating point, so that the single
truncation at posting is the only place precision is lost.

## Rounding and truncation

The policy is floor-everywhere to the minor unit. Because balances and interest are never negative,
truncation toward zero and flooring are the same operation.

1. **Gross.** Truncate `gross_raw` down to two decimal places: `gross_interest = floor2(gross_raw)`.
2. **Tax.** Compute `0.15 × gross_interest`, then truncate that down to two decimal places:
   `tax_withheld = floor2(0.15 × gross_interest)`.
3. **Net.** `net_interest = gross_interest − tax_withheld`.

Sub-penny residues left by each truncation are retained by the bank and are not tracked or redistributed.
Because tax is computed from the already-truncated gross and is itself truncated, `net_interest +
tax_withheld` reconciles exactly to `gross_interest`, but neither reconciles to the pre-truncation
`gross_raw`. That is by design.

## Withholding tax

A withholding tax of **15%** is deducted from the gross interest at every posting. The rate is a single
fixed value applied to all accounts and all postings; there is no exemption, allowance, or threshold. The
account is credited the net amount only; the withheld tax leaves the account at posting and is reported
separately as `tax_withheld`.

## Posting and capitalisation

Posting occurs on the period's `end` date, the excluded day that opens the next period.

- The **net** interest is credited to the account balance. Gross does not capitalise; the withheld tax
  never enters the balance.
- `updated_balance = B_(last) + net_interest`, where `B_(last)` is the closing balance on the last day
  included in the period, that is the day `end − 1`.
- From the `end` date onward the credited net interest is part of the interest-bearing balance, so it earns
  interest in the next period. This across-period capitalisation is the only sense in which interest
  compounds.

There is no minimum-interest threshold: any positive net interest is posted, however small.

## Edge cases

- **Zero-balance day.** A day with a closing balance of zero contributes zero to the sum and therefore no
  interest for that day.
- **Zero balance for the whole period.** Gross, tax, and net are all zero. A posting event is still
  produced and recorded, with all three amounts zero and the balance unchanged. Posting is unconditional,
  not gated on a non-zero result.
- **Negative balance.** These accounts never go negative (see invariants). A negative closing balance is
  outside the domain of this function and represents a precondition violation rather than a case to compute.
- **Rate change mid-period.** Handled by segmentation as described; each day uses the rate in force on that
  day.

## Invariants

- The account balance is always greater than or equal to zero, before and after posting.
- `gross_interest ≥ 0`, `tax_withheld ≥ 0`, `net_interest ≥ 0`.
- `net_interest = gross_interest − tax_withheld`.
- `net_interest + tax_withheld = gross_interest` (exact at the minor unit), while `gross_interest ≤
  gross_raw` (the bank retains the truncated residue).
- `updated_balance = B_(last) + net_interest`.
- Given the same account balances, period, and rate schedule, the result is deterministic.

## Worked examples

All examples use a period of `[1 Jan, 31 Jan)`, which is 30 days (`N = 30`), and a constant closing balance
of 10,000.00 on every day.

**Single rate of 3.6% throughout.**

- Sum of daily balances = 300,000.00; average daily balance = 10,000.00.
- `gross_raw = 300,000.00 × 0.036 / 360 = 30.00` (equivalently `10,000.00 × 0.036 × 30/360`).
- `gross_interest = 30.00`; `tax_withheld = floor2(0.15 × 30.00) = 4.50`; `net_interest = 25.50`.
- `updated_balance = 10,000.00 + 25.50 = 10,025.50`, posted on 31 Jan.

**Rate changes mid-period: 3.6% for 1–10 Jan (10 days), 7.2% for 11–30 Jan (20 days).**

- Segment 1: `100,000.00 × 0.036 / 360 = 10.00`.
- Segment 2: `200,000.00 × 0.072 / 360 = 40.00`.
- `gross_raw = 50.00`; `gross_interest = 50.00`; `tax_withheld = 7.50`; `net_interest = 42.50`.
- `updated_balance = 10,000.00 + 42.50 = 10,042.50`, posted on 31 Jan.

**Zero balance for the whole period.**

- `gross_interest = 0.00`; `tax_withheld = 0.00`; `net_interest = 0.00`.
- A posting event is recorded; the balance is unchanged.

## Assumptions and defaults

These were confirmed as sensible defaults rather than deliberate institutional policy, and can be revisited:

- The daily balance is the end-of-day closing balance for each calendar day in `[start, end)`, guaranteed
  present for every day with no carry-forward.
- There is no minimum-interest threshold below which posting is suppressed.
- Currency has a two-decimal minor unit.

The following were confirmed as deliberate policy: Actual/360 day count, the average-daily-balance method
(not intra-period daily compounding), floor-to-two-decimals truncation at every step, the half-open
`[start, end)` period, posting on the `end` date, net capitalisation, and 15% withholding tax.


## Auditor verdict

_Coverage 7/14 correct (#1, 4, 6, 7, 11, 12, 13). The method/rounding/tax/temporal core is well specified. Of the in-focus six [1,2,3,8,9,10], only #1 is correct: #2 is resolved backwards (no intra-period compounding vs required daily compounding), #3's quarterly-anniversary posting cadence is unaddressed, and the entire lifecycle set (#8 dormancy, #9 mid-period closure, #10 escheatment) is absent. #5 (minimum balance 1,000) is missed, and #14's output omits the average-balance and qualifying-days disclosures. The spec is strong on calculation mechanics but does not generalise to lifecycle coverage or the domain-specific policy anchors._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Method: average daily balance, per rate segment ... Interest is computed by the average-daily-balance method, evaluated per rate segment and summed. It is not day-by-day compounding arithmetic." | The spec explicitly adopts average daily balance (sum daily balances, divide by N, apply rate once) and rejects per-day daily-balance, matching the reference exactly. |
| 2 | yes | no | "Within a period, accrued interest does not itself earn interest; compounding happens only across periods, when posted net interest capitalises into the balance." | The reference requires daily compounding within the period. The spec addresses compounding but resolves it the opposite way: no intra-period compounding, only across-period capitalisation. Plausible but different, so not correct. |
| 3 | no | no | absent | The spec treats the posting period as a generic input interval and posts on the end date, but never states the cadence (quarterly) or that it falls on the account-opening anniversary rather than calendar quarter-ends. The specific decision is unaddressed. |
| 4 | yes | **yes** | "The basis is Actual/360 ... annual_rate / 360 per day ... the divisor is always 360." | Days-in-year basis is 360 with daily rate = annual/360, exactly matching the reference. |
| 5 | no | no | absent (spec addresses only minimum-interest, not minimum balance: "There is no minimum-interest threshold") | The reference sets a minimum balance of 1,000 below which a day earns zero but still counts in the divisor. The spec has no minimum-balance concept; its 'no minimum threshold' statements concern minimum interest for posting, a different decision. Every balance day contributes, contradicting the rule. |
| 6 | yes | **yes** | "The policy is floor-everywhere to the minor unit ... Truncate gross_raw down to two decimal places ... never negative, truncation toward zero and flooring are the same." | Posted interest is floored to 2 dp, never half-up, with the residue retained by the bank, matching the reference. |
| 7 | yes | **yes** | "A withholding tax of 15% is deducted from the gross interest at every posting ... The account is credited the net amount only; the withheld tax ... is reported separately as tax_withheld." | 15% withholding at each posting, net credited, tax reported separately, exactly matching the reference. |
| 8 | no | no | absent | No mention of dormancy, a 12-month inactivity trigger, continued accrual while dormant, or a monthly dormancy fee of 5 anywhere in the spec. |
| 9 | no | no | absent (closure/reversal listed out of scope: "reversal or correction of past postings") | Mid-period closure with pro-rata accrual to the closure date is not addressed; related lifecycle handling is explicitly placed out of scope. |
| 10 | no | no | absent | No mention of escheatment, a 5-year dormancy horizon, remittance to the state, or closing the account to a zero balance. |
| 11 | yes | **yes** | "Zero balance for the whole period. Gross, tax, and net are all zero. A posting event is still produced and recorded ... Posting is unconditional." and "The account balance is always greater than or equal to zero." | The spec matches the zero-balance no-op (still records a zero posting) and the no-overdraft/never-negative invariant. Negative-rate rejection is not explicitly stated, but the covered behaviours match and none contradict the reference; this is the inferable anchor. |
| 12 | yes | **yes** | "period is a half-open date interval [start, end). The start date is included and the end date is excluded. The end date is the posting date: it does not belong to the period being closed, and it opens the next period." | The posting day is excluded from the closing period and opens the next, with half-open [start, end) semantics, exactly matching the reference. |
| 13 | yes | **yes** | "Method: average daily balance, per rate segment ... The rate in force on a given day is the annual_rate of the entry with the greatest effective_date ... each day uses the rate in force on that day." | Mid-period rate changes are handled by per-segment computation summed together, with each day using its in-force rate, matching the reference. |
| 14 | yes | no | "Posting record containing: gross_interest ... tax_withheld ... net_interest ... updated_balance." | The output shape is addressed but omits two required fields: the average daily balance used and the number of qualifying days. With four of six fields, the specific disclosure the reference demands is not met. |
