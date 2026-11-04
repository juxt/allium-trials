# superpowers — loan-allocation — iteration 1

Model (author): claude-opus · Questions asked: 5 · Captured: 8/14 · Bespoke captured: 3/8

## Conversation

### Round 1
_Step reasoning:_ Architectural work under the brainstorming process; the allocation waterfall (order across instalments and across components) is the central omitted policy, so I ask that one question first rather than proposing a design.

Q: When a payment comes in against a loan with several outstanding instalments, in what order should it be applied? Specifically: (a) across instalments, do we clear the oldest instalment fully before touching the next, or work newest-first, or something else; and (b) within a single instalment, what's the priority order across penalties, fees, interest and principal?
A: (a) Oldest-first: clear the oldest overdue instalment in full across all buckets before any money touches the next. (b) Within a single instalment the priority order is: fees, then penalties, then interest, then principal.

### Round 2
_Step reasoning:_ Architectural path, questions one at a time; ordering is settled so the next material unknown is how surplus beyond all outstanding instalments is handled.

Q: Once all outstanding instalments are fully cleared, what happens to any remaining payment amount: is it applied to reduce future/not-yet-due principal (prepayment), held as an unallocated credit on the loan, or refunded/rejected?
A: Surplus is held as an unallocated credit balance on the loan and auto-applied to the next instalment when it falls due. It is never auto-refunded and does not prepay principal or affect future interest.

### Round 3
_Step reasoning:_ Ordering and surplus are settled, but rounding/precision is a material, institution-specific policy that can't be reliably inferred and directly changes allocation output; asking it before moving on to remaining gaps.

Q: When a payment (or the running remainder) doesn't divide cleanly into a bucket, or interest/penalty figures carry sub-cent precision, what rounding rule applies and where does any residual go? Specifically: (a) what currency precision do we allocate to (whole cents, or something coarser); (b) which rounding convention (round half up, round half to even/banker's, always truncate); and (c) if rounding leaves a tiny residual on an instalment, does it stay outstanding, get absorbed into principal, or get written off?
A: (a) Allocate to 3 decimal places — the loan is denominated in BHD (Bahraini dinar), whose minor unit is the fils (1/1000). (b) Round half-up to 3 dp. (c) Any rounding residual is absorbed into the interest component, not principal, and does not remain outstanding.

### Round 4
_Step reasoning:_ Core ordering, surplus and rounding are settled, but which instalments are eligible (overdue-only vs reaching into not-yet-due) and how partial coverage of an instalment behaves are still material, non-inferable policy choices.

Q: Two related points on which instalments a payment reaches: (a) does allocation only touch instalments that are currently due or overdue, leaving not-yet-due future instalments untouched (with any surplus becoming the credit balance you described), or can a payment reach into the next scheduled-but-not-yet-due instalment before that? (b) When the payment runs out partway through an instalment, that instalment is left partially paid with its remaining buckets still outstanding in the fees->penalties->interest->principal order — is that the intended behaviour, or should a payment that cannot fully clear an instalment be handled differently (e.g. held rather than applied partially)?
A: Allocation only touches instalments that are currently due or overdue. Not-yet-due future instalments are left untouched; any surplus after clearing all due and overdue instalments becomes the credit balance described previously, applied when the next instalment falls due.

### Round 5
_Step reasoning:_ Core ordering, surplus, rounding and instalment-scope policies are settled, but how a pre-existing credit balance interacts with a fresh incoming payment at allocation time is still ambiguous and cannot be safely inferred.

Q: One interaction I still need to pin down on the credit balance: when a new payment arrives and the loan already holds an unallocated credit balance from before, do you combine the existing credit with the incoming payment and allocate the total against the due/overdue instalments in one pass, or is the incoming payment allocated on its own (with the pre-existing credit left untouched until the next instalment falls due)? And relatedly, if a payment arrives with zero due/overdue instalments outstanding, does the whole amount simply join the credit balance?
A: The pre-existing credit balance is auto-applied when the next instalment falls due, not at the point a new payment arrives. Incoming payments are therefore allocated independently; the existing credit is left untouched until the due date triggers it. If a payment arrives when there are no due or overdue instalments outstanding, the entire incoming amount joins the credit balance [default, not policy on the combining mechanic — the key specifies credit is applied on due-date, implying it is not pooled with ad-hoc payments mid-cycle].

### Round 6 (process signalled done)
_Step reasoning:_ The five material policies the brief omits (cross- and intra-instalment ordering, surplus handling, rounding/precision, scope of due/overdue instalments with partial application, and credit-balance interaction) are all pinned down by explicit stakeholder answers, so requirements capture is complete.

(no questions this round)

## Produced specification

# Payment Allocation — Design Specification

## Purpose

Add payment allocation to the loan servicing system. When a borrower pays against a loan, the money must be applied deterministically across what they currently owe. This spec captures the allocation policy this institution has chosen, so that a single function can implement it correctly and predictably.

The outcome your partner wants: a borrower's payment is distributed across outstanding instalments and the buckets within them in the exact priority the institution has settled on, with any leftover held as credit rather than refunded or used to prepay. Success means the returned allocation and updated balances match that policy to the fils, including rounding.

## Interface

```
allocate_payment(payment, loan) -> { allocation, loan }
```

- `payment` — the incoming amount to apply, denominated in BHD.
- `loan` — the loan with its outstanding instalments and any pre-existing credit balance.
- Returns both a breakdown of how the payment was applied (per instalment, per bucket) and the loan with its updated balances.

The function is a pure allocation step: given a payment and a loan state, it produces the applied breakdown and the resulting loan state. It does not itself advance time or trigger due-date events (see Credit balance below).

## Domain model

A loan carries a schedule of instalments. Each instalment has four component buckets, each with an outstanding amount:

- fees
- penalties
- interest
- principal

An instalment is *due or overdue* if its due date has arrived or passed; otherwise it is *not-yet-due*. The loan may also hold an **unallocated credit balance** from a previous surplus.

## Allocation order

Allocation proceeds oldest-first across instalments and by a fixed bucket priority within each instalment.

**Across instalments.** Clear the oldest due-or-overdue instalment in full, across all four buckets, before any money touches the next instalment. Then move to the next-oldest, and so on.

**Within a single instalment.** Apply money in this priority order:

1. fees
2. penalties
3. interest
4. principal

So within an instalment fees are satisfied first, then penalties, then interest, then principal; only once an instalment is fully cleared across all four does allocation move to the next instalment.

## Scope of allocation: which instalments a payment reaches

Allocation only touches instalments that are currently **due or overdue**. Not-yet-due future instalments are left untouched. A payment cannot reach into a scheduled-but-not-yet-due instalment.

Once every due and overdue instalment is fully cleared, any remaining payment amount does not spill into future instalments and does not prepay principal. It becomes the credit balance described below.

## Partial payment

When the payment runs out partway through an instalment, that instalment is left **partially paid**. Its remaining buckets stay outstanding in the same fees -> penalties -> interest -> principal priority order. This is the intended behaviour: a payment that cannot fully clear an instalment is applied as far as it reaches, not held back.

## Surplus and the credit balance

When a payment (or the running remainder) exceeds everything currently due and overdue, the surplus is held as an **unallocated credit balance** on the loan. This credit balance:

- is auto-applied to the next instalment when that instalment falls due;
- is never auto-refunded;
- does not prepay principal and does not affect future interest.

If a payment arrives when there are **no due or overdue instalments outstanding**, the entire incoming amount joins the credit balance.

## Interaction between incoming payments and an existing credit balance

The pre-existing credit balance is applied on the due-date trigger of the next instalment, not at the moment a new payment arrives. Consequently:

- Incoming payments are allocated **independently** against the current due-or-overdue instalments. A new payment is not pooled with the existing credit and allocated as a combined total.
- The existing credit balance is left untouched by an incoming ad-hoc payment; it waits until the next instalment falls due to trigger it.

In other words, credit is a due-date mechanism, not a mid-cycle pool. `allocate_payment` allocates the incoming payment alone and does not draw down or top up the pre-existing credit as part of the same call.

## Currency, precision and rounding

The loan is denominated in **BHD (Bahraini dinar)**, whose minor unit is the fils, 1/1000 of a dinar.

- **Precision.** Allocate to 3 decimal places (fils).
- **Rounding convention.** Round half-up to 3 dp.
- **Residual handling.** Any residual left by rounding is absorbed into the **interest** component of the instalment, not principal. A rounding residual never remains outstanding.

Because residuals fold into interest and do not linger, an instalment that has been paid down to a sub-fils remainder is treated as cleared, with the tiny difference taken up by interest.

## Return value

The function returns:

- **allocation** — how the payment was applied: for each instalment touched, the amount applied to each of fees, penalties, interest and principal, and any amount added to the credit balance.
- **loan** — the loan with updated per-instalment bucket balances, the updated credit balance, and instalment states (cleared or partially paid) reflecting the allocation.

## Worked ordering summary

For a given `allocate_payment(payment, loan)` call:

1. Take the incoming `payment` on its own; do not pool it with any existing credit balance.
2. Identify due-or-overdue instalments, oldest first.
3. For the oldest, apply money to fees, then penalties, then interest, then principal, rounding each allocation half-up to 3 dp and absorbing any residual into interest so nothing sub-fils remains outstanding.
4. If the instalment is fully cleared and money remains, move to the next-oldest due-or-overdue instalment and repeat.
5. If money runs out partway, leave that instalment partially paid with its remaining buckets outstanding in priority order, and stop.
6. If all due-or-overdue instalments are cleared and money remains (or there were none to begin with), add the remainder to the loan's unallocated credit balance. Do not prepay principal, reach into not-yet-due instalments, or refund.

## Explicitly out of scope

These were not raised by the brief or the stakeholder and are deliberately not specified here: refund initiation, the due-date event that triggers credit application (this function only records credit; a separate due-date process applies it), interest accrual and recalculation, and validation of negative or malformed payment inputs. They are left to their existing owners rather than invented here.

## Decisions captured (traceability)

- Across-instalment order: oldest-first, clear fully before next. (Stakeholder, round 1a)
- Within-instalment priority: fees, penalties, interest, principal. (Round 1b)
- Surplus: held as unallocated credit, auto-applied on next due date, never auto-refunded, no principal prepayment, no interest effect. (Round 2)
- Precision 3 dp / BHD fils; round half-up; residual absorbed into interest, never left outstanding. (Round 3)
- Only due-or-overdue instalments touched; not-yet-due left alone; surplus to credit. (Round 4a)
- Partial payment leaves the instalment partially paid with remaining buckets outstanding in priority order. (Round 4b)
- Incoming payments allocated independently of the pre-existing credit; credit applied on due-date, not pooled mid-cycle; payment with no due/overdue instalments joins credit in full. (Round 5)

## Auditor verdict

_Coverage 8/14. The spec correctly captures the in-order and cross-instalment allocation (1, 2), credit-balance handling for both overpayment and early surplus (3, 8), BHD 3-dp precision, half-up rounding and interest-absorbed residual (4, 5, 6), and strict-order partial payment (9). It fails on the genuinely bespoke money decisions it never elicited: back-valued value_date re-accrual (7), the 0.005 BHD write-off tolerance (10), penalty accrual timing (12), and same-day FIFO ordering (13) are absent; negative/zero handling (11) is explicitly deferred rather than resolved; and the return shape (14) omits the required tolerance_written_off field. The elicitation gap concentrates exactly on the non-inferable tolerance and value-date policies._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Within a single instalment. Apply money in this priority order: 1. fees 2. penalties 3. interest 4. principal" | Spec states fees before penalties before interest before principal, matching the reference's deliberately non-default order exactly. |
| 2 | yes | **yes** | "Clear the oldest due-or-overdue instalment in full, across all four buckets, before any money touches the next instalment." | Matches the reference's oldest-cleared-fully-across-all-buckets-first strategy precisely. |
| 3 | yes | **yes** | "the surplus is held as an unallocated credit balance... is auto-applied to the next instalment when that instalment falls due; is never auto-refunded; does not prepay principal" | Credit balance held, auto-applied at next due date, never refunded — matches the reference exactly. |
| 4 | yes | **yes** | "denominated in BHD (Bahraini dinar), whose minor unit is the fils, 1/1000 of a dinar... Allocate to 3 decimal places (fils)." | Correctly identifies BHD as a 3-dp currency, matching the reference precision. |
| 5 | yes | **yes** | "Rounding convention. Round half-up to 3 dp." | Half-up rounding to the minor unit matches the reference exactly. |
| 6 | yes | **yes** | "Any residual left by rounding is absorbed into the interest component of the instalment, not principal." | Residual folds into interest rather than principal, matching the reference destination. |
| 7 | no | no | "interest accrual and recalculation" listed under "Explicitly out of scope" | The spec never mentions value_date or back-valued payments; it punts interest recalculation generally, so the specific re-accrual-to-value-date decision is neither raised nor resolved. |
| 8 | yes | **yes** | "This credit balance... does not prepay principal and does not affect future interest." plus "A payment cannot reach into a scheduled-but-not-yet-due instalment." | An early/on-time surplus settles current instalments only and becomes credit with no principal prepayment and no interest effect, matching the reference. |
| 9 | yes | **yes** | "remaining buckets stay outstanding in the same fees -> penalties -> interest -> principal priority order... applied as far as it reaches" | Strict in-order filling with no proportional split, matching the reference. |
| 10 | no | no | absent (only "A rounding residual never remains outstanding" re sub-fils rounding) | The spec's residual handling is about sub-fils rounding folded into interest, a different mechanism; there is no 0.005 BHD write-off tolerance marking a near-complete instalment fully paid. |
| 11 | yes | no | "validation of negative or malformed payment inputs" listed under "Explicitly out of scope" | Negative/zero inputs are acknowledged but deliberately deferred, so the reference behaviour (reject negative, zero no-op recording a zero allocation) is not specified. |
| 12 | no | no | absent ("interest accrual and recalculation" out of scope; no mention of penalty accrual) | The spec says nothing about penalties accruing up to the value date before allocation runs; penalty accrual timing is not addressed. |
| 13 | no | no | "Incoming payments are allocated independently against the current due-or-overdue instalments" (in the context of the existing credit balance) | The independence statement concerns pooling with a pre-existing credit balance, not multiple same-day payments; FIFO-by-receipt-timestamp ordering is not stated. |
| 14 | yes | no | "allocation — ... the amount applied to each of fees, penalties, interest and principal, and any amount added to the credit balance. loan — updated per-instalment bucket balances, the updated credit balance, and instalment states" | The shape covers per-bucket amounts, resulting balances and credit_balance, but omits the reference's required tolerance_written_off field (a consequence of missing decision 10), so it is not a full match. |
