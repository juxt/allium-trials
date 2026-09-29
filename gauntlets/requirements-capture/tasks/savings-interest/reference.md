# Reference set (HIDDEN) — savings interest, the material non-inferable decisions

A third task, in savings rather than lending. Its method and lifecycle decisions come from savings and
share no content with the loan tasks, so it tests whether a process's coverage of method and lifecycle
decisions is a general discipline or pattern-matched to a single domain.

Fictional institution: "Rafiki", a savings provider whose product is coherent but deliberately unusual.
Each answer is set OFF both the textbook default and Fineract's own default, so it cannot be recalled
from training data. Decision CLASSES are drawn from real Fineract savings config
(`SavingsInterestCalculationType`, `SavingsCompoundingInterestPeriodType`,
`SavingsPostingInterestPeriodType`, `SavingsInterestCalculationDaysInYearType`,
`minBalanceForInterestCalculation`, `withHoldTax`, dormancy fields `isDormancyTrackingActive`/
`daysToDormancy`/`daysToEscheat`, closure/`accruedTillDate`), so these are real policy choices.

Scoring: **surfaced** if the process asked or the artefact addresses it; **correct** if the resolution
matches the answer here. Coverage = correct / 14.

Columns: the decision class each falls under; **METHOD** or **LIFECYCLE** tags the decisions that test
method and lifecycle coverage in a fresh domain (the in-focus subset); inferable flags the anchors a
model can reasonably guess.

| # | decision | correct answer (reference) | class | tag | inferable? |
|---|---|---|---|---|---|
| 1 | **Interest calculation method** | **average daily balance**: sum the daily balances over the period, divide by days in period, apply the rate once to that average. Not per-day daily-balance. | core method | METHOD | no |
| 2 | **Compounding period** | interest compounds **daily** (each day's interest joins the base for the next day's accrual within the period) | core method | METHOD | no |
| 3 | **Posting period** | interest is posted **quarterly**, on the **anniversary** of account opening, not on calendar quarter-ends | core method | METHOD | no |
| 4 | **Days-in-year basis** | **360** (not 365); the daily rate is annual_rate / 360 | convention | (control) | no |
| 5 | **Minimum balance to earn interest** | interest accrues only on days the balance is **at or above 1,000**; on days below that, that day contributes zero interest (but still counts as a day in the average-balance divisor) | threshold | (control) | no |
| 6 | **Rounding of posted interest** | posted interest is rounded **down (floor)** to the minor unit (2 dp), never half-up; the bank keeps the fraction | rounding | (control) | no |
| 7 | **Withholding tax at posting** | **15% withholding tax** is deducted from the gross interest at each posting; the account is credited the net, and the tax withheld is reported separately | core method / output | METHOD-adjacent | no |
| 8 | **Dormancy** | after **12 months** with no customer-initiated transaction the account becomes dormant; while dormant **interest continues to accrue** but a monthly dormancy fee of **5** is charged | lifecycle | LIFECYCLE | no |
| 9 | **Closure mid-period** | on closure between posting dates, interest is accrued **pro-rata to the closure date** and posted (net of withholding) as part of closing; the customer does not forfeit the partial period | lifecycle | LIFECYCLE | no |
| 10 | **Escheatment** | after **5 years** dormant with no contact, the balance is **escheated to the state**: the account is closed to a zero balance and the funds remitted, no further interest | lifecycle | LIFECYCLE | no |
| 11 | **Zero / negative rate or balance** | a negative rate is rejected as invalid; a zero balance for the whole period posts zero interest (a no-op that still records a zero posting); the account never goes negative (no overdraft) | edge | (control) | yes (reject/zero-noop guessable) |
| 12 | **Interest on the posting day itself** | the posting day is **excluded** from the period it closes and **included** in the next period (periods are [start, end), half-open) | temporal | (control) | no |
| 13 | **Rate changes mid-period** | if the annual rate changes mid-period, each day uses the rate **in force on that day**; the average-balance interest is computed per rate-segment and summed | temporal / method | METHOD-adjacent | no |
| 14 | **Output and reporting shape** | return, per posting: gross interest, tax withheld, net interest posted, the average daily balance used, the number of qualifying days, and the updated balance | output | (control) | no (the average-balance + qualifying-days disclosure is specific) |

## Coherence and honesty notes

- Internally consistent: #1 (average daily balance) with #2 (daily compounding) and #4 (360) fixes the
  per-period computation; #5 sets which days count; #6 rounds it; #7 taxes it; #3 says when it posts;
  #8-#10 are the lifecycle path; #12 fixes the period boundary; #13 handles rate changes; #14 discloses.
- Bespoke (off-default) decisions: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14. Inferable anchor: 11. The
  guess-without-asking check re-derives this empirically before the comparison; the split here is design
  intent, not the final scored subset.
- METHOD/LIFECYCLE subset (the in-focus decisions): #1, #2, #3 (method), #8, #9, #10 (lifecycle),
  with #7 and #13 method-adjacent. Core in-focus six: **[1, 2, 3, 8, 9, 10]**. These test whether
  method and lifecycle coverage generalises to a domain unlike the loan tasks.
- Grounding: every class is a real Fineract savings dimension; Rafiki's answers are set off both the
  textbook and Fineract defaults (e.g. Fineract defaults withholding-tax and dormancy-tracking to false;
  Rafiki turns both on; Fineract's common calc is daily balance, Rafiki uses average daily balance).
- No arm is told which decisions are method or lifecycle, or what the task is probing.
