# Spec-grounded safe evolution — saturates at comprehensible scale

## What it tests

The central AI-coding promise: ship a new feature without silently breaking existing
behaviour. Does the spec, by making the salient behaviours explicit, let the model tell
load-bearing from incidental and preserve it? The feature (a `supersede` correction) forces
a refactor of the report-creation path, so the subtle behaviours (below-threshold-submitted,
rebook-idempotent, trade-time timestamp, amend-queue, cancel-noop, UTI uniqueness) are
genuinely at risk. Hidden suite (9 behaviours) scores regressions.

## Result (N=5 each)

    arm      feature added   regressions   clean (9/9)
    nospec   5/5             0             5/5
    spec     5/5             0             5/5

No delta. The model added the feature and refactored safely every time, preserving even the
fragile B6 (a careless refactor would route `new_trade` through the shared helper and mint a
fresh UTI on re-book — it didn't), with or without the spec.

## Reading — the recurring boundary, one more time

On a ~40-line engine the model holds every behaviour in its head, so it does not break them,
and the spec adds nothing measurable. Safe evolution is a real concern, but it does not bite
at a scale the model can comprehend in one context.

Where it would bite — and where the spec's grounding should pay off — is a codebase too large
for the model to hold all the salient behaviours at once: it changes one area and silently
breaks a load-bearing behaviour elsewhere it never had in view. That is the same "beyond the
context window" frontier every axis has pointed at: consistency at scale, log review at scale,
and now safe evolution at scale. It is the honest home of the grounding/completeness value,
and it needs a genuinely large real system to test — which is the one thing this programme has
not had.
