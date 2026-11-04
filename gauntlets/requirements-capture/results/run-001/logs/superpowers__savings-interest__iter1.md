# superpowers — savings-interest — iteration 1

Model (author): claude-opus · Questions asked: 7 · Captured: 5/14 · Bespoke captured: 3/10

## Conversation

### Round 1
_Step reasoning:_ Architectural task with an underspecified brief; per the brainstorming process I ask one focused question at a time, starting with the core intent that governs the interest computation.

Q: Before I sketch a design, I want to get the intent right: when `post_interest(account, period)` runs, is it posting interest that has accrued once at the end of the period (simple interest on the daily balances), or is interest meant to compound within the period, for example accruing daily and folding back into the balance it earns on? Knowing which model this institution uses drives almost everything else about the calculation.
A: Interest compounds daily within the period: each day's accrued interest joins the base for the next day's accrual, rather than simple interest applied once to the average balance at period end.

### Round 2
_Step reasoning:_ Compounding is established; the next material, un-inferable policy is the day-count convention for converting the annual rate to a daily rate, so I ask that one question next per the one-at-a-time discipline.

Q: Now that I know it compounds daily, I need the day-count convention that turns the annual rate into a daily rate: does this institution divide the annual rate by 365 every day, by 360, or by the actual number of days in the year (366 in a leap year)? This choice changes every day's accrual, so I want to use the one your institution has settled on rather than guess.
A: 360

### Round 3
_Step reasoning:_ Compounding and day-count are settled; rounding policy is the next material, non-inferable decision that changes every day's compounding base, so I ask it before moving to which daily balance and posting mechanics.

Q: When each day's interest is accrued, do you round it before folding it into the base for the next day, and if so to what precision and with which rule, or does the accrual carry full unrounded precision through the period and round only the final posted total? For example, round each day to the nearest cent (half-up), or keep full precision and round once at posting?
A: Carry full unrounded precision through the period; round only the final posted total. Rounding at posting uses floor (truncate) to two decimal places — never half-up.

### Round 4
_Step reasoning:_ Day-count convention and rounding are settled, but how accrued interest folds into the given daily balance history is the next material, non-inferable policy that governs the whole compounding calculation.

Q: I need to understand how daily compounding interacts with the daily balance history the account already carries. The history gives a recorded balance for each day (driven by deposits and withdrawals). When interest compounds daily, is each day's accrual base the recorded balance for that day *plus* all interest accrued earlier in the period (interest folds on top of the transaction-driven balance), or is the recorded daily balance treated as already complete so the compounding only ever earns interest on the balances as given? In other words, does the accrued interest itself feed back into the base the balance history provides?
A: Accrued interest folds back into the base. Each day's accrual base is the recorded transaction-driven balance for that day plus all interest accrued within the period up to that point. The period's running accrual total grows on top of the balance history — it is not treated as a separate ledger that only settles at posting.

### Round 5
_Step reasoning:_ Core computation policies are settled, but the period's day-count boundary (inclusive vs half-open endpoints) is still un-inferrable and changes every result, so I ask it before designing.

Q: I still need the period boundary convention, because it sets how many daily accruals happen. For `post_interest(account, period)` over a period with a start and end date, which days accrue interest: is the period half-open so interest accrues on each day from the start date up to but not including the end date, or closed so both the start and end dates accrue (counting one more day)? And symmetrically, on the very first day of the period does the opening balance already earn interest, or does accrual begin the day after? I want the exact set of days that contribute an accrual rather than guess the endpoint handling.
A: The period is half-open: [start, end). Interest accrues on each day from the start date up to but not including the end date. The start date itself earns interest — the opening balance (plus any accrued-to-date within the period) contributes an accrual on that day. The end date is excluded from the period it closes and will be included as the start of the next period.

### Round 6
_Step reasoning:_ Core computation (compounding, 360 day-count, floor rounding, interest fold-back, half-open period) is pinned; the remaining non-inferable material policy is how accrual handles zero/negative daily balances, which affects the running base.

Q: One more policy I can't safely infer before I sketch the design: how does accrual treat a day whose recorded balance is zero or negative (an overdrawn day)? Does that day still accrue at the same daily rate on the negative base (so the running accrual can be reduced or go negative), does it accrue nothing (floored at zero for that day), or does the institution apply a different rate to negative balances? This changes the running base on those days, so I'd rather have your institution's rule than guess.
A: The account never goes negative, so negative-balance days do not arise at this institution. A day whose recorded transaction-driven balance (before the period's running accrual is added) is zero accrues zero interest for that day — the running accrual total is unchanged. The zero day does not reduce or reset the running accrual built up from prior days in the period.

### Round 7
_Step reasoning:_ Six policies are pinned down, but the fate of the sub-cent remainder dropped by floor-truncation at posting (discarded vs carried forward) is a material, non-inferable institutional choice, so I ask it before treating requirements as complete.

Q: One posting-mechanics policy I can't safely infer: when the final total is truncated with floor to two decimals, what happens to the sub-cent fraction that gets dropped? Is that residual simply discarded (the institution keeps it and each period starts its accrual fresh from zero), or is the truncated remainder carried forward and added to the next period's accrual so no fractional interest is permanently lost? Institutions differ here and it changes long-run results, so I'd rather have your rule than guess.
A: The residual is discarded — the bank keeps the sub-cent fraction. Each period's accrual starts fresh from zero; no remainder is carried forward.

### Round 8 (process signalled done)
_Step reasoning:_ Seven rounds have captured every material policy the brief omitted and that can't be inferred — compounding model, 360 day-count, full-precision accrual with floor-to-cent posting, interest folding into the base, half-open [start, end) boundaries, zero-balance day handling, and discarded sub-cent residual — so requirements gathering is complete.

(no questions this round)

## Produced specification

# Interest engine — daily compounding interest posting

## Purpose and intent

This specifies the interest engine for the institution's savings accounts. Given an account carrying a daily balance history over a period and an annual interest rate, the engine computes the interest the account earns over the period and posts it. The public interface is `post_interest(account, period)`, which returns the interest posted and the account's updated balance.

The understanding agreed with the stakeholder, in their words: interest compounds daily within the period; each day's accrued interest joins the base for the next day's accrual. This is not simple interest on an average balance, and it is not a separate ledger that only settles at posting. The running accrual grows on top of the transaction-driven balance history day by day, and only the final total is posted (and rounded) once.

Everything below is a decision the stakeholder confirmed, except where a subsection is explicitly labelled a design decision. Design decisions cover mechanics the stakeholder was not asked about; they are resolved here explicitly rather than left ambiguous, and none of them fabricate a policy answer the stakeholder did not give.

## Computation model

### Compounding

Interest compounds daily within the period. Each day's accrued interest folds into the base that the following day earns interest on. There is a single running accrual total for the period; it starts at zero at the period start and grows each day.

### Day-count convention and daily rate

The annual interest rate is converted to a daily rate by dividing by 360 (a fixed 360-day year). The daily rate is `annual_rate / 360`. This divisor is fixed regardless of leap years or the actual number of days in the calendar year.

### Accrual base per day

For each accruing day, the accrual base is the recorded transaction-driven balance for that day (the balance the account's history carries for that day, driven by deposits and withdrawals) **plus** all interest accrued within this period up to and including the prior days. Accrued interest feeds back into the base:

```
base(day)      = recorded_balance(day) + running_accrual_before(day)
accrual(day)   = base(day) * daily_rate
running_accrual_after(day) = running_accrual_before(day) + accrual(day)
```

The recorded daily balance is not treated as already complete. The period's running accrual total compounds on top of the balance history.

### Precision

All accrual arithmetic carries full, unrounded precision through the entire period. No per-day rounding occurs. Rounding happens exactly once, at posting, on the final accrued total. Use an exact decimal representation (see design decisions) so that intra-period accruals are not silently truncated by binary floating point.

## Period boundary convention

The period is half-open: `[start, end)`. Interest accrues on each day from the start date up to but not including the end date.

- The start date itself accrues. On the first day, the opening balance (the recorded balance for the start date, plus any accrued-to-date within the period, which is zero on the first day) contributes an accrual.
- The end date is excluded from the period it closes. It will be included as the start date of the next period.

The set of accruing days is therefore every date `d` with `start <= d < end`.

## Zero-balance and negative-balance days

The account never goes negative at this institution, so negative-balance days do not arise and no negative-balance rule is defined.

A day whose recorded transaction-driven balance (before the period's running accrual is added) is zero accrues zero interest for that day. On such a day the running accrual total is left unchanged. A zero day does not reduce or reset the running accrual built up from prior days in the period; accrual simply pauses for that day and resumes on the next non-zero day carrying the accumulated total forward.

Note that this rule keys off the **recorded** balance being zero, not the accrual-inclusive base. A day with a zero recorded balance but a positive running accrual still accrues zero that day.

## Posting and rounding

At the end of the period the running accrual total is the full-precision interest earned. Posting applies:

1. **Round the final total** to two decimal places using floor (truncate towards zero for the non-negative values that arise here) — never half-up. The dropped sub-cent fraction is the residual.
2. **Discard the residual.** The institution keeps the sub-cent fraction. No remainder is carried forward. Each period's accrual starts fresh from zero; there is no stored carry between periods.
3. **Post** the truncated two-decimal amount to the account: the interest posted is this amount, and the account's updated balance is its prior balance plus the posted interest.

The return value of `post_interest(account, period)` is the interest posted (the truncated two-decimal amount) and the account's updated balance.

## Interface

```
post_interest(account, period) -> { interest_posted, updated_balance }
```

- `account` carries a daily balance history (a recorded balance per day) and the annual interest rate, and a current balance to which interest is posted.
- `period` has a start date and an end date, interpreted as the half-open interval `[start, end)`.
- Returns the interest posted for the period and the account's updated balance after posting.

## Design decisions (not asked of the stakeholder; resolved here)

These are mechanics the brief and conversation did not settle. They are fixed explicitly so the specification has no ambiguity. They do not assert any policy the stakeholder declined to state.

- **Numeric type.** Use an exact decimal type (e.g. arbitrary-precision decimal) for balances, the daily rate, and the running accrual, so that "full unrounded precision" is honoured and the final floor-to-two-decimals is exact. Binary floating point is not used for the accrual.
- **Rate semantics.** The annual rate is a decimal fraction (e.g. 0.05 for 5%). The daily rate is `annual_rate / 360` carried at full precision.
- **Balance lookup per day.** The engine reads the recorded balance for each accruing date from the account's daily balance history. It is assumed the history provides a balance for every date in `[start, end)`. If a date in the period is missing from the history, that is an input error (see error handling) rather than an implicit zero.
- **Floor direction.** All accrued totals in scope are non-negative (the account never goes negative and rates are non-negative), so floor to two decimals is equivalent to truncation towards zero. The rule is stated as floor for definiteness.
- **Posting target.** Interest is posted to the account's current balance; the updated balance returned is `prior_balance + interest_posted`. The daily balance history itself is not rewritten by posting.

## Error handling

- An empty period (`start == end`, or `start > end`) yields no accruing days, an interest posted of `0.00`, and an unchanged balance.
- A missing recorded balance for any date within `[start, end)` is an input error; the engine does not silently substitute zero.
- A negative recorded balance is outside the institution's stated invariant; the engine treats it as an input error rather than accruing on a negative base, since no negative-balance policy is defined.

## Testing

Cover the confirmed policies directly:

- **Daily compounding vs simple interest:** a multi-day constant-balance period earns more than simple interest on the same balance, and matches the day-by-day fold-in calculation exactly.
- **360 day-count:** the daily rate equals `annual_rate / 360`; leap years and calendar-year length do not change it.
- **Full precision then floor at posting:** intermediate accruals are never rounded; the posted total equals the full-precision sum truncated to two decimals, and differs from a per-day-rounded computation on a case constructed to expose the difference.
- **Floor not half-up:** a total whose third decimal is >= 5 still truncates down (e.g. 1.239 posts as 1.23, not 1.24).
- **Residual discarded:** running two consecutive periods gives the same result as computing each independently from a fresh zero accrual; no carry appears.
- **Half-open boundary:** the start date accrues, the end date does not; a period `[d, d+1)` accrues exactly one day, and adjacent periods `[a, b)` and `[b, c)` neither double-count nor skip day `b`.
- **Accrual folds onto balance history:** a period with a mid-period deposit accrues on the recorded post-deposit balance plus the running accrual, not on the balances in isolation.
- **Zero day:** a zero recorded-balance day accrues nothing and leaves the running accrual unchanged; accrual resumes on the next non-zero day carrying the prior total forward, including the case where the running accrual is already positive when the zero day occurs.
- **Empty period:** posts `0.00` and leaves the balance unchanged.
- **Return contract:** `post_interest` returns both the posted interest and the updated balance, with updated balance equal to prior balance plus posted interest.


## Auditor verdict

_The spec matches on the control/convention decisions it happens to share (4, 6, 11, 12) and on daily compounding (2), but it is built on the wrong core method: it uses per-day daily-balance compounding and explicitly rejects average daily balance (1). The lifecycle decisions (8 dormancy, 9 closure, 10 escheatment), the tax (7), the minimum balance (5), the quarterly-anniversary posting (3), mid-period rate changes (13) are all absent, and the reporting shape (14) surfaces only two of six required fields. Correct on 6 of 14 (2, 4, 6, 11, 12 plus a generous 11); of the in-focus method/lifecycle six [1,2,3,8,9,10] only #2 is correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | no | "interest compounds daily within the period; each day's accrued interest joins the base for the next day's accrual. This is not simple interest on an average balance" and "The running accrual grows on top of the transaction-driven balance history day by day" | The spec explicitly adopts per-day daily-balance compounding and expressly rejects average-daily-balance. The reference requires average daily balance (sum balances, divide by days, apply rate once), which is the opposite method, so the resolution does not match. |
| 2 | yes | **yes** | "Interest compounds daily within the period. Each day's accrued interest folds into the base that the following day earns interest on." | The spec states daily compounding with each day's interest joining the base for the next day, matching the reference exactly. |
| 3 | no | no | absent | The spec computes interest over an externally supplied period and never states a posting frequency or schedule; there is no mention of quarterly posting or posting on the account-opening anniversary. |
| 4 | yes | **yes** | "The annual interest rate is converted to a daily rate by dividing by 360 (a fixed 360-day year). The daily rate is annual_rate / 360." | The spec fixes a 360-day year and daily rate of annual_rate/360, matching the reference. |
| 5 | no | no | absent | The spec defines a zero-recorded-balance rule but no minimum balance threshold; there is no 1,000 floor for earning interest, nor any statement that sub-threshold days contribute zero while still counting in a divisor. |
| 6 | yes | **yes** | "Round the final total to two decimal places using floor ... never half-up. The dropped sub-cent fraction is the residual" and "The institution keeps the sub-cent fraction." | The spec rounds posted interest down (floor) to two decimals, never half-up, with the bank keeping the fraction, matching the reference. |
| 7 | no | no | absent | The spec makes no mention of withholding tax; posted interest is the full accrued total with no 15% deduction, net crediting, or separate tax reporting. |
| 8 | no | no | absent | The spec addresses only per-period accrual and posting; dormancy, the 12-month threshold, continued accrual while dormant, and the monthly dormancy fee of 5 are entirely absent. |
| 9 | no | no | absent | The spec never mentions account closure. While it accrues over arbitrary periods, it states no pro-rata-to-closure-date accrual-and-post-on-closing policy. |
| 10 | no | no | absent | There is no mention of escheatment, a 5-year dormant threshold, remittance to the state, or closing to a zero balance. |
| 11 | yes | **yes** | "The account never goes negative at this institution"; "A day whose recorded transaction-driven balance ... is zero accrues zero interest"; "An empty period ... yields ... an interest posted of 0.00" | The spec matches the account-never-negative (no overdraft) and zero-balance-posts-zero (recording 0.00) clauses; a negative recorded balance is treated as an input error. Negative-rate-as-invalid is only implied (rates assumed non-negative) rather than an explicit rejection, but the addressed behaviour is consistent with the reference. |
| 12 | yes | **yes** | "The period is half-open: [start, end). ... The end date is excluded from the period it closes. It will be included as the start date of the next period." | The spec uses half-open [start, end) periods, excluding the closing day and including it in the next period, matching the reference exactly. |
| 13 | no | no | absent | The account carries a single annual interest rate and the spec never addresses a mid-period rate change or per-rate-segment computation. |
| 14 | yes | no | "post_interest(account, period) -> { interest_posted, updated_balance }" | The spec's output surfaces only interest posted and updated balance. The reference requires six fields per posting (gross interest, tax withheld, net posted, average daily balance used, qualifying days, updated balance); four of these are absent, so the shape does not match. |
