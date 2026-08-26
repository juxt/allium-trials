# Outcome trials

Evaluates Allium by OUTCOMES, not spec diffs: what its specs let you *do*. Judged
against Allium's mission — design rigorously, stress-test designs before
implementation, monitor running code, all from one spec.

The trials run the real processes headlessly (like the sibling trials, they spawn
`claude` with the Allium plugin via `--plugin-dir`) and score the result against
ground truth the loop never sees.

## The four trials + capstone

- **A — elicit → build-quality.** An *operator agent* answers the elicit loop
  faithfully from a hidden acceptance suite the loop never sees; the elicited spec
  drives a build; the build is scored against that suite (mutation-kill, obligation
  coverage; did design-time analyse catch a flaw before any code). Baseline: build
  without Allium / with v3.
- **B — distill → bugs + modernisation.** Subtle planted bugs; score whether
  distill + analyse surfaces them (as a spec/code divergence, and — the deeper
  measure — as a self-identified invariant violation). Plus modernisation: does the
  distilled spec catch regressions during a refactor?
- **C — analyse → comprehension** (the primary objective; depth is the means). A
  ground-truth question bank; score v3-aided vs v4-aided vs code-only.
- **D — reimplement-from-spec.** Rebuild from the spec plus minimal non-functionals
  ONLY, scored against the same hidden suite. Measures the spec as a stand-alone
  artefact, the complement of the code. Low scores are informative, not a failure.
- **Capstone — one spec, three uses.** Verify the design, drive the build, monitor
  the run, from a single spec.

## Layout

```
systems/<name>/
  codebase/        # what the elicit/distill/comprehension loop SEES
  acceptance/      # HIDDEN ground truth: the acceptance suite (scores A, D, and bug oracles)
  bugs/<name>/     # HIDDEN planted-bug variants + bug.md (Trial B)
  questions.json   # HIDDEN comprehension question bank (Trial C) — forthcoming
```

The `acceptance/`, `bugs/` and `questions.json` are the answer keys; only
`codebase/` is ever copied into the workspace the loop runs in.

## Systems

- **ledger** — a money ledger in Allium's own domain. Reference implementation, a
  21-test acceptance suite (conservation, non-negative balances, transfer
  atomicity, boundaries), and three subtle planted bugs (overdraft-in-withdraw,
  non-atomic-transfer, same-account-allowed), each verified to be caught by the
  suite. Run the suite against any implementation:
  `PYTHONPATH=<impl-dir> python3 -m unittest discover -s systems/ledger/acceptance`.

## Status

Substrate built (ledger). Trial runners are the next work, built one at a time on
the allium-trials `v4` branch, starting with Trial B (distill → bug detection),
since the distill and weed skills already exist.
