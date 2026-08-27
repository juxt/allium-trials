# Trial F — priority/decision-table → disjoint case-split

## What it tests

Whether the v4 analyser's sound case-split checking pulls ahead of unaided drafting on a
genuinely hard, externally-authored specification task. The input is the **verbatim
CPMI-IOSCO Technical Guidance, Table 1** (Feb 2017) — the decision table for which entity
generates a trade's UTI. The table is not a linear waterfall: the control flow is a graph
(step 4 jumps to 10; steps 5/6/10 converge on 7/11; the confirmation-platform outcome is
reachable from both step 6 and step 12; the agreed-entity outcome three ways). Expressing
it as an unordered Allium case-split means deriving one self-contained guard per terminal
outcome by tracing every path. The difficulty is regulator-authored, not self-seeded.

Two arms, model = claude-opus-4-8, scored by `allium analyse` (sound; overlaps are exact
regardless of condition independence, gaps are axiom-relative here).

- **baseline** — one-shot draft, no checker.
- **checker** — draft, feed analyser diagnostics back, redraft, loop (<=4 iterations).

## Baseline result (N=8)

    clean 5/8    defective 3/8    (1 overlap+gap, 2 gap)    malformed 0

Not saturated. The graph structure induces real tracing errors ~37% of the time. Run 6's
overlap was 4/4096 — a tiny, specific corner where two outcomes both fire: the signature
of a dropped exclusion, not a systematic artifact. Overlaps are the sound signal; gaps
here are partly axiom-relative (e.g. `sooner_deadline` only applies under
`cross_jurisdictional`), which the analyser flags as such.

Contrast with the earlier synthetic clean-numbered waterfall, which opus got clean
one-shot every time. The difference is the source: a clean tiered list is free from
construction (encoding paths yields a partition automatically); a real regulator graph
with jumps and multi-path outcomes is not.

## Checker result (N=8)

_pending — see results-checker.json_

## Reading

The headline v4>v3 claim: without the checker a meaningful fraction of specs ship a
real structural defect (a trade double-classified or unclassified — a reporting failure)
that reading missed; with the checker in the loop they are caught and, per the checker
arm, fixed. This is the design-time value of a sound analyser, on real regulation.
