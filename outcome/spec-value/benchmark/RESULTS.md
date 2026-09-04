# Benchmark results — the honest prose < V3 < V4 story

The thesis holds, but the three rungs are measured by *different instruments*, and finding that out was
the main result of building it. A single-shot "implement from the spec" measurement saturates for a strong
model, so it is the wrong tool for the V3→V4 rung. Below is what the evidence actually supports.

## prose < V3 — elicitation (single-shot, real)

A structured spec surfaces the non-obvious obligation that prose omits. On the bespoke stores (p6), a
strong model given only the API and a plain description hits ~20% of the obligations (it cannot guess that
keys must be written ascending, or that a batch has a hidden capacity); given the spec that states them, it
hits ~100%. This rung is solid and single-shot. It requires the obligation to be genuinely non-obvious —
an obvious one (a cache that caches) saturates all arms.

## V3 < V4 — the GATE, not first-draft code

Three single-shot feature/modernise tasks (cache-impl, `acct-fee`, `legacy-terminate`) all SATURATED:
prose = V3 = V4 = 100%. The reason is not bad tasks; it is the finding — **for a strong model, the bugs
V4's checker catches are mostly bugs the model does not make.** First-draft pass-rate is the wrong metric
for V4.

V4's edge over V3 is the CHECKABLE GATE. The clean result (p7): from a V4 spec, `allium plan` emits an
OBJECTIVE (anti-vacuity) obligation and a suite generated from it catches a vacuous implementation **100%**
of the time; from V3-expressible (safety-only) obligations it catches it **~0%** (V3 has no objective
construct to emit the test from). The objective turns a check from a coin-flip of whether the author thinks
of it into a guaranteed gate. This is where V3 < V4 lives: not "V4 writes better code first", but "V4 can
express and generate a check that V3 structurally cannot."

## Assurance — a capability, not a percentage

| | prove a property over ALL reachable states | state a liveness / termination objective | generate the check from the spec | standing gate on the running code |
|---|---|---|---|---|
| prose | no | in words only (unchecked) | no | no |
| V3 | tested examples only | no (no construct) | safety only | weed (safety only) |
| V4 | yes (design-time discharge) | yes (objective + discharge) | yes (safety + objective) | weed + analyse |

This matrix is the regulator-facing story from the sales scaffold made literal: "we proved it over all
cases" vs "we tested five examples", and "state a termination guarantee at all", are yes/no capabilities,
not rates. V4 is the only column that is never blank.

## The honest headline

- **prose → V3**: real, measured, single-shot (elicitation of non-obvious obligations).
- **V3 → V4**: not first-draft pass-rate (≈ for strong models) but the gate — V4 expresses, generates, and
  proves checks (objectives, all-cases proof) that V3 cannot. p7 is the proof point.
- **Durability** (the standing gate catching a late regression when intent is lost across edits) is the
  strongest commercial claim and the one measurement still to run concretely — the pivot in DESIGN.md. It
  is expected to extend p7's gate result from one shot to a maintenance sequence.

Do not oversell one-shot correctness. The defensible, evidenced claims are elicitation (prose<V3) and the
gate + assurance capability gap (V3<V4). That is a stronger and more honest published story than a forced
first-draft pass-rate ladder the evidence keeps resisting.
