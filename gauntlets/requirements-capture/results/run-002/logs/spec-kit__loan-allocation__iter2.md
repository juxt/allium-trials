# spec-kit — loan-allocation — iteration 2

Model (author): claude-opus · Questions asked: 5 · Captured: 8/14 · Bespoke captured: 3/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the interactive prompt was dismissed. Let me ask the same questions in plain text so you can just answer in the chat. These are the four decisions I can't responsibly guess:

**Q1 — Waterfall order (within one instalment).** In what order is money applied across the four components?
- (a) Penalties → Fees → Interest → Principal
- (b) Fees → Penalties → Interest → Principal
- (c) Interest → Principal → Fees → Penalties
- (d) Principal → Interest → Fees → Penalties
- (or another order you specify)

**Q2 — Instalment traversal (across multiple outstanding instalments).**
- (a) Per-instalment, oldest first — fully clear one instalment's four components before the next ("vertical")
- (b) Per-component across all — all penalties oldest→newest, then all fees, then all interest, then all principal ("horizontal")
- (c) Newest instalment first
- (or another rule)

**Q3 — Overpayment (payment exceeds everything owed).** Surplus goes to:
- (a) Unapplied/suspense credit
- (b) Advance to future instalments
- (c) Principal prepayment (curtailment)
- (d) Refund to borrower

**Q4 — Partial payment (payment is less than owed).**
- (a) Apply down the waterfall, partially paying components
- (b) Hold the whole payment in suspense until a full instalment is covered
- (c) Satisfy only complete instalments; hold leftover in suspense

I have a few more (monetary rounding, whether borrowers can direct a payment to a specific component, and what counts as "currently owed"), but these four are the load-bearing ones. Answer what you can — shorthand like "Q1: a, Q2: b…" is fine.
A: Q1: (b) — Fees → Penalties → Interest → Principal.

Q2: (a) — Oldest instalment cleared in full across all four buckets before any allocation touches the next instalment.

Q3: (a) — Surplus held as an unallocated credit balance; auto-applied when the next instalment falls due. It is never auto-refunded and does not prepay principal.

Q4: (a) — Apply strictly down the waterfall, partially filling each bucket in sequence. No proportional split, no suspense hold.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Those four lock down the core algorithm. A second round on the remaining decisions that still change the output:

**Q5 — Monetary precision & rounding.** How is money represented, and how are fractional amounts handled?
- (a) Integer minor units (e.g. cents) — amounts are exact, no rounding ever needed
- (b) Decimal currency, round to 2 dp — if so, which rounding mode (half-up, half-even/banker's, truncate), and where does any leftover sub-unit remainder land?
- (or your convention)

**Q6 — Borrower-directed payments.** Can a payment instruct where it goes (e.g. "pay this specific instalment" or "pay down principal"), overriding the automatic waterfall — or is allocation *always* automatic per Q1–Q4?

**Q7 — What counts as "currently owed."** Which instalments does the waterfall operate on?
- (a) Only past-due instalments (arrears)
- (b) Past-due **plus** the instalment due today/this period
- (c) Something else
And: if the loan already carries an unallocated credit balance from before (per Q3), should `allocate_payment` fold that existing credit in together with the new payment, or treat only the new payment?

**Q8 — Invalid / edge inputs.** What should the function do with a zero or negative payment, and with a payment when there are **no** outstanding instalments? (e.g. reject/raise, or accept and route the whole amount to credit balance.)
A: Q5: The loan is denominated in BHD (Bahraini dinar), which has 3 decimal places (fils). Round half-up to 3 dp. Any sub-fil residual from rounding is absorbed into the interest component.

That is the one clarification I can give this turn. Please finalise Q6, Q7 and Q8 using your own defaults for now.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is done — saved to `spec.md` in this directory.

## What it covers

I treated the brief as deliberately underspecified and asked you rather than guessing the load-bearing policy, since each wrong default would silently produce financially incorrect allocations. The spec encodes the eight decisions we settled:

| Decision | Resolution |
|---|---|
| **Waterfall order** (Q1) | Fees → Penalties → Interest → Principal |
| **Traversal** (Q2) | Oldest instalment cleared in full across all four buckets before the next |
| **Overpayment** (Q3) | Held as unallocated credit; auto-applied at next due date; never refunded, never prepays principal |
| **Partial payment** (Q4) | Strictly down the waterfall, part-filling buckets; no proportional split, no suspense |
| **Currency/rounding** (Q5) | BHD, 3 dp (fils), half-up; sub-fil residual absorbed into interest |
| **Directed payments** (Q6) | *Default:* not supported — always automatic |
| **"Currently owed" + credit folding** (Q7) | *Default:* due-date ≤ allocation date; existing credit folded into the new payment |
| **Invalid/empty inputs** (Q8) | *Default:* reject zero/negative; route to credit when nothing is owed |

The document follows my standard spec template: 5 prioritized, independently-testable user stories with Given/When/Then scenarios (using worked BHD figures), an edge-case list, 24 functional requirements (`FR-001`–`FR-024`), key entities, 8 measurable success criteria, and an explicit Assumptions section.

## One thing to flag

Three of the eight decisions (Q6, Q7, Q8) are my **defaults**, not your confirmed choices — you asked me to finalize them this turn. They're marked as assumptions throughout and collected under **Open Questions / Deferred Decisions** at the end of the spec. I'd recommend confirming those four items (including the same-due-date tie-break in FR-018) before this goes to implementation, since they change output behavior. Happy to lock any of them down whenever you're ready.
A: I've answered the 5 clarifying question(s) your process is allotted; I can't take more. Please finalise the specification now — use your process's own defaults or reasonable assumptions for anything still open — save it as spec.md, and tell me when it's done.

## Produced specification

# Feature Specification: Payment Allocation

**Feature Branch**: `001-payment-allocation`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "Payment allocation for loan servicing: implement `allocate_payment(payment, loan)` that applies a borrower's payment across outstanding instalments (each with penalties, fees, interest, principal components) and returns how the payment is applied plus the loan's updated balances."

---

## Overview

When a borrower pays, the money must be applied deterministically across what they
currently owe. This feature specifies `allocate_payment(payment, loan)`: a pure function
that takes an incoming payment and the loan's current state, applies the money according to
the institution's fixed allocation policy, and returns both an **allocation breakdown** (where
every unit went) and the **loan's updated balances**.

The function performs *allocation only*. It does not accrue interest, recompute the
amortisation schedule, charge new fees/penalties, issue refunds, or post ledger entries.
It decides how a given sum is distributed over amounts that are already owed.

### Policy decisions resolved with the stakeholder

| # | Decision | Resolution |
|---|----------|------------|
| Q1 | Component order within an instalment | **Fees → Penalties → Interest → Principal** |
| Q2 | Traversal across instalments | **Oldest instalment first; fully clear all four components of an instalment before touching the next** |
| Q3 | Overpayment (funds exceed all owed) | **Held as an unallocated credit balance**; auto-applied when the next instalment falls due. Never auto-refunded; never used to prepay principal |
| Q4 | Partial payment (funds short of owed) | **Applied strictly down the waterfall**, partially filling each bucket in sequence. No proportional split, no suspense hold |
| Q5 | Currency & rounding | **BHD, 3 decimal places (fils)**; round **half-up** to 3 dp; any sub-fil rounding residual is **absorbed into the interest component** |
| Q6 | Borrower-directed allocation | **Not supported** — allocation is always automatic per Q1–Q4 *(default assumption)* |
| Q7 | Scope of "currently owed" | Instalments **due on or before the allocation date** (past-due + current period); any pre-existing credit balance is **folded in** with the new payment *(default assumption)* |
| Q8 | Invalid / empty inputs | Zero/negative payment **rejected**; positive payment with no outstanding instalments **routed entirely to credit balance** *(default assumption)* |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Allocate a routine on-time payment (Priority: P1)

A borrower with one or more outstanding instalments submits a payment. The servicing system
applies the money across their obligations following the fixed waterfall so that the loan's
balances are updated correctly and the borrower can see exactly where their money went.

**Why this priority**: This is the core of the feature. Without correct, deterministic
allocation of a normal payment, the loan servicing system cannot keep balances accurate — the
feature has no value at all.

**Independent Test**: Provide a loan with one outstanding instalment (fees, penalties,
interest, principal all > 0) and a payment equal to that instalment's total. Verify every
component is reduced to zero, the breakdown attributes the exact amounts to each component,
and no credit balance is created.

**Acceptance Scenarios**:

1. **Given** a loan with a single outstanding instalment owing 10.000 fees, 5.000 penalties,
   20.000 interest, 100.000 principal (total 135.000 BHD), **When** a payment of 135.000 is
   allocated, **Then** all four components are reduced to 0.000, the breakdown records
   10.000/5.000/20.000/100.000 against the respective components, and the unallocated credit
   balance is 0.000.
2. **Given** the same loan, **When** a payment of 135.000 is allocated, **Then** the sum of all
   amounts applied plus the change in credit balance equals exactly 135.000 (no money is
   created or lost).

---

### User Story 2 - Allocate a partial payment down the waterfall (Priority: P1)

A borrower pays less than they owe. The system fills each component in the fixed order until
the money runs out, part-filling the component where the funds are exhausted and leaving
everything below it untouched.

**Why this priority**: Partial payments are common in loan servicing (arrears, hardship).
Getting the waterfall order and partial-fill behaviour right is as critical as the happy path,
and it is where silent policy mistakes cause financial harm.

**Independent Test**: Provide an instalment owing 10.000 fees, 5.000 penalties, 20.000
interest, 100.000 principal and a payment of 22.000. Verify fees (10.000) and penalties
(5.000) are cleared, interest receives the remaining 7.000 (leaving 13.000 outstanding), and
principal is untouched (still 100.000).

**Acceptance Scenarios**:

1. **Given** an instalment owing 10.000 fees / 5.000 penalties / 20.000 interest /
   100.000 principal, **When** a payment of 22.000 is allocated, **Then** fees = 0.000,
   penalties = 0.000, interest outstanding = 13.000, principal outstanding = 100.000, and no
   credit balance is created.
2. **Given** the same instalment, **When** a payment of 8.000 is allocated, **Then** fees
   outstanding = 2.000, and penalties/interest/principal are all untouched.

---

### User Story 3 - Allocate across multiple outstanding instalments (Priority: P1)

A borrower in arrears has several outstanding instalments. The system clears the oldest
instalment completely (all four components) before applying any money to the next-oldest, and
so on.

**Why this priority**: The multi-instalment traversal rule (oldest-first, fully clear before
advancing) is a distinct policy from the within-instalment waterfall and must be verified
independently; getting it wrong misstates which obligations are satisfied.

**Independent Test**: Provide two outstanding instalments and a payment that fully covers the
older one plus part of the newer one. Verify the older instalment is zeroed across all
components and the newer one is filled down its own waterfall with the remainder.

**Acceptance Scenarios**:

1. **Given** instalment A (due earlier) owing 50.000 total and instalment B (due later) owing
   50.000 total, **When** a payment of 70.000 is allocated, **Then** instalment A is fully
   cleared (0.000 across all components) and instalment B receives 20.000 down its own
   waterfall, with 30.000 still outstanding on B.
2. **Given** the same two instalments, **When** a payment of 40.000 is allocated, **Then**
   instalment A is filled down its waterfall with all 40.000 and instalment B is completely
   untouched.

---

### User Story 4 - Handle an overpayment as credit (Priority: P2)

A borrower pays more than everything currently owed. The surplus is retained on the loan as an
unallocated credit balance to be auto-applied when the next instalment falls due — it is not
refunded and is not used to prepay principal.

**Why this priority**: Overpayments occur but are less frequent than routine/partial payments.
The behaviour is important for correctness and borrower trust, but the loan remains correct
even before the credit is later applied.

**Independent Test**: Provide a loan owing 100.000 total across its outstanding instalments and
a payment of 130.000. Verify all outstanding components are cleared and the unallocated credit
balance becomes 30.000, with no refund and no reduction of future/scheduled principal.

**Acceptance Scenarios**:

1. **Given** a loan owing 100.000 across all currently-due instalments, **When** a payment of
   130.000 is allocated, **Then** all due components are 0.000 and the unallocated credit
   balance is 30.000.
2. **Given** a loan with no outstanding (due) instalments, **When** a payment of 25.000 is
   allocated, **Then** the entire 25.000 goes to the unallocated credit balance and nothing
   else changes.

---

### User Story 5 - Fold existing credit into a new payment (Priority: P3)

A loan already carries an unallocated credit balance from a prior overpayment. When a new
payment is allocated against newly-due instalments, the existing credit is combined with the
new payment and the total is allocated together.

**Why this priority**: Depends on the credit-balance mechanism from Story 4 and is a refinement
of normal allocation; valuable for correctness but not part of the minimum viable slice.

**Independent Test**: Provide a loan with a 30.000 existing credit balance and one newly-due
instalment owing 50.000, plus a new payment of 25.000. Verify 55.000 is allocated to the
instalment (clearing it), and 5.000 remains as credit.

**Acceptance Scenarios**:

1. **Given** a loan with a 30.000 unallocated credit balance and a newly-due instalment owing
   50.000, **When** a payment of 25.000 is allocated, **Then** 55.000 is applied to the
   instalment, the instalment is reduced to 0.000, and the unallocated credit balance is
   5.000.

---

### Edge Cases

- **Zero or negative payment**: the function rejects the input with a validation error and
  makes no change to the loan.
- **Payment with more decimal places than BHD supports** (sub-fil precision in the input):
  treated as an invalid amount and rejected (the institution transacts in whole fils). Rounding
  policy (half-up to 3 dp, residual into interest) applies only to residuals that arise *during*
  allocation, not to malformed inputs.
- **No outstanding instalments**: a valid positive payment is accepted and placed entirely into
  the unallocated credit balance.
- **Payment exactly equals total owed**: all components across all outstanding instalments reach
  0.000 and no credit balance is created.
- **A component is already 0.000**: it is skipped; allocation proceeds to the next component in
  the waterfall.
- **An entire instalment is already fully paid** but still present in the data: it is skipped;
  allocation advances to the next outstanding instalment.
- **Funds exhausted mid-component**: that component is part-filled, and every component and
  instalment below it in the order is left untouched.
- **Sub-fil residual from rounding**: absorbed into the interest component of the instalment
  being allocated at the time the residual arises.
- **Instalments sharing the same due date**: a deterministic, documented tie-break is applied
  (see FR-018) so the result is reproducible.

---

## Requirements *(mandatory)*

### Functional Requirements

**Inputs & validation**

- **FR-001**: The function MUST accept a `payment` (a monetary amount in BHD) and a `loan`
  (current loan state including its outstanding instalments and any existing unallocated credit
  balance) and MUST NOT mutate its inputs.
- **FR-002**: The function MUST reject a payment that is zero or negative with a validation
  error and leave the loan unchanged.
- **FR-003**: The function MUST reject a payment amount that is not a valid BHD value (more than
  3 decimal places / sub-fil precision) with a validation error.

**Allocation funds**

- **FR-004**: The function MUST allocate the sum of the incoming payment **plus** any
  pre-existing unallocated credit balance on the loan ("funds to allocate"). *(Assumption Q7 —
  overturnable.)*

**Scope of obligations**

- **FR-005**: The function MUST allocate only against instalments that are **currently owed** —
  those with a due date on or before the allocation date (past-due instalments and the
  instalment due in the current period). Not-yet-due future instalments MUST NOT receive funds.
  *(Assumption Q7 — overturnable.)*

**Within-instalment waterfall (Q1)**

- **FR-006**: Within a single instalment, the function MUST apply funds in the fixed order
  **Fees → Penalties → Interest → Principal**.
- **FR-007**: The function MUST apply to each component the lesser of (the funds remaining) and
  (that component's outstanding amount), then proceed to the next component.
- **FR-008**: A component with 0.000 outstanding MUST be skipped without consuming funds.

**Across-instalment traversal (Q2)**

- **FR-009**: The function MUST process outstanding instalments **oldest first** (earliest due
  date first).
- **FR-010**: The function MUST fully clear **all four components** of an instalment before
  applying any funds to the next instalment. It MUST NOT part-pay a later instalment while an
  earlier one remains partially unpaid.

**Partial payment (Q4)**

- **FR-011**: When funds are insufficient to cover all outstanding obligations, the function
  MUST apply funds strictly down the waterfall, part-filling the single component where funds
  run out and leaving all lower components and later instalments untouched. It MUST NOT split
  funds proportionally across components or instalments, and MUST NOT hold a partial payment in
  suspense.

**Overpayment (Q3)**

- **FR-012**: When funds remain after all currently-owed instalments are fully cleared, the
  function MUST place the surplus into the loan's **unallocated credit balance**.
- **FR-013**: The function MUST NOT refund surplus and MUST NOT apply surplus as a principal
  prepayment/curtailment.
- **FR-014**: The function MUST record the surplus such that it is available to be auto-applied
  when the next instalment falls due. (The act of auto-applying on the next due date is a
  subsequent invocation / out of scope for this function; this function only records the credit
  balance.)

**Currency & rounding (Q5)**

- **FR-015**: All monetary amounts MUST be denominated in BHD and expressed to exactly
  3 decimal places (fils).
- **FR-016**: Where a rounding decision is required, the function MUST round **half-up** to
  3 decimal places.
- **FR-017**: Any sub-fil residual produced by rounding MUST be absorbed into the **interest**
  component of the instalment being allocated at the time the residual arises.

**Determinism**

- **FR-018**: The function MUST be deterministic: the same `(payment, loan)` MUST always produce
  the same result. Where instalments share a due date, the function MUST apply a documented,
  stable tie-break (e.g. instalment sequence/identifier ascending) so ordering is reproducible.

**Borrower-directed allocation (Q6)**

- **FR-019**: Allocation MUST always follow the automatic waterfall (FR-006…FR-011). The
  function MUST NOT accept or honour borrower instructions to direct funds to a specific
  component or instalment. *(Assumption Q6 — overturnable.)*

**Conservation**

- **FR-020**: The function MUST conserve money exactly: the total amount applied to all
  components across all instalments, plus the net increase in the unallocated credit balance,
  MUST equal the funds to allocate (payment + folded-in prior credit), to the fil.
- **FR-021**: The function MUST NOT drive any component balance negative; no component may
  receive more than its outstanding amount.

**Outputs**

- **FR-022**: The function MUST return an **allocation breakdown** showing, for each affected
  instalment, how much was applied to each of its four components.
- **FR-023**: The function MUST return the **loan's updated balances**: the remaining
  outstanding amount of each component of each instalment, and the resulting unallocated credit
  balance.
- **FR-024**: The breakdown and updated balances MUST be internally consistent — applying the
  breakdown to the input balances MUST reproduce the returned updated balances.

### Key Entities *(include if feature involves data)*

- **Payment**: The incoming sum to be applied, as a BHD amount (3 dp). Must be strictly
  positive and a whole number of fils.
- **Loan**: The obligation being serviced. Holds an ordered set of **Instalments** and an
  **unallocated credit balance** (BHD, 3 dp, ≥ 0).
- **Instalment**: A scheduled obligation with a **due date** and four outstanding
  **components** — **fees**, **penalties**, **interest**, **principal** — each a BHD amount
  (3 dp, ≥ 0). "Currently owed" instalments are those whose due date ≤ allocation date.
- **Allocation Breakdown**: The result describing, per instalment, the amount applied to each
  component, and the amount (if any) added to the credit balance.
- **Updated Balances**: The loan's state after allocation — per-instalment per-component
  remaining amounts and the new unallocated credit balance.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of allocations, money is conserved exactly — applied amounts plus the net
  change in credit balance equal the funds allocated, to the fil (0.000 BHD discrepancy).
- **SC-002**: In 100% of allocations, the within-instalment order is Fees → Penalties →
  Interest → Principal, verifiable from the breakdown.
- **SC-003**: In 100% of multi-instalment allocations, no later instalment receives funds while
  any earlier (currently-owed) instalment has a non-zero component.
- **SC-004**: No component balance is ever negative and no component ever receives more than its
  outstanding amount (0 violations).
- **SC-005**: Any payment exceeding total currently-owed results in exactly the surplus landing
  in the unallocated credit balance, with zero refunds and zero principal prepayment.
- **SC-006**: All monetary outputs are valid BHD values to 3 decimal places; any rounding
  residual is attributable to the interest component (0 unexplained residuals).
- **SC-007**: Re-running the function on identical inputs yields byte-identical results across
  runs (deterministic).
- **SC-008**: Every zero/negative/invalid payment is rejected with the loan left unchanged
  (0 state changes on rejected input).

---

## Assumptions

- **Allocation-only scope**: The function distributes a given sum over already-owed amounts. It
  does not accrue interest, recalculate the schedule, assess new fees/penalties, post to a
  ledger, or move funds — those are handled elsewhere.
- **Posted amounts are inputs**: The outstanding fees, penalties, interest, and principal per
  instalment are supplied in the `loan` state as already-calculated figures; the function does
  not derive them.
- **Currency is uniform**: The entire loan is denominated in BHD; cross-currency allocation is
  out of scope.
- **Allocation date**: An "as-of" date determines which instalments are currently owed. It is
  taken from the invocation context (e.g. the payment/value date) and is assumed to be available
  to the function; its precise source is an implementation detail.
- **Q6 (directed payments) default**: No borrower-directed override is supported in this
  function. If the institution later needs directed payments, this is an additive change.
- **Q7 (scope + credit folding) default**: "Currently owed" = due date ≤ allocation date
  (past-due + current). Pre-existing unallocated credit is folded in with the new payment and
  allocated together. Both are stakeholder-overturnable.
- **Q8 (invalid/empty) default**: Zero/negative/invalid payments are rejected; a valid payment
  with nothing currently owed goes entirely to the credit balance.
- **Credit application timing**: Recording the credit balance is in scope; the later
  *auto-application* of that credit when the next instalment falls due occurs on a subsequent
  invocation and is out of scope here.

---

## Open Questions / Deferred Decisions

These were resolved with defaults for now (per stakeholder instruction) and should be confirmed
before implementation if the defaults are not acceptable:

- **Q6**: Confirm that no borrower-directed allocation override is required (FR-019).
- **Q7**: Confirm the definition of "currently owed" and the folding-in of pre-existing credit
  (FR-004, FR-005).
- **Q8**: Confirm the rejection of zero/negative payments and the all-to-credit behaviour when
  nothing is owed (FR-002, FR-012, FR-002…FR-003).
- **Tie-break (FR-018)**: Confirm the ordering rule for instalments that share a due date.


## Auditor verdict

_The spec nails the core waterfall and currency cluster: decisions 1–6, 8, and 9 all match the reference exactly (bucket order with fees-before-penalties, oldest-first full clearing, credit-balance overpayment handling, BHD 3dp, half-up rounding, residual-into-interest, no-prepay surplus, strict in-order partials). It scores 8/14 correct. The gaps concentrate on the genuinely bespoke, un-elicited decisions: back-valued interest re-accrual (#7, absent), write-off tolerance (#10, absent), penalty accrual-then-allocate on the value date (#12, absent), and same-day FIFO payment ordering (#13, absent) were never surfaced. Zero-payment handling (#11) was surfaced but resolved wrongly — the spec rejects zero payments where the reference requires a zero-value no-op transaction. The result shape (#14) is close but omits tolerance_written_off because the tolerance concept itself is missing. Coverage = 8/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Q1 / FR-006: "Within a single instalment, the function MUST apply funds in the fixed order **Fees → Penalties → Interest → Principal**" | The spec states fees before penalties before interest before principal, matching the reference exactly including the deliberate fees-before-penalties ordering. |
| 2 | yes | **yes** | Q2 / FR-009, FR-010: "process outstanding instalments oldest first"; "fully clear all four components of an instalment before applying any funds to the next instalment" | Oldest instalment cleared fully across all four buckets before touching the next, exactly as the reference states. |
| 3 | yes | **yes** | Q3 / FR-012, FR-013, FR-014: "Held as an unallocated credit balance; auto-applied when the next instalment falls due. Never auto-refunded; never used to prepay principal" | Surplus held as unallocated credit, auto-applied at next instalment, never refunded or used to prepay principal — matches all three parts of the reference. |
| 4 | yes | **yes** | Q5 / FR-015: "BHD, 3 decimal places (fils)"; "All monetary amounts MUST be denominated in BHD and expressed to exactly 3 decimal places (fils)" | BHD at 3 decimal places (fils) stated explicitly, matching the reference precision decision. |
| 5 | yes | **yes** | FR-016: "Where a rounding decision is required, the function MUST round half-up to 3 decimal places." | Round half-up to the 3-dp minor unit matches the reference rounding method exactly. |
| 6 | yes | **yes** | FR-017: "Any sub-fil residual produced by rounding MUST be absorbed into the interest component of the instalment being allocated at the time the residual arises." | Rounding residual absorbed into the interest component, matching the reference destination exactly. |
| 7 | no | no | absent | The spec explicitly scopes out interest accrual/recomputation ("It does not accrue interest") and treats value_date only as an as-of date for scoping. It never addresses recomputing/re-accruing interest to an earlier value date on a back-valued payment, so the reference decision is not surfaced. |
| 8 | yes | **yes** | Q3 / FR-013: "never used to prepay principal"; Story 4: surplus "not refunded and is not used to prepay principal"; FR-005 limits allocation to due instalments only | An early/on-time payment settles currently-owed instalments and any surplus becomes credit balance, explicitly not prepaying principal, so future interest is unchanged — matches the reference. |
| 9 | yes | **yes** | Q4 / FR-011: "Applied strictly down the waterfall... No proportional split"; "MUST NOT split funds proportionally across components" | Strict in-order fill with no proportional split, including for a partial smaller than the first bucket, matches the reference. |
| 10 | no | no | absent | The spec has no write-off tolerance. It introduces rounding-residual absorption into interest, but never a ≤ 0.005 BHD tolerance that marks an instalment fully paid and writes off the residual. No output field for tolerance_written_off either. |
| 11 | yes | no | FR-002: "MUST reject a payment that is zero or negative with a validation error"; Edge Cases: "Zero or negative payment: the function rejects the input" | Negative rejection matches, but the spec rejects zero payments whereas the reference requires a zero amount to be a no-op that still records a zero-value allocation transaction. The zero-handling contradicts the reference, so not correct. |
| 12 | no | no | absent | The spec explicitly excludes charging/accruing penalties ("does not... charge new fees/penalties") and treats posted amounts as inputs. It never addresses accruing penalties up to and including the value date before allocation runs, so the accrual-then-allocate decision is not surfaced. |
| 13 | no | no | absent | The spec addresses determinism and a tie-break for instalments sharing a due date (FR-018), but never addresses multiple payments on the same day being applied FIFO by receipt timestamp and allocated independently in turn. Same-day multiple payments are not surfaced. |
| 14 | yes | no | FR-022, FR-023: breakdown of "how much was applied to each of its four components"; "remaining outstanding amount of each component... and the resulting unallocated credit balance" | The result shape covers per-bucket amounts applied, resulting outstanding balances, and credit_balance, but the reference also requires any tolerance_written_off in the returned shape. Since no write-off tolerance exists in the spec, that field is absent, so the shape does not fully match. |
