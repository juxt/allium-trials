# kiro — savings-interest — iteration 1

Model (author): claude-opus · Questions asked: 12 · Captured: 8/14 · Bespoke captured: 6/10

## Conversation

### Round 1
_Step reasoning:_ The brief omits every material interest-computation policy (accrual basis, compounding, day-count, rounding, posting semantics, edge cases); these cannot be reliably inferred, so I must ask the stakeholder before drafting requirements.

Q: Interest accrual method: should interest be calculated on the daily balance and accrued daily (i.e. sum of daily balance x daily rate), or computed on a single balance figure (e.g. average or end-of-period balance) for the whole period?
A: Average daily balance: sum all daily balances over the period, divide by the number of days in the period, then apply the rate once to that average. Interest is not accumulated per day from per-day balance × daily rate.

Q: Compounding: does interest compound during the period (e.g. daily/monthly accrued interest itself earns interest), or is it simple interest posted once at period end?
A: Interest compounds daily within the period — each day's accrued interest joins the base for the next day's accrual. It is not simple interest.

Q: Day-count convention: how is the daily rate derived from the annual rate — divide by 365, 360, or actual days in the year (and how are leap years handled)?
A: 360-day basis. The daily rate is annual_rate / 360. Leap years are not distinguished.

Q: Rounding: to what precision is interest rounded (e.g. nearest cent/penny), at what point is rounding applied (per-day or once at posting), and which rounding mode (half-up, half-even/banker's)?
A: Rounding is applied once at posting (not per-day), rounded down (floor) to 2 decimal places (the minor unit). Half-up rounding is never used; the bank retains the sub-unit fraction.

Q: Posting effect: when interest is posted, is it added to the account's principal balance (and does the returned 'updated balance' include it), and does posting create a distinct transaction/ledger entry dated at period end?
A: Net interest (gross minus 15% withholding tax) is credited to the account balance; the returned updated balance includes it. Gross interest, tax withheld, and net posted are all reported separately. Whether posting creates a distinct ledger entry is [default, not policy] — yes, treat it as a distinct dated transaction.

Q: Period boundaries: is the period inclusive of both start and end dates, and how are days with no recorded balance entry treated (carry forward the last known balance)?
A: Periods are half-open [start, end): the posting day is excluded from the period it closes and included in the next period. Days with no recorded balance entry are [default, not policy] — carry forward the last known balance.

Q: Rate sign and edge cases: how should the function handle a zero or negative daily balance (e.g. overdrawn account — does it accrue negative/penalty interest or zero), and can the annual rate be zero or negative?
A: A negative annual rate is rejected as invalid. For zero or negative daily balance: the minimum-balance threshold applies — days where the balance is below 1,000 contribute zero interest to the numerator but still count in the divisor. The account never goes negative. A period where the balance is zero throughout posts a zero-interest entry (recorded, not skipped).

Q: Currency and units: what currency/minor-unit representation does the balance use (integer minor units vs decimal), so interest is computed and stored without floating-point error?
A: [default, not policy] Use integer minor units (e.g. pence or cents as whole integers) throughout to avoid floating-point error; convert to/from decimal only at the presentation layer.

### Round 2
_Step reasoning:_ All round-1 policy questions are answered, but the average-daily-balance vs daily-compounding answers directly contradict each other and the threshold units, tax rounding, and posting side-effects remain genuinely ambiguous and non-inferable.

Q: The 1,000 minimum-balance threshold: is that expressed in minor units (e.g. 100000 pence = £1,000) or major currency units, and is the comparison strict (< 1,000 excluded) or inclusive (<= 1,000 excluded)?
A: The threshold is expressed in major currency units (1,000 = £1,000 or equivalent). If balances are stored as integer minor units, the comparison threshold is 100,000 minor units. The comparison is inclusive of the threshold: a balance at or above 1,000 major units qualifies; strictly below (< 1,000 major units) contributes zero to the numerator but still counts in the divisor.

Q: The accrual method answers appear to conflict: one says take the average daily balance and apply the rate once, the other says interest compounds daily with each day's accrued interest joining the next day's base. These are mutually exclusive. Which governs, or how do they combine (e.g. compute daily on carried-forward balances, or single application to the period average)?
A: Average daily balance with a single application of the rate governs within the period. The two answers conflict and the accrual method (answer 1) is authoritative: sum all daily balances, divide by days in the period to get the average, apply the rate once to that average. The compounding statement (answer 2) was in error as a description of within-period behaviour; what it correctly describes is inter-period compounding — posted interest is credited to the balance and therefore enters the next period's average. There is no intra-period compounding.

Q: The 15% withholding tax: is tax computed on the floored gross interest or on the unrounded gross, and is the tax amount itself floored to 2 decimals before subtracting to get net?
A: Tax is computed on the unrounded gross interest, then the tax amount itself is floored to 2 decimal places before subtracting. Net posted = floor(gross, 2) − floor(gross × 0.15, 2). [default, not policy — the key does not specify this sequence explicitly; this ordering minimises rounding loss to the customer.]

Q: Does post_interest ever mutate the balance history by writing the posting as a new balance entry at the period-end date, or does it only return the updated balance and leave the input history untouched?
A: [default, not policy] post_interest does not mutate the input balance history. It returns the updated balance and a posting record (gross, tax withheld, net, average daily balance, qualifying days, updated balance) as new data. Persisting that posting as a new balance-history entry is the caller's responsibility.

### Round 3 (process signalled done)
_Step reasoning:_ Two rounds have resolved every material, non-inferrable policy: accrual method (average daily balance, single rate application), inter-period-only compounding, 360-day basis, floor-to-2dp-once-at-posting rounding, 15% withholding sequence, half-open periods with carry-forward, minimum-balance threshold units and inclusivity, integer minor units, and non-mutation of input history; the earlier accrual/compounding conflict is now authoritatively settled, so requirements are complete.

(no questions this round)

## Produced specification

# Requirements Document

## Introduction

This feature is the interest engine for the institution's savings accounts. It exposes a single function, `post_interest(account, period)`, which computes the interest a savings account earns over a given period and posts it to the account. The function returns the interest posted (broken down into gross, tax withheld and net) and the account's updated balance.

The engine uses an **average daily balance** method: it sums the account's daily balances across the period, divides by the number of days in the period to obtain an average, and applies the interest rate once to that average. Interest does **not** compound within a period; compounding is inter-period only, arising naturally because posted interest is credited to the balance and so enters the next period's average. Interest is computed on a 360-day basis, subject to a minimum-balance threshold, floored to the minor unit at posting, reduced by a 15% withholding tax, and credited net to the account. Monetary values are held as integer minor units throughout to avoid floating-point error.

The following requirements capture every policy decision settled with the stakeholder. Where a matter was neither settled nor stated, it is resolved as a documented default and marked as such.

## Requirements

### Requirement 1: Average daily balance accrual

**User Story:** As a savings account holder, I want interest computed on my average daily balance over the period, so that my interest fairly reflects the money held across the whole period rather than a single snapshot.

#### Acceptance Criteria

1. WHEN `post_interest` computes interest for a period THEN the system SHALL sum the account's daily balances over the period, divide that sum by the number of days in the period to obtain the average daily balance, and apply the interest rate once to that average.
2. The system SHALL NOT accumulate interest per day as (per-day balance × daily rate) summed across days.
3. The system SHALL NOT compound interest within a period; no day's accrued interest joins the base for any subsequent day's accrual in the same period.
4. WHEN two answers appear to conflict (average-daily-balance-once versus daily compounding) THEN the system SHALL treat the average-daily-balance method with a single application of the rate as authoritative.

### Requirement 2: Inter-period compounding

**User Story:** As a savings account holder, I want interest already posted to earn interest in later periods, so that my savings grow over successive periods.

#### Acceptance Criteria

1. WHEN interest is posted at the close of a period THEN the system SHALL credit the net interest to the account balance so that it forms part of the balance carried into the next period.
2. WHEN a subsequent period's average daily balance is computed THEN the system SHALL include any previously posted interest that is present in the daily balances of that period.
3. The system SHALL achieve compounding only across periods (inter-period) and never within a single period (intra-period).

### Requirement 3: Day-count convention

**User Story:** As the institution, I want the daily rate derived on a fixed 360-day basis, so that interest calculations are consistent and predictable.

#### Acceptance Criteria

1. WHEN the system derives the daily rate from the annual rate THEN the system SHALL compute it as annual_rate / 360.
2. The system SHALL NOT distinguish leap years; the 360-day basis SHALL apply regardless of the calendar year.
3. WHEN determining the number of days in a period for the average and for the daily rate THEN the system SHALL use the 360-day basis convention consistently.

### Requirement 4: Minimum-balance threshold

**User Story:** As the institution, I want days below a minimum balance to earn no interest while still counting toward the period length, so that low-balance days neither earn interest nor shorten the averaging window.

#### Acceptance Criteria

1. The system SHALL apply a minimum-balance threshold of 1,000 major currency units, equal to 100,000 minor units when balances are stored as integer minor units.
2. WHEN a day's balance is at or above the threshold (>= 1,000 major units) THEN the system SHALL include that day's balance in the numerator (the sum of daily balances) used to compute the average.
3. WHEN a day's balance is strictly below the threshold (< 1,000 major units) THEN the system SHALL contribute zero to the numerator for that day.
4. WHEN any day falls below the threshold THEN the system SHALL still count that day in the divisor (the number of days in the period).
5. The system SHALL treat the threshold comparison as inclusive of the threshold value: a balance exactly equal to 1,000 major units qualifies.

### Requirement 5: Rounding at posting

**User Story:** As the institution, I want interest rounded down to the minor unit once at posting, so that rounding is applied predictably and the sub-unit fraction is retained by the bank.

#### Acceptance Criteria

1. WHEN interest is posted THEN the system SHALL apply rounding once at posting, not per day.
2. WHEN rounding gross interest THEN the system SHALL round down (floor) to 2 decimal places (the minor unit).
3. The system SHALL NOT use half-up rounding at any point.
4. WHEN flooring produces a sub-unit fraction THEN the bank SHALL retain that fraction; it is not credited to the customer.

### Requirement 6: Withholding tax

**User Story:** As the institution, I want a 15% withholding tax deducted from interest before it is credited, so that the account receives net interest and tax is accounted for separately.

#### Acceptance Criteria

1. WHEN computing withholding tax THEN the system SHALL compute the tax on the unrounded gross interest at a rate of 15%.
2. WHEN determining the tax amount to subtract THEN the system SHALL floor the computed tax to 2 decimal places before subtracting.
3. WHEN computing net interest THEN the system SHALL compute it as net = floor(gross, 2) − floor(gross × 0.15, 2).
4. The system SHALL credit the net interest (not the gross) to the account balance.
5. NOTE: The exact sequencing in criteria 1–3 (tax on unrounded gross, then floor the tax, then subtract) is a documented default chosen to minimise rounding loss to the customer; the stakeholder key did not specify the ordering explicitly.

### Requirement 7: Posting effect and returned values

**User Story:** As a caller of the interest engine, I want the net interest credited to the balance and a full breakdown returned, so that I can update the account and report gross, tax and net separately.

#### Acceptance Criteria

1. WHEN interest is posted THEN the system SHALL credit the net interest to the account's balance.
2. WHEN the function returns THEN the returned updated balance SHALL include the credited net interest.
3. WHEN the function returns THEN the system SHALL report gross interest, tax withheld and net posted separately.
4. WHEN the function returns THEN the system SHALL return a posting record containing at least: gross interest, tax withheld, net posted, average daily balance, qualifying days, and updated balance.
5. The system SHALL treat a posting as a distinct dated transaction dated at period end (documented default; not explicitly settled as policy).

### Requirement 8: Period boundaries and missing balances

**User Story:** As the institution, I want periods defined as half-open intervals with missing days carried forward, so that no day is double-counted across adjacent periods and gaps in the balance history are handled deterministically.

#### Acceptance Criteria

1. The system SHALL treat every period as the half-open interval [start, end).
2. WHEN a period closes on its posting day THEN the system SHALL exclude that posting day from the period being closed and include it in the next period.
3. WHEN a day within the period has no recorded balance entry THEN the system SHALL carry forward the last known balance for that day (documented default; not explicitly settled as policy).

### Requirement 9: Rate validity and edge cases

**User Story:** As the institution, I want invalid rates rejected and edge-case balances handled safely, so that the engine never produces incorrect postings or drives an account negative.

#### Acceptance Criteria

1. IF the annual rate is negative THEN the system SHALL reject it as invalid.
2. The system SHALL allow an annual rate of zero.
3. WHEN a day's balance is zero or negative THEN Requirement 4 SHALL govern: such a day contributes zero to the numerator (being below the threshold) but still counts in the divisor.
4. The system SHALL never allow the account balance to go negative as a result of interest posting.
5. WHEN the balance is zero throughout a period THEN the system SHALL post a zero-interest entry; the entry SHALL be recorded, not skipped.

### Requirement 10: Currency representation

**User Story:** As a developer integrating the engine, I want money held as integer minor units, so that calculations are free of floating-point error.

#### Acceptance Criteria

1. The system SHALL represent and compute all monetary values as integer minor units (for example pence or cents as whole integers) throughout (documented default; not explicitly settled as policy).
2. WHEN a decimal representation is required THEN the system SHALL convert to or from decimal only at the presentation layer.

### Requirement 11: Non-mutation of input history

**User Story:** As a caller of the interest engine, I want the function to leave my balance history untouched and hand back a posting record, so that I control how and whether the posting is persisted.

#### Acceptance Criteria

1. The system SHALL NOT mutate the input balance history (documented default; not explicitly settled as policy).
2. WHEN the function completes THEN the system SHALL return the updated balance and a posting record as new data.
3. The system SHALL leave persistence of the posting as a new balance-history entry to the caller's responsibility.

---

Do the requirements look good? If so, we can move on to the design.

## Auditor verdict

_The spec covers the core method and convention decisions (1, 4, 5, 6, 7, 11, 12, 14) correctly and precisely, matching the reference on average daily balance, 360-day basis, the 1,000 threshold mechanics, floor rounding, 15% withholding, edge cases, half-open boundaries, and output shape. It fails the lifecycle decisions entirely (dormancy #8, closure #9, escheatment #10 are absent) and misses the mid-period rate-change rule (#13) and the posting-period frequency/anchor (#3). It surfaces compounding (#2) but resolves it wrongly, denying the intra-period daily compounding the reference requires. Coverage: 8/14 correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Req 1 AC1: 'sum the account's daily balances over the period, divide that sum by the number of days in the period to obtain the average daily balance, and apply the interest rate once to that average'; AC2 forbids per-day daily-balance summation. | Matches the reference exactly: average daily balance with a single rate application, and explicitly rules out per-day daily-balance accrual. |
| 2 | yes | no | Req 1 AC3 and Req 2 AC3: 'The system SHALL NOT compound interest within a period'; 'achieve compounding only across periods (inter-period) and never within a single period (intra-period)'. | The reference requires daily compounding within the period; the spec explicitly denies intra-period compounding and allows only inter-period compounding, so the resolution is the opposite of the reference value. |
| 3 | no | no | absent | The spec treats 'period' abstractly and never states the posting frequency (quarterly) or the anchor (anniversary of opening vs calendar quarter-ends). Req 7.5 only dates a posting at period end. |
| 4 | yes | **yes** | Req 3 AC1: 'compute it as annual_rate / 360'; AC2-AC3 apply the 360-day basis regardless of leap years. | Matches the 360-day basis exactly. |
| 5 | yes | **yes** | Req 4: threshold 1,000; '>= 1,000' included in numerator, '< 1,000' contributes zero, but the day 'SHALL still count that day in the divisor'; exactly 1,000 qualifies. | Matches the reference: interest on days at or above 1,000, sub-threshold days contribute zero yet still count in the divisor, inclusive comparison. |
| 6 | yes | **yes** | Req 5 AC2-AC4: 'round down (floor) to 2 decimal places'; 'SHALL NOT use half-up rounding'; 'the bank SHALL retain that fraction'. | Matches floor-to-minor-unit rounding with the bank keeping the fraction, never half-up. |
| 7 | yes | **yes** | Req 6: '15% withholding tax deducted', 'credit the net interest (not the gross)'; Req 7 AC3: 'report gross interest, tax withheld and net posted separately'. | Matches the 15% withholding, net credited, tax reported separately. |
| 8 | no | no | absent | The spec contains no dormancy concept: no 12-month trigger, no continued accrual while dormant, and no monthly dormancy fee of 5. |
| 9 | no | no | absent | The spec never addresses mid-period closure; there is no pro-rata accrual to a closure date or net-of-tax posting at closing. |
| 10 | no | no | absent | No escheatment rule appears: no 5-year dormant trigger, no remittance to the state, no closure to zero balance. |
| 11 | yes | **yes** | Req 9: 'IF the annual rate is negative THEN the system SHALL reject it'; 'never allow the account balance to go negative'; AC5: zero-balance period 'SHALL post a zero-interest entry; the entry SHALL be recorded, not skipped'. | Matches all three: negative rate rejected, zero balance a recorded zero-interest no-op, account never negative. |
| 12 | yes | **yes** | Req 8 AC1-AC2: 'treat every period as the half-open interval [start, end)'; 'exclude that posting day from the period being closed and include it in the next period'. | Matches the half-open [start, end) boundary with the posting day excluded from the closing period and included in the next. |
| 13 | no | no | absent | The spec covers rate validity (Req 9) but never handles a rate change mid-period; no per-day rate-in-force rule or per-segment computation is stated. |
| 14 | yes | **yes** | Req 7 AC4: return a posting record containing at least 'gross interest, tax withheld, net posted, average daily balance, qualifying days, and updated balance'. | Matches the required output shape field for field, including the specific average daily balance and qualifying-days disclosure. |
