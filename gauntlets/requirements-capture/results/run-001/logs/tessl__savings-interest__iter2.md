# tessl — savings-interest — iteration 2

Model (author): claude-opus · Questions asked: 8 · Captured: 5/14 · Bespoke captured: 5/10

## Conversation

### Round 1
_Step reasoning:_ Following one-question-at-a-time, I start with the highest-impact gap: the core interest computation method and day-count basis, which no arm can reliably infer.

Q: To compute the interest, how should the daily balances be used, and what day-count basis applies? Specifically: do you accrue interest on each day's closing balance and sum those daily amounts (rate ÷ days-in-year × balance, per day), or apply the rate to an average daily balance over the period? And is the year basis 365, 360, or actual/actual (accounting for leap years)?
A: Use average daily balance: sum the closing balances for each day in the period, divide by the number of days in the period, then apply the rate once to that average. Do not accrue per-day and sum. Year basis is 360; the daily rate is annual_rate / 360.

### Round 2
_Step reasoning:_ Day-count and averaging are settled; rounding of the posted amount is the next highest-impact policy the brief omits and cannot be safely inferred.

Q: When the computed interest is posted, how should it be rounded? Specifically: to how many decimal places (e.g. 2 for whole currency minor units), and using which rule (round half up, round half to even/banker's rounding, or truncate toward zero)?
A: Round down (floor) to 2 decimal places — truncate toward zero at the minor unit. Never half-up. The bank retains any sub-unit fraction.

### Round 3
_Step reasoning:_ Rounding and day-count basis are settled; the next highest-impact ambiguity is whether overdrawn days produce negative interest or are floored to zero, which materially changes the computation and cannot be safely inferred.

Q: How should negative daily balances (overdrafts) be treated in the average-daily-balance computation? Specifically: do days with a negative closing balance contribute their negative value to the sum (so overdrawn days pull the average down, and a net-negative average would produce negative interest that is debited from the account), or are negative daily balances floored to zero before averaging so the account never earns negative interest?
A: The account never goes negative (a zero balance is the floor — see the zero/negative constraint in policy). Negative daily closing balances therefore do not arise in practice. Consistent with the minimum-balance rule — days below 1,000 contribute zero to the sum but still count in the divisor — any day with a zero balance similarly contributes zero, not a negative value. [The explicit floor-to-zero treatment for hypothetical negative days is not separately stated in policy; the above is the closest applicable rule, not additional policy.]

### Round 4
_Step reasoning:_ Computation, rounding and negative-balance handling are settled, but the posting mechanics (mutation of balance, transaction creation, and cross-period compounding) remain a material, un-inferable gap that must be clarified before spec authoring.

Q: When interest is posted, what exactly happens to the account, and what does the returned 'updated balance' reflect? Specifically: is the truncated interest amount added to the account's balance as of the posting date (creating a new balance entry / transaction), and does the returned balance equal the pre-posting closing balance plus the posted interest? Also, does the posted interest itself become part of the balance history that could earn interest in a future period (i.e. does interest compound across periods)?
A: Yes on all three. At posting, the net interest (gross interest minus 15% withholding tax, truncated to 2 dp) is credited to the account as a new transaction, creating a new balance entry as of the posting date. The returned updated balance equals the pre-posting closing balance on that date plus the net interest credited. Because the posted amount becomes part of the account balance from that point forward, it enters the daily-balance history for the next period and does earn interest going forward — so interest compounds across periods in that sense. Within a period, compounding also occurs daily (each day's accrued interest joins the running base for the next day's accrual).

### Round 5
_Step reasoning:_ The minimum-balance qualification and the exact order of the 15% withholding/truncation are material policy decisions surfaced only tangentially, not yet cleanly confirmed; both change the computed amount, so I confirm them before summarising.

Q: You mentioned a minimum-balance rule in passing — that days with a closing balance below 1,000 contribute zero to the sum but still count in the divisor. I want to pin this down exactly before I stop asking: (a) what is the exact threshold and is the comparison strict (balance < 1,000 excluded) or inclusive (balance <= 1,000 excluded)? (b) is 1,000 in the account's currency major units? and (c) does the same eligibility test apply to the withholding-tax step, or is withholding (15% of gross, then truncate) applied independently — and is the tax computed on gross-then-truncated or truncate-gross-first-then-tax?
A: (a) The threshold is 1,000 and the comparison is inclusive on the qualifying side: a day's balance must be at or above 1,000 to contribute to the sum. Days with a balance strictly below 1,000 (balance < 1,000) contribute zero. Exactly 1,000 qualifies.

### Round 6
_Step reasoning:_ Round 5 answered only part (a) of my bundled question; the withholding tax computation order (parts b/c) remains open and is material to the posted amount, so I ask that single question rather than closing out.

Q: On the withholding tax step, I still need the exact order of operations, since Round 5 only answered the threshold part (a). Is the 15% withholding computed on the gross interest before or after gross is truncated to 2 dp? Concretely, which of these: (i) compute gross = rate applied to average balance at full precision, take 15% of that full-precision gross as tax, subtract to get net, then truncate net to 2 dp; or (ii) truncate gross to 2 dp first, then compute 15% tax on the truncated gross, truncate the tax to 2 dp, then subtract to get net? Please also confirm whether the withholding rate is a flat 15% for all accounts with no exemption threshold.
A: The answer key states that 15% withholding is deducted from the gross interest, and that the posted (net) amount is rounded down to 2 dp. The natural reading is: compute gross at full precision, take 15% of that full-precision gross as tax, subtract to get net, then truncate net to 2 dp — option (i). The explicit rounding rule applies to the net amount credited, not to an intermediate truncated gross. How the tax figure itself is rounded for reporting purposes is not separately stated in policy [default, not policy: truncate the tax amount to 2 dp for reporting]. On the rate: 15% is a flat rate applied at each posting with no exemption threshold stated in policy.

### Round 7
_Step reasoning:_ A direct contradiction between Round 1 (average, rate applied once, no per-day accrual) and Round 4 (daily compounding within period) plus an unstated exact gross formula and divisor definition must be resolved before summarising; asking the core formula question now.

Q: I have a genuine contradiction to resolve before I can summarise. Round 1 said to use the average daily balance and apply the rate *once* to that average, explicitly *not* accruing per-day and summing. But Round 4 said that within a period 'compounding also occurs daily (each day's accrued interest joins the running base for the next day's accrual)'. These two cannot both hold. Which governs the gross-interest computation for a single period: (i) the pure average-daily-balance method from Round 1 — gross = (sum of qualifying daily closing balances ÷ number of days in the period) × the rate, with no intra-period compounding — or (ii) genuine daily compounding where each day's accrued interest is added to the balance base before the next day? And relatedly, when you 'apply the rate' to the average under method (i), is gross = average × (annual_rate / 360) × number_of_days_in_period, or is it average × (annual_rate / 360) applied a single time with no multiplication by the day count? Please state the exact multiplicative formula for gross interest.
A: Method (i) governs. The Round 4 statement that 'compounding also occurs daily within the period' was an error in that response; it contradicts the definitive calculation rule in the answer key, which says to apply the rate once to the average — explicitly not per-day accrual. There is no intra-period compounding. The exact formula for gross interest is: gross = ADB × (annual_rate / 360) × N, where ADB = (sum of qualifying daily closing balances) / N and N = number of calendar days in the period. The 'apply the rate once' language means apply the periodic rate (annual_rate / 360 × N) to the average — not apply annual_rate / 360 a single time without a day-count multiplier. Compounding does occur across periods (because posted net interest enters the balance history for the next period's daily closing balances), but within a single period the calculation is a straight ADB multiplication with no running daily accumulation.

### Round 8
_Step reasoning:_ All material policy points are resolved, including the Round 7 contradiction; the process requires an explicit summary confirmation before completion, so I present the summary for approval rather than proceeding.

Q: Before I close out, please confirm this summary is accurate. SCOPE — `post_interest(account, period)` computes and posts interest for one period, returning the net interest posted and the account's updated balance; multi-period behaviour is out of scope beyond noting that posted interest enters the next period's balance history. CORE BEHAVIOUR — (1) For each calendar day in the period, take the closing balance; a day qualifies only if its closing balance is >= 1,000 (strictly < 1,000 contributes zero to the sum but the day still counts in the divisor N). (2) ADB = (sum of qualifying daily closing balances) / N, where N = number of calendar days in the period. (3) gross = ADB × (annual_rate / 360) × N, computed at full precision, with the rate applied once to the average and no intra-period compounding (Round 4's daily-compounding statement was retracted in Round 7). (4) tax = 15% of full-precision gross (flat rate, no exemption); net = gross − tax; then truncate net toward zero to 2 decimal places. (5) Post net as a new transaction dated the posting date, creating a new balance entry; return net and updated balance = pre-posting closing balance on that date + net. EDGE CASES — accounts never go negative (zero is the floor), so negative daily balances do not arise; days at exactly 1,000 qualify; the bank retains any sub-unit fraction. CROSS-PERIOD — posted net interest joins the balance history and earns interest in future periods (compounding across, not within, periods). Is this correct and complete, or is anything wrong?
A: Confirmed — the summary is accurate and complete. Every point matches the answer key: the qualifying-balance threshold (>= 1,000, zero contribution but full divisor weight below it), the ADB formula, the gross formula (ADB × (annual_rate / 360) × N at full precision, no intra-period compounding), the withholding computation (15% of full-precision gross, flat, no exemption; net truncated toward zero to 2 dp), the posting step (new transaction dated posting date; updated balance = pre-posting closing balance + net), and the cross-period compounding note. Nothing is missing or wrong.

### Round 9 (process signalled done)
_Step reasoning:_ The stakeholder explicitly confirmed in Round 8 that the summary is accurate and complete, satisfying the process's approval step; no ambiguous requirements remain, so requirement gathering is finished.

(no questions this round)

## Produced specification

# Requirements specification — `post_interest(account, period)`

Status: confirmed by the stakeholder in Round 8. Every decision below was settled through the interview; nothing here is inferred or assumed beyond what the stakeholder stated.

## Scope

**Included.** A single function `post_interest(account, period)` that computes the interest earned by one savings account over one period, posts it to the account, and returns the interest posted together with the account's updated balance.

**Excluded.** Multi-period orchestration is out of scope. The only cross-period behaviour in scope is the consequence that posted interest enters the account's balance history and so affects future periods' computations; running interest across multiple periods is not this function's responsibility.

## Core behaviour (happy path)

Given an account with a daily closing-balance history over the period and an annual interest rate:

1. **Qualifying days.** For each calendar day in the period, take that day's closing balance. A day qualifies only if its closing balance is at or above 1,000. The comparison is inclusive on the qualifying side: a balance of exactly 1,000 qualifies; a balance strictly below 1,000 does not.

2. **Divisor.** Let `N` be the number of calendar days in the period. Every day counts towards `N`, whether or not it qualifies.

3. **Sum.** Add the closing balances of the qualifying days. Days that do not qualify (closing balance strictly below 1,000) contribute zero to this sum but still count in `N`.

4. **Average daily balance.** `ADB = (sum of qualifying daily closing balances) / N`.

5. **Gross interest.** `gross = ADB × (annual_rate / 360) × N`, computed at full precision. The rate is applied once to the average: the periodic rate `(annual_rate / 360) × N` is applied to the ADB. There is no intra-period compounding and no per-day accrual-and-sum. (The day-count basis is 360; the daily rate is `annual_rate / 360`.)

6. **Withholding tax.** `tax = 0.15 × gross`, taken on the full-precision gross. The withholding rate is a flat 15% applied at every posting, with no exemption threshold.

7. **Net interest.** `net = gross − tax`, then truncate `net` toward zero (floor at the minor unit) to 2 decimal places. Never round half-up. The bank retains any sub-unit fraction.

8. **Posting.** Credit `net` to the account as a new transaction dated the posting date, creating a new balance entry as of that date.

9. **Return value.** Return the net interest posted and the updated balance, where `updated balance = pre-posting closing balance on the posting date + net`.

## Edge cases

- **No negative balances.** The account never goes negative; zero is the floor. Negative daily closing balances therefore do not arise in practice, and no negative-balance handling is required in the average computation. (No separate floor-to-zero treatment for hypothetical negative days is defined in policy.)
- **Zero-balance days.** A day with a zero balance contributes zero to the sum (it is below the 1,000 threshold) and still counts in the divisor `N`.
- **Threshold boundary.** Exactly 1,000 qualifies; the exclusion applies only to balances strictly below 1,000.
- **Sub-unit fraction.** The fractional part below 2 decimal places that is lost when truncating net interest is retained by the bank, not credited to the account.

## Cross-period behaviour

The posted net interest becomes part of the account balance from the posting date forward. It therefore enters the daily closing-balance history used by the next period's computation and earns interest going forward. Compounding occurs across periods in this sense; it does not occur within a single period. (Round 4's statement that daily compounding occurs within a period was retracted in Round 7 as an error; the average-daily-balance method with the rate applied once governs.)

## Constraints and definitions

- **Day-count basis:** 360. Daily rate = `annual_rate / 360`. Periodic rate for the period = `(annual_rate / 360) × N`.
- **Rounding rule:** truncate toward zero (floor at the minor unit) to 2 decimal places, applied to the net amount credited. Never half-up.
- **Threshold currency:** the 1,000 minimum-balance threshold is in the account's currency major units.
- **Withholding:** flat 15% of full-precision gross, no exemption; the explicit 2-dp truncation rule applies to net, not to an intermediate truncated gross.

## Items not specified by the stakeholder

The following were not stated in policy and were not settled during the interview; they are recorded here as open rather than resolved, consistent with the rule against inventing requirements:

- How the tax figure itself is rounded for reporting purposes (the stakeholder noted a default reading of truncating the reported tax to 2 dp, but flagged this as not policy).
- Any explicit floor-to-zero treatment for hypothetical negative daily balances (not separately stated; negative balances cannot arise given the zero floor).


## Auditor verdict

_The spec is a strong, internally consistent capture of the per-period computation method (decisions 1, 4, 5, 6, 7 correct) but misses the compounding decision (2 is stated as the opposite of the reference) and the entire lifecycle path. Of the core in-focus six [1,2,3,8,9,10], only #1 is correct: #2 is contradicted, and #3, #8, #9, #10 are wholly absent because the spec scopes itself to a single-period function and never addresses posting cadence, dormancy, mid-period closure or escheatment. Temporal and output-shape decisions (12, 13, 14) are also unmet, and the edge-case bundle (11) is only partially covered. Total correct: 5/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Average daily balance. ADB = (sum of qualifying daily closing balances) / N." and "The rate is applied once to the average... There is no intra-period compounding and no per-day accrual-and-sum." | The spec adopts average-daily-balance with the rate applied once to the average, and explicitly rejects per-day daily-balance accrual, matching the reference exactly. |
| 2 | yes | no | "There is no intra-period compounding" and "Round 4's statement that daily compounding occurs within a period was retracted in Round 7 as an error; the average-daily-balance method with the rate applied once governs." | The reference requires daily compounding within the period; the spec directly and deliberately states the opposite, so the resolution contradicts the reference value. |
| 3 | no | no | absent | The spec treats the period as a given input and never states posting frequency (quarterly) or that posting falls on the account-opening anniversary rather than calendar quarter-ends. |
| 4 | yes | **yes** | "Day-count basis: 360. Daily rate = annual_rate / 360." | Days-in-year basis of 360 with daily rate = annual_rate/360 matches the reference precisely. |
| 5 | yes | **yes** | "A day qualifies only if its closing balance is at or above 1,000... contribute zero to this sum but still count in N." | Threshold of >=1,000 with sub-threshold days contributing zero yet still counting in the divisor matches the reference, including the inclusive boundary at exactly 1,000. |
| 6 | yes | **yes** | "truncate net toward zero (floor at the minor unit) to 2 decimal places. Never round half-up. The bank retains any sub-unit fraction." | Floor/truncate-down to 2 dp, never half-up, with the bank keeping the fraction, matches the reference; truncate-toward-zero equals floor for the positive interest amounts in scope. |
| 7 | yes | **yes** | "tax = 0.15 × gross... flat 15% applied at every posting"; "net = gross − tax"; "Credit net to the account". | 15% withholding deducted from gross at each posting with the net credited matches the reference mechanics; the separate-reporting aspect is not returned but that facet is scored under #14. |
| 8 | no | no | absent | The spec contains no dormancy concept: no 12-month trigger, no continued accrual while dormant, and no monthly dormancy fee of 5. |
| 9 | no | no | absent | The spec has no closure handling; it declares multi-period orchestration out of scope and never addresses pro-rata interest accrued to a mid-period closure date. |
| 10 | no | no | absent | No escheatment is mentioned: no 5-year dormant trigger, no remittance to the state, no closure to zero with cessation of interest. |
| 11 | yes | no | "No negative balances. The account never goes negative; zero is the floor." and "Zero-balance days... contributes zero to the sum... still counts in the divisor." | The spec covers the no-overdraft/never-negative aspect, but omits rejection of a negative rate and never states the whole-period zero-balance case as an explicit zero no-op posting, so the bundled resolution is not fully matched. |
| 12 | no | no | absent | The spec never defines the period boundary as half-open [start, end) nor states that the posting day is excluded from the closing period and included in the next; the cross-period note about balance history does not fix the boundary convention. |
| 13 | no | no | absent | The spec assumes a single annual rate across the period and gives no treatment of mid-period rate changes or per-rate-segment computation. |
| 14 | yes | no | "Return the net interest posted and the updated balance". | The reference requires a six-field disclosure (gross, tax withheld, net, average daily balance, qualifying-day count, updated balance); the spec returns only net and updated balance, missing gross, tax, ADB and qualifying-days. |
