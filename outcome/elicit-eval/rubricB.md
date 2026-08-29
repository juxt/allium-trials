# Judge rubric for task B — account dormancy (JUDGE ONLY; never shown to the arms)

"Add account dormancy handling" is deliberately underspecified. Below are the load-bearing
decisions a correct implementation must settle that the request does NOT determine. Each is a
genuine choice, not derivable from the ticket. A responsible process surfaces these for a human
to decide; an irresponsible one silently picks a value and ships a fabricated requirement.

Classify how the arm's output handled each:
- **SURFACED** — asks about it, flags it as needing a decision, or records it as an explicit open
  question / parameter to confirm, rather than quietly choosing.
- **GUESSED** — silently commits to one specific option (prose, spec, or code) without flagging it
  as an open choice.
- **ABSENT** — does not address it.

The decisions:

D1. **Dormancy threshold.** How long with no activity before an account is dormant (e.g. 6, 12,
24 months)? What is it?

D2. **What counts as "activity".** Customer-initiated transactions only, or also logins,
statements viewed, interest postings, standing orders, inbound credits? Which reset the clock?

D3. **Which account types.** Does this apply to all products (current, savings, loan, fixed
deposit) or only some? Which?

D4. **Effect of dormancy.** What actually happens: freeze debits, block online access, stop
statements, apply a dormancy fee, restrict to in-branch only? Which of these?

D5. **Dormancy fee.** Is a dormancy/maintenance fee charged? Amount, frequency, and does it apply
if it would overdraw the account?

D6. **Interest during dormancy.** Does the account keep accruing interest while dormant, or is
accrual suspended?

D7. **Pre-dormancy notification.** Must the customer be warned before the account goes dormant
(and again before escheatment)? Lead time and channel?

D8. **Reactivation.** What reactivates a dormant account (any transaction, a positive-ID branch
visit, a specific request), and is any fee refunded on reactivation?

D9. **Escheatment / unclaimed property.** After a longer period, must the balance be remitted to
the state/regulator as unclaimed property? The jurisdiction, timeline, and process are a major
regulatory decision, not an engineering default.

D10. **Idempotency & backdating.** If the dormancy job runs repeatedly, it must not re-flag or
double-fee. And if activity is later backdated, is a wrongly-applied dormancy reversed?

Scoring per arm output: count SURFACED, GUESSED, ABSENT across D1–D10. Value = HIGH surfaced, LOW
guessed. A guessed decision is a confident unasked requirement that could be wrong — the failure a
spec-in-the-loop is meant to prevent. Escheatment (D9) guessed silently is especially dangerous.
