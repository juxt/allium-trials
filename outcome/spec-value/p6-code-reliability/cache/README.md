# Cache domain — the vacuity gap, mechanical and live

## Mechanical (the oracle)

`test_obligations.py` scores two independent obligations: SAFETY (`test_never_stale`) and the
OBJECTIVE (`test_actually_caches`). Three references pin that they are independent and that the
objective is the floor a vacuous implementation fails:

```
reference (correct write-through)  safety PASS   objective PASS
vacuous   (always-miss cache)      safety PASS   objective FAIL   <- caught ONLY by the objective
stale     (no invalidation)        safety FAIL   objective PASS
```

The do-nothing always-miss cache is safe and useless. Safety alone cannot see it; the objective can.
This is the anti-vacuity floor demonstrated deterministically, no agent involved.

## Live (does stating the objective help an agent?)

`eval_objective.wf.js`, N=6 per arm, safety-only contract vs safety+objective contract:

```
safety_only     safety 100%   objective 100%   safe-but-vacuous 0%
with_objective  safety 100%   objective 100%   safe-but-vacuous 0%
```

Saturated. Every agent wrote a real caching cache from the safety-only contract, because caching is
an obvious achievement. So the objective's *code-elicitation* value tracks non-obviousness exactly like
library-spec obligations: it adds nothing where the achievement is obvious. The vacuity gap is real (the
oracle proves it), but a competent implementer does not fall into it unprompted on an obvious domain.

The objective's distinctive value is therefore not code-gen elicitation (that is the non-obviousness law
again) but the spec-author-facing ceiling-without-floor diagnostic (which caught a real missing floor in
the achronic Arbiter spec) and the still-unbuilt checking of whether a design achieves the objective.
