# Allium v4 — master synthesis (Programmes 1–5): value proposition + language design

The whole case, marshalled for decision. Everything is executable/tested; no result rests on an LLM
judge. Detail: p4/FINDINGS.md (value prop), p5/CORE-VS-EXTENSIBILITY.md + p5/RATIFICATION-DOSSIER.md +
p5/SESSION-SUMMARY.md (language). Artifact: the value-proposition page.

## THE VALUE PROPOSITION (vs no-spec, prose, v3)
1. A SPEC IS NECESSARY (biggest win, clear air over NO-SPEC). For behaviour a model can't guess — a
   system-specific convention (flat vs declining interest; pro-rata vs waterfall allocation) or an
   underspecified request — no-spec ships the plausible default and is wrong (54/150). Any spec/
   elicitation -> 150/150. Holds in build, elicit, and a 2nd domain (allocation).
2. NOTATION & MODEL DON'T MOVE ONE-SHOT CORRECTNESS (saturates). v4 = prose = v3; opus = haiku. Do NOT
   pitch v4 as more correct or cheaper than prose. Token efficiency is an honest negative for v4.
3. v4's UNIQUE, CATEGORICAL edge over PROSE and V3: the spec is EXECUTABLE — a machine-checkable,
   standing REGRESSION GATE. Prose is inert; v3 has no monitor at all. The CAPSTONE: ONE v4 spec gates
   FOUR bug classes at once — value, structure, caps, liveness — with 0 measurable blind spots and 0
   false positives; each caught by the right invariant. This is the clear air, made concrete.
4. The gate GENERALISES beyond banking: a non-financial order-fulfilment workflow (ordering + safety
   invariants) gates illegal transitions identically. General-purpose, not finance-specific. Concurrency-
   adjacent SAFETY (idempotency, uniqueness, no-double-spend) is expressible too — trace-monitorable, no
   new construct.
5. "WHY NOT JUST WRITE TESTS?" — answered executably (137 real rows, mutation battery). As a pure
   DETECTOR the gate EQUALS a correctly re-implemented oracle test row-for-row, and beats structural
   tests on value bugs (0 vs 89-107). It does NOT catch more than a correct test. Its real edge is the
   ANCHOR: with a shared misconception (dev believes flat-interest is right, writes the test to match),
   the test passes (false confidence, 0/137) while the spec — faithful-by-construction to real traces —
   fires (89/137). Plus: one declarative statement over all rows (no 2nd implementation to drift) and
   auditable by a non-programmer. SOUNDNESS of the anchor rests on the monitor actually exercising the
   invariant: a vacuity guard now warns when relational checks collapse over empty-identity traces
   (a real trap found + fixed this programme — an idempotency spec had been "passing" vacuously).

## THE LANGUAGE (what changed, and the design philosophy)
- SHIPPED (60 tests, corpus-motivated, each closing a real bug class): `/` division (value bugs:
  0/144 -> 144/144 on real traces), `if/then/else` (tiers), `round` (money precision), temporal
  `before/precedes` (ordering: 12/12), `min/max` (caps/floors), `given f means e` + `use "path"`
  (reference functions + stdlib import). SUGAR (elaborate to the above, data-driven from distilled specs):
  `p.field`=`field(p)`, `each`/`all`=`every`, `let`=`given-means`, `==`=`=`. Vacuity guard on the monitor.
- DESIGN VERDICT — SMALL CORE + CONTRIBUTABLE STDLIB (data-driven): min/max/clamp/abs/sign are
  USER-DEFINABLE (if/then/else + comparison + given-means) and compose; they need NOT be core. The core
  is primitives (arithmetic incl /, comparison, if/then/else, given-means, quantifiers, temporal, one
  rounding primitive); the rest is a stdlib (std.allium) imported via `use`. TYPES: currency/unit tags
  already open (sufficient); new numeric families deferred per corpus. LIVENESS: covered by existing
  invariants (well-founded measure + discharge bound) — no new construct. Reserve core growth for
  genuine substrate needs (exact decimal — assessed, low ROI, tolerance is the right mechanism anyway).
- FLUENCY & THE GRAMMAR FORK (decided by data): models write a coherent competing dialect (block-colon
  `invariant name:`, `each p in xs:`, `where`-filter, `^`). DECISION: do NOT fork the grammar; steer via
  the skill's canonical-form table. Evidence: a fresh authoring agent given that table reached a VALID
  spec in ONE round, zero fixes — it never emitted the dialect. The workflow is distil -> check ->
  FAITHFULNESS(monitor vs real traces) -> fix; `check` is well-formedness only (an over-constrained spec
  passes check but fails monitor — the faithfulness step is the semantic net).

## FOR RATIFICATION (I bring the data; syntax tweaks are yours)
- CORE: `/`, `if/then/else`, `round`, temporal `before/precedes`, `given-means`, `use`-import.
- CORE SUGAR (elaborate to existing constructs): `p.field`, `each`/`all`=`every`, `let`, `==`.
- STDLIB: min, max, clamp, abs, sign (std.allium — demote the min/max built-ins if you agree).
- DECIDED (data): block-colon grammar fork — declined, steer via skill (1-round convergence proof).
- NO NEW CONSTRUCT: liveness (measures), completeness (a tool: completeness_probe.py reports gate blind
  spots). DEFER (your call, low ROI): exact-decimal substrate; `dimension` type families; `progress` sugar;
  `^` power (corpus question — sidesteppable by gating observed values, not the closed-form).

## HOW TO PITCH IT
The spec you NEED for correctness (over no-spec) and that STAYS TRUE because it is executable (over
prose/v3) — a small, extensible, sound-checkable core whose standing gate catches value/structure/
ordering/liveness drift a prose spec cannot express or verify, with a tool to prove the gate is complete.
