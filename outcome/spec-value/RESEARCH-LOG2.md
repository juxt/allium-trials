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

## Iteration 5 — GATE 1 SETTLED: tunnel vision is FIXABLE by framing; skill change made
- Benign discrimination control (floor vs ceiling on rename/stream-sum/logging, 3 reps):
  ceiling benign-BLOCK 0/9; **floor benign-BLOCK 1/9 (11%)** — floor merges benign ~89%, essentially
  like ceiling. So floor DISCRIMINATES; it is not blanket timidity.
- Combined with iteration 4 (floor recovers OS1 blocking 4/4 vs ceiling 2/4 merge):
  **GATE 1 = FIXABLE. Presenting a spec as a PARTIAL FLOOR ("not-violating != safe; flag any other
  risk") recovers out-of-scope-bug blocking without over-blocking safe changes.** The rank-4
  overconfidence hazard is a fixable PRESENTATION problem, not intrinsic.
- SKILL CHANGE (skills-v4/distill/SKILL.md), evidence-backed by Programme 2:
  1. New loop step "Validate against runtime, not just by reading": monitor invariants on real traces
     (FAITHFULNESS — catches over-claims like level_payment, Phase 2a) + mutation battery (COMPLETENESS
     — records detection rate + blind spots, Phase 2b).
  2. New section "The spec is a partial floor, not a ceiling": emit a verbatim PARTIAL-FLOOR header
     listing blind spots (the tunnel-vision fix, Phase 1 verified).
  3. Done-criteria updated: faithfulness validated, completeness probed, floor header present.
- Re-verifying now: does the partial-floor HEADER alone (under a plain consumer prompt) flip the
  decision (block OS1 bug, merge benign)? If yes, the fix is self-contained in the artefact.

## Iteration 6 — RE-VERIFY caught a refinement: the floor fix must be in the CONSUMER, not just a header
- Tested whether the partial-floor HEADER in the spec (what distill now emits) flips a plain reviewer's
  decision on its own. Result: with_header and no_header BOTH merged the OS1 bug 4/4 — **the header
  alone did NOT flip the decision.** (This OS1 variant was also weaker — stripped diff + an "order
  unchanged" comment — so both merged; the clean signal is header==no-header.)
- => The floor framing works as a CONSUMER INSTRUCTION (Phase 1 floor-prompt blocked OS1 4/4), not as a
  passive spec comment a plain reviewer underweights. The fix belongs in HOW A SPEC IS CONSUMED (the
  reviewing/guiding agent's instructions), with the header as a supporting marker. Confirming now that
  the floor CONSUMER instruction still bites on this same stripped case (vs ceiling).
- Skill implication: keep the distill partial-floor HEADER, but ALSO add the floor-consumption
  principle to the skill(s) that USE a spec to review/guide code. Pending consumer-verify.

## Iteration 7 — consumption principle added to language reference; Phase 4 launched
- v4 has NO spec-consumption skill (skills-v4/allium has only a language reference). So the
  floor-framing fix (which must live in the CONSUMER's prompt, per iter 6) was added as a
  "Consuming a spec: it is a partial floor, not a ceiling" section in language-reference-v4.md:
  the consuming agent's prompt must carry the floor instruction; a passive header is insufficient
  (verified); carry the measured blind spots into the instruction. Committed to allium repo.
- Consumer-verify on the stripped OS1 case hung (ceiling 0/4 block; floor never returned) — killed it;
  Phase 1's fuller-case evidence (floor 4/4 block vs ceiling 2/4; benign 11%) is the load-bearing basis.
- Phase 4 (explain-back / how to build confidence) launched: SPEC_LLM has two REAL flaws (level_payment
  over-claim F1; roll-forward/monotonicity blind spot F2). Reviewer given {raw spec | +prose | +the
  mechanical VALIDATION REPORT}. Tests whether the validation report (monitor+mutation) helps a reviewer
  catch the flaws better than eyeballing — i.e. whether the confidence-builder is the validation, not
  the explanation.
