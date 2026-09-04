# Benchmark conclusion — the honest picture (retire reconstruction-fidelity)

Six real data points. The verdict is clear and I am stating it straight.

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
