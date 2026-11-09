# aiup — loan-allocation — iteration 1

Model (author): claude-opus · Questions asked: 18 · Captured: 11/14 · Bespoke captured: 5/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: The structured question tool isn't going through in this environment, so I'll ask in plain text. I genuinely need your answers before I can write a correct spec — these are the policy decisions the brief omits, and each has several defensible answers that only you can disambiguate.

Please answer as many as you can. I've grouped them; **Q1–Q6 are the ones that most change the implementation.**

## A. The allocation waterfall

**Q1 — Waterfall shape (across instalments).** When several instalments are outstanding, does the payment:
- **(a) Instalment-first (vertical):** fully settle the oldest instalment — all its components — before touching the next instalment; or
- **(b) Component-first (horizontal):** collect one component type across *all* instalments (e.g. every instalment's penalties), then the next component type across all instalments?

**Q2 — Component priority order.** Within whichever shape you pick, in what order are the four components paid? e.g.
- (a) Penalties → Fees → Interest → Principal
- (b) Fees → Penalties → Interest → Principal
- (c) Interest → Principal → Fees → Penalties
- (d) something else (please state)

**Q3 — Instalment ordering.** Which instalment is attacked first — strictly **oldest due date first**, or by some other key (e.g. highest penalty, nearest to default)?

## B. Edge amounts

**Q4 — Overpayment.** If the payment exceeds everything currently owed, the excess is: (a) held as unapplied/suspense credit on the loan; (b) applied to principal as a prepayment; (c) refunded; (d) payment rejected?

**Q5 — Underpayment / partial.** If the payment is less than the full amount owed: (a) allocate as far down the waterfall as it reaches (partial settlement allowed); (b) hold the whole payment in suspense until it can cover a full instalment; (c) reject?

**Q6 — Rounding.** What currency granularity (e.g. cents / 2dp), what rounding mode (half-up, half-even/banker's, truncate), and where does any rounding remainder land?

## C. Scope & representation (lighter, but I need them)

**Q7 — Eligible instalments.** Does "currently owe" / "outstanding" mean only instalments **already due** (due date ≤ today), or **all** scheduled instalments including future ones?

**Q8 — Zero / negative / invalid input.** How should a zero payment, a negative payment, or a payment against a fully-paid loan be handled — reject with an error, or return a no-op allocation?

**Q9 — Money representation & currency.** What type should amounts use (minor units as integers, decimal, etc.), is the system single-currency, and must payment and loan currency be validated as matching?

**Q10 — Output shape.** What must `allocate_payment` return? I'm assuming (a) a per-instalment, per-component breakdown of how much was applied, (b) the loan's updated balances, and (c) any leftover (unapplied/refund/overpayment). Anything else — e.g. an audit/transaction record, totals, or immutability of the input `loan`?

**Q11 — Determinism/side-effects.** Should the function be pure (return a new loan, no mutation) or mutate the loan in place?

Once you answer, I'll produce `docs/requirements.md`-style FRs/NFRs/constraints and save the full spec as `spec.md`. If you'd rather I proceed on any of these with a stated default instead of waiting, tell me which and I'll mark them explicitly as assumptions.
A: Answers in order:

**Q1 — Waterfall shape:** (a) Instalment-first (vertical). Fully clear the oldest instalment across all its components before any funds touch the next.

**Q2 — Component priority order:** (b) Fees → Penalties → Interest → Principal. Fees come before penalties.

**Q3 — Instalment ordering:** Strictly oldest due date first, no other tie-break.

**Q4 — Overpayment:** (a) Surplus is held as an unallocated credit balance on the loan. It is auto-applied to the next instalment when that instalment falls due. It is never auto-refunded.

**Q5 — Underpayment / partial:** (a) Allocate as far down the waterfall as the funds reach. Partial settlement is allowed; strict bucket order is maintained with no proportional splitting.

**Q6 — Rounding:** The loan is denominated in BHD (Bahraini dinar), so 3 decimal places (fils). Rounding mode is half-up to 3 dp. Any rounding residual is absorbed into the interest component, not principal.

**Q7 — Eligible instalments:** [default, not policy] Only instalments with due_date ≤ payment value_date are considered outstanding for allocation purposes. Future-dated instalments are not in scope.

**Q8 — Zero / negative / invalid:** Negative payment is rejected with an error. Zero payment is a no-op but still produces a zero-value allocation transaction record. Payment against a fully-paid loan: [default, not policy] treat as a zero-allocation no-op; any amount becomes a credit balance per Q4 rules.

**Q9 — Money representation:** All amounts in BHD to 3 decimal places. [default, not policy] Represent as a decimal type (not integer minor units) with explicit 3 dp precision. The system is single-currency; payment currency must match loan currency or be rejected.

**Q10 — Output shape:** Per payment, return: (1) amount applied to each bucket of each instalment touched, (2) resulting outstanding balances after allocation, (3) any credit_balance created or incremented, (4) any tolerance_written_off amount. The input loan object must not be mutated; return a new state representation.

**Q11 — Determinism / side-effects:** [default, not policy] Pure function: return a new loan/allocation result, no mutation of the input. Side-effect persistence (writing to store) is the caller's responsibility.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Thanks — that's very complete. Two of your answers introduced a concept the brief and my questions hadn't surfaced (`tolerance_written_off`, and the auto-applied credit balance), and those imply further policy I shouldn't guess at. A short second round:

**Q12 — Tolerance / write-off policy.** `tolerance_written_off` in Q10 implies that a small residual can be written off so an instalment counts as settled. I need:
- (a) **Threshold** — an absolute amount (e.g. ≤ 0.010 BHD / some number of fils) or a percentage of the instalment?
- (b) **Direction** — does it apply only to *shortfalls* (instalment settled despite a tiny unpaid remainder), only to tiny *overages*, or both?
- (c) **Effect** — is the written-off remainder removed from the outstanding balance (bucket zeroed) and reported in `tolerance_written_off`? Which bucket(s) can it apply to?

**Q13 — Existing credit balance at call time.** Q4 says surplus is held and "auto-applied to the next instalment when it falls due." When `allocate_payment` runs and the loan already carries a `credit_balance` from a prior payment:
- (a) Does this call first consume the existing `credit_balance` against any now-due instalments **before** applying the incoming `payment`, or
- (b) is the credit balance left untouched and only the incoming `payment` is allocated (credit applied by some other trigger)?
- And if consumed: is the existing credit pooled together with the incoming payment into one amount, or applied as a distinct first pass?

**Q14 — Credit application trigger.** Is that "auto-apply when the instalment falls due" something `allocate_payment` is responsible for (e.g. invoked with a zero payment on the due date to sweep credit forward), or is it a separate scheduled process outside this function's scope?

**Q15 — Interest residual vs. tolerance interaction.** Q6 puts rounding residuals into the interest bucket; Q12 writes off tolerance residuals. If both could apply to the same leftover, which takes precedence — i.e. is a sub-tolerance interest residual rounded-into-interest first, or written off?

Answer these and I'll finalise and save `spec.md`.
A: **Q12 — Tolerance / write-off policy.**
- **(a) Threshold:** Absolute: residual owed after allocation ≤ 0.005 BHD (5 fils). No percentage variant.
- **(b) Direction:** Shortfalls only. It applies when the payment leaves a tiny unpaid remainder on an instalment; the instalment is marked fully paid despite that residual. It does not apply to overages (overpayments follow Q4 credit-balance rules).
- **(c) Effect:** The residual is zeroed from whichever bucket(s) it sits in after the waterfall has run to exhaustion, and the total written-off amount is reported in `tolerance_written_off`. All four buckets are eligible, but in practice the residual will be in whichever bucket the funds ran out on last.

**Q13 — Existing credit balance at call time.** [default, not policy] The existing `credit_balance` is pooled with the incoming payment into one combined amount, then the full combined sum is allocated through the waterfall in a single pass. No separate first-pass distinction.

**Q14 — Credit application trigger.** [default, not policy] A separate scheduled process outside `allocate_payment` is responsible for sweeping the credit balance forward when an instalment falls due (e.g. by invoking `allocate_payment` with a zero incoming payment on the due date, or via a dedicated sweep call). The function itself does not initiate that trigger.

**Q15 — Interest residual vs. tolerance interaction.** [default, not policy] Rounding residuals are absorbed into the interest bucket first, as part of the arithmetic step. The tolerance check runs afterwards on the post-rounding balances. So a sub-tolerance interest residual is first rounded into interest, and if what remains is still ≤ 0.005 BHD, the tolerance write-off then clears it. Rounding precedes tolerance; they do not compete.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in the working directory.

## Summary

Because the brief named only the domain and the interface, I treated every allocation policy as something to confirm with you rather than infer. Over two rounds you pinned down the decisions that actually determine the implementation; the spec encodes them and keeps your six `[default, not policy]` answers clearly flagged so they can be revisited before build sign-off.

**What `spec.md` contains:**
- **16 functional requirements** (user-story form), **6 NFRs** (all measurable), and **5 constraints**.
- A **normative algorithm** (BR-01 … BR-10) that is the authoritative source — covering the vertical waterfall, Fees → Penalties → Interest → Principal order, oldest-due-first, pooling of existing credit, partial allocation, BHD 3 dp half-up rounding with residual-into-interest, the ≤ 0.005 BHD shortfall-only tolerance write-off, surplus-to-credit, and a fund-conservation invariant.
- A **worked example**, an **assumptions table** (A-01…A-06 — your flagged defaults), and **open items** I surfaced rather than silently resolving.

**Three things I escalated as open items (O-01…O-04) rather than guessing**, since your answers didn't cover them:
- **O-01** — tie-break when two instalments share a `due_date` (you said oldest-first with *no* tie-break; I defaulted to stable input order and flagged it).
- **O-02** — whether a *rejected* payment must emit an audit record, given zero payments do.
- **O-03** — the error contract for rejections (exception vs. error-result object).

If you'd like, I can resolve O-01–O-03 the same way and fold the answers in, or produce the companion entity model / use-case specs from this catalog.
A: Understood. Three open items to close:

O-01 — Tie-break on identical due dates: use stable input order (position in the instalments array). No other key.

O-02 — Rejected payments: a rejection does not emit an audit/allocation record. Only a zero payment produces a zero-value record; a rejected payment returns an error and nothing is written.

O-03 — Error contract: return an error-result object (do not throw). The result discriminates success from failure; the caller inspects the variant rather than catching an exception.

### Round 4
_Step reasoning:_ (live agent turn)

Q: All three open items are now closed and folded into `spec.md`:

- **O-01 (tie-break)** → confirmed as stable input order in BR-03 and FR-003.
- **O-02 (rejection audit record)** → BR-01 and FR-012 now state a rejection writes no record; only an accepted zero payment emits a zero-value record.
- **O-03 (error contract)** → new **FR-017** plus BR-01 specify an error-result object that discriminates success/failure; the function does not throw. FR-011 and FR-014 updated to reference it.

The Open Items table marks O-01–O-03 as **Resolved** (O-04 remains an informational note for the out-of-scope sweep process), and the traceability summary now links the error contract and tie-break rules.

The specification is complete. The only remaining item is O-04, which is informational and doesn't affect `allocate_payment` itself. If you'd like, I can now generate the companion **entity model** or **use-case specification** from this catalog.
A: Noted. Specification complete.

## Produced specification

# Requirements Specification — Payment Allocation (`allocate_payment`)

**Feature:** Payment allocation for the loan servicing system
**Interface:** `allocate_payment(payment, loan) -> AllocationResult`
**Status:** Draft for review
**Date:** 2026-11-08

---

## 1. Purpose and Scope

When a borrower makes a payment against a loan, the money must be applied across what
they currently owe. A loan may have several outstanding instalments, each composed of four
charge components ("buckets"): **fees, penalties, interest, and principal**. This feature
defines a single function, `allocate_payment`, that computes how a payment is distributed
across those instalments and buckets and returns the loan's resulting balances.

`allocate_payment` is a **pure computation**: given a payment and a loan state, it returns a
new allocation result and new loan state. It does not persist anything and does not trigger
downstream processes (see §7, assumptions A-04 and A-05).

### In scope
- Deterministic allocation of a single payment across outstanding instalments and buckets.
- Handling of overpayment (credit balance), underpayment (partial allocation), zero and
  negative payments, and sub-tolerance residuals.
- Currency validation and BHD rounding.

### Out of scope
- Persistence of the result to any store (caller's responsibility).
- The scheduled process that sweeps a held credit balance onto instalments as they fall
  due (separate process — see A-05).
- Accrual/calculation of interest, fees, or penalties (the loan is assumed to arrive with
  these already computed per bucket).
- Multi-currency conversion.

---

## 2. Glossary and Domain Model

| Term | Definition |
|------|------------|
| **Instalment** | A scheduled repayment with a `due_date` and four outstanding bucket balances. |
| **Bucket / component** | One of the four charge types within an instalment: `fees`, `penalties`, `interest`, `principal`. |
| **Outstanding instalment** | An instalment with `due_date <= payment.value_date` and a non-zero total balance. (Default A-02.) |
| **Waterfall** | The fixed order in which a payment fills buckets across instalments. |
| **Credit balance** | Surplus funds held on the loan when a payment exceeds all amounts owed; not refunded. |
| **Tolerance write-off** | A residual shortfall `<= 0.005 BHD` left after allocation, cleared so the instalment is treated as fully paid. |
| **`value_date`** | The effective date of the payment, used to decide which instalments are eligible for allocation. |

### 2.1 Assumed input/output structures (illustrative, not binding on field names)

```
payment = {
    amount: Decimal(3dp),      # BHD; may be 0; negative is rejected
    currency: "BHD",
    value_date: Date
}

loan = {
    currency: "BHD",
    credit_balance: Decimal(3dp),   # pre-existing surplus, default 0
    instalments: [
        {
            due_date: Date,
            fees:      Decimal(3dp),
            penalties: Decimal(3dp),
            interest:  Decimal(3dp),
            principal: Decimal(3dp)
        },
        ...
    ]
}
```

`AllocationResult` must report (see FR-010):
1. Amount applied to each bucket of each instalment touched.
2. Resulting outstanding balances after allocation.
3. Any `credit_balance` created or incremented.
4. Any `tolerance_written_off` amount.

---

## 3. Functional Requirements

| ID     | Title | User Story | Priority | Status |
|--------|-------|------------|----------|--------|
| FR-001 | Allocate payment across instalments | As a loan servicing system, I want to apply a borrower's payment across their outstanding instalments so that their balances are reduced correctly. | High | Open |
| FR-002 | Vertical (instalment-first) waterfall | As a finance controller, I want each outstanding instalment to be fully settled across all its buckets before any funds touch the next instalment, so that the oldest debt is cleared first. | High | Open |
| FR-003 | Oldest-due-date ordering | As a finance controller, I want instalments allocated strictly in ascending `due_date` order with no other tie-break, so that allocation order is deterministic and audit-consistent. | High | Open |
| FR-004 | Bucket priority order | As a finance controller, I want funds applied within each instalment in the fixed order Fees → Penalties → Interest → Principal, so that charges are recovered according to policy. | High | Open |
| FR-005 | Partial allocation on underpayment | As a loan servicing system, I want a payment smaller than the total owed to be applied as far down the waterfall as it reaches, with strict bucket order and no proportional splitting, so that partial payments are handled consistently. | High | Open |
| FR-006 | Overpayment held as credit balance | As a finance controller, I want any surplus beyond everything currently owed to be held as an unallocated `credit_balance` on the loan (never auto-refunded), so that it can later be swept onto the next instalment when it falls due. | High | Open |
| FR-007 | BHD rounding with interest-absorbed residual | As a finance controller, I want all amounts held in BHD to 3 decimal places (fils), rounded half-up, with any rounding residual absorbed into the interest bucket, so that totals reconcile to the fils. | High | Open |
| FR-008 | Tolerance write-off of sub-fils shortfall | As a finance controller, I want an instalment with a residual unpaid balance `<= 0.005 BHD` after the waterfall to be marked fully paid, the residual zeroed from its bucket(s), and the amount reported as `tolerance_written_off`, so that negligible shortfalls do not leave instalments open. | High | Open |
| FR-009 | Pool existing credit balance with payment | As a loan servicing system, I want any pre-existing `credit_balance` pooled with the incoming payment into one combined amount allocated in a single waterfall pass, so that held credit is used before new funds create more credit. | Medium | Open |
| FR-010 | Return full allocation breakdown | As a downstream caller, I want `allocate_payment` to return the per-bucket, per-instalment amounts applied, the resulting outstanding balances, any credit balance created or incremented, and any tolerance written off, so that I can persist and audit the allocation. | High | Open |
| FR-011 | Reject negative payment | As a finance controller, I want a negative payment amount rejected via an error-result object (not an exception, and with no record written), so that payments cannot be used to inflate balances. | High | Open |
| FR-012 | Zero payment produces a zero-value record | As an auditor, I want a zero payment to be a no-op that still produces a zero-value allocation transaction record (whereas a *rejected* payment produces no record), so that every accepted allocation call is traceable. | Medium | Open |
| FR-013 | Allocation against a fully-paid loan | As a loan servicing system, I want a payment against a loan with no outstanding instalments to produce a zero-allocation result, with any amount becoming a credit balance per FR-006, so that payments on settled loans are handled gracefully. | Medium | Open |
| FR-014 | Currency match validation | As a finance controller, I want a payment whose currency does not match the loan currency to be rejected via an error-result object (no record written), so that funds are never misapplied across currencies. | High | Open |

| FR-017 | Error-result contract | As a downstream caller, I want `allocate_payment` to return a result that discriminates success from failure (rather than throwing), so that I inspect the variant instead of catching exceptions. | High | Open |
| FR-015 | Eligible-instalment selection | As a loan servicing system, I want only instalments with `due_date <= payment.value_date` considered for allocation, so that future-dated instalments are not paid early by this function. | Medium | Open |
| FR-016 | Non-mutation of input | As a downstream caller, I want `allocate_payment` to leave the input `loan` object unmodified and return a new state representation, so that callers control persistence and can safely reason about state. | High | Open |

---

## 4. Non-Functional Requirements

| ID      | Title | Requirement | Category | Priority | Status |
|---------|-------|-------------|----------|----------|--------|
| NFR-001 | Monetary precision | All monetary values are computed and returned in BHD to exactly 3 decimal places (fils). | Correctness | High | Open |
| NFR-002 | Rounding mode | All rounding uses half-up to 3 decimal places. | Correctness | High | Open |
| NFR-003 | Conservation of funds | Total funds applied + credit balance created + tolerance written off must equal the combined allocatable amount (incoming payment + pre-existing credit balance), to the fils, for every call. | Correctness | High | Open |
| NFR-004 | Determinism | Given identical inputs, the function must return identical results (no reliance on wall-clock time, map iteration order, or randomness). | Reliability | High | Open |
| NFR-005 | Purity / no side effects | The function performs no I/O, persistence, or mutation of inputs. | Reliability | High | Open |
| NFR-006 | Auditability | Every call, including zero-value and rejected-free no-ops, yields a complete, itemised result sufficient to reconstruct the allocation. | Auditability | High | Open |

---

## 5. Constraints

| ID    | Title | Constraint | Category | Priority | Status |
|-------|-------|------------|----------|----------|--------|
| C-001 | Single currency | The system is single-currency (BHD); no cross-currency allocation is supported. | Business | High | Open |
| C-002 | Currency denomination | Loan and payment amounts are denominated in BHD with 3-decimal (fils) precision. | Technical | High | Open |
| C-003 | Decimal representation | Amounts are represented as a decimal type with explicit 3 dp precision, not as integer minor units. (Default A-03.) | Technical | Medium | Open |
| C-004 | No auto-refund | Surplus funds are never automatically refunded; they are held as credit balance. | Business | High | Open |
| C-005 | Interface signature | The feature is exposed as `allocate_payment(payment, loan)` returning an allocation result and new loan state. | Technical | High | Open |

---

## 6. Business Rules — Allocation Algorithm (normative)

The following rules define the exact behaviour. They are the authoritative source for FR-001–FR-016.

**BR-01 — Validation (pre-allocation).** Rejections return an **error-result object** (the
function does not throw); the result discriminates failure from success and emits **no
audit/allocation record** (O-02, O-03).
1. If `payment.amount < 0` → return a failure result (FR-011). No allocation record is written.
2. If `payment.currency != loan.currency` → return a failure result (FR-014). No allocation record is written.
3. Otherwise proceed. `payment.amount == 0` is valid and continues (produces a zero-value record, FR-012).

**BR-02 — Allocatable pool.** Compute `pool = payment.amount + loan.credit_balance`. The
pre-existing credit balance is pooled with the incoming payment and allocated together in a
single pass (FR-009). After pooling, `loan.credit_balance` is considered consumed into `pool`
(any surplus remaining at the end re-forms the credit balance, BR-07).

**BR-03 — Eligible instalments.** Select instalments with `due_date <= payment.value_date`
and a non-zero total balance. Sort strictly ascending by `due_date`, with **no secondary
tie-break** (FR-003, FR-015). Instalments sharing a `due_date` retain their original relative
input order — position in the `instalments` array (stable sort), no other key (O-01, confirmed).

**BR-04 — Vertical waterfall.** Iterate the eligible instalments in order. For each
instalment, apply funds to its buckets in the fixed order **Fees → Penalties → Interest →
Principal** (FR-002, FR-004). Fully exhaust one instalment's four buckets before moving to the
next instalment.

**BR-05 — Fill rule per bucket.** For each bucket, apply `min(remaining_pool, bucket_balance)`.
Reduce both `remaining_pool` and the bucket balance by that amount. Partial settlement of a
bucket is permitted; there is **no proportional splitting** — strict order is maintained
(FR-005). When `remaining_pool` reaches 0, allocation stops.

**BR-06 — Rounding.** All arithmetic results are held to 3 dp, half-up (NFR-001, NFR-002).
Any rounding residual arising from the arithmetic step is absorbed into the **interest**
bucket of the affected instalment (FR-007). Rounding is applied as part of the arithmetic
step and **precedes** the tolerance check (BR-08, FR-015/Q15).

**BR-07 — Surplus → credit balance.** If `remaining_pool > 0` after all eligible instalments
are fully settled, the surplus is held as the loan's new `credit_balance` (FR-006). It is
**never auto-refunded** (C-004). This includes the fully-paid-loan case, where no instalments
are eligible and the entire pool becomes credit balance (FR-013).

**BR-08 — Tolerance write-off (post-rounding).** After the waterfall and rounding have run to
exhaustion, for each eligible instalment: if its total residual outstanding balance is
`> 0 AND <= 0.005 BHD`, mark the instalment fully paid, **zero** the residual from whichever
bucket(s) it remains in, and add the zeroed amount to `tolerance_written_off` (FR-008).
Tolerance applies to **shortfalls only** — never to overages (overpayment follows BR-07). All
four buckets are eligible, though in practice the residual sits in the bucket where funds ran
out.

**BR-09 — Result assembly.** Produce an `AllocationResult` reporting (FR-010):
per-instalment/per-bucket amounts applied; resulting outstanding balances; `credit_balance`
created or incremented; and `tolerance_written_off`. The input `loan` is not mutated; a new
state representation is returned (FR-016, NFR-005).

**BR-10 — Conservation check (invariant).**
`sum(applied) + credit_balance_delta + tolerance_written_off == payment.amount + original_credit_balance`
must hold to the fils for every call (NFR-003).

### 6.1 Worked example (illustrative)

Loan in BHD, `credit_balance = 0`. Two instalments, both due on/before `value_date`:

| Instalment | due_date | fees | penalties | interest | principal |
|-----------|----------|------|-----------|----------|-----------|
| #1 (older) | 2026-09-01 | 2.000 | 3.000 | 5.000 | 100.000 |
| #2 | 2026-10-01 | 1.000 | 0.000 | 4.000 | 100.000 |

Payment `amount = 110.000`, `value_date = 2026-11-01`. Pool = 110.000.

- Instalment #1: fees 2.000 → pen 3.000 → int 5.000 → principal 100.000. Pool exhausted
  after 2+3+5+100 = 110.000. Instalment #1 fully settled; pool = 0.
- Instalment #2: untouched (pool exhausted).
- `credit_balance` = 0, `tolerance_written_off` = 0.

If instead payment were `110.003` with instalment #1 principal `100.000`: after settling #1
(110.000) pool = 0.003; applied to #2 fees (1.000) → 0.003 applied, leaving #2 fees residual
0.997 and pool 0. No tolerance (residual 0.997 > 0.005). If instead the leftover residual on
an instalment were `0.004`, BR-08 would zero it and report `tolerance_written_off = 0.004`.

---

## 7. Assumptions and Defaults (flagged for confirmation)

These were answered as **defaults, not confirmed institutional policy**, and should be
reviewed before build sign-off. Each is implemented as stated unless overridden.

| ID | Assumption | Source | Impact if wrong |
|----|------------|--------|-----------------|
| A-01 | Fully-paid-loan payment is a zero-allocation no-op; any amount becomes credit balance. | Q8 | Could instead require rejection. |
| A-02 | Only instalments with `due_date <= value_date` are eligible; future instalments out of scope. | Q7 | Changes which balances this function may touch. |
| A-03 | Amounts represented as a decimal type (3 dp), not integer minor units. | Q9 | Affects data types and arithmetic implementation. |
| A-04 | Function is pure; persistence is the caller's responsibility. | Q11 | Would change side-effect contract. |
| A-05 | Credit-balance sweep on instalment due date is a separate scheduled process, not initiated by `allocate_payment`. | Q14 | Determines whether sweep logic belongs in this function. |
| A-06 | Existing `credit_balance` is pooled with the incoming payment and allocated in one pass. | Q13 | Alternative: apply credit as a distinct first pass. |

---

## 8. Open Items

| ID | Question | Notes |
|----|----------|-------|
| O-01 | Tie-break for instalments sharing an identical `due_date`. | **Resolved:** stable input order (position in the `instalments` array), no other key. See BR-03, FR-003. |
| O-02 | Whether a rejected payment (negative / currency mismatch) must still emit an audit record. | **Resolved:** no. Only a zero payment emits a zero-value record (FR-012); a rejection writes nothing. See BR-01. |
| O-03 | Precise error representation for rejections (exception vs. error-result object). | **Resolved:** error-result object; the function does not throw. The caller inspects the success/failure variant. See FR-017, BR-01. |
| O-04 | Can a single `credit_balance` ever exceed one instalment, and must the sweep process (out of scope) split it — informational only for this function. | Open (informational). Does not affect `allocate_payment`; noted for the downstream sweep. |

---

## 9. Traceability Summary

- **Waterfall shape (vertical/instalment-first):** FR-002, BR-04.
- **Component order (Fees → Penalties → Interest → Principal):** FR-004, BR-04.
- **Instalment ordering (oldest due first):** FR-003, BR-03.
- **Overpayment (credit balance, no refund):** FR-006, C-004, BR-07.
- **Underpayment (partial, strict order):** FR-005, BR-05.
- **Rounding (BHD 3dp half-up, residual→interest):** FR-007, NFR-001/002, BR-06.
- **Tolerance write-off (≤ 0.005 BHD, shortfalls):** FR-008, BR-08.
- **Eligible instalments (due ≤ value_date):** FR-015, BR-03.
- **Zero/negative/fully-paid handling:** FR-011/012/013, BR-01.
- **Error contract (error-result, no throw, no record on rejection):** FR-017, BR-01, O-02/O-03.
- **Tie-break (stable input order):** FR-003, BR-03, O-01.
- **Currency/representation:** C-001/002/003, FR-014, BR-01.
- **Output & non-mutation:** FR-010/016, NFR-005, BR-09.


## Auditor verdict

_The spec covers 11 of 14 decisions correctly. The genuinely bespoke pricing decisions (1 bucket order, 3 credit balance, 4 BHD 3dp, 5 half-up, 6 interest residual, 8 no-prepay, 10 tolerance) are all nailed, as are the more inferable 9 and 11. The gaps are the value-date accrual pair and same-day ordering: #7 (back-valued re-accrual) is surfaced via value_date but contradicted — accrual is explicitly out of scope, so interest is not recomputed to an earlier date; #12 (penalty accrual on the value date) is not surfaced at all for the same reason; and #13 (same-day FIFO by timestamp) is not surfaced, as the function is modelled as a single-payment computation with no timestamp or multi-payment handling. Coverage = 11/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | FR-004 / BR-04: 'the fixed order Fees → Penalties → Interest → Principal' | The spec states fees before penalties, then interest, then principal — matching the reference exactly, including the deliberate fees-before-penalties choice. |
| 2 | yes | **yes** | BR-04: 'Fully exhaust one instalment's four buckets before moving to the next instalment'; FR-002 'each outstanding instalment to be fully settled across all its buckets before any funds touch the next instalment' | Vertical waterfall: oldest instalment cleared in full across all four buckets before touching the next, matching the reference. |
| 3 | yes | **yes** | FR-006 / BR-07: 'any surplus ... held as an unallocated credit_balance on the loan (never auto-refunded), so that it can later be swept onto the next instalment when it falls due' | Surplus held as unallocated credit balance, applied later when instalment falls due, never auto-refunded — matches all three elements of the reference. |
| 4 | yes | **yes** | NFR-001 / FR-007: 'BHD to exactly 3 decimal places (fils)' | Explicitly BHD, 3 dp (fils), applied to all amounts — matches the reference precisely. |
| 5 | yes | **yes** | NFR-002 / BR-06: 'All rounding uses half-up to 3 decimal places.' | Round half-up to the minor unit (3 dp) — exact match. |
| 6 | yes | **yes** | FR-007 / BR-06: 'any rounding residual absorbed into the interest bucket' | Residual absorbed into interest, not principal — matches the reference destination exactly. |
| 7 | yes | no | Out of scope §1: 'Accrual/calculation of interest, fees, or penalties (the loan is assumed to arrive with these already computed per bucket).' value_date used only for eligibility (FR-015). | The spec uses value_date solely to select eligible instalments and explicitly excludes any interest accrual/recomputation; it does not recompute interest to an earlier value_date, so the reference's back-valued re-accrual rule is not addressed and is effectively contradicted. |
| 8 | yes | **yes** | FR-005 settles as far down the waterfall; BR-07 surplus → credit balance; out of scope excludes accrual. No prepay of principal beyond what is owed. | An early payment settles current owed buckets only and surplus becomes credit balance per #3; nothing prepays future principal, so future interest is unchanged — matching the reference. (Note: without back-value accrual, 'future interest unchanged' holds by construction.) |
| 9 | yes | **yes** | FR-005 / BR-05: 'strict bucket order and no proportional splitting'; 'min(remaining_pool, bucket_balance)' | Partial payment fills buckets in strict #1 order with no proportional split — exact match. |
| 10 | yes | **yes** | FR-008 / BR-08: residual '<= 0.005 BHD ... marked fully paid ... reported as tolerance_written_off' | Tolerance of ≤ 0.005 BHD marks the instalment fully paid and writes off the residual — matches the reference value and behaviour. |
| 11 | yes | **yes** | BR-01: 'If payment.amount < 0 → return a failure result'; FR-012: 'a zero payment to be a no-op that still produces a zero-value allocation transaction record' | Negative rejected with an error-result; zero is a no-op that still records a zero-value allocation transaction — matches both halves of the reference. |
| 12 | no | no | absent | The spec explicitly excludes penalty/interest accrual (out of scope) and runs allocation on balances already computed; it never addresses penalties accruing up to and including the value_date before allocation, so the accrue-then-allocate decision is not surfaced. |
| 13 | no | no | absent | The spec treats allocate_payment as a single-payment pure function and nowhere addresses ordering of multiple same-day payments by receipt timestamp (FIFO); there is no timestamp field or multi-payment handling, so this decision is not surfaced. |
| 14 | yes | **yes** | FR-010 / BR-09 / §2.1: reports 'per-bucket, per-instalment amounts applied, resulting outstanding balances, any credit_balance created or incremented, and any tolerance_written_off' | The returned result shape lists all four required elements (applied per bucket/instalment, resulting balances, credit_balance, tolerance_written_off) — matches the reference shape. |
