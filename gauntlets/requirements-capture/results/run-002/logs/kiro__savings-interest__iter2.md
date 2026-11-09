# kiro — savings-interest — iteration 2

Model (author): claude-opus · Questions asked: 10 · Captured: 8/14 · Bespoke captured: 6/10

## Conversation

### Round 1
_Step reasoning:_ The brief omits several policy decisions (day-count, compounding, rounding, period boundaries, balance semantics, posting mechanics) that cannot be reliably inferred, so I must ask the stakeholder before drafting requirements.

Q: Day-count convention: how should the daily rate be derived from the annual rate — actual/365 (fixed), actual/360, 30/360, or actual/actual (so leap years use 366)?
A: actual/360 — the daily rate is annual_rate / 360.

Q: Simple vs compound: should interest accrue simply on each day's balance and be summed, or compound daily (so each day's accrued interest earns interest on subsequent days)?
A: Compound daily: each day's accrued interest joins the principal base for the next day's accrual within the period.

Q: Rounding: to what precision is interest rounded (e.g. whole cents/minor units), at what point (per-day vs only the final posted figure), and using which rounding mode (half-up, half-even/banker's, truncate)?
A: Rounding is applied only to the final posted figure, not per-day. Mode is floor (truncate) to 2 decimal places (minor unit); the bank retains any sub-cent fraction. Half-up is explicitly not used.

Q: Period boundaries: is the period's start date inclusive and the end date inclusive or exclusive, and exactly how many daily balances define an N-day period?
A: Periods are half-open [start, end): start date inclusive, end date exclusive. An N-day period therefore covers exactly N daily balances.

Q: Daily balance semantics: which balance represents each day (end-of-day closing balance?), and how are days with zero or negative balances treated — zero interest, excluded, or charged differently?
A: End-of-day closing balance [default, not policy]. Days where the balance is below 1,000 contribute zero interest for that day but are still counted in the period-length divisor when computing the average. The account never goes negative; a zero balance earns zero interest and is counted in the divisor.

Q: Posting mechanics: should the computed interest be added directly to the account balance (so the returned updated balance = old balance + interest), and is there any minimum-interest threshold below which nothing is posted?
A: The account is credited net interest (gross minus 15% withholding tax), so updated balance = prior balance + net interest posted. There is no minimum-interest threshold below which posting is suppressed — a zero gross result still records a zero posting.

### Round 2
_Step reasoning:_ Two material policy conflicts remain unresolved: the compounding-vs-average-balance contradiction between rounds 2 and 5, and the ordering of withholding-tax deduction relative to the floor-to-2dp rounding, both of which change the posted figure and cannot be safely inferred.

Q: Compounding vs averaging: round 2 established daily compounding (each day's accrued interest joins the principal base for the next day), but the daily-balance answer refers to a 'period-length divisor when computing the average'. Which governs the accrual — compound each day's actual closing balance, or compute interest on the average daily balance over the period? If averaging, what exactly is averaged (sum of qualifying days' balances divided by N), and how does compounding apply on top of an average?
A: Average daily balance governs the accrual: sum all daily end-of-day closing balances over the period (days below the 1,000 minimum contribute their actual balance to the sum but zero to interest), divide by N (total days in the period), to obtain the average daily balance (ADB). Compounding then applies to that ADB as the principal over the N-day period using the formula: gross interest = ADB × ((1 + annual_rate/360)^N − 1). It is not per-day accrual on each day's actual closing balance; the ADB is the single principal figure, and the daily compounding exponent is applied to it over the full period.

Q: Withholding tax and rounding order: the 15% withholding is deducted to give net interest, and the final posted figure is floored to 2 decimal places. Is gross interest floored to 2dp first and then tax applied, or is tax applied to the unrounded gross and only the net figure floored? And is the withholding tax amount itself rounded/recorded separately (e.g. floored to 2dp), or only the net credit?
A: Tax is applied to the unrounded gross figure first; only the resulting net interest is floored to 2 decimal places before being credited to the account. The tax withheld amount is recorded separately as a reported figure; it is floored to 2 decimal places for reporting [default, not policy]. Gross interest is not independently rounded before the tax deduction step.

### Round 3
_Step reasoning:_ Round 2's ADB reconciliation left the 1,000 minimum-balance rule contradictory (zero-interest days vs. single-principal ADB), and key edge cases (empty period, rate domain, currency) remain unspecified; both are policy choices a model cannot reliably infer.

Q: The sub-1,000 minimum-balance rule now conflicts with the ADB model. Round 1 said days below 1,000 earn zero interest; round 2 said those days still contribute their actual closing balance to the ADB sum, and that the ADB is the single principal (there is no per-day interest). Under the ADB formula, what does the 1,000 threshold actually do — (a) it is vestigial and has no effect (all days' balances go into the sum, interest is purely ADB-based), (b) sub-1,000 days contribute ZERO to the ADB sum (but are still counted in the N divisor, lowering the ADB), or (c) the threshold applies to the resulting ADB itself (if ADB < 1,000 the whole period earns zero interest)?
A: (b): sub-1,000 days contribute zero to the ADB numerator (the sum of daily balances) but are still counted in the N divisor, so they lower the ADB. The round-2 phrasing that said those days 'contribute their actual balance to the sum' was imprecise and should be disregarded; the authoritative rule is that only days with a closing balance at or above 1,000 contribute to the numerator. The threshold is not vestigial (a) and does not apply to the resulting ADB (c).

Q: Edge cases: (1) if the period has zero days (N=0, empty balance history), what should post_interest return — a zero posting, or an error? (2) Is the annual_rate supplied per call/per account, and can it be zero or negative? (3) Are balances and the posted figures denominated in a single currency's minor units (2dp throughout), with no multi-currency handling required?
A: (1) N=0 (empty period): return a zero posting rather than raising an error — zero days means zero gross interest, and the zero-posting rule applies [default, not policy]. (2) A negative annual rate is rejected as invalid; a zero rate produces zero gross interest and a zero posting. Rate supply mechanism is per account [default, not policy]. (3) Single currency, all balances and posted figures in that currency's minor units (2 decimal places) throughout; no multi-currency handling is required [default, not policy].

### Round 4 (process signalled done)
_Step reasoning:_ Three rounds have resolved every material policy omission — day-count (actual/360), ADB-with-compounding accrual, the sub-1,000 threshold's exact effect, floor-to-2dp rounding, half-open periods, 15% withholding on unrounded gross, zero-posting and N=0 handling, and negative-rate rejection — so I have enough to write complete EARS requirements without inventing anything.

(no questions this round)

## Produced specification

# Requirements Document

## Introduction

This document specifies the interest engine for the institution's savings accounts. Given an account with a daily closing-balance history over a period and an annual interest rate, the engine computes the interest earned, applies withholding tax, and posts the net result to the account. The public interface is a single function, `post_interest(account, period)`, which returns the interest posted and the account's updated balance.

The institution has settled on a specific set of policies for every material decision: an actual/360 day-count convention, an average-daily-balance (ADB) accrual model with daily compounding applied to the ADB, a 1,000 minimum-balance qualification rule on the ADB numerator, floor (truncate) rounding of the final net figure to two decimal places, and a 15% withholding tax applied to the unrounded gross interest. All amounts are denominated in a single currency's minor units (two decimal places) throughout.

## Requirements

### Requirement 1: Day-count convention

**User Story:** As the bank's finance team, I want the daily rate derived on an actual/360 basis, so that interest accrual matches our stated day-count policy.

#### Acceptance Criteria

1. WHEN the engine derives a daily rate from the annual rate THEN the system SHALL use the daily rate equal to annual_rate / 360 (actual/360).
2. The system SHALL NOT use actual/365, actual/360-with-365-divisor, 30/360, or actual/actual conventions.
3. WHEN the period spans a leap year THEN the system SHALL NOT alter the 360 divisor; leap years receive no special treatment in the day-count divisor.

### Requirement 2: Period boundaries

**User Story:** As a developer integrating the engine, I want unambiguous period boundaries, so that each day's balance is counted exactly once.

#### Acceptance Criteria

1. WHEN a period is defined by a start date and an end date THEN the system SHALL treat the period as half-open [start, end): the start date is inclusive and the end date is exclusive.
2. WHEN a period covers N days THEN the system SHALL expect exactly N daily closing balances, one per day in [start, end).
3. The value N used throughout accrual SHALL equal the total number of days in the period [start, end).

### Requirement 3: Daily balance semantics

**User Story:** As the bank, I want each day represented by its end-of-day closing balance, so that accrual reflects the funds actually held.

#### Acceptance Criteria

1. WHEN the engine reads a day's balance THEN the system SHALL use that day's end-of-day closing balance [default, not an explicit policy answer].
2. The account SHALL never hold a negative balance.
3. WHEN a day's closing balance is zero THEN the system SHALL treat that day as earning zero interest and SHALL still count it in the period-length divisor N.

### Requirement 4: Average daily balance (ADB) and the 1,000 minimum-balance rule

**User Story:** As the bank's finance team, I want interest accrued on the average daily balance with a minimum-balance qualification, so that only days at or above 1,000 contribute to the earning base.

#### Acceptance Criteria

1. WHEN the engine computes the ADB numerator THEN the system SHALL sum only the closing balances of days whose closing balance is at or above 1,000 (the minimum-balance threshold).
2. IF a day's closing balance is below 1,000 THEN the system SHALL contribute zero to the ADB numerator for that day.
3. WHEN the engine computes the ADB THEN the system SHALL divide the numerator by N, the total number of days in the period, including days below the 1,000 threshold and days with zero balance in that divisor.
4. The system SHALL treat sub-1,000 days as lowering the ADB (zero in the numerator, counted in the divisor); the threshold SHALL NOT be treated as vestigial, and the threshold SHALL NOT be applied to the resulting ADB itself.
5. The ADB SHALL be the single principal figure used for accrual; the system SHALL NOT accrue interest per day on each day's actual closing balance.

### Requirement 5: Gross interest accrual with daily compounding on the ADB

**User Story:** As the bank's finance team, I want gross interest computed by applying daily compounding to the ADB over the full period, so that accrual matches our compounding policy.

#### Acceptance Criteria

1. WHEN the engine computes gross interest THEN the system SHALL apply the formula: gross_interest = ADB × ((1 + annual_rate / 360) ^ N − 1), where N is the total number of days in the period.
2. The system SHALL apply the daily compounding exponent N to the single ADB principal over the full period, not as per-day accrual on each day's actual closing balance.
3. The system SHALL NOT independently round the gross interest before the withholding-tax deduction step.

### Requirement 6: Withholding tax

**User Story:** As the bank, I want a 15% withholding tax applied to gross interest, so that the account is credited net interest and the tax is reported separately.

#### Acceptance Criteria

1. WHEN the engine applies withholding tax THEN the system SHALL apply the 15% rate to the unrounded gross interest figure.
2. The system SHALL compute net interest as gross_interest × (1 − 0.15) (i.e. gross minus 15% withholding).
3. WHEN the engine records the tax withheld THEN the system SHALL record it as a separately reported figure, floored (truncated) to 2 decimal places for reporting [the per-report flooring of the tax figure is a default, not an explicit policy answer].
4. The system SHALL NOT floor or otherwise round the gross interest before deducting tax.

### Requirement 7: Rounding of the posted figure

**User Story:** As the bank, I want only the final net posted figure rounded, by truncation to the minor unit, so that the bank retains any sub-cent fraction.

#### Acceptance Criteria

1. WHEN the engine produces the final net interest to be credited THEN the system SHALL floor (truncate) it to 2 decimal places (the currency's minor unit).
2. The system SHALL apply rounding only to the final posted figure, not per day.
3. The system SHALL NOT use half-up rounding, and SHALL NOT use half-even (banker's) rounding, for the posted figure.
4. WHEN truncation discards a sub-cent fraction THEN the bank SHALL retain that fraction (it is not credited to the account).

### Requirement 8: Posting mechanics

**User Story:** As a developer, I want the net interest credited directly to the balance with no minimum-posting threshold, so that every computation produces a recorded posting.

#### Acceptance Criteria

1. WHEN interest is posted THEN the system SHALL set the updated balance equal to the prior balance plus the net interest posted.
2. The system SHALL NOT apply any minimum-interest threshold below which posting is suppressed.
3. IF the gross interest result is zero THEN the system SHALL still record a zero posting (a zero credit is a valid recorded posting).
4. WHEN `post_interest(account, period)` completes THEN the system SHALL return both the interest posted and the account's updated balance.

### Requirement 9: Empty period edge case

**User Story:** As a developer, I want an empty period handled gracefully, so that no balance history does not raise an error.

#### Acceptance Criteria

1. IF N = 0 (an empty period with no daily balances) THEN the system SHALL return a zero posting rather than raising an error [default, not an explicit policy answer].
2. WHEN N = 0 THEN the system SHALL treat gross interest as zero and apply the zero-posting rule, leaving the balance unchanged.

### Requirement 10: Annual rate validation and supply

**User Story:** As the bank, I want the annual rate validated and supplied per account, so that invalid rates are rejected and zero rates produce zero interest.

#### Acceptance Criteria

1. IF the annual rate is negative THEN the system SHALL reject it as invalid.
2. IF the annual rate is zero THEN the system SHALL produce zero gross interest and a zero posting.
3. The annual rate SHALL be supplied per account [default, not an explicit policy answer].

### Requirement 11: Currency and denomination

**User Story:** As the bank, I want all amounts handled in a single currency's minor units, so that no multi-currency handling is required.

#### Acceptance Criteria

1. The system SHALL denominate all balances and posted figures in a single currency's minor units, at 2 decimal places throughout [default, not an explicit policy answer].
2. The system SHALL NOT perform any multi-currency conversion or handling [default, not an explicit policy answer].

### Requirement 12: Order of operations

**User Story:** As the bank's finance team, I want a fixed order of computation, so that the posted result is reproducible and matches policy.

#### Acceptance Criteria

1. WHEN `post_interest(account, period)` is invoked THEN the system SHALL compute results in the following order: (a) determine N as the day count of the half-open period [start, end); (b) sum the closing balances of days at or above 1,000 to form the ADB numerator; (c) divide the numerator by N to obtain the ADB; (d) compute gross_interest = ADB × ((1 + annual_rate / 360) ^ N − 1) on the unrounded ADB; (e) apply 15% withholding tax to the unrounded gross to obtain net interest; (f) floor the net interest to 2 decimal places; (g) credit the floored net interest to the balance and record the posting, with the tax withheld reported separately.
2. The system SHALL perform flooring only at step (f) for the credited figure (and separately for the reported tax figure), and at no earlier step in the gross or ADB computation.

## Auditor verdict

_The spec covers the per-period computation decisions well: method (#1 ADB), compounding (#2 daily), day-count (#4 360), minimum balance (#5 1,000), rounding (#6 floor), withholding (#7 15%), edge cases (#11), and period boundary (#12) are all surfaced and correct, 8 of 14. It entirely omits the lifecycle and timing decisions: posting period/anniversary (#3), dormancy (#8), closure mid-period (#9), escheatment (#10), and mid-period rate changes (#13). Output shape (#14) is surfaced but incorrect, missing the ADB-used and qualifying-days disclosure. Of the core in-focus six [1,2,3,8,9,10], only #1 and #2 (method) are correct; all lifecycle decisions (#3,#8,#9,#10) are absent. Coverage = 8/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Req 4.5: "The ADB SHALL be the single principal figure used for accrual; the system SHALL NOT accrue interest per day on each day's actual closing balance." Req 4.3: "divide the numerator by N, the total number of days in the period". | The spec explicitly uses average daily balance (sum of qualifying balances divided by N) as the single accrual principal and expressly rejects per-day daily-balance accrual, matching the reference method. |
| 2 | yes | **yes** | Req 5.1: "gross_interest = ADB × ((1 + annual_rate / 360) ^ N − 1)"; intro: "an average-daily-balance (ADB) accrual model with daily compounding applied to the ADB". | The exponent N with a daily rate compounds daily over the period, matching the reference's daily-compounding answer. |
| 3 | no | no | absent | The spec treats the period as a given input to post_interest and never states posting frequency; no mention of quarterly posting or anniversary-of-opening timing. |
| 4 | yes | **yes** | Req 1.1: "the daily rate equal to annual_rate / 360 (actual/360)"; Req 1.2 rejects actual/365 and other bases. | The 360 day-count divisor is stated explicitly and alternatives are ruled out, matching the reference. |
| 5 | yes | **yes** | Req 4.1: "sum only the closing balances of days whose closing balance is at or above 1,000"; Req 4.3: divide by N "including days below the 1,000 threshold ... in that divisor". | Threshold of 1,000 for qualifying days with sub-1,000 days contributing zero to the numerator but still counted in the divisor matches the reference exactly. |
| 6 | yes | **yes** | Req 7.1: "floor (truncate) it to 2 decimal places"; Req 7.3: "SHALL NOT use half-up rounding"; Req 7.4: "the bank SHALL retain that fraction". | Floor/truncate rounding to 2 dp with the bank keeping the fraction and no half-up matches the reference precisely. |
| 7 | yes | **yes** | Req 6.1: "apply the 15% rate to the unrounded gross interest"; Req 6.2: "net interest as gross_interest × (1 − 0.15)"; Req 6.3: tax "recorded as a separately reported figure". | 15% withholding deducted from gross, net credited, tax reported separately matches the reference. |
| 8 | no | no | absent | The spec contains no dormancy concept: no 12-month inactivity trigger, no continued accrual while dormant, and no monthly dormancy fee of 5. |
| 9 | no | no | absent | The spec never addresses closure between posting dates or pro-rata accrual to a closure date; it only handles a supplied period generically. |
| 10 | no | no | absent | No escheatment path: nothing on 5 years dormant, remittance to the state, or closing to zero balance. |
| 11 | yes | **yes** | Req 10.1: "IF the annual rate is negative THEN the system SHALL reject it as invalid"; Req 3.2: "account SHALL never hold a negative balance"; Req 8.3 + Req 3.3: zero balance/zero gross still records a zero posting. | Negative rate rejected, zero-balance period posts a recorded zero (no-op), and no negative balance/overdraft all match the reference's edge-case resolution. |
| 12 | yes | **yes** | Req 2.1: "treat the period as half-open [start, end): the start date is inclusive and the end date is exclusive." | Half-open [start, end) boundary, which excludes the end/posting day from the closing period and includes it in the next, matches the reference convention. |
| 13 | no | no | absent | The spec supplies a single annual rate per account (Req 10.3) and never handles a rate changing mid-period or per-rate-segment computation. |
| 14 | yes | no | Req 8.4: returns "both the interest posted and the account's updated balance"; Req 6.3: tax withheld "separately reported". No return of ADB used or number of qualifying days. | The output addresses net posted, updated balance, and separately reported tax, but omits the reference-required gross interest, the average daily balance used, and the number of qualifying days, so the shape does not match. |
