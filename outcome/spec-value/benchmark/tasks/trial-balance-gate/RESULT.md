# trial-balance-gate (debits == credits) — widens the balancing evidence

Second balancing identity, same pre-submission gate: an odd-amount posting breaks debits == credits.

## v4 / analyse: CATCHES it (verified directly)
`allium analyse` deterministically flags the unbalancing `post` action: "action `post` can break arithmetic
invariant `balanced`". Verified by direct CLI on edited.v4.allium. (The automated workflow's v4 arm reported
0% due to a CLONE BUG — its detection string still looked for the old action name `accrue`, not `post`, so it
never matched. That 0% is a HARNESS ARTIFACT, discarded — not an analyse result. Fixed the string for
reproducibility; not re-run since analyse's catch is already verified and report-balance-gate already showed
v4=100 on the balance-sheet identity.)

## Test-gen arms (VALID) — replicate the report-balance-gate pattern on a 2nd balancing rule
| arm | opus | sonnet |
|---|---|---|
| no-spec | 66.7 | 50 |
| prose | 100 | 33.3 |
| v3 | 83.3 | 66.7 |

Same finding as report-balance-gate: generated pre-submission checks are unreliable on the mid-tier model,
and the dominant failure is FALSE-ALARM (wrongly failing the CORRECT trial balance — blocking a valid filing).
So the balancing-gate result holds across BOTH canonical identities (assets=liabilities+equity AND
debits=credits): analyse gives a deterministic correct check; hand/LLM-generated checks miss or false-alarm.
