# kiro — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 8 · Captured: 11/14 · Bespoke captured: 5/8

## Conversation

### Round 1
_Step reasoning:_ The brief omits every material allocation policy (component order, cross-instalment order, partial/overpayment handling, rounding, due-date scope, input validation, interest treatment); these must be confirmed with the stakeholder before drafting requirements.

Q: When a payment is applied to a single instalment, in what order should its four components be paid down — penalties, fees, interest, principal — or some other order?
A: Fees first, then penalties, then interest, then principal.

Q: When multiple instalments are outstanding, how should the payment be spread across them: oldest instalment fully before moving to the next, or by component priority across all instalments (e.g. all penalties first, then all fees) or something else?
A: Clear the oldest instalment in full across all four buckets before any money touches the next instalment.

Q: How should a partial payment that cannot cover a whole component be handled — apply it partially to that component, or hold it until the full component amount is available?
A: Apply strictly in bucket order, filling each bucket as far as the payment allows; no proportional split, no withholding until a full bucket can be covered.

Q: How should an overpayment (more than the total currently owed) be treated — applied to future/not-yet-due instalments, held as a credit balance, returned, or rejected?
A: Surplus is held as an unallocated credit balance and auto-applied to the next instalment when it falls due. It is never auto-refunded and does not prepay principal or affect future interest.

Q: What rounding rule and currency precision should allocation use (e.g. round to the cent, and which way), and how are any rounding remainders assigned?
A: The loan is denominated in BHD, so all amounts use 3 decimal places (fils). Round half-up to 3 dp. Any rounding residual is absorbed into the interest component.

Q: Should the allocation consider only instalments that are currently due/overdue, or may it also apply to instalments not yet due?
A: Allocation covers only instalments that are currently due or overdue. An overpayment surplus becomes a credit balance rather than being applied to future not-yet-due instalments.

Q: Are there any inputs that should be rejected outright (e.g. zero or negative payment, a fully settled loan), and what should the function return in those cases?
A: A negative payment amount is rejected outright with an error. A zero payment is a no-op but still records a zero-value allocation transaction. [A payment against a fully settled loan is a no-op or rejected — default, not policy.]

Q: Does interest accrue or recalculate at the moment of payment (e.g. per-diem interest to the payment date), or are the interest amounts on each instalment treated as fixed figures to be paid down?
A: Interest and penalties both accrue up to and including the payment value_date before allocation runs. If the value_date is earlier than today (back-valued), interest is recomputed to that date. Allocation then operates on the post-accrual balances.

### Round 2 (process signalled done)
_Step reasoning:_ The core allocation policies (component order, cross-instalment order, partial-fill behaviour, overpayment credit handling, BHD rounding, due/overdue scope, input rejection, and value-date accrual) are all now settled, so the Kiro process moves from elicitation to drafting the requirements.md and seeking 'spec-requirements-review' approval.

(no questions this round)

## Produced specification

# Requirements Document

## Introduction

This feature adds payment allocation to the loan servicing system. When a borrower makes a payment, the money must be applied across what they currently owe on the loan. The system exposes a function `allocate_payment(payment, loan)` that returns how the payment is applied and the loan's updated balances.

A loan may have several instalments outstanding. Each instalment carries four components ("buckets"): penalties, fees, interest and principal. Allocation follows a fixed within-instalment bucket priority and a fixed oldest-first ordering across instalments, operates on balances that have first been brought up to date by accruing interest and penalties to the payment's value date, and settles all amounts in Bahraini Dinar (BHD) at three decimal places (fils).

The requirements below capture the institution's chosen allocation policy. Where a behaviour was neither specified in the brief nor decided by the stakeholder, it is flagged explicitly as a default rather than a policy.

## Requirements

### Requirement 1: Within-instalment component (bucket) order

**User Story:** As a loan servicing operator, I want each instalment's payment applied to its four components in a fixed priority order, so that money reduces the right liabilities consistently across every payment.

#### Acceptance Criteria

1. WHEN allocating money to a single instalment THEN the system SHALL pay down its components in the order fees first, then penalties, then interest, then principal.
2. WHEN a component's outstanding balance reaches zero THEN the system SHALL move the remaining payment to the next component in the fees, penalties, interest, principal order.
3. IF a payment is insufficient to clear all four components of an instalment THEN the system SHALL leave the lower-priority components partially or wholly unpaid according to the order in criterion 1.

### Requirement 2: Oldest-instalment-first ordering across instalments

**User Story:** As a loan servicing operator, I want a payment to fully clear the oldest outstanding instalment before any money touches a newer one, so that the oldest debt is always retired first.

#### Acceptance Criteria

1. WHEN more than one instalment is outstanding THEN the system SHALL apply the payment to the oldest outstanding instalment first.
2. WHEN allocating to the oldest instalment THEN the system SHALL clear all four of its buckets (fees, penalties, interest, principal) in full before any money is applied to the next instalment.
3. WHEN the oldest instalment is fully cleared and payment remains THEN the system SHALL apply the remainder to the next oldest instalment, again clearing all four buckets before moving on.
4. IF the payment is exhausted before the oldest instalment is fully cleared THEN the system SHALL apply nothing to any newer instalment.

### Requirement 3: Partial payments and bucket filling

**User Story:** As a loan servicing operator, I want a partial payment applied strictly in bucket order and filling each bucket as far as it can, so that behaviour is deterministic and never proportional.

#### Acceptance Criteria

1. WHEN a payment cannot cover a whole component THEN the system SHALL apply the available amount partially to that component in bucket order.
2. WHEN filling components THEN the system SHALL fill each bucket as far as the remaining payment allows before moving to the next bucket.
3. The system SHALL NOT split a payment proportionally across components.
4. The system SHALL NOT withhold or hold back a payment until a full bucket amount can be covered; partial application within a bucket is always permitted.

### Requirement 4: Overpayment and credit balance

**User Story:** As a loan servicing operator, I want any surplus beyond the total currently owed held as a credit balance and auto-applied to the next instalment when it falls due, so that overpayments are retained for the borrower without distorting the loan.

#### Acceptance Criteria

1. WHEN a payment exceeds the total amount currently owed across all due and overdue instalments THEN the system SHALL hold the surplus as an unallocated credit balance on the loan.
2. WHEN the next instalment falls due THEN the system SHALL auto-apply the held credit balance to that instalment.
3. The system SHALL NOT auto-refund the credit balance.
4. The system SHALL NOT use the credit balance to prepay principal.
5. The credit balance SHALL NOT affect future interest calculations.

### Requirement 5: Allocation scope (due and overdue only)

**User Story:** As a loan servicing operator, I want allocation to touch only instalments that are currently due or overdue, so that payments never prepay instalments that are not yet due.

#### Acceptance Criteria

1. WHEN allocating a payment THEN the system SHALL consider only instalments that are currently due or overdue.
2. The system SHALL NOT apply any part of the payment to instalments that are not yet due.
3. WHEN a surplus remains after all due and overdue instalments are cleared THEN the system SHALL hold that surplus as a credit balance (per Requirement 4) rather than applying it to future not-yet-due instalments.

### Requirement 6: Rounding, currency precision and residual handling

**User Story:** As a finance controller, I want all amounts rounded consistently to three decimal places in BHD with any residual absorbed into interest, so that ledger totals reconcile exactly.

#### Acceptance Criteria

1. The system SHALL denominate and compute all amounts in BHD to 3 decimal places (fils).
2. WHEN rounding is required THEN the system SHALL round half-up to 3 decimal places.
3. WHEN a rounding residual arises during allocation THEN the system SHALL absorb the residual into the interest component.

### Requirement 7: Accrual to the payment value date before allocation

**User Story:** As a loan servicing operator, I want interest and penalties brought up to date to the payment's value date before allocation runs, so that the payment is applied against correct balances including back-valued payments.

#### Acceptance Criteria

1. WHEN a payment is processed THEN the system SHALL accrue interest and penalties up to and including the payment `value_date` before running allocation.
2. IF the `value_date` is earlier than today (a back-valued payment) THEN the system SHALL recompute interest to that earlier date.
3. WHEN accrual is complete THEN the system SHALL run allocation against the post-accrual balances.

### Requirement 8: Input validation and rejected or no-op payments

**User Story:** As a loan servicing operator, I want invalid or trivial payments handled predictably, so that bad input is rejected and zero payments still leave an audit trail.

#### Acceptance Criteria

1. IF the payment amount is negative THEN the system SHALL reject the payment outright and return an error.
2. WHEN the payment amount is zero THEN the system SHALL treat it as a no-op that changes no balances but still records a zero-value allocation transaction.
3. (Default, not stakeholder policy) WHEN a payment is made against a fully settled loan THEN the system SHALL treat it as a no-op or reject it; this behaviour is a default resolution and has not been fixed as policy by the stakeholder.

### Requirement 9: Function output

**User Story:** As a developer integrating the servicing system, I want `allocate_payment(payment, loan)` to return both how the payment was applied and the loan's updated balances, so that callers can post the transaction and reflect the new state.

#### Acceptance Criteria

1. WHEN `allocate_payment(payment, loan)` completes successfully THEN the system SHALL return how the payment was applied across each instalment and its four components.
2. WHEN allocation completes THEN the system SHALL return the loan's updated balances, including any per-instalment component balances and any held credit balance.
3. WHEN a payment is rejected (per Requirement 8) THEN the system SHALL return an error rather than updated balances.


## Auditor verdict

_The spec covers 12 of 14 decisions correctly, including the genuinely bespoke ones (bucket order, credit balance, BHD 3-dp, residual-to-interest, back-valued accrual, early-payment surplus). It misses the write-off tolerance (#10) entirely and says nothing about same-day FIFO ordering (#13). The returned result shape (#14) is surfaced but incomplete because it omits tolerance_written_off, a consequence of the missing tolerance policy. Coverage = 12/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Req 1, criterion 1: "pay down its components in the order fees first, then penalties, then interest, then principal." | Spec states the exact fees→penalties→interest→principal order, matching the reference's deliberately-non-default sequence. |
| 2 | yes | **yes** | Req 2, criterion 2: "clear all four of its buckets ... in full before any money is applied to the next instalment." | Spec requires the oldest instalment fully cleared across all four buckets before touching the next, matching the reference exactly. |
| 3 | yes | **yes** | Req 4: "hold the surplus as an unallocated credit balance ... auto-apply the held credit balance ... SHALL NOT auto-refund." | Spec holds surplus as unallocated credit balance, auto-applies to next instalment when due, and never auto-refunds; matches all three elements of the reference. |
| 4 | yes | **yes** | Req 6, criterion 1: "denominate and compute all amounts in BHD to 3 decimal places (fils)." | Spec sets BHD 3 dp precisely as the reference specifies. |
| 5 | yes | **yes** | Req 6, criterion 2: "round half-up to 3 decimal places." | Spec picks half-up to the 3-dp minor unit, matching the reference rounding method. |
| 6 | yes | **yes** | Req 6, criterion 3: "absorb the residual into the interest component." | Spec routes the rounding residual to interest, matching the reference destination. |
| 7 | yes | **yes** | Req 7, criterion 2: "IF the value_date is earlier than today (a back-valued payment) THEN the system SHALL recompute interest to that earlier date." | Spec recomputes interest to an earlier value date before allocation, matching the back-valued reference behaviour. |
| 8 | yes | **yes** | Req 4, criteria 4-5: "SHALL NOT use the credit balance to prepay principal" and "SHALL NOT affect future interest calculations." | Spec settles the current instalment, holds any surplus as credit, explicitly bars prepaying principal, and keeps future interest unchanged; matches the reference on early-payment surplus. |
| 9 | yes | **yes** | Req 3: "applied strictly in bucket order ... SHALL NOT split a payment proportionally across components." | Spec fills buckets in strict order with no proportional split, matching the reference (an inferable decision but still correctly stated). |
| 10 | no | no | absent | The spec never mentions any write-off tolerance or the 0.005 BHD threshold; near-complete payments are not addressed, so the bespoke forgiveness policy is missing entirely. |
| 11 | yes | **yes** | Req 8, criteria 1-2: negative "SHALL reject ... and return an error"; zero "no-op that changes no balances but still records a zero-value allocation transaction." | Spec rejects negatives with an error and treats zero as a no-op that records a zero-value transaction, matching the reference precisely. |
| 12 | yes | **yes** | Req 7, criterion 1: "accrue interest and penalties up to and including the payment value_date before running allocation." | Spec accrues penalties up to and including the value date and then allocates on post-accrual balances, matching the reference accrue-then-allocate ordering. |
| 13 | no | no | absent | The spec is silent on multiple same-day payments and any FIFO-by-timestamp handling, so the reference's ordering policy is not addressed. |
| 14 | yes | no | Req 9, criteria 1-2: returns application "across each instalment and its four components" and "updated balances, including any per-instalment component balances and any held credit balance." | Spec returns per-bucket application, outstanding balances, and credit_balance, but omits the tolerance_written_off element required by the reference shape; being strict and literal, the returned shape is incomplete. |
