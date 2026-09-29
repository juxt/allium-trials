# aiup — savings-interest — iteration 1

Model (author): claude-opus · Questions asked: 15 · Captured: 8/14 · Bespoke captured: 6/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: The interactive question tool isn't capturing answers in this environment, so I'll put the questions to you directly. Please answer inline (a letter or short note per item is plenty). These are the policy decisions the brief leaves open and that I can't safely guess.

**1. Day-count basis (annual rate → daily rate)**
- a) Actual/365 fixed — divide by 365 every day, leap years included
- b) Actual/actual — divide by 365 in normal years, 366 in leap years
- c) Actual/360 — divide by 360

**2. Accrual method across the period**
- a) Simple daily accrual — each day's interest = that day's balance × daily rate, summed; no compounding within the period
- b) Daily compounding — each day's accrued interest joins the base for the next day

**3. Rounding — timing and precision**
- a) Accrue at full precision, round the total to 2 dp only at posting
- b) Round each day's accrual to 2 dp, then sum
- c) Something else (say what, e.g. 4 dp)

**4. Rounding mode** (for whichever point rounding happens)
- a) Half-up (round 0.5 away from zero)
- b) Half-even / banker's rounding
- c) Other

**5. Endpoint treatment — which days earn interest**
- a) Both endpoints inclusive (every day from first to last)
- b) Include first, exclude last (half-open)
- c) Exclude first, include last (half-open)

**6. Which daily balance is used for a day**
- a) End-of-day balance
- b) Start-of-day balance

**7. Zero or negative balance days**
- a) Floor at zero — a day with a non-positive balance earns nothing, never negative interest
- b) Accrue negative interest on negative-balance days
- c) Negative balances are not possible for these accounts (guaranteed by the caller)

**8. What posting does**
- a) Interest is added to the account balance; the returned updated balance = starting balance + interest posted
- b) Interest is posted to a separate ledger/sub-account and does not change the working balance
- c) Other

**9. Does posted interest itself earn interest in the next period?** (compounding across postings)
- a) Yes — once posted it becomes part of the interest-bearing balance
- b) No

**10. Rate stability and edge cases**
- a) The annual rate is a single fixed value for the whole period, or
- b) The rate can change mid-period (tiered by balance, or scheduled changes) — if so, tell me how it's supplied
- Also: is the daily balance history guaranteed to cover every day of the period, and is the period ever empty or zero-length? What currency/smallest unit are we posting in?

If any of these have an obvious house answer you'd rather I just adopt, say so and I'll record the rationale.
A: Answers in order:

**1. Day-count basis:** c — Actual/360. Daily rate = annual_rate / 360.

**2. Accrual method:** b — Daily compounding. Each day's accrued interest joins the base for the next day's accrual within the period.

**3. Rounding timing:** a — Accrue at full precision throughout; round only at posting.

**4. Rounding mode:** Neither a nor b — floor (truncate down) to 2 dp. The bank retains the sub-cent fraction. Never half-up.

**5. Endpoint treatment:** b — Include first day, exclude last (half-open: [start, end)). The posting date opens the next period.

**6. Daily balance used:** End-of-day balance. [default, not policy]

**7. Zero or negative balance days:** a — floor at zero. A day with a balance below the minimum (1,000) contributes zero interest, but the day still counts in the divisor for the average.

**8. What posting does:** a — net interest is credited to the account balance. The returned updated balance is the pre-posting balance plus net interest posted (gross minus 15% withholding tax).

**9. Compounding across postings:** a — yes. Once posted, the credited amount is part of the working balance and earns interest in subsequent periods.

**10. Rate stability and edge cases:** b — the rate can change mid-period. Supply the rate as a time-series of (effective_date, annual_rate) pairs; each day uses the rate in force on that day, and interest is computed per rate-segment then summed. Daily balance history must cover every calendar day of the period with no gaps; the caller is responsible for that guarantee. An empty or zero-length period is a no-op (zero posting still recorded). Currency is 2 dp minor unit (e.g. cents).

### Round 2
_Step reasoning:_ (live agent turn)

Q: Thanks — that's most of it pinned down. A few of your answers introduced mechanics that need one more pass, because as written two of them can be read in materially different ways and would produce different numbers. Let me close those gaps.

**A. The "average" in answer 7 vs daily compounding in answer 2.**
Answer 2 says daily compounding: each qualifying day accrues `balance × daily_rate`, and that interest joins the base for the next day. But answer 7 mentions "the divisor for the average", which sounds like an average-daily-balance method (sum the daily balances, divide by day count, apply the rate once). Those are different engines and don't combine. Which is authoritative?
- a) **Daily compounding** is the engine (answer 2 stands). A sub-minimum day simply accrues zero that day; there is no averaging step. The "divisor" wording was loose.
- b) **Average daily balance** is the engine. Sum end-of-day balances over the period, divide by the day count, apply the rate — and answer 2's "compounding" was loose.
- c) Something else — please describe.

**B. Minimum-balance threshold.**
- Is the threshold 1,000 in major units, i.e. 100,000 minor units (cents)?
- Does a day *exactly at* the threshold qualify, or must it be strictly above? (i.e. is the test `balance >= threshold` or `balance > threshold`?)
- On a sub-threshold day, does the day's balance still carry forward as the compounding base (it just earns nothing that day), or is anything reset?

**C. Withholding tax — order of operations and rounding.**
You said floor-to-2dp only at posting, and net = gross − 15% tax. I need the exact sequence:
- 1) Accrue gross at full precision over the whole period, then floor gross to 2 dp.
- 2) Compute tax = 15% × (floored gross?) or × (full-precision gross?).
- 3) Floor tax to 2 dp as well (bank/tax authority retains the fraction), then net = gross − tax.
Please confirm which figure tax is a percentage of, and whether tax is floored the same way (2 dp, truncate down). Also: is 15% fixed, or supplied per account/period?

**D. Rate changes mid-period under compounding.**
"Computed per rate-segment then summed" — with daily compounding I read this as: walk day by day, each day uses the rate in force that day, and the balance compounds continuously across the whole period (segment boundaries need no special treatment). Confirm that's right, rather than computing each rate segment independently on the period-opening balance and adding the segments (which would not compound across boundaries).

**E. What the function returns.**
"Interest posted" = the **net** amount credited (after tax)? And should the result also expose gross interest and tax withheld for the ledger record, or just net + updated balance?
A: A: b — Average daily balance is the authoritative engine. My answer 2 was imprecise; the daily compounding I described is cross-period (once posted, interest joins the working balance for the next period). Within a posting period the calculation is: sum qualifying end-of-day balances, divide by total days in the period, apply the rate once to that average. A sub-minimum day contributes zero to the numerator and still counts in the denominator.

B: Threshold is 1,000 major units (100,000 minor units). Test is `balance >= 1,000` — a day exactly at the threshold qualifies. On a sub-threshold day the day's balance is treated as zero in the numerator; the day still increments the denominator. The account's actual balance is unaffected for transaction purposes.

C: Sequence: (1) compute gross at full precision using the average-daily-balance method; (2) floor gross to 2 dp; (3) compute tax = floor(floored_gross × 0.15, 2 dp) — tax is a percentage of the floored gross figure, and is itself floored; (4) net = floored_gross − floored_tax; (5) credit net to the account. The 15% rate is fixed.

D: Correct — walk day by day across the whole period; each day uses the rate in force on that day. With the average-daily-balance engine there is no within-period compounding, so segment boundaries need no special treatment. Per rate segment, compute sum(qualifying daily balances in segment) × (segment_rate / 360). Sum those across all segments to get the period's gross interest. Do not restart from the period-opening balance at each segment boundary.

E: Yes — 'interest posted' is the net amount credited (after tax). The result must also expose gross interest, tax withheld, average daily balance used, number of qualifying days, and the updated account balance. All six fields.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in this directory.

It captures every policy decision you confirmed, with the tricky ones pinned down precisely:

- **The engine**: average daily balance within a period (not intra-period compounding), Actual/360, with cross-period compounding once net interest is credited.
- **The reconciliation** between your answers A and D: the average-daily-balance framing and the per-day/per-segment sum are the same arithmetic, so mid-period rate changes need no boundary handling. The spec computes gross from the per-day sum directly to avoid double rounding.
- **The rounding and tax order**: floor gross to the minor unit, tax = floor(15% of floored gross), net = gross − tax, applied only at posting, with the bank retaining every dropped fraction.
- **The minimum balance**: sub-minimum days contribute zero to the numerator and one to the denominator, `balance >= 100,000` qualifies, real balance untouched.
- **The half-open period, the six return fields, and the empty-period no-op** that still records a zero posting.

There's a worked example that shows flooring biting at both the gross and tax steps, an edge-case table, and FR/NFR/constraint tables in the requirements-catalog format.

Two engineering choices I made rather than guessing silently are flagged **[for review]** in section 11: missing days in the balance history fail fast rather than counting as zero, and rates are assumed non-negative (so floor is truncation toward zero). If you'd prefer different behaviour on either, tell me and I'll adjust.
A: Noted. Both engineering choices are sound defaults — fail fast on gaps and reject negative rates. No changes needed.

## Produced specification

# Requirements specification — savings interest engine

## 1. Overview

This specifies the interest engine for savings accounts. The engine exposes a single
operation, `post_interest(account, period)`, which computes the interest an account has earned
over a period and posts it to the account. It returns the interest posted together with the
account's updated balance.

All monetary policy below was confirmed with the product stakeholder. Where the brief was
silent and a decision could not be safely inferred, the choice was elicited rather than
guessed. Two minor engineering decisions were made under the stakeholder's standing invitation
to establish sensible defaults; both are marked **[for review]** in section 9.

## 2. Scope

In scope: the calculation, the withholding-tax deduction, the posting, and the reported result
fields. Out of scope: how the daily balance history is assembled, how rates are sourced,
scheduling of posting runs, persistence of the ledger, multi-currency conversion, and negative
interest rates.

## 3. Interface contract

### Inputs

`account`

- `balance` — the working balance immediately before posting, in integer **minor units** (for
  example cents). This is the pre-posting balance to which net interest is credited.
- `daily_balance_history` — the end-of-day balance for every calendar day in the period, in
  minor units. The caller guarantees this covers every day of the period with no gaps
  (see NFR-002 and C-006).

`period`

- A half-open date interval `[start_date, end_date)`. The start day is included, the end day is
  excluded. The end day is the posting date and opens the next period (see FR-005).

`annual_rate`

- A time series of `(effective_date, annual_rate)` pairs. Each day of the period uses the rate
  in force on that day, which is the pair with the latest `effective_date` on or before the day.
  The caller guarantees a rate is in force on `start_date` (see C-007).

### Output

The operation returns six fields:

| Field                   | Meaning                                                              | Units          |
|-------------------------|---------------------------------------------------------------------|----------------|
| `interest_posted`       | Net interest credited to the account, after withholding tax         | Minor units    |
| `gross_interest`        | Gross interest before tax, floored to the minor unit                 | Minor units    |
| `tax_withheld`          | Withholding tax deducted, floored to the minor unit                  | Minor units    |
| `average_daily_balance` | Average of qualifying end-of-day balances over the period (informational) | Minor units (2 dp) |
| `qualifying_days`       | Count of days whose end-of-day balance met the minimum              | Integer        |
| `updated_balance`       | Pre-posting balance plus `interest_posted`                          | Minor units    |

## 4. Policy parameters

| Parameter                | Value                          | Source        |
|--------------------------|--------------------------------|---------------|
| Day-count divisor        | 360 (Actual/360)               | Stakeholder   |
| Minimum qualifying balance | 100,000 minor units (1,000 major units) | Stakeholder   |
| Qualifying test          | `end_of_day_balance >= 100,000` (at-threshold qualifies) | Stakeholder |
| Withholding tax rate     | 15%, fixed                     | Stakeholder   |
| Rounding                 | Floor (truncate toward zero) to 2 dp / whole minor unit | Stakeholder |
| Endpoint treatment       | Half-open `[start, end)`       | Stakeholder   |
| Daily balance basis      | End-of-day balance             | Stakeholder   |

## 5. The calculation

The engine walks the period day by day. It does **not** compound within a period; the
average-daily-balance method is the authoritative engine. Compounding is cross-period only:
once net interest is credited it becomes part of the working balance and earns interest in
later periods (FR-009).

For each calendar day `d` where `start_date <= d < end_date`:

1. Take `b`, the end-of-day balance for `d` from the history.
2. Determine the qualifying balance: `q = b` if `b >= 100,000`, otherwise `q = 0`. A
   sub-minimum day contributes zero to the numerator but still counts in the denominator, and
   the account's real balance is unaffected for transaction purposes.
3. Determine `rate_d`, the annual rate in force on `d`.
4. The day's accrual is `q * (rate_d / 360)`, held at full precision.

The period's figures are then:

```
total_days       = number of days in [start_date, end_date)
gross_full       = sum over all days of  q_d * (rate_d / 360)      # full precision
gross_interest   = floor2(gross_full)
tax_withheld     = floor2(gross_interest * 0.15)
interest_posted  = gross_interest - tax_withheld                    # net
average_daily_balance = (sum over all days of q_d) / total_days     # informational
qualifying_days  = count of days where b_d >= 100,000
updated_balance  = account.balance + interest_posted
```

where `floor2(x)` truncates `x` toward zero to two decimal places (whole minor units).

The per-day sum is equivalent to the stakeholder's segment formulation: for each rate segment,
`sum(qualifying daily balances in the segment) * (segment_rate / 360)`, summed across all
segments. Rate-segment boundaries need no special handling because there is no within-period
compounding. It is also equivalent to `average_daily_balance * period_rate * total_days / 360`
when a single rate applies. Gross interest must be computed from the per-day (or per-segment)
sum directly, **not** by multiplying the rounded `average_daily_balance`, to avoid a
double-rounding discrepancy.

### Order of rounding

Rounding happens only at posting, in this fixed order: accrue gross at full precision, floor
gross to the minor unit, compute tax as 15% of the **floored** gross, floor the tax, then
subtract to get net. The bank retains every sub-cent fraction dropped by flooring.

## 6. Worked example

Period `[2026-01-01, 2026-01-31)` — 30 days, half-open, so 1 to 30 January inclusive.
Flat annual rate 5% (0.05). End-of-day balance 123,456 minor units (1,234.56) every day, all
above the 100,000 minimum.

```
daily rate        = 0.05 / 360          = 0.0001388888...
day accrual       = 123456 * 0.0001388... = 17.146666... minor units
gross_full        = 17.146666... * 30    = 514.40 minor units = 5.1440 major
gross_interest    = floor2(5.1440)        = 5.14
tax_withheld      = floor2(5.14 * 0.15)   = floor2(0.771) = 0.77
interest_posted   = 5.14 - 0.77           = 4.37
average_daily_balance = 123456 / 1        = 1,234.56 per day (30 identical days)
qualifying_days   = 30
updated_balance   = 1,234.56 + 4.37       = 1,238.93
```

## 7. Edge cases

| Case                                   | Required behaviour                                                                 |
|----------------------------------------|-----------------------------------------------------------------------------------|
| Empty or zero-length period            | No-op. A zero posting is still recorded. All monetary fields and `qualifying_days` are 0, `average_daily_balance` is 0, `updated_balance` equals the pre-posting balance. |
| All days below the minimum             | Gross, tax and net are 0. `qualifying_days` is 0. `average_daily_balance` is 0. The posting is still recorded. |
| Sub-minimum day within the period      | That day contributes 0 to the numerator, still increments the denominator, and does not qualify. |
| Rate change mid-period                 | Each day uses the rate in force on that day; segments are summed with no boundary compounding. |
| Missing day in the balance history     | Fail fast with a defined error; never treated silently as zero **[for review]**.   |
| Gross rounds to a value where 15% is a sub-cent | Tax is floored to the minor unit; net absorbs the difference in the account holder's favour only to the extent of flooring. |

## 8. Functional requirements

| ID     | Title                          | User Story                                                                                                                                                     | Priority | Status |
|--------|--------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|--------|
| FR-001 | Compute gross interest         | As the bank, I want gross interest computed as the sum over each day of the qualifying end-of-day balance times the in-force daily rate (annual rate / 360), so that earnings follow the Actual/360 average-daily-balance policy. | High     | Open   |
| FR-002 | Apply minimum qualifying balance | As the bank, I want days whose end-of-day balance is below 100,000 minor units to contribute zero to the interest numerator while still counting toward the day divisor, so that only balances at or above 1,000 major units earn interest. | High     | Open   |
| FR-003 | Convert annual rate to daily   | As the bank, I want each day's rate derived by dividing the in-force annual rate by 360, so that interest follows the agreed Actual/360 day-count basis.       | High     | Open   |
| FR-004 | Support mid-period rate changes | As the bank, I want each day to use the annual rate in force on that day from a time series of effective-dated rates, so that scheduled rate changes are honoured within a single period. | High     | Open   |
| FR-005 | Apply half-open period boundaries | As the bank, I want the period treated as half-open, including the start day and excluding the end day, so that the end day opens the next period without double-counting. | High     | Open   |
| FR-006 | Floor and post net interest    | As the bank, I want gross floored to the minor unit, tax computed as 15% of floored gross and itself floored, and net credited to the balance, so that posting matches the agreed rounding and tax policy. | High     | Open   |
| FR-007 | Deduct withholding tax         | As a compliance officer, I want 15% withholding tax deducted from floored gross interest before crediting, so that the bank meets its tax-withholding obligation. | High     | Open   |
| FR-008 | Return the six result fields   | As a calling system, I want the operation to return net interest posted, gross interest, tax withheld, average daily balance used, qualifying-day count and updated balance, so that the ledger and downstream reporting have a complete record. | High     | Open   |
| FR-009 | Compound across postings       | As an account holder, I want net interest, once posted, to become part of the working balance, so that it earns interest in subsequent periods. | Medium   | Open   |
| FR-010 | Record a zero posting for an empty period | As the bank, I want an empty or zero-length period to post zero and still record the posting, so that every period has an auditable posting record. | Medium   | Open   |
| FR-011 | Report average daily balance   | As an auditor, I want the average of qualifying end-of-day balances over the period reported, so that a posted amount can be reconciled against the balance history. | Medium   | Open   |

## 9. Non-functional requirements

| ID      | Title                     | Requirement                                                                                                                  | Category     | Priority | Status |
|---------|---------------------------|----------------------------------------------------------------------------------------------------------------------------|--------------|----------|--------|
| NFR-001 | Monetary precision        | All monetary computation must use exact decimal or integer minor-unit arithmetic; binary floating point must not be used for stored or posted amounts. | Correctness  | High     | Open   |
| NFR-002 | History-coverage validation | The operation must verify the balance history covers every day in `[start_date, end_date)` and raise a defined error if any day is missing, rather than under-counting silently. | Reliability  | High     | Open   |
| NFR-003 | Determinism               | Given identical inputs, the operation must return identical results on every run.                                            | Correctness  | High     | Open   |
| NFR-004 | Full-precision accrual    | Daily accruals must be summed at full precision, with flooring applied only once at posting, so results do not vary with day ordering. | Correctness  | High     | Open   |
| NFR-005 | No double rounding        | Gross interest must be derived from the per-day sum, not from the rounded reported average daily balance.                    | Correctness  | High     | Open   |

## 10. Constraints

| ID    | Title                       | Constraint                                                                                                    | Category   | Priority | Status |
|-------|-----------------------------|--------------------------------------------------------------------------------------------------------------|------------|----------|--------|
| C-001 | Day-count basis             | Interest must use the Actual/360 basis: daily rate = annual rate / 360.                                       | Business   | High     | Open   |
| C-002 | Minimum qualifying balance  | The qualifying threshold is 100,000 minor units (1,000 major units), tested as `balance >= threshold`.        | Business   | High     | Open   |
| C-003 | Rounding mode               | All monetary rounding must floor (truncate toward zero) to two decimal places; half-up must not be used.       | Business   | High     | Open   |
| C-004 | Withholding tax rate        | Withholding tax is fixed at 15% of floored gross interest.                                                    | Business   | High     | Open   |
| C-005 | Currency scale              | Amounts are single-currency with a two-decimal-place minor unit.                                              | Technical  | High     | Open   |
| C-006 | History coverage is caller's guarantee | The daily balance history must cover every calendar day of the period with no gaps; assembling it is the caller's responsibility. | Technical  | High     | Open   |
| C-007 | Rate coverage is caller's guarantee | A rate must be in force on the period start date; the caller supplies effective-dated rates covering the period. | Technical  | High     | Open   |

## 11. Decisions and assumptions

Confirmed with the stakeholder:

- Day-count basis is Actual/360.
- Within a period the engine is average daily balance, not intra-period compounding. Compounding
  is cross-period only (FR-009).
- Rounding is floor to two decimal places, applied only at posting. The bank retains the fraction.
- Tax is 15% of floored gross, itself floored; net = floored gross minus floored tax.
- Period is half-open `[start, end)`, end day excluded and opening the next period.
- Day basis is the end-of-day balance.
- Minimum qualifying balance is 100,000 minor units, at-threshold qualifies; sub-minimum days
  contribute zero to the numerator and one to the denominator, leaving the real balance untouched.
- Rate is an effective-dated time series; each day uses the rate in force on that day.
- The result exposes all six fields in section 3.
- An empty or zero-length period is a no-op that still records a zero posting.

Assumptions made under the stakeholder's standing invitation, flagged for confirmation:

- **[for review]** A missing day in the balance history is a defined error (fail fast), not a
  silent zero. This makes the caller's coverage guarantee (C-006) enforceable.
- **[for review]** Rates are assumed non-negative, so floor equals truncation toward zero.
  Negative rates are out of scope; if they become possible, the rounding direction and the tax
  treatment of negative interest need a separate decision.
- The `average_daily_balance` field is reported to two decimal places as an informational figure;
  it does not drive the posted amount (NFR-005).
- The posting date is the period end date, consistent with the half-open boundary (FR-005).


## Auditor verdict

_8 of 14 decisions correct (coverage 0.57): #1,4,5,6,7,12,13,14. The spec captures conventions, thresholds, rounding, tax, boundaries, rate-change handling and output shape well. It fails the harder in-focus subset: #2 (asserts no intra-period compounding vs required daily compounding), #3 posting cadence, and all three lifecycle decisions #8 dormancy, #9 closure, #10 escheatment are absent. #11 is partially handled (zero-balance no-op correct) but treats negative rates as out-of-scope rather than rejected and omits the no-overdraft guarantee. Of the core in-focus six [1,2,3,8,9,10], only #1 is correct, indicating method/lifecycle coverage did not generalise to this savings domain._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Section 5: "the average-daily-balance method is the authoritative engine"; "average_daily_balance * period_rate * total_days / 360 when a single rate applies"; FR-001 "Actual/360 average-daily-balance policy". | The spec explicitly names and uses the average-daily-balance method, applying the rate to the summed/averaged qualifying balances rather than per-day daily-balance, matching the reference resolution. |
| 2 | yes | no | Section 5: "It does not compound within a period ... Compounding is cross-period only"; FR-009 compounds only across postings. | The spec explicitly rejects within-period compounding, whereas the reference requires daily compounding inside the period. The addressed decision resolves to the opposite value. |
| 3 | no | no | absent (period is a caller-supplied input; "scheduling of posting runs" is out of scope in section 2). | The spec never fixes a posting cadence; frequency and anchor are pushed to the caller, so quarterly-on-opening-anniversary is neither stated nor matched. |
| 4 | yes | **yes** | Section 4: "Day-count divisor 360 (Actual/360)"; C-001 "daily rate = annual rate / 360". | The 360-day basis with daily rate = annual/360 matches the reference exactly. |
| 5 | yes | **yes** | Section 4/C-002: threshold 100,000 minor units (1,000 major), "at-threshold qualifies"; section 5 step 2: sub-minimum day "contributes zero to the numerator but still counts in the denominator". | Threshold of 1,000 with at-or-above qualifying and sub-minimum days counting in the divisor but contributing zero matches the reference precisely. |
| 6 | yes | **yes** | Section 4/C-003: "Floor (truncate toward zero) to 2 dp"; section 5 "The bank retains every sub-cent fraction dropped by flooring." | Floor/truncate rounding to the minor unit with the bank keeping the fraction matches the reference (never half-up). |
| 7 | yes | **yes** | C-004/FR-007: "15% withholding tax deducted from floored gross interest"; output fields include net interest_posted and separate tax_withheld. | 15% withholding at posting, crediting net and reporting the tax separately, matches the reference. |
| 8 | no | no | absent (no dormancy field, fee, or 12-month rule anywhere in the spec). | Dormancy lifecycle (12 months, continued accrual, monthly fee of 5) is entirely unaddressed. |
| 9 | no | no | absent (spec handles arbitrary periods but never mentions account closure as an event). | Closure mid-period and pro-rata accrual-on-closure net of tax is not addressed as a lifecycle decision. |
| 10 | no | no | absent (no escheatment, state remittance, or 5-year rule). | Escheatment lifecycle is entirely unaddressed. |
| 11 | yes | no | Section 2 and section 11: "negative interest rates" out of scope, "Rates are assumed non-negative"; section 7: all-days-below-minimum and empty period post zero, "posting is still recorded". | The zero-balance no-op-with-recorded-posting matches, but the spec declares negative rates out of scope rather than rejecting them as invalid, and does not address the no-overdraft/never-negative guarantee, so the composite resolution is not fully matched. |
| 12 | yes | **yes** | Section 3/FR-005: half-open "[start_date, end_date)", "start day is included, the end day is excluded. The end day is the posting date and opens the next period". | Posting day excluded from the closing period and included in the next via half-open boundaries matches the reference exactly. |
| 13 | yes | **yes** | FR-004 and section 5: "Each day uses the rate in force on that day"; "for each rate segment, sum(qualifying daily balances in the segment) * (segment_rate / 360), summed across all segments". | Per-day in-force rate with per-segment summation matches the reference's mid-period rate-change handling. |
| 14 | yes | **yes** | Section 3 output table / FR-008: interest_posted (net), gross_interest, tax_withheld, average_daily_balance, qualifying_days, updated_balance. | All six disclosure fields, including the average daily balance used and qualifying-day count, match the reference output shape. |
