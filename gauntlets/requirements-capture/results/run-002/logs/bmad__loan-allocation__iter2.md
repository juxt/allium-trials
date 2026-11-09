# bmad — loan-allocation — iteration 2

Model (author): claude-opus · Questions asked: 13 · Captured: 11/14 · Bespoke captured: 5/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured question prompt didn't go through. No problem — I'll just ask in plain text. Here are the material policy decisions I need you to rule on before I can write a correct spec. Please answer each; where you're unsure, tell me and I'll flag it as an open question rather than guess.

**Core allocation policy**

1. **Waterfall order (within an instalment).** In what priority order does a payment pay down the four component types? Common choices: `Penalties → Fees → Interest → Principal` (charges first), or `Interest → Principal → Fees → Penalties` (core debt first), or something else.

2. **Sweep shape (across multiple outstanding instalments).** Assuming oldest-first, do we (a) **instalment-major** — fully clear the oldest instalment's components before touching the next instalment; or (b) **component-major** — pay one component type across *all* instalments before moving to the next component (e.g. all penalties oldest→newest, then all fees, …); or (c) some hybrid?

3. **Instalment ordering direction.** Oldest-first (FIFO)? Or is there a different priority (e.g. most-overdue, or a specific past-due-before-current rule)?

4. **Overpayment.** If the payment exceeds everything currently outstanding, what happens to the surplus — hold as unapplied/suspense credit, apply to future principal (curtailment), refund, or reject/cap?

5. **Partial payment.** If the payment can't fully clear the next item in the waterfall (or leaves an instalment partly paid), do we apply it partially as far as it reaches, or hold the payment (or the unallocatable remainder) in suspense until it can satisfy a full instalment?

**Scope / mechanics**

6. **Eligible instalments.** Does "what they currently owe" include only due/past-due instalments, or can payment reach not-yet-due future instalments?

7. **Rounding & currency.** What's the money representation and rounding rule (e.g. integer minor units / Decimal, round-half-up to the cent), and where does any rounding remainder land?

8. **Degenerate inputs.** How should the function treat a zero payment, a negative payment (reversal?), a payment against a fully-paid loan, or a loan with no outstanding instalments?

9. **Return shape.** I'll propose a structure — a per-instalment, per-component breakdown of amounts applied, plus the updated balances and any surplus/suspense and remaining-unpaid totals. Any specific fields your downstream systems require (e.g. an ordered allocation ledger, remaining balance per component, transaction IDs)?

Answer what you can; I'll turn your rulings into the spec and tag anything you leave open.
A: Answers in order:

1. **Waterfall order within an instalment:** Fees → Penalties → Interest → Principal. Fees before penalties.

2. **Sweep shape:** Instalment-major. Clear all four buckets of the oldest instalment in full before any money touches the next instalment.

3. **Instalment ordering:** Oldest-first (FIFO). Clear the oldest overdue instalment completely before moving to the next.

4. **Overpayment:** Surplus is held as an unallocated credit balance. It is auto-applied to the next instalment when that instalment falls due. It is never auto-refunded.

5. **Partial payment:** Apply strictly in waterfall order, filling each bucket as far as the payment reaches. No proportional split, no suspense hold — partial allocation is fine; leave the remainder of that bucket (and subsequent buckets) outstanding.

6. **Eligible instalments:** Only due and past-due instalments. Payment cannot reach not-yet-due future instalments. [The overpayment surplus mechanism in answer 4 handles forward application via the credit balance, not direct allocation.]

7. **Rounding and currency:** Loan currency is BHD (Bahraini Dinar), 3 decimal places (fils). Round half-up to 3 dp throughout. Any rounding residual is absorbed into the interest component, not principal.

8. **Degenerate inputs:** Negative payment — rejected with an error. Zero payment — accepted as a no-op but still records a zero-value allocation transaction. Payment against a fully-paid loan or one with no outstanding instalments — [default, not policy] treat as a zero-effect no-op; record the transaction; return zero allocations and the existing (zero) balances.

9. **Return shape:** Per payment, return: amount applied to each bucket of each instalment touched; resulting outstanding balance per bucket per instalment; any `credit_balance` created; any `tolerance_written_off` amount (write-off tolerance is residual ≤ 0.005 BHD after allocation — instalment marked fully paid, residual written off). That's the required shape; add transaction IDs or ledger ordering on top as your implementation needs.

### Round 2
_Step reasoning:_ (live agent turn)

Q: That's a thorough set of rulings — thank you. Two of your answers introduced mechanics that raise genuinely ambiguous follow-ups I can't resolve by inference. Let me close those, then I'll write the spec.

1. **Existing credit balance on entry.** Answer 4 says surplus is held as a credit balance and "auto-applied to the next instalment when that instalment falls due." Does that auto-application happen *inside* `allocate_payment` — i.e. when called, does it first consume any pre-existing `credit_balance` against now-due instalments (before/with the new payment)? Or is credit application a *separate* process (triggered at due-date elsewhere), making the credit balance purely an output of this function and never an input it acts on?
   - Related: if `allocate_payment` *does* consume existing credit, does the credit get applied **before** the new payment, combined with it into one pool, or **after**?

2. **Tolerance write-off — scope and trigger.** You defined write-off as residual ≤ 0.005 BHD after allocation, instalment marked fully paid.
   - Is the 0.005 threshold evaluated on an **instalment's total residual across all four buckets**, or **per bucket**?
   - Does it apply **only to instalments this payment actually touched**, or is every due instalment with a tiny residual swept?
   - When a residual is written off, which bucket(s) does the `tolerance_written_off` amount come from for reporting — the still-outstanding bucket(s), or just reported as a lump per instalment?

3. **Rounding application point (quick confirm).** Round-half-up to 3dp with residual absorbed into interest — since allocation is subtractive against balances you supply, where do you expect rounding to actually bite: on the incoming `payment` amount only, on each computed bucket allocation, or are inputs guaranteed already at 3dp so rounding only matters for the interest-residual/tolerance interplay? I want to pin down exactly when the half-up rounding is invoked.

Answer these and I'll produce `spec.md`.
A: Answers in order:

**1. Existing credit balance on entry.**
Credit application is a *separate* process triggered at the due-date event, not inside `allocate_payment`. The function treats `credit_balance` as a pure output — it may create or increment it, but never reads or consumes a pre-existing balance. Any prior credit is applied by the due-date scheduler before (or instead of) calling `allocate_payment`. [default, not policy — the key does not specify this boundary.]

**2. Tolerance write-off — scope and trigger.**
- Threshold evaluated on the **instalment's total residual across all four buckets combined**, not per bucket. [default, not policy]
- Applies **only to instalments this payment actually touched** during allocation. Untouched instalments with small residuals are not swept. [default, not policy]
- For reporting, `tolerance_written_off` is a **lump amount per instalment**; attribute it to the outstanding bucket(s) in waterfall order (fees first, then penalties, then interest, then principal) until the written-off amount is consumed. [default, not policy]

**3. Rounding application point.**
Inputs (payment amount, existing balances) are expected already at 3 dp. Rounding is applied to each **computed bucket allocation amount** as it is derived. The interest-residual rule exists specifically for the case where the sum of rounded per-bucket allocations does not exactly match the input figures — the difference is absorbed into the interest allocation rather than principal. [default, not policy]

### Round 3
_Step reasoning:_ (live agent turn)

Q: Done — the specification is saved as `spec.md`.

**What's in it:** a complete requirements spec for `allocate_payment(payment, loan)` — glossary, input/output contract, 13 numbered functional requirements, a normative step-by-step allocation algorithm, six worked examples (including tolerance edge cases E4/E5 at the 0.005 BHD boundary), non-goals, and cross-cutting precision/audit requirements.

**How your rulings landed:**
- Waterfall **fees → penalties → interest → principal** (FR-3), **instalment-major** (FR-4), **oldest-first FIFO** (FR-5), **due/past-due only** (FR-7), **partial fill, no suspense** (FR-8), **overpayment → credit, never refunded** (FR-9), **BHD/3dp/half-up, residual into interest** (FR-10), **negative rejected / zero no-op** (FR-2, FR-13), and your required **return shape with `credit_balance` and `tolerance_written_off`** (§3.3, FR-12).

**One thing to flag for your attention:** the six answers you marked `[default, not policy]` are collected in **§9 Assumptions Index** (A1–A6) with the FR each maps to, plus four **§10 Open Questions**. The one I'd single out is **A2** — as specified (FR-14), a positive payment against a loan with no eligible instalments is a zero-effect no-op and creates *no* credit balance. That sits in slight tension with your overpayment rule (FR-9), where surplus *does* bank to credit. If an institution would rather bank such a payment than drop it, that's a one-line policy change — worth a deliberate decision rather than inheriting the default.

Status is `draft` pending your confirmation of A1–A6. Want me to flip any of those defaults, or mark the spec final as-is?
A: On A2: flip it. A positive payment when there are no eligible instalments should bank the full amount as a credit balance, consistent with the overpayment rule (FR-9). Treating it as a no-op would be an inconsistent special case — the payment is, in effect, entirely surplus. Update FR-14 accordingly and remove A2 from the assumptions index.

A1, A3–A6: confirm as-is. The defaults are reasonable and nothing in policy contradicts them.

With that change, mark the spec final.

### Round 4
_Step reasoning:_ (live agent turn)

Q: The spec is **final**. Changes applied:

- **FR-14 flipped** — a positive payment with no eligible instalments now banks the full amount to `credit_balance` (consistent with FR-9), rather than being a no-op. Updated the requirement, the algorithm (step 3), and worked example E6.
- **A2 removed** from the assumptions index, with a note recording the flip for provenance.
- **A1, A3–A6 confirmed** — §9 reframed from "to confirm" to "confirmed defaults (2026-11-08)", and the inline `[flagged]` notes in FR-11/FR-12 updated to "confirmed."
- Tidied the §0 preamble and Open Question #1 to match.
- `status: final` in the frontmatter.

`spec.md` is complete and consistent. The four items remaining in §10 (Open Questions) are genuine future/implementation concerns — credit-balance consumption in *other* functions, write-off directionality, ledger/transaction-ID shape, and instalment status transitions — not blockers for this spec. Let me know if you'd like any of those resolved now too.
A: Noted — spec confirmed final.

## Produced specification

---
title: Payment Allocation — allocate_payment(payment, loan)
status: final
created: 2026-11-08
updated: 2026-11-08
---

# Requirements Specification: Payment Allocation

## 0. Document Purpose

This specification defines the behaviour of a single function,
`allocate_payment(payment, loan)`, in the loan servicing system. It is written for the
engineer implementing the function and the reviewers/testers verifying it. It is
capability- and behaviour-focused; it does not prescribe language, data structures beyond the
observable input/output contract, or storage.

Every allocation *policy* in this document was ruled by the product stakeholder and is stated
as a normative requirement. Several points the stakeholder initially flagged as **default, not
policy** have since been confirmed (or, for the former A2, deliberately flipped — see FR-14);
they are recorded in §9 for provenance.

Normative keywords: **MUST**, **MUST NOT**, **SHOULD** carry RFC-2119 force.

---

## 1. Overview

When a borrower pays, the money must be applied across what they currently owe. A loan carries
one or more outstanding **instalments**, each split into four **buckets**: fees, penalties,
interest, and principal. `allocate_payment` applies a single payment deterministically across
the eligible instalments, reports exactly how every unit of money was applied, returns the
loan's updated per-bucket balances, and surfaces any surplus held as credit and any residual
forgiven under a rounding tolerance.

The function is **pure with respect to policy**: given the same `payment` and `loan` state it
MUST produce the same allocation. It does not read or mutate any state outside the `payment`
and `loan` it is given (see FR-11 on the credit-balance boundary).

---

## 2. Glossary

Downstream code, tests, and this document use these terms exactly. No synonyms.

- **Payment** — a single incoming amount of money to be applied to a loan, expressed in the
  loan currency to 3 decimal places. May be zero. MUST NOT be negative (FR-2).
- **Loan** — the servicing object being paid. Holds an ordered set of instalments and a
  `credit_balance`.
- **Instalment** — one scheduled obligation on the loan. Has a due date, a status (e.g. due /
  past-due / not-yet-due / fully-paid), and four buckets. Instalments are ordered by due date.
- **Bucket** — one of the four component balances of an instalment: **fees**, **penalties**,
  **interest**, **principal**. Each holds an outstanding amount ≥ 0 to 3 dp.
- **Waterfall order** — the fixed within-instalment priority in which buckets are paid:
  **fees → penalties → interest → principal** (FR-3).
- **Eligible instalment** — an instalment that is **due or past-due**. Not-yet-due instalments
  are never eligible (FR-7).
- **FIFO / oldest-first** — eligible instalments are processed by due date, oldest first (FR-5).
- **Instalment-major allocation** — all four buckets of one instalment are settled before any
  money reaches the next instalment (FR-4).
- **Credit balance** (`credit_balance`) — surplus held on the loan after all eligible
  instalments are settled. Output-only for this function (FR-11); never auto-refunded (FR-9).
- **Tolerance write-off** (`tolerance_written_off`) — a residual ≤ 0.005 BHD on a *touched*
  instalment, forgiven so the instalment is marked fully paid (FR-12).
- **Touched instalment** — an instalment to which this payment applied a non-zero amount to at
  least one bucket.
- **Fils** — the minor unit of BHD; the currency carries **3 decimal places** (FR-10).

---

## 3. Inputs and Outputs (Contract)

### 3.1 Input: `payment`
A monetary amount in BHD, to 3 dp. Expected already normalised to 3 dp (FR-10). May be `0`.
Negative is a rejected error input (FR-2).

### 3.2 Input: `loan`
Carries at minimum:
- An ordered collection of instalments, each with: due date / status, and the four bucket
  outstanding amounts (fees, penalties, interest, principal), each ≥ 0 to 3 dp.
- The current `credit_balance` (read-only for this function — see FR-11).

### 3.3 Output: allocation result
The function MUST return an object containing:

1. **Per-instalment, per-bucket amount applied** — for every instalment touched, the amount
   allocated to each of its four buckets.
2. **Resulting outstanding balance per bucket per instalment** — the updated balances after
   allocation and any tolerance write-off.
3. **`credit_balance`** — any surplus created/incremented by this payment (FR-9).
4. **`tolerance_written_off`** — per touched instalment, the lump residual forgiven (FR-12);
   zero or absent where none.

Implementations MAY add transaction IDs and an ordered allocation ledger on top of this shape;
the four elements above are the required minimum.

---

## 4. Functional Requirements

### FR-1: Deterministic single-payment allocation
`allocate_payment` applies one `payment` to one `loan` and returns the allocation result of
§3.3.
**Consequences (testable):**
- Identical `(payment, loan)` inputs always produce identical output.
- The sum of all per-bucket amounts applied, plus any `credit_balance` created, plus any
  `tolerance_written_off`, equals the `payment` — **except** that `tolerance_written_off` is a
  forgiveness of residual, not a use of payment money, so it MUST NOT be funded from the
  payment (see FR-12). The reconciled identity is therefore:
  *sum(amounts applied) + credit_balance created = payment.*

### FR-2: Reject negative payments
A negative `payment` MUST be rejected with an error. No allocation, no state change, no
transaction recorded.
**Consequences:**
- `payment < 0` → error raised/returned; loan unchanged.

### FR-3: Within-instalment waterfall order — fees → penalties → interest → principal
Within any instalment, the payment MUST fill buckets strictly in the order **fees, then
penalties, then interest, then principal**. Fees are paid before penalties.
**Consequences:**
- No money reaches an instalment's penalties until its fees bucket is 0.
- Likewise penalties before interest, interest before principal.

### FR-4: Instalment-major allocation
All four buckets of the current instalment MUST be settled (or the payment exhausted) before
any money is applied to the next instalment. No component-major ("sweep one bucket across all
instalments") behaviour.
**Consequences:**
- Given two eligible instalments and enough money to clear the first, the first instalment's
  four buckets are all 0 before the second instalment receives anything.

### FR-5: Oldest-first (FIFO) ordering
Eligible instalments MUST be processed oldest due date first. The oldest overdue instalment is
cleared completely before the next.
**Consequences:**
- With instalments due 2026-01, 2026-02, 2026-03 all eligible, allocation order is Jan → Feb →
  Mar.

### FR-7: Eligibility — due and past-due only
Only **due and past-due** instalments are eligible targets. The function MUST NOT allocate any
payment amount to a not-yet-due future instalment.
**Consequences:**
- A future-dated instalment's buckets are unchanged by this function regardless of payment size.
- Forward application to future instalments happens only via the credit balance (FR-9),
  handled by a separate due-date process (FR-11) — never by direct allocation here.

### FR-8: Partial allocation — fill as far as the money reaches
When the payment cannot fully clear the next bucket in the waterfall, it MUST be applied to
that bucket as far as it reaches, leaving the remainder of that bucket and all subsequent
buckets outstanding. There is **no** proportional/pro-rata split and **no** suspense hold of
partial amounts.
**Consequences:**
- Bucket allocation = `min(remaining_payment, bucket_outstanding)`.
- When `remaining_payment` hits 0 mid-waterfall, every later bucket in that instalment and all
  later instalments are left untouched.

### FR-9: Overpayment → credit balance, never auto-refunded
Any surplus remaining after all eligible instalments are settled MUST be added to the loan's
`credit_balance`. The surplus MUST NOT be auto-refunded to the borrower.
**Consequences:**
- Payment exceeding total eligible outstanding → the excess appears as `credit_balance` in the
  output; no refund path is taken.
- The credit balance is auto-applied to an instalment when that instalment later falls due —
  by the **separate due-date process**, not by this function (FR-11).

### FR-10: Currency and rounding — BHD, 3 dp, half-up, residual into interest
The loan currency is **BHD** with **3 decimal places** (fils). Inputs (`payment`, existing
balances) are expected already at 3 dp.
- Each **computed bucket allocation amount** MUST be rounded **half-up to 3 dp** as it is
  derived.
- Where the sum of rounded per-bucket allocations for an instalment does not exactly match the
  figures consumed, the difference MUST be absorbed into that instalment's **interest**
  allocation — **never** principal.
**Consequences:**
- All reported amounts carry at most 3 dp.
- A rounding discrepancy within an instalment adjusts interest, leaving principal exact.

### FR-11: Credit balance is output-only (no consumption on entry)
This function MUST NOT read or consume a pre-existing `credit_balance`. It may only create or
increment it (FR-9). Application of an existing credit balance to due instalments is performed
by the separate due-date scheduler **before** (or instead of) calling this function.
**Consequences:**
- A loan entering `allocate_payment` with a non-zero `credit_balance` has that balance
  untouched except for any increment this payment produces.
- *(Confirmed default — see §9, A1.)*

### FR-12: Tolerance write-off (residual ≤ 0.005 BHD on touched instalments)
After allocating to an instalment, if that instalment is **touched** and its **total residual
across all four buckets combined** is greater than 0 and **≤ 0.005 BHD**, the residual MUST be
written off: the instalment is marked fully paid and the forgiven amount reported as
`tolerance_written_off` for that instalment.
- The threshold is evaluated on the instalment's **combined** residual, not per bucket.
- Only instalments **touched** by this payment are evaluated. Untouched instalments with small
  residuals are not swept.
- `tolerance_written_off` is reported as a **lump per instalment**; the written-off amount is
  attributed to the still-outstanding buckets in **waterfall order** (fees, penalties,
  interest, principal) until consumed, zeroing those buckets.
- The write-off is **not** funded from the payment; it forgives residual the payment did not
  cover.
**Consequences:**
- Instalment with 0.004 BHD left on principal after a touching payment → principal 0,
  instalment fully paid, `tolerance_written_off = 0.004`.
- Instalment with 0.006 BHD residual → not written off; remains outstanding.
- *(Threshold scope, touched-only, and attribution are confirmed defaults — see §9, A3–A5.)*

### FR-13: Zero payment — recorded no-op
A `payment` of exactly `0` MUST be accepted as a no-op that changes no balances, but MUST still
record a zero-value allocation transaction and return zero allocations with the loan's existing
balances.
**Consequences:**
- `payment == 0` → all per-bucket amounts applied are 0; balances unchanged; transaction
  recorded; no tolerance write-off (no instalment is touched).

### FR-14: No eligible outstanding instalments — bank full payment as credit
If the loan is fully paid or has no due/past-due outstanding instalments, a positive payment
MUST be banked in full to the loan's `credit_balance`, consistent with the overpayment rule
(FR-9) — the payment is entirely surplus. The transaction MUST be recorded with zero per-bucket
allocations. (A zero payment remains a recorded no-op under FR-13.)
**Consequences:**
- Positive payment against a fully-paid loan → zero per-bucket allocations; `credit_balance`
  += full payment; transaction recorded.
- No special-case no-op path exists for a positive payment; surplus is handled uniformly via
  `credit_balance`.

---

## 5. Allocation Algorithm (Normative)

1. **Validate.** If `payment < 0` → reject with error (FR-2). Stop.
2. **Zero payment.** If `payment == 0` → record a zero-value transaction; return zero
   allocations and existing balances (FR-13). Stop.
3. **Select eligible instalments.** Take all **due or past-due** instalments (FR-7), ordered
   oldest-first (FR-5). If none → bank the full positive payment to `credit_balance`, record a
   transaction with zero per-bucket allocations, and return (FR-14). Stop.
4. **Initialise** `remaining = payment`.
5. **For each eligible instalment, oldest first:**
   a. For each bucket in order **fees, penalties, interest, principal**:
      - `alloc = round_half_up_3dp(min(remaining, bucket_outstanding))`
      - Reduce `bucket_outstanding` by `alloc`; reduce `remaining` by `alloc`; record `alloc`.
      - If `remaining == 0`, stop filling further buckets in this instalment.
   b. **Rounding reconciliation (FR-10):** if the rounded per-bucket allocations for this
      instalment do not exactly reconcile with the amount consumed, absorb the difference into
      this instalment's **interest** allocation (never principal).
   c. **Tolerance (FR-12):** if this instalment was **touched** and its combined residual
      across the four buckets is `0 < residual ≤ 0.005`, write it off — attribute the lump to
      outstanding buckets in waterfall order, zero them, mark instalment fully paid, and record
      `tolerance_written_off` for this instalment.
   d. If `remaining == 0`, continue only to evaluate already-touched state as needed; do not
      touch further instalments.
6. **Surplus (FR-9).** If `remaining > 0` after all eligible instalments, add it to
   `credit_balance`; set `remaining = 0`. Never refund.
7. **Return** the §3.3 result.

Invariant (FR-1): *sum(all amounts applied) + credit_balance created = payment.* Tolerance
write-offs are reported separately and are not funded from `payment`.

---

## 6. Worked Examples

All amounts in BHD (3 dp). Buckets written `fees / penalties / interest / principal`.

### E1 — Partial payment, single instalment, waterfall
Instalment #1 (past-due): `2.000 / 1.500 / 5.250 / 100.000`. Payment `8.000`.
- fees 2.000 (rem 6.000) → penalties 1.500 (rem 4.500) → interest 4.500 (rem 0.000) →
  principal 0.000.
- Residual = `0.000 / 0.000 / 0.750 / 100.000` = 100.750 → no write-off.
- **Result:** applied `2.000 / 1.500 / 4.500 / 0.000`; outstanding `0 / 0 / 0.750 / 100.000`;
  `credit_balance` +0; `tolerance_written_off` 0.

### E2 — Instalment-major across two instalments
#1: `1.000 / 0.500 / 2.000 / 20.000` (23.500). #2: `1.000 / 0.000 / 2.500 / 25.000` (28.500).
Payment `30.000`.
- #1 fully cleared (consumes 23.500; rem 6.500).
- #2: fees 1.000 (rem 5.500) → penalties 0 → interest 2.500 (rem 3.000) → principal 3.000
  (rem 0), principal residual 22.000.
- **Result:** #1 all 0; #2 outstanding `0 / 0 / 0 / 22.000`; `credit_balance` +0.

### E3 — Overpayment → credit balance
#1 only: `1.000 / 0.500 / 2.000 / 20.000` (23.500). Payment `25.000`.
- #1 cleared (consumes 23.500; rem 1.500). No further eligible instalments.
- **Result:** #1 all 0; `credit_balance` += 1.500 (not refunded, not applied forward here).

### E4 — Tolerance write-off
#1: `1.000 / 0.000 / 0.000 / 10.000` (11.000). Payment `10.996`.
- fees 1.000 (rem 9.996) → penalties 0 → interest 0 → principal 9.996 (rem 0), principal
  residual 0.004.
- Instalment touched; combined residual 0.004 ≤ 0.005 → write off. Attribute lump to
  principal (the only outstanding bucket).
- **Result:** applied `1.000 / 0 / 0 / 9.996`; outstanding all 0; instalment fully paid;
  `tolerance_written_off` (#1) = 0.004; `credit_balance` +0.

### E5 — Residual just above tolerance
As E4 but payment `10.994` → principal residual 0.006 > 0.005 → **no** write-off; instalment
remains outstanding `0 / 0 / 0 / 0.006`.

### E6 — Degenerate inputs
- Payment `-5.000` → error, loan unchanged (FR-2).
- Payment `0.000` → zero allocations, balances unchanged, transaction recorded (FR-13).
- Payment `15.000` on a fully-paid loan → zero per-bucket allocations; `credit_balance` +=
  15.000; transaction recorded (FR-14).

---

## 7. Non-Goals / Out of Scope

- **Applying an existing credit balance** to due instalments — owned by the separate due-date
  scheduler (FR-11).
- **Refunds / disbursement** of credit balances (FR-9).
- **Accrual/computation** of interest, penalties, or fees — buckets arrive pre-computed.
- **Allocation to not-yet-due instalments** (FR-7).
- **Reversals** beyond rejecting negative payments (FR-2) — reversal is not modelled as a
  negative payment here.
- Persistence, transaction-ID generation scheme, concurrency/locking, and currency other than
  BHD.

---

## 8. Cross-Cutting Requirements

- **Precision/correctness:** use an exact decimal representation (e.g. integer fils or a
  Decimal type) to avoid binary float drift; all arithmetic resolves to 3 dp half-up (FR-10).
- **Auditability:** every call (including no-ops, FR-13/FR-14) records a transaction. Negative
  payments (FR-2) are rejected and record no transaction.
- **Idempotency of description:** the output fully describes the mutation so callers need not
  re-derive it.

---

## 9. Assumptions Index — confirmed defaults

These were originally marked **default, not policy** and have since been **confirmed by the
stakeholder (2026-11-08)**. They are recorded here for provenance. (The former A2 was *flipped*
— see FR-14; a positive payment with no eligible instalments now banks to `credit_balance`
rather than being a no-op — and is removed from this index.)

- **A1 (FR-11): Credit balance is output-only.** This function never consumes a pre-existing
  `credit_balance`; a separate due-date process applies it. *Confirmed.*
- **A3 (FR-12): Tolerance threshold evaluated on the instalment's combined residual across all
  four buckets** (not per bucket). *Confirmed.*
- **A4 (FR-12): Tolerance applies only to instalments this payment touched**; untouched
  instalments with small residuals are not swept. *Confirmed.*
- **A5 (FR-12): `tolerance_written_off` reported as a lump per instalment**, attributed to
  outstanding buckets in waterfall order. *Confirmed.*
- **A6 (FR-10): Rounding applied to each computed bucket allocation**, inputs assumed already
  at 3 dp, with the per-instalment reconciliation difference absorbed into interest. *Confirmed.*

---

## 10. Open Questions

1. **Credit balance as input (A1):** Should any variant of `allocate_payment` ever consume an
   existing credit balance, or is that boundary permanent? (The output-only boundary is
   confirmed for this function; this question only concerns possible future variants.)
2. **Tolerance direction only positive?** Confirm write-off only ever *forgives* a borrower
   residual (never creates an overpayment adjustment the other way).
3. **Transaction/ledger shape:** Are transaction IDs and an ordered allocation ledger required
   by downstream systems, or optional implementation add-ons (§3.3)?
4. **Status transitions:** Beyond "fully paid," are there instalment status values the output
   must set (e.g. partially-paid) for downstream consumers?


## Auditor verdict

_The spec resolves 11 of 14 decisions correctly, covering all the genuinely bespoke policy choices (1 bucket order, 3 credit balance, 4 BHD 3dp, 5 half-up, 6 residual to interest, 8 early-payment surplus, 10 tolerance) plus the more inferable ones (9 strict order, 11 zero/negative, 14 result shape) and 2. The three gaps all concern value-date/temporal behaviour explicitly pushed out of scope: #7 back-valued payment re-accrual, #12 penalty accrual on the value date, and #13 same-day multiple-payment FIFO ordering. These were never surfaced because the function treats buckets as pre-computed and handles only a single payment. Coverage = 11/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | FR-3: 'fill buckets strictly in the order fees, then penalties, then interest, then principal. Fees are paid before penalties.' | Spec states the exact bucket order fees → penalties → interest → principal, matching the reference, including the deliberate fees-before-penalties choice. |
| 2 | yes | **yes** | FR-4 (instalment-major): 'All four buckets of the current instalment MUST be settled... before any money is applied to the next' and FR-5: 'The oldest overdue instalment is cleared completely before the next.' | Spec requires oldest instalment fully cleared (all four buckets) before touching the next, matching the reference exactly. |
| 3 | yes | **yes** | FR-9: 'Any surplus... MUST be added to the loan's credit_balance. The surplus MUST NOT be auto-refunded... auto-applied to an instalment when that instalment later falls due.' | Matches reference: unallocated credit balance, applied automatically when next instalment falls due, never auto-refunded. |
| 4 | yes | **yes** | FR-10: 'The loan currency is BHD with 3 decimal places (fils).' | Spec explicitly states BHD at 3 dp, matching the reference currency and minor unit. |
| 5 | yes | **yes** | FR-10: 'Each computed bucket allocation amount MUST be rounded half-up to 3 dp as it is derived.' | Round half-up to the minor unit (3 dp) matches the reference rounding method exactly. |
| 6 | yes | **yes** | FR-10: 'the difference MUST be absorbed into that instalment's interest allocation — never principal.' | Residual destination is interest, never principal, matching the reference. |
| 7 | no | no | absent | The spec does not address back-valued payments with a value_date earlier than today triggering interest re-accrual. §7 lists accrual as out of scope and the function assumes buckets arrive pre-computed, so value-date re-accrual is neither surfaced nor resolved. |
| 8 | yes | **yes** | FR-7: 'MUST NOT allocate any payment amount to a not-yet-due future instalment'; FR-9: surplus becomes credit_balance and does not prepay principal. | Spec establishes that early/surplus payment settles only eligible (due/past-due) instalments, with surplus going to credit balance rather than prepaying principal, matching the reference. Future interest is unchanged since no not-yet-due principal is reduced. |
| 9 | yes | **yes** | FR-8: 'There is no proportional/pro-rata split and no suspense hold of partial amounts'; 'Bucket allocation = min(remaining_payment, bucket_outstanding).' | Strict in-order fill, no proportional split, matches the reference (one of the more inferable decisions). |
| 10 | yes | **yes** | FR-12: 'if that instalment is touched and its total residual across all four buckets combined is... ≤ 0.005 BHD, the residual MUST be written off: the instalment is marked fully paid.' | Tolerance threshold ≤ 0.005 BHD, marking instalment fully paid and writing off residual, matches the reference exactly. |
| 11 | yes | **yes** | FR-2: 'A negative payment MUST be rejected with an error'; FR-13: 'A payment of exactly 0 MUST be accepted as a no-op... but MUST still record a zero-value allocation transaction.' | Negative rejected with error, zero is a no-op that still records a zero-value transaction, matching the reference exactly. |
| 12 | no | no | absent | The spec explicitly lists penalty/fee/interest accrual as out of scope (§7, 'buckets arrive pre-computed') and never addresses accruing penalties up to and including the value date before allocation. Not surfaced. |
| 13 | no | no | absent | The function is scoped to a single payment; the spec does not address ordering of multiple same-day payments or FIFO-by-timestamp handling. The determinism clause concerns a single (payment, loan) call, not multi-payment sequencing. |
| 14 | yes | **yes** | §3.3: returns per-instalment per-bucket amount applied, resulting outstanding balance per bucket, credit_balance created, and tolerance_written_off per touched instalment. | Return shape covers all four required elements from the reference: amounts applied per bucket/instalment, resulting outstanding balances, credit_balance created, and tolerance_written_off. |
