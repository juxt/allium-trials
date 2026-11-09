# openspec — loan-allocation — iteration 2

Model (author): claude-opus · Questions asked: 13 · Captured: 13/14 · Bespoke captured: 7/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured prompt didn't go through. Let me put the questions in plain text so you can answer them directly. These are the policy decisions the brief leaves open — each has several plausible answers, and I need your institution's specific choice to implement `allocate_payment` correctly.

**1. Top-level waterfall shape (across instalments).** When several instalments are outstanding, how does a payment move across them?
- (a) **Per-instalment, oldest first** — fully settle the oldest instalment (all its components) before touching the next.
- (b) **Per-component across all instalments** — sweep by type: all penalties (every instalment), then all fees, then all interest, then all principal.
- (c) **Current-due first, then arrears** — reverse chronological.

**2. Component order within the chosen grouping.** In what order are penalties / fees / interest / principal paid down?
- e.g. Penalties → Fees → Interest → Principal, or Fees → Penalties → Interest → Principal, or Interest → Principal → Fees → Penalties, etc.

**3. Instalment ordering key.** Oldest *due date* first (FIFO)? Or some other key (e.g. highest penalty)?

**4. Overpayment / surplus.** If the payment exceeds everything currently owed:
- (a) hold as unallocated credit/suspense, (b) prepay future principal (curtailment), (c) refund, or (d) reject.

**5. Partial payment.** If a payment can't fully clear a component it reaches:
- (a) partially pay it and stop, (b) all-or-nothing per component, or (c) all-or-nothing per instalment.

**6. Rounding & currency.** What's the smallest money unit (e.g. whole cents / integer minor units), and how should rounding work? Is `payment` passed as a decimal amount or integer minor units?

**7. Inputs & return shape.** Any constraints on the `loan` structure (how instalments/components are represented) and what `allocate_payment` should return (allocation breakdown + updated balances — any required field names or an immutability requirement)?

A few smaller ones that affect correctness:

**8. Zero / negative payment** — reject, or treat zero as a no-op?

**9. Interest accrual** — is interest fixed as given on the instalment at allocation time, or recomputed (e.g. interest-to-date) as part of allocation? I'll assume allocation uses the balances as presented unless you say otherwise.

Answer whichever you can; for anything you'd rather I default, say so and I'll record the assumption in the spec.
A: 1. Option (a): per-instalment, oldest first. Clear every component of the oldest instalment before any money touches the next.

2. Within each instalment: Fees → Penalties → Interest → Principal. Fees before penalties.

3. Oldest due date first (FIFO).

4. Option (a): hold as an unallocated credit balance. Auto-applied to the next instalment when it falls due. Never auto-refunded, never used to prepay principal.

5. Option (a): partially pay the component and stop. Strict sequential fill; no proportional split, no all-or-nothing gating.

6. Currency is BHD (Bahraini dinar), 3 decimal places (fils). Round half-up to 3 dp throughout. Rounding residuals are absorbed into the interest component. Pass and store amounts as decimals to 3 dp.

7. Return shape per payment: amount applied to each bucket of each instalment touched, resulting outstanding balances per bucket, credit_balance created (if any), tolerance_written_off (if any). No mandated field names beyond those concepts. [default, not policy] on immutability: treat input loan structure as immutable and return a new allocation result.

8. Negative payment: rejected with an error. Zero payment: no-op, but still record a zero-value allocation transaction.

9. Interest is recomputed. If the payment carries a value_date earlier than today, re-accrue interest to that value_date before running allocation. Penalties likewise accrue up to and including value_date; allocation then runs on those post-accrual balances.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Thanks — that resolves most of it. Your own answers introduced two concepts (a `tolerance_written_off` and interest/penalty re-accrual) whose mechanics are still underspecified and genuinely affect the result. A few targeted follow-ups:

**A. Tolerance write-off.** You listed `tolerance_written_off` as an output. What triggers it and what's the threshold?
- Is it an **underpayment** tolerance (borrower pays slightly *less* than an instalment's total, within X fils → treat the instalment as fully settled and write off the shortfall)?
- Or a **residual** cleanup (after allocation, a tiny leftover owed ≤ X fils is written off)?
- What is X, in fils (e.g. 5 fils, 10 fils)? And does it apply per-instalment or per-payment?

**B. Interest & penalty accrual mechanics** (needed to recompute to `value_date`):
- **Interest day-count**: Actual/365, Actual/360, or 30/360? And where's the rate — a per-instalment annual rate field on the loan?
- Interest accrues on **outstanding principal of that instalment**, from when to `value_date`?
- **Penalty**: flat charge, or a daily rate? On the overdue **principal**, or the whole overdue instalment amount? From the due date to `value_date`?

**C. Pre-existing credit balance.** When `allocate_payment` runs and the loan already carries an unallocated `credit_balance` from a prior overpayment, and an instalment is now due — is that existing credit applied *first* (then the new payment), or does `allocate_payment` only handle the incoming payment and leave stored credit for a separate process?

**D. Eligible instalments.** Should allocation only touch instalments **already due** as of `value_date` (anything beyond becomes credit, consistent with your "never prepay principal" rule)? Or can it reach not-yet-due instalments once due ones are cleared?
A: A. Residual cleanup, not underpayment tolerance. After allocation runs, if the remaining owed on an instalment is ≤ 0.005 BHD (5 fils), that instalment is marked fully paid and the shortfall is written off. Applied per-instalment, not per-payment.

B. The answer key does not specify day-count or penalty structure at this level of detail, so these are defaults, not policy — flag them for confirmation. [default, not policy] Day-count: Actual/365. Rate: annual rate held on each instalment. Interest accrues on outstanding principal of that instalment from the last payment date (or disbursement date if no prior payments) to value_date. Penalty: daily rate on the total overdue instalment balance (all components), from due date to value_date inclusive. If your loan model carries a different rate field or accrual basis, override these.

C. The answer key does not specify this sequencing explicitly. [default, not policy] Apply existing credit balance first, then apply the incoming payment to whatever remains. This keeps the function's behaviour consistent: a caller never needs to know whether the credit came from a prior overpayment or the current call.

D. Allocation only touches instalments whose due date is on or before value_date. Once all due instalments are cleared, any surplus becomes a credit balance per rule 3 — it does not reach not-yet-due instalments and does not prepay principal.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in this directory. It is done.

It captures every policy decision we settled:

- **Waterfall** — per-instalment, oldest-due-first (FIFO); clear all four components of an instalment before the next.
- **Component order** — Fees → Penalties → Interest → Principal.
- **Partial pay** — strict sequential fill, partially pay and stop; no proportional split, no all-or-nothing gating.
- **Overpayment** — held as unallocated credit, auto-applied to the next instalment when due; never refunded, never prepays principal.
- **Eligibility** — only instalments with `due_date ≤ value_date`; surplus never reaches not-yet-due instalments.
- **Tolerance** — per-instalment residual cleanup: ≤ 0.005 BHD after allocation → mark fully paid, write off shortfall.
- **Currency** — BHD, 3 dp (fils), round half-up throughout; rounding residuals absorbed into interest; amounts as decimals.
- **Accrual** — interest and penalties recomputed to `value_date` (including back-valued payments) before allocation.
- **Validation** — negative payment rejected; zero payment is a no-op that still records a zero-value transaction.
- **Return** — per-bucket applied amounts + resulting balances, `credit_balance`, `tolerance_written_off`, transaction record.

Four items are flagged **[DEFAULT — confirm]** rather than left silent — the two you yourself marked as defaults (accrual mechanics, credit-first sequencing) plus input immutability and surfacing accrual in the result. These should be checked against the real loan model before implementation. See §12 (Decision log) for the full policy-vs-default breakdown.

One process note: you asked for `spec.md` in this directory, so I wrote the single consolidated spec there rather than scaffolding the OpenSpec change-artifact set (proposal/design/tasks). Say the word if you'd also like those generated.
A: Noted. Specification accepted.

## Produced specification

# Specification — `allocate_payment(payment, loan)`

Payment allocation for the loan servicing system. Defines exactly how an incoming
payment is applied across a loan's outstanding instalments and how the loan's
balances are updated.

Every policy decision below was confirmed with the product stakeholder. Items
explicitly flagged **[DEFAULT — confirm]** were not fixed by the stakeholder's
policy and carry a reasonable default that should be reviewed against the real
loan model before implementation.

---

## 1. Purpose & interface

```
allocate_payment(payment, loan) -> AllocationResult
```

Given an incoming `payment` and the current `loan`, compute how the money is
applied across the loan's outstanding instalments (penalties, fees, interest,
principal) and return both the per-bucket application and the loan's resulting
balances.

The function is **pure**: it does not mutate `loan`. It returns a new
`AllocationResult` describing the applied amounts and the updated state.
**[DEFAULT — confirm]** (immutability treated as a default, not stated policy).

---

## 2. Currency & rounding

- Currency is **BHD (Bahraini dinar)**, **3 decimal places** (fils). The smallest
  unit is 0.001 BHD (1 fils).
- Amounts are passed in and stored as **decimals to 3 dp** (not integer minor
  units).
- All arithmetic results are rounded to 3 dp using **round half-up**.
- Rounding is applied **throughout** (after each computed amount), not only at the
  end.
- **Rounding residuals are absorbed into the interest component.** When rounding a
  set of related amounts introduces a residual (the parts do not sum back to the
  whole at 3 dp), the discrepancy is added to / removed from the interest bucket so
  that totals reconcile exactly.

Implementations must use a decimal type (not binary floating point) to guarantee
exact 3-dp behaviour.

---

## 3. Input model

### 3.1 `payment`

| Field        | Meaning                                                                 |
|--------------|-------------------------------------------------------------------------|
| `amount`     | Decimal, 3 dp, BHD. The money being applied.                            |
| `value_date` | The effective date of the payment. Drives accrual (see §4). Defaults to today (processing date) if omitted. |

### 3.2 `loan`

The loan carries:

- `credit_balance` — any existing unallocated credit from a prior overpayment
  (decimal, 3 dp; default 0.000).
- `instalments` — a list of outstanding instalments.
- Dates needed for accrual: per-instalment `due_date`, and a per-instalment
  accrual anchor (`last_payment_date`, falling back to the loan's
  `disbursement_date` when the instalment has had no prior payment).

Each **instalment** carries four outstanding component balances ("buckets") and
accrual inputs:

| Field                 | Meaning                                                            |
|-----------------------|-------------------------------------------------------------------|
| `due_date`            | When the instalment falls due. Drives eligibility (§5) and ordering. |
| `fees`                | Outstanding fees (decimal, 3 dp).                                  |
| `penalties`           | Outstanding penalties (decimal, 3 dp).                             |
| `interest`            | Outstanding interest (decimal, 3 dp).                              |
| `principal`           | Outstanding principal (decimal, 3 dp).                             |
| `annual_rate`         | Annual interest rate used to re-accrue interest. **[DEFAULT — confirm]** field name / location. |
| `last_payment_date`   | Accrual anchor for interest; falls back to `disbursement_date`. **[DEFAULT — confirm]**. |

> The precise field names of the `loan` / instalment structure were not mandated.
> The concepts above are required; adapt names to the actual model.

---

## 4. Accrual (recompute before allocation)

Interest and penalties are **recomputed up to `value_date`** before any allocation
runs. Allocation then operates on the post-accrual balances.

- If `value_date` is earlier than today, re-accrue **to** `value_date` (back-value
  the payment).
- Accrual is applied per instalment, then allocation runs on the resulting
  balances.

**[DEFAULT — confirm]** The stakeholder did not fix the day-count or penalty
structure; the following are defaults to confirm against the real loan model:

- **Interest** — day-count **Actual/365**. Interest accrues on the instalment's
  **outstanding principal**, from its accrual anchor (`last_payment_date`, else
  `disbursement_date`) up to `value_date`:
  `interest_accrued = outstanding_principal × annual_rate × days / 365`.
  The accrued amount is added to the instalment's `interest` bucket (rounded 3 dp).
- **Penalty** — a **daily rate** applied to the **total overdue instalment balance**
  (sum of all four buckets), from `due_date` to `value_date` **inclusive**. The
  accrued penalty is added to the instalment's `penalties` bucket (rounded 3 dp).
  Only instalments that are overdue (`due_date <= value_date`) accrue penalties.

If the actual loan model carries a different rate field, accrual basis, or penalty
structure, those override the defaults above.

---

## 5. Eligible instalments & ordering

- An instalment is **eligible** for allocation only if its `due_date` is **on or
  before `value_date`** (i.e. already due).
- Eligible instalments are processed **oldest `due_date` first (FIFO)**.
- Allocation **never reaches not-yet-due instalments** and **never prepays
  principal**. Anything left after all eligible instalments are cleared becomes
  credit (see §8).

---

## 6. Allocation waterfall

### 6.1 Available funds

```
available = loan.credit_balance + payment.amount
```

The pre-existing `credit_balance` is consumed **first**, then the incoming
payment, as a single pool. The caller does not need to distinguish the two
sources. **[DEFAULT — confirm]** (credit-first sequencing treated as a default).

### 6.2 Top-level shape — per-instalment, oldest first

Fully settle the **oldest eligible instalment across all four of its components**
before any money touches the next instalment. (Not a per-component sweep across
instalments.)

### 6.3 Component order within an instalment

Within each instalment, components are paid in this strict order:

```
Fees  →  Penalties  →  Interest  →  Principal
```

(Fees before penalties.)

### 6.4 Partial fill

Strict sequential fill:

- Apply available funds to the current component until it is cleared, then move to
  the next component; when the current instalment is fully cleared, move to the
  next eligible instalment.
- If funds run out mid-component, **partially pay that component and stop**. The
  remainder of that component and all lower-priority components / later instalments
  stay outstanding.
- **No** proportional split across components. **No** all-or-nothing gating at
  component or instalment level.

---

## 7. Tolerance write-off (residual cleanup)

Applied **per instalment**, **after** allocation has run (not an underpayment
tolerance):

- For each eligible instalment touched by this allocation, if its remaining owed
  (sum of the four buckets) after allocation is **greater than 0 and ≤ 0.005 BHD
  (5 fils)**, the instalment is marked **fully paid** and the residual shortfall is
  **written off**.
- The written-off amount is reported in `tolerance_written_off`.
- The threshold is per instalment, not per payment.

> A large residual left because funds were exhausted early is **not** written off —
> only residuals within the 5-fils tolerance.

---

## 8. Overpayment & credit balance

- After all eligible instalments are cleared, any remaining funds become an
  **unallocated credit balance** held on the loan.
- The credit balance is **auto-applied to the next instalment when it falls due**
  (via a later `allocate_payment` call, where it is consumed first per §6.1).
- Credit is **never auto-refunded** and **never used to prepay principal**.
- Overpayment is always permitted (never rejected).

---

## 9. Edge cases & validation

| Case                         | Behaviour                                                                 |
|------------------------------|--------------------------------------------------------------------------|
| `amount` < 0                 | **Reject** with an error. No allocation performed.                        |
| `amount` = 0                 | **No-op allocation**, but still record a **zero-value allocation transaction** in the result. |
| No eligible instalments      | Nothing to allocate; entire `available` pool becomes/remains credit balance. |
| `available` = 0              | Record a zero-value allocation transaction; no buckets change.            |
| Funds exceed total owed      | Clear all eligible instalments; surplus → credit (§8).                    |

---

## 10. Return shape — `AllocationResult`

No specific field names are mandated beyond the following concepts. The result must
express:

- **Per instalment touched**: the amount applied to each bucket
  (fees / penalties / interest / principal), and the **resulting outstanding
  balance** of each bucket.
- **Accrued amounts** added during §4 (interest and penalty accrued to
  `value_date`), for transparency. **[DEFAULT — confirm]** (surfacing accrual in
  the result is a reasonable default).
- **`credit_balance`** — the resulting unallocated credit held on the loan
  (including any newly created surplus).
- **`tolerance_written_off`** — total residual written off under §7 (and, ideally,
  per instalment).
- A **transaction record** of the allocation — present even when the payment is
  zero (§9).
- The **updated loan state** (new object; input left unmutated — see §1).

---

## 11. Worked example

Post-accrual balances shown (accrual per §4 already applied). Two overdue
instalments, oldest first.

**Loan**
- `credit_balance` = 1.000 BHD
- Instalment A — `due_date` 2026-10-01:
  fees 2.000, penalties 1.500, interest 5.250, principal 50.000 (total 58.750)
- Instalment B — `due_date` 2026-11-01:
  fees 2.000, penalties 0.000, interest 5.500, principal 50.000 (total 57.500)

**Payment**: amount 60.000 BHD, `value_date` 2026-11-08 (both instalments due).

**Allocation**
- `available` = 1.000 (credit) + 60.000 = 61.000.
- Instalment A (oldest), order Fees→Penalties→Interest→Principal:
  - Fees 2.000 → paid 2.000 (remaining funds 59.000)
  - Penalties 1.500 → paid 1.500 (57.500)
  - Interest 5.250 → paid 5.250 (52.250)
  - Principal 50.000 → paid 50.000 (2.250)
  - Instalment A fully cleared (residual 0.000).
- Instalment B, remaining funds 2.250:
  - Fees 2.000 → paid 2.000 (0.250)
  - Penalties 0.000 → nothing due
  - Interest 5.500 → paid 0.250, **partial**, stop (interest remaining 5.250)
  - Principal 50.000 → untouched.
- Instalment B residual = 5.250 + 50.000 = 55.250 → **above** 5 fils, no
  write-off.
- Funds exhausted. No surplus → `credit_balance` = 0.000.

**Result (summary)**
- Instalment A: fees 2.000, penalties 1.500, interest 5.250, principal 50.000
  applied; all buckets now 0.000; marked fully paid.
- Instalment B: fees 2.000, interest 0.250 applied; outstanding fees 0.000,
  penalties 0.000, interest 5.250, principal 50.000.
- `credit_balance` = 0.000; `tolerance_written_off` = 0.000.

---

## 12. Decision log

| # | Decision | Status |
|---|----------|--------|
| 1 | Top-level waterfall: per-instalment, oldest first (clear all four components before next instalment). | Policy |
| 2 | Component order within instalment: Fees → Penalties → Interest → Principal. | Policy |
| 3 | Instalment ordering: oldest `due_date` first (FIFO). | Policy |
| 4 | Overpayment: hold as unallocated credit; auto-applied to next instalment when due; never refunded, never prepays principal. | Policy |
| 5 | Partial payment: partially pay the component and stop; strict sequential fill; no proportional split, no all-or-nothing gating. | Policy |
| 6 | Currency BHD, 3 dp (fils); round half-up to 3 dp throughout; rounding residuals absorbed into interest; amounts as decimals. | Policy |
| 7 | Return: per-bucket applied + resulting balances per instalment, `credit_balance`, `tolerance_written_off`, transaction record (incl. zero payments). | Policy |
| 8 | Negative payment → error; zero payment → no-op but record a zero-value allocation transaction. | Policy |
| 9 | Interest & penalties recomputed to `value_date` (incl. back-valued payments) before allocation. | Policy |
| A | Tolerance: residual cleanup — per instalment, residual ≤ 0.005 BHD after allocation → mark fully paid, write off shortfall. | Policy |
| D | Eligible instalments: `due_date <= value_date` only; surplus → credit, never not-yet-due, never prepay principal. | Policy |
| B | Accrual mechanics: Actual/365 on outstanding principal from last-payment/disbursement date; penalty = daily rate on total overdue balance, due_date→value_date inclusive. | **DEFAULT — confirm** |
| C | Pre-existing credit applied first, then incoming payment (single pool). | **DEFAULT — confirm** |
| — | Input `loan` treated as immutable; new result returned. | **DEFAULT — confirm** |
| — | Accrued amounts surfaced in the result for transparency. | **DEFAULT — confirm** |


## Auditor verdict

_The spec matches 13 of 14 reference decisions. It correctly captures all the genuinely bespoke choices (fees-before-penalties order, credit-balance overpayment handling, BHD/3dp, residual-to-interest, back-valuation, no-prepay surplus, 5-fils write-off tolerance) and the inferable ones (strict order, negative-reject/zero-noop). The only gap is decision 13: same-day multiple payments ordered FIFO by receipt timestamp is never addressed — the single-payment pure function implies independent per-call allocation but the timestamp ordering policy is absent. Coverage = 13/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §6.3: "Fees → Penalties → Interest → Principal" and "(Fees before penalties.)"; decision log #2. | Spec states the exact bucket order with fees before penalties, matching the reference's deliberately non-default sequence. |
| 2 | yes | **yes** | §6.2: "Fully settle the oldest eligible instalment across all four of its components before any money touches the next instalment. (Not a per-component sweep across instalments.)" | Matches reference: oldest instalment cleared in full across all buckets before the next is touched. |
| 3 | yes | **yes** | §8: "any remaining funds become an unallocated credit balance held on the loan... auto-applied to the next instalment when it falls due... Credit is never auto-refunded." | Exactly matches the reference credit-balance mechanism, auto-application on next due, and no auto-refund. |
| 4 | yes | **yes** | §2: "Currency is BHD (Bahraini dinar), 3 decimal places (fils). The smallest unit is 0.001 BHD." | Correctly identifies BHD and 3 dp, matching the reference's non-default minor unit. |
| 5 | yes | **yes** | §2: "All arithmetic results are rounded to 3 dp using round half-up." | Round half-up to the minor unit matches the reference rounding method exactly. |
| 6 | yes | **yes** | §2: "Rounding residuals are absorbed into the interest component... the discrepancy is added to / removed from the interest bucket." | Residual destination is interest, matching the reference. |
| 7 | yes | **yes** | §4: "If value_date is earlier than today, re-accrue to value_date (back-value the payment)"; decision log #9. | Interest is recomputed to the earlier value_date before allocation, matching the reference back-valuation rule. |
| 8 | yes | **yes** | §5: "never prepays principal"; §8: "never used to prepay principal"; surplus → credit (§8); eligibility due_date <= value_date (§5). | Early/on-time surplus settles the due instalment only and becomes credit without prepaying principal, so future interest is unchanged — matches the reference. |
| 9 | yes | **yes** | §6.4: "No proportional split across components"; strict sequential fill, "partially pay that component and stop." | Strict in-order fill with no proportional split matches the reference for sub-bucket partial payments. |
| 10 | yes | **yes** | §7: residual "greater than 0 and ≤ 0.005 BHD (5 fils)" → "marked fully paid and the residual shortfall is written off." | Tolerance threshold of 0.005 BHD, mark-fully-paid, and write-off match the reference exactly, including per-instalment scope. |
| 11 | yes | **yes** | §9: "amount < 0 → Reject with an error"; "amount = 0 → No-op allocation, but still record a zero-value allocation transaction." | Negative rejected with error, zero a no-op that still records a zero-value transaction — matches the reference. |
| 12 | yes | **yes** | §4: "Penalty — ... from due_date to value_date inclusive"; "Allocation then operates on the post-accrual balances." | Penalties accrue up to and including value_date, then allocation runs on post-accrual balances — matches the reference accrue-then-allocate choice, despite penalty rate mechanics being flagged as a default. |
| 13 | no | no | absent | The spec handles one payment per call and consumes credit first, but never addresses multiple payments arriving on the same day or ordering them FIFO by receipt timestamp; the reference's same-day ordering decision is not stated. |
| 14 | yes | **yes** | §10: "amount applied to each bucket... and the resulting outstanding balance of each bucket"; "credit_balance"; "tolerance_written_off." | Return shape includes per-bucket applied amounts, resulting balances, credit_balance, and tolerance_written_off — covering all required reference elements. |
