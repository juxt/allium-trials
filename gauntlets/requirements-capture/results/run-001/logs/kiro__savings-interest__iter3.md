# kiro — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 13 · Captured: 8/14 · Bespoke captured: 6/10

## Conversation

### Round 1
_Step reasoning:_ The brief omits several interest-computation policies (day-count, compounding, rounding, balance basis) that cannot be reliably inferred and must be confirmed with the stakeholder before drafting requirements.

Q: Day-count convention: how should the daily rate be derived from the annual rate — actual/365, actual/360, actual/actual (365 or 366 in leap years), or 30/360?
A: actual/360 — the daily rate is annual_rate / 360.

Q: Compounding: over the period, is interest simple (accrued on each day's balance and summed) or compounded (does posted/accrued interest itself earn interest, and if so at what frequency)?
A: Compounding daily within the period: each day's accrued interest is added to the running balance before the next day's accrual, so interest earns interest throughout the quarter.

Q: Rounding: to what precision is interest rounded (e.g. whole cents), and does rounding happen per-day on each daily accrual or once on the total at posting? Which rounding mode (half-up, half-even/banker's, truncate)?
A: Rounding happens once, at posting, on the total gross interest amount. Mode is floor (truncate) to 2 decimal places (the minor unit); half-up is never used, and the bank retains any fractional remainder.

Q: Which balance is used for each day's accrual — the start-of-day, end-of-day, or minimum daily balance — and are the period's start and end dates both inclusive?
A: The average daily balance is used: sum each day's balance over the period and divide by the total number of days in the period. The period is half-open — [start, end) — so the posting day itself is excluded from the period it closes and is the first day of the next period. Whether each day's balance snapshot is start-of-day or end-of-day is [default, not policy]: end-of-day.

Q: How are days with zero or negative balances treated — no interest, or a debit/overdraft rate?
A: Days where the balance is below 1,000 contribute zero interest for that day but still count as a day in the divisor of the average-balance calculation. Zero-balance days follow the same rule (below 1,000, so zero contribution). The account balance never goes negative, so no overdraft or debit rate applies. A negative annual rate is rejected as invalid.

Q: What exactly does post_interest return and mutate: is the interest amount added to the account balance in place, and in what units/currency type (integer minor units vs decimal)?
A: post_interest returns a record containing: gross interest, tax withheld (15% of gross), net interest posted (gross minus tax), the average daily balance computed for the period, the number of qualifying days (days at or above the 1,000 minimum), and the updated account balance. The account balance is mutated in place by adding the net interest. Exact numeric type (integer minor units vs decimal) is [default, not policy]: integer minor units (e.g. cents) are recommended.

### Round 2
_Step reasoning:_ Three genuine policy ambiguities remain that cannot be inferred: a direct contradiction between the daily-compounding and average-daily-balance answers, undefined rounding of the newly introduced tax/net amounts, and the units of the 1,000 threshold.

Q: The Round 1 answer specified daily compounding (each day's accrued interest added to the running balance before the next day's accrual), but the Round 4 answer specified the average daily balance method (sum each day's balance, divide by total days, apply the rate to that single average). These are incompatible: the average-balance method applies the rate once and never compounds accrued interest. Which one governs the accrual — average daily balance (simple, no compounding), or day-by-day compounding? If average daily balance, is the interest computed as average_balance x daily_rate x number_of_days_in_period?
A: Average daily balance governs. The Round 1 compounding answer was incorrect; key point 1 controls: sum each day's end-of-day balance over the [start, end) period, divide by the total number of days in the period to get the average daily balance, then apply the rate once. Gross interest = average_daily_balance × (annual_rate / 360) × days_in_period. There is no within-period compounding of accrued interest onto the running balance.

Q: Rounding was specified as floor to 2 decimal places, once, on total gross interest. With gross, tax (15% of gross), and net (gross minus tax) now all in play: is tax computed on the already-floored gross and then itself floored to 2 dp, with net = floored_gross minus floored_tax? Or is only gross rounded and tax/net derived exactly? Please specify the rounding mode and order for tax and net.
A: Apply floor in sequence: (1) floor the exact gross to 2 dp — that is the posted gross; (2) compute tax as 15% of the floored gross, then floor that result to 2 dp — that is the tax withheld; (3) net = floored_gross − floored_tax. The bank retains all fractional remainders at each floor step.

Q: The 1,000 minimum-balance threshold that determines qualifying days: is it expressed in the same integer minor units as balances (i.e. 1,000 cents = 10.00 in major units), or 1,000 major currency units (100,000 minor units)?
A: 1,000 major currency units — for example, USD 1,000.00. In an integer minor-unit representation that is 100,000 cents (or equivalent minor units). A balance of 99,999 minor units is below the threshold; 100,000 is at or above it.

### Round 3
_Step reasoning:_ Core accrual, rounding, threshold and return policies are settled; remaining material unknowns are balance-history gap handling, empty/invalid-period behaviour, the rejection mechanism, and whether the 15% tax rate is fixed or per-account.

Q: Balance history gaps: if the daily balance history has no recorded entry for a day within [start, end), what end-of-day balance is used for that day — is the most recent prior balance carried forward, is the day treated as zero, or is a missing day an error?
A: [default, not policy] Carry the most recent prior recorded end-of-day balance forward to fill any gap. A day with no entry inherits the last known balance; it is not treated as zero and is not an error.

Q: Empty period: when start == end (days_in_period = 0), the average-balance divisor is zero — should post_interest return zero interest with an unchanged balance, or raise an error? Likewise, may start be after end, and if so is that rejected as invalid?
A: [default, not policy] start == end yields days_in_period = 0; post_interest should return zero gross interest, zero tax, zero net, and leave the balance unmutated — treat it as the same no-op described for a zero-balance period. start after end is rejected as invalid (see question 3).

Q: Rejection mechanism: for an invalid input (negative annual rate, and any of the above error cases), how should rejection surface — raise an exception, or return a sentinel/error record — and is the account left unmutated in that case?
A: [default, not policy] Invalid inputs — negative annual rate, start after end, or any other structurally invalid argument — should raise an exception. The account must be left entirely unmutated in all error cases; no partial state change occurs before the exception is thrown.

Q: Is the 15% tax withholding a fixed policy applied to every account, or can an account be tax-exempt (or carry a different rate)? If always 15%, is the rate a constant of the engine or a per-call/per-account parameter?
A: Key point 7 states 15% withholding as fixed policy applied at every posting. Whether an account may be tax-exempt or carry a different rate is [default, not policy]: treat the rate as a per-call parameter with 15% as the default, so the engine can accommodate exemptions or treaty rates without a code change, but the standard policy is always 15%.

### Round 4 (process signalled done)
_Step reasoning:_ All material policy decisions (day-count, accrual method, rounding sequence, balance basis and half-open period, sub-threshold handling, threshold units, gap fill, empty-period no-op, error handling, tax withholding, and return/mutation contract) have been resolved by the stakeholder; remaining details are settled defaults, so requirements gathering is complete.

(no questions this round)

## Produced specification

# Requirements Document

## Introduction

This feature is the interest engine for the bank's savings accounts. Given a savings account with a daily balance history over a period and an annual interest rate, the engine computes the interest the account earns for that period, withholds tax, posts the net interest to the account, and returns a record describing the computation. The public interface is a single function, `post_interest(account, period)`, which returns the interest posted alongside the account's updated balance.

Interest is accrued on the average daily balance using an actual/360 day-count convention over a half-open period. There is no within-period compounding: the rate is applied once to the average balance. Only days on which the balance meets a minimum threshold contribute to the interest, though every day counts toward the averaging divisor. Interest is floored to the minor unit at posting, tax is withheld at a default rate of 15%, and the net amount is added to the balance in place. Invalid inputs are rejected without mutating the account.

The following requirements capture every policy decision settled with the stakeholder. Points explicitly marked by the stakeholder as defaults rather than policy (numeric representation, balance snapshot timing, balance-history gap filling, empty-period handling, rejection mechanism, and tax-rate parameterisation) are recorded here as the engine's chosen behaviour.

## Requirements

### Requirement 1: Day-count convention and daily rate

**User Story:** As a savings product owner, I want the daily interest rate derived from the annual rate on an actual/360 basis, so that accrual follows the institution's chosen money-market convention.

#### Acceptance Criteria

1. WHEN the engine derives the daily rate from the annual rate THEN the system SHALL compute it as annual_rate / 360.
2. WHEN computing interest for a period THEN the system SHALL use the actual number of days in the period (actual/360), NOT a 365, 366, or 30/360 day count.
3. The system SHALL NOT apply any other day-count convention (actual/365, actual/actual, or 30/360).

### Requirement 2: Average daily balance accrual (no compounding)

**User Story:** As a savings product owner, I want interest accrued on the average daily balance with the rate applied once, so that the posted interest reflects the account's average holdings over the period without compounding accrued interest.

#### Acceptance Criteria

1. WHEN computing interest for a period THEN the system SHALL compute the average daily balance as the sum of each day's end-of-day balance over the period divided by the total number of days in the period.
2. WHEN computing gross interest THEN the system SHALL calculate it as average_daily_balance × (annual_rate / 360) × days_in_period.
3. The system SHALL apply the rate exactly once and SHALL NOT compound accrued or posted interest onto the running balance within the period.
4. The system SHALL divide the summed balances by the total number of days in the period, including days that contribute zero interest (see Requirement 4).

### Requirement 3: Half-open period and balance snapshot

**User Story:** As a savings product owner, I want the period treated as half-open with a clearly defined daily balance snapshot, so that a posting day is never double-counted across adjacent periods.

#### Acceptance Criteria

1. WHEN interpreting the period THEN the system SHALL treat it as half-open, [start, end): the start date is included and the end date is excluded.
2. WHEN a period closes on a given posting day THEN the system SHALL exclude that posting day from the period it closes and SHALL treat it as the first day of the next period.
3. WHEN determining a day's balance THEN the system SHALL use that day's end-of-day balance (chosen default; snapshot timing was not stakeholder policy).

### Requirement 4: Minimum-balance qualification

**User Story:** As a savings product owner, I want only days at or above a minimum balance to earn interest, so that low-balance days earn nothing while still counting toward the average.

#### Acceptance Criteria

1. WHEN a day's end-of-day balance is below 1,000 major currency units (100,000 minor units, e.g. cents) THEN the system SHALL treat that day as contributing zero interest for that day.
2. WHEN a day's end-of-day balance is at or above 1,000 major currency units (100,000 minor units) THEN the system SHALL treat that day as a qualifying day.
3. IF a day's balance is exactly 100,000 minor units THEN the system SHALL treat it as at or above the threshold (qualifying); IF the balance is 99,999 minor units THEN the system SHALL treat it as below the threshold (non-qualifying).
4. WHEN a day is below the threshold (including zero-balance days) THEN the system SHALL still count that day in the divisor of the average-balance calculation.
5. The system SHALL count the number of qualifying days (days at or above the 1,000 minimum) and SHALL include this count in the returned record.

### Requirement 5: Rounding — floor to the minor unit, applied in sequence

**User Story:** As a finance controller, I want gross, tax, and net all floored to two decimal places in a defined order, so that posting is deterministic and the bank retains fractional remainders.

#### Acceptance Criteria

1. WHEN posting THEN the system SHALL floor (truncate) the exact gross interest to 2 decimal places (the minor unit); this floored value SHALL be the posted gross.
2. WHEN computing tax THEN the system SHALL compute 15% of the floored gross and then floor that result to 2 decimal places; this floored value SHALL be the tax withheld.
3. WHEN computing net THEN the system SHALL calculate net = floored_gross − floored_tax.
4. The system SHALL use floor (truncate) as the rounding mode at every step and SHALL NEVER use half-up or half-even rounding.
5. WHEN flooring at any step THEN the bank SHALL retain the fractional remainder; the system SHALL NOT round remainders up or carry them forward.

### Requirement 6: Tax withholding

**User Story:** As a finance controller, I want a 15% withholding applied at every posting, with the ability to accommodate exemptions or treaty rates without a code change, so that standard postings comply while special cases remain configurable.

#### Acceptance Criteria

1. WHEN posting interest THEN the system SHALL withhold tax at 15% of the floored gross by default.
2. The system SHALL expose the tax rate as a per-call parameter defaulting to 15% (chosen default; parameterisation was not stakeholder policy, but 15% as fixed standard policy is).
3. WHEN no tax rate is supplied for a call THEN the system SHALL apply 15%.
4. WHEN a per-call tax rate is supplied (e.g. for a tax-exempt account or a treaty rate) THEN the system SHALL apply that rate in place of 15% following the same floor-in-sequence rules in Requirement 5.

### Requirement 7: Return record and in-place mutation

**User Story:** As a consumer of the interest engine, I want post_interest to return a complete record of the computation and to update the account balance in place, so that I can both post and audit the result.

#### Acceptance Criteria

1. WHEN post_interest completes a valid posting THEN the system SHALL return a record containing: gross interest, tax withheld, net interest posted (gross minus tax), the average daily balance computed for the period, the number of qualifying days, and the updated account balance.
2. WHEN a valid posting completes THEN the system SHALL mutate the account balance in place by adding the net interest to it.
3. The system SHALL represent monetary amounts as integer minor units, e.g. cents (chosen default; exact numeric type was not stakeholder policy).

### Requirement 8: Balance-history gaps

**User Story:** As a savings product owner, I want gaps in the daily balance history filled by carrying the last known balance forward, so that missing entries do not distort the average or raise spurious errors.

#### Acceptance Criteria

1. WHEN a day within [start, end) has no recorded end-of-day balance entry THEN the system SHALL carry forward the most recent prior recorded end-of-day balance for that day (chosen default; gap handling was not stakeholder policy).
2. The system SHALL NOT treat a missing day as a zero balance and SHALL NOT treat a missing day as an error.

### Requirement 9: Empty period (no-op)

**User Story:** As a consumer of the interest engine, I want an empty period to be a safe no-op, so that closing a period with no elapsed days neither errors nor changes the account.

#### Acceptance Criteria

1. WHEN start == end (days_in_period = 0) THEN the system SHALL return zero gross interest, zero tax, and zero net interest.
2. WHEN start == end THEN the system SHALL leave the account balance unmutated.
3. WHEN start == end THEN the system SHALL NOT attempt the average-balance division (which would divide by zero) and SHALL treat the call as a no-op (chosen default; empty-period handling was not stakeholder policy).

### Requirement 10: Invalid input rejection

**User Story:** As a consumer of the interest engine, I want invalid inputs rejected by an exception with no partial state change, so that a bad call can never leave the account in an inconsistent state.

#### Acceptance Criteria

1. IF the annual rate is negative THEN the system SHALL reject the call as invalid and SHALL raise an exception.
2. IF start is after end THEN the system SHALL reject the call as invalid and SHALL raise an exception.
3. IF any other structurally invalid argument is supplied THEN the system SHALL raise an exception (chosen default; rejection mechanism was not stakeholder policy).
4. WHEN any invalid input is rejected THEN the system SHALL leave the account entirely unmutated, with no partial state change occurring before the exception is thrown.
5. The account balance SHALL never go negative, so the system SHALL NOT apply any overdraft or debit interest rate.

## Approval

Do the requirements look good? If so, we can move on to the design.

## Auditor verdict

_The spec strongly covers the method/convention and edge decisions (1, 4, 5, 6, 7, 11, 12, 14 all correct) but inverts compounding (#2: mandates no compounding where the reference requires daily compounding) and omits the entire lifecycle and posting-cadence set: posting period/anniversary (#3), dormancy (#8), mid-period closure (#9), escheatment (#10), and mid-period rate changes (#13). Coverage = 8/14. Of the core in-focus six [1,2,3,8,9,10], only #1 is correct, indicating lifecycle and posting-cadence discipline did not generalise to this domain._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Req 2.1: 'compute the average daily balance as the sum of each day's end-of-day balance over the period divided by the total number of days in the period'; Req 2.3: 'apply the rate exactly once' | Spec uses average daily balance with the rate applied once to that average, matching the reference exactly and explicitly excluding per-day daily-balance accrual. |
| 2 | yes | no | Req 2.3: 'SHALL apply the rate exactly once and SHALL NOT compound accrued or posted interest onto the running balance within the period'; Introduction: 'There is no within-period compounding' | The reference requires daily compounding; the spec explicitly mandates no within-period compounding. Addressed but the opposite of the reference value. |
| 3 | no | no | absent | The spec never states a posting frequency or anchor; no mention of quarterly posting or the account-opening anniversary. Req 3 concerns the half-open period, not posting cadence. |
| 4 | yes | **yes** | Req 1.1: 'compute it as annual_rate / 360'; Req 1.2: 'actual/360, NOT a 365, 366, or 30/360 day count' | Days-in-year basis is 360 with daily rate = annual_rate/360, matching the reference precisely. |
| 5 | yes | **yes** | Req 4.1-4.5: below 1,000 'contributing zero interest'; at or above 1,000 'qualifying'; Req 4.4 'still count that day in the divisor' | Threshold of 1,000 with sub-threshold days earning nothing but still counting in the averaging divisor matches the reference exactly, including the boundary handling. |
| 6 | yes | **yes** | Req 5.1 'floor (truncate) ... to 2 decimal places'; Req 5.4 'NEVER use half-up'; Req 5.5 'the bank SHALL retain the fractional remainder' | Posted interest is floored to the minor unit, never half-up, with the bank keeping the fraction, matching the reference. |
| 7 | yes | **yes** | Req 6.1 'withhold tax at 15% of the floored gross'; Req 7.1 returns 'tax withheld, net interest posted (gross minus tax)' | 15% withholding deducted from gross at posting, account credited net, and tax reported separately in the return record, matching the reference. |
| 8 | no | no | absent | No mention of dormancy, a 12-month trigger, continued accrual while dormant, or a monthly dormancy fee anywhere in the spec. |
| 9 | no | no | absent | The spec's 'empty period' (Req 9) is start==end, not account closure mid-period. No pro-rata accrual to a closure date is addressed. |
| 10 | no | no | absent | Escheatment, the 5-year dormant trigger, and remittance to the state are entirely absent from the spec. |
| 11 | yes | **yes** | Req 10.1 'IF the annual rate is negative THEN ... reject ... raise an exception'; Req 10.5 'The account balance SHALL never go negative ... SHALL NOT apply any overdraft' | Negative rate rejected and no-overdraft/never-negative both explicit; a whole-period zero balance yields zero gross by the averaging formula, so all elements of the reference are satisfied. |
| 12 | yes | **yes** | Req 3.1 'half-open, [start, end): the start date is included and the end date is excluded'; Req 3.2 'exclude that posting day from the period it closes and ... first day of the next period' | Posting day excluded from the closing period and included in the next via half-open [start, end) semantics, matching the reference exactly. |
| 13 | no | no | absent | The spec treats annual_rate as a single value for the period; no handling of mid-period rate changes or per-rate-segment computation. The per-call tax rate in Req 6 is unrelated. |
| 14 | yes | **yes** | Req 7.1: return record containing 'gross interest, tax withheld, net interest posted ..., the average daily balance computed for the period, the number of qualifying days, and the updated account balance' | The returned record enumerates gross, tax withheld, net, average daily balance, qualifying-days count, and updated balance, matching every field in the reference. |
