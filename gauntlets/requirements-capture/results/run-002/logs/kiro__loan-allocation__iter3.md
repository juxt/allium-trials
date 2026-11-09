# kiro — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 10 · Captured: 9/14 · Bespoke captured: 3/8

## Conversation

### Round 1
_Step reasoning:_ The brief omits the allocation waterfall, cross-instalment ordering, over/underpayment handling and rounding, none of which can be reliably inferred, so I must ask before drafting.

Q: Across the components of a single instalment, in what order should a payment be applied: penalties, then fees, then interest, then principal, or some other priority?
A: Fees first, then penalties, then interest, then principal.

Q: When several instalments are outstanding, how should the payment be allocated across them, for example oldest instalment fully cleared first, or the same component paid across all instalments before moving to the next component?
A: Oldest instalment is cleared in full across all four buckets before any payment touches the next instalment.

Q: If the payment exceeds the total amount currently owed on the loan, what should happen to the excess: refund it, hold it as an unapplied credit, apply it to future instalments, or reduce outstanding principal?
A: The surplus is held as an unallocated credit balance and auto-applied to the next instalment when it falls due; it is never auto-refunded.

Q: If the payment is less than what is owed, should it be applied partially following the same priority order, or rejected unless it meets a minimum (such as a full instalment)?
A: Applied partially following the same priority order — strict sequential fill per bucket; a partial payment is not rejected.

Q: What rounding rule and currency precision should allocation use, and how should any rounding remainder be assigned?
A: The loan is denominated in BHD; all amounts use 3 decimal places (fils). Rounding is half-up to 3 dp. Any rounding residual is absorbed into the interest component.

### Round 2
_Step reasoning:_ Core allocation policies are settled, but the overpayment answer introduced a stateful credit balance whose re-entry rules, input validation, and interest-bucket composition remain genuinely un-inferable and material.

Q: When a new payment arrives and the loan already holds an unallocated credit balance from a previous overpayment, should that existing credit be combined with the incoming payment and allocated together, applied first before the new payment, or left untouched until the next instalment falls due?
A: Left untouched until the next instalment falls due. The incoming payment is allocated independently against current outstanding balances; the existing credit balance auto-applies separately when the next instalment becomes due.

Q: How should invalid payment inputs be handled, specifically a zero amount, a negative amount, or a payment against a loan with nothing outstanding (and no future instalments)?
A: Negative amounts are rejected with an error. A zero amount is a no-op but still records a zero-value allocation transaction. A payment against a loan with nothing outstanding and no future instalments: [default, not policy] reject with an error indicating no balance exists to receive the payment.

Q: Within the interest bucket of an instalment, is there a single interest amount to satisfy, or must allocation distinguish between already-accrued interest and scheduled-but-unaccrued interest?
A: A single interest figure representing accrued-to-date interest; allocation does not distinguish between already-accrued and scheduled-but-unaccrued interest within the bucket. [default, not policy]

### Round 3
_Step reasoning:_ Core allocation policy is settled, but two stated rules still have unspecified edges (residual when interest is zero, and the ordering/overflow behaviour of auto-applied credit) that are institution-specific and not safely inferable.

Q: You said any rounding residual is absorbed into the interest component. If a given instalment's interest bucket is zero or has already been fully satisfied when the residual arises, where should the residual then be assigned (for example principal, the next non-zero bucket in priority order, or carried as credit)?
A: The answer key does not cover this edge case. [default, not policy] If the interest bucket is zero or already fully satisfied, assign the residual to the principal component.

Q: When a held credit balance auto-applies to the next instalment as it falls due, should that application follow the same fees then penalties then interest then principal priority, and if the credit exceeds that instalment's total, should the remainder stay as credit or spill onto the following instalment?
A: The answer key does not specify these details. [default, not policy] The auto-application should follow the same fees-then-penalties-then-interest-then-principal priority. If the credit exceeds that instalment's total, the remainder stays as a credit balance and auto-applies to the following instalment when it falls due.

### Round 4 (process signalled done)
_Step reasoning:_ All material policy decisions (priority order, cross-instalment sequencing, overpayment credit, partial payment, rounding, credit interaction, invalid inputs, interest bucket) are now answered; the last two rounds returned only non-policy edge-case defaults, signalling diminishing returns, so requirements gathering is complete.

(no questions this round)

## Produced specification

# Requirements Document

## Introduction

This feature adds payment allocation to the loan servicing system. When a borrower makes a payment, the money must be applied across what they currently owe on the loan. The core deliverable is a function `allocate_payment(payment, loan)` that returns how the payment is applied and the loan's updated balances.

A loan may have several instalments outstanding at once. Each instalment is composed of four components (buckets): penalties, fees, interest and principal. Allocation must follow a fixed priority both within an instalment and across instalments, handle overpayment and underpayment, apply a defined rounding and currency rule, and reject invalid inputs.

The loan is denominated in Bahraini Dinar (BHD). All monetary amounts are expressed to 3 decimal places (fils).

The requirements below capture the institution's chosen policies. Where a detail was neither covered by the policy nor stated in the brief, a resolved default is recorded explicitly and marked as such so that behaviour is fully determined.

## Requirements

### Requirement 1: Component priority within a single instalment

**User Story:** As a loan servicing operator, I want a payment applied to an instalment's components in a fixed priority order, so that every allocation is deterministic and consistent with the institution's policy.

#### Acceptance Criteria

1. WHEN a payment is applied to a single instalment THEN the system SHALL fill that instalment's components in the order: fees first, then penalties, then interest, then principal.
2. WHEN a component (bucket) is filled THEN the system SHALL apply funds to it until it is fully satisfied before moving to the next component in priority order.
3. IF the available funds are insufficient to fully satisfy a component THEN the system SHALL apply all remaining funds to that component and SHALL NOT apply any funds to lower-priority components.
4. WHEN a payment is allocated THEN the system SHALL record, per instalment, the amount applied to each of the four components.

### Requirement 2: Allocation order across multiple outstanding instalments

**User Story:** As a loan servicing operator, I want payments applied to the oldest instalment first, so that older debt is cleared before newer debt.

#### Acceptance Criteria

1. WHEN more than one instalment is outstanding THEN the system SHALL allocate to the oldest outstanding instalment first.
2. WHEN allocating to the oldest instalment THEN the system SHALL clear that instalment in full across all four buckets (fees, penalties, interest, principal) before applying any funds to the next instalment.
3. WHEN the oldest instalment is fully cleared and funds remain THEN the system SHALL proceed to the next-oldest outstanding instalment and apply the same within-instalment priority order.
4. WHEN funds are exhausted before an instalment is fully cleared THEN the system SHALL stop allocation and leave all remaining instalments untouched.

### Requirement 3: Overpayment and surplus handling

**User Story:** As a borrower, I want any amount I pay above what I currently owe to be held to my benefit, so that my future instalment is covered rather than the money being returned or lost.

#### Acceptance Criteria

1. WHEN a payment exceeds the total amount currently outstanding on the loan THEN the system SHALL apply funds to all outstanding balances first and SHALL hold the remaining surplus as an unallocated credit balance on the loan.
2. WHEN a surplus is held as an unallocated credit balance THEN the system SHALL auto-apply that credit to the next instalment when it falls due.
3. The system SHALL NOT auto-refund a surplus.
4. WHEN a surplus is recorded THEN the system SHALL include the resulting unallocated credit balance in the loan's updated balances returned by the function.

### Requirement 4: Underpayment and partial payment

**User Story:** As a borrower, I want a payment smaller than what I owe to still be accepted and applied, so that I can pay down debt incrementally.

#### Acceptance Criteria

1. WHEN a payment is less than the total amount currently owed THEN the system SHALL apply the payment partially following the same priority order (within-instalment: fees, penalties, interest, principal; across instalments: oldest first).
2. WHEN applying a partial payment THEN the system SHALL perform a strict sequential fill per bucket, fully satisfying each higher-priority bucket before applying any funds to the next.
3. The system SHALL NOT reject a payment solely because it is less than a full instalment or less than the total owed.
4. WHEN a partial payment is applied THEN the system SHALL return the updated balances reflecting the reduced outstanding amounts per component and per instalment.

### Requirement 5: Rounding and currency precision

**User Story:** As a loan servicing operator, I want allocation to use the loan's currency precision with a defined rounding rule, so that applied amounts and balances are exact and reconcilable.

#### Acceptance Criteria

1. WHEN the system processes any monetary amount for allocation THEN the system SHALL treat the loan as denominated in BHD and SHALL use 3 decimal places (fils) for all amounts.
2. WHEN rounding is required THEN the system SHALL round half-up to 3 decimal places.
3. WHEN a rounding residual arises during allocation of an instalment THEN the system SHALL absorb the residual into that instalment's interest component.
4. IF the interest component of the instalment is zero or has already been fully satisfied when the residual arises THEN the system SHALL assign the residual to that instalment's principal component. [resolved default, not stated policy]

### Requirement 6: Interaction between an incoming payment and an existing credit balance

**User Story:** As a borrower, I want a new payment handled independently of any credit I already hold, so that my credit is preserved for its intended purpose and the new payment is applied to current balances.

#### Acceptance Criteria

1. IF the loan already holds an unallocated credit balance from a previous overpayment WHEN a new payment arrives THEN the system SHALL leave the existing credit balance untouched.
2. WHEN a new payment arrives THEN the system SHALL allocate it independently against the current outstanding balances only, without combining it with the existing credit.
3. WHEN the next instalment becomes due THEN the system SHALL auto-apply the existing credit balance separately, independent of the incoming payment's allocation.

### Requirement 7: Auto-application of a held credit balance to the next instalment

**User Story:** As a borrower, I want my held credit applied automatically and consistently when my next instalment falls due, so that it reduces that instalment the same way a normal payment would.

#### Acceptance Criteria

1. WHEN a held credit balance auto-applies to the next instalment as it falls due THEN the system SHALL follow the same priority order: fees first, then penalties, then interest, then principal. [resolved default, not stated policy]
2. IF the held credit exceeds that instalment's total THEN the system SHALL retain the remainder as a credit balance. [resolved default, not stated policy]
3. WHEN a remainder is retained as credit THEN the system SHALL auto-apply it to the following instalment when that instalment falls due. [resolved default, not stated policy]

### Requirement 8: Interest bucket semantics

**User Story:** As a loan servicing operator, I want the interest component treated as a single figure, so that allocation logic is unambiguous.

#### Acceptance Criteria

1. WHEN allocating to the interest component of an instalment THEN the system SHALL treat it as a single interest figure representing accrued-to-date interest. [resolved default, not stated policy]
2. The system SHALL NOT distinguish between already-accrued and scheduled-but-unaccrued interest within the interest bucket. [resolved default, not stated policy]

### Requirement 9: Invalid and edge-case payment inputs

**User Story:** As a loan servicing operator, I want invalid payments rejected and benign edge cases handled predictably, so that the system never produces an incorrect or undefined allocation.

#### Acceptance Criteria

1. IF the payment amount is negative THEN the system SHALL reject the payment with an error.
2. WHEN the payment amount is zero THEN the system SHALL treat it as a no-op and SHALL still record a zero-value allocation transaction.
3. IF a payment is made against a loan with nothing currently outstanding and no future instalments THEN the system SHALL reject the payment with an error indicating that no balance exists to receive the payment. [resolved default, not stated policy]

### Requirement 10: Function output

**User Story:** As a developer integrating with the servicing system, I want `allocate_payment(payment, loan)` to return both the allocation breakdown and the updated loan balances, so that I can record the transaction and present the new state.

#### Acceptance Criteria

1. WHEN `allocate_payment(payment, loan)` completes successfully THEN the system SHALL return how the payment was applied, broken down per instalment and per component.
2. WHEN `allocate_payment(payment, loan)` completes successfully THEN the system SHALL return the loan's updated balances, including any unallocated credit balance.
3. WHEN a payment is rejected per Requirement 9 THEN the system SHALL return an error and SHALL NOT alter the loan's balances.
4. WHEN the payment is a zero-amount no-op THEN the system SHALL return a zero-value allocation transaction and the loan's balances unchanged.

## Auditor verdict

_The spec nails the inferable decisions (1, 2, 9, 11) and the well-documented policy choices (3, 4, 5, 6, 8), scoring 9/14 correct. The misses cluster on the genuinely bespoke, value-date-linked and tolerance decisions the engineer never elicited: back-valued payment re-accrual (7), write-off tolerance (10), penalty accrual timing (12), and same-day FIFO (13) are entirely absent. Decision 14 is surfaced but incorrect because the returned shape omits tolerance_written_off (a consequence of missing #10). Coverage = 9/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Req 1 AC1: "fill that instalment's components in the order: fees first, then penalties, then interest, then principal." | Matches the reference order exactly, including the deliberate fees-before-penalties choice. |
| 2 | yes | **yes** | Req 2 AC1-2: "allocate to the oldest outstanding instalment first" and "clear that instalment in full across all four buckets ... before applying any funds to the next instalment." | Oldest-first, cleared fully across all buckets before touching the next — matches the reference strategy. |
| 3 | yes | **yes** | Req 3 AC1-3: hold surplus "as an unallocated credit balance," "auto-apply that credit to the next instalment when it falls due," and "SHALL NOT auto-refund a surplus." | Credit balance, auto-applied next instalment, never auto-refunded — all three elements match. |
| 4 | yes | **yes** | Intro and Req 5 AC1: "denominated in Bahraini Dinar (BHD) ... 3 decimal places (fils) for all amounts." | Correct currency and 3 dp precision. |
| 5 | yes | **yes** | Req 5 AC2: "round half-up to 3 decimal places." | Half-up to the minor unit matches the reference. |
| 6 | yes | **yes** | Req 5 AC3: "absorb the residual into that instalment's interest component." | Residual destination is the interest component, matching the reference. The zero-interest fallback (AC4) is an extra resolved default that does not conflict. |
| 7 | no | no | absent | No mention of value_date, back-valued payments, or recomputing/re-accruing interest to an earlier value date anywhere in the spec. |
| 8 | yes | **yes** | Req 3 AC1 (surplus becomes credit) and Req 6 AC2: "allocate it independently against the current outstanding balances only." | Surplus becomes a credit balance and is never applied to reduce future principal, so future interest is unchanged — consistent with the reference, which shares the credit-balance mechanism of #3. |
| 9 | yes | **yes** | Req 4 AC2: "strict sequential fill per bucket, fully satisfying each higher-priority bucket before applying any funds to the next"; Req 1 AC3. | Strict in-order fill with no proportional split, matching the reference. |
| 10 | no | no | absent | No write-off tolerance of any size is defined; nothing marks a near-complete instalment as fully paid or writes off a small residual. |
| 11 | yes | **yes** | Req 9 AC1-2: "IF the payment amount is negative THEN ... reject ... with an error"; "WHEN the payment amount is zero THEN ... no-op and SHALL still record a zero-value allocation transaction." | Negative rejected, zero a recording no-op — matches both halves of the reference. |
| 12 | no | no | absent | No mention of penalty accrual timing relative to the allocation/value date; the spec treats penalties only as a pre-existing bucket balance. |
| 13 | no | no | absent | Nothing addresses multiple payments on the same day or FIFO ordering by receipt timestamp; Req 6 concerns a new payment versus an existing credit balance, not multiple payments. |
| 14 | yes | no | Req 10 AC1-2: returns "how the payment was applied, broken down per instalment and per component" and "updated balances, including any unallocated credit balance." | Covers per-bucket/per-instalment applied amounts, outstanding balances, and credit_balance, but omits the tolerance_written_off element required by the reference shape (tolerance is not modelled), so the shape does not fully match. |
