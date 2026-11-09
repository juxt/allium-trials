# spec-kit — loan-allocation — iteration 1

Model (author): claude-opus · Questions asked: 5 · Captured: 6/14 · Bespoke captured: 1/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured question prompt didn't go through. Let me put the same questions to you in plain text — answer in whatever form is easiest, and feel free to correct any framing.

These are the policy decisions I can't responsibly infer. I've grouped them; the first four are the ones that most change the behaviour of `allocate_payment`.

**Q1 — Allocation strategy (how a payment moves across instalments vs. components).** When several instalments are outstanding, do we:
- **(a) Instalment-first / vertical** — fully clear the oldest instalment (all of its penalty + fee + interest + principal in waterfall order) before moving to the next instalment; or
- **(b) Component-first / horizontal** — clear all penalties across *every* instalment, then all fees across every instalment, then all interest, then all principal; or
- **(c) Hybrid** — e.g. sweep penalties + fees across all instalments first, then settle interest + principal instalment-by-instalment (you'd specify the split).

**Q2 — Component waterfall order.** Within whatever grouping, in what order are the four components paid? e.g. Penalties → Fees → Interest → Principal, or Fees → Penalties → …, or Interest → Principal → … ?

**Q3 — Instalment processing order.** Oldest due date first? Newest first? Largest balance first?

**Q4 — Overpayment / surplus.** When the payment exceeds everything currently outstanding, do we: hold the surplus as an unapplied/suspense credit, apply it to principal as a prepayment, refund it to the borrower, or reject the payment?

And three more that I'll need to finalise the spec (shorter):

**Q5 — Underpayment / partial.** When the money runs out partway through a component, I assume we allocate the partial amount and leave the remainder outstanding (components and instalments partially paid). Is that correct, or is there a minimum-payment rule (e.g. an instalment must be paid in full or not at all)?

**Q6 — Rounding.** What currency precision and rounding convention applies (e.g. whole minor units / 2 decimal places, round-half-up), and where does any residual rounding difference land?

**Q7 — Invalid input.** How should a zero, negative, or non-numeric payment — or a payment against a loan with nothing outstanding — be handled (reject with an error, or return a no-op allocation)?

Once you answer, I'll write the full specification and save it to `spec.md`.
A: Q1 — Instalment-first / vertical (option a). Clear the oldest instalment completely across all four components before any money touches the next instalment.

Q2 — Within each instalment the waterfall is: Fees → Penalties → Interest → Principal. Fees before penalties.

Q3 — Oldest due date first.

Q4 — Surplus is held as an unallocated credit balance. It is auto-applied when the next instalment falls due. It is never auto-refunded and does not prepay principal.

Q5 — Strict waterfall order, partial allocation is fine. Fill each bucket as far as the money allows and leave the remainder outstanding. There is no minimum-payment rule; an instalment need not be paid in full.

That is 5 questions, which is the limit for this turn. Please finalise Q6 (rounding precision and convention) and Q7 (invalid input handling) using your own engineering defaults, then share the completed spec.

### Round 2
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as **`spec.md`** in this directory (and mirrored into the Spec Kit feature tree at `specs/001-payment-allocation/spec.md`).

## What's in it

The spec is built around an **authoritative Allocation Policy** section capturing your five decisions, since these are the institution-specific rules that can't be inferred:

1. **Instalment-first (vertical)** — oldest instalment cleared completely before the next.
2. **Oldest due date first** across instalments.
3. **Fees → Penalties → Interest → Principal** waterfall within each instalment.
4. **Surplus → unallocated credit** — never refunded, never prepays principal.
5. **Strict waterfall, partial allocation allowed, no minimum-payment rule.**

Plus the two you delegated, recorded as overridable engineering defaults: **integer minor-unit arithmetic** (no rounding introduced) and **reject zero/negative/non-numeric/over-precision** payments.

It also includes a worked numeric example, 3 prioritized user stories with acceptance scenarios, 15 functional requirements (including a money-conservation invariant, FR-012, and determinism with a same-due-date tie-break, FR-013), edge cases, measurable success criteria, and an Assumptions section.

## One thing worth your eye

I flagged a decision I did **not** want to silently assume: whether `allocate_payment` should pool any **pre-existing unallocated credit** with the incoming payment before allocating, or allocate only the incoming payment (leaving standing credit to the separate due-date auto-apply process). I defaulted to the latter but marked it for confirmation in Assumptions — if the institution expects standing credit to be swept in first, that changes the function's behaviour and I should update the spec.

The quality checklist passed all items (`specs/001-payment-allocation/checklists/requirements.md`). The spec is ready for `/speckit-plan` whenever you'd like to proceed.
A: I've answered the 5 clarifying question(s) your process is allotted; I can't take more. Please finalise the specification now — use your process's own defaults or reasonable assumptions for anything still open — save it as spec.md, and tell me when it's done.

## Produced specification

# Feature Specification: Payment Allocation

**Feature Branch**: `001-payment-allocation`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "Add payment allocation to our loan servicing system. When a borrower pays, the money has to be applied across what they currently owe on the loan. Build a function `allocate_payment(payment, loan)` that returns how the payment is applied and the loan's updated balances. The loan can have several instalments outstanding, each with penalties, fees, interest and principal components."

## Overview

When a borrower makes a payment against a loan, the money must be distributed across the amounts they currently owe. A loan may carry several **outstanding instalments** (instalments that have fallen due and are not yet fully paid), and each instalment is made up of four distinct **components**: fees, penalties, interest, and principal.

`allocate_payment(payment, loan)` deterministically decides, cent by cent, how an incoming payment is applied — which instalment, which component, and how much — and reports both the resulting allocation and the loan's updated balances. Any money that cannot be applied to a currently-outstanding instalment is retained as an **unallocated credit** on the loan.

This specification fixes the allocation **policy** (the institution's chosen rules), which is the part that cannot be inferred from general convention.

## Allocation Policy (authoritative)

These rules are the heart of the feature. They were confirmed by the product stakeholder and take precedence over any general industry default.

1. **Instalment-first (vertical) strategy.** The oldest outstanding instalment is cleared *completely across all four of its components* before any money is applied to the next instalment. Money never moves to a later instalment while an earlier one still has any outstanding balance.
2. **Instalment order: oldest due date first.** Outstanding instalments are processed in ascending order of due date.
3. **Component waterfall within an instalment: Fees → Penalties → Interest → Principal.** Fees are paid before penalties. This order is strict.
4. **Strict waterfall, partial allocation allowed.** Each bucket (component) is filled as far as the remaining money allows, in order. When the money runs out partway through a bucket, that bucket is partially paid and all later buckets/instalments are left untouched. There is **no minimum-payment rule** — an instalment need not be paid in full, and a partially-paid instalment remains outstanding for its residual amount.
5. **Surplus → unallocated credit.** When the payment exceeds everything currently outstanding, the surplus is held on the loan as an **unallocated credit balance**. This credit is **never auto-refunded** and does **not** prepay principal. (It is later auto-applied when the next instalment falls due — that auto-apply event is a separate scheduled process, out of scope for this function; see Assumptions.)

### Worked example

Loan with two outstanding instalments, oldest first. All amounts in minor currency units (cents).

| Instalment | Due date | Fees | Penalties | Interest | Principal |
|-----------|----------|------|-----------|----------|-----------|
| A (older) | 2026-09-01 | 500 | 300 | 1,200 | 10,000 |
| B (newer) | 2026-10-01 | 500 | 0 | 1,250 | 10,000 |

**Payment = 2,500.**

Applying the policy:

1. Instalment A, Fees: owe 500 → pay 500 (remaining 2,000).
2. Instalment A, Penalties: owe 300 → pay 300 (remaining 1,700).
3. Instalment A, Interest: owe 1,200 → pay 1,200 (remaining 500).
4. Instalment A, Principal: owe 10,000 → pay 500, 9,500 left outstanding (remaining 0).
5. Money exhausted. Instalment B untouched. No surplus, so no unallocated credit.

Result: 2,000 fully clears A's fees/penalties/interest; 500 partially pays A's principal; Instalment A remains outstanding (principal 9,500); Instalment B unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Apply a routine payment across outstanding instalments (Priority: P1)

A borrower with one or more overdue instalments makes a payment. The servicing system applies the money following the allocation policy and reports exactly where each cent went and what is still owed.

**Why this priority**: This is the core of the feature. Without correct, deterministic allocation across instalments and components there is no feature; every other scenario is a variation on it.

**Independent Test**: Call `allocate_payment` with a loan carrying two or more outstanding instalments and a payment smaller than the total owed; verify the allocation follows oldest-instalment-first and the Fees → Penalties → Interest → Principal waterfall, with the remainder left outstanding.

**Acceptance Scenarios**:

1. **Given** a loan with a single outstanding instalment owing fees, penalties, interest and principal, **When** a payment equal to the sum of all four components is allocated, **Then** every component is reduced to zero, the instalment is fully settled, and no unallocated credit remains.
2. **Given** a loan with two outstanding instalments (older and newer), **When** a payment large enough to fully clear the older instalment but only partially cover the newer one is allocated, **Then** the older instalment is settled in full first and the newer instalment is paid down in Fees → Penalties → Interest → Principal order until the money runs out.
3. **Given** a loan where the oldest instalment owes more than the payment, **When** the payment is allocated, **Then** money is applied only to the oldest instalment in waterfall order, later instalments are untouched, and no minimum-payment constraint blocks a partial allocation.

---

### User Story 2 - Handle a payment larger than everything owed (Priority: P2)

A borrower pays more than the total currently outstanding (or pays when nothing is outstanding). The surplus must be retained correctly rather than lost, refunded, or applied to principal.

**Why this priority**: Overpayment is common and mishandling it (losing the money, silently refunding, or prepaying principal) has direct financial and compliance consequences. It builds directly on P1.

**Independent Test**: Call `allocate_payment` with a payment exceeding total outstanding; verify all outstanding components are cleared and the exact surplus is recorded as unallocated credit, with no refund and no principal prepayment.

**Acceptance Scenarios**:

1. **Given** a loan whose outstanding instalments total 2,500, **When** a payment of 3,000 is allocated, **Then** all instalments are fully settled and 500 is recorded as unallocated credit on the loan.
2. **Given** a loan with nothing currently outstanding, **When** a positive payment is allocated, **Then** the entire payment becomes unallocated credit and no instalment balances change.
3. **Given** the surplus is recorded, **When** the result is inspected, **Then** no portion is applied to principal ahead of schedule and no refund is issued.

---

### User Story 3 - Reject invalid payments (Priority: P3)

The system must refuse payments that are not economically meaningful or well-formed, so that downstream balances are never corrupted.

**Why this priority**: Important for data integrity but secondary to correctly allocating valid payments; a smaller surface than P1/P2.

**Independent Test**: Call `allocate_payment` with zero, negative, non-numeric, and over-precision amounts; verify each is rejected with a validation error and no loan balances change.

**Acceptance Scenarios**:

1. **Given** a payment amount of zero, **When** allocation is attempted, **Then** it is rejected with a validation error and the loan is unchanged.
2. **Given** a negative or non-numeric payment amount, **When** allocation is attempted, **Then** it is rejected with a validation error and the loan is unchanged.
3. **Given** a payment with precision finer than the currency's minor unit (e.g. fractions of a cent), **When** allocation is attempted, **Then** it is rejected with a validation error.

---

### Edge Cases

- **Exact settlement**: payment equals total outstanding → every component zeroed, no credit, no leftover.
- **Money runs out mid-component**: that component is partially paid; every later component and instalment is untouched; residuals remain outstanding.
- **Component already zero**: a bucket with nothing owed is skipped without consuming any payment (e.g. an instalment with no penalties moves straight from fees to interest).
- **Instalment already fully paid**: not treated as outstanding; skipped entirely.
- **No outstanding instalments at all**: entire valid payment becomes unallocated credit (ties to P2).
- **Single cent payment**: applied to the first non-zero bucket of the oldest outstanding instalment (fees first).
- **Loan already carrying unallocated credit**: see Assumptions — this function allocates the incoming payment only; it does not re-apply pre-existing credit.
- **Ties in due date** (two instalments due the same day): resolved by a stable secondary ordering (see FR-013) so results are deterministic.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST accept a payment amount and a loan (with its outstanding instalments and their fee, penalty, interest, and principal component balances) and return (a) a breakdown of how the payment was applied per instalment per component, (b) the loan's updated component balances, (c) the resulting unallocated credit balance, and (d) the total amount allocated.
- **FR-002**: The system MUST apply the payment to outstanding instalments in **ascending due-date order** (oldest first).
- **FR-003**: The system MUST fully exhaust all four components of an instalment before applying any money to a later instalment (instalment-first / vertical strategy).
- **FR-004**: Within an instalment, the system MUST apply money to components in the strict order **Fees → Penalties → Interest → Principal**.
- **FR-005**: The system MUST allow partial allocation of any component: when remaining money is less than a component's outstanding balance, it MUST apply all remaining money to that component, reduce the balance accordingly, and stop (leaving all later components and instalments untouched).
- **FR-006**: The system MUST NOT enforce any minimum-payment rule; an instalment may be left partially paid and remains outstanding for its residual amount.
- **FR-007**: The system MUST skip any component whose outstanding balance is zero without consuming payment, and MUST skip any instalment that has no outstanding balance.
- **FR-008**: When the payment exceeds the total outstanding across all instalments, the system MUST record the surplus as an **unallocated credit balance** on the loan.
- **FR-009**: The system MUST NOT refund surplus and MUST NOT apply surplus to principal (no principal prepayment); surplus is retained as unallocated credit only.
- **FR-010**: The system MUST treat a positive payment against a loan with nothing outstanding as valid, placing the entire amount into unallocated credit with no change to instalment balances.
- **FR-011**: The system MUST reject (with a validation error, leaving the loan unchanged) any payment that is zero, negative, non-numeric, or has precision finer than the currency's minor unit.
- **FR-012**: The system MUST conserve money exactly: the total allocated across all components plus the unallocated credit added MUST equal the payment amount, for every input.
- **FR-013**: The system MUST produce a deterministic result for identical inputs, including a stable, documented tie-break when two outstanding instalments share the same due date (e.g. by instalment identifier/sequence number).
- **FR-014**: The system MUST NOT mutate the caller's input loan in place in a way that corrupts the pre-call state; the returned updated balances represent the post-allocation state (the loan's prior state must remain recoverable or the operation must be a pure transformation).
- **FR-015**: The system MUST operate in integer minor currency units internally so that allocation arithmetic introduces no rounding; if decimal inputs are accepted at the boundary, they MUST be validated to the currency's minor-unit precision and converted before allocation.

### Key Entities *(include if feature involves data)*

- **Payment**: The incoming money to be applied. Key attribute: amount (positive, in the loan's currency, at minor-unit precision). May carry metadata (date, reference) not material to allocation.
- **Loan**: The borrower's debt. Holds an ordered set of instalments and an unallocated credit balance. Currency is consistent across the loan.
- **Instalment**: A scheduled portion of the loan that has fallen due. Key attributes: due date, a stable identifier/sequence, and four outstanding component balances (fees, penalties, interest, principal). Considered *outstanding* while any component balance is greater than zero.
- **Component**: One of the four buckets within an instalment — Fees, Penalties, Interest, Principal — each with an outstanding balance that allocation reduces.
- **Allocation result**: The output — per-instalment, per-component amounts applied; updated instalment/component balances; resulting unallocated credit; and total allocated.
- **Unallocated credit**: Money held on the loan that was not applied to a currently-outstanding instalment, awaiting auto-application when the next instalment falls due.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any valid payment and loan, 100% of the payment is accounted for — the sum of all per-component allocations plus unallocated credit added equals the payment amount exactly, with zero rounding loss, across an exhaustive test suite.
- **SC-002**: In 100% of test cases, money is applied strictly oldest-instalment-first and in Fees → Penalties → Interest → Principal order within each instalment, with no leakage to a later instalment while an earlier one has an outstanding balance.
- **SC-003**: Overpayments produce an unallocated credit equal to (payment − total outstanding) in 100% of cases, with no refund and no principal prepayment.
- **SC-004**: 100% of invalid payments (zero, negative, non-numeric, over-precision) are rejected with a validation error and leave all loan balances unchanged.
- **SC-005**: Identical inputs produce byte-identical allocation results across repeated runs (determinism), including same-due-date tie cases.

## Assumptions

- **Currency & precision**: All amounts are in a single currency per loan, represented in integer minor units (e.g. cents/pence). Decimal inputs, if supported at the boundary, are validated to ≤2 decimal places and converted with round-half-up before allocation; the allocation itself is pure integer subtraction and introduces no rounding. *(Engineering default — Q6; override if the institution uses a different precision or rounding convention.)*
- **Invalid input is rejected, not silently ignored**: zero, negative, non-numeric, and over-precision payments raise a validation error rather than returning a no-op. *(Engineering default — Q7.)*
- **"Outstanding" means already due and unpaid**: the function targets instalments that have fallen due and still owe money. Future, not-yet-due instalments are not paid down by this function; money beyond current obligations becomes unallocated credit.
- **Pre-existing unallocated credit is out of scope for this function**: `allocate_payment` allocates the *incoming* payment only. Any credit already on the loan is applied by the separate scheduled "auto-apply on due date" process, not re-applied here. *(Flag for confirmation — could be revisited if the institution wants incoming payment and standing credit pooled before allocation.)*
- **Surplus auto-application is a separate process**: holding surplus as unallocated credit is this function's responsibility; applying that credit when the next instalment falls due is a downstream scheduled job outside this function's boundary.
- **Component balances are non-negative on input** and represent genuine amounts owed; the function does not recompute interest, assess new penalties, or generate fees.
- **The loan carries a stable instalment identifier/sequence** usable as a deterministic tie-break for instalments sharing a due date.
- **Single-currency, single-loan scope**: cross-loan allocation and multi-currency conversion are out of scope.


## Auditor verdict

_The spec nails the inferable and well-elicited choices (1, 2, 3, 5-method, 8, 9) but misses the genuinely bespoke decisions. It assumes a 2-dp currency instead of 3-dp BHD (4), has no rounding-residual rule (6), no back-valuation/re-accrual (7), no write-off tolerance (10), rejects zero payments instead of treating them as a recorded no-op (11), no penalty-accrual-on-value-date step (12), and no same-day FIFO handling (13). The result shape (14) covers most fields but lacks tolerance_written_off. Coverage: 6/14 correct (1, 2, 3, 5, 8, 9)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Policy #3 and FR-004: "Within an instalment, the system MUST apply money to components in the strict order Fees → Penalties → Interest → Principal"; "Fees are paid before penalties." | Spec states the exact bucket order including the non-default fees-before-penalties choice, matching the reference. |
| 2 | yes | **yes** | Policy #1/#2 and FR-003: "The oldest outstanding instalment is cleared completely across all four of its components before any money is applied to the next instalment"; FR-002 oldest-first. | Spec adopts the instalment-first (vertical) strategy clearing the oldest instalment fully across all buckets first, exactly as referenced. |
| 3 | yes | **yes** | Policy #5 / FR-008/FR-009: surplus "held on the loan as an unallocated credit balance. This credit is never auto-refunded and does not prepay principal. (It is later auto-applied when the next instalment falls due...)" | Spec holds overpayment as unallocated credit, never auto-refunds, and notes auto-application at next instalment, matching the reference mechanism. |
| 4 | yes | no | Assumptions: "represented in integer minor units (e.g. cents/pence)"; "validated to ≤2 decimal places and converted with round-half-up". No mention of BHD or 3 dp. | Spec assumes a generic 2-decimal (cents) currency and explicitly validates to ≤2 dp, contradicting the reference's 3-dp BHD precision. |
| 5 | yes | **yes** | Assumptions: "converted with round-half-up before allocation". | The rounding method (half-up) matches the reference; the precision error is captured under decision 4, but the method itself is correct. |
| 6 | no | no | absent | Spec claims allocation is "pure integer subtraction and introduces no rounding," so it never addresses where a rounding residual lands; the interest-absorption rule is not stated. |
| 7 | no | no | absent; contradicted by Assumptions: "the function does not recompute interest". | Spec never mentions value_date or back-valued payments and explicitly says it does not recompute interest, the opposite of the reference's re-accrual to value date. |
| 8 | yes | **yes** | FR-009/US2 Scenario 3: surplus "MUST NOT apply surplus to principal (no principal prepayment)"; nothing-outstanding payment "becomes unallocated credit with no change to instalment balances." | Spec establishes that an early/surplus payment does not prepay principal and surplus becomes credit, matching the reference that future interest is unchanged. |
| 9 | yes | **yes** | FR-005 / Policy #4: "Each bucket is filled as far as the remaining money allows, in order... no proportional split" implied by strict waterfall; partial allocation fills buckets in sequence. | Spec mandates strict in-order bucket filling with partial allocation, explicitly not proportional, matching the reference. |
| 10 | no | no | absent; contradicted by FR-006: "MUST NOT enforce any minimum-payment rule; an instalment may be left partially paid and remains outstanding for its residual." | Spec has no write-off tolerance concept and keeps any residual outstanding, so the ≤0.005 BHD forgiveness rule is unaddressed. |
| 11 | yes | no | FR-011: "MUST reject (with a validation error...) any payment that is zero, negative, non-numeric, or has precision finer than the minor unit." | Negative rejection matches, but the spec rejects zero whereas the reference requires zero to be a no-op that records a zero-value allocation transaction; the zero handling differs. |
| 12 | no | no | absent; contradicted by Assumptions: "the function does not recompute interest, assess new penalties, or generate fees." | Spec explicitly does not accrue penalties and allocates on given balances, so the accrue-to-value-date-then-allocate policy is not addressed. |
| 13 | no | no | absent; FR-013 addresses same-due-date instalment tie-break, not multiple same-day payments. | Spec scopes the function to a single payment and never specifies FIFO ordering of multiple same-day payments; its only tie-break is for instalment due dates. |
| 14 | yes | no | FR-001: returns "(a) a breakdown of how the payment was applied per instalment per component, (b) updated component balances, (c) the resulting unallocated credit balance, and (d) the total amount allocated." | Three of the four required elements match (per-bucket allocation, outstanding balances, credit balance), but the result shape omits tolerance_written_off, so it does not match the reference shape in full. |
