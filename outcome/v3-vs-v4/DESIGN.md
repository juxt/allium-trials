# A harness that separates v3 from v4

## The problem, stated precisely

We want to know whether the v4 language and its checker are an improvement over v3, and
where they are the same or worse, so we can direct what is left to build in v4. Every
harness so far has failed to separate them because it put a strong model in the loop as the
measured variable. A capable model succeeds with either language on any task we can cheaply
construct, so the model's competence swamps the language signal. Six trials saturated for
this reason. The model is a confound.

## The principle

Measure the language and its checker directly, model-free wherever possible. A checker is
mechanical: on a given input it either catches a fault or it does not, expresses a property
or it does not, localises well or it does not. Mechanical instruments do not saturate. So
the harness is a **differential**: run both versions' checkers over a shared corpus and a
systematic mutation battery, and score each on fixed dimensions. No model decides anything;
the results are deterministic and reproducible, which is what confidence requires.

## The dimensions (what we score)

Weighted by the constitution. TOOL-6 — a false alarm is worse than a miss — makes soundness
dominate. Strength-of-green (proved | bounded | monitored, closed | assumed) grades a catch.

1. **Expressibility.** For each specimen, can the version express it (parse + well-form with
   no error)? Where one can express what the other cannot is a clean, model-free difference.
2. **Soundness (dominant).** Does either checker ever pass a spec that is actually broken (a
   miss), or fail a spec that is actually correct (a false alarm)? False alarms are weighted
   worst. Measured over correct specs and known-broken mutants with an authored oracle.
3. **Sensitivity.** Of the semantic mutants in each class, what fraction does each version
   catch? Reported per mutation class, never as a single number, so a version that is strong
   on one class and blind on another is visible.
4. **Diagnostic quality.** When caught, how good is the diagnostic: localisation (names the
   fault site), a minimal core or witness, provenance, and its strength-of-green. Graded on a
   fixed rubric; this is the diagnostic contract made measurable.

## The instrument: mutation-based differential

For each specimen we hold a CORRECT rendering in both v3 and v4, plus a battery of MUTANTS,
each an authored semantic break tagged with its class and the ground-truth verdict (broken).
We run `allium check` and `allium analyse` (and `monitor` for runtime classes) on the
correct spec and each mutant, in both versions, and score the four dimensions.

Mutation classes span the property space deliberately, so the matrix reveals where each
version is blind. Provisional taxonomy, to be reconciled with what v3 actually checks:

- **structural**: undeclared name, arity error, dropped keyword — both should catch.
- **case-split**: an overlap or a gap in a guarded case-split.
- **consistency**: two invariants that cannot jointly hold.
- **feasibility**: a declared scenario no accepted report can satisfy.
- **reachability / dataflow / conflict**: the classes v3's analyse targets — included so
  v4's gaps against v3 are visible, not hidden.
- **runtime (temporal / relational)**: a violation only a trace exposes — monitor territory.

The corpus must be FAITHFUL in both renderings: a rendering is faithful only if it admits
exactly the source's behaviours, neither narrower nor wider. This is the same discipline the
earlier differential work used to reject corrupt renderings.

## On self-seeding

Authoring the mutants is not the model self-seeding we feared. That failure was a model
catching only bugs it could imagine. Here the subject is a mechanical checker, whose
coverage is a fixed property we are mapping; the mutants only need to span the classes
systematically. The guard against a blind spot is a completeness critic over the class
taxonomy — what property class is not being mutated — not more reruns.

## What a good result looks like

A per-class matrix: mutation-class × version × {expressible, caught, sound, diagnostic}. It
should show, model-free and reproducibly, the classes where v4 beats v3 (its reason to
exist), where they tie, and where v4 currently loses (its to-do list). Confidence comes from
determinism and from soundness being clean; the diagnostic value comes from the losses.

## Build order

1. Ground the taxonomy in what v3 actually checks (an Explore pass is running).
2. A first paired corpus of 2-3 systems, correct + a mutant battery, faithful in both.
3. The runner: run both checkers over correct + mutants, score the four dimensions, emit the
   matrix.
4. Read it, find the classes that separate the versions, and iterate: deepen the corpus,
   add classes, sharpen the diagnostic rubric, run the completeness critic.
