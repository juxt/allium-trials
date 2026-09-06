# contra-sign-gate — discriminates on the MID-TIER model (non-inferable rule); Opus knows contra

Non-obvious real rule: a contra account flips its normal side. Bug ignores the contra flag (manifests only
for contra accounts). No test recipe handed over. N=6.

| arm | opus | sonnet |
|---|---|---|
| no-spec | 100 | 50 |
| prose | 100 | 100 |
| v3 | 100 | 100 |
| v4 (analyse) | 100 | 100 |

## Findings
1. **Discriminates on Sonnet: no-spec 50 -> spec 100.** The mid-tier model cannot reliably infer the contra
   rule, so its self-written check misses the contra bug half the time; a spec that states the rule closes
   the gap to 100. This is Finding 1 (spec carries a non-inferable rule) in the reporting domain.
2. **Saturates on Opus (no-spec 100).** Contra accounts are STANDARD accounting; the frontier model knows
   the rule and tests it unaided. So the rule was not non-inferable ENOUGH for Opus.
3. **All spec forms equal (prose=v3=v4=100, no false alarms).** Once the rule is known, the contra check is
   easy to write correctly, so there is NO analyse-gate advantage here (unlike report-balance/trial-balance,
   where the multi-field check was non-trivial and test-gen false-alarmed on Sonnet). This task exercises the
   ELICITATION value, not the gate-reliability value.

## The design lesson (anti-saturation)
To discriminate on a FRONTIER model, a rule must be non-inferable to IT — i.e. bespoke / institution- or
regulation-specific, not a standard domain convention a strong model already knows. Standard accounting
(contra) discriminates only the weaker model. This is the same non-inferability law seen throughout: the
frontier model needs the spec only for rules outside its training. Two reporting values now mapped:
(a) GATE-RELIABILITY — analyse vs test-gen on NON-TRIVIAL checks (report-balance/trial-balance; Sonnet
    false-alarms); (b) ELICITATION — spec carries a non-inferable rule (contra; Sonnet misses). Both real,
both concentrated on the weaker model; the frontier model is hard to move with standard-domain rules.
