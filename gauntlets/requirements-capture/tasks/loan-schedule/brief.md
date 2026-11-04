# Brief — what every arm starts from (deliberately underspecified)

> We're building the repayment schedule engine for our loan product. Given a disbursed loan
> (principal, an annual nominal interest rate, a term in monthly instalments, and a
> disbursement date), produce the full repayment schedule: for each instalment, the interest
> and the principal due, and the running balance. Build a function `generate_schedule(loan)`
> that returns the schedule. Establish whatever details you need to compute it correctly.

That is the whole prompt. It names the domain and the interface and nothing else. Every material
policy decision below is omitted, and each is one a competent model cannot reliably *infer* — there
are several plausible answers and this institution has picked a specific one. The only way to get
them right is to ask the stakeholder. That is what the eval measures.

The brief does not tell the arm to ask or not to ask. Each authoring process's own discipline
decides that; the eval reads the consequence.
