# aiup — loan-allocation — iteration 2

Model (author): claude-opus · Questions asked: 9 · Captured: 9/14 · Bespoke captured: 3/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured question prompt didn't go through. Let me just put the questions to you directly in text — answer however is easiest (a letter/number per question is fine).

I've identified **six** material policy decisions the brief leaves open. Each has several plausible answers and your institution has presumably settled on specific ones, so I need your calls rather than my guesses.

**1. Waterfall shape** — across multiple outstanding instalments, which dimension wins?
- (a) **Oldest instalment first, fully** — clear all four components of the oldest instalment before touching the next.
- (b) **Component type across all instalments** — all penalties everywhere, then all fees everywhere, then all interest, then all principal.

**2. Component order within an instalment** — the paydown sequence of the four buckets:
- (a) Penalties → Fees → Interest → Principal
- (b) Fees → Penalties → Interest → Principal
- (c) Interest → Principal → Penalties → Fees
- (d) Principal → Interest → Fees → Penalties

**3. Overpayment** — payment exceeds total owed; the excess should:
- (a) Prepay future instalments (same waterfall), (b) Reduce principal directly (curtailment), (c) Hold as unapplied credit/suspense, (d) Refund to borrower.

**4. Underpayment** — payment is less than the next item in the waterfall:
- (a) Apply partially as far down the waterfall as it reaches, (b) Hold the whole payment in suspense until a full instalment accumulates, (c) Apply partially but only against currently-due/past-due amounts.

**5. Rounding & currency** — what monetary precision and rounding do you require (e.g. 2-decimal minor units, round-half-up / banker's rounding), and where do residual sub-unit amounts land (e.g. on principal)? Any negative-payment or zero-payment handling?

**6. Scope of "outstanding"** — does allocation consider only past-due/currently-due instalments, or all instalments including not-yet-due future ones? And is there a defined **tie-break** when two instalments share a due date?

Once you give me these, I'll write the full requirements catalog (FRs, NFRs, constraints) and save it as `spec.md`. If any of these don't match how your system actually works, tell me the real rule.
A: 1. (a) — Oldest instalment first, fully. All four components of the oldest instalment must be cleared before any allocation touches the next.

2. (b) — Fees → Penalties → Interest → Principal.

3. (c) — Surplus held as an unallocated credit balance. Auto-applied when the next instalment falls due. Never auto-refunded.

4. (a) — Apply partially in strict waterfall order, filling each bucket in sequence. No proportional split, no suspense.

5. Currency is BHD — 3 decimal places (fils). Round half-up to 3 dp. Rounding residuals are absorbed into the interest component, not principal. Negative payments are rejected with an error. Zero payments are accepted as a no-op but must still record a zero-value allocation transaction.

6. Allocation covers only past-due and currently-due instalments; not-yet-due future instalments are out of scope. Tie-break when two instalments share a due date: [default, not policy] — apply by instalment ID ascending.

### Round 2
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved.

**It's done** — the full requirements specification is at `spec.md` in this directory.

## How I approached it

The brief was deliberately underspecified: it named the domain and the `allocate_payment(payment, loan)` interface and nothing else. The substance of this feature is *policy*, and those policies can't be reliably inferred — each has several plausible answers and your institution has picked specific ones. So rather than guess, I surfaced the six material decisions and had you resolve them:

1. **Waterfall shape** → oldest instalment first, fully cleared
2. **Component order** → fees → penalties → interest → principal
3. **Overpayment** → held as unallocated credit, auto-applied at next due date, never refunded
4. **Underpayment** → strict waterfall partial, no proportional split, no suspense
5. **Currency/rounding** → BHD, 3 dp, round half-up, residuals to interest; negative rejected, zero is a logged no-op
6. **Scope/tie-break** → past-due + currently-due only; tie-break by instalment ID (flagged as a default, not confirmed policy)

## What's in the spec

- **§3 Confirmed policies** — the six decisions recorded as the authority for everything downstream
- **§4** — 13 functional requirements in user-story form, each traceable to a policy
- **§5** — a normative algorithm with inline FR/constraint references, so implementation is unambiguous
- **§6–§7** — 7 measurable NFRs (value-conservation, determinism, residual placement, atomicity, non-negativity) and 5 constraints
- **§8 Assumptions & open points** — three things I did *not* consider settled and want your confirmation on

Two of those open points are worth a direct look, since they're the kind of gap that bites later:

- **Existing credit balance** — I assumed this call allocates only the *incoming* payment and does not simultaneously draw down a pre-existing credit balance on the loan. That wasn't among the six policies. Is that right, or should an existing credit be consumed in the same call?
- **Who computes due-status** — I assumed `past-due / currently-due / not-yet-due` is supplied on each instalment, not derived inside `allocate_payment` from a system date.

Want me to fold answers to those two in, or leave them as flagged assumptions?
A: 1. Existing credit balance — an existing credit balance SHOULD be consumed in the same call, before the incoming payment is applied. Draw down the credit first (same waterfall), then allocate the incoming payment against whatever remains. [default, not policy — confirm if your ledger model differs]

2. Due-status computation — due-status is supplied on each instalment; `allocate_payment` does not derive it from a system date. That assumption is correct.

### Round 3
_Step reasoning:_ (live agent turn)

Q: **Done** — `spec.md` is updated with both confirmations threaded through.

What changed from your two answers:

- **Standing credit consumed first (new FR-014, policy #7, algorithm step 3).** The algorithm is now built on one reusable `waterfall()` pass that's applied **twice**: first spending the existing credit balance across eligible instalments, then the incoming payment against whatever's left. Surplus from the incoming payment replenishes the credit balance.
- **Value-conservation invariant (NFR-002) rewritten** to cover both money sources: `applied_total = payment + (credit_before − credit_after)`.
- **Due-status source confirmed** (new policy #8); the old open assumption is now marked resolved.

One new decision I had to make and flagged rather than bury — **assumption #3**: a *zero* incoming payment stays a pure no-op and does **not** trigger credit drawdown (drawdown runs only when `payment > 0`). That keeps your zero-payment rule (FR-011) intact, but it's a genuine interaction between two of your rules that you didn't explicitly rule on. If you'd rather a zero payment still sweep standing credit against due instalments, tell me and I'll flip step 3's guard.

Remaining flagged items, all in §8: the tie-break default (#1), the credit-drawdown order marked subject to your ledger model (#2), that zero-payment interaction (#3), and runtime platform still open (#5).
A: Assumption #3 is correct. A zero payment is a no-op; it does not trigger credit drawdown. Leave the step 3 guard as written.

### Round 4
_Step reasoning:_ (live agent turn)

Q: The specification is complete and internally consistent. `spec.md` now captures eight confirmed policy decisions (the six from the brief plus credit-drawdown order and due-status source), with FR-014 and the twice-applied waterfall algorithm reflecting them.

**Fully settled:** waterfall shape, component order, overpayment handling, underpayment handling, currency/rounding, scope, credit-drawdown order, due-status source, and the zero-payment/credit interaction.

**Still genuinely open (both noted in §8, neither blocking):**
- The equal-due-date **tie-break** (instalment ID ascending) — an engineering default you've accepted but haven't adopted as hard business policy.
- **Runtime platform/language** — the brief never named one.

If you want, I can hand this to the `entity-model` skill to formalize the Loan/Instalment/Component/Transaction structures, or the `use-case-spec` skill to turn the algorithm into acceptance scenarios. Otherwise the spec is ready to implement against.
A: Understood. The tie-break default is acceptable as an engineering convention for now. Runtime platform is not a policy concern from my side — your team's call. The spec is ready.

## Produced specification

# Requirements Specification — Payment Allocation

**Feature:** `allocate_payment(payment, loan)` — apply a borrower payment across outstanding
instalments of a loan and return the applied breakdown and updated balances.

**Status:** Draft for implementation
**Date:** 2026-11-08
**Stakeholder decisions captured:** Yes (six material policies confirmed — see §3)

---

## 1. Overview

When a borrower pays, the money must be distributed across what they currently owe. A loan
carries one or more **instalments**, and each instalment is itself split into four
**components**: penalties, fees, interest, and principal. `allocate_payment` consumes a payment
amount and a loan, walks the outstanding instalments in a fixed order, fills each component
bucket in a fixed order, and returns both a record of *how* the money was applied and the loan's
*updated* balances.

The function is **pure with respect to policy**: given the same payment and loan state it must
always produce the same allocation (see NFR-004).

### 1.1 Interface

```
allocate_payment(payment, loan) -> AllocationResult
```

- **`payment`** — a monetary amount in BHD (see C-001). Scalar value plus, where modelled, a
  payment identifier/timestamp carried through to the transaction record.
- **`loan`** — the loan aggregate: its outstanding instalments (each with penalty, fee,
  interest, principal balances and a due date + instalment ID) and any existing unallocated
  credit balance (see FR-005).
- **`AllocationResult`** — (a) the per-instalment, per-component breakdown of what the payment
  was applied to, (b) the loan's updated balances, (c) the resulting unallocated credit balance,
  and (d) a recorded allocation transaction (see FR-008).

---

## 2. Domain Model

| Entity         | Attributes (allocation-relevant)                                                                 |
|----------------|--------------------------------------------------------------------------------------------------|
| Loan           | instalments[], unallocated_credit_balance (BHD, ≥ 0)                                              |
| Instalment     | instalment_id, due_date, status (past-due / currently-due / not-yet-due), component balances      |
| Component      | Exactly four per instalment: **penalty**, **fee**, **interest**, **principal** (each BHD, ≥ 0)   |
| Payment        | amount (BHD), identifier/timestamp (carried to the transaction record)                           |
| Allocation Txn | immutable record of a single `allocate_payment` call and its per-component applications           |

**Eligibility.** Only instalments whose status is **past-due** or **currently-due** are in scope
for allocation. **Not-yet-due** (future) instalments are excluded from this function (C-003,
FR-007).

---

## 3. Confirmed Allocation Policies

These are the material decisions the brief omitted. All were confirmed by the stakeholder and are
the authority for the functional requirements below.

| # | Policy                 | Decision                                                                                                                      |
|---|------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| 1 | Waterfall shape        | **Oldest instalment first, fully.** All four components of the oldest eligible instalment are cleared before the next instalment is touched. |
| 2 | Component order        | **Fees → Penalties → Interest → Principal**, within each instalment.                                                         |
| 3 | Overpayment            | Surplus is held as an **unallocated credit balance**; auto-applied when the next instalment falls due; **never auto-refunded**. |
| 4 | Underpayment / partial | Apply **partially in strict waterfall order**, filling each bucket in sequence until the payment is exhausted. No proportional split, no suspense. |
| 5 | Currency & rounding    | **BHD, 3 decimal places (fils), round half-up.** Rounding residuals absorbed into the **interest** component. Negative payment → error. Zero payment → no-op but records a zero-value allocation transaction. |
| 6 | Scope & tie-break      | Only **past-due and currently-due** instalments. Tie-break for equal due dates: **instalment ID ascending** *(accepted default, not a hard policy)*. |
| 7 | Standing credit drawdown | An **existing** unallocated credit balance is drawn down **first** (same waterfall) before the incoming payment is applied; surplus from the incoming payment then replenishes the credit balance. *(accepted default, not a hard policy)* |
| 8 | Due-status source      | Each instalment's status (past-due / currently-due / not-yet-due) is **supplied on the instalment**; `allocate_payment` does not derive it from a system date. |

---

## 4. Functional Requirements

| ID     | Title                        | User Story                                                                                                                                                                 | Priority | Status |
|--------|------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|--------|
| FR-001 | Apply payment by instalment age | As a loan servicing system, I want to apply a payment to the oldest eligible instalment and fully clear it before moving to the next, so that older debt is retired first. | High     | Open   |
| FR-002 | Component waterfall order    | As a loan servicing system, I want each instalment's buckets filled in the order fees → penalties → interest → principal, so that charges are recovered before interest and principal. | High     | Open   |
| FR-003 | Partial allocation           | As a loan servicing system, I want an insufficient payment applied in strict waterfall order as far as it reaches with no proportional split and no suspense, so that partial payments still reduce the oldest, highest-priority balances. | High     | Open   |
| FR-004 | Surplus to credit balance    | As a loan servicing system, I want any amount left after all eligible instalments are cleared held as an unallocated credit balance, so that overpayments are retained on the loan rather than refunded. | High     | Open   |
| FR-005 | Carry and expose credit balance | As an accounting system, I want the resulting unallocated credit balance returned and stored on the loan, so that it is visible and available for the next due instalment. | High     | Open   |
| FR-006 | No automatic refund          | As a finance officer, I want surplus funds never to be auto-refunded by this function, so that disbursement remains a separate, controlled process. | High     | Open   |
| FR-007 | Restrict to due instalments  | As a loan servicing system, I want allocation to consider only past-due and currently-due instalments, so that not-yet-due future instalments are never paid down by this function. | High     | Open   |
| FR-008 | Record allocation transaction | As an auditor, I want every call to produce an immutable transaction recording the per-instalment, per-component amounts applied, so that each allocation is fully traceable. | High     | Open   |
| FR-009 | Return updated balances      | As a loan servicing system, I want the per-component updated balances for every affected instalment returned, so that the loan's new state is known after the call. | High     | Open   |
| FR-010 | Reject negative payment      | As a loan servicing system, I want a payment amount below zero rejected with an error and no state change, so that invalid credits cannot be booked. | High     | Open   |
| FR-011 | Zero payment is a no-op      | As a loan servicing system, I want a zero payment to change no balances yet still record a zero-value allocation transaction, so that the event is logged without effect. | Medium   | Open   |
| FR-012 | Deterministic tie-break      | As a loan servicing system, I want instalments sharing a due date ordered by instalment ID ascending, so that allocation order is deterministic. | Medium   | Open   |
| FR-013 | Stop when payment exhausted  | As a loan servicing system, I want allocation to stop as soon as the payment is fully consumed, leaving remaining balances untouched, so that no component is over-applied. | High     | Open   |
| FR-014 | Consume standing credit first | As a loan servicing system, I want any existing unallocated credit balance drawn down against eligible instalments (same waterfall) before the incoming payment is applied, so that retained funds are used up ahead of new money. | High     | Open   |

---

## 5. Allocation Algorithm (normative)

The following procedure is the authoritative behaviour for FR-001 … FR-014.

```
# Reusable waterfall pass: spend `funds` across `eligible` instalments and return leftover.
waterfall(funds, eligible, source):              # source ∈ {credit, payment}
    for instalment in eligible (oldest first):                               (FR-001, FR-012)
        for bucket in [fee, penalty, interest, principal]:                   (FR-002)
            applied = min(funds, bucket_balance)
            bucket_balance -= applied
            funds          -= applied
            record (source, instalment_id, bucket, applied)                  (FR-008)
            if funds == 0: return 0                                          (FR-013)
        # instalment only advanced past once all four buckets are zero        (FR-001)
    return funds                                   # leftover after all cleared

allocate_payment(payment, loan):
    1. VALIDATE
       - if payment < 0  -> raise error, no state change (incl. no credit
                            drawdown)                                         (FR-010, NFR-006)
       - if payment == 0 -> record zero-value transaction, return loan
                            unchanged (no credit drawdown either)            (FR-011)

    2. SELECT eligible instalments
       - keep instalments where status in {past-due, currently-due}          (FR-007)
       - sort by due_date ascending, then instalment_id ascending            (FR-001, FR-012)

    3. DRAW DOWN standing credit FIRST
       - leftover_credit = waterfall(loan.unallocated_credit_balance,
                                     eligible, source=credit)                (FR-014)
       - loan.unallocated_credit_balance = leftover_credit

    4. APPLY incoming payment to whatever remains
       - leftover_payment = waterfall(payment, eligible, source=payment)     (FR-003)

    5. SURPLUS
       - loan.unallocated_credit_balance += leftover_payment                 (FR-004, FR-005)
         (held, not refunded)                                                (FR-006)

    6. ROUNDING
       - all monetary math at 3 dp BHD, round half-up                        (C-001)
       - any rounding residual is absorbed into the interest component       (C-002)

    7. RETURN AllocationResult {
           applied_breakdown,          // per source, instalment, component   (FR-008)
           updated_instalment_balances,                                      (FR-009)
           unallocated_credit_balance,                                       (FR-005)
           transaction                                                       (FR-008)
       }
```

**Ordering (FR-014):** the standing credit balance is spent *before* the incoming payment, using
the identical waterfall; only then is the new money applied. Surplus from the incoming payment
replenishes the credit balance.

**Note on surplus timing (FR-004):** because future instalments are out of scope (FR-007),
leftover surplus is *stored* now and *auto-applied when the next instalment falls due* — that
later application is a separate event, not part of this call.

---

## 6. Non-Functional Requirements

| ID      | Title                  | Requirement                                                                                                           | Category        | Priority | Status |
|---------|------------------------|---------------------------------------------------------------------------------------------------------------------|-----------------|----------|--------|
| NFR-001 | Monetary precision     | All amounts are computed and stored at exactly 3 decimal places (BHD fils) using round-half-up.                      | Correctness     | High     | Open   |
| NFR-002 | No value leakage       | Total amount applied to instalment components must equal the incoming payment plus the net credit consumed, to the fils (0.000 BHD): `applied_total = payment + (credit_before − credit_after)`. | Correctness     | High     | Open   |
| NFR-003 | Residual placement     | Any rounding residual must land on the interest component and nowhere else; principal is never adjusted by rounding.  | Correctness     | High     | Open   |
| NFR-004 | Determinism            | Identical `(payment, loan state)` inputs must always yield an identical allocation and ordering.                      | Reliability     | High     | Open   |
| NFR-005 | Auditability           | Every call (including zero-payment no-ops) produces an immutable transaction record of per-component applications.    | Auditability    | High     | Open   |
| NFR-006 | Atomicity              | On a rejected (negative) payment, no instalment balance and no credit balance may change.                            | Integrity       | High     | Open   |
| NFR-007 | Non-negative balances  | No component balance and no credit balance may become negative as a result of allocation.                            | Correctness     | High     | Open   |

---

## 7. Constraints

| ID    | Title                   | Constraint                                                                                                         | Category  | Priority | Status |
|-------|-------------------------|-------------------------------------------------------------------------------------------------------------------|-----------|----------|--------|
| C-001 | Currency & precision    | Amounts are in Bahraini Dinar (BHD) at 3 decimal places (fils), rounded half-up.                                   | Technical | High     | Open   |
| C-002 | Residual absorption     | Rounding residuals must be absorbed into the interest component only.                                              | Technical | High     | Open   |
| C-003 | Future instalments excluded | This function must not allocate against not-yet-due instalments; they are out of scope.                        | Business  | High     | Open   |
| C-004 | No refund in scope      | This function must not issue refunds; surplus is retained as unallocated credit only.                              | Business  | High     | Open   |
| C-005 | Fixed component order   | The fees → penalties → interest → principal order is fixed policy and must not be configurable per-call.           | Business  | High     | Open   |

---

## 8. Assumptions & Open Points

1. **Tie-break (FR-012)** is an accepted engineering default (instalment ID ascending), *not* a
   confirmed business policy. If a deterministic business rule exists (e.g. by component size or
   origination order), it supersedes this and FR-012 must be revised.
2. **Standing-credit drawdown order (FR-014)** is an accepted default: an existing credit balance
   is consumed first, then the incoming payment. Confirmed by the stakeholder, but flagged as
   subject to the ledger model — revise if credit is not drawn down within this call.
3. **Zero payment + standing credit (FR-011 vs FR-014)** — *confirmed:* a zero incoming payment is
   a pure no-op and does **not** trigger drawdown of an existing credit balance (drawdown runs only
   when `payment > 0`). FR-011 takes precedence over FR-014 for the zero case.
4. **Due-status source (FR-008 policy row)** — *confirmed:* past-due / currently-due / not-yet-due
   is supplied on each instalment; `allocate_payment` does not derive it from a system date.
5. **Runtime platform / language** is unspecified by the brief and intentionally left open here;
   add a C-00x row once chosen.

---

## 9. Worked Example (illustrative)

Loan with two eligible instalments, payment = **1.200 BHD**, order fees → penalties → interest →
principal, oldest-first:

| Instalment (due order) | Fee   | Penalty | Interest | Principal |
|------------------------|-------|---------|----------|-----------|
| #1 (older)             | 0.300 | 0.200   | 0.400    | 0.500     |
| #2                     | 0.100 | 0.000   | 0.250    | 0.600     |

Allocation of 1.200 BHD, filling instalment #1's buckets in order fee → penalty → interest →
principal:
- fee 0.300, then penalty 0.200, then interest 0.400 → running total 0.900 consumed.
- principal needs 0.500 but only 0.300 remains → apply 0.300; instalment #1 principal left at
  0.200.
- Payment exhausted (1.200 consumed). Instalment #2 untouched. No surplus, no credit-balance
  change. One transaction recorded.

This demonstrates FR-001 (oldest first, not fully cleared because funds ran out), FR-002 (bucket
order), FR-003 (partial), and FR-013 (stop when exhausted).


## Auditor verdict

_The spec correctly nails 9 of 14, including most of the genuinely bespoke decisions (component order 1, overpayment 3, BHD 3-dp 4, residual-to-interest 6, no-prepay early-payment 8) plus the inferable ones (9, 11). It misses the four decisions that require specific elicitation and are never mentioned: back-valued/value-date re-accrual (7), write-off tolerance (10), penalty accrual to value date (12), and same-day FIFO ordering (13). The result shape (14) is otherwise a strong match but omits tolerance_written_off because the tolerance concept is absent. Coverage = 9/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §3 Policy 2: "Fees → Penalties → Interest → Principal, within each instalment."; FR-002; §5 `for bucket in [fee, penalty, interest, principal]`; C-005. | Spec states fees before penalties, matching the deliberately non-default reference order exactly. |
| 2 | yes | **yes** | §3 Policy 1: "Oldest instalment first, fully. All four components of the oldest eligible instalment are cleared before the next instalment is touched."; FR-001; §5 comment "instalment only advanced past once all four buckets are zero". | Oldest instalment cleared in full across all buckets before the next is touched, matching the reference. |
| 3 | yes | **yes** | §3 Policy 3: "Surplus is held as an unallocated credit balance; auto-applied when the next instalment falls due; never auto-refunded."; FR-004/005/006. | Credit-balance mechanism, auto-apply on next due instalment, and no auto-refund all match the reference. |
| 4 | yes | **yes** | C-001; NFR-001; §3 Policy 5: "BHD, 3 decimal places (fils)". | Loan currency BHD at 3 dp matches the reference minor unit. |
| 5 | yes | **yes** | NFR-001 "using round-half-up"; C-001 "rounded half-up"; §3 Policy 5. | Round half-up to the 3-dp minor unit matches the reference method. |
| 6 | yes | **yes** | NFR-003: "Any rounding residual must land on the interest component and nowhere else; principal is never adjusted by rounding."; C-002; §5 step 6. | Residual absorbed into interest, not principal, matches the reference exactly. |
| 7 | no | no | absent | The spec carries a payment identifier/timestamp but says nothing about a value_date or recomputing/re-accruing interest to an earlier date before allocation. |
| 8 | yes | **yes** | FR-007 / C-003 exclude not-yet-due instalments; FR-004 holds surplus as credit balance. | Because future instalments are out of scope and surplus becomes a credit balance, an early payment cannot prepay principal and future interest is unchanged — matching the reference outcome. |
| 9 | yes | **yes** | §3 Policy 4: "Apply partially in strict waterfall order... No proportional split, no suspense."; FR-003. | Strict in-order bucket filling with no proportional split matches the reference. |
| 10 | no | no | absent | No write-off tolerance is mentioned anywhere; nothing marks an instalment paid when a tiny residual (≤ 0.005 BHD) remains. |
| 11 | yes | **yes** | §3 Policy 5 "Negative payment → error. Zero payment → no-op but records a zero-value allocation transaction."; FR-010; FR-011; NFR-005. | Negative rejected with error, zero is a no-op that still records a zero-value transaction — both match the reference. |
| 12 | no | no | absent | The spec treats component balances as given on the instalment and has no penalty-accrual step; it never states penalties accrue to the value date before allocation. |
| 13 | no | no | absent | The function is single-payment per call; the spec never addresses ordering of multiple same-day payments or specifies FIFO by receipt timestamp. |
| 14 | yes | no | §1.1 AllocationResult (a) per-instalment/per-component breakdown, (b) updated balances, (c) unallocated credit balance, (d) transaction; FR-008/009; §5 step 7. | The returned shape includes per-bucket applied amounts, outstanding balances and credit_balance, but omits tolerance_written_off, which the reference shape requires (consequence of decision 10 being missed). |
