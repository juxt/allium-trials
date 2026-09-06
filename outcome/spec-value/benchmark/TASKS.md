# Benchmark tasks — slug registry

Each task has a short slug for results tables. Type ∈ {greenfield, distill, feature, update}.
The gotcha is the authentic failure mode the oracle scores; it is NOT stated in the requirements.

| slug | type | domain | gotcha (authentic failure mode) | status |
|---|---|---|---|---|
| `payment-allocation` | gate/anti-vacuity | Fineract default alloc order | a vacuous allocator (allocates nothing) is SAFE but useless; does the V4 anti-vacuity objective make the catch reliable where V3 (safety-only) misses it? Replicates p7 on real domain | running |
| `loop-guard` | gate/liveness | Fineract LoopGuard | the max-iterations termination guard is load-bearing; does each arm's generated test suite CATCH a version with the guard removed? (V4 objective = liveness test; V3 no construct) | running |
| `loan-status` | reconstruct/behavioural | Fineract loan lifecycle | isClosed quirk | **SATURATED** (prose=V3=V4=100%, all got the quirk). 6th data point: reconstruction-fidelity retired — cannot favour a declarative language |
| `allocation-reversal` | feature-add/MATRIX | Fineract alloc domain | add reverse(); reverse-order unwind | **SATURATED** (all arms 100% both models) — the order WAS inferable; models guess the natural intent |
| `charge-time` | reconstruct/MATRIX | Fineract ChargeTimeType | 21 predicates x 17 types; non-inferable allow-groupings (loan/savings/client); 357 graded; 4 arms x 2 models | queued |
| `charge-calc` | reconstruct/MATRIX | Fineract ChargeCalculationType | savings-allow rule | specs=100, no-spec ~98 (mostly inferable). Confirms pattern |
| `isin-validate` | validate/MATRIX/3rd-codebase | python-stdnum | ISIN check-digit (Luhn-over-expanded-letters) non-inferable; 21 graded; 4 arms x 2 models | queued |
| `iban-validate` | validate/MATRIX/3rd-codebase | python-stdnum | IBAN validator; mod-97 inferable but per-country length/format + national checks non-inferable; 28 graded; 4 arms x 2 models | running |
| `bech32-bugfix` | bugfix/MATRIX/crypto | bech32 | fix a corrupted polymod constant | **SATURATED** (all arms 100%) — bugfix does NOT separate: buggy code is PRESENT so no spec needed. Key: spec-as-input helps only when intent is ABSENT (reconstruct); editing visible code collapses the gap |
| `us-workday` | reconstruct/MATRIX/5th-codebase | workalendar | US business-day calendar | **SATURATED** — US holidays fully famous; both models recall all 10 with no spec (sonnet 10/10 all runs). Fully-inferable-via-fame end of the spectrum (contrast bech32 half-remembered) |
| `bech32-segwit` | port/MATRIX/4th-codebase/CRYPTO | bech32 reference | SegWit encode/decode; charset+polymod highly non-inferable; BIG-GAP anchor; 26 graded; 4 arms x 2 models | queued |
| `npf-annuity` | port/MATRIX/2nd-codebase | numpy-financial | port 5 annuity fns; non-inferable sign+when conventions vs inferable formula; 162 graded; 4 arms x 2 models | running |
| `guidance-vs-structure` | experiment | account reserve rule | is a load-bearing rule followed less reliably in @guidance prose vs structured? **NULL**: all 100% (LLM follows clean guidance fine). Real axis = VERIFIABILITY (guidance uncheckable), not code-gen |
| `trial-balance-gate` | gate/REPORTING | debits==credits | 2nd balancing identity gate; odd-amount imbalance; analyse vs test-checks | running |
| `mixed-threshold-gate` | gate/REPORTING/BOUNDARY | notional>1M implies LEI | the rule analyse CANNOT check (SAT/LRA seam); expected inversion: analyse misses, test-gen catches. Maps analyse boundary | queued |
| `report-balance-gate` | gate/REPORTING | balance sheet identity | pre-submission check: does each arm catch a report that fails assets==liabilities+equity on an odd-amount edge? V4 analyse (proof) vs generated checks. Regulatory-reporting use case | running |
| `durability-gate` | gate/DURABILITY | account invariant | fee-beyond-guard regression | **V4 WIN (measured)**: analyse 100/100 (proof, no miss no false-alarm); test-gates 66-100 (model-dependent, sonnet misses/false-alarms). V4 CHECKER > test-gen, biggest on weaker model |
| `mathutil-port` | port/MATRIX | Fineract MathUtil | reconstruct 20 numeric utils; arbitrary null semantics | **FIRST SIGNAL**: V3/V4=100 > none ~97 > prose/opus 92.9 (prose misleads). Small gap, diluted by inferable cases |
| `fineract-amortization` | reconstruct/real | Fineract TVM math | fidelity of a spec-reconstructed `rate()` solver vs real Fineract golden values (differential) | **DONE — INVERTED**: prose 100 / V3 97 / V4 86. Numerical algorithm = wrong code for a declarative language; reconstruction-fidelity favours transcription. Boundary case: where Allium does NOT help |
| `legacy-terminate` | legacy/objective | worklist drain | termination via max_ops budget | **SATURATED** (all arms 100%) — max_ops was a required signature parameter, too legible; every arm kept and used it |
| `acct-fee` | feature | account / money | overdraft on an unguarded fee | **SATURATED** (all arms 100%; gotcha too obvious, base code telegraphs the guard) — harden or replace |

Planned (design in DESIGN.md): a second of each type across domains — greenfield (sorted-segment store,
metric store), distillation, and a second feature/update — chosen for a credible task + authentic gotcha.

## Task types (updated)

The strongest domain is **legacy modernisation**: refactor legacy code carrying a load-bearing but
surprising behaviour; the oracle tests it survives. Split by quirk kind:
- **safety quirk** (a boundary, rounding, null-handling depended upon) → demonstrates **prose < V3** (the
  spec captures what prose omits; V3 ≈ V4).
- **objective quirk** (a termination / drain / bounded-retry guarantee) → demonstrates **V3 < V4** (only V4
  can express AND verify the objective; V3 has no construct for it).

Planned next: `legacy-terminate` (objective quirk — a modernisation that breaks a loop's termination
guarantee; V4's objective discharge catches it, V3 cannot express it).
