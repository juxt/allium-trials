# Logical/format slice probe — analyse's boundary on conditional-mandatory rules (CATALYST)

Regulatory reporting is full of conditional-mandatory rules ("if X then field Y is required"). We probed
whether V4 analyse can express AND check them. Deterministic CLI probes (allium analyse).

## What analyse HANDLES (positive — extends the reporting value beyond arithmetic)
- **Simple** conditional-mandatory: `kind = swap implies has_maturity = true` — VIOLATION CAUGHT (boolean tier).
- **Compound** (enum AND enum implies bool): `(asset_class = rates and venue = off_venue) implies has_counterparty = true` — CAUGHT.
- No false-alarm on the compliant action. So the CFTC/MiFID "if X then Y required" staple is checkable when
  the condition is boolean/enum.

## What analyse MISSES (the boundary — the catalyst)
- **Mixed arithmetic-threshold implies presence**: `notional > 1000000 implies has_lei = true` — VIOLATION
  NOT CAUGHT. An action setting notional=2000000, has_lei=false (a clear violation) passes clean.
- Root cause: the SAT/LRA seam (the "SMT rung", a known gap). The boolean tier can't take the arithmetic
  antecedent; the arithmetic tier can't take the boolean consequent; the mixed rule falls through.
- Threshold-triggered mandatory fields ("notional over X requires LEI/UTI/collateral flag") are a core
  reg-reporting rule class, so this is a real gap, not an edge case.

## SOUNDNESS/TRANSPARENCY BUG — FIXED (2026-09-06, merged to v4)
> RESOLVED: classify() now detects the arith-guards-bool seam and reports it as NOT statically checked
> instead of listing it under a tier. The mixed rule no longer over-claims coverage. Capability gap (SMT
> rung) remains, backlog #3. Original bug description below.

For the mixed rule, analyse's COVERAGE NOTE claims `large_needs_lei` is on the "linear-arithmetic tier" —
implying it was checked — YET its violation is not caught. This is a SILENT FALSE-NEGATIVE dressed as
coverage. It violates the tool's own discipline ("never over-claim coverage; make unchecked invariants
visible", REJECTED/soundness gauntlet). A user (or our website) reads the coverage note as "verified" when
the rule was not actually checked. In a regulatory context this is the failure mode a user cannot afford.

## Catalyst — two fixes, both soundness-relevant
1. **Honest-coverage fix (contained, do first):** a mixed arith+bool invariant analyse cannot check must be
   reported as NOT CHECKED (or "outside the checkable fragment"), never listed under a tier as if covered.
   This restores the no-over-claim discipline. Small, high-value, protects the reporting pitch.
2. **Capability fix (bigger):** the SMT rung — case-split on the finite/boolean part and hand the arithmetic
   residual to LRA (or vice versa), so mixed threshold-implies-presence rules are actually checked. This is
   the #51 mixed-reasoning frontier; soundness-critical build.

## Bearing on the website
The reporting callout must NOT claim analyse covers all report rules. Honest scope: analyse proves BALANCING
(arithmetic) and BOOLEAN/ENUM conditional-mandatory rules; it does NOT yet check MIXED arithmetic-threshold
rules, and currently mis-reports them as covered (a bug to fix). Keep the page scoped accordingly.
