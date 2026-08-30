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

## Iteration 3 — B2 amortisation CLEAN (no delegation) — SPEC ~30% CHEAPER, concentrated on the HARD task
- 5 cold tasks x 2 arms, Task/Agent disallowed so all search is in-context and comparable. Verified
  genuine (read T2 both arms; both are real deep answers, no delegation).
- Totals: **nospec $6.86 (17/18 correct, 3715k tok); spec $4.79 (18/18, 2599k tok).** Spec ~30%
  cheaper in $ and tokens. The 17-vs-18 correctness delta is within JUDGE NOISE (both arms nailed
  every task on reading; do not claim a correctness win).
- **The saving is NOT uniform amortisation — it is concentrated on the one retrieval-HARD task.**
  Per task: T1 same ($1.81 vs $1.82); T3/T4/T5 within ~$0.15; **T2 charge-off: nospec $3.15 / 31
  turns / 1.9M tok vs spec $0.88 / 20 turns / 427k.** On T2 the nospec arm explored broadly (chased
  sibling methods), while the spec's explicit "two sides accumulated separately and never reconciled"
  pointed the spec arm straight at it. Both prior runs (contaminated + clean) show nospec thrashing
  on T2, so the direction is consistent, though it rests on ONE hard task at n=1.
- **=> B2 is a REAL but SCOPED benefit: a spec saves large search cost exactly where blind retrieval
  is expensive (hard-to-locate, non-lexical targets); on easy/lexically-findable tasks it adds ~0.**
  Mechanism: the spec tells the model WHAT to look for, so it searches narrowly instead of broadly.

## Iteration 4 — B1 intent / bug-prevention — hypothesis REFUTED; surfaced a HAZARD instead
- 6 review cases (3 under-determined-intent violations, 3 benign), 4 reps, no delegation, decision
  parsed mechanically (MERGE/BLOCK), reasons read.
- **Violation-catching SATURATES.** nospec BLOCKED all 3 intent-flips 12/12 (rounding-residual removal,
  declining->flat interest, reversed allocation order) WITHOUT the spec — reasoning "this silently
  changes financial outcomes". My "under-determined intent the model can't know" premise was WRONG:
  the model blocks ANY material behaviour change defensively. spec also 12/12. Intent lift = 0.
- The spec changed the GROUNDS of the (already-correct) block: "violates documented intent X" vs the
  vaguer "this changes behaviour, please confirm". Real but qualitative (same auditability theme as B3).
- **The important finding is a COST: spec-induced TUNNEL VISION.** Benign case B3_guard (add a
  zero/negative-payment early-return): nospec BLOCKED 4/4 and was RIGHT — it caught that the guard
  silently drops NEGATIVE payments (reversals/refunds), a real data-corruption risk, and said withhold
  merge until intent is confirmed. spec MERGED 4/4 by EXPLICIT tunnel vision: "the spec only constrains
  allocation order... silent on zero/negative... blocking would be a false positive." The spec caused
  the reviewer to DISMISS a real out-of-scope bug. Same over-reliance as amortisation T5.
- **=> B1 does not establish intent as bug-prevention (saturates), and reveals that a spec can NARROW
  attention and cause misses on issues outside its scope.** This is the SAME mechanism as B2's saving:
  the spec focuses the model. In-scope hard target -> saves cost (B2 T2). Out-of-scope real issue ->
  miss (B1 B3_guard). Net value depends on spec completeness and whether what matters is in scope.
- UNIFYING INSIGHT (elevate to synthesis): **a spec concentrates the agent's attention on what it
  covers** — a benefit for cost on hard in-scope retrieval, a hazard for out-of-scope correctness.
