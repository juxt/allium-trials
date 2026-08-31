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

## ADDENDUM (Programme 5) — extensibility, fluency, liveness

### 7. `use "<path>"` import + `given f means e` as the FUNCTION-EXTENSIBILITY mechanism  [CORE — ratify]
- A shared stdlib of user-space functions, imported and resolved at BOTH check and monitor time.
- Evidence: min/max/clamp/abs/sign are USER-DEFINABLE (if/then/else + comparison), compose, and gate a
  cap breach identically to built-ins. => the core need not carry library functions.
- Recommend: RATIFY use-import as core. It is what makes v4 extensible without a fat core.

### 8. `p.field` dot notation (sugar for `field(p)`)  [CORE sugar — ratify, data-backed]
- Evidence: distilled specs SYSTEMATICALLY use `p.field` (object.attribute) — the model's/human's natural
  form. Now evaluates as `field(p)`. Reduces the one-shot v4 fluency tax measurably.
- Recommend: RATIFY (pure ergonomics; the human may prefer a different surface).

### 8b. quantifier synonyms + `let` + `==`  [CORE sugar — ratify, data-backed]
- `each`/`all`/`forall` = `every`, `any` = `some`; `:` accepted for `::` in quantifier position.
- `let name [= | (args) =] e` = `given name means e` — the OCaml-style binding the human named as an
  inspiration; the model reaches for it (`let f = annual_rate_pct/1200`). Pure sugar (elaborates to given).
- `==` = `=`. Trivial, zero-ambiguity.
- Evidence: all three are top-frequency idioms in distilled specs; each removes a systematic parse-error
  class from the distill→check→fix loop. +test let_and_double_equals, each_quantifier_synonym.
- Recommend: RATIFY (pure ergonomics; elaborate to existing constructs, no new semantics).

### 8c. OPEN DECISION for the human — the block-colon grammar fork  [NOT auto-accepted]
- Measured: a model distilling a spec writes a COHERENT competing surface grammar, not typos —
  `invariant name:` (colon + layout, no `means`), `each p in schedule: body`, `each p where COND: body`
  (filtered quantifier), `a ^ b` (power). A surface-grammar fork plus a new filtered-quantifier form.
- Per CLAUDE.md syntax is human-owned. These were NOT bolted on. Two options:
  (a) bend v4's surface toward the model's prior (colon-delimited bodies, `in <domain>`, `where` filter,
      `^`) — markedly more fluent one-shot/distill authoring, at the cost of two ways to write every body
      and a bigger grammar; or
  (b) keep the keyword-`means` surface and steer the model via skill examples (done: canonical-form table
      in the language reference) + the check-fix loop.
- Recommendation: (b) for now. The value prop does not rest on one-shot authoring; the fix loop + canonical
  examples are the cheaper lever. Revisit (a) only if the distill-loop round-count stays high after the
  skill update. `^` (power) is a separate, corpus question: if a real spec needs `x^n` it is a core
  arithmetic gap; if only compound-interest closed forms need it, a `let` binding expands the product.

### 9. DEMOTE min/max to stdlib (reiterate, now with the mechanism shipped)
- std.allium (skills-v4/allium/stdlib/) defines min/max/clamp/abs/sign in user space; use-import resolves
  them. Data says the core needn't carry min/max. Human decision: keep as convenience built-ins or demote.

### LIVENESS — no new construct needed (corpus E25 covered)
- The corpus's measure-based progress (E25: obligation + decreasing measure + bound; "no temporal
  operators; the measure must be an observable") is expressible with EXISTING invariants: a well-founded
  measure `M(next) <= M(s) - step` + a discharge bound `is_last implies M = 0`. Catches STUCK
  (measure stalls) and NEVER-DISCHARGES bugs. A `progress { ... }` construct would be SUGAR — propose to
  the human as ergonomics, not a semantic need. (Bounded liveness over a finite trace = what a monitor
  can check.)

### COMPLETENESS PROBE — a tool, not a construct
- completeness_probe.py reports a spec-gate's BLIND SPOTS (unconstrained output fields). Pair with the
  absolute-invariant mandate to author COMPLETE gates. The capstone spec: 0 blind spots, gates 4 bug
  classes. Not a language change; a workflow tool.

## Ratification summary (updated)
CORE: `/`, if/then/else, round, temporal before/precedes, given-means, use-import.
CORE SUGAR (elaborate to the above): `p.field`=`field(p)`, `each`/`all`=`every`, `let`=given-means, `==`=`=`.
STDLIB (user-space): min, max, clamp, abs, sign (std.allium).
NO NEW CONSTRUCT NEEDED: liveness (measures), completeness (a tool).
OPEN (human, syntax-owned): the block-colon grammar fork (§8c) — recommend steer-via-skill, not adopt.
DEFER (human decision, low ROI): exact-decimal substrate; `dimension` type families; `progress` sugar; `^` power (corpus?).
59 allium-v4 tests pass; real demo specs (K55, LoanSchedule, double-entry) unaffected.
