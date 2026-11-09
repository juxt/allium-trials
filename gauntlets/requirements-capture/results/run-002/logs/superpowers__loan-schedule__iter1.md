# superpowers — loan-schedule — iteration 1

Model (author): claude-opus · Questions asked: 13 · Captured: 10/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ Architectural path: before anything else I need the single most load-bearing policy, the amortisation method, which cannot be inferred and drives every downstream figure; asking one question at a time per the brainstorming discipline.

Q: How should each instalment be structured — equal total payments across the term (annuity/amortising, so interest and principal shares shift each period), equal principal each period with interest on the declining balance, or interest-only with a final balloon?
A: Equal principal each period: a constant principal portion (P/n) with interest on the declining balance, so the total instalment decreases over the term. Not equal total payments (annuity/EMI), not interest-only with a balloon.

### Round 2
_Step reasoning:_ Instalment structure is settled; the next material, non-inferable policy decision is the interest accrual/day-count convention, so I ask that one focused question before moving on.

Q: For the interest on the declining balance each period, how should the periodic interest be computed from the annual nominal rate — a simple 1/12 of the annual rate applied to the outstanding balance each month (ignoring exact day counts), or an actual-days accrual using a day-count convention (e.g. actual/365, actual/360, 30/360)? And if a day-count convention, which one?
A: 30/360: every month is treated as 30 days and the year as 360, so the periodic rate is always exactly 30/360 of the annual nominal rate applied to the outstanding balance. Interest is computed once per monthly period, not via daily accrual. Actual/365 and actual/360 are not used for accrual (though actual/365 is used separately for the disclosed APR).

### Round 3
_Step reasoning:_ Structure and accrual are settled; rounding precision, rounding rule, and final-period residual reconciliation are material, uninferable policy choices that directly change every schedule figure, so I ask these before moving to date/timing conventions.

Q: How should the per-period interest and principal amounts be rounded, and how should any accumulated rounding residual be handled so the schedule fully amortises? Specifically: to how many decimal places (e.g. 2 for currency minor units) should interest and the constant principal portion (P/n) be rounded each period, which rounding rule applies (round half up, half to even, truncate), and should the final instalment absorb the residual so the closing balance is exactly zero?
A: Each instalment is rounded to the whole shilling (zero decimal places, no cents). Within a period, interest is computed first and rounded to the whole shilling; the principal portion is then the remainder of that rounded instalment (i.e. instalment minus rounded interest), not an independently rounded P/n. The specific tie-breaking rule (e.g. half-up vs. half-to-even) is not specified policy [default, not policy: use round-half-up]. Accumulated rounding differences are not corrected period-by-period; instead, the final instalment is adjusted so the closing balance is exactly zero.

### Round 4
_Step reasoning:_ Instalment structure, accrual convention, and rounding are settled, but the schedule's due-date generation and first-period (full vs. stub) treatment remain unspecified policy that materially affects the dated schedule and cannot be reliably inferred.

Q: The loan includes a disbursement date, but we haven't settled how the instalment due dates are generated or how the first period is treated. Three things: (1) When is the first instalment due — exactly one month after disbursement, on a fixed day-of-month, or some other rule? (2) How are subsequent due dates set (same day each month, and how do you handle month-end cases like the 31st or 29-31 Feb)? (3) Since accrual is 30/360, is every period — including the first — always treated as a full 30/360 month regardless of the actual gap between disbursement and the first due date, or can there be an odd/stub first period (e.g. if the first instalment is more or less than a month out, interest for that first period is pro-rated by 30/360 days)?
A: The first instalment is due exactly one month after the disbursement date.

### Round 5
_Step reasoning:_ Round 4 answered only when the first instalment is due; subsequent due-date generation, month-end handling, and whether any period can be a stub remain genuinely unsettled policy I cannot safely infer.

Q: Two date details from round 4 are still open. (2) For instalments after the first, how is each subsequent due date set — the same day-of-month as the first due date, and how do you handle month-end cases (e.g. a 31st due date in a 30-day month, or the 29th-31st in February)? (3) Given accrual is 30/360 and the first instalment is exactly one month after disbursement, should every period — including the first — always be treated as a full 30/360 month (so there is never a stub/odd first period), or can a period ever accrue a pro-rated amount?
A: Subsequent due dates fall on the same day-of-month as the first due date, advancing one month at a time. Month-end handling is not specified policy [default, not policy: use the last day of the month when the target day does not exist in that month — e.g. a 31st due date in a 30-day month falls on the 30th, and in February on the 28th or 29th].

### Round 6
_Step reasoning:_ Round 5 answered the subsequent-due-date rule but left the first-period/stub accrual question (round 4 item 3) unanswered, and it materially affects the first instalment's interest.

Q: One detail from the previous round is still open: given accrual is 30/360 and the first instalment falls exactly one month after disbursement, should every period — including the first — always be treated as a full 30/360 month (so interest each period is exactly 30/360 of the annual nominal rate on the outstanding balance, and there is never a stub/odd first period), or can a period ever accrue a pro-rated amount?
A: Every period, including the first, is always treated as a full 30/360 month. Interest each period is exactly 30/360 of the annual nominal rate on the outstanding balance. There is never a stub or odd first period. However, if disbursement precedes the first period start, a separate stub interest charge is levied for those extra days (partial-period interest is allowed and charged for that pre-period gap only).

### Round 7
_Step reasoning:_ The round 6 stub-interest answer conflicts with the exactly-one-month-after-disbursement and full-30/360-period answers and leaves its trigger, computation, and presentation undefined, so it must be resolved before the schedule can be computed correctly.

Q: Round 6 introduced a stub interest charge, but it seems to conflict with earlier answers and I can't yet implement it unambiguously. Given that the first instalment is due exactly one month after disbursement (round 4) and every period, including the first, is treated as a full 30/360 month (round 6), under what circumstances does 'disbursement precede the first period start' such that a stub applies? Concretely: (a) what defines the 'first period start' relative to the disbursement date if the first instalment is always one month out; (b) how is the stub interest amount computed for the pre-period gap, i.e. which day-count (actual days? actual/360? 30/360 pro-rata?) and which rate is applied to what balance; and (c) how is it presented and does it affect the schedule's running balance, e.g. is it a separate charge outside generate_schedule's instalment rows, added to instalment 1's interest, or does it reduce/extend principal?
A: (a) There is genuine tension in the spec here. Under item 13 the first due date is disbursement + one month, which implies the first period starts on the disbursement date — leaving no pre-period gap in the base case. The stub in item 5 applies only when the system accepts a separately supplied 'schedule start date' (a value date or period-start date later than disbursement). In that configuration, disbursement is before the period start, the first full period runs from that schedule start date, and the first instalment falls one month after it. When no separate schedule start date is provided, disbursement date and period start coincide and no stub arises. [The existence and definition of this optional schedule-start-date input is implicit in the spec but not explicitly named; clarification recommended.]

(b) Stub computation is not specified policy. [default, not policy: apply the same 30/360 periodic rate on a pro-rata basis — count the stub days using the 30/360 day-count convention (i.e. treat each calendar month as 30 days) and charge (annual_rate × stub_days / 360) × principal.]

(c) Presentation is not specified policy. [default, not policy: treat it as a separate charge outside the main instalment schedule — it does not form part of any numbered instalment row, does not reduce or extend the principal entering the schedule, and is disclosed as a one-off 'stub interest' line item. The running balance for period 1 opens at the full disbursed principal.]

### Round 8
_Step reasoning:_ Two material items remain: a direct contradiction between round 1 (equal-principal) and round 3 (instalment-minus-interest/annuity logic) on how principal and total are derived, and the stakeholder-flagged question of whether the schedule-start-date input actually exists; both are non-inferable policy, so I ask rather than write the spec.

Q: There's an unresolved tension between two earlier answers that blocks a correct implementation, so I need to settle how each instalment's total and its principal portion are derived. Round 1 said this is an equal-principal loan: a constant principal portion of P/n each period, with interest on the declining balance, so the total instalment declines over the term. But round 3 described the principal portion as 'the remainder of the rounded instalment (instalment minus rounded interest)', which presupposes a predetermined total instalment amount and is how an annuity/EMI loan behaves, not an equal-principal one. Which governs? Concretely: (a) is the fixed quantity each period the principal portion (P/n, rounded to the whole shilling) with the total instalment then being P/n + rounded interest; or (b) is there a fixed total instalment from which rounded interest is subtracted to yield principal? If (a), is P/n rounded to the whole shilling each period, and does the final instalment absorb both the interest residual and any P/n rounding drift so the closing balance is exactly zero?
A: (a) governs. This is an equal-principal loan. The fixed quantity each period is the principal portion P/n (the base constant; do not round it independently each period). The per-period mechanics are: (1) compute interest on the opening balance using the 30/360 rate and round to the whole shilling; (2) form the raw instalment as P/n + rounded interest; (3) round that total to the whole shilling — this is the instalment due; (4) the principal actually taken that period is instalment minus rounded interest (which will be very close to P/n but may differ by ±1 KES due to rounding). The total instalment declines over the term because interest declines, consistent with an equal-principal structure. The final instalment is whatever is needed to bring the closing balance to exactly zero, absorbing all accumulated rounding drift.

Q: You noted that the optional 'schedule start date' input (a value/period-start date later than disbursement, which triggers the stub charge) is implicit but not explicitly named, and recommended clarification. Is this a real, supported input to generate_schedule(loan) that I should design for, or should the first version assume period start always coincides with disbursement (no stub) and treat the stub as out of scope?
A: Yes, it is a real, supported input. Design for it in the first version. When a schedule start date later than the disbursement date is supplied, a stub interest charge is levied for the gap between disbursement and that date, and the main instalment schedule starts from the schedule start date with the first instalment due one month after it. When no schedule start date is provided it defaults to the disbursement date, no stub arises, and behaviour is exactly as described in prior rounds.

### Round 9
_Step reasoning:_ Two material policy items remain unpinned: the now-confirmed stub charge's day-count/rate basis and presentation were given only as my defaults rather than institutional policy, and whether the disclosed APR is in scope for generate_schedule is unsettled.

Q: Now that the schedule start date and its stub interest charge are confirmed as a real, supported feature (round 8), I need the actual institutional policy for the stub, since round 7 gave only my defaults, not your policy: (a) which day-count and rate basis applies to the pre-period gap — is it genuinely 30/360 pro-rata (treating the gap in 30-day months), or actual/360, or actual/365 as used for the APR? and (b) how is the stub presented in the output of generate_schedule — a separate one-off line item outside the numbered instalments (period-1 balance opening at full principal), capitalised into principal, or added to instalment 1's interest?
A: (a) The day-count and rate basis for the stub are not specified policy. [default, not policy: apply the 30/360 convention pro-rata — count the stub days on a 30/360 basis and charge (annual_rate × stub_days / 360) × disbursed principal.] (b) Stub presentation is not specified policy; the round 7 default stands. [default, not policy: a separate one-off line item outside the numbered instalment rows, not capitalised into principal and not merged into instalment 1's interest; period 1's opening balance is the full disbursed principal.]

Q: Round 2 mentioned that actual/365 is used separately for a disclosed APR. Is computing/returning that disclosed APR part of generate_schedule's output, or is it out of scope for this function (i.e. the function returns only the instalment schedule and any stub line)?
A: Yes, the disclosed APR is part of generate_schedule's output. The function returns: the full instalment schedule (per period: due date, opening balance, interest, principal, instalment, closing balance); the total cost of credit (sum of all interest charged); and the disclosed APR, computed on an actual/365 basis regardless of the 30/360 accrual convention used for the schedule itself.

### Round 10
_Step reasoning:_ The APR, introduced in round 9, is a required output whose computation method (IRR vs nominal, which cash flows, how actual/365 times them) is material institutional policy that cannot be inferred, so I must ask before the spec is complete.

Q: Round 9 confirmed the disclosed APR is part of generate_schedule's output, computed on an actual/365 basis, but the actual computation method is still unspecified and can't be reliably inferred. (a) Is the APR the internal rate of return that discounts all repayment cash flows back to the disbursed principal, expressed as an effective annual rate (with compounding), or a nominal annualised rate (periodic IRR multiplied by the number of periods)? (b) Which cash flows feed the calculation — only the numbered instalments against the disbursed principal, or also the one-off stub interest charge and any arrangement/processing fees? (c) For the actual/365 day-count, are the actual calendar days between disbursement and each instalment's due date used to time the cash flows (even though the schedule itself accrues on 30/360), and is the stub period's timing included?
A: (a) Not specified policy. [default, not policy: use the IRR method — find the periodic rate that discounts all repayment cash flows back to the disbursed principal on an actual/365 basis, then express it as an effective annual rate via compounding: (1 + periodic_rate)^365/period_days − 1 is not quite right for irregular spacing; more precisely, solve for r such that principal = Σ CF_t / (1 + r)^(d_t/365), where d_t is the actual number of calendar days from disbursement to cash flow t, and r is the effective annual APR.] (b) Not specified policy. [default, not policy: include all cash flows the borrower pays — the numbered instalments and, if present, the stub interest charge; exclude arrangement or processing fees unless they are mandatory and non-refundable, in which case include them. The disbursed principal is the outflow at day 0.] (c) Not specified policy. [default, not policy: yes — use the actual calendar days between the disbursement date and each cash flow's due date to time every cash flow, including the stub (which falls on the disbursement date itself, or on the schedule start date if that differs, giving it a day-0 or small positive offset). The 30/360 convention governs only the accrual of interest within the schedule; it plays no role in the APR's cash-flow timing.]

### Round 11
_Step reasoning:_ Nearly all accrual, rounding, date and APR mechanics are settled, but whether mandatory fees exist is real institutional policy that materially changes the disclosed APR and total cost of credit, and it was only assumed away by a default rather than answered.

Q: For the disclosed APR and the total cost of credit that generate_schedule returns, does this loan product charge any mandatory, non-refundable arrangement or processing fees at disbursement? If so, (a) how is each fee determined (flat amount or a percentage of principal), and (b) should it be included as a day-0 cash flow in the APR calculation and/or added to the total cost of credit — or are there no such fees, so the APR and cost of credit are driven solely by interest, instalments and any stub charge?
A: No mandatory, non-refundable arrangement or processing fees are charged on this product. The total cost of credit is the sum of all interest charged (as stated in the output specification), and the APR calculation is driven solely by interest instalments and any stub interest charge. No fee cash flows are included. [The absence of fees is implicit in the policy definition of total cost of credit as 'sum of interest'; no fee structure is specified.]

### Round 12 (process signalled done)
_Step reasoning:_ Eleven rounds have settled every material policy decision the institution actually made (equal-principal structure, 30/360 accrual, whole-shilling rounding, due-date generation and month-end handling, the schedule-start-date/stub feature, equal-principal instalment mechanics, actual/365 IRR-based APR, total cost of credit as sum of interest, and no fees); remaining open items were explicitly flagged as non-policy defaults, so further questions would only re-collect defaults rather than extract policy.

(no questions this round)

## Produced specification

# Repayment schedule engine — requirements specification

## 1. Purpose and scope

This specifies `generate_schedule(loan)`, the function that produces the full repayment schedule for a disbursed loan under this institution's loan product. Given a disbursed loan, the function returns, for each instalment, the interest and principal due and the running balance, together with the total cost of credit and the disclosed APR. Amounts are in Kenyan shillings (KES), the whole shilling being the currency's minor unit for this product (no cents).

Throughout, decisions are marked either **[policy]** (settled by the stakeholder) or **[default]** (not settled as policy; resolved by the authoring process and flagged for later confirmation). Defaults are implemented as described but should be reviewed before go-live.

## 2. Interface and inputs

The function signature is `generate_schedule(loan)`. The `loan` carries:

- **principal** (P): the disbursed amount, in whole KES.
- **annual nominal interest rate**: the stated annual rate, from which the periodic rate is derived.
- **term**: the number of monthly instalments, n.
- **disbursement date**: the date the principal is advanced.
- **schedule start date** (optional): a value / period-start date. **[policy]** This is a real, supported input. When supplied and later than the disbursement date, it is the date from which the main instalment schedule runs, and it triggers a stub interest charge for the gap between disbursement and this date. When omitted, it defaults to the disbursement date, in which case no stub arises and behaviour is exactly the base case.

## 3. Instalment structure — equal principal

**[policy]** This is an equal-principal (constant-amortisation) loan, not an annuity/EMI loan and not interest-only with a balloon. The fixed quantity each period is the principal portion P/n. Interest is charged on the declining outstanding balance, so the total instalment decreases over the term as the balance falls.

P/n is the base constant and is **not** rounded independently each period.

## 4. Interest accrual — 30/360

**[policy]** Interest accrues on a 30/360 basis. Every month is treated as 30 days and the year as 360 days, so the periodic rate is always exactly 30/360 of the annual nominal rate, applied to the outstanding balance. Interest is computed once per monthly period, not via daily accrual. Actual/365 and actual/360 are not used for schedule accrual; actual/365 is used only for the disclosed APR (section 9).

**[policy]** Every period, including the first, is always treated as a full 30/360 month. Interest each period is exactly (annual nominal rate x 30/360) on the opening balance. There is never a stub or odd first period within the numbered schedule. Partial-period interest arises only as the separate stub charge of section 8, never inside a numbered instalment row.

## 5. Per-period mechanics

**[policy]** For each period, in order:

1. Compute interest on the opening balance using the 30/360 periodic rate, and round it to the whole shilling.
2. Form the raw instalment as P/n + rounded interest.
3. Round that total to the whole shilling. This rounded total is the instalment due for the period.
4. The principal actually taken that period is `instalment due - rounded interest`. This will be very close to P/n but may differ by a shilling or so because of rounding.
5. The closing balance is `opening balance - principal taken`. The next period's opening balance is this closing balance.

Because interest declines as the balance falls, the total instalment declines over the term, consistent with the equal-principal structure.

## 6. Rounding

**[policy]** All instalment amounts are rounded to the whole shilling: zero decimal places, no cents. Interest is computed and rounded first; the principal portion is the remainder of the rounded instalment (instalment minus rounded interest), not an independently rounded P/n.

**[policy]** Accumulated rounding differences are not corrected period by period. Instead, the final instalment absorbs all accumulated rounding drift.

**[default]** The tie-breaking rule is round-half-up (0.5 rounds away from zero). Half-to-even and truncation are not used. This is a default, not settled policy.

## 7. Final instalment

**[policy]** The final instalment is whatever amount is needed to bring the closing balance to exactly zero. It absorbs both the interest residual and any drift between the per-period principal taken and P/n, so that the schedule fully amortises and the closing balance of the last period is exactly zero.

## 8. Due date generation

**[policy]** The first instalment is due exactly one month after the schedule start date (which defaults to the disbursement date). In the base case with no separate schedule start date, this is one month after disbursement.

**[policy]** Subsequent due dates fall on the same day-of-month as the first due date, advancing one month at a time.

**[default]** Month-end handling is not settled policy. When the target day-of-month does not exist in a given month, the due date falls on the last day of that month. For example, a 31st due date falls on the 30th in a 30-day month, and on the 28th (or 29th in a leap year) in February. This is a default, not settled policy.

## 9. Stub interest (optional schedule start date)

**[policy]** When a schedule start date later than the disbursement date is supplied, disbursement precedes the first period start. A stub interest charge is levied for the gap between the disbursement date and the schedule start date. The first full period then runs from the schedule start date, and the first instalment is due one month after it. When no schedule start date is supplied, disbursement date and period start coincide and no stub arises.

**[default]** Stub day-count and rate basis: the 30/360 convention applied pro-rata. Count the stub days on a 30/360 basis (treating each calendar month as 30 days) and charge `(annual nominal rate x stub_days / 360) x disbursed principal`. Actual/360 and actual/365 are not used for the stub. This is a default, not settled policy.

**[default]** Stub presentation: the stub is a separate, one-off line item outside the numbered instalment rows. It is not capitalised into principal and is not merged into instalment 1's interest. Period 1's opening balance is the full disbursed principal. The stub does not reduce or extend the principal entering the schedule. This is a default, not settled policy.

## 10. Outputs

**[policy]** `generate_schedule(loan)` returns:

1. **The full instalment schedule.** For each numbered period: due date, opening balance, interest, principal, instalment, and closing balance.
2. **Any stub interest line.** When a schedule start date later than disbursement is supplied, the one-off stub interest charge as a separate line item (section 9).
3. **The total cost of credit.** The sum of all interest charged.
4. **The disclosed APR.** Computed on an actual/365 basis (section 11).

## 11. Disclosed APR

**[policy]** The disclosed APR is part of the output and is computed on an actual/365 basis, regardless of the 30/360 convention used for schedule accrual. The 30/360 convention governs only interest accrual within the schedule; it plays no role in the APR's cash-flow timing.

**[default]** Method: the internal rate of return. Solve for r such that

`principal = sum over t of CF_t / (1 + r)^(d_t / 365)`

where CF_t is each repayment cash flow, d_t is the actual number of calendar days from the disbursement date to cash flow t, and r is the effective annual APR. The disbursed principal is the outflow at day 0. This IRR-as-effective-annual-rate approach is a default, not settled policy.

**[default]** Cash flows included: all amounts the borrower pays, namely the numbered instalments and, if present, the stub interest charge. Timing uses actual calendar days from disbursement to each cash flow's due date, including the stub (which falls on the disbursement date itself, or on the schedule start date if that differs). Arrangement or processing fees are excluded unless mandatory and non-refundable, in which case they would be included; see section 12. This is a default, not settled policy.

## 12. Fees and total cost of credit

**[policy]** This product charges no mandatory, non-refundable arrangement or processing fees. The total cost of credit is the sum of all interest charged. The APR calculation is driven solely by interest instalments and any stub interest charge. No fee cash flows are included.

## 13. Summary of decisions

Policy (settled by the stakeholder):

- Equal-principal structure; P/n constant, interest on declining balance, total instalment declines.
- 30/360 accrual; periodic rate exactly 30/360 of the annual nominal rate on the opening balance, computed once per period; every numbered period is a full 30/360 month.
- Rounding to the whole shilling; interest rounded first, principal is the remainder of the rounded instalment; drift carried to the final instalment, which brings the closing balance to exactly zero.
- Per-period mechanics: round interest, raw instalment = P/n + rounded interest, round the total to the instalment due, principal = instalment minus rounded interest.
- First instalment one month after the schedule start date (defaulting to disbursement); subsequent due dates on the same day-of-month, advancing monthly.
- Optional schedule start date is a supported input; when later than disbursement it triggers a stub charge and the schedule runs from it.
- Output: full schedule (due date, opening balance, interest, principal, instalment, closing balance), total cost of credit (sum of interest), disclosed APR on actual/365.
- No mandatory non-refundable fees; total cost of credit is the sum of interest.

Defaults (not settled policy; implemented as stated, flagged for confirmation):

- Rounding tie-break: round-half-up.
- Month-end due dates: last day of the month when the target day does not exist.
- Stub day-count and rate: 30/360 pro-rata, `(annual rate x stub_days / 360) x disbursed principal`.
- Stub presentation: separate one-off line item, not capitalised, period 1 opens at full principal.
- APR method: IRR expressed as an effective annual rate, actual calendar days / 365 for timing, cash flows being instalments plus any stub (no fees).

## Auditor verdict

_The spec surfaces 11 of 14 decisions and correctly resolves 10. Strong coverage of the core schedule mechanics (methods 1-4, rounding 6-8, closing 9, due dates 13, output/APR 14). It misses decision 5 on strict matching: it reframes disbursement-date interest accrual as an optional 'schedule start date' input rather than the governing rule that interest accrues from disbursement with a stub whenever disbursement precedes the first period. It entirely omits the three bespoke lifecycle decisions: Rule-of-78 early settlement rebate (10), partial-prepayment re-amortisation keeping term fixed (11), and rejection of zero/negative principal or term (12). Coverage = 10/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Section 3: "Interest is charged on the declining outstanding balance"; Section 4: "applied to the outstanding balance". | Spec states declining balance interest on the reducing principal, matching the reference. |
| 2 | yes | **yes** | Section 3: "This is an equal-principal (constant-amortisation) loan, not an annuity/EMI loan... The fixed quantity each period is the principal portion P/n... so the total instalment decreases over the term." | Exactly matches the reference: equal principal P/n, interest on reducing balance, decreasing total instalment. |
| 3 | yes | **yes** | Section 4: "Interest accrues on a 30/360 basis. Every month is treated as 30 days and the year as 360 days." | Matches the 30/360 convention exactly, explicitly rejecting actual/365. |
| 4 | yes | **yes** | Section 4: "Interest is computed once per monthly period, not via daily accrual." | Matches reference: interest calculation period same as repayment period, not daily accrual. |
| 5 | yes | no | Section 9: stub triggered by an optional "schedule start date later than the disbursement date"; Section 4: "interest accrues on the opening balance... every period a full 30/360 month." | The reference says interest accrues from the disbursement date and a stub is levied whenever disbursement precedes the first period start. The spec makes the stub conditional on a separate optional 'schedule start date' input rather than on disbursement itself preceding the first period; by default disbursement = period start and no stub ever arises. This reframes disbursement-date accrual as an optional feature rather than the governing rule, so it does not match. |
| 6 | yes | **yes** | Section 1: "Amounts are in Kenyan shillings (KES)"; Section 2: "in whole KES". | Currency KES is correct. Note the reference says 2 decimal places as the currency precision while instalments round to whole shilling; the spec states KES with whole-shilling instalment rounding, which is consistent with the currency being KES. Currency identity matches. |
| 7 | yes | **yes** | Section 6: "All instalment amounts are rounded to the whole shilling"; Section 7: "the final instalment absorbs all accumulated rounding drift... closing balance of the last period is exactly zero." | Matches: whole-shilling instalments with accumulated rounding settled in the final instalment. |
| 8 | yes | **yes** | Section 6: "Interest is computed and rounded first; the principal portion is the remainder of the rounded instalment." | Exactly matches the within-period rounding order: interest rounded first, principal is the remainder. |
| 9 | yes | **yes** | Section 7: "whatever amount is needed to bring the closing balance to exactly zero." | Matches reference: final instalment reconciles to exactly zero closing balance. |
| 10 | no | no | absent | The spec never addresses early full settlement or an unearned-interest rebate; Rule of 78 is not mentioned anywhere. |
| 11 | no | no | absent | The spec does not address partial prepayment or re-amortisation (fixed term vs fixed instalment) at all. |
| 12 | no | no | absent | The spec does not address rejection of zero/negative principal or zero term as invalid. |
| 13 | yes | **yes** | Section 8: "The first instalment is due exactly one month after the schedule start date (which defaults to the disbursement date)... subsequent due dates... advancing one month at a time." | Matches: first due date is disbursement date + one month, monthly thereafter. |
| 14 | yes | **yes** | Section 10 & 11: returns full schedule (due date, opening balance, interest, principal, instalment, closing balance), total cost of credit (sum of interest), and "disclosed APR... computed on an actual/365 basis... regardless of the 30/360 convention." | Matches the full output shape, total cost of credit, and the non-obvious 30/360-accrual-but-actual/365-disclosure split. |
