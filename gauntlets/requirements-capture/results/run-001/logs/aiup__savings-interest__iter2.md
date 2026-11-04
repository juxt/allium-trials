# aiup — savings-interest — iteration 2

Model (author): claude-opus · Questions asked: 18 · Captured: 9/14 · Bespoke captured: 7/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured question prompt didn't go through. I'll just ask directly, in plain text. These are the decisions the brief leaves open that I can't safely guess. Answer whichever way your institution has actually decided, and correct my framing if a question has a false premise.

**Round 1 — the core calculation**

1. **Day-count convention.** How is the daily rate derived from the annual rate?
   - Actual/365 fixed (annual ÷ 365 every year, leap years included)
   - Actual/actual (÷ 365 normal years, ÷ 366 leap years)
   - Actual/360 (÷ 360)
   - 30/360

2. **Compounding.** How does interest build across the days in the period?
   - Simple (each day's interest on that day's balance, summed; accrued interest doesn't itself earn)
   - Daily compounding (accrued interest joins the balance each day and earns)
   - Compound only at posting (simple within a period, posted interest becomes principal next period)

3. **Daily balance.** Which balance represents a day: **end-of-day (closing)** or **start-of-day (opening)**?

4. **Rounding.** To what precision and stage, and which mode?
   - Round the final total to 2 dp, half-up
   - Round the final total to 2 dp, half-even (banker's)
   - Round each day to 2 dp, then sum
   - Truncate the total to 2 dp

**Round 2 — edges and boundaries** (feel free to answer these now too)

5. **Negative balances.** If the account is overdrawn on some days, does it accrue **negative interest at the same rate**, **zero interest** (floor at zero), or a **separate debit rate**?

6. **Tiered rates.** Is the annual rate a **single flat rate**, or **banded by balance** (different rates on different portions/tiers)?

7. **Rate changes mid-period.** Is the rate **fixed for the whole period**, or can it **change on given dates within the period**?

8. **Period boundaries.** Is the period a **closed interval [start, end]** (both days accrue) or **half-open [start, end)** (start accrues, posting day excluded)? And on which day is the interest **posted**?

9. **Missing days & the period vs. history mismatch.** If the balance history has gaps, or doesn't cover the whole period, what should happen: **carry forward the last known balance**, **treat missing days as zero**, or **reject the input as an error**?

10. **Currency & the account model.** What currency/minor-unit assumption applies (e.g. 2-dp decimal, single currency), and what does `account` minimally carry (an id, a balance, a currency)? What exactly should the return value contain: the posted interest amount and the new balance, and anything else (e.g. an accrual breakdown or a posting date)?

Once I have these I'll write the full requirements catalogue and save it as `spec.md`.
A: Answers in order:

1. **Day-count convention:** Actual/360 — daily rate = annual_rate ÷ 360.

2. **Compounding:** Daily compounding — each day's accrued interest joins the balance and earns from the next day onward within the period.

3. **Daily balance:** End-of-day (closing) balance. [default, not policy]

4. **Rounding:** Truncate (floor) to 2 dp at the final total — the bank retains any sub-minor-unit fraction. Not half-up.

5. **Negative balances:** The account model does not permit an overdrawn state, so negative balances do not arise. No debit rate applies.

6. **Tiered rates:** Single flat rate. [default, not policy]

7. **Rate changes mid-period:** The rate can change within a period. Each day uses the rate in force on that day; interest is computed per rate-segment and summed.

8. **Period boundaries:** Half-open [start, end) — the posting day is excluded from the period it closes and included in the next. Posting occurs quarterly on the anniversary of account opening, not on calendar quarter-ends.

9. **Missing days:** Carry forward the last known balance. [default, not policy]

10. **Currency and return shape:** 2-decimal-place single currency. [default, not policy] Return per posting: gross interest, tax withheld, net interest posted, average daily balance used, number of qualifying days, updated balance.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Answer 10 surfaced two things the brief never mentioned and that I can't guess: **tax withholding** and **qualifying days**. A few follow-ups to close those out, plus one consistency check on how truncation meets daily compounding.

11. **Withholding tax rate & basis.** What rate is withheld, and on what? For example: a flat rate (what percentage?) applied to the **gross interest at posting**. Is the rate fixed, or can it vary (by period, or by anything else)?

12. **Tax and the compounding base.** Within the period, daily compounding adds each day's accrued interest to the balance. Does it compound on the **gross (pre-tax)** accrual, with tax withheld only once at posting on the period's total gross? Or should the daily compounding be on the **post-tax** amount?

13. **Qualifying days.** Answer 10 asks for a count of "qualifying days", which implies some days don't qualify. What makes a day **not** qualify for interest (e.g. days before the account is funded, days with a zero balance, the excluded posting day, something else)?

14. **What truncation applies to.** You said truncate the final total to 2 dp. Of the reported figures (gross, tax withheld, net), which are truncated to 2 dp, and is the **balance updated by the net** interest? I'll assume full precision is retained right up to posting, where gross is truncated to 2 dp, tax computed from that, net = gross − tax, and the balance increases by net; correct me if the order differs.

15. **Tax rounding.** How is the withheld tax amount rounded to 2 dp: same truncation (floor), or a rounding mode (and if so, in whose favour)?

That should be everything. Once you confirm, I'll write `spec.md`.
A: 11. **Withholding tax rate and basis:** 15% flat rate, applied to the gross interest at posting. The rate is fixed — it does not vary by period or any other factor. The net (gross minus withheld) is credited to the account; the tax withheld is reported separately.

12. **Tax and the compounding base:** Compounding within the period is on the gross (pre-tax) accrual. Tax is withheld once, at posting, on the period's total gross interest. There is no intra-period tax deduction.

13. **Qualifying days:** A day qualifies if the end-of-day balance is at or above 1,000 (the minimum balance threshold). On a day below that threshold, the day contributes zero to accrued interest but still counts in the divisor for the average daily balance calculation. So non-qualifying days are days where the closing balance is below 1,000 — not the excluded posting day, and not zero-balance days treated specially beyond that same threshold.

14. **Truncation order:** Your proposed order is correct. Full precision is carried through to posting. Gross interest is then truncated (floored) to 2 dp. Tax withheld = 15% of that truncated gross, rounded per question 15 below. Net = gross − tax withheld. The account balance increases by the net.

15. **Tax rounding:** Truncate (floor) to 2 dp. [default, not policy]

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is done. Saved as `spec.md` in this directory.

It captures the nine policy decisions you pinned down as the binding calculation rules in §5, cross-referenced from the functional requirements, constraints, and non-functional requirements:

- **Actual/360** day count, **daily compounding on gross**, **end-of-day** balances
- **£1,000 minimum-balance threshold** governing qualifying days (with non-qualifying days still counting in the average-daily-balance divisor)
- **Mid-period rate changes** honoured per day
- **Half-open [start, end)** period, **quarterly posting on the opening anniversary**
- **Truncate-to-floor** for both gross interest and tax, in the exact order you confirmed
- **Fixed 15% withholding** on truncated gross, net credited to the balance
- **Carry-forward** for gaps, **no overdraft**, single-currency 2 dp
- The six-field `PostingResult` return shape

Two things worth flagging:

Your answer to Q10 introduced **tax withholding** and **qualifying days**, neither of which was in the brief. I've folded both in as first-class rules rather than treating them as afterthoughts.

I've left three items in §10 for your confirmation, because they're genuine residual ambiguities the answers didn't fully settle. The main one: whether the £1,000 test and the average-daily-balance figure should use the *working* end-of-day balance (closing balance plus interest compounded so far) or the transactional closing balance alone. Daily compounding makes those two diverge, so it affects results. I've assumed the working balance (§4, A1/A2) and noted it. Tell me if you'd rather it were the transactional balance and I'll adjust.
A: Use the transactional closing balance — the balance as it stands from customer transactions alone, before any intra-period compounded interest is added. [default, not policy] The minimum-balance test and the average-daily-balance divisor both operate on that figure. Compounded interest joins the principal conceptually for the purpose of earning further interest within the period, but it does not alter the transactional balance used for the £1,000 threshold check or the ADB computation.

### Round 4
_Step reasoning:_ (live agent turn)

Q: Updated. `spec.md` now reflects the transactional/working split throughout:

- **Accrual and compounding** still run on the working balance (transactional closing balance plus prior compounded gross interest), so interest earns interest within the period.
- **The £1,000 qualification test** (§5.4) and **the average-daily-balance divisor** (§5.9) both operate on the **transactional closing balance** alone, before any compounded interest.

I've reworked the two-balance definition in §4 (A1), the accrual and ADB rules, the worked example (ADB is now 2,000.00, not 2,000.20), and removed that item from the open-items list. Two items remain in §10 for your call: idempotency of a repeated posting (NFR-004) and handling of a period not aligned to a posting anniversary (NFR-005).

The specification is complete and saved as `spec.md`.
A: Two open items:

NFR-004 — **Idempotency of a repeated posting.** A posting for a period that has already been posted should be rejected as an error (do not post twice). [default, not policy]

NFR-005 — **Period not aligned to a posting anniversary.** If the period supplied does not end on the account's posting anniversary, reject it as an error rather than posting a partial or misaligned period. [default, not policy]

### Round 5
_Step reasoning:_ (live agent turn)

Q: Both decisions are folded in and the open-items section is cleared.

The specification is complete and saved as `spec.md`. It now settles every material policy the brief left unstated:

- **Repeated posting** (NFR-004) is rejected as an error, never credited twice.
- **A period whose end isn't the posting anniversary** (NFR-005) is rejected rather than posted as a partial or misaligned period, alongside the existing negative-balance and `end ≤ start` checks.

`spec.md` covers the interface and data model, the ten calculation rules in §5 (Actual/360, daily compounding on the working balance, the transactional-balance basis for the £1,000 threshold and the average daily balance, mid-period rate changes, half-open period, quarterly anniversary posting, floor-truncation of gross and 15% tax, carry-forward for gaps, no overdraft), 15 functional requirements, 7 NFRs, 10 constraints, and a worked example. Nothing remains open.
A: Confirmed. Specification complete.

## Produced specification

# Requirements specification — savings account interest engine

## 1. Overview

The interest engine computes the interest a savings account earns over a period from its daily
balance history and its annual interest rate, withholds tax, and posts the net amount to the
account. The core interface is:

```
post_interest(account, period) -> PostingResult
```

`post_interest` accrues interest day by day across the period, compounds it daily, truncates and
taxes the total at posting, credits the net to the account balance, and returns a breakdown.

This document is the authoritative statement of behaviour. Every policy below was confirmed with
the product stakeholder; the ones marked *(default)* were stakeholder-confirmed defaults rather
than deliberate institutional policy, and are equally binding.

## 2. Scope

In scope: single-account interest accrual over one period, daily compounding, a minimum-balance
qualification rule, mid-period rate changes, withholding tax, and the posting result.

Out of scope: transaction processing, statement generation, multi-currency conversion, overdraft
handling (the account model forbids overdrawn states), and scheduling of when `post_interest` is
invoked. The engine computes and posts for the period it is given.

## 3. Data model and interface

### 3.1 Inputs

`account` carries at minimum:

| Field           | Type            | Notes                                                            |
|-----------------|-----------------|------------------------------------------------------------------|
| `id`            | identifier      | Account identifier.                                              |
| `balance`       | decimal(2)      | Current posted balance, single currency, 2 decimal places.      |
| `opened_on`     | date            | Account opening date; posting anniversaries derive from it.     |
| `balance_history` | ordered series | End-of-day (closing) balances keyed by date. May contain gaps.  |
| `rate_schedule` | series          | Annual interest rate(s) in force by date; supports mid-period changes. |

`period` is a half-open date interval `[start, end)` — see §5.6.

### 3.2 Output — `PostingResult`

| Field                   | Type       | Meaning                                                          |
|-------------------------|------------|------------------------------------------------------------------|
| `gross_interest`        | decimal(2) | Total interest accrued over the period, truncated to 2 dp.       |
| `tax_withheld`          | decimal(2) | Withholding tax deducted at posting.                             |
| `net_interest`          | decimal(2) | Amount credited to the account (`gross_interest − tax_withheld`).|
| `average_daily_balance` | decimal    | Mean end-of-day balance across all days in the period.          |
| `qualifying_days`       | integer    | Count of days whose end-of-day balance met the threshold.       |
| `updated_balance`       | decimal(2) | Account balance after crediting `net_interest`.                  |

## 4. Assumptions and residual interpretations

These fill gaps the stakeholder answers did not fully resolve. They are binding but flagged for
confirmation, since a different reading would change results.

- **A1 — Two balance figures.** Each day has two figures. The **transactional closing balance** is
  the end-of-day balance from customer transactions alone, before any intra-period compounded
  interest. The **working balance** is the transactional closing balance plus all gross interest
  accrued on prior qualifying days in the period. The working balance is the base for accrual and
  compounding (§5.2, §5.3). The transactional closing balance is what the £1,000 qualification test
  (§5.4) and the average-daily-balance computation (§5.9) operate on. Compounded interest earns
  further interest within the period but never alters the transactional balance used for those two.
- **A2 — Balance credited.** `net_interest` is added to `account.balance` as it stands at posting.
- **A3 — Amounts are exact decimals.** All intermediate accrual is carried at full decimal
  precision; rounding happens only where §5.7 and §5.8 specify.

## 5. Business rules — the interest calculation

These rules are the heart of the specification. FR-xxx requirements in §6 reference them by number.

### 5.1 Day-count convention — Actual/360
The daily rate for a given day is `annual_rate_for_that_day / 360`. Actual calendar days are
counted; the divisor is always 360 regardless of calendar or leap year.

### 5.2 Per-day accrual
For each day `d` in the period, the day's gross interest is `working_balance(d) × (rate(d) / 360)`,
where `rate(d)` is the annual rate in force on `d` (§5.5) and `working_balance(d)` is the day's
transactional closing balance plus prior compounded interest per A1. Non-qualifying days accrue
zero (§5.4).

### 5.3 Daily compounding on gross
Interest compounds daily on the **gross (pre-tax)** accrual. Each day's gross interest joins the
balance and earns interest from the following day onward, within the period. There is no
intra-period tax deduction; tax is withheld once at posting (§5.8).

### 5.4 Minimum balance threshold — qualifying days
A day **qualifies** if its **transactional closing balance** (before compounded interest, per A1)
is at or above **1,000** (the minimum balance threshold). A qualifying day accrues interest per
§5.2. A day below the threshold contributes **zero** to accrued interest, but still counts toward
the average-daily-balance divisor (§5.9). No other condition disqualifies a day; zero-balance days
are treated only by this same threshold.

### 5.5 Rate changes within the period
The annual rate may change during the period. Each day uses the rate in force on that day.
Interest is computed per rate-segment and summed; no averaging of rates across segments.

### 5.6 Period boundaries — half-open `[start, end)`
The period includes `start` and excludes `end`. The posting day (`end`) is excluded from the
period it closes and belongs to the next period. Posting occurs **quarterly on the anniversary of
the account opening date**, not on calendar quarter-ends.

### 5.7 Truncation of gross interest
The period's total gross interest is carried at full precision, then **truncated (floored) to 2
decimal places** to produce `gross_interest`. The bank retains any sub-minor-unit fraction.
Truncation is floor, never round-half-up.

### 5.8 Withholding tax
Tax is withheld once, at posting, at a **fixed flat rate of 15%** applied to the **truncated**
`gross_interest`. The computed tax is **truncated (floored) to 2 decimal places** to produce
`tax_withheld`. The rate does not vary by period or any other factor.

Order of operations at posting:
1. `gross_interest = floor(total_accrued, 2)`
2. `tax_withheld = floor(0.15 × gross_interest, 2)`
3. `net_interest = gross_interest − tax_withheld`
4. `updated_balance = account.balance + net_interest`

### 5.9 Average daily balance
`average_daily_balance = (sum of transactional closing balances over all days in the period) /
(number of days in the period)`. The transactional closing balance (before compounded interest,
per A1) is used, not the working balance. Every day in the period counts in the divisor, including
non-qualifying days.

### 5.10 Missing days in the history *(default)*
Where the balance history has gaps, **carry forward the last known end-of-day balance** until the
next recorded balance. Carried-forward days are treated as ordinary days for qualification and
accrual.

### 5.11 Negative balances
The account model does not permit an overdrawn state, so negative balances do not arise. No debit
rate applies. Input that presents a negative balance is invalid (§6, NFR-005).

### 5.12 Currency *(default)*
A single currency with 2 decimal places (minor units). No conversion is performed.

## 6. Functional requirements

| ID     | Title                        | User Story                                                                                                                                              | Priority | Status |
|--------|------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|----------|--------|
| FR-001 | Post interest for a period   | As the interest engine, I want to compute and post interest for an account over a period so that the account is credited its net earned interest.        | High     | Open   |
| FR-002 | Actual/360 day count         | As the interest engine, I want to derive each day's rate as annual ÷ 360 so that accrual follows the institution's day-count convention (§5.1).          | High     | Open   |
| FR-003 | Per-day accrual              | As the interest engine, I want to accrue interest on each day's end-of-day balance so that interest reflects the actual balance held (§5.2).             | High     | Open   |
| FR-004 | Daily compounding on gross   | As the interest engine, I want each day's gross interest to join the balance and earn from the next day so that interest compounds daily (§5.3).         | High     | Open   |
| FR-005 | Minimum balance threshold    | As the institution, I want days below the 1,000 threshold to accrue zero interest so that only qualifying balances earn (§5.4).                          | High     | Open   |
| FR-006 | Count qualifying days        | As an auditor, I want the count of qualifying days reported so that I can reconcile which days earned interest (§5.4).                                    | Medium   | Open   |
| FR-007 | Mid-period rate changes      | As the institution, I want each day to use the rate in force on that day so that rate changes within a period are honoured (§5.5).                       | High     | Open   |
| FR-008 | Half-open period             | As the interest engine, I want the period treated as [start, end) so that the posting day is excluded from the period it closes (§5.6).                  | High     | Open   |
| FR-009 | Quarterly anniversary posting| As the institution, I want interest posted quarterly on the account-opening anniversary so that posting cadence matches the product terms (§5.6).        | High     | Open   |
| FR-010 | Truncate gross to 2 dp       | As the institution, I want the period's gross interest floored to 2 dp so that the bank retains the sub-minor-unit fraction (§5.7).                      | High     | Open   |
| FR-011 | Withhold tax at posting      | As the tax authority, I want 15% withheld on the truncated gross at posting so that the correct tax is deducted once per posting (§5.8).                 | High     | Open   |
| FR-012 | Credit net to balance        | As the account holder, I want the net interest credited to my balance so that my account reflects what I earned after tax (§5.8).                        | High     | Open   |
| FR-013 | Carry forward missing days   | As the interest engine, I want gaps in the balance history filled by the last known balance so that every day in the period has a balance (§5.10).       | Medium   | Open   |
| FR-014 | Average daily balance        | As an auditor, I want the average daily balance over all period days reported so that I can verify the accrual base (§5.9).                              | Medium   | Open   |
| FR-015 | Posting result breakdown     | As an auditor, I want gross, tax withheld, net, average daily balance, qualifying days, and updated balance returned so that a posting is fully explained (§3.2). | High     | Open   |

## 7. Non-functional requirements

| ID      | Title                  | Requirement                                                                                                              | Category      | Priority | Status |
|---------|------------------------|------------------------------------------------------------------------------------------------------------------------|---------------|----------|--------|
| NFR-001 | Deterministic result   | Given identical inputs, `post_interest` must return byte-identical results across runs and platforms.                    | Reliability   | High     | Open   |
| NFR-002 | Exact decimal arithmetic | Accrual must use fixed/decimal arithmetic (no binary floating point) so results are exact to the specified rounding.    | Correctness   | High     | Open   |
| NFR-003 | Rounding fidelity      | Only the two truncations in §5.7 and §5.8 may lose precision; all other steps retain full precision.                     | Correctness   | High     | Open   |
| NFR-004 | Idempotent posting     | A posting for a period that has already been posted must be rejected as an error; interest must never be credited twice for the same period. | Correctness   | High     | Open   |
| NFR-005 | Input validation       | Invalid input (negative balance, `end` ≤ `start`, or a period whose `end` is not the account's posting anniversary) must be rejected with a clear error, not silently mis-posted or posted as a partial period. | Robustness    | High     | Open   |
| NFR-006 | Performance            | A single posting over a period of up to 366 days must complete in under 50 ms on commodity hardware.                     | Performance   | Medium   | Open   |
| NFR-007 | Auditability           | Every returned figure must be reproducible from the inputs and the rules in §5 without hidden state.                     | Auditability  | High     | Open   |

## 8. Constraints

| ID    | Title                    | Constraint                                                                                          | Category  | Priority | Status |
|-------|--------------------------|----------------------------------------------------------------------------------------------------|-----------|----------|--------|
| C-001 | Day-count convention     | Accrual must use Actual/360 (divisor 360, actual days counted).                                     | Business  | High     | Open   |
| C-002 | Compounding method       | Interest must compound daily on the gross (pre-tax) accrual within the period.                      | Business  | High     | Open   |
| C-003 | End-of-day balance basis | The daily balance used is the end-of-day (closing) balance.                                         | Business  | High     | Open   |
| C-004 | Truncation policy        | Gross interest and tax withheld must be truncated (floored) to 2 dp; no round-half-up.              | Business  | High     | Open   |
| C-005 | Withholding tax rate     | Tax is a fixed flat 15% on truncated gross interest, withheld at posting.                           | Business  | High     | Open   |
| C-006 | Minimum balance threshold| The qualifying threshold is a fixed 1,000 end-of-day balance.                                       | Business  | High     | Open   |
| C-007 | No overdraft             | The account model forbids overdrawn/negative balances; no debit interest exists.                    | Business  | High     | Open   |
| C-008 | Posting cadence          | Interest posts quarterly on the account-opening anniversary, not on calendar quarter-ends.          | Business  | High     | Open   |
| C-009 | Period interval          | The period is half-open [start, end); the posting day belongs to the next period.                   | Technical | High     | Open   |
| C-010 | Single currency, 2 dp    | Amounts are a single currency with 2 decimal places (minor units); no conversion.                   | Technical | High     | Open   |

## 9. Worked example (illustrative)

A 3-day period `[2026-01-01, 2026-01-04)`, flat annual rate 3.6% (daily = 0.036 / 360 = 0.0001),
transactional closing balance of 2,000 each day, no gaps, all days qualifying (2,000 ≥ 1,000).
Accrual base is the working balance (transactional + prior compounded gross); qualification and
ADB use the transactional balance:

- Day 1: base 2,000.000000 → interest 0.200000 → running gross 0.200000
- Day 2: base 2,000.200000 → interest 0.200020 → running gross 0.400020
- Day 3: base 2,000.400020 → interest 0.200040 → running gross 0.600060

Posting:
- `gross_interest = floor(0.600060, 2) = 0.60`
- `tax_withheld = floor(0.15 × 0.60, 2) = floor(0.09, 2) = 0.09`
- `net_interest = 0.60 − 0.09 = 0.51`
- `average_daily_balance = (2000.00 + 2000.00 + 2000.00) / 3 = 2000.00` (transactional, not working)
- `qualifying_days = 3`
- `updated_balance = 2000.00 + 0.51 = 2000.51`

(Figures illustrate the rules and rounding order; they are not test fixtures.)

## 10. Open items for stakeholder confirmation

All previously open items are now resolved and reflected above (see NFR-004 and NFR-005). No open
items remain.


## Auditor verdict

_The spec covers the method/convention decisions well (compounding daily #2, quarterly-anniversary posting #3, 360 basis #4, 1,000 threshold #5, floor rounding #6, 15% withholding #7, half-open boundary #12, mid-period rate handling #13, output shape #14 all correct), but it misses the headline method decision: #1 uses per-day daily-balance accrual rather than average daily balance applied once, so it is incorrect. All three lifecycle decisions (#8 dormancy, #9 mid-period closure, #10 escheatment) are entirely absent. #11 is surfaced but only partially resolved (no negative-rate rejection). Correct: 10/14. Of the core in-focus six [1,2,3,8,9,10], only #2 and #3 are correct — method coverage is strong on conventions but the central calculation method and the whole lifecycle path were not captured._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | no | §5.2 "For each day d in the period, the day's gross interest is working_balance(d) × (rate(d) / 360)"; §5.3 daily compounding; ADB appears only as a reported figure in §5.9. | The spec computes interest by per-day daily-balance accrual with daily compounding, not by averaging the daily balances and applying the rate once to that average. Average daily balance is only a reporting output, not the calculation method. This is exactly the per-day approach the reference says is NOT correct. |
| 2 | yes | **yes** | §5.3 "Interest compounds daily on the gross (pre-tax) accrual. Each day's gross interest joins the balance and earns interest from the following day onward, within the period." | Daily compounding within the period matches the reference exactly. |
| 3 | yes | **yes** | §5.6 / FR-009 / C-008 "Posting occurs quarterly on the anniversary of the account opening date, not on calendar quarter-ends." | Quarterly posting on the account-opening anniversary matches the reference precisely, including the explicit exclusion of calendar quarter-ends. |
| 4 | yes | **yes** | §5.1 / C-001 "The daily rate for a given day is annual_rate_for_that_day / 360 ... the divisor is always 360 regardless of calendar or leap year." | Actual/360 with divisor 360 matches the reference's 360 basis exactly. |
| 5 | yes | **yes** | §5.4 "A day qualifies if its transactional closing balance ... is at or above 1,000 ... A day below the threshold contributes zero ... but still counts toward the average-daily-balance divisor (§5.9)." | Threshold of 1,000, zero contribution below it, and continued inclusion in the ADB divisor all match the reference exactly. |
| 6 | yes | **yes** | §5.7 / C-004 "truncated (floored) to 2 decimal places ... The bank retains any sub-minor-unit fraction. Truncation is floor, never round-half-up." | Floor rounding to 2 dp with the bank keeping the fraction matches the reference exactly. |
| 7 | yes | **yes** | §5.8 "Tax is withheld once, at posting, at a fixed flat rate of 15%"; §3.2 reports tax_withheld and net_interest separately. | 15% withholding at posting, net credited to the account, and tax reported separately all match the reference. (Applying 15% to truncated gross is a rounding-order detail, not a mismatch on the tax decision itself.) |
| 8 | no | no | absent | The spec never mentions dormancy, a 12-month inactivity trigger, continued accrual while dormant, or a monthly dormancy fee. The lifecycle decision is entirely unaddressed. |
| 9 | no | no | absent | The spec does not address account closure mid-period, pro-rata accrual to the closure date, or posting net-of-withholding on closure. Closure is not in scope or the rules. |
| 10 | no | no | absent | The spec makes no mention of escheatment, a 5-year dormancy threshold, remittance to the state, or closing to zero balance. The lifecycle decision is entirely unaddressed. |
| 11 | yes | no | §5.11 / C-007 / NFR-005 "the account model does not permit an overdrawn state ... Input that presents a negative balance is invalid"; §5.4 zero-balance days contribute zero via the threshold. | The spec covers no-overdraft and rejects negative balances, and zero-balance days yield zero interest via the threshold. But it never states that a negative rate is rejected, nor that a whole-period zero balance records a zero posting as a no-op, so the resolution is only partial and not a full match. |
| 12 | yes | **yes** | §5.6 / C-009 "The period includes start and excludes end. The posting day (end) is excluded from the period it closes and belongs to the next period." | Half-open [start, end) with the posting day excluded from the closing period and included in the next matches the reference exactly. |
| 13 | yes | **yes** | §5.5 / FR-007 "Each day uses the rate in force on that day. Interest is computed per rate-segment and summed; no averaging of rates across segments." | Each day using the in-force rate, computed per rate-segment and summed, matches the reference. (The spec's per-day base differs from the reference's average-balance base, but the rate-change handling itself matches.) |
| 14 | yes | **yes** | §3.2 / FR-015 PostingResult returns gross_interest, tax_withheld, net_interest, average_daily_balance, qualifying_days, updated_balance. | All six reported figures — gross, tax withheld, net, average daily balance, qualifying days, updated balance — are present, matching the reference output shape exactly. |
