# The deterministic-assurance gap — measured, and honestly refined

## What it tests

Value proposition #2: the CLI gives an assurance a capable model can approach but not reach —
a deterministic checker validates a property the model would otherwise claim with high but
imperfect confidence. The sharp version: how often is the model CONFIDENTLY WRONG on a
verdict it asserts by reasoning (tools disabled), against the deterministic oracle. That
confidently-wrong rate is the residual determinism removes.

## Result (consistency verdicts, M=10/18/26, N=24, tools disabled)

    high confidence (>=85):  0/24 wrong = 0%

Every verdict was correct, and the model reported ~100% confidence on essentially all of
them. There were no medium/low-confidence cases to bucket — the model was uniformly
confident and uniformly right. Pushed harder (the calibration's hard-search 3-SAT), the
model does not assert a confident wrong verdict; it times out or reaches for a solver. So in
the measurable range the confidently-wrong residual is ~0.

## The honest reading

Value #2 is real but not what "confidently wrong X% of the time" would suggest. On tractable
consistency the model is both confident and correct, so a deterministic checker catches
**no errors** — its contribution is not accuracy. What it contributes is the **nature of the
guarantee**: the model's correct answer is a probabilistic claim by a very reliable system;
the checker's is a deterministic, reproducible, auditable fact with a witness or a minimal
core. For a regulated assurance context those are different kinds of evidence even at
identical accuracy — "our reliable model said so" is not a control; "the checker proved it,
re-provable on every build" is.

So the two value propositions land differently, and both honestly:

- **#1 (elicit counterweight)** is an *accuracy/behaviour* value and it is large and
  non-saturated: it stops the model fabricating org-specific unknowns (88% -> 0%).
- **#2 (deterministic assurance)** is *not* an accuracy value in the tractable range — the
  model is already right — it is a *trust/auditability* value: determinism, reproducibility,
  and a machine-checkable artifact, which matter regardless of the model's (excellent)
  accuracy.

## Caveat and next probe

This is for consistency/feasibility — the properties v4's analyse covers, where a strong
model is highly reliable. Properties that are harder to self-check (inductive invariants,
temporal/liveness, quantified reasoning over large state) are the candidate regime where a
confidently-wrong residual might actually appear; that is where a future measurement of
value #2-as-accuracy should look, and it aligns with building v4's deeper verification.
