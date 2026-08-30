# Research log 2 — spec-correctness confidence, overconfidence, specs-as-tests (append-only, honest)

Budget 4h (END 1788103851 / 16:30). Phased plan + gates in PROGRAMME2.md.

## Iteration 0 — setup + Phase 1 launched
- Wrote PROGRAMME2.md (phases 1-5, gates 1-3, mutation testing as the objective oracle).
- Phase 1 (overconfidence fixable by framing?) launched: 3 out-of-scope-bug cases (negative-payment
  guard, non-idempotent retry double-post, balanced-but-wrong-account) x {nospec, ceiling, floor} x 4
  reps. GATE 1 decides whether tunnel vision is a fixable presentation problem or intrinsic.

## Iteration 4 — Phase 1 (overconfidence fixable?) — tunnel vision is in the DECISION, and floor framing recovers it
- 3 out-of-scope-bug cases x {nospec, ceiling, floor} x 4 reps. The caught_oos judge was UNRELIABLE
  (internally contradictory: floor<nospec<ceiling) — it measured "did they NAME the issue", not "did
  they BLOCK". Verified from raw outputs; the reliable signal is the parsed MERGE/BLOCK decision.
- By decision (merge = bug slips): OS1 nospec 0/4 merge, **ceiling 2/4 merge**, floor 0/4 merge.
  OS2 & OS3: all arms BLOCK 4/4 (no tunnel vision triggered).
- **Verified mechanism (read outputs): tunnel vision is a DECISION failure, not a perception failure.**
  The 2 ceiling reps that MERGED OS1 actually NOTICED the negative-payment bug but merged anyway —
  "out of the spec's scope... doesn't gate the merge." The 4 floor reps NOTICED the same bug and
  BLOCKED — "negatives should throw, not no-op... a data-integrity risk the spec doesn't cover." The
  FLOOR framing ("this spec is PARTIAL; not-violating-spec != safe; flag any other risk") flips the
  decision from merge-anyway to block. nospec also blocks (no spec, no false reassurance).
- Tunnel vision is REAL but INTERMITTENT (only OS1 triggered it, 2/4 reps) — the ceiling spec gives a
  false-reassurance nudge that sometimes tips a noticed risk into a merge.
- GATE 1 PROVISIONAL: floor framing recovers blocking. MUST confirm floor DISCRIMINATES (does not just
  block everything). Benign-control experiment running: floor vs ceiling block-rate on genuinely benign
  changes (rename, stream-sum, logging). If floor keeps benign-block low, it is a real fix.
