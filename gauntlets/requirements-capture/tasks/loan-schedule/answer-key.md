# Compact answer key (stakeholder use) — one line per decision

Answer only what is asked; give the exact value; volunteer nothing.

1. Interest method: declining balance on the reducing principal.
2. Amortisation: equal principal — a constant principal portion each period (P/n), interest on the reducing balance, so the total instalment DECREASES over the term. Not equal instalments / EMI.
3. Day-count convention: 30/360 — every month counts as 30 days, the year as 360. Not actual/365.
4. Interest calculation period: same as the repayment period (interest computed once per monthly period), not daily accrual.
5. Interest start / stub period: interest accrues from the disbursement date; if disbursement precedes the first period start, a stub interest charge is levied for those extra days (partial-period interest is allowed and charged).
6. Currency and precision: Kenyan shilling (KES), amounts to 2 decimal places.
7. Instalment rounding: each instalment is rounded to the whole shilling (no cents); the accumulated rounding difference is settled in the final instalment.
8. Within-period rounding order: interest is computed and rounded first; principal is the remainder of the (rounded) instalment for that period.
9. Schedule closing: the final instalment reconciles so the closing balance is exactly zero.
10. Early full settlement rebate: on early full payoff, unearned interest is rebated by the Rule of 78 (sum-of-the-digits), not straight-line/actuarial.
11. Partial prepayment (loan continues): applied entirely to principal, then the schedule is re-amortised keeping the TERM fixed (the instalment reduces), not keeping the instalment fixed.
12. Zero / negative principal or term: rejected as invalid with an error.
13. First due date: disbursement date + one month; subsequent instalments monthly thereafter.
14. Output shape and disclosure: return the full schedule (per period: due date, opening balance, interest, principal, instalment, closing balance), the total cost of credit (sum of interest), and the disclosed APR computed on an actual/365 basis, even though accrual uses 30/360.
