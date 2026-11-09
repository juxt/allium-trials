# kiro — savings-interest — iteration 1

Model (author): claude-opus · Questions asked: 14 · Captured: 8/14 · Bespoke captured: 7/10

## Conversation

### Round 1
_Step reasoning:_ The brief omits every material interest-calculation policy (day count, compounding, rounding, balance interpretation, edge cases, posting semantics); these cannot be reliably inferred and must be asked before drafting EARS requirements.

Q: Day-count convention: should the daily rate be the annual rate divided by 365, by 360, or by the actual number of days in the year (365/366 handling leap years)?
A: 360-day year. The daily rate is annual_rate / 360.

Q: Compounding: does interest compound daily (each day's accrued interest joins the balance and earns interest) or is it simple interest summed over the period and posted once at the end?
A: Daily compounding: each day's accrued interest joins the principal and earns interest on subsequent days within the period.

Q: Rounding: to what precision is interest rounded (e.g. whole cents), and is rounding applied to each day's accrual or only once to the final posted amount?
A: Rounding is applied once to the final posted amount, not to each day's accrual. Precision is 2 decimal places (minor unit), rounded down (floor). The bank retains any sub-cent fraction.

Q: How is the daily balance interpreted for accrual: which balance applies on each day (start-of-day, end-of-day), and are both the period's first and last days included?
A: The period is half-open [start, end): the first day is included, the posting day is excluded and belongs to the next period. Start-of-day vs end-of-day is not specified in policy — [default, not policy]: use end-of-day balance for each day.

Q: How should non-positive balances be treated: do zero or negative daily balances earn zero interest, and can a negative balance accrue negative (debit) interest?
A: Days with a zero or negative balance earn zero interest (they are below the 1,000 minimum and contribute zero to the accrual, though they still count in the period's day divisor). Negative (debit) interest does not accrue. The account balance never goes negative.

Q: What exactly does 'post' do and what is returned: is the posted interest added to the account balance, and should the returned updated balance reflect that posting?
A: Posting credits the net interest (gross minus 15% withholding tax) to the account balance. The call returns: gross interest, tax withheld, net interest posted, average daily balance used, number of qualifying days, and the updated account balance after posting.

### Round 2
_Step reasoning:_ The answers surfaced a previously unstated 1,000 minimum-balance qualification and average-daily-balance/qualifying-day outputs that conflict with daily compounding, plus tax-rounding details, all of which are policy I cannot infer and must confirm before specifying.

Q: The answers reference a '1,000 minimum' and the return value includes 'number of qualifying days' and 'average daily balance used'. Please pin down the qualification rule exactly: does a day accrue interest only when its end-of-day balance is at or above 1,000 (is the comparison >= 1,000 or > 1,000), and is 1,000 expressed in the account's major currency unit?
A: The comparison is >= 1,000 (at or above, inclusive). A day with an end-of-day balance of exactly 1,000 qualifies. The 1,000 threshold is in the account's major currency unit.

Q: How is 'average daily balance used' defined and over which days is it averaged — the full count of calendar days in the half-open period, or only the qualifying days? And given daily compounding was specified, is this average purely a reported statistic, or is interest actually computed from an average-balance formula rather than day-by-day compounding?
A: The average daily balance is the sum of end-of-day balances for every calendar day in the half-open period [start, end), divided by the total number of calendar days in that period. Non-qualifying days (balance below 1,000) contribute zero to the numerator but are still counted in the denominator. This average is the actual computation base: the rate is applied once to it (gross = average_daily_balance * ((1 + daily_rate)^days - 1) under compounding, with the average as principal). It is both the computation input and a reported output field. The 'number of qualifying days' is a separate reported field counting days where the balance was at or above 1,000.

Q: For the 15% withholding tax: is the rate fixed at 15% with no threshold or exemption, is tax computed on the gross interest, and how is it rounded — floored to 2 decimal places like the gross, and is net posted = floor(gross) minus floor(tax), or floor(gross minus tax)?
A: The 15% rate is fixed with no threshold or exemption; it is applied to the gross interest amount. The key specifies floor-to-2dp for the posted net amount but does not specify rounding for the tax deduction itself — [default, not policy]: compute tax as floor(gross_unrounded * 0.15, 2dp), then net posted = floor(gross_unrounded - tax_withheld, 2dp). Tax withheld is reported as a separate field.

### Round 3
_Step reasoning:_ Core policies are pinned, but the compounding exponent, the sparse-vs-dense balance input with gap handling, and the empty-period edge case remain genuinely ambiguous and cannot be reliably inferred.

Q: In the gross interest formula gross = average_daily_balance * ((1 + daily_rate)^days - 1), what exactly is the exponent 'days'? Is it the total number of calendar days in the half-open period [start, end), or only the number of qualifying days (balance >= 1,000)?
A: The exponent is the total number of calendar days in the half-open period [start, end) — the same count used as the denominator of the average daily balance. Qualifying days affect only the numerator of that average; the compounding runs over the full period length.

Q: How is the daily balance history supplied and how are gaps handled: does the input provide an explicit end-of-day balance for every calendar day in [start, end), or is it a sparse series of balance-change events where the balance on a day with no entry is carried forward from the most recent prior entry? And what opening balance applies to days before the first entry?
A: Not specified in policy — [default, not policy]: treat the input as a sparse series of (date, balance) events; on any calendar day with no explicit entry, carry forward the most recent prior balance. An explicit opening balance (the balance in force at the start of the period) must be supplied; days before the first event use that opening balance. If no opening balance is provided and the period begins before the first entry, treat the balance as zero for those days.

Q: If the period is empty or degenerate (start == end, giving zero calendar days and a zero denominator for the average), what should post_interest do: return zero interest with an unchanged balance, or raise an error?
A: Not specified in policy — [default, not policy]: return zero interest with the balance unchanged (gross = 0, tax = 0, net = 0, average daily balance = 0, qualifying days = 0, updated balance = input balance). Raising an error for a zero-length period would be unnecessarily strict for a pure calculation call.

### Round 4
_Step reasoning:_ Core interest policy is fully pinned, but the base balance that net interest is posted to (and same-day duplicate events) remains materially ambiguous and cannot be reliably inferred.

Q: To what base balance is the net interest credited to produce the returned 'updated account balance'? Specifically, is net interest added to the account's closing balance at the period end (the end-of-day balance carried forward to `end`, i.e. the balance in force on the excluded posting day), or to some separately supplied 'current account balance' on the `account` object that may differ from the daily history's last carried-forward value?
A: Not specified in policy — [default, not policy]: credit net interest to the closing balance carried forward from the daily history, i.e. the end-of-day balance on the last included day of the half-open period (day end-1). There is no separately supplied 'current account balance'; the updated balance is that carried-forward balance plus net interest posted.

Q: If the sparse daily balance series contains more than one (date, balance) event on the same calendar day, which one is taken as that day's end-of-day balance for both accrual and the >= 1,000 qualification test: the last/latest event for that date, or is more than one event per date disallowed?
A: Not specified in policy — [default, not policy]: take the last event for that calendar day as its end-of-day balance for both accrual and the >= 1,000 qualification test. Multiple same-day entries are permitted; earlier ones are discarded.

### Round 5 (process signalled done)
_Step reasoning:_ All material policy decisions a model cannot infer have been resolved across four rounds; the last round returned only non-policy defaults, signalling the institutional policy surface (day-count, compounding, rounding, qualification threshold, average-balance base, tax, period semantics, sparse-series handling, crediting base, same-day events) is now fully captured.

(no questions this round)

## Produced specification

# Requirements Document

## Introduction

This feature is the interest engine for the institution's savings accounts. It computes the interest an account earns over a defined period from its daily balance history and an annual interest rate, applies the institution's day-count, compounding, qualification, rounding and withholding-tax policies, then posts the net interest to the account.

The public interface is a single function, `post_interest(account, period)`, which returns the interest posted and the account's updated balance together with the supporting figures (gross interest, tax withheld, net interest, average daily balance used, and number of qualifying days).

The institution has settled specific policy choices that cannot be inferred from the brief alone. They are captured here as requirements. Where a point was neither covered by policy nor by the brief, the specification records the resolution adopted by this authoring process and marks it explicitly as a default rather than institutional policy.

### Policy summary

- Day-count: daily rate = annual_rate / 360.
- Computation base: the average daily balance over the period, compounded over the full period length.
- Qualification threshold: a day's end-of-day balance must be at or above 1,000 (>= 1,000) in the account's major currency unit.
- Rounding: floor to 2 decimal places, applied to the final amounts rather than to each day's accrual.
- Withholding tax: a fixed 15% of gross interest, with no threshold or exemption.
- Period: half-open [start, end); the first day is included and the posting day is excluded.

## Requirements

### Requirement 1 — Daily rate and day-count convention

**User Story:** As the institution's finance owner, I want the daily interest rate derived on a 360-day basis, so that accrual matches our stated day-count policy.

#### Acceptance Criteria

1. WHEN the engine derives the daily rate from the annual interest rate THEN the system SHALL compute daily_rate = annual_rate / 360.
2. The system SHALL NOT use 365, 366, or the actual number of calendar days in the year as the day-count divisor.

### Requirement 2 — Half-open accrual period

**User Story:** As the institution's finance owner, I want the accrual period treated as half-open [start, end), so that the posting day belongs to the next period and no day is counted twice across consecutive postings.

#### Acceptance Criteria

1. The period SHALL be interpreted as half-open [start, end): the start day is included and the end day (the posting day) is excluded.
2. WHEN counting the calendar days in the period THEN the system SHALL count every calendar day from start (inclusive) to end (exclusive).
3. The last included day of the period SHALL be the day immediately before end (referred to as day end-1).

### Requirement 3 — Daily balance interpretation

**User Story:** As an engineer consuming the engine, I want each day's balance defined unambiguously, so that accrual and qualification use a single consistent figure per day.

#### Acceptance Criteria

1. For each calendar day in the period, the system SHALL use that day's end-of-day balance for both accrual and qualification. (This start-of-day vs end-of-day choice was not fixed by policy; end-of-day is adopted as the default of this process.)

### Requirement 4 — Sparse balance history and carry-forward

**User Story:** As an engineer supplying balance data, I want to provide only balance-change events and an opening balance, so that I need not enumerate every calendar day.

#### Acceptance Criteria

1. The daily balance history SHALL be accepted as a sparse series of (date, balance) events. (The input shape was not fixed by policy; a sparse carry-forward series is adopted as the default of this process.)
2. WHEN a calendar day in the period has no explicit event THEN the system SHALL carry forward the balance from the most recent prior event as that day's end-of-day balance.
3. An explicit opening balance, being the balance in force at the start of the period, SHOULD be supplied; WHEN days fall before the first event THEN the system SHALL use the opening balance for those days.
4. IF no opening balance is provided AND the period begins before the first event THEN the system SHALL treat the balance for those days as zero.
5. WHEN more than one event exists for the same calendar day THEN the system SHALL take the last (latest) event for that date as its end-of-day balance and SHALL discard the earlier same-day events. (Multiple same-day entries were not fixed by policy; last-event-wins is adopted as the default of this process.)

### Requirement 5 — Qualifying days

**User Story:** As the institution's finance owner, I want only days at or above the minimum balance to count as qualifying, so that the minimum-balance rule is applied exactly.

#### Acceptance Criteria

1. A calendar day SHALL qualify WHEN its end-of-day balance is at or above 1,000, using an inclusive comparison (balance >= 1,000).
2. WHEN a day's end-of-day balance equals exactly 1,000 THEN that day SHALL qualify.
3. The 1,000 threshold SHALL be expressed in the account's major currency unit.
4. The system SHALL report the number of qualifying days as a distinct output field.

### Requirement 6 — Average daily balance as the computation base

**User Story:** As the institution's finance owner, I want interest computed from the average daily balance over the whole period, so that the reported average is also the exact base of the calculation.

#### Acceptance Criteria

1. The system SHALL compute the average daily balance as the sum of the end-of-day balances for every calendar day in [start, end), divided by the total number of calendar days in that period.
2. WHEN a day does not qualify (end-of-day balance below 1,000) THEN that day SHALL contribute zero to the numerator of the average but SHALL still be counted in the denominator.
3. WHEN a day has a zero or negative end-of-day balance THEN that day SHALL contribute zero to the numerator and SHALL still be counted in the denominator.
4. The average daily balance SHALL be used as the principal in the gross-interest computation, and SHALL also be returned as an output field.

### Requirement 7 — Gross interest with compounding over the full period

**User Story:** As the institution's finance owner, I want gross interest compounded over the full period length, so that the compounding term matches our policy.

#### Acceptance Criteria

1. The system SHALL compute gross interest as gross = average_daily_balance * ((1 + daily_rate)^days - 1).
2. The exponent `days` SHALL be the total number of calendar days in the half-open period [start, end), which is the same count used as the denominator of the average daily balance.
3. The exponent `days` SHALL NOT be the number of qualifying days; qualification affects only the numerator of the average daily balance, not the compounding term.

### Requirement 8 — Non-positive balances and no debit interest

**User Story:** As the institution's finance owner, I want non-positive balances to earn nothing and no debit interest to accrue, so that the account is never charged interest and never goes negative.

#### Acceptance Criteria

1. WHEN a day's end-of-day balance is zero or negative THEN that day SHALL earn zero interest (it is below the 1,000 minimum and contributes zero to the accrual), while still counting in the period's day divisor.
2. The system SHALL NOT accrue negative (debit) interest.
3. The account balance SHALL never go negative as a result of this engine.

### Requirement 9 — Withholding tax on gross interest

**User Story:** As the institution's finance owner, I want a fixed 15% withholding tax deducted from gross interest, so that only net interest is credited and the tax is reported separately.

#### Acceptance Criteria

1. The withholding-tax rate SHALL be fixed at 15% of the gross interest, with no threshold and no exemption.
2. The system SHALL compute tax_withheld = floor(gross_unrounded * 0.15, 2 decimal places). (The policy fixed floor-to-2dp for the posted net but did not fix the tax rounding; this tax-rounding rule is adopted as the default of this process.)
3. The system SHALL report tax_withheld as a distinct output field.

### Requirement 10 — Rounding of posted amounts

**User Story:** As the institution's finance owner, I want amounts floored to 2 decimal places once at the end, so that the institution retains any sub-cent fraction and per-day rounding error does not accumulate.

#### Acceptance Criteria

1. Rounding SHALL be applied to the final amounts, not to each day's accrual.
2. The rounding precision SHALL be 2 decimal places (the currency's minor unit), and the rounding mode SHALL be floor (round down).
3. The net interest to be posted SHALL be computed as net_posted = floor(gross_unrounded - tax_withheld, 2 decimal places).
4. Any sub-cent fraction remaining after flooring SHALL be retained by the institution and SHALL NOT be credited to the account.

### Requirement 11 — Posting and updated balance

**User Story:** As an engineer consuming the engine, I want the net interest posted to the carried-forward closing balance, so that the returned balance reflects the credit.

#### Acceptance Criteria

1. WHEN posting THEN the system SHALL credit the net interest (gross minus 15% withholding tax, floored as in Requirement 10) to the account balance.
2. The base balance credited SHALL be the closing balance carried forward from the daily history, that is the end-of-day balance on the last included day of the period (day end-1). (The base was not fixed by policy; the carried-forward closing balance is adopted as the default of this process.)
3. There SHALL be no separately supplied current account balance; the updated balance SHALL be the carried-forward closing balance plus the net interest posted.
4. The system SHALL return the updated account balance after posting.

### Requirement 12 — Return value

**User Story:** As an engineer consuming the engine, I want a complete result object, so that I can post, report and reconcile from one call.

#### Acceptance Criteria

1. The call SHALL return the gross interest.
2. The call SHALL return the tax withheld.
3. The call SHALL return the net interest posted.
4. The call SHALL return the average daily balance used.
5. The call SHALL return the number of qualifying days.
6. The call SHALL return the updated account balance after posting.

### Requirement 13 — Empty or degenerate period

**User Story:** As an engineer consuming the engine, I want a zero-length period to return zeros rather than error, so that this pure calculation call stays robust.

#### Acceptance Criteria

1. WHEN the period is empty or degenerate (start == end, giving zero calendar days) THEN the system SHALL return gross interest = 0, tax withheld = 0, net interest = 0, average daily balance = 0, and qualifying days = 0. (Handling of a zero-length period was not fixed by policy; returning zeros is adopted as the default of this process.)
2. WHEN the period is empty or degenerate THEN the system SHALL return the input balance unchanged as the updated balance and SHALL NOT raise an error.
3. The system SHALL NOT divide by a zero day count; the zero-day case SHALL be handled per criteria 1 and 2.

---

Do the requirements look good? If so, we can move on to the design.

## Auditor verdict

_The spec covers the per-period computation mechanics and conventions well (decisions 1,2,4,5,6,7,12,14 all correct) but entirely omits the lifecycle and temporal policies: posting cadence/anniversary (3), dormancy (8), mid-period closure (9), escheatment (10), and mid-period rate changes (13) are absent. Decision 11 is partially surfaced (no-overdraft and zero-balance handling present) but misses negative-rate rejection. Coverage = 8/14 correct; of the core in-focus six [1,2,3,8,9,10] only 1 and 2 are correct, so method coverage held up while lifecycle coverage collapsed in this fresh domain._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Req 6.1: 'compute the average daily balance as the sum of the end-of-day balances for every calendar day in [start, end), divided by the total number of calendar days'; Req 6.4 uses it 'as the principal in the gross-interest computation'. | The spec bases interest on the average daily balance (sum of daily balances / days in period), not per-day daily balance, matching the reference method. |
| 2 | yes | **yes** | Req 7.1: 'gross = average_daily_balance * ((1 + daily_rate)^days - 1)' with exponent 'days' = calendar days in the period (Req 7.2). | The compound formula (1+daily_rate)^days represents daily compounding over the period, matching 'interest compounds daily'. |
| 3 | no | no | absent | The spec takes an arbitrary period as input to post_interest and never states that posting is quarterly or falls on the account-opening anniversary rather than calendar quarter-ends. |
| 4 | yes | **yes** | Req 1.1: 'daily_rate = annual_rate / 360'; Req 1.2: 'SHALL NOT use 365, 366, or the actual number of calendar days'. | Day-count basis is fixed at 360, exactly matching the reference. |
| 5 | yes | **yes** | Req 5.1: qualify 'WHEN its end-of-day balance is at or above 1,000 (balance >= 1,000)'; Req 6.2: a non-qualifying day 'SHALL contribute zero to the numerator of the average but SHALL still be counted in the denominator'. | Threshold of 1,000 inclusive, with below-threshold days contributing zero interest but still counting in the average divisor, matches the reference exactly. |
| 6 | yes | **yes** | Req 10.2: 'rounding mode SHALL be floor (round down)' to '2 decimal places'; Req 10.4: 'sub-cent fraction remaining after flooring SHALL be retained by the institution'. | Floor to 2dp (never half-up) with the bank keeping the fraction matches the reference rounding rule. |
| 7 | yes | **yes** | Req 9.1: 'withholding-tax rate SHALL be fixed at 15% of the gross interest'; Req 9.3 reports tax as a distinct field; Req 11.1 credits 'net interest (gross minus 15% withholding tax)'. | 15% WHT deducted from gross, net credited, tax reported separately, matches the reference. |
| 8 | no | no | absent | The spec contains no dormancy concept: no 12-month inactivity trigger, no continued accrual while dormant, and no monthly dormancy fee of 5. |
| 9 | no | no | absent | No mid-period closure handling is specified; Req 13 covers only an empty/degenerate zero-length period, not pro-rata accrual to a closure date. |
| 10 | no | no | absent | The spec never mentions escheatment, a 5-year dormancy-to-state trigger, or remitting the balance and closing to zero. |
| 11 | yes | no | Req 8.1-8.3: non-positive balances earn zero, no debit interest, 'account balance SHALL never go negative'; Req 13 returns zeros for a zero-length period. No clause rejects a negative annual rate. | The spec covers no-overdraft and zero-balance-posts-zero, but does not address rejecting a negative rate as invalid, so the bundled resolution is not fully matched under strict reading. |
| 12 | yes | **yes** | Req 2.1: 'half-open [start, end): the start day is included and the end day (the posting day) is excluded'. | Posting day excluded from the closing period via half-open [start, end) semantics matches the reference exactly. |
| 13 | no | no | absent | The spec uses a single annual_rate throughout and never handles a rate change mid-period or per-rate-segment computation. |
| 14 | yes | **yes** | Req 12.1-12.6: returns gross interest, tax withheld, net interest posted, average daily balance used, number of qualifying days, and updated account balance. | All six reported fields, including the specific average-daily-balance and qualifying-days disclosures, match the reference output shape. |
