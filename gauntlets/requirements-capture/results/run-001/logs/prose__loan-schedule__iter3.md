# prose — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 6 · Captured: 10/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ The brief omits amortisation method, interest day-count convention, instalment dating/stub-period rules, and rounding/residual policy, each of which has several plausible answers that materially change the schedule and cannot be safely inferred, so I ask before specifying.

Q: Amortisation method: should each instalment be a fixed equal total payment (annuity/EMI style, so principal rises as interest falls), equal principal per instalment (total payment declines), or interest-only with a principal balloon at term end?
A: Equal principal per period: each period's principal portion is P/n (constant), interest accrues on the reducing balance, so the total instalment decreases over the term. Annuity/EMI and interest-only balloon structures are not used.

Q: Interest accrual convention: is the periodic interest simply the annual nominal rate divided by 12 applied to the outstanding balance, or should it use a day-count convention (e.g. 30/360, actual/365) based on actual days between instalment dates?
A: 30/360 day-count: periodic interest = annual nominal rate × (30/360) applied to the outstanding balance. Interest is computed once per monthly period, not by daily accrual.

Q: Instalment dating: when is the first instalment due (e.g. exactly one calendar month after disbursement), and how should dates that fall on month-ends or non-existent days (e.g. the 31st) be handled? Is there any first stub period if the disbursement day differs from the instalment day?
A: First instalment is due disbursement date + one calendar month; subsequent instalments follow monthly thereafter. If disbursement falls before the first period start, a stub interest charge is levied for those extra days. Handling of dates that fall on the 31st or other non-existent days (e.g. 30 April + 1 month): [default, not policy] roll to the last day of the month.

Q: Rounding policy: to what precision are interest, principal and instalment amounts rounded (e.g. 2 decimal places), and how is the residual reconciled — do you adjust the final instalment so the closing balance is exactly zero, or carry rounding differences another way?
A: Instalments are rounded to the whole shilling (no cents). Within each period, interest is computed and rounded first; principal is the remainder of the rounded instalment. Accumulated rounding differences are settled in the final instalment, which is adjusted so the closing balance is exactly zero.

### Round 2
_Step reasoning:_ Stub-period interest handling and zero-rate behaviour are still materially underspecified and cannot be reliably inferred, so one more clarifying round is warranted before writing the spec.

Q: The stub period: you said extra days before the first period start attract a stub interest charge. How is that stub interest computed and where does it sit in the schedule? Specifically (a) day-count for the stub, e.g. actual days between disbursement and first period start over 360, versus 30/360; (b) is it charged on the full principal; (c) does it appear as a separate line/charge at disbursement, get added to the first instalment's interest, or amortise into the schedule; and (d) is it rounded to the whole shilling like everything else?
A: (a) Day-count for the stub: [default, not policy] actual days between disbursement and the first period start, divided by 360 (preserving the 30/360 year basis). (b) It is computed on the full opening principal — no repayment has occurred yet. (c) [default, not policy] It is added to the first instalment's interest line rather than appearing as a separate disbursement-day charge or being spread across the schedule; the first instalment therefore carries a larger interest component than subsequent ones. (d) [default, not policy] Rounded to the whole shilling, consistent with the general rounding policy.

Q: Zero or edge-case inputs: how should the engine treat a 0% interest rate (principal-only instalments), and are there constraints on term length or minimum principal I should enforce or assume valid?
A: Zero or negative principal or term are rejected as invalid with an error — the engine must not produce a schedule for them. A 0% interest rate: [default, not policy] treated as valid; interest is zero each period, so each instalment equals the constant principal portion P/n (rounded to the whole shilling, with final-instalment reconciliation as normal). No minimum principal or maximum term is specified as policy; [default, not policy] enforce that both are positive integers/values and let the caller decide sensible bounds.

### Round 3 (process signalled done)
_Step reasoning:_ The material policy decisions the brief omitted — amortisation method, accrual convention, instalment dating and stub handling, rounding and reconciliation, stub computation, and invalid/zero-input treatment — have all been settled by the stakeholder; remaining details are stated defaults, so I have enough to write the specification correctly.

(no questions this round)

## Produced specification

# Repayment Schedule Engine — Requirements Specification

## 1. Purpose and scope

This specifies `generate_schedule(loan)`, which takes a disbursed loan and returns its full repayment schedule. For each instalment the schedule gives the due date, the interest due, the principal due, the total instalment, and the running (closing) balance. The engine implements a single, fixed institutional policy; none of the decisions below are configurable unless stated.

## 2. Input

The `loan` value carries four fields:

- `principal` — the disbursed amount, expressed in whole shillings (the schedule currency has no sub-units in output; see rounding).
- `annual_nominal_rate` — the annual nominal interest rate (e.g. 0.18 for 18%).
- `term` — the number of monthly instalments, an integer.
- `disbursement_date` — the calendar date the loan was disbursed.

## 3. Amortisation method — equal principal per period

Each instalment repays a constant principal portion of `principal / term`. Interest accrues on the reducing outstanding balance, so the total instalment is largest at the start and declines over the term. Annuity/EMI (fixed equal total payment) and interest-only-with-balloon structures are NOT used.

The constant scheduled principal per period is `P/n` computed on the exact (unrounded) principal; the whole-shilling rounding and final reconciliation described in section 7 apply on top of this.

## 4. Interest accrual convention — 30/360

Interest is computed once per monthly period (not by daily accrual). For a regular monthly period:

`periodic_interest = outstanding_balance × annual_nominal_rate × (30 / 360)`

The 30/360 basis treats every regular month as 30 days over a 360-day year (equivalent to `annual_nominal_rate / 12`). Interest is charged on the balance outstanding at the start of the period, before that period's principal is applied.

## 5. Instalment dating

- The first instalment is due on `disbursement_date` plus one calendar month.
- Each subsequent instalment is due one calendar month after the previous one, for `term` instalments in total.
- Month-end / non-existent dates: when adding a calendar month lands on a day that does not exist in the target month (e.g. 31 January + 1 month, or 30 April as a target of the 31st), the due date rolls to the last day of that month. (This is an engine default, not an explicit institutional policy, and is applied consistently to the first and all subsequent instalments.)

## 6. Stub interest (extra days before the first regular period)

If the disbursement falls before the start of the first regular period, the extra days attract a stub interest charge. It is computed as follows:

- (a) Day-count: `actual` calendar days between the disbursement date and the first period start, divided by 360, preserving the 30/360 year basis. (Engine default.)
- (b) Base: charged on the full opening principal, since no repayment has yet occurred: `stub_interest = principal × annual_nominal_rate × (actual_stub_days / 360)`.
- (c) Placement: the stub interest is added to the first instalment's interest line. It does NOT appear as a separate disbursement-day charge and is NOT amortised across the schedule. The first instalment therefore carries a larger interest component than later instalments. (Engine default.)
- (d) Rounding: rounded to the whole shilling, consistent with the general rounding policy. (Engine default.)

Where the disbursement aligns with the first period start (no extra days), the stub is zero and the first instalment's interest is the ordinary 30/360 periodic interest.

## 7. Rounding and reconciliation

- All monetary amounts in the output are rounded to the whole shilling; there are no cents.
- Order of computation within each period: interest is computed and rounded FIRST (for the first instalment this includes any stub interest, per section 6); the principal portion is then the remainder of the rounded instalment. In the regular equal-principal structure the scheduled principal is `P/n` rounded to the whole shilling, and the instalment total is rounded interest plus rounded principal.
- Accumulated rounding differences across the schedule are settled in the FINAL instalment. The final instalment's principal (and hence total) is adjusted so that the closing balance after the last instalment is exactly zero. The final instalment may therefore differ from the others by the accumulated rounding residual.

## 8. Output — the schedule

`generate_schedule(loan)` returns the ordered list of instalments, one per period from 1 to `term`. Each entry contains:

- the instalment number,
- the due date (per section 5),
- the interest due (per sections 4 and 6, rounded per section 7),
- the principal due (per sections 3 and 7),
- the total instalment (interest + principal),
- the running/closing outstanding balance after the instalment is applied.

The closing balance decreases monotonically to exactly zero at the final instalment.

## 9. Zero and edge-case handling

- Zero or negative principal is rejected as invalid; the engine raises an error and does not produce a schedule.
- Zero or negative term is rejected as invalid; the engine raises an error and does not produce a schedule.
- A 0% interest rate is valid (engine default). Interest (including any stub) is zero each period, so each instalment equals the constant principal portion `P/n` rounded to the whole shilling, with final-instalment reconciliation applied as normal so the closing balance is exactly zero.
- No minimum principal or maximum term is imposed as policy. The engine enforces only that principal and term are positive; sensible upper/lower bounds are left to the caller. (Engine default.)

## 10. Worked behaviour (illustrative, not a fixed test vector)

For a loan with no stub period and a positive rate, instalment 1 has the highest interest and highest total; interest falls each period as the balance reduces by the constant `P/n`; the total instalment declines correspondingly; and the final instalment absorbs the rounding residual so the balance closes at zero. A stub period, when present, raises only the first instalment's interest line.

## Auditor verdict

_The spec strongly covers the method and rounding decisions (1,2,3,4,5,7,8,9,12,13 all surfaced and correct) but misses the bespoke settlement and disclosure policies. Decisions 10 (Rule-of-78 rebate) and 11 (partial-prepayment re-amortisation) are entirely absent. Decision 6 fails because currency KES is unnamed and the 2-dp precision is contradicted by whole-shilling output. Decision 14 is partially surfaced (schedule shape) but omits total cost of credit and the actual/365 APR disclosure quirk. Correct: 11/14 (decisions 1,2,3,4,5,7,8,9,12,13 plus... counting: 1,2,3,4,5,7,8,9,12,13 = 10 correct)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §4: 'periodic_interest = outstanding_balance × annual_nominal_rate × (30 / 360)'; §3: 'Interest accrues on the reducing outstanding balance' | Interest is charged on the reducing/declining outstanding balance, matching declining balance on reducing principal. |
| 2 | yes | **yes** | §3: 'Each instalment repays a constant principal portion of principal / term... the total instalment is largest at the start and declines over the term. Annuity/EMI... are NOT used.' | Explicitly specifies equal principal (P/n), declining total instalment, and rules out EMI, matching the reference exactly. |
| 3 | yes | **yes** | §4: 'The 30/360 basis treats every regular month as 30 days over a 360-day year' | Day-count convention is 30/360, matching the reference; actual/365 for accrual is excluded. |
| 4 | yes | **yes** | §4: 'Interest is computed once per monthly period (not by daily accrual)' | Interest calculation period is the same as the repayment period, not daily accrual, matching the reference. |
| 5 | yes | **yes** | §6: 'If the disbursement falls before the start of the first regular period, the extra days attract a stub interest charge... stub_interest = principal × annual_nominal_rate × (actual_stub_days / 360)' | Interest accrues from disbursement with a stub charge for extra days; partial-period interest is allowed and charged, matching the reference. Note: spec uses actual days for the stub count rather than 30/360, but the core decision (stub interest from disbursement) is correctly surfaced and resolved. |
| 6 | no | no | §2 refers to 'whole shillings' and §7 to 'the whole shilling'; no currency code stated and no 2-decimal precision (output is whole-shilling, no cents). | The currency is implied as shillings but KES is never named, and the reference's 2-decimal-place amount precision is contradicted by the spec's whole-shilling output with no cents. The exact value is not matched. |
| 7 | yes | **yes** | §7: 'All monetary amounts in the output are rounded to the whole shilling; there are no cents... Accumulated rounding differences across the schedule are settled in the FINAL instalment.' | Instalments rounded to whole shilling and accumulated residual settled in the final instalment, matching the reference exactly. |
| 8 | yes | **yes** | §7: 'interest is computed and rounded FIRST... the principal portion is then the remainder of the rounded instalment.' | Within-period order is interest computed and rounded first, principal as remainder, matching the reference. |
| 9 | yes | **yes** | §7: 'the closing balance after the last instalment is exactly zero'; §8: 'decreases monotonically to exactly zero at the final instalment.' | Final instalment reconciles to an exactly zero closing balance, matching the reference. |
| 10 | no | no | absent | The spec never addresses early full settlement or an unearned-interest rebate; no mention of Rule of 78 or any rebate method. |
| 11 | no | no | absent | The spec never addresses partial prepayment, principal application, or re-amortisation strategy (fixed term vs fixed instalment). |
| 12 | yes | **yes** | §9: 'Zero or negative principal is rejected as invalid; the engine raises an error... Zero or negative term is rejected as invalid; the engine raises an error' | Zero/negative principal and term are rejected as invalid errors, matching the reference. |
| 13 | yes | **yes** | §5: 'The first instalment is due on disbursement_date plus one calendar month... Each subsequent instalment is due one calendar month after the previous one' | First due date is disbursement + one month, monthly thereafter, matching the reference. |
| 14 | yes | no | §8 lists the per-period schedule fields (number, due date, interest, principal, total, closing balance); no total cost of credit and no APR/disclosure. | The full per-period schedule is surfaced, but the spec omits the total cost of credit and the disclosed APR on an actual/365 basis; the distinctive 30/360-accrual-but-actual/365-disclosure quirk is absent, so it is not correct. |
