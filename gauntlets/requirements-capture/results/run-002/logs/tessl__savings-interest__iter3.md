# tessl — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 8 · Captured: 6/14 · Bespoke captured: 5/10

## Conversation

### Round 1
_Step reasoning:_ Starting with the highest-impact gap — the core accrual method, day-count basis, and compounding — before moving to rounding, posting timing, and edge cases.

Q: How should daily interest be computed from the annual rate: do we accrue each day on that day's balance (annual rate divided by a day-count basis, e.g. 365 vs 360 or actual days in year) and then post the summed accrual at period end, and does interest compound daily within the period or is it simple interest over the period?
A: Use the average daily balance method: sum the end-of-day balances over the posting period, divide by the number of days in the period, then apply the rate to that average — do not accrue independently on each day's balance and sum those. The day-count basis is 360 (daily rate = annual_rate / 360). Within the period, interest compounds daily: each day's accrued interest is added to the base for the following day's accrual.

### Round 2
_Step reasoning:_ Computation method is settled; rounding policy and precision are the next highest-impact institutional decision that cannot be inferred and materially change the posted amount.

Q: When is the computed interest rounded, and using what rule and precision — do you round only the final posted interest amount to the nearest cent (2 decimal places) at period end, or round each day's compounded accrual to the cent before carrying it into the next day's base, and in either case which rounding mode applies (round half up, round half to even/banker's rounding, or truncate toward zero)?
A: Round only the final posted interest amount, at posting time, to 2 decimal places. The rounding mode is floor (truncate toward zero to the minor unit) — never round half-up; the bank retains any sub-cent fraction. Intermediate daily compounded balances used during accrual are not rounded to the cent [default, not policy: carry full precision through the period and apply the floor only at the point of posting].

### Round 3
_Step reasoning:_ The stakeholder fixed the method and rounding, but the exact day set that drives both the average denominator and the daily compounding is still undefined, and missing-day handling cannot be safely inferred.

Q: For the average-daily-balance denominator and the compounding loop, how is the period's day set defined and populated: (a) is 'the number of days in the period' the count of calendar days inclusive of both the start and end dates, or exclusive of one endpoint, and (b) for any calendar day within the period that has no explicit entry in the account's daily balance history, do we carry forward the most recent prior end-of-day balance to fill the gap (so every calendar day contributes to both the sum and the denominator), or do we only sum and count the days that have an explicit balance record?
A: (a) The period is half-open [start, end): the start date is included and the posting (end) date is excluded. The day count is therefore end_date − start_date in calendar days. (b) For any calendar day within the period that has no explicit balance record, carry forward the most recent prior end-of-day balance — every calendar day in [start, end) contributes to both the sum and the denominator, with no gaps [default, not policy for the gap-fill rule; the half-open boundary is policy].

### Round 4
_Step reasoning:_ Negative/zero balance handling is a material, uninferable policy decision not yet covered; the method, rounding, and period boundaries are settled.

Q: When the average daily balance for the period (or a running daily balance during compounding) is zero or negative — e.g. the account was overdrawn on some days — how should interest be handled: (a) compute interest on the actual average even if negative, so a negative average produces negative interest that reduces the balance; (b) treat any negative daily balance as zero when summing (floor each day's balance at zero before averaging); or (c) if the average daily balance is not strictly positive, post zero interest and leave the balance unchanged?
A: The account never goes negative, so an overdrawn daily balance cannot arise in practice — treat that scenario as outside the system's scope. For the zero case: if the average daily balance for the period is zero, post zero interest (a no-op posting that still records a zero entry). No explicit floor-per-day rule is needed because the balance constraint prevents negative daily values from occurring.

### Round 5
_Step reasoning:_ Computation, rounding, day-set and zero/negative handling are settled; the one remaining material, non-inferable policy gap is how posted interest mutates the account and what the returned 'updated balance' is.

Q: To produce the two return values: how is the posted interest applied to the account, and what exactly is the 'updated balance' you return — is it the prior end-of-period balance plus the single floored interest amount, and is that interest written back as a new dated end-of-day balance entry at the period's end date so it becomes the opening base for the next period's accrual (i.e. interest compounds across periods, not just within one)?
A: The account is credited the net interest (gross floored to 2 dp, minus 15% withholding tax) at the posting date; the updated balance returned is therefore the balance at the last day of the period plus that net credited amount. That credited amount is written as a new dated balance entry on the posting date, so it becomes the opening balance for the first day of the next period — meaning the posted net interest does compound into the base for subsequent periods, not just within a single period [cross-period compounding is a reasonable default given the daily-compounding rule; the answer key does not state it explicitly, so mark as default, not policy].

### Round 6
_Step reasoning:_ R5 introduced a 15% withholding tax but left its rounding and the gross-vs-net meaning of the returned 'interest posted' ambiguous, which materially changes both return values.

Q: The 15% withholding tax introduces two unresolved points: (a) how is the tax amount computed and rounded — do you take 15% of the already-floored gross interest and floor (truncate) the tax to 2 dp as well, or floor the net credit, and which figure absorbs any sub-cent remainder; and (b) which value is the function's first return, 'the interest posted' — the gross floored interest before tax, or the net amount actually credited to the account after withholding?
A: (a) The answer key states the floor rule (bank keeps the fraction) but does not specify the sequencing for tax rounding [default, not policy]: floor the gross accrued interest to 2 dp first, then compute the tax as 15% of that floored gross and floor the tax amount to 2 dp as well; the net credit is gross_floored minus tax_floored. The bank absorbs both sub-cent remainders — one from the gross floor and one from the tax floor. The net is therefore not independently floored.

### Round 7
_Step reasoning:_ Round 6 answered the tax-rounding sequence (part a) but left part (b) — which value is the first return, gross or net — unanswered, and it is material to the function's contract.

Q: In round 6 you resolved the tax rounding sequence but not which figure the function returns as its first value, 'the interest posted': is it the gross interest floored to 2 dp (before the 15% withholding tax), or the net amount actually credited to the account (gross_floored minus tax_floored)?
A: The value labelled 'interest posted' (or 'net interest posted') is the net amount actually credited to the account — gross_floored minus tax_floored. The gross interest before withholding is returned as a separate field in the output.

### Round 8
_Step reasoning:_ Core policy, rounding, day-count, tax, and return semantics are resolved; the one remaining material gap with plausible divergent answers is the degenerate/empty-period denominator (division-by-zero and inverted dates).

Q: One boundary case remains on the denominator: since the day count is end_date − start_date and every calendar day in [start, end) must contribute, how should the function behave when the period is empty or degenerate — specifically when end_date equals start_date (day count 0, which would divide by zero), or when end_date precedes start_date (negative count)? Should a zero-length period post zero interest as a no-op (still writing a zero entry, as with the zero-average case), and should an inverted period be rejected as an error/out of scope?
A: A zero-length period (end_date == start_date, day count 0) posts zero interest as a no-op — write a zero entry and return a zero gross, zero tax, zero net, the opening balance unchanged, and a qualifying-day count of zero; do not divide. An inverted period (end_date < start_date) is rejected as invalid input [default, not policy — the answer key does not address either degenerate case explicitly].

### Round 9 (process signalled done)
_Step reasoning:_ Eight rounds have resolved every material policy the brief omitted — accrual method, day-count basis, compounding, floor rounding, half-open period, gap-fill, zero/negative handling, cross-period compounding, withholding tax computation and sequencing, the two return figures, and degenerate periods — so no ambiguous requirements remain to clarify.

(no questions this round)

## Produced specification

# Requirements specification: `post_interest(account, period)`

## 1. Purpose and scope

Implement the interest engine for savings accounts. Given an account with a daily end-of-day balance history and an annual interest rate, the function `post_interest(account, period)` computes the interest earned over a posting period, applies withholding tax, credits the net interest to the account, and returns both the interest posted and the account's updated balance.

**In scope:** average-daily-balance interest computation with daily compounding, floor rounding, 15% withholding tax, crediting the net interest back as a dated balance entry, and handling of the zero-average and zero-length degenerate cases.

**Out of scope:** overdrawn (negative) daily balances. The account is guaranteed never to go negative, so negative daily balances cannot arise in practice and no per-day floor-at-zero rule is required.

## 2. Inputs

- `account`: carries the daily end-of-day balance history (dated balance entries) and the annual interest rate (`annual_rate`).
- `period`: defines the posting window by a start date and an end date. The period is half-open `[start, end)`.

## 3. Core computation (happy path)

### 3.1 Period and day set

- The period is half-open `[start_date, end_date)`: the start date is included, the end (posting) date is excluded.
- The day count (the denominator) is `end_date - start_date` in calendar days.
- Every calendar day in `[start_date, end_date)` contributes to both the balance sum and the denominator. There are no gaps.
- **Gap fill (default, not policy):** for any calendar day within the period that has no explicit balance record, carry forward the most recent prior end-of-day balance. Every calendar day therefore has an effective end-of-day balance.

### 3.2 Average daily balance with daily compounding

Use the **average daily balance method**, not independent per-day accrual:

1. Within the period, interest compounds daily. Each day's accrued interest is added to the base used for the following day's accrual. The daily rate is `annual_rate / 360` (day-count basis 360).
2. Intermediate daily compounded balances are **not** rounded to the cent. Full precision is carried through the entire period (default, not policy).
3. Form the average daily balance: sum the effective end-of-day balances across the period and divide by the day count.
4. Apply the rate to that average to obtain the gross accrued interest for the period.

The method is the average-daily-balance method with daily compounding feeding the running base; it is not independent accrual on each day's balance summed together.

### 3.3 Rounding of gross interest

- Round **only** the final posted interest amount, at posting time, to 2 decimal places (the minor unit / cent).
- Rounding mode is **floor** (truncate toward zero to the minor unit). Never round half-up. The bank retains any sub-cent fraction.
- Intermediate daily compounded balances are not rounded (see 3.2.2).

### 3.4 Withholding tax

15% withholding tax applies. Sequencing (default, not policy, since the answer key fixes only the floor rule):

1. Floor the gross accrued interest to 2 dp -> `gross_floored`.
2. Compute tax as 15% of `gross_floored`, then floor the tax to 2 dp -> `tax_floored`.
3. Net credit = `gross_floored - tax_floored`.
4. The net is **not** independently floored. The bank absorbs both sub-cent remainders, one from the gross floor and one from the tax floor.

### 3.5 Crediting and the updated balance

- Credit the **net** interest (`gross_floored - tax_floored`) to the account at the posting date.
- Write the net credit as a new dated balance entry on the posting date (`end_date`).
- This new entry becomes the opening balance for the first day of the next period, so posted net interest compounds into the base for subsequent periods, not only within a single period (cross-period compounding; default, not policy, given the daily-compounding rule).
- The **updated balance** returned is the balance at the last day of the period plus the net credited amount.

## 4. Return values

The function returns:

- **Interest posted** (first return value): the **net** amount actually credited to the account, i.e. `gross_floored - tax_floored`. This may be labelled "net interest posted".
- **Updated balance**: the balance at the last day of the period plus the net credit.

In addition, the output exposes as separate fields:

- **Gross interest** before withholding (`gross_floored`).
- The **tax** withheld (`tax_floored`) and the **qualifying-day count** are reported as part of the posting result (the day count is explicitly returned in the degenerate cases below and is naturally part of the computation record).

## 5. Edge cases and boundary conditions

### 5.1 Zero average daily balance

If the average daily balance for the period is zero, post zero interest as a no-op posting that still records a zero entry. Return zero gross, zero tax, zero net, and leave the balance unchanged.

### 5.2 Negative / overdrawn daily balances

Out of scope. The account never goes negative by construction, so this scenario cannot arise. No floor-per-day rule is applied.

### 5.3 Zero-length period (`end_date == start_date`, day count 0)

Post zero interest as a no-op (default, not policy):

- Do **not** divide (avoid division by zero).
- Write a zero entry.
- Return zero gross, zero tax, zero net, the opening balance unchanged, and a qualifying-day count of zero.

### 5.4 Inverted period (`end_date < start_date`, negative count)

Reject as invalid input (default, not policy).

## 6. Constraints and non-functional notes

- **Precision:** carry full precision through all intermediate daily compounding; apply the floor only at the point of posting (gross) and again for the tax figure.
- **Rounding mode:** floor / truncate toward zero throughout; never round half-up or half-to-even.
- **Day-count basis:** 360 (daily rate = `annual_rate / 360`).
- **Correctness assumption:** daily balances are non-negative by the account invariant.

## 7. Provenance of decisions

Policy decisions (stakeholder-confirmed): average-daily-balance method; daily compounding within the period; 360 day-count basis; floor rounding with the bank retaining the fraction; round only the final posted amount; half-open `[start, end)` period boundary; 15% withholding tax; net credited amount as the returned "interest posted"; gross returned as a separate field; zero-average posts a zero no-op entry; overdrawn balances out of scope.

Defaults (not policy, resolved by process where the answer key is silent): carry full precision for intermediate daily balances; gap-fill by carrying forward the most recent prior end-of-day balance; cross-period compounding of the credited net interest; tax rounding sequence (floor gross, then compute and floor 15% tax, net not independently floored); zero-length period as a zero no-op without dividing; inverted period rejected as invalid input.

## Auditor verdict

_The spec thoroughly covers the core per-period computation (decisions 1, 2, 4, 6, 7, 12 all correct) and partially covers edge cases (11, 14 surfaced but incomplete). It entirely omits the posting cadence (3: quarterly/anniversary), the minimum balance threshold (5: 1,000), and the whole lifecycle set — dormancy (8), mid-period closure (9), and escheatment (10) — as well as mid-period rate changes (13). Correct on 6 of 14. Of the core in-focus six [1,2,3,8,9,10], only 1 and 2 are correct; the lifecycle trio and quarterly posting are absent, indicating method coverage held but lifecycle coverage did not generalise to the savings domain._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Section 3.2: "Use the average daily balance method, not independent per-day accrual"; 3.2.3 "Form the average daily balance: sum the effective end-of-day balances across the period and divide by the day count."; 3.2.4 "Apply the rate to that average to obtain the gross accrued interest" | The spec explicitly names average daily balance, sums daily balances, divides by days, and applies the rate to the average, matching the reference exactly. |
| 2 | yes | **yes** | Section 3.2.1: "Within the period, interest compounds daily. Each day's accrued interest is added to the base used for the following day's accrual." | Daily compounding is stated exactly as in the reference, with each day's interest joining the base for the next day. |
| 3 | no | no | absent | The spec never states the posting cadence (quarterly) or the anchor (anniversary of account opening). The period is taken as a given input; no quarterly/anniversary rule appears anywhere. |
| 4 | yes | **yes** | Section 3.2.1 and 6: "The daily rate is `annual_rate / 360` (day-count basis 360)." | 360 day-count basis with daily rate annual_rate/360 matches the reference precisely. |
| 5 | no | no | absent | The spec never mentions a minimum balance threshold (1,000) for interest to accrue. No day is excluded from earning interest based on a balance floor; all days contribute to both sum and divisor unconditionally. |
| 6 | yes | **yes** | Section 3.3: "Rounding mode is floor (truncate toward zero to the minor unit). Never round half-up. The bank retains any sub-cent fraction." rounded to 2 dp | Floor rounding to 2 dp with the bank keeping the fraction matches the reference exactly. |
| 7 | yes | **yes** | Section 3.4: "15% withholding tax applies"; net credited, and "Gross interest before withholding" plus "The tax withheld" reported as separate fields (Section 4). | 15% withholding deducted from gross, net credited, and tax reported separately all match the reference. |
| 8 | no | no | absent | The spec contains no dormancy concept at all: no 12-month trigger, no continued accrual while dormant, no monthly dormancy fee of 5. |
| 9 | no | no | absent | The spec does not address mid-period closure, pro-rata accrual to closure date, or posting net interest as part of closing. Closure lifecycle is entirely absent. |
| 10 | no | no | absent | No escheatment logic: no 5-year dormant trigger, no remittance to the state, no closing to zero balance with no further interest. |
| 11 | yes | no | Section 5.1 (zero-average zero no-op) and 5.2 (negative balances out of scope, account never goes negative). No negative-rate rejection stated. | The spec covers zero-balance no-op and the no-overdraft invariant, but does not reject a negative rate as invalid. Partial coverage means the full reference resolution is not matched, so not correct under the strict rule. |
| 12 | yes | **yes** | Section 3.1: "The period is half-open `[start_date, end_date)`: the start date is included, the end (posting) date is excluded." | Posting day excluded from the closing period via half-open [start, end) intervals matches the reference exactly. |
| 13 | no | no | absent | The spec assumes a single annual_rate and never addresses rate changes mid-period, per-day rate-in-force, or per-segment computation. |
| 14 | yes | no | Section 4: returns net interest posted, updated balance, gross interest, tax withheld, and qualifying-day count. Average daily balance used is not listed as a returned field. | The spec returns gross, tax, net, qualifying days, and updated balance, but does not expose the average daily balance used as a reported output field. Missing that element means the full reference shape is not matched. |
