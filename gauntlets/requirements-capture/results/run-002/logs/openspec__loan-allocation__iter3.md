# openspec — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 7 · Captured: 10/14 · Bespoke captured: 4/8

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured prompt was dismissed. No problem — I'll ask in plain text so you can answer however you like. These are the policy decisions I can't infer from the brief, and getting them wrong would make the implementation wrong. Here are the ones that most affect the outcome:

**1. Allocation order across instalments.** When a payment spans several outstanding instalments, which takes precedence?
- (a) **Oldest instalment first** — fully settle the oldest instalment (all its components) before touching the next; or
- (b) **Component-type first** — clear one component across *all* instalments before the next (e.g. all penalties everywhere → all fees → all interest → all principal); or
- (c) some hybrid.

**2. Component priority within scope.** In what order are the four components paid down — e.g. penalties → fees → interest → principal, or some other order?

**3. Overpayment.** If the payment exceeds everything currently owed, do you (a) return the leftover as unapplied excess, (b) prepay future instalments, (c) curtail outstanding principal, or (d) reject it?

**4. Money & rounding.** Are amounts integer minor units (cents, exact — no rounding), or decimals with a rounding rule (half-up / banker's) to 2dp?

And a second tier I'll also need, but tell me if you'd rather I take sensible defaults:

**5. Eligible instalments.** Does allocation only touch *due/overdue* instalments, or also *not-yet-due* future ones?

**6. Partial payment.** If a payment can't fully cover a component, is it applied partially (leaving a remainder), and is there any minimum-payment rule or tie-break between instalments of the same age?

**7. Input validation.** How should zero, negative, or non-numeric payments be handled?

Answer whichever you can — even "use your best judgment on 4–7" is a fine answer — and I'll fold the decisions into the spec.
A: Here are the policy decisions for each point:

**1. Allocation order across instalments:** Option (a) — oldest instalment first. Clear all four components of the oldest instalment in full before any money touches the next.

**2. Component priority within an instalment:** Fees, then penalties, then interest, then principal. Note: fees come before penalties.

**3. Overpayment:** Surplus is held as an unallocated credit balance and auto-applied to the next instalment when it falls due. It is never auto-refunded and does not prepay future principal or affect future interest accrual.

**4. Money and rounding:** The loan currency is BHD (Bahraini Dinar), which has 3 decimal places (fils). All amounts are stored and rounded to 3 dp using half-up rounding. Rounding residuals are absorbed into the interest component.

**5. Eligible instalments:** Allocation touches only due or overdue instalments. An on-time or early payment with surplus settles the current instalment only; the remainder becomes a credit balance per rule 3.

**6. Partial payment:** Strict bucket order — fill each component in sequence; no proportional split. No minimum-payment rule. One tolerance rule applies: if the residual owed after allocation is ≤ 0.005 BHD, the instalment is marked fully paid and the residual written off.

**7. Input validation:** Negative payments are rejected with an error. A zero payment is a no-op but still records a zero-value allocation transaction.

### Round 2
_Step reasoning:_ (live agent turn)

Q: It is done.

The specification is saved as **`spec.md`** in this directory, with the complete, stakeholder-confirmed payment-allocation policy. I resolved every material decision by asking you rather than guessing — the brief deliberately omitted them and they weren't safely inferable.

**The policy captured:**
- **Ordering** — oldest instalment first (settle in full), then **fees → penalties → interest → principal** within each
- **Scope** — due/overdue instalments only; future instalments never touched
- **Surplus** — held as an unallocated credit balance; never refunded, never prepays principal, never affects accrual
- **Money** — BHD, 3 dp (fils), half-up; rounding residual absorbed into interest
- **Tolerance** — residual ≤ 0.005 BHD → instalment marked fully paid, residual written off
- **Validation** — negative rejected; zero is a no-op that still records a zero-value transaction

Two genuinely-open details I defaulted and flagged as **[assumption]** in the spec (neither changes the rules above): how a *pre-existing* credit balance combines with the new payment (I chose credit-first, then payment), and where a rounding residual goes when an instalment has no interest line (next in order → principal). Tell me if you'd like either changed.

**Also created** — the full OpenSpec planning artifacts under `openspec/changes/add-payment-allocation/` (proposal, behavioral spec delta with testable WHEN/THEN scenarios, design, tasks); the change validates clean and all 4 artifacts are complete.

Per the planning boundary, I've stopped here and written no implementation code. When you're ready to build it, run `/opsx:apply`.
A: Confirmed. The two defaults (credit-first ordering, residual-to-principal fallback) are acceptable.

## Produced specification

# Specification — Payment Allocation

Function: `allocate_payment(payment, loan)`

Applies a single borrower payment across what is currently owed on a loan and returns
how the payment was applied plus the loan's updated balances. Pure and deterministic:
the input `loan` is not mutated, and equal inputs always produce equal results.

All policy decisions below were confirmed with the product stakeholder. Where the brief
left a detail genuinely open, the chosen default is marked **[assumption]**.

---

## 1. Inputs and output

- **Input `payment`**: a single monetary amount in BHD.
- **Input `loan`**: outstanding instalments, each with four components — fees, penalties,
  interest, principal — plus a due date; and any pre-existing unallocated credit balance.
- **Output**: an object containing
  - a per-instalment, per-component **allocation breakdown** (how the payment was applied),
  - the loan's **updated instalment balances**,
  - the resulting **unallocated credit balance**,
  - an **allocation transaction** record (always present, even for a zero payment).

## 2. Ordering

1. **Across instalments — oldest first.** Fully settle the oldest eligible instalment
   (all four components) before any money touches the next. Instalments are ordered by
   due date, oldest first.
2. **Within an instalment — strict bucket order:** **fees → penalties → interest →
   principal.** (Note: fees come **before** penalties.) Each component is filled to zero
   before the next begins. No proportional split.
3. If the payment is exhausted part-way through a component, that component is reduced by
   the remaining amount and no later component or instalment receives anything.

## 3. Eligible instalments

- Only **due or overdue** instalments are eligible.
- **Not-yet-due (future) instalments are never touched**, even for an on-time or early
  payment. An early/on-time payment settles the current (due) instalment only; any
  remainder becomes a credit balance (see §5).

## 4. Money and rounding (BHD)

- Currency is **BHD (Bahraini Dinar), 3 decimal places (fils)**.
- All amounts are stored and rounded to **3 dp using half-up rounding**.
- Any rounding **residual is absorbed into the instalment's interest component**, keeping
  the instalment's components consistent with its total.
  **[assumption]** If an instalment has no interest component, the residual is absorbed
  into the next component in bucket order (principal).

## 5. Surplus / credit balance

- Any amount left after all **eligible** instalments are fully settled is held as an
  **unallocated credit balance** on the loan.
- The credit balance is **never auto-refunded**, does **not** prepay future instalment
  principal, and does **not** affect future interest accrual. It is auto-applied to the
  next instalment when that instalment falls due (handled by a separate instalment-due
  process, not by this function).
- **[assumption]** A pre-existing unallocated credit balance is treated as available
  alongside the incoming payment and applied **credit-first, then payment** against the
  eligible instalments; the leftover becomes the new credit balance. (Flagged for
  confirmation; does not alter any rule above.)

## 6. Settlement write-off tolerance

- After allocation, if an instalment's residual owed is **≤ 0.005 BHD** (and > 0), the
  instalment is **marked fully paid and the residual written off**.
- A residual **above 0.005 BHD** is retained; the instalment is not fully paid.

## 7. Validation

- **Negative payment** (`payment < 0`): **rejected with an error**; nothing is applied,
  no balance changes.
- **Zero payment** (`payment == 0`): **no-op**, but still records a **zero-value
  allocation transaction** in the result.

---

## Worked rules summary (quick reference)

| Decision | Policy |
| --- | --- |
| Across instalments | Oldest instalment first, settle in full before next |
| Within instalment | Fees → Penalties → Interest → Principal (strict, no split) |
| Scope | Due/overdue only; future instalments never touched |
| Surplus | Held as unallocated credit; never refunded/prepaid/accrued |
| Currency | BHD, 3 dp (fils), half-up rounding |
| Rounding residual | Absorbed into interest component |
| Write-off tolerance | Residual ≤ 0.005 BHD → instalment fully paid, residual written off |
| Negative payment | Rejected with error |
| Zero payment | No-op; records a zero-value allocation transaction |

---

*The full OpenSpec planning artifacts for this change (proposal, behavioral spec delta
with testable scenarios, design, and tasks) live under
`openspec/changes/add-payment-allocation/`.*


## Auditor verdict

_The spec correctly resolves 10 of 14 decisions (1, 2, 3, 4, 5, 6, 8, 9, 10, 11), including the genuinely bespoke ones around bucket order, credit-balance handling, BHD precision, residual destination, and write-off tolerance. It misses the value-date/back-valued recomputation (7), penalty accrual-before-allocation timing (12), and same-day FIFO ordering (13) entirely, and its returned result shape (14) omits the required tolerance_written_off element. Coverage = 10/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §2.2: "fees → penalties → interest → principal. (Note: fees come before penalties.)" | Spec states the exact bucket order, explicitly flagging fees before penalties, matching the reference deliberately-non-default order. |
| 2 | yes | **yes** | §2.1: "Fully settle the oldest eligible instalment (all four components) before any money touches the next." | Matches reference: oldest instalment cleared fully across all buckets before the next receives anything. |
| 3 | yes | **yes** | §5: "held as an unallocated credit balance", "never auto-refunded", "auto-applied to the next instalment when that instalment falls due". | All three elements of the reference answer are stated: credit balance, auto-apply at next due, no auto-refund. |
| 4 | yes | **yes** | §4: "BHD (Bahraini Dinar), 3 decimal places (fils)". | Exact currency and 3-dp minor unit match the reference. |
| 5 | yes | **yes** | §4: "rounded to 3 dp using half-up rounding". | Half-up to the 3-dp minor unit matches the reference rounding method. |
| 6 | yes | **yes** | §4: "rounding residual is absorbed into the instalment's interest component". | Primary rule matches the reference (residual to interest); the added no-interest fallback is a flagged assumption that does not contradict the reference. |
| 7 | no | no | absent | Spec never mentions value_date, back-valued payments, or recomputing/re-accruing interest to an earlier date; the input is only "a single monetary amount". |
| 8 | yes | **yes** | §3: "An early/on-time payment settles the current (due) instalment only; any remainder becomes a credit balance"; §5: "does not prepay future instalment principal, and does not affect future interest accrual". | Matches reference: current instalment only, surplus to credit balance, no principal prepayment, future interest unchanged. |
| 9 | yes | **yes** | §2.2: "No proportional split"; §2.3: component reduced by remaining amount, no later component receives anything. | Strict in-order filling with explicit no-proportional-split matches the reference. |
| 10 | yes | **yes** | §6: "if an instalment's residual owed is ≤ 0.005 BHD (and > 0), the instalment is marked fully paid and the residual written off". | Threshold value, full-paid marking, and write-off all match the reference tolerance exactly. |
| 11 | yes | **yes** | §7: "Negative payment ... rejected with an error"; "Zero payment ... no-op, but still records a zero-value allocation transaction". | Both behaviours match the reference: negative rejected, zero is a no-op that still records a zero-value transaction. |
| 12 | no | no | absent | Spec says nothing about penalties accruing up to the value/allocation date before allocation runs; no accrual timing for penalties is addressed. |
| 13 | no | no | absent | The function handles a single payment and the spec never addresses multiple same-day payments or FIFO-by-timestamp ordering. |
| 14 | yes | no | §1 output: "allocation breakdown", "updated instalment balances", "resulting unallocated credit balance", "an allocation transaction record". | Three of the four required elements are present, but the result shape omits an explicit tolerance_written_off field (§6 describes the write-off behaviour but it is not listed in the returned object), so the shape does not match the reference literally. |
