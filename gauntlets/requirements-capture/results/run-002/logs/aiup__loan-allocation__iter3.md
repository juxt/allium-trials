# aiup — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 12 · Captured: 13/14 · Bespoke captured: 7/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the interactive question tool isn't going through in this environment. I'll ask directly in text instead — these are the decisions I need you, as stakeholder, to make before I can write a correct spec. Guessing any of them risks a confidently wrong specification, so I'd rather ask.

## Round 1 — the core allocation policy (most material)

**Q1. Waterfall order within an instalment.** When money is applied to one instalment, in what order are its four components consumed?
- (a) Penalties → Fees → Interest → Principal *(common in consumer servicing)*
- (b) Fees → Penalties → Interest → Principal
- (c) Interest → Principal → Fees → Penalties
- (d) Principal first
- (e) something else

**Q2. Order across multiple outstanding instalments.**
- (a) **Instalment-major / FIFO** — fully settle all components of the oldest instalment before touching the next
- (b) **Component-major** — pay one component (e.g. all penalties) across *every* instalment oldest-first, then the next component across all, etc.
- (c) By due date / most-days-overdue
- (d) something else

**Q3. Overpayment** (payment exceeds total currently owed). The excess should be:
- (a) applied to future/not-yet-due instalments (prepayment, same waterfall)
- (b) held as an unapplied/suspense credit, schedule untouched
- (c) applied to principal and the schedule re-amortized
- (d) refunded to the borrower
- (e) something else

**Q4. Underpayment** (payment is less than a full instalment's total).
- (a) apply partially down the waterfall, leave the remainder outstanding
- (b) hold the whole payment in suspense until a full instalment's worth is available
- (c) reject the payment

## Round 2 — scope, numerics, and the return contract

**Q5. What counts as "currently owed"?** Only past-due instalments, the current-period instalment too, or the entire remaining schedule? And does `allocate_payment` *accrue* penalties/interest as of the payment date, or does it allocate against balances already present on the loan?

**Q6. Money representation & rounding.** What currency/precision — decimal with 2 fraction digits, or integer minor units (cents)? Which rounding mode (e.g. half-up, banker's), and where does any residual rounding remainder land (principal, last component)? Is this single-currency?

**Q7. Invalid inputs.** How should the function treat a zero payment, a negative payment, a payment against a loan with nothing owed, or non-finite/overflow amounts — raise an error, or return a no-op allocation?

**Q8. The return contract.** What must `allocate_payment` return, concretely? For example: a per-instalment, per-component breakdown of amounts applied; the loan's updated per-component balances; any unapplied/excess amount; and whether the input `loan` is mutated or a new updated loan is returned. Tell me the shape you expect and I'll specify it precisely.

Answer whichever you have views on (even just the letters, e.g. "Q1: a, Q2: a…"); for any you leave open I'll flag the assumption explicitly in the spec rather than bury it. Once you reply, I'll write `spec.md`.
A: Q1: (b) — fees, then penalties, then interest, then principal.

Q2: (a) — instalment-major FIFO. Clear all four buckets of the oldest instalment completely before any money touches the next one.

Q3: (b) — hold as an unallocated credit balance. It auto-applies to the next instalment when that instalment falls due. It is never auto-refunded.

Q4: (a) — apply partially down the waterfall in strict bucket order; leave the remainder outstanding. No proportional splitting.

Q5: Past-due instalments plus the current-period instalment (not the full remaining schedule). The function accrues penalties up to and including the payment's value date, then allocates against those post-accrual balances. For a back-valued payment (value_date earlier than today), interest is also recomputed to that value date before allocation runs.

Q6: Currency is BHD — three decimal places (fils). Rounding mode is half-up to three decimal places. Any rounding residual is absorbed into the interest component, not principal. Single currency throughout.

Q7: Negative payment — rejected with an error. Zero payment — accepted as a no-op but still records a zero-value allocation transaction. Payment against a loan with nothing owed — treated as an overpayment: zero allocated, full amount becomes a credit balance per Q3. Non-finite or overflow amounts — [default, not policy] reject with an error.

Q8: Return a result object (do not mutate the input loan). It must contain: the amount applied to each bucket of each instalment touched, the resulting outstanding balance per bucket per instalment, any credit_balance created, and any tolerance_written_off amount. Write-off tolerance: if the residual owed after allocation is ≤ 0.005 BHD, mark the instalment fully paid and record the written-off residual in the result.

### Round 2
_Step reasoning:_ (live agent turn)

Q: That's comprehensive — thank you. Your answers introduced two mechanics the function must perform itself (accruing penalties to the value date, and recomputing interest for back-valued payments), plus a pre-existing `credit_balance` concept. A few of those raise follow-ups I genuinely can't infer. One more short round and then I'll write the spec.

**Q9. Accrual inputs & day-count.** `allocate_payment` accrues penalties and recomputes interest to the value date. Where do the rate parameters come from — are they carried on the `loan` object (per-instalment penalty rate, interest rate, day-count convention), or supplied separately? And which day-count convention governs the interest recomputation (e.g. Actual/365, Actual/360, 30/360)?

**Q10. Penalty accrual basis.** Is a penalty a flat charge per missed instalment, or does it accrue daily on the overdue amount up to the value date? If daily, on what base (overdue principal only, or principal+interest)?

**Q11. Pre-existing credit balance.** When `allocate_payment` runs and the loan already carries a `credit_balance` (from an earlier overpayment), does the function consume that existing credit first — combining it with the new payment before the waterfall — or does existing credit stay untouched until its own instalment falls due, with only the new payment allocated this call?

**Q12. Back-valued floor / recompute scope.** For a back-valued payment (value_date before today), when interest is recomputed to that earlier date: does this only ever *reduce* accrued interest (a floor at already-posted amounts), or can it also claw back / adjust penalties that were assessed between the value date and today (e.g. reversing a late penalty if the payment is now deemed on-time)?

Answer what you can; anything you leave open I'll record as a stated assumption in the spec rather than silently bake in.
A: Q9. [default, not policy] Rate parameters are carried on the loan object — per-instalment interest rate, penalty rate, and day-count convention stored there so the function is self-contained. Day-count convention is Actual/365.

Q10. [default, not policy] Penalty is a flat charge per missed instalment (assessed once when the instalment becomes overdue), not a daily-accruing amount. It does not compound on the overdue base.

Q11. Only the new payment is allocated in this call. An existing credit_balance stays untouched and auto-applies when the next instalment falls due, exactly as stated in Q3. The function does not combine pre-existing credit with the incoming payment.

Q12. Recomputation only reduces accrued interest to match the earlier value date — it does not claw back or reverse penalties assessed between the value date and today. Penalties already posted remain. The back-value adjustment is scoped to interest only.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in this directory.

## What I did

The brief named only the domain and the interface — every material allocation policy was omitted, and each is an institution-specific choice that can't be reliably inferred (several plausible answers each). Rather than guess, I asked you 12 questions across two rounds and built the spec from your answers.

## Decisions captured (all from you, not invented)

- **Waterfall:** fees → penalties → interest → principal (BR-06)
- **Across instalments:** instalment-major FIFO — oldest cleared fully before the next (BR-05)
- **Overpayment:** held as `credit_balance`, never auto-refunded (BR-10, FR-005/006)
- **Underpayment:** partial down the waterfall, no proportional splitting (BR-07)
- **Scope:** past-due + current-period instalments only; accrue penalties/interest to value date, interest recomputed for back-valued payments (BR-01/02/03)
- **Money:** BHD, 3 dp, half-up, residual into interest (C-001/002, BR-09)
- **Validation:** negative rejected, zero is an auditable no-op, nothing-owed → full credit (FR-013/014/015)
- **Contract:** returns a result object, input `loan` not mutated; includes per-bucket breakdown, credit, and `tolerance_written_off` ≤ 0.005 BHD (FR-012, BR-11)

## How I handled your "[default, not policy]" flags

The four items you marked as defaults (non-finite handling, rate location, Actual/365, flat penalty basis) are isolated in **§7 Assumptions** as A-01/A-02 and tagged in the business rules (BR-08, BR-15), so they're easy to revisit without touching the policy decisions.

## One thing to confirm

I introduced three **minor implementation assumptions** (A-03/04/05) — the precise definition of "current-period" vs "past-due", the scope of the tolerance write-off per call, and how `today` is supplied for determinism. These weren't policy questions, but flag any you'd want tightened.

The document contains functional requirements (user-story format), NFRs, constraints, the full allocation-policy business rules, the data model for `payment`/`loan`/`AllocationResult`, and four worked examples.
A: Noted. Specification accepted.

## Produced specification

# Requirements Specification — Payment Allocation (`allocate_payment`)

**Feature:** Payment allocation for the loan servicing system
**Interface:** `allocate_payment(payment, loan) -> AllocationResult`
**Status:** Draft for implementation
**Date:** 2026-11-08

---

## 1. Purpose & Scope

When a borrower pays, `allocate_payment` determines how the money is applied across
what they currently owe and returns the resulting balances. A loan may have several
outstanding instalments, each split into four component buckets: **penalties, fees,
interest, principal**.

The function is **self-contained and side-effect free**: it accrues charges to the
payment's value date, applies the money under a fixed policy, and returns a result
object. It **does not mutate** the input `loan` and performs no external I/O.

### In scope

- Accruing penalties and interest up to the payment's value date (including back-valued payments).
- Allocating the payment across in-scope instalments under the policy in §5.
- Producing a full per-bucket, per-instalment breakdown of amounts applied and resulting balances.
- Creating a credit balance from any excess.

### Out of scope

- Persisting the result, posting ledger transactions, or triggering downstream events.
- Auto-applying an existing credit balance (that happens on a later call when the next instalment falls due — see BR-14).
- Re-amortization or schedule regeneration.
- Multi-currency handling.

---

## 2. Domain Model

### 2.1 `payment` (input)

| Field        | Type            | Notes                                                        |
|--------------|-----------------|-------------------------------------------------------------|
| `amount`     | Decimal (BHD)   | Payment amount. May be zero; negative is rejected (FR-014). |
| `value_date` | Date            | Effective date of the payment. May be earlier than today (back-valued) — see FR-009. |

### 2.2 `loan` (input, not mutated)

| Field              | Type                 | Notes                                                             |
|--------------------|----------------------|------------------------------------------------------------------|
| `instalments`      | ordered list         | Scheduled instalments, each with the four buckets (see 2.3).      |
| `credit_balance`   | Decimal (BHD) ≥ 0    | Pre-existing unallocated credit from prior overpayment. Untouched by this call (FR-016). |
| `interest_rate`    | rate parameter       | Per the loan; used to recompute interest to value date (C-005).  |
| `penalty_rate`/fee | charge parameter     | Flat penalty amount assessed per missed instalment (BR-08).      |
| `day_count`        | convention           | Actual/365 (C-003).                                              |

### 2.3 `instalment`

| Field       | Type          | Notes                                                       |
|-------------|---------------|------------------------------------------------------------|
| `due_date`  | Date          | Used to determine past-due / current-period status (BR-05). |
| `penalties` | Decimal (BHD) | Outstanding penalty bucket.                                 |
| `fees`      | Decimal (BHD) | Outstanding fee bucket.                                     |
| `interest`  | Decimal (BHD) | Outstanding interest bucket.                                |
| `principal` | Decimal (BHD) | Outstanding principal bucket.                               |

### 2.4 `AllocationResult` (output)

| Field                  | Type                                   | Notes                                                                 |
|------------------------|----------------------------------------|----------------------------------------------------------------------|
| `applied`              | list of per-instalment, per-bucket amounts | Amount applied to each bucket of each instalment touched.         |
| `balances`             | list of per-instalment, per-bucket amounts | Resulting outstanding balance per bucket per instalment.          |
| `credit_balance`       | Decimal (BHD) ≥ 0                       | New credit created from excess this call (FR-005). Does **not** include pre-existing credit. |
| `tolerance_written_off`| Decimal (BHD) ≥ 0                       | Total residual written off under the tolerance rule (BR-11).         |
| `allocation_txn`       | record                                 | Always produced, even for a zero-value payment (FR-013).             |

---

## 3. Functional Requirements

| ID     | Title                              | User Story                                                                                                                                                              | Priority | Status |
|--------|------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|--------|
| FR-001 | Allocate payment                   | As a loan servicing system, I want to allocate a borrower's payment across their outstanding instalments so that their balances are reduced correctly.                 | High     | Open   |
| FR-002 | Bucket waterfall                   | As a servicing officer, I want each instalment's buckets paid in the order fees → penalties → interest → principal so that charges are recovered before principal.      | High     | Open   |
| FR-003 | Instalment-major FIFO             | As a servicing officer, I want all four buckets of the oldest in-scope instalment fully cleared before any money touches the next instalment so that the oldest debt settles first. | High | Open   |
| FR-004 | Partial application                 | As a servicing officer, I want an under-funded payment applied down the waterfall in strict bucket order with the remainder left outstanding so that no proportional splitting occurs. | High | Open   |
| FR-005 | Overpayment to credit               | As a borrower, I want any amount beyond what I currently owe held as a credit balance so that it is not lost.                                                          | High     | Open   |
| FR-006 | No auto-refund                      | As the institution, I want excess never auto-refunded so that funds remain on the loan as credit until a future instalment falls due.                                 | High     | Open   |
| FR-007 | Scope of amounts owed               | As a servicing officer, I want allocation to consider only past-due instalments plus the current-period instalment so that not-yet-current future instalments are untouched. | High | Open   |
| FR-008 | Penalty accrual to value date       | As a servicing officer, I want penalties accrued up to and including the payment's value date before allocation so that balances reflect charges due at that date.     | High     | Open   |
| FR-009 | Interest recompute for back-value   | As a servicing officer, I want interest recomputed to an earlier value date for back-valued payments (reducing interest only) so that the borrower is not charged interest beyond the effective date. | High | Open |
| FR-010 | Rounding residual to interest       | As a servicing officer, I want any rounding residual absorbed into the interest bucket so that principal is never distorted by rounding.                               | Medium   | Open   |
| FR-011 | Tolerance write-off                 | As a servicing officer, I want an instalment with a residual ≤ 0.005 BHD after allocation marked fully paid with the residual recorded as written off so that negligible balances do not linger. | Medium | Open |
| FR-012 | Return result without mutation      | As a developer, I want `allocate_payment` to return a result object and leave the input `loan` unmodified so that the call is side-effect free and testable.           | High     | Open   |
| FR-013 | Zero payment no-op                   | As a servicing officer, I want a zero payment accepted as a no-op that still records a zero-value allocation transaction so that the event is auditable.               | Medium   | Open   |
| FR-014 | Reject negative payment             | As a servicing officer, I want a negative payment rejected with an error so that invalid amounts cannot be allocated.                                                  | High     | Open   |
| FR-015 | Nothing owed → full credit          | As a borrower, I want a payment against a loan with nothing owed treated as an overpayment, with the full amount becoming a credit balance, so that my payment is retained. | Medium | Open |
| FR-016 | Pre-existing credit untouched       | As a servicing officer, I want an existing `credit_balance` left untouched during this call (only the new payment allocated) so that prior credit applies when its instalment falls due. | High | Open |

---

## 4. Non-Functional Requirements

| ID      | Title                  | Requirement                                                                                                           | Category        | Priority | Status |
|---------|------------------------|---------------------------------------------------------------------------------------------------------------------|-----------------|----------|--------|
| NFR-001 | Monetary accuracy      | All monetary arithmetic must use exact decimal arithmetic at 3 fraction digits (fils); no binary floating-point drift is permitted. | Accuracy        | High     | Open   |
| NFR-002 | Determinism            | Identical `payment` and `loan` inputs must always yield a byte-identical `AllocationResult`.                          | Reliability     | High     | Open   |
| NFR-003 | No side effects        | The function must not mutate inputs, perform I/O, or depend on wall-clock time except via `today` for scope/accrual decisions. | Maintainability | High     | Open   |
| NFR-004 | Performance            | Allocation must complete in under 50 ms for a loan with up to 600 instalments on commodity hardware.                 | Performance     | Medium   | Open   |
| NFR-005 | Auditability           | The result must contain a per-bucket, per-instalment breakdown sufficient to reconstruct the allocation independently. | Auditability    | High     | Open   |

---

## 5. Business Rules — Allocation Policy

Processing order for a single `allocate_payment` call:

| ID    | Rule                                                                                                                                                                                                     |
|-------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| BR-01 | **In-scope instalments** = all past-due instalments (due_date ≤ value_date/today window) **plus** the current-period instalment. Future instalments beyond current period are excluded. (FR-007)         |
| BR-02 | **Penalty accrual**: for each in-scope instalment overdue as of `value_date`, assess the flat penalty once (if not already assessed). Penalties are flat per missed instalment; they do not accrue daily or compound. (FR-008, BR-08) |
| BR-03 | **Interest accrual / recompute**: interest is recomputed to `value_date` using Actual/365. For a back-valued payment this only **reduces** accrued interest to the earlier date; it never reverses penalties assessed between value_date and today. (FR-009, Q12) |
| BR-04 | **Rounding**: after accrual, all bucket balances are rounded half-up to 3 decimal places (fils). (C-002)                                                                                                 |
| BR-05 | **Instalment order**: process in-scope instalments oldest-first (instalment-major FIFO). An instalment must be fully cleared across all four buckets before the next receives any money. (FR-003)        |
| BR-06 | **Bucket waterfall** within each instalment: **fees → penalties → interest → principal**. Each bucket is satisfied in full before the next receives money. (FR-002)                                      |
| BR-07 | **Partial application**: if the remaining payment cannot fully cover a bucket, apply what remains to that bucket in strict order and stop; the rest of that instalment (and all later instalments) stays outstanding. No proportional splitting. (FR-004) |
| BR-08 | Penalty is a flat charge per missed instalment, assessed once when the instalment becomes overdue; it does not compound on the overdue base. *(Supplied as a default — see A-02.)*                       |
| BR-09 | **Rounding residual**: any residual arising from rounding during allocation is absorbed into the **interest** bucket, never principal. (FR-010)                                                          |
| BR-10 | **Excess → credit**: once all in-scope instalments are cleared, any remaining payment becomes `credit_balance` on the result. It is never auto-refunded and is not combined with the loan's pre-existing credit. (FR-005, FR-006, FR-016) |
| BR-11 | **Tolerance write-off**: for each instalment processed, if the residual owed after allocation is ≤ 0.005 BHD, mark the instalment fully paid and add that residual to `tolerance_written_off`. (FR-011) |
| BR-12 | **Zero payment**: accepted; allocates nothing but still returns a zero-value `allocation_txn`. (FR-013)                                                                                                  |
| BR-13 | **Negative payment**: rejected with an error; no result is produced. (FR-014)                                                                                                                           |
| BR-14 | **Nothing owed**: if no in-scope balance remains after accrual, the full payment becomes `credit_balance` (zero allocated). (FR-015) The pre-existing credit auto-applies only on a later call when the next instalment falls due. |
| BR-15 | **Non-finite / overflow amounts**: rejected with an error. *(Supplied as a default — see A-01.)*                                                                                                         |

---

## 6. Constraints

| ID    | Title                 | Constraint                                                                                             | Category  | Priority | Status |
|-------|-----------------------|-------------------------------------------------------------------------------------------------------|-----------|----------|--------|
| C-001 | Currency              | All amounts are in BHD, expressed to 3 decimal places (fils).                                          | Technical | High     | Open   |
| C-002 | Rounding mode         | Rounding is half-up to 3 decimal places.                                                               | Technical | High     | Open   |
| C-003 | Day-count convention  | Interest recomputation uses Actual/365.                                                                | Technical | High     | Open   |
| C-004 | Single currency       | The function handles a single currency (BHD) throughout; no FX conversion.                             | Technical | High     | Open   |
| C-005 | Rate parameters on loan | Interest rate, penalty parameter, and day-count convention are carried on the `loan` object so the function is self-contained. | Technical | High | Open   |

---

## 7. Assumptions & Stakeholder-Confirmed Defaults

Items the stakeholder explicitly flagged as **`[default, not policy]`** — safe to revisit without re-opening policy:

| ID   | Assumption                                                                                                                              | Source |
|------|---------------------------------------------------------------------------------------------------------------------------------------|--------|
| A-01 | Non-finite (NaN/Inf) or overflow amounts are rejected with an error.                                                                   | Q7     |
| A-02 | Rate parameters (interest rate, penalty, day-count) are stored on the `loan` object; penalty is a **flat** charge per missed instalment. | Q9, Q10 |

Minor implementation assumptions (flag for confirmation if they matter):

| ID   | Assumption                                                                                                                              |
|------|---------------------------------------------------------------------------------------------------------------------------------------|
| A-03 | The "current-period instalment" is the single instalment whose period contains `value_date`/today; "past-due" is any instalment with an earlier due_date still carrying a balance. |
| A-04 | The tolerance write-off (BR-11) applies to each instalment the allocation reaches during this call, evaluated on its post-allocation residual. |
| A-05 | `today` (for determining overdue status and current period) is supplied to the function or obtained from a deterministic clock, consistent with NFR-002/NFR-003. |

---

## 8. Worked Examples (illustrative, non-normative)

**E1 — Partial payment, oldest-first.** Loan has two overdue instalments. Instalment 1 owes
fees 2.000, penalties 5.000, interest 10.000, principal 100.000. A payment of 12.000 BHD on
the due date: fees 2.000 → penalties 5.000 → interest 5.000 (remaining), principal 0. Instalment 1
interest residual 5.000 and principal 100.000 stay outstanding; instalment 2 untouched. No credit.

**E2 — Overpayment.** All in-scope instalments total 150.000 BHD owed; payment is 200.000.
After full allocation, `credit_balance` = 50.000; pre-existing loan credit unchanged.

**E3 — Tolerance.** After allocation an instalment has a 0.004 BHD interest residual. It is
marked fully paid; `tolerance_written_off` += 0.004.

**E4 — Back-valued.** Payment value_date is 10 days before today. Interest is recomputed down
to the value date (Actual/365) before allocation; a penalty already assessed in that 10-day
window is **not** reversed.


## Auditor verdict

_The specification scores 13/14. It correctly and literally resolves every bespoke decision (bucket order 1, oldest-first 2, credit-balance handling 3/8, BHD 3-dp precision 4, half-up rounding 5, residual-to-interest 6, back-valued recompute 7, strict-order partials 9, 0.005 tolerance 10, zero/negative handling 11, penalty accrual-then-allocate 12, result shape 14). The sole gap is decision 13: the spec treats allocate_payment as a single-payment call and never specifies FIFO-by-timestamp ordering for multiple same-day payments. Coverage = 13/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | BR-06 / FR-002: "Bucket waterfall within each instalment: fees → penalties → interest → principal. Each bucket is satisfied in full before the next receives money." | Spec states the exact order fees → penalties → interest → principal, matching the reference's deliberate fees-before-penalties sequence. |
| 2 | yes | **yes** | BR-05 / FR-003: "process in-scope instalments oldest-first (instalment-major FIFO). An instalment must be fully cleared across all four buckets before the next receives any money." | Matches reference exactly: oldest instalment cleared in full across all four buckets before any money touches the next. |
| 3 | yes | **yes** | FR-005/FR-006/BR-10: excess "held as a credit balance", "never auto-refunded"; Out of scope: "Auto-applying an existing credit balance (that happens on a later call when the next instalment falls due)". | Spec holds surplus as unallocated credit, never auto-refunds, and defers auto-application to the next instalment's due date, matching all three clauses of the reference. |
| 4 | yes | **yes** | C-001: "All amounts are in BHD, expressed to 3 decimal places (fils)." NFR-001: "3 fraction digits (fils)". | Currency is BHD with 3 dp precision throughout, matching the reference exactly. |
| 5 | yes | **yes** | C-002 / BR-04: "Rounding is half-up to 3 decimal places." | Round half-up to the 3-dp minor unit matches the reference's chosen method. |
| 6 | yes | **yes** | BR-09 / FR-010: "any residual arising from rounding during allocation is absorbed into the interest bucket, never principal." | Residual destination is the interest component, exactly as the reference specifies. |
| 7 | yes | **yes** | FR-009 / BR-03: "interest is recomputed to value_date using Actual/365. For a back-valued payment this only reduces accrued interest to the earlier date". | Spec recomputes (re-accrues) interest to the earlier value_date before allocation, matching the reference's value-date recompute policy. |
| 8 | yes | **yes** | BR-01/FR-007: in-scope = past-due + current-period instalment, future excluded; BR-10: excess "becomes credit_balance"; Out of scope: "Re-amortization". | Since only the current (and past-due) instalments are in scope and surplus becomes credit rather than paying future principal, future interest is unchanged, matching the reference that early surplus does not prepay principal. |
| 9 | yes | **yes** | BR-07 / FR-004: "apply what remains to that bucket in strict order and stop ... No proportional splitting." | Strict in-order fill with no proportional split matches the reference (one of the more inferable decisions). |
| 10 | yes | **yes** | BR-11 / FR-011: "if the residual owed after allocation is ≤ 0.005 BHD, mark the instalment fully paid and add that residual to tolerance_written_off." | Tolerance threshold of ≤ 0.005 BHD and the write-off behaviour match the reference precisely. |
| 11 | yes | **yes** | FR-013/BR-12: zero payment "accepted as a no-op that still records a zero-value allocation transaction"; FR-014/BR-13: "negative payment rejected with an error". | Negative rejected with error and zero a no-op that still records a zero-value txn match both halves of the reference. |
| 12 | yes | **yes** | FR-008 / BR-02: "penalties accrued up to and including the payment's value date before allocation"; BR-02: "allocation runs on post-accrual balances" (implied by ordering). | Penalties accrue up to and including the value date, then allocation runs on post-accrual balances, matching the reference. |
| 13 | no | no | absent | The spec defines a single-payment call and never addresses ordering of multiple same-day payments or FIFO by receipt timestamp; no mention of receipt timestamp anywhere. |
| 14 | yes | **yes** | §2.4 AllocationResult: `applied` (per-instalment per-bucket), `balances` (resulting outstanding per bucket), `credit_balance` (new credit created), `tolerance_written_off`. | Result exposes applied-per-bucket amounts, resulting balances, credit created, and tolerance written off, matching all four fields of the reference result shape. |
