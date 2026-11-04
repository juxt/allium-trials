# tessl — loan-schedule — iteration 2

Model (author): claude-opus · Questions asked: 6 · Captured: 8/14 · Bespoke captured: 2/6

## Conversation

### Round 1
_Step reasoning:_ Interest accrual convention is the highest-impact policy decision and cannot be reliably inferred, so I ask it first, one question at a time per the process.

Q: What day-count / interest accrual convention should each instalment's interest use — a fixed monthly rate of (annual nominal rate ÷ 12) applied to the outstanding balance, or actual-days-in-period over actual/365 (or 30/360), given that this drives every interest figure in the schedule?
A: Use a fixed monthly rate of (annual nominal rate ÷ 12) applied to the outstanding balance. The day-count convention is 30/360 — every month is treated as 30 days, the year as 360 — and interest is computed once per monthly period, not via daily accrual. Actual-days/actual-365 is not used for instalment interest.

### Round 2
_Step reasoning:_ Interest convention is settled; the amortisation method is the next highest-impact core-behaviour decision that cannot be inferred and drives every principal/interest split in the schedule.

Q: How is each instalment's total payment structured — a level (annuity/EMI) payment where every instalment is the same total amount and the principal/interest split shifts over the term, or equal-principal instalments where principal is a constant (principal ÷ term) and the total payment declines as the balance falls?
A: Equal-principal instalments: the principal portion is constant each period (P/n), interest is charged on the reducing balance, and the total instalment decreases over the term. Level/EMI amortisation is not used.

### Round 3
_Step reasoning:_ Day-count and amortisation are settled; rounding precision and residue reconciliation are the next highest-impact undecided policy, as they affect every figure and whether the balance closes to zero.

Q: To what precision is each instalment's interest and principal rounded (e.g. 2 decimal places / whole minor currency units), and how is the cumulative rounding residue reconciled so the closing balance reaches exactly zero — is the remainder absorbed into the final instalment's principal, or spread across instalments?
A: Each instalment is rounded to the whole shilling (no cents). Within each period, interest is computed and rounded first; principal is then the remainder of the rounded instalment for that period. The accumulated rounding difference is not spread across instalments — it is absorbed entirely into the final instalment, reconciling the closing balance to exactly zero.

### Round 4
_Step reasoning:_ Scope and core dates remain unresolved: the disbursement date is an input but the schedule's due-date generation and whether a first-period stub accrues are unspecified and cannot be safely inferred.

Q: Given the disbursement date is an input, how are the instalment due dates and the first interest period derived — is the first instalment due exactly one month after disbursement with every period treated as a full 30/360 month (so the disbursement date's day-of-month simply carries forward), or can the first period be a short/long 'stub' that accrues interest for the actual gap between disbursement and a fixed billing day before regular monthly instalments begin?
A: The first instalment is due exactly one month after the disbursement date, with the disbursement day-of-month carrying forward; subsequent instalments fall monthly on that same day-of-month. Every regular period is treated as a full 30/360 month. There is no fixed billing-day cycle and no short/long stub arising from alignment to one — the schedule is anchored entirely to the disbursement date, not to a calendar billing day.

### Round 5
_Step reasoning:_ Core policy traps (accrual, amortisation, rounding, date anchoring) are settled; the remaining boundary condition is the month-end day-of-month rollover, which is institution-specific and not resolved by 'day carries forward'.

Q: When the disbursement day-of-month is the 29th, 30th, or 31st and a subsequent month has no such day (e.g. disbursed on the 31st, due date lands in February), what due date does that instalment take — the last day of the shorter month, or does it roll forward into the next month?
A: Use the last day of the shorter month — for example, a loan disbursed on the 31st has its February instalment due on the 28th (or 29th in a leap year). The date does not roll forward into the next month. [default, not policy]

### Round 6
_Step reasoning:_ Rounding precision is fixed but the rounding mode is still unspecified and is a genuine institutional policy lever affecting every figure, so I ask one more bounded question before concluding.

Q: Round 3 established that each instalment is rounded to the whole shilling with interest rounded first — but which rounding mode applies to that per-period interest figure: round half up, round half to even (banker's rounding), or truncate toward zero? This changes individual interest and principal figures across the schedule and cannot be inferred.
A: Round half up (0.5 rounds to the next whole shilling). [default, not policy]

### Round 7 (process signalled done)
_Step reasoning:_ The material policy decisions — accrual convention, instalment structure, rounding precision and reconciliation, due-date derivation, month-end handling, and rounding mode — are all resolved, and the last two rounds returned defaults rather than institution-specific policy, signalling remaining questions are non-material; requirements gathering is complete.

(no questions this round)

## Produced specification

# Requirements specification: repayment schedule engine

Status: confirmed with stakeholder. Ready for spec authoring (`spec-writer`).

This specification records the requirements for `generate_schedule(loan)`, which produces the full repayment schedule for a disbursed loan. Every decision below was settled with the stakeholder through the requirement-gathering interview; nothing here is inferred beyond what the brief and the stakeholder answers state. Where an answer was flagged by the stakeholder as a default rather than a deliberate institutional policy, that is noted so downstream readers know its provenance, but it remains a confirmed requirement.

## Scope

### Included

- A function `generate_schedule(loan)` that returns the complete repayment schedule for a single disbursed loan.
- Input: a disbursed loan described by its principal, an annual nominal interest rate, a term expressed as a number of monthly instalments, and a disbursement date.
- Output: one row per instalment, each carrying the interest due, the principal due, and the running (outstanding) balance after the instalment, plus the instalment's due date.
- Interest computation, payment structuring, rounding and reconciliation, due-date derivation, and short-month handling as specified below.

### Excluded

- Fees, penalties, insurance, taxes, and any charges other than interest and principal.
- Early repayment, overpayment, arrears, restructuring, and any post-disbursement change to the loan.
- Variable or changing interest rates over the term; the annual nominal rate is fixed for the life of the loan.
- Currency conversion. Amounts are handled in a single currency (the shilling) at whole-unit precision.
- Persistence, presentation, and any calling or integration concerns beyond returning the schedule.

## Core behaviour (happy path)

Given a loan with principal P, annual nominal interest rate r, term n monthly instalments, and disbursement date D, the engine produces n instalments using an equal-principal (reducing-balance) structure.

1. **Interest accrual convention.** Interest for each instalment is computed once per monthly period as a fixed monthly rate applied to the outstanding balance at the start of that period. The monthly rate is the annual nominal rate divided by 12 (r / 12). The day-count convention is 30/360: every month is treated as 30 days and the year as 360 days. Interest is not accrued daily, and actual-days / actual-365 is never used.

2. **Payment structure — equal principal.** The principal portion of each instalment is constant across the term, equal to the principal divided by the number of instalments (P / n). Interest is charged on the reducing balance, so the total instalment (principal portion plus interest) declines over the term as the balance falls. Level/annuity/EMI amortisation is not used.

3. **Per-instalment computation and rounding.** All amounts are expressed in whole shillings; there are no cents. For each period, in order:
   - Compute the interest on the outstanding balance and round it to the whole shilling first.
   - The principal portion for the period is then derived so that the rounded instalment reconciles to the whole shilling (principal taken as the remainder of the rounded instalment for that period).
   - Reduce the outstanding balance by the principal portion to give the running balance carried into the next period.

   The rounding mode for the per-period interest figure is round half up: a residue of exactly 0.5 shilling rounds up to the next whole shilling. (Stakeholder noted this as a default rather than a deliberate policy, but it is confirmed.)

4. **Rounding reconciliation.** The accumulated rounding difference across the schedule is not spread across instalments. It is absorbed entirely into the final instalment's principal, so that the closing balance after the final instalment is exactly zero.

5. **Due-date derivation.** The schedule is anchored entirely to the disbursement date, not to any calendar billing day. The first instalment is due exactly one month after the disbursement date, carrying the disbursement day-of-month forward. Each subsequent instalment falls one month after the previous, on that same day-of-month. Every regular period is treated as a full 30/360 month for interest. There is no fixed billing-day cycle and no short or long first-period stub.

## Edge cases and boundary conditions

- **Short months and the 29th/30th/31st.** When the disbursement day-of-month is the 29th, 30th, or 31st and a later month has no such day, that instalment's due date is the last day of the shorter month. For example, a loan disbursed on the 31st takes a February due date of the 28th, or the 29th in a leap year. The date never rolls forward into the following month. Interest for such a period is still computed as a full 30/360 month; the short-month rule affects only the due date, not the interest figure. (Stakeholder noted this as a default rather than a deliberate policy, but it is confirmed.)

- **Final instalment.** The final instalment carries whatever principal is required to bring the outstanding balance to exactly zero, absorbing the entire accumulated rounding residue. Its interest is computed and rounded on the reducing balance in the same way as every other period; only its principal portion is adjusted for reconciliation.

- **Rounding residue direction.** Because interest is rounded half up first and principal is the remainder, per-period residues may accumulate in either direction over the term; all of it lands in the final instalment regardless of sign.

## Constraints

- **Precision.** All monetary outputs (interest, principal, running balance) are whole shillings. No sub-unit (cent) precision is exposed or retained in the schedule.
- **Determinism.** For identical inputs the schedule is fully deterministic: fixed monthly rate, 30/360 day count, equal-principal structure, interest-rounded-first with round-half-up, and final-instalment reconciliation together fix every figure.
- **Zero closing balance.** The running balance after the last instalment must be exactly zero.
- **Compatibility / integration.** No integration points beyond the `generate_schedule(loan)` interface were specified, and none are assumed.

## Items resolved by process default (not stakeholder policy)

Recorded for traceability. Both were answered by the stakeholder and are binding, but flagged as defaults rather than deliberate institutional choices:

- Short-month due dates use the last day of the shorter month (round 5).
- Per-period interest rounding uses round half up (round 6).

No requirement outside the brief and the stakeholder answers has been invented. Any decision not covered above (for example, input validation rules, handling of a zero or negative principal, or non-integer terms) was neither raised in the brief nor settled in the interview and is therefore out of scope for this specification until raised with the stakeholder.

## Auditor verdict

_The spec correctly resolves 8 of 14 decisions (1, 2, 3, 4, 7, 8, 9, 13), all core happy-path and rounding mechanics. It fails 6: precision #6 (whole shilling instead of 2 dp KES), first-period stub #5 (explicitly denies the required stub, the opposite answer), Rule-of-78 rebate #10 and partial-prepayment re-amortisation #11 (both explicitly excluded from scope), zero/negative validation #12 (named but deferred out of scope rather than rejected), and output disclosure #14 (schedule shape present but total cost of credit and actual/365 APR disclosure omitted). Coverage = 8/14. The engineer captured the bespoke amortisation, day-count, calculation-period and rounding-order policies but missed the temporal stub, both post-disbursement method policies, and the dual day-count disclosure quirk._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Interest is charged on the reducing balance" (Payment structure); "a fixed monthly rate applied to the outstanding balance at the start of that period" (Interest accrual convention). | The spec explicitly uses declining/reducing balance on the outstanding principal, matching the reference. |
| 2 | yes | **yes** | "an equal-principal (reducing-balance) structure... The principal portion of each instalment is constant across the term, equal to the principal divided by the number of instalments (P / n)... the total instalment... declines over the term... Level/annuity/EMI amortisation is not used." | Exact match: constant P/n principal, interest on reducing balance, decreasing instalment, EMI explicitly excluded. |
| 3 | yes | **yes** | "The day-count convention is 30/360: every month is treated as 30 days and the year as 360 days... actual-days / actual-365 is never used." | Exact match to the reference 30/360 convention, with actual/365 explicitly rejected. |
| 4 | yes | **yes** | "Interest for each instalment is computed once per monthly period... Interest is not accrued daily". | Matches: interest computed once per repayment period, not daily accrual. |
| 5 | yes | no | "The first instalment is due exactly one month after the disbursement date... There is no fixed billing-day cycle and no short or long first-period stub." | The reference requires interest to accrue from disbursement with a stub charge for extra days before the first period; the spec explicitly denies any stub, so the resolution is the opposite of the reference. |
| 6 | yes | no | "Amounts are handled in a single currency (the shilling) at whole-unit precision"; "All monetary outputs... are whole shillings." | The reference specifies 2 decimal places (KES); the spec mandates whole-shilling precision with no cents, contradicting the 2 dp requirement. Currency (shilling) matches but precision does not, so not correct. |
| 7 | yes | **yes** | "each instalment is rounded to the whole shilling"; "The accumulated rounding difference... is absorbed entirely into the final instalment's principal, so that the closing balance... is exactly zero." | Matches both parts of the reference: whole-shilling instalments and the accumulated residue settled in the final instalment. |
| 8 | yes | **yes** | "Compute the interest on the outstanding balance and round it to the whole shilling first. The principal portion... is then derived so that the rounded instalment reconciles... (principal taken as the remainder of the rounded instalment...)". | Exact match: interest computed and rounded first, principal is the remainder. |
| 9 | yes | **yes** | "the closing balance after the final instalment is exactly zero"; "The running balance after the last instalment must be exactly zero." | Matches the reference requirement of exactly zero closing balance. |
| 10 | no | no | "Excluded: ... Early repayment, overpayment, arrears, restructuring, and any post-disbursement change to the loan." | Early full settlement rebate (Rule of 78) is explicitly excluded from scope, so the decision is neither surfaced nor resolved. |
| 11 | no | no | "Excluded: ... Early repayment, overpayment... and any post-disbursement change to the loan." | Partial prepayment and re-amortisation are explicitly out of scope; not addressed. |
| 12 | yes | no | "Any decision not covered above (for example, input validation rules, handling of a zero or negative principal, or non-integer terms) was neither raised... and is therefore out of scope". | The spec names zero/negative principal but explicitly defers it as out of scope rather than resolving it as rejected/invalid, so it is not correctly resolved to the reference answer. |
| 13 | yes | **yes** | "The first instalment is due exactly one month after the disbursement date... Each subsequent instalment falls one month after the previous, on that same day-of-month." | Exact match: first due date is disbursement + one month, monthly thereafter. |
| 14 | yes | no | Output: "one row per instalment, each carrying the interest due, the principal due, and the running (outstanding) balance... plus the instalment's due date." No total cost of credit or APR disclosure mentioned. | The spec covers the per-period schedule (partial match on shape) but omits the total cost of credit and the actual/365-basis disclosed APR quirk, so the full reference resolution is not stated. |
