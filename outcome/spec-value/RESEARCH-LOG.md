# Research log — spec value on Fineract (append-only, honest)

Programme: determine the largest benefit a specification adds to an existing codebase, and rank the
candidates B1..B5 (see MISSION.md) by effect size and significance. Autonomous loop; the human
reconvenes when RANKING.md carries a defensible SYNTHESIS.

---

## Iteration 0 — setup + B2 pilot recap

- Built the scaffold: MISSION.md (5-benefit taxonomy + discriminating experiments), RANKING.md,
  this log. Target = full Fineract (985k LOC, beyond-context).
- **B2 single-shot pilot (already run, honest negative):** localise the double-entry loan posting
  path over 985k LOC. nospec and spec scored IDENTICALLY (4/4 structural, caught the guard-gap) but
  spec cost MORE (595k vs 322k tokens, 21 vs 16 turns). Cause: domain vocabulary == code vocabulary,
  so grep bridges concept to code and the semantic map is redundant. => single lookups saturate; B2's
  only hope is amortisation across cold tasks (running now).
- Next: collect the B2 amortisation run, then design and launch B1 (bug-prevention via encoded intent)
  — the sharpest unique-value test.

## Iteration 1 — B2 amortisation run 1 — DISCARDED (sub-agent confound), harness fixed

- Ran 5 cold tasks x 2 arms. Raw totals looked like a spec WIN on cost: nospec $7.91 (17/18 correct)
  vs spec $5.14 (15/18). But verification (reading the actual outputs) killed it.
- **CONFOUND: arms spawned SUB-AGENTS.** I forgot to disallow the Task/Agent tool. Three outputs
  explicitly say "the background agent's independent sweep corroborates..."; several runs show the
  signature turns=1-4 but tok=49-98k (hidden delegated work). num_turns undercounts a delegating
  parent, and total_cost rolls up sub-agent tokens inconsistently across runs. The entire "spec is
  cheaper" headline rests on ONE run (nospec T2, 41 turns, $4.13) that did NOT delegate while others
  hid their work — apples to oranges. Cost numbers are UNTRUSTWORTHY.
- Also the spec's only correctness loss (T5, 0/3, 1 turn) was a DELEGATED run that skipped
  verification and answered confident-wrong. Cannot conclude "spec induces over-reliance" from a
  contaminated run either.
- **Fix:** added `Task,Agent` to disallowedTools in eval-locate.mjs and eval-amortise.mjs, so every
  arm must search in its own context and turns/tokens are directly comparable. Re-running B2 clean.
- Lesson for ALL experiments: disallow delegation, or the cost axis is meaningless. Banked in MISSION
  discipline. This is the verify-before-claiming rule catching a false headline before it was logged.

## Iteration 2 — B3 deterministic gap detection — SATURATES on catch/reliability (value is the GUARANTEE)
- 4 specs with a real seeded defect (contradiction, cross-dimension type error, infeasible
  requirement, subtle 3-invariant chain) + 2 clean controls. analyse run 3x/spec; model reviews the
  SAME Allium source, 6 reps/spec. Verdicts matched mechanically to ground truth (no judge, no
  inflation risk).
- Result:
  - analyse: 4/4 defects, 0/2 false positives, variance 0, NAMED flag each (CONTRADICTORY/TYPE_ERROR/
    INFEASIBLE) + non-zero exit code.
  - model: 4/4 defects (6/6 every spec), 0/2 false positives, ZERO flips. 100% correct and stable.
- **=> The checkable-representation benefit does NOT manifest as superior catch OR superior
  reliability against a frontier model on tractable specs. The model was perfect and stable.** Another
  saturation. Effect size on catch/variance = ~0.
- **The residual, real difference is a GUARANTEE, not a rate.** analyse cannot flip, by construction,
  and yields a named construct + exit code you can wire into CI and cite in an audit. The model was
  empirically stable over 6 reps but carries no proof it will be on the 7th, and no certifiable named
  verdict. In a REGULATED gate that certification is the value; on catch-rate there is none.
- Honest limit: only tested on small specs. Determinism plausibly bites only when a spec is complex
  enough that model review becomes unreliable — but prior work (buried 14-constraint APR) showed the
  model catches even those, so escalation likely saturates too. Logged; may escalate if time permits.
- B3 verdict for RANKING: LOW effect on catch/variance; value is qualitative (auditability/certifiability).
