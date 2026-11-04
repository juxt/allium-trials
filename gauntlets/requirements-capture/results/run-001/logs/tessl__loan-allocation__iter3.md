# tessl — loan-allocation — iteration 3

Model (author): claude-opus · Questions asked: 5 · Captured: 8/14 · Bespoke captured: 3/8

## Conversation

### Round 1
_Step reasoning:_ Highest-impact scope question first: the allocation order across components is a core policy the brief omits and cannot be reliably inferred, so I ask it before edge cases, one question at a time per the process.

Q: When a payment is applied to an outstanding instalment, in what order should it be allocated across the four components (penalties, fees, interest, principal)?
A: fees, then penalties, then interest, then principal

### Round 2
_Step reasoning:_ Allocation order within an instalment is settled; the next highest-impact gap is how the payment traverses multiple outstanding instalments.

Q: When multiple instalments are outstanding, in what order should the payment be applied across them, and do you fully satisfy one instalment's components before moving to the next, or apply a given component across all instalments before moving to the next component?
A: Clear the oldest outstanding instalment in full — all four buckets in the established order — before any money touches the next instalment.

### Round 3
_Step reasoning:_ Scope and instalment ordering are settled; the next highest-impact gap is overpayment handling, which cannot be inferred and has several plausible institutional policies.

Q: If the payment exceeds the total currently owed across all outstanding instalments, how should the excess be handled: refund it to the borrower, hold it as an unallocated credit on the loan, or apply it to reduce future/not-yet-due instalments (and if so, in what order and against which components)?
A: Hold the surplus as an unallocated credit balance on the loan. It is auto-applied to the next instalment when it falls due. It is never auto-refunded and does not prepay principal or reduce future not-yet-due instalments.

### Round 4
_Step reasoning:_ Ordering, cross-instalment sequencing, and surplus handling are settled; rounding of fractional amounts is the next material, un-inferable policy gap before I can call requirements complete.

Q: When a payment or the running allocation produces fractional currency amounts (for example splitting across interest and principal, or applying a credit), how should rounding be handled: to what precision, using which rounding rule, and where does any residual rounding difference land?
A: Round to 3 decimal places (the BHD fils minor unit) using round-half-up. Any residual rounding difference is absorbed into the interest component.

### Round 5
_Step reasoning:_ Core allocation, cross-instalment order, surplus handling and rounding are settled; the unresolved material gap is how a pre-existing credit balance interacts with a fresh incoming payment.

Q: When a new payment arrives and the loan already holds an unallocated credit balance, should that existing credit be combined with the incoming payment and allocated together in this run, or does the credit stay untouched (applied only when the next instalment falls due) while only the new payment is allocated now?
A: The existing credit balance stays untouched and is not combined with the incoming payment in this run. The credit is auto-applied only when the next instalment falls due; the new payment is allocated independently against outstanding balances right now.

### Round 6 (process signalled done)
_Step reasoning:_ Five high-impact policy gaps (component order, instalment order, surplus handling, rounding, credit interaction) are now resolved with specific institutional answers; remaining details are minor enough to defer, and the process forbids proceeding to spec authoring here.

(no questions this round)

## Produced specification

# Requirements Specification: `allocate_payment(payment, loan)`

## Status

Confirmed with stakeholder through a five-round clarification interview. Every policy decision recorded below traces to a specific stakeholder answer or to the feature brief. Items the stakeholder did not settle are listed explicitly under "Open items" rather than resolved by assumption.

## 1. Purpose and scope

### In scope

- A function `allocate_payment(payment, loan)` that applies a single incoming payment to a loan's outstanding instalments and returns both how the payment was applied and the loan's updated balances.
- A loan may carry several outstanding instalments. Each instalment has four components: penalties, fees, interest and principal.
- Handling of surplus payment beyond the total currently owed.
- Handling of a pre-existing unallocated credit balance on the loan at the time a new payment arrives.
- Rounding of fractional currency amounts produced during allocation.

### Out of scope (not raised in the brief and not settled in interview)

- Reversals, refunds initiated by the borrower, or manual credit application.
- Recalculation of interest or penalties as a function of time or the payment date.
- Persistence, concurrency, currency conversion, or any interface beyond the named function signature.

## 2. Core behaviour (happy path)

Given a payment amount and a loan with one or more outstanding instalments, the function applies the payment as follows.

### 2.1 Order across instalments

Apply the payment to the **oldest outstanding instalment first**. Fully satisfy that instalment in full, across all four components, before any money touches the next instalment. Only once the oldest instalment is completely cleared does allocation move to the next-oldest, and so on.

This is instalment-by-instalment satisfaction, not component-by-component across instalments. A given component is never applied across all instalments before the next component; each instalment is closed out in turn.

### 2.2 Order across components within an instalment

Within a single instalment, allocate to the four components in this fixed order:

1. **Fees**
2. **Penalties**
3. **Interest**
4. **Principal**

Each component is satisfied in full before moving to the next. Money moves to the next component only when the current one reaches zero outstanding.

### 2.3 Termination

Allocation continues instalment by instalment until either the payment is exhausted or every outstanding instalment is fully cleared, whichever comes first.

## 3. Surplus handling

If the payment exceeds the total currently owed across all outstanding instalments, the excess is **held as an unallocated credit balance on the loan**.

The credit balance:

- Is **auto-applied to the next instalment when that instalment falls due**.
- Is **never auto-refunded** to the borrower.
- **Does not prepay principal** and **does not reduce future or not-yet-due instalments** at allocation time.

So surplus is parked, not distributed. It waits for the next instalment to become due and is applied then.

## 4. Pre-existing credit balance at time of a new payment

When a new payment arrives and the loan **already holds** an unallocated credit balance:

- The existing credit balance **stays untouched**. It is **not combined** with the incoming payment in this allocation run.
- The existing credit continues to follow the rule in section 3: it is auto-applied only when the next instalment falls due.
- The **new payment is allocated independently, right now**, against the currently outstanding balances, following sections 2 and 3.

The incoming payment and any resident credit are two separate streams. This run touches only the incoming payment.

## 5. Rounding

All fractional currency amounts arising during allocation (for example when splitting across interest and principal, or when applying a credit) are handled as follows:

- **Precision:** 3 decimal places, the BHD fils minor unit.
- **Rule:** round half up.
- **Residual placement:** any residual rounding difference is **absorbed into the interest component**.

## 6. Output

The function returns:

1. **The allocation** — how the payment was applied, broken down by instalment and, within each instalment, by the four components in the order fees, penalties, interest, principal.
2. **The loan's updated balances** — the remaining outstanding amount per component per instalment after allocation.
3. **The unallocated credit balance** on the loan, reflecting any surplus newly held (section 3) plus any pre-existing credit left untouched (section 4).

## 7. Decision log (traceability)

- **Component order within an instalment:** fees, then penalties, then interest, then principal. (Round 1)
- **Instalment order and satisfaction mode:** oldest outstanding instalment first, cleared in full across all four buckets before the next instalment is touched. (Round 2)
- **Surplus:** held as an unallocated credit balance, auto-applied to the next instalment when due, never auto-refunded, does not prepay principal or reduce not-yet-due instalments. (Round 3)
- **Rounding:** 3 decimal places (BHD fils), round half up, residual absorbed into interest. (Round 4)
- **Existing credit on new payment:** existing credit stays untouched and is not combined with the incoming payment; the new payment is allocated independently now. (Round 5)

## 8. Open items (not settled; must not be assumed)

The following were neither stated in the brief nor answered in the interview. They are flagged rather than resolved, in keeping with the rule against inventing stakeholder answers. Each should be confirmed before implementation:

- **Definition of "oldest" and "falls due":** the fields or dates used to order instalments and to detect when the next instalment becomes due are not specified.
- **Zero, negative, or non-numeric payment inputs:** behaviour for a zero payment, a negative amount, or a malformed value is unspecified.
- **No outstanding instalments at all:** whether an entire payment then becomes credit, or is rejected, is unspecified (section 3 implies it would become credit, but this was not confirmed).
- **Mechanics of credit auto-application when the next instalment falls due:** the component order for applying a held credit, and whether that event is triggered inside this function or elsewhere, are not specified.
- **Loan and payment data shapes:** the concrete structure of the `loan` and `payment` arguments and of the return value is not defined.
- **Currency assumption:** rounding is fixed to the BHD minor unit; whether the system is single-currency (BHD only) is not confirmed.

## 9. Success criteria for this specification

- Every stakeholder decision from the five interview rounds is captured verbatim in intent (section 7).
- No requirement has been invented where the stakeholder was silent; gaps are surfaced in section 8.
- The specification is ready to hand to spec authoring once the open items are confirmed.

## Auditor verdict

_The spec captures the five interviewed decisions strongly: bucket order (1), instalment order (2), surplus/credit-balance (3, 8), and rounding (4, 5, 6) all match the reference exactly, and strict in-order filling (9) is correct. It fails on the decisions never surfaced in the interview: back-valued payments (7) and penalty accrual (12) are pushed out of scope, write-off tolerance (10) and same-day FIFO (13) are absent, zero/negative handling (11) is honestly flagged as an open item but left unresolved, and the return shape (14) omits tolerance_written_off. Coverage = 8/14 correct (1, 2, 3, 4, 5, 6, 8, 9)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Section 2.2: '1. Fees 2. Penalties 3. Interest 4. Principal' and 7: 'Component order within an instalment: fees, then penalties, then interest, then principal.' | The spec fixes the order fees → penalties → interest → principal, matching the reference's deliberate fees-before-penalties choice exactly. |
| 2 | yes | **yes** | Section 2.1: 'Apply the payment to the oldest outstanding instalment first. Fully satisfy that instalment in full, across all four components, before any money touches the next instalment.' | Matches the reference: oldest instalment cleared in full across all buckets before the next is touched. |
| 3 | yes | **yes** | Section 3: 'held as an unallocated credit balance on the loan... auto-applied to the next instalment when that instalment falls due... never auto-refunded... Does not prepay principal.' | Matches the reference: credit balance, auto-applied at next instalment due, never refunded. |
| 4 | yes | **yes** | Section 5: 'Precision: 3 decimal places, the BHD fils minor unit.' | Spec states BHD, 3 dp, fils — matches the reference precisely. |
| 5 | yes | **yes** | Section 5: 'Rule: round half up.' | Round half up to 3 dp matches the reference rounding method. |
| 6 | yes | **yes** | Section 5: 'Residual placement: any residual rounding difference is absorbed into the interest component.' | Matches the reference: residual absorbed into interest, not principal. |
| 7 | yes | no | Out of scope: 'Recalculation of interest or penalties as a function of time or the payment date.' Section 2.2 / no value_date handling. | The spec explicitly excludes back-valued interest recomputation and defines no value_date behaviour, so it does not resolve this decision to the reference answer; it is contradicted rather than addressed. |
| 8 | yes | **yes** | Section 3: surplus 'held as an unallocated credit balance... Does not prepay principal and does not reduce future or not-yet-due instalments at allocation time.' | Matches the reference: an early/surplus payment does not prepay principal; surplus becomes credit and future interest is unchanged. |
| 9 | yes | **yes** | Section 2.2: 'Each component is satisfied in full before moving to the next. Money moves to the next component only when the current one reaches zero outstanding.' | Strict in-order filling with no proportional split matches the reference; a partial payment smaller than the first bucket fills that bucket in order. |
| 10 | no | no | absent | No write-off tolerance is mentioned anywhere; the spec has no notion of marking an instalment paid when a small residual remains. |
| 11 | yes | no | Section 8 Open items: 'Zero, negative, or non-numeric payment inputs: behaviour... is unspecified.' | The spec flags zero/negative handling as an open item and deliberately does not resolve it, so it does not state the reference answer (reject negative, zero no-op recording a zero allocation). |
| 12 | no | no | Out of scope: 'Recalculation of interest or penalties as a function of time or the payment date.' | Penalty accrual on the allocation/value date is excluded and never addressed, so the accrue-then-allocate policy is neither surfaced nor resolved. |
| 13 | no | no | absent | The function handles a single payment and never addresses ordering of multiple same-day payments; no FIFO-by-timestamp rule appears. |
| 14 | yes | no | Section 6: returns 'The allocation... broken down by instalment... by the four components', 'updated balances', and 'The unallocated credit balance'. | The output includes per-bucket allocation, outstanding balances and credit_balance, but omits the tolerance_written_off field required by the reference shape, so it does not fully match. |
