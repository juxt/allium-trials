# superpowers — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 6 · Captured: 8/14 · Bespoke captured: 3/8

## Conversation

### Round 1
_Step reasoning:_ This is architectural work with underspecified policy; the brainstorming process requires asking clarifying questions one at a time, starting with the most material unknown, which is the allocation order (the core of how a payment is applied).

Q: When a borrower's payment is applied, in what order should it be consumed across the outstanding amounts, both across the multiple outstanding instalments (e.g. oldest instalment first?) and across the components within an instalment (penalties, then fees, then interest, then principal, or some other waterfall)?
A: Apply to the oldest overdue instalment in full before any funds touch the next. Within each instalment the waterfall is: fees, then penalties, then interest, then principal.

### Round 2
_Step reasoning:_ Ordering is settled; the next material, uninferable policy is how to handle an overpayment that exceeds total outstanding, so I ask that one question and keep the process open.

Q: When a payment is larger than everything currently outstanding on the loan (all instalments fully cleared), what should happen to the excess: held as an unapplied credit on the loan, applied forward to reduce future/not-yet-due principal, or returned/refused so the function only ever consumes up to the amount owed?
A: The surplus is held as an unallocated credit balance on the loan and auto-applied to the next instalment when it falls due. It is never auto-refunded and does not prepay future principal.

### Round 3
_Step reasoning:_ Order and surplus are settled, but underpayment/partial-allocation behaviour within an instalment is still undetermined and cannot be safely inferred, so I ask before considering the requirements complete.

Q: When a payment is smaller than the oldest overdue instalment's total, how should it behave: flow partially down that instalment's waterfall (fees, then penalties, then interest, then principal) leaving the rest outstanding, or only be applied once it's enough to clear a whole component or the whole instalment? And in a partial case, does the instalment stay 'overdue/open' with its remaining components carried forward unchanged?
A: Apply the payment strictly in waterfall order within the instalment — fees first, then penalties, then interest, then principal — filling each bucket as far as the funds allow before moving to the next. There is no minimum-to-clear-a-component requirement; a partial fill of any bucket is valid. The instalment remains overdue and open, with the unfilled components carried forward at their remaining balances.

### Round 4
_Step reasoning:_ Rounding and monetary precision is a material, institution-specific policy the brief omits and a model cannot safely infer; I'll gather it before considering the process complete.

Q: How should monetary precision and rounding be handled during allocation: are the loan's component balances (fees, penalties, interest, principal) always exact to the minor unit (e.g. whole cents) so allocations never produce fractions, or can a payment be split such that rounding is required, and if so what rule applies (round down each bucket, round to nearest, carry the remainder into the next bucket) and in what unit?
A: The loan currency is BHD, which has 3 decimal places (fils). All component balances and allocated amounts are expressed to 3 dp. Where allocation arithmetic produces a sub-fils remainder, apply round-half-up to 3 dp. Any rounding residual is absorbed into the interest component, not principal.

### Round 5
_Step reasoning:_ Round 2 established a persistent credit balance but not how a subsequent allocation call treats pre-existing credit on entry; this interaction is material and not inferable.

Q: When `allocate_payment` is called on a loan that already carries an unallocated credit balance from a previous overpayment, how should that pre-existing credit interact with the incoming payment: is the credit combined with the new payment and the total allocated together down the waterfall, is the credit applied first (only to instalments that have since fallen due) and then the new payment, or is the standing credit left untouched so this call only allocates the incoming payment?
A: The answer key does not explicitly cover this interaction. A reasonable default consistent with stated policy: the pre-existing credit balance is combined with the incoming payment amount and the combined total is allocated together down the waterfall in the normal sequence — oldest overdue instalment first, fees → penalties → interest → principal within each. This is consistent with the credit being 'auto-applied to the next instalment when it falls due': calling allocate_payment constitutes that application event. The credit is not left untouched, nor applied in a separate prior pass. [default, not policy — confirm if the distinction matters for your implementation]

### Round 6
_Step reasoning:_ All core policies (ordering, surplus, partial fills, rounding, pre-existing credit) are captured, but the boundary between 'overdue' and merely 'outstanding not-yet-due' instalments still governs which buckets the waterfall touches and is not inferable.

Q: When `allocate_payment` runs, which instalments does the waterfall actually consume against: only those that are currently due/overdue, or every outstanding instalment including ones not yet due? Concretely, if the oldest overdue instalment (or all overdue ones) is cleared and money remains, does allocation continue into the next instalment that is outstanding but not yet due, or does it stop and hold the remainder as the unallocated credit balance until that instalment falls due?
A: Allocation runs only against instalments that are currently due or overdue. Once all due/overdue instalments are cleared and money remains, allocation stops and the remainder is held as an unallocated credit balance. It is not applied forward into instalments that are not yet due. Those future instalments remain untouched; the credit is auto-applied when each one falls due.

### Round 7 (process signalled done)
_Step reasoning:_ Six rounds have settled every material, non-inferable policy decision — cross-instalment and within-instalment waterfall, surplus/credit handling, partial fills, BHD rounding and residual placement, pre-existing credit interaction, and due-versus-not-yet-due scope; remaining unknowns are implementation detail, so requirements capture is complete.

(no questions this round)

## Produced specification

# Payment allocation — `allocate_payment(payment, loan)` design specification

## Purpose

When a borrower pays into a loan servicing account, the money must be applied across what they currently owe. This function takes an incoming payment and a loan, applies the payment across the loan's outstanding instalments and their components according to a fixed policy, and returns both how the payment was applied and the loan's updated balances.

The intended outcome is a deterministic, auditable allocation that a loan servicing back office can rely on: given the same payment and the same loan state, the same result every time, expressed exactly to the currency's minor unit.

## Interface

```
allocate_payment(payment, loan) -> allocation_result
```

- `payment` — the incoming payment amount, a monetary value in BHD.
- `loan` — the loan, carrying its outstanding instalments (each with fee, penalty, interest and principal component balances and a due status) and any standing unallocated credit balance.
- `allocation_result` — a record of how the payment (plus any pre-existing credit) was applied down the waterfall, together with the loan's updated component balances, updated instalment statuses, and the updated unallocated credit balance.

The function is pure with respect to policy: it does not decide due dates or accrue interest. It allocates against the loan state as presented at call time.

## Confirmed policy (from stakeholder)

Every rule in this section was settled with the stakeholder and is authoritative.

### 1. Allocation order

**Across instalments:** the oldest overdue instalment is cleared in full before any funds touch the next instalment. Allocation proceeds oldest-first.

**Within an instalment:** funds are applied down a fixed waterfall — fees first, then penalties, then interest, then principal. This order is invariant.

### 2. Which instalments are eligible

Allocation runs only against instalments that are currently due or overdue. Instalments that are not yet due are never consumed by this function. Once all due and overdue instalments are fully cleared and money remains, allocation stops; the remainder is held as unallocated credit (see rule 4). Funds are never applied forward into not-yet-due instalments; those instalments remain untouched until they fall due.

### 3. Partial payments

A payment smaller than the oldest overdue instalment's total flows strictly in waterfall order, filling each bucket as far as the available funds allow before moving to the next bucket. There is no minimum-to-clear threshold: a partial fill of any single component (fee, penalty, interest or principal) is valid.

After a partial payment the instalment remains overdue and open. Its unfilled components are carried forward at their remaining balances, unchanged except for whatever was applied.

### 4. Surplus / overpayment

When a payment exceeds everything currently outstanding on eligible (due/overdue) instalments, the surplus is held as an unallocated credit balance on the loan. This credit:

- is auto-applied to the next instalment when it falls due;
- is never auto-refunded;
- does not prepay future or not-yet-due principal.

### 5. Pre-existing credit balance

When `allocate_payment` is called on a loan that already carries an unallocated credit balance from a previous overpayment, the pre-existing credit is combined with the incoming payment amount, and the combined total is allocated together down the normal waterfall — oldest overdue instalment first, fees then penalties then interest then principal within each. Calling `allocate_payment` constitutes the application event for the standing credit. The credit is not left untouched, and it is not applied in a separate prior pass.

> Note: the stakeholder flagged this as a reasonable default consistent with stated policy rather than an explicit answer-key rule. It is adopted here because it is the only reading consistent with 'credit is auto-applied to the next instalment when it falls due' and with rule 6 (allocation runs against due/overdue instalments only). If the combined-versus-separate distinction later proves material, confirm with the stakeholder.

### 6. Monetary precision and rounding

The loan currency is BHD, which has three decimal places (fils). All component balances, the payment, the credit balance and every allocated amount are expressed to 3 decimal places.

Where allocation arithmetic produces a sub-fils remainder, apply round-half-up to 3 decimal places. Any rounding residual is absorbed into the interest component, never into principal.

## Allocation algorithm

1. Form the allocatable total: incoming `payment` plus the loan's existing unallocated credit balance (rule 5). Set the credit balance to zero for the duration of the pass; it is recomputed at the end from any remainder.
2. Build the ordered list of eligible instalments: those currently due or overdue, oldest first (rules 1, 2).
3. For each eligible instalment in order, while funds remain:
   a. Apply funds down the waterfall fees → penalties → interest → principal (rule 1), filling each component up to its outstanding balance before moving to the next (rule 3).
   b. Each applied amount is computed and recorded to 3 dp using round-half-up; any sub-fils rounding residual is folded into the interest component of that instalment (rule 6).
   c. If the instalment's components all reach zero, it is cleared and marked accordingly; move to the next eligible instalment.
   d. If funds run out mid-instalment, the instalment stays overdue and open with its remaining component balances carried forward; allocation ends (rule 3).
4. When all eligible instalments are cleared and funds remain, stop. The remaining funds become the loan's new unallocated credit balance (rules 2, 4). Do not consume not-yet-due instalments.
5. Return the allocation result.

## Return value

The result must let a caller both post the allocation and reconcile it. It contains:

- **Applied breakdown** — per instalment, the amount applied to each component (fees, penalties, interest, principal), including any rounding residual folded into interest. The total of the breakdown equals the allocatable total minus the ending credit balance.
- **Updated instalment balances and statuses** — each affected instalment's remaining component balances and whether it is cleared or remains overdue/open.
- **Updated unallocated credit balance** — the surplus held after eligible instalments are satisfied (0 if none).
- All monetary figures to 3 dp.

## Error handling

These cases are not covered by stakeholder answers; they are resolved here by the design's own discipline (make the choice explicit, favour the safe conservative behaviour, do not invent policy). They should be confirmed if they matter operationally, but the function needs defined behaviour for each.

- **Zero payment with zero standing credit:** nothing to allocate; return an empty applied breakdown, loan balances unchanged, credit balance unchanged. Not an error.
- **Negative payment:** rejected as invalid input. Allocation only ever consumes non-negative funds; reversals/refunds are out of scope for this function (the confirmed policy is that surplus is never auto-refunded, so this function has no refund path at all).
- **Payment with more than 3 decimal places:** rejected as invalid input rather than silently rounded, so the caller cannot lose money to an implicit rounding they did not see. Callers must present BHD amounts to fils precision.
- **No eligible (due/overdue) instalments but funds present:** the entire allocatable total becomes unallocated credit (consistent with rules 2 and 4). Not an error.
- **Currency other than BHD:** out of scope. This specification and its 3 dp / round-half-up / residual-into-interest rules are defined for BHD only. A multi-currency generalisation would need its own policy decisions and is deliberately not designed here (YAGNI).

## Explicitly out of scope

To keep the function focused, the following are not its responsibility and are not designed here:

- Determining or advancing instalment due dates, and accruing interest, fees or penalties over time. The function allocates against the loan state as presented.
- Refunds or reversals of any kind. Confirmed policy is that surplus is held as credit and never auto-refunded; any refund is a separate, out-of-band operation.
- Prepayment of not-yet-due principal. Confirmed policy forbids it.
- Persistence, transaction logging and audit-trail storage. The function returns the applied breakdown and updated balances; recording them is the caller's concern.

## Testing

The policy is deterministic, so tests assert exact 3 dp outcomes.

- **Waterfall order within an instalment:** a payment that partially fills the waterfall stops at the right bucket (fees, then penalties, then interest, then principal), with earlier buckets full and later buckets untouched.
- **Oldest-first across instalments:** the oldest overdue instalment is fully cleared before the next receives anything.
- **Partial fill:** a payment smaller than a component leaves that component partially filled, the instalment overdue and open, and later components untouched.
- **Exact clearance:** a payment equal to total eligible outstanding clears everything with zero credit.
- **Overpayment:** surplus lands entirely in the unallocated credit balance; no not-yet-due instalment is touched; nothing is refunded.
- **Eligibility boundary:** not-yet-due instalments are never consumed even when funds remain after clearing all due/overdue ones.
- **Pre-existing credit:** a standing credit is combined with the incoming payment and the total is allocated in one waterfall pass, oldest-first.
- **Rounding:** a split that produces a sub-fils remainder rounds half-up to 3 dp and folds the residual into interest, never principal; the applied breakdown still reconciles to the allocatable total exactly.
- **Edge inputs:** zero payment, negative payment (rejected), and sub-fils-precision payment (rejected) behave as specified in Error handling.


## Auditor verdict

_The spec correctly nails the allocation mechanics and BHD precision cluster: bucket order (1), oldest-first (2), overpayment credit (3), 3 dp BHD (4), half-up (5), residual-into-interest (6), early-payment no-prepay (8), and strict partial order (9) — 8/14. It fails the accrual-timing pair (7 back-valued, 12 penalty accrual) by explicitly declaring accrual out of scope, omits the write-off tolerance entirely (10) and its result field (part of 14), does not fully match the zero-payment contract (11, no zero-value transaction recorded), and never addresses same-day FIFO ordering (13). The gap concentrates on the genuinely bespoke value-date and tolerance policies._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Section 'Confirmed policy' rule 1: 'funds are applied down a fixed waterfall — fees first, then penalties, then interest, then principal. This order is invariant.' | Spec states the exact reference order with fees before penalties, matching the deliberately non-default sequence. |
| 2 | yes | **yes** | Rule 1 Across instalments: 'the oldest overdue instalment is cleared in full before any funds touch the next instalment. Allocation proceeds oldest-first.' | Matches 'oldest instalment cleared in full before any money touches the next'. |
| 3 | yes | **yes** | Rule 4: surplus 'is held as an unallocated credit balance... is auto-applied to the next instalment when it falls due; is never auto-refunded'. | All three reference properties (credit balance, auto-apply next instalment, never refund) are stated. |
| 4 | yes | **yes** | Rule 6: 'The loan currency is BHD, which has three decimal places (fils). All component balances... expressed to 3 decimal places.' | Matches BHD 3 dp exactly. |
| 5 | yes | **yes** | Rule 6: 'apply round-half-up to 3 decimal places.' | Matches round half-up to the minor unit. |
| 6 | yes | **yes** | Rule 6: 'Any rounding residual is absorbed into the interest component, never into principal.' | Matches residual-into-interest exactly. |
| 7 | yes | no | Interface: 'it does not decide due dates or accrue interest. It allocates against the loan state as presented at call time.' Out of scope: 'accruing interest, fees or penalties over time.' | The spec addresses accrual but resolves it opposite to the reference: it never recomputes interest to an earlier value_date, and value_date/back-valuation is not handled. Reference requires re-accrual to the value date before allocation. |
| 8 | yes | **yes** | Rule 2: 'Instalments that are not yet due are never consumed'; Rule 4: surplus becomes credit and 'does not prepay future or not-yet-due principal.' | Spec settles only due instalments, sends surplus to credit and forbids principal prepayment, so future interest is unchanged — matches the reference. |
| 9 | yes | **yes** | Rule 3: 'flows strictly in waterfall order, filling each bucket as far as the available funds allow... a partial fill of any single component... is valid.' | Matches strict in-order fill with no proportional split. |
| 10 | no | no | absent (Rule 3 states 'There is no minimum-to-clear threshold'; no write-off tolerance defined). | No write-off tolerance mechanism exists; the spec explicitly disclaims any clear threshold, contradicting the reference's 0.005 BHD tolerance write-off. |
| 11 | yes | no | Error handling: 'Negative payment: rejected as invalid input.' 'Zero payment... return an empty applied breakdown... Not an error.' | Negative-rejection matches, but the reference requires a zero payment to record a zero-value allocation transaction; the spec returns an empty breakdown (and logging is out of scope), so the zero-case resolution differs. Strict match fails. |
| 12 | yes | no | Out of scope: 'accruing interest, fees or penalties over time'; Interface: 'allocates against the loan state as presented at call time.' | Spec explicitly declines to accrue penalties, allocating on presented balances — the opposite of the reference's accrue-to-value-date-then-allocate. |
| 13 | no | no | absent (spec handles a single payment; no same-day multi-payment or FIFO-by-timestamp rule). | FIFO-by-receipt-timestamp ordering of multiple same-day payments is never addressed. |
| 14 | yes | no | Return value: 'Applied breakdown — per instalment, the amount applied to each component... Updated instalment balances and statuses... Updated unallocated credit balance.' | Three of the four reference fields are present (per-bucket applied, outstanding balances, credit_balance), but tolerance_written_off is absent because no write-off tolerance exists, so the shape does not fully match. |
