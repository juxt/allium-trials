# spec-kit — loan-schedule — iteration 2

Model (author): claude-opus · Questions asked: 11 · Captured: 9/14 · Bespoke captured: 2/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like that prompt didn't go through. Let me put the same questions to you in plain text; answer inline and I'll pin the rest down from there.

These are the decisions the brief leaves open that actually change the numbers. I need your ruling on each.

**1. Amortisation method** — how each instalment splits between principal and interest.
- (a) Equal instalments (annuity): fixed total payment each month, principal share grows over the term. Most common for consumer loans.
- (b) Equal principal: fixed principal each month, total payment falls over time.
- (c) Interest-only with a bullet principal repayment at the final instalment.

**2. Interest basis** — how the monthly interest charge comes from the annual nominal rate.
- (a) Nominal ÷ 12 applied to the outstanding balance, ignoring actual days in the month.
- (b) Actual/365: balance × annual rate × (actual days in period ÷ 365).
- (c) 30/360.

**3. Rounding** — how you close the schedule to exactly zero at currency precision.
- (a) Round each line to the minor unit, final instalment's principal absorbs the residual.
- (b) Round each line, spread the accumulated residual across instalments.
- (c) Keep full precision, round only for display.

Also: which **currency / minor unit precision** (e.g. 2 decimal places)?

**4. First period** — when the first instalment falls and whether it accrues a full month.
- (a) One month after disbursement, every period a full month, no stub.
- (b) Fixed day-of-month, first period is a pro-rata stub.
- (c) First payment 30 days after disbursement.

And two smaller ones once those are settled:

**5. Payment dates** — monthly anniversary of the disbursement date, or a fixed day of month? Any business-day adjustment (e.g. roll to the next working day) for weekends/holidays, and if so does that change the interest accrued?

**6. Edge cases** — how should the engine treat a zero interest rate (0% loan), and should it reject or clamp invalid input (negative principal, zero term, a disbursement date that lands on the 29th–31st)?

Take them in any order. Once I have your answers I'll write `spec.md`.
A: 1. **Amortisation: equal principal (b).** A constant principal portion (P/n) each period; interest is charged on the reducing balance; the total instalment falls over the term. Not an annuity/EMI structure.

2. **Interest basis: 30/360 (c).** Every month is treated as 30 days, the year as 360. The monthly rate is simply the annual nominal rate divided by 12, applied to the outstanding balance. Actual day counts are not used for accrual.

3. **Rounding: option (a), whole-shilling instalments, residual to final.** Each instalment is rounded to the whole shilling (no cents). Within each period, interest is computed and rounded first; principal is the remainder of the rounded instalment. The accumulated rounding difference is settled in the final instalment so the closing balance is exactly zero. **Currency: KES, schedule amounts carried to 2 decimal places internally; instalments themselves rounded to the whole shilling.**

4. **First period: one month after disbursement, but stub interest is charged if applicable.** The first due date is disbursement date plus one month; subsequent instalments fall monthly thereafter. If disbursement precedes the first period start, a stub interest charge is levied for those extra days at the same 30/360 daily rate.

5. **Monthly anniversary of the disbursement date.** No business-day adjustment policy has been defined — dates fall as calculated regardless of weekends or holidays. [default, not policy: if a due date lands on a weekend or holiday, no roll is applied and no interest adjustment is made.]

6. **Zero or negative principal, or zero term: rejected with an error.** Zero interest rate [default, not policy: valid input; interest charge is zero each period, instalment equals the principal portion]. Disbursement on the 29th–31st [default, not policy: add one calendar month; where the target month is shorter, clamp to its last day].

### Round 2
_Step reasoning:_ (live agent turn)

Q: Good, that pins down most of it. Four of your answers interact in ways I need to close before the spec is unambiguous. These are short.

**A. The stub — when does it actually fire?** You've set the first due date at disbursement + 1 month and all dates on the monthly anniversary (Q4/Q5). Under 30/360 every such period is a clean 30-day month, so I can't see the condition that triggers a stub. Which do you mean:
- (i) There is no stub under anniversary dating; the clause is vestigial and every period, including the first, is one whole month. Drop stub handling entirely.
- (ii) There's a separate first-billing-day concept (e.g. loans bill on the 1st) so the gap between disbursement and the first period start is a stub. If so, what sets that day?
- (iii) Something else — describe it.

**B. Principal portion under whole-shilling rounding.** You said interest is rounded first and principal is the remainder of the rounded instalment. Two readings of "the instalment", confirm which:
- (i) Each period: `instalment = round_to_shilling(P/n + interest_raw)`, `interest = round_to_shilling(interest_raw)`, `principal = instalment − interest`. Principal wobbles by a shilling around P/n period to period.
- (ii) Principal is a fixed `round_to_shilling(P/n)` every period, interest rounded separately, instalment is their sum. Residual still lands on the final instalment.

**C. Output precision.** Given whole-shilling instalments, should the three reported figures per line (interest, principal, running balance) all be whole shillings, with the 2 dp only used for intermediate accrual? Or do you want interest/principal reported at 2 dp and only the instalment total rounded?

**D. Return shape and rejection.** For rejected input (zero/negative principal, zero term), should `generate_schedule` raise an exception, or return an error value? And what is `loan` — an object/struct with the four named fields, anything else on it (loan id, currency)?
A: **A. No stub under anniversary dating — option (i).** With the first due date set at disbursement + one month and all subsequent dates on the monthly anniversary, every period under 30/360 is a clean 30-day month. There is no gap between disbursement and the first period start, so the stub clause never fires. Drop stub handling entirely; the reference to it in my earlier answer was vestigial.

**B. Option (i).** Each period: `instalment = round_to_shilling(P/n + interest_raw)`, `interest_rounded = round_to_shilling(interest_raw)`, `principal = instalment − interest_rounded`. Principal wobbles by at most one shilling around P/n from period to period; the final instalment absorbs the accumulated residual so the closing balance is exactly zero.

**C. Interest and principal reported at 2 dp; instalment and running balance as whole shillings.** Interest accrual can produce cents, so interest and principal carry 2 decimal places in the output. The instalment is a whole shilling (as defined). The running balance, being opening balance minus a whole-shilling principal, will also land at 2 dp — in practice a whole shilling for every period except where the rounding residual sits.

**D. Raise an exception for invalid input.** `generate_schedule` should throw (or raise) on zero/negative principal or zero term; do not return an error value. The loan input has four named fields: principal (KES, numeric), annual nominal rate (decimal, e.g. 0.14 for 14%), term in months (integer), and disbursement date. [default, not policy: no loan-id or currency field on the struct — currency is fixed as KES.]

### Round 3
_Step reasoning:_ (live agent turn)

Q: One inconsistency between B and C to resolve, then I have everything.

B rounds interest to the whole shilling (`interest_rounded`) and sets `principal = instalment − interest_rounded`, which makes both interest and principal whole, and the balance whole. C says interest and principal are reported at 2 dp because accrual produces cents. Those can't both hold. Pick the coherent scheme you want:

- **Scheme 1 — everything whole.** `interest = round_to_shilling(interest_raw)`, `instalment = round_to_shilling(P/n + interest_raw)`, `principal = instalment − interest`. Interest, principal and balance are all whole shillings. Simple, but you lose the accrued cents on the interest line. (This is what B literally says.)

- **Scheme 2 — cents on the split, whole instalment.** `interest = interest_raw` (2 dp), `instalment = round_to_shilling(P/n + interest_raw)`, `principal = instalment − interest` (2 dp). Interest and principal carry cents; the instalment is whole; the running balance therefore also carries cents and is *not* generally whole. (This is what C's precision implies, but it contradicts C's remark that the balance lands whole.)

Which one? If Scheme 2, confirm you accept a running balance that carries cents. The final instalment still drives the closing balance to exactly zero either way.
A: Scheme 1. Interest is rounded to the whole shilling, principal is the remainder of the rounded instalment, and the running balance is therefore also a whole shilling in every period. The accrued cents on the interest line are absorbed into the rounding residual that settles in the final instalment. Everything reported — interest, principal, instalment, balance — is whole shillings.

### Round 4
_Step reasoning:_ (live agent turn)

Q: Done. The specification is saved as `spec.md` in this directory.

It pins down the four policy areas you ruled on, plus the reconciliations we worked through:

- **Amortisation** — equal principal (`P/n` each period), interest on the reducing balance, falling instalments.
- **Interest** — 30/360, monthly rate `r/12`, no actual day counts.
- **Rounding** — whole-shilling throughout (Scheme 1). Interest rounded first, principal is the remainder of the rounded instalment, final instalment absorbs the residual so the balance closes to exactly zero.
- **Dates** — monthly anniversary of disbursement, first due one month after, no stub, no business-day adjustment.
- **Validation** — raises on zero/negative principal or zero term; zero rate is valid.

It also carries a precise per-period algorithm, the return-row shape, a set of acceptance invariants, and a fully computed six-period worked example (I checked the arithmetic: principal sums to 100,000, balance closes at zero).

Five items are flagged in an **Assumptions and defaults** section rather than presented as your policy, since you didn't rule on them: the rounding tie-break (half-up), rejecting negative rates, the no-roll weekend behaviour, month-end date clamping, and accrual precision. If any of those should be firm policy, tell me and I'll promote them.
A: Noted. Specification accepted.

## Produced specification

# Repayment schedule engine — requirements specification

## Purpose

Given a disbursed loan, produce its full repayment schedule: for each instalment, the
interest due, the principal due, the total instalment, and the running balance after
payment. The engine is deterministic and depends only on the four input fields; it holds no
state and reads no external data.

The public interface is a single function, `generate_schedule(loan)`, which returns the
schedule as an ordered list of instalment rows.

## Inputs

`loan` is a struct with exactly four fields. There is no loan identifier and no currency
field; currency is fixed as Kenyan shillings (KES).

| Field | Type | Unit / form | Example |
|---|---|---|---|
| `principal` | numeric | KES, the disbursed amount | `100000` |
| `annual_nominal_rate` | decimal | annual nominal rate as a fraction | `0.14` for 14% |
| `term_months` | integer | number of monthly instalments | `6` |
| `disbursement_date` | date | the date the loan was disbursed | `2026-01-15` |

Symbols used below: `P` = principal, `r` = annual nominal rate, `n` = term in months.

## Validation and errors

`generate_schedule` raises (throws) an exception on invalid input. It never returns an error
value or a partial schedule.

Reject and raise when:

- `principal` is zero or negative.
- `term_months` is zero or negative.
- `annual_nominal_rate` is negative. *(Default, not stakeholder policy — see Assumptions.)*

A zero interest rate is valid input, not an error. It produces zero interest in every period;
each instalment is then just the principal portion.

## Policy decisions

These are the choices the brief left open. They are settled here and are binding.

### Amortisation: equal principal

A constant principal portion of `P / n` is scheduled each period. Interest is charged on the
reducing outstanding balance, so the total instalment falls over the term. This is not an
annuity or EMI structure; the instalment is not constant.

### Interest basis: 30/360

Every month is treated as 30 days and the year as 360 days. The monthly rate is the annual
nominal rate divided by twelve, applied to the outstanding balance:

```
monthly_rate = r / 12
interest_raw = opening_balance × monthly_rate
```

Actual day counts are never used for accrual. Because every period is a whole 30/360 month,
the calendar spacing of due dates does not affect the interest charged.

### Rounding: whole-shilling instalments, residual to the final instalment

All reported amounts are whole shillings. No cents appear in the schedule. Rounding is to the
nearest whole shilling, ties away from zero. *(Tie-breaking is a flagged default — see
Assumptions.)*

Within each non-final period:

```
interest        = round_to_shilling(interest_raw)
instalment      = round_to_shilling(P / n + interest_raw)
principal       = instalment − interest
closing_balance = opening_balance − principal
```

Interest is rounded first; principal is the remainder of the rounded instalment. The principal
portion therefore wobbles by at most one shilling around `P / n` from period to period, and the
running balance is a whole shilling in every period.

The **final instalment** reconciles the schedule so the closing balance is exactly zero:

```
principal   = opening_balance          // the whole remaining balance
interest    = round_to_shilling(interest_raw)
instalment  = principal + interest
closing_balance = 0
```

The accumulated rounding difference, including the accrued cents dropped from every interest
line, is absorbed into this final principal.

`interest_raw` is computed at full precision and rounded directly to the whole shilling. There
is no intermediate rounding step that would change the result.

### Dates: monthly anniversary of the disbursement date

The first instalment is due one calendar month after the disbursement date. Each subsequent
instalment is due on the monthly anniversary thereafter. The k-th due date is the disbursement
date plus k months, preserving the original day of month where the target month allows and
clamping to the last day of shorter months (a disbursement on the 31st falls due on the 28th
or 29th in February, the 30th in April, and so on). *(29th–31st clamping is a flagged default —
see Assumptions.)*

There is no business-day adjustment. A due date that lands on a weekend or public holiday is
left as calculated, and no interest adjustment is made. There is no stub period: under
anniversary dating every period, including the first, is one whole 30/360 month.

## Algorithm

Let `B₀ = P`. For each period `k` from 1 to `n`, with opening balance `B₍ₖ₋₁₎`:

1. `interest_raw = B₍ₖ₋₁₎ × (r / 12)`
2. `interestₖ = round_to_shilling(interest_raw)`
3. If `k < n`:
   - `instalmentₖ = round_to_shilling(P / n + interest_raw)`
   - `principalₖ = instalmentₖ − interestₖ`
4. If `k = n` (final period):
   - `principalₖ = B₍ₖ₋₁₎`
   - `instalmentₖ = principalₖ + interestₖ`
5. `Bₖ = B₍ₖ₋₁₎ − principalₖ`
6. `due_dateₖ = disbursement_date + k months` (anniversary, clamped as above)

Emit one row per period. `Bₙ` is exactly zero.

For `n = 1` the single period is the final period: `principal = P`,
`interest = round_to_shilling(P × r / 12)`, `instalment = principal + interest`, closing
balance zero.

## Output

`generate_schedule` returns an ordered list of `n` rows, one per instalment, ascending by
instalment number. Each row carries:

| Field | Meaning |
|---|---|
| `instalment_number` | 1-based position in the schedule |
| `due_date` | the anniversary due date for this instalment |
| `opening_balance` | balance before this payment (whole shillings) |
| `interest` | interest due this period (whole shillings) |
| `principal` | principal due this period (whole shillings) |
| `instalment` | total payment this period, `interest + principal` (whole shillings) |
| `closing_balance` | running balance after this payment (whole shillings) |

## Invariants

The following must hold for any valid input, and serve as acceptance properties:

- The schedule has exactly `n` rows.
- Every reported amount is a whole shilling (an integer number of KES).
- `interestₖ + principalₖ = instalmentₖ` for every row.
- `closing_balanceₖ = opening_balanceₖ − principalₖ`, and
  `opening_balance₍ₖ₊₁₎ = closing_balanceₖ`.
- The sum of all `principal` values equals `P` exactly.
- The closing balance of the final row is exactly zero.
- The running balance is non-increasing across the schedule and never negative.
- For every non-final row, `interestₖ = round_to_shilling(B₍ₖ₋₁₎ × r / 12)` and
  `|principalₖ − P / n| ≤ 1` shilling.
- With `r = 0`, every `interest` is zero and every `instalment` equals its `principal`.

## Worked example

`principal = 100000`, `annual_nominal_rate = 0.14`, `term_months = 6`,
`disbursement_date = 2026-01-15`. Monthly rate `= 0.14 / 12 ≈ 0.0116667`;
`P / n ≈ 16666.67`.

| # | Due date | Opening | Interest | Principal | Instalment | Closing |
|---|---|---:|---:|---:|---:|---:|
| 1 | 2026-02-15 | 100000 | 1167 | 16666 | 17833 | 83334 |
| 2 | 2026-03-15 | 83334 | 972 | 16667 | 17639 | 66667 |
| 3 | 2026-04-15 | 66667 | 778 | 16666 | 17444 | 50001 |
| 4 | 2026-05-15 | 50001 | 583 | 16667 | 17250 | 33334 |
| 5 | 2026-06-15 | 33334 | 389 | 16667 | 17056 | 16667 |
| 6 | 2026-07-15 | 16667 | 194 | 16667 | 16861 | 0 |

Total principal repaid `= 100000`. Total interest `= 4083`. Total paid `= 104083`. The closing
balance reaches exactly zero at the final instalment. Row 6 is the final period, so its
principal is the whole remaining balance and it absorbs the rounding residual.

## Assumptions and defaults

These were not settled as policy by the stakeholder. They are reasonable defaults, called out
so they can be overridden.

- **Rounding tie-break.** Rounding to the whole shilling breaks ties away from zero
  (commercial half-up). Values such as exactly `x.5` shillings round up.
- **Negative interest rate.** Treated as invalid input and rejected. Only zero or positive
  rates are accepted.
- **Weekend and holiday due dates.** No roll and no interest adjustment; the date stands as
  calculated.
- **Month-end disbursement.** A disbursement on the 29th to 31st advances by one calendar
  month with clamping to the last day of a shorter target month. Anniversary day of month is
  taken from the original disbursement date each period, so it returns to the 31st in months
  that have one.
- **Accrual precision.** `interest_raw` is carried at full precision and rounded once to the
  whole shilling. Because balances are whole shillings every period, no intermediate 2-decimal
  rounding affects the result.

## Out of scope

- Fees, penalties, insurance, and any charge other than interest on principal.
- Early repayment, restructuring, missed payments, arrears and re-ageing.
- Variable or resetting interest rates.
- Business-day calendars and holiday tables.
- Currencies other than KES and any multi-currency handling.
- Persistence, presentation and rounding for display beyond the whole-shilling rule above.


## Auditor verdict

_The spec correctly resolves 9 of 14 decisions (1, 2, 3, 4, 7, 8, 9, 12, 13), covering all the core bespoke method/rounding choices and the inferable anchors. It fails 5: it contradicts the stub-period policy (#5, explicitly denies any stub interest), diverges on currency precision (#6, whole shillings instead of 2 decimal places), omits the Rule-of-78 early-settlement rebate (#10) and principal-first term-fixed partial prepayment (#11) by declaring them out of scope, and misses the total-cost-of-credit output plus the actual/365 APR disclosure quirk (#14). Coverage = 9/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Interest is charged on the reducing outstanding balance"; "interest_raw = opening_balance × monthly_rate" | The spec applies the monthly rate to the reducing outstanding balance, which is declining-balance interest on the reducing principal, matching the reference exactly. |
| 2 | yes | **yes** | "Amortisation: equal principal. A constant principal portion of P / n is scheduled each period ... total instalment falls over the term. This is not an annuity or EMI structure" | Constant P/n principal, interest on reducing balance, decreasing instalment, explicitly not EMI — matches the reference equal-principal answer precisely. |
| 3 | yes | **yes** | "Interest basis: 30/360. Every month is treated as 30 days and the year as 360 days." | The spec states 30/360 and never uses actual day counts for accrual, matching the reference. |
| 4 | yes | **yes** | "Actual day counts are never used for accrual"; interest is computed once per period as opening_balance × r/12, "the calendar spacing of due dates does not affect the interest charged" | Interest is computed once per monthly period rather than by daily accrual, matching the reference same-as-repayment-period basis. |
| 5 | yes | no | "There is no stub period: under anniversary dating every period, including the first, is one whole 30/360 month." | The spec addresses the stub-period question but resolves it in the opposite direction — it explicitly denies any stub/partial-period interest, contradicting the reference which levies a stub interest charge from the disbursement date. |
| 6 | yes | no | "currency is fixed as Kenyan shillings (KES)"; "All reported amounts are whole shillings. No cents appear ... no intermediate 2-decimal rounding affects the result." | Currency KES matches, but the reference specifies amounts to 2 decimal places; the spec uses whole shillings throughout and explicitly rejects 2-decimal handling, so the precision component does not match. |
| 7 | yes | **yes** | "Rounding: whole-shilling instalments, residual to the final instalment"; "The accumulated rounding difference ... is absorbed into this final principal." | Each instalment is rounded to the whole shilling and the accumulated residual is settled in the final instalment, matching the reference exactly. |
| 8 | yes | **yes** | "Interest is rounded first; principal is the remainder of the rounded instalment." | Interest is computed and rounded first and principal is taken as the remainder of the rounded instalment, matching the reference ordering. |
| 9 | yes | **yes** | "The final instalment reconciles the schedule so the closing balance is exactly zero"; invariant "The closing balance of the final row is exactly zero." | The schedule closes to an exact zero balance at the final instalment, matching the reference. |
| 10 | no | no | Out of scope: "Early repayment, restructuring, missed payments, arrears and re-ageing." | The spec excludes early repayment entirely and never mentions any rebate method, so the Rule-of-78 rebate decision is neither surfaced nor resolved. |
| 11 | no | no | Out of scope: "Early repayment, restructuring, missed payments, arrears and re-ageing." | Partial prepayment and re-amortisation are declared out of scope and no treatment (principal-first, term-fixed re-amortisation) is captured. |
| 12 | yes | **yes** | "Reject and raise when: principal is zero or negative. term_months is zero or negative." | Zero or negative principal and zero or negative term are both rejected as invalid, matching the reference. |
| 13 | yes | **yes** | "The first instalment is due one calendar month after the disbursement date. Each subsequent instalment is due on the monthly anniversary thereafter." | First due date is disbursement date plus one month with monthly instalments thereafter, matching the reference. |
| 14 | yes | no | Output rows list per-period due date/opening/interest/principal/instalment/closing; "Total interest = 4083" appears only in the worked example; no APR or disclosure basis anywhere. | The per-period schedule shape matches, but the return value does not include the total cost of credit as an output and the reference's key non-obvious element — a disclosed APR computed on an actual/365 basis alongside 30/360 accrual — is entirely absent, so the decision is not correctly resolved. |
