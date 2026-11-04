# tessl — loan-allocation — iteration 2

Model (author): claude-opus · Questions asked: 3 · Captured: 8/14 · Bespoke captured: 3/8

## Conversation

### Round 1
_Step reasoning:_ Highest-impact ambiguity is the allocation waterfall order across components and instalments; ask that first per one-question-at-a-time.

Q: When a payment is applied to the loan, in what order should it consume the outstanding components — for example penalties, then fees, then interest, then principal — and how should this interact with multiple outstanding instalments (oldest instalment fully cleared before moving to the next, or the same component paid across all instalments first)?
A: Within a single instalment, the order is: fees, then penalties, then interest, then principal. Across multiple overdue instalments, clear the oldest instalment in full across all four buckets before any payment touches the next instalment.

### Round 2
_Step reasoning:_ Allocation order is settled; overpayment handling is the next highest-impact policy gap the model cannot reliably infer.

Q: When the payment exceeds the total currently owed across all outstanding instalments, how should the surplus be handled — returned/reported as an unapplied remainder, held as a credit on the loan, or applied forward to reduce future (not-yet-due) principal?
A: The surplus is held as an unallocated credit balance on the loan and will be automatically applied to the next instalment when it falls due. It is never auto-refunded, and it does not prepay future principal.

### Round 3
_Step reasoning:_ Ordering, instalment sequencing and surplus are settled; the next unresolved material policy is the money model — minimum allocatable unit and rounding — which cannot be safely inferred.

Q: When a payment does not fully cover a component bucket, or when splitting produces fractional currency units, what is the minimum allocatable unit and how should rounding be handled — is money tracked to the whole minor unit (e.g. penny) with no sub-unit allocation, and does a partial payment simply reduce the current bucket by the exact amount paid?
A: The loan is denominated in BHD, whose minor unit is the fils — three decimal places. All amounts are tracked and rounded to three decimal places using round-half-up. A partial payment that does not fully cover a bucket simply reduces that bucket by the exact amount paid (no sub-unit allocation issue there). Where arithmetic splitting produces a rounding residual, it is absorbed into the interest component, not principal.

### Round 4 (process signalled done)
_Step reasoning:_ Scope, allocation order across buckets and instalments, surplus handling, currency precision, rounding and residual placement are now all pinned down; no material ambiguities remain, so requirement gathering is complete.

(no questions this round)

## Produced specification

# Requirements specification: payment allocation

## Overview

Add payment allocation to the loan servicing system. Implement `allocate_payment(payment, loan)`, which applies a borrower's payment across what they currently owe and returns both how the payment was applied and the loan's updated balances.

A loan may have several outstanding instalments. Each instalment carries four component buckets: fees, penalties, interest and principal.

This specification records only the decisions confirmed with the stakeholder. Items neither in the brief nor settled in the interview are listed as open questions rather than assumed; per the requirement-gathering process they must be clarified before implementation and spec authoring proceed.

## Scope

### In scope

- Allocating a single payment across outstanding instalments and their component buckets.
- Reporting the per-bucket, per-instalment application of the payment.
- Reporting the loan's updated balances after allocation.
- Handling a surplus when the payment exceeds the total currently owed.
- Rounding and minor-unit handling for BHD.

### Out of scope (not raised in the brief or interview)

- How instalments become due, or the schedule that produces them.
- Refund mechanics (the credit is never auto-refunded; any manual refund path is not specified here).
- Reversal or unwinding of a previously applied payment.

## Core behaviour (happy path)

Given a payment and a loan with one or more outstanding instalments, the payment is consumed as follows.

**Across instalments.** Instalments are cleared oldest first. The oldest outstanding instalment is fully cleared across all four of its buckets before any of the payment touches the next instalment. Only once an instalment's fees, penalties, interest and principal are all zero does allocation move to the next-oldest instalment.

**Within an instalment.** The four buckets are consumed in this fixed order:

1. Fees
2. Penalties
3. Interest
4. Principal

Each bucket is reduced by the amount applied to it before the next bucket in the order receives anything.

The result reports the amount applied to each bucket of each instalment and the loan's resulting balances.

## Edge cases and boundary conditions

### Partial coverage of a bucket

When the remaining payment does not fully cover the current bucket, that bucket is reduced by exactly the amount paid. Allocation then stops (the payment is exhausted); no sub-unit allocation problem arises because the reduction equals the amount paid.

### Surplus (payment exceeds total owed)

When the payment exceeds the total currently owed across all outstanding instalments, the surplus is held as an unallocated credit balance on the loan. Rules for the credit:

- It is automatically applied to the next instalment when that instalment falls due.
- It is never auto-refunded.
- It does not prepay future (not-yet-due) principal.

The result reports the surplus as credit added to the loan's unallocated credit balance.

### Rounding residual from arithmetic splitting

Where an arithmetic split produces a rounding residual, the residual is absorbed into the interest component. It is never absorbed into principal.

## Constraints

### Currency, minor unit and rounding

- The loan is denominated in BHD.
- The minor unit is the fils: three decimal places.
- All amounts are tracked and rounded to three decimal places.
- Rounding uses round-half-up.

## Open questions (unresolved after interview)

The following were neither given in the brief nor settled in the stakeholder conversation. They must be clarified before implementation; they have not been assumed here.

- The exact shape of the `loan` input and the `allocate_payment` return value (field names, structure, whether the loan is mutated or a new state is returned).
- Behaviour for a zero or negative payment amount.
- Behaviour when the loan has no outstanding instalments and no future instalment exists to hold credit against.
- Whether the reported result distinguishes the pre- and post-allocation balances, and in what units the surplus credit is expressed.
- Validation and error handling for malformed input (e.g. an instalment with negative bucket balances, or a payment not expressible in whole fils).

## Success criteria

- A payment is consumed oldest-instalment-first, and within each instalment in the order fees, penalties, interest, principal.
- An instalment is fully cleared across all four buckets before the next instalment receives any allocation.
- Surplus is recorded as an unallocated credit balance, applied to the next instalment on due date, never auto-refunded, and never used to prepay future principal.
- All amounts are in BHD to three decimal places, rounded half-up, with any split residual absorbed into interest and never into principal.
- The open questions above are resolved and confirmed before spec authoring and implementation begin.

## Auditor verdict

_The spec correctly nails the bespoke allocation-mechanics decisions (1-6, 8, 9) with exact matches on bucket order, oldest-first clearing, credit-balance handling, BHD 3dp, half-up rounding, and residual-to-interest. It misses decisions 7 (back-valued payment), 10 (write-off tolerance), 12 (penalty accrual timing) and 13 (same-day FIFO) entirely. Decisions 11 (zero/negative) and 14 (result shape) are surfaced honestly as unresolved open questions rather than assumed, so they score as surfaced-but-not-correct. Coverage: 9/14 correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Within an instalment. The four buckets are consumed in this fixed order: 1. Fees 2. Penalties 3. Interest 4. Principal" | Spec states fees before penalties before interest before principal, matching the reference exactly. |
| 2 | yes | **yes** | "The oldest outstanding instalment is fully cleared across all four of its buckets before any of the payment touches the next instalment." | Matches oldest-instalment-cleared-in-full-before-next exactly. |
| 3 | yes | **yes** | "the surplus is held as an unallocated credit balance on the loan... It is automatically applied to the next instalment when that instalment falls due... It is never auto-refunded." | Credit balance, auto-applied on due date, never auto-refunded — all three elements match. |
| 4 | yes | **yes** | "The loan is denominated in BHD. The minor unit is the fils: three decimal places." | BHD, fils, 3 dp stated explicitly, matching reference. |
| 5 | yes | **yes** | "Rounding uses round-half-up." | Round half-up to the minor unit matches the reference. |
| 6 | yes | **yes** | "the residual is absorbed into the interest component. It is never absorbed into principal." | Residual to interest, never principal — matches exactly. |
| 7 | no | no | absent | The spec never mentions back-valued payments or value_date-based interest recomputation; no open question covers it either. |
| 8 | yes | **yes** | "It does not prepay future (not-yet-due) principal." and "Surplus is recorded as an unallocated credit balance... never used to prepay future principal." | Spec states surplus becomes credit and does not prepay future principal, matching #8 (future interest unchanged). |
| 9 | yes | **yes** | "When the remaining payment does not fully cover the current bucket, that bucket is reduced by exactly the amount paid. Allocation then stops... no sub-unit allocation problem arises" | Strict in-order fill with no proportional split, matching the reference. |
| 10 | no | no | absent | No write-off tolerance (≤0.005 BHD) is mentioned anywhere in the spec. |
| 11 | yes | no | Open questions: "Behaviour for a zero or negative payment amount." | Surfaced as an explicit open question but left unresolved; spec does not state reject-negative / zero-noop, so not correct. |
| 12 | no | no | absent | Spec does not address penalty accrual timing on the value/allocation date. |
| 13 | no | no | absent | Same-day multiple payments and FIFO-by-timestamp ordering are not mentioned; the spec scopes to a single payment. |
| 14 | yes | no | "The result reports the amount applied to each bucket of each instalment and the loan's resulting balances." but open question: "The exact shape of the... return value" | Partially describes the result (per-bucket amounts, balances, credit) but the shape is explicitly left as an open question and tolerance_written_off is not included, so it does not match the full reference shape. |
