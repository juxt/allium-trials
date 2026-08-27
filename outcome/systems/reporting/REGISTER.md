# Assurance register — Reporting.allium

Strength of green: **proved** (sound, no bound) · **bounded** (exact over the modelled domain) · **monitored** (observed on a trace). Completeness: **closed** (no assumptions) · **assumed** (relative to stated axioms).

## Design time

| Property | Check | Verdict | Assurance | Evidence |
|---|---|---|---|---|
| rule set | consistency | consistent | bounded / closed | SAT witness |
| cleared_report | feasibility | feasible | bounded / closed | report exists |


## Runtime — 12 events observed

| Property | Check | Verdict | Assurance | Evidence |
|---|---|---|---|---|
| code_when_collateralised | monitor (point) | VIOLATED | monitored / measured | t=7 T3: collateralised=T, has_collateral_code=F |
| once_accepted_stays | monitor (temporal) | VIOLATED | monitored / measured | t=10 T4: old accepted=T, rejected=T |
| unique_uti | monitor (relational) | VIOLATED | monitored / measured | t=11 -: a=B1, b=T5 |
| allocation_refs_block | monitor (relational) | VIOLATED | monitored / measured | t=12 -: a=A3 |


2 invariant(s) held over the trace.


## Overall: RED

Every verdict above is machine-checked and reproducible on every build. A red or amber cell names the exact property, evidence, and stage — not a judgement call.

