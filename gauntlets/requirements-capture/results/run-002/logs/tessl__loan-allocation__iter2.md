# tessl — loan-allocation — iteration 2

Model (author): claude-opus · Questions asked: 13 · Captured: 13/14 · Bespoke captured: 8/8

## Conversation

### Round 1
_Step reasoning:_ Allocation order across components and across instalments is the central policy the brief omits and cannot be reliably inferred, so I ask it first before edge cases.

Q: When a payment is applied, in what order should it be allocated across the outstanding components — for example penalties first, then fees, then interest, then principal — and should the oldest instalment be fully satisfied before moving to the next, or should one component type be cleared across all instalments before moving to the next component?
A: Allocation order within an instalment is: fees first, then penalties, then interest, then principal. The oldest overdue instalment must be cleared in full across all four buckets before any payment is applied to the next instalment.

### Round 2
_Step reasoning:_ Allocation order is settled; overpayment handling is the next highest-impact policy gap and cannot be reliably inferred.

Q: If the payment is larger than the total currently owed across all outstanding instalments, how should the excess be handled — applied forward to reduce the next not-yet-due instalment, held as an unallocated credit on the loan, or returned/refunded to the borrower?
A: Surplus is held as an unallocated credit balance on the loan and auto-applied to the next instalment when it falls due. It is never auto-refunded.

### Round 3
_Step reasoning:_ Scope, ordering and surplus are settled; monetary precision/rounding is the next highest-impact policy that cannot be inferred and would otherwise cause reconciliation errors.

Q: When a payment only partially covers a bucket (e.g. it runs out partway through the interest owed on the oldest instalment), I assume it simply reduces that bucket by the amount available and stops — but I need the monetary precision rule: what currency unit and rounding convention should allocation use (e.g. round each bucket allocation to whole cents, and if so, half-up, half-even, or truncate), so that the sum of allocations always reconciles exactly to the payment with no lost or phantom fractions?
A: The loan is denominated in BHD (Bahraini dinar), which has 3 decimal places (fils). Round each bucket allocation half-up to 3 dp. Any rounding residual that causes the sum of bucket allocations to diverge from the payment amount is absorbed into the interest component.

### Round 4
_Step reasoning:_ Three core policy decisions (ordering, surplus, rounding) are settled; the surplus rule introduced a credit-balance concept whose interaction with subsequent payments is a material, non-inferable policy gap worth resolving before concluding.

Q: You've defined an unallocated credit balance that holds surplus and auto-applies when the next instalment falls due. When a *new* payment arrives while an unallocated credit already exists on the loan, how should the two interact — is the existing credit drawn down first (or combined with the new payment) and allocated through the same fees→penalties→interest→principal waterfall before any surplus re-accumulates, or is the new payment allocated independently and the prior credit left untouched until its instalment falls due?
A: [default, not policy] The new payment is allocated independently through the fees→penalties→interest→principal waterfall against outstanding balances. The existing credit balance is left untouched and continues to sit unallocated until the next instalment falls due, at which point it auto-applies as already defined. The two are not combined.

### Round 5
_Step reasoning:_ The four core allocation policies are settled; input validation for zero/negative/sub-fils payments remains a genuine institution-specific policy choice, not something inferable.

Q: How should the function handle a non-positive or malformed payment amount — specifically, if `payment` is zero, negative, or has more than 3 decimal places (sub-fils precision), should it reject with an error, no-op and return the loan unchanged, or round/coerce the input before allocating?
A: Negative payment amounts are rejected with an error. Zero is a no-op but still records a zero-value allocation transaction — it does not leave the loan state unchanged in the audit sense. Sub-fils precision (more than 3 decimal places) is not covered by policy; [default, not policy] the input should be rounded half-up to 3 dp before allocation proceeds, treating it as a valid payment at the rounded amount.

### Round 6
_Step reasoning:_ The Round 3 residual-to-interest rule is undefined when the interest bucket is zero or already cleared; this is a genuine policy gap that affects exact reconciliation, so I ask one final targeted question before concluding.

Q: Your rounding rule absorbs any residual into the interest component — but what should happen when the oldest instalment being allocated has a zero (or already-satisfied) interest bucket, so there is no interest to absorb the residual into? Should the residual then fall to the next component in the waterfall (principal), to the next non-zero bucket in order (fees→penalties→interest→principal), or be carried onto the interest bucket of the next instalment?
A: [default, not policy] If the interest bucket on the oldest instalment is zero or already fully satisfied and cannot absorb the rounding residual, the residual should fall to the principal bucket of the same instalment — the next component in the waterfall. It is not carried forward to the next instalment's interest bucket.

### Round 7
_Step reasoning:_ All material, non-inferable policy decisions appear captured and recent rounds only yielded defaults; presenting the consolidated summary for explicit stakeholder confirmation per the process before completing.

Q: I believe I now have every material policy decision needed. Before I hand these off for spec authoring, please confirm this consolidated summary is accurate:

Scope — `allocate_payment(payment, loan)` applies a single payment across the loan's outstanding instalments and returns the per-bucket allocation plus the loan's updated balances. In scope: allocation across outstanding instalments, surplus handling, rounding, input validation, interaction with an existing credit balance. Out of scope: the later auto-application of credit when a future instalment falls due (a separate event).

Core behaviour (happy path) — Within an instalment, allocate in the order fees → penalties → interest → principal. The oldest overdue instalment must be fully cleared across all four buckets before any amount is applied to the next. Partial coverage reduces the current bucket by the amount available and stops.

Surplus — Any amount beyond total outstanding is held as an unallocated credit balance on the loan; never auto-refunded. If a credit balance already exists when a new payment arrives, the new payment is allocated independently through the waterfall and the existing credit is left untouched; the two are not combined.

Precision — Loan is denominated in BHD (3 dp / fils). Round each bucket allocation half-up to 3 dp. Any rounding residual is absorbed into the interest bucket of the instalment being allocated; if that interest bucket is zero or already satisfied, the residual falls to the principal bucket of the same instalment (not carried to the next instalment). The sum of allocations must reconcile exactly to the payment.

Input handling — Negative payment: reject with an error. Zero: no-op allocation but still records a zero-value allocation transaction (not a silent no-change). More than 3 dp (sub-fils): round half-up to 3 dp and proceed as a valid payment at the rounded amount.

Is this summary correct and complete, or is there any policy I've mis-stated or missed?
A: The summary is accurate for every policy it states — no mis-statements. It is not complete, however. Several material decisions in scope for `allocate_payment` were never raised and are therefore absent: (1) how back-valued payments (value_date earlier than today) are handled before allocation runs; (2) when and how penalties accrue on the allocation date itself; (3) a write-off tolerance that can close an instalment even if a small residual remains; (4) how same-day multiple payments interact; and (5) the required shape of the return value. You will want to ask about each of these before handing off for spec authoring.

### Round 8
_Step reasoning:_ The stakeholder confirmed my summary is accurate but flagged five material in-scope decisions never raised; per the one-question-at-a-time rule I ask the highest-impact one (back-valued payments) first before the remaining four.

Q: Let's take the back-valued payment case first, since it affects everything downstream: when a payment arrives with a value_date earlier than today, how should `allocate_payment` treat it before running the waterfall — should it reject back-dated payments outright, allocate them as of today's date ignoring the earlier value_date, or re-compute the loan's outstanding position (penalties/interest) as it stood on the earlier value_date and allocate against that historical state?
A: Interest is recomputed (re-accrued) to the value_date before allocation runs. Allocation proceeds against that post-recomputation position, not against today's outstanding balances.

### Round 9
_Step reasoning:_ Round 8 resolved back-valued payments (item 1 of the five gaps the stakeholder flagged in Round 7); four remain, and asking one at a time I take penalty accrual on the allocation date next since it, like interest re-accrual, changes the outstanding position the waterfall sees.

Q: Staying with accrual before allocation: on the allocation date itself, when and how do penalties accrue — should `allocate_payment` first assess/post any penalty that becomes due as of the value_date (so a newly-triggered penalty is part of the outstanding position the waterfall allocates against), or does it allocate only against penalties already posted to the loan and never trigger a new penalty itself?
A: Penalties accrue up to and including the value_date before the waterfall runs. Allocation then proceeds against the post-accrual balances, so any penalty that becomes due as of the value_date is part of the outstanding position the waterfall allocates against.

### Round 10
_Step reasoning:_ Two of the five gaps the stakeholder flagged in round 7 are resolved (back-valued payments, penalty accrual); write-off tolerance, same-day multiple payments, and return-value shape remain, so I take them one at a time per the one-question-at-a-time rule, starting with write-off tolerance.

Q: Let's turn to the write-off tolerance you flagged. When an instalment's buckets are all but cleared and only a tiny residual remains after allocation, should `allocate_payment` treat the instalment as fully closed once the outstanding residual falls at or below some tolerance — and if so, what is the tolerance threshold (e.g. a fixed number of fils such as 0.001–0.005 BHD, or a percentage of the instalment), which bucket(s) does the written-off residual come from, and should the write-off be recorded as its own line in the allocation result?
A: If the total remaining owed across all buckets of an instalment is 0.005 BHD or less after allocation, the instalment is marked fully paid and the residual is written off. The threshold is a fixed amount (0.005 BHD), not a percentage. The written-off residual should be recorded as a tolerance_written_off field in the result for that instalment, as a distinct line in the allocation output.

### Round 11
_Step reasoning:_ Two of the five gaps the stakeholder flagged in Round 7 remain unaddressed (same-day multiple payments and the return value shape); asking about same-day interaction next, one question at a time, before the return-shape question.

Q: Let's address same-day multiple payments. When more than one payment arrives against the loan on the same value_date, how should `allocate_payment` treat them — is each payment allocated independently in arrival order against the then-current outstanding position (so the second payment sees balances already reduced by the first), should same-day payments be aggregated into a single combined amount and allocated once through the waterfall, or is there an ordering/netting rule (e.g. by timestamp, or all debits before credits) that determines the sequence before allocation runs?
A: Each payment is allocated independently in arrival order (FIFO by receipt timestamp). The second payment sees the outstanding balances already reduced by the first; same-day payments are never aggregated.

### Round 12
_Step reasoning:_ Four of the five gaps the stakeholder flagged in round 7 are resolved; only the required return-value shape remains, so I ask that before concluding.

Q: Finally, let's nail down the required shape of the return value, since spec authoring depends on it. What exactly must `allocate_payment` return — specifically: (a) should it return the per-instalment, per-bucket allocation breakdown (how much of the payment went to fees/penalties/interest/principal on each instalment), (b) the loan's full updated balances including each instalment's remaining buckets and the unallocated credit balance, (c) the new surplus/credit created by this payment, (d) the tolerance_written_off line(s), and (e) the recorded allocation transaction (including the zero-value case)? And should this be a single structured object, and are there any required field names or a required nesting (e.g. allocations keyed by instalment id) the spec must follow?
A: Return a single structured object per payment containing: (a) the amount applied to each bucket (fees, penalties, interest, principal) for each instalment touched — keyed by instalment id; (b) the resulting outstanding balance of each bucket on each affected instalment; (c) any credit_balance created or incremented by this payment; (d) a tolerance_written_off field on each instalment where the tolerance rule fired, recorded as a distinct line. Required field names per the answer key are: allocations (per-instalment, per-bucket breakdown), outstanding balances, credit_balance, and tolerance_written_off. Beyond those four, naming conventions, nesting depth, and the exact shape of the allocation transaction record (including the zero-value case) are [default, not policy] — a reasonable default is a top-level allocations array of instalment objects each containing bucket_allocations, remaining_balances, and tolerance_written_off, with a top-level credit_balance field and a top-level transaction record (amount, value_date, timestamp) that is present even for zero-value payments.

### Round 13
_Step reasoning:_ All five gaps the stakeholder flagged in Round 7 are now answered; I must present the updated consolidated summary and obtain explicit confirmation before hand-off, per the process.

Q: Thank you — those five fill the gaps you identified. Here is the updated consolidated summary incorporating every policy, for a final confirmation before hand-off:

Scope — `allocate_payment(payment, loan)` applies a single payment across the loan's outstanding instalments and returns the per-bucket allocation plus the loan's updated balances. In scope: accrual to value_date before allocation, back-valued handling, allocation across instalments, surplus/credit handling, rounding, write-off tolerance, same-day multiple payments, input validation, interaction with an existing credit balance, and the return shape. Out of scope: the later auto-application of credit when a future instalment falls due (a separate event).

Accrual before allocation — Interest is recomputed (re-accrued) to the payment's value_date, and penalties accrue up to and including the value_date, before the waterfall runs. Allocation proceeds against this post-accrual, post-recomputation position, not against today's balances. Back-valued payments (value_date earlier than today) are allocated against the loan's position as it stood on the value_date; they are not rejected and not treated as of today.

Core behaviour (happy path) — Within an instalment, allocate in the order fees → penalties → interest → principal. The oldest overdue instalment must be fully cleared across all four buckets before any amount is applied to the next. Partial coverage reduces the current bucket by the amount available and stops.

Same-day multiple payments — Each payment is allocated independently in arrival order (FIFO by receipt timestamp); the second payment sees balances already reduced by the first. Same-day payments are never aggregated.

Surplus — Any amount beyond total outstanding is held as an unallocated credit balance on the loan; never auto-refunded. If a credit balance already exists when a new payment arrives, the new payment is allocated independently through the waterfall and the existing credit is left untouched; the two are not combined.

Precision — Loan is denominated in BHD (3 dp / fils). Round each bucket allocation half-up to 3 dp. Any rounding residual is absorbed into the interest bucket of the instalment being allocated; if that interest bucket is zero or already satisfied, the residual falls to the principal bucket of the same instalment (not carried to the next instalment). The sum of allocations must reconcile exactly to the payment.

Write-off tolerance — If the total remaining owed across all buckets of an instalment is 0.005 BHD or less after allocation, the instalment is marked fully paid and the residual is written off. The threshold is a fixed amount (0.005 BHD), not a percentage. The written-off residual is recorded as a distinct `tolerance_written_off` field on that instalment in the result.

Input handling — Negative payment: reject with an error. Zero: no-op allocation but still records a zero-value allocation transaction (not a silent no-change). More than 3 dp (sub-fils): round half-up to 3 dp and proceed as a valid payment at the rounded amount.

Return value — A single structured object per payment containing: (a) `allocations` — the per-instalment, per-bucket breakdown (fees/penalties/interest/principal applied) keyed by instalment id; (b) the resulting outstanding balance of each bucket on each affected instalment; (c) `credit_balance` created or incremented by this payment; (d) a `tolerance_written_off` field on each instalment where the tolerance rule fired. A reasonable default shape (not policy) is a top-level `allocations` array of instalment objects each with `bucket_allocations`, `remaining_balances`, and `tolerance_written_off`, a top-level `credit_balance`, and a top-level transaction record (amount, value_date, timestamp) present even for zero-value payments.

Is this summary now accurate and complete, or is there any remaining policy I've mis-stated or missed?
A: The summary is accurate and complete. Every policy decision in scope for `allocate_payment` is correctly stated, and no policy has been mis-stated or omitted. It is ready for hand-off to spec authoring.

### Round 14 (process signalled done)
_Step reasoning:_ The stakeholder has explicitly confirmed the consolidated summary is accurate and complete across all policy areas, so the requirement-gathering process is finished and ready for hand-off.

(no questions this round)

## Produced specification

# Requirements specification — `allocate_payment(payment, loan)`

## Scope

`allocate_payment(payment, loan)` applies a single payment across a loan's outstanding instalments and returns a structured result describing how the payment was applied together with the loan's updated balances.

**In scope:**
- Accrual of interest and penalties up to the payment's value_date before allocation runs
- Handling of back-valued payments (value_date earlier than today)
- Allocation of the payment across outstanding instalments and their buckets
- Surplus handling via an unallocated credit balance
- Interaction between a new payment and a pre-existing credit balance
- Monetary rounding and residual absorption
- Write-off tolerance for near-cleared instalments
- Same-day multiple-payment sequencing
- Input validation (negative, zero, sub-fils precision)
- The shape of the return value

**Out of scope:**
- The later auto-application of an unallocated credit balance when a future instalment falls due. That is a separate event triggered when the next instalment becomes due, not part of this function's responsibility.

## Domain model

A loan carries one or more outstanding instalments. Each instalment has four component buckets, each with an owed balance:

- **fees**
- **penalties**
- **interest**
- **principal**

The loan also carries an **unallocated credit balance** that holds surplus from prior payments.

The loan is denominated in **BHD (Bahraini dinar)**, which has 3 decimal places (fils).

## Accrual before allocation

Before the waterfall runs, the loan's outstanding position is brought up to the payment's value_date:

1. **Interest** is recomputed (re-accrued) to the value_date.
2. **Penalties** accrue up to and including the value_date. Any penalty that becomes due as of the value_date is posted and becomes part of the outstanding position that the waterfall allocates against. The function does assess and post newly-due penalties; it does not allocate only against previously-posted penalties.

Allocation then proceeds against this post-accrual, post-recomputation position, not against today's balances.

### Back-valued payments

A payment whose value_date is earlier than today is **not rejected** and is **not** treated as of today. Instead, the loan's outstanding position (interest and penalties) is recomputed as it stood on the earlier value_date, and allocation proceeds against that historical state.

## Core allocation behaviour (happy path)

### Bucket order within an instalment

Within a single instalment, the payment is allocated across buckets in this fixed order:

1. fees
2. penalties
3. interest
4. principal

### Instalment order

The oldest overdue instalment must be cleared in full across all four buckets before any amount is applied to the next instalment. Allocation is instalment-by-instalment (oldest first), fully satisfying each instalment's four buckets before moving on — not component-type-by-component-type across instalments.

### Partial coverage

When the payment runs out partway through a bucket, that bucket is reduced by the amount available and allocation stops. No further buckets or instalments are touched.

## Surplus handling

If the payment exceeds the total currently outstanding across all instalments, the excess is held as an **unallocated credit balance** on the loan. It is never auto-refunded to the borrower. (Its later auto-application when the next instalment falls due is a separate, out-of-scope event.)

### Interaction with an existing credit balance

> Resolved as a reasonable default (not stakeholder policy), per the one-question-at-a-time interview: the stakeholder confirmed this as the sensible default.

When a new payment arrives while an unallocated credit balance already exists on the loan, the new payment is allocated independently through the fees → penalties → interest → principal waterfall against the outstanding balances. The existing credit balance is left untouched and continues to sit unallocated until the next instalment falls due, at which point it auto-applies as defined elsewhere. The existing credit and the new payment are **not** combined or drawn down together.

## Monetary precision and rounding

- All amounts are in BHD with 3 decimal places (fils).
- Each bucket allocation is rounded **half-up to 3 decimal places**.
- The sum of all bucket allocations must reconcile **exactly** to the payment amount, with no lost or phantom fractions.
- Any rounding residual that causes the sum of bucket allocations to diverge from the payment amount is **absorbed into the interest bucket** of the instalment currently being allocated.

### Residual when interest cannot absorb it

> Resolved as a reasonable default (not stakeholder policy).

If the interest bucket on the instalment being allocated is zero or already fully satisfied and so cannot absorb the rounding residual, the residual falls to the **principal bucket of the same instalment** (the next component in the waterfall). The residual is **not** carried forward to the next instalment's interest bucket.

## Write-off tolerance

After allocation, if the total remaining owed across all buckets of an instalment is **0.005 BHD or less**, the instalment is marked fully paid and the remaining residual is written off.

- The threshold is a **fixed amount (0.005 BHD)**, not a percentage of the instalment.
- The written-off residual is recorded as a distinct **`tolerance_written_off`** field on that instalment in the result.

## Same-day multiple payments

When more than one payment arrives against the loan on the same value_date, each payment is allocated **independently in arrival order (FIFO by receipt timestamp)**. The second payment sees the outstanding balances already reduced by the first. Same-day payments are **never** aggregated into a single combined amount, and there is no netting rule beyond FIFO sequencing.

## Input validation

- **Negative payment amount:** reject with an error.
- **Zero payment:** treated as a no-op for allocation, but it still records a zero-value allocation transaction. It does not leave the loan state unchanged in the audit sense; the transaction is recorded.
- **More than 3 decimal places (sub-fils precision):** not covered by explicit policy. Resolved as a reasonable default (not stakeholder policy): round the input **half-up to 3 dp** before allocation proceeds, then treat it as a valid payment at the rounded amount.

## Return value

The function returns a **single structured object per payment** containing at least the following, with the four required field names below:

1. **`allocations`** — the per-instalment, per-bucket breakdown of how much of the payment went to fees, penalties, interest and principal on each instalment touched, keyed by instalment id.
2. **outstanding balances** — the resulting outstanding balance of each bucket on each affected instalment.
3. **`credit_balance`** — any unallocated credit balance created or incremented by this payment.
4. **`tolerance_written_off`** — recorded on each instalment where the write-off tolerance rule fired, as a distinct line.

Beyond these four required field names, the exact naming conventions, nesting depth, and the precise shape of the allocation transaction record (including the zero-value case) are not fixed by policy.

> Resolved as a reasonable default (not stakeholder policy): a top-level `allocations` array of instalment objects, each containing `bucket_allocations`, `remaining_balances`, and `tolerance_written_off`; a top-level `credit_balance` field; and a top-level transaction record (`amount`, `value_date`, `timestamp`) that is present even for zero-value payments.

## Notes on provenance

Every policy above was confirmed by the stakeholder. Items explicitly flagged as "resolved as a reasonable default (not stakeholder policy)" were points the stakeholder marked `[default, not policy]`: the credit-interaction rule (round 4), the sub-fils rounding of input (round 5), the residual-to-principal fallback (round 6), and the detailed return shape beyond the four required field names (round 12). These defaults are recorded as such so spec authoring and later review can distinguish mandated policy from sensible defaults.

## Auditor verdict

_The spec is strong and resolves 13 of 14 reference decisions correctly, including the genuinely bespoke ones (fees-before-penalties order, BHD 3-dp, residual-to-interest, value-date recompute, 0.005 tolerance). The single miss is decision 8: the spec never states that an early/on-time surplus settles only the current instalment without prepaying principal, and its cascading-allocation language arguably implies surplus could flow into future instalments' principal, so the distinctive no-prepay/future-interest-unchanged rule is not established. Coverage = 13/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Within a single instalment, the payment is allocated across buckets in this fixed order: 1. fees 2. penalties 3. interest 4. principal" | The spec states fees → penalties → interest → principal, matching the reference's deliberate fees-before-penalties ordering exactly. |
| 2 | yes | **yes** | "The oldest overdue instalment must be cleared in full across all four buckets before any amount is applied to the next instalment." | Matches the reference: oldest instalment fully satisfied across all four buckets before touching the next, not component-by-component across instalments. |
| 3 | yes | **yes** | "the excess is held as an unallocated credit balance on the loan. It is never auto-refunded to the borrower. (Its later auto-application when the next instalment falls due...)" | Credit balance, auto-applied on next instalment, never auto-refunded — matches the reference precisely. |
| 4 | yes | **yes** | "The loan is denominated in BHD (Bahraini dinar), which has 3 decimal places (fils)." | Correctly identifies BHD as a 3-dp currency rather than defaulting to 2 dp. |
| 5 | yes | **yes** | "Each bucket allocation is rounded half-up to 3 decimal places." | Half-up rounding to the 3-dp minor unit matches the reference method exactly. |
| 6 | yes | **yes** | "Any rounding residual ... is absorbed into the interest bucket of the instalment currently being allocated." | Primary rule routes the residual into interest, matching the reference; the principal fallback is an explicitly-flagged default for the edge case and does not override the mandated interest destination. |
| 7 | yes | **yes** | "A payment whose value_date is earlier than today ... the loan's outstanding position (interest and penalties) is recomputed as it stood on the earlier value_date, and allocation proceeds against that historical state." | Interest is re-accrued to the earlier value_date before allocation, matching the reference's recompute-to-value-date choice. |
| 8 | yes | no | "If the payment exceeds the total currently outstanding across all instalments, the excess is held as an unallocated credit balance" — but no rule that an early payment settles the current instalment only or that principal is not prepaid. | The reference requires that an early/on-time surplus settles only the current instalment and does NOT prepay principal, leaving future interest unchanged. The spec's cascading rule ('cleared in full ... before the next instalment', surplus only when payment exceeds total across ALL instalments) plausibly flows surplus into future instalments' principal, and it never states that principal is not prepaid or that future interest is unchanged. The distinctive non-arrears decision is not resolved to the reference value. |
| 9 | yes | **yes** | "When the payment runs out partway through a bucket, that bucket is reduced by the amount available and allocation stops. No further buckets or instalments are touched." | Strict in-order fill with no proportional split, matching the reference. |
| 10 | yes | **yes** | "if the total remaining owed across all buckets of an instalment is 0.005 BHD or less, the instalment is marked fully paid and the remaining residual is written off." | Fixed 0.005 BHD threshold, mark-paid, write off residual — matches the reference exactly. |
| 11 | yes | **yes** | "Negative payment amount: reject with an error. Zero payment: treated as a no-op for allocation, but it still records a zero-value allocation transaction." | Negative rejected, zero a no-op that still records a transaction, matching the reference contract. |
| 12 | yes | **yes** | "Penalties accrue up to and including the value_date ... Allocation then proceeds against this post-accrual, post-recomputation position." | Accrue penalties through the value_date then allocate on post-accrual balances, matching the reference. |
| 13 | yes | **yes** | "each payment is allocated independently in arrival order (FIFO by receipt timestamp). The second payment sees the outstanding balances already reduced by the first." | FIFO by timestamp, each allocated independently in turn, never aggregated — matches the reference. |
| 14 | yes | **yes** | "allocations — the per-instalment, per-bucket breakdown ...; outstanding balances ...; credit_balance ...; tolerance_written_off ..." | Returns per-bucket per-instalment amounts applied, resulting outstanding balances, credit_balance created, and tolerance_written_off — covering all four elements the reference requires. |
