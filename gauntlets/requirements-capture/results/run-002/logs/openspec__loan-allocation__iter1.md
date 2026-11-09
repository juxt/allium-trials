# openspec — loan-allocation — iteration 1

Model (author): claude-opus · Questions asked: 11 · Captured: 11/14 · Bespoke captured: 5/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured prompt didn't go through. Let me just ask you directly, in plain text. I need your decisions on the following — these are the institution-specific policies I cannot infer, and getting them right is the whole point.

**1. Component order (within an instalment).** In what order is a payment applied across a single instalment's components?
- (a) Penalties → Fees → Interest → Principal
- (b) Fees → Penalties → Interest → Principal
- (c) Interest → Principal → Fees → Penalties
- (d) Principal first (regulatory/consumer-favourable)
- (e) something else

**2. Instalment sweep (across multiple outstanding instalments).** When more than one instalment is outstanding:
- (a) Instalment-major, oldest first — fully clear the oldest instalment (all its components) before moving to the next
- (b) Component-major, oldest first — sweep one component across all instalments (all penalties oldest→newest, then all fees, then all interest, then all principal)
- (c) Proportional / pro-rata across instalments
- (d) something else

**3. Overpayment.** If the payment exceeds everything currently outstanding, the surplus is:
- (a) held as unapplied/suspense credit
- (b) applied forward to prepay future instalments (interest + principal)
- (c) applied to curtail principal (reduce balance/term)
- (d) rejected/returned
- (e) something else

**4. Underpayment.** If the payment is less than a full instalment's due amount:
- (a) allocate as far as it reaches (partial application down the waterfall)
- (b) hold in suspense until a full instalment accumulates
- (c) reject below a minimum
- (d) something else

**5. Rounding.** What is the money representation and rounding policy? (e.g. integer minor units / cents with no rounding needed; or decimal with round-half-up to 2 dp; and where any residual sub-unit lands.)

Once you answer these, I may have one short follow-up round (edge cases like zero/negative payment, and exactly what the function returns), then I'll write the spec. What are your decisions?
A: 1. **(b) Fees → Penalties → Interest → Principal.** Fees are senior to penalties within a single instalment.

2. **(a) Instalment-major, oldest first.** The oldest overdue instalment must be cleared in full across all four components before any allocation touches the next one.

3. **(a) Held as a credit balance.** Surplus is held as an unallocated credit and auto-applied when the next instalment falls due. It is never auto-refunded.

4. **(a) Allocate as far as it reaches.** Strict waterfall, partial fill per bucket in sequence. No suspense hold, no minimum threshold rejection (though see edge-case policy on zero/negative if you ask in your follow-up round).

5. **Currency is BHD (Bahraini Dinar), minor unit is the fils — 3 decimal places.** All amounts are expressed and rounded to 3 dp using round-half-up. Any sub-unit rounding residual is absorbed into the interest component, not principal.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Thank you — that's clear. One short follow-up round on edge cases and the function's contract, then I'll write the spec.

**6. Zero or negative payment.** How should `allocate_payment` handle a payment of zero, or a negative amount?
- (a) Raise/return an error (reject invalid input)
- (b) Zero → no-op (empty allocation, loan unchanged); negative → error
- (c) something else

**7. Pre-existing credit balance on the loan.** A loan may already carry an unallocated credit balance from a prior overpayment. When `allocate_payment` is called with a new payment, should it:
- (a) Combine the incoming payment with any existing credit balance and run the whole amount through the waterfall
- (b) Only process the incoming payment; the existing credit is left untouched (applied separately when an instalment next falls due)
- (c) something else

**8. What the function returns.** You said it returns "how the payment is applied and the loan's updated balances." To be precise, should the result contain:
- A per-instalment, per-component breakdown of exactly how much was applied to each bucket (fees/penalties/interest/principal)?
- The resulting credit balance (if any surplus)?
- The updated loan with each instalment's remaining component balances?
- Any total "amount applied" / "amount unapplied" summary figures?

Tell me which of these the result must include (and anything I've missed). Also: should the input `loan` be mutated in place, or should the function return a new updated loan and leave the input unchanged?

**9. Rounding residual — when does it arise?** In a strict oldest-first waterfall, allocations are exact subtractions, so no residual normally occurs. The "absorb into interest" rule implies residuals *can* appear. Can an instalment's owed component amounts themselves carry more than 3 dp of precision (e.g. from daily interest accrual), so that `allocate_payment` must round them to 3 dp (half-up) and push the residual into interest? Or are all input amounts guaranteed already at 3 dp? Please confirm where the rounding actually happens.
A: **6.** (b), with one addition: negative is rejected with an error; zero is a no-op but still records a zero-value allocation transaction in the audit trail. The loan state is unchanged by a zero payment.

**7.** (b). The existing credit balance is not combined with the incoming payment. It is left untouched and applied automatically when the next instalment falls due. The new payment is processed independently through the waterfall.

**8.** The result must include: (i) a per-instalment, per-component breakdown of the amount applied to each bucket (fees, penalties, interest, principal); (ii) the resulting outstanding balance for each component of each instalment after allocation; (iii) the credit balance after allocation (zero if none created or held); (iv) any tolerance amount written off and on which instalment. Summary totals (total applied, total unapplied) are not required by policy — derive them from the breakdown if the engineer finds them useful. The function must return a new updated loan object; the input must not be mutated in place.

**9.** Daily interest accrual produces amounts with more than 3 dp of precision, so `allocate_payment` is responsible for rounding each component balance to 3 dp (half-up) before it runs the allocation. The residual from that rounding is absorbed into the interest component of the same instalment. Input amounts are not guaranteed to arrive at exactly 3 dp.

### Round 3
_Step reasoning:_ (live agent turn)

Q: Answer 8 surfaced something I hadn't asked about: a **tolerance write-off**. That's a material policy I need from you before I can write this correctly.

**10. Tolerance write-off policy.**
- (a) What triggers it? E.g. after the waterfall runs, if an instalment's *remaining total* is at or below some threshold, the remainder is written off and the instalment treated as fully satisfied?
- (b) What is the threshold value (in fils / BHD)?
- (c) Which component(s) does the write-off reduce — the remaining balance across all four buckets, or a specific one?
- (d) Does it apply per instalment, or only to the oldest, or only once per payment?
- (e) Does the opposite case exist — if the payment *overshoots* an instalment by within tolerance due to rounding, is that handled too, or is overshoot impossible given the exact-subtraction waterfall?

Once I have this, I'll have everything and will write `spec.md`.
A: **10. Tolerance write-off policy.**

**(a) Trigger:** After the waterfall has run on an instalment, if the remaining total owed across all components is ≤ the threshold, the remainder is written off and the instalment marked fully paid.

**(b) Threshold:** 0.005 BHD (half a fils — i.e. any residual that would round to zero at 3 dp).

**(c) Component reduction:** The write-off clears whatever remains across whichever components still carry a balance. There is no designated single bucket; it zeroes the residual wherever it sits. [The key does not prescribe a specific component order for write-off absorption — treat this as default behaviour unless you have a reason to allocate it differently.]

**(d) Scope:** Per instalment. Each instalment is evaluated independently after the waterfall touches it. It is not limited to the oldest instalment only.

**(e) Overshoot:** Not a defined policy case. Given the exact-subtraction waterfall, overshoot within an instalment is not expected to arise — the waterfall stops when the instalment is cleared and carries any surplus to the next instalment or into the credit balance. No special tolerance case for overshoot is defined. [Default: treat as standard surplus handling per policy 3.]

### Round 4
_Step reasoning:_ (live agent turn)

Q: I have everything except one genuine inconsistency in **10(b)** that I don't want to resolve by guessing, because the two readings differ by 10× and one of them makes the feature a no-op:

You wrote the threshold as **"0.005 BHD (half a fils — i.e. any residual that would round to zero at 3 dp)."** These three don't agree:

- **0.005 BHD = 5 fils.** With this threshold, a remaining instalment total of 1–5 fils is written off.
- **"half a fils" = 0.0005 BHD**, and **"rounds to zero at 3 dp"** means a residual strictly below 0.0005 BHD.
- But per policy **9**, every component balance is already rounded to 3 dp (multiples of 0.001 BHD) *before* the waterfall. So the smallest non-zero remainder is exactly 0.001 BHD (1 fils). A threshold of 0.0005 would then catch *nothing* — the write-off could never fire. Only the literal **0.005 BHD (5 fils)** reading makes the write-off actually do anything.

Which is authoritative?
- (a) Threshold is **0.005 BHD (5 fils)** — write off any remaining instalment total ≤ 5 fils after the waterfall. (The parenthetical wording was loose.)
- (b) Threshold is **0.0005 BHD (half a fils)** — and you accept that, given 3 dp rounding, this effectively only ever zeroes an exact-zero remainder (write-off is a safety net, not a real tolerance).
- (c) something else.

Which do you want?
A: (a). The threshold is 0.005 BHD (5 fils). The parenthetical wording was loose; the literal figure is authoritative.

### Round 5
_Step reasoning:_ (live agent turn)

Q: The specification is done.

**`spec.md` is saved in this directory** — a self-contained specification capturing all ten policy decisions you confirmed. The full OpenSpec planning artifacts are also complete and validate strictly (`--strict`) under `openspec/changes/add-payment-allocation/`:

- **proposal.md** — why/what, and the `payment-allocation` capability
- **specs/payment-allocation/spec.md** — requirement-level contract with WHEN/THEN scenarios (testable)
- **design.md** — implementation approach (exact decimal math, round-once-up-front, single instalment-major pass, purity-by-copy)
- **tasks.md** — dependency-ordered implementation steps with verification each

Every material policy that the brief omitted was resolved by asking you rather than inferred:

1. Component order: **Fees → Penalties → Interest → Principal**
2. Instalment sweep: **instalment-major, oldest-first, cleared in full before the next**
3. Overpayment: **held as unallocated credit, never auto-refunded** (auto-applied at next due date by a separate process)
4. Underpayment: **allocate as far as it reaches; no suspense, no minimum**
5. Money: **BHD, 3 dp, round-half-up; residual → interest**; function rounds inputs before allocating
6. Zero → **audited no-op**; negative → **error**
7. Pre-existing credit: **not combined, untouched**
8. Returns a **new loan** (no mutation) + applied breakdown + remaining balances + credit balance + write-offs
9. Tolerance write-off: **per instalment, ≤ 0.005 BHD (5 fils)** — including resolving the 0.005-vs-"half a fils" contradiction you confirmed

Per the planning boundary, I've stopped at planning and have not written any implementation code. When you're ready to build it, run `/opsx:apply`.
A: Confirmed. The specification is complete and all ten decisions are correctly recorded.

## Produced specification

# Specification — `allocate_payment(payment, loan)`

Payment allocation for the loan servicing system. This specification records the institution's
chosen policies (confirmed with the product stakeholder); it is not a set of defaults. Full OpenSpec
planning artifacts (proposal, requirement-level spec with scenarios, design, tasks) live under
`openspec/changes/add-payment-allocation/`.

## 1. Purpose and interface

`allocate_payment(payment, loan)` applies a single incoming `payment` across the loan's outstanding
instalments and returns how the payment was applied together with the loan's updated balances. Each
instalment has four component balances: **fees, penalties, interest, principal**.

The function is **pure with respect to its input**: it returns a **new** updated loan object and
**must not mutate** the `loan` argument.

## 2. Money and rounding

- **Currency:** Bahraini Dinar (BHD). Minor unit is the fils — **3 decimal places**.
- **Rounding mode:** **round-half-up** to 3 dp.
- **Input precision is not guaranteed.** Daily interest accrual can produce component balances with
  more than 3 dp. Therefore, **before allocating**, `allocate_payment` rounds **each component
  balance** to 3 dp (round-half-up).
- **Rounding residual:** the residual produced by that rounding is **absorbed into the interest
  component of the same instalment**. It is never absorbed into principal.
- All amounts in the returned result are expressed at 3 dp.

## 3. Allocation order

### 3.1 Across instalments — instalment-major, oldest-first

When several instalments are outstanding, the payment is applied **instalment-major, oldest-first**.
The **oldest** outstanding instalment must be **cleared in full across all four components** (subject
to the tolerance write-off in §6) **before any amount touches the next-oldest** instalment. Leftover
after an instalment is carried forward to the next-oldest. No proportional/pro-rata splitting.

### 3.2 Within an instalment — component waterfall

Within a single instalment the order is strictly:

**Fees → Penalties → Interest → Principal**

(Fees are senior to penalties.) Each component is filled as far as the remaining payment allows
before any amount is applied to the next component.

## 4. Shortfall (payment less than total outstanding)

Apply the payment **as far as it reaches** down the instalment-major component waterfall, filling the
bucket where the payment runs out **partially**. There is:

- **No suspense hold** — the payment is applied immediately as far as it goes.
- **No minimum threshold** — a payment is never rejected for failing to cover a full instalment or
  any minimum amount.

## 5. Surplus (payment more than total outstanding)

Any amount remaining after **all** outstanding instalments are cleared is held on the loan as an
**unallocated credit balance**. This function:

- **Does not** auto-apply the surplus to not-yet-due future instalments. (Credit is auto-applied when
  the next instalment falls due — a separate process, outside `allocate_payment`.)
- **Never auto-refunds** the surplus.

### Pre-existing credit balance

A credit balance already on the loan is **not combined** with the incoming payment. The incoming
payment is processed independently through the waterfall; any pre-existing credit remains on the
returned loan untouched (other than surplus newly added by this payment).

## 6. Tolerance write-off (per instalment)

After the waterfall has **touched** an instalment, if that instalment's **remaining total owed across
all components is ≤ 0.005 BHD (5 fils)**, the remainder is **written off** and the instalment marked
**fully paid**.

- **Threshold:** 0.005 BHD, authoritative literal figure (the boundary: ≤ 0.005 written off; > 0.005
  retained).
- **Scope:** evaluated **per instalment**, independently, for every instalment the waterfall touches
  — not limited to the oldest.
- **Absorption:** clears whatever residual remains across whichever components still carry a balance;
  no single designated bucket.
- **Overshoot** within an instalment is not a defined case — the waterfall stops when an instalment is
  cleared and carries any surplus onward per §5.

## 7. Invalid / zero payment

- **Negative payment:** rejected with an **error**; the loan is left unchanged.
- **Zero payment:** a **no-op** — loan state is unchanged — but it **still records a zero-value
  allocation transaction in the audit trail**.

## 8. Auditing

Every call records an **allocation transaction** in the audit trail, including the zero-payment
no-op, so each invocation is traceable.

## 9. Return value

`allocate_payment` returns a result that includes:

1. **Per-instalment, per-component applied breakdown** — how much of the payment was applied to each
   of fees, penalties, interest, principal, for each instalment.
2. **Per-instalment, per-component remaining balances** after allocation.
3. **Credit balance** after allocation (zero if none created or held).
4. **Tolerance write-off(s)** — any amount written off and the instalment it applied to.
5. The **updated loan** object (new object; input not mutated).

Summary totals (total applied, total unapplied) are **not required**; derive them from the breakdown
if useful.

## 10. Worked ordering summary

For each instalment, oldest first, until the payment is exhausted:
1. Round each of the instalment's four component balances to 3 dp (half-up); absorb residual into interest.
2. Apply remaining payment: Fees → Penalties → Interest → Principal (partial fill where it runs out).
3. If the instalment's remaining total ≤ 0.005 BHD, write off the residual and mark it fully paid.
4. Carry any leftover payment to the next-oldest instalment.

After all instalments: any leftover payment becomes (added to) the loan's unallocated credit balance.
Record an allocation transaction either way.


## Auditor verdict

_11/14 correct. The spec matches the reference on bucket order (1), instalment ordering (2), credit-balance/overpayment handling (3, 8), currency precision (4), rounding method and residual (5, 6), strict in-order partial fill (9), tolerance write-off (10), zero/negative handling (11), and result shape (14). The three gaps cluster on value-date mechanics and payment sequencing: back-valued interest recomputation (7) and penalty accrual up to the value date (12) are entirely absent — the spec never introduces value_date — and FIFO-by-timestamp ordering of same-day payments (13) is unaddressed given the single-payment framing. This is consistent with the reference's note that elicitation gaps concentrate on the genuinely bespoke decisions._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §3.2: "Fees → Penalties → Interest → Principal" and "(Fees are senior to penalties.)" | Spec states the exact bucket order with fees ahead of penalties, matching the reference's deliberate non-default ordering. |
| 2 | yes | **yes** | §3.1: "The oldest outstanding instalment must be cleared in full across all four components ... before any amount touches the next-oldest" | Instalment-major, oldest-first with full clearance of all four buckets before moving on matches the reference exactly. |
| 3 | yes | **yes** | §5: "held on the loan as an unallocated credit balance"; "Credit is auto-applied when the next instalment falls due"; "Never auto-refunds the surplus." | All three elements — credit balance, auto-apply at next due, no auto-refund — are present and match. |
| 4 | yes | **yes** | §2: "Bahraini Dinar (BHD). Minor unit is the fils — 3 decimal places." | Correct currency and 3-dp precision stated explicitly. |
| 5 | yes | **yes** | §2: "Rounding mode: round-half-up to 3 dp." | Round half-up to the 3-dp minor unit matches the reference. |
| 6 | yes | **yes** | §2: "the residual ... is absorbed into the interest component of the same instalment. It is never absorbed into principal." | Residual destination is interest, explicitly not principal — matches. |
| 7 | no | no | absent | The spec never mentions value_date, back-valued payments, or recomputing/re-accruing interest to an earlier value date before allocation. |
| 8 | yes | **yes** | §5: surplus "held on the loan as an unallocated credit balance"; "Does not auto-apply the surplus to not-yet-due future instalments." | Any surplus after clearing outstanding instalments becomes credit and is not applied to future instalments, so principal is not prepaid and future interest is unchanged — matching the reference. |
| 9 | yes | **yes** | §4: "filling the bucket where the payment runs out partially"; §3.1: "No proportional/pro-rata splitting." | Strict in-order bucket fill with explicit rejection of proportional splitting matches the reference. |
| 10 | yes | **yes** | §6: "if that instalment's remaining total owed across all components is ≤ 0.005 BHD (5 fils), the remainder is written off and the instalment marked fully paid." | Tolerance threshold (≤ 0.005 BHD), write-off, and mark-paid all match exactly. |
| 11 | yes | **yes** | §7: "Negative payment: rejected with an error"; "Zero payment: a no-op ... but it still records a zero-value allocation transaction" | Negative rejected with error and zero as no-op that still records a zero-value transaction both match. |
| 12 | no | no | absent | The spec's pre-allocation step is rounding component balances (§2, §10 step 1), not accruing penalties up to the value date; penalty accrual timing relative to allocation is never addressed. |
| 13 | no | no | absent | The function is scoped to a single payment and never specifies FIFO-by-receipt-timestamp ordering for multiple same-day payments; the §5 "processed independently" note concerns not combining a credit balance, not inter-payment sequencing. |
| 14 | yes | **yes** | §9: per-component applied breakdown, per-component remaining balances, credit balance, tolerance write-off(s), updated loan | All reference-required fields (per-bucket applied amounts, resulting balances, credit balance created, tolerance written off) are present. |
