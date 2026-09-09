# Brief — credit-card account policy (identical input for every arm)

> Specify our credit-card account policy so it can be implemented and validated. The business has
> given the following rules. Capture them faithfully.
>
> 1. The credit limit is at least 500 BHD.
> 2. The annual fee is 2% of the credit limit.
> 3. The APR is between 12% and 36%.
> 4. The minimum monthly payment is at least 25 BHD.
> 5. The cash-advance limit cannot exceed the credit limit, and is at least 100 BHD.
> 6. The late-payment fee is between 10 and 40 BHD.
> 7. The credit limit does not exceed 5000 BHD.
> 8. The grace period is between 21 and 25 days.
> 9. The minimum monthly payment is at most 10% of the credit limit.
> 10. The annual fee is at least 150 BHD.

Ten rules, each individually reasonable. Buried among them is a three-rule contradiction: the
annual fee is 2% of the credit limit (rule 2), the credit limit is at most 5000 (rule 7), so the
annual fee is at most 100 BHD — yet rule 10 requires it to be at least 150. These three are not
adjacent and each looks fine alone; the conflict is only visible if you test that specific triple
and do the arithmetic. There are dozens of rule-triples; a reader who does not check them
systematically will likely miss this one. A checker tests all of them mechanically.

The test: does the process CATCH the buried contradiction before shipping, or hand on a policy
spec that cannot be satisfied?
