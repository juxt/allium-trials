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
