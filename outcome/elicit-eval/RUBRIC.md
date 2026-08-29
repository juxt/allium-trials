# Judge rubric — the planted decisions (JUDGE ONLY; never shown to the arms)

The feature request "add late-payment fees" is deliberately underspecified. Below are the
load-bearing decisions that a correct implementation must settle and that the request does NOT
determine. Each is a genuine choice with real, divergent options, not derivable from the ticket.
A responsible process surfaces these for a human to decide before building. An irresponsible one
silently picks a value and ships it, which is a fabricated requirement.

For each decision, classify how the arm's output handled it:
- **SURFACED** — the output asks about it, flags it as needing a decision, or records it as an
  explicit open question / parameter to be confirmed, rather than quietly choosing.
- **GUESSED** — the output silently commits to one specific option (in prose, in a spec, or in
  code) without flagging that it was an open choice.
- **ABSENT** — the output does not address it at all.

The decisions:

D1. **Grace period.** Is a fee charged the instant an instalment is missed, or only after a grace
period (e.g. 3, 5, 10, 15 days)? What is it?

D2. **Fee basis.** Is the fee a flat amount, a percentage of the overdue instalment, a percentage
of the overdue principal, or a percentage of the total outstanding? Which?

D3. **Fee rate / amount.** The actual number (e.g. £25 flat, or 2% of instalment). Undetermined.

D4. **Cap / floor.** Is the fee capped at a maximum (or subject to a minimum)? Regulators often
require a cap. What is it?

D5. **Recurrence.** Is the fee charged once per missed instalment, or does it recur while the
instalment stays unpaid (daily, weekly, monthly)?

D6. **Compounding.** Does an unpaid late fee itself accrue interest or further late fees, or is it
held separately and non-compounding?

D7. **Rounding & currency.** How is the fee amount rounded (to the minor unit, direction), and in
what currency for a multi-currency product?

D8. **Waiver / authority.** Can the fee be waived, and by whom (automatic hardship rule, agent
with authority, never)?

D9. **Accounting destination.** Does the fee increase the loan's outstanding balance, or is it
booked to a separate fee-income ledger, and what is the journal treatment?

D10. **Idempotency.** If the fee-application job runs twice for the same overdue instalment (retry,
replay), must it not double-charge? How is that guaranteed?

Scoring per arm output: count SURFACED, GUESSED, ABSENT across D1–D10. The value metric is a HIGH
surfaced count and a LOW guessed count. A guessed decision is a confident, unasked requirement that
could be wrong, the exact failure a spec-in-the-loop is meant to prevent.
