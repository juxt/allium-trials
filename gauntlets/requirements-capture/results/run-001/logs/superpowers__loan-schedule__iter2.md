# superpowers — loan-schedule — iteration 2

Model (author): claude-opus · Questions asked: 10 · Captured: 7/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ Architectural path: asking clarifying questions one at a time, starting with the amortisation method — the most consequential omitted policy that cannot be inferred.

Q: Before I sketch the design, one key decision: how should each instalment be shaped? The two common conventions are (a) a fixed equal total payment each month (an annuity, where interest and principal split shifts over the term) or (b) equal principal each month with interest on the declining balance (so the total payment falls over time). Which does this product use?
A: Equal principal each month with interest on the declining balance, so the total instalment decreases over the term.

### Round 2
_Step reasoning:_ Instalment shape is settled; the next decisive, non-inferable policy is the interest accrual basis and whether the disbursement date creates an irregular first period, so I ask that one question.

Q: For the interest on each instalment, how is the periodic rate derived from the annual nominal rate, and does the disbursement date affect the first period? Specifically: (a) a flat monthly rate of annual/12 applied to the outstanding balance, with equal calendar periods and the disbursement date only setting the payment day; or (b) actual-days accrual (e.g. actual/365) where the gap between disbursement and the first instalment can differ from a whole month, producing a longer or shorter first period?
A: Option (a): the periodic rate is the annual nominal rate divided by 12, applied once per monthly period using a 30/360 day-count (every month is treated as 30 days, the year as 360). The disbursement date sets the payment day — the first instalment falls exactly one month after disbursement, and subsequent instalments monthly thereafter. However, if the disbursement date precedes the nominal start of the first period, a stub interest charge is levied for those extra days at the same daily rate (annual/360), so the first collection may include a partial-period interest amount on top of the regular instalment. There is no actual-days accrual between regular periods.

### Round 3
_Step reasoning:_ Instalment shape and interest accrual are pinned down; rounding precision, mode, and residual reconciliation remain unspecified and materially change every schedule row, so I ask that before writing the spec.

Q: How should monetary amounts be rounded, and where does the accumulated rounding residual land? Specifically: (a) each instalment's interest and principal are rounded to 2 decimal places (the minor currency unit) as computed, and any cumulative rounding difference is absorbed into the final instalment so the closing balance is exactly zero; or (b) some other convention (e.g. carry fractional cents forward, round only the total, or round half-up vs banker's rounding)? Please state the decimal precision, the rounding mode (half-up, half-even, truncate), and how the last instalment reconciles the balance to zero.
A: Amounts are in KES. Each instalment is rounded to the whole shilling — no cents. Within a period, interest is computed and rounded first; principal is the remainder of the rounded instalment (not rounded independently). The rounding mode is half-up. The accumulated rounding difference across all periods is reconciled in the final instalment, which is adjusted so the closing balance is exactly zero.

### Round 4
_Step reasoning:_ The big three policies (amortisation type, rate/day-count/stub, rounding) are captured, but round 3's 'principal is the remainder of the rounded instalment' wording fits an annuity and conflicts with the equal-principal method chosen in round 1; this must be resolved before specifying.

Q: One computational detail on the equal-principal method, to reconcile it with the rounding rule you gave: in an equal-principal schedule the scheduled principal is the same every period (principal / term), not a residual of a fixed total. So how is the per-period principal derived and rounded? Specifically — (a) the scheduled principal each period is `round_half_up(principal / term)` to the whole shilling, held constant, and the interest for the period (`round_half_up(balance × monthly rate)`) is added on top to form that period's total instalment (total therefore declines as the balance falls), with all accumulated rounding drift — from both the principal division and the interest rounding — swept into the final instalment so the closing balance is exactly zero; or (b) some other allocation (e.g. principal recomputed each period as the whole-shilling remainder of a rounded total instalment, as your round-3 wording implied)? Please confirm which, since the two produce different principal columns.
A: Option (a). The scheduled principal each period is `round_half_up(principal / term)`, held constant across all regular periods. Interest for the period is computed on the opening balance and rounded independently (`round_half_up(balance × monthly_rate)`). The two rounded amounts are summed to form that period's total instalment, which therefore declines over the term as the interest component falls. Accumulated rounding drift from both the principal division and the per-period interest rounding is swept into the final instalment, which is adjusted so the closing balance is exactly zero. The round-3 phrasing about principal being 'the remainder' described the rounding order within a period (interest rounded first, principal not rounded again independently) rather than implying a fixed total instalment from which principal is derived as a residual.

### Round 5
_Step reasoning:_ The stub interest introduced in round 2 has a self-contradictory trigger and unspecified day-count, balance, and rounding treatment — a material, non-inferable policy that must be pinned down before specifying.

Q: Let's nail down the stub interest, since its trigger is still ambiguous. You said the first instalment falls exactly one month after disbursement, yet a stub is levied 'if the disbursement date precedes the nominal start of the first period' — which reads as contradictory. Please define precisely: (1) What fixes the 'nominal start of the first period' against which the disbursement date is compared (e.g. a scheduled anchor day such as the 1st of the month, a product-wide cycle date, or the borrower's chosen payment day)? (2) Under what exact condition does a stub period exist, and how are its days counted under 30/360 (e.g. 30-minus-day-of-month, actual days capped at 30)? (3) The stub interest is charged at the daily rate (annual/360) on what balance — the full disbursed principal? (4) Is the stub amount interest-only, added on top of the first regular instalment's total (leaving that instalment's scheduled principal unchanged), and is it rounded to the whole shilling half-up like the other interest amounts and included in the final-instalment drift reconciliation?
A: The answer key does not define a separate nominal-period-start anchor independently of the disbursement date. Item 13 states the first due date is disbursement date plus one month, and item 5 states a stub is levied if disbursement precedes the first period start — but the key does not resolve what fixes that start (e.g. a product-wide cycle day such as the 1st of the month, or a borrower-chosen payment day). This is an open policy decision you need to confirm. [default, not policy: a common implementation treats the nominal period start as a fixed calendar anchor — e.g. the 1st of the month following disbursement — so any days from disbursement to that anchor constitute the stub.]

### Round 6
_Step reasoning:_ The stakeholder explicitly flagged the stub-interest trigger as an unresolved policy decision requiring confirmation, so the design brief is not yet complete and I must not invent the answer.

Q: On the stub interest, which you've now flagged as an open policy decision, please confirm the following so I can capture it correctly: (1) What fixes the 'nominal start of the first period' against which the disbursement date is compared — a fixed product-wide calendar anchor (e.g. the 1st of the month following disbursement), the borrower's chosen payment day, or something else? (2) Given first due date = disbursement + one month, under what exact condition does a stub period exist, and how are its days counted under 30/360 (e.g. 30 minus day-of-month, or actual days capped at 30)? (3) The stub interest at the daily rate (annual/360) is charged on what balance — the full disbursed principal? (4) Is the stub amount interest-only, added on top of the first regular instalment (leaving that instalment's scheduled principal unchanged), rounded to the whole shilling half-up like other interest, and included in the final-instalment drift reconciliation?
A: Fixed product-wide calendar anchor: the 1st of the month following the disbursement month (or the 1st of the current month if the loan is disbursed on the 1st). This is the nominal period start — the value date — from which regular monthly periods run. The first regular instalment is due on the 1st of the month after that anchor (value date plus one month). Item 13's 'disbursement plus one month' describes the no-stub case where disbursement falls on the 1st, making value date and disbursement date coincide.

### Round 7
_Step reasoning:_ Round 6 fixed the nominal-period-start anchor but left the stub's day-count, charging balance, interest-only treatment, and rounding/drift handling unconfirmed; these must be nailed down before the schedule can be computed correctly.

Q: Thanks — that fixes the anchor. To finish capturing the stub, please confirm its mechanics now that the value date is defined: (1) How are the stub days counted under 30/360 between the disbursement date and the value date — 30 minus the day-of-month of disbursement, actual days capped at 30, or another rule? (2) The stub interest at the daily rate (annual/360) is charged on which balance — the full disbursed principal? (3) Is the stub amount interest-only, added on top of the first regular instalment's total (leaving that instalment's scheduled principal unchanged)? (4) Is it rounded to the whole shilling half-up like the other interest amounts, and is it included in the final-instalment drift reconciliation that forces the closing balance to exactly zero?
A: Under 30/360, the stub days are 30 minus the day-of-month of disbursement (e.g. disbursed on the 15th gives 30 − 15 = 15 stub days). This follows directly from the 30/360 convention — each month is notionally 30 days, so the remaining days from the disbursement day to the end of that notional month are 30 − D. The answer key states the 30/360 convention but does not enumerate the stub-day formula separately; this is the standard derivation from it.

### Round 8
_Step reasoning:_ Round 7 answered only the stub-day formula; the stub's balance base, its interest-only additive treatment, and its rounding/reconciliation are still unconfirmed and cannot be inferred safely.

Q: Now that stub-day counting is fixed (30 minus day-of-month of disbursement), three stub mechanics from my last question are still unconfirmed. (1) The stub interest at the daily rate (annual/360) is charged on which balance — the full disbursed principal, for the counted stub days? (2) Is the stub amount interest-only, added on top of the first regular instalment's total, leaving that instalment's scheduled principal (round_half_up(principal/term)) unchanged? (3) Is the stub interest rounded to the whole shilling half-up like the other interest amounts, and is it folded into the same final-instalment drift reconciliation that forces the closing balance to exactly zero?
A: The stub interest is charged on the full disbursed principal — no principal has been repaid before the value date, so that is the only balance available. [The answer key states interest accrues from the disbursement date and that a stub charge is levied for those extra days, implying the full disbursed amount; it does not enumerate this separately, so treat as derived from policy rather than an explicit key entry.]

### Round 9
_Step reasoning:_ The round-8 answer confirmed only the stub balance (full disbursed principal); the interest-only-on-top treatment and the stub's rounding/drift-reconciliation handling remain unconfirmed and are material to the principal and final-instalment columns.

Q: Two stub mechanics from my previous question are still unconfirmed. (1) Is the stub amount interest-only, added on top of the first regular instalment's total, leaving that instalment's scheduled principal (round_half_up(principal/term)) unchanged? Or does the stub alter the first period's principal in any way? (2) Is the stub interest rounded to the whole shilling half-up like the other interest amounts, and is it folded into the same final-instalment drift reconciliation that forces the closing balance to exactly zero (rather than reconciled separately or left unrounded)?
A: The stub amount is interest-only, added on top of the first regular instalment's total. The first instalment's scheduled principal remains round_half_up(principal/term), unchanged by the stub.

### Round 10
_Step reasoning:_ Round 9 confirmed the stub is interest-only on top of the first instalment but left its rounding mode and its treatment in the final-instalment drift reconciliation unanswered; that is the last open policy detail before the design is fully specified.

Q: One stub mechanic remains unconfirmed from my previous question: is the stub interest rounded to the whole shilling half-up like the other interest amounts, and is it folded into the same final-instalment drift reconciliation that forces the closing balance to exactly zero — rather than reconciled separately, added unrounded, or left outside the closing-balance adjustment?
A: The stub interest is rounded to the whole shilling half-up, consistent with all other interest amounts. It is folded into the same final-instalment drift reconciliation that forces the closing balance to exactly zero — it is not reconciled separately, left unrounded, or excluded from the closing-balance adjustment.

### Round 11 (process signalled done)
_Step reasoning:_ All material policy decisions are now confirmed — instalment shape (equal principal, declining balance), periodic rate and 30/360 day-count, whole-shilling half-up rounding with interest-first allocation, constant scheduled principal, stub trigger/anchor/day-count/balance/interest-only treatment, and stub rounding folded into the final-instalment drift reconciliation — so requirements capture is complete.

(no questions this round)

## Produced specification

# Repayment schedule engine — design specification

## Purpose

Generate the full repayment schedule for a disbursed loan under this institution's policy. Given a loan (principal, annual nominal interest rate, term in monthly instalments, disbursement date), `generate_schedule(loan)` returns the schedule: for each instalment, the interest due, the principal due, the total instalment, and the running (closing) balance. The final closing balance must be exactly zero.

This spec captures the policy decisions confirmed with the stakeholder. It is the single source of truth for the computation. Anything not stated here as confirmed policy is resolved by the explicitly-labelled defaults in the "Resolved by default" section; no stakeholder answer has been invented beyond what was given.

## Interface

```
generate_schedule(loan) -> schedule
```

**Input `loan`** has at least:
- `principal` — disbursed amount, in KES.
- `annual_rate` — annual nominal interest rate (e.g. 0.24 for 24%).
- `term` — number of monthly instalments (a positive integer).
- `disbursement_date` — the date the loan was disbursed.

**Output `schedule`** is an ordered list of `term` instalment rows. Each row carries:
- `period` — 1-based instalment index.
- `due_date` — the calendar date the instalment is collected.
- `opening_balance` — balance at the start of the period.
- `interest` — interest due for the period, whole shillings.
- `principal` — principal due for the period, whole shillings.
- `instalment` — total collected in the period (`interest + principal`, plus the stub charge on period 1 where applicable), whole shillings.
- `closing_balance` — balance after the period.

The closing balance of the last row is exactly `0`.

## Amortisation method

Equal-principal with interest on the declining balance. The scheduled principal is the same every regular period; interest is charged on the outstanding balance and falls as the balance declines, so the total instalment **decreases** over the term. This is not an annuity (equal-total-payment) schedule.

## Rate and day-count

- **Periodic rate.** The monthly rate is `annual_rate / 12`, applied once per monthly period. There is no actual-days accrual between regular periods.
- **Day-count.** 30/360: every month is treated as 30 days and the year as 360 days. The daily rate, used only for the stub, is `annual_rate / 360`.
- **Schedule cadence.** Regular monthly periods run from the value date (defined below). The first regular instalment is due one month after the value date, and subsequent instalments monthly thereafter.

## Currency and rounding

- Amounts are in **KES**, rounded to the **whole shilling** — no cents.
- Rounding mode is **half-up** everywhere.
- **Order within a period.** Interest is computed and rounded first. Scheduled principal is a separately-derived rounded amount (see below); it is not re-rounded as a residual of the total.
- All accumulated rounding drift is swept into the **final instalment**, which is adjusted so the closing balance is exactly zero.

## Per-period amounts (regular periods)

For each regular period:

- **Scheduled principal** = `round_half_up(principal / term)`, held **constant** across all regular periods.
- **Interest** = `round_half_up(opening_balance * monthly_rate)`, where `monthly_rate = annual_rate / 12` and `opening_balance` is the balance at the start of the period.
- **Total instalment** = scheduled principal + interest (plus the stub on period 1 where applicable). Because the interest component falls as the balance declines, the total instalment declines over the term.

The running balance reduces by the scheduled principal each regular period (the interest is a charge, not a balance reduction). Rounding drift arises from two sources — the principal division `round_half_up(principal / term)` not dividing evenly, and the per-period interest rounding — and both are reconciled in the final instalment.

### Final-instalment reconciliation

The last period's principal is set to whatever clears the remaining balance to exactly zero, absorbing all accumulated drift from principal division, per-period interest rounding, and the stub. Its interest is still `round_half_up(opening_balance * monthly_rate)`; its total instalment is the reconciled principal plus that interest. After it, `closing_balance == 0`.

## Value date and the stub period

The disbursement date does not by itself start the regular periods; a fixed product-wide calendar anchor does.

- **Value date (nominal period start).** The 1st of the month **following** the disbursement month. If the loan is disbursed on the 1st, the value date is the 1st of the current month, so value date and disbursement date coincide. Regular monthly periods run from the value date; the first regular instalment is due one month after it.
- **When a stub exists.** A stub period exists when the disbursement date precedes the value date, i.e. when disbursement falls on any day after the 1st. Disbursement on the 1st produces no stub (value date equals disbursement date).
- **Stub days.** Under 30/360, stub days = `30 - D`, where `D` is the day-of-month of disbursement. (E.g. disbursed on the 15th gives `30 - 15 = 15` stub days.)
- **Stub balance.** The stub interest is charged on the **full disbursed principal**; no principal has been repaid before the value date.
- **Stub amount.** `stub_interest = round_half_up(principal * (annual_rate / 360) * stub_days)`, half-up to the whole shilling, consistent with all other interest amounts.
- **How the stub is applied.** The stub is **interest-only**. It is added on top of the **first regular instalment's total**. It does not change the first period's scheduled principal, which remains `round_half_up(principal / term)`.
- **Reconciliation.** The stub interest is folded into the **same** final-instalment drift reconciliation that forces the closing balance to exactly zero. It is not reconciled separately, added unrounded, or excluded from the closing-balance adjustment.

## Worked shape of period 1

- Interest = `round_half_up(principal * monthly_rate)`.
- Scheduled principal = `round_half_up(principal / term)`.
- Stub interest = `round_half_up(principal * (annual_rate / 360) * (30 - D))` when `D > 1`, else `0`.
- Total instalment (period 1) = scheduled principal + interest + stub interest.
- Closing balance = principal - scheduled principal.

## Data flow

1. Derive the value date from the disbursement date; determine whether a stub exists and, if so, the stub days and stub interest.
2. Compute the constant scheduled principal `round_half_up(principal / term)`.
3. Walk periods 1..term: for each, take the opening balance, compute rounded interest, apply the constant scheduled principal, add the stub interest on period 1, record the row, and reduce the balance by the scheduled principal.
4. At the final period, replace the scheduled principal with the exact residual that drives the closing balance to zero, absorbing all drift including the stub.
5. Return the ordered rows.

## Testing

- **No-stub case** (disbursed on the 1st): value date equals disbursement date; first due date is one month later; no stub charge; total instalments strictly decline; closing balance exactly zero.
- **Stub case** (disbursed mid-month): stub days = `30 - D`; stub interest charged on full principal at `annual_rate / 360`; the stub rides on period 1's total only, leaving period 1's scheduled principal unchanged; closing balance exactly zero.
- **Rounding reconciliation**: principal that does not divide evenly by term still closes to zero, with all drift landing in the final instalment; the final interest is still `round_half_up(opening_balance * monthly_rate)`.
- **Invariants across every schedule**: exactly `term` rows; sum of principal columns (including the reconciled final principal) equals the disbursed principal; each regular scheduled principal equals `round_half_up(principal / term)`; total instalment is non-increasing after period 1 (period 1 may be higher because of the stub).

## Resolved by default (not confirmed by the stakeholder)

These details were neither in the brief nor settled in the conversation. They are resolved here so the function is well-defined; each is flagged as a default rather than confirmed policy, and should be revisited if it matters.

- **Due-date calendar arithmetic** (month-end handling when adding months, e.g. a value date that would fall on a non-existent day) follows normal calendar month addition; no confirmed month-end rule was given.
- **Input validation** (rejecting non-positive principal, non-positive term, or negative rate) is treated as a precondition on `loan`; behaviour on invalid input is not specified by policy.
- **Zero-rate loans** yield zero interest and zero stub interest; the equal-principal reconciliation still forces the closing balance to zero.
- **Representation**: monetary values are whole-shilling integers in the output; no fractional-cent field is carried, consistent with the whole-shilling rounding policy.

No stakeholder answers have been invented beyond the confirmed rounds above.

## Auditor verdict

_The spec strongly captures the core computation-method and rounding decisions it was given: interest method (1), equal-principal amortisation (2), 30/360 day-count (3), per-period interest calculation (4), the disbursement-date stub (5), whole-shilling instalment rounding with drift swept to the final instalment (7), and exact zero closing (9) are all surfaced and correct. It fails on the decisions outside pure schedule generation and on two subtler policy points: currency precision is set to whole-shilling rather than the reference's 2 dp (6); within-period order derives principal independently instead of as the instalment remainder (8); first due date is anchored to the 1st-of-following-month value date rather than disbursement+1 month (13); output omits total cost of credit and the actual/365 disclosed APR (14); and prepayment/rebate/validation policies are absent or deferred (10, 11, 12). Coverage = 7/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Equal-principal with interest on the declining balance... interest is charged on the outstanding balance and falls as the balance declines"; "Interest = round_half_up(opening_balance * monthly_rate)" | Spec states interest is computed on the declining/outstanding balance, matching the reducing-balance interest method. |
| 2 | yes | **yes** | "The scheduled principal is the same every regular period... the total instalment decreases over the term. This is not an annuity (equal-total-payment) schedule." Scheduled principal = round_half_up(principal / term). | Spec explicitly picks equal-principal (constant P/n), interest on reducing balance, declining total instalment, and rules out EMI — exactly the reference answer. |
| 3 | yes | **yes** | "Day-count. 30/360: every month is treated as 30 days and the year as 360 days." | Exact match to the 30/360 convention. |
| 4 | yes | **yes** | "The monthly rate is annual_rate / 12, applied once per monthly period. There is no actual-days accrual between regular periods." | Interest is computed once per monthly (repayment) period, not by daily accrual — matches the reference. |
| 5 | yes | **yes** | "A stub period exists when the disbursement date precedes the value date... stub_interest = round_half_up(principal * (annual_rate / 360) * stub_days)... The stub is interest-only." | Spec charges partial-period interest from disbursement (day D) through the period start, i.e. interest accrues from the disbursement date with a stub charge for the extra days — matches the reference. |
| 6 | yes | no | "Amounts are in KES, rounded to the whole shilling — no cents."; "monetary values are whole-shilling integers in the output; no fractional-cent field is carried" | Currency (KES) matches, but the reference precision is 2 decimal places whereas the spec adopts whole-shilling / 0 decimal places and explicitly carries no cents, so the stated precision contradicts the reference value. |
| 7 | yes | **yes** | "Amounts are in KES, rounded to the whole shilling — no cents."; "All accumulated rounding drift is swept into the final instalment, which is adjusted so the closing balance is exactly zero." | Each instalment rounds to the whole shilling and the accumulated rounding difference is settled in the final instalment — exact match. |
| 8 | yes | no | "Interest is computed and rounded first. Scheduled principal is a separately-derived rounded amount (see below); it is not re-rounded as a residual of the total." | Spec matches the 'interest first' half but explicitly rejects the reference's second clause: the reference makes principal the remainder of the rounded instalment, while the spec derives principal independently (round(P/term)) and states it is NOT a residual of the total. Direct contradiction. |
| 9 | yes | **yes** | "The final closing balance must be exactly zero."; "the final instalment... adjusted so the closing balance is exactly zero." | Final instalment reconciles the schedule to a closing balance of exactly zero — matches. |
| 10 | no | no | absent | The spec covers only schedule generation; there is no mention of early full settlement, unearned-interest rebate, or the Rule of 78. |
| 11 | no | no | absent | No treatment of partial prepayment, principal application, or re-amortisation strategy (fixed term vs fixed instalment) appears anywhere in the spec. |
| 12 | yes | no | "Input validation (rejecting non-positive principal, non-positive term, or negative rate) is treated as a precondition on loan; behaviour on invalid input is not specified by policy." | The spec raises invalid input but explicitly declines to resolve it, treating it as an unspecified precondition rather than stating rejection-with-error as the reference requires. |
| 13 | yes | no | "The first regular instalment is due one month after the value date", where value date = "the 1st of the month following the disbursement month". | Reference first due date is disbursement date + one month; the spec anchors it to a value date on the 1st of the following month, so the first due date generally differs from disbursement+1 month (coinciding only when disbursed on the 1st). |
| 14 | yes | no | Output row carries "period, due_date, opening_balance, interest, principal, instalment, closing_balance"; no total cost of credit and no APR/disclosure clause present (absent). | The per-period schedule shape matches, but the spec omits both the total cost of credit and the disclosed APR on an actual/365 basis — the bespoke, non-obvious disclosure quirk — so the decision is not fully or correctly resolved. |
