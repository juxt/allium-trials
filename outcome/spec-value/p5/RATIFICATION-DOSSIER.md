# Ratification dossier — new v4 constructs, with corpus motivation + executable value evidence
For the language authority's end-of-session review. Each construct: what it unlocks (corpus), the
executable evidence it adds measurable value, and the recommendation. All shipped with tests
(56 allium-v4 tests pass); none broke the real demo specs (K55, LoanSchedule, double-entry).

## 1. DIVISION `/`  [CORE primitive — ratify]
- Corpus: every financial rate/ratio invariant — `interest = rate/1200 * balance`, pro-rata, day-count.
- Was ENTIRELY ABSENT: the lexer skipped `/`, so `x/1200` silently parsed to `x`. This is why P3
  found the gate value-blind (0/20 real-code arithmetic mutants).
- Evidence: with division, `interest = rate_factor * outstanding` catches value drift on 144 real
  Fineract traces: relational-only 0/144 -> +absolute 144/144. Not user-definable (needs a primitive).
- Recommend: RATIFY as core. Syntax `/` (mul precedence). Constant divisor -> linear (LRA); variable -> nonlinear.

## 2. if / then / else  [CORE primitive — ratify]
- Corpus: tiered rates, grace-period conditionals, banded fees. `rate = if bal > 10000 then 5 else 10`.
- Evidence: tiered-rate invariant holds when correct, catches the violation. Also the ENABLER of the
  whole function stdlib (min/max/abs/clamp are defined WITH it). Not user-definable (control primitive).
- Recommend: RATIFY as core. It is load-bearing for extensibility.

## 3. round(x, n)  [CORE primitive (the one rounding primitive) — ratify, with a substrate caveat]
- Corpus: money is always rounded; a spec must assert exact interest/fee values.
- Evidence: `interest = round(bal*rate, 2)` monitors; catches wrong rounding. Not user-definable (no
  fractional-part extraction without a primitive; no recursion).
- Caveat: the monitor evaluates in f64, so exact decimal TIE-breaking (8.325) can differ from BigDecimal.
  Fix = exact-decimal substrate (see CORE-VS-EXTENSIBILITY layer 2, in progress).
- Recommend: RATIFY as core (it is the irreducible rounding primitive). Syntax could be `round`/`floor`.

## 4. min / max  [DEMOTE to stdlib — data says NOT core]
- Corpus: caps and floors — `fee = min(computed, cap)`, `payment = max(due, minimum)`.
- Evidence: they WORK (cap breach caught) — BUT they are USER-DEFINABLE: `given min(a,b) means if a<b
  then a else b`, imported via `use "std.allium"`, monitors identically. Shipped as built-ins this
  session, but the data says the core needn't carry them.
- Recommend: DEMOTE to the std.allium stdlib (already written). Keep as built-in only if convenience is
  judged worth the core surface. This is the small-core argument, evidenced.

## 5. temporal ordering (before / precedes / after)  [CORE — ratify]
- Corpus: payment sequencing, no-replay, settlement order — `capture implies some auth before it`.
- Evidence: payment-ordering gate catches 12/12 ordering mutants, 0 false positives; a bug class no
  arithmetic/relational invariant can catch. Immediate-past `old` already worked; this adds multi-step.
- Recommend: RATIFY as core (a distinct paradigm, banking-critical).

## 6. reference definitions `given f(args) means e` + 0-ary constants  [CORE — the extensibility mechanism]
- Corpus: any absolute/input-anchored law; and it IS the user-function mechanism.
- Evidence: absolute invariants (the value-drift catch) rest on it; and the entire stdlib (min/max/...) is
  built from it. Cross-module `use "path"` now loads these from a shared file.
- Recommend: RATIFY as core — it is what makes the language extensible without growing the core.

## Summary recommendation
RATIFY as CORE: `/`, if/then/else, round(/floor), temporal ordering, given-means (+ use-import).
DEMOTE to STDLIB: min, max (and abs/clamp/sign — already in std.allium).
ONE core substrate task remaining: exact-decimal evaluation (penny-exact rounding).
