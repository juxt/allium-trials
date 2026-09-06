# guidance-vs-structure — NULL for the code-gen hypothesis; the real axis is VERIFIABILITY

Does a non-obvious load-bearing rule (a $5 reserve -> charge requires balance>=20) get followed less
reliably in V3 @guidance PROSE than STRUCTURED? Discriminator: the [15,20) band must be rejected. N=6.

| arm | opus band% | sonnet band% |
|---|---|---|
| no-spec | 33 | 0 |
| v3 @guidance (prose) | 100 | 100 |
| v3 structured | 100 | 100 |
| v4 structured | 100 | 100 |

## The honest finding

**Guidance prose is followed exactly as reliably as structure (100% all, both models).** A modern LLM reads
a clear @guidance block and implements the rule perfectly. So the hypothesis "V3 guidance-prose is a vector
for confusion that produces WORSE CODE" is NOT supported. (Contrast: only no-spec fails — it cannot infer
the non-obvious reserve rule, confirming the rule IS load-bearing and non-inferable; both prose-guidance and
structure convey it fine.)

## Why this points at a BETTER argument (verifiability, not code-gen)

The experiment tested CLEAN guidance. Two things it does NOT overturn, and which are the real case for v4
removing the escape hatch:

1. **Guidance is INVISIBLE TO THE CHECKER.** The reserve rule the LLM followed from @guidance is prose —
   `analyse` cannot prove it, `weed` cannot gate code against it. In v4-structured the same rule is a
   `requires` + `invariant`, which the durability-gate experiment showed `analyse` proves and catches
   deterministically. So load-bearing detail in guidance is UNVERIFIABLE by construction. V4 forcing
   structure makes every load-bearing rule checkable. This is the real, evidence-backed reason.

2. **We only tested CLEAN, unambiguous guidance.** The genuine confusion risk is AMBIGUOUS or CONTRADICTORY
   guidance (prose that disagrees with the structure, or is vague). That is a different, weaker, and harder-
   to-defend claim; this experiment does not support it and we should not lean on it.

## Recommendation for the messaging
Do NOT argue "guidance-prose produces worse code" — it is false (LLMs follow clean guidance fine). DO argue
"guidance is invisible to the checker, so anything load-bearing hidden there cannot be proved or gated; v4
forces every load-bearing rule into checkable structure." That is true, evidence-backed (durability-gate +
this null result + the architecture), and consistent with the whole benchmark: spec FORM does not change
code-gen; v4's edge is VERIFICATION.
