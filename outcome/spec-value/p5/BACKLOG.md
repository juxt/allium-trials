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
