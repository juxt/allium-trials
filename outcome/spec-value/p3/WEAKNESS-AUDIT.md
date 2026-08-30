# Programme 3 — weakness audit + big-n mechanical strengthening (90 min, END 1788115211)

## Honest critique of Programmes 1-2 (what could be chance / fallacy / irrelevant)

1. **Small n everywhere.** Almost every headline is n=1-4: B2 cost win rests on ONE hard task (T2);
   Phase 2 completeness is ONE distilled spec on ONE battery; Phase 4 is 3 reps of ONE flaw. These
   could be noise.
2. **Model-judge unreliability recurred** (B5 3/6 false-neg; Phase 1 caught_oos contradictory; Phase 4
   needed spot-reading). ANY result resting on a model judge is suspect. => Programme 3 uses MECHANICAL
   metrics only: monitor holds/fails (deterministic), JUnit pass/fail, exit codes. No model judge.
3. **"Completeness 63% vs 88%" is battery-dependent** — I chose the mutation kinds, so the number is an
   artefact of the battery, not an absolute completeness. Fix: report the DETECTION PROFILE over a
   large, systematic mutation set, and be explicit it is relative to that operator set.
4. **Within-context, small subsystem.** Phases 2-4 used the loan-schedule calculator + traces, which fit
   in a context window. The user's point stands: within-context results may not demonstrate the value.
   The genuinely beyond-context asset is the code — the spec is a ~30-line summary of code embedded in a
   ~985k-LOC repo. Programme 3 pushes to REAL-CODE mutation of that code.
5. **Phase 3 M1 (spec misses wrong-rate; shipped test catches) is n=1.** The complementarity claim needs
   a DISTRIBUTION: across many real-code mutants, how often does the spec-gate catch vs miss vs add
   coverage over the shipped tests? That is the honest, quantified version.
6. **prose ~ elicit** (Prog-1): surfacing is not Allium-specific. Not re-litigated here; flagged.

## Programme 3 plan (mechanical, bigger n, real code)
- **E1 Big-N faithfulness at scale:** generate a large trace corpus from the REAL calculator (one
  gradle run), monitor the gold spec over N>=hundreds. Mechanical. Confirms/【refutes】 the spec is a
  faithful contract at scale.
- **E2 Real-code mutation cross-tab (headline):** auto-generate many compiling mutants of the real
  calculator; per mutant run the gold-spec GATE (monitor over regenerated traces) AND the shipped JUnit
  suite. Cross-tabulate catches. Mechanical, no model judge. Answers: does the spec-gate ADD regression
  coverage over existing tests, DUPLICATE them, or MISS what they catch — with real n.
- **E3 (if time) Big-N trace-level mutation** with confidence intervals as a statistical complement.
- Honesty: report effect sizes with counts; call chance where n is small; keep only what survives.

## E3 results (big-n, mechanical, non-gradle) — STRUCTURAL detection is SOLID; value-only operator flawed
- STRUCTURAL breaks: **600/600 = 100% detected (95% CI 99-100%)** across 150 real traces x 6 operators.
  CONFIDENT: the spec-gate catches local structural regressions (broken roll-forward, monotonicity,
  conservation, principal-split, close, emi) deterministically at big n.
- VALUE-ONLY (uniform rescale): 68% — CONFOUNDED and discarded. Rounding each scaled field to 2dp makes
  sum(rounded) != rounded(sum), so the "value-only" scale accidentally violates conservation (partly
  structural). Not a clean measure. HONEST: do not use this number.
- CLEAN value-only blindness is established elsewhere, mechanically: (a) faithfulness = the spec holds
  on ALL 150 real schedules, so it cannot distinguish a correct schedule from a different wrong-but-
  internally-consistent one; (b) E2 real-code mutants that re-derive a consistent schedule (mul2sub_1:
  changed, shipped-test FAIL, spec HOLD). => the gate is blind to value errors that preserve structure.
