# Reference set (HIDDEN) — the material, non-inferable decisions

A second task, in loan scheduling rather than allocation, testing whether a process generalises across
domains. Ground truth held only by the proxy stakeholder. The institution is
a fictional microfinance lender, "Meridian", whose loan product is coherent but deliberately unusual:
each answer is set OFF both the textbook default and Fineract's own default, so the answers cannot be
recalled from training data. The decision CLASSES are drawn from real Fineract loan-product
configuration (`LoanProductRelatedDetail`, `InterestMethod`, `AmortizationMethod`, `DaysInYearType`,
`DaysInMonthType`, `InterestCalculationPeriodMethod`, `interestRecognitionOnDisbursementDate`,
`installmentAmountInMultiplesOf`, `supportedInterestRefundTypes`), so these are real policy choices,
not invented gotchas.

Scoring: a decision is **surfaced** if the process asked about it or its artefact addresses it, and
**correct** if the resolution matches the answer here. Coverage = correct / 14.

Decision-class column: the requirements-engineering class each decision falls under (method,
convention/units, temporal, rounding, ordering, output, edge). Inferable column flags the anchor
decisions a model can reasonably guess (kept in, tagged, so the gap is shown to concentrate on the
bespoke ones).

| # | decision | correct answer (reference) | decision class | inferable? |
|---|---|---|---|---|
| 1 | **Interest method** | declining balance on the reducing principal | method | yes (model guesses declining) |
| 2 | **Amortisation** | **equal principal**: a constant principal portion each period (P/n), interest on the reducing balance, so the total instalment DECREASES over the term. Not equal instalments / EMI. | method | no |
| 3 | **Day-count convention** | **30/360**: every month counts as 30 days, the year as 360. Not actual/365. | convention/units | no |
| 4 | **Interest calculation period** | **same as the repayment period** (interest computed once per monthly period), not daily accrual | temporal | no |
| 5 | **Interest start / stub period** | interest accrues **from the disbursement date**; if disbursement precedes the first period start, a **stub interest charge** is levied for those extra days (partial-period interest is allowed and charged) | temporal | no |
| 6 | **Currency and precision** | Kenyan shilling (KES), amounts to 2 decimal places | units | yes (2 dp is the naive default) |
| 7 | **Instalment rounding** | each instalment is **rounded to the whole shilling** (no cents in an instalment); the accumulated rounding difference is settled in the **final instalment** | rounding | no |
| 8 | **Within-period rounding order** | **interest is computed and rounded first; principal is the remainder** of the (rounded) instalment for that period | rounding/ordering | no |
| 9 | **Schedule closing** | the final instalment reconciles so the closing balance is **exactly zero** | output/edge | yes (guessable) |
| 10 | **Early full settlement rebate** | on early full payoff, unearned interest is rebated by the **Rule of 78 (sum-of-the-digits)**, not straight-line/actuarial | method | no |
| 11 | **Partial prepayment** (extra payment, loan continues) | applied entirely to **principal**, then the schedule is **re-amortised keeping the TERM fixed** (the instalment reduces), not keeping the instalment fixed (term reduces) | method | no |
| 12 | **Zero / negative principal or term** | rejected as invalid with an error; a zero amount or zero term is not a valid loan | edge | yes (reject is guessable) |
| 13 | **First due date** | the schedule's first due date is **disbursement date + one month**; subsequent instalments monthly thereafter | temporal | yes (guessable) |
| 14 | **Output shape and disclosure** | return the full schedule (per period: due date, opening balance, interest, principal, instalment, closing balance), the **total cost of credit** (sum of interest), and the **disclosed APR computed on an actual/365 basis** for the regulatory disclosure, even though accrual uses 30/360 | output | no (the 30/360-accrual-but-actual/365-disclosure split is a real, non-obvious regulatory quirk) |

## Coherence and honesty notes

- The policy is internally consistent: declining balance (#1) makes amortisation (#2) material; 30/360
  (#3) with same-as-repayment periods (#4) fixes each period's interest as `balance × rate × 30/360`;
  #7 and #8 together fix how each period's figures round and where the residual lands; #9 closes it;
  #14's dual day-count is the disclosure quirk.
- Under 30/360 the leap-year strategy is moot, so it is deliberately not a decision here (it would be
  incoherent with #3). This keeps the set coherent rather than maximal.
- Bespoke (off-default) decisions: 2, 3, 4, 5, 7, 8, 10, 11, 14. Inferable anchors: 1, 6, 9, 12, 13.
  The guess-without-asking check re-derives this empirically before the comparison run; the split above
  is the design intent, not the final scored subset.
- Method spread: decisions 2, 10, 11 (amortisation, Rule-of-78 rebate, re-amortisation strategy) are
  core-method choices a generic decision-class checklist would not name explicitly. Whether a process
  surfaces them anyway is part of what this task measures. No arm is told these exist.
- Grounding: Fineract exposes interest refunds (`supportedInterestRefundTypes`) but models them more
  simply than Rule of 78; Rule of 78 is Meridian's specific off-default policy for the same decision
  class. Same pattern for the others: real class, off-default answer.
