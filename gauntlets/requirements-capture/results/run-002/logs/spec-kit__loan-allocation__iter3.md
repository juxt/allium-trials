# spec-kit — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 5 · Captured: 7/14 · Bespoke captured: 1/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the interactive prompt didn't go through. Let me put the questions to you in plain text instead — these are the policy decisions I need from you as the stakeholder before I can write a correct spec. I've grouped them; please answer each (letter, or your own wording).

---

### Q1 — Component waterfall (order *within* an instalment)
When applying money to one instalment, in what order are its components consumed?

| Option | Order |
|--------|-------|
| A | Penalties → Fees → Interest → Principal |
| B | Fees → Penalties → Interest → Principal |
| C | Interest → Principal → Fees → Penalties |
| D | Principal first |
| Custom | your own |

### Q2 — Allocation strategy across instalments
How does the payment move across several outstanding instalments relative to the waterfall?

| Option | Strategy |
|--------|----------|
| A | **Per-instalment waterfall** — fully clear all components of the oldest instalment before touching the next |
| B | **Component-sweep** — pay one component type across *all* instalments (all penalties everywhere, then all fees, etc.) |
| C | **Hybrid** — sweep penalties & fees across all instalments first, then clear interest+principal instalment-by-instalment |
| Custom | your own |

### Q3 — Instalment ordering
Which instalment is targeted first?

| Option | Order |
|--------|-------|
| A | Oldest due date first (FIFO / oldest arrears) |
| B | Newest due date first |
| C | Highest-charge instalment first |
| Custom | your own |

### Q4 — Overpayment (payment exceeds everything owed)
What happens to the surplus?

| Option | Handling |
|--------|----------|
| A | Hold in suspense / unapplied credit |
| B | Curtail principal (may re-amortise) |
| C | Pre-pay future not-yet-due instalments |
| D | Reject / refund the excess |
| Custom | your own |

### Q5 — Underpayment / partial payment
If the payment can't cover even one full instalment (or is below the minimum due):

| Option | Handling |
|--------|----------|
| A | Accept and apply partially as far as the waterfall reaches |
| B | Hold entire payment in suspense until enough accumulates to cover a full instalment |
| C | Reject the payment |
| Custom | your own |

### Q6 — Scope of "currently owed"
Does allocation consider only **due / past-due** instalments, or also **not-yet-due** (future) instalments?

| Option | Scope |
|--------|-------|
| A | Due and past-due only |
| B | All instalments including future ones |
| Custom | your own |

### Q7 — Rounding & money precision
How is monetary rounding handled?

| Option | Policy |
|--------|--------|
| A | 2-decimal currency, round half-up, any residual cent goes to principal |
| B | 2-decimal, round half-up, residual stays in suspense |
| C | Integer minor units only (no rounding needed) |
| Custom | your own |

---

Two smaller ones I'll default unless you say otherwise (tell me if any are wrong):
- **Input validation**: zero/negative payment is rejected; a payment against a loan with nothing owed goes entirely to suspense (or is rejected per Q4-D).
- **Single currency**, balances supplied on the loan as-is (no interest re-accrual computed inside this function).

Once you answer Q1–Q7, I'll write the full requirements spec and save it to `spec.md`.
A: Q1 — **Option B**: Fees → Penalties → Interest → Principal.

Q2 — **Option A**: Per-instalment waterfall. Clear all four components of one instalment in full before any money moves to the next.

Q3 — **Option A**: Oldest due date first.

Q4 — **Option A** with one addition: surplus is held as an unallocated credit balance and auto-applied when the next instalment falls due. It is never auto-refunded.

Q5 — **Option A**: Accept and apply partially, strict waterfall order, no proportional split.

That is 5 questions — my limit for this turn. Please finalise Q6 and Q7 using your own defaults.

One correction to your stated defaults: a zero-value payment is **not** rejected. It is a no-op that still records a zero-value allocation transaction. Negative payments are rejected with an error.

### Round 2
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved to **`spec.md`** in this directory.

## What it covers

The spec encodes the seven material policy decisions — none of which the brief specified and none safely inferable — as an authoritative **Policy Decisions** table (P1–P9), then builds testable requirements on top:

- **P1** Fees → Penalties → Interest → Principal within an instalment
- **P2** Per-instalment waterfall (clear one instalment fully before the next)
- **P3** Oldest due date first
- **P4** Overpayment → unallocated credit, never auto-refunded
- **P5** Partial payments accepted, strict order, no proportional split
- **P6** Due/past-due instalments only (your default, as delegated)
- **P7** 2 dp round-half-up, residual into Principal of last instalment touched (your default)
- **P8/P9** Zero = recorded no-op; negative = rejected (per your correction)

It also includes prioritised user stories with Given/When/Then acceptance scenarios, edge cases, 15 functional requirements, measurable success criteria, and an Assumptions section.

## Two things I flagged rather than guessed

I deliberately did **not** invent answers to these — they're marked as open questions needing your confirmation before planning:

1. **Pre-existing unallocated credit** — if a loan already carries surplus credit from a prior overpayment when `allocate_payment` is called, should it be swept into the available funds on *this* call, or only applied by the scheduled due-date process? (I assumed the former as a placeholder.)
2. **Equal due dates** — the tie-break when two instalments share a due date (I assumed a stable secondary sort by instalment sequence).

Want me to turn these into a sixth/seventh locked decision, or leave them as deferred open questions? I'm otherwise ready to proceed to `/speckit-plan` whenever you are.
A: I've answered the 5 clarifying question(s) your process is allotted; I can't take more. Please finalise the specification now — use your process's own defaults or reasonable assumptions for anything still open — save it as spec.md, and tell me when it's done.

## Produced specification

# Feature Specification: Payment Allocation

**Feature Branch**: `001-payment-allocation`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "Build a function `allocate_payment(payment, loan)` for a loan servicing system that applies a borrower's payment across what they currently owe. The loan can have several instalments outstanding, each with penalties, fees, interest and principal components. The function returns how the payment is applied and the loan's updated balances."

---

## Overview

When a borrower makes a payment against a loan, the money must be applied deterministically across the amounts they currently owe. A loan may have several outstanding instalments, and each instalment owes up to four component balances: **fees**, **penalties**, **interest**, and **principal**. This feature defines `allocate_payment(payment, loan)`, a pure function that decides exactly how a single incoming payment is distributed and returns both the allocation breakdown and the loan's resulting balances.

The institution has selected a specific allocation policy. These policy choices (waterfall order, cross-instalment behaviour, overpayment/underpayment handling) are **business rules**, not implementation preferences — they are fixed by the sections below and must be implemented exactly.

## Policy Decisions (Authoritative)

These were confirmed with the product stakeholder and govern all requirements in this document.

| # | Decision | Chosen policy |
|---|----------|---------------|
| P1 | **Component waterfall** (order within one instalment) | **Fees → Penalties → Interest → Principal** |
| P2 | **Cross-instalment strategy** | **Per-instalment waterfall** — all four components of one instalment are cleared in full before any money moves to the next instalment |
| P3 | **Instalment ordering** | **Oldest due date first** |
| P4 | **Overpayment / surplus** | Surplus is held as an **unallocated credit balance** on the loan; auto-applied when the next instalment falls due; **never auto-refunded** |
| P5 | **Underpayment / partial payment** | **Accepted and applied partially** in strict waterfall order; **no proportional split** |
| P6 | **Scope of "currently owed"** | Allocation targets **due and past-due instalments only**; not-yet-due instalments are reached only via the P4 credit mechanism when they fall due |
| P7 | **Rounding** | Amounts carried to **2 decimal places, round half-up**; any residual minor unit is absorbed into **Principal of the last instalment touched** |
| P8 | **Zero payment** | **No-op** — allocates nothing but still records a zero-value allocation transaction |
| P9 | **Negative payment** | **Rejected with an error**; no changes to the loan |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Apply a routine payment across outstanding instalments (Priority: P1)

A servicing operator (or an automated payment-posting job) receives a borrower payment and applies it to the loan. The payment is distributed oldest-instalment-first, and within each instalment it consumes fees, then penalties, then interest, then principal. The operator receives a precise breakdown of where every unit of money went and the loan's new balances.

**Why this priority**: This is the core of the feature — without correct distribution across instalments and components, nothing else matters. It is the minimum viable product.

**Independent Test**: Supply a loan with two or more outstanding instalments and a payment smaller than the total owed; verify the allocation fills the oldest instalment's components in Fees→Penalties→Interest→Principal order before touching the next instalment, and that returned balances equal the originals minus the amounts applied.

**Acceptance Scenarios**:

1. **Given** a loan whose oldest outstanding instalment owes Fees 10, Penalties 5, Interest 20, Principal 100 (total 135) and a payment of 135, **When** `allocate_payment` is called, **Then** the entire instalment is cleared (all four components reduced to 0) and nothing is applied to any later instalment.
2. **Given** the same loan and a payment of 40, **When** allocated, **Then** Fees 10 and Penalties 5 are fully paid, Interest receives 25 of its 20 owed… *(see Edge Cases for the correct waterfall stop)* — concretely: Fees 10 → Penalties 5 → Interest 20 → Principal 5; Principal remaining is 95, and no later instalment is touched.
3. **Given** a loan with two outstanding instalments (instalment A older than B), **When** a payment large enough to clear A and partially cover B is allocated, **Then** A is fully cleared first and only the remainder flows into B following the same component order.

---

### User Story 2 - Handle overpayment (surplus credit) (Priority: P2)

A borrower pays more than the total currently owed across all due and past-due instalments. The excess must not be lost or refunded; it is retained on the loan as an unallocated credit for later application.

**Why this priority**: Overpayments are common (round-number payments, early settlement attempts) and mishandling them causes financial/regulatory harm. Depends on P1 being correct.

**Independent Test**: Supply a payment exceeding the total owed; verify all owed components across all due instalments reach 0, the surplus appears as `unallocated_credit`, and no refund is produced.

**Acceptance Scenarios**:

1. **Given** a loan owing 200 in total across its due instalments and a payment of 250, **When** allocated, **Then** all owed components are cleared to 0 and the loan carries an unallocated credit of 50.
2. **Given** a loan owing 0 (nothing due) and a payment of 75, **When** allocated, **Then** the full 75 becomes unallocated credit and no component is reduced.
3. **Given** a surplus has been created, **When** the result is returned, **Then** no automatic refund transaction is produced.

---

### User Story 3 - Handle underpayment / partial payment (Priority: P2)

A borrower pays less than a full instalment, or less than the minimum due. The payment is still accepted and applied as far as it reaches in strict waterfall order.

**Why this priority**: Partial payments are routine in arrears management; rejecting or proportionally splitting them would violate policy.

**Independent Test**: Supply a payment smaller than the oldest instalment's first component chain; verify money is consumed strictly in order and later components/instalments are untouched, with no proportional spreading.

**Acceptance Scenarios**:

1. **Given** the oldest instalment owes Fees 10, Penalties 5, Interest 20, Principal 100 and a payment of 12, **When** allocated, **Then** Fees 10 and Penalties 2 are paid; Penalties retains 3; Interest and Principal are untouched.
2. **Given** a payment of 7 against the same instalment, **When** allocated, **Then** Fees 7 only is applied (Fees retains 3), and no other component receives anything — confirming no proportional split.

---

### User Story 4 - Zero and negative payments (Priority: P3)

The system must treat a zero payment as an auditable no-op and reject negative payments.

**Why this priority**: Input-integrity behaviour; small in scope but must be unambiguous for correctness and audit.

**Independent Test**: Call with payment 0 and confirm balances are unchanged but a zero-value allocation transaction is recorded; call with a negative payment and confirm an error is returned with no mutation.

**Acceptance Scenarios**:

1. **Given** any loan and a payment of 0, **When** allocated, **Then** all balances are unchanged and the result records a zero-value allocation transaction.
2. **Given** any loan and a payment of -10, **When** allocated, **Then** an error is raised/returned and the loan is unchanged.

---

### Edge Cases

- **Waterfall stop mid-component**: when the remaining payment is smaller than the current component's owed amount, that component is partially paid and allocation stops; no later component or instalment receives anything (per P5, no proportional split).
- **Exact-fill boundaries**: a payment that exactly equals one component, one full instalment, or the full loan must leave no stray residual and must not spill a rounding artifact into the next target.
- **Components already zero**: a component owing 0 is skipped; the next component in the waterfall is considered without consuming any payment.
- **Instalment fully paid already**: a due instalment with all components at 0 is skipped entirely; the next-oldest is considered.
- **Nothing owed at all**: with no due/past-due balances, the entire payment becomes unallocated credit (P4); a zero payment in this state is a no-op (P8).
- **Rounding residual**: if intermediate arithmetic produces a sub-cent residual, it is resolved by P7 (absorbed into Principal of the last instalment touched) so that the sum of all allocated amounts exactly equals the applied payment.
- **Pre-existing unallocated credit**: if the loan already carries an unallocated credit from a prior overpayment, see Assumption A6 — this is flagged for stakeholder confirmation.
- **Ties in due date**: if two instalments share the same due date, see Assumption A7 for the tie-break — flagged for confirmation.
- **Not-yet-due instalments present**: future instalments are ignored by allocation (P6); only the credit mechanism (P4) reaches them when they later fall due.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose a function `allocate_payment(payment, loan)` that accepts a single payment amount and a loan with zero or more outstanding instalments and returns (a) the allocation breakdown and (b) the loan's updated balances.
- **FR-002**: The function MUST be a pure calculation: it MUST NOT mutate the input loan in place, and calling it twice with identical inputs MUST produce identical outputs (deterministic).
- **FR-003**: The system MUST order instalments by due date, **oldest first**, and allocate to them in that order (P3).
- **FR-004**: The system MUST consider only **due and past-due** instalments as targets for direct allocation; not-yet-due instalments MUST be excluded from direct allocation (P6).
- **FR-005**: Within each instalment, the system MUST consume the payment strictly in the order **Fees → Penalties → Interest → Principal** (P1).
- **FR-006**: The system MUST fully satisfy all four components of an instalment before applying any money to the next instalment (per-instalment waterfall, P2).
- **FR-007**: The system MUST apply partial payments as far as they reach in strict waterfall order and MUST NOT split a payment proportionally across components or instalments (P5).
- **FR-008**: When a component owes 0 or an instalment is already fully paid, the system MUST skip it without consuming payment and proceed to the next target.
- **FR-009**: When the payment exceeds the total owed across all due/past-due instalments, the system MUST record the surplus as an **unallocated credit balance** on the returned loan and MUST NOT produce an automatic refund (P4).
- **FR-010**: The system MUST NOT reduce any component below zero, and the sum of all component allocations plus any unallocated credit MUST exactly equal the applied payment amount.
- **FR-011**: The system MUST carry monetary amounts to 2 decimal places using round-half-up, and MUST absorb any residual minor unit into the **Principal of the last instalment touched** so totals reconcile exactly (P7).
- **FR-012**: For a payment of exactly 0, the system MUST make no balance changes and MUST still record a zero-value allocation transaction in the result (P8).
- **FR-013**: For a negative payment, the system MUST reject the request with an error and MUST leave the loan unchanged (P9).
- **FR-014**: The returned result MUST itemise, per instalment and per component, the amount applied, so the allocation is fully auditable and reproducible.
- **FR-015**: The returned result MUST include the loan's updated per-instalment, per-component balances and the resulting unallocated credit balance.

### Key Entities *(include if feature involves data)*

- **Payment**: the incoming amount to be applied. A single non-negative monetary value (negative is an error per FR-013). May be zero.
- **Loan**: the servicing record being paid. Holds an ordered set of instalments and an unallocated credit balance. Not mutated by the function (FR-002).
- **Instalment**: one scheduled obligation with a due date and four component balances — Fees, Penalties, Interest, Principal — plus a due/not-yet-due status.
- **Component balance**: a single outstanding amount within an instalment (Fees, Penalties, Interest, or Principal), each ≥ 0.
- **Allocation result**: the returned object — a per-instalment / per-component breakdown of amounts applied, the updated loan balances, the resulting unallocated credit, and a record of the allocation transaction (including the zero-value case).
- **Unallocated credit balance**: surplus retained on the loan after everything owed is cleared; carried forward, not refunded (P4).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any payment less than or equal to the total owed, the sum of all per-component amounts applied equals the payment exactly (to the defined 2-decimal precision), in 100% of cases.
- **SC-002**: For any payment greater than the total owed, (total applied) + (unallocated credit) equals the payment exactly, and no refund is generated, in 100% of cases.
- **SC-003**: Given identical inputs, the function produces byte-for-byte identical output every time (fully deterministic), verified across the test suite.
- **SC-004**: No component balance is ever driven below zero, across all test and production allocations (0 violations).
- **SC-005**: Every allocation — including zero-value payments — produces a recorded, itemised transaction, so 100% of payment events are auditable.
- **SC-006**: The allocation order (oldest instalment first; Fees→Penalties→Interest→Principal within each) is demonstrably followed in 100% of multi-instalment, multi-component test cases, with no proportional splitting observed.

---

## Assumptions

- **A1**: All amounts (payment and all component balances) are expressed in a **single currency**; multi-currency loans are out of scope for this function.
- **A2**: The component balances supplied on the loan are **authoritative as-of the call**; this function does **not** re-accrue interest, assess new fees/penalties, or recompute amortisation. It allocates against the balances given.
- **A3**: "Currently owed" for direct allocation means instalments whose status is **due or past-due** at the time of the call (P6). Determining due/past-due status is the caller's responsibility (e.g., via due date vs. a value date supplied on the loan).
- **A4**: Overpayment surplus is stored as a single **unallocated credit balance** on the loan; the actual auto-application "when the next instalment falls due" (P4) is performed by a separate scheduled process, not by this function. This function's responsibility ends at recording the credit.
- **A5**: Rounding residuals are expected to be sub-minor-unit artifacts of intermediate arithmetic only; P7 resolves them deterministically into Principal of the last instalment touched.
- **A6**: *(Flagged for stakeholder confirmation)* If a loan already carries an **unallocated credit** from a prior overpayment when `allocate_payment` is called, the assumed default is that the existing credit is **combined with the incoming payment** as available funds before allocation. Confirm whether existing credit should be swept in on every call or only applied by the scheduled due-date process.
- **A7**: *(Flagged for stakeholder confirmation)* If two instalments share the **same due date**, the assumed tie-break is a stable secondary ordering by the instalment's identifier/sequence number. Confirm the intended tie-break.
- **A8**: The function signature returns a result object containing both the allocation breakdown and the updated balances; the exact serialization/shape is an implementation concern to be settled in planning.

---

## Open Questions (deferred, non-blocking)

These do not block the core allocation logic but should be resolved before implementation planning finalises:

1. **A6** — treatment of pre-existing unallocated credit on entry.
2. **A7** — tie-break for instalments sharing a due date.
3. Whether the caller or this function is responsible for computing due/past-due status (A3).


## Auditor verdict

_The spec nails the inferable decisions (1, 2, 9, 11) and the shared credit-balance mechanism (3, 8), scoring 7/14 correct. It systematically misses the genuinely bespoke policy choices that required asking: currency minor unit (fixed at 2 dp instead of BHD 3 dp, #4), residual destination (principal instead of interest, #6), value-date re-accrual (#7) and same-day penalty accrual (#12) both explicitly disclaimed via A2, write-off tolerance (entirely absent, #10), and same-day FIFO ordering (#13). The result shape (#14) is close but omits tolerance_written_off. Coverage = 7/14 (0.50). The gap concentrates exactly on the non-inferable, elicitation-dependent decisions (4, 6, 7, 10, 12, 13)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | P1 / FR-005: "consume the payment strictly in the order Fees → Penalties → Interest → Principal" | Spec states fees before penalties before interest before principal, exactly matching the reference order (fees deliberately before penalties). |
| 2 | yes | **yes** | P2 / FR-006: "all four components of one instalment are cleared in full before any money moves to the next instalment"; P3/FR-003 oldest due date first | Oldest instalment is cleared in full across all four buckets before any money reaches the next, matching the reference strategy. |
| 3 | yes | **yes** | P4 / FR-009: "held as an unallocated credit balance... auto-applied when the next instalment falls due; never auto-refunded" | Surplus held as unallocated credit, auto-applied at next due date, never auto-refunded — matches the reference verbatim in substance. |
| 4 | yes | no | P7 / FR-011: "Amounts carried to 2 decimal places"; A1: "single currency" (no currency named) | Spec addresses precision but fixes it at 2 decimal places and never identifies BHD/3 dp; the reference requires 3-dp (fils) precision, so the chosen value is wrong. |
| 5 | yes | **yes** | P7 / FR-011: "round half-up" | The rounding method is half-up, matching the reference; the precision discrepancy (2 dp vs 3 dp) is scored separately under decision 4. |
| 6 | yes | no | P7 / FR-011: residual "absorbed into Principal of the last instalment touched" | Spec routes the rounding residual to principal, but the reference requires it be absorbed into the interest component — a different, incorrect destination. |
| 7 | yes | no | A2: "this function does not re-accrue interest... It allocates against the balances given." | Spec addresses re-accrual but explicitly opts out and never recomputes interest to an earlier value_date; the reference requires re-accrual to the back-dated value date before allocation. |
| 8 | yes | **yes** | P6 / FR-004 (only due/past-due targeted) + P4; US2 scenario 2: "owing 0... payment of 75... full 75 becomes unallocated credit and no component is reduced"; A2 no re-accrual | Early/not-in-arrears surplus becomes a credit balance and never prepays principal, so future interest is unchanged — matching the reference outcome via the shared credit mechanism. |
| 9 | yes | **yes** | P5 / FR-007; US3 scenario 2: payment of 7 → "Fees 7 only is applied... confirming no proportional split" | Spec applies strict in-order fill with no proportional split, matching the reference. |
| 10 | no | no | absent | No write-off tolerance of any kind is mentioned; the reference ≤ 0.005 BHD tolerance that marks an instalment fully paid is entirely unaddressed. |
| 11 | yes | **yes** | P8/P9, FR-012/FR-013: zero is "No-op... still records a zero-value allocation transaction"; negative "Rejected with an error" | Negative rejected with error and zero a no-op that still records a zero-value transaction — matches the reference exactly. |
| 12 | yes | no | A2: "does not re-accrue interest, assess new fees/penalties... allocates against the balances given." | Spec explicitly declines to accrue penalties on the allocation date; the reference requires penalties to accrue up to and including the value date before allocation runs. |
| 13 | no | no | absent | The function handles a single payment and never addresses ordering of multiple same-day payments; the reference FIFO-by-timestamp rule is not stated. |
| 14 | yes | no | FR-014/FR-015 + Allocation result: per-instalment/per-component amounts applied, updated balances, and resulting unallocated credit | Spec covers per-bucket amounts, outstanding balances, and credit balance, but omits tolerance_written_off (consistent with missing decision 10), so the shape does not fully match the reference. |
