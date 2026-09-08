# elicit-loan-allocation — END-TO-END result (opus author; sonnet pending)

Vague loan-allocation brief, 14 material non-inferable decisions, proxy stakeholder answers what
is asked and volunteers nothing. Each process interacts by its own real rules, produces a spec,
then a FIXED codegen step (opus) turns that spec into code scored by an 11-scenario behavioural
oracle. Coverage = spec vs bible; Code = did we get the code we wanted.

## Opus author, cooperative stakeholder (N=3, complete and stable across two runs)

| process | coverage /14 | end-to-end code | Qs |
|---|---|---|---|
| **allium-elicit** | 12.0 | **87.9%** | 24 |
| plain prose | 12.7 | **87.9%** | 18 |
| AIUP | 11.3 | 69.7% | 15 |
| spec-kit | 9.0 | 63.6% | 5 |
| superpowers* | 7.0 | 36.4% | 6 |

Naive-guess code floor (industry-standard defaults): 27% (3/11).

## What this shows

1. **Allium elicit ties the strongest baseline and beats every packaged competitor process.**
   Against a diligent engineer who asks the stakeholder freely (prose), elicit ties at 88% code.
   Against the three named SDD tools it wins clearly: AIUP 70, spec-kit 64, superpowers 36. The
   honest headline is "matches an expert, beats the tools", not "beats everything".

2. **The packaged tools lose for structural reasons, reproduced faithfully.**
   - **spec-kit**: `/specify` guesses from industry standards and the 3-marker + 5-question caps
     stop it asking; it defaults BHD to 2dp, misses the write-off tolerance (0/3 code on
     tolerance and backdate), lands 64%.
   - **AIUP**: derives use-cases from a vision rather than interrogating; asks a fair amount
     (15Q) so it recovers to 70%, but still guesses the un-asked bespoke policies.
   - **superpowers**: one-question-at-a-time brainstorming; *under-measured here* — the harness
     round cap starves it (only 6 Q). 36% is a floor, not a fair figure; a dedicated re-run with
     more rounds is pending. Do not quote 36% as final.

3. **Per-decision, the separation is on the bespoke policies.** All arms pass bucket-order and
   BHD-3dp once asked; the tools fall down on backdated re-accrual (spec-kit/aiup/superpowers all
   0/3) and the write-off tolerance — exactly the decisions their capped/derive-from-standard
   processes never surface.

## Honest caveat (the recurring pattern)
On the capable-model happy path, elicit does not beat a diligent prose author — both saturate an
interactive cooperative stakeholder. Elicit's edge over prose must come from the conditions that
break free-form asking: a weaker author model (sonnet cells, pending), a non-cooperative/absent
stakeholder, or contradictory requirements (elicit's unique `analyse` move). Those variants are
next. The win banked here is elicit ≥ expert prose and elicit > every packaged tool, end to end.

*superpowers under-measured — see note 2.
