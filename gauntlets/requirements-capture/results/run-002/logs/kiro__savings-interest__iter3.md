# kiro — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 24 · Captured: 9/14 · Bespoke captured: 7/10

## Conversation

### Round 1
_Step reasoning:_ Several interest-computation policies (day-count, compounding, posting frequency, rounding, balance definition, rate semantics) are omitted and cannot be reliably inferred, so I must ask the stakeholder before drafting requirements.

Q: What day-count convention should be used to convert the annual rate to a daily rate (e.g. actual/365, actual/360, actual/actual), and how should leap years be handled?
A: 360-day basis: daily rate = annual_rate / 360. Leap years are irrelevant under this convention.

Q: How is interest compounded over the period: simple interest on each day's balance, or daily compounding where posted/accrued interest itself earns interest?
A: Daily compounding — each day's accrued interest joins the principal for the following day's accrual within the period.

Q: At what frequency is interest actually posted to the account (daily, monthly, or once at the end of the period), and does the posting date's balance then include the newly posted interest for subsequent accrual?
A: Interest is posted quarterly, on the anniversary of account opening. Periods are half-open [start, end): the posting day is excluded from the period it closes and included in the next period, so newly posted interest is part of the opening balance for subsequent accrual.

Q: How should the daily interest and the final posted amount be rounded (e.g. round each day's accrual to the nearest cent, or accrue at full precision and round only at posting), and what rounding rule applies (half-up, banker's rounding)?
A: Accrue at full floating-point precision throughout the period; round only at posting. Rounding rule is floor (round down) to 2 decimal places — never half-up. The bank retains the fractional remainder.

Q: How is the 'daily balance' for each day defined when balances change intraday (e.g. end-of-day balance, and is the first/last day of the period inclusive or exclusive)?
A: End-of-day balance is used for each day [default, not policy]. Periods are half-open [start, end): the first day of the period is included; the closing/posting day is excluded and falls in the next period.

Q: Is the annual interest rate a nominal annual rate or an effective annual rate, and can it change within the period?
A: Nominal annual rate, converted to a daily rate by dividing by 360. The rate can change mid-period; each day uses the rate in force on that day, and interest is computed per rate-segment then summed.

### Round 2
_Step reasoning:_ Core mechanics (day-count, compounding, posting cadence, rounding, rate segments) are settled; remaining uninferable policies concern overdrawn balances, multi-anniversary periods, missing-day handling, and remainder carry-over.

Q: How should negative (overdrawn) balances be treated — are days with a negative end-of-day balance skipped (no interest), charged debit interest at the same rate, or charged at a separate overdraft rate?
A: The account never goes negative — the system prevents overdrafts, so this case does not arise in practice. If a negative end-of-day balance were somehow present in the data, treat it the same as a below-minimum day: the balance contributes zero interest but still counts toward the divisor in the average-daily-balance calculation. No separate overdraft rate applies. [partial default for the data-error edge case; the 'account never goes negative' constraint is policy]

Q: If the supplied period spans more than one quarterly posting anniversary, should post_interest post interest at each anniversary within the period (multiple postings) or only compute a single posting for the period passed in?
A: post_interest should compute a single posting for the period passed in. Callers are responsible for supplying exactly one quarter at a time — the function does not detect or iterate over multiple anniversaries within a longer span. [default, not policy]

Q: How should gaps or missing days in the daily balance history be handled — carry forward the last known end-of-day balance, treat the missing day's balance as zero, or reject the period as invalid?
A: Carry forward the last known end-of-day balance for any missing day — treat the gap as a day on which no transaction occurred and the balance was unchanged. Rejecting the period would be too disruptive; zeroing missing days would understate the customer's balance. [default, not policy]

Q: On what rounded balance does the next period's accrual begin — the floored posted figure (bank keeps the remainder) becomes the new principal, confirming the fractional remainder is dropped from the account entirely rather than carried forward?
A: Yes. The floored (posted) figure becomes the opening balance for the next period. The fractional remainder is not carried forward in any form — the bank retains it and it plays no further part in accrual.

### Round 3
_Step reasoning:_ Round 2 surfaced two concepts never pinned down — a minimum-balance threshold and an average-daily-balance method — the latter conflicting with the daily-compounding model from Round 1, so these must be resolved before specifying.

Q: Round 2's answer on negative balances referenced a 'below-minimum day' and an 'average-daily-balance calculation' — neither was established earlier. Is there a minimum-balance threshold below which a day accrues zero interest, and if so, what is the threshold and is it applied to each day's end-of-day balance?
A: Yes, a minimum-balance threshold exists: 1,000. Interest accrues only on days when the end-of-day balance is at or above 1,000. On days below that threshold the day contributes zero to the interest numerator but still counts as a full day in the divisor used to compute the average daily balance.

Q: That same answer describes interest via an 'average daily balance' (balance summed over days, divided by a day-count divisor), but Round 1 established daily compounding where each day's accrued interest joins the next day's principal. Which model actually applies — per-day compounding on each end-of-day balance, or an average-daily-balance method — and if both, how do they combine?
A: The average-daily-balance (ADB) method applies: sum all end-of-day balances over the period, divide by the total number of days in the period, then apply the daily rate to that average balance for the full period. This is the operative calculation. The Round 1 answer describing per-day compounding where each day's accrued interest joins the next day's principal was incorrect; that model does not apply within a period. 'Compounding' in this context means inter-period: interest posted at the end of one quarter is added to the opening balance and therefore forms part of the daily balances used to compute the ADB for the next quarter.

Q: If a minimum-balance threshold exists: when a day falls below it and contributes zero interest, does that day still count toward the compounding/averaging divisor (as the negative-balance answer implies), and does falling below the minimum affect only that day or forfeit interest for the whole period?
A: Yes, a below-minimum day still counts in the divisor — it reduces the average daily balance used for the calculation. Only that specific day's balance is excluded from the numerator; the rest of the period is unaffected. Falling below the minimum does not forfeit interest for the whole period.

### Round 4
_Step reasoning:_ A genuine contradiction remains between the ADB method (Round 3) and per-rate-segment computation (Round 1), and the exact ADB formula and day-count multiplier need confirming before the requirements are complete and accurate.

Q: Round 3 established that the operative calculation is the average-daily-balance (ADB) method applied over the whole period, but Round 1 established that the rate can change mid-period and interest is 'computed per rate-segment then summed'. These two don't combine unambiguously. When the rate changes mid-period, which applies: (a) split the period into rate-segments, compute a separate ADB for each segment (sum of that segment's end-of-day balances / that segment's day count) and interest = segment_ADB × segment_daily_rate × segment_days, then sum the segments; or (b) compute one ADB over the whole period and apply some blended/weighted rate to it? Please specify the exact formula.
A: Option (a) applies. Split the period into rate-segments; for each segment compute segment_ADB = (sum of that segment's end-of-day balances, with below-minimum days contributing 0 to the numerator) / (total days in the whole period — not the segment day count); then segment_interest = segment_ADB × (segment_annual_rate / 360) × segment_days. Sum the segment_interest values to get gross interest for the period. The divisor is always the total period length, not the segment length.

Q: To confirm the single-rate ADB formula explicitly: is posted interest (before flooring) equal to ADB × (annual_rate / 360) × (number of days in the period), where ADB = (sum of end-of-day balances, counting below-minimum days as 0 in the sum) / (total number of days in the period)? In particular, is the daily rate multiplied by the number of days in the period, not by 360 or by 90?
A: Yes, confirmed for the single-rate case: gross_interest = ADB × (annual_rate / 360) × N, where ADB = (sum of qualifying end-of-day balances, with below-minimum days counted as 0 in the numerator) / N, and N is the total number of days in the period. The daily rate (annual_rate / 360) is multiplied by N (the actual day count of the period), not by 360 or by a fixed 90.

### Round 5
_Step reasoning:_ Four rounds resolved the core contradictions and confirmed both ADB formulas; the only unresolved policy is where two confirmed rules intersect — mid-period rate changes under the half-open convention (segment boundaries, rate carry-forward) and how the threshold interacts with carried-forward days.

Q: When the rate changes mid-period, how are the rate-segment boundaries defined under the half-open [start, end) convention — does a rate that becomes effective on day D apply from D inclusive (so the prior segment ends the day before), and if the rate history has a gap, should the last known rate be carried forward (mirroring the balance carry-forward rule)?
A: A rate effective on day D applies from D inclusive; the prior segment runs [segment_start, D) and the new segment begins [D, next_change_or_period_end). The divisor for each segment's ADB calculation is always N, the total days in the whole period, as established in Round 4. For gaps in the rate history, carry forward the last known rate, mirroring the balance carry-forward rule.

Q: Does the below-minimum (<1,000) exclusion and the missing-day carry-forward compose as expected — i.e. a day whose balance is carried forward from the last known value is still subject to the 1,000 threshold test for the numerator while always counting in the divisor?
A: Yes, the two rules compose independently in that order: first fill any missing day's balance by carrying forward the last known end-of-day balance, then apply the 1,000 threshold test to the resulting figure. If the carried-forward balance is at or above 1,000 it enters the numerator; if below, it contributes 0 to the numerator. In both cases the day counts in the divisor.

### Round 6
_Step reasoning:_ Computation is fully pinned, but the returned 'updated balance' is undefined and Round 2's wording on it is self-contradictory; also need degenerate-case behaviour before the spec is complete.

Q: The function returns both the interest posted and the account's updated balance, but the exact definition of 'updated balance' is still ambiguous. Is the updated balance equal to the period's closing figure (the last end-of-day balance carried into the posting day) plus the floored posted interest? And to reconcile Round 2's wording ('the floored posted figure becomes the opening balance for the next period'): does 'floored posted figure' there mean the floored interest *added to* the closing principal (i.e. new opening balance = closing balance + floored interest), rather than the interest amount replacing the principal? Please state exactly what numeric value is returned as the updated balance and how it relates to the opening balance of the next period.
A: The updated balance is the closing end-of-day balance (the last carried end-of-day balance on the day before the posting date, i.e. the final day of the half-open period [start, end)) plus the net interest posted after withholding tax. Concretely: updated_balance = closing_balance + net_interest_posted, where net_interest_posted = floored_gross_interest − tax_withheld. This figure is what is credited to the account and what becomes the opening balance for the next period. 'Floored posted figure' in Round 2 referred to the net interest amount (after tax) added to the principal, not the interest replacing it.

Q: What should post_interest return (or do) in the degenerate cases: a period with zero days (start == end under the half-open convention), and a period where every day is below the 1,000 minimum so gross interest is 0 — is posted interest simply 0.00 with the updated balance left equal to the opening/closing balance, and is any posting record still produced?
A: For a zero-day period (start == end, so N = 0): return gross interest 0.00, tax withheld 0.00, net interest 0.00, ADB undefined (or 0), qualifying days 0, updated balance equal to the closing balance; still produce a posting record. [default, not policy] For a period where every day is below the 1,000 minimum so gross interest is 0: same treatment as the zero-balance whole-period case — post 0.00 interest, deduct 0.00 tax, credit 0.00 net, leave the balance unchanged, and still record the posting.

### Round 7
_Step reasoning:_ Round 6 added withholding tax to the return/updated-balance formula but never specified its rate, base (pre- vs post-floor), rounding, or thresholds — the one material policy left dangling before the spec can be written.

Q: Round 6 introduced withholding tax (net_interest_posted = floored_gross_interest − tax_withheld) but its rules were never established. (a) What is the withholding tax rate, and is it a flat rate or does it depend on account type/customer status/an exemption flag? (b) Is tax computed on the gross interest before or after the floor-to-2dp step — i.e. is it tax = rate × floored_gross_interest, or tax = rate × raw_gross_interest? (c) How is the tax amount itself rounded (floor to 2dp like interest, half-up, or banker's), and in which direction does any remainder go? (d) Is there a tax-free threshold below which no tax is withheld, and is tax ever withheld when gross interest is 0.00?
A: 15% flat rate. The answer key states this as policy with no qualification for account type, customer status, or exemption flags.

### Round 8
_Step reasoning:_ Round 7 answered only the tax rate; its sub-parts (b) tax base, (c) tax rounding, (d) tax-free threshold/zero-interest handling remain open and are material to post_interest's output, so I ask them in this final round.

Q: Round 7 established the withholding tax rate (15% flat) but left three sub-parts unanswered. (b) Is tax computed on the floored gross interest (tax = 0.15 × floored_gross_interest) or on the raw pre-floor gross interest (tax = 0.15 × raw_gross_interest)?
A: Tax is computed on the floored gross interest: tax = 0.15 × floored_gross_interest. [default, not policy]

Q: (c) How is the tax amount itself rounded — floor to 2 decimal places like the interest, half-up, or banker's rounding — and does the bank retain any fractional remainder from the tax calculation the same way it retains the interest remainder?
A: Floor to 2 decimal places, the same rule as the interest rounding. The bank retains any fractional remainder from the tax calculation. [default, not policy]

Q: (d) Is there a tax-free threshold below which no tax is withheld, and is tax ever withheld when gross interest is 0.00 (e.g. a zero-day or all-below-minimum period)?
A: No tax-free threshold exists. When gross interest is 0.00, tax withheld is 0.00 and net interest posted is 0.00 — no withholding occurs. [default, not policy]

Q: When tax is withheld, where does it go in the returned figures — is net_interest_posted = floored_gross_interest − tax_withheld the only amount credited (tax removed from the account entirely), and should the posting record expose gross interest, tax withheld, and net interest as separate fields?
A: Yes: net_interest_posted = floored_gross_interest − tax_withheld is the only amount credited to the account; the tax is removed from the account entirely. The posting record exposes gross interest, tax withheld, and net interest posted as separate fields, alongside average daily balance, qualifying days, and updated balance.

## Produced specification

# Requirements Document

## Introduction

This feature is the interest engine for the institution's savings accounts. Its entry point is a single function, `post_interest(account, period)`, which computes the interest an account earns over a supplied period, applies withholding tax, posts the net amount to the account, and returns both the interest posted and the account's updated balance.

The operative calculation is the average-daily-balance (ADB) method. Over the period, each day's end-of-day balance is examined; qualifying days (those at or above the minimum-balance threshold) contribute to a numerator, every day counts toward a divisor, and the resulting average balance is accrued at a 360-basis daily rate for the actual number of days in the period. Gross interest is floored to two decimal places, withholding tax is deducted, and the net is credited to the account. The floored, after-tax figure becomes part of the opening balance for the next period, which is the only sense in which interest compounds: between periods, never within one.

The function handles a single posting period at a time. Callers are responsible for supplying exactly one quarter, delimited by the account's quarterly posting anniversaries. The period is half-open `[start, end)`: the first day is included and the closing (posting) day is excluded, falling into the next period instead.

This document records every policy and default settled with the stakeholder. Where a point was neither in the brief nor settled in conversation, it is left unspecified rather than invented.

## Requirements

### Requirement 1

**User Story:** As a savings-platform engineer, I want a single function that computes and posts one period's interest, so that I can credit accounts correctly without re-implementing the interest policy at each call site.

#### Acceptance Criteria

1. WHEN `post_interest(account, period)` is called THEN the system SHALL compute the interest for the supplied period, floor and tax it, post the net interest to the account, and return the interest posted together with the account's updated balance.
2. WHEN `post_interest` returns THEN the system SHALL produce a posting record exposing, as separate fields, the gross interest, the tax withheld, the net interest posted, the average daily balance, the number of qualifying days, and the updated balance.
3. WHEN a period is supplied THEN the system SHALL treat it as half-open `[start, end)`: the first day of the period is included and the closing/posting day is excluded and belongs to the next period.
4. WHEN a period is supplied THEN the system SHALL compute a single posting for exactly that period and SHALL NOT detect or iterate over multiple posting anniversaries within a longer span; callers are responsible for supplying exactly one quarter at a time.
5. WHERE the account's posting schedule is concerned the system SHALL treat interest as posted quarterly, on the anniversary of account opening.

### Requirement 2

**User Story:** As a finance stakeholder, I want the annual rate converted to a daily rate on a fixed basis, so that accrual is predictable and independent of the calendar.

#### Acceptance Criteria

1. WHEN converting the annual interest rate to a daily rate THEN the system SHALL use a 360-day basis: daily_rate = annual_rate / 360.
2. WHERE leap years occur the system SHALL ignore them, as they are irrelevant under the 360-day convention.
3. WHERE the annual rate is defined the system SHALL treat it as a nominal annual rate, not an effective annual rate.
4. WHEN accruing interest over the period THEN the system SHALL multiply the daily rate by N, the actual number of days in the period, and SHALL NOT multiply by 360 or by a fixed 90.

### Requirement 3

**User Story:** As a finance stakeholder, I want interest computed by the average-daily-balance method over the period, so that the figure reflects the balance actually held across the whole period.

#### Acceptance Criteria

1. WHERE the interest model is concerned the system SHALL use the average-daily-balance (ADB) method and SHALL NOT compound each day's accrued interest into the following day's principal within a period.
2. WHEN computing interest for a single-rate period THEN the system SHALL compute ADB = (sum of qualifying end-of-day balances, with below-minimum days counted as 0 in the numerator) / N, where N is the total number of days in the period.
3. WHEN computing interest for a single-rate period THEN the system SHALL compute gross_interest = ADB × (annual_rate / 360) × N.
4. WHEN summing end-of-day balances for the numerator THEN the system SHALL use the end-of-day balance for each day.
5. WHEN counting days for the divisor THEN the system SHALL count every day in the period, including days that contribute 0 to the numerator.

### Requirement 4

**User Story:** As a finance stakeholder, I want mid-period rate changes handled by splitting the period into rate-segments, so that each day earns at the rate in force on that day.

#### Acceptance Criteria

1. WHEN the rate changes within the period THEN the system SHALL split the period into rate-segments and compute interest per segment, then sum the segments to obtain the gross interest for the period.
2. WHEN computing a segment's average balance THEN the system SHALL compute segment_ADB = (sum of that segment's end-of-day balances, with below-minimum days contributing 0 to the numerator) / N, where N is the total number of days in the whole period and not the segment's day count.
3. WHEN computing a segment's interest THEN the system SHALL compute segment_interest = segment_ADB × (segment_annual_rate / 360) × segment_days, where segment_days is the number of days in that segment.
4. WHEN a rate becomes effective on day D THEN the system SHALL apply that rate from D inclusive, ending the prior segment at `[segment_start, D)` and beginning the new segment at `[D, next_change_or_period_end)`.
5. IF the rate history has a gap THEN the system SHALL carry forward the last known rate for the affected days, mirroring the balance carry-forward rule.

### Requirement 5

**User Story:** As a finance stakeholder, I want a minimum-balance threshold enforced per day, so that only days meeting the balance requirement earn interest.

#### Acceptance Criteria

1. WHERE the minimum-balance threshold is concerned the system SHALL use a threshold of 1,000.
2. IF a day's end-of-day balance is at or above 1,000 THEN the system SHALL include that balance in the interest numerator for the period.
3. IF a day's end-of-day balance is below 1,000 THEN the system SHALL count that day as contributing 0 to the interest numerator while still counting it as a full day in the divisor.
4. WHEN a day falls below the minimum THEN the system SHALL exclude only that day's balance from the numerator and SHALL NOT forfeit interest for the rest of the period.

### Requirement 6

**User Story:** As a savings-platform engineer, I want missing days in the balance history filled by carrying forward the last known balance, so that gaps are treated as days with no transaction rather than rejected or zeroed.

#### Acceptance Criteria

1. IF a day in the period has no recorded end-of-day balance THEN the system SHALL carry forward the last known end-of-day balance for that day.
2. WHEN filling missing days THEN the system SHALL NOT reject the period and SHALL NOT treat the missing day's balance as zero.
3. WHEN both the carry-forward rule and the minimum-balance test apply to a day THEN the system SHALL first fill the missing balance by carrying forward the last known end-of-day balance, and then apply the 1,000 threshold test to the resulting figure.
4. IF a carried-forward balance is at or above 1,000 THEN the system SHALL include it in the numerator; IF it is below 1,000 THEN the system SHALL count it as 0 in the numerator; in both cases the system SHALL count the day in the divisor.

### Requirement 7

**User Story:** As a risk stakeholder, I want negative balances handled defensively, so that a data error never produces incorrect interest even though overdrafts cannot occur.

#### Acceptance Criteria

1. WHERE account balances are concerned the system SHALL rely on the constraint that the account never goes negative because overdrafts are prevented.
2. IF a negative end-of-day balance is nonetheless present in the data THEN the system SHALL treat that day the same as a below-minimum day: the balance contributes 0 to the numerator while the day still counts in the divisor.
3. WHEN a negative balance is encountered THEN the system SHALL NOT apply any separate overdraft or debit-interest rate.

### Requirement 8

**User Story:** As a finance stakeholder, I want accrual carried at full precision and rounded only at posting by flooring, so that the bank's rounding policy is applied consistently and the remainder is retained.

#### Acceptance Criteria

1. WHEN accruing interest throughout the period THEN the system SHALL accrue at full floating-point precision and SHALL NOT round intermediate daily or segment figures.
2. WHEN posting the gross interest THEN the system SHALL round it by flooring (rounding down) to 2 decimal places and SHALL NOT use half-up or banker's rounding.
3. WHEN flooring produces a fractional remainder THEN the system SHALL have the bank retain that remainder, and the remainder SHALL play no further part in accrual and SHALL NOT be carried forward in any form.

### Requirement 9

**User Story:** As a compliance stakeholder, I want a flat withholding tax deducted from posted interest, so that the correct net amount is credited and the tax is accounted for separately.

#### Acceptance Criteria

1. WHERE withholding tax is concerned the system SHALL apply a flat rate of 15%, with no qualification for account type, customer status, or exemption flags.
2. WHEN computing tax THEN the system SHALL compute tax = 0.15 × floored_gross_interest, using the floored gross interest rather than the raw pre-floor gross interest.
3. WHEN rounding the tax amount THEN the system SHALL floor it to 2 decimal places, the same rule as the interest rounding, and the bank SHALL retain any fractional remainder from the tax calculation.
4. WHERE a tax-free threshold might apply the system SHALL apply none.
5. WHEN the gross interest is 0.00 THEN the system SHALL withhold 0.00 tax and post 0.00 net interest.
6. WHEN tax is withheld THEN the system SHALL credit only net_interest_posted = floored_gross_interest − tax_withheld to the account, removing the tax from the account entirely.

### Requirement 10

**User Story:** As a savings-platform engineer, I want the updated balance defined exactly and carried into the next period, so that inter-period compounding is correct and unambiguous.

#### Acceptance Criteria

1. WHEN determining the closing balance THEN the system SHALL use the last carried end-of-day balance on the final day of the half-open period `[start, end)`, i.e. the day before the posting date.
2. WHEN computing the updated balance THEN the system SHALL compute updated_balance = closing_balance + net_interest_posted, where net_interest_posted = floored_gross_interest − tax_withheld.
3. WHEN interest is posted THEN the system SHALL credit net_interest_posted to the account, and the updated balance SHALL become the opening balance for the next period.
4. WHERE compounding occurs the system SHALL treat it as inter-period only: interest posted at the end of one quarter is added to the opening balance and therefore forms part of the daily balances used to compute the ADB for the next quarter.

### Requirement 11

**User Story:** As a savings-platform engineer, I want degenerate periods handled deterministically, so that empty or non-qualifying periods still produce a consistent, recorded result.

#### Acceptance Criteria

1. IF the period has zero days (start == end, so N = 0) THEN the system SHALL return gross interest 0.00, tax withheld 0.00, and net interest 0.00, SHALL treat ADB as undefined (or 0) and qualifying days as 0, SHALL set the updated balance equal to the closing balance, and SHALL still produce a posting record.
2. IF every day in the period is below the 1,000 minimum so that gross interest is 0 THEN the system SHALL post 0.00 interest, deduct 0.00 tax, credit 0.00 net interest, leave the balance unchanged, and SHALL still produce a posting record.

---

*Do the requirements look good? If so, we can move on to the design.*

## Auditor verdict

_9 of 14 decisions correct. The method and convention decisions (1 ADB, 3 quarterly anniversary, 4 360-basis, 5 minimum balance, 6 floor rounding, 7 15% withholding, 12 half-open boundary, 13 rate-segment handling, 14 output shape) are surfaced and match. Decision 2 is addressed but contradicted — the spec forbids within-period compounding where the reference requires daily compounding. Decision 11 is partly covered but omits negative-rate rejection. The three lifecycle decisions (8 dormancy, 9 mid-period closure, 10 escheatment) are entirely absent. In-focus core six [1,2,3,8,9,10]: only 1 and 3 correct; method coverage is strong but lifecycle coverage is missing entirely._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Req 3.1-3.3: 'SHALL use the average-daily-balance (ADB) method'; 'ADB = (sum of qualifying end-of-day balances ...) / N'; 'gross_interest = ADB × (annual_rate / 360) × N'. | Spec sums daily balances, divides by days in period, and applies the rate once to the average — exactly the reference ADB method, explicitly not per-day daily-balance. |
| 2 | yes | no | Req 3.1: 'SHALL NOT compound each day's accrued interest into the following day's principal within a period'; Intro: 'the only sense in which interest compounds: between periods, never within one'. | Reference requires daily compounding within the period; the spec explicitly states the opposite (inter-period only, no within-period compounding), so the resolution is directly contradicted. |
| 3 | yes | **yes** | Req 1.5: 'interest as posted quarterly, on the anniversary of account opening'; Intro: 'delimited by the account's quarterly posting anniversaries'. | Quarterly posting on the opening anniversary (not calendar quarter-ends) matches the reference exactly. |
| 4 | yes | **yes** | Req 2.1: 'SHALL use a 360-day basis: daily_rate = annual_rate / 360'. | 360-day basis with daily rate = annual/360 matches the reference precisely. |
| 5 | yes | **yes** | Req 5.1-5.3: threshold of 1,000; at/above included in numerator; below 'contributing 0 to the interest numerator while still counting it as a full day in the divisor'. | Threshold value (1,000), the at-or-above rule, zero numerator contribution below it, and continued divisor counting all match the reference. |
| 6 | yes | **yes** | Req 8.2: 'SHALL round it by flooring (rounding down) to 2 decimal places and SHALL NOT use half-up or banker's rounding'; Req 8.3: 'the bank retain that remainder'. | Floor to 2 dp, never half-up, bank keeps the fraction — matches the reference exactly. |
| 7 | yes | **yes** | Req 9.1 'flat rate of 15%'; Req 9.6 credits only net to the account; Req 1.2 exposes 'the tax withheld' as a separate field. | 15% withholding deducted at posting, net credited, tax reported separately all match; computing on floored rather than raw gross is a precision nuance the reference does not pin down, so it does not break the match. |
| 8 | no | no | absent | The spec never mentions dormancy, a 12-month no-transaction trigger, continued accrual while dormant, or a monthly dormancy fee of 5. |
| 9 | no | no | absent | No mid-period closure handling appears; Req 11 covers only zero-day and all-below-minimum degenerate periods, not pro-rata accrual to a closure date. |
| 10 | no | no | absent | The spec contains no escheatment logic — no 5-year dormant trigger, no remittance to the state, no close-to-zero behaviour. |
| 11 | yes | no | Req 7.1 'the account never goes negative because overdrafts are prevented'; Req 11.2 all-below-minimum posts 0.00 and still records a posting; no clause rejecting a negative rate. | Zero-balance no-op (zero posting recorded) and no-overdraft/never-negative are covered, but the reference also requires a negative rate be rejected as invalid, which the spec never states, so the full resolution is not matched. |
| 12 | yes | **yes** | Req 1.3: half-open '[start, end): the first day of the period is included and the closing/posting day is excluded and belongs to the next period'. | Posting day excluded from the closing period and included in the next, via half-open intervals — matches the reference exactly. |
| 13 | yes | **yes** | Req 4.1-4.4: split into rate-segments, compute per segment then sum; 'a rate becomes effective on day D ... apply that rate from D inclusive'. | Each day earns at the rate in force that day, with interest computed per rate-segment and summed — matches the reference method. |
| 14 | yes | **yes** | Req 1.2: exposes 'the gross interest, the tax withheld, the net interest posted, the average daily balance, the number of qualifying days, and the updated balance'. | All six reference output fields (gross, tax withheld, net, ADB used, qualifying days, updated balance) are present as separate fields. |
