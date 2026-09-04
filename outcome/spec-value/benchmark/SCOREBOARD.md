# Scoreboard — ProSpec vs V3 vs V4 on real code

Live results across the suite. Each row is a named task (`tasks/<slug>/`, re-run with
`Workflow({scriptPath: "tasks/<slug>/eval.wf.js"})`). Metric differs by task type; the column that
discriminates is named per row. Read `CONCLUSION.md` for what it all means.

| task | type | source | metric | ProSpec | V3 | V4 | reads as |
|---|---|---|---|---|---|---|---|
| `fineract-amortization` | reconstruct | Fineract TvmFunctions (RATE solver) | fidelity vs real golden | **100** | 97 | 86 | prose > V3 > V4 — a numerical algorithm; declarative abstraction discards it. Boundary case. |
| `loan-status` | reconstruct | Fineract LoanStatus state machine | fidelity vs 168 golden | 100 | 100 | 100 | tie — simple enum behaviour transcribes losslessly into any form. |
| `loop-guard` | gate | Fineract LoopGuard (termination guard) | catches guard-removed regression | 100 | 100 | 100 | tie on catch (guard too obvious); precision differs → next row |
| `loop-guard` | gate | Fineract LoopGuard | passes correct (precision), N=10 | **80** | 50 | 40 | INVERTED at N=10 — prose MOST precise; structured specs over-specify → more false alarms. Precision thread dead. |
| p7 (cache) | gate | cache anti-vacuity (SYNTHETIC) | catches vacuous impl | — | ~0 | 100 | V4>V3 — but ONLY because V3's spec was pure safety (no positive obligation). |
| `payment-allocation` | gate | Fineract alloc order (REAL) | catches vacuous impl | 100 | **100** | 100 | p7 does NOT replicate: V3's order obligation already forces the anti-vacuity test. V4 adds nothing. |
| p6 (bespoke stores) | greenfield | sorted/metric store | obligation coverage | 20 (no-spec) | → 100 (spec) | 100 | writing the obligation down (any form) is the win; elicitation. |

## The honest one-line summary per finding

- **On real code, first-draft/reconstruction quality is FLAT** across the three for a strong model — a
  capable model given the obligation in any form writes correct code. (loan-status tie; amortization even
  inverts, because prose can transcribe an algorithm a declarative spec abstracts away.)
- **The spec's value is not the code, it is the checkable artefact:** writing the obligation down at all
  (p6), and the GATE — a check that catches a regression. V4 beats V3 on the gate ONLY for a true
  anti-vacuity property (p7); for a concrete-safety property (loop-guard's throw) V3 = V4.
- **Precision thread DEAD (N=10):** structured specs do NOT generate more precise gates — prose is most
  precise; V3/V4 over-specify and false-alarm more. The only clean real V4>V3 remains p7 (anti-vacuity).

This scoreboard is deliberately unflattering where the truth is unflattering. Nine data points in, there is NO demonstrated code-level V4>V3 on real code. The one apparent win (p7)
was an artifact of a synthetic spec with no positive obligation; on real Fineract logic (payment-allocation)
V3's positive obligations already force the anti-vacuity test, so V4's objective adds nothing. First-draft
code, reconstruction, and gate catch-rate are all FLAT across prose/V3/V4 for a strong model. Allium's value
is NOT a code-quality delta — it is a CAPABILITY (design-time proof over all cases; provenance; a durable
checkable artefact), which this code-level benchmark is the wrong instrument to measure.
