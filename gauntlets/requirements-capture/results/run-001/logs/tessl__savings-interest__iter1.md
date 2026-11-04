# tessl — savings-interest — iteration 1

Model (author): claude-opus · Questions asked: 8 · Captured: 7/14 · Bespoke captured: 6/10

## Conversation

### Round 1
_Step reasoning:_ Following one-question-at-a-time, I start with the highest-impact gap: the core interest computation method (day-count basis and compounding), which no competent model can reliably infer.

Q: How should the daily interest be computed from the annual rate: do you divide the annual rate by a fixed day count (and if so, 360, 365, or actual days in the year), and is interest compounded on the running balance daily or simply accrued and posted once at the end of the period?
A: The daily rate is annual_rate / 360 (fixed 360-day basis). Interest compounds daily within the period: each day's accrued interest is added to the running balance before the next day's accrual, so the base grows day by day. The compounded total is then posted at the end of the period, not dripped in daily postings.

### Round 2
_Step reasoning:_ Day-count and compounding are settled; rounding policy is the next high-impact, non-inferable decision (per-day rounding versus round-at-post materially changes the result) so I ask it singly per the one-question-at-a-time rule.

Q: When interest is compounded daily, do you round each day's accrued interest (and the running balance) to the currency's smallest unit, e.g. the cent, before the next day's accrual, or do you carry full precision through the whole period and round only the final posted figure to the cent?
A: Carry full precision through the entire period; do not round each day's accrued interest or the running balance to the minor unit mid-period. Round only the final posted figure, flooring to 2 decimal places. [default, not policy for the intra-period precision rule; the floor-at-posting rule is policy]

### Round 3
_Step reasoning:_ Core-behaviour gap remains: how the supplied daily balance history interacts with daily compounding is material and cannot be safely inferred, so I ask that before edge cases.

Q: The account carries a daily balance history for the period, yet interest compounds on a running balance you grow day by day. How do these two combine: for each day's accrual, do you apply the daily rate to that day's balance from the history plus the interest accrued so far (history balance + running accrued interest), or does the running compounded balance from prior days' interest override the supplied history, so the history is used only for the first day and thereafter you accrue on the internally grown balance?
A: Apply the daily rate to the history balance for that day plus the running accrued interest accumulated so far — that is, option A. The customer's balance history drives the principal base each day; the compounding effect comes from adding prior days' accrued interest on top of that day's history balance before computing the next day's accrual. The history is not discarded after day one; it is the authoritative source of the principal component every day throughout the period.

### Round 4
_Step reasoning:_ Core interface behaviour: the returned updated balance is still undefined (which base it builds on and whether it uses the floored posted figure), so I must resolve it before edge cases.

Q: The function returns the account's updated balance alongside the posted interest. How is that updated balance defined: is it the final day's balance from the supplied history plus the floored posted interest, or is it the internally grown running balance (history-plus-accrued) at period end, and either way is the value you return the already-floored, rounded-to-the-cent figure?
A: The updated balance is the final day's balance from the supplied history plus the net interest posted — that is, history balance plus the floored, after-withholding figure that was credited to the account. The internally grown running balance is a computation artefact used only to derive the gross interest; it does not become the returned balance. The value you return is already in its final, floored-to-the-cent form, since the net posted amount has already been floored before being added. [default, not policy for the precise definition of 'final day history balance'; the floor-at-posting and net-of-withholding rules are policy]

### Round 5
_Step reasoning:_ Round 4 introduced a net-of-withholding policy but left the withholding rate, its order relative to the floor step, and its own rounding entirely unspecified — a material policy gap I cannot infer.

Q: You've mentioned that what's credited is the net interest 'after withholding' and that this net-of-withholding rule is policy, but the withholding itself hasn't been defined: what is the withholding rate, is it applied to the gross compounded interest before the floor-to-2dp step or after it, and is the withheld tax amount itself rounded (and if so, floored, rounded half-up, to how many decimal places) so that net = gross minus withholding reconciles exactly to the cent?
A: The withholding rate is 15%, applied to the gross compounded interest. The order of operations and rounding of the tax amount itself are not defined policy: a reasonable default is to compute tax = gross × 0.15 at full precision, subtract from gross to get net at full precision, then floor the net to 2 decimal places before crediting — the bank retains the sub-cent remainder as it does with the interest floor. The withheld tax amount reported separately is then gross (full precision) minus the floored net, so net + tax withheld = gross exactly by construction. [withholding rate and gross-interest basis are policy; order of floor vs withholding step and tax rounding rule are default, not policy]

### Round 6
_Step reasoning:_ Core interest and withholding policy is settled; the remaining material ambiguity is how the period selects days from the history and how boundary and degenerate cases (missing days, empty or single-day periods, out-of-range periods) are handled.

Q: How does the `period` argument relate to the daily balance history: does `period` define a start/end date range that selects a sub-window of the history (accruing only over days within the period), and how should the function behave at the boundaries — is the end day inclusive, what happens if the history has missing days within the period (carry forward the last known balance, treat as zero, or error), and what is the defined result for a degenerate period (empty history, a single day, or a period that falls outside the history's range)?
A: The `period` argument defines a half-open date range [start, end) that selects a sub-window of the daily balance history: the start day is included, the end day is excluded. This boundary rule is policy (the posting day is excluded from the period it closes and included in the next). The function accrues over each day d where start ≤ d < end, looking up that day's balance from the supplied history. For missing days within the period [default, not policy]: carry forward the last known balance from any earlier day in the history; if no prior balance exists at all, treat the missing day's balance as zero. That day still counts in the divisor for average-daily-balance purposes (consistent with the minimum-balance rule, which counts sub-threshold days in the divisor). For degenerate cases [default, not policy]: an empty history or a period that falls entirely outside the history's range produces zero gross interest and records a zero posting (consistent with the zero-balance no-op rule); a single-day period [start, start+1) accrues normally for that one day; a period where start ≥ end is rejected as invalid input.

### Round 7
_Step reasoning:_ The answers repeatedly invoke a minimum-balance/average-daily-balance rule and a zero-balance no-op rule as established policy, yet neither has been defined; these gate whether interest is earned and are material, so I must clarify them before finishing.

Q: Your last two answers referenced a 'minimum-balance rule' (sub-threshold days still counting in the divisor), an 'average-daily-balance' calculation, and a 'zero-balance no-op rule' — but none of these has actually been defined. Could you specify them: is there a minimum average daily balance the account must maintain over the period to earn any interest at all, and if so, what is the threshold, how is the average computed (sum of each day's history balance across the period divided by the day count, including sub-threshold and carried-forward days), and what happens when the account falls below it — is all interest forfeited (zero posting), or is it reduced? And what exactly is the 'zero-balance no-op' condition that produces a zero posting?
A: The minimum balance threshold is 1,000 in the account currency. It is a per-day rule, not a period-level average threshold: interest accrues only on days when that day's balance (from the history, including any carried-forward value) is at or above 1,000. On a sub-threshold day, that day contributes zero to interest accrual — the daily rate is not applied — but the day still counts in the divisor when the average daily balance is computed for reporting purposes. There is no mechanism by which falling below the threshold on some days forfeits the entire period's interest; only those specific sub-threshold days are excluded from accrual. The average daily balance reported in the output is the sum of each day's history balance across the period (all days, including sub-threshold and carried-forward days, at their raw balance values) divided by the total day count in the period. The zero-balance no-op condition is when the account's balance is zero for the entire period, or equivalently when no day in the period has a qualifying balance at or above the threshold, producing zero gross interest. In that case a zero posting is still recorded rather than omitted: gross interest, tax withheld, and net posted are all zero, and the updated balance equals the closing history balance unchanged.

### Round 8
_Step reasoning:_ Core computation, tax, boundaries, and threshold rules are settled, but the output contract and posting side effect remain undefined: prior answers introduced reported figures (gross, tax withheld, average daily balance) whose place in the return value and whether 'posting' mutates the account are still ambiguous.

Q: What exactly does the function return and what side effect does 'posting' have on the account: is the return a structured result carrying the net interest posted, the gross interest, the tax withheld, and the average daily balance (all the reported figures introduced above) plus the updated balance, or only the two values named in the signature (interest posted, updated balance)? And does post_interest mutate the account in place (writing a ledger/posting entry, updating the stored balance) or is it a pure computation that returns the new values without altering the passed-in account?
A: The function returns a structured result carrying: gross interest, tax withheld, net interest posted, the average daily balance used, the number of qualifying days, and the updated balance. Whether post_interest mutates the account in place or is a pure computation is not defined policy — a reasonable default is to treat it as a pure function returning the structured result, leaving any ledger write or balance update to the caller. [return shape is policy; mutation vs pure-function question is default, not policy]

### Round 9 (process signalled done)
_Step reasoning:_ All material policy decisions (day count, compounding, precision/floor, principal base, updated-balance definition, withholding, period boundaries, minimum-balance rule, zero-balance no-op, return shape) have been confirmed across eight rounds with no ambiguous requirements remaining.

(no questions this round)

## Produced specification

# Requirements specification: `post_interest(account, period)`

Status: confirmed with stakeholder. This document captures every decision settled during the requirement-gathering interview. Items are marked **[policy]** where the institution has picked a specific rule, and **[default]** where the rule was not defined policy and a reasonable default was agreed. Nothing here is inferred beyond what the stakeholder confirmed.

## Scope

### Included

- Computing the interest a savings account earns over a period from a daily balance history and an annual interest rate.
- Daily compounding of accrued interest within the period.
- A per-day minimum-balance qualification rule.
- Withholding tax on the gross interest.
- A single end-of-period posting of the net interest.
- A structured result reporting the figures below and the updated balance.

### Excluded

- Any ledger write or persistence side effect. `post_interest` does not mutate the account; the caller owns any balance update or posting entry **[default]**.
- Daily/intermediate postings. Interest is posted once, at the end of the period **[policy]**.
- Currency conversion, multi-currency handling, and cross-account behaviour.
- Anything not settled in the interview (see "Open items" — none remain).

## Inputs

- `account`: carries a daily balance history over the period and an annual interest rate. The history is the authoritative source of the principal balance for every day in the period.
- `period`: a half-open date range `[start, end)`.

## Core behaviour (happy path)

### 1. Period window and day enumeration

- `period` defines a half-open range `[start, end)`: the start day is **included**, the end day is **excluded** **[policy]**. The posting day is excluded from the period it closes and included in the next.
- The function accrues over each day `d` with `start ≤ d < end`, looking up that day's balance from the supplied history.

### 2. Daily rate

- `daily_rate = annual_rate / 360` — a fixed 360-day basis **[policy]**.

### 3. Daily balance lookup

For each day `d` in the period, determine that day's history balance:

- Use the balance recorded for `d` in the history.
- If `d` is missing from the history, carry forward the last known balance from an earlier day in the history **[default]**.
- If no prior balance exists at all, treat that day's balance as zero **[default]**.

### 4. Minimum-balance qualification (per day)

- The minimum balance threshold is **1,000** in the account currency **[policy]**.
- This is a per-day rule, not a period-level average threshold.
- A day **qualifies** for accrual when its balance (from the history, including any carried-forward value) is **at or above 1,000**.
- On a sub-threshold day the daily rate is not applied: that day contributes zero to interest accrual. It does not forfeit the rest of the period's interest; only that specific day is excluded from accrual.

### 5. Daily compounding

Interest compounds daily on a running accrued-interest figure grown day by day, with the history balance supplying the principal component each day **[policy]**:

- Maintain a running total of accrued interest, `accrued`, starting at 0.
- For each qualifying day `d` (in date order):
  - `base = history_balance(d) + accrued`
  - `day_interest = base * daily_rate`
  - `accrued = accrued + day_interest`
- For each sub-threshold day, `accrued` is unchanged (no accrual added). The running accrued interest is never discarded; it simply does not grow on non-qualifying days.
- The compounding effect comes from adding prior days' accrued interest on top of each day's history balance before computing that day's accrual (option A). The history is the authoritative principal component every day; it is not discarded after day one.

After the last day, `gross = accrued` is the gross compounded interest for the period.

### 6. Precision

- Carry **full precision** through the entire period. Do not round each day's accrued interest or the running balance to the minor unit mid-period **[default]**.
- Rounding happens only at the final posting steps below **[policy for the floor-at-posting rule]**.

### 7. Withholding tax

- The withholding rate is **15%**, applied to the **gross compounded interest** **[policy: rate and gross-interest basis]**.
- Order of operations and tax rounding **[default]**:
  - `tax_full = gross * 0.15` at full precision.
  - `net_full = gross - tax_full` at full precision.
  - `net = floor(net_full, 2)` — floor the net to 2 decimal places before crediting. The bank retains the sub-cent remainder, consistent with the interest floor.
  - `tax_withheld = gross - net` (gross at full precision minus the floored net). By construction `net + tax_withheld = gross` exactly to the cent.
- `net` is the net interest posted (credited to the account).

### 8. Posting and updated balance

- The net interest `net` is posted once, at the end of the period.
- `updated_balance = final_day_history_balance + net` **[policy: floor-at-posting and net-of-withholding]**, where `final_day_history_balance` is the final day's balance from the supplied history **[default for the precise definition of 'final day history balance']**.
- The internally grown running balance (history-plus-accrued) is a computation artefact used only to derive the gross interest; it does not become the returned balance.
- The returned `updated_balance` is already in final, floored-to-the-cent form, since `net` was floored before being added.

### 9. Average daily balance (reporting)

- `average_daily_balance = sum over all days in the period of that day's history balance / total day count in the period` **[default]**.
- All days are included at their raw balance values: sub-threshold days and carried-forward days count in both the numerator (at their raw balance) and the divisor. This is consistent with the per-day rule that sub-threshold days still count in the divisor.

### 10. Qualifying-day count (reporting)

- `qualifying_days = the number of days in the period whose balance is at or above the 1,000 threshold`.

## Return shape

`post_interest` returns a structured result **[policy]** carrying:

- `gross_interest`: the gross compounded interest for the period.
- `tax_withheld`: `gross - net`.
- `net_interest_posted`: `net`, the floored, after-withholding figure credited to the account.
- `average_daily_balance`: the average daily balance used, as defined above.
- `qualifying_days`: the number of qualifying days.
- `updated_balance`: final day's history balance plus `net`.

`post_interest` is a **pure function** returning this result and does not mutate the passed-in `account`; any ledger write or stored-balance update is left to the caller **[default]**.

## Edge cases and boundary conditions

- **Single-day period** `[start, start+1)`: accrues normally for that one day (subject to the qualification rule).
- **Invalid period** where `start ≥ end`: rejected as invalid input **[default]**.
- **Empty history**, or a **period falling entirely outside the history's range**: produces zero gross interest and records a zero posting **[default]**.
- **Missing days within the period**: carry forward the last known earlier balance; if none exists, treat as zero. The day still counts in the average-daily-balance divisor **[default]**.
- **Zero-balance no-op**: when the account's balance is zero for the entire period, or equivalently when no day in the period has a qualifying balance at or above the threshold, gross interest is zero. A zero posting is still recorded rather than omitted: `gross_interest`, `tax_withheld`, and `net_interest_posted` are all zero, and `updated_balance` equals the closing history balance unchanged **[policy: zero posting still recorded; default: the conditions]**.

## Constraints

- Fixed 360-day count basis for the daily rate **[policy]**.
- Full intra-period precision; floor to 2 decimal places only at posting **[floor: policy; intra-period precision: default]**.
- 15% withholding on gross interest, net floored to 2 dp before crediting, `net + tax_withheld = gross` reconciling exactly to the cent **[rate and basis: policy; order and tax rounding: default]**.
- 1,000-currency-unit per-day minimum balance for accrual **[policy]**.
- Half-open `[start, end)` period boundary **[policy]**.
- No side effects; pure computation **[default]**.

## Success criteria

- Every decision above is either a confirmed institution policy or an explicitly agreed default. No ambiguous requirements remain.
- No behaviour has been invented beyond the stakeholder's answers and the brief.

## Auditor verdict

_7 of 14 decisions correct (coverage 0.50): #2, #4, #5, #6, #7, #12, #14. The spec excels at the convention/threshold/rounding/tax/boundary/output controls but fails the core method and lifecycle subset. On method: it captures daily compounding (#2) but implements per-day daily-balance compounding rather than the reference's average-daily-balance-applied-once (#1 wrong), never specifies quarterly anniversary posting (#3 wrong), and ignores mid-period rate changes (#13 absent). The entire lifecycle path is missing: dormancy (#8), closure mid-period (#9), and escheatment (#10) are absent. Edge case #11 is partially matched (zero-balance no-op present) but lacks negative-rate rejection and no-overdraft. Of the core in-focus six [1,2,3,8,9,10], only #2 is correct, showing method and lifecycle coverage did not generalise to this savings domain._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | no | Section 5 'Daily compounding': 'base = history_balance(d) + accrued; day_interest = base * daily_rate; accrued = accrued + day_interest'; section 9 computes average_daily_balance only '(reporting)'. | The reference method is average daily balance with the rate applied ONCE to the averaged balance. The spec instead applies the rate per-day with compounding (explicitly 'option A', per-day daily-balance) and uses the average only as a reported figure, so the calculation method does not match. |
| 2 | yes | **yes** | Section 5: 'Interest compounds daily on a running accrued-interest figure grown day by day'; 'Daily compounding of accrued interest within the period.' | Reference calls for daily compounding within the period, which the spec states explicitly. |
| 3 | yes | no | 'A single end-of-period posting of the net interest'; 'Interest is posted once, at the end of the period [policy]'. No mention of quarterly or anniversary. | The spec addresses posting cadence but treats 'period' as an opaque input and posts once at its end. It never states quarterly posting on the account-opening anniversary, so the reference value is not matched. |
| 4 | yes | **yes** | Section 2: 'daily_rate = annual_rate / 360 — a fixed 360-day basis [policy]'. | Reference specifies 360-day basis with daily rate = annual_rate/360; spec states this exactly. |
| 5 | yes | **yes** | Section 4: threshold '1,000', 'A day qualifies for accrual when its balance ... is at or above 1,000'; sub-threshold day 'contributes zero'. Section 9: sub-threshold days 'count in both the numerator ... and the divisor'. | Matches the reference: accrual only on days at/above 1,000, below contributes zero, yet still counts in the average-balance divisor. |
| 6 | yes | **yes** | Section 7: 'net = floor(net_full, 2)'; 'The bank retains the sub-cent remainder, consistent with the interest floor'; constraints: 'floor to 2 decimal places only at posting'. | Reference requires posted interest floored (never half-up) to 2 dp with the bank keeping the fraction; the spec floors and states the bank retains the remainder. |
| 7 | yes | **yes** | Section 7: 'The withholding rate is 15%, applied to the gross compounded interest'; return shape reports 'tax_withheld' separately and 'net_interest_posted' credited. | Matches reference: 15% withheld from gross at posting, net credited, tax reported separately. |
| 8 | no | no | absent | The spec contains no dormancy concept: no 12-month inactivity trigger, no continued accrual while dormant, and no monthly dormancy fee of 5. |
| 9 | no | no | absent | The spec never addresses account closure mid-period or pro-rata accrual to a closure date; posting is only end-of-period. |
| 10 | no | no | absent | No escheatment: nothing about a 5-year dormant period, remittance to the state, or zeroing the balance. |
| 11 | yes | no | 'Zero-balance no-op': gross/tax/net all zero, 'A zero posting is still recorded rather than omitted'; 'Invalid period where start >= end: rejected'. No mention of negative rate rejection or no-overdraft. | The spec matches the zero-balance no-op-with-recorded-zero-posting portion, but the reference answer also requires rejecting a negative rate and never going negative (no overdraft), neither of which the spec states, so the full compound answer is not matched. |
| 12 | yes | **yes** | Section 1: 'half-open range [start, end): the start day is included, the end day is excluded'; 'The posting day is excluded from the period it closes and included in the next.' | Exact match to the reference half-open [start, end) boundary and posting-day handling. |
| 13 | no | no | absent; inputs specify 'an annual interest rate' (singular) and section 2 uses a single annual_rate. | The spec assumes one fixed rate for the period and gives no rule for mid-period rate changes or per-rate-segment computation. |
| 14 | yes | **yes** | Return shape: 'gross_interest', 'tax_withheld', 'net_interest_posted', 'average_daily_balance', 'qualifying_days', 'updated_balance'. | All six reference output fields are present: gross, tax withheld, net posted, average daily balance used, qualifying-day count, and updated balance. |
