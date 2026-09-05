# us-workday result (5th codebase) — SATURATED; the fully-famous end of the spectrum

Holiday hard-subset (10 US federal holidays), % correct:

| arm | opus | sonnet |
|---|---|---|
| none | 66.7* | 100 |
| prose | 100 | 100 |
| v3 | 100 | 100 |
| v4 | 100 | 100 |

*none/opus 66.7 is ONE broken run (104/366 full, 0/10 hard — a code bug producing wrong output for most
days); the other two no-spec/opus runs were 10/10. no-spec SONNET got 10/10 holidays on all 3 runs.

**Essentially saturated: US federal holidays are famous enough that BOTH models recall all of them with no
spec.** This is the FULLY-INFERABLE-via-fame end of the spectrum. Contrast bech32's charset (also "famous"
but only HALF-remembered -> no-spec 82%, real gap). So "famous" is a spectrum of ubiquity: a Bitcoin charset
is known to the model but fuzzily; US public holidays are known cold. The more culturally ubiquitous the
knowledge, the more inferable, the smaller the spec gap. (The 365/366 seen on v4/most arms is a 1-day
edge discrepancy, not a holiday miss.)
