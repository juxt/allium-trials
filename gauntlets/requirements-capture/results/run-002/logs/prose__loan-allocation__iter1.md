# prose — loan-allocation — iteration 1

Model (author): claude-opus · Questions asked: 8 · Captured: 9/14 · Bespoke captured: 4/8

## Conversation

### Round 1
_Step reasoning:_ The brief omits the allocation waterfall, instalment ordering, overpayment handling, partial-component behaviour and rounding, none of which can be reliably inferred, so I must ask before specifying.

Q: Allocation order across components within an instalment: in what sequence should the payment be applied to penalties, fees, interest and principal (e.g. penalties, then fees, then interest, then principal, or some other order)?
A: Fees first, then penalties, then interest, then principal.

Q: Allocation order across multiple outstanding instalments: should the payment clear the oldest instalment first before moving to the next, or be applied in some other order (e.g. newest first, or proportionally)?
A: Oldest instalment first. Clear it in full before any amount is applied to the next instalment.

Q: Within that ordering, is allocation strictly sequential component-by-component (fully satisfy one component before the next), or is it done per-instalment (fully clear one instalment across all its components before touching the next instalment)?
A: Both apply. Oldest instalment is cleared in full across all its components before the next instalment is touched. Within each instalment, allocation is strictly sequential component-by-component — one component must be fully satisfied before the next receives anything.

Q: Overpayment: if the payment exceeds everything currently owed, what happens to the surplus (refund/return it, hold it as an unapplied credit, apply it to future/not-yet-due principal, or reject the payment)?
A: Surplus is held as an unallocated credit balance and auto-applied to the next instalment when it falls due. It is never auto-refunded and does not prepay future principal.

Q: Partial payment within a component: if the money runs out mid-component, do you apply what remains to partially reduce that component, or is allocation to a component all-or-nothing?
A: Partial reduction. If funds are exhausted mid-component, whatever remains is applied to reduce that component partially. Allocation is strict-sequential, not all-or-nothing per component.

Q: Rounding and currency precision: what unit are amounts in (e.g. cents/minor units as integers, or decimals), and how should any rounding remainders be handled so the allocated amounts reconcile exactly with the payment?
A: Amounts are in BHD (Bahraini dinar) to 3 decimal places (fils). Round half-up to 3 dp. Any rounding residual is absorbed into the interest component so that allocated amounts reconcile exactly with the payment.

### Round 2
_Step reasoning:_ Core allocation mechanics are settled; two material, non-inferable scope questions remain (due-only vs all-outstanding, and handling of any pre-existing credit) before I can specify correctly.

Q: Scope of what a payment can be applied to: should allocation target only instalments that have currently fallen due, or all outstanding instalments on the loan (including not-yet-due ones)? The overpayment answer implies due-only with surplus held as credit, but please confirm.
A: Confirmed: allocation targets only instalments that have currently fallen due. A surplus from overpayment or an early payment on a current instalment is held as a credit balance and auto-applied when the next instalment falls due — it does not reach not-yet-due instalments at allocation time.

Q: Pre-existing credit balance: if the loan already holds an unallocated credit balance when a new payment arrives, how is it treated? Is the existing credit combined with the new payment and allocated together, applied first before the new payment, or left untouched?
A: The answer key does not specify this. [default, not policy] Combine the pre-existing credit balance with the incoming payment and allocate the combined pool together in a single pass, oldest-due instalment first.

### Round 3 (process signalled done)
_Step reasoning:_ All material, non-inferable policy decisions are now pinned down (component order, instalment order, sequential/partial allocation, overpayment credit handling, rounding/residual, due-only scope, pre-existing credit); the last probe already hit a point the answer key leaves to default, signalling diminishing returns, so I'm ready to write the spec.

(no questions this round)

## Produced specification

# Requirements specification — `allocate_payment(payment, loan)`

## 1. Purpose

When a borrower makes a payment against a loan, the money must be applied across what the borrower currently owes. This specification defines `allocate_payment(payment, loan)`: a pure function that computes how a payment is distributed across the loan's outstanding instalments and their components, and returns the resulting updated balances together with a full allocation breakdown.

The function must be deterministic and side-effect free. It takes the payment and the current loan state as input and returns a new loan state plus an allocation record; it does not mutate the inputs.

## 2. Domain model

### 2.1 Loan
A loan holds:
- An ordered set of **instalments**, each with a due date and four owed components.
- An **unallocated credit balance**: money previously received but not yet applied to any instalment (see §6 and §7).

### 2.2 Instalment
Each instalment has:
- A **due date** (used to order instalments and to determine whether it has currently fallen due).
- Four **component balances**, each a non-negative amount currently outstanding:
  1. **Fees**
  2. **Penalties**
  3. **Interest**
  4. **Principal**

An instalment is **outstanding** if any of its four component balances is greater than zero. It is **due** if its due date is on or before the evaluation date (see §5).

### 2.3 Payment
A payment is a single non-negative amount in the loan's currency (see §8). The function also has access to the loan's existing credit balance as part of the loan state.

## 3. Allocation order — the two orderings that apply together

Allocation proceeds strictly in this nested order. Both orderings apply simultaneously:

### 3.1 Across instalments: oldest due first, fully cleared
Instalments that have fallen due are processed in ascending due-date order (oldest first). The oldest due instalment must be cleared **in full across all four of its components** before any amount is applied to the next instalment. Only when an instalment's fees, penalties, interest and principal are all reduced to zero does allocation move to the next instalment.

### 3.2 Within an instalment: strict sequential component order
Within a single instalment, the payment is applied to components strictly sequentially in this fixed order:

1. **Fees**
2. **Penalties**
3. **Interest**
4. **Principal**

One component must be **fully satisfied** (reduced to zero) before the next component in the sequence receives anything. Allocation is not proportional and not all-or-nothing (see §4).

### 3.3 Combined effect
For the oldest due instalment: fully pay fees, then fully pay penalties, then fully pay interest, then fully pay principal. Only once all four are zero, move to the next-oldest due instalment and repeat. Continue until either funds are exhausted or all due instalments are fully cleared.

## 4. Partial allocation within a component

Allocation to a component is a **partial reduction**, not all-or-nothing. If the available funds are exhausted part-way through a component, whatever remains is applied to partially reduce that component's balance, and allocation stops there. The component's remaining balance is reduced by the amount applied; no further components or instalments receive anything.

Example: if 50 remains and the current component owes 80, the component is reduced by 50 to a remaining balance of 30, and allocation ends.

## 5. Scope — what a payment may be applied to

Allocation targets **only instalments that have currently fallen due** as of the evaluation date. Not-yet-due (future) instalments are never touched during allocation.

- The function needs an evaluation/"as-of" date to determine which instalments are due. This date is part of the function's inputs (either carried on the loan state or passed to the function; the implementation must make it an explicit, testable input rather than reading the system clock implicitly).
- Any money remaining after all **due** instalments are fully cleared does **not** flow to not-yet-due instalments. It is held as credit (see §6).
- The payment never prepays future (not-yet-due) principal at allocation time.

## 6. Overpayment and surplus handling

If the combined funds exceed everything currently owed on all due instalments, the surplus is **held as an unallocated credit balance** on the loan. The surplus:
- Is **not** auto-refunded.
- Does **not** prepay future/not-yet-due principal.
- Is **auto-applied to the next instalment when it falls due** (i.e. it is carried forward and allocated at the point the next instalment becomes due, following the same allocation rules in §3 and §4).

The credit balance is a first-class part of the returned loan state.

## 7. Pre-existing credit balance on arrival of a new payment

> **Note on provenance:** The stakeholder's answer key does not specify how a pre-existing credit balance interacts with a new payment. The rule below is an engineering **default**, not a stated institutional policy. It should be confirmed before go-live.

If the loan already holds an unallocated credit balance when a new payment arrives, the pre-existing credit is **combined with the incoming payment** and the combined pool is allocated together in a **single pass**, oldest-due instalment first (per §3). After allocation, any amount of the combined pool left over becomes the new credit balance (per §6).

## 8. Currency, precision and rounding

- Amounts are denominated in **BHD (Bahraini dinar)**, expressed to **3 decimal places** (fils).
- Rounding mode is **round half-up** to 3 decimal places.
- The implementation should represent and compute amounts so that no precision beyond 3 dp leaks into stored balances or the allocation record. (Using integer minor units — fils — internally is the safest representation; if decimals are used they must be rounded half-up to 3 dp at the defined points.)
- **Reconciliation guarantee:** the sum of all amounts allocated to components, plus any surplus added to the credit balance, must exactly equal the total pool allocated (incoming payment plus any pre-existing credit combined per §7). Any rounding residual is **absorbed into the interest component** of the instalment being processed, so that the allocated amounts reconcile exactly with the payment. No residual may be silently dropped or create a discrepancy.

## 9. Function contract

### 9.1 Inputs
- `payment`: a non-negative BHD amount (to 3 dp).
- `loan`: the current loan state, including its ordered instalments (each with due date and the four component balances), its existing unallocated credit balance, and the evaluation/as-of date used to determine which instalments are due.

### 9.2 Output
The function returns, without mutating its inputs:

1. **Allocation breakdown** — how the pool was applied: for each instalment touched, the amount applied to each of fees, penalties, interest and principal (including any rounding residual folded into interest), in processing order.
2. **Updated loan balances** — each instalment's remaining component balances after allocation, and the loan's new unallocated credit balance.

The two must reconcile exactly with the input pool (§8).

### 9.3 Determinism
Given identical inputs (including the as-of date), the function must always produce identical output.

## 10. Edge cases and expected behaviour

- **Zero payment:** a payment of 0 with no pre-existing credit leaves all balances unchanged and allocates nothing.
- **No due instalments:** if no instalment has fallen due, the entire pool (payment plus any pre-existing credit) is held as the new credit balance; no instalment is touched.
- **Nothing owed on due instalments:** if all due instalments are already fully cleared, the entire pool becomes credit.
- **Exact payment:** if the pool exactly equals total owed on due instalments, all due instalments are cleared and the credit balance is zero.
- **Funds exhausted mid-component:** allocation stops at the partially reduced component (§4); all later components and instalments remain unchanged.
- **Component already zero:** a component with a zero balance is skipped (contributes nothing) and allocation proceeds immediately to the next component.
- **Negative inputs:** negative payment amounts or negative component balances are invalid and must be rejected (the function should not attempt allocation on invalid input).

## 11. Worked example

Loan state (as-of date makes instalments A and B due; C is not yet due):
- Instalment A (oldest): fees 2.000, penalties 5.000, interest 10.000, principal 100.000
- Instalment B: fees 1.000, penalties 0.000, interest 8.000, principal 90.000
- Instalment C (not yet due): any balances
- Existing credit balance: 3.000

Incoming payment: 120.000. Combined pool = 120.000 + 3.000 = 123.000.

Allocation (oldest first, fees → penalties → interest → principal, partial reduction, stop when exhausted):
- Instalment A fees 2.000 → paid in full (121.000 left)
- Instalment A penalties 5.000 → paid in full (116.000 left)
- Instalment A interest 10.000 → paid in full (106.000 left)
- Instalment A principal 100.000 → paid in full (6.000 left); instalment A fully cleared
- Instalment B fees 1.000 → paid in full (5.000 left)
- Instalment B penalties 0.000 → skipped
- Instalment B interest 8.000 → only 5.000 remains → interest reduced by 5.000 to remaining 3.000; funds exhausted

Result: instalment A fully cleared; instalment B has fees 0.000, interest 3.000 remaining, principal 90.000 untouched; credit balance 0.000. Instalment C untouched. Allocated amounts sum to 123.000, reconciling exactly with the pool.

## Auditor verdict

_The spec nails the allocation mechanics and currency/rounding cluster: bucket order (1), oldest-first full clearing (2), overpayment credit handling (3), BHD 3dp (4), half-up rounding (5), residual-to-interest (6), no-prepay surplus (8), strict in-order partial fill (9), and largely the result shape (14). It misses the genuinely bespoke value-date decisions (7 back-valued re-accrual, 12 penalty accrual on allocation date), the write-off tolerance (10), and same-day FIFO (13) entirely. Decision 11 is partially addressed — negative rejection correct, but the zero-value allocation-transaction requirement is not met. Coverage: 9/14 correct (1,2,3,4,5,6,8,9,14)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §3.2: '1. Fees 2. Penalties 3. Interest 4. Principal' and §3.3 'fully pay fees, then fully pay penalties, then fully pay interest, then fully pay principal' | The spec explicitly orders fees before penalties before interest before principal, matching the reference exactly including the deliberate fees-before-penalties choice. |
| 2 | yes | **yes** | §3.1: 'The oldest due instalment must be cleared in full across all four of its components before any amount is applied to the next instalment.' | Matches the reference: oldest instalment cleared fully across all buckets before touching the next. |
| 3 | yes | **yes** | §6: surplus 'held as an unallocated credit balance', 'not auto-refunded', 'auto-applied to the next instalment when it falls due' | Matches all three elements of the reference: credit balance, no auto-refund, auto-applied when next instalment falls due. |
| 4 | yes | **yes** | §8: 'Amounts are denominated in BHD (Bahraini dinar), expressed to 3 decimal places (fils).' | Exactly matches the reference: BHD, 3 dp, fils. |
| 5 | yes | **yes** | §8: 'Rounding mode is round half-up to 3 decimal places.' | Exactly matches the reference rounding method (half-up to minor unit). |
| 6 | yes | **yes** | §8: 'Any rounding residual is absorbed into the interest component of the instalment being processed' | Matches the reference: residual goes to interest, not principal. |
| 7 | no | no | absent | The spec requires an explicit as-of/evaluation date input but never addresses a payment carrying an earlier value_date or recomputing/re-accruing interest to that value date. No back-valued payment handling is specified. |
| 8 | yes | **yes** | §5: 'The payment never prepays future (not-yet-due) principal at allocation time.' §6: surplus does 'not prepay future/not-yet-due principal' and is held as credit. | The spec states early/surplus payments settle only due instalments, surplus becomes credit, and future principal is not prepaid — matching the reference (future interest unchanged). |
| 9 | yes | **yes** | §3.2: 'One component must be fully satisfied (reduced to zero) before the next... Allocation is not proportional' and §4 partial-reduction example (50 against 80 owed). | Matches the reference: strict in-order fill, no proportional split, including the sub-first-bucket partial case. |
| 10 | no | no | absent | The spec specifies exact reconciliation and residual-into-interest but never mentions a write-off tolerance (e.g. ≤0.005 BHD) marking a near-complete instalment fully paid. No forgiveness policy is stated. |
| 11 | yes | no | §10: 'Zero payment: a payment of 0... leaves all balances unchanged and allocates nothing.' 'Negative inputs... must be rejected.' | Negative rejection matches, but the zero case diverges: the reference requires a zero-value allocation transaction still be recorded, while the spec says a zero payment 'allocates nothing' and leaves balances unchanged, not recording a zero-value allocation. Strict match fails. |
| 12 | no | no | absent | The spec treats component balances as given inputs and never addresses penalty accrual up to the value date before allocation runs. No accrue-then-allocate rule is specified. |
| 13 | no | no | absent | The spec is a single-payment pure function and never addresses multiple same-day payments or FIFO-by-timestamp ordering between them. |
| 14 | yes | **yes** | §9.2: allocation breakdown of amount applied to each bucket per instalment, updated remaining balances, and 'new unallocated credit balance'; §6 credit balance first-class. | The spec returns per-instalment per-bucket amounts applied, resulting outstanding balances, and the credit balance created. It omits an explicit tolerance_written_off field (consistent with not implementing #10), which is a minor shortfall, but the core required shape is present; marking correct on the balance of the four required elements, with the tolerance field being the only gap. |
