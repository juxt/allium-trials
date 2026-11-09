# bmad — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 16 · Captured: 13/14 · Bespoke captured: 7/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured question prompt was dismissed. Let me put the questions directly in the conversation so you can answer them in whatever form is easiest — these are the material policy decisions I can't safely infer, and I need your calls on them before I draft the spec.

## Allocation policy questions

**A. Component priority within an instalment.** Each instalment has penalties, fees, interest, and principal. In what order does a payment consume them? Common choices:
1. Penalties → Fees → Interest → Principal (typical consumer-loan hierarchy)
2. Fees → Penalties → Interest → Principal
3. Interest → Principal → Fees → Penalties
4. Principal → Interest → Fees → Penalties (rare / regulation- or borrower-directed)

**B. Traversal across multiple outstanding instalments.** With several instalments due, does the money go:
1. **Oldest instalment fully first** — run the full component waterfall on the oldest instalment, exhaust it, then the next (row-major); or
2. **Component-type across all instalments** — all penalties everywhere, then all fees everywhere, then all interest, then all principal (column-major); or
3. **Hybrid** — top-priority component on every instalment oldest→newest, then the next component across every instalment, etc.

**C. Overpayment** (payment exceeds everything currently owed). Excess is:
1. Held as an unapplied/suspense credit; or
2. Applied to principal as a prepayment (curtailment); or
3. Carried onto the next not-yet-due instalment(s); or
4. Refunded to the borrower.

**D. Partial payment** (less than total owed):
1. Apply as far as it goes, remaining balances stay outstanding; or
2. Hold in suspense until it covers a full instalment; or
3. Reject it.

**E. Eligible instalments.** Does `allocate_payment` only touch **due / past-due** instalments, or can a single payment also reach **not-yet-due (future)** instalments? (This interacts with C.)

**F. Who directs allocation.** Is the waterfall **institution-directed and fixed** for every payment, or can the **borrower override** it (e.g. "put this toward principal")? Any statutory exceptions (e.g. a regulated rule that a specific surplus must go to principal)?

**G. Currency representation & rounding.** Are `payment` and the loan balances **integer minor units (cents)** — so no rounding ever arises — or **decimal amounts** that need a rounding rule (round-half-up to the cent, banker's rounding, etc.)? If decimals, where does the residual cent land?

**H. Invalid / edge inputs.** How should the function treat a **zero**, **negative**, or non-finite payment, and a payment against a **loan with nothing owed** — reject with an error, or return balances unchanged as a no-op?

Answer whichever you have firm positions on (a quick "A1, B1, C1…" is fine), and flag any I've missed or any where the real policy is more nuanced than the options. Once I have your answers I'll write up `spec.md`.
A: A. Option 2: Fees → Penalties → Interest → Principal.

B. Option 1 (row-major / oldest-first): run the full four-bucket waterfall on the oldest instalment, exhaust it entirely, then move to the next.

C. Option 1, with a specific rule: surplus is held as an unallocated credit balance and auto-applied when the next instalment falls due. It is never auto-refunded and does not curtail principal.

D. Option 1: apply as far as the payment reaches; remaining bucket balances stay outstanding.

E. Only due and past-due instalments are eligible. A payment does not reach future instalments directly. Any surplus after clearing all arrears becomes a credit balance per C.

F. Institution-directed and fixed for every payment — no borrower override. [default, not policy on statutory exceptions: none identified.]

G. Decimal amounts, denominated in BHD (Bahraini dinar). Three decimal places (fils). Rounding: round half-up to 3 dp. Rounding residuals are absorbed into the interest component, not principal.

H. Negative payment: rejected with an error. Zero payment: accepted as a no-op but must still produce a zero-value allocation transaction in the audit record. Payment against a loan with nothing owed: treat as an overpayment of zero — credit balance of the payment amount held per C.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Those are clear and decisive — thank you. Before I draft, there's one genuine interaction your answers surface that I don't want to guess at, plus a small output-shape confirmation.

## Follow-ups

**1. Pre-existing credit balance as available funds.** Your rule C creates a persistent *credit balance* on the loan, and E says any surplus lands there. Two things I need pinned down:

- When `allocate_payment` runs, are the funds available for the waterfall **just the incoming `payment`**, or **`payment` + any existing credit balance** already sitting on the loan? (i.e. does an incoming payment "top up" and get combined with prior credit before hitting arrears?)
- You said credit is "auto-applied when the next instalment falls due." Is that auto-application *performed by this same function* (called when the instalment becomes due), or by a separate mechanism outside `allocate_payment`'s scope?

**2. Zero-payment vs. credit interaction.** H says a zero payment is a no-op that still emits a zero-value allocation record. But if a credit balance exists *and* an instalment has just fallen due, C implies that credit should now be applied. So: does the "zero = no-op" rule hold **only when there is no applicable credit to apply**, and otherwise a zero (or any) payment still triggers application of the existing credit against newly-due arrears? Or is "zero = strictly no-op, never touches credit" the true rule, with credit application always driven by a separate due-date event?

**3. Return shape & audit record.** The brief says the function returns "how the payment is applied and the loan's updated balances," and H mandates an allocation transaction in the audit record even for zero. I'm planning to specify:
- a **pure function** (returns new balances; does not mutate the input `loan`), returning (a) a per-instalment, per-bucket allocation breakdown, (b) the resulting credit-balance change, (c) the updated loan balances, and (d) an **allocation transaction record** for the audit trail.
- For the audit record, I'll include: a timestamp, the input payment amount, the full allocation breakdown, opening/closing credit balance, and opening/closing total owed.

Does that match your expectations — in particular, **must the function be pure/non-mutating**, and are there **specific fields the audit record is required to contain** (e.g. a transaction/reference ID, value date vs. posting date, operator/channel) that I should mandate rather than leave open?
A: 1. **Credit balance as available funds.** Two separate answers here.

- Funds available for the waterfall: the incoming `payment` amount only. The function does not automatically fold in a pre-existing credit balance on each call. [default, not policy — this is the simpler, auditable design; flag if you need a combined-funds rule.]
- Auto-application mechanism: credit application is performed by a *separate* mechanism triggered when an instalment's due date is reached, not by `allocate_payment` itself. That function's scope is strictly: incoming payment → waterfall → updated balances. [default, not policy.]

2. **Zero-payment vs. credit interaction.** Zero is strictly a no-op — it records the zero-value allocation transaction and returns unchanged balances. It does not trigger credit application. Credit application is always driven by the due-date event, never by payment arrival. [default, not policy.]

3. **Return shape and audit record.** The required return contents are: per-instalment per-bucket allocation breakdown, resulting outstanding balances, credit_balance delta, and any tolerance_written_off amount. Those four are the mandated outputs.

- Pure/non-mutating: yes, that is the correct design. [default, not policy.]
- Audit record required fields: no specific fields are mandated beyond what the allocation itself contains. Value date (the value_date input, not posting date) must appear, given its effect on interest recomputation. Transaction/reference ID, operator, and channel are [default, not policy] — include them as good practice but do not over-specify.

### Round 3
_Step reasoning:_ (live agent turn)

Q: Two new elements surfaced in your answer that I hadn't captured, and both are material enough that I don't want to infer them: **tolerance write-off** and **value-date interest recomputation**.

## Follow-ups (final set, I think)

**1. Tolerance / write-off.** You named `tolerance_written_off` as a mandated output, so there's a rounding/tolerance policy I need to specify:
- **Trigger & direction:** Does the write-off clear a small *residual the borrower still owes* (under-payment: e.g. an instalment left with a trivial balance after the payment is exhausted → write it off so the instalment counts as settled)? Does it also absorb a small *excess* (so a trivial overpayment is written off instead of going to credit)? Or only one direction?
- **Threshold:** What is the tolerance amount, and in what unit (fils)? e.g. "≤ 5 fils".
- **Scope of the threshold:** Is it assessed **per bucket**, **per instalment** (total across its four buckets), or **per loan / per payment**?
- **Which bucket(s)** does the written-off amount come out of, and is `tolerance_written_off` reported as a single total or itemised?

**2. Value date & interest recomputation.** You said `value_date` "must appear, given its effect on interest recomputation." That implies `allocate_payment` does more than allocate against stated balances — it recomputes interest as of the value date. I need the scope boundary:
- Does the function **recompute/accrue the interest bucket(s) to `value_date`** *before* running the waterfall, or does it receive interest as a **fixed given balance** and merely record `value_date` for downstream/audit use?
- If it recomputes: can `value_date` be **back-dated** (in the past), reducing already-accrued interest — and is the reverse (forward value date adding accrual) also in scope?
- If it recomputes: what's the **interest basis and rate source** (daily accrual on outstanding principal at the loan's rate? day-count convention?) — I want to bound how much interest logic lives inside this function versus being supplied to it.

Once I have these, I'll have everything I need to write `spec.md`.
A: 1. **Tolerance / write-off.**

- **Trigger & direction:** Under-payment only. If, after the full waterfall, an instalment has a remaining balance ≤ the threshold, that residual is written off and the instalment is marked fully paid. Trivial overpayments are not written off — they go to the credit balance per rule C.
- **Threshold:** ≤ 0.005 BHD (5 fils) — per instalment, assessed on the total residual across all four buckets after allocation.
- **Scope:** Per instalment, not per bucket and not per loan/payment.
- **Bucket source and reporting:** [default, not policy — absorb from the lowest-priority bucket first (principal); report as a single `tolerance_written_off` total per instalment, not itemised by bucket.]

2. **Value date & interest recomputation.**

- **Scope:** The function recomputes both interest and penalties to `value_date` *before* running the waterfall. Allocation runs on those post-accrual balances. It does not receive interest as a fixed given.
- **Back-dated value_date:** Yes, in scope — a value_date earlier than today causes interest (and penalties) to be re-accrued to that earlier date before allocation proceeds.
- **Forward value_date:** [default, not policy — a future value_date adding accrual beyond today is out of scope; treat any value_date > today as an error or clamp to today.]
- **Interest basis and rate source:** [default, not policy — daily accrual on outstanding principal at the loan's contracted rate, supplied to the function as an input, using the loan's day-count convention. The function does the accrual arithmetic; the rate and convention are not computed internally.]

### Round 4
_Step reasoning:_ (live agent turn)

Q: Done — the specification is saved as `spec.md` in this directory.

**What it captures.** It's a launch-grade requirements spec for `allocate_payment(payment, loan)` built entirely around the policy decisions you confirmed, with a precise interface contract, an authoritative step-by-step processing order, 11 testable FRs, 5 NFRs (including a money-conservation invariant), six worked examples, explicit non-goals, and a traceability table of your A–H answers plus the tolerance, value-date, and return-shape rules.

**The decisions it encodes:** Fees→Penalties→Interest→Principal within an instalment; row-major oldest-first across instalments; surplus → credit balance (no refund, no curtailment, consumed later by a separate due-date mechanism); partial payments applied as far as they reach; due/past-due instalments only; fixed institution-directed waterfall; BHD/3dp, round half-up, residuals into interest; negative→error, zero→no-op-with-transaction, nothing-owed→full-amount-to-credit; ≤5 fils per-instalment under-payment write-off; value-date re-accrual of interest and penalties with back-dating in scope; pure/non-mutating.

**Where I used discretion** (all tagged `[ASSUMPTION]` in §10, flip any): forward value dates → **reject** (your "error or clamp"); tolerance drawn from principal first; same-due-date tie-break by instalment id; zero payments skip accrual entirely.

**Three items I'd still want your call on** before a developer finishes (§9 Open Questions):
1. **Penalty re-accrual basis** — you marked the penalty rate/base as `[default, not policy]`. Interest accrues on outstanding principal; I need to know what penalties accrue *on* (overdue principal vs. total overdue) and at what rate.
2. **Zero payment vs. accrual** — I read "returns unchanged balances" literally, so the zero path performs *no* re-accrual. Confirm you don't want interest/penalties recomputed-and-persisted even when nothing is applied.
3. **Same-due-date tie-break** — confirm instalment-id ordering is acceptable.

Want me to resolve those three now, or run the skill's reviewer gate (an adversarial critique pass against the spec) before we call it final?
A: Resolve the three now.

1. **Penalty re-accrual basis.** [default, not policy — penalties accrue on the total overdue instalment balance (principal + interest components that are past due), not on overdue principal alone. Rate supplied to the function as a loan input, same as the interest rate.]

2. **Zero payment vs. accrual.** Confirmed: the zero path performs no re-accrual. Zero is a strict no-op — unchanged balances, no interest or penalty recomputation, one zero-value transaction in the audit record.

3. **Same-due-date tie-break.** Instalment-id ordering is acceptable. [default, not policy.]

### Round 5
_Step reasoning:_ (live agent turn)

Q: All three resolved and folded into `spec.md`:

1. **Penalty re-accrual basis** → FR-3 now specifies penalties accrue on the **total overdue instalment balance** (past-due principal + past-due interest), at a supplied `daily_penalty_rate` (added to the loan inputs in §3.2), using the same day-count convention as interest.
2. **Zero payment** → FR-8 confirmed as a strict no-op with **no re-accrual**, balances unchanged, one zero-value audit transaction.
3. **Same-due-date tie-break** → FR-4 confirmed as instalment-`id` ascending.

§9 Open Questions now reads **none open**, with the three resolutions recorded for traceability, and the §10 Assumptions Index marks each as confirmed.

The spec is complete with no open policy questions. If you'd like, I can run the skill's **reviewer gate** — an adversarial critique pass against the spec to catch gaps or internal inconsistencies before we set it to `final`. Otherwise it's ready as-is.
A: Understood — spec is complete and all open questions are resolved. Well done.

## Produced specification

---
title: Payment Allocation — allocate_payment
status: draft
created: 2026-11-08
updated: 2026-11-08
---

# Spec: Payment Allocation (`allocate_payment`)

## 0. Document Purpose

This is the requirements specification for the `allocate_payment(payment, loan)` function in the
loan servicing system. It is written for the implementing engineer and their reviewer. It defines
the allocation policy (which buckets get paid, in what order, across which instalments), the
value-date accrual behaviour, tolerance write-off, surplus handling, the input/output contract,
and the edge-case behaviour — all at a level precise enough to implement and test without further
policy decisions.

Every material policy below was confirmed with the product stakeholder. Where a detail was
explicitly delegated to implementation discretion it is tagged `[ASSUMPTION]` and indexed in §10
for later confirmation. Genuinely unresolved items are in §9 Open Questions.

Vocabulary is fixed in §2 Glossary; §4 and the examples use those terms verbatim.

## 1. Overview

When a borrower pays, the money must be applied across what they currently owe. A loan carries one
or more **outstanding instalments**, each split into four **buckets**: fees, penalties, interest,
and principal. `allocate_payment` takes a single incoming payment and the loan's current state,
re-accrues time-sensitive balances to the payment's value date, applies the money through a fixed
institution-directed waterfall, writes off trivial residuals, parks any surplus as a credit
balance, and returns a full breakdown plus an audit transaction.

The function is **pure**: it does not mutate its inputs and performs no I/O. Credit balances it
creates are consumed later by a *separate* due-date mechanism, not by this function (see §5 Non-Goals).

## 2. Glossary

- **Payment** — a single incoming amount to be applied, with a value date. See §3.1 for its shape.
- **Loan** — the servicing record: its outstanding instalments, credit balance, and accrual
  parameters. See §3.2.
- **Instalment** — one scheduled repayment obligation with a due date and four buckets. A loan has
  one or more outstanding instalments.
- **Bucket** — one of the four component balances within an instalment: **fees**, **penalties**,
  **interest**, **principal**. These four names are exact; no synonyms.
- **Eligible instalment** — an instalment whose due date is on or before the value date (i.e. **due
  or past-due**). Only eligible instalments receive allocation (FR-4).
- **Arrears** — the total outstanding across all eligible instalments after value-date accrual.
- **Waterfall** — the fixed order in which a payment consumes buckets within an instalment:
  Fees → Penalties → Interest → Principal (FR-5).
- **Value date** — the effective date of the payment (`payment.value_date`); interest and penalties
  are recomputed to this date before allocation (FR-3).
- **Credit balance** — unallocated funds held on the loan. `allocate_payment` only ever *adds* to it
  (from surplus, FR-7); it never reads or spends it.
- **Tolerance write-off** — a trivial residual (≤ 5 fils per instalment) owed after allocation,
  cleared so the instalment counts as fully paid (FR-6).
- **BHD / fils** — Bahraini dinar; the currency. 1 BHD = 1000 fils, so all amounts carry **3 decimal
  places**. 5 fils = 0.005 BHD.
- **Fully paid** — an instalment whose four buckets total zero after allocation (including after any
  tolerance write-off).

## 3. Interface Contract

Signature: `allocate_payment(payment, loan) -> AllocationResult`

All monetary values are decimal amounts in **BHD to 3 decimal places (fils)**. Implementations must
use an exact decimal type, never binary floating point (NFR-1).

### 3.1 Input: `payment`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `amount` | Decimal(BHD, 3dp), ≥ 0 | yes | Funds to apply. 0 is a valid no-op (FR-8); negative is rejected (FR-1). |
| `value_date` | Date | yes | Effective date. Must be ≤ the loan's current/system date (FR-1). Drives accrual (FR-3). |
| `reference_id` | string | optional | Transaction reference, echoed into the audit record. `[ASSUMPTION]` |
| `operator` | string | optional | Who/what initiated the payment, echoed into the audit record. `[ASSUMPTION]` |
| `channel` | string | optional | Payment channel, echoed into the audit record. `[ASSUMPTION]` |

### 3.2 Input: `loan`

| Field | Type | Meaning |
|---|---|---|
| `instalments` | list of Instalment | All outstanding instalments (eligible and future). |
| `credit_balance` | Decimal(BHD, 3dp), ≥ 0 | Existing unallocated credit. Read-only here; see §5. |
| `as_of_date` | Date | The loan's current date; the upper bound for a valid `value_date`. `[ASSUMPTION]` |
| `daily_interest_rate` | Decimal | Per-day interest rate on outstanding principal, supplied (not computed here). `[ASSUMPTION]` |
| `daily_penalty_rate` | Decimal | Per-day penalty rate, supplied as a loan input (same as the interest rate). Accrues on the total overdue instalment balance (FR-3). |
| `day_count_convention` | enum | Day-count basis used by the accrual arithmetic. `[ASSUMPTION]` |

**Instalment** fields:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable identifier. |
| `due_date` | Date | Determines eligibility and waterfall ordering. |
| `fees`, `penalties`, `interest`, `principal` | Decimal(BHD, 3dp), ≥ 0 | The four bucket balances. |
| `last_accrual_date` | Date | Date through which `interest`/`penalties` are currently accrued; accrual runs from here to `value_date` (FR-3). |

### 3.3 Output: `AllocationResult`

The four **mandated** outputs:

1. **`allocations`** — per-instalment, per-bucket breakdown of what was applied (see below).
2. **`updated_instalments`** — the resulting outstanding bucket balances per instalment.
3. **`credit_balance_delta`** — the amount added to the loan's credit balance (≥ 0).
4. **`tolerance_written_off`** — total written off across all instalments (≥ 0).

Plus the audit transaction and convenience closing totals:

- **`transaction`** — audit record containing at minimum: `value_date`, `payment.amount`, the full
  `allocations` breakdown, `credit_balance_delta`, `tolerance_written_off`, opening and closing
  total-owed, and opening and closing credit balance. `reference_id` / `operator` / `channel` are
  echoed if supplied. `[ASSUMPTION]` on exact field set beyond `value_date` and the allocation
  content (see §10).
- **`credit_balance_closing`** = `loan.credit_balance + credit_balance_delta`.

Each entry in `allocations` has: `instalment_id`, `applied` = {fees, penalties, interest, principal}
amounts applied, `residual_after` = {fees, penalties, interest, principal} still outstanding,
`tolerance_written_off` for that instalment, and `fully_paid` (bool).

## 4. Processing Order (authoritative)

`allocate_payment` executes these steps in order. Each is specified as an FR in §5.

1. **Validate** inputs (FR-1). On failure, raise; produce no allocation.
2. **Zero short-circuit** (FR-8): if `amount == 0`, return a no-op result with a zero-value audit
   transaction and balances unchanged — **skip steps 3–7**.
3. **Accrue** interest and penalties on every instalment to `value_date` (FR-3).
4. **Select & order** eligible instalments: due_date ≤ value_date, ordered oldest due_date first (FR-4).
5. **Allocate** the payment through the waterfall, exhausting each instalment fully before the next
   (FR-4, FR-5).
6. **Tolerance write-off** per instalment (FR-6).
7. **Surplus → credit balance** (FR-7).
8. **Assemble** result + audit transaction (FR-9, FR-10).

## 5. Functional Requirements

### FR-1: Input validation

The function validates inputs before any accrual or allocation.

**Consequences (testable):**
- `payment.amount < 0` → raise a validation error; no allocation, no audit transaction produced.
- `payment.amount == 0` → accepted (handled by FR-8), not an error.
- `payment.value_date > loan.as_of_date` (a future value date) → raise a validation error.
  `[ASSUMPTION]` — stakeholder delegated "error or clamp"; this spec chooses **error**. (§10)
- `payment.value_date ≤ loan.as_of_date` → valid, including back-dated value dates (FR-3).
- Non-decimal / non-finite `amount` → raise a validation error.

### FR-2: Purity and non-mutation

The function computes a result without side effects.

**Consequences (testable):**
- The `loan` and `payment` arguments are unchanged after the call (deep-equal to their inputs).
- Calling the function twice with identical inputs yields identical outputs (determinism, NFR-2).
- No I/O, no clock reads, no persistence inside the function. The reference date is `loan.as_of_date`,
  passed in — not the system clock.

### FR-3: Value-date accrual of interest and penalties

Before allocation, the function recomputes the **interest** and **penalties** buckets of every
instalment to `value_date`. It does **not** recompute fees or principal.

**Consequences (testable):**
- For each instalment, interest is accrued from `last_accrual_date` to `value_date` using
  `daily_interest_rate`, outstanding `principal`, and `day_count_convention`:
  `accrued = principal × daily_interest_rate × day_count(last_accrual_date → value_date)`, added to
  the existing `interest` bucket. `[ASSUMPTION]` on exact formula/convention (§10).
- Penalties are re-accrued to `value_date` using `daily_penalty_rate` (a supplied loan input, like
  the interest rate) on the **total overdue instalment balance** — the past-due principal **and**
  past-due interest components — not on overdue principal alone. Same `day_count_convention`.
- **Back-dated** `value_date` (earlier than `as_of_date` but ≥ `last_accrual_date` semantics):
  interest/penalties are accrued to that earlier date, yielding *less* accrual than accruing to
  `as_of_date`. Back-dating is explicitly in scope.
- Forward `value_date` (> `as_of_date`) never reaches this step — rejected at FR-1.
- Rounding of accrued amounts follows FR-11; sub-fils residuals land in the **interest** bucket.
- Allocation (FR-4/FR-5) runs on these **post-accrual** balances, not the input balances.

### FR-4: Instalment eligibility and traversal (row-major, oldest-first)

The payment is applied across eligible instalments one at a time, oldest first, exhausting each
before moving on.

**Consequences (testable):**
- Only instalments with `due_date ≤ value_date` are eligible. Future instalments receive **nothing**,
  even if funds remain — surplus goes to credit (FR-7), never to a future instalment.
- Eligible instalments are processed in ascending `due_date` order (oldest due date first). `[ASSUMPTION]`:
  ties on `due_date` are broken by instalment `id` ascending for determinism (§10).
- The **full** waterfall (FR-5) is run on the oldest eligible instalment until it is fully paid or
  funds run out, and only then does the next instalment begin. This is **row-major**: e.g. the
  **principal** of instalment 1 is paid before the **fees** of instalment 2.
- If funds are exhausted mid-instalment, remaining buckets of that instalment and all later
  instalments stay outstanding (partial payment; FR-9).

### FR-5: Component waterfall within an instalment

Within a single instalment, a payment consumes buckets in this fixed order:

**Fees → Penalties → Interest → Principal**

**Consequences (testable):**
- A bucket must be reduced to zero before the next bucket in the order receives any funds (subject to
  remaining payment).
- The order is **institution-directed and fixed** for every payment. There is no borrower override
  and no per-payment reordering.
- A bucket with a zero balance is skipped (no effect), and the order proceeds to the next.

### FR-6: Tolerance write-off (under-payment only)

After the waterfall finishes on an instalment, a trivial remaining balance is written off.

**Consequences (testable):**
- After allocation to an instalment, if the **total residual across all four buckets ≤ 0.005 BHD
  (5 fils)**, that residual is written off and the instalment is marked `fully_paid`.
- The threshold is assessed **per instalment** (sum of the four buckets), not per bucket and not
  per loan or per payment.
- A residual **> 0.005 BHD** is **not** written off; those buckets stay outstanding.
- Write-off applies to **under-payment only**. A trivial *overpayment* is never written off — it goes
  to the credit balance (FR-7).
- The written-off amount is drawn from the **lowest-priority bucket(s) first (principal)**, then up
  the order if principal's residual is smaller than the total written off. `[ASSUMPTION]` (§10).
- `tolerance_written_off` is reported as a **single total per instalment** (not itemised by bucket),
  and summed into the top-level `tolerance_written_off` output.

### FR-7: Surplus becomes credit balance

Funds remaining after all eligible instalments are satisfied are held as credit.

**Consequences (testable):**
- Any payment remaining after the last eligible instalment is fully paid is added to the loan's
  credit balance: `credit_balance_delta = remaining funds`.
- The surplus is **never** auto-refunded and **never** curtails (pre-pays) principal.
- The surplus does **not** reach future (not-yet-due) instalments within this call.
- The function **does not** read or spend the loan's existing `credit_balance`; it only adds to it.
  Application of credit to newly-due instalments is a separate due-date-triggered mechanism outside
  this function's scope (§5 Non-Goals).
- A payment against a loan with **no eligible instalments** (nothing owed, or all instalments in the
  future) results in the entire payment becoming `credit_balance_delta` (an "overpayment of the full
  amount").

### FR-8: Zero-payment no-op

A zero payment is accepted and recorded but changes nothing.

**Consequences (testable):**
- `payment.amount == 0` → **no accrual, no allocation, no credit change**; `updated_instalments`
  equal the input instalment balances; `credit_balance_delta == 0`; `tolerance_written_off == 0`.
- A **zero-value allocation transaction is still produced** in the audit record (with all applied
  amounts = 0), carrying the `value_date`.
- A zero payment does **not** trigger credit application and does **not** re-accrue balances.
  `[ASSUMPTION]`: "returns unchanged balances" (per stakeholder) is taken literally — the zero path
  skips the FR-3 accrual entirely (§9 Q2, §10).

### FR-9: Partial-payment behaviour

When the payment is less than total arrears, it is applied as far as it reaches.

**Consequences (testable):**
- The waterfall runs until funds are exhausted; buckets not reached remain fully outstanding.
- Partial payments are never rejected for being short, and are never held in suspense by this function.
- `credit_balance_delta == 0` whenever any arrears remain after allocation.

### FR-10: Return value and audit transaction

The function returns the four mandated outputs plus an audit transaction.

**Consequences (testable):**
- The result contains `allocations`, `updated_instalments`, `credit_balance_delta`, and
  `tolerance_written_off` (§3.3), always — including on the zero-payment path.
- The result contains a `transaction` whose fields include at minimum `value_date` and the full
  allocation content; optional `reference_id`/`operator`/`channel` are echoed when supplied.
- Opening and closing total-owed and credit balances appear in the transaction so the record is
  self-contained for audit.

### FR-11: Currency precision and rounding

All arithmetic is exact-decimal in fils.

**Consequences (testable):**
- All inputs and outputs are BHD to **3 decimal places**.
- Any value requiring rounding (accrual products in FR-3) is rounded **half-up to 3 dp**.
- Rounding **residuals are absorbed into the interest bucket**, never principal.
- Because allocation itself is sequential subtraction of 3dp amounts, it introduces no new rounding;
  rounding arises only in accrual (FR-3).

## 6. Worked Examples

All amounts in BHD (3dp). Assume `value_date == as_of_date` and `last_accrual_date == value_date`
(so FR-3 accrual adds 0) **except** Example E.

### E1 — Row-major across two instalments, partial

Loan, credit_balance 0. Payment 60.000.
- Instalment #1 (older): fees 2.000, penalties 1.500, interest 5.000, principal 50.000 (total 58.500)
- Instalment #2 (newer): fees 2.000, penalties 1.000, interest 4.000, principal 50.000 (total 57.000)

Allocation: #1 consumes fees 2.000 → penalties 1.500 → interest 5.000 → principal 50.000 (fully paid,
58.500 used). Remaining 1.500 goes to #2: fees 2.000 bucket receives 1.500 (residual fees 0.500).
Funds exhausted.
- #2 residual: fees 0.500, penalties 1.000, interest 4.000, principal 50.000 (total 55.500 > 5 fils → no write-off).
- `credit_balance_delta` 0; `tolerance_written_off` 0.

### E2 — Tolerance write-off

Loan, credit_balance 0. Payment 58.498. Single instalment: fees 2.000, penalties 1.500, interest
5.000, principal 50.000 (total 58.500).
- fees 2.000 → penalties 1.500 → interest 5.000 → principal receives 49.998 (residual principal 0.002).
- Instalment residual total 0.002 ≤ 0.005 → **written off** (from principal). Instalment `fully_paid`.
- `tolerance_written_off` 0.002; `credit_balance_delta` 0.

### E3 — Overpayment → credit

Loan, credit_balance 0. Payment 60.000. Single instalment total 58.500 (as E2 totals).
- Instalment fully paid using 58.500. Remaining 1.500, no further eligible instalments.
- `credit_balance_delta` +1.500; `credit_balance_closing` 1.500. No refund, no principal curtailment.

### E4 — Nothing owed

Loan with only future instalments (all `due_date > value_date`), credit_balance 10.000. Payment 25.000.
- No eligible instalments. Entire 25.000 → `credit_balance_delta`. `credit_balance_closing` 35.000.
- Existing 10.000 credit is untouched by this function.

### E5 — Back-dated value date re-accrues less interest

Instalment principal 50.000, interest bucket 5.000 accrued through `last_accrual_date` = 2026-11-01.
`daily_interest_rate` such that daily interest = 0.010. `value_date` = 2026-11-08 (`as_of_date` = 2026-11-08).
- FR-3 accrues 7 days × 0.010 = 0.070 → interest bucket becomes 5.070 before the waterfall.
- Had the caller passed `value_date` = 2026-11-04 (back-dated), accrual would be 3 × 0.010 = 0.030,
  interest bucket 5.030 — strictly less. Allocation then runs on the post-accrual figure.

### E6 — Zero payment

Payment 0.000. → no accrual, no allocation; `updated_instalments` == input; `credit_balance_delta` 0;
`tolerance_written_off` 0; a zero-value `transaction` is emitted with `value_date`.

## 7. Non-Functional Requirements

- **NFR-1 (precision):** exact decimal arithmetic in fils; binary floating point is prohibited.
- **NFR-2 (determinism):** identical inputs → byte-identical outputs; ordering ties resolved
  deterministically (FR-4).
- **NFR-3 (purity):** no mutation of inputs, no I/O, no system-clock reads (FR-2).
- **NFR-4 (auditability):** every call — including zero and rejected-then-corrected — is expressible
  as one allocation transaction carrying value date and full breakdown (FR-10).
- **NFR-5 (conservation of money):** for any accepted non-zero payment,
  `sum(applied across all buckets) + tolerance_written_off + credit_balance_delta == payment.amount`.
  This invariant must hold exactly and should be asserted in tests.

## 8. Non-Goals (explicit, v1)

- **Applying or spending the existing credit balance.** This function only adds to it. Consuming
  credit against newly-due instalments is a separate due-date-triggered mechanism.
- **Future/not-yet-due instalments.** Never receive allocation here.
- **Principal curtailment / prepayment** from surplus. Surplus always becomes credit.
- **Refunds.** Never issued by this function.
- **Borrower-directed allocation.** The waterfall is fixed; no overrides.
- **Computing interest/penalty rates or schedules.** Rates, bases, and conventions are supplied as
  inputs; the function only performs the accrual arithmetic to `value_date`.
- **Forward-dated value dates.** `value_date > as_of_date` is rejected, not projected.
- **Overpayment write-off.** Tolerance covers under-payment only.

## 9. Open Questions

None open. The three previously-open items are resolved and encoded above:

1. **Penalty re-accrual basis (FR-3)** — resolved: penalties accrue on the **total overdue instalment
   balance** (past-due principal + past-due interest), at a supplied `daily_penalty_rate`, same
   `day_count_convention` as interest.
2. **Zero-payment vs. accrual (FR-8)** — resolved: the zero path is a strict no-op with **no
   re-accrual**; balances unchanged; one zero-value audit transaction.
3. **Same-due-date tie-break (FR-4)** — resolved: order by instalment `id` ascending.

## 10. Assumptions Index

Items inferred or delegated, to confirm:

- **§3.1 / §3.3** — `reference_id`, `operator`, `channel` are optional pass-through audit fields;
  no specific audit schema is mandated beyond `value_date` + allocation content (stakeholder: good
  practice, do not over-specify).
- **§3.2** — accrual inputs (`as_of_date`, `daily_interest_rate`, `penalty_accrual_params`,
  `day_count_convention`) live on the `loan` object and are supplied, not computed.
- **FR-1 (forward value date)** — stakeholder delegated "error or clamp"; this spec chooses **error**.
- **FR-3** — exact interest formula and day-count convention are supplied; function does the arithmetic.
  Penalty basis **confirmed** (total overdue instalment balance; supplied `daily_penalty_rate`).
- **FR-4** — oldest-first by `due_date`; ties broken by `id` ascending (**confirmed**).
- **FR-6** — tolerance drawn from principal first (lowest priority), up the order if needed; reported
  as one per-instalment total.
- **FR-8** — zero path skips accrual (**confirmed**: strict no-op, no re-accrual).

---

## Confirmed policy decisions (source of truth)

For traceability, the stakeholder-confirmed decisions this spec encodes:

| # | Decision | Answer |
|---|---|---|
| A | Bucket order within an instalment | **Fees → Penalties → Interest → Principal** |
| B | Traversal across instalments | **Row-major, oldest-first** (exhaust oldest fully, then next) |
| C | Overpayment / surplus | **Held as credit balance**; auto-applied later by a separate due-date mechanism; never refunded, never curtails principal |
| D | Partial payment | **Apply as far as it reaches**; remainder stays outstanding |
| E | Eligible instalments | **Due / past-due only**; surplus → credit (never future instalments) |
| F | Who directs allocation | **Institution-directed, fixed**; no borrower override; no statutory exceptions identified |
| G | Currency / rounding | **BHD, 3dp (fils); round half-up to 3dp; rounding residuals absorbed into interest** |
| H | Invalid / edge inputs | Negative → **error**; zero → **no-op + zero-value transaction**; nothing owed → **full amount to credit** |
| — | Tolerance write-off | **≤ 5 fils per instalment, under-payment only**, written off so instalment is fully paid |
| — | Value date | Function **recomputes interest & penalties to `value_date`** before the waterfall; **back-dating in scope**, forward dates rejected |
| — | Return contents | Per-instalment per-bucket breakdown; resulting balances; `credit_balance` delta; `tolerance_written_off`; audit transaction with `value_date` |
| — | Purity | **Pure / non-mutating** |


## Auditor verdict

_The spec covers and correctly matches 13 of 14 reference decisions, including all the genuinely bespoke ones (bucket order, credit-balance surplus handling, BHD 3dp precision, residual-to-interest, back-valued accrual, no-principal-prepay, tolerance write-off). The sole gap is decision 13 (same-day multiple payments, FIFO by timestamp): the spec is scoped to a single payment and never addresses ordering across concurrent same-day payments. Coverage = 13/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | FR-5: "Within a single instalment, a payment consumes buckets in this fixed order: Fees → Penalties → Interest → Principal" | Spec states fees before penalties before interest before principal, matching the reference exactly including the deliberate fees-before-penalties choice. |
| 2 | yes | **yes** | FR-4: "The full waterfall is run on the oldest eligible instalment until it is fully paid or funds run out, and only then does the next instalment begin. This is row-major" | Oldest instalment cleared fully across all buckets before any money reaches the next, matching the reference strategy. |
| 3 | yes | **yes** | FR-7: surplus "added to the loan's credit balance ... never auto-refunded ... Application of credit to newly-due instalments is a separate due-date-triggered mechanism" | Surplus held as credit balance, applied later by a separate due-date mechanism, never auto-refunded — matches reference exactly. |
| 4 | yes | **yes** | §2 Glossary: "BHD / fils — Bahraini dinar ... all amounts carry 3 decimal places"; FR-11: "All inputs and outputs are BHD to 3 decimal places" | Currency is BHD at 3 dp (fils), matching the reference minor unit. |
| 5 | yes | **yes** | FR-11: "Any value requiring rounding ... is rounded half-up to 3 dp" | Round half-up to the 3dp minor unit matches the reference rounding method. |
| 6 | yes | **yes** | FR-11: "Rounding residuals are absorbed into the interest bucket, never principal" | Residual destination is the interest component, matching the reference. |
| 7 | yes | **yes** | FR-3: "Back-dated value_date ... interest/penalties are accrued to that earlier date"; E5 shows less accrual when back-dated | A value_date earlier than today triggers re-accrual of interest to that value date before allocation, matching the reference. |
| 8 | yes | **yes** | FR-4: future instalments "receive nothing"; FR-7: surplus "never curtails (pre-pays) principal"; §8 Non-Goals: "Principal curtailment / prepayment from surplus. Surplus always becomes credit" | An early/on-time payment settles only eligible instalments; surplus becomes credit and never prepays principal, so future interest is unchanged — matches the reference. |
| 9 | yes | **yes** | FR-5: "A bucket must be reduced to zero before the next bucket in the order receives any funds" | Strict in-order bucket filling with no proportional split, matching the reference. |
| 10 | yes | **yes** | FR-6: "if the total residual across all four buckets ≤ 0.005 BHD (5 fils) ... that residual is written off and the instalment is marked fully_paid" | Tolerance threshold of ≤ 0.005 BHD per instalment, written off and marked fully paid, matches the reference exactly. |
| 11 | yes | **yes** | FR-1: "payment.amount < 0 → raise a validation error"; FR-8: "zero-value allocation transaction is still produced" | Negative rejected with error; zero is a no-op that still records a zero-value allocation transaction — matches the reference. |
| 12 | yes | **yes** | FR-3: penalties "re-accrued to value_date"; §4 step 3 accrue then step 5 allocate; "Allocation runs on these post-accrual balances" | Penalties accrue to the value date and allocation runs on post-accrual balances, matching the reference accrue-then-allocate order. |
| 13 | no | no | absent | The spec scopes allocate_payment to a single payment and never addresses ordering of multiple same-day payments or FIFO by receipt timestamp; the only tie-break discussed (FR-4) is for instalment due dates, not payments. |
| 14 | yes | **yes** | §3.3: "allocations — per-instalment, per-bucket breakdown ... updated_instalments ... credit_balance_delta ... tolerance_written_off" | Returns per-bucket amounts applied per instalment, resulting balances, credit balance created, and tolerance written off — matches the reference result shape. |
