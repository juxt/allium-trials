# Benchmark conclusion — the honest picture

> UPDATE (elicitation + competitor phase). The reconstruction and matrix work below answered
> "does a finished spec produce better code" — and among spec *forms* it largely ties, because that
> question assumes the hard part (knowing what to build) is done. The next phase moved upstream to
> where the spec comes from, and compared Allium against the tools people actually use. This is where
> the honest wins and the honest nulls both live.
>
> **1. The flagship win — elicitation, end to end.** A deliberately vague loan-allocation brief hides
> 14 material, non-inferable policy decisions; a proxy stakeholder answers only what is asked. Five
> authoring processes interview it by their own real rules, produce a spec, and a fixed step turns each
> spec into code scored by a behavioural oracle. Pooled over clean cells:
>
> | process | Opus code | Sonnet code |
> |---|---|---|
> | Allium elicit | 80.5 (n=7) | 70.9 (n=5) |
> | plain prose (diligent engineer) | 77.8 (n=9) | 58.0 (n=8) |
> | AIUP | 63.6 (n=11) | — |
> | spec-kit | 56.6 (n=9) | 43.5 (n=14) |
> | superpowers | 42.9 (n=7) | — |
>
> Three claims, each defensible: (a) elicit **ties a diligent engineer who asks freely** on the strong
> model — structured discipline does not beat a capable model with a cooperative stakeholder; (b) both
> **beat every packaged spec-driven tool** by 14+ points, because each tool under-asks (spec-kit caps at
> 5 questions + guesses from "industry standards"; AIUP derives from a vision; superpowers stops ~12
> questions in even when given 20 rounds); (c) elicit **degrades more gracefully as the author weakens**
> — the elicit-vs-prose gap widens ~5x from Opus (+2.7) to Sonnet (+12.9). The mid-tier user gains most.
> Competitors were run on their real process definitions, not paraphrases. This measures the elicitation
> *discipline* (structured asking), NOT the checker.
>
> **2. The honest null — one-shot contradiction catching.** Hypothesis: the checker's determinism lets
> Allium catch a self-contradictory spec that prose ships. Tested twice (a simple 3-rule arithmetic
> contradiction, then one buried among 10 plausible rules), Opus and Sonnet. Result: **null both times —
> every arm caught it ~5/5.** A capable model does the arithmetic in prose too. `analyse` fired correctly
> every run; prose reasoning also succeeded, so there is no catch-rate gap. Two nulls; stopped chasing.
> The checker's real, already-measured value is the *regression gate* (durability-gate / report-balance-
> gate: `analyse` deterministic 100% vs generated tests stochastic 66-100%), a re-check-after-a-change
> axis, not one-shot catching.
>
> **3. Two real negatives the contradiction work exposed, now fixed.** (a) v4 was **not in the released
> binary** — homebrew 3.5.3 rejects v4; only the debug build parses it, and its `--version` mis-advertised
> "1, 2, 3". Fixed the version string (release build analyses v4, tests green); publishing 3.6.0 to
> homebrew remains a release-process step. (b) The elicit skill **fabricated an `analyse` verdict** when
> the CLI errored — invented a CONTRADICTORY result that never ran. Fixed: elicit + distill now must
> confirm the tool actually ran and never narrate a verdict they did not receive.
>
> **4. A refined guidance finding.** A controlled tight-vs-verbose distillation test was confounded (the
> tight spec dropped the ISIN check-digit algorithm; its best port hit the 9/21 structure-only floor while
> the step-carrying verbose spec reached 20/21). The lesson: "keep it tight" is dangerous on *algorithmic*
> behaviour — a recipe has no redundancy to cut, so tightening drops the behaviour. Skill guidance updated.
>
> **Net.** Allium's demonstrated value is the elicitation discipline (upstream, strongest for mid-tier
> authors, beats the named tools) and the deterministic verification/regression gate (design + maintenance
> time). It is NOT first-draft code quality (ties prose) and NOT one-shot contradiction catching (a capable
> model matches it). Metric philosophy in `METRICS.md`; discrimination discipline in `DISCRIMINATION.md`;
> per-task detail under `tasks/`.

> UPDATE (matrix phase, 4 arms x 2 models). The picture below (written after 9 single-model data points)
> stands for its claims, but the MATRIX added a genuine positive that changes the headline. On real code
> with NON-INFERABLE conventions (mathutil-port HARD, 287 cases), a **structured spec (V3/V4) reliably
> yields 100% correct code on both Opus and Sonnet, while no-spec drops to 88% (Sonnet) / 95% (Opus) and
> prose is erratic (86-100%, can mislead)**. So among spec forms, code production is NOT flat where the
> behaviour is non-inferable: structured > prose (reliability) > no-spec (correctness margin), and the
> margin is LARGER for the weaker model. V3 ≈ V4 throughout (both structured). The rest of this document
> (single-model, mostly inferable tasks) explains why earlier tasks tied: they were inferable or
> transcription-favouring. The matrix isolates where the spec actually moves code quality.

Nine single-model data points, then the matrix. The verdict, stated straight.

## What does NOT hold

**First-draft / reconstruction code quality is flat across prose / V3 / V4 for a strong model.**
- 3 single-shot feature/impl tasks saturated (cache-impl, acct-fee, legacy-terminate): prose = V3 = V4 = 100%.
- 1 numerical algorithm (fineract-amortization) INVERTED: prose 100 > V3 97 > V4 86 — monotonic in
  abstraction, because a declarative language abstracts away the algorithm that IS the golden behaviour.
- 1 behavioural state machine (loan-status) SATURATED: prose = V3 = V4 = 100%, all captured the non-obvious
  `isClosed` quirk.

Reconstruction-fidelity structurally rewards TRANSCRIPTION COMPLETENESS, which prose (able to approach
verbatim code) maximises. A declarative spec abstracts on purpose, so it can only tie or lose. **The
reconstruction instrument cannot demonstrate a declarative language's value. It is retired for that claim.**

Also honest: p6's "spec beats no-spec" (20% → 100%) is NO-SPEC vs SPEC — the value of writing the
obligation down in ANY form. It is not prose-spec vs Allium-spec. Among spec *forms*, code production ties.

## What DOES hold

The value of a spec is real, but it is not first-draft code. It is:
1. **Writing the obligation down at all** (no-spec → spec; p6). Any representation; this is elicitation of
   the non-obvious obligation. Prose carries it as well as Allium *for a strong model producing code*.
2. **A checkable / provable / durable artefact — where Allium beats prose and V3.** The one clean win is p7:
   from a V4 objective, `allium plan` generates an anti-vacuity test that catches a vacuous implementation
   100% of the time; V3 (no objective construct) ~0%. That is a GATE, not code. Assurance ("proved over all
   cases, not five examples") and durability ("the standing gate catches drift when intent is lost across
   edits") are the same axis.

This is exactly, and only, what the sales positioning claims: *"on textbook logic a good model is already
accurate — a spec won't move that. The value is verifiability, clarity and provenance."* The evals VALIDATE
the honest positioning and REFUTE the overclaim that Allium makes first-draft code more correct.

## The one instrument worth building next

**Durability / gate on real code.** Take a real Fineract module + its spec; introduce a realistic
regression (or a sequence of edits by fresh agents that lose the original intent); measure whether each
arm's standing GATE catches it — V4 (`analyse`/`weed`/generated objective tests) vs V3 (safety tests only)
vs prose (nothing). This measures Allium's actual value (assurance/durability), is code-level and
real-code, and does not reward transcription. It is the honest home for the V3<V4 and V4<prose claims.

Everything else (single-shot pass-rate, reconstruction-fidelity) should not be published as a
spec-value result — it measures a thing where specs, honestly, do not move the needle for a strong model.
