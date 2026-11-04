# superpowers — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 16 · Captured: 9/14 · Bespoke captured: 6/10

## Conversation

### Round 1
_Step reasoning:_ The brief omits every material interest-calculation policy (day count, compounding, endpoint/balance basis, rounding, posting behaviour, negative balances); these cannot be reliably inferred, so I must ask the stakeholder before writing the spec.

Q: What day-count convention should the engine use for accruing daily interest (e.g. actual/365, actual/360, or actual/actual), and how are leap years handled?
A: 360-day year: the daily rate is annual_rate / 360. Leap years have no effect because the denominator is always 360, never the actual calendar day count.

Q: Is interest simple (rate applied to each day's balance and summed) or compounded, and if compounded, at what frequency (daily, monthly, at posting)?
A: Compounded daily: each day's accrued interest joins the balance used as the base for the next day's accrual within the period.

Q: Which balance counts for each day, the opening or closing balance, and are the first and last days of the period both included (inclusive/exclusive endpoints)?
A: Periods are half-open [start, end): the first day of the period is included; the posting day is excluded from the period it closes and falls in the next period instead. Which intra-day snapshot to use (opening vs closing balance) is not specified in policy; [default, not policy]: use the end-of-day (closing) balance for each calendar day.

Q: How should amounts be rounded: to what precision (e.g. whole cents), using which rounding mode (half-up, half-even/banker's), and is rounding applied per day or once at posting?
A: Rounded down (floor) to 2 decimal places (the minor unit), never half-up; the bank retains any sub-cent remainder. Rounding is applied once at posting, not per day.

Q: Should the posted interest be added to this same account's balance (so the returned updated balance = starting balance + interest), and does posted interest itself start earning interest?
A: Yes: posted interest is credited to this account — the returned updated balance is the prior balance plus the net amount posted. Yes: because interest compounds daily, the credited amount immediately joins the principal base for the following period.

Q: How are non-standard balances treated, specifically days with a zero or negative balance (no interest, or negative interest/charge)?
A: Zero balance: the day contributes zero to the interest numerator but still counts as a day in the average-balance divisor. Negative balance: the account never goes negative by policy, so this case does not arise. A negative rate is rejected as invalid input.

### Round 2
_Step reasoning:_ Core accrual mechanics are settled, but posting is a state change with unresolved idempotency, and rate-over-time and balance-history-coverage remain material policies a model cannot reliably infer.

Q: Is `post_interest(account, period)` idempotent, or does calling it twice for the same period post interest twice? Specifically, does the account record which periods have already been posted, and what should the function do if invoked again for an already-posted period (return zero, raise an error, or re-post)?
A: [default, not policy] The answer key does not define idempotency policy. Recommended default: the account records each posted period; a second call for an already-posted period raises an error rather than silently returning zero or re-posting, to make duplicate invocations visible rather than harmless.

Q: Is the annual interest rate fixed for the whole period, or can it change mid-period (either a scheduled rate change or balance-tiered rates)? If it can change, is the rate keyed to each calendar day like the balance history?
A: Rates can change mid-period. Each calendar day uses the rate in force on that day. When the rate changes one or more times within the period, compute the average-balance interest separately for each contiguous rate-segment and sum the results.

Q: How does the engine handle days in [start, end) that are missing from the supplied daily balance history: carry forward the last known balance, treat the gap as zero, or reject the input as incomplete?
A: [default, not policy] The answer key does not specify gap handling. Recommended default: reject the input as incomplete. The caller must supply a balance entry for every calendar day in [start, end); gaps are not silently filled, because silent carry-forward could mask data pipeline errors.

### Round 3
_Step reasoning:_ Two genuinely material ambiguities remain (the compounding-vs-average-balance method conflict and the undefined input/output data shapes) that policy has not resolved and cannot be safely inferred.

Q: The Round 1 answer says interest is compounded daily (each day's accrued interest joins the base for the next day), but the Round 2 rate-change answer says to compute the average-balance interest separately for each contiguous rate-segment and sum. These two methods differ. Which governs: daily compounding on the running balance, or average-balance-times-rate-times-days per segment? If both, how do they combine (e.g. compound daily within a segment, then sum segments)?
A: Daily compounding (#2) governs the operative mechanic; the average-balance framing in #1 and #13 labels the method but does not override the compounding rule. The two combine as follows: within each contiguous rate-segment, accrue interest day by day using daily compounding (each day's accrued interest joins the running balance as the base for the next day, using that segment's rate). When the rate changes, the running compound balance at the end of segment N becomes the starting balance for segment N+1, and daily compounding continues at the new rate. The per-segment results are therefore not independently averaged and summed after the fact; rather, compounding rolls forward through the period with each day drawing on whichever rate is in force on that day. The 'average daily balance' language describes the conceptual method name and the basis for the minimum-balance qualifying-days rule (#5), not a separate simple-interest formula that overrides the daily compounding mechanic.

Q: What are the exact shapes of the `account` and `period` inputs and of the return value? Specifically: how is the daily balance history keyed and typed (dates to minor-unit integers or decimals?), how is the annual rate supplied and keyed to days when it changes, and does the function return the account object mutated, a new account, or a (posted_interest, updated_balance) pair?
A: [default, not policy] Input shapes are not defined in policy. Recommended defaults: `account` carries at minimum an account identifier, the current balance (see unit answer below), and a log of prior postings keyed by period-start date to enforce idempotency. The daily balance history is supplied as a map from ISO-8601 date string to amount; the rate schedule is a list of {effective_date, annual_rate} records sorted ascending, where each entry applies from its date until the next entry. `period` is a {start, end} pair of ISO-8601 dates representing the half-open interval [start, end). The function returns a result object (not a mutated account); per policy (#14) that object contains: gross_interest, tax_withheld, net_interest_posted, average_daily_balance (the qualifying-day-weighted average used in reporting), qualifying_days (days at or above the 1,000 minimum balance threshold), and updated_balance (prior balance plus net_interest_posted).

Q: In what unit and type are money amounts represented and computed (integer minor units vs decimal), and given floor-to-2-decimals rounding once at posting, is the sub-cent remainder simply discarded or tracked anywhere on the account?
A: [default, not policy] The answer key specifies floor-to-2-dp rounding at posting and that the bank retains the sub-cent fraction (#6), but does not mandate an internal numeric type. Recommended default: represent all customer-facing money amounts as integer minor units (i.e. whole cents) for storage and I/O, and perform intermediate daily-compounding arithmetic in a high-precision decimal type (e.g. 28+ significant digits) to avoid float drift across 90 days of compounding. At posting, floor the accumulated gross interest to 2 decimal places; the sub-cent remainder is discarded and not tracked anywhere on the account. The bank's retention of that fraction is a revenue item recorded at the institution level, outside the scope of the account object.

### Round 4
_Step reasoning:_ The Round 3 answer revealed two material, institution-specific policies (withholding tax and a 1,000 minimum-balance qualifying-days rule) that were named but never elicited, so requirements capture is not yet complete.

Q: Round 3 introduced a result object with gross_interest, tax_withheld, and net_interest_posted, where updated_balance uses the net amount. What is the withholding-tax policy on posted interest: the rate, whether it is computed on gross interest, how it is rounded, when it is withheld, and whether it applies to every account or only under certain conditions?
A: 15% withholding tax is deducted from the gross interest at each posting. It is computed on the gross interest amount. The net amount credited to the account is gross_interest minus tax_withheld, and the tax withheld is reported separately rather than booked to the account. Withholding applies at every posting with no account-level exceptions stated in policy. Rounding of the tax amount itself is not specified in policy; [default, not policy]: floor the tax_withheld to 2 decimal places before subtracting, so both gross_interest and tax_withheld are each floored independently, and net_interest_posted = gross_interest_floored - tax_withheld_floored.

Q: Round 3 referenced a 'minimum-balance qualifying-days rule (#5)' with a 1,000 threshold and a qualifying-day-weighted average_daily_balance, which goes beyond the Round 1 zero/negative-balance answer. How does the 1,000 minimum-balance threshold affect the calculation: does interest accrue only on days with balance at or above 1,000 (and are sub-threshold days excluded from both numerator and the qualifying-day average), and is there a minimum count of qualifying days below which no interest is paid at all?
A: On days the balance is below 1,000, that day contributes zero to the interest numerator (no interest accrues) but still counts as a day in the divisor used for the period length. Sub-threshold days are therefore excluded from the numerator only; they remain in the denominator. The term 'qualifying days' in the Round 3 result shape refers to the count of days at or above the 1,000 threshold, reported for transparency, but the divisor for the average is always the total calendar days in [start, end), not the qualifying-day count. There is no stated minimum number of qualifying days below which interest is forfeited entirely; [default, not policy]: no such floor applies — even one qualifying day produces a non-zero gross interest amount, and zero qualifying days posts zero interest as a no-op per the zero-balance rule.

### Round 5
_Step reasoning:_ Round 4 still surfaced material, non-inferrable policy (withholding tax, the 1,000 threshold), so I keep probing the remaining genuine gaps: day-boundary/timezone semantics and exact rate-change alignment, both policy choices a model cannot reliably infer, before treating requirements as complete.

Q: For keying each balance and rate to a specific calendar day, what timezone or day-boundary definition governs (e.g. UTC, a fixed institutional timezone, or the account's local timezone), and at what wall-clock instant does one interest day roll into the next?
A: [default, not policy] Timezone and day-boundary are not defined in policy. Recommended default: use a single fixed institutional timezone (e.g. UTC) for all day boundaries. One interest day rolls into the next at midnight in that timezone. Balance history entries and rate effective_dates are interpreted as calendar dates in that same timezone; no account-level local timezone applies.

Q: When a rate change's effective_date falls inside the period, does the new rate apply from the start of that calendar day (so the whole day accrues at the new rate) or from some intra-day point, and if the effective_date does not coincide with a balance-history day boundary, how are the two schedules aligned?
A: [default, not policy] Intra-day rate-change alignment is not defined in policy. Recommended default: a rate change with a given effective_date applies from the start of that calendar day — the entire day accrues at the new rate. Because both the balance history and the rate schedule are keyed to calendar dates (not wall-clock instants), there is no intra-day alignment problem: for any calendar day in [start, end), the engine selects the rate whose effective_date is the latest date not exceeding that day, then uses the day's balance entry. The two schedules are aligned by calendar date lookup, so they remain consistent as long as both use the same timezone convention as answer 1.

### Round 6 (process signalled done)
_Step reasoning:_ All material policy decisions (day-count, daily compounding, half-open period, floor rounding, credit-and-compound, zero/negative handling, mid-period rate changes, 15% withholding tax, 1,000 minimum-balance qualifying-days rule) have been captured; the last two rounds returned only non-policy defaults, signalling saturation, so requirements gathering is complete.

(no questions this round)

## Produced specification

# Interest engine specification: `post_interest(account, period)`

## Purpose and scope

This document specifies the interest engine for the savings accounts product. Given an account with a daily balance history and an annual interest rate that may change over time, the engine computes the interest earned over a half-open period, applies withholding tax, posts the net amount to the account, and returns a structured result. The single public entry point is `post_interest(account, period)`.

The specification captures every policy decision confirmed with the stakeholder. Decisions that policy does not fix are marked **[default]** and resolved as the process dictates; these are recommended defaults, not institutional policy, and are called out so they can be overridden without reopening policy questions.

## Core computation

### Day-count convention

The engine uses a 360-day year. The daily rate for any calendar day is `annual_rate / 360`. Leap years have no effect: the denominator is always 360, never the actual calendar day count.

### Compounding

Interest compounds daily. Each day's accrued interest joins the running balance and forms the base for the next day's accrual within the period. Daily compounding on the running balance is the operative mechanic. The 'average daily balance' language used elsewhere in policy names the conceptual method and supplies the basis for the qualifying-days rule; it does not define a separate simple-interest formula and does not override daily compounding.

### Period endpoints

A period is the half-open interval `[start, end)`. The first day (`start`) is included. The posting day (`end`) is excluded from the period it closes; it falls into the next period instead. The divisor for period length is the total count of calendar days in `[start, end)`.

### Which balance counts per day

**[default]** For each calendar day the engine uses the end-of-day (closing) balance. Policy does not fix the intra-day snapshot; the closing balance is the recommended default.

### Operative daily algorithm

For each calendar day `d` in `[start, end)`, in ascending date order:

1. Select the rate in force on day `d` (see rate schedule below).
2. Take the day's balance from the balance history, reflecting interest already compounded into the running balance from prior days in the period.
3. Apply the minimum-balance rule:
   - If the balance is at or above the 1,000 minimum threshold, that day accrues interest of `balance * (rate / 360)`. This accrued interest joins the running balance and becomes part of the base for the following day.
   - If the balance is below 1,000, the day accrues zero interest. It contributes nothing to the interest numerator but still counts as one day in the period-length divisor.

When the rate changes within the period, compounding rolls forward continuously: the running compound balance at the end of one rate segment is the starting base for the next segment, and daily compounding continues at the new rate. Per-segment results are not independently averaged and summed after the fact; each day simply draws on whichever rate is in force on that day.

The sum of daily accruals across the period is the gross interest, computed before rounding.

## Rate schedule

The annual interest rate is not necessarily fixed for the whole period. Rates can change mid-period. Each calendar day uses the rate in force on that day.

**[default]** The rate schedule is supplied as a list of `{effective_date, annual_rate}` records sorted ascending by `effective_date`. Each entry applies from its effective date until the next entry's effective date. For any calendar day, the engine selects the rate whose `effective_date` is the latest date not exceeding that day.

**[default]** A rate change applies from the start of its effective calendar day: the entire day accrues at the new rate. Because both the balance history and the rate schedule are keyed to calendar dates rather than wall-clock instants, there is no intra-day alignment problem; the two schedules are aligned by calendar-date lookup.

A negative annual rate is rejected as invalid input.

## Minimum-balance qualifying-days rule

The minimum balance threshold is 1,000.

Days with a balance at or above 1,000 accrue interest as described above. Days below 1,000 accrue no interest: they are excluded from the interest numerator only and remain in the denominator (period length).

`qualifying_days` is the count of days at or above the 1,000 threshold. It is reported for transparency. The divisor for the reported average daily balance is always the total calendar days in `[start, end)`, never the qualifying-day count.

**[default]** There is no minimum number of qualifying days below which interest is forfeited entirely. Even a single qualifying day produces a non-zero gross interest amount. Zero qualifying days posts zero interest as a no-op, consistent with the zero-balance rule.

## Zero and negative balances

A zero-balance day contributes zero to the interest numerator but still counts as a day in the divisor. This is the same treatment as any sub-threshold day.

The account never goes negative by policy, so negative balances do not arise and no negative-interest or charge behaviour is defined. (A negative rate, distinct from a negative balance, is rejected as invalid input.)

## Withholding tax

A 15% withholding tax is deducted from the gross interest at every posting, with no account-level exceptions. The tax is computed on the gross interest amount. The net amount credited to the account is gross interest minus tax withheld. The tax withheld is reported separately and is not booked to the account.

**[default]** The tax amount is floored to 2 decimal places before subtraction. Gross interest and tax withheld are each floored independently, and `net_interest_posted = gross_interest_floored - tax_withheld_floored`.

## Rounding and money representation

Amounts are rounded down (floor) to 2 decimal places, the minor unit. Half-up rounding is never used. Rounding is applied once at posting, not per day. The bank retains any sub-cent remainder as an institution-level revenue item, outside the scope of the account object.

**[default]** Customer-facing money amounts are stored and exchanged as integer minor units (whole cents). Intermediate daily-compounding arithmetic is performed in a high-precision decimal type (28 or more significant digits) to avoid floating-point drift across the compounding period. At posting, the accumulated gross interest is floored to 2 decimal places; the sub-cent remainder is discarded and not tracked anywhere on the account.

## Posting and its effect on the account

Posted interest is credited to this same account. The returned updated balance is the prior balance plus the net amount posted (`updated_balance = prior_balance + net_interest_posted`).

Because interest compounds daily, the credited net amount immediately joins the principal base for the following period.

## Idempotency

**[default]** Policy does not define idempotency. The recommended default: the account records each posted period, keyed by period-start date. A second call for an already-posted period raises an error rather than silently returning zero or re-posting, so that duplicate invocations are visible rather than harmless.

## Missing balance data

**[default]** Policy does not define gap handling. The recommended default: reject the input as incomplete. The caller must supply a balance entry for every calendar day in `[start, end)`. Gaps are not silently carried forward or treated as zero, because silent filling could mask data-pipeline errors.

## Timezone and day boundaries

**[default]** Policy does not define timezone or day-boundary handling. The recommended default: a single fixed institutional timezone (for example, UTC) governs all day boundaries. One interest day rolls into the next at midnight in that timezone. Balance-history entries and rate effective dates are interpreted as calendar dates in that same timezone. No account-level local timezone applies. The balance and rate schedules stay consistent as long as both use this convention.

## Input and output shapes

**[default]** Policy does not define the input shapes. The recommended defaults:

- **`account`** carries at minimum: an account identifier; the current balance (stored in integer minor units); and a log of prior postings keyed by period-start date, used to enforce idempotency.
- **Daily balance history** is a map from ISO-8601 date string to amount, with one entry for every calendar day in `[start, end)`.
- **Rate schedule** is a list of `{effective_date, annual_rate}` records sorted ascending, each applying from its effective date until the next entry.
- **`period`** is a `{start, end}` pair of ISO-8601 dates representing the half-open interval `[start, end)`.

The function returns a result object rather than mutating and returning the account. The result object contains:

- `gross_interest`: the total interest accrued over the period, floored to 2 decimal places.
- `tax_withheld`: 15% of gross interest, floored to 2 decimal places.
- `net_interest_posted`: `gross_interest` minus `tax_withheld` (each already floored).
- `average_daily_balance`: the qualifying-day-weighted average used in reporting, with total calendar days in `[start, end)` as the divisor.
- `qualifying_days`: the count of days at or above the 1,000 minimum-balance threshold.
- `updated_balance`: the prior balance plus `net_interest_posted`.

## Validation and error handling

- A negative annual rate is rejected as invalid input.
- **[default]** A period already present in the account's posting log raises an error.
- **[default]** A balance history missing any calendar day in `[start, end)` is rejected as incomplete.
- Negative balances do not arise by policy and are not handled.

## Summary of policy versus default decisions

Policy-fixed: 360-day count with daily rate `annual_rate/360` and no leap-year effect; daily compounding on the running balance as the operative mechanic; half-open `[start, end)` periods; floor-to-2-dp rounding once at posting with the bank retaining the sub-cent; net interest credited to the same account with compounding into the next period; zero-balance days in the divisor but not the numerator; negative balances impossible and negative rates rejected; mid-period rate changes keyed per calendar day; 15% withholding on gross at every posting, reported separately.

Recommended defaults (not policy): closing-balance snapshot per day; error on duplicate posting; rejection of incomplete balance histories; result-object return shape and input shapes; integer minor units with high-precision intermediate decimals; independent flooring of gross and tax; no qualifying-days floor; fixed institutional timezone with midnight day boundaries; rate changes effective from the start of their calendar day.

## Auditor verdict

_Coverage 9/14. The spec nails the conventions and edge decisions (#4 360-day, #5 1,000 threshold, #6 floor rounding, #7 15% withholding, #11 zero/negative handling, #12 half-open boundary, #14 output shape) plus #2 daily compounding and #13 rate-in-force-per-day. It fails #1 by deliberately choosing daily compounding over the reference's average-daily-balance method, and omits the entire posting cadence (#3 quarterly on anniversary) and the lifecycle path entirely (#8 dormancy, #9 mid-period closure, #10 escheatment). Method coverage is partial and lifecycle coverage is absent._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | no | "Interest compounds daily. Each day's accrued interest joins the running balance... The 'average daily balance' language used elsewhere in policy names the conceptual method... it does not define a separate simple-interest formula and does not override daily compounding." | The reference method is average daily balance (average the daily balances, apply the rate once), explicitly NOT per-day compounding. The spec addresses the choice but deliberately resolves it as daily compounding on a running balance and expressly subordinates the average-balance language, so the resolution contradicts the reference. |
| 2 | yes | **yes** | "Compounding: Interest compounds daily. Each day's accrued interest joins the running balance and forms the base for the next day's accrual within the period." | Reference states interest compounds daily; the spec states daily compounding in the same terms. |
| 3 | no | no | absent | The reference fixes quarterly posting on the account-opening anniversary. The spec treats the posting period as a caller-supplied `period` input and never states any posting frequency or anniversary rule, so it is unaddressed. |
| 4 | yes | **yes** | "The engine uses a 360-day year. The daily rate for any calendar day is `annual_rate / 360`." | Reference basis is 360 with daily rate annual_rate/360; the spec states exactly this and excludes leap-year effects. |
| 5 | yes | **yes** | "If the balance is at or above the 1,000 minimum threshold, that day accrues interest... If the balance is below 1,000, the day accrues zero interest... but still counts as one day in the period-length divisor." | Matches the reference: threshold of 1,000, sub-threshold days contribute zero to the numerator but still count in the divisor. |
| 6 | yes | **yes** | "Amounts are rounded down (floor) to 2 decimal places, the minor unit. Half-up rounding is never used... The bank retains any sub-cent remainder." | Reference requires floor to 2 dp, never half-up, with the bank keeping the fraction; the spec states each of these. |
| 7 | yes | **yes** | "A 15% withholding tax is deducted from the gross interest at every posting... The net amount credited to the account is gross interest minus tax withheld. The tax withheld is reported separately." | Matches the reference: 15% withheld from gross at each posting, net credited, tax reported separately. |
| 8 | no | no | absent | The reference specifies dormancy after 12 months (interest still accrues, monthly fee of 5). The spec contains no mention of dormancy, dormancy fees, or inactivity tracking. |
| 9 | no | no | absent | The reference requires pro-rata interest accrued to the closure date and posted net on mid-period closure. The spec never addresses account closure or partial-period settlement. |
| 10 | no | no | absent | The reference specifies escheatment to the state after 5 years dormant. The spec has no escheatment, state-remittance, or long-dormancy provision. |
| 11 | yes | **yes** | "A negative annual rate is rejected as invalid input... Zero qualifying days posts zero interest as a no-op... The account never goes negative by policy." | Covers all three parts of the reference: negative rate rejected, zero-balance period posts a zero no-op, and no negative balance/overdraft. |
| 12 | yes | **yes** | "A period is the half-open interval `[start, end)`. The first day (`start`) is included. The posting day (`end`) is excluded from the period it closes; it falls into the next period instead." | Matches the reference: half-open periods, posting day excluded from the closing period and included in the next. |
| 13 | yes | **yes** | "Rates can change mid-period. Each calendar day uses the rate in force on that day." A negative annual rate is rejected. | The operative reference rule is that each day uses the rate in force on that day, which the spec states verbatim. The reference's 'per rate-segment and summed' phrasing is a consequence of the average-balance method (#1); the spec's continuous-compounding treatment differs there but satisfies the material per-day rate-in-force decision. |
| 14 | yes | **yes** | Result object contains `gross_interest`, `tax_withheld`, `net_interest_posted`, `average_daily_balance`, `qualifying_days`, `updated_balance`. | All six reference fields are present: gross, tax withheld, net posted, average daily balance used, qualifying-days count, and updated balance. |
