# prose — loan-allocation — iteration 2

Model (author): claude-opus · Questions asked: 10 · Captured: 13/14 · Bespoke captured: 7/8

## Conversation

### Round 1
_Step reasoning:_ The brief omits every material allocation policy (component/instalment ordering, overpayment and partial handling, rounding, and I/O shape); these cannot be reliably inferred, so I ask before writing the spec.

Q: Allocation order: when a payment is applied, in what priority are the four components (penalties, fees, interest, principal) paid, and across multiple outstanding instalments, do you exhaust one instalment fully before moving to the next, or pay the same component across all instalments first (e.g. all penalties, then all fees)? Please state the exact ordering.
A: Component order within each instalment: fees → penalties → interest → principal. The strategy is per-instalment, not global: exhaust all four buckets of one instalment in full before any money touches the next.

Q: Instalment sequencing: are outstanding instalments paid oldest-first (by due date), or is there another rule (e.g. by highest penalty)? And within that, is the component order applied per-instalment or globally?
A: Oldest-first by due date. Component order (fees → penalties → interest → principal) is applied per-instalment — not globally across all instalments simultaneously.

Q: Overpayment: if the payment exceeds everything currently owed across all outstanding instalments, what happens to the surplus? (e.g. reduce future/not-yet-due principal, hold as a credit/unapplied balance, reject, or refund.)
A: Surplus is held as an unallocated credit balance. It is auto-applied to the next instalment when that instalment falls due. It is never auto-refunded.

Q: Underpayment / partial component: if the payment is smaller than a given component, do you apply it partially to that component (reducing the balance by the paid amount), or must a component be paid in full before any is applied? Confirm partial application is allowed.
A: Partial application is allowed. The rule is strict sequential fill: apply as much as possible to fees, then whatever remains to penalties, then interest, then principal. No proportional split across components.

Q: Rounding and currency: what monetary unit and precision does the function operate in (e.g. integer minor units / cents, or decimals to 2 places), and what rounding rule applies to any computed splits or interest?
A: The loan is denominated in BHD (Bahraini Dinar). All amounts are held and returned to 3 decimal places (fils). Rounding rule: round half-up to 3 dp. Any rounding residual is absorbed into the interest component, not principal.

Q: Inputs and outputs: what is the exact shape of the `payment` and `loan` arguments (fields and types), and what must the returned value contain, i.e. the per-instalment/per-component allocation breakdown AND the updated loan balances? Please specify the expected return structure.
A: [default, not policy] Reasonable shape: payment = { id, loan_id, amount (decimal string to 3 dp), value_date (ISO date), received_at (ISO datetime) }; loan = { id, currency, instalments: [{ id, due_date, outstanding: { fees, penalties, interest, principal } (all decimal strings), status }], credit_balance }. Return: { allocations: [{ instalment_id, applied: { fees, penalties, interest, principal }, outstanding_after: { fees, penalties, interest, principal } }], credit_balance_after, tolerance_written_off (decimal string), allocation_transactions: [...] }.

Q: Validation and edge cases: how should the function handle a zero or negative payment, a payment with more decimal places than allowed, a loan with no outstanding instalments, or an instalment whose components are already zero? (Error, no-op, or specific behaviour.)
A: Negative payment: rejected with an error. Zero payment: accepted as a no-op but a zero-value allocation transaction is still recorded. More decimal places than the minor unit (3 dp): [default, not policy] reject with a validation error before processing. No outstanding instalments (all paid or none exist): [default, not policy] the full amount becomes a credit balance (consistent with overpayment rule). Component already zero: [default, not policy] skip that bucket and move to the next.

Q: Does allocation recompute or affect interest/penalty accrual (e.g. paying down principal changing future interest), or does it operate purely on the balances as presented at call time with no accrual side effects?
A: Penalties accrue up to and including the value_date; allocation then runs on those post-accrual balances. For a back-valued payment (value_date earlier than today), interest is recomputed to that value_date before allocation. Allocation itself does not prepay principal on future instalments and does not alter future interest or penalty accrual on instalments not yet cleared.

### Round 2
_Step reasoning:_ The return shape references a tolerance write-off never established as policy, and the credit-balance auto-apply mechanics need their ordering rules pinned down; both are institution-specific and non-inferable.

Q: Payment tolerance / short-payment write-off: the return structure references `tolerance_written_off`. Is there a policy where an instalment is treated as fully cleared (and a small residual written off) when the shortfall is within a tolerance? If so, what is the threshold (e.g. absolute fils amount or percentage), and does the write-off apply per-instalment or only when the whole loan is otherwise cleared?
A: Yes. The threshold is absolute: if the residual owed on an instalment after allocation is ≤ 0.005 BHD (half a fils), the instalment is marked fully paid and that residual is written off. The rule applies per-instalment — it does not require the whole loan to be otherwise cleared.

Q: Credit balance application: when a held credit balance is auto-applied to an instalment as it falls due, does it follow the same component order (fees → penalties → interest → principal) and the same partial-fill rules as a fresh payment? And if multiple instalments fall due simultaneously, is the credit applied oldest-first like a normal payment?
A: The answer key does not specify this. [default, not policy] Credit balance application follows the same rules as a fresh payment: component order fees → penalties → interest → principal, strict sequential fill, partial application allowed. If multiple instalments fall due simultaneously, the credit is applied oldest-first by due date, consistent with normal payment sequencing.

### Round 3 (process signalled done)
_Step reasoning:_ All material policy decisions (component order, instalment sequencing, overpayment credit, partial fill, rounding/residual, tolerance write-off, accrual timing, credit-balance application) are now pinned down; remaining points are defaults, so I have enough to write the spec.

(no questions this round)

## Produced specification

# Requirements Specification: `allocate_payment(payment, loan)`

## 1. Purpose and scope

This specification defines a single pure function, `allocate_payment(payment, loan)`, for a loan servicing system. Given an incoming borrower payment and the current state of a loan, the function determines how the payment money is applied across the loan's outstanding instalments and their component balances, and returns both the allocation breakdown and the loan's updated balances.

The function is deterministic and side-effect free with respect to external state: it computes and returns a result. It does not persist anything, does not schedule future work, and does not alter accrual rules for instalments it does not clear. Any accrual it performs (see §7) is a computation on the inputs to arrive at the balances against which allocation runs, not a mutation of external accrual policy.

## 2. Domain and currency

- The loan is denominated in **BHD (Bahraini Dinar)**.
- The minor unit is the **fils**: **3 decimal places**. All monetary amounts are held, computed and returned to exactly 3 decimal places.
- **Rounding rule:** round **half-up** to 3 dp for any computed split, interest recomputation or accrual figure.
- **Rounding residual absorption:** any residual arising from rounding is absorbed into the **interest** component, never into principal.

Implementations should represent amounts using a decimal type (or scaled integers of fils), not binary floating point, to avoid representation error. Amounts cross the function boundary as decimal strings with 3 dp (see §8).

## 3. The four components and their fixed order

Each outstanding instalment carries four balance buckets:

1. **fees**
2. **penalties**
3. **interest**
4. **principal**

Within any single instalment, money is applied strictly in the order **fees → penalties → interest → principal**. This order is fixed and applies both to a fresh payment and to the auto-application of a held credit balance (§6).

## 4. Allocation algorithm

### 4.1 Instalment sequencing

Outstanding instalments are paid **oldest-first, by `due_date` ascending**. There is no other priority rule (penalty size, balance size and so on are irrelevant to ordering).

### 4.2 Per-instalment, not global

The strategy is **per-instalment**. All four buckets of the oldest instalment are exhausted in full before any money touches the next instalment. The function does not pay "all penalties across all instalments, then all fees" or any other global-by-component scheme.

### 4.3 Strict sequential fill within an instalment

Within an instalment, apply as much of the remaining payment as possible to fees, then whatever remains to penalties, then to interest, then to principal. This is a strict sequential fill:

- **Partial application is allowed.** If the remaining money is less than a bucket's balance, apply all of the remaining money to that bucket, reducing its balance by that amount, and stop (no money remains for later buckets).
- **No proportional split.** Money is never divided proportionally across buckets or across instalments.
- A bucket whose balance is already **zero is skipped**, and the fill moves to the next bucket in order.

### 4.4 Progression

Apply the payment to the oldest instalment per §4.3. If money remains after that instalment is fully satisfied (all four buckets at zero, or cleared under the tolerance rule in §5), move to the next-oldest instalment and repeat. Continue until either the payment is exhausted or all outstanding instalments are satisfied.

### 4.5 Surplus after all instalments satisfied

If money remains after every outstanding instalment is satisfied, the surplus becomes an **unallocated credit balance** (§6). It is added to any pre-existing `credit_balance` and returned as `credit_balance_after`.

## 5. Per-instalment tolerance write-off

After allocation to an instalment, if the **total residual owed on that instalment is ≤ 0.005 BHD (half a fils)**, the instalment is marked **fully paid** and the residual is **written off**.

- The threshold is an **absolute** amount: 0.005 BHD.
- The rule applies **per-instalment**. It does **not** require the rest of the loan to be otherwise cleared.
- The residual amount written off is accumulated across instalments and reported in the return as `tolerance_written_off` (sum of all per-instalment write-offs in this call).
- An instalment cleared under this rule has its `outstanding_after` buckets set to zero and its status set to fully paid.

## 6. Credit balance

### 6.1 Creation

Surplus payment money (§4.5), and any payment received when there are no outstanding instalments (§9), is held as an **unallocated credit balance**. It is **never auto-refunded**.

### 6.2 Auto-application

A held credit balance is **auto-applied to the next instalment when that instalment falls due**. When applied, it follows the **same rules as a fresh payment**:

- component order **fees → penalties → interest → principal**;
- **strict sequential fill** with partial application allowed;
- if multiple instalments fall due simultaneously, the credit is applied **oldest-first by due date**, consistent with normal payment sequencing.

(The trigger for auto-application — an instalment falling due — is outside the scope of a single `allocate_payment` call unless that call's inputs already reflect a due instalment plus a standing credit balance; when they do, the same rules govern.)

## 7. Accrual and value dating

Allocation runs on **post-accrual balances** as at the payment's `value_date`:

- **Penalties accrue up to and including the `value_date`.** Allocation then runs on those post-accrual penalty balances.
- **Back-valued payments:** if `value_date` is earlier than today, **interest is recomputed to that `value_date`** before allocation.
- Allocation itself has **no forward accrual side effects**: it does **not** prepay principal on future instalments, and does **not** alter future interest or penalty accrual on instalments it does not clear.

The rounding residual from any interest recomputation is absorbed into the interest component (§2).

## 8. Input and output shapes

The following shapes are the working contract. Fields marked as policy-driven are fixed by this specification; the overall structure is the agreed reasonable shape.

### 8.1 `payment`

```
payment = {
  id:          string,
  loan_id:     string,
  amount:      string,   // decimal, 3 dp, BHD
  value_date:  string,   // ISO date (YYYY-MM-DD)
  received_at: string    // ISO datetime
}
```

### 8.2 `loan`

```
loan = {
  id:       string,
  currency: string,      // "BHD"
  instalments: [
    {
      id:         string,
      due_date:   string,   // ISO date
      outstanding: {
        fees:      string,   // decimal, 3 dp
        penalties: string,
        interest:  string,
        principal: string
      },
      status:     string
    }
  ],
  credit_balance: string   // decimal, 3 dp
}
```

### 8.3 Return value

```
{
  allocations: [
    {
      instalment_id: string,
      applied: {
        fees:      string,
        penalties: string,
        interest:  string,
        principal: string
      },
      outstanding_after: {
        fees:      string,
        penalties: string,
        interest:  string,
        principal: string
      }
    }
  ],
  credit_balance_after:   string,   // decimal, 3 dp
  tolerance_written_off:  string,   // decimal, 3 dp, sum of per-instalment write-offs
  allocation_transactions: [ ... ]  // ledger records for this call (see §8.4)
}
```

### 8.4 Allocation transactions

The function records `allocation_transactions` describing the movements it made. At minimum this includes, for each instalment touched, the amounts applied per component. A **zero-value allocation transaction is still recorded** for an accepted zero payment (§9). The exact transaction record fields follow the working shape above; every applied movement in `allocations` is reflected as a transaction.

All monetary fields in inputs and outputs are decimal strings to 3 dp.

## 9. Validation and edge cases

- **Negative payment amount:** **rejected with an error.** No allocation is performed.
- **Zero payment amount:** **accepted as a no-op.** No balances change, but a **zero-value allocation transaction is still recorded** and returned.
- **More decimal places than the minor unit (more than 3 dp):** **rejected with a validation error before any processing.** The function does not silently round the input; it rejects it.
- **No outstanding instalments** (all paid, or none exist): the **full payment amount becomes a credit balance** (consistent with the overpayment rule, §4.5 / §6). Added to any existing `credit_balance`.
- **A component already zero:** that bucket is **skipped** and the fill moves to the next bucket in order (§4.3).

Validation (negative amount, excess precision) occurs **before** accrual and allocation. Rejections surface as errors; accepted no-ops return the normal result structure.

## 10. Worked ordering summary (normative recap)

For a fresh payment against a loan with outstanding instalments:

1. Validate: reject negative amount; reject >3 dp precision.
2. Accrue penalties to `value_date`; if back-valued, recompute interest to `value_date`. Absorb rounding residual into interest.
3. Take the payment amount as the money available.
4. For each outstanding instalment in `due_date` ascending order:
   a. Fill fees, then penalties, then interest, then principal, strict sequential, partial allowed, skipping zero buckets.
   b. If the instalment's residual owed is ≤ 0.005 BHD, clear it fully and add the residual to `tolerance_written_off`.
   c. If money remains, proceed to the next instalment; otherwise stop.
5. Any money remaining after all instalments are satisfied is added to the credit balance.
6. Return `allocations`, `credit_balance_after`, `tolerance_written_off`, and `allocation_transactions`.

All arithmetic is in BHD to 3 dp, round half-up, with rounding residuals absorbed into interest.

## 11. Explicit non-goals / out of scope

- The function does not refund credit balances.
- The function does not prepay or reschedule future instalments, nor change their future accrual.
- The function does not persist state; callers are responsible for applying the returned balances and transactions to storage.

## 12. Notes on provenance of decisions

Every policy in this specification is fixed by the stakeholder: BHD/3 dp/round-half-up with interest absorbing the residual; component order fees → penalties → interest → principal; per-instalment strategy; oldest-first sequencing; strict sequential fill with partial application; surplus held as never-auto-refunded credit; ≤ 0.005 BHD per-instalment tolerance write-off; penalty accrual to value_date and interest recomputation for back-valued payments with no forward accrual side effects; and the validation rules for negative, zero and over-precise amounts. Where the stakeholder marked an item as a reasonable default rather than firm policy (input/output shape, over-precision rejection, no-outstanding-instalments credit behaviour, zero-bucket skipping, and credit-balance application following fresh-payment rules), this specification adopts that default as stated and does not substitute any invented alternative.

## Auditor verdict

_The specification correctly resolves 13 of the 14 reference decisions, including all the genuinely bespoke ones (fees-before-penalties order, credit-balance overpayment handling, BHD 3 dp, residual-to-interest, back-valued recompute, no principal prepay, 0.005 BHD tolerance). The single gap is decision 13: same-day multiple-payment ordering (FIFO by receipt timestamp) is never surfaced, since the spec scopes itself to a single payment and its oldest-first rule governs instalments rather than concurrent payments. Coverage = 13/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §3: "Within any single instalment, money is applied strictly in the order fees → penalties → interest → principal." | The spec states the exact non-default order, fees before penalties, matching the reference. |
| 2 | yes | **yes** | §4.1 "oldest-first, by due_date ascending"; §4.2 "All four buckets of the oldest instalment are exhausted in full before any money touches the next instalment." | Oldest instalment cleared across all four buckets before the next, exactly matching the reference strategy. |
| 3 | yes | **yes** | §4.5 surplus "becomes an unallocated credit balance"; §6.1 "never auto-refunded"; §6.2 "auto-applied to the next instalment when that instalment falls due." | Credit balance held, auto-applied to next instalment, never auto-refunded, matching all three reference elements. |
| 4 | yes | **yes** | §2: "denominated in BHD (Bahraini Dinar)... The minor unit is the fils: 3 decimal places." | Currency BHD and 3 dp precision stated exactly. |
| 5 | yes | **yes** | §2: "Rounding rule: round half-up to 3 dp for any computed split." | Round half-up to the minor unit matches the reference. |
| 6 | yes | **yes** | §2: "any residual arising from rounding is absorbed into the interest component, never into principal." | Residual destination is interest, matching the reference. |
| 7 | yes | **yes** | §7: "if value_date is earlier than today, interest is recomputed to that value_date before allocation." | Back-valued payment recomputes interest to the value date, matching the reference. |
| 8 | yes | **yes** | §7: "does not prepay principal on future instalments, and does not alter future interest"; §6 surplus becomes credit balance. | Early surplus goes to credit balance and does not prepay principal, so future interest is unchanged, matching the reference. |
| 9 | yes | **yes** | §4.3: "strict sequential fill... No proportional split. Money is never divided proportionally across buckets." | Strict in-order fill with no proportional split, matching the reference. |
| 10 | yes | **yes** | §5: "if the total residual owed on that instalment is ≤ 0.005 BHD... the instalment is marked fully paid and the residual is written off." | Per-instalment write-off with the exact 0.005 BHD threshold, matching the reference. |
| 11 | yes | **yes** | §9: "Negative payment amount: rejected with an error. Zero payment amount: accepted as a no-op... a zero-value allocation transaction is still recorded." | Negative rejected, zero is a no-op that still records a zero-value transaction, matching both reference elements. |
| 12 | yes | **yes** | §7: "Penalties accrue up to and including the value_date. Allocation then runs on those post-accrual penalty balances." | Penalties accrue to and including value date, then allocation runs on post-accrual balances, matching the reference. |
| 13 | no | no | absent | The spec defines a single-payment function and never addresses how multiple payments received on the same day are ordered; no statement that same-day payments are applied FIFO by receipt timestamp. §6.2 oldest-first refers to instalment sequencing, not multiple payments. |
| 14 | yes | **yes** | §8.3 return has allocations with applied per bucket, outstanding_after per bucket, credit_balance_after, tolerance_written_off. | Return shape reports per-bucket amounts applied, resulting outstanding balances, credit balance and tolerance written off, matching the reference. |
