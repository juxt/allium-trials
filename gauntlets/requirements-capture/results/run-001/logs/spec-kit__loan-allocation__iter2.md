# spec-kit — loan-allocation — iteration 2

Model (author): claude-opus · Questions asked: 11 · Captured: 10/14 · Bespoke captured: 4/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the question dialog didn't go through. Let me just put these to you in plain text. These are the decisions I can't safely infer, and each is one your institution will have a specific policy on. I've grouped them; answer inline in whatever form is easiest.

**The core waterfall**

1. **Component order.** Within what's owed, in what order does a payment consume the four components? The common servicing order is penalties → fees → interest → principal, but some institutions put fees ahead of penalties, and some service interest and principal before charges. Which is yours?

2. **Instalment traversal.** With several instalments outstanding, do you clear the *oldest instalment in full* (all its components) before moving to the next (row-first), or do you sweep *one component type across every instalment* before the next type, e.g. all penalties everywhere, then all fees everywhere (column-first)? This changes results whenever a payment can't cover everything.

**Boundaries**

3. **Eligible instalments.** May the payment only touch instalments that are due/overdue, or can it flow into not-yet-due future instalments once the due ones are cleared?

4. **Overpayment.** After every eligible component is cleared, what happens to any leftover? Hold as an unapplied credit/suspense balance, prepay future principal, apply to the next future instalment, or report it as a refund due?

5. **Partial payment.** When the money runs out mid-waterfall, I assume the current component is partially paid and everything after it is left untouched, with the instalment simply remaining partly outstanding. Is a partial allocation to a single component acceptable, or must a component be paid all-or-nothing?

**Mechanics**

6. **Rounding and currency.** What's the monetary unit and precision, and how should remainders be handled? For example, are amounts integer minor units (pennies/cents) with no rounding needed, or decimal amounts where I need a rounding rule?

7. **Input validation.** How should the function treat a zero or negative payment, a payment larger than the total owed, or a loan with nothing outstanding? Reject with an error, or handle gracefully (e.g. zero payment produces a no-op allocation)?

Answer what you can and say "default" for any you'd rather I take a sensible standard on. I'll fold your answers into the spec.
A: Answers in order:

1. **Component order.** Fees first, then penalties, then interest, then principal.

2. **Instalment traversal.** Row-first. Clear the oldest instalment in full across all four components before any money moves to the next instalment.

3. **Eligible instalments.** Due and overdue only. Once those are cleared, any remaining funds become a credit balance rather than flowing into future instalments.

4. **Overpayment.** Hold as an unallocated credit balance. Auto-applied when the next instalment falls due. Never auto-refunded.

5. **Partial payment.** Partial allocation to a single component is acceptable. Strict sequential order: fill each bucket as far as the funds allow, leave the remainder of that bucket and everything after it outstanding. No proportional splitting.

6. **Rounding and currency.** Loan is denominated in BHD (Bahraini dinar), 3 decimal places (fils). Round half-up to 3 dp. Any rounding residual is absorbed into the interest component.

7. **Input validation.** Negative payment: reject with an error. Zero payment: accept as a no-op but still record a zero-value allocation transaction. Overpayment: handled per item 4 above. Loan with nothing outstanding: [default, not policy] — treat as a zero-amount no-op.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Done. The specification is saved at `spec.md` in this directory.

It captures the seven policy decisions you gave me as hard requirements, not defaults:

- **Component order** fees → penalties → interest → principal, strict fill, no proportional splitting (FR-001 to FR-003).
- **Row-first traversal**, oldest instalment cleared in full before the next (FR-004, FR-005).
- **Due and overdue only**, leftover to credit, no flow into future instalments (FR-006, FR-007).
- **Credit held, auto-applied later, never auto-refunded**, with the falls-due application marked out of scope (FR-008).
- **BHD to three decimals, round half-up, residual into interest** (FR-011, FR-012).
- **Negative rejected, zero a recorded no-op** (FR-009, FR-010).

Two things to flag for your sign-off:

1. **The one conflict I raised** (A-1): a positive payment on a loan with nothing due. I've resolved it toward your credit-balance policy (the whole amount becomes credit), since a strict no-op there would contradict FR-007. If you'd rather reject or refund that case, it's a one-line change.

2. **Three smaller gaps I closed with documented assumptions** rather than guessing silently: how existing credit interacts with a new payment (A-2), the tiebreak when two instalments share a due date (A-3), and which instalment's interest absorbs a rounding residual (A-4). All are marked "confirm" in the Assumptions section.

The spec is ready for your review. Once you've confirmed A-1 through A-4, it's ready for `/speckit-plan`. Note I saved it to this directory as you asked rather than the SpecKit `specs/<nnn>-name/` convention.
A: A-1 confirmed: a positive payment on a loan with nothing due becomes a credit balance in full. Your resolution is correct per policy.

A-2, A-3, A-4 are not covered by policy, so your documented assumptions stand as defaults:

- A-2 [default, not policy]: existing credit is consumed first, before the incoming payment amount is applied.
- A-3 [default, not policy]: where two instalments share a due date, break the tie by instalment sequence number ascending.
- A-4 [default, not policy]: the rounding residual is absorbed into the interest bucket of whichever instalment is being allocated against at the moment the residual arises.

All four confirmed. Proceed.

### Round 3
_Step reasoning:_ (live agent turn)

Q: All four confirmations are folded in. The spec at `spec.md` is now stakeholder-confirmed and internally consistent.

What changed since the last draft:

- **A-1** is now recorded as firm policy: a positive payment on a loan with nothing due becomes a full credit balance.
- **A-2 reversed my earlier assumption**, so I promoted it to a requirement. FR-008a now says an existing credit balance is consumed *first*, ahead of the incoming payment, through the same waterfall. I added acceptance scenario 8 to pin the behaviour, and updated the conservation rule (FR-016) and its success criterion to `applied + ending credit = payment + starting credit`. I also clarified FR-010 so a zero payment stays a full no-op and does not sweep existing credit, and separated this payment-time consumption from the falls-due auto-application in the out-of-scope section.
- **A-3** (tiebreak by instalment sequence number ascending) and **A-4** (residual into the interest bucket of the instalment being allocated against) are recorded as accepted defaults, wired into FR-004 and FR-012.

The specification is complete and ready for `/speckit-plan`.
A: Confirmed and noted. Specification accepted as complete.

## Produced specification

# Feature specification: payment allocation

**Feature**: Payment allocation across outstanding loan instalments
**Interface**: `allocate_payment(payment, loan)`
**Created**: 2026-09-28
**Status**: Confirmed by stakeholder, ready for planning

## Summary

When a borrower makes a payment, the money must be applied across what they currently
owe on the loan. A loan can carry several outstanding instalments, and each instalment
has four balance components: penalties, fees, interest and principal. This feature defines
a single function, `allocate_payment(payment, loan)`, that decides how one payment is
distributed across those instalments and components, returns a breakdown of what was
applied, and returns the loan's updated balances. Any money that cannot be applied to a
due or overdue obligation is held as a credit balance on the loan.

The allocation policy below is specific to this institution. It was established with the
product stakeholder and is not a set of defaults.

## User scenarios and testing

### Primary flow

A borrower with two overdue instalments makes a payment that is smaller than the total
owed. The function walks the oldest instalment first, fills its fees, then penalties, then
interest, then principal as far as the money allows, and stops the moment the money runs
out. Whatever component the money stops on is left partly paid, and every component and
instalment after it stays outstanding. The function returns which amounts landed where and
the resulting balances.

### Acceptance scenarios

1. **Exact settlement of one instalment.** Given a single overdue instalment with fees 5,
   penalties 3, interest 10 and principal 100 (BHD), when a payment of 118.000 is applied,
   then all four components are cleared to zero and no credit balance remains.

2. **Partial payment stops mid-component.** Given one overdue instalment with fees 5.000,
   penalties 3.000, interest 10.000 and principal 100.000, when a payment of 12.000 is
   applied, then fees are cleared (5.000), penalties are cleared (3.000), interest receives
   4.000 and is left with 6.000 outstanding, and principal is untouched at 100.000.

3. **Oldest instalment cleared before the next is touched.** Given two overdue instalments,
   the older owing 20.000 in total and the newer owing 50.000, when a payment of 30.000 is
   applied, then the older instalment is fully cleared and 10.000 is applied to the newer
   instalment following the same component order, with the newer instalment left partly
   outstanding.

4. **Overpayment becomes credit.** Given total due and overdue obligations of 40.000, when
   a payment of 60.000 is applied, then all due and overdue components are cleared and
   20.000 is recorded as an unallocated credit balance on the loan. Nothing flows into
   future not-yet-due instalments and nothing is refunded.

5. **Future instalments are out of scope.** Given one overdue instalment owing 15.000 and a
   future not-yet-due instalment owing 100.000, when a payment of 25.000 is applied, then
   the overdue instalment is cleared and the remaining 10.000 becomes a credit balance. The
   future instalment is not reduced.

6. **Zero payment is a recorded no-op.** Given any loan, when a payment of 0.000 is applied,
   then no balances change and an allocation record is still produced showing zero applied
   to every component.

7. **Negative payment is rejected.** Given any loan, when a payment below zero is supplied,
   then the function raises an error and no balances change.

8. **Existing credit is consumed first.** Given a loan with a starting credit balance of
   10.000 and one overdue instalment owing 25.000 in total, when a payment of 20.000 is
   applied, then the 10.000 credit is drawn first and the 20.000 payment second, clearing the
   instalment (30.000 available against 25.000 owed) and leaving a 5.000 credit balance.

### Edge cases

- **Money runs out exactly at a component boundary.** Allocation stops cleanly; the next
  component and every later obligation stay outstanding.
- **A component already at zero.** It is skipped and the money moves to the next component
  in order.
- **An instalment with all components at zero.** It is skipped and the money moves to the
  next eligible instalment.
- **Two instalments share the same due date.** Ordering is deterministic (see FR-004).
- **Positive payment on a loan with nothing due or overdue.** The whole payment becomes a
  credit balance (see Assumptions, A-1).
- **A credit balance already present when a new payment arrives.** See Assumptions, A-2.
- **An input value carrying finer precision than fils.** Normalised to 3 decimal places
  (see FR-011).

## Requirements

### Functional requirements

**Component order within an instalment**

- **FR-001**: Within a single instalment, the function MUST apply money to components in this
  strict order: fees first, then penalties, then interest, then principal.
- **FR-002**: The function MUST fill each component as far as the available money allows
  before moving to the next component. Partial allocation to a single component is permitted.
  Proportional or split allocation across components is not permitted.
- **FR-003**: When the available money reaches zero, the function MUST stop. The current
  component keeps any unpaid remainder, and all later components in that instalment stay
  outstanding.

**Instalment traversal**

- **FR-004**: The function MUST process eligible instalments oldest first, ordered by due
  date ascending. Where two eligible instalments share a due date, the order MUST be
  deterministic and stable (see Assumptions, A-3, for the tiebreak).
- **FR-005**: The function MUST fully clear an instalment across all four components, or
  exhaust the available money, before applying any money to the next instalment. Money never
  moves to a later instalment while an earlier eligible instalment has an outstanding
  component and money remains, subject to FR-003.

**Eligibility**

- **FR-006**: Only instalments that are due or overdue as of the allocation reference date
  are eligible to receive money. Not-yet-due instalments MUST NOT be reduced by this function.
- **FR-007**: After all eligible instalments are cleared, any remaining money MUST be held as
  an unallocated credit balance on the loan. It MUST NOT flow into future not-yet-due
  instalments within this function, and it MUST NOT be auto-refunded.

**Credit balance**

- **FR-008**: The credit balance is an output of allocation and a stored property of the
  loan. Its automatic application when the next instalment falls due is a separate scheduled
  process and is out of scope for this function (see Out of scope). This is distinct from the
  payment-time consumption of existing credit in FR-008a.
- **FR-008a**: When an allocation runs against a positive payment, any credit balance already
  present on the loan MUST be consumed first, ahead of the incoming payment, against the due
  and overdue obligations. The effective pool of money is the existing credit balance followed
  by the incoming payment, drawn in that order through the same waterfall (FR-001 to FR-006).
  Any amount left after all eligible obligations are cleared becomes the new credit balance.

**Payment validation**

- **FR-009**: A negative payment MUST be rejected with an error, and no balances change.
- **FR-010**: A zero payment MUST be accepted as a full no-op. No balances change, including
  no consumption of any existing credit balance, and the function MUST still return an
  allocation record showing zero applied to every component (a recorded zero-value allocation
  transaction). The credit-first consumption in FR-008a applies only to a positive payment.

**Currency and rounding**

- **FR-011**: All monetary amounts are denominated in Bahraini dinar (BHD) to three decimal
  places (fils). Any input or intermediate value carrying finer precision MUST be rounded to
  three decimal places using round half-up.
- **FR-012**: Any residual arising from rounding MUST be absorbed into the interest component
  (see Assumptions, A-4, for which instalment's interest absorbs it).

**Outputs**

- **FR-013**: The function MUST return a breakdown of how the payment was applied, itemised
  by instalment and by component (fees, penalties, interest, principal).
- **FR-014**: The function MUST return the loan's updated balances: the remaining balance of
  each component of each instalment, and the resulting credit balance.
- **FR-015**: Every invocation MUST produce an allocation transaction record, including the
  zero-payment no-op case (FR-010).
- **FR-016**: Money is conserved. The sum of all amounts applied across every instalment and
  component, plus the ending credit balance, MUST equal the accepted payment plus the starting
  credit balance. No money is created or lost in allocation.

### Key entities

- **Loan**: The borrower's obligation. Holds an ordered set of instalments and a credit
  balance. Denominated in BHD to three decimal places.
- **Instalment**: A scheduled obligation with a due date and four balance components. Is
  eligible for allocation once due or overdue.
- **Component**: One of fees, penalties, interest or principal. Carries an outstanding
  amount that allocation reduces.
- **Payment**: A single incoming amount to be allocated. Non-negative.
- **Credit balance**: Money held on the loan that could not be applied to a due or overdue
  obligation. Consumed first when the next positive payment is allocated (FR-008a), also
  auto-applied by a separate falls-due process, never auto-refunded.
- **Allocation record**: The itemised result of one allocation: amounts applied per
  instalment and component, updated balances, and resulting credit balance. Produced on
  every invocation.

## Success criteria

- **SC-001**: For any accepted payment, applied amounts plus the ending credit balance equal
  the payment plus the starting credit balance exactly, verified to the fils (FR-016).
- **SC-002**: Given the same loan state and payment, allocation produces identical results on
  every run, including instalment ordering (determinism).
- **SC-003**: No due or overdue component is skipped while an earlier component in the fixed
  order (fees, penalties, interest, principal) of the same instalment remains outstanding and
  money is available.
- **SC-004**: No future not-yet-due instalment is ever reduced by this function.
- **SC-005**: A negative payment always leaves the loan unchanged and signals an error; a
  zero payment always leaves the loan unchanged and still yields an allocation record.
- **SC-006**: All returned balances and applied amounts are expressed to exactly three
  decimal places.

## Assumptions

All four items raised in the previous draft have been confirmed by the stakeholder. A-1 is
firm policy. A-2, A-3 and A-4 are accepted institutional defaults rather than policy, and are
recorded here so a later policy decision can revisit them.

- **A-1 (policy, confirmed)**: A positive payment on a loan with no due or overdue obligation
  is applied in full to the credit balance, consistent with the overpayment policy (FR-007).
  Only a zero payment is a true no-op.
- **A-2 (default, confirmed)**: A credit balance already present on the loan is consumed
  first, ahead of the incoming payment, against due and overdue obligations. This is now a
  requirement (FR-008a), not merely an assumption. Distinct from the separate falls-due
  auto-application process (Out of scope).
- **A-3 (default, confirmed)**: Where two eligible instalments share a due date, they are
  ordered by instalment sequence number ascending (FR-004).
- **A-4 (default, confirmed)**: A rounding residual is absorbed into the interest component of
  whichever instalment is being allocated against at the moment the residual arises (FR-012).
  Because inputs at fils granularity produce no sub-fils precision under subtraction, this rule
  only takes effect when an input or an externally computed value (for example accrued
  interest) carries finer precision.
- **A-5**: The allocation reference date used to decide which instalments are due or overdue
  is supplied by or available to the function (for example the processing date). Its source
  is an integration detail and does not change the policy.
- **A-6**: "Due or overdue" means the instalment's due date is on or before the reference
  date. Instalments with a future due date are not yet due.

## Out of scope

- The scheduled auto-application of a credit balance when a future instalment later falls due.
  This is a separate process. Note this is distinct from FR-008a, which consumes any existing
  credit at the moment a positive payment is allocated and is in scope.
- Refunds of any kind. Credit is never auto-refunded (FR-007).
- Accrual or calculation of interest, fees or penalties. This function allocates against
  balances that already exist on the loan.
- Reversal or reallocation of a prior payment.
- Distribution of a payment across more than one loan.


## Auditor verdict

_The spec covers 9 of 14 reference decisions correctly (1-6, 8, 9, 11, 14 — that is 10 correct). Missing: back-valued payment/value-date re-accrual (#7), write-off tolerance (#10), penalty accrual on allocation date (#12), and same-day multiple payments FIFO (#13) — all unaddressed, largely because interest accrual is placed out of scope. The bespoke policy decisions (bucket order, credit-balance overpayment, BHD 3 dp, half-up, interest-residual) were all elicited correctly, but the accrual-linked decisions (#7, #12) and the tolerance/same-day decisions (#10, #13) were missed._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | FR-001: 'apply money to components in this strict order: fees first, then penalties, then interest, then principal.' | Spec states fees → penalties → interest → principal exactly, matching the reference (fees before penalties). |
| 2 | yes | **yes** | FR-005: 'MUST fully clear an instalment across all four components, or exhaust the available money, before applying any money to the next instalment'; acceptance scenario 3. | Oldest instalment cleared in full across all buckets before touching the next, matching the reference. |
| 3 | yes | **yes** | FR-007: remaining money 'MUST be held as an unallocated credit balance... MUST NOT be auto-refunded'; Credit balance entity: 'auto-applied by a separate falls-due process, never auto-refunded.' | Surplus held as unallocated credit, auto-applied when next instalment falls due, never refunded — matches reference exactly. |
| 4 | yes | **yes** | FR-011: 'denominated in Bahraini dinar (BHD) to three decimal places (fils).' | Spec specifies BHD 3 dp, matching the reference currency minor unit. |
| 5 | yes | **yes** | FR-011: 'MUST be rounded to three decimal places using round half-up.' | Round half-up to 3 dp matches the reference rounding method. |
| 6 | yes | **yes** | FR-012: 'Any residual arising from rounding MUST be absorbed into the interest component.' | Rounding residual absorbed into interest, matching the reference destination. |
| 7 | no | no | absent | No mention of back-valued payments or recomputing interest to an earlier value_date; 'Accrual or calculation of interest' is explicitly out of scope, so this decision is not surfaced. |
| 8 | yes | **yes** | FR-006/FR-007 and scenario 5: overdue cleared, surplus becomes credit, 'The future instalment is not reduced'; Out of scope: 'Accrual or calculation of interest... allocates against balances that already exist.' | Surplus on an on-time/early payment becomes credit and does not prepay principal or reduce future instalments, so future interest is unchanged — matches the reference. |
| 9 | yes | **yes** | FR-002: 'Proportional or split allocation across components is not permitted'; fill each component in order. | Strict in-order fill with no proportional split matches the reference (an inferable decision). |
| 10 | no | no | absent | No write-off tolerance appears; the spec has no ≤ 0.005 BHD forgiveness rule. The rounding residual rule (FR-012) is distinct from tolerance write-off, so this decision is not addressed. |
| 11 | yes | **yes** | FR-009: 'A negative payment MUST be rejected with an error'; FR-010: 'A zero payment MUST be accepted as a full no-op... still return an allocation record showing zero applied... (a recorded zero-value allocation transaction).' | Negative rejected with error; zero is a no-op that still records a zero-value allocation transaction — matches the reference exactly. |
| 12 | no | no | absent | The spec explicitly puts accrual out of scope and never states that penalties accrue up to/including the value date before allocation runs on post-accrual balances. Not surfaced. |
| 13 | no | no | absent | The spec handles a single payment and never addresses multiple same-day payments or FIFO-by-timestamp ordering; not surfaced. |
| 14 | yes | **yes** | FR-013/FR-014 and Allocation record entity: 'amounts applied per instalment and component, updated balances, and resulting credit balance.' | Return shape includes per-bucket amounts applied, resulting outstanding balances, and credit_balance. Tolerance_written_off is absent (no tolerance exists), but the reference result shape requires it only when applicable; the core shape matches, though the tolerance field is not present. |
