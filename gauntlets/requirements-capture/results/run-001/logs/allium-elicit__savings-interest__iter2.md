# allium-elicit — savings-interest — iteration 2

Model (author): claude-opus · Questions asked: 24 · Captured: 11/14 · Bespoke captured: 7/10

## Conversation

### Round 1
_Step reasoning:_ No questions asked yet; the brief omits every material interest-calculation policy (method, day-count, compounding, rounding, balance basis, edge cases, output shape), so I open with the core-method and completeness-gate decisions before writing any spec.

Q: What's the boundary of this specification? Is `post_interest(account, period)` the whole system, or part of a larger accounts platform (and are things like overdrafts, tax/withholding, or fees in or out of scope)?
A: post_interest is part of a larger accounts platform. Withholding tax and dormancy fees are explicitly in scope. Overdraft (negative balance) is out of scope — the account never goes negative. Other platform concerns (account opening, transfers, statements) are out of scope for this function.

Q: How is interest accrued from the daily balance history: simple interest summed over the period, or does it compound? If it compounds, at what frequency (daily, monthly, at period end)?
A: Interest compounds daily: each day's accrued interest is added to the running balance and becomes the base for the next day's accrual within the period. The posted amount is the result of that daily compounding over the full period.

Q: What day-count convention applies when turning the annual rate into a daily figure: actual/365, actual/360, 30/360, or actual/actual (and how are leap years handled)?
A: 360-day basis. The daily rate is annual_rate / 360. Leap years are not relevant under this convention.

Q: Which balance is used for each day's accrual (end-of-day closing balance, start-of-day, or something else), and how are days with no recorded balance change treated?
A: The average daily balance method applies: sum each calendar day's balance across the period, divide by the total number of days in the period, then apply the rate to that average. Days with no recorded transaction carry the most recent known balance forward [default, not policy for the specific end-of-day vs. start-of-day question — end-of-day closing balance is the natural read].

Q: How should negative balances (overdraft) and zero balances be treated for accrual: no interest, a different debit rate, or accrue negatively at the same rate?
A: Days where the balance is below 1,000 contribute zero interest for that day but the day still counts in the divisor when computing the average daily balance. A zero balance for the whole period results in a zero posting (still recorded). Negative balances are not possible — the account never goes negative and overdraft is out of scope.

Q: Is the annual rate a single flat rate, or is it tiered/banded by balance? If tiered, how do the tiers apply (whole balance at one rate, or marginal slices)?
A: Flat rate — tiering is not in scope. [default, not policy]

Q: What are the exact units and precision of money here (currency, minor units such as pennies), and how is rounding handled: which direction, and does rounding occur per day, per compounding step, or only once at final posting?
A: Money is tracked to 2 decimal places (minor unit). Rounding of posted interest is floor (truncate toward zero), never half-up; the bank retains the fraction. Rounding is applied once at final posting, not per day or per compounding step. Currency denomination is not specified in policy [default, not policy — use the account's denominated currency].

Q: How are the period's endpoints treated: are both the start and end dates inclusive, and does interest accrue on the posting day itself?
A: Periods are half-open [start, end): the start date is included and accrues interest; the posting/end date is excluded from the period being closed and is included in the next period. Interest does not accrue on the posting day itself within the period being settled.

Q: When interest is posted, does it get added to the account balance (and thereafter earn interest in future periods), and does the returned 'updated balance' reflect the balance plus posted interest?
A: Yes. The net interest (gross minus 15% withholding tax) is credited to the account balance. Because interest compounds daily within a period, posted interest joining the balance also becomes the base for future periods. The returned updated balance reflects the balance after crediting net interest.

Q: What exactly must the function return, field by field: the interest amount and updated balance only, or also things like an accrual breakdown, effective date, or the rate applied? And is any figure disclosed/reported on a different basis than it is computed?
A: Return per posting: gross interest, tax withheld (15% of gross, rounded down to minor unit), net interest posted (gross minus tax withheld), average daily balance used, number of qualifying days (days where balance was at or above 1,000), and updated account balance.

Q: What is the effective date of the posted interest versus when it is recorded, and can interest ever be recomputed or back-dated for a past period?
A: Effective date of posting is the period end date. Interest is not back-dated or recomputed for past closed periods once posted. [default, not policy]

Q: What should happen for degenerate inputs: an empty balance history, a zero-length or single-day period, a period with dates out of order, or a balance history that doesn't cover the whole period?
A: Zero balance for the whole period: post zero interest (still record the zero posting). [default, not policy for the rest] Zero-length or single-day period: treat as a valid degenerate case — accrue for the days in the half-open interval (a single-day period [d, d) has zero days, so posts zero). Out-of-order dates: reject as invalid input. Balance history not covering the whole period: carry the last known balance forward for uncovered days; if no history exists at all, treat balance as zero for all days.

### Round 2
_Step reasoning:_ Two prior answers give contradictory accrual methods (daily compounding vs average daily balance) that must be reconciled, and dormancy fees were declared in scope but never elicited.

Q: Two of your earlier answers describe different accrual methods and I want to make sure I capture the one you actually use. You said interest 'compounds daily' (each day's accrued interest is added to the running balance and becomes the next day's base), but you also said the 'average daily balance method' applies (sum each day's balance across the period, divide by the number of days, then apply the rate to that single average). These are different computations that give different results. Which governs: daily compounding on the running balance, or a single rate application to the period's average daily balance? If both somehow apply, how exactly do they combine?
A: Average daily balance governs. My earlier 'compounds daily' answer was imprecise. Within a period, the computation is: sum each calendar day's end-of-day balance, divide by the number of days in the period to get the ADB, then apply the rate once — ADB × (annual_rate / 360) × days_in_period — with floor rounding at posting. There is no day-by-day compounding within a period. What 'compounds' is the posted net interest joining the account balance at each quarterly posting, so it earns interest in subsequent periods. The two descriptions do not combine; ADB with a single rate application is the definitive method.

Q: You said dormancy fees are explicitly in scope, but we haven't specified them. What makes an account dormant (e.g. no qualifying activity for some duration), what is the dormancy fee (fixed amount or a rate), and how often is it charged?
A: An account becomes dormant after 12 consecutive months with no customer-initiated transaction (balance queries and system-generated postings such as interest do not reset the clock). While dormant, interest continues to accrue normally. A fixed monthly dormancy fee of 5 (in the account's denominated currency) is charged each calendar month the account remains dormant.

Q: How does a dormancy fee interact with interest posting within post_interest: is the fee assessed inside this function or elsewhere, and when it applies, is it deducted from the balance before interest is computed, after net interest is credited, or in the same posting, and does it appear as its own field in the returned result?
A: The dormancy fee is assessed outside post_interest, by a separate fee process, and is not a field in the value returned by post_interest. When both apply in the same period, the fee is deducted from the balance after net interest has been credited. post_interest sees the balance as it stands at period start and returns the updated balance after crediting net interest; the fee engine then applies the monthly charges separately. [default, not policy for the precise sequencing and ownership boundary]

Q: For withholding tax, is the 15% rate applied to every posting unconditionally, or are there exemptions or thresholds (e.g. tax-exempt accounts, or gross interest below some amount) where no tax is withheld?
A: The 15% withholding tax applies unconditionally to every posting. There are no exemptions, thresholds, or tax-exempt account categories in scope for this function.

### Round 3
_Step reasoning:_ Two material interactions remain unresolved: how the 1,000 threshold combines with the now-definitive ADB numerator/divisor, and the exact rounding sequence across gross, tax, and net; both change the posted amount.

Q: Now that average daily balance (ADB) is the definitive method, I need to reconcile it with the sub-1,000 threshold, because your earlier threshold answer described a per-day interest model that ADB replaced. Under ADB, how exactly do sub-threshold days enter the calculation: is each day's balance that falls below 1,000 treated as zero in the numerator sum (while the day still counts in the divisor), so ADB = (sum of balances only on days at or above 1,000) / (total days in period)? Or does the whole balance still enter the sum and the threshold does something else? Please state the exact numerator and divisor.
A: Sub-threshold days contribute zero to the numerator and one to the divisor. The exact formula is: numerator = sum of each day's end-of-day balance for days where balance >= 1,000 (days below 1,000 contribute 0); divisor = total calendar days in the period (all days, whether qualifying or not). ADB = numerator / divisor. The rate is then applied once: gross = ADB × (annual_rate / 360) × days_in_period.

Q: The return shape has three money figures — gross interest, tax withheld, and net posted — and I want to pin the rounding sequence so no figure is disclosed on a different basis than it is computed. Is gross interest floored to the 2-decimal minor unit first and the 15% tax then computed on that floored gross (tax = floor(0.15 x floored_gross), net = floored_gross - tax)? Or is the 15% applied to the unrounded gross, with flooring happening elsewhere? And is net always exactly gross_reported minus tax_reported at 2dp?
A: Gross interest is floored to the minor unit first. Tax is then computed on that floored gross: tax = floor(0.15 × floored_gross). Net = floored_gross − tax. Because both gross_reported and tax_reported are already at 2 dp and net is their exact arithmetic difference, net is always exactly gross_reported minus tax_reported with no further rounding step required. [default, not policy for the precise rounding chain — the answer key specifies floor rounding and the tax field as '15% of gross, rounded down to minor unit' but does not explicitly state whether gross is floored before or after the tax computation; the above sequence is the most coherent reading consistent with the bank retaining the fraction and net being disclosed on the same basis as it is computed.]

### Round 4
_Step reasoning:_ Every material policy class has been pinned except the base balance to which net interest is credited; the stakeholder's 'period start' phrasing conflicts with the daily-balance history, so I must resolve which figure the returned updated balance builds on before concluding.

Q: One field in the return still has an ambiguous base: the 'updated account balance'. Net interest is credited to the account, but to which balance figure? You said post_interest 'sees the balance as it stands at period start and returns the updated balance after crediting net interest', yet the balance history shows the balance changing across the period (transactions carried forward day to day). So is updated_balance = the account's closing balance at period end (the last known balance in the half-open period) + net interest? Or literally period_start_balance + net interest, discarding intervening transactions? Please state exactly which base figure net is added to.
A: updated_balance = the account's last known end-of-day balance on the final day of the half-open period (i.e. end_date − 1, the last day accrued) + net_interest. Intervening transactions are not discarded — they are already reflected in that closing balance, which is also the same balance history used to compute the ADB. The earlier phrase 'sees the balance as it stands at period start' described when post_interest begins its computation, not which balance figure receives the credit. [default, not policy — the answer key does not explicitly state the base; this is the most coherent reading consistent with a half-open period, a live balance history, and net interest being credited to the account as it actually stands at period close.]

### Round 5
_Step reasoning:_ Core method, rounding, thresholds, return shape and degenerate inputs are pinned, but the whole-life class (mid-period closure/final settlement and reversal/correction) has not yet been put to the stakeholder, so I ask those before concluding.

Q: We haven't walked the account's whole life against this function, only the normal period close. If an account is closed partway through a period, does post_interest run a final partial-period settlement up to the closure date (accruing over the half-open interval [period_start, closure_date) and posting net interest), or is no interest posted for a period in which the account closes? And is account closure in or out of scope for this function?
A: On closure mid-period, interest is accrued pro-rata over the half-open interval [period_start, closure_date) and posted net of 15% withholding as part of closing. The customer does not forfeit the partial period. Account closure is in scope to the extent that post_interest is responsible for computing and posting that final settlement; the broader closure workflow (zeroing the account, remitting funds) is outside this function.

Q: Can a posted interest amount ever be reversed or corrected once recorded (for example, an erroneous posting, a clawback of withheld tax, or a transaction back-dated into a closed period that changes the ADB)? You said interest is not recomputed or back-dated for closed periods, so I want to confirm reversal/correction is genuinely out of scope rather than a path we simply haven't specified.
A: Reversal and correction of posted interest is out of scope. Interest is not recomputed or back-dated for closed periods once posted, and there is no clawback or amendment path for erroneous postings or back-dated transactions that would alter a closed period's ADB. [default, not policy]

### Round 6
_Step reasoning:_ Coverage is broad, but two timing/sequencing classes remain genuinely unasked: whether the annual rate can vary within a period (and how ADB combines with a mid-period rate change), and whether re-invoking post_interest on an already-settled or overlapping period is guarded, rejected, or double-posts.

Q: The rate: is `annual_rate` a single value fixed for the whole period (passed in or read once), or can it change partway through a period? If it can change mid-period, how does that interact with the average-daily-balance method — does the ADB get a single blended/most-recent rate applied once, or is the period split at each rate-change date with a separate ADB and accrual per sub-interval that are then summed? Please state exactly which rate applies to which days.
A: Each day uses the rate in force on that day. The period is split at each rate-change boundary into sub-intervals. For each sub-interval, a separate ADB is computed (numerator = sum of qualifying end-of-day balances within that sub-interval; divisor = total calendar days in the full period, not the sub-interval), and accrual = ADB_segment × (rate_segment / 360) × days_in_segment. The sub-interval accruals are summed to produce gross interest before rounding. A single blended or most-recent rate applied to a full-period ADB is not used.

Q: Idempotency and re-invocation: once a period has been posted, can `post_interest` be called again for the same (or an overlapping) period, and if so what happens — is it rejected, a no-op, or does it double-post? Given reversal/correction is out of scope, I want to confirm whether guarding against re-posting a settled period is this function's responsibility or lies entirely with the caller.
A: Guarding against re-invocation for an already-settled period is the caller's responsibility, not this function's. post_interest has no in-scope mechanism to detect or reject a duplicate call for a closed period — it would compute and post again, double-crediting the account. The caller (or the surrounding platform) must ensure post_interest is not invoked twice for the same period. [default, not policy]

### Round 7
_Step reasoning:_ Nearly complete, but the Round 6 rate-change segmentation left the single reported 'average daily balance used' field ambiguous, a reporting figure now potentially disclosed on a different basis than computed.

Q: The return shape reports a single 'average daily balance used', but Round 6 established that when the rate changes mid-period the calculation splits into sub-intervals, each with its own segment ADB (numerator = qualifying balances within the segment, divisor = full-period days). When the rate changes at least once, what exactly is reported in the single 'average daily balance used' field: the whole-period ADB computed as (sum of all qualifying end-of-day balances across the entire period) / (total calendar days) ignoring the segmentation, or some aggregate of the per-segment ADBs, or the sum of the segment ADBs? Please state the exact figure so this disclosed value isn't computed on a different basis from the gross interest it accompanies.
A: The answer key does not specify what the single 'average daily balance used' field reports in a multi-rate period, so this is [default, not policy]. The most coherent disclosed figure is the whole-period ADB: (sum of all qualifying end-of-day balances across the entire period) / (total calendar days), computed without regard to rate-segment boundaries. This figure is a true summary of the account's average over the posting period and is independently derivable from the balance history alone. It does not equal any individual segment ADB, nor their sum, nor their weighted combination — it is simply the flat whole-period average. Implementors should note that this reported ADB is a disclosure summary and not the figure fed directly into the gross interest arithmetic (which uses per-segment ADBs as established in Round 6); the two are consistent with the same underlying balance history but serve different purposes.

### Round 8 (process signalled done)
_Step reasoning:_ All completeness-gate classes have been put and answered or explicitly scoped out across seven rounds (ADB method reconciled, rounding chain, threshold, mid-period rate segmentation, closure, reversal, dormancy, idempotency, disclosure basis, edge inputs); no material policy decision remains unasked.

(no questions this round)

## Produced specification

-- allium: 3

-- ===========================================================================
-- Savings account interest posting: post_interest(account, period)
--
-- Scope: post_interest is one function within a larger accounts platform.
-- In scope: computing and posting periodic interest for a savings account,
-- 15% withholding tax on each posting, crediting net interest to the balance,
-- and (on closure) a final pro-rata settlement. Withholding tax and dormancy
-- are platform concerns in scope, though the dormancy fee itself is assessed
-- by a separate fee process, not by post_interest.
-- Out of scope: overdraft / negative balances (the account never goes
-- negative), account opening, transfers, statements, reversal or correction
-- of posted interest, and the broader closure workflow (zeroing, remitting).
--
-- Inputs to a posting are the account's daily end-of-day balance history and
-- the annual rate(s) in force over the period. All monetary amounts are
-- Decimal in the account's denominated currency, tracked to two decimal places
-- (the minor unit). Rounding is always floor (truncate toward zero); the bank
-- retains the fraction.
-- ===========================================================================

config {
    qualifying_balance_threshold: Decimal = 1000   -- days below this earn no interest
    withholding_tax_rate: Decimal = 0.15           -- applied unconditionally to every posting
    dormancy_threshold: Duration = 12.months       -- 12 consecutive months, no customer transaction
    dormancy_fee: Decimal = 5                       -- fixed monthly charge while dormant
}

-- ---------------------------------------------------------------------------
-- Value types
-- ---------------------------------------------------------------------------

-- The settlement window. Half-open [start_date, end_date): the start date is
-- included and accrues interest; the end/posting date is excluded and belongs
-- to the next period. A single-day window [d, d) spans zero days.
value Period {
    start_date: Timestamp
    end_date: Timestamp
}

-- A rate sub-interval within the period. The period is split at each
-- rate-change boundary; each day uses the rate in force on that day.
-- The divisor for a segment's ADB is the FULL period's day count, not the
-- segment's, so the segment accruals sum coherently over the period.
value RateSegment {
    annual_rate: Decimal
    days: Integer                    -- calendar days in this sub-interval
    period_total_days: Integer       -- total calendar days in the full period (the divisor)
    qualifying_balance_sum: Decimal  -- sum of end-of-day balances on qualifying days in this sub-interval

    -- ADB for the segment: qualifying balances over the FULL-period day count.
    segment_adb: qualifying_balance_sum / period_total_days
    -- Segment accrual before rounding: ADB x (rate / 360) x days-in-segment.
    -- 360 is the fixed day-count basis; leap years are irrelevant.
    accrual: segment_adb * (annual_rate / 360) * days
}

-- ---------------------------------------------------------------------------
-- Entities
-- ---------------------------------------------------------------------------

entity Account {
    balance: Decimal
    status: active | closed
    last_customer_transaction_at: Timestamp   -- reset only by customer-initiated transactions

    -- Dormant after 12 consecutive months with no customer-initiated
    -- transaction. Balance queries and system-generated postings (interest)
    -- do not reset the clock. Interest continues to accrue while dormant.
    is_dormant: now - last_customer_transaction_at >= config.dormancy_threshold

    transitions status {
        active -> closed
        terminal: closed
    }
}

-- The result of a posting: exactly the fields post_interest returns.
entity InterestPosting {
    account: Account
    period: Period
    segments: List<RateSegment>

    total_days: Integer               -- calendar days in the half-open period
    qualifying_days: Integer          -- days where the closing balance was at or above the threshold
    qualifying_balance_sum: Decimal   -- sum of end-of-day balances across all qualifying days
    last_accrued_balance: Decimal     -- closing balance on the last accrued day (end_date - 1)

    gross_interest: Decimal           -- floor(sum of segment accruals) at the minor unit
    tax_withheld: Decimal             -- floor(0.15 x gross_interest)
    average_daily_balance: Decimal    -- whole-period disclosure: qualifying_balance_sum / total_days

    -- Net posted = floored gross minus floored tax; no further rounding.
    net_interest: gross_interest - tax_withheld
    -- Net interest credited to the account's closing balance at period end.
    updated_balance: last_accrued_balance + net_interest
    -- Effective date of the posting is the period end date.
    effective_date: period.end_date

    @guidance
        -- Accrual method (definitive): average daily balance, applied per
        -- rate segment. For each sub-interval the numerator is the sum of
        -- end-of-day balances only on qualifying days (balance >= 1,000);
        -- days below 1,000 contribute 0 to the numerator but still count in
        -- the divisor. The divisor is the FULL period's calendar-day count.
        -- Segment gross = segment_adb x (segment_rate / 360) x days-in-segment.
        -- Gross interest is the sum of segment accruals, then floored once to
        -- the 2-decimal minor unit. There is NO day-by-day compounding within
        -- a period; compounding happens only across periods, as posted net
        -- interest joins the balance and earns interest in later periods.
        --
        -- Rounding chain: gross is floored to the minor unit first; tax is
        -- floor(0.15 x floored_gross); net = floored_gross - tax. Rounding is
        -- floor (truncate toward zero) throughout; the bank retains the
        -- fraction. Net is exactly the reported gross minus reported tax.
        --
        -- Reported average_daily_balance is the whole-period average
        -- (all qualifying balances / total calendar days), computed WITHOUT
        -- regard to rate-segment boundaries. It is a disclosure summary and
        -- does not equal any segment ADB, their sum, or the figure fed into
        -- the gross arithmetic; the two are consistent with the same balance
        -- history but serve different purposes.
        --
        -- Balance sourcing: each day uses its end-of-day closing balance.
        -- Days with no recorded transaction carry the last known balance
        -- forward. If the balance history does not cover the whole period,
        -- carry the last known balance forward for uncovered days; if there
        -- is no history at all, treat the balance as zero for every day.
}

-- ---------------------------------------------------------------------------
-- Behaviour
-- ---------------------------------------------------------------------------

-- The core function. Computes a posting for the given half-open period.
rule PostInterestForPeriod {
    when: PostInterest(account, period)
    requires: period.end_date >= period.start_date
    ensures: InterestPosting.created(account: account, period: period)

    @guidance
        -- Out-of-order dates (end before start) are rejected as invalid input.
        -- A zero-length or single-day period [d, d) spans zero days and posts
        -- zero. A zero balance across the whole period posts zero, but the
        -- zero posting is still recorded and returned.
        --
        -- The value returned is exactly: gross_interest, tax_withheld,
        -- net_interest, average_daily_balance, qualifying_days, and
        -- updated_balance. The dormancy fee is never part of this return.
        --
        -- Idempotency is the caller's responsibility. post_interest has no
        -- mechanism to detect or reject a duplicate call for an
        -- already-settled period; invoked twice for the same period it would
        -- compute and post again, double-crediting the account. The caller
        -- must ensure it is not invoked twice for the same period.
        --
        -- Interest is not back-dated or recomputed for closed periods, and
        -- there is no clawback or amendment path for erroneous postings or
        -- back-dated transactions that would alter a settled period's ADB.
}

-- Crediting: net interest joins the account balance at the closing balance of
-- the last accrued day. Intervening transactions are already reflected there.
rule CreditNetInterest {
    when: posting: InterestPosting.created
    ensures: posting.account.balance = posting.updated_balance
}

-- On closure mid-period, post_interest runs a final pro-rata settlement over
-- [period_start, closure_date) and posts net interest. The customer does not
-- forfeit the partial period. Zeroing the account and remitting funds are
-- outside this function.
rule SettleInterestOnClosure {
    when: account: Account.status transitions_to closed
    ensures: InterestPosting.created(account: account)
}

-- The monthly dormancy fee. Assessed OUTSIDE post_interest by a separate fee
-- process, and never a field in post_interest's return.
rule ChargeMonthlyDormancyFee {
    when: account: Account.is_dormant
    requires: account.status = active
    ensures: account.balance = account.balance - config.dormancy_fee

    @guidance
        -- A fixed fee of 5 in the account's currency is charged for each
        -- calendar month the account remains dormant. When an interest
        -- posting and a dormancy fee fall in the same period, the fee is
        -- deducted AFTER net interest has been credited.
}

-- ---------------------------------------------------------------------------
-- Invariants
-- ---------------------------------------------------------------------------

-- The account never goes negative; overdraft is out of scope.
invariant BalanceNeverNegative {
    for a in Accounts:
        a.balance >= 0
}

-- The three money figures never go negative (no debit interest).
invariant NonNegativeFigures {
    for p in InterestPostings:
        p.gross_interest >= 0 and p.tax_withheld >= 0 and p.net_interest >= 0
}

-- Withholding tax is at most 15% of gross (equal but for the floor remainder).
invariant TaxBoundedByRate {
    for p in InterestPostings:
        p.tax_withheld <= p.gross_interest * config.withholding_tax_rate
}

-- Reported ADB is the whole-period average when the period has days.
invariant AverageDailyBalanceDisclosure {
    for p in InterestPostings:
        p.total_days > 0 implies p.average_daily_balance = p.qualifying_balance_sum / p.total_days
}

-- A zero-day period posts nothing.
invariant ZeroDayPeriodPostsZero {
    for p in InterestPostings:
        p.total_days = 0 implies p.gross_interest = 0
}

-- A zero balance across the period posts nothing.
invariant ZeroBalancePostsZero {
    for p in InterestPostings:
        p.qualifying_balance_sum = 0 implies p.gross_interest = 0
}

-- Qualifying days are a subset of the period's days.
invariant QualifyingDaysBounded {
    for p in InterestPostings:
        p.qualifying_days >= 0 and p.qualifying_days <= p.total_days
}

-- Any non-zero accrual is backed by at least one rate segment.
invariant SegmentsPresentWhenAccruing {
    for p in InterestPostings:
        p.gross_interest > 0 implies p.segments.count >= 1
}

-- The posting's effective date is the period end date.
invariant EffectiveDateIsPeriodEnd {
    for p in InterestPostings:
        p.effective_date = p.period.end_date
}

-- ---------------------------------------------------------------------------
-- Open questions: coherent defaults are encoded above, but these were
-- answered as defaults rather than confirmed policy and should be ratified.
-- ---------------------------------------------------------------------------

open question "Multi-rate reporting: is the single 'average daily balance used' field the whole-period ADB (encoded here), given it differs from the per-segment ADBs that drive the gross arithmetic?"

open question "updated_balance base: net interest is credited onto the last accrued day's closing balance (end_date - 1). Confirm this rather than the period-start balance."

open question "Dormancy fee sequencing and ownership: the fee is charged by a separate process after net interest is credited when both fall in the same period. Confirm the boundary and ordering."

open question "Idempotency: guarding against re-invocation for a settled period is the caller's responsibility; post_interest will double-post if called twice. Confirm this is acceptable."

open question "Reversal and correction of posted interest is out of scope, with no clawback or amendment path. Confirm."


## Auditor verdict

_11 of 14 decisions correct. The spec strongly covers method conventions (average daily balance, 360 basis, threshold, floor rounding, withholding tax), lifecycle closure and dormancy, rate-segmentation, edge cases, and output shape. Three fail: #2 (spec explicitly denies daily intra-period compounding, contradicting the reference), #3 (posting frequency/quarterly-anniversary never stated, as the period is caller-supplied), and #10 (escheatment entirely absent, with the remittance workflow declared out of scope). Coverage = 11/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Accrual method (definitive): average daily balance, applied per rate segment"; RateSegment: "segment_adb: qualifying_balance_sum / period_total_days" and "accrual: segment_adb * (annual_rate / 360) * days". | The spec computes an average daily balance (sum of qualifying balances over the full-period day count) and applies the rate to that average, and explicitly rejects per-day daily-balance accrual. Matches the reference method. |
| 2 | yes | no | "There is NO day-by-day compounding within a period; compounding happens only across periods, as posted net interest joins the balance and earns interest in later periods." | The reference requires interest to compound daily within the period. The spec explicitly denies intra-period compounding, so the resolution contradicts the reference value. |
| 3 | no | no | absent | post_interest takes an arbitrary Period as input; the spec never states a posting frequency, nor quarterly posting on the account-opening anniversary. The decision is not addressed. |
| 4 | yes | **yes** | "annual_rate / 360"; "360 is the fixed day-count basis; leap years are irrelevant." | The spec fixes the days-in-year basis at 360, matching the reference. |
| 5 | yes | **yes** | config "qualifying_balance_threshold: Decimal = 1000 -- days below this earn no interest"; "days below 1,000 contribute 0 to the numerator but still count in the divisor." | Threshold of 1,000, below-threshold days earn zero but still count in the average-balance divisor. Matches the reference exactly. |
| 6 | yes | **yes** | "Rounding is always floor (truncate toward zero); the bank retains the fraction"; "Gross interest is ... floored once to the 2-decimal minor unit." | Posted interest is floored to the 2dp minor unit with the bank keeping the fraction, never half-up. Matches the reference. |
| 7 | yes | **yes** | config "withholding_tax_rate: Decimal = 0.15"; "tax_withheld: ... floor(0.15 x gross_interest)"; "net_interest: gross_interest - tax_withheld"; return includes both tax_withheld and net. | 15% withholding deducted from gross at posting, account credited net, tax reported separately. Matches the reference. |
| 8 | yes | **yes** | config "dormancy_threshold: Duration = 12.months"; "Interest continues to accrue while dormant"; "dormancy_fee: Decimal = 5"; "a fixed fee of 5 ... charged for each calendar month the account remains dormant." | Dormancy at 12 months of no customer transaction, interest continues to accrue, monthly fee of 5. All three elements match the reference. |
| 9 | yes | **yes** | SettleInterestOnClosure: "post_interest runs a final pro-rata settlement over [period_start, closure_date) and posts net interest. The customer does not forfeit the partial period." | On mid-period closure, interest is accrued pro-rata to the closure date and posted net of withholding, with no forfeiture. Matches the reference. |
| 10 | no | no | absent | No mention of escheatment, a 5-year dormant window, or remitting the balance to the state. The zeroing/remitting workflow is explicitly declared out of scope and the 5-year escheat rule is entirely absent. |
| 11 | yes | **yes** | "A zero balance across the whole period posts zero, but the zero posting is still recorded and returned"; invariant BalanceNeverNegative "a.balance >= 0"; "the account never goes negative." | Zero-balance zero-posting-still-recorded and no-overdraft both match the reference; explicit rejection of a negative rate is not stated, but the core edge resolutions are correct. |
| 12 | yes | **yes** | Period: "Half-open [start_date, end_date): the start date is included and accrues interest; the end/posting date is excluded and belongs to the next period." | Periods are half-open [start, end); the posting day is excluded from the closing period and belongs to the next. Matches the reference exactly. |
| 13 | yes | **yes** | RateSegment: "The period is split at each rate-change boundary; each day uses the rate in force on that day"; gross is "the sum of segment accruals." | Mid-period rate changes are handled by splitting into rate segments, each day using the rate in force, with accruals summed. Matches the reference. |
| 14 | yes | **yes** | "The value returned is exactly: gross_interest, tax_withheld, net_interest, average_daily_balance, qualifying_days, and updated_balance." | The returned shape includes gross, tax withheld, net, the average daily balance used, qualifying days, and the updated balance. All six reference fields are present. |

## Allium checker (spec-side, not scored)

check reported issues:

```
{
  "command": "check",
  "diagnostics": [
    {
      "code": "allium.status.noExit",
      "location": {
        "col": 13,
        "file": "/var/folders/lg/wpmf96vd5fl4p14g9k1rj0z00000gn/T/gauntlet-allium-olYpq4/spec.allium",
        "line": 65
      },
      "message": "Status 'active' in entity 'Account' has no observed transition to a different status.",
      "severity": "warning"
    },
    {
      "code": "allium.status.unreachableValue",
      "location": {
        "col": 13,
        "
```
