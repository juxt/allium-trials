# prose — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 8 · Captured: 9/14 · Bespoke captured: 3/8

## Conversation

### Round 1
_Step reasoning:_ The brief omits the component waterfall, instalment ordering, over/underpayment handling, and rounding rules, which cannot be reliably inferred and must come from the stakeholder.

Q: When a payment arrives, in what order should it be applied across an instalment's components (penalties, fees, interest, principal), and what is the exact waterfall?
A: Fees, then penalties, then interest, then principal.

Q: When multiple instalments are outstanding, in what order are they satisfied (e.g. oldest due date first), and must one instalment be fully cleared before the payment moves to the next, or is each component cleared across all instalments before moving to the next component?
A: Oldest instalment first. One instalment must be fully cleared across all four buckets before any payment moves to the next instalment.

Q: How should an overpayment be handled: excess held as a credit, refunded, or applied to future/principal, and how is a partial payment (less than the total owed) handled?
A: Overpayment: surplus is held as an unallocated credit balance and auto-applied to the next instalment when it falls due; it is never auto-refunded and does not prepay principal. Partial payment: strict waterfall order — fill each bucket in sequence; no proportional split.

Q: What are the rounding and currency-precision rules (smallest unit, rounding direction, and how any rounding remainder is assigned)?
A: Currency is BHD (3 decimal places, fils). Rounding is round-half-up to 3 dp. Any rounding residual is absorbed into the interest component.

### Round 2
_Step reasoning:_ Two material, non-inferable policy gaps remain: how a pre-existing credit balance interacts with the new payment, and whether not-yet-due instalments are eligible; both must be resolved before writing the spec.

Q: Is an already-standing unallocated credit balance on the loan combined with the incoming payment and allocated together in this run, or is the existing credit applied first (to the oldest instalment) before the new payment, and does the incoming payment ever get added to credit without touching instalments?
A: Existing credit balance and incoming payment are not explicitly covered as a combined-vs-sequential question in policy. [default, not policy] A reasonable default: the existing credit is applied first to the oldest outstanding due instalment before the incoming payment is allocated; the incoming payment is then allocated independently in the same waterfall against remaining balances. The incoming payment is never itself added to credit without first exhausting any due instalments.

Q: Which instalments are eligible for allocation in a given run: only those already due as of the payment date, or all outstanding instalments regardless of due date (i.e. can a payment pay down a future, not-yet-due instalment before its due date)?
A: Only instalments already due as of the payment value_date are eligible. An early or on-time payment settles the current due instalment only; any surplus becomes a credit balance and does not pay down future not-yet-due instalments, leaving future interest unchanged.

### Round 3
_Step reasoning:_ Core waterfall, ordering, overpayment, eligibility and rounding are settled; two implementation-material policy edges remain (residual scope and the no-due-instalment / non-positive-payment cases) before I can spec correctly.

Q: The rounding residual is absorbed into interest — is that applied to each instalment's interest bucket as that instalment is cleared, or computed once against a single interest figure at the very end of the whole allocation run?
A: The rounding residual is absorbed per instalment as each instalment is cleared — not aggregated and resolved at the end of the run. Each instalment's interest bucket absorbs any fils discrepancy arising from that instalment's arithmetic before the algorithm moves to the next. [default, not policy for the per-instalment vs end-of-run split; the key states only that interest absorbs the residual, not the timing]

Q: When no instalment is currently due as of value_date (all future, or none outstanding), does the entire incoming payment become unallocated credit? And how should a zero or negative payment amount be handled — rejected as invalid, or treated as a no-op returning the loan unchanged?
A: Yes — if no instalment is due as of value_date, the entire incoming payment becomes an unallocated credit balance. For payment amount: a negative value is rejected with an error; a zero amount is a no-op that still records a zero-value allocation transaction.

### Round 4 (process signalled done)
_Step reasoning:_ All material policy decisions (waterfall order, instalment sequencing, overpayment/partial handling, BHD rounding and residual placement, credit combination, due-date eligibility, and zero/negative edge cases) are now captured, and the last two rounds returned non-policy defaults, signalling diminishing returns; remaining data-shape and output details are mine to establish per the brief.

(no questions this round)

## Produced specification

# Requirements specification: `allocate_payment(payment, loan)`

## 1. Purpose and scope

This specification defines the behaviour of a single function, `allocate_payment(payment, loan)`, in a loan servicing system. When a borrower makes a payment, the function determines how that money is applied across the amounts currently owed on the loan and returns both the allocation (a record of what was applied where) and the loan's updated balances. It does not schedule payments, generate ledgers beyond the returned transaction, or handle disbursement or refunds.

## 2. Domain model

### 2.1 Loan

A loan carries:

- A collection of **instalments**, each with a due date and four owed **components** (buckets): fees, penalties, interest and principal.
- An **unallocated credit balance**: money already held on the loan that has not yet been applied to any instalment. May be zero.

### 2.2 Instalment

Each instalment has:

- A **due date**.
- Four outstanding component balances, each a non-negative BHD amount: `fees`, `penalties`, `interest`, `principal`.
- A **status** derived from its balances: an instalment is *cleared* when all four component balances are zero.

An instalment is **due** (eligible for allocation) if its due date is on or before the payment's `value_date`. Instalments with a due date after `value_date` are **not yet due** and are never touched by an allocation run (see §5.2).

### 2.3 Payment

The `payment` input carries at least:

- An **amount** in BHD.
- A **value_date**: the effective date used to decide which instalments are due.

## 3. Currency, precision and rounding

- Currency is **BHD (Bahraini dinar)**, with **3 decimal places** (fils). One fils is 0.001 BHD, the smallest representable unit.
- All amounts are held and returned at 3 dp.
- Rounding is **round-half-up to 3 dp**.
- Any rounding residual (a fils-level discrepancy arising from the arithmetic of clearing an instalment) is **absorbed into that instalment's interest component**.
- The residual is absorbed **per instalment, as each instalment is cleared**, before the algorithm moves on to the next instalment. It is not aggregated and resolved once at the end of the run. (Note: the stakeholder confirmed interest absorbs the residual; the per-instalment timing rather than end-of-run was resolved as the working default.)

## 4. Component waterfall within an instalment

Within a single instalment, an available amount of money is applied to the four components in this strict order:

1. **Fees**
2. **Penalties**
3. **Interest**
4. **Principal**

Each bucket is filled in sequence: the current bucket is paid down to zero before any money moves to the next bucket. There is **no proportional split** across buckets. If the available money runs out partway through a bucket, that bucket is partially paid and the remaining buckets are left untouched.

## 5. Instalment ordering and eligibility

### 5.1 Ordering

When more than one instalment is outstanding, they are satisfied **oldest due date first**. One instalment must be **fully cleared across all four buckets** before any money moves to the next instalment. Money is never spread across instalments component-by-component; each instalment is completed (or exhausts the available money) before the next begins.

### 5.2 Eligibility

Only instalments **already due as of `value_date`** are eligible for allocation. A payment never pays down a future, not-yet-due instalment, even if money remains after all due instalments are cleared. An early or on-time payment settles the current due instalment(s) only; any surplus becomes credit (see §6). Future interest is therefore left unchanged by prepayment.

## 6. Overpayment, partial payment and credit

- **Partial payment** (less than the total currently owed on the due instalments): apply in strict waterfall order (oldest instalment first, fees→penalties→interest→principal within each) until the money is exhausted. Whatever is unpaid remains owed. No proportional split.
- **Overpayment / surplus**: any money remaining after all *due* instalments are fully cleared is held as an **unallocated credit balance** on the loan. This surplus:
  - is **auto-applied to the next instalment when it falls due**;
  - is **never auto-refunded**;
  - **does not prepay principal** and does not pay down any not-yet-due instalment during this run.

## 7. Interaction of existing credit with the incoming payment

(The combined-vs-sequential treatment of a standing credit balance was not fixed by policy; the following is the resolved working default.)

1. If the loan already carries an unallocated credit balance, that **existing credit is applied first**, to the **oldest outstanding due instalment**, using the standard instalment ordering and component waterfall.
2. The **incoming payment is then allocated independently**, in the same waterfall, against the balances that remain after the existing credit has been applied.
3. The incoming payment is **never itself added to credit without first exhausting any due instalments**. Only after all due instalments are cleared does any leftover incoming money become credit.

## 8. Edge cases

- **No instalment due as of `value_date`** (all instalments are in the future, or none are outstanding): the entire incoming payment becomes **unallocated credit balance**. Any existing credit likewise has nothing due to apply against and remains as credit.
- **Zero payment amount**: treated as a **no-op** with respect to balances, but the function **still records a zero-value allocation transaction** and returns the loan unchanged.
- **Negative payment amount**: **rejected with an error**. No allocation is performed and the loan is not modified.

## 9. Algorithm (normative summary)

Given `payment` (amount, value_date) and `loan`:

1. **Validate.** If `payment.amount < 0`, reject with an error and make no changes. If `payment.amount == 0`, record a zero-value allocation transaction and return the loan unchanged.
2. **Determine due instalments.** Select instalments whose due date is ≤ `value_date`. Sort them oldest due date first.
3. **Apply existing credit.** Using the loan's current unallocated credit balance, walk the due instalments oldest-first; within each, fill fees→penalties→interest→principal. Fully clear an instalment before moving to the next. Stop when credit is exhausted or all due instalments are cleared. Reduce the credit balance by the amount applied.
4. **Apply the incoming payment.** Using `payment.amount`, repeat the same oldest-first, fees→penalties→interest→principal walk against the balances remaining after step 3.
5. **Absorb rounding per instalment.** As each instalment is cleared, absorb any fils-level rounding residual from that instalment's arithmetic into its interest bucket before proceeding to the next instalment. All amounts round-half-up to 3 dp.
6. **Handle surplus.** Any incoming money remaining after all due instalments are cleared is added to the loan's unallocated credit balance. It is not applied to not-yet-due instalments, not applied to principal ahead of schedule, and not refunded.
7. **Return** the allocation record and the loan's updated balances.

## 10. Return value

The function returns:

- An **allocation record** (the transaction): for the run, the amounts applied broken down by instalment and by component (fees, penalties, interest, principal), the amount of existing credit consumed, the amount of the incoming payment consumed, and the surplus moved to credit. A zero payment yields a zero-value allocation record.
- The **loan's updated balances**: each instalment's remaining component balances after allocation, and the loan's resulting unallocated credit balance.

## 11. Invariants

- No component balance is ever negative.
- Total money accounted for (applied to instalments + moved to/remaining as credit) equals existing credit consumed plus incoming payment, at 3 dp.
- No not-yet-due instalment is modified by any run.
- Every run returns an allocation transaction, including zero-value runs.
- All returned amounts are BHD at 3 dp, rounded half-up, with per-instalment rounding residual absorbed into interest.

## Auditor verdict

_The spec nails the inferable decisions and most of the precision/ordering set: 1, 2, 3, 4, 5, 6, 8, 9, 11 are all correct (9/14). The elicitation gap concentrates exactly where the reference predicts, on the genuinely bespoke temporal and forgiveness policies: back-valued re-accrual (7), write-off tolerance (10), penalty accrual timing (12) and same-day FIFO (13) are entirely absent. Decision 14's return shape is addressed but incomplete, missing tolerance_written_off as a downstream consequence of never surfacing the write-off tolerance. Coverage = 9/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §4: "1. Fees 2. Penalties 3. Interest 4. Principal" filled "in this strict order" | Spec states the exact reference order fees→penalties→interest→principal, with fees before penalties as required. |
| 2 | yes | **yes** | §5.1: "satisfied oldest due date first. One instalment must be fully cleared across all four buckets before any money moves to the next instalment." | Matches the reference: oldest instalment cleared across all four buckets before touching the next. |
| 3 | yes | **yes** | §6: "held as an unallocated credit balance... auto-applied to the next instalment when it falls due; never auto-refunded; does not prepay principal" | All three reference properties (credit balance, auto-apply next instalment, never refunded) are stated. |
| 4 | yes | **yes** | §3: "Currency is BHD (Bahraini dinar), with 3 decimal places (fils)... All amounts are held and returned at 3 dp." | Correctly identifies BHD and 3 dp precision matching the reference. |
| 5 | yes | **yes** | §3: "Rounding is round-half-up to 3 dp." | Matches round half-up to the minor unit exactly. |
| 6 | yes | **yes** | §3: "Any rounding residual... is absorbed into that instalment's interest component." | Residual lands in interest, matching the reference destination. |
| 7 | no | no | absent | value_date is only used to decide which instalments are due (§2.3); the spec never mentions recomputing/re-accruing interest to an earlier back-valued date. |
| 8 | yes | **yes** | §5.2: "An early or on-time payment settles the current due instalment(s) only; any surplus becomes credit... Future interest is therefore left unchanged by prepayment." | Explicitly states surplus becomes credit, no principal prepayment, future interest unchanged. |
| 9 | yes | **yes** | §6: "apply in strict waterfall order... No proportional split." | Strict in-order fill with no proportional split, matching the reference. |
| 10 | no | no | absent | The spec's only residual concept is rounding absorption into interest (§3); there is no write-off tolerance of ≤0.005 BHD marking an instalment fully paid. |
| 11 | yes | **yes** | §8: "Zero payment amount: treated as a no-op... still records a zero-value allocation transaction... Negative payment amount: rejected with an error." | Negative rejected, zero is a no-op that still records a zero-value transaction, exactly as referenced. |
| 12 | no | no | absent | The spec never mentions penalty accrual up to the value date before allocation; it treats penalty balances as pre-existing without an accrual step. |
| 13 | no | no | absent | The spec handles one payment per run and existing-credit-then-incoming ordering (§7), but never addresses multiple same-day payments applied FIFO by receipt timestamp. |
| 14 | yes | no | §10: "amounts applied broken down by instalment and by component... surplus moved to credit... the loan's resulting unallocated credit balance" | The return shape covers per-bucket/instalment amounts, outstanding balances and credit created, but omits tolerance_written_off (consistent with its missing tolerance concept), so it does not fully match the reference shape. |
