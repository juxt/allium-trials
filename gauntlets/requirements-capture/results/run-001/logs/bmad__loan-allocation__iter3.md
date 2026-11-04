# bmad — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 15 · Captured: 11/14 · Bespoke captured: 5/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured question prompt didn't go through. I'll just ask directly, and you can answer inline.

The brief is deliberately silent on every policy decision that actually determines how `allocate_payment` behaves. None of these can be safely inferred, so I need your answers. Here are the questions, grouped. Where I have a sense of the common choice I've marked a suggestion, but please correct me.

**Structural decisions (these shape the whole algorithm)**

1. **Component order within an instalment.** In what order does money consume the four components? Common in servicing is penalties → fees → interest → principal. Or do you use fees → penalties → …, or something that pays interest/principal first?

2. **Movement across instalments.** With several instalments outstanding, do you (a) clear the oldest instalment in full across all four components before touching the next, or (b) sweep by seniority (all penalties across every instalment, then all fees, then all interest, then all principal), or something else?

3. **Overpayment.** If the payment exceeds everything currently owed, does the surplus (a) sit on the loan as unapplied/suspense credit, (b) prepay future instalments, (c) reduce principal directly as a curtailment, or (d) get refunded?

4. **Underpayment.** If the payment can't clear a full instalment, do you (a) allocate partially down the waterfall as far as it reaches, (b) hold the whole payment in suspense until a full instalment's worth is available, or (c) allocate partially but only in whole components?

**Scope and edges**

5. **What counts as "outstanding".** Only instalments that are due or overdue, or can a borrower pay against not-yet-due (future) instalments too?

6. **Instalment ordering key.** Is "oldest" strictly by due date? Any tie-break needed (e.g. two instalments same due date)?

7. **Rounding and currency.** What's the minor-unit precision (e.g. pennies), and how do you handle rounding residuals? Should I assume integer minor units throughout to avoid float issues?

8. **Invalid or unusual inputs.** How should the function treat a zero payment, a negative payment (is that a reversal, or an error?), and a payment on a loan with nothing outstanding?

9. **Return shape.** What does the caller need back? I'm assuming a per-instalment, per-component breakdown of what was applied, plus the updated balances, plus any surplus/unapplied and any still-outstanding total. Anything else, e.g. an audit trail or the order in which allocations were made?

Answer as many as you can. Your answers to 1–4 are the ones that most change the specification, so those first if you'd rather not do all nine at once.
A: 1. **Component order within an instalment.** Fees first, then penalties, then interest, then principal.

2. **Movement across instalments.** Clear the oldest instalment in full across all four buckets before any money touches the next instalment.

3. **Overpayment.** Surplus is held as an unallocated credit balance on the loan. It is auto-applied to the next instalment when that instalment falls due. It is never auto-refunded.

4. **Underpayment.** Allocate partially down the waterfall in strict component order as far as the payment reaches. No proportional splits; no holding in suspense.

5. **What counts as outstanding.** Only instalments that are due or overdue. A borrower cannot pay directly against future instalments. Surplus from an on-time payment becomes a credit balance and is applied when the next instalment falls due; future interest is not affected.

6. **Instalment ordering key.** Oldest by due date. [default, not policy] If two instalments share the same due date, break the tie by instalment sequence number ascending.

7. **Rounding and currency.** The loan is denominated in BHD; all amounts use 3 decimal places (fils). Round half-up to 3 dp throughout. Rounding residuals are absorbed into the interest component, not principal. Represent amounts as integers in fils internally if you want to avoid float issues.

8. **Invalid or unusual inputs.** Zero payment: treated as a no-op, but a zero-value allocation transaction is still recorded. Negative payment: rejected with an error (not a reversal). Payment on a loan with nothing outstanding: [default, not policy] return an empty allocation with zero applied and balances unchanged.

9. **Return shape.** Per payment: the amount applied to each bucket of each instalment touched, the resulting outstanding balance per bucket per instalment, any credit_balance created, and any tolerance_written_off amount. On that last point: if the residual owed after allocation is 0.005 BHD or less, mark the instalment fully paid and record the written-off residual in tolerance_written_off.

### Round 2
_Step reasoning:_ (live agent turn)

Q: These are clear and answer the big structural questions. Four follow-ups, because your answers surface some interactions I don't want to guess at.

**A. Existing credit balance at payment time.** You said surplus becomes a credit balance that's auto-applied when the next instalment falls due, via a separate event. So when `allocate_payment` runs for a new incoming payment, and a credit balance already exists on the loan, does the function (a) ignore the credit balance entirely and allocate only the incoming payment, or (b) add any existing credit balance to the incoming payment and allocate the combined amount? In other words, is credit balance only ever consumed by the "instalment falls due" event, or also by an incoming payment?

**B. Should the spec include the due-date auto-application rule?** That behaviour (credit applied when the next instalment falls due) is triggered by time, not by a payment, so strictly it sits outside `allocate_payment`. Do you want it specified here as a related rule for completeness, or is it out of scope for this spec?

**C. Tolerance write-off scope.** Is the 0.005 BHD tolerance assessed per instalment, against that instalment's total residual owed across all four buckets after allocation? And does it apply only to instalments the payment actually reached, or should any instalment sitting at ≤ 0.005 residual be swept clean whenever `allocate_payment` runs? Also: when an instalment is fully cleared via tolerance write-off, the tiny residual is written off rather than paid, so it consumes none of the payment, correct? Remaining payment then flows to the next instalment as normal.

**D. Error model.** For a negative payment, should the function raise/throw an error, or return a result object carrying an error status? And is "nothing outstanding" (empty allocation) distinct from an error, i.e. a normal successful return?
A: A. **Existing credit balance at payment time.** Option (a): `allocate_payment` ignores any existing credit balance entirely and allocates only the incoming payment. The credit balance is consumed exclusively by the due-date auto-application event, never by an incoming payment.

B. **Due-date auto-application in scope?** Out of scope for this spec. It is a separate time-triggered rule, not part of `allocate_payment`. You may reference it briefly as a related behaviour, but do not specify it here.

C. **Tolerance write-off scope.** The tolerance is assessed per instalment, against that instalment's total residual across all four buckets after allocation. It applies only to instalments the payment actually reached; the function does not sweep unrelated instalments. When the tolerance fires, the residual is written off and consumes none of the payment — the remaining payment continues to the next instalment as normal. Your summary is correct.

D. **Error model.** Raise or throw an error for a negative payment (not a result object carrying an error status). A payment on a loan with nothing outstanding is a normal successful return — an empty allocation with zero applied and balances unchanged, not an error.

### Round 3
_Step reasoning:_ (live agent turn)

Q: Done. The specification is saved as `spec.md` in the working directory.

It captures the twelve policy decisions we pinned down, with each one marked as confirmed policy or as a default worth revisiting. The core of it:

- **Waterfall** is fees → penalties → interest → principal within an instalment, and oldest-instalment-first across instalments (clear one fully before touching the next).
- **Shortfall** allocates as far down the waterfall as the money reaches, no splits, no suspense. **Surplus** becomes an inert credit balance that `allocate_payment` never itself consumes.
- **Amounts** are integer fils (BHD, three decimal places); the **5-fil tolerance** forgives a trivial shortfall on a reached instalment.
- **Errors**: negative payments raise, zero payments are a recorded no-op, nothing-outstanding returns an empty allocation.

It also includes the algorithm in prose and pseudocode, the return schema, six invariants (conservation, strict priority, and so on), and four worked examples covering the shortfall, surplus-to-credit, tolerance write-off and invalid-input cases.

One thing to flag: there's an asymmetry between your surplus rule (decision 5) and the nothing-outstanding default (decision 12). A large overpayment on a nearly-settled loan is banked as credit, but a payment on a fully-current loan is returned unapplied. Since decision 12 was a default rather than firm policy, I've written it up as the single open question at the end of the spec. Worth a look when you have a moment.

I ran this as a requirements elicitation rather than a formal Allium model, since you asked for a markdown spec. If you'd also like a validated Allium formalisation of the data model and invariants (the allocation algorithm itself sits naturally as a documented black box), I can add one.
A: Good flag on the asymmetry. Decision 12 should not stay as a default: a payment received when nothing is outstanding should be held as a credit balance, exactly as an overpayment would be. That keeps the rule uniform — money is never returned, only banked — and removes the edge case. Please firm that up in the spec.

On the Allium formalisation: yes, add it. The data model and invariants are well-suited to it, and a validated formal layer alongside the prose spec gives implementers something to check against.

### Round 4
_Step reasoning:_ (live agent turn)

Q: Both changes are in.

**Decision 12 firmed up.** The nothing-outstanding case now follows the same rule as any surplus: a positive payment with nothing to apply is banked in full as a credit balance. I removed the short-circuit that returned balances unchanged, updated the policy table, algorithm, pseudocode, error handling and worked example D, and replaced the open question with a short design note explaining why the two cases are now one rule. The conservation invariant (`total_applied + credit_balance_created = P`) is now universally true, which is the cleaner formulation.

**Allium formalisation added.** `payment-allocation.allium` sits alongside the spec and passes `allium check` with no errors, warnings or findings. It models the data model (Loan, Instalment, Payment, Allocation, and an AllocationLine value type), the `AllocatePayment` operation, and five invariants: payment conservation, non-negative applications, non-negative balances, a credit balance that never goes negative, and eligibility restricted to due instalments with a positive residual. The negative-payment rejection is the `payment.amount >= 0` precondition.

One honest limitation worth stating: the allocation waterfall is represented as a black box (`allocate_lines` and the `new_*` balance functions). Ordered, running-remainder consumption is imperative and doesn't reduce to a declarative Allium expression, so the model pins down the surrounding structure and the properties an implementation must preserve, while the algorithm itself lives in the prose. The model is embedded as an appendix in `spec.md` and also stands alone as the `.allium` file so it can be checked in CI.

Two informational notes remain in the check output, both expected: `is_fully_paid` is a read-model helper with no internal caller, and `AllocatePayment` is an external entry point. Neither is a defect.
A: Good. The spec is consistent and the Allium model is clean. No further questions from me.

## Produced specification

# Payment allocation specification

**Function:** `allocate_payment(payment, loan)`
**Domain:** loan servicing
**Status:** agreed with product stakeholder, 2026-09-28

## Purpose

When a borrower pays, the money must be applied across what they currently owe on the loan. This document specifies how a single incoming payment is allocated across outstanding instalments and their component balances, what the loan looks like afterwards, and what the function returns.

Every policy decision here was confirmed with the product stakeholder. Where a value or behaviour was a reasonable default rather than a deliberate policy choice, it is marked as such, and the open question at the end flags the one point worth revisiting.

## Scope

In scope: the behaviour of `allocate_payment` for one payment against one loan. This covers the allocation waterfall within an instalment, the order in which instalments are consumed, the treatment of surplus and shortfall, rounding, the small-residual tolerance, error handling, and the shape of the result.

Out of scope: how a credit balance is later applied when the next instalment falls due (a separate, time-triggered rule described briefly under "Related behaviour"); how instalments, interest, fees and penalties are originally calculated; refunds; payment reversals; and persistence, currency conversion and transport concerns. These are assumed to be handled elsewhere.

## Definitions and data model

Amounts are held in **fils**, the minor unit of the Bahraini dinar (BHD). One dinar is 1,000 fils, so BHD amounts carry three decimal places. Representing every amount as an integer number of fils keeps arithmetic exact and avoids floating-point error. Throughout this document, amounts are shown in BHD with the fils value alongside where it aids precision.

A **loan** has a currency (BHD), an ordered set of instalments, and a credit balance holding any funds not yet applied to an instalment.

An **instalment** has a sequence number, a due date, a lifecycle status (outstanding or fully paid), and four component balances, each an amount still owed:

| Component | Meaning |
|-----------|---------|
| Fees | Service and administrative fees |
| Penalties | Late-payment penalties |
| Interest | Accrued interest |
| Principal | Outstanding capital |

An instalment's **residual** is the sum of its four component balances.

A **payment** has an amount in fils and an effective date. The effective date determines which instalments count as due or overdue. Where no effective date is supplied, the processing date is used [default, not policy].

An instalment is **outstanding** for the purpose of allocation when its due date is on or before the payment's effective date and its residual is greater than zero. Instalments not yet due cannot be paid directly; see "Related behaviour" for how early money is handled.

## Function contract

```
allocate_payment(payment, loan) -> allocation
```

The function takes the incoming payment and the loan, applies the payment across the loan's outstanding instalments according to the policy below, updates the loan's balances, and returns a record of what was applied.

The function does not consider any existing credit balance on the loan. That balance is consumed only by the separate due-date rule, never by an incoming payment.

## Allocation policy

The following table records every decision that governs allocation. All are confirmed policy unless marked otherwise.

| # | Decision | Policy |
|---|----------|--------|
| 1 | Component order within an instalment | Fees, then penalties, then interest, then principal |
| 2 | Movement across instalments | Clear the oldest outstanding instalment in full across all four components before any money touches the next |
| 3 | Instalment ordering | Oldest by due date first; ties broken by sequence number ascending [tie-break is default, not policy] |
| 4 | Shortfall | Allocate down the waterfall in strict component order as far as the payment reaches. No proportional splits, no holding in suspense |
| 5 | Surplus | Any amount left after all outstanding instalments are cleared becomes an unallocated credit balance on the loan. Never auto-refunded |
| 6 | Direct payment of future instalments | Not permitted. Only due or overdue instalments are eligible |
| 7 | Currency and precision | BHD, three decimal places (fils). Amounts represented internally as integer fils |
| 8 | Rounding | Round half up to three decimal places. Rounding residuals are absorbed into the interest component, never principal |
| 9 | Small-residual tolerance | If, after allocation, an instalment the payment reached is left owing 0.005 BHD (5 fils) or less, the residual is written off, the instalment is marked fully paid, and the written-off amount is reported |
| 10 | Zero payment | Treated as a no-op. A zero-value allocation is still recorded |
| 11 | Negative payment | Rejected: the function raises an error. Not treated as a reversal |
| 12 | Nothing outstanding | The whole payment is held as a credit balance on the loan, exactly as a surplus would be. Money is never returned, only banked |

## Algorithm

The payment is consumed once, from a running remainder, moving through instalments in order and through components within each instalment in order. Money only ever moves forward: no component or instalment is revisited.

1. **Validate.** If the payment amount is negative, raise an error and make no change to the loan. (See error handling.)

2. **Select and order.** Take the outstanding instalments, those due or overdue as of the payment's effective date with a residual above zero. Order them oldest due date first, breaking ties by ascending sequence number.

3. **Short-circuit the zero payment.** If the payment amount is zero, record an allocation with nothing applied, leave all balances unchanged, and return it. A zero payment still produces a recorded (zero-value) allocation. A positive payment with no outstanding instalments is not short-circuited: it falls through to the surplus step and is banked in full as credit.

4. **Consume the payment.** Set the remainder to the payment amount. For each outstanding instalment in order, and within it for each component in the order fees, penalties, interest, principal:
   - Apply the smaller of the remainder and the amount owed on that component. Reduce both the component balance and the remainder by that amount, and record the applied amount against that instalment and component.
   - Stop as soon as the remainder reaches zero.

5. **Apply the tolerance.** After working through an instalment the payment reached, if its residual is now greater than zero but no more than 5 fils (0.005 BHD), write off the residual: set its component balances to zero, mark the instalment fully paid, and add the written-off amount to the running total for the result. A written-off residual is forgiven, not funded, so it consumes none of the payment. Any instalment whose residual reaches zero, whether by payment or by write-off, is marked fully paid.

6. **Bank the surplus.** If any remainder is left after all outstanding instalments have been cleared, add it to the loan's credit balance and report it as the credit created by this payment.

Pseudocode:

```
function allocate_payment(payment, loan):
    if payment.amount < 0:
        raise InvalidPaymentError

    as_of = payment.effective_date            # default: processing date
    outstanding = instalments of loan where
                    due_date <= as_of and residual > 0
    sort outstanding by (due_date asc, sequence_number asc)

    allocation = new Allocation(payment, loan) # recorded even when zero

    if payment.amount == 0:
        return allocation                      # zero applied, balances unchanged

    remaining = payment.amount
    for instalment in outstanding:
        if remaining == 0: break
        for component in [fees, penalties, interest, principal]:
            if remaining == 0: break
            applied = min(remaining, instalment.owed[component])
            instalment.owed[component] -= applied
            remaining               -= applied
            allocation.record(instalment, component, applied)

        # tolerance, assessed on an instalment the payment reached
        residual = instalment.residual
        if 0 < residual <= 5:                   # 5 fils = 0.005 BHD
            allocation.tolerance_written_off += residual
            set every component of instalment to 0
        if instalment.residual == 0:
            instalment.status = fully_paid

    if remaining > 0:
        allocation.credit_balance_created = remaining
        loan.credit_balance += remaining

    return allocation
```

Because a component is only left part-paid when the remainder hits zero, and an instalment is only left with a residual when the remainder hits zero, any leftover that flows on to a later instalment implies the current one was cleared in full. In practice the tolerance therefore fires on the last instalment a payment touches, when the payment falls at most 5 fils short of clearing it. The rule is stated per reached instalment so it holds regardless of how the residual arose.

## Rounding, currency and tolerance

All amounts are integer fils, so allocation itself is exact integer subtraction and introduces no rounding. Rounding is relevant where amounts are computed upstream (interest, fees, penalties) or converted into fils: those use round half up to three decimal places, and any residual from rounding is absorbed into the interest component, never principal.

The tolerance is a servicing convenience, not a rounding step. It forgives a trivial shortfall, at most 5 fils, so a borrower who pays a whisker short is not left with an instalment stuck open. It is assessed per instalment, against the instalment's total residual across all four components, and only for instalments the payment actually reached. The function never sweeps unrelated instalments clean.

## Error handling

A **negative payment** is an error. The function raises (for example `InvalidPaymentError`); it does not return a result object carrying an error status, and it makes no change to the loan. A negative amount is never interpreted as a reversal.

A **zero payment** is not an error. It is a no-op that still records a zero-value allocation: nothing is applied and balances are unchanged.

A payment against a loan with **nothing outstanding** is not an error. The whole payment is held as a credit balance on the loan, the same treatment a surplus receives, so money is never returned to the borrower by this function, only banked.

Currency is assumed to match the loan (BHD); a currency mismatch is treated as an upstream validation concern and is out of scope here [assumption].

## Return value

The function returns an allocation record describing the outcome of this one payment:

| Field | Description |
|-------|-------------|
| `lines` | One entry per component of per instalment that received money, each giving the instalment (sequence number and due date), the component, and the amount applied. Empty for a no-op |
| `total_applied` | Total amount applied across all lines, in fils |
| `resulting_balances` | For each instalment the payment touched, the residual per component after allocation |
| `credit_balance_created` | Surplus added to the loan's credit balance by this payment; zero if none |
| `tolerance_written_off` | Total residual written off under the tolerance rule; zero if none |
| `total_outstanding_after` | The loan's total outstanding across all instalments after allocation (convenience for the caller) |

The loan itself is updated as a side effect: touched instalment balances are reduced, cleared instalments are marked fully paid, and any surplus is added to the credit balance.

## Invariants

These properties hold for every successful allocation of a payment with amount `P` greater than zero:

- **Conservation of the payment.** `total_applied + credit_balance_created = P`. Every fil of the payment is either applied to a balance or banked as credit.
- **Write-offs are not funded.** The total reduction in what is owed equals `total_applied + tolerance_written_off`. Written-off residuals reduce the debt without consuming the payment.
- **No negative balances.** No component balance, and no applied amount, is ever below zero.
- **Strict priority across instalments.** Money is applied to a later instalment only once every earlier outstanding instalment has a residual of zero, whether cleared by payment or by write-off.
- **Strict priority within an instalment.** Within an instalment, a later component receives money only once every earlier component is at zero.
- **Credit balance is inert to incoming payments.** `allocate_payment` never reads or reduces an existing credit balance; it only ever adds to it.

## Worked examples

All amounts in BHD, with fils in parentheses. Component order is fees, penalties, interest, principal.

**A. Shortfall, stopping mid-waterfall.** Instalment #1 is overdue owing fees 5.000, penalties 3.000, interest 12.000, principal 100.000. Payment 10.000 (10,000 fils).

Fees take 5.000, penalties take 3.000, interest takes the remaining 2.000, principal is untouched. The instalment is left owing interest 10.000 and principal 100.000, so it stays outstanding. Result: `total_applied` 10.000, `credit_balance_created` 0, `tolerance_written_off` 0.

**B. Oldest first, with surplus to credit.** Instalments #1 and #2 are both overdue, each owing 10.000 in every component (40.000 each). Payment 100.000.

Instalment #1 is cleared in full (40.000), then instalment #2 in full (40.000), leaving 20.000. With no outstanding instalments remaining, the 20.000 becomes credit. Result: `total_applied` 80.000, `credit_balance_created` 20.000, both instalments fully paid.

**C. Tolerance write-off.** Instalment #1 is overdue owing fees 5.000, penalties 5.000, interest 10.000, principal 30.000 (50.000 total). Payment 49.997 (49,997 fils).

Fees, penalties and interest are cleared (20.000), then 29.997 goes to principal, leaving principal owing 0.003 (3 fils) and the payment exhausted. The residual of 3 fils is within tolerance, so it is written off and the instalment is marked fully paid. Result: `total_applied` 49.997, `tolerance_written_off` 0.003, `credit_balance_created` 0.

**D. Invalid and degenerate inputs.** A payment of 0.000 returns an allocation with nothing applied and balances unchanged, but the zero-value allocation is still recorded. A payment of -5.000 raises an error and changes nothing. A payment of 10.000 against a loan with no due or overdue instalments applies nothing and banks the whole 10.000 as a credit balance, exactly as a surplus would be banked.

## Related behaviour (out of scope here)

A credit balance created by a surplus is applied automatically when the next instalment falls due, by a separate time-triggered rule. That rule, not `allocate_payment`, is the only thing that consumes the credit balance. Applying credit early does not change future interest. This specification does not define that rule; it is noted only so the lifecycle of a credit balance is clear.

## Design note: a uniform surplus rule

Decisions 5 and 12 are deliberately the same rule. Any amount of a positive payment that cannot be applied to an outstanding instalment, whether it is the tail of an overpayment or the whole of a payment that arrives with nothing due, is banked as a credit balance. Money is never returned by this function, only applied or banked. Treating the two cases identically removes the edge case that would otherwise sit between them and keeps the conservation invariant (`total_applied + credit_balance_created = P`) universally true.

## Appendix: formal model (Allium)

A formal model of the data model, the allocation operation and its invariants accompanies this specification as `payment-allocation.allium`. It passes `allium check` cleanly (no errors, warnings or findings). Two informational notes remain and are expected: `is_fully_paid` is a read-model helper for consumers, and `AllocatePayment` is an external entry point with no in-spec caller.

The allocation waterfall itself is deliberately a black box. Ordered, running-remainder consumption is imperative and does not reduce to a declarative expression, so the model represents it with named functions (`allocate_lines`, and the `new_fees` / `new_penalties` / `new_interest` / `new_principal` balance functions) whose behaviour is the algorithm defined in prose above. What the model does pin down is the surrounding structure and the properties any implementation must preserve: conservation of the payment, non-negative balances and applications, a credit balance that never goes negative and is never consumed by an incoming payment, and eligibility restricted to due instalments with a positive residual. The negative-payment rejection appears as the `payment.amount >= 0` precondition, whose failure rejects the operation.

```
-- allium: 3
-- payment-allocation.allium

enum Component { fees | penalties | interest | principal }

value AllocationLine {
    instalment: Instalment
    component: Component
    amount_applied: Integer
}

entity Loan {
    credit_balance: Integer                 -- fils not yet applied to an instalment
    instalments: Instalment with loan = this
}

entity Instalment {
    loan: Loan
    due_date: Timestamp

    fees_owed: Integer
    penalties_owed: Integer
    interest_owed: Integer
    principal_owed: Integer

    residual: fees_owed + penalties_owed + interest_owed + principal_owed
    is_fully_paid: residual = 0
    is_due(as_of): due_date <= as_of
}

entity Payment {
    loan: Loan
    amount: Integer                         -- fils; a negative amount is rejected
    effective_date: Timestamp               -- determines which instalments are due
}

entity Allocation {
    payment: Payment
    loan: Loan
    lines: List<AllocationLine>
    total_applied: Integer
    credit_balance_created: Integer
    tolerance_written_off: Integer
}

config {
    tolerance: Integer = 5                   -- fils; residuals at or below this are written off
}

rule AllocatePayment {
    when: AllocatePayment(payment, loan)

    requires: payment.loan = loan
    requires: payment.amount >= 0            -- a negative payment is rejected (caller receives an error)

    let eligible = loan.instalments where is_due(payment.effective_date) and residual > 0
    let lines = allocate_lines(payment, eligible, config.tolerance)
    let total_applied = applied_total(lines)
    let written_off = written_off_total(payment, eligible, config.tolerance)
    let credit = payment.amount - total_applied

    ensures:
        for i in eligible:
            i.fees_owed = new_fees(lines, i)
            i.penalties_owed = new_penalties(lines, i)
            i.interest_owed = new_interest(lines, i)
            i.principal_owed = new_principal(lines, i)
        Allocation.created(
            payment: payment,
            loan: loan,
            lines: lines,
            total_applied: total_applied,
            credit_balance_created: credit,
            tolerance_written_off: written_off
        )
        loan.credit_balance = loan.credit_balance + credit
}

invariant PaymentConserved {
    for a in Allocations:
        a.total_applied + a.credit_balance_created = a.payment.amount
}

invariant ApplicationsNonNegative {
    for a in Allocations:
        a.lines.all(l => l.amount_applied >= 0)
        and a.total_applied >= 0
        and a.credit_balance_created >= 0
        and a.tolerance_written_off >= 0
}

invariant BalancesNonNegative {
    for i in Instalments:
        i.fees_owed >= 0
        and i.penalties_owed >= 0
        and i.interest_owed >= 0
        and i.principal_owed >= 0
}

invariant CreditNeverNegative {
    for loan in Loans:
        loan.credit_balance >= 0
}
```

The full file, including scope comments and the `@guidance` block on the rule, is `payment-allocation.allium`.


## Auditor verdict

_The spec correctly resolves 11 of 14 decisions (1-6, 8-11, 14), matching the reference on component order, oldest-first clearing, credit-balance surplus handling, BHD 3-dp precision, half-up rounding, interest-residual absorption, early-payment non-prepayment, strict-order partial fills, the 5-fils write-off tolerance, zero/negative handling, and the result shape. Three are unaddressed: #7 (interest re-accrual to an earlier value date), #12 (penalty accrual up to the value date before allocation), and #13 (FIFO ordering of same-day payments) are all outside the stated scope. Coverage = 11/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Decision 1: "Component order within an instalment \| Fees, then penalties, then interest, then principal" | Spec states the exact sequence fees → penalties → interest → principal, matching the reference (fees deliberately before penalties). |
| 2 | yes | **yes** | Decision 2: "Clear the oldest outstanding instalment in full across all four components before any money touches the next" | Matches the reference's oldest-in-full-across-all-buckets-before-next strategy exactly. |
| 3 | yes | **yes** | Decision 5: "becomes an unallocated credit balance on the loan. Never auto-refunded"; Related behaviour: "applied automatically when the next instalment falls due" | All three reference elements present: unallocated credit balance, auto-applied at next instalment, never auto-refunded. |
| 4 | yes | **yes** | Decision 7: "BHD, three decimal places (fils)"; "Amounts are held in fils, the minor unit of the Bahraini dinar (BHD)" | Spec explicitly sets BHD with 3 decimal places (fils), matching the reference precision. |
| 5 | yes | **yes** | Decision 8: "Round half up to three decimal places" | Round half-up to the minor unit (3 dp) matches the reference rounding method exactly. |
| 6 | yes | **yes** | Decision 8: "Rounding residuals are absorbed into the interest component, never principal" | Residual destination (interest, not principal) matches the reference exactly. |
| 7 | no | no | absent (effective_date only governs instalment eligibility; "how instalments, interest, fees and penalties are originally calculated" is out of scope) | The spec uses effective_date solely to select which instalments are due; it never states that a payment with an earlier value date triggers recomputation/re-accrual of interest to that date, so the bespoke back-valuing rule is not addressed. |
| 8 | yes | **yes** | Decision 6: "Direct payment of future instalments \| Not permitted. Only due or overdue instalments are eligible"; Related behaviour: "Applying credit early does not change future interest" | Early payment settles only due instalments, surplus banked as credit (per #3/#5), and future interest is explicitly unchanged, matching the reference. |
| 9 | yes | **yes** | Decision 4: "Allocate down the waterfall in strict component order as far as the payment reaches. No proportional splits" | Strict in-order fill with no proportional split matches the reference; example A confirms mid-waterfall stop. |
| 10 | yes | **yes** | Decision 9: "left owing 0.005 BHD (5 fils) or less, the residual is written off, the instalment is marked fully paid, and the written-off amount is reported" | Tolerance threshold (≤0.005 BHD), write-off and fully-paid marking match the reference exactly. |
| 11 | yes | **yes** | Decision 10: "Zero payment \| Treated as a no-op. A zero-value allocation is still recorded"; Decision 11: "Negative payment \| Rejected: the function raises an error" | Negative rejected with error; zero is a no-op that still records a zero-value allocation transaction, both matching the reference. |
| 12 | no | no | absent ("how instalments, interest, fees and penalties are originally calculated" is out of scope; #12 is used for a different decision, "Nothing outstanding") | The spec never states that penalties accrue up to and including the value date before allocation runs on post-accrual balances; penalty accrual timing is out of scope, so this reference decision is unaddressed. |
| 13 | no | no | absent (scope: "the behaviour of allocate_payment for one payment against one loan") | The spec covers a single payment and never specifies that multiple same-day payments are ordered FIFO by receipt timestamp and allocated independently in turn; the ordering policy is not stated. |
| 14 | yes | **yes** | Return value: "lines" (per component of per instalment, amount applied), "resulting_balances", "credit_balance_created", "tolerance_written_off" | All four required reference fields are present: per-bucket amounts per instalment, resulting outstanding balances, credit created, and tolerance written off (plus extra convenience fields). |
