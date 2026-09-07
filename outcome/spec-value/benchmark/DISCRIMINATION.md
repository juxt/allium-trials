# How to make the evals discriminatory (break the 80-100% cluster)

The website currently clusters at 80-100%, which reads as "nothing to see". The cause and the fix are both
understood. This is the design discipline for new tasks.

## Why tasks cluster high

1. **Too few obligations, mostly inferable.** A single-rule task is binary (0 or 100). The gaps we saw came
   from a *few* non-inferable cases diluted by many easy ones, and dilution pulls the average toward 100.
2. **Frontier models know standard domains.** no-spec/Opus hits 100 on standard accounting/finance because it
   genuinely knows the rules. Separation then only appears on the mid-tier model or on bespoke rules.
3. **Oracles dominated by easy cases** wash out the hard signal (mathutil: full 96 vs hard-subset 88).

## The recipe for no-spec at 50-60%, spec at 80-90%

1. **Many INDEPENDENT obligations (15-30), a MAJORITY non-inferable.** Then no-spec gets the inferable
   minority + a few lucky guesses and lands mid-range; a spec carrying all of them reaches high. (p6's
   bespoke stores did exactly this: no-spec ~20% -> spec 100%.)
2. **Per-obligation GRADED oracle** (partial credit), so scores are smooth, not bimodal.
3. **Non-inferable = BESPOKE/arbitrary**, not standard-domain: minor-unit+overpunch amounts, Julian dates,
   ISO-numeric currency codes, arbitrary enum codes, institution/regulation-specific thresholds and
   orderings. A model cannot guess these; only the spec carries them.
4. **Do NOT hand the conventions (or a test recipe) to the no-spec arm.** It gets the interface only.
5. **Report per model.** The gap is largest on the mid-tier model (the typical user); a genuinely bespoke
   rule also separates the frontier model.

`settlement-format` is the first task built to this recipe (bespoke wire-record encoder, ~12 non-inferable
conventions, per-field graded; naive baseline 23%).

## Honest axis-matching — what CAN and CANNOT separate

- **no-spec vs spec (any form): CAN separate dramatically** on code score. This is the elicitation value and
  the right place to chase 50-60 vs 80-90. Retro-fit existing tasks by adding more non-inferable obligations.
- **prose vs structured (v3/v4): TIES on code score** — all carry the obligations equally. Do NOT fabricate a
  score gap. The real difference is RELIABILITY: prose misleads/false-alarms. Show it as *fraction of runs
  fully correct* (or variance), not mean coverage. (mathutil prose/opus 86 < no-spec; reporting gates:
  prose false-alarms.)
- **v3 vs v4: separates on the GATE, not code** — analyse (proof) 100 vs generated tests 66-100
  (durability-gate, reporting). Keep the v3/v4 story on verification, never on first-draft code score.

## The output-space floor (why enum/boolean tasks can't go low)

A crucial refinement, confirmed by settlement-format (no-spec 20) vs the enum tasks (no-spec ~98). The
no-spec floor is set by the OUTPUT SPACE per obligation:
- **Boolean/enum outputs** (is-this-status-closed?, which-tier?) have a high CHANCE floor: guessing, or an
  all-false default, scores ~50-70%. So a boolean-output task CANNOT be pushed much below ~70 no matter how
  bespoke the rule — retrofitting enum tasks with bespoke predicates de-clusters them only modestly (98 -> ~78).
- **Large output spaces** (an encoded string, a specific value/ordering/format) make a wrong guess almost
  certainly wrong, so no-spec drops to 15-30 (settlement-format). This is why the wire-format task separated
  so sharply and the enum tasks did not.

Implication: to land no-spec LOW (20-40), the obligations must have LARGE output spaces (encodings, computed
values, orderings, formats), not booleans. To land no-spec MODERATE (~50-60), mix large-output bespoke
obligations with inferable ones (settlement-mixed: 10 natural + 10 bespoke -> ~57). Boolean/enum tasks are
inherently high-floor and best used to show the mid-tier-model gap, not a dramatic one.

## To harden the existing suite
- Add non-inferable obligations to the reconstruct tasks (turn 1-2-rule tasks into 15-rule ones).
- Add a RELIABILITY column (fraction of fully-correct runs) so the prose-vs-structured difference is visible.
- Keep at least one deliberately-hard task per domain that lands no-spec ≤ 60%.
