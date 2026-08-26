# Outcome evaluation — first results (ledger)

The harness runs the real Allium processes headless (`claude` + the plugin) and scores
their OUTCOMES against ground truth the loop never sees. First target: a small money
ledger. Model `claude-sonnet-4-6`, 2026-08-26. Per-trial detail in
`systems/ledger/TRIAL-*-RESULT.md`; the capstone in `systems/ledger/CAPSTONE.md`.

| trial | what it measures | result |
|---|---|---|
| **B — distill → bugs** | does distill+weed surface planted bugs | **3/3 detected**, each precisely |
| **A — elicit → build** | quality of code built via Allium vs a no-Allium baseline | **21/21 vs 21/21** (parity, fair run) |
| **C — analyse → comprehension** | code-only vs spec-aided question answering | **100% vs 100%** |
| **D — reimplement from spec** | the spec as a stand-alone artefact | **21/21 fidelity** |
| **capstone** | one spec, three uses | design-time (B) + build (D) + runtime monitor, all from one invariant |

## The meta-finding

The harness works end to end: real elicit/distill/weed processes, real builds, judged
against hidden suites. But the small ledger **only discriminates on Trial B**. A, C and D
all hit ceilings (parity, 100%, 100%), because a system this simple is easy to build, to
comprehend, and to rebuild from a spec — with or without Allium. That is honest and
expected, not a null result: Trial B works because bug-finding is inherently discriminating,
while A/C/D need a harder problem to separate the arms.

This is exactly the objective, outcome-level signal the eval is for — and it already
surfaced a real harness flaw (Trial A run 1's API artifact), which the harness was then
fixed to remove.

## What raises the signal next

1. **A harder system** (achronic, or a larger purpose-built one) to break the A/C/D
   ceilings — where invariants are easy to lose and comprehension degrades from code alone.
2. **v4 analyse (4c).** The v4-analyse-aided arms are stubbed: Trial C's deeper
   comprehension arm and Trial B's self-detection measure both need v4's analyse layer.
   That is where v4 must beat v3, and it is the reason the CLI work continues.
3. **Statistical rigour** — multiple runs and models, not one each.
4. **A fairer judge** for Trial B (an LLM grader over the weed report, replacing keyword
   matching) and the **interactive operator** for Trial A (replacing the batch brief).

## How to reproduce

```
node outcome/trial-b.mjs      # distill → bug detection
node outcome/trial-a.mjs      # elicit → build vs baseline
node outcome/trial-c.mjs      # comprehension
node outcome/trial-d.mjs      # reimplement from spec
python3 systems/ledger/capstone/demo.py   # runtime monitor
```
