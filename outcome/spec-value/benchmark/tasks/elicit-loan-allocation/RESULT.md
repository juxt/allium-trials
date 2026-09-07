# elicit-loan-allocation — result (N=3, Opus author, cooperative stakeholder)

| arm | coverage | bespoke (11) | inferable (3) | Qs asked |
|---|---|---|---|---|
| plain prose | **90.5%** | 93.9% | 77.8% | 20 |
| allium-elicit | 85.7% | 90.9% | 66.7% | 28.7 |
| spec-kit | **45.2%** | 48.5% | 33.3% | 4.3 |

## Findings

1. **spec-kit loses decisively (45%), by its own design — a strong, faithful result.** It scored
   0/3 on BHD-3dp, residual→interest, tolerance write-off, zero/negative, and result-shape, 1/3
   on half-up. `/specify` guesses from "industry standards" (defaulted 2dp, "non-negative
   amount") and the 5-question `/clarify` cap meant the bespoke policies were never asked. A
   process that caps clarification and guesses misses bespoke policy — the settlement-format
   lesson, reproduced in an elicitation setting.

2. **allium-elicit ≈ plain prose (85.7 vs 90.5) — a NULL result on coverage, honestly reported.**
   Decision-by-decision the two are identical bar #8 and #13 (within variance; elicit runs were
   11/13/12 of 14). A capable model (Opus) given a cooperative stakeholder simply asks ~20
   questions and captures almost everything; the elicit discipline added no coverage and asked
   *more* questions (29) for it.

## Why this eval does not exercise elicit's differentiators

Elicit's distinctive moves are (a) mark-don't-guess when you cannot ask, (b) refuse to silently
reconcile contradictions, (c) produce a machine-checkable artefact. This task neutralises all
three: the stakeholder answers everything (guessing is never forced, so prose just asks), the
bible has no contradictions (`analyse` is inert), and there is no code/verification phase. So the
task measures "does the process ask enough", on which a capable model + cooperative stakeholder
already saturates for both prose and elicit. The genuine separation it DID surface is against a
process that structurally fails to ask (spec-kit).

Reconciles with the earlier clear-air finding (elicit 9 vs prose 5): that was prose writing from
a brief with NO ONE to ask — where prose guesses and elicit marks. Give prose a stakeholder and
the gap closes. Elicit's coverage edge is real only where you cannot, or do not, ask enough.

## What to test next (where elicit should actually bite)
- **Weaker author model (Sonnet).** Prior law: spec value rises as capability falls. Does elicit
  discipline help Sonnet ask better than Sonnet-prose?
- **Non-cooperative / absent stakeholder.** Terse or unavailable answers force the process to
  decide when to guess vs mark. elicit marks OPEN; prose guesses wrong. This is the condition the
  clear-air finding measured.
- **Contradictory requirements.** Put two conflicting policies in the bible; elicit's `analyse`
  catches the conflict, prose smooths it over. This is elicit's unique, checkable move.
- **Downstream code + verification.** Generate code from each artefact and (for Allium) re-check
  it — the axis where structured beats prose that this coverage eval cannot see.
