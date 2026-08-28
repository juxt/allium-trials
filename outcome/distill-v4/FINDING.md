# Distill — completeness by discipline

## What it tests

Distill's value through the disposition lens: not detection (a strong model reads code well)
but completeness. Asked to summarise, a model is selectively helpful; distilling into a full
spec forces exhaustiveness. `report_engine.py` has 8 known behaviours — B1-B3 mainline,
B4-B8 subtle edge cases (below-threshold still submitted; amendment-before-ack queued;
re-book idempotent; reported timestamp is trade time; cancel-already-cancelled is a no-op).

## Result (N=4 each, tools disabled)

    arm         mainline B1-B3    subtle B4-B8
    summarise   67%               80%
    distill     83%               100%

Distill captures every subtle edge, every run (100%); summarise drops about a fifth of them.
The delta is modest — a strong model summarises thoroughly — but it lands exactly where it
matters for reimplementation-from-spec: the edge behaviours a summary silently omits are the
ones a reimplementation would get wrong.

## Reading

Consistent with the whole investigation: the model is capable (summarise already gets 80% of
the subtle behaviours), and the tool's value is a disposition correction at the margin —
here, pushing completeness from good to complete. For a spec that must stand alone as the
source of truth (the reimplement-from-spec use), that last 20% of edge behaviour is the
difference between a faithful spec and a quietly lossy one.

Caveat: measured by concept-keyword detectors over free text; the distill arm needed more
turns than summarise (a complete spec is longer). A format-agnostic judge would sharpen the
exact numbers, but the direction — distill more complete on edges — is clear.
