# aiup — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 11 · Captured: 10/14 · Bespoke captured: 5/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured prompt didn't go through. I'll just ask directly, plainly, so you can answer in your own words. These are the policy decisions the brief leaves open, and each one changes the output materially. I've grouped them.

**A. Allocation structure and order**

1. **Allocation shape.** When a payment spans several outstanding instalments, do you (a) fully satisfy the oldest instalment across all its components before touching the next instalment, *instalment-first waterfall*; or (b) sweep one component type across all instalments first, e.g. every penalty on every instalment, then every fee, then interest, then principal, *component-first*; or (c) some hybrid?

2. **Component order.** Within whatever grouping applies, in what order are the four components paid: penalty → fee → interest → principal, or something else?

3. **Instalment order.** Oldest due date first (arrears first), or another ordering?

**B. Boundaries**

4. **Overpayment.** If the payment exceeds everything currently owed, what happens to the excess: held as an unapplied credit/suspense balance, used to prepay future principal, the payment rejected outright, or the surplus refunded?

5. **Underpayment / partial.** If the payment doesn't cover everything, do you apply it as far as it reaches following the order above (partial allocation), or hold it in suspense until it can clear a whole instalment (or some other unit)?

**C. Mechanics**

6. **Currency and rounding.** What currency/precision (e.g. GBP to the penny, integer minor units)? Can any component carry fractional minor units, and if a rounding remainder appears, where does it go?

7. **Input validation.** How should the function treat a zero or negative payment, a payment against a loan that owes nothing, or a non-finite/oversized amount, reject with an error, or handle silently?

**D. Output shape**

8. The brief says the function returns "how the payment is applied and the loan's updated balances." Do you want a specific return structure, e.g. a per-instalment, per-component breakdown of amounts applied, plus the updated outstanding balances and any leftover/credit? Or is the exact shape my call as long as both halves are present?

Answer whatever you can; anything you leave I'll flag in the spec as an open decision rather than silently guess.
A: Happy to answer each in turn.

**A1. Allocation shape.** Instalment-first waterfall. Clear the oldest instalment in full across all its components before any money touches the next instalment.

**A2. Component order.** Within each instalment: fees first, then penalties, then interest, then principal. Note fees come before penalties.

**A3. Instalment order.** Oldest due date first.

**B4. Overpayment.** Surplus is held as an unallocated credit balance and auto-applied to the next instalment when it falls due. It is never auto-refunded.

**B5. Underpayment / partial.** Apply as far as it reaches following the component order above. Strict sequential fill — no proportional split, no suspense hold.

**C6. Currency and rounding.** The loan is in BHD (Bahraini dinar), which has 3 decimal places (fils). All amounts and rounding to 3 dp, using round-half-up. If a rounding residual appears, it is absorbed into the interest component.

**C7. Input validation.** A negative payment is rejected with an error. A zero payment is a no-op but still records a zero-value allocation transaction. A payment against a loan that owes nothing should produce a credit balance per B4 above.

**D8. Output shape.** A specific structure is required: per payment, return the amount applied to each component bucket of each instalment touched, the resulting outstanding balances, any credit_balance created, and any amount tolerance-written-off.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Two of your answers open a detail the brief hadn't surfaced, and one edge case in your rounding rule. Let me close those, then I'll write the spec.

1. **Tolerance write-off (from D8).** You want the output to report an "amount tolerance-written-off," but no write-off policy has been stated. What's the rule? Typically: after applying a payment, if an instalment's (or the loan's) remaining owed is at or below some threshold, the residual is written off and the instalment treated as settled. I need the threshold (e.g. ≤ 0.010 BHD), what it's measured against (per instalment or whole loan), and when it fires (only when a payment nearly clears the balance, or always at end of allocation).

2. **Existing credit balance on arrival.** When `allocate_payment` runs and the loan already carries a credit balance from a previous overpayment, does this call consume that credit first, effectively adding it to the incoming payment before allocating, or does the credit stay untouched and only the new payment gets allocated?

3. **Rounding residual with no interest present.** Your rule absorbs the rounding residual into interest. If an instalment being touched has no interest component (interest already zero, or the residual arises while filling fees/penalties/principal only), where does the residual go then, principal, or the nearest non-zero component?
A: 1. **Tolerance write-off.** The threshold is ≤ 0.005 BHD. It is measured per instalment. It fires at the end of allocation: after the payment has been applied, if the remaining owed on an instalment is at or below that threshold, the residual is written off and the instalment marked fully paid.

2. **Existing credit balance on arrival.** [default, not policy] The existing credit balance is applied first, effectively added to the incoming payment before allocation begins. The combined amount is then allocated in the normal order.

3. **Rounding residual with no interest present.** [default, not policy] If the interest component is already zero, the residual is absorbed into principal instead.

### Round 3
_Step reasoning:_ (live agent turn)

Q: Done. The specification is saved at `spec.md`.

It captures the eight policy decisions you pinned down, structured as a requirements catalog per the requirements skill (functional requirements as user stories, measurable NFRs, constraints), plus the parts a plain FR/NFR table can't hold: the allocation policy as an ordered set of business rules (BR-1 to BR-9), the output contract, and a worked example that exercises the waterfall and sequential fill.

A few things worth flagging in how I wrote it up:

- **The two you marked `[default, not policy]`** (consume existing credit first; residual to principal when interest is zero) are recorded separately as confirmed defaults under "Assumptions", cross-referenced from the rules, and noted as the only items flagged for future review. I didn't fold them in as if they were institutional policy.
- **Fee-before-penalty** is called out explicitly in FR-003 and BR-4, since it inverts the more common default.
- **Conservation of funds** (NFR-001) makes the money-in-equals-money-out invariant testable, and **exact decimal arithmetic** (NFR-003) guards against the BHD 3-dp rounding being done in binary floating point.

The brief was underspecified by design, so nothing here was inferred: every material rule traces back to one of your answers. The only genuinely open items are A-1 and A-2, both confirmed defaults.
A: Noted. The separation of confirmed defaults from institutional policy is the right call — those two items should stay visible for review. Good to have it done.

## Produced specification

# Payment allocation — requirements specification

## Overview

This specification defines `allocate_payment(payment, loan)`, a pure function in the loan
servicing system. When a borrower pays, the function applies the money across what the loan
currently owes and returns both a breakdown of how the payment was applied and the loan's
updated balances.

A loan carries one or more outstanding instalments. Each instalment has four component
balances: fee, penalty, interest and principal. Allocation follows a fixed policy chosen by
the institution: an instalment-first waterfall, oldest instalment first, filling components
in a fixed order, with defined rules for overpayment, partial payment, rounding and a
small-residual write-off.

The function is called by the servicing system whenever a payment is received. It does not
initiate refunds and does not read or write external state beyond the loan passed to it.

## Interface

```
allocate_payment(payment, loan) -> allocation_result
```

- `payment` — the incoming amount in BHD, plus enough context to record an allocation
  transaction (see FR-012 and the output contract).
- `loan` — the loan, exposing its outstanding instalments (each with due date and the four
  component balances) and any existing unallocated `credit_balance`.
- `allocation_result` — the structure defined in the output contract below.

## Allocation policy (business rules)

These rules are the heart of the specification. They are ordered as the function must apply
them.

**BR-1 Combine incoming payment with existing credit.** Before allocation, any existing
`credit_balance` on the loan is consumed and added to the incoming payment. The combined
amount is what gets allocated. (Confirmed default, see Assumptions A-1.)

**BR-2 Order instalments oldest first.** Outstanding instalments are processed in ascending
due-date order. The oldest is cleared in full before any money touches the next.

**BR-3 Instalment-first waterfall.** All four components of the current instalment are
satisfied before moving to the next instalment. Money never skips ahead to a later
instalment while the current one still owes.

**BR-4 Component order within an instalment: fee, then penalty, then interest, then
principal.** Fees are paid before penalties. Each component receives `min(remaining
available amount, component balance)`, and the available amount is reduced accordingly
before the next component.

**BR-5 Strict sequential fill for partial payments.** If the available amount runs out
mid-instalment, allocation stops there. Whatever has been reached is applied; the rest is
left outstanding. There is no proportional split across components or instalments and no
suspense hold.

**BR-6 Rounding.** All amounts and all intermediate arithmetic are carried to 3 decimal
places (BHD fils), using round-half-up. Any rounding residual is absorbed into the interest
component of the instalment being processed. If that instalment's interest component is
already zero, the residual is absorbed into principal instead. (Interest-first absorption is
policy; the principal fallback is a confirmed default, see Assumptions A-2.)

**BR-7 Tolerance write-off, per instalment, at end of allocation.** After the payment has
been applied, each instalment is checked. If its total remaining owed is at or below
0.005 BHD, that residual is written off and the instalment is marked fully paid. The written
-off amount is reported in the result.

**BR-8 Overpayment to credit balance, never auto-refunded.** Any amount left over after all
instalments are cleared (including write-offs) is held on the loan as an unallocated
`credit_balance`, to be auto-applied to the next instalment when it falls due. The function
never refunds a surplus.

**BR-9 Zero owed produces a credit balance.** A payment against a loan that owes nothing is
not an error. The whole amount becomes `credit_balance` per BR-8.

## Functional requirements

| ID     | Title                                | User Story                                                                                                                                                          | Priority | Status |
|--------|--------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|--------|
| FR-001 | Instalment-first waterfall           | As the loan servicing system, I want each instalment cleared in full across all its components before the next is touched so that older debt is settled first.       | High     | Open   |
| FR-002 | Oldest instalment first              | As the loan servicing system, I want instalments processed in ascending due-date order so that the borrower's earliest arrears are cleared before later ones.        | High     | Open   |
| FR-003 | Component order within an instalment | As a finance controller, I want each instalment paid down as fee, then penalty, then interest, then principal so that charges are recovered before principal.        | High     | Open   |
| FR-004 | Sequential fill on partial payment   | As the loan servicing system, I want an insufficient payment applied strictly in order until it runs out so that allocation is deterministic with no proportional split. | High     | Open   |
| FR-005 | Overpayment held as credit           | As a servicing operations analyst, I want any surplus held as an unallocated credit balance so that it can be auto-applied to the next instalment when it falls due. | High     | Open   |
| FR-006 | Consume existing credit first        | As the loan servicing system, I want any existing credit balance added to the incoming payment before allocation so that held funds are used before new money.       | High     | Open   |
| FR-007 | Tolerance write-off per instalment   | As a finance controller, I want an instalment whose remaining owed is at or below 0.005 BHD written off and marked fully paid so that trivial residuals do not linger. | High     | Open   |
| FR-008 | Rounding to 3 dp, residual to interest | As a finance controller, I want all amounts computed to 3 decimal places round-half-up with any residual absorbed into interest so that totals reconcile to the fil. | High     | Open   |
| FR-009 | Reject negative payment              | As the loan servicing system, I want a negative payment rejected with an error so that funds cannot be withdrawn through allocation.                                 | High     | Open   |
| FR-010 | Zero payment is a recorded no-op     | As a servicing operations analyst, I want a zero payment to apply nothing yet still record a zero-value allocation transaction so that the event is auditable.        | Medium   | Open   |
| FR-011 | Payment against nothing owed         | As the loan servicing system, I want a payment on a fully-settled loan to become a credit balance so that the money is retained rather than rejected.                | Medium   | Open   |
| FR-012 | Detailed allocation result          | As a servicing operations analyst, I want the result to itemise per-component amounts per instalment, updated balances, credit created and amount written off so that every payment is fully traceable. | High     | Open   |

## Output contract

`allocate_payment` returns a structure containing:

- **Per-instalment, per-component allocation.** For each instalment touched, the amount
  applied to each of its fee, penalty, interest and principal buckets.
- **Updated outstanding balances.** The resulting balance of each component of each
  instalment, and the loan's total remaining owed. Instalments cleared by BR-7 are marked
  fully paid.
- **`credit_balance`.** Any unallocated credit created by BR-8 or BR-9 (0 if none).
- **`written_off`.** The total amount written off under the tolerance rule BR-7 (0 if none).
- **Allocation transaction record.** A record of the call, produced for every invocation
  including a zero payment (FR-010).

Instalments not touched by the payment need not appear in the per-instalment allocation, but
the updated balances must reflect the loan's full state.

## Non-functional requirements

| ID      | Title                     | Requirement                                                                                                                                                             | Category        | Priority | Status |
|---------|---------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------|----------|--------|
| NFR-001 | Conservation of funds     | For any call, (sum of all amounts applied) + (credit_balance created) + (written_off) must equal (incoming payment) + (existing credit_balance consumed), exact to 0.001 BHD. | Correctness     | High     | Open   |
| NFR-002 | Determinism               | Identical `payment` and `loan` inputs must always produce an identical result, with no dependence on wall-clock time, iteration order or randomness.                    | Correctness     | High     | Open   |
| NFR-003 | Exact decimal arithmetic  | All monetary values must be represented and computed without binary floating-point error, e.g. as integer fils or a fixed-point/decimal type at 3 dp.                    | Correctness     | High     | Open   |
| NFR-004 | Audit record completeness | Every invocation, including a zero payment and a no-op, must emit exactly one allocation transaction record.                                                             | Auditability    | High     | Open   |
| NFR-005 | Performance               | A single allocation across up to 60 outstanding instalments must complete within 50 ms on the reference servicing runtime.                                              | Performance     | Medium   | Open   |
| NFR-006 | No side effects beyond loan | The function must not mutate global state or perform I/O; it operates only on the supplied inputs and returns the result.                                              | Maintainability | Medium   | Open   |

## Constraints

| ID    | Title                    | Constraint                                                                                                                        | Category  | Priority | Status |
|-------|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------|-----------|----------|--------|
| C-001 | Currency and precision   | The loan is denominated in BHD, which has 3 decimal places (fils). All amounts are held and reported to 3 dp.                      | Technical | High     | Open   |
| C-002 | Rounding mode            | Rounding uses round-half-up at 3 dp wherever a residual arises.                                                                   | Technical | High     | Open   |
| C-003 | Fixed interface          | The public entry point must be `allocate_payment(payment, loan)` returning the result structure defined above.                     | Technical | High     | Open   |
| C-004 | No automatic refund      | The function must never return money to the borrower; surplus is always retained as credit_balance.                               | Business  | High     | Open   |
| C-005 | Write-off threshold      | The per-instalment tolerance write-off threshold is fixed at 0.005 BHD.                                                           | Business  | High     | Open   |

## Assumptions and confirmed defaults

These are decisions confirmed by the stakeholder as sensible defaults rather than stated
institutional policy. They should be revisited if a policy position emerges.

- **A-1 (BR-1).** An existing credit balance is consumed first and added to the incoming
  payment before allocation begins.
- **A-2 (BR-6).** When an instalment's interest component is already zero, a rounding
  residual is absorbed into principal instead of interest.

## Worked example

A loan owes two instalments, both denominated in BHD to 3 dp, with no existing credit
balance. A payment of 100.000 BHD arrives.

| Instalment | Due date   | Fee    | Penalty | Interest | Principal |
|------------|------------|--------|---------|----------|-----------|
| #1 (older) | 2026-07-01 | 5.000  | 10.000  | 20.000   | 40.000    |
| #2         | 2026-08-01 | 2.000  | 4.000   | 15.000   | 60.000    |

Allocation (BR-2, BR-3, BR-4): instalment #1 is cleared first. Fee 5.000, penalty 10.000,
interest 20.000, principal 40.000, total 75.000 applied. Remaining available: 25.000.
Instalment #2 next: fee 2.000, penalty 4.000, interest 15.000, then 4.000 of the 60.000
principal, at which point the payment is exhausted (BR-5).

Result: instalment #1 fully paid; instalment #2 has 56.000 principal outstanding, all other
components zero; `credit_balance` 0.000; `written_off` 0.000. Loan total remaining owed:
56.000 BHD.

## Open questions

None outstanding. Every material policy decision in the brief has been resolved with the
stakeholder. A-1 and A-2 are confirmed defaults and are the only items flagged for future
review.


## Auditor verdict

_The spec resolves 10 of 14 decisions correctly (1-6, 9-11, 14). It misses three that were never surfaced: back-valued payment re-accrual (#7), penalty accrual on the value date (#12), and same-day FIFO ordering (#13). Decision #8 is partially addressed via the shared credit-balance mechanism but fails to state the specific no-prepay/future-interest-unchanged rule for early payments, so it is not counted correct. Coverage = 10/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | BR-4: 'Component order within an instalment: fee, then penalty, then interest, then principal. Fees are paid before penalties.' | Spec states fee → penalty → interest → principal, matching the reference's deliberate fees-before-penalties order exactly. |
| 2 | yes | **yes** | BR-2: 'Outstanding instalments are processed in ascending due-date order. The oldest is cleared in full before any money touches the next.' | Matches 'oldest instalment cleared in full before any money touches the next' precisely, reinforced by BR-3 waterfall. |
| 3 | yes | **yes** | BR-8: 'Any amount left over ... is held on the loan as an unallocated credit_balance, to be auto-applied to the next instalment when it falls due. The function never refunds a surplus.' | Credit balance, auto-applied to next instalment, never refunded — matches all three parts of the reference answer. |
| 4 | yes | **yes** | C-001: 'The loan is denominated in BHD, which has 3 decimal places (fils). All amounts are held and reported to 3 dp.' | BHD, 3 decimal places, fils — exact match to the reference. |
| 5 | yes | **yes** | C-002/BR-6: 'Rounding uses round-half-up at 3 dp wherever a residual arises.' | Round-half-up to the 3 dp minor unit matches the reference rounding method exactly. |
| 6 | yes | **yes** | BR-6: 'Any rounding residual is absorbed into the interest component of the instalment being processed.' | Residual to interest matches the reference. The principal fallback (A-2) is an added edge-case default but does not contradict the reference answer. |
| 7 | no | no | absent | The spec never mentions value_date or re-accruing interest to an earlier value date; back-valued payment recomputation is not addressed anywhere. |
| 8 | yes | no | BR-8: surplus 'held on the loan as an unallocated credit_balance'; worked example and BR rules never distinguish arrears vs on-time or state principal is not prepaid. | Reference requires an explicit statement that an early payment does NOT prepay principal and future interest is unchanged. The spec routes surplus to credit balance (consistent) but never states the no-prepay/future-interest-unchanged rule, so the specific decision is not resolved. |
| 9 | yes | **yes** | BR-5: 'Strict sequential fill ... There is no proportional split across components or instalments.' | Strict in-order fill with no proportional split matches the reference exactly. |
| 10 | yes | **yes** | BR-7/C-005: 'If its total remaining owed is at or below 0.005 BHD, that residual is written off and the instalment is marked fully paid.' | Tolerance threshold of ≤ 0.005 BHD with instalment marked fully paid and residual written off matches the reference precisely. |
| 11 | yes | **yes** | FR-009: 'a negative payment rejected with an error'; FR-010: 'a zero payment to apply nothing yet still record a zero-value allocation transaction'. | Negative rejected with error, zero is a no-op that still records a zero-value allocation transaction — both parts match the reference. |
| 12 | no | no | absent | The spec does not mention penalty accrual on the allocation/value date or the accrue-then-allocate ordering; no rule covers accruing penalties before allocation. |
| 13 | no | no | absent | Same-day multiple payments and FIFO-by-timestamp ordering are never addressed; NFR-002 covers determinism generally but not this ordering policy. |
| 14 | yes | **yes** | Output contract: 'Per-instalment, per-component allocation ... Updated outstanding balances ... credit_balance ... written_off ...' plus FR-012. | Result shape itemises per-bucket amounts per instalment, resulting balances, credit_balance created and written_off — matches all elements of the reference result shape. |
