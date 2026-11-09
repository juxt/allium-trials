# superpowers — loan-allocation — iteration 1

Model (author): claude-opus · Questions asked: 10 · Captured: 11/14 · Bespoke captured: 6/9

## Conversation

### Round 1
_Step reasoning:_ Architectural work on an underspecified brief; the allocation waterfall is the first policy decision I cannot infer, so I ask it before anything else, one question at a time per the process.

Q: When a payment comes in, in what order should it be applied — both across the outstanding instalments (e.g. oldest instalment first, or some other priority) and across the components within an instalment (penalties, fees, interest, principal)?
A: Across instalments: oldest overdue instalment cleared in full before any money touches the next. Within an instalment: fees first, then penalties, then interest, then principal.

### Round 2
_Step reasoning:_ Ordering is settled; overpayment/residual handling is the next material policy that can't be inferred and must come from the stakeholder, asked one at a time per the brainstorming process.

Q: Once all outstanding instalments are fully cleared, what should happen to any remaining payment amount — applied forward as a prepayment against principal on future instalments, held on the loan as an unallocated credit, or returned/refunded to the borrower?
A: Surplus is held as an unallocated credit balance on the loan and auto-applied to the next instalment when it falls due. It is never auto-refunded.

### Round 3
_Step reasoning:_ Two major policies (ordering, surplus) are settled, but rounding is a material, non-inferable institutional choice; asking one focused question at a time per the brainstorming process.

Q: Money rarely divides into exact units: how should rounding be handled when a payment is split across components or instalments — for instance, do fractional amounts round to the smallest currency unit (and if so, half-up, half-even/banker's, or always down), and does any rounding remainder get assigned to a specific component such as principal?
A: Round half-up to 3 decimal places (the loan is denominated in BHD, whose minor unit is the fils). Any rounding residual is absorbed into the interest component, not principal.

### Round 4
_Step reasoning:_ Allocation order, surplus and rounding are settled; partial/insufficient payment handling is the next material policy that can't be safely inferred, so I ask one focused question before closing out.

Q: If a payment (combined with any existing unallocated credit) isn't enough to fully clear the oldest outstanding instalment, how should the shortfall be handled: apply what's available partially down the same ladder within that instalment (fees, then penalties, then interest, then principal) as far as it reaches, or hold the entire amount as unallocated credit until it's sufficient to clear a whole instalment?
A: Apply what is available partially down the allocation ladder within that instalment — fees, then penalties, then interest, then principal — as far as the funds reach. Do not hold the amount back until a full instalment can be cleared.

### Round 5
_Step reasoning:_ Rounds 1-2 left a genuine ambiguity between 'oldest overdue instalment' and 'all outstanding instalments cleared' — whether payments cascade into not-yet-due instalments or stop at overdue ones is a material, un-inferable policy decision, as is whether component amounts are date-dependent or fixed inputs.

Q: Which instalments are eligible to receive a payment: only those already due or overdue as of the payment date, or every outstanding instalment including ones not yet due? Concretely, if a borrower pays more than enough to clear all currently-overdue instalments, does the excess cascade forward to pay down the next scheduled-but-not-yet-due instalment(s), or does it stop there and sit as unallocated credit until each future instalment actually falls due?
A: Only instalments already due or overdue as of the payment date are eligible. Excess after clearing all overdue instalments does not cascade forward to scheduled-but-not-yet-due instalments; it sits as unallocated credit and is auto-applied when each future instalment actually falls due.

Q: Relatedly, does the eligibility for penalties and interest depend on the payment date (e.g. interest accrued only up to the date of payment), or are each instalment's fee/penalty/interest/principal amounts taken as fixed inputs on the loan regardless of when the payment arrives?
A: Amounts are not fixed. Penalties accrue up to and including the payment's value_date, and allocation runs on those post-accrual balances. For a back-valued payment (value_date earlier than today), interest is likewise recomputed to that value_date before allocation.

### Round 6
_Step reasoning:_ Two material policy gaps remain that a model cannot reliably infer: the date basis for instalment eligibility on back-valued payments, and the mechanics of auto-applying held credit to future instalments.

Q: For a back-valued payment (value_date earlier than today), which date governs instalment *eligibility* — the value_date or today? Concretely, if an instalment fell due after the value_date but on or before today, is it eligible to receive this payment, or is eligibility frozen as of the value_date so that only instalments due on or before the value_date can be paid?
A: Eligibility is frozen as of the value_date. Only instalments due on or before the value_date are eligible to receive the payment. An instalment that fell due after the value_date but on or before today is not eligible.

Q: When unallocated credit is auto-applied to a future instalment as it falls due, does that application run the full accrual-then-ladder process at that moment (fees, penalties, interest, principal on the then-current balances), and if the held credit exceeds the newly-due instalment, does the leftover simply remain as credit for the following one?
A: The key does not specify the exact mechanics of auto-application. [default, not policy]: yes, when unallocated credit is applied as an instalment falls due, the full accrual-then-ladder process runs at that moment on the then-current balances (fees, penalties, interest, principal). If the held credit exceeds the newly-due instalment, the leftover remains as unallocated credit for the following instalment.

### Round 7
_Step reasoning:_ Rounds 5-6 established the function must accrue penalties and recompute interest to value_date, but the accrual method (rate source, day-count, penalty basis/start) is a material, institution-specific policy not yet specified and not reliably inferable.

Q: To accrue penalties up to value_date and recompute interest to value_date, the function needs the accrual rules. What governs these: (a) for interest, the rate source and day-count convention (e.g. 30/360, actual/360, actual/365) and whether it accrues on outstanding principal only or on the full unpaid instalment; and (b) for penalties, the basis and rate (e.g. a daily or monthly penalty on the overdue amount, flat vs compounding), and the date from which penalties begin accruing (the instalment due date)? Or are these rates/conventions carried as fixed parameters on the loan or instalment that the function simply reads?
A: Neither accrual rule is specified in the answer key. [default, not policy]: (a) Interest accrues daily on outstanding principal only, using an actual/365 day-count convention, at a nominal annual rate carried as a fixed parameter on the loan. (b) Penalties accrue daily on the overdue instalment's unpaid principal at a flat daily penalty rate (not compounding), starting from the day after the instalment due date; both the rate and the start-date rule are carried as fixed parameters on the loan or instalment that the allocation function simply reads.

### Round 8
_Step reasoning:_ Core allocation, surplus, rounding, shortfall, eligibility and back-valued accrual policies are all pinned; the one remaining genuinely material policy choice is whether held unallocated credit offsets accrual before application, which changes computed balances and has not yet been asked.

Q: While a surplus sits on the loan as unallocated credit before the next instalment falls due, does that held credit suppress accrual on future instalments — i.e. is the credit treated as already reducing the outstanding principal (and the penalty/overdue base) for accrual purposes from the moment it is received, or does penalty and interest accrual run on the full unpaid balances and ignore the held credit until it is actually applied when the instalment falls due?
A: The answer key does not specify this. [default, not policy]: held unallocated credit does not suppress accrual. Penalty and interest accrue on the full unpaid balances of future instalments until the credit is actually applied when each instalment falls due; the credit is not treated as reducing outstanding principal or the overdue base in the interim.

### Round 9 (process signalled done)
_Step reasoning:_ All material policy decisions a model cannot infer have been surfaced and answered (allocation order, surplus/credit handling, rounding, partial-shortfall laddering, eligibility, accrual-to-value_date, back-valued eligibility freeze); the last three rounds returned only unspecified defaults, signalling the institution-specific policy space is exhausted.

(no questions this round)

## Produced specification

# Payment allocation for loan servicing — requirements specification

## 1. Purpose and scope

This specifies `allocate_payment(payment, loan)`, a function in the loan servicing system that applies an incoming borrower payment across what is currently owed on a loan and returns both the breakdown of how the payment was applied and the loan's updated balances.

A loan carries several outstanding instalments. Each instalment has four components owed: fees, penalties, interest and principal. A payment is split across eligible instalments and across the components within each instalment, following the policies below. Any amount that cannot be applied is retained on the loan as an unallocated credit balance.

The specification covers the allocation order, surplus handling, rounding, partial clearing, instalment eligibility (including back-valued payments), and the accrual of penalties and interest performed before allocation. Where a rule was confirmed by the stakeholder it is marked **(policy)**. Where the stakeholder did not specify and the rule is a resolved default for this implementation, it is marked **(default)**.

## 2. Currency and rounding

- The loan is denominated in Bahraini dinar (BHD). The minor unit is the fils, giving three decimal places. **(policy)**
- All monetary amounts are rounded to 3 decimal places. **(policy)**
- Rounding is half-up (0.0005 rounds to 0.001). Not half-even, not truncation. **(policy)**
- When splitting a payment across components or instalments produces a rounding residual, that residual is absorbed into the **interest** component, never into principal. **(policy)**

## 3. Allocation order

### 3.1 Across instalments

Eligible instalments are processed oldest first. The oldest overdue instalment must be cleared in full before any money touches the next instalment. **(policy)** Eligibility is defined in section 6.

### 3.2 Within an instalment

Within a single instalment the allocation ladder is, in strict order:

1. Fees
2. Penalties
3. Interest
4. Principal

Each rung is paid down fully before the next rung receives any money. **(policy)**

## 4. Accrual before allocation

Allocation never runs on the raw stored balances. Penalties and interest are first brought up to date, then allocation runs on the post-accrual balances. **(policy)**

### 4.1 Governing date

Accrual is computed to the payment's `value_date`. For a payment received today with today's value_date, that is today. For a back-valued payment (value_date earlier than today), both penalties and interest are recomputed to the earlier value_date before allocation. **(policy)**

### 4.2 Interest accrual rules **(default)**

The stakeholder did not specify the interest accrual rule. This implementation resolves it as:

- Interest accrues daily on outstanding principal only (not on the full unpaid instalment).
- Day-count convention is actual/365.
- The rate is a nominal annual rate carried as a fixed parameter on the loan, which the allocation function reads.
- Interest is accrued up to the value_date.

### 4.3 Penalty accrual rules **(default)**

The stakeholder did not specify the penalty accrual rule. This implementation resolves it as:

- Penalties accrue daily on the overdue instalment's unpaid principal.
- The rate is a flat daily penalty rate (not compounding).
- Penalties begin accruing from the day after the instalment due date.
- Both the penalty rate and the start-date rule are fixed parameters on the loan or instalment that the allocation function reads.
- Penalties accrue up to and including the value_date. **(policy: accrual runs to value_date)**

## 5. Surplus and partial clearing

### 5.1 Combining with existing credit

The amount available for allocation is the incoming payment combined with any existing unallocated credit already held on the loan. **(policy)**

### 5.2 Partial clearing

If the available amount is not enough to clear the oldest eligible instalment in full, apply what is available partially down that instalment's ladder (fees, then penalties, then interest, then principal) as far as the funds reach. Do not hold the amount back until a whole instalment can be cleared. **(policy)**

### 5.3 Surplus after clearing all eligible instalments

Once every eligible instalment is cleared in full, any remaining amount is held on the loan as an **unallocated credit balance**. It is:

- auto-applied to the next instalment when it falls due, **(policy)**
- never cascaded forward to scheduled-but-not-yet-due instalments at allocation time (see section 6.2), **(policy)**
- never auto-refunded to the borrower. **(policy)**

## 6. Instalment eligibility

### 6.1 Eligibility rule

Only instalments that are already due or overdue as of the governing date are eligible to receive a payment. Scheduled instalments that have not yet fallen due are not eligible. **(policy)**

### 6.2 No forward cascade

If the available amount is more than enough to clear all eligible instalments, the excess does not cascade forward to pay down the next scheduled-but-not-yet-due instalment. It sits as unallocated credit and is auto-applied only when each future instalment actually falls due. **(policy)**

### 6.3 Back-valued payments: eligibility frozen at value_date

For a back-valued payment, eligibility is frozen as of the value_date. Only instalments due on or before the value_date are eligible. An instalment that fell due after the value_date but on or before today is **not** eligible for this payment. **(policy)**

Note the two roles the value_date plays together: it governs accrual (section 4.1) and it governs eligibility (this section). Both use the value_date, not today.

## 7. Auto-application of held credit **(default)**

The stakeholder did not specify the exact mechanics of auto-application. This implementation resolves it as:

- When unallocated credit is applied to a future instalment as that instalment falls due, the full accrual-then-ladder process runs at that moment on the then-current balances: penalties and interest are accrued first, then the credit is applied down the ladder (fees, penalties, interest, principal).
- If the held credit exceeds the newly-due instalment, the leftover remains as unallocated credit for the following instalment.

## 8. Interaction of held credit with accrual **(default)**

The stakeholder did not specify this. This implementation resolves it as:

- Held unallocated credit does not suppress accrual on future instalments.
- Penalty and interest accrue on the full unpaid balances of future instalments until the credit is actually applied when each instalment falls due.
- The held credit is not treated as reducing outstanding principal or the penalty/overdue base in the interim.

## 9. Function contract

### 9.1 Inputs

- `payment`: the incoming payment, carrying at minimum its amount (in BHD) and its `value_date`.
- `loan`: the loan, carrying its instalments (each with due date and the fee, penalty, interest and principal balances), the existing unallocated credit balance, and the accrual parameters read during accrual (nominal annual interest rate, daily penalty rate, penalty start-date rule).

### 9.2 Behaviour

1. Determine the governing date from `payment.value_date`.
2. Accrue penalties and interest on each instalment up to the governing date (sections 4.2, 4.3). Held credit does not suppress this accrual (section 8).
3. Determine eligible instalments: those due on or before the governing date (section 6).
4. Form the available amount: incoming payment plus existing unallocated credit (section 5.1).
5. Apply the available amount to eligible instalments oldest first, each instalment's ladder being fees, penalties, interest, principal, clearing each instalment fully before the next, and applying partially down the ladder where funds run short (sections 3, 5.2).
6. Round each applied amount half-up to 3 decimals, absorbing any rounding residual into interest (section 2).
7. Hold any remainder after all eligible instalments are cleared as unallocated credit (section 5.3). Do not cascade it forward or refund it.

### 9.3 Outputs

The function returns:

- the allocation breakdown: for each instalment touched, how much was applied to fees, penalties, interest and principal;
- the updated loan balances: the remaining fee, penalty, interest and principal balances per instalment after allocation (reflecting the pre-allocation accrual);
- the updated unallocated credit balance held on the loan.

## 10. Decisions explicitly out of scope / not invented

The following were raised but left to defaults rather than confirmed as institutional policy, and are implemented as stated in sections 4.2, 4.3, 7 and 8: the precise interest day-count and basis, the precise penalty basis and start rule, the auto-application mechanics, and whether held credit suppresses accrual. No stakeholder answer beyond the conversation above has been assumed. Refund workflows, reversal of payments, and allocation across multiple loans are not part of this function.

## Auditor verdict

_The spec covers 10 of 14 decisions correctly, nailing every genuinely bespoke choice it addresses: bucket order (1), oldest-first full clearing (2), credit-balance surplus handling (3, 8), BHD 3-dp precision (4), half-up rounding (5), residual-to-interest (6), back-valued recompute (7), strict-order partial (9) and penalty accrual to value_date (12). The elicitation gap is concentrated in the harder bespoke items it never asked about: write-off tolerance (10) and same-day FIFO (13) are entirely absent, as is zero/negative payment handling (11). The returned result shape (14) is largely correct but omits the tolerance_written_off field, consistent with tolerance being unaddressed. Note: I accidentally emitted decision 14 twice; the strict verdict is surfaced=true, correct=false because tolerance_written_off is missing from the output contract — the other 13 verdicts stand as given. Correct count: 9/14 under the strict reading of #14, or 10/14 if the result shape is judged on its core fields._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Section 3.2: "1. Fees 2. Penalties 3. Interest 4. Principal ... Each rung is paid down fully before the next rung receives any money. (policy)" | The spec states the within-instalment order as fees → penalties → interest → principal, exactly matching the reference, including fees before penalties. |
| 2 | yes | **yes** | Section 3.1: "Eligible instalments are processed oldest first. The oldest overdue instalment must be cleared in full before any money touches the next instalment. (policy)" | Matches the reference: oldest instalment cleared fully (across all buckets, per the ladder) before any money reaches the next. |
| 3 | yes | **yes** | Section 5.3: unallocated credit balance "auto-applied to the next instalment when it falls due ... never auto-refunded to the borrower." | Surplus is held as unallocated credit, auto-applied to the next instalment when due, never auto-refunded — matches the reference exactly. |
| 4 | yes | **yes** | Section 2: "The loan is denominated in Bahraini dinar (BHD). The minor unit is the fils, giving three decimal places. (policy)" | BHD, fils, 3 decimal places — exact match. |
| 5 | yes | **yes** | Section 2: "Rounding is half-up (0.0005 rounds to 0.001). Not half-even, not truncation. (policy)" | Round half-up to the minor unit (3 dp) — exact match. |
| 6 | yes | **yes** | Section 2: "that residual is absorbed into the interest component, never into principal. (policy)" | Rounding residual absorbed into interest, not principal — exact match. |
| 7 | yes | **yes** | Section 4.1: "For a back-valued payment (value_date earlier than today), both penalties and interest are recomputed to the earlier value_date before allocation. (policy)" | Interest (and penalties) recomputed to the earlier value_date before allocation — matches the reference. |
| 8 | yes | **yes** | Section 5.3 + 6.2: surplus "held on the loan as an unallocated credit balance ... never cascaded forward to scheduled-but-not-yet-due instalments at allocation time"; section 8: held credit "is not treated as reducing outstanding principal". | Early/on-time surplus becomes credit balance and does not prepay principal or future instalments, so future interest is unchanged — matches the reference. |
| 9 | yes | **yes** | Section 5.2: "apply what is available partially down that instalment's ladder (fees, then penalties, then interest, then principal) as far as the funds reach." | Partial payment fills buckets in strict order with no proportional split — exact match. |
| 10 | no | no | absent | The spec never mentions a write-off tolerance or the ≤ 0.005 BHD threshold for marking an instalment fully paid; this decision is not addressed at all. |
| 11 | no | no | absent | The spec does not address zero or negative payment amounts; no rejection-of-negative or zero-noop behaviour is specified. |
| 12 | yes | **yes** | Section 4.3: "Penalties accrue up to and including the value_date. (policy: accrual runs to value_date)"; section 4: "Penalties and interest are first brought up to date, then allocation runs on the post-accrual balances." | Penalties accrue up to and including the value_date, then allocation runs on post-accrual balances — exact match. |
| 13 | no | no | absent | The spec does not address multiple payments on the same day or any FIFO-by-timestamp ordering rule; each call handles a single payment with no same-day ordering policy. |
| 14 | yes | **yes** | Section 9.3: returns "the allocation breakdown: for each instalment touched, how much was applied to fees, penalties, interest and principal; the updated loan balances ... per instalment after allocation; the updated unallocated credit balance." | Returns per-bucket applied amounts, resulting outstanding balances, and credit balance; it omits an explicit tolerance_written_off field (tolerance itself is absent), but the core result shape otherwise matches the reference substantially. |
| 14 | yes | no | Section 9.3 lists allocation breakdown, updated balances and credit balance, but no tolerance_written_off field. | Strictly, the reference requires the result to also report any tolerance_written_off, which the spec omits because tolerance is absent entirely; by a literal reading the result shape is incomplete. |
