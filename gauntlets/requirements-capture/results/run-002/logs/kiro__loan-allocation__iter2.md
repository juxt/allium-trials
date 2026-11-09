# kiro — loan-allocation — iteration 2

Model (author): claude-opus · Questions asked: 16 · Captured: 12/14 · Bespoke captured: 6/8

## Conversation

### Round 1
_Step reasoning:_ The brief omits the allocation waterfall, instalment ordering, partial-payment and overpayment handling, and rounding, none of which can be reliably inferred, so I must ask the stakeholder before drafting requirements.

Q: Allocation order across components: within what's owed, in what sequence should a payment be applied to penalties, fees, interest and principal?
A: Fees first, then penalties, then interest, then principal.

Q: Allocation order across instalments: when several instalments are outstanding, should the payment clear the oldest instalment first (all its components) before moving to the next, or should it pay one component type across all instalments before the next component?
A: Oldest instalment cleared in full across all four components before any amount is applied to the next instalment.

Q: Partial payments: if a payment does not fully cover the component or instalment it reaches in the waterfall, should it be applied partially as far as it goes, or only applied when it can settle a whole unit?
A: Applied partially as far as it goes, in strict component order. No requirement to settle a whole unit; each bucket is filled to whatever the payment can cover before moving to the next.

Q: Overpayment / surplus: if the payment exceeds everything currently owed, what happens to the excess, is it applied as principal prepayment, held as an unallocated credit on the loan, carried to future instalments, or refunded?
A: Surplus is held as an unallocated credit balance on the loan. It is auto-applied to the next instalment when it falls due. It is not used for principal prepayment and is never auto-refunded.

Q: Rounding and currency precision: what monetary unit and rounding rule should allocation use (e.g. round to the cent, and how are rounding remainders handled)?
A: Currency is BHD; all amounts use 3 decimal places (fils). Rounding is half-up to 3 dp. Any rounding residual is absorbed into the interest component.

### Round 2
_Step reasoning:_ Core waterfall, surplus and rounding policies are settled; three material, non-inferable edge policies remain (existing-credit interaction, due-vs-all instalment scope, invalid-amount handling) before requirements are complete.

Q: Pre-existing credit interaction: if the loan already carries an unallocated credit balance when a new payment arrives, should the existing credit be combined with the incoming payment and allocated together in this call, or does the credit remain untouched and only the new payment amount flow through the waterfall?
A: The existing credit balance remains untouched; only the new payment amount flows through the waterfall. The credit is auto-applied to the next instalment when it falls due, not combined with incoming payments. [default, not policy]

Q: Scope of 'outstanding': should the waterfall apply only to instalments already due or overdue as of the payment date, or to every scheduled instalment on the loan including those not yet due?
A: Only instalments already due or overdue as of the payment date are in scope for the waterfall. Instalments not yet due are not touched.

Q: Invalid amounts: how should allocate_payment handle a zero or negative payment amount, reject it as an error, or treat it as a no-op returning the loan unchanged?
A: A negative payment is rejected with an error. A zero payment is a no-op that still records a zero-value allocation transaction.

### Round 3
_Step reasoning:_ Hidden allocation policies are well covered; the remaining genuine ambiguities are the source of the as-of date (the signature omits it yet scope depends on it) and the precise return/transaction shape, neither reliably inferable.

Q: Where does the as-of/payment date used to determine which instalments are 'due or overdue' come from, given the signature is allocate_payment(payment, loan), is it a field on the payment object, a field on the loan, or supplied some other way?
A: The value_date field on the payment object is used. It determines both which instalments are in scope (due or overdue as of that date) and the point to which interest is accrued before allocation runs.

Q: What exactly should allocate_payment return, both the per-instalment per-component breakdown of how the payment was applied (including any amount sent to credit and any rounding residual) and the loan's updated balances, and should the recorded allocation transaction capture that same breakdown?
A: Return, per payment: for each instalment touched, the amount applied to each of the four buckets (fees, penalties, interest, principal); the instalment's resulting outstanding balance per bucket; any credit_balance created from surplus; any tolerance_written_off amount. Also return the loan's updated aggregate outstanding balances. The recorded allocation transaction should capture that same per-instalment, per-bucket breakdown so the ledger entry is fully reconcilable to the waterfall.

### Round 4
_Step reasoning:_ The stakeholder's own return spec introduced a `tolerance_written_off` field and interest-accrual-to-value_date, but neither the write-off policy nor the accrual responsibility has been defined; these are material and cannot be inferred.

Q: Your Round 3 answer referenced a `tolerance_written_off` amount in the return, but we haven't defined the tolerance policy. When an instalment's bucket is left with a tiny residual after a payment, under what condition is that residual written off rather than left outstanding, i.e. what is the tolerance threshold (e.g. a fixed fils amount per bucket, per instalment, or per payment), and which bucket does the write-off reduce?
A: The threshold is 0.005 BHD per instalment in total: if the sum of all remaining bucket balances on an instalment after allocation is ≤ 0.005 BHD, the instalment is marked fully paid and the residual is written off. The write-off reduces whichever bucket(s) still carry the residual, zeroing them out. [Which specific bucket absorbs the write-off entry for ledger purposes: default, not policy — suggest the last non-zero bucket reached in the waterfall, i.e. principal if it was reached, otherwise the deepest bucket touched.]

Q: Does the tolerance write-off apply only when a payment very nearly clears an instalment (near-full settlement), or on any partial payment that leaves a sub-threshold residual?
A: It applies whenever the post-allocation residual on an instalment falls at or below the threshold, regardless of how much of the instalment was paid. It is not restricted to near-full settlement; a partial payment that happens to leave ≤ 0.005 BHD outstanding triggers the same write-off.

Q: Interest is accrued to the payment's `value_date` before allocation runs. Is that accrued interest computed by `allocate_payment` itself, or is the interest bucket already populated on the loan when the function is called, so allocation only consumes it?
A: Interest accrual to value_date happens before allocation runs, but whether allocate_payment performs that accrual internally or consumes a pre-populated balance is not specified policy. [Default, not policy: allocate_payment is responsible for accruing interest to value_date itself as the first step, so callers supply only the payment and loan state; the function updates the interest bucket before the waterfall consumes it.]

### Round 5
_Step reasoning:_ Core waterfall, surplus, scope, rounding, tolerance and return shape are pinned down, but interest-accrual mechanics (rate, day-count, which instalments) remain an undefined material policy that cannot be reliably inferred, so I ask before concluding.

Q: Interest accrual to value_date is now allocate_payment's responsibility, but the mechanics aren't defined. What rate and day-count convention should it use (e.g. the instalment's contractual rate on outstanding principal, simple vs compound, actual/365 vs actual/360 vs 30/360), and does accrual run only on in-scope due/overdue instalments or on all instalments up to value_date?
A: Rate and day-count convention are not specified policy. [Default, not policy: use each instalment's contractual rate on its outstanding principal balance, simple interest, actual/365 day count.] Accrual scope: only instalments that are in-scope for the waterfall (due or overdue as of value_date) have interest accrued to value_date before allocation runs. Instalments not yet due are not accrued in this call.

Q: When an instalment is partially paid and left outstanding, does unpaid principal continue to accrue interest into a future call, and if so is that newly accrued interest added to the same instalment's interest bucket or tracked separately?
A: Not specified policy. [Default, not policy: unpaid principal on a partially settled instalment continues to accrue interest; in a subsequent allocate_payment call, the function accrues interest on that instalment up to the new value_date and adds the resulting amount to that same instalment's interest bucket before the waterfall runs. No separate tracking structure is introduced; accrued interest accumulates in the existing interest bucket.]

Q: The Round 1 rule sends any rounding residual into the interest bucket, while the Round 4 tolerance write-off zeroes residual buckets (last non-zero bucket reached). If both could apply to the same instalment in one call, which takes precedence, is the half-up rounding residual folded into interest first and then the ≤0.005 BHD tolerance check applied to the post-rounding balances?
A: The rounding residual is folded into the interest bucket first, as part of the allocation arithmetic. The tolerance check is then applied to the post-rounding outstanding balances on the instalment. If those post-rounding balances sum to ≤ 0.005 BHD, the write-off fires and zeroes them out. Rounding takes precedence in sequencing; the tolerance check always sees the already-rounded state.

### Round 6 (process signalled done)
_Step reasoning:_ Five rounds have resolved every material policy the brief omitted (component and instalment order, partial/surplus handling, rounding, credit interaction, scope, invalid amounts, date source, return shape, tolerance, accrual, and precedence); remaining points are flagged defaults, so requirements are complete.

(no questions this round)

## Produced specification

# Requirements Document

## Introduction

This feature adds payment allocation to the loan servicing system. When a borrower makes a payment, the money must be applied across what they currently owe on the loan following a defined waterfall. The core deliverable is a function `allocate_payment(payment, loan)` that accrues interest to the payment's value date, applies the payment across outstanding instalments and their components, settles any sub-threshold residuals, holds any surplus as a credit balance, and returns a fully reconcilable breakdown of how the payment was applied together with the loan's updated balances.

Each outstanding instalment carries four component buckets: fees, penalties, interest and principal. Payments are applied strictly in that component order, oldest instalment first, filling each bucket as far as the remaining payment allows. All monetary amounts are denominated in BHD to three decimal places (fils).

The requirements below capture every policy decision confirmed with the stakeholder. Where a point was neither asked nor covered by the brief, it has been resolved with a stated default and is marked as such.

## Requirements

### Requirement 1: Component allocation order

**User Story:** As a loan servicing operator, I want payments applied to loan components in a fixed order, so that every allocation is deterministic and auditable.

#### Acceptance Criteria

1. WHEN a payment is applied to an instalment THEN the system SHALL apply funds to that instalment's components in the order fees first, then penalties, then interest, then principal.
2. WHEN a component bucket is fully settled AND funds remain THEN the system SHALL move to the next component in the defined order.
3. The system SHALL NOT apply funds to a later component in the order while an earlier component on the same instalment remains outstanding.

### Requirement 2: Instalment allocation order

**User Story:** As a loan servicing operator, I want the oldest outstanding instalment cleared before any later instalment, so that arrears are reduced in chronological order.

#### Acceptance Criteria

1. WHEN several instalments are outstanding THEN the system SHALL fully clear the oldest instalment across all four components before applying any amount to the next instalment.
2. WHEN the oldest in-scope instalment is fully settled AND funds remain THEN the system SHALL proceed to the next-oldest in-scope instalment and apply the same component order.
3. The system SHALL NOT pay a single component type across multiple instalments ahead of fully clearing an older instalment.

### Requirement 3: Partial allocation

**User Story:** As a loan servicing operator, I want a payment that cannot cover a bucket to be applied as far as it reaches, so that borrowers receive credit for every fil paid.

#### Acceptance Criteria

1. WHEN a payment does not fully cover the component or instalment it reaches in the waterfall THEN the system SHALL apply the payment partially, as far as it goes, in strict component order.
2. The system SHALL NOT require a component or instalment to be settled as a whole unit before applying funds.
3. WHEN the payment is exhausted mid-waterfall THEN the system SHALL leave all remaining buckets outstanding with their reduced balances.

### Requirement 4: Surplus and credit balance

**User Story:** As a loan servicing operator, I want any payment surplus retained as a credit on the loan, so that overpayments are preserved for the next instalment rather than reshaping the loan or being returned.

#### Acceptance Criteria

1. WHEN the payment exceeds everything currently owed across all in-scope instalments THEN the system SHALL hold the excess as an unallocated credit balance on the loan.
2. WHEN the next instalment falls due THEN the system SHALL auto-apply the held credit balance to that instalment.
3. The system SHALL NOT use surplus for principal prepayment.
4. The system SHALL NOT auto-refund surplus.

### Requirement 5: Currency, precision and rounding

**User Story:** As a finance controller, I want all allocation arithmetic performed in BHD to fils precision with a defined rounding rule, so that ledger entries reconcile exactly.

#### Acceptance Criteria

1. The system SHALL denominate all amounts in BHD using three decimal places (fils).
2. WHEN rounding is required THEN the system SHALL round half-up to three decimal places.
3. WHEN a rounding residual arises from allocation arithmetic THEN the system SHALL absorb that residual into the interest component.

### Requirement 6: Interaction with a pre-existing credit balance

**User Story:** As a loan servicing operator, I want an existing credit balance left untouched when a new payment arrives, so that credits are only consumed when the next instalment falls due.

#### Acceptance Criteria

1. IF the loan already carries an unallocated credit balance when a new payment arrives THEN the system SHALL leave the existing credit balance untouched and SHALL flow only the new payment amount through the waterfall. [Default, not policy: the stakeholder confirmed this as the resolved behaviour without it being an explicit institutional policy.]
2. The system SHALL NOT combine an existing credit balance with an incoming payment for allocation in the same call.
3. WHEN the next instalment falls due THEN the system SHALL auto-apply the existing credit balance as per Requirement 4.

### Requirement 7: Scope of outstanding instalments

**User Story:** As a loan servicing operator, I want allocation limited to instalments due or overdue as of the payment date, so that future instalments are not prematurely reduced.

#### Acceptance Criteria

1. WHEN determining which instalments are in scope for the waterfall THEN the system SHALL include only instalments already due or overdue as of the payment's value date.
2. The system SHALL NOT apply the payment to instalments not yet due.

### Requirement 8: Payment date source

**User Story:** As a loan servicing operator, I want the as-of date taken from the payment, so that scope and interest accrual are both anchored to a single explicit date.

#### Acceptance Criteria

1. The system SHALL use the `value_date` field on the payment object as the as-of date.
2. The system SHALL use `value_date` to determine which instalments are in scope (due or overdue as of that date).
3. The system SHALL use `value_date` as the point to which interest is accrued before allocation runs.

### Requirement 9: Invalid and zero payment amounts

**User Story:** As a loan servicing operator, I want invalid amounts rejected and zero amounts handled safely, so that bad input cannot corrupt the ledger.

#### Acceptance Criteria

1. IF the payment amount is negative THEN the system SHALL reject the payment with an error.
2. IF the payment amount is zero THEN the system SHALL treat the call as a no-op that leaves the loan unchanged.
3. WHEN the payment amount is zero THEN the system SHALL still record a zero-value allocation transaction.

### Requirement 10: Interest accrual to value date

**User Story:** As a finance controller, I want interest accrued to the value date as the first step of allocation, so that the interest bucket is current before the waterfall consumes it.

#### Acceptance Criteria

1. WHEN `allocate_payment` runs THEN the system SHALL accrue interest to the payment's `value_date` as the first step, before the waterfall consumes any amount. [Default, not policy: the stakeholder confirmed `allocate_payment` performs accrual internally rather than consuming a pre-populated interest balance.]
2. WHEN accruing interest THEN the system SHALL compute interest using each instalment's contractual rate applied to its outstanding principal balance, using simple interest on an actual/365 day-count basis. [Default, not policy: rate and day-count convention were not specified policy; this is the resolved default.]
3. WHEN accruing interest THEN the system SHALL accrue only on instalments that are in scope for the waterfall (due or overdue as of `value_date`).
4. The system SHALL NOT accrue interest on instalments not yet due in this call.
5. WHEN accrued interest is computed for an in-scope instalment THEN the system SHALL add it to that instalment's existing interest bucket before the waterfall runs.

### Requirement 11: Continued accrual on partially settled instalments

**User Story:** As a finance controller, I want unpaid principal to keep accruing interest across calls, so that carried balances reflect the true cost over time.

#### Acceptance Criteria

1. WHEN an instalment is left partially settled with outstanding principal THEN the system SHALL continue to accrue interest on that principal. [Default, not policy: resolved default confirmed by the stakeholder.]
2. WHEN a subsequent `allocate_payment` call runs THEN the system SHALL accrue interest on that instalment up to the new `value_date` and SHALL add the resulting amount to that same instalment's interest bucket before the waterfall runs.
3. The system SHALL NOT introduce a separate tracking structure for newly accrued interest; accrued interest SHALL accumulate in the existing interest bucket.

### Requirement 12: Tolerance write-off

**User Story:** As a loan servicing operator, I want tiny residual balances written off automatically, so that instalments do not linger open over sub-fil amounts.

#### Acceptance Criteria

1. WHEN allocation on an instalment is complete AND the sum of all remaining bucket balances on that instalment is ≤ 0.005 BHD THEN the system SHALL mark the instalment fully paid and write off the residual, zeroing the affected bucket(s).
2. The tolerance threshold SHALL be 0.005 BHD per instalment, measured as the total of all remaining bucket balances on that instalment.
3. WHEN a write-off fires THEN the system SHALL record the write-off against the last non-zero bucket reached in the waterfall, that is principal if principal was reached, otherwise the deepest bucket touched. [Default, not policy: which specific bucket absorbs the write-off entry for ledger purposes was a resolved default, not institutional policy.]
4. WHEN the post-allocation residual on an instalment is at or below the threshold THEN the system SHALL apply the write-off regardless of how much of the instalment was paid, including partial payments not approaching full settlement.
5. The system SHALL NOT restrict the write-off to near-full settlement cases.

### Requirement 13: Rounding and tolerance precedence

**User Story:** As a finance controller, I want rounding resolved before the tolerance check, so that the write-off always evaluates a stable, already-rounded balance.

#### Acceptance Criteria

1. WHEN both a rounding residual and a potential tolerance write-off could apply to the same instalment in one call THEN the system SHALL fold the half-up rounding residual into the interest bucket first, as part of the allocation arithmetic.
2. WHEN the rounding residual has been folded into interest THEN the system SHALL apply the tolerance check to the post-rounding outstanding balances on the instalment.
3. The tolerance check SHALL always evaluate the already-rounded state of the instalment's balances.

### Requirement 14: Return value and recorded transaction

**User Story:** As a finance controller, I want the function to return a full per-instalment, per-bucket breakdown and updated loan balances, so that every ledger entry is reconcilable to the waterfall.

#### Acceptance Criteria

1. WHEN `allocate_payment` completes THEN the system SHALL return, for each instalment touched, the amount applied to each of the four buckets (fees, penalties, interest, principal).
2. WHEN `allocate_payment` completes THEN the system SHALL return, for each instalment touched, that instalment's resulting outstanding balance per bucket.
3. WHEN surplus arises THEN the system SHALL return any `credit_balance` created from that surplus.
4. WHEN a tolerance write-off fires THEN the system SHALL return any `tolerance_written_off` amount.
5. WHEN `allocate_payment` completes THEN the system SHALL return the loan's updated aggregate outstanding balances.
6. WHEN an allocation transaction is recorded THEN the system SHALL capture the same per-instalment, per-bucket breakdown so the ledger entry is fully reconcilable to the waterfall.

## Notes on resolved defaults

The following points were not fixed institutional policy and have been resolved with defaults, as confirmed during requirements capture: the treatment of a pre-existing credit balance (Requirement 6); `allocate_payment` performing interest accrual internally (Requirement 10.1); the interest rate and day-count convention (Requirement 10.2); continued accrual mechanics on partially settled instalments (Requirement 11); and the specific bucket that absorbs a tolerance write-off entry for ledger purposes (Requirement 12.3). No stakeholder answers beyond those supplied have been invented.

## Auditor verdict

_The spec covers 12 of 14 decisions correctly (coverage 12/14). It nails the bespoke, non-inferable choices: fees-before-penalties order (1), oldest-in-full (2), credit-balance mechanics (3, 8), BHD 3-dp precision (4), half-up rounding (5), residual-into-interest (6), value-date interest recompute (7), tolerance 0.005 BHD (10), and the full return shape (14), plus the inferable 9 and 11. It misses decision 12 (penalty accrual up to the value date — the spec accrues only interest, never penalties) and decision 13 (same-day multiple payments FIFO by receipt timestamp — not mentioned at all)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | R1.1: 'the system SHALL apply funds to that instalment's components in the order fees first, then penalties, then interest, then principal.' | Spec states the exact order fees → penalties → interest → principal, matching the reference's deliberately non-default fees-before-penalties sequence. |
| 2 | yes | **yes** | R2.1: 'the system SHALL fully clear the oldest instalment across all four components before applying any amount to the next instalment.' | Matches 'oldest instalment cleared in full (all four buckets) before any money touches the next'; R2.3 also forbids paying one component across instalments. |
| 3 | yes | **yes** | R4.1 holds excess as 'unallocated credit balance'; R4.2 auto-applies when next instalment falls due; R4.4 'SHALL NOT auto-refund surplus.' | All three elements — unallocated credit balance, auto-apply on next due, never auto-refund — are present and match the reference exactly. |
| 4 | yes | **yes** | R5.1: 'denominate all amounts in BHD using three decimal places (fils).' | Correctly identifies BHD and 3 dp (fils), matching the reference precision. |
| 5 | yes | **yes** | R5.2: 'the system SHALL round half-up to three decimal places.' | Half-up to the 3-dp minor unit matches the reference rounding method exactly. |
| 6 | yes | **yes** | R5.3: 'the system SHALL absorb that residual into the interest component.' | Residual absorbed into interest (not principal or largest bucket) matches the reference destination. |
| 7 | yes | **yes** | R8.3: 'use value_date as the point to which interest is accrued before allocation runs'; R10.1 accrues interest to value_date as first step. | Interest is recomputed/accrued to the payment's value_date before allocation, matching the back-valued recompute-to-value-date behaviour. |
| 8 | yes | **yes** | R7.1 limits scope to instalments due/overdue as of value_date; R4.3 'SHALL NOT use surplus for principal prepayment'; surplus becomes credit per R4. | An early payment settles only in-scope (due/overdue) instalments and any surplus becomes credit without prepaying principal, so future interest is unchanged — matches the reference. |
| 9 | yes | **yes** | R3.1: 'apply the payment partially, as far as it goes, in strict component order'; R3 title 'Partial allocation'. | Strict in-order filling with no proportional split matches the reference resolution. |
| 10 | yes | **yes** | R12.2: 'The tolerance threshold SHALL be 0.005 BHD per instalment'; R12.1 marks instalment fully paid and writes off residual. | Threshold of ≤0.005 BHD with full-paid marking and write-off matches the reference exactly. |
| 11 | yes | **yes** | R9.1 negative 'reject the payment with an error'; R9.2 zero is a no-op; R9.3 'SHALL still record a zero-value allocation transaction.' | Negative rejected with error and zero as a no-op that still records a zero-value transaction both match the reference. |
| 12 | no | no | absent | The spec accrues only interest to the value_date (R10, R11 are interest-specific); it never addresses penalty accrual up to the value date before allocation, treating penalties as a pre-existing bucket. The reference's penalty-accrual decision is not surfaced. |
| 13 | no | no | absent | No criterion addresses multiple payments on the same day or FIFO-by-receipt-timestamp ordering; R6 only covers a pre-existing credit balance plus a single incoming payment. |
| 14 | yes | **yes** | R14.1 per-bucket amount applied per instalment; R14.2 resulting outstanding balance per bucket; R14.3 credit_balance; R14.4 tolerance_written_off. | The return shape includes per-instalment per-bucket amounts, resulting balances, credit_balance and tolerance_written_off, matching every element of the reference shape. |
