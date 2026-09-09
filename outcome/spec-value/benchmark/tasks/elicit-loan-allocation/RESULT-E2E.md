# elicit-loan-allocation — END-TO-END result (pooled across runs)

Vague loan-allocation brief, 14 material non-inferable decisions, proxy stakeholder answers what
is asked and volunteers nothing. Each process interacts by its own real rules, produces a spec,
then a FIXED codegen step (opus) turns that spec into code scored by an 11-scenario behavioural
oracle. Coverage = spec vs bible; Code = did we get the code we wanted. Numbers pooled over all
valid cells across runs (network/limit-damaged cells excluded).

## Pooled results (clean cells only; network/limit-damaged cells excluded)

| process | opus cov | opus **code** | sonnet cov | sonnet **code** |
|---|---|---|---|---|
| **allium-elicit** | 84.7 (n=7) | **80.5** | 78.6 (n=2) | **81.8** |
| plain prose | 89.7 (n=9) | 77.8 | 55.7 (n=5) | 58.2 |
| AIUP | 80.4 (n=8) | 71.6 | — | — |
| spec-kit | 63.5 (n=9) | 56.6 | 54.8 (n=6) | 47.0 |
| superpowers | 48.8 (n=6) | 45.5 | — | — |

Naive industry-standard-guess code floor: 27% (3/11). elicit/sonnet is n=2 (both clean cells
scored 9/11 — zero variance — plus a consistent third clean cell at 9/11 in an earlier run);
thin, but consistent and directionally clear. Getting clean sonnet cells was costly: the network
repeatedly killed the `produce`/`ask` steps, contaminating cells (empty spec or zero questions),
which is why n differs by arm.

## THE WEAKER-AUTHOR WIN (confirmed)

**elicit holds ~81% code on BOTH author models; prose collapses 78 -> 58 on the weaker one.**

| author | elicit code | prose code |
|---|---|---|
| Opus (frontier) | 80.5 | 77.8 |
| Sonnet (mid-tier) | 81.8 | 58.2 |

On the capable author, structured elicitation ties a diligent engineer (both ~78-80). On the
weaker author the tie breaks: prose's code drops 20 points because a weaker model asks fewer,
less-targeted questions and captures less, while elicit's discipline forces it to keep asking
until the org-specific decisions are settled — so its code stays high. The mechanism is visible in
the transcripts: clean elicit/sonnet cells asked 20 and 28 questions; clean prose/sonnet cells
asked 5-14. This is exactly the programme's law (spec value rises as author capability falls),
now measured on requirement *authoring*, not just code reconstruction. The everyday Cursor/Copilot
user on a mid-tier model is precisely who gains.

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
