# allium-elicit — savings-interest — iteration 1

Model (author): claude-opus · Questions asked: 28 · Captured: 12/14 · Bespoke captured: 8/10

## Conversation

### Round 1
_Step reasoning:_ No questions asked yet; the brief omits every material interest-computation policy (method, day-count, balance basis, rounding, rate structure, result shape, edge cases), so I must elicit these core decisions before specifying.

Q: Interest method: is this simple interest on the balance, or compound? If compound, at what frequency is interest capitalised (daily, monthly, at period end)?
A: Compound interest, capitalised daily. Each day's accrued interest joins the principal before the next day's accrual within the period.

Q: Day-count convention: how is the daily rate derived from the annual rate, actual/365, actual/360, 30/360, or actual/actual (i.e. 366 in leap years)? Which convention does this institution use?
A: Actual/360. The daily rate is annual_rate / 360. Leap years do not change the divisor.

Q: For each day, which balance figure is used to accrue interest, the start-of-day balance, the end-of-day balance, or something else, and how is a day with multiple transactions treated?
A: The average daily balance method is used: each day contributes one balance figure to the sum that is then divided by the number of days in the period. For a day with multiple transactions, [default, not policy] end-of-day balance is the standard ADB convention and should be used unless you have a reason to diverge.

Q: Are the period's start and end dates both inclusive, or is one end exclusive? How is the accrual for the first and last day of the period handled?
A: Half-open interval [start, end). The start date is inclusive; the posting day is exclusive — it is excluded from the period it closes and included in the next period. The first day of the period is fully accrued; the posting day itself is not.

Q: Rounding: to what precision is interest computed and posted (e.g. whole cents), which direction does it round (up, down, half-up, banker's rounding), and where does any sub-unit remainder go, carried to the next period, dropped, or added on?
A: Floored to 2 decimal places (minor unit). Never half-up. The sub-unit remainder is dropped — the bank retains it. It is not carried forward to the next period.

Q: Is the annual rate a single flat rate for the whole balance, or is it tiered/banded by balance level? Can the rate change partway through the period, and if so does the accrual switch on the effective date?
A: A single flat rate applies to the full balance on each day. If the rate changes mid-period, each day uses the rate in force on that day; accrual is computed per rate-segment and summed. Tiered or banded rates by balance level are [default, not policy] not specified — assume a flat rate on the full balance.

Q: How are non-positive daily balances treated, is interest accrued on a zero balance (nil), and for negative balances is interest zero, excluded, or is a separate debit/overdraft rate applied?
A: Zero balance for the whole period posts zero interest (a no-op that still records a zero posting). Days below the 1,000 minimum balance threshold contribute zero to accrual but still count in the divisor. Negative balances do not occur — the account never goes negative. A negative rate is rejected as invalid.

Q: What does post_interest return exactly, field by field, the interest amount, the updated balance, currency and precision, and does 'posting' itself add the interest to the balance (so the returned balance already includes it) with a specific effective/value date?
A: Returns per posting: gross_interest, tax_withheld (15% of gross), net_interest_posted (gross minus tax withheld), average_daily_balance, qualifying_days (days at or above the 1,000 threshold), and updated_balance. Posting credits the net interest to the account; the returned balance already includes it. Precision is 2 decimal places. Value/effective date is [default, not policy] the posting run date.

Q: What is the effective date of the posted interest, the last day of the period, the first day of the next, or the posting run date, and does this differ from the date the accrual is computed as of?
A: The posting date is the quarterly anniversary of account opening. The accrual covers up to but not including that date (half-open period). The key does not distinguish the effective date from the posting run date — [default, not policy] treat them as the same date.

Q: Edge inputs: how should the function behave when the balance history is empty, has gaps (missing days), or the period is zero-length, reject, treat missing days as carrying the last known balance, or treat as zero?
A: Zero-length period: posts zero interest — a no-op that still records a zero posting. Empty balance history or gaps: [default, not policy] carry the last known balance forward (standard ADB convention); if no prior balance exists at all, treat as zero for those days.

### Round 2
_Step reasoning:_ The method answers contain an unresolved contradiction (daily compounding vs average daily balance) plus unpinned tax/net rounding and the base balance for crediting; these must be reconciled before the whole-life class is even reached.

Q: The answers so far give two different methods that don't obviously combine. 'Compound interest, capitalised daily, each day's accrued interest joins the principal before the next day's accrual' describes daily compounding on a running balance. But the balance-figure answer describes the average daily balance method: sum each day's balance, divide by the number of days, apply the rate once. These are distinct methods that produce different numbers. Which one actually governs gross interest? Concretely: is gross_interest = average_daily_balance x (annual_rate/360) x day_count (no compounding), or is it genuinely compounded day by day on a growing principal (in which case what is average_daily_balance in the return, a reported figure only)?
A: The average daily balance method governs. Rule 1 is explicit: sum the daily balances over the period, divide by days in the period, apply the rate once to that average — not per-day. The round-1 'compound daily' answer was a misstatement. Gross interest = ADB × (annual_rate / 360) × total_days_in_period. Average_daily_balance in the return is the figure actually used in the computation, not a side-reported figure.

Q: If the average daily balance method governs: which day count multiplies the ADB to get gross interest, the total days in the period (the same divisor used to form the ADB) or only the qualifying_days at or above 1,000? And when the rate changes mid-period and accrual is 'computed per rate-segment and summed', is a separate ADB formed for each rate segment over that segment's days, or is one whole-period ADB formed and then apportioned across segments?
A: The same total days in the period that form the ADB divisor are used as the day-count multiplier in the interest formula (they cancel algebraically, so the effective computation is sum-of-qualifying-day-balances × daily_rate, but the conceptual structure is ADB × rate × total_days). Qualifying_days is a reported count only; it does not replace the total-day multiplier. For mid-period rate changes, a separate ADB is formed for each rate segment over that segment's days, interest is computed per segment and the results are summed.

Q: Tax and net precision: is tax_withheld = 15% taken from gross before or after gross_interest is floored to 2 decimal places? Is tax_withheld itself floored (or otherwise rounded) to 2 decimal places, and in which direction? And is net_interest_posted exactly gross_interest minus tax_withheld, or is it independently floored (so gross, tax and net might not reconcile to the cent)?
A: The key specifies that posted interest is floored to 2 dp (rule 6) and that 15% tax is deducted from gross (rule 7), but does not specify the ordering or rounding of tax_withheld itself. [default, not policy]: floor gross to 2 dp first, then compute tax_withheld = floor(gross_floored × 0.15, 2 dp), then net_interest_posted = gross_floored − tax_withheld. Net is derived rather than independently floored, so the three figures reconcile exactly.

Q: updated_balance: the net interest is credited to which balance figure, the account's end-of-period (posting-date) balance, or its live balance at the time the posting run executes, if those differ?
A: The key does not distinguish end-of-period balance from live balance at posting run time. [default, not policy]: net interest is credited to the account's balance as it stands at the moment the posting runs on the quarterly anniversary date. If a same-day transaction has already moved the balance before the posting run executes, the credit applies to the post-transaction balance.

### Round 3
_Step reasoning:_ Main computation is pinned, but whole-life events (re-run idempotency, back-dated corrections to a posted period, reversal) and invalid-input signalling remain unasked.

Q: Idempotency: if post_interest runs more than once for the same period (e.g. a retried or duplicated posting run on the quarterly anniversary), does it post interest again each time, or is a period that has already been posted treated as a no-op that returns the existing posting?
A: [default, not policy] A period already posted should be treated as a no-op: the function detects an existing posting record for that period and returns it without crediting the account again. Duplicate runs on the same quarterly anniversary must not double-credit interest.

Q: Back-dated or corrected transactions: if a transaction with a value date inside an already-posted period arrives after that period's interest has been posted, does a later run recompute and adjust the prior period's interest, or is a closed period immutable and the correction only affects future accrual?
A: [default, not policy] Closed periods are immutable. A back-dated or corrected transaction with a value date inside an already-posted period does not trigger recomputation of that period's interest. The correction affects only the current open period's accrual from the transaction's value date onward.

Q: Reversal: is there a way to reverse or void a posting made in error, and if so does the reversal restore the account balance and reclaim the 15% tax_withheld, or is reversal out of scope for this function?
A: [default, not policy] Reversal is out of scope for post_interest. Voiding an erroneous posting, restoring the balance, and reclaiming tax withheld should be handled by a separate reversal or adjustment mechanism; post_interest itself has no reversal path.

Q: Invalid inputs: how is a rejected input (e.g. a negative annual rate) surfaced to the caller, as a raised error/exception or as a returned status field? And is a zero annual rate valid (posting zero interest) or also rejected?
A: A negative annual rate is rejected as invalid (rule 11). A zero annual rate is not explicitly rejected — by analogy with a zero-balance period it produces a zero-interest posting, which is valid. [default, not policy] Invalid inputs are surfaced by raising an error or exception rather than via a returned status field.

### Round 4
_Step reasoning:_ Main computation, edge inputs, tax, idempotency, corrections and reversal are all settled, but the account's own whole-life events (closure/early termination and dormancy/suspension) and the currency of the returned figures remain unasked.

Q: Account closure / early termination: if an account is closed or the customer withdraws all funds and terminates it partway through a quarter, before its quarterly-anniversary posting date, is a final pro-rata interest posting made for the partial period (from the last anniversary up to the closure date, using the same half-open ADB, Actual/360, floor-and-15%-tax machinery), or is the accrued-but-unposted interest forfeited and nothing posted on closure?
A: On closure between posting dates, a final pro-rata interest posting is made covering the period from the last anniversary up to but not including the closure date, using the same half-open ADB, Actual/360, floor-to-2-dp, 15%-withholding machinery. The customer does not forfeit the partial period's accrued interest; it is posted as part of the closing process.

Q: Account dormancy / suspension: can a savings account be frozen, suspended, or flagged dormant, and if so does interest continue to accrue and post normally during that state, accrue but hold the posting, or stop accruing entirely for the days the account is in that state?
A: After 12 months with no customer-initiated transaction the account becomes dormant. While dormant, interest continues to accrue normally. A monthly dormancy fee of 5 is charged during dormancy. Posting continues on the usual quarterly-anniversary schedule; interest is not held or suspended.

Q: Currency: is this a single-currency system with one implied minor unit, or must post_interest's return carry an explicit currency for each amount? And can a single account's balance history span more than one currency, or is one account always exactly one currency?
A: [default, not policy] Single-currency system with one implied minor unit; post_interest's return does not need to carry an explicit currency code. One account is always exactly one currency; a balance history spanning more than one currency is not a supported scenario.

### Round 5
_Step reasoning:_ The dormancy fee introduced in round 4 is a live, material thread: whether post_interest applies it, whether it feeds the ADB, and how it interacts with the threshold all change the computed result and updated_balance, and none of it has been put to the stakeholder.

Q: Round 4 introduced a monthly dormancy fee of 5 charged while an account is dormant. Two things are unresolved: (a) Is that fee applied by post_interest itself (deducted as part of the posting run, affecting updated_balance and possibly appearing as a return field), or is it charged by a separate fee mechanism outside post_interest's scope, as reversal is? (b) Since the fee moves the balance, do the fee debits appear in the daily balance history and therefore reduce the daily balances that feed the ADB accrual, or is accrual computed on balances gross of the dormancy fee?
A: The answer key does not assign the dormancy fee to post_interest. [default, not policy] The monthly dormancy fee of 5 is charged by a separate fee mechanism outside post_interest's scope, consistent with how reversal is treated. Post_interest's return fields and updated_balance do not include or reflect the dormancy fee directly. Because the fee is a real debit transaction posted to the account by that separate mechanism, it does appear in the daily balance history; the resulting lower end-of-day balances feed into the ADB calculation for any period in which the fee was charged.

Q: How does the dormancy fee interact with the 1,000 minimum-balance threshold and qualifying_days, if at all, i.e. can a fee debit push a day below 1,000 and thereby drop it from qualifying_days, or is the fee irrelevant to the qualifying-day count?
A: The answer key does not address this interaction explicitly. [default, not policy] Because fee debits are real transactions that reduce the end-of-day balance, a dormancy fee debit can push a day's balance below 1,000. If it does, that day contributes zero to accrual and is excluded from qualifying_days, exactly as any other sub-threshold day would be. The fee receives no special treatment relative to the minimum-balance threshold.

### Round 6
_Step reasoning:_ Multi-segment rate changes leave two genuine gaps a model can't infer: the order of per-segment flooring/tax, and which ADB/qualifying-day figures populate the single-valued return fields.

Q: When the rate changes mid-period and gross interest is computed per rate-segment and summed, at what point is the floor-to-2-dp and the 15% tax applied? Concretely: is each segment's interest floored to 2 dp and then summed (so each segment drops its own sub-cent remainder), or are the raw segment interests summed and the floor applied once to the total? And is tax_withheld = floor(0.15 x total_gross_floored) computed once on the combined gross, or per segment and summed?
A: The answer key specifies that posted interest is floored to 2 dp (rule 6) and tax deducted from gross at 'each posting' (rule 7), treating a posting as a single event. It does not address per-segment flooring explicitly. [default, not policy] Sum the raw (unrounded) segment interests first, then apply floor-to-2-dp once to the combined total to produce gross_interest. Tax is then computed once on that combined gross_floored figure: tax_withheld = floor(0.15 × gross_floored, 2 dp). This avoids accumulating multiple sub-cent losses and is consistent with 'each posting' being a single operation.

Q: The return has a single average_daily_balance field, but for a multi-segment period a separate ADB is formed per segment. Which figure populates the returned average_daily_balance in that case, a single whole-period ADB (sum of all daily balances / total days), or something else? And is qualifying_days simply the total count of at-or-above-1,000 days across the whole period regardless of segments?
A: The answer key does not specify which ADB figure to return for a multi-segment period. [default, not policy] Return a single whole-period ADB computed as the sum of all daily end-of-day balances across the entire period divided by the total number of days in the period, regardless of segment boundaries. This is the most interpretable summary figure for the caller. qualifying_days is the total count of at-or-above-1,000 days across the whole period, with no segmentation applied.

### Round 7
_Step reasoning:_ One material contradiction remains between the Round 1/2 accrual-basis ADB and the Round 6 all-balances ADB; every other decision class in the completeness gate has been answered or explicitly scoped out, so this is the last open item.

Q: There is an unresolved conflict in how the returned average_daily_balance is defined for a period containing sub-threshold days. Round 1 established that days below the 1,000 minimum contribute zero to the accrual sum but still count in the divisor, and Round 2 established that the returned average_daily_balance is 'the figure actually used in the computation, not a side-reported figure' — which implies sub-threshold days are entered as zero in its numerator. But Round 6 defined the returned figure as 'the sum of all daily end-of-day balances across the entire period divided by total days', which would include sub-threshold days at their actual (non-zero) balance. These give different numbers whenever any day falls below 1,000. Which governs the returned average_daily_balance: the accrual ADB (sub-threshold days zeroed in the numerator, so it reconciles exactly with gross_interest = ADB × daily_rate × total_days), or the true arithmetic mean of every day's actual end-of-day balance (which will not reconcile with gross when sub-threshold days exist)?
A: The accrual ADB governs. Rule 14 specifies 'the average daily balance used', and Round 2 is explicit that the returned figure is the one actually used in the computation, not a side-reported figure. Sub-threshold days contribute zero to the numerator; the divisor remains total days in the period. The Round 6 default (sum of actual end-of-day balances) conflicts with both the key and the Round 2 ruling and does not apply. The returned average_daily_balance will therefore reconcile exactly with gross_interest = ADB × (annual_rate / 360) × total_days.

### Round 8
_Step reasoning:_ Every major policy class is resolved; the only genuinely material items still unasked are the first-period boundary for a new/same-quarter account and how mid-period rate history is supplied, both of which affect correctness and this is the final round.

Q: First-period boundary for a newly opened account: does the very first accrual period run from the account opening date (inclusive) up to but not including the first quarterly anniversary, using the same half-open ADB machinery? And if the account is opened and closed within a single quarter (before any anniversary), is a pro-rata posting made from opening to closure exactly as with mid-quarter closure?
A: Yes. The first accrual period runs from the account opening date (inclusive) up to but not including the first quarterly anniversary, using the same half-open [start, end) ADB machinery as every subsequent period. If the account is opened and closed before any quarterly anniversary has occurred, rule 9 applies without modification: a pro-rata posting is made covering the period from opening date (inclusive) to closure date (exclusive), using the standard ADB, Actual/360, floor-to-2-dp, 15%-withholding machinery. The customer does not forfeit the partial period's accrued interest.

Q: Rate-change input shape: since gross interest is computed per rate-segment when the rate changes mid-period, how does the rate history reach the function, is it carried on the account argument (a schedule of effective-dated rates that post_interest reads), or is a single annual_rate passed per call with segmentation handled by the caller invoking post_interest once per segment?
A: The answer key specifies per-segment computation (rule 13) but does not define the input shape. [default, not policy] The rate history is carried as a schedule of effective-dated rates on the account argument; post_interest reads that schedule internally to identify segment boundaries and form a separate ADB per segment. The caller passes one period and one account; it does not invoke post_interest once per rate segment.

## Produced specification

-- allium: 3

--
-- Savings account interest posting.
--
-- Specifies post_interest: for a savings account and a half-open accrual period
-- it forms an average daily balance, applies the Actual/360 day count and the
-- rate(s) in force, floors to the minor unit, withholds tax, and credits the net
-- interest to the account. The average daily balance method governs the whole
-- computation; there is no day-by-day compounding.
--
-- Amounts are Decimal in the single implied currency and minor unit. Dates are
-- Timestamps interpreted as calendar days.
--

config {
    day_count_divisor: Integer = 360        -- Actual/360; leap years do not change it
    minimum_balance_threshold: Decimal = 1000 -- days below this contribute zero to accrual
    tax_rate: Decimal = 0.15                -- withholding tax deducted from gross interest
    minor_unit_dp: Integer = 2             -- posting precision, 2 decimal places
    posting_interval: Duration = 3.months   -- quarterly, on the account's opening anniversary
    dormancy_threshold: Duration = 12.months -- inactivity before an account becomes dormant
    dormancy_fee: Decimal = 5               -- monthly; charged outside post_interest
}

entity Account {
    opening_date: Timestamp
    status: active | dormant | closed
    balance: Decimal                               -- live balance, 2 dp; never negative
    last_activity_at: Timestamp                    -- last customer-initiated transaction

    rate_schedule: RateChange with account = this  -- effective-dated rates, read for segments
    balance_history: DailyBalance with account = this
    postings: InterestPosting with account = this

    transitions status {
        active -> dormant
        dormant -> active
        active -> closed
        dormant -> closed
        terminal: closed
    }
}

entity RateChange {
    account: Account
    effective_date: Timestamp       -- rate is in force from this date
    annual_rate: Decimal            -- a negative rate is invalid; zero is valid
}

entity DailyBalance {
    account: Account
    date: Timestamp
    end_of_day_balance: Decimal     -- end-of-day figure; includes any fee debits posted that day

    qualifies: end_of_day_balance >= config.minimum_balance_threshold
}

entity InterestPosting {
    account: Account
    period_start: Timestamp         -- inclusive
    period_end: Timestamp          -- exclusive; the posting date
    posting_date: Timestamp        -- effective/value date; equals period_end and the run date
    total_days: Integer            -- calendar days in [period_start, period_end)
    gross_interest: Decimal
    tax_withheld: Decimal
    net_interest_posted: Decimal
    average_daily_balance: Decimal  -- accrual ADB actually used; sub-threshold days zeroed
    qualifying_days: Integer        -- days at or above the threshold (reported count only)
    updated_balance: Decimal        -- balance after the net credit
}

invariant BalanceNeverNegative {
    for account in Accounts:
        account.balance >= 0
}

invariant AccountAlwaysHasARate {
    for account in Accounts:
        account.rate_schedule.count >= 1
}

invariant NonNegativeRates {
    for change in RateChanges:
        change.annual_rate >= 0
}

invariant RateChangesFollowOpening {
    for change in RateChanges:
        change.effective_date >= change.account.opening_date
}

invariant PostingsStartWithinAccountLife {
    for posting in InterestPostings:
        posting.period_start >= posting.account.opening_date
}

invariant NetReconciles {
    for posting in InterestPostings:
        posting.net_interest_posted = posting.gross_interest - posting.tax_withheld
}

rule AccountOpens {
    when: OpenAccount(opening_date, opening_balance)
    ensures:
        Account.created(
            opening_date: opening_date,
            status: active,
            balance: opening_balance,
            last_activity_at: opening_date
        )
}

rule ReactivateOnActivity {
    when: CustomerTransacts(account)
    requires: account.status = dormant
    ensures: account.status = active
    ensures: account.last_activity_at = now
}

rule AccountBecomesDormant {
    when: account: Account.last_activity_at <= now - config.dormancy_threshold
    requires: account.status = active
    ensures: account.status = dormant
    @guidance
        -- Dormancy begins after 12 months with no customer-initiated transaction.
        -- Interest keeps accruing and posts on the usual quarterly schedule while
        -- dormant; it is not held or suspended. The monthly dormancy fee of 5 is
        -- charged by a separate fee mechanism, not by post_interest.
}

rule AccountCloses {
    when: CloseAccount(account)
    requires: account.status != closed
    ensures: account.status = closed
    @guidance
        -- Closing an account triggers a final pro-rata interest posting for the
        -- period from the last anniversary up to but not including the closure date,
        -- computed with the same machinery (see the ClosurePosting guarantee). The
        -- customer does not forfeit the partial period's accrued interest.
}

rule PostInterestForPeriod {
    when: PostInterest(account, period_start, period_end)
    requires: account.status != closed
    requires: not account.postings.any(p => p.period_end = period_end)
    let period_days = account.balance_history where date >= period_start and date < period_end
    let total_days = period_days.count
    let qualifying_days = (period_days where qualifies).count
    ensures:
        InterestPosting.created(
            account: account,
            period_start: period_start,
            period_end: period_end,
            posting_date: period_end,
            total_days: total_days,
            qualifying_days: qualifying_days
        )
    @guidance
        -- The money fields (gross_interest, tax_withheld, net_interest_posted and
        -- average_daily_balance) are computed exactly as set out by the guarantees
        -- on the InterestPostingBoundary surface. A run for a period that already
        -- has a posting is a no-op: it returns the existing posting and does not
        -- credit the account again.
}

rule CreditNetInterest {
    when: posting: InterestPosting.created
    ensures: posting.updated_balance = posting.account.balance + posting.net_interest_posted
    ensures: posting.account.balance = posting.account.balance + posting.net_interest_posted
    @guidance
        -- Net interest is credited to the balance as it stands when the posting run
        -- executes, so a same-day transaction that has already moved the balance is
        -- reflected. The returned updated_balance already includes the credit. This
        -- rule fires for every posting, including the pro-rata closure and first
        -- period postings.
}

surface InterestPostingBoundary {
    facing acct: Account

    context posting: InterestPosting where account = acct

    exposes:
        posting.gross_interest
        posting.tax_withheld
        posting.net_interest_posted
        posting.average_daily_balance
        posting.qualifying_days
        posting.updated_balance

    provides:
        PostInterest(acct, period_start, period_end)
            when acct.status != closed

    @guarantee AverageDailyBalanceMethod
        -- The average daily balance method governs. Sum the daily balances over the
        -- period, divide by the total days in the period to form the ADB, and apply
        -- the rate once: gross = ADB x (annual_rate / 360) x total_days. There is no
        -- day-by-day compounding. The total-day multiplier is the same total days
        -- that form the ADB divisor, so it cancels and the effective computation is
        -- the sum of qualifying-day balances x daily_rate.

    @guarantee DayCountConvention
        -- Actual/360. The daily rate is annual_rate / 360. Leap years do not change
        -- the divisor.

    @guarantee HalfOpenPeriod
        -- The accrual period is the half-open interval [period_start, period_end).
        -- The start date is inclusive and fully accrued; the posting date is
        -- exclusive, excluded from the period it closes and included in the next.

    @guarantee MinimumBalanceThreshold
        -- A day whose end-of-day balance is at or above 1,000 qualifies and enters
        -- the accrual sum at its balance. A day below 1,000 contributes zero to the
        -- accrual sum but still counts in the total-day divisor, and is excluded
        -- from qualifying_days. An account at zero for the whole period posts zero
        -- interest, recorded as a zero posting rather than skipped.

    @guarantee RateSegments
        -- The rate history reaches the function as an effective-dated schedule on
        -- the account; post_interest reads it to find segment boundaries. The caller
        -- passes one account and one period, not one call per segment. When the rate
        -- changes mid-period a separate ADB is formed for each rate segment over
        -- that segment's days, interest is computed per segment and the results are
        -- summed. Each day within a segment uses the rate in force that day. A single
        -- flat rate applies to the full balance; tiered or banded rates are not used.

    @guarantee RoundingTaxAndNet
        -- Sum the raw, unrounded segment interests first, then floor once to 2
        -- decimal places to produce gross_interest. Rounding is always floor, never
        -- half-up; the dropped sub-unit remainder is retained by the bank and is not
        -- carried to the next period. tax_withheld = floor(gross_interest x 0.15, 2
        -- dp), computed once on the combined gross. net_interest_posted =
        -- gross_interest - tax_withheld, derived rather than independently floored,
        -- so the three figures reconcile exactly.

    @guarantee ReturnedAverageDailyBalance
        -- The returned average_daily_balance is the accrual ADB actually used: the
        -- sum of qualifying-day end-of-day balances (sub-threshold days entered as
        -- zero) divided by the total days in the period. For a single-rate period it
        -- reconciles exactly with gross_interest = ADB x (annual_rate / 360) x
        -- total_days. For a multi-segment period a single whole-period ADB is
        -- returned regardless of segment boundaries. qualifying_days is the total
        -- count of at-or-above-1,000 days across the whole period, unsegmented.

    @guarantee UpdatedBalanceAndEffectiveDate
        -- Posting credits the net interest to the account, so the returned
        -- updated_balance already includes it. The credit applies to the balance as
        -- it stands when the run executes. The posting date is the quarterly
        -- anniversary of account opening; the effective/value date and the run date
        -- are treated as that same date. The accrual covers up to but not including
        -- it.

    @guarantee Idempotency
        -- Running post_interest more than once for the same period does not
        -- double-credit. A period that already has a posting record is detected and
        -- the existing posting is returned without crediting the account again.

    @guarantee ClosedPeriodImmutability
        -- A closed period is immutable. A back-dated or corrected transaction whose
        -- value date falls inside an already-posted period does not trigger
        -- recomputation of that period's interest. The correction affects only the
        -- current open period's accrual, from the transaction's value date onward.

    @guarantee ReversalOutOfScope
        -- post_interest has no reversal path. Voiding an erroneous posting,
        -- restoring the balance and reclaiming withheld tax are handled by a separate
        -- reversal or adjustment mechanism.

    @guarantee InvalidInputs
        -- A negative annual rate is rejected as invalid by raising an error, not via
        -- a returned status field. A zero annual rate is valid and produces a
        -- zero-interest posting. Balances never go negative, so no overdraft or debit
        -- rate applies.

    @guarantee ZeroLengthAndMissingDays
        -- A zero-length period posts zero interest, recorded as a zero posting. Where
        -- the balance history is empty or has gaps, the last known balance is carried
        -- forward across the missing days; if no prior balance exists at all, those
        -- days are treated as zero.

    @guarantee ClosurePosting
        -- On closure between posting dates a final pro-rata posting is made covering
        -- the period from the last anniversary up to but not including the closure
        -- date, using the same half-open ADB, Actual/360, floor-to-2-dp and 15%
        -- withholding machinery. The customer does not forfeit the partial period's
        -- accrued interest.

    @guarantee FirstPeriod
        -- The first accrual period runs from the account opening date, inclusive, up
        -- to but not including the first quarterly anniversary, using the same
        -- half-open machinery. An account opened and closed before any anniversary
        -- gets a pro-rata posting from opening, inclusive, to closure, exclusive.

    @guarantee DormancyFeeInteraction
        -- The monthly dormancy fee of 5 is a real debit posted by a separate
        -- mechanism, so it appears in the daily balance history and lowers the
        -- end-of-day balances that feed the ADB for any period in which it is
        -- charged. If a fee debit pushes a day below 1,000 that day contributes zero
        -- to accrual and drops out of qualifying_days, exactly as any other
        -- sub-threshold day. post_interest's return does not include the fee
        -- directly.

    @guarantee SingleCurrency
        -- The system is single-currency with one implied minor unit. The return
        -- carries no currency code. One account is always exactly one currency; a
        -- balance history spanning more than one currency is not supported.
}


## Auditor verdict

_The spec covers 13 of 14 decisions correctly. It surfaces all decisions except escheatment (#10), which is entirely absent. The one surfaced-but-incorrect decision is compounding (#2): the reference mandates daily compounding, but the spec explicitly adopts average daily balance with no day-by-day compounding, a direct contradiction. All other method, threshold, rounding, tax, lifecycle (dormancy, closure), edge-case, temporal, and output decisions match the reference exactly. Coverage = 12/14 correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | @guarantee AverageDailyBalanceMethod: "Sum the daily balances over the period, divide by the total days in the period to form the ADB, and apply the rate once... There is no day-by-day compounding." | The spec explicitly adopts average daily balance, applying the rate once to the average, and rejects per-day daily-balance compounding, matching the reference exactly. |
| 2 | yes | no | @guarantee AverageDailyBalanceMethod: "There is no day-by-day compounding."; header: "there is no day-by-day compounding." | The reference requires daily compounding (each day's interest joins the base for the next day). The spec explicitly states the opposite: no day-by-day compounding. This is a contradiction, so not correct. |
| 3 | yes | **yes** | config: "posting_interval: Duration = 3.months -- quarterly, on the account's opening anniversary"; @guarantee UpdatedBalanceAndEffectiveDate: "The posting date is the quarterly anniversary of account opening" | Spec states quarterly posting on the opening anniversary, not calendar quarter-ends, matching the reference. |
| 4 | yes | **yes** | config: "day_count_divisor: Integer = 360"; @guarantee DayCountConvention: "Actual/360. The daily rate is annual_rate / 360." | Spec uses 360 day-count with daily rate = annual_rate/360, matching the reference exactly. |
| 5 | yes | **yes** | @guarantee MinimumBalanceThreshold: "A day whose end-of-day balance is at or above 1,000 qualifies... A day below 1,000 contributes zero to the accrual sum but still counts in the total-day divisor" | Spec sets the threshold at 1,000, zeros sub-threshold days' contribution, and keeps them in the divisor, exactly matching the reference. |
| 6 | yes | **yes** | @guarantee RoundingTaxAndNet: "floor once to 2 decimal places to produce gross_interest. Rounding is always floor, never half-up; the dropped sub-unit remainder is retained by the bank" | Spec floors posted interest to 2dp, never half-up, with the bank keeping the fraction, matching the reference. |
| 7 | yes | **yes** | config: "tax_rate: Decimal = 0.15"; @guarantee RoundingTaxAndNet: "tax_withheld = floor(gross_interest x 0.15...)... net_interest_posted = gross_interest - tax_withheld"; posting exposes tax_withheld separately | Spec deducts 15% withholding tax at posting, credits the net, and reports tax_withheld separately, matching the reference. |
| 8 | yes | **yes** | config: "dormancy_threshold: Duration = 12.months", "dormancy_fee: Decimal = 5"; @guidance in AccountBecomesDormant: "Interest keeps accruing... while dormant... The monthly dormancy fee of 5 is charged" | Spec sets dormancy at 12 months of no customer transaction, keeps interest accruing while dormant, and charges a monthly fee of 5, matching the reference. |
| 9 | yes | **yes** | @guarantee ClosurePosting: "On closure between posting dates a final pro-rata posting is made... net of... 15% withholding... The customer does not forfeit the partial period's accrued interest." | Spec makes a pro-rata closure posting net of withholding, with no forfeiture, matching the reference. |
| 10 | no | no | absent | The spec addresses dormancy and closure but never mentions escheatment, the 5-year dormant period, or remittance to the state. Not surfaced, so not correct. |
| 11 | yes | **yes** | @guarantee InvalidInputs: "A negative annual rate is rejected as invalid by raising an error... A zero annual rate is valid and produces a zero-interest posting. Balances never go negative"; @guarantee MinimumBalanceThreshold: zero-balance whole period "posts zero interest, recorded as a zero posting" | Spec rejects negative rates, treats zero balance as a zero no-op posting, and forbids negative balances, matching the reference. |
| 12 | yes | **yes** | @guarantee HalfOpenPeriod: "the half-open interval [period_start, period_end). The start date is inclusive... the posting date is exclusive, excluded from the period it closes and included in the next." | Spec makes periods half-open [start, end), excluding the posting day from the closing period and including it in the next, matching the reference. |
| 13 | yes | **yes** | @guarantee RateSegments: "When the rate changes mid-period a separate ADB is formed for each rate segment... interest is computed per segment and the results are summed. Each day within a segment uses the rate in force that day." | Spec computes interest per rate-segment using the rate in force each day and sums them, matching the reference. |
| 14 | yes | **yes** | entity InterestPosting fields and surface exposes: gross_interest, tax_withheld, net_interest_posted, average_daily_balance, qualifying_days, updated_balance | Spec's posting output returns gross, tax withheld, net posted, the average daily balance used, qualifying days count, and updated balance, matching the reference's required reporting shape. |

## Allium checker (spec-side, not scored)

check passed:

```
{
  "command": "check",
  "diagnostics": [
    {
      "code": "allium.field.unused",
      "location": {
        "col": 5,
        "file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-MYQO2Z/spec.allium",
        "line": 53
      },
      "message": "Field 'DailyBalance.date' is declared but not referenced elsewhere.",
      "severity": "info"
    },
    {
      "code": "allium.field.unused",
      "location": {
        "col": 5,
        "file": "/var/folders/lg/wpmf96vd5fl
```
