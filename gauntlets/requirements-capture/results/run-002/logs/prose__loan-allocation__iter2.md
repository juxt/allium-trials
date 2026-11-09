# prose — loan-allocation — iteration 2

Model (author): claude-opus · Questions asked: 8 · Captured: 9/14 · Bespoke captured: 3/8

## Conversation

### Round 1
_Step reasoning:_ The brief omits the component priority, cross-instalment ordering, overpayment, partial-allocation, rounding and validation policies, none of which can be reliably inferred, so I must ask before specifying.

Q: Across the components within what is owed (penalty, fee, interest, principal), in what priority order should the payment be applied?
A: Fees first, then penalties, then interest, then principal.

Q: When multiple instalments are outstanding, how should the payment be applied across them: oldest instalment first until fully settled, or by sweeping one component type across all instalments before moving to the next component type (a waterfall by component), or some other order?
A: Oldest instalment first: clear all four buckets of that instalment in full before any funds touch the next instalment.

Q: If the payment is larger than the total currently owed on the loan, what should happen to the surplus (refund it, hold it as an unapplied credit, apply it to reduce future principal, or reject the payment)?
A: Surplus is held as an unallocated credit balance and auto-applied to the next instalment when it falls due. It is never auto-refunded.

Q: If the payment is smaller than a given component or instalment, is partial allocation to that component allowed, or must a component be settled all-or-nothing before any money moves to the next?
A: Partial allocation is allowed. The strict bucket order is preserved; each bucket is filled as far as available funds allow before moving to the next. There is no proportional splitting and no requirement to settle a bucket in full before touching it.

Q: What are the monetary units and rounding rules (e.g. minor units/cents, rounding direction, how to handle fractional amounts left after allocation)?
A: The loan currency is BHD (Bahraini dinar), with 3 decimal places (fils). All amounts are rounded half-up to 3 dp. Any rounding residual is absorbed into the interest component, not principal.

Q: How should invalid payments be handled (zero, negative, or non-numeric amounts), and should overpayment/zero-balance loans be treated as errors or no-ops?
A: Negative payments are rejected with an error. A zero payment is a no-op but still records a zero-value allocation transaction. A payment against a zero-balance loan is [default, not policy] also a no-op.

### Round 2
_Step reasoning:_ Core allocation policy is pinned, but two material, uninferable rules remain: how pre-existing credit interacts with a new payment, and whether allocation may reach not-yet-due instalments or stops at due ones.

Q: When a payment arrives and the loan already holds an unallocated credit balance from a prior overpayment, should `allocate_payment` sweep that existing credit in together with the incoming payment and allocate the combined amount now, or leave the credit untouched until the next instalment falls due?
A: Leave the existing credit balance untouched until the next instalment falls due. The incoming payment is allocated on its own. [default, not policy — the key defines the credit trigger as the due date, not an inbound payment event, but does not explicitly rule on this interaction.]

Q: For the oldest-first allocation, which instalments are eligible: only instalments that are currently due/outstanding (with any remainder becoming credit), or should the payment also flow into future instalments that have not yet fallen due once all due ones are cleared?
A: Only instalments that are currently due or overdue are eligible. Once all due instalments are cleared, any remaining funds become an unallocated credit balance held until the next instalment falls due. Payment does not flow into future, not-yet-due instalments.

### Round 3 (process signalled done)
_Step reasoning:_ Two rounds have resolved every material policy the brief omitted (component priority, oldest-first cross-instalment order, surplus-to-credit, partial allocation, BHD/3dp rounding with residual to interest, invalid-payment handling, credit-interaction and instalment eligibility); the last answers returned defaults rather than policy, signalling the policy space is exhausted, so I'm ready to write the spec.

(no questions this round)

## Produced specification

# Requirements specification — `allocate_payment(payment, loan)`

## 1. Purpose

Apply a borrower's payment across the amounts currently owed on a loan and return both the allocation (how the money was applied) and the loan's updated balances. The loan may carry several outstanding instalments, each split into four components: penalties, fees, interest and principal.

## 2. Interface

```
allocate_payment(payment, loan) -> result
```

- `payment`: the incoming payment amount, denominated in the loan currency (BHD).
- `loan`: the loan state, including its ordered instalments, each instalment's four component balances, each instalment's due date (or due/overdue status), and any existing unallocated credit balance.
- `result`: an allocation record plus the loan's updated balances (see section 9).

The function is pure with respect to its inputs: it computes and returns the new state and the allocation. Whether it mutates `loan` in place or returns a new loan object is an implementation choice; the returned state must reflect all changes described here.

## 3. Monetary model, units and rounding

- Currency is Bahraini dinar (BHD), with 3 decimal places (fils). Every monetary value — balances, the payment, allocations and the credit balance — is a BHD amount with 3 dp.
- All amounts are rounded half-up to 3 dp.
- Any rounding residual left after allocation is absorbed into the **interest** component, never into principal.
- Implementations must avoid binary floating-point drift (use integer fils or a decimal type). Comparisons and "fully settled" tests are made at 3 dp precision.

## 4. Input validation

Validation runs before any allocation.

- **Negative payment**: rejected with an error. No allocation transaction is recorded and the loan is unchanged.
- **Non-numeric / malformed payment amount**: rejected with an error (treated as an invalid payment; same handling as a negative amount — no allocation, loan unchanged).
- **Zero payment**: a no-op. The loan balances are unchanged, but a zero-value allocation transaction **is** recorded (all component allocations zero).
- **Payment against a zero-balance loan** (nothing currently owed): a no-op. *(Engineering default, not stated policy: a zero-value allocation transaction is recorded, consistent with the zero-payment rule. The incoming amount, if positive, becomes unallocated credit under section 7, since there is nothing due to apply it to.)*

## 5. Component priority within an instalment

Within a single instalment, funds fill the four component buckets in this strict order:

1. **Fees**
2. **Penalties**
3. **Interest**
4. **Principal**

## 6. Order across instalments

Allocation is **oldest instalment first**. All four buckets of the oldest eligible instalment are cleared in full (fees, then penalties, then interest, then principal) before any funds touch the next instalment. Only once an instalment is fully settled across all four components does allocation move to the next-oldest eligible instalment.

### 6.1 Instalment eligibility

Only instalments that are **currently due or overdue** are eligible to receive funds. Payment does **not** flow into future instalments that have not yet fallen due. Once all due/overdue instalments are fully settled, any remaining funds become an unallocated credit balance (section 7) rather than pre-paying future instalments.

## 7. Partial allocation and shortfall

Partial allocation is allowed. The strict bucket order of sections 5 and 6 is always preserved, and each bucket is filled as far as the available funds allow before moving to the next bucket.

- There is **no** proportional splitting across components or instalments.
- There is **no** all-or-nothing rule: a bucket may be left partially filled when funds run out, and the next bucket simply receives nothing.
- When the payment is exhausted part-way through, allocation stops; all remaining component balances are left as they were (reduced by whatever was applied).

## 8. Surplus and the unallocated credit balance

- If the payment exceeds the total currently owed across all due/overdue instalments, the surplus is held as an **unallocated credit balance** on the loan.
- The credit is **never auto-refunded**.
- The credit is **auto-applied to the next instalment when that instalment falls due**. The trigger for applying credit is the instalment due date, not the arrival of a payment.

### 8.1 Interaction with an existing credit balance

When a payment arrives and the loan already holds an unallocated credit balance from a prior overpayment, the existing credit is **left untouched**. The incoming payment is allocated on its own; it is **not** combined with the existing credit for immediate allocation. The existing credit remains held until the next instalment falls due, consistent with the due-date trigger. *(Resolved as an engineering default: the stakeholder defined the credit trigger as the due date, not an inbound-payment event, and did not override this interaction.)*

Note: any surplus from the incoming payment adds to the unallocated credit balance. The behaviour above means a payment event itself never flushes held credit into instalments; only a due date does.

## 9. Output

The function returns:

1. **The allocation** — how this payment was applied, broken down per instalment and per component (fees, penalties, interest, principal), in the order applied. For a zero or no-op payment, this is a recorded zero-value allocation transaction.
2. **The loan's updated balances** — each instalment's four component balances after allocation, and the loan's unallocated credit balance after allocation.

Each allocation produces a transaction record (including the zero-value case described in section 4). An invalid (negative/non-numeric) payment produces an error and **no** transaction record.

## 10. Worked order of operations

For a valid, positive payment:

1. Validate the payment (section 4).
2. Identify due/overdue instalments and sort oldest first (section 6).
3. Starting with the oldest eligible instalment, fill fees → penalties → interest → principal, applying funds up to each bucket's outstanding balance and the funds remaining (sections 5, 7).
4. On fully settling an instalment, advance to the next-oldest eligible instalment and repeat.
5. When all due/overdue instalments are settled and funds remain, add the remainder to the unallocated credit balance (section 8). Do **not** touch future instalments or the pre-existing credit balance (sections 6.1, 8.1).
6. Apply rounding at 3 dp throughout, absorbing any residual into interest (section 3).
7. Record the allocation transaction and return the allocation plus updated balances (section 9).

## 11. Decisions explicitly settled

- Component priority: fees, penalties, interest, principal (stakeholder policy).
- Cross-instalment order: oldest first, settle fully before advancing (stakeholder policy).
- Surplus: held as unallocated credit, auto-applied at next due date, never auto-refunded (stakeholder policy).
- Partial allocation allowed; strict order preserved; no proportional split; no all-or-nothing (stakeholder policy).
- Currency BHD, 3 dp, round half-up, residual into interest (stakeholder policy).
- Negative payment rejected; zero payment no-op with zero transaction (stakeholder policy).
- Only due/overdue instalments eligible; no flow into future instalments (stakeholder policy).
- Zero-balance loan payment: no-op (stakeholder default).
- Incoming payment does not sweep in existing held credit; credit untouched until due date (engineering default, stakeholder-flagged as not explicit policy).
- Non-numeric payment handling, zero-value transaction on the zero-balance no-op, and in-place vs returned state: engineering defaults, flagged above.

## Auditor verdict

_The spec nails the inferable decisions and most of the bespoke monetary policy: bucket order (1), cross-instalment order (2), overpayment/credit handling (3), BHD 3-dp currency (4), half-up rounding (5), residual-into-interest (6), surplus-not-prepaying (8), strict-order partials (9), and zero/negative handling (11) are all correct — 9/14. The elicitation gap concentrates on the time/accrual decisions and the tolerance: back-valued value_date re-accrual (7), write-off tolerance (10), and penalty accrual timing (12) are entirely absent; same-day FIFO ordering (13) is not addressed; and the returned result shape (14) is largely right but omits the tolerance_written_off field because the tolerance concept itself was never surfaced. Coverage = 9/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Section 5: "1. Fees 2. Penalties 3. Interest 4. Principal" | Spec states the exact bucket order fees → penalties → interest → principal, matching the reference's deliberate fees-before-penalties ordering. |
| 2 | yes | **yes** | Section 6: "All four buckets of the oldest eligible instalment are cleared in full ... before any funds touch the next instalment." | Spec specifies oldest instalment settled fully across all four components before advancing, matching the reference exactly. |
| 3 | yes | **yes** | Section 8: surplus "held as an unallocated credit balance", "never auto-refunded", "auto-applied to the next instalment when that instalment falls due". | All three elements — credit balance, auto-apply at next due date, never auto-refunded — match the reference. |
| 4 | yes | **yes** | Section 3: "Currency is Bahraini dinar (BHD), with 3 decimal places (fils)." | Spec correctly identifies BHD as a 3-dp currency, matching the reference. |
| 5 | yes | **yes** | Section 3: "All amounts are rounded half-up to 3 dp." | Spec states round half-up to the 3-dp minor unit, matching the reference rounding method. |
| 6 | yes | **yes** | Section 3: "Any rounding residual left after allocation is absorbed into the interest component, never into principal." | Residual destination is interest, exactly as the reference specifies. |
| 7 | no | no | absent | The spec never mentions value_date, back-valued payments, or recomputing/re-accruing interest to an earlier value date before allocation. |
| 8 | yes | **yes** | Section 6.1 / Section 10 step 5: remaining funds "become an unallocated credit balance (section 7) rather than pre-paying future instalments." | Spec confines eligibility to due/overdue instalments and routes surplus to credit without prepaying principal, so future interest is unchanged, matching the reference. |
| 9 | yes | **yes** | Section 7: "There is no proportional splitting across components or instalments" and "each bucket is filled as far as the available funds allow." | Spec mandates strict in-order fill with no proportional split, matching the reference. |
| 10 | no | no | absent | No write-off tolerance is mentioned anywhere; there is no ≤ 0.005 BHD residual rule marking an instalment fully paid. Section 3's 3-dp 'fully settled' test is a precision statement, not a forgiveness tolerance. |
| 11 | yes | **yes** | Section 4: "Negative payment: rejected with an error"; "Zero payment: a no-op ... a zero-value allocation transaction is recorded." | Negative rejected with error, zero is a no-op that still records a zero-value transaction — both match the reference exactly. |
| 12 | no | no | absent | The spec does not address penalty accrual timing or whether penalties accrue up to and including the value date before allocation runs. |
| 13 | no | no | absent | Section 8.1 discusses not combining an incoming payment with existing credit, but the spec never addresses ordering of multiple same-day payments by receipt timestamp (FIFO), each allocated independently in turn. |
| 14 | yes | no | Section 9: returns the per-instalment per-component allocation, updated component balances, and the unallocated credit balance; no tolerance_written_off field. | Spec covers three of the four required output elements (per-bucket allocation, outstanding balances, credit_balance) but omits any tolerance_written_off element, since the write-off tolerance of #10 is absent; strictly it does not match the full reference shape. |
