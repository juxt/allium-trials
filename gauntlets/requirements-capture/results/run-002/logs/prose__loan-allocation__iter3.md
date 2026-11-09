# prose — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 9 · Captured: 10/14 · Bespoke captured: 5/8

## Conversation

### Round 1
_Step reasoning:_ The brief omits several institution-specific policies (inter-instalment order, component priority, over/underpayment handling, rounding, return shape) that cannot be reliably inferred, so I ask before specifying.

Q: Allocation order across instalments: should the payment be applied to the oldest outstanding instalment first (then the next, and so on), or spread proportionally across all outstanding instalments?
A: Oldest outstanding instalment first. The oldest instalment must be cleared in full across all four of its components before any money is applied to the next instalment.

Q: Within a single instalment, in what priority order are the components paid: penalties, fees, interest, then principal? Please confirm the exact sequence the institution uses.
A: Exact sequence: fees first, then penalties, then interest, then principal.

Q: How should an overpayment be handled when the payment exceeds the total currently owed across all instalments: refund the excess, hold it as an unapplied credit on the loan, or apply it to reduce future principal?
A: Hold the surplus as an unallocated credit balance on the loan. It is auto-applied to the next instalment when that instalment falls due. It is never auto-refunded.

Q: How should a partial payment that cannot fully cover a component be treated: allocate as much as possible to the highest-priority component and leave the remainder outstanding, or is there a minimum-payment or all-or-nothing rule per instalment/component?
A: Strict sequential order — allocate as much as possible to the highest-priority component, then move to the next. There is no minimum-payment rule, no all-or-nothing rule per instalment, and no proportional split.

Q: What rounding and currency-precision rules apply (e.g. round to the minor currency unit, and how are sub-unit remainders handled)?
A: Currency is BHD (Bahraini Dinar), 3 decimal places (fils). All amounts are expressed and rounded to 3 dp using round-half-up. Any sub-unit rounding residual is absorbed into the interest component, not principal.

Q: What exactly should the function return, and what balance fields does the loan carry that must be updated (per-component and per-instalment outstanding amounts, plus any loan-level totals)?
A: Return per payment: the amount applied to each component bucket (fees, penalties, interest, principal) for each instalment touched; the resulting outstanding balance per bucket per instalment; any credit_balance created; any tolerance_written_off amount (residuals ≤ 0.005 BHD are written off and the instalment marked fully paid).

### Round 2
_Step reasoning:_ Core allocation policy is settled, but credit-balance interaction, tolerance-write-off scope, and invalid-input handling remain materially ambiguous and institution-specific.

Q: Pre-existing credit balance: when allocate_payment runs on a loan that already carries a credit_balance, is that existing credit combined with the incoming payment and allocated together, applied to the oldest instalment before the new payment, or left untouched? And since the signature allocate_payment(payment, loan) carries no date, does this function itself perform the 'auto-apply on due date' step or is that a separate process?
A: Pre-existing credit_balance is left untouched by allocate_payment. The 'auto-apply on due date' step is a separate process, not performed inside this function. allocate_payment allocates only the incoming payment amount against outstanding instalments; any surplus it generates is added to credit_balance, but it does not consume a pre-existing credit_balance.

Q: Tolerance write-off scope and trigger: is the 0.005 BHD tolerance assessed per instalment (on its total remaining across all four components) or per individual component bucket? And does it trigger only on an instalment the current payment actually touched, or on any instalment whose remaining balance is ≤ 0.005 regardless of whether this payment reached it?
A: The 0.005 BHD tolerance is assessed per instalment on its total remaining balance across all four components combined, not per individual bucket. It triggers only on an instalment the current payment actually touched — not on any arbitrary instalment whose balance happens to be small.

Q: Input validation: how should the function treat a zero payment, a negative payment, or a payment against a loan with no outstanding instalments and no amount due (e.g. error, no-op, or route entirely to credit_balance)?
A: Negative payment: rejected with an error. Zero payment: a no-op that still records a zero-value allocation transaction. Payment against a loan with no outstanding balance and no instalments due: the full amount is held as a credit_balance [default, not policy].

### Round 3 (process signalled done)
_Step reasoning:_ All material, non-inferrable policy decisions (allocation order, component priority, overpayment handling, partial-payment rule, rounding/residual, return shape, pre-existing credit, tolerance scope/trigger, input validation) have been settled; remaining points are implementation detail, so I'm ready to write the spec.

(no questions this round)

## Produced specification

# Requirements specification: `allocate_payment(payment, loan)`

## 1. Purpose and scope

This specifies a single pure function, `allocate_payment(payment, loan)`, for a loan servicing system. Given an incoming payment and a loan carrying one or more outstanding instalments, the function determines how the payment is applied across the loan's outstanding components, computes the loan's updated balances, and returns a complete record of what was applied.

The function allocates **only the incoming payment amount**. It does not run any due-date processing, does not consume any pre-existing credit balance, and does not refund money. Those are the responsibility of other processes.

## 2. Domain model

### 2.1 Loan

A loan carries:
- `instalments`: an ordered collection of outstanding instalments (see 2.2). Order is by age, oldest first.
- `credit_balance`: a non-negative amount of previously unallocated surplus held on the loan. Expressed in BHD to 3 dp.

### 2.2 Instalment

Each instalment carries four outstanding component buckets, each a non-negative amount in BHD to 3 dp:
- `fees`
- `penalties`
- `interest`
- `principal`

An instalment's total remaining balance is the sum of its four buckets. An instalment is "outstanding" when that total is greater than zero. An instalment is marked **fully paid** when its total remaining balance reaches zero (including via tolerance write-off, see 6).

### 2.3 Instalment age ordering

Instalments are processed oldest first. The specification assumes the loan supplies instalments in a stable, deterministic age order (oldest to newest). The function must not reorder beyond relying on this supplied order.

## 3. Currency and rounding

- Currency is **BHD (Bahraini Dinar)**, with **3 decimal places (fils)**.
- All amounts are expressed and rounded to **3 dp using round-half-up**.
- Where a rounding operation produces a sub-unit residual, that residual is **absorbed into the interest component**, never into principal. (See 7 for the precise interaction with allocation.)
- All comparisons and the tolerance test (6) operate on amounts at 3 dp precision.

## 4. Allocation algorithm

### 4.1 Across instalments: strictly oldest-first

The payment is applied to the **oldest outstanding instalment first**. That instalment must be **cleared in full across all four of its components** before any money is applied to the next instalment. Only once an instalment's total remaining balance is zero does allocation move to the next-oldest instalment.

There is no proportional spreading across instalments.

### 4.2 Within an instalment: strict component priority

Within a single instalment, the payment is applied to components in this exact priority sequence:

1. **Fees**
2. **Penalties**
3. **Interest**
4. **Principal**

Each component is settled as fully as the remaining payment allows before moving to the next.

### 4.3 Partial coverage

Allocation is strictly sequential and greedy: apply as much of the remaining payment as possible to the highest-priority unsettled component, then move to the next component (and then the next instalment). When the payment runs out mid-component, that component retains its outstanding remainder and all lower-priority components and later instalments are left untouched.

There is **no minimum-payment rule, no all-or-nothing rule** (per instalment or per component), and **no proportional split**. Any positive payment is applied for whatever it can cover.

### 4.4 Surplus (overpayment)

If, after the oldest-first / priority-order allocation has settled every outstanding instalment in full, payment remains, the leftover is **held as an unallocated credit balance** on the loan: it is added to `credit_balance` and reported as `credit_balance` created by this call.

The surplus is **never auto-refunded** by this function. The auto-application of a credit balance to the next instalment when it falls due is a **separate process** and is explicitly out of scope here (see 5).

## 5. Interaction with pre-existing credit balance (out of scope for consumption)

- A pre-existing `credit_balance` on the loan is **left untouched** by `allocate_payment`. The function does **not** combine it with the incoming payment and does **not** consume it to settle instalments.
- The function allocates **only the incoming `payment` amount** against outstanding instalments.
- Any surplus the current payment generates is **added to** `credit_balance`.
- The "auto-apply credit on due date" behaviour is a **separate process** not performed inside this function. The signature carries no date precisely because this function does no date-driven work.

## 6. Tolerance write-off

After allocation, a tolerance rule writes off trivial residuals:

- **Scope:** assessed **per instalment**, on the instalment's **total remaining balance across all four components combined** (not per individual bucket).
- **Threshold:** if an instalment's total remaining balance is **≤ 0.005 BHD**, that residual is written off.
- **Effect:** the residual is recorded as `tolerance_written_off`, the instalment's remaining buckets are reduced to zero, and the instalment is **marked fully paid**.
- **Trigger condition:** the write-off triggers **only on an instalment that the current payment actually touched** (i.e. received some allocation during this call). It does **not** trigger on an arbitrary instalment whose balance merely happens to be ≤ 0.005 but which this payment did not reach.

When multiple instalments are touched by one payment, the tolerance test is applied independently to each touched instalment, and `tolerance_written_off` in the result is the sum of residuals written off.

## 7. Ordering of rounding, allocation, and tolerance

1. Validate the input (see 8).
2. Allocate the incoming payment oldest-first, component-priority within instalment (4.1–4.3), at 3 dp round-half-up precision.
3. Any sub-unit rounding residual arising in the allocation arithmetic is absorbed into the **interest** component, never principal (3).
4. For each instalment the payment touched, apply the per-instalment tolerance write-off (6).
5. Apply any remaining payment surplus to `credit_balance` (4.4).
6. Assemble and return the result (9).

## 8. Input validation

- **Negative payment:** rejected with an **error**. No balances are changed and no transaction is recorded.
- **Zero payment:** a **no-op that still records a zero-value allocation transaction**. The result is returned with all applied amounts zero, no `credit_balance` created, and no `tolerance_written_off`. Balances are unchanged.
- **Payment against a loan with no outstanding balance and no instalments due:** the full payment amount is **held as a `credit_balance`**. (This case was not governed by institutional policy in the stakeholder conversation; it is resolved here as a sensible default consistent with the never-refund, surplus-to-credit rule. Flag for confirmation if policy later requires otherwise.)

## 9. Return value

The function returns a record describing the outcome of this single payment. It contains:

### 9.1 Per instalment touched
For each instalment that received any allocation (or, for the zero-payment case, the transaction record with zero amounts):
- `instalment_id` (or stable reference to the instalment).
- **Amount applied to each component bucket** this call: `applied.fees`, `applied.penalties`, `applied.interest`, `applied.principal`.
- **Resulting outstanding balance per bucket** after this call: `outstanding.fees`, `outstanding.penalties`, `outstanding.interest`, `outstanding.principal`.
- `fully_paid`: whether the instalment is now fully paid (including via tolerance).
- `tolerance_written_off` for that instalment (0 if none).

### 9.2 Loan-level
- `credit_balance_created`: the surplus added to the loan's `credit_balance` by this call (0 if none).
- `credit_balance`: the loan's resulting `credit_balance` (pre-existing credit, which is untouched, plus any created this call).
- `tolerance_written_off`: total residual written off across all instalments touched by this call.

### 9.3 Updated loan state
The loan's per-bucket, per-instalment outstanding amounts and `credit_balance` are updated to the values reported above. Instalments reduced to zero (including by tolerance) are marked fully paid. The pre-existing `credit_balance` component is preserved unchanged except for the addition of any surplus created this call.

All monetary values in the return are BHD at 3 dp, round-half-up.

## 10. Worked rules summary (non-normative)

- Oldest instalment, fully across fees → penalties → interest → principal, before any money reaches the next instalment.
- Greedy partial allocation; no minimums, no all-or-nothing, no proportional split.
- Rounding residuals land in interest, not principal.
- Per-instalment tolerance of 0.005 BHD, on combined remaining, only for instalments this payment touched.
- Surplus to `credit_balance`; never refunded; pre-existing credit never consumed here.
- Negative payment errors; zero payment is a recorded no-op; payment with nothing due goes entirely to credit.

## 11. Explicit non-goals
- Consuming or auto-applying a pre-existing `credit_balance`.
- Any due-date or calendar-driven processing.
- Refunds.
- Reordering instalments beyond the age order supplied by the loan.

## Auditor verdict

_The spec correctly nails the bespoke allocation and currency decisions (1-6, 9-11, 14): fees-before-penalties order, oldest-first full clearance, credit-balance surplus handling, BHD 3dp, half-up, residual-to-interest, strict no-proportional, 0.005 tolerance, negative-error/zero-noop, and the full return shape. The gap is entirely date-driven: the spec deliberately excludes all calendar work, so it misses #7 (back-valued re-accrual to value_date), #12 (penalty accrual to value date before allocation), and #13 (same-day FIFO by timestamp). It also fails to surface #8's specific point that an early non-arrears surplus does not prepay principal and leaves future interest unchanged — though its uniform surplus-to-credit rule is consistent with that outcome, it never states the decision. Coverage: 10/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Section 4.2: '1. Fees 2. Penalties 3. Interest 4. Principal'; Section 10: 'fees → penalties → interest → principal' | Spec states the within-instalment priority as fees, penalties, interest, principal, matching the reference order exactly (fees before penalties). |
| 2 | yes | **yes** | Section 4.1: 'That instalment must be cleared in full across all four of its components before any money is applied to the next instalment.' | Spec requires oldest instalment cleared fully across all four buckets before touching the next, matching the reference. |
| 3 | yes | **yes** | Section 4.4: 'held as an unallocated credit balance... never auto-refunded... auto-application... when it falls due is a separate process' | Surplus becomes credit balance, applied automatically next instalment (noted as separate process), never refunded — matches the reference mechanism. |
| 4 | yes | **yes** | Section 3: 'Currency is BHD (Bahraini Dinar), with 3 decimal places (fils).' | Spec specifies BHD at 3 dp, matching the reference exactly. |
| 5 | yes | **yes** | Section 3: 'All amounts are expressed and rounded to 3 dp using round-half-up.' | Round-half-up to the minor unit matches the reference rounding method. |
| 6 | yes | **yes** | Section 3: 'that residual is absorbed into the interest component, never into principal.' | Rounding residual lands in interest, matching the reference destination. |
| 7 | no | no | Section 5: 'The signature carries no date precisely because this function does no date-driven work.' Section 11 lists 'Any due-date or calendar-driven processing' as a non-goal. | Spec explicitly disclaims any date-driven work and no value_date / back-valued re-accrual is handled; the reference requires recomputing interest to an earlier value_date. Not addressed and contradicted. |
| 8 | no | no | absent | Spec treats all surplus uniformly as credit balance but never addresses the arrears-vs-not distinction nor explicitly states early payment does NOT prepay principal / future interest is unchanged. The specific early-payment decision is not surfaced. |
| 9 | yes | **yes** | Section 4.3: 'no proportional split'; Section 4.2 strict priority sequence; Section 10: 'no proportional split' | Spec mandates strict in-order fill with explicit no-proportional-split, matching the reference for partial payment below the first bucket. |
| 10 | yes | **yes** | Section 6: 'if an instalment's total remaining balance is ≤ 0.005 BHD, that residual is written off.' | Tolerance threshold of ≤ 0.005 BHD on combined remaining, marking fully paid, matches the reference exactly. |
| 11 | yes | **yes** | Section 8: 'Negative payment: rejected with an error... Zero payment: a no-op that still records a zero-value allocation transaction.' | Negative rejected with error; zero is a no-op that records a zero-value transaction — matches the reference exactly. |
| 12 | no | no | Section 11: 'Any due-date or calendar-driven processing' is a non-goal; no mention of penalty accrual up to value date before allocation. | Spec does no date-driven accrual and never addresses accruing penalties to the value date before allocation; the reference requires accrue-then-allocate. Not surfaced. |
| 13 | no | no | absent | Spec specifies allocation of a single payment but never addresses ordering of multiple same-day payments or FIFO-by-timestamp handling. Not surfaced. |
| 14 | yes | **yes** | Section 9: per-instalment 'Amount applied to each component bucket', 'Resulting outstanding balance per bucket', loan-level 'credit_balance_created', 'tolerance_written_off'. | Return shape includes per-payment per-bucket amounts applied, resulting outstanding balances, credit balance created, and tolerance written off — matches all four required elements of the reference. |
