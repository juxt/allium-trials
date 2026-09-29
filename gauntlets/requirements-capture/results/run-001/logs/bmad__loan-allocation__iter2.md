# bmad — loan-allocation — iteration 2

Model (author): claude-opus · Questions asked: 14 · Captured: 11/14 · Bespoke captured: 5/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured question prompt didn't go through. Let me put the same decisions to you directly in prose. These are the policy choices the brief leaves open, and each one changes the algorithm materially, so I'd rather have your answer than guess.

**1. Component order within an instalment.** Each instalment has penalty, fee, interest and principal. In what order does a payment absorb them? The common servicing default is penalties → fees → interest → principal (clear punitive and cost items first, principal last), but interest → principal → fees → penalties is also used where the goal is to shrink the interest-bearing balance early. Which does this institution use?

**2. Movement across instalments.** With several instalments outstanding, does the payment:
   - (a) fully satisfy the oldest instalment (all its components) before touching the next, or
   - (b) clear one component type across *all* instalments before the next (all penalties oldest→newest, then all fees, then all interest, then all principal), or
   - (c) split pro-rata across instalments?

**3. Eligibility.** Does the payment apply only to due/overdue instalments, or can it flow into not-yet-due future instalments once the due ones are cleared?

**4. Overpayment.** If the payment exceeds everything currently owed, what happens to the surplus? Hold it as unapplied credit on the loan, apply it to future principal as a prepayment, refund it, or reject the payment outright?

And four more once those are settled:

**5. Underpayment / partial.** If the payment can't cover even the first component or instalment, do you apply it partially as far as it goes, or is there a minimum (e.g. must at least clear the oldest instalment) below which it's held or rejected?

**6. Rounding and precision.** What currency/precision model, and how is rounding handled so components always reconcile to the total to the cent?

**7. Zero and negative edge cases.** How should a zero payment, a negative payment, or a loan with nothing outstanding be treated?

**8. What the return reports.** Beyond updated balances, does the result need a per-instalment, per-component breakdown of what was applied (an allocation ledger), and any leftover/unapplied amount?

Answer as many as you like in whatever form suits. I'll fold your answers into the spec.
A: 1. **Component order:** Fees first, then penalties, then interest, then principal. Note that fees precede penalties — this is intentional and not a typo.

2. **Movement across instalments:** Option (a). Clear the oldest instalment in full across all its components before any money touches the next oldest. No cross-instalment sweeps by component type; no pro-rata splits.

3. **Eligibility:** Surplus does not flow into not-yet-due future instalments. Once all due and overdue instalments are settled, any remainder is held as an unallocated credit balance and auto-applied when the next instalment falls due.

4. **Overpayment:** Surplus is held as an unallocated credit balance on the loan. It is auto-applied to the next instalment when it falls due. It is never auto-refunded, and it does not prepay principal.

5. **Underpayment / partial:** Apply it as far as it goes in strict bucket order — fees, penalties, interest, principal — within the oldest instalment. No minimum threshold; no hold or rejection on partial amount. The payment is allocated as far as it reaches.

6. **Rounding and precision:** The loan currency is BHD (Bahraini Dinar), which has 3 decimal places (fils). Round half-up to 3 decimal places throughout. Any rounding residual is absorbed into the interest component, not principal.

7. **Zero and negative:** A negative payment amount is rejected outright with an error. A zero payment is a no-op but must still produce a recorded zero-value allocation transaction. A loan with nothing outstanding should be treated the same as an overpayment — the full amount becomes a credit balance.

8. **Return shape:** Yes, a full allocation ledger is required. Per payment, return: the amount applied to each component of each instalment touched, the resulting outstanding balance for each, any credit balance created, and any amount written off under the tolerance rule.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Two of your answers introduce a mechanism that isn't yet defined, so I need to close it before I can write this precisely.

**The tolerance / write-off rule.** Answer 8 says the ledger must report "any amount written off under the tolerance rule," and answer 6 routes rounding residual into interest. But the tolerance rule itself hasn't been specified.

- What triggers a write-off? Presumably when an instalment is left with a tiny residual outstanding balance after allocation (e.g. from rounding), and that residual is at or below some threshold, it's written off so the instalment can close. Is that the intent?
- What is the threshold, in fils? (e.g. 0.005 BHD, or some fixed number of fils.)
- Direction: is the write-off only ever *downward* (forgiving a tiny amount the borrower still owes so the instalment reaches zero), or does it also cover tiny *overpayments*? And which component absorbs the write-off in the ledger?

**Existing credit balance.** When `allocate_payment` runs, the loan may already be carrying an unallocated credit balance from a previous payment. Does this function fold that existing credit into the funds it allocates now (existing credit + new payment, applied together against outstanding instalments), or does it leave existing credit untouched and allocate only the incoming payment? Relatedly, is the auto-application of credit when an instalment "falls due" a responsibility of *this* function, or a separate event outside its scope?

**Rounding residual with no interest.** Residual goes into the interest component, but if the instalment being touched has no interest left to absorb it (interest already zero, or the instalment carries no interest), where does the residual land instead?

**Currency.** Is the incoming `payment` always assumed to be in the loan's currency (BHD), or should the function guard against a currency mismatch and reject it?
A: **Tolerance / write-off rule.** Yes, that is the intent. The trigger is: after allocation, the instalment has a residual outstanding balance (something the borrower still owes) of 0.005 BHD or less — it is written off and the instalment marked fully paid. The direction is downward only: it forgives a tiny shortfall on the borrower's side. It does not cover tiny overpayments; those follow the normal credit-balance path. The component that absorbs the write-off in the ledger is [default, not policy — suggest interest, consistent with the rounding residual rule; flag if you need a policy decision here].

**Existing credit balance.** [default, not policy] Fold the existing credit balance into the funds available for this allocation run — combine it with the incoming payment and allocate the total together against outstanding instalments. Auto-application of credit when a new instalment falls due is a separate event outside the scope of this function.

**Rounding residual with no interest.** [default, not policy] If the interest component of the affected instalment is already zero and cannot absorb the residual, apply it to principal instead. If principal is also zero, absorb it into fees, then penalties — last-available-bucket wins.

**Currency.** [default, not policy] Assume the incoming payment is always in BHD. Guard against a currency mismatch at the function boundary and reject with an error if the payment currency does not match the loan currency.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is done, saved as `spec.md` in the working directory.

It pins down every policy the brief left open, taken from your answers:

- **Component order** fees → penalties → interest → principal (with the fees-before-penalties choice flagged as deliberate).
- **Oldest instalment settled in full** before the next, no sweeps or pro-rata.
- **Due/overdue only**, surplus held as unallocated credit, never prepaying principal or auto-refunding.
- **Partial payments** applied as far as they reach, no minimum.
- **Half-up to 3 dp (fils)**, rounding residual into interest then principal, fees, penalties.
- **Existing credit folded** into available funds; auto-application on falling due kept out of scope.
- **Write-off** of residuals at or below 0.005 BHD, downward only, attributed to interest.
- **Negative rejected, currency mismatch rejected, zero a recorded no-op, nothing-outstanding treated as overpayment.**
- **Full allocation ledger** as the return, plus reconciliation and non-negativity invariants.

Each policy carries a requirement ID, there's a traceability table mapping decisions to requirements, and five worked BHD examples exercise the tricky paths.

Two things to look at rather than take on trust. First, the one interaction I had to resolve myself: a zero payment is a no-op *and* existing credit is normally folded in, which conflict. I ruled that a zero payment does not apply existing credit, and recorded it under Assumptions as **R14** for you to confirm or overturn. Second, I added a tie-break for instalments sharing a due date (lower sequence is older), which you hadn't specified. Both are in the Assumptions section along with the defaults you delegated to me.
A: **R14 confirmed.** A zero payment is a no-op and does not trigger credit application. Folding existing credit into available funds only applies when a non-zero payment is being allocated. R14 stands as written.

**Tie-break accepted.** Lower sequence number as a proxy for age when due dates are equal is a reasonable default. No policy decision on this one, so keep it as an assumption.

### Round 4
_Step reasoning:_ (live agent turn)

Q: Done. `spec.md` is complete and reflects your confirmations.

Both items in the Assumptions section now read as settled: **R14** (zero payment is a no-op, credit folds only on a non-zero payment) is marked confirmed, and the same-date tie-break is recorded as an accepted default rather than an open flag. Nothing in the specification is now awaiting your input.

The finished spec covers the full allocation policy, currency and rounding behaviour, the small-residual write-off rule, every edge case, the ledger return shape, reconciliation and non-negativity invariants, a decision-to-requirement traceability table, and five worked BHD examples.
A: Noted. The specification is complete.

## Produced specification

# Requirements specification: `allocate_payment(payment, loan)`

## Purpose

When a borrower makes a payment against a loan, the money must be applied across what
they currently owe. A loan carries one or more outstanding instalments, and each instalment
is split into four components: fees, penalties, interest and principal. This function decides
how a single payment is distributed across those instalments and components, updates the
loan's balances, and returns a full record of what it did.

The specification fixes every allocation policy the institution has chosen. It is written to
be implementable without further guesswork and testable against worked examples.

## Scope

In scope: the deterministic allocation of one payment against one loan's outstanding
instalments, the resulting balance changes, creation of an unallocated credit balance, the
small-residual write-off rule, and the allocation ledger returned to the caller.

Out of scope: interest accrual and how component balances come to exist; the scheduling of
instalments; the separate event that auto-applies a credit balance when a future instalment
falls due (see [Credit balance](#credit-balance)); refunds; persistence, transaction
identifiers and any concurrency control. These are the responsibility of the surrounding
servicing system.

## Definitions

A **loan** is denominated in a single currency, Bahraini Dinar (BHD), and holds a set of
instalments plus an unallocated **credit balance** (zero or positive).

An **instalment** has a due date and four component balances: **fees**, **penalties**,
**interest** and **principal**. Each component balance is the amount still outstanding on that
component, held to three decimal places (fils).

An instalment is **due or overdue** when its due date is on or before the processing date,
and **outstanding** when the sum of its four component balances is greater than zero. An
instalment is **eligible** for this run when it is both due-or-overdue and outstanding.

The **oldest** instalment is the eligible instalment with the earliest due date. Where two
eligible instalments share a due date, the one with the lower instalment sequence (its
position in the schedule) is treated as older.

A **payment** carries an amount and a currency.

**Processing date** is the servicing date the function evaluates against when deciding which
instalments are due or overdue. The caller supplies it (or it is the current servicing date);
it is not read from wall-clock time inside the allocation logic.

## Interface

```
allocate_payment(payment, loan) -> AllocationResult
```

The function is a pure calculation over the supplied `payment` and `loan` state plus the
processing date. It does not mutate its inputs in place; the updated balances are expressed
through the returned result (an implementation may of course apply them, but the contract is
the returned `AllocationResult`).

## Allocation policy

### Available funds

Let the **available funds** for the run be the incoming payment amount plus any credit
balance already on the loan:

```
F = loan.credit_balance + payment.amount
```

The existing credit balance is folded into the run and allocated together with the new money
(**R7**). The one exception is a zero payment, which is a no-op and does not fold or apply
existing credit (**R14**, and see [Assumptions](#assumptions-recorded)).

### Component order within an instalment

Within any one instalment, funds absorb the components in this strict order:

1. **Fees**
2. **Penalties**
3. **Interest**
4. **Principal**

Fees precede penalties. This is the institution's deliberate choice, not the more common
penalties-first ordering (**R1**).

### Movement across instalments

The oldest eligible instalment is settled in full, across all four of its components in the
order above, before any money touches the next oldest. There are no cross-instalment sweeps
by component type and no pro-rata splitting (**R2**). The function walks eligible instalments
oldest-first, and for each one applies funds component by component until either the
instalment is fully settled or the available funds are exhausted.

### Eligibility and surplus

Only due-or-overdue instalments are eligible. Funds never flow into instalments that are not
yet due, even when money remains after all eligible instalments are settled (**R3**). Any
remainder after the last eligible instalment is settled becomes an unallocated credit balance
on the loan (**R4**). It is not applied to future principal and is never auto-refunded.

### The allocation procedure

```
F = loan.credit_balance + payment.amount        # zero-payment exception: see R14
for instalment in eligible_instalments ordered oldest-first:
    if F <= 0: break
    for component in [fees, penalties, interest, principal]:
        applied = min(F, component.outstanding)
        component.outstanding -= applied
        F -= applied
        record applied in the ledger
    apply the write-off rule to this instalment      # see R9
    mark the instalment paid iff all four components are now zero
loan.credit_balance = F                                # remainder held as credit (R4)
```

A partial payment is simply the case where `F` reaches zero part-way through. It is applied
as far as it reaches, in strict bucket order, with no minimum threshold and no rejection or
hold (**R5**).

## Rounding and precision

All monetary values are BHD held to three decimal places (fils). Rounding is half-up to
three decimal places throughout (**R6**).

The sum of the rounded component allocations for a payment must reconcile exactly to the
funds applied. Where independent rounding of components would otherwise leave a one-fil
discrepancy, that residual is absorbed into the **interest** component of the affected
instalment so the ledger reconciles to the fil (**R6a**). If the interest component cannot
absorb it (already zero), the residual falls to **principal**, then **fees**, then
**penalties**: last available bucket wins (**R6b**).

## Small-residual write-off

After an instalment has been allocated against, it may be left owing a tiny amount, typically
from rounding. When the instalment's total residual outstanding balance is greater than zero
and at or below **0.005 BHD**, that residual is written off and the instalment is marked fully
paid (**R9**).

The rule is downward only. It forgives a small shortfall on the borrower's side. It never
applies to tiny overpayments, which follow the normal credit-balance path (**R10**). In the
ledger the written-off amount is attributed to the **interest** component, consistent with the
rounding-residual rule (**R11**).

A write-off is forgiveness, not money. It reduces the instalment's outstanding balance but is
not funded by the payment and does not appear in the money reconciliation (see
[Invariants](#invariants)).

## Credit balance

Surplus funds are held on the loan as an unallocated credit balance, which is zero or
positive. This function creates or increases that balance when funds remain after all eligible
instalments are settled, and consumes an existing balance by folding it into available funds
at the start of a run (**R7**, **R4**).

The auto-application of a credit balance when a not-yet-due instalment later falls due is a
separate servicing event and is out of scope for this function (**R8**).

## Edge cases

**Negative payment.** A payment with a negative amount is rejected outright with an error. No
balances change and no ledger is produced (**R12**).

**Currency mismatch.** If the payment currency is not the loan currency (BHD), the function
rejects it at the boundary with an error and makes no changes (**R13**).

**Zero payment.** A zero payment is a no-op: no funds are allocated and no existing credit is
folded or applied. It must still produce a recorded allocation transaction with zero applied
to every component and no change to the credit balance (**R14**).

**Nothing outstanding.** A loan with no eligible instalments (nothing due or overdue, or
everything already settled) is treated exactly like an overpayment: the whole incoming payment
becomes a credit balance. The transaction records zero applied to all components and the full
credit created (**R15**).

## Return shape: the allocation ledger

The function returns an `AllocationResult` describing the run in full (**R16**). It contains:

- The payment as received: amount and currency.
- The available funds figure, showing how much came from the incoming payment and how much
  from the existing credit balance folded in.
- A per-instalment breakdown for every instalment the run touched, each giving the instalment
  identifier and, for each of the four components, its opening outstanding balance, the amount
  applied, and its closing outstanding balance.
- For each instalment, any amount written off under the tolerance rule and the component it
  was attributed to, and the instalment's resulting status (open or fully paid).
- The credit balance movement: opening balance, the change this run made, and the closing
  balance.
- Run totals: total applied across all components, total written off, and the amount left
  unapplied and moved to credit.

## Invariants

These must hold for every successful run (**R17**).

**Money reconciliation.** The funds available equal the funds placed somewhere:

```
payment.amount + opening_credit_balance
    == total_applied_to_components + closing_credit_balance
```

Written-off amounts do not appear in this identity; they are forgiveness, not money.

**Per-instalment balance.** For each component of each instalment:

```
closing_outstanding == opening_outstanding - applied - written_off
closing_outstanding >= 0
```

An instalment is marked fully paid if and only if all four of its component balances are zero
after allocation and any write-off.

**Non-negativity.** No component balance and no credit balance is ever negative.

**Determinism.** For the same loan state, payment and processing date, the result is
identical. The function reads no wall-clock time or other ambient state.

## Traceability: policy to requirement

| Policy decision | Requirement |
|---|---|
| Component order: fees, penalties, interest, principal | R1 |
| Oldest instalment settled in full before the next; no sweeps or pro-rata | R2 |
| Only due/overdue eligible; surplus never flows to future instalments | R3 |
| Surplus held as unallocated credit; no prepayment, no auto-refund | R4 |
| Partial payment applied as far as it reaches; no minimum | R5 |
| Half-up rounding to 3 dp; residual into interest, then principal, fees, penalties | R6, R6a, R6b |
| Existing credit folded into available funds | R7 |
| Credit auto-application on falling due is out of scope | R8 |
| Write-off of residual at or below 0.005 BHD, downward only, attributed to interest | R9, R10, R11 |
| Negative payment rejected | R12 |
| Currency mismatch rejected | R13 |
| Zero payment is a recorded no-op | R14 |
| Nothing outstanding treated as overpayment | R15 |
| Full allocation ledger returned | R16 |
| Invariants hold every run | R17 |

## Worked examples

All amounts are BHD to three decimal places. Processing date is 2026-09-28 throughout.

### Example 1: partial payment, oldest-first, bucket order

Two overdue instalments, no existing credit.

- Instalment #1, due 2026-07-01: fees 5.000, penalties 2.500, interest 10.000, principal 100.000.
- Instalment #2, due 2026-08-01: fees 0.000, penalties 0.000, interest 12.000, principal 100.000.

Payment 20.000. Available funds F = 20.000.

Instalment #1 absorbs in order: fees 5.000 (F = 15.000), penalties 2.500 (F = 12.500),
interest 10.000 (F = 2.500), principal 2.500 (F = 0.000). Instalment #1 closes with principal
97.500 still outstanding and is not paid. Instalment #2 is untouched. Credit balance stays
0.000. Total applied 20.000, written off 0.000.

### Example 2: overpayment becomes credit

Only instalment #1 outstanding, total 117.500 (fees 5.000, penalties 2.500, interest 10.000,
principal 100.000). No existing credit. Payment 120.000.

F = 120.000 fully settles instalment #1 (117.500 applied), leaving 2.500. No further eligible
instalments, so the remainder is held as a credit balance of 2.500. Instalment #1 is marked
fully paid.

### Example 3: small-residual write-off

Instalment #1 outstanding is principal 0.004 only, everything else zero. Payment 0.000 is not
this case; instead a prior allocation left 0.004 owing. On the next payment of, say, 0.000
this is untouched, but on any run that reaches this instalment and cannot clear the 0.004, the
residual (0.004, at or below 0.005) is written off and the instalment marked fully paid. The
ledger records a write-off of 0.004 attributed to the interest component. The money
reconciliation is unaffected.

### Example 4: existing credit folded in

Existing credit balance 3.000. One overdue instalment #1: fees 4.000, penalties 0.000,
interest 6.000, principal 50.000. Payment 10.000.

F = 3.000 + 10.000 = 13.000. Instalment #1 absorbs fees 4.000 (F = 9.000), penalties 0.000,
interest 6.000 (F = 3.000), principal 3.000 (F = 0.000). Instalment #1 closes with principal
47.000 outstanding, not paid. Closing credit balance 0.000. The ledger shows available funds
of 13.000 split as 10.000 from the payment and 3.000 from folded credit.

### Example 5: nothing outstanding

No eligible instalments. Payment 25.000. The whole 25.000 becomes a credit balance. The
transaction records zero applied to every component and a credit creation of 25.000.

## Assumptions recorded

These are resolutions I have taken where your answers left a default to me or interacted in a
way worth flagging. Confirm or overturn any of them.

**Zero payment versus credit folding (confirmed).** A zero payment is defined as a no-op, yet
existing credit is normally folded into an allocation run. A zero payment does not fold or
apply existing credit; the no-op wins (**R14**). Folding existing credit into available funds
applies only when a non-zero payment is being allocated. Confirmed by the stakeholder.

**Write-off component attribution.** The write-off is attributed to the interest component in
the ledger, matching the rounding-residual rule, per your suggestion (**R11**).

**Rounding-residual fallback order.** Where interest cannot absorb a residual, it falls to
principal, then fees, then penalties (**R6b**), per your default.

**Currency.** The payment is assumed to be BHD, with a guard at the boundary rejecting any
mismatch (**R13**).

**Ordering of same-dated instalments (accepted default).** Where two eligible instalments
share a due date, the lower instalment sequence is treated as older. Not a policy decision;
accepted by the stakeholder as a reasonable default proxy for age.

**Processing date.** Due and overdue status is judged against a processing date supplied to
the function rather than wall-clock time, to keep allocation deterministic. Confirm the caller
can provide this.

## Open questions

None outstanding on core policy. The items under [Assumptions](#assumptions-recorded) are the
only points awaiting your confirmation.


## Auditor verdict

_The spec correctly resolves 11 of 14 decisions (1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 14), including the genuinely bespoke ones (fees-before-penalties, credit-balance handling, BHD 3 dp, residual-to-interest, no-prepay surplus, 0.005 tolerance). It misses the three tied to accrual timing that it explicitly scoped out: back-valued value_date re-accrual (#7), penalty accrual up to the value date (#12), and same-day FIFO-by-timestamp ordering (#13) are neither surfaced nor resolved. Coverage = 11/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "1. Fees 2. Penalties 3. Interest 4. Principal ... Fees precede penalties. This is the institution's deliberate choice, not the more common penalties-first ordering (R1)." | The spec fixes the exact order fees → penalties → interest → principal and explicitly flags the fees-before-penalties choice, matching the reference verbatim. |
| 2 | yes | **yes** | "The oldest eligible instalment is settled in full, across all four of its components in the order above, before any money touches the next oldest. There are no cross-instalment sweeps by component type and no pro-rata splitting (R2)." | Oldest-first, cleared fully across all four buckets before the next instalment, exactly the reference strategy. |
| 3 | yes | **yes** | "Any remainder ... becomes an unallocated credit balance on the loan (R4). It is not applied to future principal and is never auto-refunded." plus R8 noting auto-application on falling due is a separate event. | Surplus held as credit balance, never auto-refunded, and later auto-applied when a future instalment falls due (acknowledged though scoped out), matching the reference mechanism. |
| 4 | yes | **yes** | "denominated in a single currency, Bahraini Dinar (BHD) ... held to three decimal places (fils)." | Currency is BHD with 3 dp (fils), exactly the reference minor unit. |
| 5 | yes | **yes** | "Rounding is half-up to three decimal places throughout (R6)." | Half-up to the 3 dp minor unit matches the reference rounding method. |
| 6 | yes | **yes** | "that residual is absorbed into the interest component of the affected instalment so the ledger reconciles to the fil (R6a)." | Primary rounding residual destination is the interest component, matching the reference; the R6b fallback adds detail without contradicting it. |
| 7 | no | no | absent — "Out of scope: interest accrual and how component balances come to exist"; processing date is used only to decide due/overdue status. | The spec never addresses a value_date earlier than today or re-accruing interest to it; it explicitly excludes interest accrual, so back-valued recomputation is neither surfaced nor implemented. |
| 8 | yes | **yes** | "Funds never flow into instalments that are not yet due ... (R3). Any remainder ... becomes an unallocated credit balance ... It is not applied to future principal." | An early/on-time payment settles only eligible (due) balances and any surplus becomes credit with no prepayment of principal, so future interest is unchanged, matching the reference. |
| 9 | yes | **yes** | "A partial payment ... is applied as far as it reaches, in strict bucket order ... no pro-rata splitting (R2)" (R5). | Partial payments fill buckets in strict sequence with no proportional split, exactly the reference resolution. |
| 10 | yes | **yes** | "When the instalment's total residual outstanding balance is greater than zero and at or below 0.005 BHD, that residual is written off and the instalment is marked fully paid (R9)." | Write-off tolerance of ≤ 0.005 BHD marking the instalment fully paid matches the reference threshold and effect exactly. |
| 11 | yes | **yes** | "A payment with a negative amount is rejected outright with an error (R12)." and "A zero payment is a no-op ... It must still produce a recorded allocation transaction with zero applied to every component (R14)." | Negative rejected with error, zero a no-op that still records a zero-value allocation transaction, matching the reference on both counts. |
| 12 | no | no | absent — "Out of scope: interest accrual and how component balances come to exist"; penalties accrual on the value date is not addressed. | The spec takes component balances as given and excludes accrual, so it never states penalties accrue up to and including the value date before allocation. |
| 13 | no | no | absent — the spec covers a single payment and excludes "concurrency control"; no FIFO-by-timestamp ordering of same-day payments is stated. | Although the function processes one payment at a time, the spec never specifies that multiple same-day payments are ordered FIFO by receipt timestamp, so the reference decision is not surfaced or resolved. |
| 14 | yes | **yes** | "A per-instalment breakdown ... for each of the four components, its opening outstanding balance, the amount applied, and its closing outstanding balance ... any amount written off ... The credit balance movement ... (R16)." | The returned AllocationResult includes per-bucket applied amounts per instalment, resulting outstanding balances, credit balance created, and tolerance written off, covering every element the reference requires. |
