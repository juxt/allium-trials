# mathutil-port result — FIRST non-saturated matrix signal

Port 20 Fineract numeric utils from a spec, hidden source. 980 graded golden cases. 4 arms x 2 models.

| arm | opus | sonnet |
|---|---|---|
| none | 98.5 | 96.5 |
| prose | 92.9 | 100 |
| v3 | 100 | 100 |
| v4 | 100 | 100 |

## Findings (the first real ones on code output)

1. **Structured specs (V3/V4) = 100% on BOTH models.** They pinned the arbitrary null-convention edge cases
   (is_empty(0)=true, is_zero(null)=false, negative_to_zero(null)=0, zero_to_null(0)=None, the asymmetric
   is_less_than_or_equal_to that NPEs on a null second arg) that a signature-only port cannot infer.
2. **No-spec is high but not perfect (~96.5-98.5%).** Models INFER most of even the arbitrary semantics, but
   miss a few. So a spec adds a small, real correctness margin on non-inferable conventions.
3. **Prose is UNRELIABLE.** prose/opus scored 92.9 — BELOW no-spec. The prose description of the asymmetric
   isLessThanOrEqualTo / min modes misled the implementer into a wrong quirk. Structured specs (V3/V4)
   did not have this failure. This is a real point FOR structured over prose: prose can actively mislead;
   the structured forms were reliably 100.

## Caveat + next
The gap is SMALL because the 980-case oracle is dominated by INFERABLE comparison/arithmetic cases (everyone
~100). The signal lives in the ~5% arbitrary-semantics cases. A sharper task concentrated ONLY on
non-inferable conventions should widen the gap and confirm: structured > none > prose-when-it-misleads.
This is the recipe: real code with ARBITRARY/OPAQUE conventions + a graded oracle weighted to them.
