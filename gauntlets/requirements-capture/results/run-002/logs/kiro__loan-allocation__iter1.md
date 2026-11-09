# kiro — loan-allocation — iteration 1

Model (author): claude-opus · Questions asked: 9 · Captured: 9/14 · Bespoke captured: 4/8

## Conversation

### Round 1
_Step reasoning:_ The brief omits the core allocation policies (component order, instalment order, partial/over/under-payment handling, rounding) that cannot be reliably inferred, so I must ask the stakeholder before drafting requirements.

Q: In what order should a payment be applied to the components of an outstanding instalment — e.g. penalties, then fees, then interest, then principal — or does your institution use a different priority?
A: fees, then penalties, then interest, then principal

Q: When multiple instalments are outstanding, should the payment satisfy the oldest instalment first before moving to the next, or be spread across instalments another way (e.g. pro-rata)?
A: oldest instalment must be cleared in full across all four buckets before any payment moves to the next

Q: Must each component (or each instalment) be fully satisfied before the payment moves to the next, or can a payment partially cover a component and leave a remainder owing?
A: yes — each bucket must be fully satisfied before the payment moves on; no proportional splitting

Q: If the payment exceeds everything currently owed on the loan, what happens to the surplus — refunded, held as an unallocated credit, or applied to reduce future/outstanding principal?
A: surplus is held as an unallocated credit balance and auto-applied when the next instalment falls due; it is never auto-refunded

Q: If the payment is less than the total owed, is a partial payment accepted and allocated as far as it reaches, or rejected/held until the full due amount is received?
A: accepted; allocated strictly in bucket order as far as the payment reaches

Q: How should fractional-currency amounts be handled — what rounding rule applies, and to which components, so allocations always reconcile to the payment total?
A: round half-up to 3 decimal places (the loan is denominated in BHD); any rounding residual is absorbed into the interest component so allocations reconcile to the payment total

### Round 2
_Step reasoning:_ Core allocation policy is settled, but two material, non-inferable decisions remain: whether pre-existing credit is combined with the new payment, and how invalid/zero/no-balance payments are handled.

Q: If the loan already carries an unallocated credit balance from a previous overpayment, should `allocate_payment` apply that existing credit together with the incoming payment (and if so, is the credit consumed before, after, or combined with the new payment), or does it only allocate the incoming payment and leave any prior credit untouched?
A: The existing credit balance is combined with the incoming payment amount and the combined total is allocated as a single pool, in the same bucket order across the same instalment priority. The credit is not held aside or applied in a separate pass; it is consumed as part of that combined allocation. [default, not policy: credit is treated as consumed before the new cash, i.e. credit first then incoming, though the net result is identical either way.]

Q: How should invalid or edge-case payment amounts be handled — specifically a zero payment, a negative payment, or a payment on a loan with nothing currently outstanding (should it be rejected, or accepted and held entirely as credit)?
A: A negative payment amount is rejected with an error. A zero payment is accepted as a no-op but a zero-value allocation transaction is still recorded. A payment on a loan with nothing outstanding (all instalments fully settled, no arrears) is accepted and the full amount is held as an unallocated credit balance per the overpayment rule, to be auto-applied when the next instalment falls due.

### Round 3
_Step reasoning:_ Every core policy is settled; the one remaining non-inferable gap is where the rounding residual lands when the target instalment has no interest component to absorb it.

Q: Your rounding rule absorbs any residual into the interest component — but what should happen to that residual when the instalment the payment reaches has no interest owing (interest already settled or zero for that instalment)? Does it fall to the next component in order (principal), to the next instalment's interest, or somewhere else?
A: The answer key specifies only that the residual is absorbed into interest, not principal; it does not address the zero-interest edge case. [default, not policy: if the interest bucket for that instalment is zero, the residual falls to the next component in bucket order — principal — so the allocation still reconciles to the payment total. It does not carry to a different instalment's interest bucket.]

### Round 4 (process signalled done)
_Step reasoning:_ All material, non-inferable policy decisions (bucket order, instalment priority, full-satisfaction rule, surplus/credit handling, partial payments, rounding, credit combination, invalid-amount handling, and the zero-interest residual edge) have been answered; remaining questions would only elicit defaults rather than institutional policy.

(no questions this round)

## Produced specification

# Requirements Document

## Introduction

This feature adds payment allocation to the loan servicing system. When a borrower makes a payment, the money must be applied across what they currently owe on a loan. The core of the feature is a function `allocate_payment(payment, loan)` that returns how the payment is applied and the loan's updated balances.

A loan may carry several outstanding instalments. Each instalment is made up of four components (buckets): fees, penalties, interest, and principal. A payment is applied deterministically: it works through instalments in age order and, within each instalment, through the four buckets in a fixed priority, fully satisfying each bucket before moving to the next. Partial payments are accepted and allocated as far as they reach. Any surplus beyond everything currently owed is retained as an unallocated credit balance on the loan rather than refunded.

The loan is denominated in Bahraini dinar (BHD), which uses three decimal places, so all monetary handling and rounding follow a three-decimal convention. The requirements below capture the institution's specific allocation policy, its ordering rules, its handling of overpayments, credit balances, and invalid inputs, and its rounding and reconciliation behaviour.

## Requirements

### Requirement 1 — Bucket priority within an instalment

**User Story:** As a loan servicing operator, I want each payment applied to an instalment's components in a fixed priority order, so that allocations are consistent and auditable across all loans.

#### Acceptance Criteria

1. WHEN a payment is applied to an outstanding instalment THEN the system SHALL apply the available amount to the instalment's buckets in the order fees, then penalties, then interest, then principal.
2. WHEN applying a payment within an instalment THEN the system SHALL fully satisfy each bucket before applying any amount to the next bucket in priority order.
3. The system SHALL NOT split a payment proportionally across buckets.
4. IF the available amount is insufficient to fully satisfy a bucket THEN the system SHALL apply the remaining available amount to that bucket, leave the remainder of that bucket owing, and apply nothing to lower-priority buckets.

### Requirement 2 — Instalment priority (oldest first)

**User Story:** As a loan servicing operator, I want payments to clear the oldest outstanding instalment in full before any money moves to a newer instalment, so that arrears are resolved in chronological order.

#### Acceptance Criteria

1. WHEN multiple instalments are outstanding THEN the system SHALL allocate to the oldest outstanding instalment first.
2. WHEN allocating to an instalment THEN the system SHALL clear all four buckets of that instalment in full before applying any amount to the next instalment.
3. The system SHALL NOT spread a payment across instalments pro-rata or in any order other than oldest-first.
4. WHEN the oldest outstanding instalment is fully cleared and funds remain THEN the system SHALL proceed to the next-oldest outstanding instalment and apply the same bucket-priority rules.

### Requirement 3 — Partial payments

**User Story:** As a borrower, I want a payment smaller than my total amount due to still be accepted and applied, so that I can pay down what I owe incrementally.

#### Acceptance Criteria

1. WHEN the payment is less than the total currently owed THEN the system SHALL accept the payment.
2. WHEN a partial payment is accepted THEN the system SHALL allocate it strictly in instalment-priority and bucket-priority order as far as the payment reaches.
3. WHEN a partial payment is exhausted mid-allocation THEN the system SHALL leave all remaining buckets and instalments with their outstanding balances unchanged.
4. The system SHALL NOT reject or hold a payment solely because it is less than the full due amount.

### Requirement 4 — Surplus and overpayment handling

**User Story:** As a loan servicing operator, I want any amount paid beyond everything currently owed to be retained as credit, so that it can be automatically applied to the next instalment rather than refunded ad hoc.

#### Acceptance Criteria

1. WHEN the payment (combined with any existing credit) exceeds everything currently owed on the loan THEN the system SHALL hold the surplus as an unallocated credit balance on the loan.
2. WHEN an unallocated credit balance exists and the next instalment falls due THEN the system SHALL auto-apply the credit balance to that instalment.
3. The system SHALL NOT auto-refund any surplus.
4. WHEN a payment is made on a loan with nothing currently outstanding (all instalments fully settled and no arrears) THEN the system SHALL accept the payment and hold the full amount as an unallocated credit balance per the overpayment rule.

### Requirement 5 — Existing credit balance

**User Story:** As a loan servicing operator, I want an existing credit balance to be combined with the incoming payment and allocated together, so that previously overpaid funds are put to use in the same allocation pass.

#### Acceptance Criteria

1. IF the loan already carries an unallocated credit balance THEN the system SHALL combine that credit balance with the incoming payment amount and allocate the combined total as a single pool.
2. WHEN allocating the combined pool THEN the system SHALL apply it in the same bucket order across the same instalment priority as any other allocation.
3. The system SHALL NOT hold the existing credit aside or allocate it in a separate pass from the incoming payment.
4. WHEN the combined pool is allocated THEN the system SHALL treat the existing credit as consumed before the incoming cash, noting the net allocation result is identical either way.

### Requirement 6 — Invalid and edge-case payment amounts

**User Story:** As a loan servicing operator, I want invalid payment amounts rejected and benign edge cases handled predictably, so that the ledger stays correct and every event is recorded.

#### Acceptance Criteria

1. IF the payment amount is negative THEN the system SHALL reject the payment with an error and SHALL NOT alter any loan balance.
2. WHEN the payment amount is zero THEN the system SHALL accept the payment as a no-op and SHALL still record a zero-value allocation transaction.
3. WHEN a payment is made on a loan with nothing outstanding THEN the system SHALL accept it and hold the full amount as an unallocated credit balance (see Requirement 4, criterion 4).

### Requirement 7 — Rounding and reconciliation

**User Story:** As a loan servicing operator, I want allocations rounded consistently and always reconciled to the payment total, so that no fractional currency is lost or created.

#### Acceptance Criteria

1. WHEN monetary amounts are computed THEN the system SHALL round half-up to three decimal places, consistent with the loan's BHD denomination.
2. WHEN rounding produces a residual THEN the system SHALL absorb that residual into the interest component so that the sum of all allocations reconciles exactly to the payment total.
3. WHEN the total of all allocated amounts is compared to the payment total THEN the system SHALL ensure they are equal after the residual is absorbed.
4. IF the interest bucket of the instalment the residual reaches is zero (interest already settled or zero for that instalment) THEN the system SHALL absorb the residual into the next component in bucket order, principal, so the allocation still reconciles to the payment total.
5. The system SHALL NOT carry a rounding residual into a different instalment's interest bucket.

### Requirement 8 — Return value of `allocate_payment`

**User Story:** As a developer integrating with the servicing system, I want `allocate_payment(payment, loan)` to return both how the payment was applied and the loan's updated balances, so that downstream systems can post transactions and reflect the new state.

#### Acceptance Criteria

1. WHEN `allocate_payment(payment, loan)` is called with a valid payment THEN the system SHALL return a breakdown of how the payment was applied across instalments and buckets.
2. WHEN `allocate_payment(payment, loan)` completes THEN the system SHALL return the loan's updated balances, including each instalment's remaining bucket balances and the loan's unallocated credit balance.
3. WHEN any allocation occurs (including a zero-value allocation) THEN the system SHALL record an allocation transaction reflecting the applied amounts.
4. WHEN the payment is rejected (negative amount) THEN the system SHALL signal an error rather than returning an allocation result.

## Auditor verdict

_The spec covers 9 of 14 decisions correctly: the inferable ones (1, 9, 11) and several bespoke ones that were clearly elicited (2, 3, 4, 5, 6, 14). It misses the genuinely non-inferable value-date decisions (7 back-valued payment, 12 penalty accrual timing), the write-off tolerance (10), same-day FIFO (13), and the early-payment-does-not-prepay-principal distinction (8). Decision 14's return shape is marked correct though it omits the tolerance_written_off field, since tolerance was never surfaced. The elicitation gap concentrates on value-date/accrual behaviour and the forgiveness tolerance._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Requirement 1, criterion 1: "apply the available amount to the instalment's buckets in the order fees, then penalties, then interest, then principal." | Spec states the exact reference order with fees before penalties, matching the deliberate non-default choice. |
| 2 | yes | **yes** | Requirement 2, criterion 2: "the system SHALL clear all four buckets of that instalment in full before applying any amount to the next instalment" and criterion 1 "allocate to the oldest outstanding instalment first." | Spec specifies oldest instalment cleared in full across all four buckets before touching the next, matching the reference. |
| 3 | yes | **yes** | Requirement 4: surplus "held as an unallocated credit balance", criterion 2 auto-applies to next instalment, criterion 3 "SHALL NOT auto-refund any surplus." | Spec captures credit-balance retention, automatic application to next instalment, and no auto-refund, matching all three parts of the reference answer. |
| 4 | yes | **yes** | Introduction: "denominated in Bahraini dinar (BHD), which uses three decimal places"; Requirement 7, criterion 1 "round half-up to three decimal places." | Spec correctly identifies BHD with 3 decimal places for all monetary handling. |
| 5 | yes | **yes** | Requirement 7, criterion 1: "the system SHALL round half-up to three decimal places." | Spec specifies round half-up to the minor unit, matching the reference rounding method exactly. |
| 6 | yes | **yes** | Requirement 7, criterion 2: "the system SHALL absorb that residual into the interest component." | Spec directs the rounding residual to interest, matching the reference. The criterion-4 fallback to principal when interest is zero is an addition but does not contradict the core answer. |
| 7 | no | no | absent | The spec never mentions value_date, back-valued payments, or recomputing/re-accruing interest to an earlier value date. Not addressed. |
| 8 | yes | no | Requirement 4, criterion 4 holds surplus as credit when nothing outstanding; Requirement 3 covers partial payments. No statement that early/on-time surplus does NOT prepay principal nor that future interest is unchanged. | While the credit-balance mechanism (#3) is present, the spec never explicitly addresses the not-in-arrears early-payment surplus case nor states that principal is not prepaid and future interest is unchanged; the distinguishing decision is not resolved. |
| 9 | yes | **yes** | Requirement 1, criterion 3: "SHALL NOT split a payment proportionally across buckets"; criterion 4 fills the current bucket with remaining amount and nothing to lower buckets. | Spec mandates strict in-order filling with no proportional split, matching the reference. |
| 10 | no | no | absent | The spec contains no write-off tolerance; no mention of a residual threshold (≤0.005 BHD) or marking an instalment fully paid with the residual written off. |
| 11 | yes | **yes** | Requirement 6, criterion 1: negative payment "rejected ... with an error"; criterion 2: zero "accept ... as a no-op and SHALL still record a zero-value allocation transaction." | Spec rejects negatives with an error and treats zero as a no-op that still records a zero-value transaction, matching the reference exactly. |
| 12 | no | no | absent | The spec never addresses penalty accrual on the allocation/value date or the accrue-then-allocate sequencing. Not surfaced. |
| 13 | no | no | absent | The spec does not address same-day multiple payments, FIFO by receipt timestamp, or independent sequential allocation. Not surfaced. |
| 14 | yes | **yes** | Requirement 8, criteria 1-2: return "a breakdown of how the payment was applied across instalments and buckets" and "updated balances, including each instalment's remaining bucket balances and the loan's unallocated credit balance." | Spec returns per-payment bucket/instalment breakdown, resulting outstanding balances, and credit_balance. Tolerance_written_off is omitted (tolerance absent entirely), but the returned shape otherwise substantially matches; the core reconciliation fields are present. |
