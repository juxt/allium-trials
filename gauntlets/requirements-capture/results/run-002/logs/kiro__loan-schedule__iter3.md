# kiro — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 13 · Captured: 12/14 · Bespoke captured: 4/6

## Conversation

### Round 1
_Step reasoning:_ The brief fixes the domain and interface but omits amortisation method, day-count/interest convention, first-due-date semantics, rounding precision/rule, and final-balance reconciliation, each of which has several plausible answers only the stakeholder can settle before correct computation is possible.

Q: How is each instalment's payment structured: equal total payments across the term (annuity/amortising), equal principal with declining interest, or interest-only with a final balloon?
A: Equal principal with declining interest: a constant principal portion each period (P/n), with interest charged on the reducing balance, so the total instalment decreases over the term. Not equal total payments (annuity/EMI), not interest-only.

Q: How is the per-period interest derived from the annual nominal rate: a flat nominal/12 each month, or an actual-days day-count convention (e.g. actual/365) based on the dates between instalments?
A: 30/360 day-count: every month is treated as 30 days, the year as 360. Interest is computed once per monthly period (no daily accrual), giving an effective periodic rate of nominal/12.

Q: What role does the disbursement date play in the schedule, and when does the first instalment fall due (e.g. exactly one month after disbursement, or a fixed day-of-month)?
A: Interest accrues from the disbursement date. The first instalment falls due exactly one month after disbursement; subsequent instalments monthly thereafter. If disbursement precedes the first period start, a stub interest charge is levied for those extra days.

Q: To what precision are interest, principal, and balance rounded (e.g. 2 decimal places / minor currency units), and what rounding rule applies (round half up, bankers' rounding, truncation)?
A: Currency is KES. Amounts are held to 2 decimal places. Instalments are rounded to the whole shilling (no cents). Within each period, interest is computed and rounded first; the principal portion is the remainder of the rounded instalment. Rounding direction is not specified in policy [default, not policy: round half up].

Q: How should any rounding residue be absorbed so the final running balance reaches exactly zero: adjust the final instalment, adjust the final interest/principal split, or distribute across instalments?
A: The accumulated rounding difference is absorbed in the final instalment, which is adjusted so the closing balance is exactly zero.

### Round 2
_Step reasoning:_ Two material policy points remain un-inferable: whether the balancing final instalment breaks the whole-shilling rule, and the mechanics/reachability of the stub interest charge.

Q: Final instalment vs the whole-shilling rule: non-final instalments are rounded to whole shillings, but the final instalment is adjusted so the closing balance is exactly zero. Does the final instalment stay a whole-shilling amount (accepting a small non-zero residue), or may it carry cents (2 dp) so the balance reaches exactly zero?
A: The final instalment may carry cents (2 dp) so the closing balance reaches exactly zero. The whole-shilling rule applies to non-final instalments only; the final instalment is exempt and takes whatever value zeros the balance. [default, not policy: policy states exact-zero close and whole-shilling rounding for non-final instalments but does not explicitly extend the whole-shilling rule to the final instalment — exact-zero takes precedence]

Q: Stub interest mechanics: given the first instalment falls exactly one month after disbursement, when does the stub actually arise, and how is it presented and charged? Specifically, is it folded into the first instalment's interest or shown as a separate charge, does it reduce principal or is it interest-only, and is it rounded to the whole shilling or held at 2 dp?
A: The stub arises only when the disbursement date falls before the first scheduled period start (i.e. the schedule runs on fixed anchor dates and disbursement lands mid-period). When first-due-date is simply disbursement-plus-one-month there is no stub. When a stub does arise: it covers the days from disbursement to the first period start using the same 30/360 periodic rate prorated over those days; it is interest-only (no principal reduction); policy confirms it is charged but does not specify presentation or rounding [default, not policy: shown as a separate line item preceding period 1; held at 2 dp rather than rounded to the whole shilling, since it is not a regular instalment].

### Round 3
_Step reasoning:_ Two material, non-inferable policies remain: the due-date anchor/month-end convention (which determines whether stubs arise and the exact due dates) and the handling of zero-rate and degenerate single-instalment terms.

Q: Due-date scheduling convention: do instalments fall on a fixed anchor day-of-month (making the stub the normal case whenever disbursement lands mid-cycle), or is the first due date always exactly disbursement-plus-one-month (making the stub a rare edge case)? And under whichever convention, how are month-end and short-month dates rolled, e.g. disbursement on the 31st when the following month has 30 or fewer days: clamp to the last day of month, roll forward, or roll back?
A: The first due date is always disbursement-plus-one-month (key item 13); subsequent instalments fall monthly thereafter. This makes the stub a rare edge case — under this convention the first period starts on the disbursement date, so no stub arises in the normal path. Month-end and short-month rolling are not specified in policy [default, not policy: clamp to the last day of the target month — e.g. disbursement on the 31st into a 30-day month gives a first due date of the 30th; subsequent dates anchor to that clamped day-of-month, clamping again whenever the month is too short].

Q: Zero/degenerate inputs: how should the engine treat a 0% nominal rate (schedule becomes pure equal-principal with no interest), a single-instalment term (n=1), and any guard on non-positive principal or term, so the rounding-residue-in-final-instalment rule still yields an exact-zero close?
A: Non-positive principal or term (zero or negative) is rejected as invalid with an error (key item 12). A 0% nominal rate and a single-instalment term (n=1) are not addressed in policy [default, not policy: a 0% rate is accepted — it produces equal principal portions with zero interest each period, and the rounding-residue rule still closes the balance to exactly zero since interest is always zero; n=1 is a valid positive term — the single instalment equals opening principal plus any interest, adjusted if needed so the closing balance is exactly zero, with no rounding residue possible since it is both the first and final instalment].

### Round 4
_Step reasoning:_ Structure, day-count, dates, residue, stub, scheduling, and degenerate inputs are settled; two material, non-inferable items remain: the rounding granularity of the interest/principal split and the function's input/output contract.

Q: Within a non-final instalment, to what granularity is the interest portion rounded before the principal is taken as the remainder? The policy says instalments are rounded to the whole shilling and that interest is computed and rounded first with principal as the remainder, but it is ambiguous whether the interest line itself is rounded to the whole shilling (so interest, principal, and total are all whole shillings) or held at 2 dp (so the principal remainder carries cents even though the total instalment is a whole shilling). Which applies?
A: Policy (key item 8) states interest is computed and rounded first, with principal as the remainder of the rounded instalment, but does not specify the granularity to which the interest line itself is rounded. [default, not policy: interest is rounded to 2 decimal places (the standard currency precision per key item 6); the principal portion equals the whole-shilling instalment minus the 2 dp interest figure and may therefore carry cents. The instalment total is always a whole shilling; the interest/principal split need not be.]

Q: What is the exact return contract of generate_schedule(loan)? Specifically: the input fields expected on `loan`; the per-instalment fields to emit (e.g. instalment number, due date, opening balance, interest, principal, total payment, closing balance); and how the two special rows are represented in that structure, namely the interest-only stub (when it arises) and the cents-carrying final instalment.
A: Per key item 14, the return value comprises: (a) a schedule array — one entry per period — with fields: due_date, opening_balance, interest, principal, instalment, closing_balance; (b) total_cost_of_credit (sum of all interest charges across all periods); (c) apr (disclosed rate computed on an actual/365 basis). Input fields and instalment-number labelling are not specified in policy [default, not policy: loan input has principal (KES, positive decimal), annual_nominal_rate (decimal fraction, e.g. 0.18), term_months (positive integer), disbursement_date (date); each schedule entry also carries a period field, with non-stub periods numbered 1..n]. The stub row, when it arises, appears as a separate entry before period 1 with period=0 (or labelled 'stub'), due_date equal to the first period-start date, opening_balance and closing_balance both equal to the loan principal, principal=0, interest=stub interest at 2 dp, and instalment equal to that interest amount; this is [default, not policy] on presentation since policy only confirms the stub is charged. The final instalment entry follows the same field structure as all other periods but its instalment value may carry cents (2 dp) and its closing_balance is exactly 0.

### Round 5
_Step reasoning:_ Return contract names APR and total_cost_of_credit but leaves the APR computation method, fee treatment, precision, and the scope of total cost of credit as genuine unresolved policy decisions that cannot be inferred.

Q: How exactly is the disclosed APR computed? You've said it's on an actual/365 basis, but the method is unspecified: is it the solved internal rate of return that equates the present value of the scheduled instalments (and stub, if any) to the net disbursed amount, or a simpler nominal-to-effective annualisation? Does the APR include the stub interest, and does it incorporate any fees/charges, or is it purely the interest cash flows? And to what precision is the APR expressed (e.g. 2 dp, as a percentage or a fraction)?
A: Policy (key item 14) states the APR is computed on an actual/365 basis but does not specify the method, what it includes, or its precision. [default, not policy: the APR is the solved IRR — the annual rate that equates the present value of all scheduled cash flows (instalments, and the stub charge if one arises, discounted on actual/365 day-counts from the disbursement date) to the net disbursed principal. No fees are defined in policy so the APR reflects interest cash flows only. The APR is expressed as a percentage to 2 decimal places, e.g. 18.00%.]

Q: Does total_cost_of_credit cover interest only (the sum of all period interest plus any stub interest), or does it also include fees/charges if any exist? And is the stub interest included in that total when it arises?
A: Policy (key item 14) defines total_cost_of_credit as the sum of interest; no fees or charges are defined anywhere in policy, so the figure is interest-only. Whether stub interest is included is not explicitly stated [default, not policy: yes — stub interest is an interest charge and is included in the total when it arises].

### Round 6 (process signalled done)
_Step reasoning:_ All material policy decisions (payment structure, day-count, disbursement/stub handling, due-date rolling, rounding and residue absorption, interest/principal granularity, degenerate inputs, return contract, APR method, and total_cost_of_credit scope) have been resolved; the last rounds returned only stakeholder-confirmed defaults, signalling no further policy remains to elicit.

(no questions this round)

## Produced specification

# Requirements Document

## Introduction

This feature is the repayment schedule engine for a KES-denominated loan product. Given a disbursed loan, defined by its principal, an annual nominal interest rate, a term in monthly instalments, and a disbursement date, the engine produces the full repayment schedule. For each instalment it reports the due date, opening balance, interest charged, principal repaid, the total instalment, and the closing (running) balance. Alongside the per-period schedule it returns the total cost of credit and a disclosed APR.

The product uses an **equal-principal, declining-interest** repayment structure: a constant principal portion each period with interest charged on the reducing balance, so the total instalment decreases over the term. Interest is derived under a **30/360** day-count convention at an effective periodic rate of the annual nominal rate divided by twelve. Amounts are held in Kenyan shillings; regular instalments are rounded to the whole shilling, the interest line to two decimal places, and the accumulated rounding residue is absorbed in a final instalment that is permitted to carry cents so that the closing balance reaches exactly zero.

The primary interface is a single function, `generate_schedule(loan)`, which returns the schedule array, the total cost of credit, and the APR.

The following conventions are used throughout. Where a decision was fixed by stakeholder policy it is stated as a plain requirement. Where policy was silent and the authoring process resolved the matter by default, the requirement is tagged **[DEFAULT]**; these defaults are binding for this implementation but are flagged so the stakeholder can override them on review.

## Requirements

### Requirement 1: Repayment structure (equal principal, declining interest)

**User Story:** As a loan servicing operator, I want each instalment to repay a constant principal portion with interest on the reducing balance, so that borrowers follow the institution's chosen equal-principal, declining-total repayment plan rather than an annuity or interest-only plan.

#### Acceptance Criteria

1. WHEN the engine generates a schedule for a loan of principal P over n instalments THEN the system SHALL compute a constant per-period principal portion equal to P divided by n (subject to the rounding rules in Requirement 4 and the final-instalment adjustment in Requirement 5).
2. WHEN the engine computes the interest for a period THEN the system SHALL charge interest on the opening balance of that period (the reducing balance), not on the original principal.
3. THEN the system SHALL NOT use an annuity/EMI (equal-total-payment) structure and SHALL NOT use an interest-only-with-balloon structure.
4. WHEN principal is repaid in constant portions while interest declines with the balance THEN the total instalment SHALL decrease over the term.

### Requirement 2: Interest derivation and day-count (30/360)

**User Story:** As a finance controller, I want interest computed under a 30/360 convention at a periodic rate of nominal/12, so that every monthly period is charged consistently regardless of calendar length.

#### Acceptance Criteria

1. WHEN the engine derives the periodic interest rate from the annual nominal rate r THEN the system SHALL use an effective periodic rate of r divided by 12.
2. WHEN the engine computes interest for a regular monthly period THEN the system SHALL treat the period as 30 days and the year as 360 days (30/360), computing interest once per monthly period with no daily accrual.
3. WHEN interest for a regular period is computed THEN the system SHALL calculate it as the opening balance multiplied by the periodic rate (r/12).

### Requirement 3: Disbursement date, first due date, and scheduling convention

**User Story:** As a loan operations officer, I want the first instalment to fall exactly one month after disbursement with subsequent instalments monthly thereafter, so that due dates follow a predictable monthly cadence anchored on the disbursement date.

#### Acceptance Criteria

1. WHEN a loan is disbursed THEN the system SHALL treat interest as accruing from the disbursement date.
2. WHEN the engine schedules the first instalment THEN the system SHALL set its due date to exactly one month after the disbursement date.
3. WHEN the engine schedules instalments after the first THEN the system SHALL set each due date to one month after the previous due date.
4. WHEN the first due date is disbursement-plus-one-month THEN the first period SHALL start on the disbursement date, and in this normal path no stub interest SHALL arise (see Requirement 7).
5. **[DEFAULT]** WHEN advancing a due date by one month would land in a month too short to contain the anchor day-of-month (e.g. the 31st rolled into a 30-day month) THEN the system SHALL clamp the due date to the last day of the target month.
6. **[DEFAULT]** WHEN a due date has been clamped to a short month THEN subsequent due dates SHALL continue to anchor on the original day-of-month, clamping again whenever a later month is too short.

### Requirement 4: Precision and rounding

**User Story:** As a finance controller, I want amounts held in shillings with regular instalments rounded to whole shillings and interest to two decimals, so that the schedule matches the institution's rounding policy.

#### Acceptance Criteria

1. WHEN the engine represents monetary amounts THEN the system SHALL use Kenyan shillings (KES) held to 2 decimal places.
2. WHEN the engine produces a non-final (regular) instalment total THEN the system SHALL round that instalment to the whole shilling (no cents).
3. WHEN the engine splits a regular period THEN the system SHALL compute and round the interest first, then take the principal portion as the remainder of the rounded instalment (principal = rounded instalment minus rounded interest).
4. **[DEFAULT]** WHEN the interest line for a period is rounded THEN the system SHALL round it to 2 decimal places (the standard currency precision), not to the whole shilling.
5. **[DEFAULT]** WHEN the whole-shilling instalment minus the 2-decimal-place interest is taken as the principal portion THEN that principal portion MAY carry cents, while the regular instalment total SHALL remain a whole shilling.
6. **[DEFAULT]** WHEN any rounding is applied THEN the system SHALL round half up.

### Requirement 5: Rounding residue and exact-zero close

**User Story:** As an auditor, I want the accumulated rounding difference absorbed in the final instalment, so that the closing balance of the schedule is exactly zero.

#### Acceptance Criteria

1. WHEN the engine reaches the final instalment THEN the system SHALL adjust that instalment so that the closing balance after it is exactly zero.
2. WHEN accumulated rounding across earlier periods has left a residue THEN the system SHALL absorb that entire residue in the final instalment.
3. **[DEFAULT]** IF reaching an exact-zero close requires the final instalment to carry cents THEN the final instalment SHALL be exempt from the whole-shilling rule and SHALL take whatever 2-decimal-place value zeros the balance; exact-zero close takes precedence over whole-shilling rounding.
4. WHEN the final instalment is computed THEN its closing_balance SHALL be exactly 0.

### Requirement 6: Stub interest for mid-period disbursement

**User Story:** As a loan operations officer, I want a correctly prorated stub interest charge when disbursement lands before the first scheduled period start, so that the borrower is charged for the extra days without distorting the regular schedule.

#### Acceptance Criteria

1. WHEN the disbursement date falls before the first scheduled period start (schedule running on fixed anchor dates with disbursement mid-period) THEN the system SHALL levy a stub interest charge for the days from disbursement to the first period start.
2. WHEN the first due date is simply disbursement-plus-one-month (the normal path of Requirement 3) THEN the system SHALL NOT levy a stub charge.
3. WHEN a stub charge arises THEN the system SHALL compute it using the same 30/360 periodic rate (r/12) prorated over the stub days.
4. WHEN a stub charge arises THEN the system SHALL treat it as interest-only, applying no principal reduction.
5. **[DEFAULT]** WHEN a stub charge arises THEN the system SHALL hold it at 2 decimal places (not round it to the whole shilling), since it is not a regular instalment.
6. **[DEFAULT]** WHEN a stub charge arises THEN the system SHALL present it as a separate line item preceding period 1.

### Requirement 7: Degenerate and boundary inputs

**User Story:** As a developer integrating the engine, I want invalid inputs rejected and legitimate edge cases handled, so that the engine fails loudly on bad data and still closes the balance to zero on valid edges.

#### Acceptance Criteria

1. IF the principal is zero or negative THEN the system SHALL reject the loan as invalid with an error.
2. IF the term in months is zero or negative THEN the system SHALL reject the loan as invalid with an error.
3. **[DEFAULT]** WHEN the annual nominal rate is 0% THEN the system SHALL accept the loan and produce equal principal portions with zero interest in every period, and the closing balance SHALL still reach exactly zero.
4. **[DEFAULT]** WHEN the term is a single instalment (n=1) THEN the system SHALL accept the loan and set the single instalment equal to the opening principal plus any interest due.
5. **[DEFAULT]** WHEN n=1 THEN no rounding residue is possible (the single row is both first and final), and its closing_balance SHALL be exactly zero.

### Requirement 8: Return contract of `generate_schedule(loan)`

**User Story:** As a developer consuming the engine, I want a well-defined input and return structure, so that I can read the schedule, the total cost of credit, and the APR without ambiguity.

#### Acceptance Criteria

1. **[DEFAULT]** WHEN the engine receives a `loan` THEN the system SHALL expect the input fields: `principal` (KES, positive decimal), `annual_nominal_rate` (decimal fraction, e.g. 0.18 for 18%), `term_months` (positive integer), and `disbursement_date` (a date).
2. WHEN the engine returns THEN the system SHALL return a value comprising: (a) a `schedule` array with one entry per period; (b) `total_cost_of_credit`; and (c) `apr`.
3. WHEN the engine emits a schedule entry THEN the system SHALL include the fields: `due_date`, `opening_balance`, `interest`, `principal`, `instalment`, and `closing_balance`.
4. **[DEFAULT]** WHEN the engine emits a schedule entry THEN the system SHALL also include a `period` field, with non-stub periods numbered 1..n.
5. **[DEFAULT]** WHEN a stub charge arises THEN the system SHALL emit it as a separate entry before period 1 with `period` = 0 (or labelled 'stub'), `due_date` equal to the first period-start date, `opening_balance` and `closing_balance` both equal to the loan principal, `principal` = 0, `interest` = the stub interest at 2 decimal places, and `instalment` equal to that stub interest amount.
6. WHEN the engine emits the final instalment entry THEN the system SHALL use the same field structure as all other periods, with `instalment` permitted to carry cents (2 dp) and `closing_balance` exactly 0.

### Requirement 9: Total cost of credit

**User Story:** As a compliance officer, I want the total cost of credit reported as the sum of all interest charged, so that the borrower sees the full interest cost of the loan.

#### Acceptance Criteria

1. WHEN the engine computes `total_cost_of_credit` THEN the system SHALL set it to the sum of all period interest charges across the schedule.
2. WHEN no fees or charges are defined THEN the system SHALL make `total_cost_of_credit` interest-only (there are no fees in policy).
3. **[DEFAULT]** IF a stub interest charge arises THEN the system SHALL include that stub interest in `total_cost_of_credit`.

### Requirement 10: Disclosed APR

**User Story:** As a compliance officer, I want a disclosed APR computed on an actual/365 basis, so that the advertised rate reflects the true annualised cost of the scheduled cash flows.

#### Acceptance Criteria

1. WHEN the engine computes the `apr` THEN the system SHALL use an actual/365 basis.
2. **[DEFAULT]** WHEN the engine computes the `apr` THEN the system SHALL solve for the internal rate of return: the annual rate at which the present value of all scheduled cash flows, discounted on actual/365 day-counts from the disbursement date, equals the net disbursed principal.
3. **[DEFAULT]** WHEN the APR cash flows are assembled THEN the system SHALL include every scheduled instalment and, IF a stub charge arises, the stub charge.
4. **[DEFAULT]** WHEN no fees are defined in policy THEN the system SHALL make the APR reflect interest cash flows only.
5. **[DEFAULT]** WHEN the engine expresses the `apr` THEN the system SHALL express it as a percentage to 2 decimal places (e.g. 18.00%).

---

Do the requirements look good? If so, we can move on to the design.


## Auditor verdict

_The spec surfaces and correctly resolves 12 of 14 decisions (coverage 12/14 = 0.857). It nails every method, convention, temporal, rounding, ordering, output and edge decision it addresses, including the bespoke ones (equal principal #2, 30/360 #3, same-as-period #4, stub interest #5, whole-shilling rounding #7, interest-first ordering #8, and the 30/360-accrual-but-actual/365-disclosure split #14). The two misses are both core-method lifecycle decisions the spec is entirely silent on: the Rule-of-78 early-settlement rebate (#10) and the partial-prepayment re-amortisation keeping term fixed (#11). The gap concentrates exactly on post-origination servicing policy, which the schedule-generation framing never prompted._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Req 1 title 'equal principal, declining interest'; Req 1.2 'SHALL charge interest on the opening balance of that period (the reducing balance), not on the original principal'; Req 2.3 interest = opening balance × r/12 | Spec explicitly uses declining balance on the reducing principal, matching the reference. |
| 2 | yes | **yes** | Req 1.1 'constant per-period principal portion equal to P divided by n'; Req 1.3 'SHALL NOT use an annuity/EMI'; Req 1.4 'total instalment SHALL decrease over the term' | Equal-principal (P/n) with declining total, explicitly excluding EMI — exactly the reference answer. |
| 3 | yes | **yes** | Req 2.2 'SHALL treat the period as 30 days and the year as 360 days (30/360)' | 30/360 convention stated verbatim, matching the reference over actual/365. |
| 4 | yes | **yes** | Req 2.2 'computing interest once per monthly period with no daily accrual' | Interest computed once per repayment period, not daily — matches the reference temporal decision. |
| 5 | yes | **yes** | Req 3.1 'SHALL treat interest as accruing from the disbursement date'; Req 6.1 'SHALL levy a stub interest charge for the days from disbursement to the first period start' | Both the from-disbursement accrual and the stub charge for extra days are present, matching the reference. |
| 6 | yes | **yes** | Req 4.1 'SHALL use Kenyan shillings (KES) held to 2 decimal places' | KES to 2 dp matches the reference exactly. |
| 7 | yes | **yes** | Req 4.2 'SHALL round that instalment to the whole shilling (no cents)'; Req 5.2 'SHALL absorb that entire residue in the final instalment' | Whole-shilling instalments with the accumulated residue settled in the final instalment — matches the reference. |
| 8 | yes | **yes** | Req 4.3 'SHALL compute and round the interest first, then take the principal portion as the remainder of the rounded instalment (principal = rounded instalment minus rounded interest)' | Interest rounded first, principal as remainder — exactly the reference ordering. |
| 9 | yes | **yes** | Req 5.1/5.4 'closing_balance SHALL be exactly 0' | Final instalment reconciles to an exact-zero closing balance, matching the reference. |
| 10 | no | no | absent | The spec never addresses early full settlement or any interest rebate, so the Rule-of-78 policy is neither surfaced nor resolved. |
| 11 | no | no | absent | The spec never addresses partial prepayment, re-amortisation, or term-vs-instalment handling of extra payments. |
| 12 | yes | **yes** | Req 7.1 'IF the principal is zero or negative THEN the system SHALL reject the loan as invalid with an error'; Req 7.2 same for term | Zero/negative principal and term are rejected as invalid, matching the reference edge case. |
| 13 | yes | **yes** | Req 3.2 'SHALL set its due date to exactly one month after the disbursement date'; Req 3.3 monthly thereafter | First due date = disbursement + one month, monthly thereafter — matches the reference. |
| 14 | yes | **yes** | Req 8.3 fields 'due_date, opening_balance, interest, principal, instalment, closing_balance'; Req 9.1 total_cost_of_credit = sum of all interest; Req 10.1 'SHALL use an actual/365 basis' while Req 2.2 accrual is 30/360 | Full per-period schedule, total cost of credit as sum of interest, and disclosed APR on actual/365 while accrual stays 30/360 — captures the dual day-count disclosure quirk exactly. |
