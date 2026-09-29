# kiro — loan-allocation — iteration 1

Model (author): claude-opus · Questions asked: 8 · Captured: 9/14 · Bespoke captured: 3/8

## Conversation

### Round 1
_Step reasoning:_ The brief omits the core allocation policies (component order, instalment order, under/overpayment handling, rounding) which cannot be reliably inferred, so I must ask the stakeholder before drafting requirements.

Q: Allocation order across components within an instalment: in what sequence should a payment be applied to penalties, fees, interest and principal (e.g. penalties → fees → interest → principal, or some other order)?
A: Fees, then penalties, then interest, then principal.

Q: Allocation order across multiple outstanding instalments: should the payment clear the oldest instalment first before moving to the next, or be applied in some other order (e.g. newest first, or proportionally across all)?
A: Oldest instalment cleared in full across all four buckets before any amount is applied to the next.

Q: Underpayment handling: when a payment is smaller than the total owed, should it partially satisfy a component/instalment (and if so, following the same component order), or must it fully clear one unit before touching the next?
A: Strict bucket order is followed; each bucket is filled in sequence. No proportional split — a partial payment that does not cover the first bucket due remains within that bucket.

Q: Overpayment handling: when a payment exceeds everything currently owed, what happens to the surplus (hold as credit/unapplied balance, apply to future/not-yet-due instalments, or reject/return)?
A: Surplus is held as an unallocated credit balance and auto-applied to the next instalment when it falls due. It is never auto-refunded.

Q: Rounding and currency: what precision are amounts held in (e.g. minor units/cents), and how should any rounding remainder be handled when splitting a payment across components?
A: Amounts are held in BHD to 3 decimal places (fils). Rounding is half-up to 3 dp. Any rounding residual is absorbed into the interest component.

### Round 2
_Step reasoning:_ Core allocation policy is settled; a final round closes genuinely non-inferable edge cases (credit re-application order, invalid inputs, residual when interest is zero) before drafting.

Q: When the held unallocated credit is auto-applied to the next instalment as it falls due, does it follow the same fees → penalties → interest → principal bucket order, and does any resulting rounding residual likewise go to interest?
A: Yes, the auto-applied credit follows the same fees → penalties → interest → principal order. Any rounding residual from that application likewise goes to the interest component.

Q: How should the function handle non-positive or malformed inputs (a zero or negative payment amount, or a loan with no outstanding instalments) — reject with an error, or return the loan unchanged with the amount held as credit?
A: Negative payment amount: rejected with an error. Zero payment amount: treated as a no-op — no allocation occurs, but a zero-value allocation transaction is still recorded. A loan with no outstanding instalments: [default, not policy] treat as a no-op and hold the payment as an unallocated credit balance per the standard overpayment rule.

Q: If the instalment receiving the rounding residual has a zero interest component, where should the residual go instead (e.g. principal, or the next non-zero bucket in order)?
A: If the interest component is zero, the rounding residual falls to principal. [default, not policy]

### Round 3 (process signalled done)
_Step reasoning:_ Two rounds have resolved every material policy decision (component order, instalment order, under/overpayment, rounding, credit auto-application, malformed inputs, zero-interest residual); the last answers were flagged defaults rather than policy, signalling the policy space is exhausted and I can now write the requirements.

(no questions this round)

## Produced specification

# Requirements Document

## Introduction

This feature adds payment allocation to the loan servicing system. When a borrower makes a payment, a function `allocate_payment(payment, loan)` applies the money across what the borrower currently owes and returns both how the payment was applied and the loan's updated balances.

A loan may carry several outstanding instalments. Each instalment is composed of four components (buckets): fees, penalties, interest and principal. Allocation is deterministic: it follows a fixed bucket order within an instalment and clears older instalments before newer ones. Any payment in excess of what is currently owed is retained as an unallocated credit and applied automatically when the next instalment falls due. All monetary amounts are held in Bahraini Dinar (BHD) to three decimal places (fils).

The requirements below capture the institution's specific allocation policy. They are written so the behaviour can be implemented and tested without further interpretation.

## Requirements

### Requirement 1

**User Story:** As a loan servicing operator, I want a payment applied to the components of an instalment in a fixed order, so that every allocation is consistent and auditable.

#### Acceptance Criteria

1. WHEN a payment is applied to an instalment THEN the system SHALL apply it to the components in the order: fees first, then penalties, then interest, then principal.
2. WHEN a component (bucket) is being filled THEN the system SHALL apply funds to that bucket until it is fully satisfied before applying any funds to the next bucket in order.
3. WHEN a bucket has an amount owed of zero THEN the system SHALL apply nothing to it and SHALL proceed to the next bucket in order.

### Requirement 2

**User Story:** As a loan servicing operator, I want payments applied to the oldest outstanding instalment first, so that arrears are cleared in the correct sequence.

#### Acceptance Criteria

1. WHEN a loan has more than one outstanding instalment THEN the system SHALL apply the payment to the oldest outstanding instalment first.
2. WHEN applying a payment to an instalment THEN the system SHALL fully clear that instalment across all four buckets (fees, penalties, interest, principal) before applying any amount to the next instalment.
3. WHEN the oldest instalment is fully cleared and funds remain THEN the system SHALL move to the next-oldest outstanding instalment and repeat the same bucket order.

### Requirement 3

**User Story:** As a loan servicing operator, I want underpayments handled by strict bucket order with no proportional splitting, so that partial payments land predictably.

#### Acceptance Criteria

1. WHEN a payment is smaller than the total amount owed THEN the system SHALL fill each bucket in sequence (fees, penalties, interest, principal across instalments oldest first) and SHALL NOT split the payment proportionally across components or instalments.
2. IF a payment does not fully cover the first bucket due THEN the system SHALL apply the entire payment within that bucket and SHALL leave all subsequent buckets untouched.
3. WHEN a payment partially fills a bucket THEN the system SHALL record the applied amount against that bucket and SHALL reduce that bucket's outstanding balance by the applied amount.

### Requirement 4

**User Story:** As a loan servicing operator, I want any surplus held as credit and applied to the next instalment, so that overpayments are retained for the borrower rather than refunded.

#### Acceptance Criteria

1. WHEN a payment exceeds everything currently owed on the loan THEN the system SHALL hold the surplus as an unallocated credit balance on the loan.
2. WHEN an instalment falls due AND an unallocated credit balance exists THEN the system SHALL automatically apply the credit to that instalment.
3. WHEN the unallocated credit is auto-applied to the next instalment THEN the system SHALL apply it in the same bucket order: fees, then penalties, then interest, then principal.
4. IF a surplus exists THEN the system SHALL NOT automatically refund it to the borrower.

### Requirement 5

**User Story:** As a loan servicing operator, I want amounts held and rounded to a defined precision, so that every allocation totals exactly and residuals are handled consistently.

#### Acceptance Criteria

1. WHEN the system holds or reports any monetary amount THEN it SHALL hold that amount in BHD to three decimal places (fils).
2. WHEN rounding is required THEN the system SHALL round half-up to three decimal places.
3. WHEN splitting a payment across components produces a rounding residual THEN the system SHALL absorb that residual into the interest component of the instalment concerned.
4. WHEN auto-applied credit produces a rounding residual THEN the system SHALL absorb that residual into the interest component of the instalment concerned.
5. IF the instalment receiving a rounding residual has an interest component of zero THEN the system SHALL absorb the residual into the principal component instead.

### Requirement 6

**User Story:** As a loan servicing operator, I want non-positive and edge-case inputs handled explicitly, so that invalid payments are rejected and benign cases are recorded correctly.

#### Acceptance Criteria

1. IF the payment amount is negative THEN the system SHALL reject the payment with an error and SHALL NOT modify the loan.
2. WHEN the payment amount is zero THEN the system SHALL treat it as a no-op, SHALL perform no allocation, and SHALL still record a zero-value allocation transaction.
3. WHEN the loan has no outstanding instalments THEN the system SHALL treat the payment as a no-op for allocation and SHALL hold the payment as an unallocated credit balance per the standard overpayment rule.

### Requirement 7

**User Story:** As a loan servicing operator, I want the function to return both the allocation breakdown and the updated loan, so that I can post the transaction and see the resulting balances.

#### Acceptance Criteria

1. WHEN `allocate_payment(payment, loan)` completes successfully THEN the system SHALL return how the payment was applied across each instalment and each of its four buckets.
2. WHEN `allocate_payment(payment, loan)` completes successfully THEN the system SHALL return the loan's updated balances, including any unallocated credit balance.
3. WHEN an allocation occurs (including the zero-payment no-op) THEN the system SHALL record an allocation transaction reflecting the amounts applied.

## Auditor verdict

_Coverage 9/14. The spec nails the mechanical and more-inferable decisions (1,2,3,4,5,6,8,9,11), including the bespoke fees-before-penalties order, BHD 3 dp precision, half-up rounding, and residual-into-interest. It entirely misses the value-date/accrual family (7, 12) and the write-off tolerance (10), and consequently the return shape (14) omits tolerance_written_off. Same-day FIFO ordering (13) is also absent. The gap concentrates on the genuinely bespoke, non-inferable policies the engineer would only get by asking._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Req 1.1: "apply it to the components in the order: fees first, then penalties, then interest, then principal." | Spec states the exact reference order, including fees before penalties (the deliberate non-default). Matches. |
| 2 | yes | **yes** | Req 2.1 "apply the payment to the oldest outstanding instalment first"; Req 2.2 "fully clear that instalment across all four buckets ... before applying any amount to the next instalment." | Oldest-first, cleared fully across all four buckets before touching the next — exactly the reference strategy. |
| 3 | yes | **yes** | Req 4.1 "hold the surplus as an unallocated credit balance"; Req 4.2 auto-apply when instalment falls due; Req 4.4 "SHALL NOT automatically refund it." | Credit balance, auto-applied on next due, never auto-refunded — all three reference elements present. |
| 4 | yes | **yes** | Req 5.1: "hold that amount in BHD to three decimal places (fils)." | Currency BHD and 3 dp minor unit stated exactly. |
| 5 | yes | **yes** | Req 5.2: "round half-up to three decimal places." | Round half-up to the 3 dp minor unit matches the reference method. |
| 6 | yes | **yes** | Req 5.3: "absorb that residual into the interest component of the instalment concerned." | Residual lands in interest as required. Spec 5.5 adds a principal fallback when interest is zero, an extra edge case that does not contradict the primary rule. |
| 7 | no | no | absent | The spec never mentions value_date, back-valued payments, or recomputing/re-accruing interest to an earlier date. |
| 8 | yes | **yes** | Req 4.1 "exceeds everything currently owed ... hold the surplus as an unallocated credit balance"; Req 4 makes no provision for prepaying principal. | All surplus becomes credit under the uniform rule and nothing prepays principal, so early-with-surplus behaviour resolves as the reference requires (future interest unchanged). |
| 9 | yes | **yes** | Req 3.1 "fill each bucket in sequence ... SHALL NOT split the payment proportionally"; Req 3.2 apply entire payment within the first bucket if not covered. | Strict in-order fill with explicit no-proportional-split — matches reference. |
| 10 | no | no | absent | No mention of any write-off tolerance, residual threshold (≤ 0.005 BHD), or marking an instalment fully paid on a near-complete payment. |
| 11 | yes | **yes** | Req 6.1 negative "reject the payment with an error"; Req 6.2 zero is a no-op that "SHALL still record a zero-value allocation transaction." | Negative rejected with error, zero a no-op still recording a zero-value transaction — matches both halves of the reference. |
| 12 | no | no | absent | The spec says nothing about penalty accrual timing or accruing penalties up to/including the value date before allocation. |
| 13 | no | no | absent | No mention of multiple same-day payments, receipt timestamps, or FIFO ordering of independent allocations. |
| 14 | yes | no | Req 7.1 per-instalment per-bucket application; Req 7.2 updated balances "including any unallocated credit balance." | Spec returns three of the four reference elements (per-bucket application, outstanding balances, credit_balance) but omits tolerance_written_off, so the shape does not fully match the reference. |
