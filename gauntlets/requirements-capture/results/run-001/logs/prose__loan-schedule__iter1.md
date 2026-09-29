# prose — loan-schedule — iteration 1

Model (author): claude-opus · Questions asked: 9 · Captured: 12/14 · Bespoke captured: 4/6

## Conversation

### Round 1
_Step reasoning:_ The brief omits amortisation method, rate/day-count convention, first-period and payment-date handling, and rounding/residual policy, none of which can be reliably inferred, so I must ask before specifying.

Q: Which amortisation method should the schedule use: equal total instalments (annuity/EMI, where each payment is the same and the principal/interest split changes), equal principal (fixed principal plus declining interest), or interest-only with a balloon at term end?
A: Equal principal: a constant principal portion each period (P/n), with interest charged on the reducing balance, so the total instalment decreases over the term. Not equal instalments/EMI, not interest-only with a balloon.

Q: How is the periodic interest rate derived from the annual nominal rate: simple division by 12, or a day-count convention (e.g. actual/365, actual/360, 30/360) applied to the days in each period?
A: 30/360 day-count: every month is treated as 30 days, the year as 360. Interest is computed once per monthly repayment period, not by daily accrual. The periodic rate is the annual nominal rate multiplied by 30/360.

Q: When is the first instalment due, and does the disbursement date affect the first period's interest (i.e. is there a stub or odd first period between disbursement and the first payment date, or is every period treated as a full month)?
A: First instalment is due on the disbursement date plus one month; subsequent instalments fall monthly thereafter. If disbursement precedes the first period start date, a stub interest charge is levied for those extra days — partial-period interest is allowed and charged.

Q: What rounding policy applies: to how many decimal places / minor units should interest and principal be rounded each period, and how should the residual be absorbed (typically adjust the final instalment so the balance closes to exactly zero)?
A: Amounts are in KES to 2 decimal places, but each instalment is rounded to the whole shilling (no cents). The accumulated rounding difference across all periods is settled in the final instalment so the closing balance is exactly zero. Within each period, interest is computed and rounded first; principal is the remainder of the rounded instalment.

Q: Should each period's interest be computed on the outstanding balance at the start of that period, and must the running balance reach exactly zero at the final instalment?
A: Yes to both. Interest each period is computed on the opening (outstanding) balance for that period, using the declining-balance method. The schedule must close so the final instalment brings the running balance to exactly zero, with the final instalment adjusted to absorb any accumulated rounding residual.

### Round 2
_Step reasoning:_ The stub-interest answer conflicts with the disbursement+1-month rule, and input/output shapes plus numeric edge cases remain unspecified and materially affect a correct implementation.

Q: The first instalment is due disbursement + 1 month, yet you also said a stub charge applies when disbursement precedes the first period start date. Can you reconcile these: under what circumstances does a stub period actually arise, and how are its days counted (30/360 partial days) — is the stub interest attached to the first instalment, or charged as a separate item at disbursement?
A: A stub arises when the disbursement date does not coincide with the nominal start of the first regular monthly period — for example, funds are released on the 10th but the monthly cycle is anchored to the 1st of the following month. In that case the stub covers the days between disbursement and the first period-start date. Under 30/360, stub days = (30 − disbursement day-of-month), and stub interest = principal × annual rate × stub_days / 360. The answer key records that stub interest is levied but does not specify whether it appears as a separate disbursement-day charge or is folded into instalment 1. [default, not policy]: attach it to instalment 1 as additional interest; the first due date remains disbursement date + 1 month.

Q: For the stub period, does it add an extra entry to the schedule (so n+1 rows), or is the stub interest simply added on top of instalment 1's normal interest while the principal portion of instalment 1 stays P/n?
A: The answer key does not specify whether the stub produces an extra schedule row. [default, not policy]: fold the stub into instalment 1 — the schedule has exactly n rows. Instalment 1 interest = stub interest + one full period's interest (both computed then rounded per the within-period rounding rule); instalment 1 principal = P/n; total instalment 1 is rounded to the whole shilling as normal. No n+1 row is added.

Q: How should the engine handle edge cases: a zero (0%) annual interest rate, a term of exactly one instalment, and a principal that does not divide evenly into n whole shillings — are these all valid inputs the function must support, and does the final-instalment residual absorption cover the uneven-division case?
A: A zero annual interest rate is valid: every instalment is simply P/n (interest = 0), rounded to the whole shilling with the residual settled in the final instalment. A term of exactly one instalment is valid: that single instalment carries any stub interest plus one period's interest and the full principal, adjusted so the closing balance is exactly zero. Zero or negative principal or term are explicitly rejected as invalid with an error. Uneven principal division (principal not a whole-shilling multiple of n) is valid: the final-instalment residual absorption handles the rounding shortfall and guarantees the closing balance reaches exactly zero.

Q: What is the exact input shape of the `loan` argument and the expected output shape of the schedule (field names and types for principal, annual rate, term, disbursement date; and per-row fields for instalment number, due date, opening balance, interest, principal, total instalment, closing balance)?
A: Input — { principal: number (KES, positive), annualRate: number (decimal, e.g. 0.12 for 12%, non-negative), termMonths: integer (number of monthly periods, positive), disbursementDate: string (ISO 8601 date) }. Output — { schedule: Array<{ periodNumber: integer, dueDate: string (ISO 8601), openingBalance: number (2 dp), interest: number (2 dp), principal: number (whole shilling, 0 dp), instalment: number (whole shilling, 0 dp), closingBalance: number (2 dp) }>, totalCostOfCredit: number (sum of all interest, 2 dp), apr: number (actual/365 basis, decimal) }. Field names are [default, not policy] — rename to match your codebase conventions.

### Round 3 (process signalled done)
_Step reasoning:_ All material policy decisions (equal-principal method, 30/360 day-count, stub handling, whole-shilling rounding with final-instalment residual, edge cases, and I/O shape) are resolved; remaining ambiguities have stated defaults, so I have enough to write the specification.

(no questions this round)

## Produced specification

# Repayment schedule engine — requirements specification

## 1. Purpose and scope

Implement `generate_schedule(loan)`, a pure function that takes a disbursed loan and returns its full repayment schedule plus two summary figures. The schedule lists, for every instalment, the interest due, the principal due, and the running balance, computed by the equal-principal (declining-balance) method under a 30/360 day-count convention, with amounts rounded to the whole Kenyan shilling and the final instalment adjusted so the outstanding balance closes to exactly zero.

The function is deterministic and has no side effects. Given the same input it must always return the same output.

## 2. Interface

### 2.1 Input

The `loan` argument is an object with the following fields. Field names below are the reference names; they may be renamed to match codebase conventions, but the types and meanings are fixed.

- `principal`: number, KES, must be strictly positive.
- `annualRate`: number, the annual nominal interest rate as a decimal (e.g. `0.12` for 12%), must be non-negative (zero is allowed).
- `termMonths`: integer, the number of monthly instalment periods, must be strictly positive.
- `disbursementDate`: string, an ISO 8601 calendar date (`YYYY-MM-DD`), the date the funds were released.

### 2.2 Output

The function returns an object:

- `schedule`: an array of exactly `termMonths` rows (no extra stub row), each with:
  - `periodNumber`: integer, 1-based instalment index.
  - `dueDate`: string, ISO 8601 date on which the instalment falls due.
  - `openingBalance`: number, outstanding balance at the start of the period, 2 decimal places.
  - `interest`: number, interest charged for the period, a whole-shilling amount presented to 2 decimal places (cents always `.00`).
  - `principal`: number, principal repaid in the period, whole shilling (0 decimal places).
  - `instalment`: number, total payment for the period (`interest + principal`), whole shilling (0 decimal places).
  - `closingBalance`: number, outstanding balance after the payment, 2 decimal places.
- `totalCostOfCredit`: number, the sum of the `interest` field across all rows, 2 decimal places.
- `apr`: number, the annual percentage rate on an actual/365 basis, as a decimal (see section 10).

Invariants that must hold for every returned schedule:

- `schedule.length === termMonths`.
- Row 1 `openingBalance === principal`.
- For each row, `closingBalance === openingBalance − principal` (row principal).
- For each row after the first, `openingBalance === previous.closingBalance`.
- The final row `closingBalance === 0` exactly.
- For each row, `instalment === interest + principal`.

## 3. Validation

Reject invalid input by raising/throwing an error (do not return a partial schedule):

- `principal <= 0` is invalid.
- `termMonths <= 0`, or non-integer `termMonths`, is invalid.
- `annualRate < 0` is invalid.
- A missing or unparseable `disbursementDate` is invalid.

`annualRate === 0` and `termMonths === 1` are both valid and must be supported (see section 11).

## 4. Amortisation method

Use the equal-principal method. The principal portion is constant across the regular periods at `principal / termMonths`. Interest is charged on the reducing (opening) balance each period, so the total instalment declines over the term as the balance falls. Do not use equal-instalment/EMI amortisation, and do not use interest-only with a balloon.

## 5. Interest calculation (30/360)

Interest accrues on a 30/360 day-count basis: every month is treated as 30 days and the year as 360 days. Interest is computed once per monthly repayment period, not by daily accrual.

The periodic rate is:

```
periodicRate = annualRate * 30 / 360   // equivalently annualRate / 12
```

Each regular period's interest is computed on the opening (outstanding) balance for that period:

```
interestRaw = openingBalance * periodicRate
```

## 6. Instalment timing and due dates

The first instalment is due on the disbursement date plus one calendar month. Each subsequent instalment falls due one calendar month after the previous one.

```
dueDate(1) = disbursementDate + 1 month
dueDate(k) = disbursementDate + k months   // k = 1 .. termMonths
```

The number of schedule rows equals `termMonths`; the stub (section 7) does not add a row and does not shift the first due date.

## 7. Stub period

A stub period arises when the disbursement date does not coincide with the nominal start of the first regular monthly period (for example, funds released on the 10th while the monthly cycle is anchored to the 1st of the following month). The stub covers the days between disbursement and that first period-start date and attracts partial-period interest.

Under 30/360 the stub is computed from the disbursement day-of-month:

```
stubDays     = 30 - dayOfMonth(disbursementDate)
stubInterest = principal * annualRate * stubDays / 360
```

When `stubDays <= 0` (disbursement on day 30 or later of the 30/360 month, i.e. no gap to the period start) no stub interest is levied.

The stub is folded into instalment 1; it does not create an `n+1` row and does not move the first due date, which remains disbursement + 1 month. Specifically:

- Instalment 1 interest = stub interest + one full period's interest. Each component is computed and rounded to the whole shilling per the within-period rounding rule (section 8), then combined.
- Instalment 1 principal portion is `principal / termMonths`, exactly as any regular period.
- Instalment 1 total is rounded to the whole shilling as normal.

(The stub interest is levied on instalment 1; it is not emitted as a separate disbursement-day line item. Whether it appears separately or folded is an author default, resolved here in favour of folding, per section 13.)

## 8. Rounding and residual absorption

All amounts are denominated in KES. Internally, balances may be tracked to 2 decimal places, but every instalment is rounded to the whole shilling, with no cents in the `principal` and `instalment` outputs.

Within each period the order is fixed: interest is computed and rounded first, then principal is taken as the remainder of the rounded instalment.

For a regular period k (1 < k < n, and period 1 with its stub component added into the interest term):

```
interest_k    = round_to_shilling(interestRaw_k)          // plus stub for k = 1
instalment_k  = round_to_shilling( (principal / termMonths) + interest_k )
principal_k   = instalment_k - interest_k
closingBalance_k = openingBalance_k - principal_k
```

Because each rounded instalment differs slightly from the exact `P/n + interest`, a rounding residual accumulates across the term. This residual is settled entirely in the final instalment so that the schedule closes exactly.

For the final period n:

```
interest_n   = round_to_shilling(interestRaw_n)
principal_n  = openingBalance_n            // whatever principal remains, to close the balance
instalment_n = principal_n + interest_n
closingBalance_n = 0                        // exactly
```

The final principal absorbs any accumulated whole-shilling rounding difference and any uneven-division shortfall, guaranteeing `closingBalance_n === 0`.

Rounding mode: round half away from zero (round half up) to the nearest whole shilling. (Half-way tie handling is not stated by the stakeholder; resolved by the author per section 13.)

## 9. Per-period algorithm

```
validate(loan)                                  // section 3
periodicRate = annualRate * 30 / 360
regularPrincipal = principal / termMonths       // exact, unrounded
stub = max(0, 30 - dayOfMonth(disbursementDate))
stubInterest = round_to_shilling(principal * annualRate * stub / 360)

balance = principal
for k in 1 .. termMonths:
    opening = balance
    fullInterest = round_to_shilling(opening * periodicRate)
    interest = (k == 1) ? (fullInterest + stubInterest) : fullInterest
    if k == termMonths:
        principalPortion = opening                 // close exactly
    else:
        instalment = round_to_shilling(regularPrincipal + interest)
        principalPortion = instalment - interest
    instalment = principalPortion + interest
    closing = opening - principalPortion
    emit row { periodNumber: k, dueDate: disbursementDate + k months,
               openingBalance: opening (2dp), interest (2dp),
               principal: principalPortion (0dp), instalment (0dp),
               closingBalance: closing (2dp) }
    balance = closing
```

For `termMonths === 1`, the single period is the final period: its interest is stub interest plus one full period's interest, its principal is the full outstanding principal, and its closing balance is zero.

## 10. Aggregate outputs

`totalCostOfCredit` is the sum of the per-row `interest` values, to 2 decimal places. Because each period's interest is a whole-shilling amount, the sum is a whole-shilling amount presented to 2 decimal places.

`apr` is the annual percentage rate expressed as a decimal on an actual/365 basis. The stakeholder specified the basis (actual/365) but not the precise formula; resolved by the author (section 13) as the annualised rate `r` that makes the present value of the scheduled instalments, each discounted from the disbursement date to its due date over the actual number of calendar days divided by 365, equal to the disbursed principal:

```
principal = Σ_k  instalment_k / (1 + r)^(actualDays(disbursementDate, dueDate_k) / 365)
```

Solve for `r` numerically (e.g. bisection or Newton-Raphson) and return it as a decimal. When `annualRate === 0` and there is no stub interest, `apr === 0`.

## 11. Edge cases

- Zero interest rate (`annualRate === 0`): every period's interest is 0 (and stub interest is 0). Each instalment is `principal / termMonths` rounded to the whole shilling, with the residual settled in the final instalment so the balance closes to zero.
- Single instalment (`termMonths === 1`): one row carrying any stub interest plus one full period's interest, plus the entire principal, with closing balance exactly zero.
- Uneven principal division (`principal` not a whole-shilling multiple of `termMonths`): valid. The per-period rounding leaves a residual that the final-instalment absorption clears, so the closing balance still reaches exactly zero.
- Zero or negative principal, and zero, negative, or non-integer term: rejected as invalid (section 3).

## 12. Worked example (illustrative)

Input: `principal = 100000`, `annualRate = 0.12`, `termMonths = 12`, `disbursementDate = 2026-01-10`.

- `periodicRate = 0.12 * 30 / 360 = 0.01`.
- `regularPrincipal = 100000 / 12 = 8333.333…`.
- Stub: `stubDays = 30 − 10 = 20`; `stubInterest = 100000 * 0.12 * 20 / 360 = 666.67 → 667`.
- Period 1: full interest `= 100000 * 0.01 = 1000 → 1000`; `interest = 1000 + 667 = 1667`. Instalment `= round(8333.33 + 1667) = round(10000.33) = 10000`; `principal = 10000 − 1667 = 8333`; opening `100000.00`, closing `91667.00`; due `2026-02-10`.
- Period 2: interest `= round(91667 * 0.01) = round(916.67) = 917`; instalment `= round(8333.33 + 917) = round(9250.33) = 9250`; principal `= 9250 − 917 = 8333`; opening `91667.00`, closing `83334.00`; due `2026-03-10`.
- Periods 3–11 continue on the declining balance in the same way.
- Period 12 (final): interest `= round(openingBalance * 0.01)`; principal `= openingBalance` (the full remaining balance, absorbing accumulated rounding); closing `= 0.00`; due `2027-01-10`.

## 13. Assumptions resolved by the author (not stakeholder policy)

These details were neither in the brief nor settled by the stakeholder and are resolved here by engineering judgement. They should be confirmed before release.

- Output field names follow the reference names above but may be renamed to codebase conventions.
- Stub interest is folded into instalment 1 rather than emitted as a separate disbursement-day charge; the schedule has exactly `termMonths` rows.
- With the given input shape the only date available is `disbursementDate`, so the nominal first period start is taken as implied by the 30/360 stub formula (`stubDays = 30 − dayOfMonth`); no separate cycle-anchor field is read.
- Whole-shilling rounding uses round-half-up (away from zero).
- Month arithmetic for due dates adds calendar months; when the disbursement day-of-month does not exist in a target month (e.g. the 31st), the due date clamps to the last day of that month.
- The APR is computed as the internal rate of return that equates the present value of the scheduled instalments, discounted actual/365 from the disbursement date to each due date, to the disbursed principal, solved numerically.

## Auditor verdict

_The spec correctly captures 12 of 14 decisions (coverage 12/14 = 0.857), including all bespoke off-default choices for amortisation (#2), 30/360 (#3), interest period (#4), stub interest (#5), instalment rounding (#7), within-period rounding order (#8), and the actual/365-disclosure-over-30/360-accrual quirk (#14). The two gaps are the lifecycle-event method choices that fall outside a single-shot schedule generator: early full settlement rebate via Rule of 78 (#10) and partial prepayment re-amortisation keeping the term fixed (#11), neither of which the spec mentions at all._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §1/§4: "the equal-principal (declining-balance) method"; §4 "Interest is charged on the reducing (opening) balance each period" | Spec explicitly uses declining balance on the reducing principal, matching the reference exactly. |
| 2 | yes | **yes** | §4: "Use the equal-principal method. The principal portion is constant across the regular periods at principal / termMonths... so the total instalment declines over the term... Do not use equal-instalment/EMI amortisation" | Constant P/n principal, interest on reducing balance, declining instalment, and explicit rejection of EMI — matches the reference precisely. |
| 3 | yes | **yes** | §5: "Interest accrues on a 30/360 day-count basis: every month is treated as 30 days and the year as 360 days." | Exact match to the 30/360 reference answer, not actual/365. |
| 4 | yes | **yes** | §5: "Interest is computed once per monthly repayment period, not by daily accrual." | Interest calculation period equals the repayment period, not daily — matches reference. |
| 5 | yes | **yes** | §7: stub period "covers the days between disbursement and that first period-start date and attracts partial-period interest"; stubInterest formula folded into instalment 1 | Spec charges partial-period stub interest for the gap from disbursement, capturing the material decision that partial-period interest is allowed and levied from the disbursement date. |
| 6 | yes | **yes** | §1/§8: amounts "rounded to the whole Kenyan shilling"; balances "tracked to 2 decimal places"; §2.2 openingBalance/closingBalance "2 decimal places" | Currency is KES and precision is 2 decimal places, matching the reference. |
| 7 | yes | **yes** | §8: "every instalment is rounded to the whole shilling... This residual is settled entirely in the final instalment so that the schedule closes exactly." | Whole-shilling instalments with accumulated rounding difference absorbed in the final instalment — exact match. |
| 8 | yes | **yes** | §8: "interest is computed and rounded first, then principal is taken as the remainder of the rounded instalment"; principal_k = instalment_k - interest_k | Interest rounded first, principal is the remainder of the rounded instalment — matches the reference ordering. |
| 9 | yes | **yes** | §2.2/§8: "The final row closingBalance === 0 exactly"; principal_n = openingBalance_n to close | Final instalment reconciles so the closing balance is exactly zero — matches reference. |
| 10 | no | no | absent | The spec never addresses early full settlement, payoff, or interest rebate; Rule of 78 is not mentioned anywhere. |
| 11 | no | no | absent | The spec never addresses partial prepayment, extra payments, or re-amortisation strategy (term-fixed vs instalment-fixed). |
| 12 | yes | **yes** | §3: "principal <= 0 is invalid"; "termMonths <= 0, or non-integer termMonths, is invalid"; reject by throwing an error | Zero/negative principal and zero/negative/non-integer term are rejected as invalid errors — matches reference. |
| 13 | yes | **yes** | §6: "The first instalment is due on the disbursement date plus one calendar month. Each subsequent instalment falls due one calendar month after the previous one." | First due date is disbursement + one month, monthly thereafter — exact match. |
| 14 | yes | **yes** | §2.2 schedule rows (dueDate, openingBalance, interest, principal, instalment, closingBalance), totalCostOfCredit, apr; §10 "apr is the annual percentage rate expressed as a decimal on an actual/365 basis" while accrual is 30/360 | Returns the full per-period schedule, total cost of credit, and APR disclosed on actual/365 despite 30/360 accrual — the exact dual-day-count regulatory quirk in the reference. |
