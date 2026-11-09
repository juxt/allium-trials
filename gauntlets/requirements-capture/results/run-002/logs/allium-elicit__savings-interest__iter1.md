# allium-elicit — savings-interest — iteration 1

Model (author): claude-opus · Questions asked: 21 · Captured: 10/14 · Bespoke captured: 6/10

## Conversation

### Round 1
_Step reasoning:_ No questions asked yet; the brief omits every material interest-computation policy, so I elicit the core method, units/precision, rounding, timing, edge inputs and output shape before writing anything.

Q: Which day-count convention does the institution use for daily accrual, actual/365, actual/360, or actual/actual (so leap years get 366)?
A: actual/360: the daily rate is annual_rate / 360. Leap years do not get a 366-day denominator.

Q: Is the annual rate applied as simple interest across the period, or does it compound, and if it compounds, at what frequency (daily, monthly, etc.)?
A: Compounds daily: each day's accrued interest is added to the base balance for the following day's accrual within the period. The period's interest is then derived from the average daily balance (sum of daily balances ÷ days in period, rate applied once to that average).

Q: Is the quoted annual rate a nominal rate that you divide down to a daily rate, or an effective annual rate that you convert?
A: Nominal rate divided straight down: daily_rate = annual_rate / 360. It is not an effective annual rate requiring a conversion formula.

Q: Which day's balance is used for each day's accrual, the end-of-day closing balance, and are both the first and last day of the period counted (inclusive/exclusive of boundaries)?
A: End-of-day closing balance is used for each day [default, not policy]. Period boundaries are half-open [start, end): the opening day of the period is included; the posting day itself is excluded from the period it closes and falls into the next period instead.

Q: To what precision is interest accrued and posted (e.g. to the cent), in which direction is it rounded (up, down, half-up, banker's), and does rounding happen each day or once at the end of the period?
A: Full precision is carried through accrual. Rounding happens once, at posting: floor (round down) to 2 decimal places — never half-up. The bank retains any sub-cent fraction.

Q: How are days with a zero or negative balance treated, is interest zero, or is a different (e.g. overdraft) rate applied?
A: Any day the balance is below 1,000 contributes zero interest to the numerator but still counts as a day in the average-balance divisor. A zero balance therefore earns nothing; no overdraft or alternative rate applies. A negative rate is rejected as invalid.

Q: Does the rate vary by balance tier or step, or is it a single flat rate for the whole balance?
A: Single flat rate for the whole balance — no balance tiers are defined [default, not policy]. If the rate changes mid-period, each day uses the rate in force on that day and the results are summed per rate segment.

Q: When interest is posted, is it added to the account balance (and does posted interest itself go on to earn interest in later periods), and what is the exact shape of the return value, every field the function must give back?
A: Net interest (gross minus 15% withholding tax) is credited to the account balance and goes on to earn interest in later periods. Each posting must return exactly these fields: gross interest, tax withheld, net interest posted, average daily balance used, number of qualifying days, and the updated account balance.

Q: What happens at the period edges around events like an account opened or closed mid-period, or a balance history that has gaps or missing days?
A: Closure mid-period: interest accrues pro-rata to the closure date and is posted net of withholding as part of closing — the customer does not forfeit the partial period. Account opened mid-period: accrual begins from the opening date [default, not policy]. Days below the minimum balance threshold contribute zero to the interest numerator but are still counted in the divisor; any other gaps in balance history should carry the last known balance forward [default, not policy].

### Round 2
_Step reasoning:_ Main method is well covered, but the exact average-balance formula, per-segment vs period-wide rate application, tax/threshold configurability and scope, and post-posting corrections/reversals remain materially ambiguous and cannot be safely inferred.

Q: You said period interest derives from the average daily balance with the rate applied once, and that days below 1,000 contribute zero to the numerator but still count in the divisor. Can you pin the exact arithmetic: is average daily balance = (sum of closing balances on qualifying days only) ÷ (total days in period), and is period interest then that average × daily_rate × total days, or the average × daily_rate applied a single time? And does the returned 'average daily balance used' field report that same figure (qualifying-balance sum over total days), or an average taken over qualifying days only?
A: ADB = (sum of end-of-day closing balances over the period, with sub-threshold days contributing 0) ÷ total days in the period. Period interest = ADB × (annual_rate / 360) × total_days_in_period — the rate is applied once to that average across the full period, not reapplied day by day. The returned 'average daily balance used' field reports that same figure: qualifying-balance sum ÷ total days (the divisor is always total days, not qualifying days only).

Q: When the rate changes mid-period and results are 'summed per rate segment', is the average-daily-balance method applied independently within each segment (each segment forming its own average and day count, then summed), or is one period-wide average computed with the applicable daily rate applied day by day?
A: The ADB method is applied independently within each rate segment: each segment forms its own sub-average (sum of qualifying balances within that segment ÷ days in that segment) and its own day count, segment interest is computed, and results are summed across segments. A single period-wide average is not computed.

Q: Are the 15% withholding tax rate and the 1,000 minimum-balance threshold fixed in the system or configurable (per deployment or per account), and in what currency/unit is the threshold expressed? Does post_interest actually remit or record the withheld tax to a tax ledger, or does it only report the amount withheld in its return value?
A: Neither the 15% withholding rate nor the 1,000 minimum-balance threshold is specified as configurable — treat both as fixed system constants [default, not policy]. The threshold is expressed in the account's native currency units [default, not policy]. post_interest reports the withheld amount in its return value; the key states the amount 'is reported separately' but does not mandate writing to a tax ledger — treat reporting as the guaranteed behaviour, any ledger write as out of scope for this function [default, not policy].

Q: Beyond opening and closure, can a balance in the history be corrected or back-dated after a period has already been posted? If so, does post_interest re-run and adjust the prior posting (a reversal or true-up), or is a posted period immutable? And is there any reversal, cancellation, or clawback of a posting once made?
A: Back-dating corrections, re-runs of posted periods, reversals, and clawbacks are not addressed in policy. Reasonable defaults: a posted period is immutable once recorded; balance corrections after posting require a separate adjustment entry rather than a re-run of post_interest; this function provides no reversal or clawback mechanism [default, not policy].

### Round 3
_Step reasoning:_ Two material policy classes remain genuinely unasked: how the single floor reconciles across the gross/tax/net figures (a derived-figure basis the rounding answer didn't settle), and the degenerate zero-day/empty-history divisor case.

Q: You said rounding is a single floor to 2 decimal places at posting, and the return reports three monetary figures: gross interest, tax withheld (15%), and net interest posted. Can you pin exactly how the floor interacts with the tax split: is gross floored to 2dp first and then tax = 15% of that floored gross (and is tax itself floored or carried at full precision, with net = floored_gross minus tax)? Or is net computed at full precision as gross x 0.85, floored to 2dp, and tax reported as the remainder (floored_gross minus floored_net)? In other words, which of the three figures is the one that gets floored, and how do the other two derive from it so they reconcile exactly?
A: The answer key does not pin the exact ordering of floor versus the tax split. [default, not policy]: floor gross to 2 decimal places first; tax withheld = floor(floored_gross × 0.15) to 2 decimal places; net posted = floored_gross − floored_tax. All three figures are exact at 2dp and net + tax = floored_gross reconciles with no remainder. The bank retains two sub-cent fractions: one from rounding gross and one from rounding tax.

Q: When the period contains zero days, or the balance history is empty so the average-daily-balance divisor (total days in period) would be zero, what does post_interest do: return zero interest with the balance unchanged, or reject the call as invalid? (The all-days-below-threshold case is already covered: numerator zero, so interest is zero.)
A: A zero-day period (or empty balance history producing a zero total-days divisor) is not addressed in policy. [default, not policy]: treat it as an invalid call and reject it — it represents a caller error rather than a legitimate edge case. The all-days-below-threshold case (zero numerator, non-zero divisor) is already defined as a valid zero-interest posting and is unaffected by this.

### Round 4
_Step reasoning:_ Core method, precision, rounding, thresholds, boundaries, edge inputs, output shape, closure, opening and corrections are all pinned; the remaining unasked whole-life events (dormancy/suspension/freeze and transfer) could carry account-status accrual policy, so I confirm them before concluding.

Q: Does the status of the account itself ever suppress or alter accrual for a period, independent of balance, specifically: if an account is dormant or inactive, does it still earn interest for that period at the normal rate, or does accrual stop (or switch rate) while dormant? And if an account is frozen or placed under a legal hold mid-period, does interest continue to accrue over the hold and post as normal, or is accrual suspended for the days under hold?
A: Dormancy: interest continues to accrue at the normal rate while the account is dormant — accrual is not suspended and the rate does not change. A monthly dormancy fee of 5 (in the account's native currency) is charged during the dormant period, but that is a separate deduction and does not alter the interest calculation. Frozen accounts or legal holds are not addressed in policy. [default, not policy]: interest continues to accrue normally over the hold period and posts as usual when the posting date arrives; accrual is not suspended by a freeze or legal hold.

Q: Can an account be transferred or have its ownership change mid-period, and if so does post_interest treat the balance history as continuous (interest computed over the whole period regardless of the transfer) or must the period be split at the transfer point and interest posted separately to each owner?
A: Account transfers and ownership changes mid-period are not addressed in policy. [default, not policy]: post_interest treats the balance history as continuous over the whole period regardless of any ownership change; it is the caller's responsibility to split the period at the transfer point and invoke post_interest separately for each owner if separate attribution is required.

### Round 5
_Step reasoning:_ Nearly every decision class is settled, but two output/arithmetic specifics remain genuinely ambiguous: the exact meaning of the 'qualifying days' return field versus the total-days divisor, and whether mid-period closure truncates the ADB divisor or keeps the full period length.

Q: The return value must include 'number of qualifying days'. The ADB divisor is always total days in the period, yet 'qualifying' days are those at/above the 1,000 threshold (the ones contributing to the numerator). Which does this field report: the count of days with a closing balance at or above 1,000, or the total days in the period used as the divisor?
A: The answer key does not explicitly pin what 'qualifying days' means in the return value. [default, not policy]: it reports the count of days whose closing balance was at or above the 1,000 threshold (i.e. the days contributing a non-zero balance to the ADB numerator), not the total days used as the divisor. The two fields serve different purposes: 'average daily balance used' already encodes the full-period divisor; 'number of qualifying days' gives the caller the count of threshold-passing days so they can audit why the numerator is what it is.

Q: For a mid-period closure where interest 'accrues pro-rata to the closure date', how is the ADB divisor set for that final period: does 'total days in the period' become the number of days from the period start up to (half-open) the closure date, or does it stay the full nominal period length with the post-closure days contributing zero to the numerator?
A: The answer key does not pin the divisor for the closure case beyond 'accrues pro-rata to the closure date'. [default, not policy]: total days in the period becomes the actual days from the period-start date up to (but not including) the closure date — the divisor is the length of the truncated period, not the full nominal period. Note that because ADB × (annual_rate/360) × total_days simplifies to (sum of qualifying balances) × (annual_rate/360) regardless of which interpretation is used, both methods yield the same interest amount; the distinction only affects the ADB and qualifying-days fields in the return value.

### Round 6
_Step reasoning:_ Core policy is thoroughly pinned, but two output/whole-life ambiguities remain unasked: how the single return fields aggregate under segmented rates, and whether post_interest's returned balance reflects the dormancy fee deduction.

Q: When the rate changes mid-period and interest is summed per rate segment, the return has single 'gross interest', 'average daily balance used' and 'number of qualifying days' fields. Is gross interest the sum across segments, and do the ADB and qualifying-days fields report a single period-wide figure (total qualifying-balance sum ÷ total days, and total threshold-passing days across the whole period), or a per-segment breakdown?
A: Gross interest is the sum of segment interests across all rate segments. The return shape is not specified as containing per-segment breakdowns. [default, not policy]: 'average daily balance used' reports a single period-wide figure (total qualifying-balance sum ÷ total days across the whole period), and 'number of qualifying days' reports the total count of threshold-passing days across the whole period. Per-segment ADB and qualifying-day figures are not part of the return value.

Q: You said a dormant account is charged a monthly dormancy fee of 5 in native currency as a separate deduction that does not alter the interest calculation. Does post_interest itself apply that fee to the account, so the returned 'updated account balance' reflects the net interest credit minus the dormancy fee, or is the fee entirely outside this function so the returned balance reflects only the net interest credited?
A: The answer key does not specify whether post_interest applies the dormancy fee. [default, not policy]: the fee is entirely outside this function; the returned 'updated account balance' reflects only the net interest credited, not any dormancy fee deduction.

### Round 7 (process signalled done)
_Step reasoning:_ Across six rounds every completeness-gate class has been put to the stakeholder and answered — core method, day-count, compounding, rounding/tax-split ordering, thresholds, boundaries, rate-segmentation, the full return shape, and the whole lifecycle (opening, closure, dormancy, freeze, transfer, back-dating, reversal) — and the last rounds now yield only 'not addressed in policy' defaults, signalling the institution's actual policy surface is exhausted.

(no questions this round)

## Produced specification

-- allium: 3
-- savings-interest.allium
--
-- Scope: The interest engine for savings accounts — `post_interest(account, period)`.
--   Given an account and a daily closing-balance history over a period (plus the
--   annual rate in force on each day), compute the interest earned, withhold tax,
--   credit the net to the account, and report the result.
--
-- Includes:
--   - Daily accrual on an actual/360 day-count basis
--   - Average-daily-balance (ADB) method, rate applied once per rate segment
--   - Minimum-balance threshold behaviour (sub-threshold days earn nothing but still count)
--   - Mid-period rate changes (per-segment computation, summed)
--   - 15% withholding tax and net crediting (net compounds into later periods)
--   - The exact result shape returned to the caller
--   - Period edges: account opened mid-period, closure mid-period (pro-rata), gaps
--
-- Excludes (decisions confirmed out of scope for this function):
--   - Dormancy fee (monthly 5, native currency): a separate deduction applied elsewhere;
--     the returned updated balance reflects only the net interest credit, never the fee.
--   - Tax ledger remittance: the withheld amount is reported in the result only;
--     writing it to a tax ledger is out of scope.
--   - Reversals, clawbacks, and back-dated re-runs: a posted period is immutable;
--     later balance corrections require a separate adjustment entry, not a re-run.
--   - Dormant / frozen / legal-hold status transitions: governed externally. Interest
--     still accrues at the normal rate in all of these states (accrual is never suspended).
--   - Ownership transfer / account split: history is treated as continuous; splitting the
--     period at a transfer point and posting per owner is the caller's responsibility.
--
-- Fixed system constants (NOT configurable per deployment or per account):
--   15% withholding tax, 1,000 minimum-balance threshold, actual/360 day count.

------------------------------------------------------------
-- Value Types
------------------------------------------------------------

-- One contiguous stretch of the period over which a single annual rate is in force.
-- When the rate changes mid-period, the period is split into consecutive segments;
-- the ADB method is applied INDEPENDENTLY within each segment and the results summed.
value RateSegment {
    annual_rate: Decimal

    -- End-of-day closing balances, one entry per day in this segment, in day order.
    -- Every calendar day in the segment appears here (sub-threshold and zero-balance
    -- days included); gaps in the source history are carried forward as the last known
    -- balance before the list is formed. The list length is therefore the day count
    -- that contributes to the divisor.
    balances: List<Decimal>

    -- Divisor contribution: total days in the segment (all days, not just qualifying ones).
    days: balances.count

    -- Nominal annual rate divided straight down — actual/360, no leap-year adjustment,
    -- not an effective-annual-rate conversion.
    daily_rate: annual_rate / 360

    -- Sum of the closing balances on QUALIFYING days only (closing balance at or above
    -- the minimum-balance threshold). Sub-threshold days contribute 0 to this numerator.
    qualifying_balance_sum: segment_qualifying_sum(this, config.min_balance_threshold)

    -- Count of qualifying days (closing balance at or above the threshold) in this segment.
    qualifying_days: segment_qualifying_days(this, config.min_balance_threshold)

    -- Sub-average for the segment: qualifying-balance sum over total days in the segment.
    segment_adb: qualifying_balance_sum / days

    -- Segment interest = ADB x daily_rate x days. This equals qualifying_balance_sum x
    -- daily_rate: the rate is applied once to the segment average across the whole segment,
    -- not reapplied day by day. Carried at full precision (no intermediate rounding).
    segment_interest: segment_adb * daily_rate * days
}

-- The period being posted. Boundaries are half-open [start, end): the opening day is
-- included; the posting day that closes the period is excluded and falls into the next
-- period. For an account opened mid-period, start is the opening date. For a mid-period
-- closure, end is the closure date and the period is the truncated span up to it.
value Period {
    start: Timestamp
    end: Timestamp

    -- The period split into consecutive single-rate segments (one entry if the rate is
    -- flat for the whole period). Ordered by day.
    rate_segments: List<RateSegment>

    -- Divisor for the whole period: the actual number of days across all segments.
    -- For a mid-period closure this is the truncated length (start up to, but excluding,
    -- the closure date), not the full nominal period length.
    total_days: sum_by(rate_segments, s => s.days)

    -- Period-wide qualifying-balance numerator: summed across all segments.
    qualifying_balance_sum: sum_by(rate_segments, s => s.qualifying_balance_sum)

    -- The single period-wide figure reported as "average daily balance used":
    -- total qualifying-balance sum over TOTAL days (the divisor is always total days,
    -- never qualifying days only). No per-segment breakdown is reported.
    average_daily_balance: qualifying_balance_sum / total_days

    -- Total count of qualifying days across the whole period (threshold-passing days),
    -- summed across segments. Distinct from total_days: this reports why the numerator
    -- is what it is, while average_daily_balance already encodes the full-period divisor.
    qualifying_days: sum_by(rate_segments, s => s.qualifying_days)

    -- Gross interest for the period before rounding: the sum of the per-segment interests.
    -- Full precision is carried through; rounding happens once, at posting.
    gross_interest_raw: sum_by(rate_segments, s => s.segment_interest)
}

------------------------------------------------------------
-- Entities
------------------------------------------------------------

entity Account {
    balance: Decimal
    currency: String

    -- Interest accrues at the normal rate while the account is open, including when it is
    -- dormant or frozen / on legal hold (accrual is never suspended by status, and those
    -- status transitions are governed by external systems). Only closing stops earning.
    is_closed: Boolean
}

-- The result of a single post_interest call. Its fields are exactly what the function
-- must return. A posted period is immutable once recorded.
entity InterestPosting {
    account: Account
    period: Period

    -- Gross interest, floored (rounded down) to the posting precision.
    gross_interest: Decimal

    -- Tax withheld: 15% of the floored gross, itself floored to the posting precision.
    tax_withheld: Decimal

    -- Net interest actually credited to the balance: floored_gross - floored_tax.
    net_interest: Decimal

    -- Average daily balance used = qualifying-balance sum / total days in the period.
    average_daily_balance: Decimal

    -- Number of qualifying days (closing balance at or above the threshold) in the period.
    qualifying_days: Integer

    -- The account balance after the net interest has been credited.
    updated_balance: Decimal

    -- gross = net + tax exactly, with no remainder. The bank retains two sub-cent
    -- fractions (one from flooring gross, one from flooring tax).
    invariant Reconciles {
        net_interest + tax_withheld = gross_interest
    }

    -- A negative rate is rejected before posting, so interest is never negative.
    invariant NonNegative {
        gross_interest >= 0 and tax_withheld >= 0 and net_interest >= 0
    }
}

------------------------------------------------------------
-- Config
------------------------------------------------------------

config {
    -- All three are FIXED system constants, held here as the single source of truth
    -- rather than configurable knobs. They do not vary per deployment or per account.

    -- Minimum-balance threshold, expressed in the account's native currency. A day whose
    -- end-of-day closing balance is below this contributes 0 to the ADB numerator but is
    -- still counted in the divisor. A zero balance therefore earns nothing.
    min_balance_threshold: Decimal = 1000

    -- Withholding tax rate applied to gross interest.
    withholding_tax_rate: Decimal = 0.15

    -- Posting precision. Interest is carried at full precision through accrual and reduced
    -- to this many decimal places exactly once, at posting, by flooring (rounding down).
    interest_decimal_places: Integer = 2
}

------------------------------------------------------------
-- Rules
------------------------------------------------------------

-- The core function: post_interest(account, period).
rule PostInterest {
    when: PostInterest(account, period)

    -- A zero-day period (or empty balance history producing a zero divisor) is a caller
    -- error and is rejected.
    requires: period.total_days > 0

    -- A negative annual rate is invalid and is rejected. (The all-days-below-threshold
    -- case is NOT an error: it is a valid zero-interest posting — numerator 0, divisor > 0.)
    requires: period.rate_segments.all(s => s.annual_rate >= 0)

    -- Interest can be posted while open (including dormant or frozen), but not once closed.
    requires: not account.is_closed

    -- Round once, at posting, by flooring to the posting precision. Order is fixed:
    -- floor gross first, then tax = floor(floored_gross x 0.15), then net = gross - tax.
    let gross = floor_to_places(period.gross_interest_raw, config.interest_decimal_places)
    let tax = floor_to_places(gross * config.withholding_tax_rate, config.interest_decimal_places)
    let net = gross - tax

    ensures:
        InterestPosting.created(
            account: account,
            period: period,
            gross_interest: gross,
            tax_withheld: tax,
            net_interest: net,
            average_daily_balance: period.average_daily_balance,
            qualifying_days: period.qualifying_days,
            updated_balance: account.balance + net
        )
        -- Net interest is credited to the balance and so goes on to earn interest in
        -- later periods (compounding across periods). The dormancy fee, if any, is NOT
        -- applied here — the updated balance reflects only the net interest credit.
        account.balance = account.balance + net

    @guidance
        -- Day count: actual/360. daily_rate = annual_rate / 360; leap years get no 366-day
        --   denominator. The rate is nominal (divided straight down), not an effective
        --   annual rate requiring conversion.
        -- Method: average-daily-balance. ADB = (sum of end-of-day closing balances over the
        --   period, with sub-threshold days contributing 0) / total days in the period. The
        --   rate is applied once to that average across the full period, not reapplied day by
        --   day. When the rate changes mid-period, the ADB method is applied independently
        --   within each rate segment and the segment interests are summed into gross.
        -- Balances: each day uses its end-of-day closing balance. Boundaries are half-open
        --   [start, end): the opening day is included, the posting day is excluded. Gaps in
        --   the history carry the last known balance forward.
        -- Threshold: days with a closing balance below config.min_balance_threshold add 0 to
        --   the numerator yet still count in the divisor; a zero balance earns nothing; no
        --   overdraft or alternative rate exists.
        -- Rounding: full precision through accrual; a single floor to config.interest_decimal_places
        --   at posting (never half-up). The bank retains the sub-cent fractions from flooring
        --   gross and from flooring tax.
        -- Immutability: a posted period is never re-run, reversed, or clawed back; corrections
        --   are made via a separate adjustment entry.
}

-- Closing an account. The final partial period is posted first (via PostInterest, with a
-- truncated half-open period up to the closure date) so pro-rata interest is not forfeited;
-- the net is credited as part of closing. This rule records the closure itself.
rule CloseAccount {
    when: CloseAccount(account)
    requires: not account.is_closed
    ensures:
        account.is_closed = true

    @guidance
        -- Before this fires, the caller invokes PostInterest for the final truncated period
        -- (start up to, but excluding, the closure date). total_days for that period is the
        -- truncated length, so ADB and qualifying-days reflect the actual days accrued.
}

------------------------------------------------------------
-- Surfaces
------------------------------------------------------------

-- The boundary the calling ledger system sees: the operations it may invoke on an
-- account and the account fields it reads. The full result shape is the InterestPosting
-- entity created by PostInterest.
surface SavingsInterestBoundary {
    context account: Account

    exposes:
        account.balance
        account.currency
        account.is_closed

    provides:
        PostInterest(account, period)
            when not account.is_closed
        CloseAccount(account)
            when not account.is_closed

    @guarantee ResultShape
        -- Every successful PostInterest yields an InterestPosting carrying exactly: gross
        -- interest, tax withheld, net interest posted, average daily balance used, number
        -- of qualifying days, and the updated account balance.

    @guarantee TaxReportedNotRemitted
        -- The withheld tax is reported in the result only; this function does not write it
        -- to any tax ledger.
}


## Auditor verdict

_10/14 correct. Conventions, rounding, tax, threshold, edge-cases, boundary, rate-change, output shape, ADB method and mid-period closure are all captured precisely. Failures cluster in posting cadence and lifecycle: #2 (spec applies the rate once, contradicting daily within-period compounding), #3 (quarterly-on-anniversary posting entirely delegated to the caller, absent), #8 (fee=5 monthly and dormant-accrual captured, but the 12-month dormancy trigger is missing), and #10 (escheatment wholly absent). On the core in-focus six [1,2,3,8,9,10] the spec scores 2/6 (only #1 and #9), so method/lifecycle coverage in this fresh domain is weak despite strong control-decision coverage._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Average-daily-balance (ADB) method, rate applied once per rate segment"; segment_adb = qualifying_balance_sum / days; segment_interest = segment_adb * daily_rate * days ("the rate is applied once to the segment average across the whole segment, not reapplied day by day"). | The spec explicitly adopts average daily balance: sum balances, divide by days, apply the rate once to the average, not per-day daily-balance. Exact match. |
| 2 | yes | no | "the rate is applied once to the segment average across the whole segment, not reapplied day by day" and @guidance "The rate is applied once to that average across the full period, not reapplied day by day." Cross-period only: "net compounds into later periods". | Reference requires daily compounding within the period. The spec explicitly does NOT compound daily within a period (ADB applies the rate once); it compounds only across posting periods. Contradicts the reference value. |
| 3 | no | no | absent | The posting frequency is fully delegated to the caller via post_interest(account, period); the spec never states quarterly posting, nor the opening-anniversary (vs calendar quarter-end) timing. Not addressed. |
| 4 | yes | **yes** | "Daily accrual on an actual/360 day-count basis"; daily_rate = annual_rate / 360; @guidance "daily_rate = annual_rate / 360; leap years get no 366-day denominator ... nominal (divided straight down)." | 360-day basis with the annual rate divided straight down matches the reference exactly, including rejecting a 365/366 denominator. |
| 5 | yes | **yes** | config min_balance_threshold = 1000; "Sum of the closing balances on QUALIFYING days only (closing balance at or above the minimum-balance threshold). Sub-threshold days contribute 0 to this numerator" while days below "still count in the divisor". | Threshold is 1,000, at-or-above qualifies, sub-threshold days contribute zero to the numerator but still count in the divisor. Exact match. |
| 6 | yes | **yes** | "Gross interest, floored (rounded down) to the posting precision"; interest_decimal_places = 2; @guidance "a single floor ... (never half-up). The bank retains the sub-cent fractions." | Posted interest floored to 2 dp, never half-up, bank keeps the fraction. Exact match. |
| 7 | yes | **yes** | withholding_tax_rate = 0.15; tax = floor_to_places(gross * 0.15, 2); net_interest credited; @guarantee TaxReportedNotRemitted "withheld tax is reported in the result only". | 15% withholding deducted from gross at posting, net credited, tax reported separately. Matches the reference (applied to floored gross, still 15% of gross interest). |
| 8 | yes | no | "Dormancy fee (monthly 5, native currency): a separate deduction applied elsewhere"; "Interest still accrues at the normal rate in all of these states (accrual is never suspended)" including dormant. | The spec correctly states the fee is monthly 5 and that interest keeps accruing while dormant, but it never states the 12-month no-customer-transaction trigger that defines dormancy. Strict matching fails on the missing material trigger value. |
| 9 | yes | **yes** | CloseAccount: "The final partial period is posted first (via PostInterest, with a truncated half-open period up to the closure date) so pro-rata interest is not forfeited; the net is credited as part of closing." | On mid-period closure interest is accrued pro-rata to the closure date and posted net of withholding as part of closing, with no forfeiture. Exact match. |
| 10 | no | no | absent | Escheatment is never mentioned; there is no 5-year dormant trigger, no remittance to the state, no close-to-zero behaviour. Not addressed. |
| 11 | yes | **yes** | "A negative annual rate is invalid and is rejected"; "a valid zero-interest posting — numerator 0, divisor > 0"; "A zero balance therefore earns nothing"; "no overdraft or alternative rate exists." | Negative rate rejected, zero balance yields a valid zero posting (no-op recording), and no overdraft. Matches the reference. |
| 12 | yes | **yes** | "Boundaries are half-open [start, end): the opening day is included; the posting day that closes the period is excluded and falls into the next period." | Posting day excluded from the closing period and included in the next, half-open [start, end). Exact match. |
| 13 | yes | **yes** | "When the rate changes mid-period, the ADB method is applied INDEPENDENTLY within each segment and the segment interests are summed into gross"; RateSegment per annual_rate. | Each day uses the rate in force via per-segment computation, with segment interests summed. Matches the reference. |
| 14 | yes | **yes** | InterestPosting fields and @guarantee ResultShape: "gross interest, tax withheld, net interest posted, average daily balance used, number of qualifying days, and the updated account balance." | The reported shape lists exactly gross, tax withheld, net, average daily balance used, qualifying days, and updated balance. Exact match. |

## Allium checker (spec-side, not scored)

check passed:

```
{
  "command": "check",
  "diagnostics": [],
  "findings": [],
  "spec_file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-oExGfd/spec.allium"
}

```
