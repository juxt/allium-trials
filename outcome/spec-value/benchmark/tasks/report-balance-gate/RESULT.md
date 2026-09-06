# report-balance-gate — REGULATORY REPORTING: analyse gives a correct pre-submission check

Before a balance sheet is submitted, the check must confirm assets == liabilities + equity. An accrual posted
via two half-postings loses $1 on ODD amounts, so the sheet silently fails to balance for odd accruals only.
Which arm's pre-submission check CATCHES this (fails the buggy report, passes the correct one)? N=6.

| arm (check) | opus | sonnet |
|---|---|---|
| v4 — `analyse` (proof) | 100 | 100 |
| no-spec — tests | 100 | 66.7 |
| prose — tests | 66.7 | 50 |
| v3 — tests | 100 | 0 |

## Findings

1. **`analyse` is the ONLY 100%-reliable check, both models.** It proves the accounting identity over ALL
   amounts, so it catches the odd-amount imbalance deterministically and never false-alarms on a correct
   report. Verified witness on the spec.
2. **The regulator-relevant failure mode is FALSE-ALARM, not miss.** The generated checks most often failed
   by WRONGLY flagging the CORRECT balance sheet (sonnet: v3 6/6 false-alarm, prose 3/6, no-spec 2/6). In a
   submission gate a false-alarm blocks a valid filing; a miss lets an invalid one through. analyse does
   neither.
3. **Test-generated checks are unreliable on the mid-tier model** (0-67% catch on sonnet) — the everyday
   case. On the frontier model they mostly work.

## Honest caveats
- v3/sonnet = 0% is partly a SPEC-TO-API mapping artifact: the v3 `entity Sheet {assets,liabilities,equity}`
  abstraction did not map cleanly onto the concrete build(base,...,accrual) API, so a mid-tier model produced
  consistently-broken checks. The robust claim is analyse (proof) > test-generation (unreliable on weaker
  models), not the specific v3 number.
- Scope: this is the ARITHMETIC/BALANCING slice of regulatory reporting — analyse's provable fragment, and
  exactly where accounting identities live. It does NOT cover logical/format rules (conditional-mandatory
  fields, enum validation) common in CFTC/MiFID transaction reporting; that is a different, untested flavour.

## The benefit statement (evidence-backed)
For the pre-submission checks a regulator requires on a report's BALANCING identities, Allium's `analyse`
proves them over all cases and catches a report that would not balance — deterministically, with no misses
and no false alarms — where hand-generated checks are unreliable, especially for mid-tier models, and tend to
BLOCK VALID reports as often as they miss invalid ones.
