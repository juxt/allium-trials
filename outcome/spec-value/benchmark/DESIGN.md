# A spec-value benchmark: prose < V3 < V4

## Goal

A small, publishable benchmark that shows, in percentage terms, how well three ways of specifying a
system carry a task through to correct code: a prose specification, an Allium V3 spec, and an Allium V4
spec. The thesis to demonstrate is a ladder, **V4 > V3 > prose**, on real tasks a working engineer
recognises. Small enough to explain on one page, rigorous enough to publish.

## The ladder, and where each rung's gain comes from

The three arms are not arbitrary; each adds a capability the one below lacks, and the benchmark should
attribute the gain to that capability.

- **prose → V3.** Structure. A V3 spec states behaviour precisely (entities, rules, triggers) where prose
  is ambiguous, and it is executable enough to generate tests. The gain is disambiguation and test
  coverage.
- **V3 → V4.** Verification and the anti-vacuity floor. V4 *checks* the spec (preservation, refinement,
  arithmetic, objective discharge), so it catches design bugs before code; and V4 states *objectives*,
  the anti-vacuity floor a safety-only spec cannot. The gain is caught-at-design-time errors and
  vacuity-resistance.

## The one design constraint that matters most

Every result in this programme has obeyed one law: **spec value tracks non-obviousness.** A tool adds
nothing where a capable model already knows the answer, and a great deal where it does not. The cache
implementation saturated because caching is obvious; the bespoke stores did not, because their
obligations (write keys ascending or corrupt the index; a hidden batch capacity) are not guessable from
the API.

The benchmark therefore fails if its tasks are obvious. **Every task must carry at least one non-obvious
obligation** — a constraint a competent implementer, given only the interface and a plain description,
would plausibly miss. If a task saturates (all three arms score ~100%), it measures nothing and is
dropped or hardened. This is the single most important selection rule, and it is why the cache is a good
*test-generation* probe (does the objective yield the anti-vacuity test) but a poor *implementation*
task (everyone caches).

## Scoring: a fixed hidden oracle per task

Each task ships a fixed, hidden, executable oracle — a test suite grouped by obligation, the way the p6
harness works — never an LLM judge and never agent-generated tests (both add noise we have measured).
The score for one run is the fraction of obligation-groups that pass. Determinism where possible: the
oracle is pinned by a correct and a naive reference (the correct one scores 100%, the naive one exposes
the non-obvious obligations), exactly as `verify.py` pins the library-spec verdicts.

Spec-producing tasks (distillation) are scored indirectly: generate tests from the produced spec and run
them against the reference code and a known-buggy variant; a good spec's tests pass the reference and
catch the bug. This keeps even the spec tasks on an executable oracle.

## Task types and the matrix

Four task types, a couple of each, spread across domains (and, where cheap, languages), so the suite is
8–10 tasks. Each is one sentence to explain.

- **Greenfield** — implement a component from the spec. The gain shows as prose missing the non-obvious
  obligation and V4's objective catching vacuity. Candidates: the bespoke sorted-segment store and the
  time-series metric store (both proven non-obvious in p6).
- **Spec distillation** — extract a spec from existing code. The gain shows as V4's `analyse` catching an
  inconsistent or vacuous distilled spec that V3 accepts unchecked. Candidate: distil a spec from a
  reference with a subtle guarded invariant, score by whether the distilled spec's tests catch a planted
  bug.
- **Feature addition** — add a feature to existing code + spec without breaking what holds. The gain shows
  as V4's checker (preservation / objective discharge) flagging when the feature violates an existing
  invariant or objective, where V3 and prose ship the regression. Candidate: add an operation to the
  store that must preserve the capacity and ordering obligations.
- **Update to existing behaviour** — change a behaviour deliberately. The gain shows as V4 catching the
  *unintended* consequences of the change (a preserved invariant now broken) that the author did not mean
  to touch. Candidate: change the eviction/retention rule and check no safety obligation regressed.

## Fairness — representing each tool honestly

The result is only publishable if each arm is a fair rendering of its tool, not a straw man.

- The three specs for a task express the *same intent*; they differ only in representation and capability.
  The prose spec is a good-faith natural-language description a competent author would write, not a
  deliberately vague one. The V3 spec is idiomatic V3. The V4 spec adds only what V4 can express
  (objectives, checked contracts), over the same intent.
- Each arm runs the tool's *actual workflow*: prose is read; V3 may use its propagate/weed skills; V4 may
  run `check`/`analyse`, consult objectives, and use library specs. Withholding a tool's real workflow
  understates it.
- Fresh, uncontaminated implementer agents per run; the oracle is never in their context. N runs per
  (task × arm) with the variance reported. The whole suite is one re-runnable workflow.

## Honest risks

- **Saturation.** The chief threat; mitigated by the non-obviousness rule and by dropping any task where
  all arms tie.
- **Agent variance.** LLM implementers vary; report N and spread, do not over-read a single point.
- **Fair rendering.** The prose and V3 arms must not be strawmen; a reviewer should agree each spec is
  what a good author of that tool would write. This is the part most open to challenge and must be
  defensible per task.
- **Attribution.** A gain must be traceable to a capability (disambiguation, verification, objective), not
  to incidental wording. Where possible, an ablation (e.g. V4-without-objectives) isolates the cause, as
  the factorial did.

## Proposed first slice

Before building all 8–10, prove the harness on ONE task end to end, all three arms, fixed oracle: the
sorted-segment store as a greenfield task (its obligations are proven non-obvious, and the p6 oracle
exists). That yields the first honest three-way number and validates the scoring before the suite is
scaled. Then add one of each remaining type.
