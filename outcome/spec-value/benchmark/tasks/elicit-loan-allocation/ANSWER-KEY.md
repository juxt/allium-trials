# Compact answer key (stakeholder use) — one line per decision

Answer only what is asked; give the exact value; volunteer nothing.

1. Bucket order within an instalment: fees, then penalties, then interest, then principal (fees BEFORE penalties).
2. Multiple overdue instalments: clear the OLDEST in full (all four buckets) before any money touches the next.
3. Overpayment (pay > total owed): surplus held as an unallocated credit balance, auto-applied to the next instalment when it falls due, NEVER auto-refunded.
4. Currency minor unit: loan is BHD — 3 decimal places (fils); all amounts and rounding to 3 dp.
5. Rounding method: round half-up to the minor unit (3 dp).
6. Rounding residual destination: absorbed into the INTEREST component (not principal).
7. Back-valued payment (value_date earlier than today): interest is recomputed (re-accrued) to that value_date before allocation.
8. Early/on-time payment with surplus (not in arrears): settles the current instalment only; surplus becomes a credit balance (per 3); does NOT prepay principal; future interest unchanged.
9. Partial payment smaller than the first bucket due: strict order, fill each bucket in the sequence; NO proportional split.
10. Write-off tolerance: residual owed after allocation ≤ 0.005 BHD -> instalment marked fully paid, residual written off.
11. Zero/negative payment: negative is REJECTED with an error; zero is a no-op that still records a zero-value allocation transaction.
12. Penalty accrual on the allocation date: penalties accrue up to and including the value_date, then allocation runs on post-accrual balances.
13. Same-day multiple payments: applied FIFO by receipt timestamp, each allocated independently in turn.
14. Result shape: per payment, return amount applied to each bucket of each instalment, resulting outstanding balances, any credit_balance created, any tolerance_written_off.
