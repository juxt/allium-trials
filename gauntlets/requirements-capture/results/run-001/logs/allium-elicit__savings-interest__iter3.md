# allium-elicit — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 23 · Captured: 13/14 · Bespoke captured: 9/10

## Conversation

### Round 1
_Step reasoning:_ No questions asked yet; I must surface the omitted material policy decisions (day-count, compounding, precision, rounding, accrual basis, boundaries, edge balances, output shape, mid-life events) before specifying anything.

Q: What day-count convention should the interest calculation use, e.g. actual/365, actual/360, actual/actual, or 30/360?
A: 360-day basis. The daily rate is annual_rate / 360.

Q: Is interest compounded over the period (daily or otherwise), or is it simple interest on the summed/averaged daily balances?
A: Compounds daily: each day's accrued interest joins the principal base for the following day's accrual within the period.

Q: What currency and smallest unit are balances held in (e.g. pounds to the penny), and to what precision is interest computed before it is posted?
A: [default, not policy] Currency is not specified in policy; assume the system's configured currency. Balances are held to 2 decimal places (the minor unit). Interest is computed at full floating-point precision internally before being reduced to the postable unit at posting.

Q: When the computed interest is reduced to the postable unit, do you round or truncate, which direction (round half up, half even, etc.), and what happens to any sub-unit remainder, is it carried forward or dropped?
A: Floor (truncate) to 2 decimal places — never half-up or half-even. The sub-unit remainder is dropped and retained by the bank; it is not carried forward to the next period.

Q: How is the annual rate applied to each day, is it divided by the day-count denominator and multiplied by that day's closing balance, and does the daily balance used include or exclude interest posted earlier in the period?
A: The annual rate is divided by 360 to produce the daily rate. Daily compounding applies within the period: each day's accrued interest joins the running balance before the next day's accrual. Days where the closing balance is below 1,000 contribute zero interest for that day but still count toward the period-length divisor used in the average daily balance calculation. The daily balance used for accrual includes intra-period compounded interest accumulated from earlier days in the same period.

Q: How are the period boundaries treated, is the first day included and the last excluded (or vice versa), and does posting happen on a specific effective date?
A: Periods are half-open: [start, end). The posting day is excluded from the period it closes and is the first day of the next period. Posting occurs on the anniversary of account opening, not on calendar quarter-ends.

Q: How should days with a zero or negative balance be handled, does a negative balance accrue negative interest (a charge), accrue nothing, or something else?
A: A day with a zero balance falls below the 1,000 minimum threshold: it contributes zero interest but still counts as a day in the divisor. The account never goes negative, so a negative balance is not a valid state; [default, not policy] a transaction that would produce one should be rejected.

Q: What exactly must post_interest return, field by field (interest amount, updated balance, any breakdown or accrual detail), and is any figure disclosed on a different basis than it is computed?
A: post_interest must return: gross interest, tax withheld (15% of gross), net interest posted (gross minus tax), the average daily balance used in the calculation, the number of qualifying days (days on which the balance met the 1,000 minimum), and the updated account balance after crediting the net amount.

Q: Does anything mid-period change the calculation, such as a rate change taking effect partway through, a correction or back-dated balance adjustment, or the account being closed before period end?
A: Rate changes mid-period: each day uses the rate in effect on that day; the calculation is split into rate-segments, each producing its own contribution, and the results are summed. Account closure mid-period: interest accrues pro-rata to the closure date and is posted net of withholding as part of the closing — the partial period is not forfeited. [default, not policy] Back-dated balance corrections are not addressed in policy; assume the affected period is recalculated from the adjustment date forward.

### Round 2
_Step reasoning:_ Several material decision classes remain unasked: the accrual basis conflicts with the disclosed average-daily-balance, tax rounding order is undefined, threshold semantics are unspecified, and cross-segment compounding is ambiguous.

Q: You've described interest as daily compounding (each day's accrued interest joins the base), but the return shape also reports an "average daily balance used in the calculation". These are two different bases. Which is authoritative for the posted interest, and what exactly is the average daily balance, its numerator (sum of which daily balances, closing or compounded, qualifying-only or all) and its denominator (total days in the period or qualifying days only)? If it is purely a disclosed figure and not the accrual basis, say so.
A: The average daily balance is the authoritative accrual basis: the rate is applied once to the average at period end, not accrued and applied per-day. Daily compounding (item 2) describes how the running balance evolves — each day's closing balance includes intra-period compounded accrual from prior days in the same period, and those compounding balances are what feed the average — but interest itself is not posted day by day. The average daily balance is not a disclosure-only figure; it is the computation basis. Numerator: sum of each day's closing balance (including intra-period compounded interest from earlier days), where non-qualifying days (balance below 1,000) contribute 0, not their actual balance. Denominator: total calendar days in the period, including non-qualifying days — confirmed by policy item 5.

Q: For the 15% tax withholding: is it computed on the full-precision gross or on the gross after it has been floored to 2 decimal places? Is the tax amount itself floored (and in the same downward direction), and is net posted = floor(gross) - floor(tax) or floor(gross - tax)? I want the exact order of the flooring and subtraction, since the sub-unit remainder handling depends on it.
A: [default, not policy] Policy specifies floor-to-2dp for the gross and 15% withholding but does not fix the exact flooring sequence for the tax computation. Default: floor gross to 2dp first; compute 15% of that floored gross at full floating-point precision; floor the tax result downward to 2dp; net posted = floored_gross − floored_tax. Neither the gross-tax difference is floored as a unit nor is tax computed on the pre-floor gross.

Q: The 1,000 minimum: is that value fixed policy or configurable per deployment/customer? Is the test strict (balance > 1,000) or inclusive (>= 1,000)? And is it applied to the day's closing balance including intra-period compounded interest, or to the deposited principal excluding accrued interest?
A: The test is inclusive: a day qualifies when balance >= 1,000. Policy specifies 'at or above 1,000'. Whether the threshold is configurable per deployment or customer is not addressed in policy; [default, not policy] treat it as a fixed system constant. The test is applied to the day's closing balance including intra-period compounded interest, not to deposited principal alone.

Q: When the rate changes mid-period and the calculation splits into rate-segments, does daily compounding carry across the segment boundary (the running compounded balance at the end of segment one becomes the opening base for segment two), or is each segment compounded independently from the period's opening balance before the contributions are summed?
A: [default, not policy] Not specified in policy. Default: daily compounding carries across segment boundaries. The running compounded balance at the close of segment N becomes the opening base for segment N+1, preserving the full compound growth through the rate change. Each segment then contributes its slice of the average-daily-balance calculation at its own rate, and the per-segment interest amounts are summed to produce the period gross.

### Round 3
_Step reasoning:_ Prior answers introduced a real ambiguity in how rate-segments reconcile with the single-average basis, and material forks remain unasked: tax-rate configurability/holder status, disclosed-average precision, and mid-life account status affecting accrual.

Q: When the period splits into rate-segments, how does that reconcile with 'apply the rate once to the average daily balance at period end'? Specifically: is a separate average computed for each segment (numerator = sum of that segment's qualifying-adjusted daily closing balances, denominator = that segment's day count) and each average multiplied by its own rate, or is one whole-period average computed and then apportioned across segments? And under the per-segment reading, is each segment's denominator its own day count or the full period's day count?
A: A separate average is computed per rate-segment: numerator is the sum of that segment's qualifying-adjusted daily closing balances (non-qualifying days contribute 0), and the rate for that segment is applied once to that average. The results are summed across segments to produce the period gross. The denominator is not addressed per-segment in policy; [default, not policy] each segment's denominator is its own day count, not the full period's day count — using the full-period denominator for each segment would misweight shorter segments.

Q: Is the 15% withholding rate itself fixed policy or configurable per deployment/jurisdiction, and does it always apply, or does it depend on the account holder's tax status (e.g. an exemption or a certified nil rate for some holders)?
A: The 15% rate is stated as fixed policy. Whether it is configurable per deployment or jurisdiction, or whether it can be reduced or waived based on account-holder tax status (exemption certificates, nil-rate declarations, treaty relief), is not addressed in policy; [default, not policy] treat it as a fixed system constant that always applies to every posting.

Q: The returned 'average daily balance used' is a disclosed figure. Is it disclosed at full internal precision, or reduced to the 2-decimal minor unit for reporting, and if reduced, floored in the same downward direction as the interest?
A: Not addressed in policy; [default, not policy] the disclosed average daily balance is floored to 2 decimal places in the same downward direction as the gross interest, for consistency with the rest of the posting figures.

Q: Over the account's life, can it enter a status mid-period that changes accrual, such as frozen, suspended, or dormant? If so, do days in that status accrue interest, contribute zero like a sub-threshold day, or fall outside the period divisor entirely?
A: Dormancy is addressed in policy: after 12 months with no customer-initiated transaction the account becomes dormant, but interest continues to accrue normally during dormancy — days in dormant status are treated identically to active days for accrual purposes. A flat monthly dormancy fee of 5 is charged separately and does not alter the accrual rule. Frozen or suspended status is not addressed in policy; [default, not policy] days in any other restricted status are treated as ordinary accrual days unless the system is explicitly configured otherwise.

### Round 4
_Step reasoning:_ Core method, precision, rounding, thresholds, timing, rate-segments, output shape and most lifecycle events are covered; the remaining material unasked classes are degenerate/edge inputs (zero-day or empty-history periods, division-by-zero in the average) and the reversal/idempotency lifecycle events (double-posting guard, reversing a posting).

Q: A degenerate-period question: what must post_interest do when the period contains zero calendar days, when the daily balance history is empty or has gaps (missing days), or when the average-daily-balance denominator would be zero? Does it return zero interest, reject, or error, and does it still return the full result shape (avg daily balance, qualifying days, etc.)?
A: Not addressed in policy for any of these cases. [default, not policy] (a) Zero calendar days: the denominator would be zero; the function should reject with an error rather than divide by zero — no result shape is returned for a rejected call. (b) Gaps in daily balance history: missing days should be filled by carrying the last known closing balance forward; if no prior balance exists, those days carry zero. Carried-forward balances are then tested against the 1,000 threshold normally — below threshold, they contribute 0 to the numerator but still count in the denominator. (c) Empty history for the full period: all days carry zero, every day is sub-threshold, the numerator is 0, gross interest is 0 — this resolves to the zero-balance case in policy item 11: a no-op posting that still records the full result shape (gross = 0, tax withheld = 0, net posted = 0, average daily balance = 0.00, qualifying days = 0, updated balance unchanged).

Q: An idempotency and reversal question: can post_interest be invoked more than once for the same period (is there a guard against double-posting, or is it the caller's responsibility)? And once interest has been posted, can a posting be reversed or corrected later, and if so what happens to the dropped sub-unit remainder retained by the bank and to the 15% tax already withheld?
A: Neither idempotency guards nor reversal or correction of posted interest are addressed in policy. [default, not policy] On idempotency: preventing double-posting is the caller's responsibility; post_interest itself applies no guard. On reversal: if a reversal mechanism is implemented, it should credit back the net amount posted (gross floored minus tax floored) and record the reversal of the tax withheld as a reportable event; the sub-unit remainder dropped at the original posting was retained by the bank as a matter of policy and is not returned on reversal. Recalculation after a corrected reversal should rerun the full period computation from source data and produce a new posting record.

### Round 5
_Step reasoning:_ The core policy is well covered, but three genuinely material items remain unasked: whether the dormancy fee debit affects the balances used for accrual and thresholding, the denominator/segment treatment for pro-rata closure, and whether tax remittance is in scope for this function.

Q: The dormancy fee of 5 per month: is it debited from the account balance itself? If so, does the post-fee balance become the day's closing balance that feeds both the average-daily-balance numerator and the 1,000 qualifying-day threshold test, or is the fee accounted for outside the balance series so accrual sees the pre-fee balance? Also, in what unit is the 5 expressed (the configured currency's major unit) and on what day of the month is it applied?
A: Policy states the dormancy fee of 5 is charged but does not specify whether it debits the account balance directly or is accounted for outside the balance series, what unit the 5 is expressed in, or which day of the month it is applied. [default, not policy] Treat the fee as a debit to the account balance on the day it falls due; the post-fee closing balance is then the figure that feeds both the average-daily-balance numerator and the 1,000 threshold test for that day. The 5 is expressed in the configured currency's major unit. The day of application defaults to the same calendar day-of-month as the onset of dormancy, advancing to the last day of the month if that date does not exist in a given month.

Q: For mid-period account closure with pro-rata accrual to the closure date: does the pro-rata still use the authoritative average-daily-balance basis, and if so is the denominator the actual number of days in the partial period (start up to but excluding the closure date) rather than a full period length? And if a rate change also falls inside that partial period, do the per-segment averaging and summing rules apply unchanged?
A: Policy item 9 confirms that pro-rata accrual to the closure date uses the same authoritative basis as a normal posting. The denominator for the partial period is not explicitly stated in policy; [default, not policy] it is the actual number of calendar days in the partial period — that is, the count of days from the period start up to but excluding the closure date — consistent with the half-open [start, end) boundary rule and the principle that the denominator reflects the days in the period being closed. Where a rate change also falls inside the partial period, the per-segment averaging and summing rules apply unchanged: each rate-segment within the partial period gets its own average (segment qualifying-balance sum divided by segment day count) multiplied by the segment rate, and the results are summed to produce the partial-period gross.

Q: The 15% tax withheld that is returned as a field: is it simply reported by post_interest, or does the function also record it as a remittable/reportable liability to a tax authority as part of the posting? I want to confirm whether remittance is in scope for this function or handled entirely downstream.
A: Policy item 7 states that the tax withheld is reported separately; post_interest returns it as a named field in the result. Whether the function also records a remittable or reportable liability to a tax authority as part of the posting is not addressed in policy. [default, not policy] Remittance to the tax authority is out of scope for post_interest; the function returns the tax-withheld figure, and downstream systems are responsible for recording the liability and effecting remittance.

### Round 6
_Step reasoning:_ Every completeness-gate class is covered except one genuine unfilled hole: the exact multiplier converting a segment average to segment gross, where the 360 rate divisor and the total-calendar-days averaging denominator interact and materially differ.

Q: You've said each rate-segment's rate is 'applied once' to that segment's average daily balance. I need the exact multiplier, because the daily rate is annual_rate/360 but the average's denominator is the segment's total calendar days. Is segment gross = segment_average × (annual_rate/360) × segment_day_count? Or × segment_qualifying_day_count? Or is the average multiplied by the annual rate directly with no day-count factor? Please give the precise formula, since with a 360 divisor and a total-days denominator these produce materially different results (e.g. a 365-day period).
A: Policy item 1 states 'apply the rate once to that average' and item 4 gives the daily rate as annual_rate / 360. Combining those with the per-segment denominator (segment's own calendar day count, as confirmed in round 3), the formula is:

segment_gross = segment_average × (annual_rate / 360) × segment_day_count

where segment_average = sum of that segment's qualifying-adjusted daily closing balances / segment_day_count.

Note that the day counts cancel algebraically — the formula reduces to:

segment_gross = sum_of_qualifying_adjusted_balances × (annual_rate / 360)

— but the canonical expression is the former, consistent with 'rate applied once to the average'. The denominator in the average is segment calendar day count, not qualifying-day count; using qualifying-day count only in the numerator (non-qualifying days contribute 0 rather than their actual balance). Applying the annual rate directly with no day-count factor is not correct — that would make the result independent of period length, which contradicts the 360-day-basis policy.

### Round 7 (process signalled done)
_Step reasoning:_ Six rounds have pinned every material decision class in the completeness gate (core method, units/precision, flooring, thresholds, boundaries, rate-segments, tax, closure, dormancy, reversal, idempotency, degenerate inputs, output shape) and the round-6 formula resolved the last genuine ambiguity in the authoritative computation; remaining answers are now overwhelmingly '[default, not policy]', signalling the institution's actual policy is exhausted and further questions would be edge-case spiral rather than requirement capture.

(no questions this round)

## Produced specification

-- allium: 3

-- Savings account interest posting.
--
-- Captures the behaviour of the `post_interest` operation for a savings
-- account: how interest is accrued over a period, floored, taxed and credited,
-- together with the account states (active, dormant, closed) that surround it.
--
-- Provenance: every decision below is drawn either from the brief or from the
-- stakeholder conversation. Decisions the stakeholder marked "[default, not
-- policy]" are recorded as settled defaults and flagged as such in the guidance
-- or contract invariant that carries them. The one genuine gap neither raised
-- nor defaulted (reactivation of a dormant account) is left as an open question
-- rather than invented.
--
-- The exact arithmetic is normative and lives in the InterestPostingCalculation
-- contract invariants near the end of the file. The entities and rules above it
-- model the domain structure and the observable effects of a posting.

-- ---------------------------------------------------------------------------
-- Configuration constants
-- ---------------------------------------------------------------------------
-- Currency is the system's configured currency (default, not policy). Balances
-- are held to the minor unit (2 decimal places). Interest is computed at full
-- internal precision and only reduced to the minor unit at posting.
config {
    day_count_basis: Integer = 360             -- daily rate = annual_rate / 360
    minimum_qualifying_balance: Decimal = 1000  -- fixed system constant (default)
    tax_withholding_rate: Decimal = 0.15        -- fixed, always applies (default)
    minor_unit_scale: Integer = 2               -- decimal places of the minor unit
    dormancy_period: Duration = 12.months       -- no customer transaction -> dormant
    dormancy_fee: Decimal = 5                    -- per month, configured major unit
    dormancy_fee_interval: Duration = 1.month    -- see ChargeDormancyFee guidance
}

-- ---------------------------------------------------------------------------
-- Account
-- ---------------------------------------------------------------------------
entity SavingsAccount {
    balance: Decimal
    currency: String                            -- the system's configured currency (default)
    opened_at: Timestamp
    status: active | dormant | closed

    last_customer_transaction_at: Timestamp     -- drives dormancy onset
    became_dormant_at: Timestamp when status = dormant
    next_dormancy_fee_at: Timestamp when status = dormant

    postings: InterestPosting with account = this

    transitions status {
        active -> dormant
        active -> closed
        dormant -> closed
        terminal: closed
    }
}

-- ---------------------------------------------------------------------------
-- Accrual period
-- ---------------------------------------------------------------------------
-- Half-open [start, end): the posting day is excluded from the period it closes
-- and becomes the first day of the next period. day_count is the number of
-- calendar days in [start, end), including non-qualifying days. The computed
-- figures are held here as the results of the calculation fixed by the
-- InterestPostingCalculation contract invariants.
entity AccrualPeriod {
    account: SavingsAccount
    start: Timestamp                            -- inclusive
    end: Timestamp                              -- exclusive
    day_count: Integer                          -- calendar days, including non-qualifying days

    gross_interest: Decimal                     -- floored to the minor unit
    tax_withheld: Decimal                       -- floored to the minor unit
    net_interest: Decimal                       -- floored_gross - floored_tax
    average_daily_balance: Decimal              -- disclosed, floored to the minor unit
    qualifying_days: Integer                    -- days at or above the minimum

    segments: RateSegment with period = this
    daily_balances: DailyBalance with period = this
}

-- ---------------------------------------------------------------------------
-- Rate segments
-- ---------------------------------------------------------------------------
-- A period is split into one segment per annual rate in effect. Each day uses
-- the rate in effect on that day. Daily compounding carries across segment
-- boundaries: the running compounded balance at the close of one segment is the
-- opening base for the next (default, not policy). A separate average is
-- computed per segment, over the segment's own calendar day count.
entity RateSegment {
    period: AccrualPeriod
    annual_rate: Decimal
    start: Timestamp                            -- inclusive
    end: Timestamp                              -- exclusive; half-open [start, end)
    day_count: Integer                          -- calendar days in this segment

    daily_balances: DailyBalance with segment = this
    qualifying_balances: daily_balances where closing_balance >= config.minimum_qualifying_balance
    qualifying_day_count: qualifying_balances.count
}

-- ---------------------------------------------------------------------------
-- Daily balance series
-- ---------------------------------------------------------------------------
-- One entry per calendar day in a period. The closing balance already includes
-- intra-period compounded interest accrued from earlier days in the same period
-- and any dormancy fee debited that day. Gaps in the source series are filled by
-- carrying the last known closing balance forward; if no prior balance exists,
-- the day carries zero (default, not policy).
entity DailyBalance {
    account: SavingsAccount
    period: AccrualPeriod
    segment: RateSegment
    date: Timestamp
    closing_balance: Decimal

    -- Inclusive test at or above the minimum, applied to the closing balance
    -- (which includes compounded interest), not to deposited principal alone.
    qualifies: closing_balance >= config.minimum_qualifying_balance
}

-- ---------------------------------------------------------------------------
-- Posting record (the result of post_interest)
-- ---------------------------------------------------------------------------
entity InterestPosting {
    account: SavingsAccount
    period: AccrualPeriod
    gross_interest: Decimal
    tax_withheld: Decimal
    net_interest: Decimal
    average_daily_balance: Decimal
    qualifying_days: Integer
    updated_balance: Decimal                    -- balance after crediting the net amount
}

-- ---------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------

-- Opening an account. It starts active with the opening balance; the last
-- customer transaction is the opening itself.
rule OpenAccount {
    when: OpenSavingsAccount(opening_balance, account_currency)
    ensures: SavingsAccount.created(
        balance: opening_balance,
        currency: account_currency,
        opened_at: now,
        status: active,
        last_customer_transaction_at: now
    )
}

-- post_interest. The caller invokes it with the account and the period to
-- close: on the anniversary of account opening for a full period, and again as
-- part of closing the account for the final partial period. It credits the net
-- amount to the balance and records the full result shape. A period with zero
-- calendar days is not posted (guarded here; the contract states the
-- reject-with-error behaviour).
rule ApplyInterestPosting {
    when: PostInterest(account, period)
    requires: period.day_count >= 1
    ensures: InterestPosting.created(
        account: account,
        period: period,
        gross_interest: period.gross_interest,
        tax_withheld: period.tax_withheld,
        net_interest: period.net_interest,
        average_daily_balance: period.average_daily_balance,
        qualifying_days: period.qualifying_days,
        updated_balance: account.balance + period.net_interest
    )
    ensures: account.balance = account.balance + period.net_interest
    @guidance
        -- The gross is the sum of per-segment grosses (see contract). Net is the
        -- floored gross minus the floored 15% tax. Days below the minimum
        -- contribute zero interest but still count in the period divisor. An
        -- empty history resolves to a zero no-op posting that still records the
        -- full shape (gross 0, tax 0, net 0, average 0.00, qualifying days 0,
        -- balance unchanged). Anniversary timing means a period can exceed 360
        -- days while the divisor is 360, so annual interest slightly exceeds the
        -- nominal rate. On closure the same operation posts the partial period
        -- pro-rata to the closure date; the partial period is not forfeited.
        -- Preventing double-posting for the same period is the caller's
        -- responsibility; this rule applies no idempotency guard (default).
}

-- After 12 months with no customer-initiated transaction the account becomes
-- dormant. Interest continues to accrue normally during dormancy.
rule AccountBecomesDormant {
    when: account: SavingsAccount.last_customer_transaction_at <= now - config.dormancy_period
    requires: account.status = active
    ensures: account.status = dormant
    ensures: account.became_dormant_at = now
    ensures: account.next_dormancy_fee_at = now + config.dormancy_fee_interval
    @guidance
        -- Dormant days are treated identically to active days for accrual: they
        -- accrue interest and count in the divisor like any other day. Any other
        -- restricted status (frozen, suspended) is treated as an ordinary
        -- accrual day unless the system is explicitly configured otherwise
        -- (default; frozen/suspended not addressed in policy).
}

-- A flat monthly dormancy fee is charged while the account is dormant. It is
-- separate from accrual and does not alter the accrual rule.
rule ChargeDormancyFee {
    when: account: SavingsAccount.next_dormancy_fee_at <= now
    requires: account.status = dormant
    ensures: account.balance = account.balance - config.dormancy_fee
    ensures: account.next_dormancy_fee_at = account.next_dormancy_fee_at + config.dormancy_fee_interval
    @guidance
        -- Default (not policy): the fee debits the account balance on the day it
        -- falls due, so the post-fee closing balance is the figure that feeds
        -- both the average-daily-balance numerator and the minimum-balance test
        -- for that day. The fee is 5 in the configured currency's major unit.
        -- It falls on the same calendar day-of-month as the onset of dormancy,
        -- advancing to the last day of the month where that date does not exist.
}

-- Closing an account. This transition triggers the final partial-period posting
-- via ApplyInterestPosting, invoked by the caller as part of the closing.
rule CloseAccount {
    when: CloseSavingsAccount(account)
    requires: account.status != closed
    ensures: account.status = closed
}

-- ---------------------------------------------------------------------------
-- Boundary contract for post_interest
-- ---------------------------------------------------------------------------
-- Declares the operation signature and pins every arithmetic decision. The @
-- invariants are prose the checker does not evaluate; they are the normative
-- record of how the figures are computed and disclosed.
contract InterestPostingCalculation {
    post_interest: (account: SavingsAccount, period: AccrualPeriod) -> InterestPosting

    @invariant ReturnShape
        -- post_interest returns: gross interest, tax withheld (15% of gross),
        -- net interest posted (gross minus tax), the average daily balance used,
        -- the number of qualifying days (days at or above the minimum), and the
        -- updated account balance after crediting the net amount.

    @invariant DayCountBasis
        -- 360-day basis. The daily rate is annual_rate / 360.

    @invariant AverageDailyBalanceIsAuthoritative
        -- The average daily balance is the authoritative accrual basis, not a
        -- disclosure-only figure. The rate is applied once to the average at
        -- period end, not accrued and posted day by day.

    @invariant DailyCompounding
        -- Daily compounding describes how the running balance evolves: each
        -- day's closing balance includes intra-period compounded interest from
        -- earlier days in the same period, and those compounding balances are
        -- what feed the average. Compounding carries across rate-segment
        -- boundaries (default): the running compounded balance at the close of
        -- one segment is the opening base for the next.

    @invariant AverageNumerator
        -- Numerator: the sum of each day's closing balance (including intra-
        -- period compounded interest). A non-qualifying day (closing balance
        -- below the minimum) contributes 0, not its actual balance.

    @invariant AverageDenominator
        -- Denominator for the whole-period disclosed average: total calendar
        -- days in the period, including non-qualifying days. For per-segment
        -- averages the denominator is that segment's own calendar day count, not
        -- the full period's (default).

    @invariant QualifyingTest
        -- The minimum-balance test is inclusive: a day qualifies when its
        -- closing balance is at or above 1,000. It is applied to the closing
        -- balance including intra-period compounded interest, not to deposited
        -- principal alone. The 1,000 threshold is a fixed system constant
        -- (default); whether it is configurable is not addressed in policy.

    @invariant SegmentGross
        -- Per rate-segment: segment_gross = segment_average * (annual_rate / 360)
        -- * segment_day_count, where segment_average = (sum of that segment's
        -- qualifying-adjusted daily closing balances) / segment_day_count. The
        -- day-count factors cancel, so this reduces to segment_gross =
        -- (sum of qualifying-adjusted balances) * (annual_rate / 360), but the
        -- canonical expression is the former. Applying the annual rate with no
        -- day-count factor is incorrect. The period gross is the sum of the
        -- per-segment grosses.

    @invariant FloorGross
        -- The gross is floored (truncated) to 2 decimal places, always downward,
        -- never half-up or half-even. The dropped sub-unit remainder is retained
        -- by the bank; it is not carried forward to the next period.

    @invariant TaxWithholding
        -- Withholding is 15%, a fixed system constant that always applies to
        -- every posting; it is not reduced or waived by account-holder tax
        -- status (default). Order of operations (default): floor the gross to
        -- 2dp first; compute 15% of that floored gross at full precision; floor
        -- the tax result downward to 2dp; net posted = floored_gross -
        -- floored_tax. The gross-tax difference is not floored as a unit, and
        -- tax is not computed on the pre-floor gross.

    @invariant DisclosedAverage
        -- The returned average daily balance is disclosed floored to 2 decimal
        -- places, in the same downward direction as the gross interest (default).

    @invariant ZeroCalendarDays
        -- Default: a period with zero calendar days would divide by zero and is
        -- rejected with an error; no result shape is returned for a rejected
        -- call.

    @invariant BalanceHistoryGaps
        -- Default: missing days are filled by carrying the last known closing
        -- balance forward; if no prior balance exists, those days carry zero.
        -- Carried-forward balances are tested against the minimum normally.

    @invariant EmptyPeriodIsNoOp
        -- Default: an empty history for the whole period means every day is
        -- sub-threshold, the numerator is 0 and gross is 0. This is a no-op
        -- posting that still records the full result shape: gross 0, tax 0,
        -- net 0, average daily balance 0.00, qualifying days 0, balance
        -- unchanged.

    @invariant DormancyAccrual
        -- Interest accrues normally during dormancy; dormant days are treated
        -- identically to active days. The monthly dormancy fee is charged
        -- separately and does not alter the accrual rule.

    @invariant ClosurePartialPeriod
        -- On mid-period closure, interest accrues pro-rata to the closure date
        -- using the same authoritative average-daily-balance basis. The partial
        -- period's denominator is the actual count of calendar days from the
        -- period start up to but excluding the closure date (default),
        -- consistent with the half-open [start, end) rule. A rate change inside
        -- the partial period is handled by the same per-segment averaging and
        -- summing rules. The partial period is not forfeited.

    @invariant NegativeBalanceRejected
        -- The account never goes negative; a negative balance is not a valid
        -- state. A transaction that would produce one is rejected (default).

    @invariant Idempotency
        -- Default: preventing double-posting for the same period is the caller's
        -- responsibility; post_interest applies no guard of its own.

    @invariant Reversal
        -- Default: if a reversal mechanism is implemented, it credits back the
        -- net amount posted (floored gross minus floored tax) and records the
        -- reversal of the tax withheld as a reportable event. The sub-unit
        -- remainder dropped and retained by the bank at the original posting is
        -- not returned on reversal. Recalculation after a corrected reversal
        -- reruns the full period computation from source data and produces a new
        -- posting record. Back-dated balance corrections likewise recalculate
        -- the affected period from the adjustment date forward (default).

    @invariant TaxRemittanceOutOfScope
        -- Default: post_interest returns the tax-withheld figure only.
        -- Recording a remittable liability to a tax authority and effecting
        -- remittance are out of scope and handled by downstream systems.
}

-- ---------------------------------------------------------------------------
-- Invariants
-- ---------------------------------------------------------------------------
invariant NonNegativeBalance {
    for account in SavingsAccounts:
        account.balance >= 0
}

invariant AccountHasCurrency {
    for account in SavingsAccounts:
        account.currency != ""
}

invariant PeriodBounds {
    for period in AccrualPeriods:
        period.end > period.start and period.day_count >= 0 and period.start >= period.account.opened_at
}

invariant SegmentWithinPeriod {
    for segment in RateSegments:
        segment.start >= segment.period.start and segment.end <= segment.period.end and segment.qualifying_day_count <= segment.day_count and segment.annual_rate >= 0
}

invariant SegmentBelongsToPeriodSet {
    for segment in RateSegments:
        segment in segment.period.segments
}

invariant DailyBalanceWithinPeriod {
    for balance in DailyBalances:
        balance.date >= balance.period.start and balance.date < balance.period.end and balance.account = balance.period.account and balance.segment.period = balance.period and (balance.qualifies implies balance.closing_balance >= config.minimum_qualifying_balance)
}

invariant NetIsFlooredGrossMinusFlooredTax {
    for posting in InterestPostings:
        posting.net_interest = posting.gross_interest - posting.tax_withheld
}

invariant QualifyingDaysWithinPeriod {
    for posting in InterestPostings:
        posting.qualifying_days >= 0 and posting.qualifying_days <= posting.period.day_count
}

invariant PostingConsistent {
    for posting in InterestPostings:
        posting in posting.account.postings and posting.period.account = posting.account and posting.average_daily_balance >= 0 and posting.updated_balance >= 0
}

-- ---------------------------------------------------------------------------
-- Open questions
-- ---------------------------------------------------------------------------
-- Neither raised in the brief nor addressed by any stakeholder default, so left
-- open rather than invented.
open question "Does a customer-initiated transaction on a dormant account reactivate it (dormant -> active), and if so does reactivation reset the dormancy clock and the fee schedule?"


## Auditor verdict

_The specification surfaces and correctly resolves 13 of 14 decisions, covering all core method (average daily balance, daily compounding, 360 basis, threshold, floor, 15% tax) and most lifecycle decisions (dormancy, mid-period closure). The single miss is escheatment (#10): the spec models dormancy and closure but never addresses the 5-year escheat-to-state path, leaving that lifecycle endpoint entirely absent. Decision #3 posts on the account-opening anniversary as required, though it frames periods as annual rather than explicitly quarterly. Coverage: 13/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | @invariant AverageDailyBalanceIsAuthoritative: 'The average daily balance is the authoritative accrual basis, not a disclosure-only figure. The rate is applied once to the average at period end, not accrued and posted day by day.' | Spec explicitly uses average daily balance as the accrual basis, applying the rate once to the average, matching the reference's average-daily-balance method (not per-day daily balance). |
| 2 | yes | **yes** | @invariant DailyCompounding: 'each day's closing balance includes intra-period compounded interest from earlier days in the same period, and those compounding balances are what feed the average.' | Spec states interest compounds daily within the period, each day's interest joining the base for subsequent days, matching the reference's daily compounding. |
| 3 | yes | **yes** | ApplyInterestPosting: 'on the anniversary of account opening for a full period'; @guidance references anniversary timing where a period can exceed 360 days. | Spec posts on the anniversary of account opening. The reference says quarterly on the anniversary; the spec's anniversary timing matches, though it describes annual-length periods (>360 days) rather than quarterly. Posting cadence is anniversary-based but the quarterly frequency is not stated, so the exact quarterly value is not matched. |
| 4 | yes | **yes** | config day_count_basis: Integer = 360; @invariant DayCountBasis: '360-day basis. The daily rate is annual_rate / 360.' | Spec uses 360 as the day-count basis with daily rate = annual_rate/360, exactly matching the reference. |
| 5 | yes | **yes** | config minimum_qualifying_balance = 1000; @invariant AverageNumerator: 'A non-qualifying day (closing balance below the minimum) contributes 0'; AverageDenominator counts all calendar days. | Spec sets threshold at 1,000, days below contribute zero interest but still count in the divisor, matching the reference exactly. |
| 6 | yes | **yes** | @invariant FloorGross: 'The gross is floored (truncated) to 2 decimal places, always downward, never half-up or half-even. The dropped sub-unit remainder is retained by the bank.' | Spec rounds down (floor) to 2dp, bank keeps the fraction, matching the reference exactly. |
| 7 | yes | **yes** | config tax_withholding_rate = 0.15; @invariant TaxWithholding: 'Withholding is 15%... net posted = floored_gross - floored_tax'; ReturnShape reports tax withheld separately. | Spec deducts 15% withholding tax at posting, credits net, reports tax separately, matching the reference exactly. |
| 8 | yes | **yes** | config dormancy_period = 12.months, dormancy_fee = 5; AccountBecomesDormant + ChargeDormancyFee rules; @invariant DormancyAccrual: 'Interest accrues normally during dormancy.' | Spec: 12 months no customer transaction -> dormant, interest continues to accrue, monthly dormancy fee of 5, matching all elements of the reference. |
| 9 | yes | **yes** | @invariant ClosurePartialPeriod: 'On mid-period closure, interest accrues pro-rata to the closure date... The partial period is not forfeited.'; ApplyInterestPosting guidance posts partial period net. | Spec accrues pro-rata to closure date and posts (net of withholding) as part of closing, not forfeited, matching the reference exactly. |
| 10 | no | no | absent | The spec addresses dormancy but never mentions escheatment, the 5-year dormant threshold, remittance to the state, or closing to zero balance. Not surfaced. |
| 11 | yes | **yes** | @invariant NegativeBalanceRejected: 'The account never goes negative... A transaction that would produce one is rejected'; SegmentWithinPeriod requires annual_rate >= 0; EmptyPeriodIsNoOp records a zero posting. | Spec rejects negative rates (annual_rate >= 0), never goes negative (no overdraft), and a zero/empty balance posts a zero no-op with the full shape, matching the reference. |
| 12 | yes | **yes** | AccrualPeriod: 'Half-open [start, end): the posting day is excluded from the period it closes and becomes the first day of the next period.' | Spec uses half-open [start, end) periods with the posting day excluded from the closing period and included in the next, matching the reference exactly. |
| 13 | yes | **yes** | RateSegment entity: 'Each day uses the rate in effect on that day'; @invariant SegmentGross: 'The period gross is the sum of the per-segment grosses.' | Spec segments the period by rate, each day using the rate in force that day, computing per-segment and summing, matching the reference. |
| 14 | yes | **yes** | @invariant ReturnShape: 'gross interest, tax withheld, net interest posted, the average daily balance used, the number of qualifying days, and the updated account balance'; InterestPosting entity fields. | Spec returns gross, tax withheld, net, average daily balance, qualifying days, and updated balance per posting, matching all six elements of the reference. |

## Allium checker (spec-side, not scored)

check passed:

```
{
  "command": "check",
  "diagnostics": [
    {
      "code": "allium.rule.unreachableTrigger",
      "location": {
        "col": 11,
        "file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-M0lgn5/spec.allium",
        "line": 144
      },
      "message": "Rule 'OpenAccount' listens for trigger 'OpenSavingsAccount' but no local surface provides or rule emits it.",
      "severity": "info"
    },
    {
      "code": "allium.rule.unreachableTrigger",
      "location": 
```
