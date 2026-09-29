# prose — loan-allocation — iteration 1

Model (author): claude-opus · Questions asked: 8 · Captured: 10/14 · Bespoke captured: 5/8

## Conversation

### Round 1
_Step reasoning:_ The brief omits every material allocation policy, so I ask the stakeholder to pin down component priority, cross-instalment order, partial/overpayment handling, rounding, and the input/output contract before writing the spec.

Q: When a payment is applied, in what order should the components be paid within an instalment: penalties, then fees, then interest, then principal, or some other priority?
A: Fees first, then penalties, then interest, then principal.

Q: When multiple instalments are outstanding, should the payment be applied to the oldest instalment first (and fully clear its components before moving to the next), or applied component-first across all instalments (e.g. all penalties across every instalment before any fees)?
A: Oldest instalment first. Clear all four components of that instalment in full before any of the payment touches the next instalment.

Q: How should a partial payment be handled when it is not enough to fully cover the highest-priority component: apply it proportionally, apply it fully to that component and leave the rest owing, or reject the payment?
A: Strict sequential order. Apply available funds to fill each component in priority sequence and leave any unfilled remainder owing. No proportional split; payment is not rejected.

Q: How should an overpayment be handled once every outstanding instalment component is cleared: apply the surplus to future instalments, hold it as a credit/unapplied balance, or refuse the excess?
A: Hold the surplus as an unallocated credit balance. Auto-apply it to the next instalment when that instalment falls due. Never auto-refund.

Q: What rounding rule and monetary precision should apply (e.g. round to the nearest cent/penny, and how are fractional remainders after proportional splits resolved)?
A: Loan currency is BHD. All amounts use 3 decimal places (fils). Rounding rule is round-half-up to 3 dp. Any rounding residual is absorbed into the interest component, not principal.

Q: What is the exact shape of the `payment` and `loan` inputs and the required return value (fields, types, and how updated balances and the per-component allocation breakdown should be represented)?
A: [default, not policy] Input `payment`: { id: string, loan_id: string, amount: decimal (3 dp), value_date: ISO-8601 date, received_at: ISO-8601 datetime }. Input `loan`: { id: string, instalments: [{ id: string, due_date: date, fees_due: decimal, penalties_due: decimal, interest_due: decimal, principal_due: decimal }] }. Return: { allocations: [{ instalment_id: string, fees_applied: decimal, penalties_applied: decimal, interest_applied: decimal, principal_applied: decimal, tolerance_written_off: decimal }], credit_balance_created: decimal, outstanding_balances: [{ instalment_id: string, fees_due: decimal, penalties_due: decimal, interest_due: decimal, principal_due: decimal }] }.

### Round 2
_Step reasoning:_ Two material, non-inferable policy gaps remain: the tolerance write-off threshold (implied by the output field but never specified) and whether allocation is scoped to due instalments or all outstanding instalments.

Q: The return shape includes a `tolerance_written_off` field per allocation, but no write-off policy has been established. Is there a tolerance threshold below which a remaining component (or instalment) balance is written off and treated as settled, e.g. a residual of a few fils left after rounding? If so, what is the exact threshold, does it apply per component or per instalment, and is the write-off triggered only when the component is otherwise fully paid?
A: Yes. The threshold is 0.005 BHD. It applies per instalment: if the total remaining balance across all four components of an instalment is ≤ 0.005 BHD after allocation runs, the instalment is marked fully paid and the residual is written off. It is not a per-component check, and it is triggered only after the normal allocation sequence has been applied to that instalment.

Q: Should `allocate_payment` allocate only to instalments already due as of the payment's `value_date` (leaving future-dated instalments untouched, so any surplus becomes credit to be auto-applied when they fall due), or to all outstanding instalments in the loan regardless of due date? The overpayment rule implies the former, but the scope of which instalments are eligible for allocation has not been stated explicitly.
A: Only instalments whose due_date is on or before the payment's value_date are eligible for allocation. Future-dated instalments are left untouched. Any surplus remaining after all eligible instalments are cleared becomes a credit balance, auto-applied when the next instalment falls due.

### Round 3 (process signalled done)
_Step reasoning:_ All material policy decisions (component priority, instalment ordering, partial/overpayment handling, rounding, eligibility, tolerance write-off, and I/O shape) are now resolved; remaining details are inferable defaults, so the specification can be written.

(no questions this round)

## Produced specification

# Requirements specification: `allocate_payment(payment, loan)`

## 1. Purpose and scope

This specifies a pure function `allocate_payment(payment, loan)` for a loan servicing system. Given a single borrower payment and the current state of a loan, it computes how the payment is applied across the loan's outstanding instalments and returns both the per-component allocation and the loan's updated outstanding balances.

The function is deterministic and side-effect-free. It does not persist state, call external services, or mutate its inputs; it reads the supplied `payment` and `loan` and returns a result value. Persistence, transaction management, and scheduling of the auto-application of credit balances are the responsibility of the caller and are out of scope here, except that this function reports the credit balance to be held.

## 2. Domain model

A loan has one or more instalments. Each instalment has four owed components: fees, penalties, interest, and principal. A payment is a single sum of money in the loan's currency that must be distributed across these components according to the rules below.

### 2.1 Currency, precision, and rounding

- The loan currency is Bahraini Dinar (BHD).
- All monetary amounts are represented and computed to 3 decimal places (fils). Three decimal places is the canonical precision for every input amount, intermediate value, and output amount.
- The rounding rule is round-half-up to 3 decimal places. Any value that could carry more than 3 decimal places (for example an intermediate arithmetic result) is rounded half-up to 3 dp.
- Where a rounding residual arises, it is absorbed into the interest component of the allocation, never into principal. (In the strict sequential allocation defined below, addition and subtraction of 3 dp amounts do not themselves create sub-fil residuals; this rule fixes the destination of any residual should one occur in an implementation that computes intermediate fractional values, and it governs the interest component specifically.)

## 3. Input contract

### 3.1 `payment`

```
payment: {
  id: string,               // unique payment identifier
  loan_id: string,          // identifier of the loan this payment is for
  amount: decimal(3dp),     // BHD amount tendered, >= 0, 3 decimal places
  value_date: date,         // ISO-8601 date; the effective date of the payment
  received_at: datetime     // ISO-8601 datetime; when the payment was received
}
```

### 3.2 `loan`

```
loan: {
  id: string,
  instalments: [
    {
      id: string,
      due_date: date,             // ISO-8601 date
      fees_due: decimal(3dp),     // >= 0
      penalties_due: decimal(3dp),// >= 0
      interest_due: decimal(3dp), // >= 0
      principal_due: decimal(3dp) // >= 0
    }
  ]
}
```

The `*_due` fields represent the amount currently owed on each component of each instalment at the time the function is called.

## 4. Output contract

```
return: {
  allocations: [
    {
      instalment_id: string,
      fees_applied: decimal(3dp),
      penalties_applied: decimal(3dp),
      interest_applied: decimal(3dp),
      principal_applied: decimal(3dp),
      tolerance_written_off: decimal(3dp)
    }
  ],
  credit_balance_created: decimal(3dp),
  outstanding_balances: [
    {
      instalment_id: string,
      fees_due: decimal(3dp),
      penalties_due: decimal(3dp),
      interest_due: decimal(3dp),
      principal_due: decimal(3dp)
    }
  ]
}
```

- `allocations` reports, per eligible instalment that received any allocation or write-off, how much of the payment was applied to each component and how much was written off under the tolerance rule.
- `credit_balance_created` is the surplus held as an unallocated credit balance (see section 6).
- `outstanding_balances` reports the remaining amount owed on each component of each instalment after allocation.

## 5. Allocation algorithm

### 5.1 Eligibility of instalments

Only instalments whose `due_date` is on or before the payment's `value_date` are eligible for allocation. Future-dated instalments (`due_date` strictly after `value_date`) are left untouched: they receive no allocation, no write-off, and their outstanding balances are unchanged.

### 5.2 Order of instalments

Eligible instalments are processed oldest first, ordered by ascending `due_date`. All four components of the current instalment must be handled in full (per the component sequence and the tolerance rule) before any of the payment touches the next instalment.

Where two eligible instalments share the same `due_date`, they are processed in the order they appear in `loan.instalments` (input order is the tie-break). This ordering rule for equal due dates was not specified by the stakeholder and is resolved here for determinism.

### 5.3 Order of components within an instalment

Within an instalment the payment is applied to components in this strict priority sequence:

1. Fees
2. Penalties
3. Interest
4. Principal

### 5.4 Strict sequential fill

Allocation is strictly sequential, not proportional. For each component in priority order, apply the lesser of (the funds still available from the payment) and (the amount owed on that component). Move to the next component only when the current one is fully filled or the available funds are exhausted.

If the available funds are not enough to fully cover the highest-priority unpaid component, apply all remaining funds to that component and leave the rest of that component, and every lower-priority component, owing. The payment is never rejected for being partial, and funds are never split proportionally across components.

Once the payment's funds are exhausted, all remaining eligible instalments and remaining components keep their existing due amounts.

### 5.5 Tolerance write-off (per instalment)

After the normal allocation sequence in 5.4 has been applied to an instalment, evaluate the tolerance rule for that instalment:

- Compute the total remaining balance across all four components of the instalment: `fees_due + penalties_due + interest_due + principal_due` after allocation.
- If that total is greater than 0 and less than or equal to 0.005 BHD, the instalment is treated as fully paid. The residual is written off: each component's remaining due is set to 0, and the sum written off is reported in that instalment's `tolerance_written_off`.
- The threshold is 0.005 BHD and applies to the instalment as a whole, not to any single component. It is not a per-component check.
- The write-off is triggered only after the normal allocation sequence has been applied to that instalment. An instalment that received no allocation (for example because funds were exhausted earlier) is still subject to the check on its remaining total, but in practice only an instalment that has just been allocated against will have a residual small enough to qualify. The check runs per eligible instalment in due-date order as part of processing that instalment.

When an instalment's residual is written off, it is not treated as available funds and does not increase the amount available for later instalments. Write-off reduces what the borrower owes; it does not create payment.

An instalment whose remaining total after allocation is exactly 0 has nothing to write off; its `tolerance_written_off` is 0.

### 5.6 Surplus and credit balance

Processing continues, oldest eligible instalment to newest, until either the payment's funds are exhausted or all eligible instalments are fully cleared (including any tolerance write-offs).

If funds remain after every eligible instalment is cleared, the surplus is held as an unallocated credit balance and reported in `credit_balance_created`. The surplus is not applied to future-dated instalments within this call. It is retained and auto-applied to the next instalment when that instalment falls due; that auto-application is performed by the caller on a later invocation and is out of scope for this function beyond reporting the amount. The surplus is never auto-refunded.

If there are no eligible instalments at all (for example every instalment is future-dated), the entire payment amount becomes `credit_balance_created`, `allocations` is empty, and `outstanding_balances` reflects the unchanged instalments.

## 6. Worked semantics of the credit balance

`credit_balance_created` is the amount of the current payment left over after all eligible instalments have been cleared. This function reports the newly created credit only. It does not receive or apply any pre-existing credit balance; combining this credit with any balance already on the loan is the caller's responsibility. (The inputs carry no existing credit-balance field; this is noted as a boundary of the contract, not an inferred policy.)

## 7. Output construction rules

- `allocations` contains one entry per eligible instalment that was processed and either received a non-zero allocation to at least one component or had a non-zero `tolerance_written_off`. Instalments that were reached but received nothing (zero applied, zero written off) need not appear; ineligible future-dated instalments never appear. Each `*_applied` value is the amount applied to that component, to 3 dp.
- `outstanding_balances` contains one entry per instalment in the loan whose balance is reported, in ascending `due_date` order (ties in input order). Every instalment's post-allocation component balances are reported here, including future-dated instalments (unchanged) and fully cleared instalments (all zeros). Implementations should report all instalments so the caller has the complete post-state.
- The sum, across all allocation entries, of the four `*_applied` amounts plus `credit_balance_created` equals `payment.amount`. Written-off residuals are not part of this sum; they reduce outstanding balances but are not funded by the payment.
- All output amounts are 3 dp, round-half-up.

## 8. Invariants and edge cases

1. Conservation of funds: `sum(all *_applied) + credit_balance_created == payment.amount` exactly, at 3 dp.
2. No negative balances: no component's outstanding due is ever negative; no `*_applied` value exceeds the component's due at the time it is applied.
3. Zero payment: if `payment.amount` is 0, no allocation occurs, `credit_balance_created` is 0, tolerance write-offs still do not trigger from allocation (no funds applied), and outstanding balances are unchanged.
4. Loan with no instalments, or no eligible instalments: entire `payment.amount` becomes `credit_balance_created`; `allocations` is empty.
5. Idempotence of representation: calling the function does not mutate the input `loan` or `payment`; the returned `outstanding_balances` is a fresh representation of the post-state.
6. A component with 0 due is skipped in the sequence with 0 applied and does not block lower-priority components.
7. The tolerance write-off applies at most once per instalment per call, evaluated after that instalment's allocation.

## 9. Decisions carried from stakeholder (summary)

- Component priority within an instalment: fees, then penalties, then interest, then principal.
- Across instalments: oldest first; clear all four components of an instalment in full before touching the next.
- Partial payment: strict sequential fill in priority order; remainder left owing; no proportional split; payment never rejected.
- Overpayment: surplus held as unallocated credit balance, auto-applied when the next instalment falls due, never auto-refunded.
- Currency and rounding: BHD, 3 dp (fils), round-half-up to 3 dp; any rounding residual absorbed into interest, not principal.
- Tolerance write-off: threshold 0.005 BHD, evaluated per instalment on the total remaining across all four components after allocation, triggered only after the normal allocation sequence; residual written off and instalment marked fully paid; not a per-component check.
- Eligibility: only instalments with `due_date` on or before `payment.value_date`; future-dated instalments untouched; surplus becomes credit balance auto-applied when the next instalment falls due.
- Input and output shapes: as given in sections 3 and 4.

## 10. Decisions resolved by the engineer (not stakeholder policy)

These were neither in the brief nor answered by the stakeholder and are resolved here for determinism and completeness. They should be confirmed if they touch policy:

- Tie-break for equal `due_date` among eligible instalments: process in input order (section 5.2).
- The function is pure and does not itself perform the later auto-application of the credit balance; it only reports `credit_balance_created` (sections 1 and 6).
- No pre-existing credit-balance input field is defined; merging any prior credit is the caller's concern (section 6).
- `outstanding_balances` reports all instalments, including unchanged future-dated ones, so the caller holds the full post-state (section 7).
- Negative or malformed inputs (negative amounts, missing fields) are treated as caller errors; validation behaviour is not specified here beyond the non-negative assumptions stated in section 3.

## Auditor verdict

_The spec scores 10/14. It nails the bespoke policy decisions that were captured — bucket order (1), multi-instalment clearing (2), overpayment credit handling (3), BHD 3-dp precision (4), half-up rounding (5), interest-residual destination (6), non-arrears surplus (8), strict fill (9), tolerance write-off (10) and result shape (14). It misses the four decisions tied to value-date accrual and payment sequencing: back-valued interest recompute (7) and penalty accrual on the value date (12) are entirely absent; same-day FIFO ordering (13) is deferred to the caller without stating FIFO; and zero/negative handling (11) diverges — negative validation is explicitly punted and a zero payment records no allocation transaction, contradicting the required zero-value transaction. The gap concentrates on the value-date/accrual cluster (7, 12) and payment-sequencing (11, 13)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | 5.3: "1. Fees 2. Penalties 3. Interest 4. Principal" | Spec states the exact bucket order fees→penalties→interest→principal, matching the reference (fees before penalties, the non-default choice). |
| 2 | yes | **yes** | 5.2: "Eligible instalments are processed oldest first... All four components of the current instalment must be handled in full... before any of the payment touches the next instalment." | Oldest instalment cleared across all four buckets before touching the next matches the reference exactly. |
| 3 | yes | **yes** | 5.6: "the surplus is held as an unallocated credit balance... auto-applied to the next instalment when that instalment falls due... The surplus is never auto-refunded." | Credit-balance held, auto-applied at next instalment, never auto-refunded — all three elements match. |
| 4 | yes | **yes** | 2.1: "The loan currency is Bahraini Dinar (BHD). All monetary amounts are represented and computed to 3 decimal places (fils)." | BHD at 3 dp matches the reference precision exactly. |
| 5 | yes | **yes** | 2.1: "The rounding rule is round-half-up to 3 decimal places." | Round half-up to the minor unit (3 dp) matches the reference. |
| 6 | yes | **yes** | 2.1: "Where a rounding residual arises, it is absorbed into the interest component of the allocation, never into principal." | Residual routed to interest, not principal, matches the reference precisely. |
| 7 | no | no | absent | The spec uses value_date only for instalment eligibility (5.1) and treats *_due as given; it never recomputes/re-accrues interest to an earlier value_date, so the back-valued recompute decision is not addressed. |
| 8 | yes | **yes** | 5.6: "The surplus is not applied to future-dated instalments within this call. It is retained and auto-applied to the next instalment..." and 5.1 leaves future instalments untouched. | An early/non-arrears surplus settles eligible instalments only, becomes a credit balance and does not prepay future principal, so future interest is unchanged — matches the reference. |
| 9 | yes | **yes** | 5.4: "Allocation is strictly sequential, not proportional... funds are never split proportionally across components." | Strict in-order fill with no proportional split matches the reference (one of the more inferable decisions). |
| 10 | yes | **yes** | 5.5: "If that total is greater than 0 and less than or equal to 0.005 BHD, the instalment is treated as fully paid. The residual is written off..." | Tolerance threshold of ≤0.005 BHD on the whole-instalment residual, marking it fully paid, matches the reference exactly. |
| 11 | yes | no | 8.3: "if payment.amount is 0, no allocation occurs, credit_balance_created is 0... outstanding balances are unchanged." 10: "Negative or malformed inputs... are treated as caller errors; validation behaviour is not specified here." | Reference requires negative to be rejected with an error and zero to be a no-op that still records a zero-value allocation transaction; the spec defers negative validation and explicitly produces no allocation entry for zero, so the zero-transaction requirement is not met. |
| 12 | no | no | absent | The spec treats penalties_due as a given input and never accrues penalties up to the value date before allocation, so the accrue-then-allocate decision is not addressed. |
| 13 | no | no | absent | The function handles a single payment; although received_at exists, the spec never specifies FIFO-by-timestamp ordering for multiple same-day payments (it defers scheduling to the caller), so the decision is not resolved. |
| 14 | yes | **yes** | Section 4: allocations with fees/penalties/interest/principal_applied and tolerance_written_off, plus credit_balance_created and outstanding_balances. | Returned shape reports per-bucket amounts applied, resulting outstanding balances, credit_balance created and tolerance_written_off — all four required elements match. |
