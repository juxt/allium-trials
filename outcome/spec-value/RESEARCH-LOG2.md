# Research log 2 — spec-correctness confidence, overconfidence, specs-as-tests (append-only, honest)

Budget 4h (END 1788103851 / 16:30). Phased plan + gates in PROGRAMME2.md.

## Iteration 0 — setup + Phase 1 launched
- Wrote PROGRAMME2.md (phases 1-5, gates 1-3, mutation testing as the objective oracle).
- Phase 1 (overconfidence fixable by framing?) launched: 3 out-of-scope-bug cases (negative-payment
  guard, non-idempotent retry double-post, balanced-but-wrong-account) x {nospec, ceiling, floor} x 4
  reps. GATE 1 decides whether tunnel vision is a fixable presentation problem or intrinsic.
