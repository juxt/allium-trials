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

    first-draft defective 2/8    ->    after loop: clean 8/8    (0 shipped defects)
    avg iterations 1.6 (defective drafts converged in 3 and 4 iterations)

Both defective first-drafts were caught and fixed. Integrity check on run 4 (the
4-iteration case): the final spec keeps all nine real terminal outcomes (CCP, clearing
member, trading platform, sooner-deadline rules, assigned entity, agreed entity,
confirmation platform, TR, counterparty sort) — no spurious catch-all action, no merged
or dropped outcome. So the loop drove a genuine structural correction, not checker-gaming
(killing a gap with a junk action, or an overlap by deleting an outcome).

## Reading

Side by side, on the verbatim CPMI-IOSCO table, opus:

    baseline (no checker)      5/8 clean, 3/8 ship a real structural defect
    checker in the loop        8/8 clean, 0/8 ship a defect (2 caught + fixed)

Without the checker a real fraction of specs ship a defect — a trade double-classified or
unclassified, a reporting failure — that reading missed. With the analyser in an
elicit-style loop they are caught and fixed in a few iterations, without degrading the
spec. This is the design-time value of a sound analyser, measured probabilistically on
real regulation. It is the first non-saturated v4-over-v3 result: unlike the earlier
ledger and idempotency trials, the baseline fails a meaningful fraction of the time, so
the checker has something to add.

Caveat on scope: the sound signal is disjointness (overlaps are exact). Exhaustiveness
here is axiom-relative, because conditions like `sooner_deadline` only apply under
`cross_jurisdictional`; the loop's fix for a gap may be to state that domain axiom rather
than change a guard. Full guard-level fidelity to the table is a separate axis the
analyser does not check.
