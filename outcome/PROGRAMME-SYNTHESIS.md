# Where Allium adds value with an LLM in the loop — the data-driven map

This is the synthesis of the whole eval programme: many experiments, each controlling the
one variable that matters (capability vs disposition vs determinism vs scale), tools
enabled or disabled deliberately, scored against sound oracles or hidden suites.

## The one organising finding

A capable, tool-using model is *not* the weak baseline. On any task it can comprehend in one
context, it reasons correctly, self-provisions tooling, catches traceable faults, and
refactors safely. So every value framed as "the tool makes the model get the answer" —
solving, detection, verification accuracy, safe evolution at small scale — saturates. Allium
adds value only where the model is *structurally* limited, not merely where a task is hard.

## The map

    axis                         experiment                    verdict
    solving                      hard 3-SAT                    SATURATES (self-tools: own solver in 33s)
    detection                    buried contradictions         SATURATES (catches traceable, even at 28 rules)
    design-time verification     consistency, inductive,       SATURATES on ACCURACY: 74/74, 0 confidently-wrong
                                 parametric/EPR
    safe evolution (small)       refactor + hidden suite       SATURATES: 0 regressions with or without spec
    observability completeness   ad-hoc vs distil monitors     ~SATURATES: both thorough; distil adds STRUCTURE
    distill completeness         summarise vs distil           MODEST: 80% -> 100% subtle-edge capture
    elicit counterweight         fabricate org-specifics       LARGE, NON-SATURATED: 88% -> 0%
    v3 vs v4 (model-free)        differential mutation matrix   v4 better assurance layer; gap = lifecycle

## The three homes of real value

**1. The unknowable (large, clean, the standout).** The elicit counterweight. A model asked
to build fabricates org-specific facts it cannot possibly know — an internal deadline, which
legal entity reports, a placeholder, a carve-out — 88% of the time. The elicit discipline,
landing answers durably and refusing to guess, surfaces 100% and fabricates 0. This is the
only large, non-saturated accuracy win, and it exists precisely because it targets what the
model *cannot* know rather than what it can reason. Tuned to keep the catch and cut the
over-surfacing (8/8 -> 1/8); shipped into the v4 elicit skill.

**2. The form of the artifact (real, marginal on accuracy, decisive for assurance).**
Determinism, reproducibility, auditability, structure, completeness. The model is 74/74 and
confidently correct on in-scope verification, so a deterministic checker catches ~zero
errors — its worth is that its verdict is a machine-checked, reproducible, auditable fact
with a witness or a counterexample, not a reliable model's confident claim. In a regulated
context that is the product at equal accuracy. Distil and observability sharpen the same
point: the discipline produces a complete, typed, standing invariant set rather than a
good-but-informal one.

**3. Scale beyond the context window (plausible, untested — the honest frontier).** Every
saturating axis pointed to the same edge: the model wins because it can hold the whole task
in view. Consistency at 40 rules, safe evolution at 40 lines, log review of a short trace —
all comprehensible. Where the salient behaviours, rules, or state exceed one context, the
model must change one area and cannot see what it breaks elsewhere. That is where grounding,
completeness, and a standing deterministic gate should pay off, and it is the one regime this
programme could not test, because it lacks a genuinely large real system.

## v3 vs v4

Decided model-free by the differential mutation matrix: v4 is sound where v3 is heuristic and
checks consistency, feasibility, coverage and runtime invariants v3 has no mechanism for. v4
is the better assurance layer. The one class v3 does that v4 cannot is the lifecycle/rule/
trigger family — v4's single build gap, evidenced in FRICTION.md for the construct decision.

## What this says to build

Not more solving/detection benchmarks — they saturate. The value-bearing work is: (a) the
elicit/distil discipline and its artifact, already shipping value on the unknowable and on
completeness; (b) the deterministic, standing, auditable gate (design-time + monitor from one
spec), whose worth is trust and reproducibility; and (c) closing the v4 lifecycle gap so it
does everything v3 does, soundly. The only way to test the scale frontier — and the only place
an accuracy residual might still live — is a genuinely large real system, which is the next
substrate to acquire, not another synthetic probe.
