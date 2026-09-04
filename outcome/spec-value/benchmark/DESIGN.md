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

## Credibility: real tasks, real failure modes

A non-obvious obligation must be a *real* one — a constraint whose omission causes an actual production
bug — not an invented gotcha. The task is a task a working engineer recognises; the scored obligation is
the thing engineers genuinely get wrong on it. Lost pennies when a money amount is split and the
remainder is dropped; a stale read after an invalidation is missed; a message silently dropped on
redelivery; an index that returns wrong answers when keys are written out of order. If a credible task
would otherwise saturate, it is desaturated by scoring its real hard part, never by bolting on an
artificial trap. We do not invent tasks; we find the authentic failure mode inside a real one.

## Fairness model — what is held equal, and what is not

Elicitation (surfacing an obligation the author did not know) depends on the author, not the tool, so it
is not what a fair comparison isolates. The three specs for a task are therefore **equivalent in intent**:
each states the same obligations, written the way that tool's author would. What differs is the tool's
own workflow, and each arm runs it:

- **prose** — a good-faith natural-language spec, read and implemented.
- **V3** — the same intent as idiomatic V3, with its propagate / weed workflow available.
- **V4** — the same intent in V4, plus what only V4 can do: `check` / `analyse` the design, state and
  discharge objectives, reference a library spec.

So the benchmark isolates **guidance** (does the representation help an implementer realise a stated
obligation) and **verification** (does the tool catch when the code or spec is wrong), not who happened
to know the obligation. Each task's three specs are signed off as fair before it runs — that judgement is
human, per task, and is the part most open to a reviewer's challenge.

### Workflow-realistic (the model we run)

Refined after the greenfield-saturation problem: if all three specs state the same obligations, a
greenfield task saturates and shows nothing. So the arms are **workflow-realistic**. Every arm starts
from the SAME task requirements — which state the goal but NOT the non-obvious gotcha — and each uses its
tool's real workflow to get to code: prose implements directly; V3 builds a V3 spec (its process) then
implements; V4 builds a V4 spec, runs `check`/`analyse`, states objectives, then implements. The hidden
oracle scores the full outcome, every obligation including the gotcha and (for feature/update) the
existing behaviour. This includes elicitation, which is a real tool capability, and is fair as long as
each arm gets its own best workflow (prose is a thoughtful author, not a strawman).

Fairness then reduces to two human, per-task judgements that cannot be automated: the task is CREDIBLE,
and its gotcha is an AUTHENTIC failure mode. It is no longer a hand-equalised spec to sign off.

### The ladder decomposes across task types

No single task shows the whole ladder; the suite does.

- **Greenfield** shows **prose < V3**: the structured process elicits the non-obvious obligation prose
  omits. V3 ≈ V4 here — once an obligation is stated, implementing it is easy — so greenfield is a weak
  V3-vs-V4 discriminator.
- **Feature-addition / update-behaviour** shows **V3 < V4**: V4's `analyse` flags at spec-time,
  deterministically, that the change breaks an existing invariant or objective; V3 and prose rely on
  regenerated tests happening to cover the regression, or ship it. The oracle's existing-behaviour tests
  are what surface it. Same deterministic-check-vs-luck theme as the p7 anti-vacuity result.
- **Distillation** shows **V3 < V4**: V4 `analyse` catches an inconsistent or vacuous distilled spec that
  V3 accepts unchecked.

## Legacy modernisation — the domain where the spec is essential, not ceremony

The `acct-fee` slice saturated: a strong model guards a fee by instinct, so V4's check had nothing to
catch. The lesson generalised — V4's verification catches, for a capable model, mostly bugs it was not
going to write. The task type that escapes this is **legacy modernisation**: refactor or rewrite a piece
of legacy code that carries a *load-bearing but surprising* behaviour — a quirk downstream depends on
precisely because it looks like an accident (Hyrum's Law). A clean rewrite drops it; prose and instinct
fail by construction, because the behaviour reads as cruft. This is real, abundant, and commercially
live. The requirements say "modernise / clean up this code, preserving behaviour"; the hidden oracle tests
that the surprising behaviour survived.

**Where V3 and V4 actually diverge, applied here.** Capturing a *safety* quirk in a spec is something V3
does too, so a safety-quirk modernisation lands at **prose < V3 ≈ V4** (the spec, either version, carries
the quirk that prose omits). The clean **V3 < V4** appears only where the preserved behaviour is a
**liveness / objective** property — "this loop always terminates", "this worker always drains its queue",
"this retry always gives up within N" — because the objective is the one construct V3 structurally lacks,
and V4 can now *verify* it (the discharge pass). So legacy modernisation splits cleanly by quirk kind:
safety quirks demonstrate prose < V3; objective quirks demonstrate V3 < V4.

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

## Meta-finding — the single-shot instrument is wrong for V4 (three saturations)

Three single-shot tasks saturated: cache-implementation (caching is obvious), acct-fee (overdraft guard
instinctive + telegraphed by the base code), legacy-terminate (the termination budget was a required
signature parameter, maximally legible). The pattern is not three task-design misses; it is the finding:
**for a strong model, the bugs V4's checker catches are mostly bugs the model does not make.** A single-shot
benchmark with a fresh capable agent measures first-draft quality, and there V4 ≈ V3 ≈ prose.

V4's value is not first-draft pass-rate. It is **assurance** (a property PROVED over all cases, not five
tested examples — the regulator-facing difference) and **durability** (a standing gate that catches drift
when a later edit, by someone who has lost the original intent, breaks a load-bearing property). Neither is
visible in a one-shot implement-from-spec measurement.

### The pivot: measure durability, not first-draft correctness

- **Durability eval.** Start from spec + correct code. Apply a SEQUENCE of feature edits, each by a fresh
  agent that sees only the code and its own edit request (not the accumulated intent). A later edit
  naturally breaks an earlier invariant/objective because it is not in the editor's local context. Measure
  whether each arm's GATE catches the regression: V4 `analyse`/`weed` (deterministic), V3 regenerated tests
  (coverage-dependent), prose (nothing). This is where the spec earns its keep, and it does not depend on a
  single agent making a mistake — it depends on intent being lost across edits, which is realistic.
- **Assurance is a capability, not a rate.** "Prove the property holds for ALL reachable states" is
  yes/no per tool (V4 design-time proof; V3/prose tested examples only). Report it as a capability matrix,
  not a percentage. The one clean single-shot V4>V3 result we have — p7, the anti-vacuity test GENERATED
  from the objective — is itself a gate-generation result, consistent with this reframe.

The single-shot tasks stay in the suite only where the obligation is genuinely non-obvious to a strong
model (the bespoke stores for prose<V3 elicitation). The V3<V4 story moves to durability + assurance.

## The line: legitimate legacy obfuscation vs gaming the harness

A real concern once we deliberately obscure a quirk to beat saturation. The test for which side we are on:

**Legitimate** — the quirk is hard to see because it is hard to see IN REAL LEGACY CODE: a magic constant
with no comment, a budget buried in tangled control flow, an invariant maintained implicitly across
scattered sites, a behaviour that emerged from an old bugfix. A real engineer, modernising in good faith,
plausibly misses it. We are reproducing the actual conditions under which the bug ships. Two hard
requirements keep it honest:
1. The quirk must be RECOVERABLE by a careful human from the code alone — it is real, not invented.
2. All arms get EQUAL-FIDELITY artefacts. No arm is handed intent the others are denied. If the V4 spec
   states the objective, it is because the tool's own elicitation process surfaced it from the same code —
   not because we typed the answer into V4 and gave prose a vaguer description. Where practical, produce
   each arm's spec by running that tool's real process on the code, rather than hand-authoring the answer.

**Gaming** — obfuscation contrived specifically to defeat the model, hiding the gotcha in a way real code
never would, or withholding from prose/V3 an understanding the V4 spec was simply handed. If the only way
to recover the quirk is the spec we wrote, the spec is a crib sheet and the result is manufactured.

**Why the gate/durability pivot is also the honest pivot.** The single-shot obfuscation approach is exactly
where the gaming risk concentrates — we end up tuning *how hidden* the gotcha is until a gap appears, and
that dial has no principled stop. The gate and durability measurements avoid the dial entirely: they
measure a CAPABILITY (can the tool express and check this property; does the standing gate catch a
regression) that does not depend on hiding anything. A termination objective is either expressible or not
(V4 yes, V3 no) regardless of how legible max_ops is. So the pivot is not just a better instrument, it is a
less game-able one.

**Where single-shot stays legitimate.** Only where non-obviousness is INHERENT, not obfuscated — the
bespoke stores, whose internal constraint (write ascending or corrupt the index) genuinely is not guessable
from the API. There is nothing hidden; the domain is simply specialised. That is the clean home for the
prose < V3 elicitation rung.
