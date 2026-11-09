# bmad — loan-allocation — iteration 1

Model (author): claude-opus · Questions asked: 15 · Captured: 12/14 · Bespoke captured: 6/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: The structured prompt was declined — let me just ask in plain text. Same questions, answer them however is easiest for you.

These are the material allocation-policy decisions I can't responsibly infer. **Round 1 — the waterfall itself:**

1. **Order across instalments.** When several instalments are outstanding, in what order does the payment hit them? (e.g. oldest-due-first/FIFO, newest-first, highest-cost-first, or pro-rata across all at once)

2. **Waterfall shape — instalment-first vs. component-first.** Do we fully clear the oldest instalment across *all* its components before moving to the next instalment (per-instalment waterfall)? Or do we clear one component type across *all* instalments first — all penalties, then all fees, then all interest, then all principal (horizontal/component-first)? Or some hybrid?

3. **Component order within an instalment.** What's the priority among the four components — e.g. penalties → fees → interest → principal, or some other sequence?

4. **Overpayment.** If the payment exceeds everything currently outstanding, what happens to the surplus — hold as unapplied/suspense credit, prepay principal, advance future instalments, or refund/reject?

Once I have these, I'll ask a short **Round 2** (partial-payment/shortfall handling, which instalments are eligible, rounding & currency, and input validation), then write `spec.md`.
A: 1. **Order across instalments:** Oldest-due-first (FIFO). Clear the oldest overdue instalment entirely before any money touches the next one.

2. **Waterfall shape:** Per-instalment. Fully clear the oldest instalment across all its components before moving to the next instalment. Not horizontal/component-first.

3. **Component order within an instalment:** Fees first, then penalties, then interest, then principal.

4. **Overpayment:** Surplus is held as an unallocated credit balance. It is auto-applied to the next instalment when that instalment falls due. It is never auto-refunded.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Clear — and noted that component order is **fees → penalties → interest → principal** (fees ahead of penalties), which I would not have guessed. 

**Round 2 — the remaining policy edges:**

5. **Partial payment / shortfall.** When the money runs out partway down the waterfall, do we partially pay the component we're on (allocate whatever's left and stop)? Or must each component be satisfied in full, with any sub-component remainder going to credit instead? I.e. is a partially-paid component allowed?

6. **Eligible instalments.** "Outstanding" — does that mean only instalments that are currently due or past due? Your overpayment answer implies we do **not** proactively reach into not-yet-due future instalments during allocation (surplus waits as credit until they fall due) — can you confirm a normal payment never touches a future instalment directly?

7. **Existing credit balance.** If the loan already carries an unallocated credit balance when a new payment arrives, is that existing credit consumed first (added to the incoming payment and run through the same waterfall), or does it stay parked and only the new payment is allocated?

8. **Rounding & currency.** What's the monetary unit and rounding rule — e.g. integer minor units (cents) with no rounding needed, or decimal amounts rounded half-up to 2 dp? And can I assume a single currency across the payment and all loan balances (mismatch is an error)?

9. **Input validation.** How should the function treat invalid or degenerate inputs — zero payment, negative payment, a non-finite amount, and a loan with nothing currently outstanding? Reject with an error, or allocate nothing / route the whole amount to credit?
A: 5. **Partial payment / shortfall:** Partially-paid components are allowed. Allocate whatever remains to the current bucket and stop. Strict sequential order; no proportional split across buckets.

6. **Eligible instalments:** Confirmed. A normal payment never touches a not-yet-due future instalment directly. Only instalments that are currently due or past due are eligible. Surplus waits as a credit balance until the next instalment falls due.

7. **Existing credit balance:** [default, not policy] The existing credit balance is combined with the incoming payment and the full combined amount runs through the same waterfall together. The credit is consumed first, then the new payment, in one unified allocation pass.

8. **Currency and rounding:** The loan currency is BHD (Bahraini dinar). All amounts are in fils — 3 decimal places. Round half-up to 3 dp throughout. Any rounding residual is absorbed into the interest component. Single currency across payment and all loan balances; a currency mismatch is an error.

9. **Input validation:** A negative payment is rejected with an error. A zero payment is a no-op but still records a zero-value allocation transaction. A non-finite amount [default, not policy] is rejected with an error. A payment against a loan with nothing outstanding routes the entire amount to the credit balance per rule 4.

### Round 3
_Step reasoning:_ (live agent turn)

Q: It's done — the specification is saved at `spec.md`.

## What's in it

A complete requirements spec for `allocate_payment(payment, loan)`, built entirely around the policy decisions you confirmed (not inferred). Highlights:

- **Glossary** fixing the data model (Loan, Instalment, the four Components, Credit Balance, Waterfall) in BHD/fils.
- **13 functional requirements**, each with testable consequences, grouped into: the waterfall (FR-1–3), overpayment & credit balance (FR-4–6), currency & rounding (FR-7–8), validation/edge cases (FR-9–12), and the return contract (FR-13).
- An **authoritative worked example** (two instalments, an 80.000-fils payment) that pins the ordering numerically so the implementer can't misread it.
- The confirmed policy encoded precisely: FIFO oldest-first, per-instalment vertical waterfall, **Fee → Penalty → Interest → Principal**, partial components allowed, surplus → never-refunded credit, only Due/Past-Due eligible, half-up to 3 dp with **residual absorbed into Interest**, and the full validation matrix.

## Two things I want to flag

1. **I captured your two `[default, not policy]` answers as such** (FR-6 combined credit, FR-11 non-finite rejection) in the Assumptions Index (§9), kept separate from the deliberate policy — so they're trivial to revisit without re-reading the whole doc.

2. **One genuine gap surfaced that you haven't ruled on** (§8, Open Question 1): FR-8 absorbs rounding residuals into Interest — but **what happens when the instalment's Interest is already 0.000?** There's no obvious fallback (Principal? Penalty? carry forward?), and it's a real reachable state. I'd recommend deciding this before implementation. There are also three lower-stakes opens: the allocation-date source (back-dating), the exact return-object shape, and in-place vs. new-state mutation.

Want me to get your answer on the zero-interest-residual case and fold it in, or leave it as a flagged open question for the implementation review?
A: Zero-interest residual fallback: if the Interest component for that instalment is 0.000 when the rounding residual needs to be absorbed, apply it to Principal instead. [default, not policy — worth locking before implementation.]

Fold it in; it is a real reachable state and an ambiguous spec is worse than a defaulted one.

I also have answers ready for the other three flagged opens (allocation-date source, return-object shape, mutation model) whenever you want to close them.

### Round 4
_Step reasoning:_ (live agent turn)

Q: Done — the zero-interest residual fallback is now locked into the spec:

- **FR-8** now states the residual goes to **Principal** when Interest is 0.000, with a testable consequence for it.
- **§8 Open Questions** dropped that item (down to 3 opens, renumbered).
- **§9 Assumptions Index** records it as a confirmed default flagged for locking before implementation.

That leaves three open items, and you said you have answers ready. Let's close them:

1. **Allocation-date source** (FR-5 eligibility) — is the date always "now", or can a caller pass one in for back-dated postings?
2. **Return-object shape** (FR-13) — the concrete fields/structure of the Allocation returned.
3. **Mutation model** — does the function mutate `loan` in place, or return a new loan state and leave the input untouched?

Fire away with all three and I'll fold them in and clear the Open Questions section entirely.
A: 1. **Allocation-date source:** The caller passes an explicit `value_date`. The function uses that date, not system-now, for both instalment eligibility (Due/Past-Due as of value_date) and interest recomputation. A back-dated value_date causes interest to be re-accrued to that date before allocation runs. value_date must be a valid calendar date; a missing or invalid value is an error.

2. **Return-object shape:** Per payment, return: (a) an array of instalment-level allocations — for each instalment touched, the amount applied to each of the four buckets (fees, penalties, interest, principal); (b) the resulting outstanding balance for each component of each affected instalment; (c) `credit_balance` — the credit balance created or incremented by this payment (0.000 if none); (d) `tolerance_written_off` — the amount written off under the rounding-tolerance rule (0.000 if none). No other fields are required.

3. **Mutation model:** [default, not policy] Return a new loan state; leave the input untouched. The function is pure with respect to its arguments.

### Round 5
_Step reasoning:_ (live agent turn)

Q: All three answers are folded in. Here's where things stand.

## Folded in cleanly
- **value_date (FR-14):** now an explicit argument governing both eligibility (FR-5 reworded) and interest; invalid/missing → error. Signature noted as expanding to `allocate_payment(payment, loan, value_date)`. Glossary term added.
- **Return shape (FR-13):** rewritten to your exact four fields (`instalment_allocations`, updated component balances, `credit_balance`, `tolerance_written_off`), with the reconciliation identity updated to include the write-off.
- **Mutation model:** §4.5 NFR now states it returns a new loan state and leaves the input untouched; recorded as a `[default, not policy]` assumption in §9.

## Two new policy gaps your answers surfaced — now flagged as **implementation-blocking** (§8)

Your answers introduced two concepts the spec has to name but can't yet define. I captured each as a requirement (FR-15, FR-16) with a `[NOTE FOR PM]`, and put the undefined policy into Open Questions rather than inventing it:

1. **Rounding-tolerance rule (blocks FR-16).** You named `tolerance_written_off`, but the *rule* behind it is undefined: threshold, scope (per-component / per-instalment / whole-loan), direction (write off a tiny shortfall to close an instalment? a tiny over-residual? both?), and when it fires.

2. **Interest re-accrual mechanics (blocks FR-15).** You confirmed interest is re-accrued to value_date — which I reconciled against the old "no interest recalculation" Non-Goal (re-accrual is now in scope; re-amortisation/rescheduling stays out). But *how* it accrues is unspecified: rate source, day-count convention, compounding, and the accrual-from anchor.

Both genuinely can't be inferred — there are several defensible answers and getting them wrong produces silently wrong money. If you've got the answers, send them and I'll close §8 entirely; otherwise they stand as the two known blockers before implementation.

The spec is saved at `spec.md`. Want to resolve those two now?
A: Both can be closed now.

1. **Rounding-tolerance rule (FR-16).** Threshold: a residual owed on an instalment of ≤ 0.005 BHD after allocation runs causes that instalment to be marked fully paid and the residual written off. Scope is per instalment. Direction: shortfall only — a tiny amount still owed after allocation, not an over-payment residual (overpayments become credit per FR-4). The rule fires at the end of each instalment's allocation pass, before moving to the next instalment.

2. **Interest re-accrual mechanics (FR-15).** [default, not policy — requires confirmation from finance/product before implementation] Daily simple interest on the outstanding principal balance, using the loan's contracted annual rate divided by 365 (Actual/365 day-count), accruing from the date of the last recorded payment or disbursement (whichever is later) up to and including value_date. No compounding within the accrual period. The rate source is the loan's own contracted rate field; no external rate lookup.

### Round 6
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved at `spec.md`. **Open Questions is now empty** — every material policy decision has been elicited from you and encoded.

## Final state

**16 functional requirements**, each with testable consequences, covering:
- The waterfall — FIFO oldest-first, per-instalment vertical, fee→penalty→interest→principal, partial components (FR-1–3)
- Overpayment/credit, eligibility, combined-credit pass (FR-4–6)
- BHD/fils, half-up to 3 dp, residual→interest-then-principal (FR-7–8)
- Validation and degenerate inputs (FR-9–12)
- Return contract — your exact four fields, pure/returns-new-state (FR-13)
- **value_date** governing eligibility + interest re-accrual, with full accrual mechanics (FR-14–15)
- **Rounding-tolerance write-off** — per-instalment shortfall ≤ 5 fils (FR-16)

Plus an authoritative worked example, glossary, non-goals, MVP scope, success metrics with a counter-metric, and a complete assumptions index.

## Two flags carried forward (not gaps — tracked decisions)

The §9 Assumptions Index separates your **deliberate policy** from items you explicitly marked `[default, not policy]`, so nothing confirmed-by-default masquerades as institutional policy:
- **Defaults to revisit:** combined-credit consumption (FR-6), non-finite rejection (FR-11), zero-interest residual→principal (FR-8), pure/new-state mutation model.
- **Requires external sign-off before build:** the interest-accrual mechanics (FR-15) — you flagged these as needing finance/product confirmation, and I've kept that flag loud rather than burying it.

The thread worth noting across this: the brief named only the domain and the signature, and nearly every decision that makes the function *correct* — the waterfall order, overpayment handling, rounding, the tolerance rule, interest re-accrual — came from you, not from inference. Two of your own answers (value_date, `tolerance_written_off`) surfaced *further* undefined policy, which is why I paused to ask rather than invent. That's all now resolved and captured.

Want me to run a validation/reviewer pass over the finished spec, or is this ready to hand off?
A: Noted. The specification is complete and accurately reflects all confirmed policy. Hand it off.

## Produced specification

---
title: Payment Allocation — allocate_payment(payment, loan)
status: draft
created: 2026-11-08
updated: 2026-11-08
---

# Requirements Specification: Payment Allocation

## 0. Document Purpose

This specification defines the behaviour of a single function, `allocate_payment(payment, loan)`,
in a loan servicing system. It is written for the engineer implementing the function and the
reviewer verifying it. Every allocation **policy** below (ordering, overpayment handling,
rounding, validation) was confirmed with the product stakeholder — these are not inferable
defaults; the institution has chosen specific answers and they are recorded here verbatim.
Vocabulary is fixed in the Glossary (§3); requirements are stated as globally-numbered FRs with
testable consequences (§4); a fully worked example (§4.1) pins down the waterfall numerically.
Assumptions that were confirmed but flagged as *defaults rather than deliberate policy* are listed
in §9 for easy revisit.

## 1. Vision

When a borrower pays, the money must be applied deterministically across everything they currently
owe, in an order the institution can defend to a borrower, an auditor, and a regulator. This
function is the single source of truth for that application: given a payment and the loan's current
state, it returns exactly how the money was split — down to each component of each instalment — and
the loan's resulting balances. Correctness, determinism, and exact-decimal arithmetic matter more
than anything else here; a one-fils discrepancy is a defect, not a rounding nicety.

## 2. Target User

### 2.1 Jobs To Be Done

- **Servicing engineer:** "Given a payment and a loan, apply it correctly and give me an auditable
  breakdown I can persist and display."
- **Collections / operations:** "Know precisely which charges and instalments a payment cleared,
  and what remains outstanding."
- **Borrower (indirect):** "See my payment applied consistently and fairly every time, with surplus
  safely held rather than lost."
- **Auditor / regulator (indirect):** "Reconstruct, from inputs alone, why each fils landed where
  it did."

### 2.2 Non-Users (v1)

- Callers wanting re-amortisation or interest **recalculation** triggered by a payment — out of
  scope (§5).
- Callers expecting scheduling of future auto-applications as a side effect — this function only
  allocates at call time (§4.2).

## 3. Glossary

*These terms are used verbatim throughout. No synonyms.*

- **Loan** — The servicing record against which payments are applied. Carries an ordered set of
  **Instalments**, a **Credit Balance**, and a single **Currency**.
- **Currency** — The loan's currency. Fixed at **BHD** (Bahraini dinar). All monetary amounts are
  expressed in **fils**.
- **Fils** — The minor unit of BHD. 1 BHD = 1000 fils; amounts carry **3 decimal places**. All
  arithmetic in this spec is in fils to 3 dp.
- **Instalment** — A scheduled amount due on a given date. Has a **Due Date**, a status derived from
  that date (**Due / Past-Due** vs **Future**), and four ordered **Components**.
- **Component** — One of the four payable parts of an instalment, in strict priority order:
  **Fee**, then **Penalty**, then **Interest**, then **Principal**. Each has an outstanding balance ≥ 0.
- **Outstanding Instalment** — An instalment whose Due Date is on or before the **Value Date**
  (i.e. Due or Past-Due) and which has any non-zero Component balance. Future instalments are **not**
  Outstanding.
- **Payment** — The incoming amount to allocate, with its Currency. Must be in the loan's Currency.
- **Credit Balance** — An unallocated surplus held on the Loan. Not tied to any instalment until a
  future instalment falls due. Never auto-refunded.
- **Waterfall** — The deterministic ordering by which money is applied: oldest Outstanding
  Instalment first, and within each instalment, Fee → Penalty → Interest → Principal.
- **Value Date** — A caller-supplied valid calendar date that serves as the reference date for the
  whole allocation: instalment eligibility (Due/Past-Due as of Value Date) and interest re-accrual.
  Supplied as the `value_date` argument. Not system-now; may be back-dated.
- **Rounding-Tolerance Rule** — A policy by which a per-instalment residual shortfall of ≤ 0.005 BHD
  (5 fils) remaining after allocation is written off and the instalment marked fully paid; the amount
  written off is reported as `tolerance_written_off`. Applies to shortfalls only, not over-payments.
  See FR-16.
- **Allocation** — The function's output: the per-instalment, per-component breakdown of how the
  payment (plus consumed Credit Balance) was applied, plus the Loan's updated balances.

## 4. Features

### 4.1 Allocation Waterfall (ordering)

**Description:** The money is applied strictly sequentially. Instalments are processed
**oldest-due-first (FIFO)**: the oldest Outstanding Instalment is cleared **entirely across all four
of its Components** before any money touches the next instalment (per-instalment waterfall — *not*
component-first/horizontal). Within an instalment, Components are paid in the fixed order
**Fee → Penalty → Interest → Principal**. There is no proportional split: money fills the current
bucket, and only the remainder flows to the next. This realizes the institution's defensible,
auditable application order.

**Functional Requirements:**

#### FR-1: Oldest-due-first instalment ordering

The system applies the payment to Outstanding Instalments in ascending Due Date order, fully
exhausting each instalment's four Components before advancing to the next.

**Consequences (testable):**
- Given instalments due 2026-01, 2026-02, 2026-03 all outstanding, and a payment sufficient to clear
  only 1.5 of them, the 2026-01 instalment is fully cleared, the 2026-02 instalment is partially
  cleared per FR-3, and 2026-03 is untouched.
- No fils is applied to a later instalment while any Component of an earlier Outstanding Instalment
  remains > 0.

#### FR-2: Per-instalment (vertical) waterfall, not component-first

Within the chosen instalment, all four Components are addressed before the next instalment — the
function never clears "all penalties across all instalments" before moving on.

**Consequences (testable):**
- Given two outstanding instalments each with an unpaid Fee, a payment that clears instalment 1
  entirely (Fee, Penalty, Interest, Principal) applies to instalment 2's Fee **only after**
  instalment 1's Principal is zero — it does not pay instalment 2's Fee before instalment 1's
  Principal.

#### FR-3: Component order and partial components

Within an instalment, Components are paid strictly in order **Fee → Penalty → Interest →
Principal**. When the available money runs out mid-Component, that Component is **partially paid**
(it absorbs whatever remains) and allocation stops. Partial components are allowed; no proportional
split across Components.

**Consequences (testable):**
- Given an instalment with Fee 10.000, Penalty 5.000, Interest 20.000, Principal 100.000 and 17.000
  available, the result is Fee 10.000 (paid), Penalty 5.000 (paid), Interest 2.000 (partial),
  Principal 0.000, and 0.000 remaining.
- Penalty is never paid before that instalment's Fee is fully cleared; Interest never before Penalty;
  Principal never before Interest.

**Worked example (authoritative):**

> Loan in BHD. Credit Balance 0.000. Two Outstanding Instalments:
> - **Inst A** (due 2026-01-01): Fee 2.000, Penalty 3.000, Interest 10.000, Principal 50.000
> - **Inst B** (due 2026-02-01): Fee 2.000, Penalty 0.000, Interest 11.000, Principal 50.000
>
> Payment: **80.000 fils**.
>
> Waterfall: A.Fee 2.000 → A.Penalty 3.000 → A.Interest 10.000 → A.Principal 50.000 (A fully
> cleared; 65.000 consumed, 15.000 left) → B.Fee 2.000 → B.Penalty 0.000 → B.Interest 11.000
> → B.Principal 2.000 (partial; 15.000 consumed). Remaining: 0.000. No Credit Balance created.
> B still owes Principal 48.000.

### 4.2 Overpayment and Credit Balance

**Description:** If, after clearing every Outstanding Instalment, money remains, the surplus is held
on the Loan as an unallocated **Credit Balance**. It is **never auto-refunded**. The function does
**not** reach into not-yet-due future instalments during allocation; the surplus simply waits. When
a future instalment later falls due, the Credit Balance is combined with the next incoming payment
and run through the same Waterfall (see FR-6).

**Functional Requirements:**

#### FR-4: Surplus routed to Credit Balance

After all Outstanding Instalments are fully cleared, any remainder is added to the Loan's Credit
Balance and reported as such. Future (not-yet-due) instalments are never paid directly by the
current allocation.

**Consequences (testable):**
- Given total outstanding across all Due/Past-Due instalments = 65.000 and a payment of 80.000, the
  result clears 65.000 and the Credit Balance increases by 15.000; no future instalment's Component
  changes.
- A payment against a Loan with **nothing** Outstanding routes the **entire** amount to the Credit
  Balance (no error).

#### FR-5: Eligibility — only Due / Past-Due instalments as of value_date

Only instalments whose Due Date is on or before the **value_date** (FR-14) are eligible for direct
allocation. A normal payment never touches a Future instalment (Due Date after value_date) directly.

**Consequences (testable):**
- Given one Past-Due instalment owing 30.000 and one Future instalment owing 100.000, a payment of
  50.000 clears the 30.000 and places 20.000 in the Credit Balance; the Future instalment is
  unchanged.

#### FR-6: Existing Credit Balance combined on next allocation

When an allocation runs and the Loan already carries a Credit Balance, the existing Credit Balance
is combined with the incoming Payment and the **full combined amount** runs through the Waterfall in
one unified pass, credit consumed first, then the new payment. *(Confirmed as the current default —
see §9.)*

**Consequences (testable):**
- Given Credit Balance 10.000, a new Payment of 5.000, and an Outstanding Instalment owing 12.000:
  the combined 15.000 is applied; 12.000 clears the instalment; the Credit Balance ends at 3.000.
- The Allocation output distinguishes the portion sourced from existing credit vs. the new payment.

### 4.3 Currency and Rounding

**Description:** The Loan, the Payment, and all balances are in a single Currency (BHD); any
mismatch is an error. All amounts are in fils to 3 decimal places; rounding is **half-up to 3 dp**,
and any rounding **residual is absorbed into the Interest Component** of the instalment being
processed.

**Functional Requirements:**

#### FR-7: Single currency; mismatch is an error

The Payment Currency must equal the Loan Currency. A mismatch is rejected with an error and no
allocation is performed.

**Consequences (testable):**
- A Payment in a currency other than the Loan's BHD raises a currency-mismatch error; the Loan is
  unchanged.

#### FR-8: Fils precision, half-up rounding, residual to Interest

All arithmetic is carried in fils to 3 dp, rounded **half-up**. Any rounding residual produced while
allocating an instalment is absorbed into that instalment's **Interest** Component. If that
instalment's Interest Component is already 0.000 when the residual needs to be absorbed, the residual
is applied to the **Principal** Component instead.

**Consequences (testable):**
- No output amount has more than 3 decimal places.
- Where a split would otherwise produce a sub-fils residual, the residual lands on the Interest
  Component (or, when Interest is 0.000, on Principal) such that the sum of allocated Components
  equals the amount consumed exactly (no fils created or lost).
- Given an instalment whose Interest is 0.000 when a residual arises, the residual appears on
  Principal, not Interest, and the Components still sum exactly to the amount consumed.

### 4.4 Input Validation and Edge Cases

**Description:** The function validates its inputs before allocating and handles degenerate cases
explicitly and consistently.

**Functional Requirements:**

#### FR-9: Negative payment rejected

A Payment with a negative amount is rejected with an error; the Loan is unchanged.

**Consequences (testable):**
- `allocate_payment(-1.000, loan)` raises an error and performs no allocation.

#### FR-10: Zero payment is a recorded no-op

A zero Payment performs no allocation but still **records a zero-value Allocation transaction** in
the output.

**Consequences (testable):**
- `allocate_payment(0.000, loan)` changes no balance, raises no error, and returns an Allocation with
  all component amounts 0.000 (a transaction is recorded, not suppressed).

#### FR-11: Non-finite amount rejected

A non-finite Payment amount (NaN, ±Infinity) is rejected with an error. *(Confirmed as the current
default — see §9.)*

**Consequences (testable):**
- `allocate_payment(NaN, loan)` and `allocate_payment(Infinity, loan)` each raise an error; the Loan
  is unchanged.

#### FR-12: Nothing outstanding → entire payment to credit

A Payment against a Loan with no Outstanding Instalments routes the entire amount to the Credit
Balance per FR-4 (no error).

**Consequences (testable):**
- Given a Loan whose only instalments are Future, a Payment of 25.000 leaves all instalments
  unchanged and increases the Credit Balance by 25.000.

### 4.5 Return Contract

**Description:** The function returns both *how the payment was applied* and *the loan's updated
balances*, in a shape that is auditable and reconstructable from inputs alone.

**Functional Requirements:**

#### FR-13: Allocation breakdown + updated balances returned

The return value contains exactly the following fields:
- **(a) `instalment_allocations`** — an array of per-instalment allocations; for each instalment
  touched, the amount applied to each of the four buckets (`fees`, `penalties`, `interest`,
  `principal`).
- **(b) updated component balances** — the resulting outstanding balance for each Component of each
  affected instalment.
- **(c) `credit_balance`** — the Credit Balance created or incremented by this payment (0.000 if
  none).
- **(d) `tolerance_written_off`** — the amount written off under the rounding-tolerance rule (0.000
  if none). See FR-16.

No other fields are required.

**Consequences (testable):**
- The sum of all applied Component amounts, plus the change in Credit Balance, plus
  `tolerance_written_off`, equals the combined (existing credit + new payment) amount — exactly, to
  the fils.
- The output is a pure function of the inputs: identical `(payment, loan, value_date)` inputs yield
  identical output (determinism).

**Feature-specific NFRs:**
- **Purity / no I/O:** `allocate_payment` **returns a new loan state and leaves the input `loan`
  untouched** (pure with respect to its arguments). It performs no persistence, no network, and no
  scheduling. *(Confirmed as the current default — see §9.)*

### 4.6 Value Date and Interest Re-accrual

**Description:** The caller supplies an explicit **value_date**. The function uses value_date — not
system-now — as the reference date for both instalment eligibility (FR-5) and interest recomputation.
A back-dated value_date causes interest to be **re-accrued to that date before allocation runs**, so
the amount owed reflects the economic position as of value_date. This expands the original
`allocate_payment(payment, loan)` interface to effectively `allocate_payment(payment, loan,
value_date)`.

**Functional Requirements:**

#### FR-14: Explicit value_date governs the allocation

The function uses the caller-supplied value_date as the reference date for eligibility and interest
recomputation. value_date must be a valid calendar date; a missing or invalid value_date is an error
and no allocation is performed.

**Consequences (testable):**
- Eligibility (FR-5) is evaluated against value_date, not system-now; the same `(payment, loan)` with
  different value_dates can yield different eligible instalment sets.
- A missing or syntactically invalid value_date raises an error; the Loan is unchanged.

#### FR-15: Interest re-accrued to value_date before allocation

Before the Waterfall runs, interest is re-accrued to value_date, including when value_date is
back-dated (interest is recomputed to the earlier date). Allocation then operates on the re-accrued
balances.

**Accrual mechanics:** daily **simple** interest on the outstanding **Principal** balance, using the
loan's contracted annual rate ÷ 365 (**Actual/365** day-count), accruing from the date of the last
recorded payment or disbursement (whichever is later) up to and including value_date. **No
compounding** within the accrual period. The rate source is the loan's own **contracted rate field** —
no external rate lookup. *(Confirmed but flagged as default requiring finance/product sign-off before
implementation — see §9.)*

**Consequences (testable):**
- Given a back-dated value_date, the interest Component balances used by the Waterfall reflect accrual
  up to value_date, not up to system-now.
- Daily accrual = outstanding Principal × (contracted annual rate ÷ 365), summed over each day from the
  day after the later of {last payment, disbursement} through value_date inclusive, no compounding.
- With a contracted rate of 0 or zero elapsed days, re-accrual adds 0.000 interest and the Waterfall
  runs on the existing balances.

#### FR-16: Rounding-tolerance write-off

At the end of each instalment's allocation pass — **before** moving to the next instalment — if the
total residual still owed on that instalment is **≤ 0.005 BHD (5 fils)**, the instalment is marked
**fully paid** and the residual is **written off**. Scope is **per instalment**. The rule applies to a
**shortfall only** (a tiny amount still owed), never to an over-payment residual (overpayments become
Credit Balance per FR-4). The total written off across the payment is reported as
`tolerance_written_off` (FR-13d).

**Consequences (testable):**
- Given an instalment left owing 0.003 BHD after allocation, it is marked fully paid, 0.003 is added
  to `tolerance_written_off`, and its Component balances are driven to 0.000 before the next instalment
  is processed.
- Given an instalment left owing 0.006 BHD (> 5 fils), the rule does **not** fire; the 0.006 remains
  outstanding and `tolerance_written_off` is unchanged by it.
- The rule never writes off an over-payment; surplus always routes to Credit Balance (FR-4).
- The reconciliation identity in FR-13 holds: applied + Δcredit + `tolerance_written_off` = combined
  amount, to the fils.

## 5. Non-Goals (Explicit)

- **No re-amortisation / rescheduling.** Interest **is** re-accrued to value_date before allocation
  (FR-15), but the function does not rebuild the instalment schedule, change due dates, or recompute
  instalment amounts; it applies against the (re-accrued) Component balances of the existing schedule.
- **No scheduling of future auto-application.** The function does not set up a future event when
  surplus is held; auto-application happens because the *next* allocation combines the Credit Balance
  (FR-6), not via a side effect of this call.
- **No multi-currency conversion.** A currency mismatch is an error (FR-7), never a conversion.
- **No refund mechanism.** Surplus is held, never returned by this function (FR-4).
- **No persistence, auditing side effects, or transaction logging** beyond returning the Allocation
  (recording to a store is the caller's responsibility).

## 6. MVP Scope

### 6.1 In Scope
- Deterministic Waterfall allocation (FR-1–FR-3) with the confirmed ordering.
- Overpayment → Credit Balance, eligibility rules, combined-credit pass (FR-4–FR-6).
- BHD/fils arithmetic, half-up to 3 dp, residual-to-Interest-then-Principal (FR-7–FR-8).
- Input validation and degenerate cases (FR-9–FR-12).
- Auditable return contract, pure/returns-new-state (FR-13, §4.5).
- Explicit value_date governing eligibility and interest re-accrual (FR-14–FR-15; accrual mechanics
  defined, pending finance/product sign-off per §9).
- Rounding-tolerance write-off: per-instalment shortfall ≤ 5 fils (FR-16).

### 6.2 Out of Scope for MVP
- Alternative orderings (LIFO, highest-cost, pro-rata) — not chosen.
- Partial-refund / surplus-return policies.
- Re-amortisation and interest accrual.
- Multi-currency.

## 7. Success Metrics

- **SM-1 (Correctness):** 100% of allocation test vectors (including the §4.1 worked example and all
  FR consequence cases) produce exact, fils-accurate results. Validates FR-1–FR-13.
- **SM-2 (Determinism):** Identical inputs produce byte-identical output across runs. Validates
  FR-13.
- **SM-C1 (Counter-metric — do not optimise for fewer errors by silently coercing bad input):**
  Invalid inputs (negative, non-finite, currency mismatch) must continue to raise errors, not be
  "helpfully" normalised. Counterbalances any drive to reduce error rates.

## 8. Open Questions

None outstanding. All previously-open items are resolved: allocation-date source (explicit value_date,
FR-14); return object shape (FR-13); mutation model (returns new loan state, input untouched, §4.5 NFR);
rounding-tolerance rule (FR-16); interest re-accrual mechanics (FR-15).

Two resolved items carry a **sign-off flag** rather than remaining open — see §9: the interest-accrual
mechanics (FR-15) require finance/product confirmation before implementation, and several answers were
confirmed as defaults rather than deliberate policy.

## 9. Assumptions Index

*Confirmed with the stakeholder, but flagged as defaults rather than deliberate policy — revisit if
circumstances change:*
- **FR-6 combined-credit consumption** — existing Credit Balance is combined with the incoming
  Payment and run through one unified Waterfall pass (credit first). *(Stakeholder: "default, not
  policy.")*
- **FR-11 non-finite rejection** — NaN/±Infinity amounts are rejected with an error. *(Stakeholder:
  "default, not policy.")*
- **FR-8 zero-interest residual fallback** — when an instalment's Interest is 0.000, the rounding
  residual is applied to Principal instead. *(Stakeholder: "default, not policy — worth locking before
  implementation.")*
- **FR-5/§4.5 mutation model** — the function returns a new loan state and leaves the input untouched
  (pure w.r.t. arguments). *(Stakeholder: "default, not policy.")*

*Confirmed, but requiring external sign-off before implementation:*
- **FR-15 interest-accrual mechanics** — daily simple interest on outstanding Principal, Actual/365
  (contracted annual rate ÷ 365), accruing from the later of {last payment, disbursement} through
  value_date inclusive, no compounding, rate from the loan's contracted rate field. *(Stakeholder:
  "default, not policy — requires confirmation from finance/product before implementation.")*

*Confirmed policy (not assumptions, recorded for traceability):* oldest-due-first FIFO (FR-1);
per-instalment vertical waterfall (FR-2); Fee → Penalty → Interest → Principal (FR-3);
partial components allowed (FR-3); surplus held as Credit, never refunded (FR-4); only Due/Past-Due
eligible (FR-5); BHD/fils, half-up 3 dp, residual to Interest (FR-7–FR-8); negative rejected (FR-9);
zero is a recorded no-op (FR-10); nothing-outstanding → all to credit (FR-12); explicit value_date
governs eligibility + interest, invalid value_date is an error (FR-14); interest re-accrued to
value_date before allocation (FR-15, mechanics default pending sign-off); return fields fixed (FR-13);
per-instalment shortfall ≤ 5 fils written off and reported as `tolerance_written_off` (FR-16).


## Auditor verdict

_The spec correctly captures 12 of 14 decisions, including the genuinely bespoke ones (1 fees-before-penalties, 3 credit-balance, 4 BHD 3-dp, 6 residual-to-interest, 7 back-valued re-accrual, 8 no-prepay, 10 tolerance). It misses the two accrual/ordering edge cases: #12 (penalty accrual to value date — only interest re-accrual is specified) and #13 (same-day multiple payments FIFO by receipt timestamp — never addressed). Coverage = 12/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | FR-3 / Glossary: "Components are paid strictly in order Fee → Penalty → Interest → Principal"; Component defined "in strict priority order: Fee, then Penalty, then Interest, then Principal." | Spec fixes the exact order fees → penalties → interest → principal, matching the reference (fees before penalties), and reinforces it throughout FR-3 and the worked example. |
| 2 | yes | **yes** | FR-1: "the oldest Outstanding Instalment is cleared entirely across all four of its Components before any money touches the next instalment"; FR-2 vertical waterfall. | Exactly the reference strategy: oldest instalment fully cleared across all four buckets before the next is touched, explicitly not component-first. |
| 3 | yes | **yes** | FR-4: "any remainder is added to the Loan's Credit Balance"; Glossary "Never auto-refunded"; FR-6: existing Credit Balance combined with incoming Payment on next allocation. | Surplus held as unallocated credit, never auto-refunded, and applied via the next allocation when a future instalment falls due — matches the reference credit-balance mechanism. |
| 4 | yes | **yes** | Glossary: "Fixed at BHD (Bahraini dinar)"; "1 BHD = 1000 fils; amounts carry 3 decimal places." | Currency is BHD with 3-dp fils precision exactly as the reference states. |
| 5 | yes | **yes** | FR-8: "All arithmetic is carried in fils to 3 dp, rounded half-up." | Half-up rounding to the 3-dp minor unit matches the reference method. |
| 6 | yes | **yes** | FR-8: "Any rounding residual produced while allocating an instalment is absorbed into that instalment's Interest Component." | Primary rule routes the residual to Interest, matching the reference; the added zero-interest fallback to Principal is an extra edge rule that does not contradict the stated default. |
| 7 | yes | **yes** | FR-15: "Before the Waterfall runs, interest is re-accrued to value_date, including when value_date is back-dated (interest is recomputed to the earlier date)." | A back-dated value_date triggers interest recomputation to that date before allocation, exactly as the reference requires. |
| 8 | yes | **yes** | FR-4: "Future (not-yet-due) instalments are never paid directly by the current allocation"; surplus "added to the Loan's Credit Balance"; §5 non-goal "No re-amortisation." | An early payment settles only outstanding instalments; surplus becomes credit rather than prepaying principal, and no re-amortisation means future interest is unchanged — matches the reference. |
| 9 | yes | **yes** | FR-3: "Partial components are allowed; no proportional split across Components"; "money fills the current bucket, and only the remainder flows to the next." | Strict in-order filling with no proportional split is exactly the reference answer. |
| 10 | yes | **yes** | FR-16: "if the total residual still owed on that instalment is ≤ 0.005 BHD (5 fils), the instalment is marked fully paid and the residual is written off"; reported as tolerance_written_off. | Tolerance threshold ≤ 0.005 BHD, mark-paid, and write-off reporting all match the reference precisely. |
| 11 | yes | **yes** | FR-9: negative Payment "rejected with an error"; FR-10: zero Payment "records a zero-value Allocation transaction." | Negative rejected with error and zero a no-op that still records a zero-value allocation transaction — matches the reference on both halves. |
| 12 | no | no | absent | FR-15 defines accrual only as "daily simple interest on outstanding Principal"; the spec never addresses penalties accruing up to and including the value date or running allocation on post-accrual penalty balances. Penalty components are treated as static balances. |
| 13 | no | no | absent | The spec allocates one payment per call and never addresses ordering of multiple same-day payments; FIFO by receipt timestamp is nowhere stated, so the reference's same-day ordering rule is unaddressed. |
| 14 | yes | **yes** | FR-13: return contains (a) per-instalment per-bucket instalment_allocations, (b) updated component balances, (c) credit_balance, (d) tolerance_written_off. | The return shape matches the reference field-for-field: per-bucket amounts, resulting balances, credit_balance created, and tolerance_written_off. |
