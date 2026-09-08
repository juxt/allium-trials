# elicit-loan-allocation — END-TO-END result (pooled across runs)

Vague loan-allocation brief, 14 material non-inferable decisions, proxy stakeholder answers what
is asked and volunteers nothing. Each process interacts by its own real rules, produces a spec,
then a FIXED codegen step (opus) turns that spec into code scored by an 11-scenario behavioural
oracle. Coverage = spec vs bible; Code = did we get the code we wanted. Numbers pooled over all
valid cells across runs (network/limit-damaged cells excluded).

## Pooled results

| process | opus cov | opus **code** | sonnet cov | sonnet **code** |
|---|---|---|---|---|
| **allium-elicit** | 84.7 (n=7) | **80.5** | 71.4* (n=1) | **81.8*** |
| plain prose | 89.7 (n=9) | 77.8 | 57.1 (n=4) | 61.4 |
| AIUP | 80.4 (n=8) | 71.6 | — | — |
| spec-kit | 63.5 (n=9) | 56.6 | 50.9 (n=8) | 40.9 |
| superpowers | 48.8 (n=6) | 45.5 | — | — |

Naive industry-standard-guess code floor: 27% (3/11). *elicit/sonnet provisional — 2 of 3 cells
were network-damaged; a clean re-run is in progress. Do not quote until confirmed.

## What holds (solid)

1. **Allium elicit ties expert prose and beats every packaged tool, end to end.** On the opus
   author both reach ~78-81% code; the tools trail — AIUP 72, spec-kit 57, superpowers 46. Honest
   headline: *matches an expert engineer, beats the tools*, on the code that actually ships.

2. **The tools lose for structural reasons, reproduced faithfully.** spec-kit caps clarification
   (3 markers + 5 questions) and guesses from industry standards, so it defaults BHD to 2dp and
   misses the write-off tolerance; AIUP derives use-cases from a vision rather than interrogating;
   superpowers' one-question-at-a-time brainstorming under-asks here. Each miss is a bespoke
   policy the process never surfaced.

## What is emerging (needs the re-run to confirm)

3. **The weaker author is where discipline should separate elicit from prose.** On sonnet, plain
   prose's code drops sharply (77.8 → 61.4) — a weaker model asks fewer, less-targeted questions
   and captures less. elicit's one clean sonnet cell HELD at 81.8. If the re-run confirms elicit
   stays high while prose sags, that is the weaker-author win the programme predicts: the elicit
   loop forces the weak author to keep asking rather than guess. On n=1 this is a hint, not a
   finding. spec-kit on sonnet is already clearly worst (code 40.9) — its cap bites hardest when
   the author is weak.

## Honest caveat (unchanged)
On the capable-model happy path, elicit does not beat a diligent prose author — both saturate an
interactive cooperative stakeholder. Elicit's edge must come from conditions that break free-form
asking: a weaker author (in progress), a non-cooperative/absent stakeholder, or contradictory
requirements (elicit's unique `analyse` move — not yet tested). Those are the next variants.
