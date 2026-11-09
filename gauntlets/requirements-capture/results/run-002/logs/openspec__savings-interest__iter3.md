# openspec — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 11 · Captured: 5/14 · Bespoke captured: 3/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: The structured prompt didn't go through. Let me ask directly — these are the material policy decisions I need from you as the product stakeholder before I can write a correct spec. Each has several plausible answers and I don't want to guess.

**1. Day-count convention** — how does the annual rate become a daily rate?
- (a) Actual/365 — `annual/365` every day (common for GBP retail savings)
- (b) Actual/Actual — divide by 365 or 366 depending on the calendar year
- (c) Actual/360
- (d) Fixed 365.25 divisor

**2. Compounding within a posting period** — does accrued interest earn interest before it's posted?
- (a) Simple — `interest = Σ(daily balance) × daily_rate`
- (b) Daily compound — each day's accrual is added to the running balance

**3. Rounding** — precision, when, and mode?
- (a) Round to cents once at posting, half-up
- (b) Round to cents once at posting, banker's (half-even)
- (c) Round each day to cents, then sum
- (d) Truncate to cents at posting

**4. Rate units** — is the `annual interest rate` argument a percent (`5.0` = 5%) or a decimal fraction (`0.05` = 5%)?

**5. Period boundaries / which days count** — for a period, is it inclusive of both start and end dates, inclusive-start/exclusive-end, or exclusive-start/inclusive-end? And which balance applies on a given day (the closing balance for that calendar day)?

**6. Negative balances (overdraft days)** — if a day's balance is negative, do you (a) floor at zero / skip it, (b) accrue negative interest (a debit), or (c) treat it as an error?

**7. A few smaller ones** (tell me if any matter, otherwise I'll record a stated assumption):
- Is the rate constant for the whole period (the brief implies one rate)?
- If the daily balance history has gaps, carry the last known balance forward?
- Does `post_interest` add the posted interest to the balance (so it becomes principal) and return `(interest_posted, new_balance)`?
- Currency/minor units — plain 2-decimal currency, or something else?

Once you give me these, I'll write the spec and save it as `spec.md` in this directory.
A: Answers in order:

**1. Day-count convention:** Actual/360 — option (c). Daily rate = annual_rate / 360.

**2. Compounding:** Daily compound — option (b). Each day's accrual joins the running base before the next day's calculation.

**3. Rounding:** Truncate (floor) at posting — option (d). Round down to 2 dp at the moment of posting; the bank retains the fraction. Never half-up.

**4. Rate units:** Percent — 5.0 means 5%. [default, not policy]

**5. Period boundaries:** Half-open [start, end). The start date is included; the posting/end date is excluded and opens the next period. Balance for a given day is the closing balance for that calendar day. [closing-balance rule is default, not policy]

**6. Negative balances:** The account never goes negative — this product has no overdraft facility. If a day's balance is somehow negative, treat it as an error at the input boundary. Within normal operation, floor at zero; a zero-balance day contributes zero to accrual but still counts in the period divisor (consistent with the minimum-balance treatment).

**7. Smaller ones:**
- Rate is NOT assumed constant. Each day uses the rate in force on that day; compute interest per rate-segment and sum.
- Gaps in balance history: carry the last known balance forward. [default, not policy]
- post_interest: yes, add the net posted interest to the balance (it becomes principal) and return the full posting record. [default, not policy]
- Currency: standard 2-decimal (cent/penny). [default, not policy]

### Round 2
_Step reasoning:_ (live agent turn)

Q: The specification is done. It's saved as `spec.md` in this directory.

A note on what I did and why: the brief was deliberately underspecified, so before writing anything I asked you the material policy questions rather than guessing. Your answers are all encoded as numbered requirements (R1–R11) with a canonical algorithm, validation rules, and a worked numeric example that acts as an acceptance anchor.

The confirmed policies, faithfully captured:
- **Actual/360** day-count (annual% / 100 / 360 per day)
- **Daily compounding** within the period, realised as a single posting
- **Truncate/floor to 2 dp at posting only** — full-precision accrual, never half-up; the bank retains the fraction
- **Rate percent** units (`5.0` = 5%)
- **Half-open `[start, end)`** period; closing balance per day
- **No overdraft** — negative daily balance is an input-boundary error; zero-balance days contribute zero but still count
- **Per-day rate in force** (rate can change; computed per rate-segment and summed)
- Carry-forward on gaps; posted interest added to balance as principal; standard 2-decimal currency

**One item I flagged rather than silently decided** (§6 / R8): your "no overdraft / zero-balance day contributes zero" rule and your "daily compound" rule can disagree on a day where the balance is zero but interest has already accrued earlier in the period. I took your wording literally (that day adds zero; compounding resumes when the balance is positive again) and marked it as an open item for your confirmation. If accrued interest should instead keep compounding on zero-balance days, tell me and I'll adjust R8 and the algorithm.

One procedural note: you asked for `spec.md` in this directory, so I honored that explicitly rather than the default OpenSpec change layout (`specs/<capability>/spec.md` plus proposal/design/tasks). If you'd also like the full OpenSpec change scaffold generated around this, I can do that on request.
A: Your literal interpretation is correct — a zero-balance day contributes zero accrual and compounding resumes when the balance turns positive. No adjustment to R8 needed.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in this directory, with no open items remaining.

The R8 × R5 precedence is now recorded as confirmed policy: a zero-balance day contributes zero accrual and does not compound accrued interest; compounding resumes when the balance turns positive.

All material policy decisions are captured as requirements with a canonical algorithm and a worked acceptance example:
- **Actual/360** day-count
- **Daily compounding**, posted once at period end
- **Truncate to 2 dp at posting only** — bank retains the fraction, never half-up
- **Percent** rate units; **per-day rate in force** (rate may change, computed per segment)
- **Half-open `[start, end)`** period, closing balance per day
- **No overdraft** — negative balance is an input error; zero-balance days contribute zero but still count toward the period
- Carry-forward on gaps; posted interest added to balance as principal; standard 2-decimal currency

It is done.
A: Confirmed. Specification complete.

## Produced specification

# Savings Interest Engine — Specification

## 1. Purpose

Compute and post the interest a savings account earns over a posting period, given the
account's daily balance history and the annual interest rate(s) in force during that period.

The engine exposes a single operation:

```
post_interest(account, period) -> posting_record
```

It returns the interest posted and the account's updated balance (as part of a posting
record), and it adds the posted interest to the account balance as new principal.

All numeric policy below (day-count, compounding, rounding, boundaries, negative-balance
handling) reflects decisions confirmed by the product stakeholder. Where a detail was
labelled a default rather than a policy, it is marked **[default]**; where it is a
deliberate institutional policy, it is marked **[policy]**.

---

## 2. Interface

### 2.1 Inputs

- `account` — the savings account. Relevant fields:
  - `balance` — the account's current/live balance in minor-unit-precise currency
    (2 decimal places). The net posted interest is added to this value.
  - `balance_history` — the closing balance for each calendar day. May be sparse; see
    §4.3 (carry-forward). Balances are 2-decimal currency amounts.
  - access to the applicable **dated rate schedule** (see `period` / §4.4). The function
    signature carries only `account` and `period`, so the annual rate(s) in force are
    resolved from the schedule associated with the account's product.

- `period` — the posting period being closed. Relevant fields:
  - `start` — first calendar day of the period (**included**).
  - `end` — the posting date (**excluded**); it opens the next period. See §4.1.

### 2.2 Output — posting record

`post_interest` returns a posting record containing at least:

| Field | Meaning |
|---|---|
| `interest_posted` | The interest credited to the account, truncated to 2 dp (§4.5). |
| `new_balance` | `account.balance + interest_posted`. |
| `period_start`, `period_end` | The half-open period actually settled. |
| `days_counted` | Number of calendar days accrued = `end - start`. |
| `gross_accrued` | The full-precision accrued interest before truncation (audit). |
| `fraction_retained` | `gross_accrued - interest_posted` (retained by the bank, §4.5). |

### 2.3 Side effect

The account balance is increased by `interest_posted` (the posted interest becomes
principal). **[default]** No other mutation occurs. The function is the system of record
for the posting event via the returned posting record.

---

## 3. Definitions

- **Calendar day `d`** — a single date in the period.
- **Closing balance for day `d`** — the account balance as at the end of day `d`, taken
  from `balance_history` (carried forward where missing, §4.3). **[default]**
- **Rate in force on day `d`** — the annual rate from the dated rate schedule that is
  effective on day `d` (most recent rate effective on or before `d`). §4.4.
- **Daily rate for day `d`** — `rate_in_force(d) / 100 / 360` (§4.2, §4.4).
- **Accrued interest** — interest computed day-by-day at full precision, not yet posted.
- **Running base** — the balance that earns interest on a given day: the day's closing
  balance plus accrued interest carried within the period (§4.6).

---

## 4. Requirements

### R1 — Period is half-open `[start, end)`  **[policy]**

- Accrual covers every calendar day `d` with `start <= d < end`.
- The `start` date **is** accrued; the `end`/posting date **is not** — it is the first day
  of the next period.
- `days_counted = end - start` (in whole days).

*Acceptance:* For `start = 2026-01-01`, `end = 2026-02-01`, interest accrues for the 31
days 2026-01-01 … 2026-01-31; 2026-02-01 earns nothing in this period.

### R2 — Day-count convention: Actual/360  **[policy]**

- The daily rate is the annual rate (as a fraction) divided by **360**, every day,
  regardless of the calendar year or its length.
- `daily_rate(d) = (rate_in_force(d) / 100) / 360`.
- Leap years receive no special treatment in the divisor; a 365- or 366-day span still
  divides each day's rate by 360.

### R3 — Rate units: percent  **[default]**

- The annual rate is expressed as a percent: `5.0` means 5% per annum. It is divided by
  100 before use (hence `/100/360` in R2).

### R4 — Rate is not constant; each day uses the rate in force  **[policy]**

- The rate may change within a period. Each day `d` uses the annual rate in force on `d`
  per the dated rate schedule.
- Equivalently, the period is partitioned into rate-segments (maximal runs of days sharing
  one rate) and interest is computed per segment and summed; the daily loop in §4.6
  satisfies this because it reads the rate afresh each day.
- Where the schedule has no explicit entry for `d`, the most recent rate effective on or
  before `d` applies. **[default]**

### R5 — Daily compounding within the period  **[policy]**

- Interest compounds daily: each day's accrued interest joins the running base before the
  next day's calculation, so later days in the period earn interest on earlier days'
  accrued (but not-yet-posted) interest.
- Interest does **not** post mid-period; compounding is internal to the accrual and is
  realised as a single posting at `end`.

### R6 — Rounding: truncate (floor) to 2 dp at posting only  **[policy]**

- Accrual is performed at **full precision** throughout the period (no per-day rounding).
- At the moment of posting, the total accrued interest is **truncated** (rounded toward
  zero) to 2 decimal places: `interest_posted = floor_to_2dp(gross_accrued)`.
- Rounding is **never** half-up or half-even. The fractional remainder
  (`gross_accrued - interest_posted`) is **retained by the bank** and is not credited.

*Acceptance:* `gross_accrued = 4.16724...` → `interest_posted = 4.16` (not 4.17);
`fraction_retained = 0.00724...`.

### R7 — No overdraft; negative daily balances are invalid  **[policy]**

- The product has no overdraft facility; the account balance never goes negative in normal
  operation.
- If any day's closing balance is negative, this is an **input-boundary error**: the
  function rejects the input (validation error) rather than computing interest.
- For accrual purposes a balance is floored at zero: a floored/zero balance earns nothing.

### R8 — Zero-balance days contribute zero but still count  **[policy]**

- A day whose closing balance is zero contributes **zero** interest for that day.
- The day is still counted as a day of the period (it occupies its place in the day
  sequence / Actual-360 timeline); it is not skipped.
- **R5 interaction (confirmed policy):** where a day's closing balance is zero but interest
  has already accrued earlier in the period, that day adds **zero** accrual — accrued
  interest does not itself grow on a zero-balance day — and daily compounding (R5) resumes
  once the balance turns positive again. This precedence (R8 over R5 on zero-balance days)
  is confirmed by the stakeholder.

### R9 — Carry balances forward across gaps  **[default]**

- If `balance_history` has no entry for a day within the period, the most recent known
  prior closing balance is carried forward.
- If the first day of the period has no entry, the closing balance carried into the period
  (the balance as at `start`) is used.

### R10 — Posting adds net interest to the balance  **[default]**

- `new_balance = account.balance + interest_posted`, and the account balance is updated to
  `new_balance`.
- "Net" interest here equals the truncated posted amount; no tax, withholding, or fee is
  applied by this engine. **[default]**

### R11 — Currency precision  **[default]**

- Amounts are standard 2-decimal currency (cents/pence). Posted interest is a 2-dp amount;
  intermediate accrual is full precision.

---

## 4.6 Canonical algorithm

```
post_interest(account, period):
    validate(account, period)              # see §5

    accrued = 0                            # full precision

    for each calendar day d in [period.start, period.end):     # R1, half-open
        cb = closing_balance(account, d)   # R9 carry-forward
        if cb < 0:
            error("negative balance")      # R7
        if cb == 0:
            interest_d = 0                 # R8
        else:
            base_d = cb + accrued          # R5 daily compounding on the running base
            daily_rate = (rate_in_force(d) / 100) / 360   # R2, R3, R4
            interest_d = base_d * daily_rate              # full precision, R6
        accrued = accrued + interest_d

    interest_posted = truncate_to_2dp(accrued)            # R6 floor, bank keeps remainder
    new_balance = account.balance + interest_posted       # R10
    account.balance = new_balance

    return posting_record(
        interest_posted, new_balance,
        period.start, period.end,
        days_counted = (period.end - period.start),
        gross_accrued = accrued,
        fraction_retained = accrued - interest_posted,
    )
```

---

## 5. Validation & error handling

- **Negative daily balance** → reject (R7).
- **`end <= start`** → zero-length or invalid period: no days accrue; `interest_posted = 0`
  and `new_balance = account.balance`. (A strictly invalid `end < start` should be rejected
  as an input error.)
- **Missing rate for a day with no prior schedule entry** → input error (no rate can be
  resolved). Otherwise carry the most recent effective rate (R4).
- **Missing balance with no prior entry at or before `start`** → input error (no balance to
  carry forward, R9).

---

## 6. Worked example (acceptance anchor)

Inputs:
- `period.start = 2026-01-01`, `period.end = 2026-01-04` → days 01-01, 01-02, 01-03
  (3 days; 01-04 excluded, R1).
- Closing balance = `10000.00` on all three days.
- Rate in force = `5.0` (5%) on all three days. `daily_rate = 0.05 / 360 = 0.0001388888…`

Day-by-day (full precision, R5/R6):

| Day | running base = cb + accrued | interest_d | accrued |
|---|---|---|---|
| 01-01 | 10000.00000000 | 1.38888888889 | 1.38888888889 |
| 01-02 | 10001.38888889 | 1.38908179012 | 2.77797067901 |
| 01-03 | 10002.77797068 | 1.38927471815 | 4.16724539716 |

- `gross_accrued = 4.16724539716`
- `interest_posted = truncate_to_2dp(4.16724539716) = 4.16`  (R6 — **not** 4.17)
- `fraction_retained = 0.00724539716`
- `new_balance = account.balance + 4.16`

This example distinguishes the chosen policy from common alternatives: half-up rounding
would give `4.17`; simple (non-compounding) interest would give
`3 × 10000 × 0.05/360 = 4.16666… → 4.16` here, so a longer period or larger balance is
needed to separate simple from compound — but the rounding and day-count policies are
exercised directly.

---

## 7. Out of scope

- Tax / withholding on interest.
- Fees, bonuses, tiered/stepped rates by balance band (only dated rate changes over time
  are in scope, R4).
- Overdraft / negative-balance interest (the product has none, R7).
- Mid-period partial postings or statement generation beyond the returned posting record.
- Persistence/transaction mechanics beyond updating `account.balance`.

---

## 8. Confirmed policy summary

| # | Decision | Value |
|---|---|---|
| 1 | Day-count convention | Actual/360 (R2) **[policy]** |
| 2 | Compounding | Daily compound within the period (R5) **[policy]** |
| 3 | Rounding | Truncate/floor to 2 dp at posting only; bank retains fraction (R6) **[policy]** |
| 4 | Rate units | Percent, `5.0` = 5% (R3) **[default]** |
| 5 | Period boundaries | Half-open `[start, end)`; closing balance per day (R1) **[policy / default]** |
| 6 | Negative balances | No overdraft; negative → input error; floor at zero; zero day = zero accrual but still counts (R7, R8) **[policy]** |
| 7a | Rate constancy | Not constant; rate in force per day, per rate-segment (R4) **[policy]** |
| 7b | Balance gaps | Carry last known balance forward (R9) **[default]** |
| 7c | Posting | Add net posted interest to balance; return posting record (R10) **[default]** |
| 7d | Currency | Standard 2-decimal (R11) **[default]** |

### R8 × R5 precedence (confirmed)
- On a zero-balance day with interest already accrued, that day contributes **zero**
  accrual; accrued interest does not compound on a zero-balance day. Compounding resumes
  when the balance turns positive. Confirmed by the stakeholder — no open items remain.


## Auditor verdict

_The spec is a numerically rigorous average-interest engine for a single given period, but it is scoped narrowly to accrual mechanics and matches only 5 of 14 reference decisions (2, 4, 6, 12, 13). It uses per-day daily-balance compounding rather than the reference's average daily balance (#1 wrong), and it omits or explicitly de-scopes the entire lifecycle and output surface: posting frequency/anniversary (#3), minimum-balance threshold (#5), withholding tax (#7, out of scope), dormancy (#8), mid-period closure (#9, out of scope), escheatment (#10), and the mandated reporting shape incl. tax withheld, average daily balance and qualifying days (#14). Edge handling (#11) is partially right (no overdraft, zero-balance no-op) but silent on negative-rate rejection. Coverage = 5/14; notably it misses 5 of the 6 core in-focus method/lifecycle decisions (gets #2 only; misses #1, #3, #8, #9, #10)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | no | §4.6 loop: `base_d = cb + accrued; daily_rate = (rate_in_force(d)/100)/360; interest_d = base_d * daily_rate`; R5 'each day's accrued interest joins the running base'. | The spec computes per-day daily-balance interest (rate applied to each day's balance, compounded), not average daily balance (sum balances / days, rate applied once to the average). Reference requires average daily balance and explicitly excludes per-day daily-balance, so this is a different method. |
| 2 | yes | **yes** | R5 'Daily compounding within the period … each day's accrued interest joins the running base before the next day's calculation'. | Reference requires daily compounding within the period; the spec states exactly daily compounding where each day's interest joins the base for the next day. |
| 3 | no | no | absent — `period` is an input with `start`/`end`; `end` is 'the posting date' but frequency is never defined. No mention of quarterly or anniversary of account opening. | The spec takes the posting period as a given input and never resolves the posting frequency; it does not state quarterly posting on the account-opening anniversary. |
| 4 | yes | **yes** | R2 'Day-count convention: Actual/360 … the annual rate … divided by 360, every day'; §3 'Daily rate … rate_in_force(d)/100/360'. | Reference requires a 360 days-in-year basis with daily rate = annual/360; the spec states Actual/360 and divides by 360. |
| 5 | no | no | absent — no minimum-balance threshold; R8 addresses only zero-balance days, with no 1,000 floor for earning interest. | The spec has no minimum-balance-to-earn-interest rule; there is no 1,000 threshold below which a day contributes zero interest while still counting in the divisor. |
| 6 | yes | **yes** | R6 'the total accrued interest is truncated (rounded toward zero) to 2 decimal places … Rounding is never half-up … retained by the bank'; acceptance 4.16724→4.16. | Reference requires floor/truncate to 2 dp with the bank keeping the fraction; the spec states exactly truncate-toward-zero, never half-up, fraction retained by the bank. |
| 7 | no | no | §7 'Out of scope: Tax / withholding on interest'; R10 'no tax, withholding, or fee is applied by this engine'. | Reference requires a 15% withholding tax deducted at posting with net credited and tax reported. The spec explicitly excludes tax/withholding rather than resolving it, so the decision is neither addressed nor matched. |
| 8 | no | no | absent — no dormancy fields, dormancy fee, or inactivity period anywhere in the spec. | The spec does not address dormancy at all; there is no 12-month inactivity trigger, no continued accrual while dormant, and no monthly dormancy fee of 5. |
| 9 | no | no | §7 'Out of scope: Mid-period partial postings'; the engine only posts at the period `end`. | Reference requires pro-rata accrual to a mid-period closure date, posted net of withholding. The spec explicitly puts mid-period partial postings out of scope and never handles account closure. |
| 10 | no | no | absent — no escheatment, state remittance, or multi-year-dormant handling in the spec. | The spec does not address escheatment; there is no 5-year-dormant trigger, no remittance to the state, and no zero-balance closure of unclaimed funds. |
| 11 | yes | no | R7 'no overdraft … negative → input-boundary error … floored at zero'; R8 'zero … contributes zero'; §5 validation. No handling of a negative annual rate. | The spec correctly covers no-overdraft and zero-balance-earns-nothing, but the reference also requires rejecting a negative rate as invalid, which the spec never states; the decision is only partly resolved. |
| 12 | yes | **yes** | R1 'Period is half-open [start, end) … The end/posting date is not [accrued] — it is the first day of the next period'. | Reference requires the posting day excluded from the closing period and included in the next, with half-open [start, end); the spec states exactly this. |
| 13 | yes | **yes** | R4 'Each day d uses the annual rate in force on d … partitioned into rate-segments … computed per segment and summed'. | Reference requires each day to use the rate in force, computed per rate-segment and summed; the spec states exactly this and notes the daily loop satisfies it. |
| 14 | yes | no | §2.2 output: `interest_posted`, `new_balance`, period dates, `days_counted`, `gross_accrued`, `fraction_retained`. No tax withheld, no average daily balance, no qualifying-days count. | Reference requires the posting record to disclose gross interest, tax withheld, net posted, the average daily balance used, and the number of qualifying days. The spec's record omits tax withheld, the average daily balance, and qualifying days (days_counted is all calendar days, not threshold-qualifying days). |
