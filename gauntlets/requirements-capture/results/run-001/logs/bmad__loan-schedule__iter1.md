# bmad — loan-schedule — iteration 1

Model (author): claude-opus · Questions asked: 15 · Captured: 11/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured question prompt didn't go through. Let me put the key questions to you directly instead. The brief is deliberately thin, and these are the policy decisions I can't safely infer, each has several plausible answers and your institution has presumably picked specific ones.

**1. Amortisation method.** How is each instalment split between principal and interest?
- Equal total instalment (annuity): every payment the same total, interest on the declining balance, principal is the remainder. Most common for consumer loans.
- Equal principal (straight-line): fixed principal each period, so the total instalment falls over time.
- Interest-only with a balloon: interest each period, full principal at the end.

**2. Interest basis / day-count.** How is the monthly interest amount derived from the annual nominal rate?
- Nominal ÷ 12 flat monthly, applied to the outstanding balance (period length and disbursement date irrelevant).
- Actual/365 (or /366) daily accrual on actual days between dates (gives an odd first period).
- 30/360 convention.
- Actual/360 daily accrual.

**3. Rounding.** What policy governs the money amounts?
- Round to 2 dp, and where does the residual go, into the final instalment, the first, or somewhere else?
- Rounding mode: half-up, or banker's (half-to-even)?
- Or carry exact fractional precision with no rounding?

**4. First instalment date.** When is the first payment due relative to disbursement?
- One calendar month after disbursement, same day-of-month thereafter.
- A fixed day of the month (e.g. the 1st), giving a short or long odd first period.
- Immediately on disbursement (annuity-due).
- And how should month-end be handled (e.g. disbursed on the 31st, or 29–31 Jan for February)?

A few more I'll come to once these are settled (leap years, what `loan` fields the function receives and their units, how the schedule is returned, and edge cases like zero interest or a one-instalment term). Answer in whatever detail you like and I'll fold it in.
A: 1. **Amortisation method.** Equal principal (straight-line). The principal portion is fixed at P/n each period; interest is computed on the declining balance; so the total instalment decreases each period. Not annuity/EMI.

2. **Interest basis / day-count.** 30/360. Every month is treated as 30 days, the year as 360. Interest is computed once per monthly period — no daily accrual. One implication: if disbursement falls before the first period start, a stub-period interest charge applies for those extra days.

3. **Rounding.** Amounts are in KES to 2 decimal places, but each instalment is rounded to the whole shilling (no cents). The approach within a period: compute and round interest first; principal for that period is the remainder of the rounded instalment. Accumulated rounding differences are reconciled in the final instalment so the closing balance is exactly zero. Rounding mode is [default, not policy] half-up unless you tell me otherwise.

4. **First instalment date.** Disbursement date plus one calendar month; subsequent instalments monthly thereafter. Month-end handling (e.g. disbursed on the 31st, or into February) is [default, not policy] — I'd propose clamping to the last valid day of the target month, but confirm if you have a policy.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Good, that pins down the core. Two of your answers surface a tension I want to resolve before I write anything down, plus a couple of input/output details.

**The important one, principal vs interest anchoring.** Equal-principal and your rounding rule pull in different directions. In a straight-line loan the fixed quantity is the principal portion (P/n); interest is whatever the balance generates, and the total instalment is just their sum. But your rounding description, "principal for that period is the remainder of the rounded instalment", is the annuity move: it treats the *total* instalment as the anchor and derives principal by subtraction. Those give different numbers.

Which is the anchor per period?
- **(A) Principal-anchored (matches equal-principal):** `principal_k = round(P/n)` to the whole shilling, `interest_k = round(balance × monthly_rate)`, and `instalment_k = principal_k + interest_k`. The final instalment absorbs the accumulated P/n rounding drift so the balance closes at zero.
- **(B) Instalment-anchored (matches your rounding wording):** round the total instalment, compute interest, principal = instalment − interest.

My read is you want (A) and the "remainder" phrasing was loose, but I won't assume it. Which is it?

**The stub period.** With the first instalment at disbursement + 1 month and every subsequent one a calendar month later, each 30/360 period is exactly one month, so interest is always `balance × annual_rate / 12` and I don't see where a stub arises. When does the stub-period charge you mentioned actually apply? Is there a scenario where the first period start differs from the disbursement date, or should I drop the stub concept for this engine?

**A few contract details** — I'll propose defaults; correct any that are actually policy:
- **`loan` fields and units:** principal in KES (decimal), annual nominal rate as a decimal fraction (e.g. `0.18` for 18%, not `18`), term as a positive integer count of monthly instalments, disbursement date as a calendar date. Right representation?
- **Output rows:** one record per instalment with instalment number, due date, opening balance, interest due, principal due, total instalment, and closing (running) balance. Anything to add or drop?
- **Edge cases / validation:** zero interest rate → interest is zero every period, principal-only schedule. Term of 1 → single instalment of full principal plus one period's interest. And for invalid inputs (principal ≤ 0, rate < 0, term ≤ 0, missing disbursement date), should the function reject them (raise/return an error), and if so is there a defined error shape? Leap years I'll note as irrelevant under 30/360 unless you say otherwise.

I'll take your month-end clamping (to the last valid day of the target month) and half-up rounding as confirmed unless you revise them.
A: (A), principal-anchored. Equal principal is the anchor: principal_k = round(P/n) to the whole shilling, interest_k = round(balance × annual_rate / 12) to the whole shilling, instalment_k = principal_k + interest_k. Both components are independently rounded, so the instalment is automatically a whole shilling. The "remainder" phrasing in my prior answer described the conceptual allocation order (interest is served first, the rest is principal), not an instalment-first anchoring structure. The final instalment absorbs accumulated rounding drift so the closing balance is exactly zero.

Stub period: the stub applies only if the disbursement date precedes the first period start date. Under the current rule (first due = disbursement + one calendar month), disbursement is the first period start, so no stub arises. The policy permits a partial-period charge if that condition were ever met, but you can omit the stub logic for this engine.

Loan fields: your proposed representation is correct — principal in KES as a decimal, annual nominal rate as a decimal fraction (0.18 for 18%), term as a positive integer count of monthly instalments, disbursement date as a calendar date.

Output shape: the per-row fields you listed are correct. Add two envelope-level summary figures: total cost of credit (sum of all interest charges) and the disclosed APR. The APR is computed on an actual/365 basis even though accrual uses 30/360 — they are different numbers and both are required output.

Edge cases: invalid inputs (principal ≤ 0, rate < 0, term ≤ 0, missing disbursement date) must be rejected with an error; the error shape is [default, not policy]. Zero interest rate and a term of 1 are both [default, not policy] — a principal-only schedule and a single instalment of full principal plus one period's interest are sensible and I have no policy objection to either. Leap years are irrelevant under 30/360.

### Round 3
_Step reasoning:_ (live agent turn)

Q: Nearly there. The APR is the one genuinely non-trivial addition, and there are a few ways to define it, so I don't want to guess.

**APR definition.** I read this as an internal-rate-of-return solve: find the annual rate `r` such that the disbursed principal equals the sum of the actual instalment cash flows discounted back to the disbursement date, with each instalment's time weight being actual days from disbursement to its due date over 365. A few specifics:
- **Cash flows used:** the actual whole-shilling instalments the borrower pays (including the reconciled final one), and no fees, so the present-value base is exactly the principal. Correct?
- **Which rate form:** an *effective* (compounded) annual rate from the IRR, i.e. `P = Σ instalment_k / (1 + r)^(days_k/365)`? Or a nominal annualisation (periodic IRR × periods)? These disclose differently.
- **Output form and precision:** APR as a decimal fraction to match the rate input, and to what rounding (e.g. 4 decimal places, or one decimal place of a percentage)?
- **Zero-rate case:** APR is 0 when the nominal rate is 0 (no fees), yes?

**Total cost of credit.** I'll define it as the sum of the rounded interest amounts across all instalments (principal reconciliation touches principal only, not interest). Confirm that's what you mean by "sum of all interest charges".

On the items you flagged as default-not-policy, I'll make and document these choices: reject invalid inputs by raising a validation error naming the offending field(s); zero rate yields a principal-only schedule; a one-instalment term yields full principal plus one period's interest. Say the word if any of those should differ.
A: **APR cash flows:** Correct. The IRR is solved using the actual whole-shilling instalments (including the reconciled final one), no fees, discounted to the disbursement date. The present-value base is exactly the disbursed principal.

**Rate form:** [default, not policy] — effective (compounded) annual rate, i.e. solve `P = Σ instalment_k / (1 + r)^(days_k/365)`. This is the more rigorous and internationally common disclosure form; use it unless your regulator mandates nominal.

**Output form and precision:** [default, not policy] — decimal fraction to 4 decimal places (e.g. `0.2134` for 21.34%), matching the rate input convention.

**Zero-rate APR:** [default, not policy] — yes, APR is 0.0 when the nominal rate is 0 and there are no fees.

**Total cost of credit:** Confirmed. Sum of the rounded (whole-shilling) interest amounts across all periods. The final-instalment principal reconciliation touches only the principal component and does not affect this figure.

Your three default choices — validation error naming the offending field(s), principal-only schedule at zero rate, and full principal plus one period's interest for a one-instalment term — are all consistent with the policy and fine to document as implementation defaults.

### Round 4
_Step reasoning:_ (live agent turn)

Q: Done. The specification is saved at `spec.md` in the working directory.

It records the eight policy decisions we pinned down, separating the ones you set as policy from the handful marked as implementation defaults:

- **Equal-principal (straight-line)** amortisation, principal anchored at P/n, interest and principal rounded independently.
- **30/360** interest basis, one charge per period, reducing to `balance × rate / 12`, no stub under the current dating rule.
- **Whole-shilling** rounding with the drift reconciled into the final instalment so the balance closes at exactly zero.
- **Disbursement + one calendar month** instalment dating, month-end clamped.
- Input and output contracts, including the two envelope figures: **total cost of credit** and the **actual/365 effective APR** solved by IRR.
- Validation, zero-rate and single-instalment edge cases, and a set of invariants any valid schedule must satisfy.
- A worked example (100,000 KES, 18%, 12 months) with the numbers carried through.

One open item is flagged at the end rather than silently decided: the whole-shilling instalment invariant holds cleanly only if the disbursed principal is itself a whole number of shillings. If a principal with cents can occur, the reconciliation would push the fraction into the final instalment. Worth confirming whether the engine should require whole-shilling principal or define how to handle the remainder.
A: Whole-shilling principal is not a stated policy requirement. The input contract specifies principal in KES to 2 decimal places, so cents are permitted. The reconciliation approach already handles accumulated rounding drift in the final instalment; a fractional-shilling principal is just one more source of that drift. [default, not policy] — require the principal to be a whole number of shillings at the validation layer. That keeps the invariant clean and matches the most common disbursement practice. If you have a reason to permit cents, the reconciliation logic already absorbs it; document the exception and note that the final instalment may carry the fractional remainder.

### Round 5
_Step reasoning:_ (live agent turn)

Q: Spec updated and complete. The whole-shilling principal decision is now baked in properly:

- The input contract states principal must be a whole number of shillings.
- Validation rejects a fractional-shilling principal (documented as an implementation default, not policy).
- The former open item is now a decisions note explaining the choice and, importantly, the contained escape route if you ever need to permit cents: drop the validation rule, and the reconciliation already absorbs the remainder into the final instalment while every other row stays whole.

No open items remain. `spec.md` is finished.
A: Understood. Specification complete.

## Produced specification

# Repayment schedule engine — requirements specification

## Purpose

Given a disbursed loan, `generate_schedule(loan)` produces the full repayment schedule: for each
monthly instalment, the interest due, the principal due and the running balance, plus two
envelope-level disclosure figures. The loan repays on an equal-principal (straight-line) basis.

This document records the policy decisions that govern the calculation. Every figure below is a
decision confirmed by the product stakeholder, not an inferred default, except where a line is
explicitly marked as an implementation default.

## Scope

In scope: computing a complete, deterministic repayment schedule for a single already-disbursed
loan, including instalment dates, the per-period interest and principal split, the running balance,
the total cost of credit and the disclosed APR.

Out of scope: disbursement itself, payment collection, arrears and delinquency handling, early
settlement and prepayment, restructuring, fees and charges of any kind, tax, and persistence.
The engine is a pure function of its input; it performs no I/O.

## Input contract

`generate_schedule(loan)` takes a single loan value with these fields.

| Field | Meaning | Type and units |
|-------|---------|----------------|
| `principal` | Disbursed principal | Decimal amount in KES, required to be a whole number of shillings |
| `annual_rate` | Annual nominal interest rate | Decimal fraction, e.g. `0.18` for 18%, not `18` |
| `term` | Number of monthly instalments | Positive integer |
| `disbursement_date` | Date the loan was disbursed | Calendar date |

The rate is a nominal annual rate. The engine derives the monthly rate from it as described under
[interest basis](#interest-basis-30360).

## Output contract

The function returns a schedule with two parts: an ordered list of instalment rows and an
envelope of summary figures.

Each instalment row carries:

| Field | Meaning |
|-------|---------|
| `instalment_number` | 1-based position in the schedule |
| `due_date` | Calendar date the instalment falls due |
| `opening_balance` | Principal outstanding at the start of the period, before this instalment |
| `interest` | Interest due for the period, whole KES |
| `principal` | Principal due for the period, whole KES |
| `instalment` | Total due for the period; equals `interest + principal`, whole KES |
| `closing_balance` | Principal outstanding after this instalment |

The envelope carries:

| Field | Meaning |
|-------|---------|
| `total_cost_of_credit` | Sum of the rounded interest across all periods, whole KES |
| `apr` | Disclosed annual percentage rate, decimal fraction to 4 places |

## Core policy decisions

### Amortisation method: equal principal (straight-line)

The principal portion is the anchor and is fixed each period at `principal / term`. Interest is
computed on the declining balance, so the total instalment falls over the life of the loan. This is
not an annuity or equal-instalment (EMI) product.

For each period the two components are computed and rounded independently:

- `principal_k = round(principal / term)` to the whole shilling, for periods 1 to `term - 1`.
- `interest_k = round(opening_balance_k × annual_rate / 12)` to the whole shilling.
- `instalment_k = principal_k + interest_k`.

Because both components are already whole shillings, the instalment is automatically a whole
shilling with no further rounding.

Conceptually interest is served first and principal is the remainder of what the borrower pays.
That ordering describes the allocation, not the arithmetic: the instalment is built up from its two
independently rounded parts, it is not rounded as a whole and then decomposed.

### Interest basis: 30/360

Interest is charged once per monthly period on a 30/360 basis. Every month is treated as 30 days
and the year as 360, so each period's interest is `opening_balance × annual_rate × 30/360`, which
reduces to `opening_balance × annual_rate / 12`. There is no daily accrual, and the actual number
of days in a calendar month does not affect the interest charged. Leap years are therefore
irrelevant to accrual.

Interest is charged on the outstanding principal only. Interest does not compound within the
schedule; each period's interest is paid in full in that period's instalment.

Stub periods are out of scope for this engine. A partial-period interest charge would arise only if
the disbursement date preceded the first period start date. Under the instalment-dating rule below
the disbursement date is the first period start, so no stub ever arises here.

### Instalment dates

The first instalment falls due one calendar month after the disbursement date. Each subsequent
instalment falls due one calendar month after the previous one, anchored to the disbursement
day-of-month.

Month-end is handled by clamping to the last valid day of the target month (implementation
default, no contrary policy). A loan disbursed on the 31st produces due dates on the 28th or 29th
of February, the 30th of April, and so on. Clamping is applied per target month from the original
disbursement day-of-month, so a short month does not permanently shift later due dates earlier: a
31st-anchored loan returns to the 31st in months that have one.

### Rounding and reconciliation

Amounts are in KES. Although KES carries two decimal places, every instalment in this schedule is
rounded to the whole shilling; no cents appear. Interest and principal are each rounded to the
whole shilling independently, using round half up (implementation default; non-negative amounts, so
this is round half away from zero).

The equal-principal method leaves a small rounding drift, because `round(principal / term)` summed
over the periods rarely equals the principal exactly. The final instalment absorbs this drift. The
final period's principal is set to whatever closes the balance at exactly zero:

```
principal_term = principal − Σ principal_k for k in 1 .. term-1
```

The final period's interest is computed normally, on its opening balance. Only the principal
component of the final instalment is adjusted; the interest component is never adjusted by
reconciliation. As a result the closing balance of the last instalment is exactly zero.

## Algorithm

1. Validate the input (see [validation](#validation)).
2. Set `balance = principal`.
3. For `k` from 1 to `term`:
   1. `opening_balance_k = balance`.
   2. `interest_k = round(opening_balance_k × annual_rate / 12)` to the whole shilling.
   3. If `k < term`: `principal_k = round(principal / term)` to the whole shilling.
      If `k = term`: `principal_k = balance` (the remaining balance, which closes it to zero).
   4. `instalment_k = principal_k + interest_k`.
   5. `closing_balance_k = opening_balance_k − principal_k`.
   6. `due_date_k = disbursement_date + k` calendar months, clamped to month-end.
   7. `balance = closing_balance_k`.
4. Compute the envelope figures (see below).
5. Return the rows and the envelope.

Note that step 3.3 for the final period yields the same result as the reconciliation formula above,
since `balance` at that point already equals `principal − Σ principal_k for k in 1 .. term-1`.

## Derived outputs

### Total cost of credit

The sum of the rounded interest amounts across all periods. Because reconciliation touches only
principal, the total cost of credit is unaffected by it.

```
total_cost_of_credit = Σ interest_k for k in 1 .. term
```

### Disclosed APR

The APR is disclosed on an actual/365 basis, deliberately different from the 30/360 basis used for
accrual. The two are different numbers and both are required output.

The APR is the effective (compounded) annual rate `r` that equates the disbursed principal to the
present value of the actual instalment cash flows, discounted to the disbursement date, with each
instalment weighted by its actual day count over 365:

```
principal = Σ instalment_k / (1 + r) ^ (days_k / 365)
```

where `days_k` is the actual number of calendar days from the disbursement date to instalment `k`'s
due date, and `instalment_k` is the actual whole-shilling amount the borrower pays, including the
reconciled final instalment. There are no fees, so the present-value base is exactly the disbursed
principal. `r` is solved numerically.

The following are implementation defaults, adopted in the absence of a contrary regulatory mandate:

- Effective (compounded) annual form, as written above, rather than a nominal annualisation.
- Reported as a decimal fraction to 4 decimal places, e.g. `0.2134` for 21.34%.
- When `annual_rate` is 0 and there are no fees, the APR is `0.0`.

## Edge cases

**Zero interest rate.** When `annual_rate` is 0, every period's interest is 0 and the schedule is
principal only. The APR is `0.0`. (Implementation default; consistent with policy.)

**Single-instalment term.** When `term` is 1, the schedule is one instalment of the full principal
plus one period's interest. Reconciliation is trivially satisfied. (Implementation default;
consistent with policy.)

**Leap years.** Irrelevant to accrual under 30/360. They affect only the `days_k` day counts used
in the APR solve, which already uses actual days.

### Validation

The following inputs are invalid and must be rejected:

- `principal` less than or equal to 0.
- `principal` that is not a whole number of shillings. KES carries two decimal places, so cents are
  representable, but the engine requires whole-shilling principal (implementation default) to keep
  every instalment a whole shilling. See [sub-shilling principal](#sub-shilling-principal).
- `annual_rate` less than 0. A rate of exactly 0 is valid.
- `term` less than or equal to 0, or not a whole number.
- A missing `disbursement_date`.

On invalid input the function raises a validation error naming the offending field or fields. The
precise error type and message structure are an implementation default. No partial schedule is
returned.

## Invariants

These properties hold for every schedule the engine returns from valid input.

- The schedule has exactly `term` rows, numbered 1 to `term`.
- Every `interest`, `principal` and `instalment` amount is a whole number of KES.
- For every row, `instalment = interest + principal`.
- For every row, `closing_balance = opening_balance − principal`.
- The first row's `opening_balance` equals `principal`.
- Each row's `opening_balance` equals the previous row's `closing_balance`.
- The final row's `closing_balance` is exactly 0.
- The sum of all `principal` amounts equals `principal`.
- `total_cost_of_credit` equals the sum of all `interest` amounts.
- Due dates are strictly increasing, one calendar month apart, anchored to the disbursement
  day-of-month and clamped to month-end.

## Worked example

Loan: principal 100,000 KES, annual rate 0.18 (18%), term 12, disbursed 2026-01-15.

Fixed principal per period is `round(100000 / 12) = round(8333.33) = 8,333` for periods 1 to 11.
The final principal reconciles the drift: `100000 − 11 × 8333 = 100000 − 91663 = 8,337`.

Monthly interest is `opening_balance × 0.18 / 12 = opening_balance × 0.015`, rounded to the whole
shilling.

| # | Due date | Opening balance | Interest | Principal | Instalment | Closing balance |
|---|----------|-----------------|----------|-----------|------------|-----------------|
| 1 | 2026-02-15 | 100,000 | 1,500 | 8,333 | 9,833 | 91,667 |
| 2 | 2026-03-15 | 91,667 | 1,375 | 8,333 | 9,708 | 83,334 |
| 3 | 2026-04-15 | 83,334 | 1,250 | 8,333 | 9,583 | 75,001 |
| … | … | … | … | … | … | … |
| 11 | 2026-12-15 | 16,670 | 250 | 8,333 | 8,583 | 8,337 |
| 12 | 2027-01-15 | 8,337 | 125 | 8,337 | 8,462 | 0 |

Interest in period 2 is `91,667 × 0.015 = 1,375.005`, which rounds to 1,375. The final principal is
8,337 rather than 8,333, absorbing the accumulated rounding drift so the balance closes at zero.

Total cost of credit for this loan is 9,750 KES (the sum of the interest column). The APR is solved
numerically from the instalment cash flows on an actual/365 basis and reported to 4 decimal places;
it differs from the 18% nominal rate because of compounding and the day-count basis.

## Notes on specific decisions

### Sub-shilling principal

The whole-shilling instalment invariant holds exactly when the disbursed principal is itself a whole
number of shillings. Whole-shilling principal is not a stated policy requirement, and the KES input
representation permits cents. The engine nonetheless rejects a fractional-shilling principal at the
validation layer (implementation default). That keeps the invariant clean and matches the most
common disbursement practice.

If cents are ever to be permitted, the change is contained: the reconciliation logic already absorbs
rounding drift, and a fractional principal is simply one more source of it. Remove the validation
rule and document that the final instalment's principal, and therefore its total, may carry the
fractional-shilling remainder. Every other row remains a whole shilling.


## Auditor verdict

_The spec covers 12 of 14 decisions correctly. It nails the bespoke method/convention/rounding decisions (equal-principal amortisation, 30/360 accrual, per-period interest, whole-shilling rounding with final-instalment reconciliation, interest-first rounding order, zero closing balance) and the non-obvious 30/360-accrual-but-actual/365-disclosure APR quirk. Two decisions fail: #5 (interest start/stub period) is explicitly declared out of scope and the spec asserts no stub ever arises, contradicting the reference's charged partial-period interest; and #10/#11 (Rule-of-78 rebate and re-amortise-keeping-term-fixed prepayment) are both explicitly placed out of scope, so neither is surfaced. Net: decisions 10 and 11 not surfaced; decision 5 surfaced but incorrect; the remaining 11 correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Interest is computed on the declining balance"; "each period's interest is `opening_balance × annual_rate × 30/360`" | Spec explicitly uses declining balance on the reducing principal, matching the reference. |
| 2 | yes | **yes** | "Amortisation method: equal principal (straight-line)... fixed each period at `principal / term`. Interest is computed on the declining balance, so the total instalment falls... This is not an annuity or equal-instalment (EMI) product." | Exactly matches equal-principal with decreasing total instalment, explicitly excluding EMI. |
| 3 | yes | **yes** | "Interest basis: 30/360... Every month is treated as 30 days and the year as 360" | Matches the 30/360 convention exactly. |
| 4 | yes | **yes** | "Interest is charged once per monthly period on a 30/360 basis... There is no daily accrual" | Interest computed once per monthly period, not daily accrual, matching the reference. |
| 5 | yes | no | "Stub periods are out of scope for this engine... Under the instalment-dating rule below the disbursement date is the first period start, so no stub ever arises here." | Reference requires interest to accrue from disbursement with a stub interest charge for extra days when disbursement precedes first period start. The spec explicitly declares stubs out of scope and asserts no stub ever arises, contradicting the reference policy that partial-period interest is allowed and charged. |
| 6 | yes | **yes** | "Decimal amount in KES"; "Although KES carries two decimal places" | Currency KES and 2 decimal places both stated, matching the reference. |
| 7 | yes | **yes** | "every instalment in this schedule is rounded to the whole shilling; no cents appear... The final instalment absorbs this drift." | Whole-shilling rounding with accumulated drift settled in the final instalment matches the reference. |
| 8 | yes | **yes** | "Conceptually interest is served first and principal is the remainder"; "`interest_k = round(...)`... `principal_k = round(principal / term)`" | Interest is computed and rounded, and for the reference the ordering is interest-first with principal as remainder. The spec states interest is served first and principal is the remainder, and both are rounded independently; interest is rounded first. This matches the reference intent of interest-first rounding with principal absorbing the remainder. |
| 9 | yes | **yes** | "the closing balance of the last instalment is exactly zero"; "The final row's `closing_balance` is exactly 0." | Final instalment reconciles to exactly zero closing balance, matching the reference. |
| 10 | no | no | "Out of scope: ... early settlement and prepayment" | Early full settlement rebate (Rule of 78) is explicitly out of scope; the spec does not address the rebate method, so it is not surfaced and not correct. |
| 11 | no | no | "Out of scope: ... early settlement and prepayment" | Partial prepayment handling (re-amortise keeping term fixed) is explicitly out of scope; not surfaced, not correct. |
| 12 | yes | **yes** | "`principal` less than or equal to 0."; "`term` less than or equal to 0, or not a whole number." rejected with validation error | Zero/negative principal and zero/negative term are rejected as invalid, matching the reference. |
| 13 | yes | **yes** | "The first instalment falls due one calendar month after the disbursement date. Each subsequent instalment falls due one calendar month after the previous one" | First due date is disbursement + one month, monthly thereafter, matching the reference. |
| 14 | yes | **yes** | "return the full schedule (per period: due date, opening balance, interest, principal, instalment, closing balance)"; "total_cost_of_credit"; "The APR is disclosed on an actual/365 basis, deliberately different from the 30/360 basis used for accrual." | Full per-period schedule, total cost of credit (sum of interest), and disclosed APR on actual/365 basis while accrual uses 30/360 all match the reference, including the non-obvious dual day-count split. |
