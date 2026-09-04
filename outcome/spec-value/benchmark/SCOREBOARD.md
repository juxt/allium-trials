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
| p7 (cache) | gate | cache anti-vacuity | catches vacuous impl | — | ~0 | **100** | V4-only: the objective generates a test V3 has no construct for. The clean V4>V3. |
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

This scoreboard is deliberately unflattering where the truth is unflattering. Eight data points in, the
ONE clean place V4 genuinely beats V3 is the anti-vacuity gate (p7) — the objective generates a check V3
has no construct to express. Everything else on real code ties, or (numerical algorithm, gate precision)
mildly favours prose. The credibility of the p7 win comes precisely from the rest of the board being honest
about where there is no advantage.
