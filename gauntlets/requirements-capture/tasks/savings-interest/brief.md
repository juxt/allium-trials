# Brief — what every arm starts from (deliberately underspecified)

> We're building the interest engine for our savings accounts. Given an account with a daily balance
> history over a period and an annual interest rate, work out the interest the account earns and post
> it. Build a function `post_interest(account, period)` that returns the interest posted and the
> account's updated balance. Establish whatever details you need to compute it correctly.

That is the whole prompt. It names the domain and the interface and nothing else. Every material policy
decision below is omitted, and each is one a competent model cannot reliably *infer* — there are several
plausible answers and this institution has picked a specific one. The only way to get them right is to
ask the stakeholder. That is what the eval measures.

The brief does not tell the arm to ask or not to ask. Each authoring process's own discipline decides
that; the eval reads the consequence.
