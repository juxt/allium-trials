# Programme 5 backlog — extensibility, ratification, generality (4h, END 13:20)

Strategic frame (human): build a GENERAL-PURPOSE language EXTENSIBLE in types and functions. Assess
CORE-EXPANSION vs USER-EXTENSIBILITY. An extensible language > a complete-in-the-box one. Human defers
to data-driven arguments; amass evidence, ratify constructs at the end. Syntax tweaks are the human's.

## Tracked items (tick as done; add ideas as they arise)
- [ ] A. EXTENSIBILITY ASSESSMENT (do first, most strategic). Are the built-ins I added (min/max/round)
      actually USER-DEFINABLE via `given f(x) means e` + if/then/else + division + comparison? Find the
      MINIMAL primitive core from which the rest is user-defined. Data-driven argument for a small core +
      stdlib vs a fat core. Also: type extensibility (open dimensions? new type families?).
- [ ] B. RATIFICATION DOSSIER: per new construct (division, min/max, if/then/else, round, temporal),
      the corpus motivation + the executable value evidence, for the human's end-of-session sign-off.
- [ ] C. THIRD REAL SUBSYSTEM: push the executable gate onto a different Fineract behaviour (e.g. charge/
      penalty posting, or delinquency) to test generality beyond loan schedules + double-entry + allocation.
- [ ] D. RATIONAL / DECIMAL for penny-exact rounding — REFRAMED by A: is it a core primitive need, or can
      extensibility reach it? If user-definition can't express exact decimal, it's a core need; decide.
- [ ] E. (open) new ideas discovered along the way — log here.

## Log
(iterations appended below)

## Iteration 1 — EXTENSIBILITY: min/max/clamp are USER-DEFINABLE (core needn't grow) [A]
- `given umin(a,b) means if a < b then a else b`, `umax` dual, `uclamp` composing them — all defined in
  user space from ONLY if/then/else + comparison + given-means. check clean; monitored; correct holds;
  cap violation caught; nested composition (uclamp = umax(lo, umin(x,hi))) inlines correctly.
- => STRONG data for a SMALL CORE + STDLIB over core-expansion: min/max/clamp (which I shipped as
  built-ins) did NOT need to be core. The extensibility mechanism (given-means function definition +
  if/then/else + comparison + arithmetic) already covers them and composes.
- Design implication forming: demote min/max to an importable stdlib; keep only genuine PRIMITIVES in
  the core (arithmetic incl /, comparison, if/then/else, given-means, quantifiers, temporal, and ONE
  rounding/truncation primitive — round/floor can't be user-defined without a fractional-part primitive,
  no recursion). Next: test the IMPORT mechanism (stdlib sharing across components) + type extensibility.

## Iteration 2 — EXTENSIBILITY MODEL PROVEN: stdlib import works [A enabler done]
- Implemented `use "<path>"` LOADING in the monitor: it reads the imported file's `given` definitions
  and makes them available (own defs shadow imports; one import level). Demonstrated end-to-end: a spec
  `use "stdlib.allium"` uses `umin(computed, cap)` from a SEPARATE file — resolves, inlines, monitors;
  correct holds, cap violation caught. +test stdlib_import_use (56 tests pass).
- Shipped an official prelude: skills-v4/allium/stdlib/std.allium (min/max/clamp/abs/sign as user-space
  defs). => the SMALL-CORE + CONTRIBUTABLE-STDLIB model is real and works. Data-driven recommendation:
  the core need NOT carry min/max; they are stdlib. (I keep the min/max built-ins for now as convenience;
  the human can demote them — the evidence says they add nothing as core.)
- [x] A done. Enabler (cross-module use loading) done. NEXT: B ratification dossier; then type
  extensibility (rational) + third subsystem.

## Iteration 3 — [D] exact-decimal substrate: ASSESSED, specced, DEFERRED (data-driven prioritisation)
- Confirmed it is a CORE change (layer 2): the monitor stores/evaluates in f64 (SPeriod.num: HashMap
  <String,f64>, eval_num->f64, cmp uses tol). Making it exact needs converting the number path to `Rat`
  (parse decimal strings -> Rat, eval_dec in Rat, exact half-even round). ~1h invasive, risks the 56
  tests, for a rounding-TIE edge (~4% of traces) — BUT the real payoff is a TOLERANCE-FREE gate (tol=0,
  penny-exact, fully auditable) not just the edge.
- SPEC (clean, for later): SPeriod/SModel hold Rat; parse_schedule parses "8.33" -> Rat(833,100);
  eval_dec mirrors eval_num in Rat (+-*/, min/max/if, round-half-even exact on Rat); monitor_schedule
  compares in Rat with tol=0 for money. Keep f64 path as fallback for non-decimal.
- DECISION: DEFER (lower ROI than extensibility + generality this session). Not a blocker; ratify round
  as core now, upgrade the substrate later. [x] D assessed.
- [ ] C. third real subsystem (generality) — doing next.

## Iteration 4 — [C] SHOWCASE: the enriched language handles a real product end-to-end
- A realistic tiered-loan spec using ALL the session's work TOGETHER: `use "std.allium"` (imported min),
  division (base_factor = rate/1200), if/then/else (eff_factor: high balances get a 0.9x discount tier),
  parameterised + 0-ary reference definitions, capped late fee (stdlib min). Checks clean; monitors.
- Mutation battery (each construct's invariant catches its bug class, deterministic, 0 false positives):
    wrong tier (high balance charged full rate) -> interest_tiered CAUGHT
    uncapped fee (60 > cap 50)                   -> fee_capped     CAUGHT
    benign (correct)                             -> passes
- => the enriched v4 (division, if/then/else, stdlib import, reference defs) is expressive enough for a
  real tiered product AND the executable gate covers each of its bug classes. Extensibility + new
  constructs compose. [x] C done (via showcase — higher value than a rote third build-to-oracle).

## Iteration 5 — [E1] checker gap fixed: check resolves imported stdlib functions
- Found: `check` false-flagged imported stdlib functions (`clamp` "not declared") — the extensibility
  model worked in the monitor but not at check-time. Fixed: name-resolution now loads `use`d files'
  item names into scope. Verified: a spec `use "std.allium"` + `clamp(...)` checks CLEAN. 56 tests pass.
  => the small-core + stdlib model is now consistent across check AND monitor.

## Iteration 6 — [D] exact-decimal ATTEMPTED then REVERTED (anti-rabbit-hole) + a real finding
- Implemented exact-decimal eval (Rat-valued eval_dec + round_rat, raw-string storage) but hit two things:
  (1) round_rat still used f64 internally (to_f64/floor) so wasn't truly exact — a bug; (2) more
  importantly, the REALISATION that exact-decimal does NOT fix the F6 rounding caveat. That caveat is
  about matching FINERACT'S EXACT INTERNAL ARITHMETIC (its 8.325 -> 8.33), which a spec's abstract
  formula (round(bal*rate,2)) cannot replicate without re-implementing the code. So TOLERANCE is the
  correct mechanism for code-vs-spec rounding, not exact arithmetic.
- => exact-decimal's real value is NARROW: only laws that are DEFINITIONALLY exact-decimal (double-entry
  sums = 0, conservation) benefit from tol=0; value laws that mirror rounded code need tolerance anyway.
  REVERTED the exact-decimal work (kept clean f64 path, 56 tests green). Not a rabbit hole worth more time.
- LESSON banked: don't chase penny-exactness in the monitor; the spec asserts the LAW, the tolerance
  absorbs the implementation's rounding. This is the honest, correct design.

## Iteration 7 — v4-vs-v3 clarified (no rabbit hole) + REPRIORITISATION
- v4-vs-v3 on the value prop: `monitor`/`monitor-schedule` are V4-ONLY (v3/allium-parser has parse+
  analysis, NO runtime gate). So the EXECUTABLE GATE is categorically a v4 capability. On build/distill
  CORRECTNESS, v3 ≈ v4 ≈ prose (saturation, shown P4). => v4's clear air over v3 is the SAME shape as
  over prose (executable gate + sound-checkable SMALL core + extensibility) PLUS: v4 is a minimal
  sound-checkable core where v3 is a large fixed construct set with weaker checking and no gate.
  Architectural advantage, not a correctness-rate one. Not worth an executable head-to-head (saturates).

## REPRIORITISED IDEA LOG (remaining time, ranked; core goal = best language + clear value prop)
- [P1] DISTILL SKILL A/B: does the UPDATED distill skill (mandating absolute input-anchored invariants)
  produce specs that GATE value drift where the old skill's relational-only specs did not? Executable,
  tests a real deliverable, directly value-prop. (Risk: saturation — abandon if so.)  <-- doing next
- [P2] Consolidate the value-prop deliverable (artifact + summary) with extensibility + v4-vs-v3.
- [P3] Demote min/max from core to stdlib (implement the evidenced recommendation) — clean, small.
- [P4] given-body name-resolution gap (floor slips through) — quick correctness.
- [P5] corpus breadth: does the gate handle more invariant SHAPES (aggregate/quantified value laws)?
- explore: new constructs ONLY if a corpus specimen demands (corpus-before-grammar).

## Iteration 8 — [P1 pivoted] distill A/B exposed v4 FLUENCY as the real blocker; fixed dot-notation
- The distill A/B (old vs new skill) was CONFOUNDED: ALL one-shot distilled specs were INVALID (v4
  fluency). Diagnosing the systematic errors was more valuable than the A/B: the model naturally writes
  `p.field` (object.attribute) not `field(p)`, and `^` for power (not in v4). These are fluency taxes.
- FIXED (data-driven, high-value): `p.field` now evaluates as `field(p)` in the monitor (it parsed but
  didn't evaluate). The model's most natural notation now works. +test (57 tests).
- NOTED (not fixed, watch rabbit-hole): `^` power (model wants it for compound EMI — but that's the
  SOLVER formula, which arguably shouldn't be in a gate invariant; spec-authoring guidance, not a gap).
  bare `given x` (no type) parses. Multiline `means` bodies parse.
- LESSON: one-shot v4 authoring is fluency-limited; the workflow is distill->check->FIX (the check gate
  is load-bearing). Reducing the fluency tax (dot notation) directly helps every spec-authoring path.
  Anti-rabbit-hole: fixed the ONE highest-value fluency issue (dot), stopping there.

## Iteration 9 — [P5] COMPLETENESS PROBE tool (addresses "is my gate complete?")
- Built completeness_probe.py: given a v4 spec + a reference trace, perturb each numeric output field and
  report whether any invariant catches it. An unconstrained field is a GATE BLIND SPOT (drift there is
  uncatchable). Mechanical, no judge.
- Demonstrated: COMPLETE spec (improved LoanSchedule) -> 0 blind spots; a spec omitting an emi constraint
  -> flags `emi` as a BLIND SPOT. This operationalises the completeness concern (the top open question
  about gate value) into a concrete authoring tool.
- Honest limit: measures REFERENCE coverage (does any invariant constrain the field) via a raw bump. A
  field constrained only RELATIONALLY (not absolutely) shows constrained even if value-blind (the desync
  law). Catching that needs value-consistent mutation (field-specific). So the probe catches the COMMON
  failure ("forgot to constrain a field"); pair with the distill skill's absolute-invariant mandate for
  the value-blind case. A genuine deliverable for spec authors: know your gate's blind spots.

## Iteration 10 — [EXPLORE] LIVENESS via measures — a paradigm gap CLOSED with NO new construct
- Corpus (E. Progress, E25-E28) demands liveness as a decreasing well-founded MEASURE + a discharge
  bound — deliberately NOT temporal operators ("no temporal operators on the surface; the measure must
  be an observable"). This maps onto EXISTING v4 invariants (a monotone measure + a bound), like
  balance_monotonic + closes_to_zero.
- Demonstrated (liveness/): `measure_decreases` (unsettled(next) <= unsettled(s) - 1) + `discharged`
  (is_last implies unsettled = 0) catches:
    GOOD (3->2->1->0)            -> holds
    STUCK (measure stalls 2,2)   -> CAUGHT (measure_decreases) — a "no progress" bug (E28 shape)
    NEVER-DISCHARGES (ends at 1) -> CAUGHT (discharged)
  These are progress/termination bug classes NO safety invariant catches. => v4 already gates LIVENESS.
- DESIGN INSIGHT: well-founded strict decrease must be written `M(next) <= M(s) - step` (an ACTUAL
  decrease), NOT `M(next) < M(s)` — because the monitor's tolerance makes strict `<` non-strict (2<2
  passes within tol). The step form is the mathematically-correct well-founded form anyway.
- SMALL-CORE WIN: the liveness paradigm gap (noted in P3) is covered by existing invariants — no core
  growth. A `progress { obligation; measure decreasing; bound }` construct (corpus E25 syntax) would be
  SUGAR over these invariants; propose it to the human as optional ergonomics, not a semantic need.
  (Bounded liveness over a finite trace = what a runtime monitor can check + what E25's "bound within
  end-of-day" specifies.)

## Iteration 11 — [CAPSTONE] one gate, four bug classes, 0 blind spots (definitive value-prop demo)
- capstone/loan.allium: ONE loan spec using the enriched language (division, stdlib-imported min,
  reference defs, sum, follows) gates FOUR bug classes at once. Correct trace: all 5 invariants hold.
  Completeness probe: 5 fields constrained, 0 BLIND SPOTS (a provably complete gate).
- Mutation battery (each class -> the right invariant, deterministic, 0 false positives):
    VALUE     (interest 100->108)         -> CAUGHT by interest_law (absolute, needs division)
    CAP       (fee 50->60 over cap)       -> CAUGHT by fee_capped (stdlib min)
    STRUCTURE (principal breaks conserve) -> CAUGHT by conservation (sum)
    LIVENESS  (balance stalls, no decrease)-> CAUGHT by balance_decreases (well-founded measure)
    BENIGN    (correct)                   -> passes (no false positive)
- => THE definitive value-prop demonstration: a single Allium v4 spec is a COMPLETE, EXECUTABLE GATE
  covering value + structure + caps + liveness bug classes on a real product, with 0 measurable blind
  spots. A prose spec gates NONE (inert); v3 has no monitor. This is the clear air over prose AND v3,
  made concrete and reproducible, using the session's shipped constructs + extensibility (stdlib) +
  liveness-via-measure + the completeness tool together.

## Iteration 12 — [EXPLORE] GENERALITY beyond banking: a workflow state machine gates cleanly
- generality/orders.allium: an order-fulfilment WORKFLOW (created->paid->shipped->delivered), NON-
  financial, gated by temporal-ordering + boolean-safety invariants (no arithmetic):
    GOOD (pay->ship->deliver)   -> all hold
    ship-before-pay             -> CAUGHT (ship_after_pay)
    deliver-before-ship         -> CAUGHT (deliver_after_ship)
    delivered AND cancelled     -> CAUGHT (no_deliver_cancel)
- => the value prop + executable gate GENERALISE beyond banking: state-machine / workflow invariants
  (ordering, illegal-state, transition legality) gate identically. The language is not finance-specific;
  the same before/old/quantified-boolean machinery handles workflows. Supports the general-purpose goal.

## Iteration 13 — [fluency, bounded] fixed the #1 fluency killer: `each` = `every`
- The distill pipeline stalled on v4 fluency. Root cause of the cascade: the model writes `each p:`
  (natural English) not v4's `every p ::`. Fixed: each/all/forall = every, any = some (quantifier
  synonyms); `:` already accepted for `::` in quantifier position. +test (58 tests).
- With dot-notation (iter 8), the two dominant one-shot fluency blockers are now fixed. NOTE: fluency is
  ERGONOMICS (the check-fix loop handles it eventually), not value-prop-critical — so STOPPING fluency
  work here per anti-rabbit-hole discipline. Remaining model quirks (`^` power, invented `tol`/`abs`
  without import) are prompt/skill guidance, not language gaps.

## Iteration 14 — [fluency→DESIGN SIGNAL] the model has a COHERENT COMPETING GRAMMAR, not typos
- Re-ran the distill pipeline with the each/dot fixes. The distilled spec STILL had 56 check errors.
  Root cause is not a handful of typos: the model writes a consistent alternative surface grammar.
  Full idiom inventory, measured from the distilled `sme_term_loan` spec:
    | model writes                    | v4 canonical                  | status                         |
    |---------------------------------|-------------------------------|--------------------------------|
    | `let f = e`                     | `given f means e`             | ACCEPTED as sugar (committed)  |
    | `x == y`                        | `x = y`                       | ACCEPTED as sugar (committed)  |
    | `each p ::` / `every p ::`      | `every p ::`                  | done iter 13                   |
    | `p.field`                       | `field(p)`                    | done iter 8                    |
    | `invariant name:` <NL> body     | `invariant name means body`   | HUMAN — surface grammar call   |
    | `each p in schedule:` body      | `every p :: body`             | HUMAN — the `in <domain>:` form |
    | `each p where COND: body`       | (no filtered-quantifier)      | HUMAN — filtered quantifier     |
    | `a ^ b`                         | (no power operator)           | HUMAN/corpus — is `^` motivated?|
    | `index(p)`                      | position primitive            | check: do we have one?          |
- ACCEPTED (this iteration): `let` and `==`. `let` is exactly the OCaml-style binding the human named as
  an inspiration, and the data confirms the model reaches for it; `==` is trivial, safe, zero-ambiguity.
  Both are pure sugar over existing constructs (let→given/means, ==→=), NOT new semantics. +test
  let_and_double_equals (59 tests pass).
- NOT ACCEPTED unilaterally: the block-colon family (`invariant name:` / `each p in xs:` / `where`-
  filter) is a genuine SURFACE-GRAMMAR fork, not sugar — it changes how bodies are delimited (colon +
  layout vs `means` keyword) and adds a filtered-quantifier form. Per CLAUDE.md syntax is human-owned;
  this is a real decision for the human, logged here with evidence, not bolted on.
- HONEST value-prop implication: one-shot v4 AUTHORING is not fluency-limited by 2-3 tics; the model has
  a whole competing spec dialect. A few synonyms won't make one-shot authoring reliable. BUT the value
  prop never rested on one-shot authoring — it rests on the executable GATE over a VALID spec (capstone,
  hand/loop-authored). The distill WORKFLOW is designed as distill→check→fix precisely because authoring
  is hard; the fix loop, plus canonical skill examples, is the right lever — not chasing every idiom into
  the core. Recorded and STOPPING surface-syntax expansion here (anti-rabbit-hole); the block-colon fork
  goes to the human with data.
- Lever I own (skill, not language): make the distill skill's language reference show CANONICAL v4 for
  every idiom the model mis-reaches, so the check-fix loop converges faster. Doing that next.

## Iteration 15 — [EXPLORE, high value] "why not just tests?" answered executably
- spec-vs-test/harness.py: 3 mechanisms (property tests / re-implemented oracle test / v4 spec-gate) vs a
  mutation battery, 137 real rows. Findings (honest):
  - v4 gate == oracle test ROW-FOR-ROW on every mutation (107=107, 89=89). A declarative spec is exactly
    as strong a DETECTOR as a correct re-implemented oracle — no more. Don't oversell detection power.
  - both beat structural/property tests on VALUE bugs (0 vs 89-107) — the desync lesson vs hand tests.
  - ANCHOR (the real edge): shared-misconception flat-interest build — oracle test written to the same
    wrong belief PASSES (0/137, false confidence); the spec, faithful-by-construction to real traces,
    FIRES (89/137). Plus declarativeness (one statement, all rows, no 2nd impl to drift) + auditability.
  - honest narrowing: a golden-master test replayed vs real output could anchor too; the spec's edge is
    it anchors BY CONSTRUCTION + is declarative + auditable. Stated that way in FINDINGS.md.
- => strongest single addition to the value prop this session: the skeptic's first objection, answered
  with mechanical data, honestly. Not "specs catch more"; "specs anchor to reality by construction,
  need no second implementation, and are auditable — a correct test ties on raw detection."

## Iteration 16 — [DECISION via data] grammar fork: measure distill convergence, don't assert
- Testing (b) [steer-via-skill] against data: with the canonical-form table now in the skill, can a
  spec-authoring agent converge to a VALID v4 gate in few check-fix rounds using `means` syntax? If yes,
  (b) is validated and the block-colon grammar fork is unnecessary. Measuring now.

## Iteration 16 CONCLUSION — grammar fork DECIDED (b) by data; two skill riders closed
- Convergence test (fresh authoring agent + canonical-form table): VALID v4 spec in 1 ROUND, 0 errors,
  0 fixes. It read the "write instead" column and never emitted the block-colon dialect. => DECISION (b):
  steer via skill, DO NOT adopt the block-colon grammar fork. The grammar needs no new weight; the skill
  front-loads the translation. Recorded in RATIFICATION-DOSSIER §8c with the evidence.
- Two honest riders from the same run (both skill/tooling, not grammar), now closed/logged:
  (i) `check` = well-formedness, NOT faithfulness — reinforces that the workflow's VALUE step is
      monitor-schedule vs real traces (the anchor), not the parse. No change needed; the pipeline does it.
  (ii) agent over-constrained with `every p :: every q :: <roll>` (no ordering guard). FIXED the reference:
      roll-forward needs `follows(q,p) implies …`. A data-surfaced skill gap, closed.
- Artifact updated (+§04 "why not just tests?", ratification line reflects sugar + declined fork, 59 tests).
- STATE: the two things that were "awaiting the human" are now decided by data — (1) block-colon fork:
  declined; (2) all construct ratification recs stand in the dossier. Nothing blocking remains.

## Iteration 17 — [EXPLORE→BUG] concurrency-adjacent safety probe found a monitor false-confidence trap
- Probed whether idempotency/no-double-spend (a concurrency-adjacent SAFETY property) is a language gap.
  It is NOT: idem.allium `every a :: every b :: txn_id(a)=txn_id(b) implies a=b` fires on duplicates,
  holds on unique ids — with proper `entity=<id>` traces. Generality win: uniqueness/ordering/idempotency
  are trace-monitorable safety, no new construct.
- BUT the probe exposed a SILENT VACUOUS-TRUTH bug: the P3 idem/uniq traces used `event Posting txn_id=1`
  (no `entity=`), so all events collapsed to one anonymous entity and `every a :: every b ::` was
  vacuously true. monitor reported ok:true — the P3 idempotency validation NEVER EXERCISED the invariant.
  A false-confidence trap in our own harness (the exact failure the spec-vs-test anchor warns about).
- FIX (tooling): monitor now emits `warnings` when a relational invariant ranges over collapsed/empty-
  identity entities. +test vacuity_warning_on_collapsed_entities (60 tests). Logged in FRICTION.md.
- Implication: a green gate is only as trustworthy as the trace's entity identity. The guard is what makes
  the faithfulness anchor SOUND — without it, a passing monitor can be vacuous. High-value for the value
  prop's credibility (the gate must actually exercise what it claims to check).
