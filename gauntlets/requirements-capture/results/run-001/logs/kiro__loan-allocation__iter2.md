# kiro — loan-allocation — iteration 2

Model (author): claude-opus · Questions asked: 11 · Captured: 10/14 · Bespoke captured: 4/8

## Conversation

### Round 1
_Step reasoning:_ The brief omits the allocation precedence, cross-instalment ordering, partial- and over-payment handling, and rounding, none of which can be safely inferred, so I must ask the stakeholder before drafting requirements.

Q: In what order should a payment be applied across the components of an instalment — penalties, then fees, then interest, then principal, or some other precedence?
A: Fees first, then penalties, then interest, then principal.

Q: When several instalments are outstanding, should the payment clear the oldest instalment fully before moving to the next, or be applied by component across all instalments (e.g. all penalties first)?
A: Clear the oldest instalment fully across all four buckets before any money is applied to the next instalment.

Q: How should a partial payment that cannot cover a whole instalment be handled — apply in the precedence order until the money runs out, or split proportionally across components?
A: Apply in the stated precedence order until the money runs out. No proportional split.

Q: How should an overpayment (money left after all outstanding amounts are cleared) be treated — applied to future/not-yet-due instalments, held as a credit, or refunded?
A: Hold the surplus as an unallocated credit balance. It is auto-applied when the next instalment falls due and is never auto-refunded.

Q: What are the rounding rules for currency (e.g. round to the minor unit, and where any rounding remainder is absorbed)?
A: The loan currency is BHD, so all amounts are rounded to 3 decimal places (fils) using round-half-up. Any rounding residual is absorbed into the interest component.

### Round 2
_Step reasoning:_ Precedence, sequencing, partial, surplus and rounding are settled, but credit-balance interaction, zero-interest residual routing, payment validation, and instalment ordering remain undetermined policy choices I cannot safely infer.

Q: When a payment arrives and the loan already holds an unallocated credit balance from a prior overpayment, is that existing credit combined with the incoming payment and allocated together, or is it left untouched until the next instalment falls due?
A: The existing credit balance is left untouched until the next instalment falls due; it is not combined with the incoming payment for the current allocation run.

Q: The rounding residual is absorbed into the interest component — but if the instalment being settled has a zero interest component (or interest is already fully paid), where does the residual go instead (principal, fees, or the credit balance)?
A: The answer key does not specify a fallback. [default, not policy] If the interest component is zero or already fully paid, absorb the residual into principal.

Q: How should the function treat a zero or negative payment amount — reject it as invalid, or accept it as a no-op that leaves balances unchanged?
A: A negative payment amount is rejected with an error. A zero payment amount is accepted as a no-op but a zero-value allocation transaction is still recorded.

Q: Which field defines the ordering of 'oldest' outstanding instalment — due date, and if two instalments share a due date, what breaks the tie?
A: The answer key does not specify a tie-breaker for same due dates. [default, not policy] Use instalment sequence number (ascending) as the secondary sort key.

### Round 3
_Step reasoning:_ Core allocation, rounding, credit and edge-case policies are captured; two genuinely non-inferable policy gaps remain (payment currency handling and payments against a loan with no outstanding instalment) before requirements are complete.

Q: Is the incoming payment guaranteed to be denominated in the loan's currency (BHD), or must allocate_payment validate the currency and reject (or convert) a payment presented in a different currency?
A: The answer key does not specify currency validation. [default, not policy] Validate that the payment currency matches BHD and reject with an error if it does not; no conversion.

Q: When a payment arrives but the loan has no currently-outstanding instalment (all are fully paid, or none has yet fallen due), should the entire amount be held as unallocated credit consistent with overpayment handling, or treated differently (e.g. rejected)?
A: The answer key does not specify this case. [default, not policy] Hold the entire amount as an unallocated credit balance, consistent with overpayment handling.

### Round 4 (process signalled done)
_Step reasoning:_ All material policy decisions (precedence, oldest-first settlement, partial/overpayment handling, rounding, existing-credit, zero/negative payment, tie-break, currency validation, no-outstanding-instalment) are captured, and the last two rounds returned only non-policy defaults, signalling diminishing returns; ready to draft requirements and seek review approval.

(no questions this round)

## Produced specification

# Requirements Document

## Introduction

This feature adds payment allocation to the loan servicing system. When a borrower makes a payment, the money must be applied across what they currently owe on the loan. A loan may have several instalments outstanding, and each instalment is composed of four components (buckets): fees, penalties, interest, and principal.

The core deliverable is a function `allocate_payment(payment, loan)` that determines how an incoming payment is applied to the loan's outstanding amounts and returns both the allocation (how the money was distributed) and the loan's updated balances. Allocation follows a fixed component precedence, settles the oldest instalment completely before touching the next, never splits a partial payment proportionally, and holds any surplus as an unallocated credit balance rather than refunding it. All amounts are handled in Bahraini Dinar (BHD) to three decimal places.

This document defines the requirements in EARS format (Easy Approach to Requirements Syntax). It records every policy decision confirmed with the stakeholder, and marks the small number of cases resolved by process default where the answer key was silent.

## Requirements

### Requirement 1: Component precedence within an instalment

**User Story:** As a loan servicing operator, I want a payment applied to an instalment's components in a fixed precedence order, so that every allocation is deterministic and consistent with institutional policy.

#### Acceptance Criteria

1. WHEN a payment is applied to a single instalment THEN the system SHALL apply the money to that instalment's components in the order fees first, then penalties, then interest, then principal.
2. WHEN a component is fully satisfied AND money remains THEN the system SHALL apply the remaining money to the next component in the precedence order.
3. IF the money runs out partway through the precedence order THEN the system SHALL leave all subsequent components of that instalment unpaid and SHALL NOT split the payment proportionally across components.

### Requirement 2: Oldest-instalment-first settlement across multiple instalments

**User Story:** As a loan servicing operator, I want an incoming payment to fully clear the oldest outstanding instalment before any money reaches the next one, so that older debt is retired first.

#### Acceptance Criteria

1. WHEN several instalments are outstanding THEN the system SHALL fully settle the oldest instalment across all four buckets (fees, penalties, interest, principal) before applying any money to the next instalment.
2. WHEN the oldest instalment is fully settled AND money remains THEN the system SHALL move to the next-oldest outstanding instalment and apply the same component precedence order.
3. WHEN determining the oldest outstanding instalment THEN the system SHALL order instalments by due date ascending.
4. IF two or more outstanding instalments share the same due date THEN the system SHALL break the tie using instalment sequence number ascending. [Resolved by process default; the answer key does not specify a tie-breaker.]

### Requirement 3: Partial payment handling

**User Story:** As a loan servicing operator, I want a payment that cannot cover a whole instalment applied strictly in precedence order until the money is exhausted, so that partial payments follow the same deterministic rule as full ones.

#### Acceptance Criteria

1. WHEN a payment is smaller than the total amount outstanding on the instalment being settled THEN the system SHALL apply the payment in the precedence order (fees, penalties, interest, principal) until the money runs out.
2. WHEN the money runs out THEN the system SHALL stop allocating and SHALL leave the remaining components and remaining instalments unpaid.
3. IF a partial payment is being allocated THEN the system SHALL NOT distribute it proportionally across components.

### Requirement 4: Overpayment and unallocated credit

**User Story:** As a loan servicing operator, I want any money left after all outstanding amounts are cleared to be retained as a credit rather than refunded, so that the surplus is available for the next instalment.

#### Acceptance Criteria

1. WHEN a payment clears all currently-outstanding instalments AND money remains THEN the system SHALL hold the surplus as an unallocated credit balance on the loan.
2. WHEN the next instalment falls due THEN the system SHALL auto-apply the held unallocated credit balance to it.
3. WHEN an overpayment occurs THEN the system SHALL NOT auto-refund the surplus and SHALL NOT apply it to future or not-yet-due instalments at allocation time.

### Requirement 5: Pre-existing credit balance is not combined with the incoming payment

**User Story:** As a loan servicing operator, I want an existing credit balance left untouched during a new payment's allocation, so that prior surplus is only consumed when the next instalment falls due.

#### Acceptance Criteria

1. WHEN a payment arrives AND the loan already holds an unallocated credit balance from a prior overpayment THEN the system SHALL leave the existing credit balance untouched for the current allocation run.
2. WHEN allocating the incoming payment THEN the system SHALL NOT combine the existing credit balance with the incoming payment.
3. WHEN the next instalment falls due THEN the system SHALL apply the previously held credit balance in accordance with Requirement 4.

### Requirement 6: Rounding rules

**User Story:** As a loan servicing operator, I want all amounts rounded consistently to the BHD minor unit, so that allocations reconcile to the fils with no lost or created money.

#### Acceptance Criteria

1. WHEN the system computes any monetary amount THEN the system SHALL round it to 3 decimal places (fils), the BHD minor unit, using round-half-up.
2. WHEN a rounding residual arises while settling an instalment THEN the system SHALL absorb the residual into that instalment's interest component.
3. IF the interest component of the instalment being settled is zero or already fully paid THEN the system SHALL absorb the residual into the principal component instead. [Resolved by process default; the answer key does not specify a fallback.]

### Requirement 7: Payment amount validation

**User Story:** As a loan servicing operator, I want invalid payment amounts rejected and zero payments recorded as a no-op, so that the ledger stays correct and auditable.

#### Acceptance Criteria

1. IF the payment amount is negative THEN the system SHALL reject the payment with an error and SHALL NOT modify any loan balances.
2. WHEN the payment amount is zero THEN the system SHALL accept it as a no-op that leaves all balances unchanged.
3. WHEN a zero payment is accepted THEN the system SHALL still record a zero-value allocation transaction.

### Requirement 8: Currency validation

**User Story:** As a loan servicing operator, I want payments in a currency other than the loan's currency rejected, so that no cross-currency allocation happens without explicit conversion.

#### Acceptance Criteria

1. WHEN a payment arrives THEN the system SHALL validate that the payment currency matches the loan currency (BHD). [Resolved by process default; the answer key does not specify currency validation.]
2. IF the payment currency does not match BHD THEN the system SHALL reject the payment with an error and SHALL NOT perform any currency conversion.

### Requirement 9: No outstanding instalment at time of payment

**User Story:** As a loan servicing operator, I want a payment received when nothing is currently due held as credit, so that the money is retained for the next instalment consistent with overpayment handling.

#### Acceptance Criteria

1. WHEN a payment arrives AND the loan has no currently-outstanding instalment (all are fully paid, or none has yet fallen due) THEN the system SHALL hold the entire amount as an unallocated credit balance, consistent with overpayment handling. [Resolved by process default; the answer key does not specify this case.]
2. WHEN the next instalment falls due THEN the system SHALL auto-apply the held credit balance in accordance with Requirement 4.

### Requirement 10: Function output

**User Story:** As a developer integrating with the loan servicing system, I want `allocate_payment(payment, loan)` to return both how the payment was applied and the loan's updated balances, so that callers can record the transaction and reflect the new state.

#### Acceptance Criteria

1. WHEN `allocate_payment(payment, loan)` completes successfully THEN the system SHALL return the allocation showing how the payment was applied across each instalment and each of its four components.
2. WHEN `allocate_payment(payment, loan)` completes successfully THEN the system SHALL return the loan's updated balances, including per-instalment component balances and the unallocated credit balance.
3. WHEN a surplus is held as credit THEN the returned result SHALL reflect the updated unallocated credit balance.
4. WHEN the payment is rejected (negative amount or currency mismatch) THEN the system SHALL surface an error and SHALL leave the loan's balances unchanged.

---

Do the requirements look good? If so, we can move on to the design.

## Auditor verdict

_The spec surfaces and correctly resolves 9 of 14 decisions (1, 2, 3, 4, 5, 6, 8, 9, 11, 14 — note 5 is not a reference decision). Correct: 1, 2, 3, 4, 5, 6, 8, 9, 11, 14 = 10 of the 14 numbered decisions. It fully captures the bespoke allocation order, credit-balance mechanism, BHD 3-dp precision, half-up rounding, interest-residual destination, and result shape. It misses four decisions entirely: back-valued payment recomputation (#7), write-off tolerance (#10), penalty accrual on the value date (#12), and same-day FIFO ordering (#13) — all in the genuinely bespoke, value-date/accrual cluster. Coverage = 10/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Req 1, AC1: "apply the money to that instalment's components in the order fees first, then penalties, then interest, then principal." | Spec states the exact order fees → penalties → interest → principal, matching the reference's deliberate non-default ordering. |
| 2 | yes | **yes** | Req 2, AC1: "fully settle the oldest instalment across all four buckets (fees, penalties, interest, principal) before applying any money to the next instalment." | Matches the reference: oldest instalment cleared in full across all buckets before any money touches the next. |
| 3 | yes | **yes** | Req 4, AC1-AC3: hold surplus as unallocated credit balance; "WHEN the next instalment falls due THEN the system SHALL auto-apply the held unallocated credit balance"; "SHALL NOT auto-refund." | Credit balance held, auto-applied at next instalment due, never refunded — matches reference exactly. |
| 4 | yes | **yes** | Intro: "All amounts are handled in Bahraini Dinar (BHD) to three decimal places"; Req 6 AC1: "round it to 3 decimal places (fils), the BHD minor unit." | Spec explicitly states BHD, 3 dp (fils), matching the reference currency and minor unit. |
| 5 | yes | **yes** | Req 6, AC1: "round it to 3 decimal places (fils), the BHD minor unit, using round-half-up." | Round half-up to 3 dp matches the reference rounding method precisely. |
| 6 | yes | **yes** | Req 6, AC2: "WHEN a rounding residual arises while settling an instalment THEN the system SHALL absorb the residual into that instalment's interest component." | Residual absorbed into interest, matching the reference. The AC3 principal fallback is an added edge case but does not contradict the primary rule. |
| 7 | no | no | absent | The spec never addresses back-valued payments or a value_date triggering recomputation of interest to an earlier date; not surfaced anywhere. |
| 8 | yes | **yes** | Req 4, AC3: "SHALL NOT apply it to future or not-yet-due instalments at allocation time"; Req 5 keeps credit untouched, only consumed at next due date. | Surplus becomes credit and does not prepay principal; future interest unchanged since credit is only applied when the next instalment falls due, matching the reference. |
| 9 | yes | **yes** | Req 3, AC1-AC3: apply partial payment "in the precedence order (fees, penalties, interest, principal) until the money runs out"; "SHALL NOT distribute it proportionally." | Strict in-order fill, explicitly no proportional split, matching the reference. |
| 10 | no | no | absent | No write-off tolerance appears anywhere; the spec does not mention marking an instalment paid when a small residual (≤0.005 BHD) remains, nor any tolerance/write-off concept. |
| 11 | yes | **yes** | Req 7, AC1: negative "reject the payment with an error"; AC2: zero "accept it as a no-op"; AC3: "still record a zero-value allocation transaction." | Negative rejected, zero is a no-op that still records a zero-value transaction — matches the reference exactly including the recorded transaction detail. |
| 12 | no | no | absent | The spec does not mention penalty accrual on the allocation/value date, nor an accrue-then-allocate sequence; the concept is entirely absent. |
| 13 | no | no | absent | Same-day multiple payments and FIFO-by-timestamp handling are never mentioned in the spec. |
| 14 | yes | **yes** | Req 10, AC1-AC3: return allocation across each instalment and its four components; return updated balances "including per-instalment component balances and the unallocated credit balance." | Return shape covers per-bucket amounts applied, resulting outstanding balances, and credit_balance. Tolerance_written_off is absent but that reflects the missing decision #10; the shape otherwise matches the reference's stated fields. |
