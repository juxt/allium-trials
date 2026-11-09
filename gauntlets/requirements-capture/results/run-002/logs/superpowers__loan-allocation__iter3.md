# superpowers — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 7 · Captured: 11/14 · Bespoke captured: 6/8

## Conversation

### Round 1
_Step reasoning:_ Classifying this as architectural; the allocation waterfall (order across instalments and across components) is the single most consequential policy the brief omits, so I ask it first, one question at a time per the process.

Q: When a borrower's payment is applied, in what order should it absorb the amounts owed? Specifically: (a) across the outstanding instalments, do we work oldest-instalment-first until each is cleared, or spread the payment across all of them? and (b) within a single instalment, what priority do the components take: penalties, then fees, then interest, then principal, or some other order your institution uses?
A: (a) Oldest instalment first: a payment must clear the oldest outstanding instalment in full across all its components before any remainder is applied to the next instalment. (b) Within a single instalment the order is: fees, then penalties, then interest, then principal.

### Round 2
_Step reasoning:_ Allocation order is settled, but overpayment/surplus handling is a material, uninferable policy decision I must confirm before specifying.

Q: If a borrower pays more than the total currently outstanding on the loan (all instalments and components cleared), what should happen to the surplus: hold it as an unallocated credit on the loan, apply it to reduce future/remaining principal (early payoff), or return it as a refund, and does that choice depend on whether the loan is thereby fully settled?
A: Hold the surplus as an unallocated credit balance on the loan. It is auto-applied to the next instalment when it falls due. It is never auto-refunded, and it does not reduce future principal. This applies regardless of whether the loan is fully settled by the payment.

### Round 3
_Step reasoning:_ Allocation order and surplus are settled; partial/underpayment behaviour and rounding are the remaining material policies that can't be reliably inferred.

Q: If a payment is not enough to clear an instalment in full, how should the shortfall be handled? Specifically: (a) do we apply the money partially, reducing components in the fees-penalties-interest-principal order as far as it reaches and leaving the rest of that instalment outstanding, or does the institution require an instalment to be cleared in full before any allocation is recorded (holding an insufficient payment as a credit instead)? and (b) when amounts don't divide evenly, what rounding rule applies, to what precision (e.g. nearest minor currency unit), and does any rounding remainder land on a specific component such as principal?
A: (a) Apply the payment partially: money is allocated in the fees-penalties-interest-principal sequence as far as it reaches, reducing each component in turn, and the remainder of the instalment stays outstanding. There is no hold-until-full-clearance rule. (b) The loan is denominated in BHD, so all amounts are rounded to 3 decimal places (fils) using round-half-up. Any rounding residual is absorbed into the interest component, not principal.

### Round 4
_Step reasoning:_ Ordering, surplus, and partial/rounding are settled; the one remaining non-inferable policy is which instalments are in scope (due/overdue only vs all unpaid), which directly determines the allocation target set.

Q: Which instalments does a payment apply to: only those currently due or overdue, or every unpaid instalment on the loan including ones not yet due? The surplus rule (hold as credit, auto-apply when the next instalment falls due) suggests payments touch only due/overdue instalments, but I want to confirm the exact set 'oldest instalment first' ranges over before implementing.
A: Payments apply only to instalments that are currently due or overdue. The 'oldest instalment first' sequence ranges over that set exclusively. Future instalments that have not yet fallen due are never touched; any surplus after clearing all due and overdue instalments becomes a credit balance and is auto-applied when the next instalment falls due.

### Round 5
_Step reasoning:_ Allocation order, surplus, partial/rounding, and the eligible-instalment set are settled, but how a pre-existing credit balance folds into the current allocation is still materially undefined and cannot be inferred.

Q: When `allocate_payment(payment, loan)` is called and the loan already carries an unallocated credit balance from an earlier overpayment, how does that pre-existing credit interact with the incoming payment? Specifically: is the existing credit combined with the new payment and allocated together against the due/overdue instalments in this same call, or is the existing credit left untouched (only auto-applied when the next instalment falls due) while just the new payment is allocated now? And in which order are they considered if both apply?
A: [default, not policy] The pre-existing credit balance is left untouched during the `allocate_payment` call; it remains set aside and auto-applied only when the next instalment falls due, as per the credit-balance rule. The incoming payment is allocated independently against the due and overdue instalments in the normal oldest-first, fees-penalties-interest-principal sequence. The two are not combined into a single allocation run.

### Round 6
_Step reasoning:_ All component-ordering, surplus, partial-payment, rounding, scope and pre-existing-credit policies are settled; the one remaining material unknown is the reference date that defines 'due or overdue', since the signature supplies none.

Q: The signature `allocate_payment(payment, loan)` carries no payment or reference date, yet the policy hinges on which instalments are 'currently due or overdue'. How is that determination made at call time: does the function evaluate due/overdue against the current system date ('today'), or does the loan object carry an explicit as-of/value date that the caller sets, and should a payment ever be back- or forward-dated to a date other than today?
A: The payment carries an explicit value_date; due/overdue status is evaluated against that value_date, not the system clock. Back-dating is supported: when value_date is earlier than today, interest is recomputed (re-accrued) up to and including value_date before allocation runs on those post-accrual balances. Forward-dating (value_date in the future) is not addressed by policy; [default, not policy] it should be rejected at the API boundary.

### Round 7
_Step reasoning:_ Round 6 introduced interest re-accrual on back-dating but left its mechanics (day-count, rate source, compounding, accrual window) unspecified; these are material, non-inferable policy choices needed before specifying allocate_payment.

Q: Round 6 established that back-dating re-accrues interest up to and including the value_date before allocation. How exactly is that interest recomputed? Specifically: (a) what day-count convention applies (e.g. actual/365, actual/360, 30/360), (b) what rate is used (the instalment's contractual rate, a stored per-loan rate, or something else) and is it simple or compounding over the re-accrual window, and (c) from which date does re-accrual run, the instalment's last accrual/due date up to the value_date, and does it touch only due/overdue instalments or every instalment whose interest clock is live?
A: [default, not policy] None of these specifics appear in policy. Reasonable defaults: (a) actual/365 day-count convention. (b) The per-loan contractual annual rate stored on the loan, applied as simple (not compounding) interest over the re-accrual window. (c) Re-accrual runs from each instalment's last accrual date (or the previous period's due date if no finer accrual checkpoint is stored) up to and including value_date; it touches only the due and overdue instalments, not future ones whose interest clock has not yet opened.

### Round 8 (process signalled done)
_Step reasoning:_ All material, non-inferable policy decisions from the brief are now settled (allocation order, surplus/credit handling, partial allocation and rounding, due/overdue scope, pre-existing credit interaction, value-dating and back-dated re-accrual); the last three rounds returned only reasonable defaults rather than new institutional policy, signalling the policy surface is exhausted.

(no questions this round)

## Produced specification

# Payment allocation specification — `allocate_payment(payment, loan)`

## 1. Purpose and scope

This specifies `allocate_payment(payment, loan)` for the loan servicing system. When a borrower pays, the function applies the money across what is currently owed and returns both the allocation (how the payment was consumed, component by component) and the loan's updated balances.

The function is a pure allocation step: given a payment and a loan state, it produces a new loan state and an allocation record. It does not persist anything; persistence is the caller's responsibility.

### Provenance of requirements

Every policy below was either confirmed by the stakeholder or is an explicit engineering default where policy is silent. The two are labelled throughout:

- **[POLICY]** — confirmed by the stakeholder.
- **[DEFAULT]** — not covered by policy; resolved here with a reasonable default and flagged so it can be ratified or overridden.

Nothing beyond the stakeholder answers has been treated as an authoritative policy decision.

## 2. Domain model

### Loan

A loan carries:

- An ordered set of **instalments**, each with a due date and four component balances.
- A per-loan **contractual annual interest rate** (used for back-dated re-accrual; see section 7).
- An **unallocated credit balance** (the running surplus from earlier overpayments), denominated in BHD, defaulting to zero.
- Currency is **BHD** throughout; all monetary amounts are in BHD and carry three decimal places (fils).

### Instalment

Each instalment has:

- A **due date**, used to determine due/overdue status against the payment's value date.
- A **last accrual date** (or, where no finer checkpoint is stored, the previous period's due date), used as the start of the re-accrual window. **[DEFAULT]**
- Four **component balances**, each a non-negative BHD amount:
  - `fees`
  - `penalties`
  - `interest`
  - `principal`

An instalment is *cleared* when all four components are zero.

### Payment

A payment carries:

- An **amount** (positive BHD).
- A **value_date** — an explicit date set by the caller that governs due/overdue evaluation and back-dated re-accrual. The function does not read the system clock to decide which instalments are in scope. **[POLICY]**

### Allocation result

The function returns:

- The per-instalment, per-component breakdown of how the payment was applied.
- The updated instalment balances.
- The updated unallocated credit balance.
- The total amount allocated and any surplus moved to credit.

## 3. Instalment scope: which instalments a payment touches

**[POLICY]** A payment applies **only** to instalments that are **currently due or overdue**, evaluated against the payment's `value_date`. Instalments that have not yet fallen due as of `value_date` are never touched by allocation.

The phrase "oldest instalment first" (section 4) ranges over the due/overdue set **exclusively**.

## 4. Allocation order

Allocation proceeds in two nested orderings.

### 4.1 Across instalments — oldest first **[POLICY]**

Work the due/overdue instalments **oldest first**. A payment must clear the oldest outstanding instalment **in full, across all four of its components**, before any remainder is applied to the next-oldest instalment. The payment is never spread evenly across instalments; each is exhausted in turn.

### 4.2 Within an instalment — fees, penalties, interest, principal **[POLICY]**

Within a single instalment the component priority is:

1. **fees**
2. **penalties**
3. **interest**
4. **principal**

Each component is reduced in turn as far as the available money reaches before moving to the next.

Note: this order (fees before penalties) is the stakeholder's stated institution order and differs from the penalties-first phrasing floated in the initial question. Fees take first priority.

## 5. Partial payments and shortfalls

**[POLICY]** If a payment is not enough to clear an instalment in full, it is applied **partially**. Money is allocated in the fees, penalties, interest, principal sequence as far as it reaches, reducing each component in turn, and the remainder of the instalment stays outstanding.

There is **no** hold-until-full-clearance rule: an insufficient payment is recorded as a partial allocation, not set aside as a credit. (The credit mechanism in section 6 applies only to surplus after all due/overdue instalments are cleared, never to a shortfall.)

## 6. Surplus handling: the unallocated credit balance

**[POLICY]** If the payment exceeds the total currently outstanding across all due and overdue instalments (every such component cleared), the surplus is held as an **unallocated credit balance** on the loan.

Rules for the credit balance:

- It is **auto-applied to the next instalment when that instalment falls due**. It is not applied to future instalments within the current call.
- It is **never auto-refunded**.
- It **does not reduce future principal** (no early-payoff behaviour).
- This holds **regardless of whether the loan is fully settled** by the payment. Even a payment that clears the entire loan leaves any surplus as credit rather than triggering a refund.

## 7. Pre-existing credit balance on entry

**[DEFAULT]** When `allocate_payment` is called and the loan already carries an unallocated credit balance from an earlier overpayment, that pre-existing credit is **left untouched** during the call. It remains set aside and is auto-applied only when the next instalment falls due, per section 6.

The incoming payment is allocated **independently** against the due and overdue instalments in the normal oldest-first, fees-penalties-interest-principal sequence. The existing credit and the new payment are **not combined** into a single allocation run.

If the new payment itself produces a surplus, that surplus is added to the credit balance (the balance accumulates); the pre-existing credit is not otherwise disturbed.

## 8. Dating, value_date and re-accrual

### 8.1 Value date governs scope **[POLICY]**

The payment carries an explicit `value_date`. Due/overdue status (section 3) is evaluated against `value_date`, not the system clock.

### 8.2 Back-dating **[POLICY]**

Back-dating is supported. When `value_date` is **earlier than today**, interest is **recomputed (re-accrued)** up to and including `value_date` before allocation runs. Allocation then operates on the post-accrual balances.

### 8.3 Forward-dating **[DEFAULT]**

Forward-dating (a `value_date` in the future) is not addressed by policy. It is **rejected at the API boundary**: the function raises/returns an error and performs no allocation.

### 8.4 Re-accrual mechanics **[DEFAULT]**

None of the re-accrual specifics are set by policy. The following defaults apply and should be ratified:

- **(a) Day-count convention:** actual/365.
- **(b) Rate:** the per-loan contractual annual rate stored on the loan, applied as **simple** (non-compounding) interest over the re-accrual window.
- **(c) Window and scope:** re-accrual runs from each instalment's **last accrual date** (or, where no finer accrual checkpoint is stored, the previous period's due date) up to and **including** `value_date`. It touches **only the due and overdue instalments**, not future instalments whose interest clock has not yet opened.

Re-accrued interest is added to each affected instalment's `interest` component before that instalment enters allocation.

## 9. Rounding **[POLICY]**

- The loan is denominated in **BHD**; all amounts are rounded to **3 decimal places (fils)**.
- The rounding rule is **round-half-up**.
- Any rounding residual is absorbed into the **interest** component, not principal.

Re-accrual (section 8.4) and allocation both produce amounts at three-decimal precision under this rule.

## 10. Processing sequence

For a single `allocate_payment(payment, loan)` call:

1. **Validate.** Reject a forward-dated payment (section 8.3). Reject a non-positive amount. **[DEFAULT]**
2. **Re-accrue** if `value_date` is earlier than today: recompute interest up to and including `value_date` on the due/overdue instalments (section 8.4), rounding residuals into interest (section 9).
3. **Determine scope.** Select instalments due or overdue as of `value_date` (section 3); leave the pre-existing credit balance untouched (section 7).
4. **Allocate** the incoming payment oldest-instalment-first, each instalment fees → penalties → interest → principal, partially where the money runs out (sections 4, 5).
5. **Surplus to credit.** If money remains after all due/overdue instalments are cleared, add it to the unallocated credit balance (section 6).
6. **Return** the allocation breakdown, the updated instalment balances, and the updated credit balance.

## 11. Worked edge cases

- **Exact clearance:** payment equals total due/overdue outstanding. All selected instalments cleared, no surplus, credit balance unchanged.
- **Shortfall mid-component:** payment runs out partway through, say, the interest component of the second-oldest instalment. That interest component is partially reduced; principal of that instalment and all later instalments remain untouched. No credit is created.
- **Overpayment on a fully settled loan:** every due/overdue component cleared and money remains. Surplus held as credit; no refund, no principal reduction, even though the loan is settled.
- **Entry with existing credit:** pre-existing credit untouched; only the new payment is allocated; any new surplus accumulates onto the credit balance.
- **Back-dated payment:** interest re-accrued to `value_date` first; due/overdue set and all allocation computed on post-accrual balances.

## 12. Open items for ratification

The following were resolved as engineering defaults because policy is silent. They should be confirmed before or shortly after implementation:

- Treatment of a pre-existing credit balance during a call (section 7).
- Rejection of forward-dated payments (section 8.3).
- All re-accrual mechanics: day-count, rate basis, window and scope (section 8.4).
- Validation of non-positive payment amounts (section 10, step 1).

No stakeholder answers beyond those captured above have been assumed.

## Auditor verdict

_The spec correctly resolves 11 of 14 decisions, including the genuinely bespoke ones: fees-before-penalties order (#1), oldest-in-full (#2), credit-balance surplus handling (#3, #8), BHD 3-dp precision (#4), half-up rounding (#5), residual-into-interest (#6), back-dated re-accrual (#7), strict-order partials (#9), accrue-then-allocate (#12), and result shape (#14). It misses the write-off tolerance entirely (#10, absent) and same-day FIFO ordering (#13, absent). On zero/negative payments (#11) it rejects negatives correctly but also rejects zero rather than treating it as a recorded no-op, so that decision does not match. Coverage = 11/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Section 4.2: '1. fees 2. penalties 3. interest 4. principal ... Note: this order (fees before penalties) is the stakeholder's stated institution order' | Spec states the within-instalment order as fees → penalties → interest → principal, exactly matching the reference, and explicitly notes fees precede penalties. |
| 2 | yes | **yes** | Section 4.1: 'A payment must clear the oldest outstanding instalment in full, across all four of its components, before any remainder is applied to the next-oldest instalment.' | Matches the reference: oldest instalment cleared fully across all four buckets before touching the next. |
| 3 | yes | **yes** | Section 6: surplus 'held as an unallocated credit balance', 'auto-applied to the next instalment when that instalment falls due', 'never auto-refunded'. | Spec captures credit balance, auto-application to next instalment on due, and no auto-refund, matching the reference exactly. |
| 4 | yes | **yes** | Section 2/9: 'Currency is BHD throughout ... carry three decimal places (fils).' | Spec states BHD with 3 decimal places (fils), matching the reference minor unit. |
| 5 | yes | **yes** | Section 9: 'The rounding rule is round-half-up.' and 'rounded to 3 decimal places (fils).' | Round-half-up to 3 dp matches the reference rounding method exactly. |
| 6 | yes | **yes** | Section 9: 'Any rounding residual is absorbed into the interest component, not principal.' | Residual destination (interest, not principal) matches the reference exactly. |
| 7 | yes | **yes** | Section 8.2: 'When value_date is earlier than today, interest is recomputed (re-accrued) up to and including value_date before allocation runs.' | Back-valued payment triggers re-accrual to the value date before allocation, matching the reference. |
| 8 | yes | **yes** | Section 6: 'does not reduce future principal (no early-payoff behaviour)' and 'Even a payment that clears the entire loan leaves any surplus as credit rather than triggering a refund.' | Spec states surplus becomes credit and does not prepay principal, leaving future interest unchanged, matching reference #8 (which shares the credit mechanism of #3). |
| 9 | yes | **yes** | Section 5: 'Money is allocated in the fees, penalties, interest, principal sequence as far as it reaches ... There is no hold-until-full-clearance rule'; 'no proportional split' implied by strict sequence. | Partial payment follows strict in-order filling, not proportional, matching the reference. |
| 10 | no | no | absent | The spec contains no write-off tolerance rule; there is no mention of marking an instalment fully paid when residual ≤ 0.005 BHD, so the material forgiveness policy is unaddressed. |
| 11 | yes | no | Section 10 step 1: 'Reject a non-positive amount.' Payment defined as 'An amount (positive BHD).' | Reference requires negative rejected but zero to be a no-op recording a zero-value allocation transaction; the spec rejects all non-positive amounts (including zero), so the zero-amount behaviour does not match. |
| 12 | yes | **yes** | Section 10 step 2: 're-accrue ... recompute interest up to and including value_date on the due/overdue instalments' then step 4 'Allocate'; section 8.4(c) accrual 'up to and including value_date'. | Spec accrues penalties/interest up to and including value_date, then allocates on post-accrual balances, matching the accrue-then-allocate ordering of the reference. |
| 13 | no | no | absent | The spec never addresses multiple payments on the same day or FIFO-by-receipt-timestamp ordering; it treats a single payment per call without specifying same-day sequencing. |
| 14 | yes | **yes** | Section 2 'Allocation result' and Section 10 step 6: per-instalment per-component breakdown, updated instalment balances, updated unallocated credit balance, total allocated and surplus moved to credit. | Returned shape includes per-bucket per-instalment amounts, resulting balances, and credit balance created, matching the reference; tolerance_written_off is omitted but tolerance (#10) is itself absent, and the core result shape otherwise matches. |
