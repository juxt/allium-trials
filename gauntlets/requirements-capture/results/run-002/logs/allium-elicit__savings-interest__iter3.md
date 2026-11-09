# allium-elicit — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 20 · Captured: 12/14 · Bespoke captured: 8/10

## Conversation

### Round 1
_Step reasoning:_ No questions asked yet; surfacing the material interest-computation policies the brief omits (compounding, day-count, accrual basis, rounding, edge balances, tiers, timing, lifecycle, output shape) before writing any spec.

Q: Compounding method: is interest simple over the whole period (rate applied to the summed/average daily balances once), or does it compound, and if so at what frequency (daily, monthly, at period end)?
A: Interest compounds daily: each day's accrued interest joins the principal for the next day's accrual within the period. At period end a single posting is made reflecting the compounded result, not simple interest on the average.

Q: Day-count convention: how is the daily rate derived from the annual rate — divide by 365, by 360, or by actual days in the year (365/366 handling leap years)?
A: Daily rate = annual_rate / 360. Fixed 360-day basis; leap years are not considered.

Q: Accrual basis: which figure does each day contribute — the opening or closing balance for that day? Are the first and last days of the period both counted (inclusive both ends), and does the day interest is posted itself accrue?
A: Each day contributes its closing balance. Periods are half-open [start, end): the first day of the period is included, the posting day itself is excluded from the period it closes and is the first day of the next period. So neither 'first and last both counted' nor 'last excluded' exactly — start included, end excluded.

Q: Rounding and precision: to what unit is posted interest rounded (e.g. the minor currency unit / cent), in which direction (half-up, half-even/banker's, truncate down), and what happens to any sub-unit remainder — dropped, or carried forward to the next period?
A: Posted interest is rounded down (floor/truncate) to the minor currency unit (2 decimal places). The sub-unit remainder is dropped — the bank retains it. Nothing is carried forward to the next period.

Q: Zero and negative daily balances: if a day's balance is zero or negative, does that day earn zero interest, is it skipped, or is interest charged (negative) against it?
A: A day with a zero balance contributes zero interest for that day but still counts as a day in the period (it is included in the divisor). Negative balances are not anticipated (the account never goes negative per policy); a negative annual rate is rejected as invalid.

Q: Thresholds and tiers: is there a minimum balance required to earn any interest, and does the rate vary by balance band or is a single flat annual rate applied to the whole balance?
A: Minimum balance of 1,000 is required to earn interest on a given day. Days where the balance is below 1,000 contribute zero to interest accrual but still count in the period-day divisor. A single flat annual rate applies; there are no balance tiers.

Q: Timing and effective date: when in the period is interest posted (last day of the period?), and once posted does it join the balance such that it earns interest in subsequent periods?
A: Interest is posted quarterly on the anniversary of account opening (not calendar quarter-ends). Once posted, net interest is credited to the account balance and therefore accrues interest in subsequent periods.

Q: Whole-of-life events: what should happen if the annual rate changes mid-period, or if the account is closed before the period ends — is interest computed up to the effective/closure date, and with what basis?
A: Rate change mid-period: compute interest per rate-segment (each day uses the rate in force that day), sum the segments. Account closure mid-period: interest accrues pro-rata to the closure date and is posted (net of 15% withholding tax) as part of the closing process; the customer does not forfeit the partial period.

Q: Return shape: beyond the interest amount and the updated balance, must post_interest return anything else (e.g. accrued-but-unrounded amount, carried remainder, the period boundaries, currency/units), and in what units is each expressed?
A: post_interest must return, per posting: gross interest, tax withheld (15% of gross), net interest posted (gross minus tax), the average daily balance used in the calculation, the number of qualifying days (days at or above the 1,000 minimum), and the updated account balance. All monetary values in the minor currency unit (or decimal with 2 dp). No carried remainder is returned as it is dropped.

### Round 2
_Step reasoning:_ Core-method and output-shape gaps remain: the average-daily-balance divisor/numerator, whether compounding feeds the closing balance and threshold test, the tax-and-rounding order of operations, and the zero-qualifying-day degenerate case.

Q: Average daily balance definition (it is in the return shape): what is its numerator and divisor exactly? Is the numerator the sum of every day's closing balance including days below the 1,000 minimum and zero-balance days, or only the qualifying days' balances? Is the divisor the total period-days or only the qualifying-day count? And does the figure include within-period accrued-but-unposted interest, or only the transactional balance?
A: Numerator: the sum of every day's closing balance over the period, including days where the balance is below 1,000 and zero-balance days — below-threshold days contribute their actual transactional balance to the sum, not zero. Divisor: the total calendar days in the period (not the qualifying-day count); below-threshold days explicitly count in the divisor per policy. Whether within-period accrued-but-unposted interest is included in the daily balance figure is not covered by policy; [default, not policy] the closing balance used for the average is the transactional balance only — compounded accrual is tracked on a separate notional accumulator and does not inflate the daily balance figure used for averaging.

Q: Daily compounding versus the closing-balance and threshold tests: when a day's accrued interest 'joins the principal for the next day's accrual', does that running compounded amount add to the closing balance that each subsequent day contributes, and does it count toward the 1,000 minimum (so a sub-1,000 transactional balance could cross the threshold via accrued interest)? Or are the daily closing balances purely transactional, with compounding tracked on a separate notional accrual balance?
A: Not covered by policy. [default, not policy] The daily closing balances used for the threshold test (≥ 1,000) and for the average daily balance calculation are purely transactional; accrued-but-unposted compounded interest is accumulated on a separate notional accrual balance and does not count toward the 1,000 minimum. A sub-1,000 transactional balance cannot cross the threshold via accrued interest.

Q: Tax and rounding order of operations: is gross interest floored to 2dp first and the 15% withholding then computed on that floored gross, or is tax computed on the unrounded accrued amount? In which direction is the tax figure itself rounded, and net = gross − tax — is net therefore exact or independently rounded? Where does any tax sub-unit remainder go?
A: Not covered by policy. [default, not policy] The recommended order is: (1) floor the total compounded gross accrual to 2 dp; (2) compute withholding tax as 15% of that floored gross, itself floored to 2 dp; (3) net = floored gross − floored tax (exact subtraction, no independent rounding of net). Any sub-unit remainder on the tax figure is retained by the tax authority and not credited to the account.

Q: Degenerate period: if the period has no qualifying days (every day below 1,000, or an empty/zero balance history), what does post_interest return for gross/tax/net, and what value is reported for the average daily balance to avoid a divide-by-zero (e.g. zero, or the raw average over period-days)?
A: For a period with no qualifying days, gross interest = 0, tax withheld = 0, net posted = 0 — recorded as a zero posting per policy, not omitted. For the average daily balance figure in that degenerate case, policy does not specify; [default, not policy] report the raw arithmetic average over all period-days (sum of all closing balances divided by period-day count); when all balances are zero the result is zero; the divisor is always the period-day count (minimum 1), so no divide-by-zero arises.

### Round 3
_Step reasoning:_ Core method, precision, rounding, timing, degenerate cases and most whole-of-life events are covered, but the whole-of-life class still has unasked items — back-dated corrections to posted periods, posting reversal, suspension/dormancy, and tax-exemption variation — each a material policy a model cannot reliably infer.

Q: Back-dated corrections: if a prior day's transactional balance in a period whose interest has ALREADY been posted is later corrected (a back-dated deposit, reversal, or error fix), does post_interest recompute and adjust that closed period's posting (claw back or top up), or is a posted period immutable with the correction only affecting future accrual?
A: Not covered by policy. [default, not policy] Posted periods are immutable: a back-dated correction to a closed period's transactional history does not trigger a recompute or adjustment of that period's posting. The corrected balance takes effect from the correction's value date and influences future accrual only.

Q: Posting reversal/correction: if an interest posting itself is found to be erroneous (wrong rate, wrong balance history), how is it undone — a reversing entry that also reverses the 15% withholding, a net adjustment on the next posting, or is it out of scope for post_interest?
A: Not covered by policy. [default, not policy] Erroneous posting correction is out of scope for post_interest. Undoing an erroneous posting — including reversing the associated withholding — is handled via separate reversal journal entries in the ledger layer; post_interest is not responsible for detecting or applying such corrections.

Q: Account suspension/dormancy (distinct from closure): if an account is frozen, dormant, or suspended during a period but not closed, does interest continue to accrue and post normally for those days, accrue but hold the posting, or stop accruing entirely for suspended days?
A: Dormancy is in scope: after 12 months with no customer-initiated transaction the account is dormant; while dormant, interest continues to accrue normally and a monthly dormancy fee of 5 is charged. 'Frozen' or 'suspended' (regulatory or administrative hold, distinct from dormancy) is not covered by policy. [default, not policy] Treat a suspended account like a dormant one for accrual purposes — interest continues to accrue — unless the suspension instruction explicitly directs otherwise.

Q: Tax treatment variation: is the 15% withholding applied uniformly to every account, or are there exempt accounts or differing withholding rates (e.g. by customer residency or account type) that post_interest must account for — and is the withholding rate a fixed policy constant or configurable/effective-dated like the annual rate?
A: The 15% withholding rate is a fixed policy constant applied uniformly to every account; the answer key contains no exemptions, residency-based variation, or account-type carve-outs. Whether the rate is effective-dated or configurable like the annual rate is not covered by policy. [default, not policy] Treat it as a fixed constant; any future need for per-account or effective-dated withholding rates would require a policy decision before post_interest could implement them.

### Round 4
_Step reasoning:_ The round-3 dormancy answer introduced a monthly fee of 5 whose ownership by post_interest, interaction with the accrual balance and threshold, and presence in the return shape are all unresolved — a genuine whole-of-life gap, not an invented one.

Q: Dormancy fee mechanics: the monthly dormancy fee of 5 was introduced as charged while dormant — is post_interest itself responsible for deducting this fee, or is it applied by a separate process? If post_interest applies it: in what units is the 5 (minor unit / whole currency units), is it charged per calendar month or per 30 days within the period, and is it prorated or waived for a partial final month at closure?
A: Not covered by policy for all sub-parts. [default, not policy] The dormancy fee is applied by a separate process; post_interest is not responsible for deducting it. The 5 is in whole currency units. It is charged per calendar month (not per 30-day rolling window). For a partial final month at closure it is waived, not prorated.

Q: Dormancy fee and the balance used for accrual: when the fee is deducted, does it reduce the transactional closing balance on the day it is charged — thereby lowering that day's (and subsequent days') accrual and possibly pushing the balance below the 1,000 qualifying threshold — or is it booked outside the balance used for interest accrual?
A: Not covered by policy. [default, not policy] The fee is a real debit and reduces the transactional closing balance on the day it is charged; it therefore lowers that day's and subsequent days' closing balances for accrual and average-balance purposes, and can push the balance below the 1,000 qualifying threshold.

Q: Dormancy fee and the return shape: must post_interest report the dormancy fee(s) charged as a distinct field in its return (alongside gross/tax/net interest, average daily balance, qualifying days, updated balance), and is the fee subject to any flooring to the minor unit? Also, can a dormancy fee ever drive the account balance below zero, and if so is it capped at the available balance?
A: Policy (answer key item 14) defines the return shape as: gross interest, tax withheld, net interest posted, average daily balance, qualifying-day count, and updated balance — no dormancy fee field is listed. [default, not policy] If the fee is applied by a separate process, post_interest need not report it. If post_interest were ever made responsible, the fee should appear as a distinct field. The fee is not subject to interest-rounding rules (it is a fixed charge, not a computed amount). Policy (item 11) states the account never goes negative; [default, not policy] the fee should be capped at the available balance rather than driving the account negative.

### Round 5 (process signalled done)
_Step reasoning:_ All completeness-gate decision classes (core method, day-count, accrual basis, rounding, thresholds, timing, whole-of-life events including closure/rate-change/dormancy/suspension/back-dated corrections/reversals, tax order, degenerate periods, scope boundaries, and the field-by-field return shape) have been put to the stakeholder and answered or explicitly ruled out of scope; the last two rounds returned only '[default, not policy]', signalling the answer key is exhausted.

(no questions this round)

## Produced specification

-- allium: 3
-- savings-interest.allium
--
-- Scope: The interest engine for savings accounts. Given an account with a
--   daily balance history and a dated interest-rate schedule, compute the
--   interest earned over a period, withhold tax, and post the net result,
--   updating the account balance. Core operation: post_interest(account, period).
-- Includes:
--   - Daily-compounded interest accrual over a half-open period
--   - Minimum-balance qualification and the per-day accrual basis
--   - Flooring/rounding and withholding-tax treatment
--   - Quarterly posting on the account-opening anniversary
--   - Mid-period rate changes, account closure, dormancy
--   - The posting result shape (the return of post_interest)
-- Excludes:
--   - The dormancy-fee charging process (separate process; see deferred)
--   - Reversal/correction of erroneous postings (ledger layer; see deferred)
--   - The core daily-compounding arithmetic itself (captured as a black box;
--     its policy inputs and conventions are pinned here)

------------------------------------------------------------
-- Value Types
------------------------------------------------------------

-- The accrual window. Half-open [start, end): the start day is included, the
-- end (posting) day is excluded from the period it closes and becomes the first
-- day of the next period. day_count is the total number of CALENDAR days in
-- [start, end) -- every day counts, including zero-balance and below-minimum
-- days. By policy the divisor used for the average is this count, floored at a
-- minimum of 1 so a degenerate period never divides by zero.
value Period {
    start: Timestamp
    end: Timestamp
    day_count: Integer
}

------------------------------------------------------------
-- Enumerations
------------------------------------------------------------

-- Why a posting was produced. A normal quarterly posting, or the final
-- pro-rata posting made as part of closing the account.
enum PostingReason { scheduled | closure }

------------------------------------------------------------
-- Entities and Variants
------------------------------------------------------------

entity Account {
    -- Opening instant; posting anniversaries are measured from here, NOT from
    -- calendar quarter-ends.
    opened_at: Timestamp

    -- Transactional (ledger) balance. Never goes negative, by policy.
    balance: Decimal

    status: active | dormant | closed

    -- Instant of the most recent customer-initiated transaction. Drives
    -- dormancy (12 months of inactivity).
    last_customer_activity_at: Timestamp

    -- Next scheduled quarterly posting instant. Advanced by one posting
    -- interval each time a scheduled posting is made.
    next_posting_at: Timestamp

    -- The daily closing-balance history. Each entry is the TRANSACTIONAL
    -- closing balance for one day; accrued-but-unposted compounded interest is
    -- tracked notionally and is NOT part of these figures.
    daily_balances: DailyBalance with account = this

    -- The dated interest-rate schedule. More than one segment may apply within
    -- a single period when the rate changes mid-period.
    interest_rates: InterestRate with account = this

    transitions status {
        active -> dormant
        dormant -> active
        active -> closed
        dormant -> closed
        terminal: closed
    }

    invariant NonNegativeBalance {
        balance >= 0
    }
}

entity DailyBalance {
    account: Account
    date: Timestamp

    -- The day's TRANSACTIONAL closing balance. This is the figure tested
    -- against the minimum and summed into the average-balance numerator. A day
    -- with a zero balance is a real day of the period (it still counts in the
    -- day_count divisor) that earns zero interest. Below-minimum days likewise
    -- count in the divisor and contribute their actual balance to the numerator,
    -- but accrue zero interest. Accrued compounded interest never inflates this
    -- figure and never lifts a sub-minimum balance over the threshold.
    closing_balance: Decimal
}

entity InterestRate {
    account: Account
    annual_rate: Decimal
    effective_from: Timestamp
    effective_to: Timestamp?

    -- A negative annual rate is rejected as invalid.
    invariant NonNegativeRate {
        annual_rate >= 0
    }

    -- A segment that has ended must end after it began.
    invariant ValidRange {
        effective_to = null or effective_to > effective_from
    }
}

-- The result of post_interest: one posting record carrying the complete return
-- shape. All monetary figures are in the minor currency unit (decimal, 2 dp).
entity InterestPosting {
    account: Account
    period: Period
    reason: PostingReason
    posted_at: Timestamp

    -- Total compounded interest for the period, floored to 2 dp. The dropped
    -- sub-unit remainder is retained by the bank and never carried forward.
    gross_interest: Decimal

    -- Withholding tax: 15% of the floored gross, itself floored to 2 dp. The
    -- dropped sub-unit remainder is retained by the tax authority.
    tax_withheld: Decimal

    -- Net posted to the account: floored gross minus floored tax (exact
    -- subtraction, not independently rounded).
    net_interest: Decimal

    -- Sum of EVERY day's closing balance over the period (including zero and
    -- below-minimum days) divided by the total calendar days in the period.
    average_daily_balance: Decimal

    -- Count of days whose closing balance was at or above the minimum.
    qualifying_days: Integer

    -- The account balance after net interest is credited.
    updated_balance: Decimal

    -- Posted periods are immutable: net = gross - tax always holds for the
    -- figures as posted, regardless of any later back-dated correction.
    invariant NetIsGrossMinusTax {
        net_interest = gross_interest - tax_withheld
    }
}

------------------------------------------------------------
-- Config
------------------------------------------------------------

config {
    -- Minimum closing balance a day must reach to earn interest that day.
    -- A single flat annual rate applies above it; there are no balance tiers.
    minimum_qualifying_balance: Decimal = 1000

    -- Fixed 360-day basis: daily rate = annual_rate / 360. Leap years are not
    -- considered. This is a fixed policy convention, not expected to vary.
    day_count_basis: Integer = 360

    -- Fixed, uniform withholding rate applied to every account's gross
    -- interest. No exemptions, residency variation, or account-type carve-outs;
    -- treated as a fixed policy constant (see open question on effective-dating).
    withholding_tax_rate: Decimal = 0.15

    -- Interest posts quarterly, on the anniversary of account opening.
    posting_interval: Duration = 3.months

    -- After this long with no customer-initiated transaction the account is
    -- dormant.
    dormancy_threshold: Duration = 12.months

    -- Minor-currency-unit precision. Posted figures are floored to this many
    -- decimal places.
    currency_precision: Integer = 2
}

------------------------------------------------------------
-- Rules
------------------------------------------------------------

-- The core engine: post_interest(account, period). Computes daily-compounded
-- interest over the period, withholds tax, records the full result, and credits
-- the net to the balance. Callable directly (reason omitted -> scheduled) and
-- emitted by the quarterly scheduler and by closure.
rule PostInterest {
    when: PostInterest(account, period, reason?)
    requires: account.status in {active, dormant}

    -- Days of the period, by their transactional closing balance. The window is
    -- half-open [start, end): the start day is included, the end day excluded.
    let period_balances =
        filter(account.daily_balances, b => b.date >= period.start and b.date < period.end)

    -- Qualifying days: closing balance at or above the minimum.
    let qualifying_balances =
        filter(period_balances, b => b.closing_balance >= config.minimum_qualifying_balance)

    -- Daily-compounded gross: each qualifying day accrues
    -- closing_balance * (rate_in_force_that_day / day_count_basis); the day's
    -- accrued interest joins a notional principal for the next day's accrual
    -- within the period. Below-minimum and zero days accrue nothing but remain
    -- days of the period. When the rate changes mid-period each day uses the
    -- rate in force that day and the segments are summed. The compounded total
    -- is then floored to the currency precision; the sub-unit remainder drops.
    let gross = floor(
        compound_daily(
            period_balances,
            account.interest_rates,
            config.minimum_qualifying_balance,
            config.day_count_basis
        ),
        config.currency_precision
    )

    -- Withholding tax: 15% of the floored gross, itself floored.
    let tax = floor(gross * config.withholding_tax_rate, config.currency_precision)

    -- Net is exact subtraction of the two floored figures.
    let net = gross - tax

    ensures: InterestPosting.created(
        account: account,
        period: period,
        reason: reason ?? scheduled,
        posted_at: now,
        gross_interest: gross,
        tax_withheld: tax,
        net_interest: net,
        average_daily_balance: sum_balances(period_balances) / period.day_count,
        qualifying_days: qualifying_balances.count,
        updated_balance: account.balance + net
    )

    -- Net interest is credited and therefore accrues in subsequent periods.
    ensures: account.balance = account.balance + net

    @guidance
        -- A period with no qualifying days still produces a posting, not an
        -- omission: gross = 0, tax = 0, net = 0. In that case
        -- compound_daily returns 0 and the balance is unchanged, but the record
        -- is still written.
        -- The average_daily_balance divisor is the total calendar days in the
        -- period (period.day_count), floored at a minimum of 1 so an empty or
        -- all-zero history reports 0 rather than dividing by zero.
        -- The daily balances used for the minimum test and the average are the
        -- transactional balances only; notional compounded accrual is tracked
        -- separately and does not count toward the minimum or the average.
        -- Posted periods are immutable: a back-dated correction to a day whose
        -- period has already been posted does NOT recompute or adjust that
        -- posting. The corrected balance takes effect from its value date and
        -- influences future accrual only.
}

-- Timing: interest falls due quarterly on the opening anniversary. Emits the
-- scheduled posting and advances the next due instant.
rule QuarterlyPostingDue {
    when: account: Account.next_posting_at <= now
    requires: account.status in {active, dormant}
    let period = current_posting_period(account.opened_at, account.next_posting_at)
    ensures: PostInterest(account: account, period: period, reason: scheduled)
    ensures: account.next_posting_at = account.next_posting_at + config.posting_interval
}

-- Closure: interest accrues pro-rata to the closure date and is posted (net of
-- withholding) as part of closing. The customer does not forfeit the partial
-- period.
rule CloseAccount {
    when: CloseAccount(account)
    requires: account.status in {active, dormant}
    let period = closure_period(account.opened_at, account.next_posting_at, now)
    ensures: PostInterest(account: account, period: period, reason: closure)
    ensures: account.status = closed
}

-- Dormancy: after 12 months with no customer-initiated transaction the account
-- becomes dormant. Interest continues to accrue and post normally while dormant.
rule AccountBecomesDormant {
    when: account: Account.last_customer_activity_at + config.dormancy_threshold <= now
    requires: account.status = active
    ensures: account.status = dormant
}

-- A customer transaction on a dormant account reactivates it and records the
-- activity.
rule ReactivateOnActivity {
    when: CustomerTransaction(account)
    requires: account.status = dormant
    ensures: account.status = active
    ensures: account.last_customer_activity_at = now
}

-- A customer transaction on an active account records the activity.
rule RecordActivity {
    when: CustomerTransaction(account)
    requires: account.status = active
    ensures: account.last_customer_activity_at = now
}

------------------------------------------------------------
-- Invariants
------------------------------------------------------------

invariant BalancesNeverNegative {
    for account in Accounts:
        account.balance >= 0
}

invariant WithholdingNeverExceedsGross {
    for posting in InterestPostings:
        posting.tax_withheld <= posting.gross_interest
}

------------------------------------------------------------
-- Surfaces
------------------------------------------------------------

-- The operations the engine exposes at its boundary.
surface InterestEngine {
    context account: Account

    provides:
        PostInterest(account, period, reason?)
        CloseAccount(account)
        CustomerTransaction(account)
}

-- The result shape of post_interest, as disclosed to the caller. Every field
-- the operation must return, per posting.
surface PostingStatement {
    context posting: InterestPosting

    exposes:
        posting.gross_interest
        posting.tax_withheld
        posting.net_interest
        posting.average_daily_balance
        posting.qualifying_days
        posting.updated_balance

    @guidance
        -- No carried remainder is returned: the dropped sub-unit remainders on
        -- gross and tax are retained by the bank and the tax authority
        -- respectively. The dormancy fee is not part of this return shape.
}

------------------------------------------------------------
-- Deferred Specifications
------------------------------------------------------------

-- The monthly dormancy fee (5 whole currency units) is charged by a separate
-- process, not by post_interest. It is a real debit: it reduces the
-- transactional closing balance on the calendar month's charge day, lowering
-- that and subsequent days' accrual and possibly pushing the balance below the
-- minimum. It is charged per calendar month, waived (not prorated) for a partial
-- final month at closure, not subject to interest-rounding, and capped at the
-- available balance so the account never goes negative.
deferred DormancyFee.charge          -- see: dormancy-fee.allium

-- Reversal/correction of an erroneous posting (wrong rate or balance history),
-- including reversing the associated withholding, is handled by separate
-- reversal journal entries in the ledger layer, out of scope for post_interest.
deferred PostingReversal.reverse     -- see: ledger-reversal.allium

------------------------------------------------------------
-- Open Questions
------------------------------------------------------------

-- The following were resolved by sensible default during elicitation but were
-- NOT confirmed by policy; each warrants explicit sign-off.

open question "Whether within-period accrued-but-unposted interest should be included in the daily balance figure used for averaging (defaulted: transactional balance only; compounding tracked on a separate notional accumulator)."
open question "Whether accrued compounded interest counts toward the 1,000 minimum, allowing a sub-1,000 transactional balance to cross the threshold (defaulted: no; threshold and average use transactional balances only)."
open question "Tax and rounding order of operations (defaulted: floor gross to 2dp, then tax = 15% of floored gross floored to 2dp, then net = floored gross - floored tax, no independent rounding of net; tax sub-unit remainder to the tax authority)."
open question "Average-daily-balance figure for a degenerate period with no qualifying days (defaulted: raw arithmetic average over all period-days; divisor floored at 1; all-zero balances yield 0)."
open question "Back-dated corrections to already-posted periods (defaulted: posted periods immutable; correction affects future accrual only)."
open question "Reversal of an erroneous posting (defaulted: out of scope for post_interest; handled by ledger reversal journals)."
open question "Treatment of frozen/suspended (non-dormant) accounts (defaulted: treat like dormant for accrual -- interest continues -- unless the suspension instruction directs otherwise)."
open question "Whether the 15% withholding rate is effective-dated or configurable like the annual rate (defaulted: fixed policy constant)."
open question "Dormancy-fee ownership and mechanics (defaulted: applied by a separate process; 5 whole currency units; per calendar month; waived for a partial final month at closure; reduces the transactional balance; capped at available balance; not reported by post_interest)."


## Auditor verdict

_12 of 14 decisions correct. Correct: #2 (daily compounding), #3 (quarterly on opening anniversary), #4 (360 basis), #5 (1,000 minimum, counts in divisor), #6 (floor), #7 (15% withholding reported separately), #8 (12-month dormancy, interest continues, fee of 5), #9 (pro-rata closure net of tax), #11 (reject negative rate / zero no-op / non-negative), #12 (half-open period boundary), #13 (per-day rate segments summed), #14 (full output shape). Incorrect: #1 — the core method is resolved as per-day daily-balance compounding (compound_daily), not average daily balance with the rate applied once; average_daily_balance is reported but is not the interest basis. Absent: #10 — escheatment (5-year dormant, remit to state, close to zero) is not surfaced at all. Of the core in-focus six [1,2,3,8,9,10], the spec gets 4 (#2,#3,#8,#9), misses the method (#1) and omits escheatment (#10)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | no | "Daily-compounded gross: each qualifying day accrues closing_balance * (rate_in_force_that_day / day_count_basis); the day's accrued interest joins a notional principal for the next day's accrual" (compound_daily in rule PostInterest) | The spec addresses the calculation method but resolves it as per-day daily-balance compounding, which the reference explicitly rules out. The reference requires average daily balance with the rate applied ONCE to the average; the spec computes average_daily_balance only as a reported figure, not as the interest basis. Wrong method. |
| 2 | yes | **yes** | "the day's accrued interest joins a notional principal for the next day's accrual within the period" (PostInterest guidance / compound_daily) | The spec states interest compounds daily, each day's accrual joining the base for the next day, matching the reference exactly. |
| 3 | yes | **yes** | config posting_interval = 3.months; rule QuarterlyPostingDue; Account.opened_at comment "posting anniversaries are measured from here, NOT from calendar quarter-ends" | Quarterly posting on the account-opening anniversary, explicitly not calendar quarter-ends, matches the reference. |
| 4 | yes | **yes** | config day_count_basis: Integer = 360; "daily rate = annual_rate / 360" | 360-day basis with daily rate = annual_rate/360 matches the reference exactly. |
| 5 | yes | **yes** | config minimum_qualifying_balance = 1000; "Below-minimum days likewise count in the divisor and contribute their actual balance to the numerator, but accrue zero interest." | Interest accrues only at or above 1,000; sub-minimum days earn zero but still count in the average divisor, matching the reference. |
| 6 | yes | **yes** | "Total compounded interest for the period, floored to 2 dp. The dropped sub-unit remainder is retained by the bank"; floor(..., config.currency_precision) | Posted interest is floored (never half-up) to 2 dp and the bank keeps the fraction, matching the reference. |
| 7 | yes | **yes** | config withholding_tax_rate = 0.15; tax_withheld = "15% of the floored gross"; net = gross - tax; separate tax_withheld field and PostingStatement exposure | 15% withholding deducted at posting, net credited, tax reported separately as its own figure, matching the reference. |
| 8 | yes | **yes** | config dormancy_threshold = 12.months; rule AccountBecomesDormant; "Interest continues to accrue and post normally while dormant"; deferred DormancyFee "monthly dormancy fee (5 whole currency units)" | 12 months of inactivity triggers dormancy, interest continues to accrue, and a monthly dormancy fee of 5 is stated (deferred to a separate process but the value and cadence are pinned), matching the reference. |
| 9 | yes | **yes** | rule CloseAccount: "interest accrues pro-rata to the closure date and is posted (net of withholding) as part of closing. The customer does not forfeit the partial period." | Pro-rata accrual to closure date, posted net of withholding, no forfeiture, matches the reference exactly. |
| 10 | no | no | absent | No mention of escheatment, a 5-year dormant threshold, remittance to the state, or closing to zero balance anywhere in the spec. Dormancy is covered but escheatment is not surfaced. |
| 11 | yes | **yes** | invariant NonNegativeRate { annual_rate >= 0 } with "A negative annual rate is rejected as invalid"; guidance "A period with no qualifying days still produces a posting... gross = 0, tax = 0, net = 0"; invariant NonNegativeBalance | Negative rate rejected as invalid, zero/empty balance yields a recorded zero posting (no-op), and the account never goes negative, matching the reference. |
| 12 | yes | **yes** | Period comment: "Half-open [start, end): the start day is included, the end (posting) day is excluded from the period it closes and becomes the first day of the next period." | Posting day excluded from the period it closes and included in the next, half-open [start, end), matches the reference exactly. |
| 13 | yes | **yes** | "When the rate changes mid-period each day uses the rate in force that day and the segments are summed"; InterestRate schedule with effective_from/effective_to | Each day uses the rate in force on that day, computed per rate-segment and summed, matching the reference. |
| 14 | yes | **yes** | surface PostingStatement exposes posting.gross_interest, tax_withheld, net_interest, average_daily_balance, qualifying_days, updated_balance; InterestPosting fields | The return shape discloses all six required fields: gross, tax withheld, net, average daily balance used, qualifying days, and updated balance, matching the reference. |

## Allium checker (spec-side, not scored)

check passed:

```
{
  "command": "check",
  "diagnostics": [],
  "findings": [],
  "spec_file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-hJGxfO/spec.allium"
}

```
