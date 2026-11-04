# tessl — loan-schedule — iteration 1

Model (author): claude-opus · Questions asked: 7 · Captured: 14/14 · Bespoke captured: 6/6

## Conversation

### Round 1
_Step reasoning:_ Following the one-question-at-a-time rule, I start with the highest-impact scope question: the amortisation method determines the entire structure of the schedule and cannot be reliably inferred.

Q: Which amortisation method should the schedule use: equal total instalments (annuity/French method, where each payment is the same and the principal/interest split changes over time), equal principal per instalment (with declining total payments), or something else?
A: Equal principal per instalment: a constant principal portion each period (P/n), with interest calculated on the reducing balance, so the total instalment decreases over the term.

### Round 2
_Step reasoning:_ Amortisation method is settled; the next highest-impact unknown is how the periodic interest rate is derived from the annual nominal rate, which materially changes every interest figure.

Q: When you compute the interest for each instalment on the reducing balance, how is the periodic interest rate derived from the annual nominal rate: a fixed monthly rate of (annual rate / 12) applied uniformly to every period, or a day-count method (for example actual days in the period over 365, or a 30/360 convention) that varies with the calendar length of each period?
A: A 30/360 day-count convention: every month counts as 30 days and the year as 360, giving a fixed periodic rate of (annual rate / 12) applied uniformly to every period. Not actual/365 or actual-days-based.

### Round 3
_Step reasoning:_ Amortisation method and rate convention are settled; the next material, non-inferable policy is monetary rounding and how the residual is reconciled so the balance closes to zero.

Q: Since equal principal (P/n) rarely divides into a whole number of currency units, how should rounding work: round each period's principal and interest to the minor currency unit (e.g. 2 decimal places) and absorb any accumulated rounding residual into the final instalment so the balance closes exactly at zero, or carry full unrounded precision throughout and only round for display?
A: Round each instalment to the whole shilling (no cents); interest is computed and rounded first, principal is the remainder for that period. The accumulated rounding difference is absorbed into the final instalment so the closing balance is exactly zero.

### Round 4
_Step reasoning:_ Core computation rules are settled; the disbursement date's role in setting due dates and first-period interest is the next material, non-inferable policy gap.

Q: The brief lists the disbursement date as an input, but nothing so far consumes it. How does it drive the schedule: is the first instalment due exactly one month after disbursement (with every period treated as a full 30/360 month, so the disbursement date only sets the due-date calendar), or is there a stub/odd first period where interest accrues from the disbursement date to the first due date over a different number of days?
A: The first instalment is due exactly one month after the disbursement date, and subsequent instalments follow monthly thereafter, so disbursement sets the due-date calendar. However, if disbursement precedes the first period start, a stub interest charge is levied for those extra days — partial-period interest is computed and charged for that odd interval before the regular schedule begins.

### Round 5
_Step reasoning:_ Round 4 introduced a stub interest charge but left its day-count basis and how it surfaces in the schedule unspecified — a material, institution-specific policy that cannot be safely inferred.

Q: For the stub interest on the odd days between disbursement and the first period start: how is that partial-period interest computed and represented — is the daily rate derived as (annual rate / 360) charged over the actual number of calendar days in the stub, and is the resulting stub interest added to (collected within) the first instalment, or does it appear as a separate schedule line with zero principal?
A: The daily rate for the stub is (annual rate / 360), consistent with the 30/360 convention, applied over the actual calendar days between the disbursement date and the first period start. How the stub charge is represented in the output is [default, not policy]: it appears as a separate schedule line dated on the disbursement date, with zero principal, showing only the stub interest as the instalment — keeping the regular monthly schedule unmodified from period 1 onward.

### Round 6
_Step reasoning:_ All five material policy decisions are settled; per the process I now present the summary for explicit stakeholder approval and surface any remaining validation/grace-period gaps before completing.

Q: Before I hand these off to the spec author, please confirm this summary is complete and accurate. SCOPE: generate_schedule(loan) produces the full repayment schedule (per-instalment interest, principal, running balance) from principal, annual nominal rate, term in monthly instalments, and disbursement date. CORE BEHAVIOUR: equal-principal amortisation — constant principal P/n each period with interest on the reducing balance; 30/360 day-count giving a fixed periodic rate of annual/12 applied uniformly. First instalment due exactly one month after disbursement, monthly thereafter. STUB: if disbursement precedes the first period start, a stub interest charge accrues at a daily rate of annual/360 over the actual calendar days in the odd interval, shown as a separate schedule line dated on the disbursement date with zero principal and the regular schedule unchanged from period 1. ROUNDING: round each instalment to the whole shilling (no cents); interest computed and rounded first, principal is the remainder, with accumulated rounding residual absorbed into the final instalment so the closing balance is exactly zero. Is anything missing or wrong, in particular any policy for input validation (e.g. zero/negative principal or rate, zero term) or grace/interest-only periods that I have not asked about?
A: The scope and core behaviour are accurate. Four policy items are missing from the summary:

1. Input validation (you asked): zero or negative principal, and a zero term, are rejected as invalid with an error. A zero or negative rate is [default, not policy] and should also be rejected.

2. Currency and precision: the currency is Kenyan shilling (KES); all amounts are expressed to 2 decimal places in intermediate calculations before instalment-level rounding to the whole shilling.

3. Early full settlement: if the borrower pays off in full before term, unearned interest is rebated by the Rule of 78 (sum-of-the-digits), not straight-line or actuarial.

4. Partial prepayment (loan continues): a prepayment is applied entirely to principal, then the schedule is re-amortised keeping the original term fixed so the instalment reduces — not keeping the instalment fixed and shortening the term.

5. Output shape and APR disclosure: generate_schedule must return the full per-period schedule (due date, opening balance, interest, principal, instalment, closing balance), the total cost of credit (sum of all interest charged), and a disclosed APR computed on an actual/365 basis — even though accrual uses 30/360.

Grace periods and interest-only periods are [default, not policy] and are not supported.

### Round 7
_Step reasoning:_ The stakeholder's correction introduced settlement and prepayment behaviours whose relationship to the single generate_schedule(loan) interface is genuinely ambiguous and cannot be inferred, so I must clarify scope before re-confirming rather than close out.

Q: Items 3 and 4 (early full settlement with a Rule-of-78 rebate, and partial prepayment triggering re-amortisation over the fixed original term) describe events that happen after disbursement, but the only interface named is generate_schedule(loan). How do these enter the system: does generate_schedule accept prepayment/settlement events (e.g. a list of dated payments on the loan) and reflect them in the returned schedule, or are they separate functions that operate on an already-generated schedule and are therefore out of scope for generate_schedule itself?
A: They are separate functions, out of scope for generate_schedule itself. generate_schedule takes the original loan inputs and returns the baseline schedule. Early full settlement and partial prepayment are [default, not policy] handled by separate operations — for example, settle_early(schedule, settlement_date) returns the rebate amount, and prepay(schedule, payment_date, amount) returns a revised schedule — each consuming an already-generated schedule as input rather than embedding event logic inside generate_schedule.

### Round 8 (process signalled done)
_Step reasoning:_ All material policy decisions (amortisation, day-count, rounding, stub interest, validation, currency, prepayment/settlement scope, output shape, APR) are clarified and the stakeholder has confirmed the summary with the interface boundary of generate_schedule resolved.

(no questions this round)

## Produced specification

# Requirements specification — repayment schedule engine

## Status

Confirmed by the stakeholder through structured interview. Ready for hand-off to the spec author. Every decision below is traceable to the feature brief or to an explicit stakeholder answer; nothing has been inferred where the interview did not settle it.

## 1. Scope

### In scope

- A function `generate_schedule(loan)` that produces the full baseline repayment schedule for a single disbursed loan.
- The loan inputs are: principal, annual nominal interest rate, term expressed as a number of monthly instalments, and disbursement date.
- The returned schedule covers, for each instalment: due date, opening balance, interest due, principal due, total instalment, and closing (running) balance.
- The return value also carries the total cost of credit and a disclosed APR (see section 7).
- A stub interest line where disbursement precedes the first period start (see section 5).
- Input validation (see section 8).

### Out of scope for `generate_schedule`

- Early full settlement and partial prepayment. These are post-disbursement events handled by separate operations that consume an already-generated schedule; they are not embedded in `generate_schedule`. Their required behaviour is documented in section 9 so the spec author can carry it forward, but `generate_schedule` itself takes only the original loan inputs and returns the baseline schedule.
- Grace periods and interest-only periods. Not supported.

## 2. Amortisation method

Equal principal per instalment (constant amortisation), not the annuity/French method.

- The principal portion is constant each period: `P / n`, where `P` is the principal and `n` is the term in instalments.
- Interest each period is computed on the reducing (opening) balance.
- Because the principal portion is constant and the balance declines, the total instalment decreases over the term.

## 3. Interest rate derivation and day-count

30/360 day-count convention.

- Every month counts as 30 days and the year as 360 days.
- This yields a fixed periodic (monthly) rate of `annual nominal rate / 12`, applied uniformly to every regular period.
- It is explicitly not actual/365 and not any actual-days-based accrual for the regular schedule. (The stub period in section 5 uses a daily rate derived from the same 30/360 convention.)

## 4. Rounding, currency and precision

- Currency is the Kenyan shilling (KES).
- Intermediate calculations are carried to 2 decimal places before instalment-level rounding.
- Each instalment is then rounded to the whole shilling (no cents).
- Within a period, interest is computed and rounded first; the principal portion is the remainder for that period.
- The accumulated rounding residual across the term is absorbed into the final instalment, so the closing balance is exactly zero at the end of the schedule.

## 5. Disbursement date, first due date and stub interest

- The first instalment is due exactly one month after the disbursement date; subsequent instalments fall monthly thereafter. The disbursement date therefore sets the due-date calendar, and every regular period is treated as a full 30/360 month.
- If the disbursement date precedes the first period start, a stub interest charge is levied for the extra (odd) days before the regular schedule begins.
  - The stub daily rate is `annual nominal rate / 360`, consistent with the 30/360 convention.
  - It is applied over the actual number of calendar days between the disbursement date and the first period start.
- Representation of the stub charge (resolved as the process default, no specific stakeholder policy): the stub appears as a separate schedule line dated on the disbursement date, carrying zero principal and showing only the stub interest as its instalment amount. The regular monthly schedule is left unmodified from period 1 onward.

## 6. Output shape

`generate_schedule` returns:

1. The full per-period schedule. Each line contains: due date, opening balance, interest, principal, instalment, closing balance. Where a stub applies, its line (section 5) precedes period 1.
2. The total cost of credit: the sum of all interest charged across the schedule (including any stub interest).
3. A disclosed APR, computed on an actual/365 basis, even though interest accrual uses 30/360.

## 7. APR disclosure

- The disclosed APR is computed on an actual/365 basis.
- This is a disclosure figure only; it does not change how interest accrues in the schedule, which remains 30/360.

## 8. Input validation

`generate_schedule` rejects the following inputs as invalid, raising an error:

- Zero or negative principal.
- Zero term.
- Zero or negative annual nominal rate (resolved as the process default, no specific stakeholder policy; treated the same as the other invalid inputs and rejected).

## 9. Out-of-scope post-disbursement operations (documented for the spec author, not part of `generate_schedule`)

These are handled by separate functions that operate on an already-generated schedule. Their signatures are indicative (resolved as the process default; the stakeholder confirmed they are separate operations rather than events consumed by `generate_schedule`):

- Early full settlement, e.g. `settle_early(schedule, settlement_date)`: returns the rebate amount. Unearned interest is rebated by the Rule of 78 (sum-of-the-digits), not straight-line and not actuarial.
- Partial prepayment with the loan continuing, e.g. `prepay(schedule, payment_date, amount)`: returns a revised schedule. The prepayment is applied entirely to principal, then the loan is re-amortised keeping the original term fixed, so the instalment reduces. The term is not shortened and the instalment is not held fixed.

## 10. Explicitly unsupported

- Grace periods.
- Interest-only periods.

## Traceability notes

- Amortisation method, day-count, rounding, first-due-date rule, and stub mechanics are direct stakeholder answers (rounds 1-5).
- Currency (KES), 2-decimal intermediate precision, Rule-of-78 rebate, fixed-term re-amortisation on prepayment, and the output shape including total cost of credit and actual/365 APR are direct stakeholder answers (round 6).
- Separation of settlement and prepayment from `generate_schedule` is a direct stakeholder answer (round 7).
- Items marked "process default, no specific stakeholder policy" (stub representation, rejection of zero/negative rate, the indicative signatures of the separate operations) were resolved as the interview settled them and confirmed within the conversation; none introduces a stakeholder answer that was not given.

## Auditor verdict

_The specification surfaces and correctly resolves all 14 reference decisions, including all nine bespoke off-default choices (equal-principal amortisation, 30/360, per-period interest calculation, disbursement-date stub interest, whole-shilling rounding, interest-first rounding order, Rule-of-78 rebate, fixed-term re-amortisation, and the dual 30/360-accrual/actual-365-disclosure APR quirk). Coverage = 14/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Section 2: 'Interest each period is computed on the reducing (opening) balance.' and Section 3 references the rate applied to periods | The spec states interest is computed on the reducing/opening balance, which is declining balance on the reducing principal. Matches the reference. |
| 2 | yes | **yes** | Section 2: 'Equal principal per instalment (constant amortisation), not the annuity/French method... The principal portion is constant each period: P / n... the total instalment decreases over the term.' | Exactly matches the reference: constant principal P/n, interest on reducing balance, decreasing total instalment, explicitly not EMI. |
| 3 | yes | **yes** | Section 3: '30/360 day-count convention. Every month counts as 30 days and the year as 360 days... explicitly not actual/365' | Exact match to the reference 30/360 convention, explicitly rejecting actual/365. |
| 4 | yes | **yes** | Section 3: 'This yields a fixed periodic (monthly) rate of annual nominal rate / 12, applied uniformly to every regular period... not any actual-days-based accrual for the regular schedule.' | The spec specifies interest computed once per monthly period (periodic rate applied per period), not daily accrual, matching 'same as the repayment period'. |
| 5 | yes | **yes** | Section 5: 'If the disbursement date precedes the first period start, a stub interest charge is levied for the extra (odd) days before the regular schedule begins.' | Matches the reference: interest accrues from disbursement, partial-period stub interest is charged for the extra days. |
| 6 | yes | **yes** | Section 4: 'Currency is the Kenyan shilling (KES). Intermediate calculations are carried to 2 decimal places' | KES and 2 decimal places both match the reference exactly. |
| 7 | yes | **yes** | Section 4: 'Each instalment is then rounded to the whole shilling (no cents)... The accumulated rounding residual across the term is absorbed into the final instalment' | Matches the reference: instalment rounded to whole shilling, accumulated difference settled in final instalment. |
| 8 | yes | **yes** | Section 4: 'Within a period, interest is computed and rounded first; the principal portion is the remainder for that period.' | Exact match: interest computed and rounded first, principal is the remainder. |
| 9 | yes | **yes** | Section 4: 'the closing balance is exactly zero at the end of the schedule.' | Matches the reference that the final instalment reconciles to exactly zero closing balance. |
| 10 | yes | **yes** | Section 9: 'Unearned interest is rebated by the Rule of 78 (sum-of-the-digits), not straight-line and not actuarial.' | Exact match to the reference Rule-of-78 rebate, explicitly excluding straight-line and actuarial. |
| 11 | yes | **yes** | Section 9: 'The prepayment is applied entirely to principal, then the loan is re-amortised keeping the original term fixed, so the instalment reduces. The term is not shortened and the instalment is not held fixed.' | Exact match: applied to principal, re-amortised with fixed term, instalment reduces. |
| 12 | yes | **yes** | Section 8: 'rejects the following inputs as invalid, raising an error: Zero or negative principal. Zero term.' | Matches the reference: zero/negative principal and zero term rejected as invalid errors. |
| 13 | yes | **yes** | Section 5: 'The first instalment is due exactly one month after the disbursement date; subsequent instalments fall monthly thereafter.' | Exact match: first due date is disbursement + one month, monthly thereafter. |
| 14 | yes | **yes** | Section 6 & 7: full per-period schedule (due date, opening balance, interest, principal, instalment, closing balance), total cost of credit (sum of interest), and 'A disclosed APR, computed on an actual/365 basis, even though interest accrual uses 30/360.' | Matches all three elements of the reference including the non-obvious 30/360-accrual-but-actual/365-disclosure split. |
