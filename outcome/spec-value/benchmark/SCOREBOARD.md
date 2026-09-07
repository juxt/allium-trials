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
| isin-validate (stdnum, 2nd module) | 73 | 68.3 | 100 | 100 | 95.2 | 97.6 | 98.4 | 58.7* | ~30pt gap: ISIN check-digit non-inferable. prose most reliable here. *v4/sonnet fragile (complex spec, 2/3 broke). |
| iban-validate (3rd codebase, N=3 partial) | 96.4 | 96.4 | 98.2 | 100 | 96.4 | 64.3* | 98.8 | fail** | small gap: mod-97 inferable (~96 all); only the BE national-check case separates, specs catch it sometimes. *broken run **v4/sonnet prompt-too-long |
| us-workday (5th codebase) | 66.7* | 100 | 100 | 100 | 100 | 100 | 100 | 100 | SATURATED (holiday hard-subset): US holidays fully famous, both models recall all no-spec. *1 broken opus run. Fully-inferable-via-fame end. |
| bech32-segwit (4th codebase, CRYPTO) | 82.1 | 82.1 | 100 | 100 | 100 | 100 | 100 | 100 | 18-pt gap: no-spec BIMODAL (famous algo half-memorised); ANY spec=reliable 100. Spec makes flaky memory reliable. |
| trial-balance-gate (REPORTING, 2nd identity) | v4 CATCHES (verified; workflow v4=0 was a clone-bug artifact) · test-gen: none 67/50 prose 100/33 v3 83/67 | | | | | | | | widens balancing to debits==credits: analyse deterministic; test-checks false-alarm on sonnet |
| fineract-journal-gate (REAL Fineract GL) | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | SATURATED — canonical debits==credits + test recipe handed over; everyone catches. Real-rule provenance yes; analyse-advantage no |
| contra-sign-gate (REPORTING, non-obvious rule) | none 100/50 · prose 100/100 · v3 100/100 · v4 100/100 | | | | | | | | discriminates on SONNET (no-spec 50->spec 100, cant infer contra); Opus knows contra (saturates). Elicitation value, weaker-model |
| report-balance-gate (REPORTING) | v4 100/100 · none 100/67 · prose 67/50 · v3 100/0 | | | | | | | | analyse=only reliable pre-submission check; test-checks FALSE-ALARM (block valid reports) on sonnet. Accounting-balancing slice |
| p7 (cache) | gate | cache anti-vacuity (SYNTHETIC) | catches vacuous impl | — | ~0 | 100 | V4>V3 — but ONLY because V3's spec was pure safety (no positive obligation). |
| `payment-allocation` | gate | Fineract alloc order (REAL) | catches vacuous impl | 100 | **100** | 100 | p7 does NOT replicate: V3's order obligation already forces the anti-vacuity test. V4 adds nothing. |
| p6 (bespoke stores) | greenfield | sorted/metric store | obligation coverage | 20 (no-spec) | → 100 (spec) | 100 | writing the obligation down (any form) is the win; elicitation. |


## Matrix results (4 arms x 2 models) — code quality %

| settlement-mixed (MODERATE) | 45.3 | 41.8 | 100 | 100 | 98.9 | 96.1 | 100 | 97.4 | spectrum middle: ~55pt gap, no-spec mid-range. v3=v4=prose. |
| **settlement-format (HARD, bespoke encoder)** | **24.6** | **16.7** | 100 | 100 | 99.2 | 99.2 | 99.2 | 99.2 | CLUSTER BROKEN: ~75pt no-spec-vs-spec gap. Many non-inferable conventions. v3=v4=prose (no format penalty). |

| task | none/opus | none/son | prose/opus | prose/son | v3/opus | v3/son | v4/opus | v4/son | reads as |
|---|---|---|---|---|---|---|---|---|---|
| mathutil-port (full 980) | 98.5 | 96.5 | 92.9 | 100 | 100 | 100 | 100 | 100 | V3/V4=100 reliably; no-spec ~97; prose misleads opus. |
| mathutil-port (HARD 287) | 94.8 | 88.2 | 86.1 | 100 | 100 | 100 | 100 | 100 | **STRONGEST POSITIVE**: structured=100 both; no-spec 88-95 (weaker model worse); prose erratic 86-100. |
| loan-status-matrix | 98.8 | 98.0 | 100 | 100 | 100 | 100 | 100 | 100 | all specs=100; no-spec ~98 (isClosed quirk). Small gap = mostly-inferable. |
| charge-calc | 98.8 | 98.1 | 100 | 100 | 100 | 100 | 100 | 100 | all specs=100; no-spec ~98. |
| charge-time (357 golden) | 99.5 | 98.2 | 100 | 100 | 100 | 100 | 100 | 100 | 3rd enum confirm: specs=100; no-spec ~98-99 (misses allow-groupings); sonnet worse. |
| allocation-reversal | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | saturated — reverse-order was inferable. |

## The honest one-line summary per finding

- **On real code, first-draft/reconstruction quality is FLAT** across the three for a strong model — a
  capable model given the obligation in any form writes correct code. (loan-status tie; amortization even
  inverts, because prose can transcribe an algorithm a declarative spec abstracts away.)
- **The spec's value is not the code, it is the checkable artefact:** writing the obligation down at all
  (p6, no-spec → spec). But among spec FORMS, code-level outcomes tie.
- **No code-level V4>V3 survives on real code.** p7 (V4>V3 on anti-vacuity) was an artifact of a synthetic
  spec with no positive obligation; on real Fineract logic (payment-allocation) V3's positive obligations
  already force the anti-vacuity test, so V4's objective adds nothing. Precision thread also dead (N=10).
- **What is left for V4 is a CAPABILITY, not a rate:** design-time proof over ALL cases (not tested
  examples), and provenance / a durable checkable artefact. Yes/no per tool, not a code-quality percentage.
  A code-level differential benchmark is the wrong instrument to measure it.

## npf multi-distillation (settles v3-vs-v4)

3 independent distillations/arm (sonnet). Reliability: **v3 5/6, v4 6/6** — the single-distillation v4>v3
gap was ARTIFACT; v3≈v4 confirmed once distillation variance is controlled.

This scoreboard is deliberately unflattering where the truth is unflattering. Nine data points in, there is NO demonstrated code-level V4>V3 on real code. The one apparent win (p7)
was an artifact of a synthetic spec with no positive obligation; on real Fineract logic (payment-allocation)
V3's positive obligations already force the anti-vacuity test, so V4's objective adds nothing. First-draft
code, reconstruction, and gate catch-rate are all FLAT across prose/V3/V4 for a strong model. Allium's value
is NOT a code-quality delta — it is a CAPABILITY (design-time proof over all cases; provenance; a durable
checkable artefact), which this code-level benchmark is the wrong instrument to measure.
