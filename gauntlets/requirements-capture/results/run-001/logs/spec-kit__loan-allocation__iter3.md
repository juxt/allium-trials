# spec-kit — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 18 · Captured: 12/14 · Bespoke captured: 6/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: I'll ask directly instead. Here's the first round — the decisions that most shape the algorithm. Answer inline, and feel free to say "use the common default" for any where you don't have a firm policy.

**1. Cross-instalment order.** With several instalments outstanding, does a payment work through the *oldest instalment* completely first (FIFO waterfall), sweep *one component class across all instalments* first (all penalties oldest→newest, then all fees, then all interest, then all principal), split *pro-rata*, or something else?

**2. Component waterfall within an instalment.** In what order are penalties, fees, interest and principal paid down? (e.g. penalties → fees → interest → principal.)

**3. Overpayment.** If the payment exceeds everything currently owed, what happens to the surplus: hold as unapplied credit, prepay future principal, refund, or reject the payment?

**4. Eligibility.** Which instalments can receive money: only due/overdue, or also future not-yet-due instalments (allowing prepayment)?

**5. Underpayment / partial.** If the payment can't cover an instalment or even a single component, do you allow partial allocation (apply what's there, leave a remainder), or must a payment meet some minimum (e.g. the full current due) before anything is applied?

**6. Directed payments.** Can the borrower or caller direct a payment at a specific instalment or component, or is allocation always automatic by the rules above?

**7. Rounding & currency.** What's the monetary unit (minor units / decimal places), and how do you round when a split would produce fractions? Any risk of currency mismatch between payment and loan that the function must guard against?

**8. Interest on prepayment.** If a payment reduces principal early, does future interest get recalculated, or is each instalment's interest fixed by the original schedule?

**9. Validation.** How should the function treat a zero, negative, or non-numeric payment, or a loan with no outstanding balance?

**10. Return shape.** The brief says return "how the payment is applied and the loan's updated balances." Do you have a required structure in mind (e.g. a per-instalment, per-component breakdown of amounts applied, plus remaining balances and any surplus/unapplied), or should I design it?
A: Answers in order:

**1. Cross-instalment order.** FIFO waterfall. The oldest overdue instalment must be cleared completely across all four of its buckets before any money touches the next instalment.

**2. Component waterfall within an instalment.** Fees → penalties → interest → principal. Fees come before penalties.

**3. Overpayment.** Surplus is held as an unallocated credit balance. It is auto-applied when the next instalment falls due. It is never auto-refunded.

**4. Eligibility.** Only due and overdue instalments. Surplus from settling the current instalment becomes a credit balance; it does not flow forward to prepay future scheduled instalments.

**5. Underpayment / partial.** Partial allocation is allowed. Apply strictly in bucket order, filling each bucket as far as the money goes, leaving a remainder. No minimum-payment gate.

**6. Directed payments.** [Default, not policy — allocation is automatic per the rules above. No directed-payment override is defined.]

**7. Rounding & currency.** Loan is denominated in BHD — three decimal places (fils). Round half-up to three decimal places. Any rounding residual is absorbed into the interest component. Guard against currency mismatch: reject any payment not in BHD.

**8. Interest on prepayment.** Each instalment's interest is fixed by the original schedule. Early settlement of principal does not trigger recalculation of future interest.

**9. Validation.** Negative payment: reject with an error. Zero payment: no-op, but still record a zero-value allocation transaction. No outstanding balance: the zero-payment rule applies — record, allocate nothing.

**10. Return shape.** Per payment, return: amount applied to each bucket of each instalment touched, resulting outstanding balances per instalment, any credit_balance created, and any tolerance_written_off amount.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Good, that's most of it pinned. Two of your answers open smaller policy questions I need to close before the spec is unambiguous.

**A. Tolerance write-off (from answer 10).** You want a `tolerance_written_off` figure returned, but we haven't defined the tolerance policy. Specifically:
- What triggers it: when a payment leaves an instalment short of full settlement by a tiny amount, do we write that shortfall off and treat the instalment as settled? Or does tolerance apply to a tiny *residual balance* regardless of payment?
- What's the threshold (e.g. ≤ 0.010 BHD / 10 fils)?
- Which bucket does the written-off amount come out of, and does writing it off mark the instalment settled?

**B. Existing credit balance on an incoming payment.** Answer 3 says surplus is held as credit and auto-applied "when the next instalment falls due." When `allocate_payment` runs for a fresh payment, should it *also* fold in any pre-existing credit balance already sitting on the loan (credit + payment allocated together), or does `allocate_payment` only ever deal with the incoming payment, leaving credit application to the separate due-date process?

**C. Rounding residual into interest (from answer 7).** Given every amount is already at three decimals (fils) and interest is fixed by schedule, where do you expect a rounding residual to actually arise? I want to know the mechanism you have in mind so the rule isn't dead text. Is it, for example, when a partial allocation is computed as a proportion, or is this purely a defensive catch-all?

And one I missed:

**D. Ordering tie-break.** If two outstanding instalments share the same due date, how do we order them (e.g. by instalment number ascending)?
A: **A. Tolerance write-off.** Trigger: when the residual owed on an instalment after allocation is ≤ 0.005 BHD, write it off and mark the instalment fully settled. The written-off amount comes out of whichever bucket still carries the residual at that point — in practice, almost always principal, since that is settled last. [Bucket attribution: default, not policy — confirm if it matters for reporting.]

**B. Existing credit balance on an incoming payment.** `allocate_payment` deals only with the incoming payment amount. Any pre-existing credit balance is applied by the separate due-date process, not folded into the live allocation run. [Default, not policy.]

**C. Rounding residual mechanism.** Treat it as a defensive catch-all. Given that interest is fixed by schedule and all inputs are already at three decimal places, no systematic residual is expected. The rule exists to absorb any sub-fil arithmetic drift that surfaces from internal intermediate computation rather than from a defined split or proportion step.

**D. Tie-break on same due date.** Ascending instalment number. [Default, not policy.]

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in this directory.

It captures every policy you pinned down:

- **FIFO across instalments**, oldest cleared completely before the next (R4), with the fees → penalties → interest → principal waterfall within each (R2).
- **Due and overdue only** (R3); surplus becomes an unallocated **credit balance**, never forwarded to future instalments and never auto-refunded (R7).
- **Partial allocation** with no minimum gate (R5), and **fixed schedule interest** (R6).
- **BHD, three decimals, round half-up** (R-CUR block), with the sub-fil residual absorbed into interest as a defensive catch-all.
- **Tolerance write-off** at ≤ 0.005 BHD, tested only on instalments the pass actually reached, drawn from the residual bucket and marking the instalment settled (R-TOL block).
- **Validation**: reject negative, invalid or non-BHD payments as errors; zero payment is a recorded no-op that also covers the no-outstanding-balance case (R-VAL block).
- The **return structure** you asked for: per-instalment per-bucket applied amounts, resulting balances, `credit_balance` and `tolerance_written_off`.

The four things you flagged as defaults rather than policy (D1–D4) plus one genuine gap I couldn't close from your answers, the value date used to decide which instalments are due (D5), are recorded under assumptions with a short open-items list. Worth a look at D5 in particular, since eligibility can't be computed without it.
A: Good summary. On D5: use the payment's value_date as the reference point. An instalment is eligible if its due date falls on or before that value_date. That's also the date to which penalty accrual runs before allocation begins.

### Round 4
_Step reasoning:_ (live agent turn)

Q: `spec.md` is complete and internally consistent. D5 is now firm policy rather than an assumption: eligibility is `due_date <= value_date`, and penalty accrual runs to that same `value_date` before allocation (R0).

Three open items remain, all narrow and none blocking the allocation logic itself:

- Where penalty accrual lives (inside the function or a preceding step) and where its rate and basis are defined.
- Whether `tolerance_written_off` needs a per-bucket breakdown.
- The concrete error surface for rejected payments (exception versus error result).

Everything else, the FIFO waterfall, the fees → penalties → interest → principal order, due/overdue eligibility, partial allocation, fixed interest, BHD three-decimal rounding, the 0.005 tolerance write-off, surplus-to-credit and the validation rules, is specified with worked examples. Say the word if you want the three open items closed too.
A: Understood. Please close all three.

**Penalty accrual location and basis.** Accrual runs as a preceding step, outside the allocation function itself. The allocation function receives already-accrued balances. Rate and basis are defined in the loan product configuration, not in the allocation spec.

**Tolerance write-off breakdown.** No per-bucket breakdown required. A single `tolerance_written_off` scalar per instalment is sufficient.

**Error surface for rejected payments.** Rejected payments (negative amount, non-BHD currency, non-numeric input) raise an exception rather than returning an error result. Zero payment returns normally with a recorded no-op result.

### Round 5
_Step reasoning:_ (live agent turn)

Q: All three closed, and the open-items list is now empty. The final positions in `spec.md`:

- **Penalty accrual (R0)** is a preceding step outside `allocate_payment`; the function receives already-accrued balances, and rate and basis live in the loan product configuration.
- **Tolerance write-off (R-TOL-2)** is a single scalar per instalment, no per-bucket breakdown. The stray D3 assumption is removed.
- **Error surface** now states rejected payments raise an exception, while a zero payment returns normally as a recorded no-op (R-VAL-4).

The specification is complete with no outstanding questions. It fixes the FIFO cross-instalment waterfall, the fees → penalties → interest → principal component order, `due_date <= value_date` eligibility, partial allocation with no minimum, fixed schedule interest, BHD three-decimal half-up rounding, the 0.005 BHD tolerance write-off, surplus held as non-refunded credit, and the validation and exception rules, with worked examples and the remaining defaults (D1, D2, D4, D5) recorded as marked assumptions.
A: Confirmed. The specification is complete.

## Produced specification

# Payment allocation — requirements specification

## Overview

This specifies `allocate_payment(payment, loan)` for the loan servicing system. When a
borrower pays, the function applies the money across what the borrower currently owes on the
loan and reports both how the payment was applied and the loan's updated balances.

A loan carries one or more outstanding instalments. Each instalment owes up to four
components, held in separate buckets: fees, penalties, interest and principal. Allocation is
automatic and rule driven. It follows a fixed order across instalments and a fixed order
within each instalment, applies a small settlement tolerance, and parks any surplus as an
unallocated credit balance rather than refunding it.

## Interface

```
allocate_payment(payment, loan) -> AllocationResult
```

The function does not mutate its inputs in place for the caller's purposes beyond returning
the updated balances; whether it mutates or returns copies is an implementation choice, but
the returned result is the authoritative record of the outcome.

## Scope

In scope: applying a single incoming payment to the instalments of a single loan, computing
the per bucket allocation, the resulting outstanding balances, any credit balance created and
any amount written off under tolerance, and validating the payment.

Out of scope: applying pre-existing credit balances (handled by a separate due-date process,
see assumption D1), interest recalculation, refunds, directed payments, multi-loan or
multi-currency settlement, and persistence. These are noted under assumptions and open items.

## Domain model

**Loan.** Denominated in BHD. Holds an ordered set of instalments and a credit balance. The
credit balance is money previously held unallocated; `allocate_payment` may add to it but does
not consume it (see R7 and assumption D1).

**Instalment.** Has an instalment number, a due date and four component buckets: fees,
penalties, interest and principal. Each bucket holds a non-negative outstanding amount in BHD.
An instalment is eligible for allocation only when it is due or overdue (see R3).

**Bucket.** One of fees, penalties, interest or principal, in that priority order.

**Payment.** Has an amount, a currency and a value date. The amount is expected in BHD at
three decimal places. The currency must be BHD. The value date is the reference point for
instalment eligibility (R3) and the date to which penalties are accrued before allocation
(R0).

## Currency and rounding

- **R-CUR-1.** The loan is denominated in BHD. All monetary amounts are in BHD to three
  decimal places (fils; one fils is 0.001 BHD).
- **R-CUR-2.** Rounding is half-up to three decimal places wherever a value must be reduced to
  fils precision.
- **R-CUR-3.** Intermediate arithmetic is carried at full precision. Each amount recorded in
  the result is rounded half-up to three decimals. Any sub-fil residual left by internal
  intermediate computation is absorbed into the interest component of the last instalment
  touched. No systematic residual is expected because inputs are already at three decimals and
  interest is fixed by schedule (see R6); this rule is a defensive catch-all only.

## Allocation algorithm

The function proceeds in this order.

- **R0. Balances are already accrued.** Penalty accrual to the payment's value date runs as a
  preceding step, outside `allocate_payment`. The function receives already-accrued balances,
  so the penalties bucket of each instalment is current as of the value date on entry. The
  accrual rate and basis are defined in the loan product configuration, not in this
  specification.
- **R1. Validate first.** Apply the validation rules in the validation section before any
  allocation. A rejected payment produces no allocation.
- **R2. Component waterfall.** Within any single instalment, apply money to buckets strictly
  in the order fees, then penalties, then interest, then principal. Fees are paid before
  penalties.
- **R3. Eligibility.** Only instalments that are due or overdue may receive allocation. An
  instalment is due or overdue when its due date falls on or before the payment's value date.
  Future, not-yet-due instalments are never touched by `allocate_payment`, even when money
  remains after all due instalments are settled (see R7).
- **R4. Cross-instalment order (FIFO).** Process eligible instalments oldest first. The oldest
  overdue instalment must be cleared completely across all four of its buckets before any
  money touches the next instalment. Order instalments by due date ascending; where two share
  the same due date, order by instalment number ascending (assumption D2).
- **R5. Partial allocation.** There is no minimum-payment gate. Fill each bucket in order as
  far as the remaining money allows, then stop when the money is exhausted, leaving the
  remaining buckets and instalments untouched. A payment that only partly covers a bucket
  applies what it can and leaves the rest outstanding.
- **R6. Interest is fixed.** Each instalment's interest is fixed by the original schedule.
  Settling principal early does not trigger recalculation of any future instalment's interest.

## Settlement tolerance

- **R-TOL-1.** After the allocation pass has applied whatever it can to an instalment, if that
  instalment's total residual owed across its buckets is greater than zero and less than or
  equal to 0.005 BHD (five fils), write the residual off and mark the instalment fully
  settled.
- **R-TOL-2.** The written-off amount is drawn from whichever bucket still carries the
  residual at that point. Because principal is settled last, this is almost always principal.
  No per-bucket breakdown of the written-off amount is required; a single scalar per
  instalment is sufficient.
- **R-TOL-3.** The tolerance test applies only to instalments the allocation pass actually
  reached. An instalment that received no allocation because the payment was exhausted earlier
  is not tested and not written off. An instalment settled exactly (residual zero) is settled
  normally and is not a tolerance write-off.
- **R-TOL-4.** The total amount written off across all instalments in this run is reported as
  `tolerance_written_off`.

## Overpayment and credit balance

- **R7. Surplus becomes credit.** If money remains after all eligible (due or overdue)
  instalments are settled, the surplus is held as an unallocated credit balance on the loan
  and reported as `credit_balance`. It is never applied to future scheduled instalments by
  this function, and it is never auto-refunded. Application of the credit balance to the next
  instalment when it falls due is performed by a separate due-date process (assumption D1).

## Validation and error handling

- **R-VAL-1. Currency mismatch.** If the payment currency is not BHD, reject the payment with
  an error. No allocation is performed.
- **R-VAL-2. Negative payment.** If the payment amount is negative, reject the payment with an
  error. No allocation is performed.
- **R-VAL-3. Non-numeric or otherwise invalid amount.** Treated as an invalid payment and
  rejected with an error, as for a negative amount.
- **R-VAL-4. Zero payment.** A zero payment is not an error. It is a no-op that still records a
  zero-value allocation transaction: nothing is applied, no credit balance is created and
  nothing is written off.
- **R-VAL-5. No outstanding balance.** A payment against a loan with nothing due or overdue is
  handled by the zero-payment rule: record the transaction and allocate nothing. Any non-zero
  payment amount in this case has no eligible instalment to receive it and its full amount
  becomes a credit balance under R7.

Errors under R-VAL-1 to R-VAL-3 raise an exception rather than returning a result. The
exception identifies the reason (currency mismatch, negative amount or invalid amount). The
zero payment under R-VAL-4 returns normally with a recorded no-op result and does not raise.

## Return structure

`AllocationResult` reports, for a single payment:

- `payment_amount` and `currency` as received.
- `allocations`: an ordered list, one entry per instalment the payment touched, each with:
  - the instalment number,
  - `applied`: the amount applied to each of the four buckets (fees, penalties, interest,
    principal),
  - `resulting_outstanding`: the outstanding amount remaining in each of the four buckets
    after allocation, and the instalment total,
  - `settled`: whether the instalment is now fully settled (including by tolerance write-off),
  - `written_off`: the amount written off on this instalment under tolerance, if any.
- `credit_balance`: the unallocated credit created from surplus in this run (zero if none).
- `tolerance_written_off`: the total written off under tolerance across all instalments in
  this run (zero if none).

A zero-payment no-op (R-VAL-4) returns a result with empty or all-zero `allocations`,
`credit_balance` of zero and `tolerance_written_off` of zero, and still constitutes a recorded
transaction.

## Worked examples

All amounts are BHD to three decimal places.

**Example 1 — FIFO across two overdue instalments, partial second.**
Instalment 1 (older): fees 5.000, penalties 2.000, interest 10.000, principal 100.000.
Instalment 2: fees 5.000, penalties 0.000, interest 9.000, principal 100.000.
Payment 150.000.
Instalment 1 is cleared in full (117.000 applied) before instalment 2 is touched. Of the
remaining 33.000, instalment 2 receives fees 5.000, penalties 0.000, interest 9.000 and
principal 19.000, leaving principal 81.000 outstanding. Instalment 1 settled, instalment 2
partial, `credit_balance` 0.000, `tolerance_written_off` 0.000.

**Example 2 — tolerance write-off.**
Instalment 1: fees 0.000, penalties 0.000, interest 0.000, principal 50.004.
Payment 50.000.
Principal receives 50.000, leaving a residual of 0.004, which is ≤ 0.005. The 0.004 is written
off and the instalment is marked settled. `resulting_outstanding` for the instalment is
0.000, `tolerance_written_off` is 0.004.

**Example 3 — overpayment becomes credit.**
Single overdue instalment, total owed 100.000. Payment 120.000.
The instalment is settled with 100.000 applied. The surplus 20.000 becomes `credit_balance`
20.000. It is not applied to any future instalment and is not refunded.

**Example 4 — validation.**
Payment amount -5.000: rejected with a negative-amount error, no allocation. Payment currency
USD: rejected with a currency-mismatch error, no allocation. Payment 0.000: no-op, a
zero-value transaction is recorded.

## Assumptions and defaults

These were not stated as firm institutional policy and should be confirmed. They are recorded
here so the boundary between policy and default is explicit.

- **D1. Existing credit balance.** `allocate_payment` deals only with the incoming payment
  amount. Any pre-existing credit balance on the loan is applied by a separate due-date
  process, not folded into a live allocation run.
- **D2. Tie-break on equal due dates.** Instalments sharing a due date are ordered by
  instalment number ascending.
- **D4. Directed payments.** None. Allocation is always automatic per the rules above; there
  is no override to target a specific instalment or bucket.
## Open items

None. All previously open policy decisions are resolved.


## Auditor verdict

_The spec covers 12 of 14 reference decisions correctly (coverage 12/14). It nails the bespoke policy choices on bucket order (fees before penalties), FIFO clearing, credit-balance handling, BHD 3-dp precision, half-up rounding, interest-residual destination, no-prepay early payments, tolerance write-off, validation, penalty accrual to value date, and the result shape. Two gaps: decision 7 (back-valued payments) is resolved opposite to the reference, since the spec fixes interest and excludes recalculation rather than re-accruing interest to an earlier value_date; and decision 13 (same-day multiple payments FIFO by timestamp) is entirely absent, as the spec is scoped to a single payment._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | R2: "apply money to buckets strictly in the order fees, then penalties, then interest, then principal. Fees are paid before penalties." | The spec states the exact reference order, explicitly calling out that fees precede penalties (the non-default choice), matching the reference. |
| 2 | yes | **yes** | R4: "The oldest overdue instalment must be cleared completely across all four of its buckets before any money touches the next instalment." | Matches the reference: oldest instalment cleared in full across all buckets before any allocation to the next. |
| 3 | yes | **yes** | R7: "the surplus is held as an unallocated credit balance on the loan... never auto-refunded. Application of the credit balance to the next instalment when it falls due is performed by a separate due-date process." | Matches all three parts: held as unallocated credit, applied to next instalment when due (via separate process), never refunded. |
| 4 | yes | **yes** | R-CUR-1: "The loan is denominated in BHD. All monetary amounts are in BHD to three decimal places (fils; one fils is 0.001 BHD)." | Exactly matches the reference currency (BHD) and minor unit (3 dp). |
| 5 | yes | **yes** | R-CUR-2: "Rounding is half-up to three decimal places wherever a value must be reduced to fils precision." | Matches the reference rounding method: half-up to the 3-dp minor unit. |
| 6 | yes | **yes** | R-CUR-3: "Any sub-fil residual left by internal intermediate computation is absorbed into the interest component of the last instalment touched." | Matches the reference: rounding residual lands in interest, not principal. |
| 7 | yes | no | R0: "Penalty accrual to the payment's value date runs as a preceding step, outside allocate_payment." R6: "Settling principal early does not trigger recalculation of any future instalment's interest." Scope excludes "interest recalculation". | The reference requires interest to be re-accrued to an earlier value_date before allocation. The spec addresses value-date handling only for penalty accrual and explicitly treats interest as fixed and interest recalculation as out of scope, so it resolves this decision opposite to the reference. |
| 8 | yes | **yes** | R3: "Future, not-yet-due instalments are never touched"; R7 surplus becomes credit; R6: "Settling principal early does not trigger recalculation of any future instalment's interest." | The spec settles the current instalment, parks surplus as credit rather than prepaying principal, and keeps future interest fixed, matching the reference exactly. |
| 9 | yes | **yes** | R5: "Fill each bucket in order as far as the remaining money allows... A payment that only partly covers a bucket applies what it can and leaves the rest outstanding." | Strict in-order fill with no proportional split, matching the reference. |
| 10 | yes | **yes** | R-TOL-1: "if that instalment's total residual owed across its buckets is greater than zero and less than or equal to 0.005 BHD (five fils), write the residual off and mark the instalment fully settled." | Matches the reference tolerance threshold (≤ 0.005 BHD) and the mark-fully-paid / write-off behaviour. |
| 11 | yes | **yes** | R-VAL-2: negative payment "reject... with an error"; R-VAL-4: "A zero payment is not an error. It is a no-op that still records a zero-value allocation transaction." | Negative rejected with error, zero a no-op that still records a zero-value transaction, matching the reference. |
| 12 | yes | **yes** | R0: "The function receives already-accrued balances, so the penalties bucket of each instalment is current as of the value date on entry"; allocation then runs on those balances. | Substance matches: penalties are accrued to the value date and allocation runs on the post-accrual balances; delegating the accrual step outside the function does not change the resolution. |
| 13 | no | no | absent | The spec scopes itself to "a single incoming payment" and never addresses ordering of multiple payments received on the same day or FIFO-by-timestamp handling. |
| 14 | yes | **yes** | Return structure: per-instalment "applied" per bucket, "resulting_outstanding" per bucket plus total, plus "credit_balance" and "tolerance_written_off". | The result reports per-bucket amounts applied, resulting outstanding balances, credit_balance created and tolerance_written_off, matching the reference shape. |
