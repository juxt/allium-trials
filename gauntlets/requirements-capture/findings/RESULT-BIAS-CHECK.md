# Bias check: are the 14 decisions genuinely bespoke, or leaked into training data?

Date: 2026-09-15. Run: wf_4c1662f3-a7c. Answers the concern that prose's high coverage means the
"bespoke" decisions are really common knowledge the model already holds.

## Method

Give a capable model ONLY the brief, no stakeholder, and tell it to produce a complete spec, guessing
every unstated detail as a capable engineer would by default. Score against the hidden reference set.
If the model guesses the reference set's answers, they are in training data (contaminated). If it
guesses common
defaults and gets the bespoke ones wrong, they are genuinely bespoke. Opus and Sonnet, N=5.

## Result: no contamination. The decisions are genuinely bespoke.

| condition | coverage (14) | bespoke coverage |
|---|---|---|
| guess, no stakeholder (opus) | 20.0 | 14.5 |
| guess, no stakeholder (sonnet) | 42.9 | 40.0 |
| prose, WITH stakeholder (ref) | 76.2 | — |

Forced to guess, coverage collapses. The gap between 20% and prose's 76% is the asking. Prose wins by
asking the standard questions and recording the stakeholder's answers, not by knowing them.

## Per-decision guess success (correct out of 10 guesses, opus+sonnet)

| # | decision | correct/10 | reading |
|---|---|---|---|
| 1 | component order (fees before penalties) | 0 | always guesses penalties-first (the common, inverted convention) |
| 2 | oldest instalment first, in full | 10 | genuinely inferable, standard |
| 3 | surplus held as credit, auto-applied | 4 | partly guessable |
| 4 | BHD, 3 decimal places | 0 | always defaults to 2dp (USD/GBP). Never BHD |
| 5 | round half-up | 6 | split between half-up and banker's rounding |
| 6 | rounding residual to interest | 3 | mostly not guessed |
| 7 | interest re-accrual to value date | 0 | never guessed; treats date as informational |
| 8 | surplus does not prepay principal | 5 | half guessed |
| 9 | strict order, no proportional split | 10 | genuinely inferable, standard |
| 10 | write-off tolerance <=0.005 BHD | 0 | never invented |
| 11 | zero no-op records txn, negative rejected | 4 | usually rejects zero too (wrong) |
| 12 | penalty accrual to value date | 0 | never guessed |
| 13 | same-day multiple payments, FIFO by timestamp | 0 | never guessed |
| 14 | return shape incl tolerance_written_off | 2 | shape incomplete |

The sharpest cases (#1, #4, #10, #13) are 0/10: the model, forced to decide, confidently produces the
industry-standard answer, which is wrong for this institution. That confidence is the risk elicitation
exists to manage.

## Correction: the hand-labelled INFERABLE set was wrong

Earlier runs used INFERABLE = [9, 11, 13]. The evidence contradicts this:
- #13 (FIFO) is 0/10 — one of the MOST bespoke, not inferable.
- #11 is 4/10 — not reliably inferable.
- #2 (10/10) is genuinely inferable and was not marked.

Empirically inferable (>=5/10): #2, #5, #8, #9.
Empirically bespoke (<=3/10): #1, #4, #6, #7, #10, #12, #13, #14.

Future scoring should use the empirically-bespoke subset [1,4,6,7,10,12,13,14] as the "decisions where
asking matters", replacing the hand guess. This is the less-brittle measure: it targets decisions the
model provably cannot infer, rather than an assumption about which those are.

## What this means

- The task is sound. Prose's win is honest: it asks, the stakeholder answers, no product knows the
  answers in advance.
- Asked to guess, a capable model picks penalties-first and 2 decimal places every time, both wrong.
  When no elicitation discipline runs (the guess arm, ~20%), you ship the plausible-wrong default.
  Running some discipline is the win.
- Opus guessed worse than Sonnet (20 vs 43), because it more often scoped a decision out or declined
  to commit rather than guess. Minor, do not over-read.
