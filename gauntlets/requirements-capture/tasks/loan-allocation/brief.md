# Brief — what every arm starts from (deliberately underspecified)

> We're adding payment allocation to our loan servicing system. When a borrower pays, the
> money has to be applied across what they currently owe on the loan. Build a function
> `allocate_payment(payment, loan)` that returns how the payment is applied and the loan's
> updated balances. The loan can have several instalments outstanding, each with penalties,
> fees, interest and principal components. Establish whatever details you need to implement
> it correctly.

That is the whole prompt. It names the domain and the interface and nothing else. Every
material policy decision below is omitted, and each is one a competent model cannot reliably
*infer* — there are several plausible answers and this institution has picked a specific one.
The only way to get them right is to ask the stakeholder. That is what the eval measures.

The brief does not tell the arm to ask or not to ask. Each authoring process's own discipline
decides that; the eval reads the consequence.
