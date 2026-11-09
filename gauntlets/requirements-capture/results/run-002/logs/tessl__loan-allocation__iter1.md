# tessl — loan-allocation — iteration 1

Model (author): claude-opus · Questions asked: 8 · Captured: 9/14 · Bespoke captured: 3/8

## Conversation

### Round 1
_Step reasoning:_ Allocation ordering across components and instalments is the single highest-impact policy the brief omits and cannot be safely inferred, so I ask that first, one question at a time.

Q: When a payment is applied, in what order should it be allocated across an instalment's components — penalties, fees, interest, and principal — and does that same ordering take priority over moving to the next outstanding instalment (i.e. oldest instalment fully cleared across all components first, or each component type cleared across all instalments first)?
A: Within an instalment the order is: fees first, then penalties, then interest, then principal. Instalment-first (oldest-first) takes priority: the oldest outstanding instalment must be cleared in full across all four buckets before any payment amount moves to the next instalment.

### Round 2
_Step reasoning:_ Allocation order is settled; overpayment/surplus handling is the next highest-impact scope boundary that cannot be safely inferred.

Q: If the payment exceeds the total amount currently outstanding across all instalments (penalties, fees, interest and principal), how should the surplus be handled — returned/left unallocated, held as a credit on the loan, or applied to reduce future (not-yet-due) principal?
A: Surplus is held as an unallocated credit balance on the loan and auto-applied to the next instalment when it falls due. It is never auto-refunded and does not prepay future principal.

### Round 3
_Step reasoning:_ Allocation order and surplus are settled; monetary precision and rounding policy is the next highest-impact undetermined decision the institution must have chosen before amounts can be computed correctly.

Q: To what monetary precision are allocations computed and stored (e.g. whole minor units like cents, or fractional/decimal amounts), and when a bucket amount or the payment itself carries sub-unit fractions, what rounding rule applies (round half-up, banker's rounding, truncate) and where does any resulting rounding remainder land?
A: The loan is denominated in BHD (Bahraini dinar), which has 3 decimal places (fils). All allocation amounts are computed and stored to 3 dp. When any bucket amount or intermediate calculation produces a sub-unit fraction, round half-up to 3 dp. Any rounding residual is absorbed into the interest component, not principal.

### Round 4
_Step reasoning:_ Round 2 established that surplus becomes an auto-applied credit balance, but it's unspecified whether an existing credit is folded into this allocation run — a material policy that changes the function's inputs and cannot be safely inferred.

Q: When `allocate_payment` is called, is any pre-existing unallocated credit balance on the loan combined with the incoming payment and allocated together in the same run, or does the function allocate only the new payment amount and leave the existing credit untouched until the next instalment's due date triggers it separately?
A: The existing credit balance is left untouched during the payment run. It is auto-applied separately when the next instalment falls due, not combined with incoming payments. `allocate_payment` allocates only the new payment amount.

### Round 5
_Step reasoning:_ Core allocation policy is settled; one material input-validation policy (non-positive/negative payments) remains and cannot be safely inferred.

Q: How should `allocate_payment` handle a non-positive payment — i.e. a zero amount or a negative amount (such as a reversal/chargeback) — should it reject these as invalid input, treat zero as a no-op returning unchanged balances, and if negatives are permitted, do they reverse prior allocations in some defined order?
A: A negative payment amount must be rejected with an error. A zero payment amount is a no-op: no allocation is performed and no balances change, but a zero-value allocation transaction is still recorded. Negative amounts are not permitted as a reversal mechanism; reversals are not handled by this function.

### Round 6
_Step reasoning:_ Partial-payment behaviour within a single instalment is the last core allocation mechanic still unconfirmed; it determines where allocation stops and what state is written back.

Q: When the oldest outstanding instalment cannot be fully cleared by the payment (a partial payment), does allocation still proceed in order (fees, then penalties, then interest, then principal) up to the amount available, stopping partway through that instalment's buckets, and are the resulting partial bucket balances persisted as the loan's updated state?
A: Yes: allocation proceeds strictly in bucket order (fees → penalties → interest → principal) up to the amount available, stopping partway through whichever bucket exhausts the payment. The resulting partial bucket balances are persisted as the loan's updated state. No proportional split is applied.

### Round 7
_Step reasoning:_ Instalment-first ordering is confirmed, but the key that defines "oldest" and its tie-breaking rule is a non-inferable policy still needed for deterministic allocation.

Q: How is the "oldest" outstanding instalment determined for allocation ordering — strictly by each instalment's due date, and if two instalments share the same due date (or the ordering key is otherwise tied), what deterministic tie-breaker decides which is cleared first?
A: Oldest is determined strictly by due date (ascending). Tie-breaking between instalments sharing the same due date is not covered by policy; a reasonable default would be ascending instalment sequence number or instalment ID [default, not policy].

### Round 8
_Step reasoning:_ One material edge remains: the round-3 'residual into interest' rule is undefined when interest is zero, and the institution likely has a specific fallback the model cannot infer.

Q: When the rounding residual is absorbed into the interest component (per the round-3 policy), how should it be handled if the instalment receiving the allocation has a zero interest component — does the residual then fall to the next bucket in order (principal), get held in the unallocated credit balance, or is it guaranteed by denomination that no residual can arise in that case?
A: The answer key does not cover this edge case. A reasonable default: if the interest component for that instalment is zero, the rounding residual falls to principal — the next bucket in allocation order — rather than being held as a credit balance or silently dropped [default, not policy].

### Round 9 (process signalled done)
_Step reasoning:_ The material policy decisions (bucket order, instalment priority, surplus/credit handling, precision and rounding, credit interaction, non-positive and partial payments) are all captured; the last two rounds returned edge cases outside the answer key, signalling the institution's specified policy is exhausted, so further questions yield no inferable-only gaps.

(no questions this round)

## Produced specification

# Specification — `allocate_payment(payment, loan)`

## 1. Purpose and scope

This specification defines how an incoming borrower payment is allocated across the outstanding instalments of a loan in the servicing system, and how the loan's balances are updated as a result.

`allocate_payment(payment, loan)` takes a single incoming payment amount and a loan, applies the payment across what is currently owed according to the rules below, and returns both how the payment was applied and the loan's updated balances.

Each loan may carry several outstanding instalments. Each instalment has four component buckets: penalties, fees, interest and principal.

**In scope:** allocation of a single new payment across outstanding instalments; computation and persistence of updated bucket balances; handling of surplus, zero and negative payments; monetary precision and rounding.

**Out of scope:** reversals, chargebacks and refunds; the separate process that auto-applies a held credit balance when an instalment falls due (this spec defines only that such a credit is created and left untouched, not the mechanics of its later application); accrual of new interest, fees or penalties.

## 2. Allocation order

### 2.1 Within an instalment

Within a single instalment, the payment is applied to the component buckets in this strict order:

1. Fees
2. Penalties
3. Interest
4. Principal

### 2.2 Across instalments

Instalment-first (oldest-first) ordering takes priority over component ordering. The oldest outstanding instalment must be cleared in full across all four buckets (fees, penalties, interest and principal) before any payment amount moves to the next instalment. Component types are never cleared across all instalments ahead of fully clearing an older instalment.

### 2.3 Determining the oldest instalment

The oldest outstanding instalment is determined strictly by due date, ascending. The instalment with the earliest due date is cleared first.

Tie-breaking between two instalments that share the same due date is not covered by policy. The system applies a deterministic default tie-breaker: ascending instalment sequence number (or instalment ID). *(Default, not stakeholder policy.)*

## 3. Partial payments

When the payment is insufficient to fully clear the oldest outstanding instalment, allocation still proceeds strictly in bucket order (fees → penalties → interest → principal) up to the amount available, stopping partway through whichever bucket exhausts the payment.

No proportional split is applied. The payment fills each bucket in order until it runs out; the bucket in which the payment is exhausted receives whatever remains.

The resulting partial bucket balances are persisted as the loan's updated state.

## 4. Surplus handling

When the payment exceeds the total amount currently outstanding across all instalments and all four buckets, the surplus is held as an unallocated credit balance on the loan.

- The credit balance is auto-applied to the next instalment when it falls due (that application is handled by a separate process, outside this function).
- The surplus is never auto-refunded.
- The surplus does not prepay future (not-yet-due) principal.

## 5. Pre-existing credit balance

Any pre-existing unallocated credit balance on the loan is left untouched during a payment run. `allocate_payment` allocates only the new incoming payment amount.

The existing credit balance is not combined with the incoming payment. It is auto-applied separately when the next instalment falls due, not during this function's execution.

## 6. Monetary precision and rounding

The loan is denominated in Bahraini dinar (BHD), which has three decimal places (fils).

- All allocation amounts are computed and stored to 3 decimal places.
- When any bucket amount, the payment itself, or any intermediate calculation produces a sub-unit fraction, round half-up to 3 decimal places.
- Any rounding residual is absorbed into the interest component, not principal.

### 6.1 Residual when interest is zero

If the instalment receiving the allocation has a zero interest component, the rounding residual falls to the next bucket in allocation order, principal, rather than being held as a credit balance or silently dropped. *(Default, not stakeholder policy — the answer key does not cover this edge case.)*

## 7. Non-positive payments

### 7.1 Negative payment

A negative payment amount must be rejected with an error. Negative amounts are not permitted as a reversal mechanism. Reversals and chargebacks are not handled by this function.

### 7.2 Zero payment

A zero payment amount is a no-op: no allocation is performed and no balances change. A zero-value allocation transaction is still recorded.

## 8. Output and persisted state

`allocate_payment` returns how the payment was applied (the allocation across instalments and their component buckets) and the loan's updated balances.

The updated bucket balances, including any partial balances from a partial payment (§3) and any surplus credit balance created (§4), are persisted as the loan's new state. An allocation transaction is recorded for every call, including the zero-payment no-op case (§7.2).

## 9. Summary of decisions

| Area | Decision | Source |
|------|----------|--------|
| Component order within instalment | Fees → penalties → interest → principal | Policy |
| Cross-instalment order | Oldest instalment cleared fully across all buckets before next | Policy |
| Oldest determination | Strictly by due date, ascending | Policy |
| Same-due-date tie-break | Ascending instalment sequence number / ID | Default |
| Partial payment | Strict bucket order up to amount available; partial balances persisted; no proportional split | Policy |
| Surplus | Held as unallocated credit; auto-applied at next due date; never refunded; no principal prepay | Policy |
| Pre-existing credit | Left untouched; only new payment allocated | Policy |
| Precision | BHD, 3 dp (fils) | Policy |
| Rounding | Round half-up to 3 dp | Policy |
| Rounding residual | Absorbed into interest | Policy |
| Residual when interest zero | Falls to principal | Default |
| Negative payment | Rejected with error | Policy |
| Zero payment | No-op; zero-value transaction still recorded | Policy |
| Reversals | Not handled by this function | Policy |

## Auditor verdict

_The spec correctly nails the inferable core and most bespoke choices: bucket order (1), cross-instalment clearing (2), credit-balance surplus (3, 8), BHD 3dp precision (5), half-up rounding (5), interest residual (6), strict partial order (9) and non-positive handling (11). It misses the genuinely bespoke value-date decisions entirely — back-valued recompute (7) and penalty accrual timing (12) — both pushed out of scope, and the write-off tolerance (10), which in turn leaves the result shape (14) incomplete by omitting tolerance_written_off. Same-day FIFO (13) is also unaddressed. Coverage: 9/14 correct (1,2,3,4,5,6,8,9,11)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §2.1: '1. Fees 2. Penalties 3. Interest 4. Principal' | Spec states the within-instalment order as fees → penalties → interest → principal, matching the reference exactly, including fees before penalties. |
| 2 | yes | **yes** | §2.2: 'The oldest outstanding instalment must be cleared in full across all four buckets ... before any payment amount moves to the next instalment.' | Matches the reference 'oldest instalment cleared in full (all four buckets) before any money touches the next'. |
| 3 | yes | **yes** | §4: 'the surplus is held as an unallocated credit balance ... auto-applied to the next instalment when it falls due ... never auto-refunded.' | Credit-balance mechanism, auto-apply at next instalment, and no auto-refund all match the reference. |
| 4 | yes | **yes** | §6: 'denominated in Bahraini dinar (BHD), which has three decimal places (fils). All allocation amounts are computed and stored to 3 decimal places.' | BHD and 3 dp precision match the reference exactly. |
| 5 | yes | **yes** | §6: 'round half-up to 3 decimal places.' | Round half-up to the minor unit matches the reference rounding method. |
| 6 | yes | **yes** | §6: 'Any rounding residual is absorbed into the interest component, not principal.' | Residual destination (interest, not principal) matches the reference; the §6.1 zero-interest edge is a flagged default and does not contradict the main rule. |
| 7 | no | no | absent | The spec never mentions value_date or back-valued payments; §1 explicitly lists accrual as out of scope. No recomputation of interest to an earlier value date is addressed. |
| 8 | yes | **yes** | §4: 'The surplus does not prepay future (not-yet-due) principal.' | Spec states surplus becomes a credit balance and does not prepay principal, so future interest is unchanged, matching the reference. |
| 9 | yes | **yes** | §3: 'allocation still proceeds strictly in bucket order ... No proportional split is applied.' | Strict in-order fill with no proportional split matches the reference. |
| 10 | no | no | absent | The spec contains no write-off tolerance; no threshold (e.g. ≤ 0.005 BHD) for marking an instalment fully paid and writing off the residual is mentioned anywhere. |
| 11 | yes | **yes** | §7.1: 'A negative payment amount must be rejected with an error.' §7.2: 'A zero payment ... is a no-op ... A zero-value allocation transaction is still recorded.' | Negative rejected, zero is a no-op that still records a zero-value transaction — matches the reference precisely. |
| 12 | no | no | absent | Penalty accrual on the allocation/value date is not addressed; §1 puts accrual out of scope, so the accrue-then-allocate ordering is not specified. |
| 13 | no | no | absent | The spec handles only 'a single new payment' per call and never defines ordering of multiple same-day payments (FIFO by receipt timestamp), so this decision is unaddressed. |
| 14 | yes | no | §8: returns 'the allocation across instalments and their component buckets ... and the loan's updated balances ... any surplus credit balance created.' | Spec covers per-bucket allocation, outstanding balances and credit_balance, but omits tolerance_written_off from the returned shape (consistent with #10 being absent); strict literal match to the four-element reference fails. |
