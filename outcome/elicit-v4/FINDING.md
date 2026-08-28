# Elicit-process eval — what it found, and the honest boundary

## Built

- A v4 **language reference** and **elicit skill** (plugin `v4` branch, `skills-v4/`), with
  the sound checker in the loop: land answers durably, capture as invariants/axioms, run
  `allium analyse`, surface the minimal conflicting core instead of silently resolving, park
  ambiguity as `-- OPEN:`, and check requirements against library-spec axioms.
- Evals: `eval.mjs` (an emergent library-mediated contradiction) and `eval-scale.mjs` (a
  28-rule self-contradictory rulebook, contradiction buried in a chain).

## The elicit process works

The elicit arm reliably produces the disciplined artifact: a spec with a decision record
(question -> captured constraint), requirements as invariants, the third-party contract as
axioms, and a sound-check verdict. On every contradiction tested it surfaced the conflict
with the core (obvious: 6/6; buried-in-28-rules: 4/4). The mechanism is sound and the
artifact is exactly what the value proposition promises.

## But the detection delta against a build-directly baseline saturates

The unaided-of-Allium baseline is not weak. Told merely to "implement this", a strong model:

- caught the obvious 2-rule contradiction 6/6, even without being asked to check;
- caught the contradiction buried in a 28-rule rulebook 4/4.

The only contradictions it misses are those requiring genuine **search** (hard random-3SAT,
where the calibration measured 0% at N>=25). Those are artificial to frame as a real
rulebook, and — decisively — a model with a shell simply writes its own solver and cracks
them (33s in the frontier test). So there is no realistic regime where the model needs
Allium's checker to *detect* a contradiction: traceable ones it finds by reasoning,
search-hard ones it finds by self-tooling.

## What this leaves as the real, non-substitutable value

Detection and solving saturate. What does not:

1. **The disciplined, durable, trusted artifact.** A decision record, a sound-checked spec,
   parked OPEN items — reviewable and auditable, produced by process not by luck. A model
   asked to build produces prose and proceeds; it does not leave this behind.
2. **Refusing to proceed on ambiguity.** The untested and most promising LLM-in-loop axis is
   not contradiction (saturated) but *ambiguity*: given under-specified requirements, a
   build-focused model fills the gap with a guess and proceeds, where the elicit discipline
   parks it and refuses. Whether the guess is *wrong* — against a hidden ground truth, with
   an operator resolving the OPEN items — is the measurable question, and it is about
   disposition, not capability, so it may not saturate. It needs the operator-agent setup
   (Trial A's premise, refined to ambiguity).
3. **Assurance.** The sound, reproducible, auditable verdict a regulator accepts, which the
   model's ad-hoc reasoning is not.

## The v3-vs-v4 answer stands, on the assurance axis

Where v4 beats v3 is decided and model-free (the differential matrix): v4 is sound where v3
is heuristic and checks consistency, feasibility, coverage and runtime properties v3 cannot.
That is the defensible "v4 is the better assurance layer" — not "v4 lets the model solve
more", which the evidence rules out for any tool.
