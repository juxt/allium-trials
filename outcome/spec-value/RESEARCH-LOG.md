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
