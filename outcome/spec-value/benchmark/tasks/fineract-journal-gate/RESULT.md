# fineract-journal-gate (#3 real-code grounding) — SATURATED (honest)

Fineract's real GL rule (journal entry: total debits == total credits). Sub-ledger split loses $1 on odd
amounts. N=6.

| arm | opus | sonnet |
|---|---|---|
| no-spec | 100 | 100 |
| prose | 100 | 100 |
| v3 | 100 | 100 |
| v4 (analyse) | 100 | 100 |

## Reading it honestly
SATURATED — every arm catches it. Two reasons: (1) debits==credits is the MOST canonical accounting rule,
(2) the task interface spelled out how to test it (entries where sum(debit_lines)==credit_amount). So the
check was trivial to write correctly and even no-spec caught the odd-amount bug.

## What this does and does NOT show
- DOES: real-code grounding succeeded — this is Fineract's actual GL rule (provenance cited). And analyse's
  deterministic guarantee holds (100%).
- Does NOT: show an analyse ADVANTAGE over test-generation. On the most obvious rule, clearly framed,
  everyone succeeds. The analyse edge appears only on NON-TRIVIAL checks (report-balance-gate,
  trial-balance-gate: multi-field report generation where the mid-tier model's generated checks
  FALSE-ALARMED). Consistent with the non-inferability law applied to gates: a gate discriminates only when
  the rule/edge is non-obvious OR the check is non-trivial to write.

## Net for the reporting story
analyse gives a deterministic correct balancing check across all three gates. Its DIFFERENTIATED value over
test-gen is on non-trivial report checks (shown by report-balance + trial-balance), not on the canonical
single debits==credits rule. Do not cite this saturated run as evidence of advantage; cite it only for
real-Fineract-rule provenance.
