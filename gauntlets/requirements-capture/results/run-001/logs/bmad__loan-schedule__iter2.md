# bmad — loan-schedule — iteration 2

Model (author): claude-opus · Questions asked: 13 · Captured: 11/14 · Bespoke captured: 4/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the interactive prompt didn't go through, so I'll just put the questions to you directly. These are the decisions the engine can't correctly infer. Please answer each; where you're happy with my suggested default, just say "default".

**1. Amortisation method.** What shape do the instalments take?
- (a) *Equal instalment (annuity)* — same total payment each period, interest falls and principal rises. The usual consumer-loan method. **(my default)**
- (b) *Equal principal (straight-line)* — principal in equal chunks, total payment declines.
- (c) *Interest-only + balloon* — interest each period, whole principal repaid at the end.

**2. Interest basis.** How is each period's interest derived from the annual nominal rate, and does the disbursement date affect accrual?
- (a) *Nominal ÷ 12 on the outstanding balance* — every period equal, disbursement date affects only due dates, not interest. **(my default)**
- (b) *Actual/365 by days* — interest scales by actual days in each period, so month lengths and disbursement date matter.
- (c) *Actual/360 or 30E/360* — a commercial day-count convention.

**3. First instalment timing.** When is the first payment due and how is the gap from disbursement treated?
- (a) *One calendar month after disbursement, in arrears, regular period, no stub* **(my default)**
- (b) *Stub first period* — odd first instalment accruing interest on actual days to the first due date.
- (c) *In advance (annuity due)* — first payment on the disbursement date.

**4. Rounding to minor units (pennies).** How, and where does the residual land?
- (a) *Round each period, true up the final instalment* so the balance closes at exactly zero. **(my default)**
- (b) *Carry the sub-penny residual forward* each period.
- (c) *No rounding* — full precision, caller rounds for display.

Once you've answered these, I have a short second round: **due-date scheduling** (same day-of-month vs fixed day, and what happens when disbursement is on the 29th–31st), **business-day adjustment** for due dates that fall on weekends/holidays, and the **currency/decimal precision** and expected **input/output shape** of `loan` and the returned schedule. Answer 1–4 first and I'll follow up.
A: Answers in order:

**1. Amortisation method — (b) Equal principal.** A constant principal chunk each period (P/n), interest on the reducing balance, total instalment declines over the term. Not annuity/EMI.

**2. Interest basis — (c) 30/360.** Every month is treated as 30 days, the year as 360. Interest is computed once per monthly period on the outstanding balance — not daily accrual. Disbursement date drives due-date scheduling, not the day-count.

**3. First instalment timing — (b) Stub first period.** The first due date is disbursement date plus one month; subsequent instalments are monthly thereafter. If disbursement falls before the first period start, a stub interest charge is levied for those extra days. Partial-period interest is allowed and charged.

**4. Rounding — default (a).** Each instalment is rounded to the whole shilling. The accumulated rounding difference is reconciled in the final instalment so the closing balance is exactly zero.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Two of your answers interact in a way I need to nail down before it's unambiguous, plus a few smaller policy points remain. Here's round two.

**5. Stub mechanics (the one I most need pinned).** Answers 2 and 3 together leave the stub calculation underdetermined. You said the first due date is disbursement + 1 month, yet also that a stub is charged "if disbursement falls before the first period start" for "those extra days" on a 30/360 basis. Those only both hold if there's a scheduling anchor distinct from the disbursement date. Which model do you mean?
- (a) *Pro-rata within a single first period.* There's no separate anchor. The first period runs disbursement → first due date (disb + 1 month), and its interest is `balance × monthly_rate × (30/360 day-count of that period ÷ 30)`. For a clean whole month the factor is 1; end-of-month disbursements can make it slightly more or less. One instalment, no separate stub line.
- (b) *Separate stub charge, then regular cycle.* There's a fixed cycle anchor (e.g. a billing day-of-month). Interest for the odd days from disbursement to the first cycle start is charged as a distinct stub, then full monthly periods run on the anchor. This produces an extra stub entry before instalment 1.
- (c) Something else — please describe.

A worked example would settle it: **principal 120,000 shillings, 12 instalments, 24% nominal annual, disbursed 20 Jan 2026** — what's the first due date, and what interest does instalment 1 carry?

**6. Due-date scheduling and end-of-month.** Subsequent instalments are "monthly thereafter" from the first due date. When the anchor day is the 29th, 30th or 31st, how are later due dates set?
- (a) *Same day-of-month, clamped to the last day* when the month is shorter (e.g. 31 Jan anchor → 28/29 Feb → 31 Mar). **(my default)**
- (b) *Always the last day of the month* once the anchor is a month-end.
- (c) Fixed day for all (e.g. always the 1st).

**7. Business-day adjustment.** If a computed due date lands on a weekend or public holiday, does it move? (a) *No — due dates are calendar dates as computed, no adjustment* **(my default)**; (b) roll to the next business day; (c) modified following. If you want any adjustment I'll also need the holiday calendar source.

**8. Currency and precision.** "Whole shilling" — I'll take the minor unit as **1 shilling, amounts are integers, zero decimal places**. Confirm, and tell me which shilling (e.g. KES) if it should be recorded in the spec.

**9. Rounding of the principal chunk.** With equal principal, the chunk is `principal ÷ n`. When that doesn't divide evenly, do earlier instalments carry the rounded chunk with the **principal remainder absorbed into the final instalment** (alongside the interest-rounding reconciliation from answer 4, so the closing balance is exactly zero)? **(my default: yes)**

**10. Input and output shape.** What does `generate_schedule` take and return?
- *Input `loan`:* I'll assume fields `principal`, `annual_rate` (nominal, as a decimal or percent — tell me which), `term_months`, `disbursement_date`. Anything else (loan id, currency, cycle anchor day)?
- *Output:* a schedule of rows, each with `instalment_number`, `due_date`, `opening_balance`, `interest`, `principal`, `total_payment`, `closing_balance`. Add or drop any fields you want.

Answer what you can; for any you're happy with, "default" is fine.
A: **5. Stub mechanics — (a). One first period, no separate stub row.**

The first period runs from disbursement to disbursement + 1 month. Its interest is computed as `balance × monthly_rate × (30/360 day-count of that period ÷ 30)`. For a clean whole-month span the factor is 1; for end-of-month disbursements the 30/360 count may be less than 30, giving a smaller interest charge — that fractional case is what the policy means by a 'stub'. No extra billing row.

Worked example — principal 120,000 KES, 12 instalments, 24% nominal annual, disbursed 20 Jan 2026:
- First due date: 20 Feb 2026.
- 30/360 day count, Jan 20 → Feb 20: (2−1)×30 + (20−20) = 30 days. Factor = 1.
- Monthly rate: 2%.
- Instalment 1 interest: 120,000 × 2% × 1 = 2,400 KES.
- Principal chunk: 10,000. Instalment: 12,400. Closing balance: 110,000.

**6. End-of-month scheduling — default (a).** Same day-of-month, clamped to the last day of shorter months. [default, not policy]

**7. Business-day adjustment — default (a).** Due dates are calendar dates as computed; no rolling or adjustment. [default, not policy]

**8. Currency and precision — not default.** KES, amounts to 2 decimal places (not integers). Instalments round to the whole shilling per the earlier answer, so the instalment field is always x.00, but intermediate values such as pre-rounding interest should be held to 2 d.p.

**9. Principal chunk rounding — default (yes).** Each period carries the rounded principal chunk (P/n to nearest whole shilling); any residual is absorbed into the final instalment alongside the interest-rounding reconciliation so the closing balance is exactly zero.

**10. Input and output shape.**
- `annual_rate` as a decimal (0.24 for 24%). No loan ID required as an input field.
- Output: the full amortisation schedule with one row per period — `due_date`, `opening_balance`, `interest`, `principal`, `instalment` (not `total_payment`), `closing_balance` — plus two summary fields: `total_cost_of_credit` (sum of all interest charges) and `disclosed_apr` (computed on an actual/365 basis, even though accrual uses 30/360).

### Round 3
_Step reasoning:_ (live agent turn)

Q: Nearly there. Two computational details remain genuinely underdetermined, and pinning them down now saves a wrong spec.

**11. Row-level rounding consistency and rounding mode.** You've said principal chunk rounds to the nearest whole shilling (answer 9) and the instalment rounds to the whole shilling (answer 8), while interest is held to 2 d.p. intermediately. For each row to reconcile (`interest + principal = instalment`, and `opening − principal = closing`), I need to know how the displayed **interest** field is treated:
- (a) *Interest is also rounded to the whole shilling* for display, so `interest + principal = instalment` holds exactly with all three at x.00. The 2 d.p. precision is purely intermediate, before that rounding. **(my default — it's the only reading where every row reconciles cleanly)**
- (b) *Interest is displayed at 2 d.p.* (its true rounded value) and only the instalment is forced to whole shilling, so `interest + principal` may differ from `instalment` by up to 0.50 in some rows. If so, tell me which field is authoritative.

And the **rounding mode** for "nearest whole shilling": (a) round half **up** (0.50 → 1) **(my default)**; (b) round half to **even** (banker's).

**12. Disclosed APR method.** You want `disclosed_apr` on an actual/365 basis while accrual uses 30/360. I'll take it as the internal rate of return that equates the discounted instalments to the principal advanced:

> find the annual rate `i` such that `Σ instalment_k / (1 + i)^(d_k / 365) = principal`, where `d_k` is the actual number of calendar days from disbursement to due date *k*.

Confirm, and tell me: is `i` disclosed as an **effective annual rate** (the solution above) or converted to a **nominal annualised** figure? And is `disclosed_apr` returned as a decimal (e.g. 0.2682) or a percentage, and to how many decimal places?

That's the last of it. Answer these and I'll write `spec.md`.
A: **11. Row-level rounding and rounding mode.**

Interest is computed and rounded first — to the whole shilling. Principal is then the remainder: instalment (rounded) minus rounded interest. All three fields display as whole shillings and the row identity holds exactly. Your option (a) is correct, but the order matters: interest rounds first, principal is derived from it, not rounded independently.

Rounding mode: round half up (0.50 → 1). [default, not policy]

**12. Disclosed APR method.**

The IRR equation you've stated is correct: find the effective annual rate `i` such that the discounted instalments equal the principal advanced, discounting by actual calendar days on an actual/365 basis. Return it as an effective annual rate, expressed as a decimal to 4 decimal places (e.g. 0.2682). [decimal/4 d.p. are default, not policy]

### Round 4
_Step reasoning:_ (live agent turn)

Q: It's done. The specification is saved at `spec.md`.

It captures the six policy decisions you settled, each pinned to one answer rather than a plausible guess:

- **Equal-principal amortisation** with a constant principal chunk and declining instalments.
- **30/360 day-count**, monthly accrual, monthly rate `annual_rate / 12`.
- **Fractional first period** pro-rated by the 30/360 count over 30, carried inside the first instalment with no separate stub row.
- **Rounding order** made explicit: interest rounds first, principal is derived as instalment minus interest, and both the principal and interest residuals reconcile in the final instalment so the closing balance is exactly zero.
- **KES at 2 d.p.**, instalments to the whole shilling, round half up.
- **Output shape** including `instalment`, `total_cost_of_credit`, and `disclosed_apr` as an effective-annual IRR on an actual/365 basis to 4 d.p.

It also states the interface, preconditions, invariants (including the row and balance identities and the zero-rate case), the full 12-row worked example from your figures, and a decisions register that separates what you chose as policy from the defaults I proposed, so a reader knows which lines are load-bearing.

One honesty flag: the schedule rows and `total_cost_of_credit` in the worked example are exact, but I've marked the `disclosed_apr` figure (~0.2682) as illustrative rather than hand-verified to 4 d.p., since the actual/365 IRR needs numerical solving. If you'd like, I can compute it precisely and lock the exact value into the example.
A: Yes, please compute the exact disclosed_apr and lock it into the worked example. An illustrative figure in the reference case invites rounding disputes later.

### Round 5
_Step reasoning:_ (live agent turn)

Q: Done. The worked example now carries the exact `disclosed_apr` of **0.2696**, with the day counts and the equation it satisfies spelled out so the figure can be reproduced and can't be disputed.

I also left a one-line note explaining why it exceeds the naive `0.2682`, since that gap is exactly the kind of thing someone will query when they first read the reference case. The declining instalments discounted on actual/365 land higher than compounding the flat 2% monthly rate.

The specification at `spec.md` is complete: interface, conventions, the equal-principal method with the interest-first rounding order, scheduling and the fractional first period, both summary figures, preconditions, invariants, the fully worked 12-row example with the locked APR, and a decisions register separating your policy choices from accepted defaults.
A: Noted. The specification is complete.

## Produced specification

# Repayment schedule engine — requirements specification

## Purpose and scope

This specifies `generate_schedule(loan)`, a pure function that takes a single disbursed loan
and returns its full repayment schedule: for every instalment, the interest due, the principal
due, the running balance, and the instalment total, plus two loan-level summary figures.

In scope: the deterministic computation of the schedule from the loan's terms. Out of scope:
persistence, payment collection, arrears and default handling, restructuring, early settlement,
fees and charges other than interest, tax, and any user interface. The function computes a
projected schedule at disbursement; it does not react to actual payments.

The function is pure and deterministic. Given the same `loan` it returns the same schedule, with
no dependence on the current date, wall clock, locale or environment.

## Interface

### Input

`loan` carries:

| Field | Type | Notes |
|-------|------|-------|
| `principal` | decimal | Amount advanced, in KES. Must be > 0. |
| `annual_rate` | decimal | Nominal annual interest rate as a decimal fraction, e.g. `0.24` for 24%. Must be ≥ 0. |
| `term_months` | integer | Number of monthly instalments, `n`. Must be ≥ 1. |
| `disbursement_date` | date | Calendar date the principal was advanced. |

No loan identifier is required as an input.

### Output

A schedule of `term_months` rows, in due-date order, each with:

| Field | Type | Meaning |
|-------|------|---------|
| `due_date` | date | Date this instalment falls due. |
| `opening_balance` | decimal | Outstanding principal at the start of the period. |
| `interest` | decimal | Interest charged for the period. |
| `principal` | decimal | Principal repaid in this instalment. |
| `instalment` | decimal | Total due this period (`interest + principal`). |
| `closing_balance` | decimal | Outstanding principal after this instalment. |

Plus two loan-level summary fields:

| Field | Type | Meaning |
|-------|------|---------|
| `total_cost_of_credit` | decimal | Sum of all `interest` charges across the schedule. |
| `disclosed_apr` | decimal | Effective annual percentage rate, as a decimal to 4 d.p. See [Disclosed APR](#disclosed-apr). |

## Conventions

### Currency and precision

All monetary amounts are in Kenyan shillings (KES) and typed as decimals with two decimal
places. Instalment amounts are rounded to the whole shilling, so every rounded monetary field
in a schedule row reads as `x.00`. Intermediate values, such as interest before rounding, are
held to two decimal places during computation.

Rounding to the nearest whole shilling uses round half up: exactly 0.50 rounds to 1.

### Day-count basis

Interest accrual uses the 30/360 convention. Every whole month is treated as 30 days and the
year as 360 days. Interest is computed once per monthly period on the outstanding balance; there
is no daily accrual. The disbursement date drives due-date scheduling, not the day-count, except
for the fractional first period described below.

The monthly periodic rate is `annual_rate / 12`.

## Amortisation method: equal principal

The schedule uses the equal-principal (straight-line) method, not annuity/EMI. A constant
principal chunk is repaid each period and interest is charged on the reducing balance, so the
total instalment declines over the term.

The nominal principal chunk is `principal / n`, rounded to the nearest whole shilling and applied
in every period. Because interest is rounded first and principal is derived from the rounded
instalment (see [Per-period computation](#per-period-computation)), the reported principal equals
this rounded chunk in every regular period. Any accumulated principal residual, together with the
interest-rounding residual, is reconciled in the final instalment so that the closing balance is
exactly zero.

## Scheduling

### Due dates

The first instalment is due one calendar month after the disbursement date. Each subsequent
instalment is due one calendar month after the previous due date.

When the anchor day of month is the 29th, 30th or 31st and a later month is shorter, the due date
is clamped to the last day of that month. For example, an anchor on the 31st gives due dates of
31 January, 28 or 29 February, 31 March, and so on.

### Business days

Due dates are the calendar dates as computed. A due date that falls on a weekend or public holiday
is not moved. No business-day adjustment is applied.

## Interest and the fractional first period

Interest for a period is:

```
interest = opening_balance × (annual_rate / 12) × (period_days_30_360 / 30)
```

For a clean whole-month span the 30/360 day-count is 30, the factor is 1, and interest is simply
`opening_balance × annual_rate / 12`.

The first period runs from the disbursement date to the first due date (disbursement plus one
month). For most disbursement dates this is a clean whole month and the factor is 1. For some
end-of-month disbursements the 30/360 count of the first period is less than 30, which reduces the
first interest charge proportionally. This fractional case is what the policy means by a "stub".

There is no separate stub billing row. The reduced charge is carried inside the first instalment.
Partial-period interest is permitted and charged.

## Per-period computation

For each period, in order, the fields are derived as follows. The order matters.

1. `opening_balance` is the previous period's `closing_balance`, or `principal` for the first
   period.
2. `interest` is computed from the formula above and rounded to the whole shilling.
3. `instalment` is the nominal principal chunk plus the rounded interest, rounded to the whole
   shilling. In the final period the instalment is set so that the loan closes exactly (see below).
4. `principal` is derived as `instalment − interest`. It is not rounded independently.
5. `closing_balance` is `opening_balance − principal`.

This ordering guarantees the row identity `interest + principal = instalment` holds exactly, with
all three fields at whole-shilling precision, and that `opening_balance − principal = closing_balance`.

### Final instalment reconciliation

In the final period, `principal` is set to the entire remaining `opening_balance` so that
`closing_balance` is exactly zero. The final `instalment` is that principal plus the final period's
rounded interest. This absorbs any accumulated principal-rounding residual and any interest-rounding
residual across the schedule.

## Summary figures

### Total cost of credit

`total_cost_of_credit` is the sum of the `interest` field across all rows.

### Disclosed APR

`disclosed_apr` is the effective annual rate `i` that equates the discounted instalments to the
principal advanced, discounting on an actual/365 basis:

```
Σ_k  instalment_k / (1 + i)^(d_k / 365)  =  principal
```

where `d_k` is the actual number of calendar days from the disbursement date to due date `k`.

The APR uses actual/365 for discounting even though interest accrual uses 30/360. `i` is the
effective annual rate (the direct solution of the equation above), not converted to a nominal
figure. It is returned as a decimal to four decimal places, for example `0.2682`. The root is found
numerically; the method is an implementation concern. Where the equation admits more than one real
root, the smallest non-negative real solution is taken.

## Preconditions

- `principal > 0`
- `annual_rate ≥ 0`
- `term_months ≥ 1`

Behaviour for inputs that violate these preconditions is out of scope for this specification and
should be defined as input validation elsewhere.

## Invariants

For any valid loan, the returned schedule satisfies:

- The schedule has exactly `term_months` rows.
- Row identity: `interest + principal = instalment` in every row.
- Balance identity: `opening_balance − principal = closing_balance` in every row, and each row's
  `opening_balance` equals the previous row's `closing_balance`.
- The first row's `opening_balance` equals `principal`.
- The final row's `closing_balance` is exactly `0.00`.
- The sum of all `principal` fields equals `principal`.
- `total_cost_of_credit` equals the sum of all `interest` fields.
- Balances are non-increasing and never negative. With equal-principal amortisation and a
  non-negative rate, negative amortisation cannot occur.
- When `annual_rate` is `0`, every `interest` is `0.00`, each `instalment` equals its `principal`,
  and `disclosed_apr` is `0.0000`.

## Worked example

Loan: principal 120,000.00 KES, 12 instalments, `annual_rate` 0.24, disbursed 20 January 2026.

The monthly rate is 2%. The principal chunk is `120,000 / 12 = 10,000` and divides evenly. Every
period is a clean whole month anchored on the 20th, so the first-period factor is 1.

| # | Due date | Opening | Interest | Principal | Instalment | Closing |
|---|----------|---------|----------|-----------|------------|---------|
| 1 | 2026-02-20 | 120,000.00 | 2,400.00 | 10,000.00 | 12,400.00 | 110,000.00 |
| 2 | 2026-03-20 | 110,000.00 | 2,200.00 | 10,000.00 | 12,200.00 | 100,000.00 |
| 3 | 2026-04-20 | 100,000.00 | 2,000.00 | 10,000.00 | 12,000.00 | 90,000.00 |
| 4 | 2026-05-20 | 90,000.00 | 1,800.00 | 10,000.00 | 11,800.00 | 80,000.00 |
| 5 | 2026-06-20 | 80,000.00 | 1,600.00 | 10,000.00 | 11,600.00 | 70,000.00 |
| 6 | 2026-07-20 | 70,000.00 | 1,400.00 | 10,000.00 | 11,400.00 | 60,000.00 |
| 7 | 2026-08-20 | 60,000.00 | 1,200.00 | 10,000.00 | 11,200.00 | 50,000.00 |
| 8 | 2026-09-20 | 50,000.00 | 1,000.00 | 10,000.00 | 11,000.00 | 40,000.00 |
| 9 | 2026-10-20 | 40,000.00 | 800.00 | 10,000.00 | 10,800.00 | 30,000.00 |
| 10 | 2026-11-20 | 30,000.00 | 600.00 | 10,000.00 | 10,600.00 | 20,000.00 |
| 11 | 2026-12-20 | 20,000.00 | 400.00 | 10,000.00 | 10,400.00 | 10,000.00 |
| 12 | 2027-01-20 | 10,000.00 | 200.00 | 10,000.00 | 10,200.00 | 0.00 |

`total_cost_of_credit` is 15,600.00. `disclosed_apr` is `0.2696`.

This is the exact solution of the actual/365 IRR equation for this loan. The actual day counts from
the disbursement date to each due date are 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334 and
365. The rate `i = 0.2696` (to 4 d.p.) satisfies
`Σ_k instalment_k / (1 + i)^(d_k / 365) = 120,000.00`. Note this exceeds the naive
`(1 + 0.02)^12 − 1 = 0.2682`, because the disclosed APR discounts the actual declining instalments
on an actual/365 basis rather than compounding the flat monthly rate.

## Decisions register

Decisions the stakeholder made as policy, distinct from defaults accepted for convenience.

Policy decisions:

- Equal-principal amortisation, not annuity/EMI.
- 30/360 day-count, monthly (not daily) accrual.
- Fractional first period: interest pro-rated by 30/360 day-count over 30, carried inside the
  first instalment with no separate row.
- Interest rounded first, principal derived as instalment minus interest, residuals reconciled in
  the final instalment so the closing balance is exactly zero.
- KES amounts at two decimal places, instalments rounded to the whole shilling, intermediate values
  held to two decimal places.
- Output fields including `instalment` (not `total_payment`), `total_cost_of_credit`, and
  `disclosed_apr` computed on an actual/365 IRR basis.
- `annual_rate` supplied as a decimal fraction; no loan identifier in the input.

Defaults accepted, not stakeholder policy:

- Same day-of-month scheduling, clamped to the last day of shorter months.
- No business-day adjustment for due dates.
- Round half up.
- `disclosed_apr` returned as a decimal to four decimal places.

## Open questions

None outstanding. Input validation behaviour for out-of-range inputs, and any holiday calendar
should business-day adjustment ever be introduced, are deferred to separate specifications.


## Auditor verdict

_The spec strongly covers the accrual/amortisation core: it correctly resolves decisions 1-9, 13 and 14, including the bespoke off-default choices (equal-principal amortisation, 30/360, once-per-period accrual, whole-shilling instalment rounding with final-instalment reconciliation, interest-first rounding order, and the 30/360-accrual-but-actual/365-disclosure split). It fails on the lifecycle decisions it declares out of scope: the Rule-of-78 early-settlement rebate (10) and the term-fixed partial-prepayment re-amortisation (11) are entirely absent. Decision 12 is surfaced as preconditions but its resolution is deliberately deferred rather than stated as rejection, so it is not scored correct under a strict reading. Coverage: 11/14 correct (10, 11, 12 not credited)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "interest is charged on the reducing balance" (Amortisation method section); "declining instalments" (Disclosed APR note) | The spec applies interest to the outstanding/reducing balance each period, which is declining-balance interest, matching the reference. |
| 2 | yes | **yes** | "Amortisation method: equal principal ... A constant principal chunk is repaid each period and interest is charged on the reducing balance, so the total instalment declines over the term." | Exactly equal-principal (P/n constant, interest on reducing balance, decreasing instalment), explicitly not annuity/EMI, matching the reference. |
| 3 | yes | **yes** | "Interest accrual uses the 30/360 convention. Every whole month is treated as 30 days and the year as 360 days." | 30/360 stated verbatim, matching the reference and explicitly not actual/365. |
| 4 | yes | **yes** | "Interest is computed once per monthly period on the outstanding balance; there is no daily accrual." | Interest calculation period is the repayment period (once monthly), not daily accrual, matching the reference. |
| 5 | yes | **yes** | "The first period runs from the disbursement date to the first due date ... the 30/360 count of the first period is less than 30, which reduces the first interest charge proportionally. This fractional case is what the policy means by a 'stub'. ... Partial-period interest is permitted and charged." | Spec grounds interest accrual in the disbursement date and explicitly permits and charges partial-period (stub) interest, carried inside the first instalment, matching the reference's core policy. Note the spec frames the stub as a reduced (shorter-than-30-day) first period rather than extra days before a fixed cycle start, but the material off-default decision (partial-period interest from disbursement is allowed and charged) is captured. |
| 6 | yes | **yes** | "All monetary amounts are in Kenyan shillings (KES) and typed as decimals with two decimal places." | Currency KES and 2 dp precision both stated, matching the reference. |
| 7 | yes | **yes** | "Instalment amounts are rounded to the whole shilling ... Any accumulated principal residual, together with the interest-rounding residual, is reconciled in the final instalment" | Instalments rounded to whole shilling with the accumulated rounding difference settled in the final instalment, matching the reference exactly. |
| 8 | yes | **yes** | "interest is rounded first and principal is derived from the rounded instalment"; Per-period step 2 rounds interest, step 4 derives principal as "instalment − interest" | Interest computed and rounded first, principal as the remainder of the rounded instalment, matching the reference ordering. |
| 9 | yes | **yes** | "In the final period, `principal` is set to the entire remaining `opening_balance` so that `closing_balance` is exactly zero." | Final instalment reconciles the closing balance to exactly zero, matching the reference. |
| 10 | no | no | absent — "Out of scope: ... early settlement" | Early full settlement is explicitly excluded from scope, so the Rule-of-78 rebate policy is neither surfaced nor resolved. |
| 11 | no | no | absent — "Out of scope: ... payment collection ... it does not react to actual payments." | Partial prepayment handling and re-amortisation are out of scope; the function only projects the schedule at disbursement, so the term-fixed re-amortisation decision is not addressed. |
| 12 | yes | no | "principal > 0 ... term_months ≥ 1 ... Behaviour for inputs that violate these preconditions is out of scope for this specification and should be defined as input validation elsewhere." | The spec establishes zero/negative principal or term as invalid via preconditions, but explicitly defers the rejection-with-error behaviour out of scope rather than stating that such loans are rejected, so the reference resolution is not literally stated. |
| 13 | yes | **yes** | "The first instalment is due one calendar month after the disbursement date. Each subsequent instalment is due one calendar month after the previous due date." | First due date is disbursement + one month with monthly instalments thereafter, matching the reference. |
| 14 | yes | **yes** | Output table (due_date, opening_balance, interest, principal, instalment, closing_balance) plus total_cost_of_credit and disclosed_apr; "The APR uses actual/365 for discounting even though interest accrual uses 30/360." | Spec returns the full per-period schedule, total cost of credit, and disclosed APR computed on an actual/365 basis while accrual stays 30/360, capturing the non-obvious dual-day-count disclosure quirk in the reference. |
