# Regression experiment — the tireless, deterministic axis

The assurance gate runs on every commit: all runtime invariants, re-verified from one spec over the build's own trace. This is the value the six saturations pointed at — not out-catching a model once, but total coverage on every commit, for free, reproducibly, with provenance.

```
Regression matrix — gate on every commit (RED = violation caught)

                     code_when_coll  ccp_lei_when_c  once_accepted_     no_unsubmit      unique_uti  allocation_ref
c1 baseline                      ok              ok              ok              ok              ok              ok
c2 +bespoke                     RED              ok              ok              ok              ok              ok
c3 +late-reject                 RED              ok             RED              ok              ok              ok
c4 fix bespoke                   ok              ok             RED              ok              ok              ok
c5 +re-book                      ok              ok             RED              ok             RED              ok
c6 +orphan-alloc                 ok              ok             RED              ok             RED             RED
c7 fix re-book,late              ok              ok              ok              ok              ok             RED
c8 fix orphan                    ok              ok              ok              ok              ok              ok

8 commits x 6 properties = 48 checks, all deterministic and reproducible; 10 regressions caught with provenance.
Each regression is caught at the commit it lands (c2 bespoke, c3 late-reject, c5 re-book, c6 orphan) and clears when fixed (c4, c7, c8).
```

A model reviewing each commit would be nondeterministic and, at N properties x M commits, expensive; the gate is neither. It need not beat the model on catch-rate to be worth running — it is cheap enough to run on everything, every time, and its verdict is a machine-checked artifact.
