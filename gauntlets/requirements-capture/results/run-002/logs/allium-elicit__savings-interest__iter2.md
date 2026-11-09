# allium-elicit — savings-interest — iteration 2

Model (author): claude-opus · Questions asked: 25 · Captured: 11/14 · Bespoke captured: 7/10

## Conversation

### Round 1
_Step reasoning:_ No questions asked yet; these surface the core undetermined policy decisions (day-count, compounding, rounding, balance basis, edge balances, rate changes, output shape) that cannot be reliably inferred.

Q: How is the annual rate turned into a daily figure, and does interest compound or accrue simply? Specifically: what day-count convention applies (e.g. actual/365, actual/360, actual/actual honouring leap years), and is interest simple accrual over the period posted once, or compounded daily so each day's interest itself earns interest?
A: The daily rate is annual_rate / 360 (day-count convention: 360, not 365 and not actual/actual). Interest compounds daily: each day's accrued interest is added to the running balance before the next day's accrual, so interest earns interest within the period.

Q: Which daily balance is used for each day's accrual (e.g. end-of-day closing balance), and how is the period bounded: are the start and end dates both included, and does the posting day itself accrue? If the balance changes within a day, which value counts?
A: End-of-day closing balance is used for each day. [default, not policy — intra-day changes: the closing balance governs.] The period is half-open: [start, end). The posting day itself is excluded from the period being closed and falls into the next period's start, so it does not accrue in the period that posts.

Q: How is interest rounded, and to what precision? To the minor unit (e.g. nearest cent), or more decimal places held internally? Which direction does rounding go, is it applied per day or once on the total, and where does any sub-unit remainder go (dropped, carried forward to the next period, accumulated)?
A: Rounding is applied once to the final gross interest figure, not per day. It rounds down (floor) to the minor unit — 2 decimal places. The bank retains any sub-unit remainder; it is neither carried forward nor credited to the customer.

Q: How are non-standard daily balances treated: does interest accrue on a zero balance, and on a negative (overdrawn) balance does it accrue at this same rate, a different rate, or not at all? Is there a minimum-balance threshold below which no interest is earned, or tiered rates by balance band?
A: A zero balance for the whole period results in a zero posting (a no-op, still recorded). There is a minimum balance threshold of 1,000: on any day the balance is below 1,000 that day contributes zero interest, but it still counts as a day in the divisor used to compute the average daily balance. A negative (overdrawn) balance is not addressed as a supported state — the account never goes negative. A negative rate is rejected as invalid.

Q: Can the annual rate change partway through the period, and if so how is that handled (each day uses the rate in force that day)? Are there multiple rates or just the single rate given?
A: Yes, the rate can change mid-period. Each day uses the rate in force on that day. The accrual is computed per rate-segment (a contiguous range of days sharing the same rate) and the results are summed to produce the period's gross interest. There is a single rate at any given time; no tiered bands.

Q: What exactly must post_interest return, field by field? Beyond the interest amount and updated balance, is anything else required (e.g. accrual start/end, effective date of posting, the rate used, a per-day breakdown)? And is the interest figure disclosed anywhere on a different basis (e.g. an AER/APY) from how it is computed?
A: post_interest must return: gross interest, tax withheld (15% of gross), net interest posted (gross minus tax), the average daily balance used in the calculation, the number of qualifying days (days at or above the 1,000 minimum), and the updated account balance after crediting the net interest. No AER/APY disclosure is required. [default, not policy — accrual start/end dates and effective posting date are not mandated fields but are reasonable to include for auditability.]

### Round 2
_Step reasoning:_ A basis conflict between daily compounding and the reported average daily balance, plus tax rounding, missing-day handling, and re-run/reversal, remain unasked and uninferrable.

Q: You've said interest compounds daily on each day's end-of-day closing balance (per rate-segment), but the required output also includes an "average daily balance used in the calculation" with a divisor of total days in the period. These are two different bases. Is gross interest actually computed by daily compounding, with the average daily balance being only a separately-reported figure? Or is interest computed from the average daily balance (average × rate × days)? And precisely how is the average formed: for the numerator, do below-1,000 days contribute their actual closing balance or zero, and is the divisor the total calendar days in the period?
A: Gross interest is computed from the average daily balance; that is the actual computation basis, not a separately-reported supplementary figure. The method is: sum the closing balances for each day in the period, divide by the total calendar days in the period, then apply the rate once to that average. The earlier characterisation of daily compounding was incorrect. For the numerator: a day on which the closing balance is below 1,000 contributes zero, not its actual closing balance. The divisor is total calendar days in the period regardless of how many days qualify.

Q: Tax withheld is 15% of gross. Gross is floored to 2 dp. Is the tax figure itself rounded, and if so to what precision and in which direction (floor, round-half-up, etc.)? Is net interest then simply gross minus the rounded tax, already at 2 dp, or is net rounded independently?
A: The answer key does not specify rounding for the tax figure. [default, not policy] Apply the same floor-to-2dp rule to the tax amount (floor of gross × 0.15 to 2 dp). Net interest is then gross minus that rounded tax figure; no independent rounding of net is required since both inputs are already at 2 dp.

Q: If a day within the period has no recorded closing balance (a gap in the history, or the history starts after the period's start date), what balance governs that day: carry forward the last known closing balance, treat it as zero, or reject the input as incomplete?
A: Not covered by policy. [default, not policy] Carry the last known closing balance forward for any day with no recorded balance entry. If no prior closing balance exists at all (history starts after the period's start date with no initial balance established), reject the input as incomplete.

Q: Over the account's life, can post_interest be called more than once for the same or an overlapping period? Is there any guard against double-posting, and is there a reversal or correction path when a posting already made turns out to be wrong (e.g. a back-dated balance adjustment)?
A: Not covered by policy. [default, not policy] No guard against double-posting is mandated, and no reversal or correction path is specified. Calling post_interest twice for the same period would produce two independent postings. Guard logic, idempotency keys, and correction flows are implementation concerns outside the stated policy.

### Round 3
_Step reasoning:_ Round 2's switch to the average-daily-balance basis left the gross formula (how /360 and day count enter) and the mid-period rate-change handling genuinely contradictory with Round 1; both are material and cannot be inferred, so I must resolve them before finishing.

Q: Round 2 reframed the computation to a single average-daily-balance method (sum of qualifying closing balances ÷ total calendar days, rate applied once), but the exact formula is still ambiguous: once you have the average daily balance, is gross interest computed as average × (annual_rate/360) × number_of_days — and if so, is that day count the total calendar days in the period or only the qualifying days? Or is it average × annual_rate directly (no /360, no day multiplier)? Please state the precise arithmetic from average to gross.
A: Gross interest = average_daily_balance × (annual_rate / 360) × total_calendar_days_in_the_period. The day-count multiplier is the total calendar days in the period — the same count used as the divisor when forming the average. annual_rate / 360 gives the daily rate; multiplying by the period length converts it to the periodic rate. No separate /360 or day-count step is omitted or applied twice.

Q: In Round 1 you said a mid-period rate change is handled per rate-segment, with each segment's accrual summed. That was stated under the (now-corrected) daily-compounding model. Under the average-daily-balance method, how is a rate change handled now: do you compute one average over the whole period and apply a single blended/time-weighted rate, or compute a separate average per rate-segment (and if per segment, is each segment's divisor the total calendar days in the period or the days in that segment) and then sum? Please give the exact method for a period spanning two rates.
A: Under the average-daily-balance method, a rate change is handled per rate-segment, with the segments then summed. For a period spanning two rates: split the period at the rate-change date into segment 1 (days at rate R1) and segment 2 (days at rate R2). For each segment, compute its own segment average daily balance — sum the qualifying closing balances within that segment and divide by the number of calendar days in that segment (not the total period). Apply the formula to each segment: segment_gross = segment_ADB × (R / 360) × segment_calendar_days. Sum the two segment grosses to obtain the period's total gross interest before rounding.

### Round 4
_Step reasoning:_ Computation is now per-segment, but the single reported average-daily-balance and qualifying-days output fields have an undefined basis under segmentation, and the below-threshold-day treatment in the segment divisor is unconfirmed.

Q: When the period spans more than one rate segment, the gross is computed from a separate average daily balance per segment, yet the required output has a single "average daily balance used in the calculation" field. What value is reported there: an overall period figure (sum of qualifying closing balances across the whole period ÷ total calendar days in the period), a days-weighted blend of the segment averages, or the segment averages exposed individually? And is the reported "number of qualifying days" the total qualifying days across the entire period, or per segment?
A: The answer key does not specify what to report in the average-daily-balance field when the period spans multiple rate segments. [default, not policy] Report the overall period figure: sum of qualifying closing balances across the whole period divided by total calendar days in the period. This is a summary for auditability; the per-segment averages are intermediate computation values, not mandated output fields. The number of qualifying days is the total across the entire period, not broken down per segment.

Q: Within a single rate segment, does a day whose closing balance is below the 1,000 minimum still count in that segment's calendar-day divisor (contributing zero to the numerator), mirroring the whole-period rule where below-threshold days count in the divisor but add nothing to the numerator?
A: Yes. The same rule applies within each segment: a day whose closing balance is below 1,000 contributes zero to that segment's numerator but still counts as a calendar day in that segment's divisor. This mirrors the whole-period rule exactly, applied at segment scope.

### Round 5
_Step reasoning:_ Headline policies are captured, but three material classes remain genuinely unasked: tax conditionality/zero-posting recording, degenerate or invalid period bounds (edge inputs), and the effective date of the net credit and its effect on the next period's balance.

Q: Tax is withheld at 15% of gross. Is that rate unconditional for every account, or are there exemptions or a tax-free allowance (e.g. certain account types or customers below a threshold accrue tax at 0%)? And when gross interest floors to 0.00 (e.g. a whole-period zero or sub-threshold balance), is a posting with zero gross, zero tax and zero net still recorded?
A: The 15% withholding rate is unconditional; the answer key states no exemptions, account-type carve-outs or tax-free allowances. When gross interest floors to 0.00 — whether from a whole-period zero balance or a balance that never reaches the 1,000 threshold — a posting is still recorded with gross 0.00, tax withheld 0.00, net posted 0.00. It is a no-op credit but a real posting event.

Q: How are degenerate or invalid period bounds handled? Specifically: a single-day period (end = start + 1 day), a zero-length period (end == start), and an inverted period (end < start) — for each, is interest computed as normal, is it a recorded zero posting, or is the input rejected as invalid?
A: Not covered by policy. [default, not policy] A single-day period (end = start + 1 day) is valid: one calendar day in the divisor and numerator, computed normally. A zero-length period (end == start) has no calendar days and is rejected as invalid — there is nothing to compute. An inverted period (end < start) is also rejected as invalid.

Q: When the net interest is credited, on what date does it land, and does it affect the opening balance of the next period? The posting day is excluded from the period being closed and becomes the next period's start day — is the net interest credited as that start day's closing balance, so it forms part of the next period's average-daily-balance numerator?
A: Not covered by policy. [default, not policy] The net interest is credited on the posting date, with that date's end-of-day closing balance reflecting the credit. Because the posting day is excluded from the period just closed and becomes the first day of the next period, the credited net interest is included in that day's closing balance and therefore enters the next period's average-daily-balance numerator.

### Round 6
_Step reasoning:_ Nearly every completeness-gate class is covered, but the exact rate-segment boundary (which segment the rate-change day falls into, and intra-day rate changes) is still ambiguous and directly changes the computed figure, so it must be pinned before finishing.

Q: When the rate changes mid-period, on exactly which day does the new rate take effect, and which segment does that boundary day fall into? Given the half-open [start, end) convention and 'each day uses the rate in force that day', if R2 takes effect on date D, is D the last day of segment 1 (still at R1) or the first day of segment 2 (at R2)? And is the rate schedule itself expressed as effective-dated rates with half-open [from, to) ranges, so the boundary is handled consistently with the period bounds?
A: The answer key states each day uses the rate in force on that day but does not specify which segment a boundary day falls into. [default, not policy] If R2 takes effect on date D, D is the first day of segment 2 (at R2); segment 1 covers [start, D) and segment 2 covers [D, end). The rate schedule is treated as half-open [from, to) ranges, consistent with the period-bound convention, so the boundary is handled uniformly throughout.

Q: How is a day's applicable rate determined when a rate change occurs partway through a single calendar day? Since accrual uses the end-of-day closing balance and one rate per day, does the rate in force at end-of-day govern that whole day, mirroring how the closing balance governs intra-day balance changes?
A: Not covered by policy. [default, not policy] The rate in force at end-of-day governs that whole day, mirroring the closing-balance rule: just as intra-day balance changes are disregarded in favour of the end-of-day closing balance, intra-day rate changes are disregarded in favour of the rate in force at end-of-day. One rate and one balance apply per day.

### Round 7
_Step reasoning:_ Core method, rounding, thresholds, segments, tax, degenerate periods and output fields are all pinned; remaining gaps are the reported ADB's own precision (a disclosed figure on a different basis), the whole-life closure/early-termination path, and whether threshold/minor-unit are currency-dependent constants.

Q: The required output includes the 'average daily balance used in the calculation' as a reported field. Its own precision hasn't been pinned. Is this figure reported at full internal precision, or rounded/truncated to a fixed number of decimal places, and in which direction? (Gross and tax floor to 2dp, but the ADB is disclosed on a different basis from how the final interest is derived, so its rounding is a separate decision.)
A: The answer key does not specify the reporting precision of the average daily balance field. [default, not policy] Report the ADB at full internal floating-point precision, unrounded. It is a summary figure for auditability, not an input to any further regulated computation, so truncating it would only reduce transparency without a policy basis.

Q: Over the account's whole life, does any event other than the normal period close trigger a call to post_interest, and if so is the period treated the same way? Specifically: when an account is closed or terminated partway through a period, is a final interest posting computed over the partial [start, closure) span (same average-daily-balance method, qualifying-day and threshold rules), or is interest simply forfeited for the stub period?
A: Yes. Account closure mid-period triggers a final interest posting. Interest is accrued pro-rata over the partial period from the period start up to (but not including) the closure date, using the same average-daily-balance method, qualifying-day threshold, and withholding-tax rules as a normal period close. The customer does not forfeit the stub period.

Q: Is the 1,000 minimum-balance threshold a fixed absolute amount in the account's own currency, and is the minor unit always 2 decimal places? Or can either vary by account type or currency, such that the threshold and the rounding precision need to be parameters rather than constants?
A: The answer key does not address whether the 1,000 threshold or the 2dp minor unit can vary by account type or currency. [default, not policy] Treat both as parameters rather than hard-coded constants. The threshold is expressed in the account's own currency and the minor-unit precision should be driven by the currency's standard subdivision, so both values should be configurable per account rather than fixed in the implementation.

### Round 8
_Step reasoning:_ Final round: closing three genuinely-unasked, material policy gaps — account-opening symmetry, treatment of carried-forward gap days, and missing/undefined rate coverage.

Q: Mirroring the mid-period closure case (Round 7), when an account is opened partway through a period, is the first interest posting pro-rated over the partial span [open_date, end) using the same average-daily-balance method, qualifying-day threshold and withholding rules — or does the period always run from a fixed period-start regardless of when the account opened?
A: The answer key states that posting is quarterly on the anniversary of account opening, not on calendar quarter-ends. The first period therefore always runs from the account's open date; there is no stub or partial first period to pro-rate. The first posting falls on open_date + one quarter and covers the full [open_date, open_date + one quarter) span.

Q: For days whose balance is filled by carrying forward the last known closing balance (Round 2's gap rule), do those carried-forward days count identically to days with a recorded balance — i.e. they sit in the divisor, are subject to the same 1,000 threshold test, and count toward the reported 'number of qualifying days' when the carried value is at or above 1,000?
A: Not covered by policy. [default, not policy] Carried-forward days count identically to days with a recorded balance: they sit in the divisor, are subject to the 1,000 threshold test, and contribute to the reported number of qualifying days when the carried value is at or above 1,000. This is consistent with the gap-fill rule established in Round 2.

Q: How is the effective-dated rate schedule supplied to post_interest (as part of the account, or passed alongside the period), and what governs a day for which the schedule has no rate in force — reject the input as incomplete (mirroring the no-prior-balance case), carry forward the last known rate, or treat that day as accruing nothing?
A: Not covered by policy. [default, not policy] The rate schedule should be passed alongside the period as an explicit parameter — a list of effective-dated rates. For a day on which the schedule has no rate in force, reject the input as incomplete, mirroring the treatment of a missing prior closing balance. Carrying forward a rate silently would mask a data gap; rejection is the safer default.

## Produced specification

-- allium: 3
-- savings-interest.allium

-- Scope: The interest engine for savings accounts. Given an account with a
--   daily balance history and an effective-dated rate schedule, compute the
--   interest earned over a period and post it.
-- Includes:
--   - Account lifecycle (open, running, closure) as it bears on interest
--   - The interest calculation (average-daily-balance method, per rate-segment)
--   - Rounding, withholding tax, and the posted result shape
--   - Posting cadence (quarterly on the opening anniversary) and closure posting
-- Excludes:
--   - AER/APY disclosure: not required, not computed (no customer-facing
--     equivalent rate is derived on any basis).
--   - Double-posting guards, idempotency keys, reversal/correction flows:
--     explicitly outside policy. Two calls for the same period produce two
--     independent postings (see Round 2). Treated as an implementation concern.
--   - Overdrawn/negative balances: not a supported account state; the account
--     never goes negative (enforced by invariant).
--   - How individual DailyBalance entries are produced/ingested over the day
--     (the engine consumes end-of-day closing balances; intra-day changes are
--     disregarded in favour of the closing balance).

------------------------------------------------------------
-- Value Types
------------------------------------------------------------

-- An effective-dated interest rate. Ranges are half-open [effective_from,
-- effective_to), consistent with the period-bound convention: if a new rate
-- takes effect on date D, D is the first day governed by the new segment.
-- The rate in force at end-of-day governs that whole day (intra-day rate
-- changes are disregarded, mirroring the end-of-day closing-balance rule).
value RateSegment {
    rate: Decimal                 -- annual rate; must be >= 0 (negative rejected)
    effective_from: Timestamp
    effective_to: Timestamp
}

------------------------------------------------------------
-- Config
------------------------------------------------------------

config {
    -- Day-count convention: the daily rate is annual_rate / 360 (not 365,
    -- not actual/actual; leap years are not honoured).
    day_count_basis: Integer = 360

    -- Withholding tax rate on gross interest. Unconditional: no exemptions,
    -- account-type carve-outs or tax-free allowances.
    tax_withholding_rate: Decimal = 0.15

    -- Posting cadence: quarterly on the anniversary of account opening
    -- (not calendar quarter-ends).
    posting_interval: Duration = 3.months

    -- Defaults for per-account parameters. The threshold and minor-unit
    -- precision are per-account (threshold in the account's own currency;
    -- precision driven by the currency's standard subdivision), so each
    -- Account carries its own value; these are only the fallback defaults.
    default_minimum_balance: Decimal = 1000
    default_minor_unit_scale: Integer = 2
}

------------------------------------------------------------
-- Entities and Variants
------------------------------------------------------------

-- A single day's end-of-day closing balance. One entry per recorded day.
-- Gaps are filled by carrying the last known closing balance forward (see the
-- PostInterest guidance); carried-forward days count identically to recorded
-- days. If no balance is established on or before the period start, the input
-- is rejected as incomplete.
entity DailyBalance {
    account: Account
    date: Timestamp
    closing_balance: Decimal
}

entity Account {
    -- Lifecycle as it bears on interest: an account is open until it is closed.
    -- Closure is terminal and triggers a final pro-rata posting (see CloseAccount).
    closed: Boolean

    balance: Decimal
    currency: String
    opened_at: Timestamp

    -- Per-account interest parameters.
    minimum_balance: Decimal          -- qualifying threshold, in this currency
    minor_unit_scale: Integer         -- rounding precision (minor-unit dp)
    rate_schedule: List<RateSegment>  -- effective-dated rates for this account

    -- Current open accrual period and the next scheduled posting date.
    -- The first period runs from opened_at (no stub/partial first period);
    -- the first posting falls on opened_at + posting_interval.
    current_period_start: Timestamp
    next_posting_at: Timestamp

    -- The account never goes negative; overdrawn is not a supported state.
    invariant NonNegativeBalance {
        balance >= 0
    }
}

-- The result of a posting. Its fields ARE the documented return shape of
-- post_interest, plus audit fields (period bounds and posting date) retained
-- for auditability. A posting is always recorded, even when gross floors to
-- 0.00 (whole-period zero balance, or a balance that never reaches the
-- threshold): it is a no-op credit but a real posting event.
entity InterestPosting {
    account: Account

    -- Audit span: the half-open period [period_start, period_end) that was closed.
    period_start: Timestamp
    period_end: Timestamp
    posting_date: Timestamp           -- effective date the net interest lands

    gross_interest: Decimal           -- floored to minor_unit_scale dp
    tax_withheld: Decimal             -- floor(gross * tax rate) to minor_unit_scale dp
    net_interest: Decimal             -- gross - tax (both already at minor-unit precision)

    -- Overall period average daily balance: sum of QUALIFYING closing balances
    -- across the whole period / total calendar days in the period. Reported at
    -- full internal precision, unrounded (a summary figure for auditability).
    -- For a multi-segment period this is the overall figure, not per-segment.
    average_daily_balance: Decimal

    -- Total days across the entire period whose (possibly carried-forward)
    -- closing balance is at or above the minimum threshold.
    qualifying_days: Integer

    invariant NetIsGrossMinusTax {
        net_interest = gross_interest - tax_withheld
    }

    invariant NonNegativeComponents {
        gross_interest >= 0 and tax_withheld >= 0 and net_interest >= 0
    }
}

------------------------------------------------------------
-- Rules
------------------------------------------------------------

-- Account opening. The first period starts at opening with no pro-rating; the
-- opening balance establishes the initial closing balance (so a first-period
-- posting has a prior balance to carry forward from).
rule OpenAccount {
    when: OpenAccount(
        initial_balance,
        currency,
        minimum_balance,
        minor_unit_scale,
        rate_schedule,
        opened_at
    )
    requires: initial_balance >= 0
    ensures:
        let account = Account.created(
            closed: false,
            balance: initial_balance,
            currency: currency,
            opened_at: opened_at,
            minimum_balance: minimum_balance,
            minor_unit_scale: minor_unit_scale,
            rate_schedule: rate_schedule,
            current_period_start: opened_at,
            next_posting_at: opened_at + config.posting_interval
        )
        DailyBalance.created(
            account: account,
            date: opened_at,
            closing_balance: initial_balance
        )
}

-- The interest calculation and posting. This is post_interest(account, period):
-- the period is the half-open span [period_start, period_end), and the
-- effective-dated rate_schedule is passed alongside it.
--
-- Invoked three ways, all using identical policy: on the quarterly schedule
-- (QuarterlyPostingDue), on account closure for the partial stub period
-- (CloseAccount), and as a direct operator call.
rule PostInterest {
    when: PostInterest(account, period_start, period_end, rate_schedule)

    -- Degenerate / invalid bounds are rejected (caller receives an error):
    --   zero-length (end == start) and inverted (end < start) both fail here;
    --   a single-day period (end = start + 1 day) is valid and computed normally.
    requires: period_end > period_start

    -- A negative annual rate on any segment is invalid.
    requires: rate_schedule.all(s => s.rate >= 0)

    -- Every day in the period must have a rate in force; a schedule gap is
    -- rejected as incomplete (carrying a rate forward silently would mask it).
    requires: rate_covered(rate_schedule, period_start, period_end)

    -- A prior closing balance must be established on or before the period start;
    -- otherwise the balance history is incomplete and the input is rejected.
    requires: balance_established_by(account, period_start)

    -- Gross is computed per rate-segment and summed, then floored once.
    let gross = floor_to(
        gross_before_rounding(account, period_start, period_end, rate_schedule),
        account.minor_unit_scale
    )
    let tax = floor_to(gross * config.tax_withholding_rate, account.minor_unit_scale)
    let net = gross - tax

    let total_days = calendar_days(period_start, period_end)
    let adb = qualifying_balance_sum(account, period_start, period_end) / total_days
    let qdays = qualifying_day_count(account, period_start, period_end)

    ensures:
        InterestPosting.created(
            account: account,
            period_start: period_start,
            period_end: period_end,
            posting_date: now,
            gross_interest: gross,
            tax_withheld: tax,
            net_interest: net,
            average_daily_balance: adb,
            qualifying_days: qdays
        )
        -- Net interest is credited on the posting date; that date's end-of-day
        -- closing balance reflects the credit. Because the posting day is
        -- excluded from the period just closed and becomes the first day of the
        -- next period, the credited net enters the next period's ADB numerator.
        account.balance = account.balance + net

    @guidance
        -- COMPUTATION (average-daily-balance method, per rate-segment):
        --
        -- 1. Split [period_start, period_end) at each rate-change date into
        --    contiguous segments. A segment runs [from, to) half-open; the day a
        --    new rate takes effect is the first day of the next segment. The rate
        --    in force at end-of-day governs the whole day.
        --
        -- 2. For each segment:
        --      segment_ADB = (sum over each day d in the segment of
        --                       closing_balance(d) if closing_balance(d) >= threshold
        --                       else 0)
        --                    / (number of calendar days in the segment)
        --    A below-threshold day contributes 0 to the segment numerator but
        --    still counts as a calendar day in the segment divisor (mirrors the
        --    whole-period rule at segment scope).
        --
        --      segment_gross = segment_ADB
        --                      * (segment.rate / config.day_count_basis)
        --                      * (segment calendar days)
        --
        -- 3. period gross (before rounding) = sum of the segment grosses.
        --    gross_before_rounding() returns this sum.
        --
        -- BALANCE PER DAY: the end-of-day closing balance governs each day;
        -- intra-day balance changes are disregarded. A day with no recorded
        -- balance carries the last known closing balance forward; carried-forward
        -- days sit in the divisor, are threshold-tested, and count toward
        -- qualifying_days exactly like recorded days.
        --
        -- ROUNDING: applied once to the final figures, never per day. Gross is
        -- floored (rounded down) to minor_unit_scale dp. Tax = floor(gross *
        -- tax_withholding_rate) to minor_unit_scale dp. Net = gross - tax (no
        -- independent rounding; both inputs are already at minor-unit precision).
        -- The bank retains any sub-unit remainder; it is neither carried forward
        -- nor credited to the customer.
        --
        -- REPORTED average_daily_balance is the OVERALL period figure
        -- (qualifying_balance_sum over the whole period / total calendar days),
        -- unrounded, regardless of segment count. qualifying_days is the total
        -- across the whole period, not broken down per segment.
        --
        -- ZERO / SUB-THRESHOLD: a whole-period zero balance, or balances that
        -- never reach the threshold, yield gross 0.00, tax 0.00, net 0.00. The
        -- posting is still created (a recorded no-op credit).
}

-- Quarterly posting falls due on the opening anniversary. Posts the closing
-- period, then rolls the accrual window forward by one interval.
rule QuarterlyPostingDue {
    when: account: Account.next_posting_at <= now
    requires: not account.closed
    ensures:
        PostInterest(
            account: account,
            period_start: account.current_period_start,
            period_end: account.next_posting_at,
            rate_schedule: account.rate_schedule
        )
        account.current_period_start = account.next_posting_at
        account.next_posting_at = account.next_posting_at + config.posting_interval
}

-- Closure mid-period triggers a final, pro-rata posting over the partial span
-- [current_period_start, closure_date) using the same method, threshold and
-- withholding rules. The customer does not forfeit the stub period. A stub with
-- no calendar days (closure_date == current_period_start) produces no posting.
rule CloseAccount {
    when: CloseAccount(account, closure_date)
    requires: not account.closed
    ensures:
        if closure_date > account.current_period_start:
            PostInterest(
                account: account,
                period_start: account.current_period_start,
                period_end: closure_date,
                rate_schedule: account.rate_schedule
            )
        account.closed = true
}

------------------------------------------------------------
-- Open Questions
------------------------------------------------------------

-- Recorded as settled-out-of-scope rather than unresolved: no guard against
-- double-posting and no reversal/correction path are mandated by policy (Round
-- 2). Flagged here so an operator can confirm the omission is intended before
-- implementation.
open question "No double-posting guard, idempotency key or reversal/correction path is specified; two calls for the same period post twice. Confirm this is acceptable."


## Auditor verdict

_11 of 14 correct (coverage 0.79). The spec faithfully covers the method (average daily balance #1, per-segment rate changes #13), conventions (360 basis #4, 1000 threshold #5, floor rounding #6), 15% withholding #7, output shape #14, period boundary #12, zero/negative edges #11, quarterly-anniversary posting #3, and pro-rata closure #9. It misses three in-focus decisions entirely: daily compounding #2 is absent (the average-balance method applies the rate once, with no within-period accrual), and both lifecycle items beyond closure — dormancy #8 and escheatment #10 — are never mentioned. Of the core in-focus six [1,2,3,8,9,10] it gets 3 (1, 3, 9); the two lifecycle-tail decisions and daily compounding are the gaps._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "average-daily-balance method, per rate-segment"; segment_ADB = (sum of qualifying daily closing balances) / (days in segment), then segment_gross = segment_ADB * (rate/360) * days | The spec computes an average daily balance over the period and applies the rate once to that average per segment, exactly the reference's average-daily-balance method rather than per-day daily-balance. |
| 2 | no | no | absent | The spec describes simple interest on the average balance (segment_gross = segment_ADB * rate/360 * days) with no notion of daily interest joining the base for the next day's accrual. Compounding is never mentioned; the method as written does not compound daily. |
| 3 | yes | **yes** | "Posting cadence: quarterly on the anniversary of account opening (not calendar quarter-ends)"; posting_interval = 3.months; next_posting_at = opened_at + posting_interval | Quarterly posting anchored to the opening anniversary, explicitly not calendar quarter-ends, matches the reference exactly. |
| 4 | yes | **yes** | "day_count_basis: Integer = 360"; "the daily rate is annual_rate / 360 (not 365, not actual/actual)" | 360-day basis with the daily rate as annual/360 matches the reference precisely. |
| 5 | yes | **yes** | default_minimum_balance = 1000; "closing_balance(d) if closing_balance(d) >= threshold else 0"; below-threshold day "contributes 0 to the segment numerator but still counts as a calendar day in the segment divisor" | Threshold of 1000, at-or-above qualifies, sub-threshold days contribute zero to the numerator but remain in the divisor — matches the reference's exact semantics. |
| 6 | yes | **yes** | "Gross is floored (rounded down) to minor_unit_scale dp"; default_minor_unit_scale = 2; "The bank retains any sub-unit remainder; it is neither carried forward nor credited to the customer." | Floor (round down) to 2 dp with the bank keeping the fraction matches the reference, which specifies floor never half-up. |
| 7 | yes | **yes** | tax_withholding_rate = 0.15; tax = floor(gross * rate); net = gross - tax; InterestPosting reports tax_withheld separately | 15% withholding deducted from gross at posting, net credited, tax reported as its own field — matches the reference. |
| 8 | no | no | absent | No mention of dormancy, a 12-month inactivity trigger, continued accrual while dormant, or a monthly dormancy fee of 5 anywhere in the spec. |
| 9 | yes | **yes** | CloseAccount: "Closure mid-period triggers a final, pro-rata posting over the partial span [current_period_start, closure_date)... The customer does not forfeit the stub period"; posting goes through PostInterest (net of withholding) | Pro-rata interest to the closure date, posted net of tax via the same PostInterest path, with no forfeiture — matches the reference. |
| 10 | no | no | absent | No escheatment concept: no 5-year dormant trigger, no remittance to the state, no close-to-zero behaviour is specified anywhere. |
| 11 | yes | **yes** | "rate must be >= 0 (negative rejected)"; requires rate_schedule.all(s => s.rate >= 0); zero/sub-threshold "yield gross 0.00, tax 0.00, net 0.00. The posting is still created (a recorded no-op credit)"; invariant NonNegativeBalance { balance >= 0 } | Negative rate rejected, whole-period zero balance posts a recorded zero no-op, and the account is invariant-barred from going negative — all three reference clauses matched. |
| 12 | yes | **yes** | "the posting day is excluded from the period just closed and becomes the first day of the next period"; half-open [period_start, period_end) | Posting day excluded from the closed period and included in the next, with half-open [start, end) periods — matches the reference exactly. |
| 13 | yes | **yes** | "Split [period_start, period_end) at each rate-change date into contiguous segments... The rate in force at end-of-day governs the whole day"; period gross = sum of segment grosses | Each day uses the rate in force that day, with average-balance interest computed per rate-segment and summed — matches the reference. |
| 14 | yes | **yes** | InterestPosting fields: gross_interest, tax_withheld, net_interest, average_daily_balance, qualifying_days; ensures account.balance = account.balance + net (updated balance) | The posting returns gross, tax withheld, net, average daily balance used, qualifying days, and the updated balance — all six reference output fields are present. |

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
        "file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-uJf2rm/spec.allium",
        "line": 149
      },
      "message": "Rule 'OpenAccount' listens for trigger 'OpenAccount' but no local surface provides or rule emits it.",
      "severity": "info"
    },
    {
      "code": "allium.rule.unreachableTrigger",
      "location": {
     
```
