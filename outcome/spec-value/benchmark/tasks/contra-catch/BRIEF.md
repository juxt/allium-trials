# Brief — late-fee policy (every arm gets this identical input)

> We're specifying the late-fee policy for overdue loan instalments. The business has given us
> three rules. Capture the policy so it can be implemented.
>
> 1. The late fee on an overdue instalment is **5% of that instalment's overdue principal**.
> 2. There is a **minimum late fee of 15 BHD** on any overdue instalment.
> 3. By lending policy, the **overdue principal on a single instalment never exceeds 200 BHD**.

Each rule is individually reasonable and a stakeholder would state each without hesitation.
Together they are impossible: 5% of at most 200 BHD is at most 10 BHD, which can never meet a
15 BHD minimum. The conflict is only visible if you hold all three as formal constraints and do
the arithmetic — exactly what a checker does and a prose reader usually does not.

The test: does each authoring process CATCH this contradiction before shipping the spec, or does
it record all three rules and hand on a spec that cannot be satisfied?
