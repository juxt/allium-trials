# Living ranking — which spec benefit is largest? (updated each iteration)

Status: OPEN. Evidence accumulating. No synthesis until B1..B5 each have a verified result.

| Benefit | Verdict so far | Effect size | Confidence | Notes |
|---|---|---|---|---|
| B1 intent / bug-prevention | REFUTED as catch-benefit; surfaced a HAZARD (tunnel vision) | ~0 on catch; NEGATIVE (a real out-of-scope miss) | med-high | model blocks all intent-flips unaided (saturates); spec made it dismiss a real negative-payment bug as "out of scope". Spec's only plus: better GROUNDS for a block (auditable) |
| B2 navigation / amortisation | POSITIVE but SCOPED: ~30% cheaper, concentrated on hard-to-locate targets | ~30% cost on retrieval-hard tasks; ~0 on easy; correctness neutral | med | clean run (no delegation): spec $4.79 vs nospec $6.86, driven almost entirely by T2 charge-off ($0.88 vs $3.15). n=1 hard task |
| B3 deterministic gap detection | SATURATES on catch+reliability; value = certifiable guarantee | ~0 on catch/variance; qualitative on audit | med | model 4/4 defects, 0 flips over 6 reps on tractable specs; analyse's edge is a NAMED verdict + exit code + proof-of-determinism, not a higher/steadier rate |
| B4 brownfield surfacing | LARGEST unique effect: nospec silently commits ~4/10 policy decisions | ~3-4 decisions/10 (nospec guessed 4.3 vs spec ~1) | med | but it's the ACT OF SPECIFYING, not Allium: prose (8.0) ~ elicit (7.7) >> nospec (4.7). n=1 task |
| B5 drift / regression gate | catch SATURATES (model 6/6 unaided, non-leading); value = guarantee + automatic | ~0 on catch; qualitative (determinism/automation) | med-high | monitor deterministic (residual 50, 0 variance); BONUS: my model-JUDGE gave 3/6 false negatives = live proof model-checkers are unreliable |

## Prior context feeding the ranking (from the earlier loop)
- Accuracy of single-shot catch/regeneration/verification SATURATES even at 985k LOC — the model
  navigates 1M lines and nails a cross-module invariant + the subtle guard-gap cold, in 16 turns,
  $0.82. So B-benefits that rest on the model being LESS capable are unlikely to be the winner.
- The elicit SURFACING disposition is the one axis that beat prose and no-spec, judge-robustly, in
  greenfield. That makes B4 (and the intent-encoding half of B1) the prior favourites.
- Determinism/auditability (B3, B5) is real but is a QUALITY of the verdict, not a higher rate — its
  significance depends on whether the user values reproducibility over raw catch (regulated setting: yes).

---

## SYNTHESIS (2026-08-30) — what value does a spec add to an existing codebase, ranked

Five discriminating experiments on the full Apache Fineract (~985k LOC, genuinely beyond-context),
each built to isolate something an LLM does not already have. Every result was verified by reading the
actual arm outputs, not the judge numbers; two false headlines and one judge false-negative were
caught and corrected in the process.

### The one finding that organises all the others
**A specification acts in two distinct phases, with opposite effects.**
- The **process** of writing a spec forces enumeration of the decisions the code cannot answer, so it
  SURFACES the human's undecided policy instead of silently guessing it. (Benefit.)
- The finished spec **artefact** concentrates the agent's attention on what it covers: a large cost
  saving when the target is in-scope and hard to locate, but a blinker that causes misses on real
  issues OUTSIDE its scope. (Benefit and hazard, same mechanism.)

Separately, and cutting across everything: **accuracy saturates.** A frontier model, unaided, matched
or beat the spec on catching conflicts, preserving invariants, localising cross-module code over a
million lines, and spotting a seeded double-entry break in a feature-framed review it was not told to
check (6/6). The spec does not make the model catch more bugs. Its value is never catch-rate.

### Ranking (largest benefit first)

1. **Surfacing the human's decisions (B4) — the largest and most unique benefit.**
   On an underspecified brownfield change, the "just implement" arm silently committed ~4 of 10 policy
   decisions the code does not determine — including the money/regulatory-critical retroactivity choice
   — while a spec process surfaced ~8 and guessed ~1. Verified on the same decision: unaided the model
   picked a plausible default; with the spec process it flagged it as the human's to make. This is the
   one place the model provably lacks something (the human's intent) and fills the gap wrongly when
   left alone. Effect: ~3-4 silently-fabricated decisions per feature, avoided.
   CAVEAT: it is the ACT OF SPECIFYING, not the Allium notation — prose matched elicit (8.0 vs 7.7).
   This argues for spec-first discipline generally; the Allium-specific edge is narrower (see 3).

2. **Navigation cost on hard-to-locate targets (B2) — real but scoped.**
   Clean run (no delegation): the spec arm cost ~30% less ($4.79 vs $6.86) across 5 cold tasks, the
   saving concentrated almost entirely on the ONE task where blind search thrashed (charge-off hazard:
   $0.88 vs $3.15). On easy, lexically-findable targets the spec added nothing. A spec pays for itself
   as a map only where retrieval is genuinely expensive. Correctness was neutral (within judge noise).

3. **Deterministic, certifiable checking (B3 + B5) — the only uniquely-Allium value; a guarantee, not a rate.**
   analyse/monitor caught every seeded defect with a NAMED verdict, exact residual, exit code, and zero
   variance. But the model matched the catch-rate and (B3) was perfectly stable too — so the value is
   not "catches more" or even "more reliable in practice". It is a GUARANTEE: the checker cannot flip,
   by construction, and fires automatically on every change regardless of where attention is. The
   affirmative case arrived by accident: my own model-based JUDGE returned 3/6 FALSE NEGATIVES on B5 —
   a model asked to verify was unreliable while the reviewers were perfect. That is precisely why a
   deterministic gate has worth in a regulated setting: you can certify it; you cannot certify a model.

4. **Bug prevention via encoded intent (B1) — REFUTED, and a net hazard.**
   The premise (a spec catches plausible-but-wrong changes the model would wave through) failed: the
   model blocked all three intent-violating refactors unaided. Worse, the finished spec caused TUNNEL
   VISION — it merged a change that silently dropped negative payments, dismissing the real out-of-scope
   bug as "not the spec's concern", which the unaided reviewer caught. An over-trusted spec narrows
   attention and can REDUCE correctness on anything it does not cover.

### What stays uncertain (do not over-read)
- Small n: B2's cost win rests on one hard task; B4 is one change over 3 reps; B1's hazard is one case.
- Process vs notation unresolved: prose matched elicit on surfacing, so B4 does not show Allium beats a
  plain prose spec. The uniquely-Allium value (mechanical checking) is real but sits at rank 3.
- Over-time drift is only single-edit here. The "standing gate across many edits / handoffs" claim —
  where determinism + automation should compound — is argued but not yet measured over a real sequence.
- Correctness never improved in any experiment; if it does anywhere, it will be via surfacing (a
  decision made right up front) or via the gate catching a regression a tiring human misses over time.

### Recommendation for the human
Position and invest along the two real axes, not the saturated one:
- Sell the spec PROCESS as a decision-surfacing front-end (rank 1) and the ARTEFACT as a deterministic,
  certifiable CI/audit gate (rank 3) — NOT as a bug-catcher that makes the model smarter (it does not).
- Treat tunnel vision (rank 4) as a first-class risk: a spec must be paired with review that is NOT
  bounded by it, or it will license misses on everything it omits. Completeness of the spec matters
  more than its cleverness.
- Highest-value unbuilt experiment: the over-time regression gate across a real edit sequence with
  handoffs (rank 3's compounding case), and a build-to-oracle test to see if surfacing up front yields
  a measurably more correct artefact downstream.
