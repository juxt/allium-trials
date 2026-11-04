# bmad — loan-allocation — iteration 1

Model (author): claude-opus · Questions asked: 12 · Captured: 12/14 · Bespoke captured: 6/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like that interactive prompt didn't go through in this environment. I'll ask in plain text instead, so you can just answer inline. These are the decisions that determine what `allocate_payment` actually returns, and none of them are inferable from the brief.

**The material policy questions**

1. **Component order within an instalment.** Each instalment has penalties, fees, interest and principal. In what order does a payment consume them? For example penalties → fees → interest → principal, or interest → principal → fees → penalties, or something else your institution mandates.

2. **Traversal across instalments.** With several instalments outstanding, does a payment clear the oldest instalment fully (all four components) before touching the next (instalment-major, oldest first), or does it clear one component type across every instalment before moving on (component-major, e.g. all penalties everywhere, then all fees, then interest, then principal)? This single choice changes the result more than any other.

3. **Overpayment.** If the payment exceeds everything currently owed, what happens to the surplus? Held as an unallocated credit, applied as principal prepayment to future instalments, refunded, or rejected/capped?

4. **Underpayment / partial payment.** If the payment is smaller than a full instalment, do you apply it partially as far down the waterfall as it reaches, hold it as credit until it can clear a whole instalment, or reject anything below the minimum due?

**A few more I'll need before the spec is complete** (feel free to answer now or after the above):

5. **Eligible instalments.** Does "what they currently owe" mean only due and overdue instalments, or can a payment reach not-yet-due (future) instalments once the current ones are cleared?

6. **Rounding.** What's the currency's smallest unit, and how are fractional amounts handled (round half-up, banker's rounding, always round in the borrower's favour)? Where does any residual sub-unit land?

7. **Degenerate inputs.** How should the function treat a zero payment, a negative payment, or a payment on a loan with nothing outstanding?

Answer whichever you can and I'll turn the answers into the spec. If you'd rather I proceed with a specific institution's conventional defaults for any of these, say so and I'll mark them explicitly as assumptions.
A: Answers in order:

1. **Component order within an instalment:** fees first, then penalties, then interest, then principal.

2. **Traversal across instalments:** Instalment-major, oldest first. The oldest overdue instalment must be cleared in full across all four components before any allocation touches the next instalment.

3. **Overpayment:** Surplus is held as an unallocated credit balance and auto-applied when the next instalment falls due. It is never auto-refunded and does not prepay principal.

4. **Partial payment:** Strict waterfall — fill each component in sequence as far as the payment reaches. No minimum threshold; no proportional split; no hold-until-full-instalment.

5. **Eligible instalments:** Payments do not reach future (not-yet-due) instalments. Once current and overdue instalments are cleared, any surplus becomes a credit balance per item 3 above.

6. **Rounding:** The loan currency is BHD (Bahraini dinar), minor unit is the fils — three decimal places throughout. Round half-up to 3 dp. Any sub-unit residual from rounding is absorbed into the interest component, not principal.

7. **Degenerate inputs:** A negative payment is rejected with an error. A zero payment is a no-op but must still produce a zero-value allocation transaction in the record. A payment against a loan with nothing outstanding falls under the overpayment rule — the full amount becomes a credit balance.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Those are clear and cover the big decisions. Three tight follow-ups remain, each of which genuinely changes the output or the function's contract. Then I'll write the spec.

**A. The rounding residual, concretely.** Allocation itself is subtraction of 3-dp amounts, so a sub-fils residual only arises if a component *balance* carries more precision than 3 dp (typically accrued interest) and gets rounded at allocation time. Two things I need:
   - Is that the scenario you mean — interest balances accrue at higher precision and are rounded to 3 dp when allocated?
   - If the residual should land in interest but that instalment's interest is already zero (fully paid or none accrued), where does it go instead: principal, or carried as a credit-balance adjustment?

**B. How held credit is applied later.** When an unallocated credit balance is auto-applied as the next instalment falls due, (i) does it follow the same fees → penalties → interest → principal waterfall, and (ii) is that auto-application performed *inside* `allocate_payment`, or is it a separate trigger and therefore out of scope for this function?

**C. The return contract and tie-breaks.**
   - What must the returned value contain? My default: the allocation broken down per instalment and per component, the loan's updated component balances, the resulting credit balance, and the allocation transaction record (including the zero-value one for a zero payment). Anything to add or drop, e.g. a transaction id or timestamp the function must produce versus receive as input?
   - If two outstanding instalments share the same due date, how is "oldest first" broken, by an instalment sequence number, or can that never happen?
A: A. Rounding residual:
- Yes, that is the scenario: accrued interest carries sub-unit precision internally and is rounded to 3 dp at allocation time. That is the only source of a residual.
- If the interest component on that instalment is already zero, the residual lands in principal instead. [default, not policy — the key only specifies the normal destination]

B. How held credit is applied later:
- (i) Yes, the same fees → penalties → interest → principal waterfall applies when the credit balance is auto-applied. [default, not policy]
- (ii) The auto-application is a separate trigger, not performed inside `allocate_payment`. The function's responsibility ends at recording the credit balance. What happens to it on a future due date is out of scope here.

C. Return contract and tie-breaks:
- The required return shape is: amount applied to each component of each instalment touched, resulting outstanding balances per component per instalment, credit_balance resulting from this payment, and any tolerance_written_off amount. Your default is correct on those four. The function receives value_date and receipt_timestamp as inputs; it does not generate a transaction id — that is assigned by the persistence layer and is therefore outside the function's contract.
- If two outstanding instalments share the same due date, break the tie by instalment sequence number, ascending. [default, not policy — this scenario is not addressed in policy]

### Round 3
_Step reasoning:_ (live agent turn)

Q: One new term appeared in your answer to C: `tolerance_written_off`. That implies a payment-tolerance policy I don't yet have, and it's now part of the return contract, so I need to pin it down. I also want to confirm one thing about `value_date`.

**D. Tolerance policy.** What produces a `tolerance_written_off` amount?
   - Does tolerance apply to a **shortfall** (an instalment left a hair short is treated as fully cleared and the tiny remainder written off), to an **overage** (a surplus below the threshold is written off rather than held as credit), or both?
   - What is the threshold, an absolute amount in fils, a percentage, and is it assessed per component, per instalment, or per whole payment?
   - When a write-off happens, the affected balance goes to zero and the written-off amount is reported separately, correct? And for an overage within tolerance, does write-off take precedence over the credit-balance rule (item 3)?

**E. `value_date`.** I'm treating `value_date` as the "as of" date that determines which instalments count as due or overdue (and thus eligible), while `receipt_timestamp` is just recorded on the transaction. Correct?

That should be everything. Once I have D and E I'll write `spec.md`.
A: D. Tolerance policy:
- Tolerance applies to a shortfall only. If the residual owed on an instalment after allocation is ≤ 0.005 BHD, the instalment is marked fully paid and the remainder is written off. There is no tolerance rule for an overage — any surplus follows the credit-balance rule (item 3) regardless of size.
- Threshold: 0.005 BHD, absolute, assessed per instalment.
- Correct: the affected balance goes to zero and the written-off amount is reported separately in the return value. Write-off does not take precedence over the credit-balance rule; those two paths do not overlap (write-off is for shortfalls, credit balance is for overages).

E. value_date:
- Confirmed on interest: when value_date is earlier than today, interest is recomputed to that value_date before allocation runs. The function operates on post-recomputation balances.
- Using value_date as the cut-off that determines which instalments count as due or overdue is correct. [default, not policy — the key specifies the interest-recomputation behaviour but does not separately address eligibility determination]

### Round 4
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in the working directory.

It captures every policy decision we pinned down, and it separates the confirmed institutional policy from the defaults you flagged, so an implementer knows which lines are settled and which need a second look.

A few things worth flagging:

- **The three defaults you marked** (residual-into-principal when interest is zero, credit following the same waterfall on later application, shared-due-date tie-break) are isolated in section 9 rather than buried in the rules, so they're easy to revisit.
- **One genuine open boundary** I couldn't close from your answers: whether `allocate_payment` itself performs the interest recomputation to `value_date`, or receives already-recomputed balances. The spec treats the accrual maths as out of scope either way, but names the ambiguity in section 9 so it doesn't get silently decided in code.
- **`tolerance_written_off`** is now fully specified as a shortfall-only, per-instalment, 0.005 BHD rule that never overlaps with the credit-balance path, which was the one contract term that arrived undefined.

The structure runs purpose → scope → contract → policy (in application order) → invariants → worked examples → confirmed decisions → assumptions. The worked examples double as ready-made test cases for the partial, tolerance, overpayment and zero-payment paths.

If you'd like, I can also produce a formal Allium version of the allocation rules, or expand the worked examples into a full test matrix covering the instalment-major traversal and the negative-payment rejection.
A: Received. The structure looks right and the three flagged defaults are where they should be. The value_date ambiguity is the only live question worth resolving before implementation starts — worth a quick confirmation from engineering on whether recomputation happens inside or outside the function boundary. No further input needed from this side.

## Produced specification

# Requirements specification: payment allocation

## 1. Purpose

Specify the behaviour of `allocate_payment(payment, loan)`, the function that applies a
borrower's payment across what they currently owe on a loan and returns both the allocation
and the loan's updated balances.

A loan carries one or more outstanding instalments. Each instalment owes up to four
components: fees, penalties, interest and principal. The function decides how a single
payment is consumed against those components and instalments, what becomes of any surplus,
and how near-misses and degenerate inputs are handled.

The currency throughout is the Bahraini dinar (BHD). The minor unit is the fils, giving three
decimal places. Every amount in this specification is a BHD value at three-decimal precision
unless stated otherwise.

## 2. Scope

### In scope

- Allocating a single payment across the loan's due and overdue instalments.
- Ordering allocation within an instalment and across instalments.
- Handling partial payments, overpayments, shortfalls within tolerance, and degenerate inputs.
- Producing the allocation breakdown, the updated balances, the resulting credit balance and
  any tolerance written off.

### Out of scope

- **Interest accrual.** The interest accrual formula is a separate concern. This function
  operates on balances that are current as of `value_date` (see 5.1). It does not define how
  interest is calculated.
- **Auto-application of a credit balance.** When a credit balance is later applied as a future
  instalment falls due, that is a separate trigger. This function's responsibility ends at
  recording the credit balance (see 5.7).
- **Persistence.** The function does not assign a transaction id or write to storage. The
  persistence layer owns those (see 4.2).
- **Refunds and prepayment.** Surplus is never auto-refunded and never prepays principal
  (see 5.7).

### Dependencies

- An interest accrual routine that can bring interest balances current to a given
  `value_date`. Treated here as a black box invoked before allocation.

## 3. Domain model

**Loan.** Holds an ordered set of instalments and a running credit balance. Each instalment
has a unique sequence number and a due date.

**Instalment.** Owes four component balances, each a non-negative BHD amount:

- `fees`
- `penalties`
- `interest`
- `principal`

An instalment is *fully paid* when all four component balances are zero. An instalment is
*eligible* for a given payment when its due date is on or before `value_date` (see 5.2).

**Component order.** The four components are always consumed in this fixed order:

1. fees
2. penalties
3. interest
4. principal

## 4. Function contract

### 4.1 Inputs

**`payment`**

- `amount`: the payment amount in BHD. May be zero or negative (see 5.8).
- `value_date`: the effective date of the payment. Determines instalment eligibility and the
  point to which interest is brought current.
- `receipt_timestamp`: the moment the payment was received. Recorded on the resulting
  allocation record; it does not affect allocation logic.

**`loan`**

- The instalments with their four component balances, due dates and sequence numbers.
- The existing credit balance, if any.

### 4.2 Outputs

The function returns:

1. **Allocation breakdown.** For each instalment the payment touched, the amount applied to
   each of its four components.
2. **Updated balances.** For each instalment touched, the resulting outstanding balance of
   each component.
3. **`credit_balance`.** The credit balance resulting from this payment (see 5.7).
4. **`tolerance_written_off`.** The total amount written off under the shortfall tolerance
   rule (see 5.6).

The function does **not** generate a transaction id. That is assigned downstream by the
persistence layer and is outside this contract.

## 5. Allocation policy

The rules below apply in the order presented. This ordering is itself part of the
specification.

### 5.1 Bring interest current to `value_date`

If `value_date` is earlier than today, interest is recomputed to `value_date` before
allocation runs. Allocation operates on the post-recomputation balances. The accrual
calculation itself is out of scope (see 2).

### 5.2 Determine eligible instalments

An instalment is eligible if its due date is on or before `value_date`. Only due and overdue
instalments are eligible. A payment never reaches a not-yet-due (future) instalment. Once all
eligible instalments are cleared, any remaining payment becomes a credit balance (see 5.7).

### 5.3 Order instalments

Eligible instalments are allocated **oldest first**: ascending by due date. If two eligible
instalments share the same due date, break the tie by instalment sequence number, ascending.

> Tie-break by sequence number is a sensible default; the funding policy does not address the
> shared-due-date case explicitly.

### 5.4 Traversal is instalment-major

The oldest eligible instalment must be cleared in full, across all four components, before any
allocation touches the next instalment. Allocation does not move to the next instalment while
the current one still owes anything (subject to the tolerance rule in 5.6).

This is instalment-major traversal, not component-major. The payment does not, for example,
clear all penalties across every instalment before moving to fees.

### 5.5 Strict waterfall within an instalment

Within an instalment, the payment fills each component in the fixed order (fees, penalties,
interest, principal), taking `min(remaining payment, component balance)` at each step. There
is:

- no minimum-payment threshold,
- no proportional split across components,
- no hold-until-full-instalment behaviour.

A partial payment is applied as far down the waterfall as it reaches. Whatever it does not
cover stays outstanding.

### 5.6 Shortfall tolerance

After the payment has been allocated to an instalment, assess the residual it still owes (the
sum of its remaining component balances). If that residual is greater than zero and less than
or equal to **0.005 BHD**, the instalment is marked fully paid: its remaining component
balances are set to zero, and the written-off amount is added to `tolerance_written_off` and
reported separately in the return value.

- Tolerance is assessed **per instalment**.
- The threshold is **0.005 BHD**, absolute.
- Tolerance applies to **shortfalls only**. There is no tolerance rule for a surplus; any
  overage of any size follows the credit-balance rule in 5.7.

The shortfall path (5.6) and the credit-balance path (5.7) never overlap: one handles money
still owed, the other handles money left over.

### 5.7 Overpayment and credit balance

If the payment exceeds everything currently owed across all eligible instalments, the surplus
is held as an **unallocated credit balance** on the loan. It is:

- **never** auto-refunded to the borrower,
- **never** used to prepay principal,
- **never** applied to future (not-yet-due) instalments by this function.

The surplus is auto-applied only when the next instalment falls due, which is a separate
trigger outside this function (see 2). This function's responsibility ends at recording the
credit balance in the return value.

> When that later trigger applies the credit balance, it follows the same fees → penalties →
> interest → principal waterfall. That behaviour belongs to the separate trigger, not to this
> function, and is noted here only for continuity.

### 5.8 Rounding

- All amounts are held and reported at three decimal places (fils). Rounding is **half-up to
  3 dp**.
- The only source of a rounding residual is accrued interest, which carries sub-unit precision
  internally and is rounded to 3 dp at allocation time.
- The residual from that rounding is absorbed into the **interest** component of the instalment
  concerned.
- If that instalment's interest component is already zero, the residual is absorbed into
  **principal** instead.

> Residual-into-interest is the stated policy. Residual-into-principal when interest is zero is
> a sensible default filling a case the policy does not name.

### 5.9 Degenerate inputs

- **Negative payment.** Rejected with an error. No allocation is produced.
- **Zero payment.** A no-op for balances, but the function must still produce a zero-value
  allocation record: every touched-component amount is zero, balances are unchanged, and
  `credit_balance` and `tolerance_written_off` are zero.
- **Nothing outstanding.** A payment against a loan with no eligible outstanding balance falls
  under the overpayment rule (5.7): the full amount becomes a credit balance.

## 6. Invariants

- Conservation: for a non-negative payment, `sum of amounts applied to components` +
  `tolerance_written_off` + `credit_balance` = `payment.amount`, at 3 dp.
- No component balance is ever negative.
- No eligible instalment is left partially paid while a later eligible instalment receives any
  allocation (instalment-major traversal, 5.4).
- `tolerance_written_off` accrues only from shortfalls of at most 0.005 BHD per instalment
  (5.6).
- A credit balance arises only from surplus after all eligible instalments are cleared (5.7),
  never from a shortfall.
- Future instalments are never touched (5.2).

## 7. Worked examples

All amounts in BHD.

### 7.1 Straightforward partial payment

Two overdue instalments. Instalment 1 (older) owes fees 5.000, penalties 2.000, interest
10.000, principal 100.000. Payment is 15.000.

Waterfall on instalment 1: fees 5.000, penalties 2.000, interest 8.000. Payment exhausted.
Instalment 1 still owes interest 2.000 and principal 100.000, so it is not cleared; instalment
2 is untouched. No credit balance, no write-off.

### 7.2 Shortfall within tolerance

Instalment 1 owes a total of 50.004. Payment is 50.000.

The waterfall applies 50.000 down the components, leaving a residual of 0.004. Since
0 < 0.004 ≤ 0.005, the instalment is marked fully paid, its remaining 0.004 is written off,
and `tolerance_written_off` = 0.004. Allocation may now proceed to instalment 2 if payment
remained, but here it did not.

### 7.3 Overpayment

One overdue instalment owing 30.000 in total. Payment is 45.000.

The instalment is cleared with 30.000. The surplus 15.000 becomes `credit_balance` = 15.000.
It is not refunded, does not prepay principal, and does not reach any future instalment.

### 7.4 Zero payment

Payment is 0.000. Balances unchanged. The function returns a zero-value allocation record with
`credit_balance` = 0.000 and `tolerance_written_off` = 0.000.

## 8. Decisions confirmed with the stakeholder

The following are institutional policy, confirmed rather than inferred:

- Component order: fees, penalties, interest, principal (5.5).
- Instalment-major traversal, oldest first (5.4, 5.3).
- Surplus held as credit balance; never refunded, never prepays principal, never reaches
  future instalments; auto-applied only by a separate later trigger (5.7).
- Strict waterfall for partial payments; no threshold, no proportional split, no
  hold-until-full (5.5).
- Eligibility limited to due and overdue instalments (5.2).
- BHD at 3 dp, half-up; interest rounding residual absorbed into interest (5.8).
- Shortfall tolerance of 0.005 BHD, per instalment, shortfalls only (5.6).
- Interest recomputed to `value_date` before allocation (5.1).
- Degenerate-input handling (5.9).

## 9. Assumptions and open points

These fill cases the stakeholder flagged as default rather than settled policy. They should be
confirmed before implementation if they carry weight:

- Rounding residual lands in principal when the instalment's interest is already zero (5.8).
- Held credit, when later applied, follows the same waterfall (5.7); this belongs to the
  separate trigger, not this function.
- Shared-due-date instalments are tie-broken by sequence number, ascending (5.3).
- `value_date` is treated as the cut-off that determines instalment eligibility, in addition to
  its confirmed role of setting the interest recomputation point (5.1, 5.2).

One point worth confirming explicitly: whether `allocate_payment` itself invokes the interest
recomputation of 5.1, or whether it receives balances already brought current to `value_date`.
This specification treats recomputation as happening before the allocation waterfall and the
accrual maths as out of scope, but the boundary of who calls it is not settled.


## Auditor verdict

_The spec correctly resolves 12 of 14 decisions (1-11, 14), including the bespoke ones (fees-before-penalties order, credit-balance surplus handling, BHD 3 dp, half-up, residual-into-interest, back-valued recompute, tolerance). It misses decision 12 (penalty accrual timing to value_date is never stated — only interest recomputation is) and decision 13 (no FIFO-by-timestamp rule for multiple same-day payments; receipt_timestamp is said not to affect allocation). Coverage = 12/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Section 3 'Component order... 1. fees 2. penalties 3. interest 4. principal'; 5.5 'fills each component in the fixed order (fees, penalties, interest, principal)' | Spec fixes the within-instalment order as fees → penalties → interest → principal, matching the reference exactly, including fees before penalties. |
| 2 | yes | **yes** | 5.4 'The oldest eligible instalment must be cleared in full, across all four components, before any allocation touches the next instalment'; 5.3 oldest first | Instalment-major, oldest-first traversal clearing all four buckets before moving on matches the reference resolution. |
| 3 | yes | **yes** | 5.7 'surplus is held as an unallocated credit balance... never auto-refunded... auto-applied only when the next instalment falls due' | Surplus held as unallocated credit balance, auto-applied to the next instalment via a separate trigger, never refunded — matches the reference on all points. |
| 4 | yes | **yes** | 1. Purpose 'The currency throughout is the Bahraini dinar (BHD). The minor unit is the fils, giving three decimal places' | Spec states BHD at three decimal places (fils), matching the reference minor unit exactly. |
| 5 | yes | **yes** | 5.8 'Rounding is half-up to 3 dp' | Half-up rounding to the 3 dp minor unit matches the reference method precisely. |
| 6 | yes | **yes** | 5.8 'The residual from that rounding is absorbed into the interest component of the instalment concerned' | Residual absorbed into interest matches the reference; the added principal fallback when interest is zero is extra scope but does not contradict the stated primary rule. |
| 7 | yes | **yes** | 5.1 'If value_date is earlier than today, interest is recomputed to value_date before allocation runs' | Back-valued payments trigger interest recomputation to the value_date before allocation, exactly as the reference states. |
| 8 | yes | **yes** | 5.2 eligibility limited to due/overdue; 5.7 surplus 'never used to prepay principal'; 5.9 'Nothing outstanding... becomes a credit balance' | A not-in-arrears payment settles only eligible instalments and any surplus becomes a credit balance that never prepays principal, so future interest is unchanged — matches the reference. |
| 9 | yes | **yes** | 5.5 'no proportional split across components'; 'A partial payment is applied as far down the waterfall as it reaches' | Strict in-order waterfall with no proportional split matches the reference for a sub-first-bucket partial payment. |
| 10 | yes | **yes** | 5.6 'if that residual is greater than zero and less than or equal to 0.005 BHD, the instalment is marked fully paid... written off' | Per-instalment write-off tolerance of ≤ 0.005 BHD marking the instalment fully paid matches the reference threshold and behaviour. |
| 11 | yes | **yes** | 5.9 'Negative payment. Rejected with an error'; 'Zero payment. A no-op for balances, but the function must still produce a zero-value allocation record' | Negative rejected with error and zero as a no-op that still records a zero-value allocation transaction matches the reference exactly. |
| 12 | no | no | 5.1 recomputes interest only; Section 2 lists 'Interest accrual' out of scope. Penalty accrual timing: absent | The spec addresses interest recomputation to value_date but never states that penalties accrue up to and including the value_date before allocation; the accrue-then-allocate point is defined for interest only, so the penalty decision is not surfaced. |
| 13 | no | no | 4.1 'receipt_timestamp... does not affect allocation logic'; multiple same-day payment ordering: absent | The function is single-payment and the spec explicitly says receipt_timestamp does not affect allocation, but it never states that multiple same-day payments are applied FIFO by receipt timestamp, each allocated independently in turn. |
| 14 | yes | **yes** | 4.2 outputs: 'Allocation breakdown... amount applied to each of its four components', 'Updated balances', 'credit_balance', 'tolerance_written_off' | The returned shape includes per-instalment per-bucket amounts applied, resulting balances, credit_balance and tolerance_written_off, matching all four elements of the reference result shape. |
