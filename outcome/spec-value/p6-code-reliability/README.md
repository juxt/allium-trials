# Code-reliability eval — does Allium, and the library-spec feature, produce more reliable code?

The p5 eval showed a library spec makes an implementer write a more complete *specification*, the
elicitation half of the thesis. This eval tests the harder, real claim: does it make the implementer
write more reliable *code*, with fewer bugs. The oracle here is not an LLM judge, it is a **hidden
executable test suite**. Fresh agents write a real Python module; the tests run against it and count
how many correctness obligations survive.

## The three arms

Same task, same published interface, one variable: how much of the Allium way of working the
implementer has.

- **A, no Allium** — the task and the interface. Write code.
- **B, Allium** — the same, plus: first specify your consumer's behaviour in Allium and check it, then
  implement. No dependency, just the discipline of specifying and checking a design.
- **C, Allium + library spec** — the same as B, plus the dependency's **library spec**: a contract of
  the obligations. Reference it, `allium analyse` your design against it until it SATISFIES every one,
  then implement.

A vs B answers *does the Allium method alone produce more reliable code*. B vs C answers *does the
library-spec feature improve on that*. The checker is machinery inside B and C, never the scorer.

## The wrapper matters: a spec must never make code worse

The first run exposed a real defect, not in Allium but in how an agent is told to use a spec. With a
naive wrapper ("read the spec, then write the code") the Allium arms scored **below** the no-spec
control on the message queue (B 83%, C 92% vs A 100%). Two failure modes: the spec became a *ceiling*
(attention narrowed to the abstract invariants and the agent dropped defensive practices a plain coder
applies), and nothing *reconciled* the code back to the spec (an agent wrote `applied implies deduped`
then code that deduped nothing). Both are fixed by two wrapper rules, and both must hold or a spec can
degrade output:

1. **The spec is a floor, not a ceiling.** Implement everything the spec requires *plus* everything
   robust code needs; never let specifying narrow the implementation.
2. **Reconcile the code against the spec before finishing** (the `weed` step). For each obligation,
   point to the line that realises it; fix any that are asserted but not implemented.

Adding these returned all three arms to parity on the message queue (91.7%). The axiom holds: with the
right wrapper, the spec is never worse than none. The shipped skill set has no explicit
implement-from-spec wrapper that enforces this, which is a gap worth closing.

## Two domains, chosen to bracket the effect

**`message_queue/` — textbook.** An at-least-once broker with a visibility timeout, on a simulated
clock. Four obligations: idempotent processing, ack-only-after-processing, extend-the-lease for slow
jobs, dead-letter a failing message. These are operational concerns, but for a *coding* agent they are
textbook: the API scaffolds them and the patterns saturate its training.

**`sorted_store/` — bespoke.** A sorted-segment key/value store (SSTable-style). Two obligations, and
neither is visible in the API: keys within a batch must be written **ascending** (lookup binary-searches
each segment, so unsorted input silently returns wrong answers), and a batch silently **drops writes
past a hidden capacity** (roll to a new batch or lose data). A competent coder handed a neutral
`write`/`commit`/`get` stub has no way to guess either. This is where a library spec should earn its keep.

Each oracle is validated by a correct and a naive reference, the way p5's `verify.py` pins its verdicts:

```
message_queue  reference 4/4   naive 1/4   (naive passes ack-ordering only)
sorted_store   reference 2/2   naive 0/2   (naive corrupts the index and drops data)
```

Both library-spec contracts also gate at the design level: the checker SATISFIES every obligation for a
correct design and refuses a naive one on the ones it omits (boolean and arithmetic alike — the store's
capacity bound is `committed(b) implies entry_count(b) <= 4`). So arm C's checker-gate is real for every
obligation.

## Results

Message queue, N=3 per arm, after the wrapper fix:

| arm | coverage | idempotent | ack | extend | dead-letter |
|---|---|---|---|---|---|
| A no-Allium | 91.7% | 2/3 | 3/3 | 3/3 | 3/3 |
| B Allium | 91.7% | 3/3 | 3/3 | 2/3 | 3/3 |
| C Allium+libspec | 91.7% | 3/3 | 3/3 | 2/3 | 3/3 |

Parity. A strong coding agent already handles these patterns, so the spec adds no code-level
reliability here — and, fixed wrapper, costs none. The remaining misses are the genuinely subtle one
(extend-the-lease-*before*-work), scattered by noise.

Sorted store, N=5 per arm:

| arm | coverage | sorted_write | capacity_rollover |
|---|---|---|---|
| A no-Allium | **20%** | 1/5 | 1/5 |
| B Allium | **0%** | 0/5 | 0/5 |
| C Allium+libspec | **100%** | 5/5 | 5/5 |

The library spec is the entire lift. Four of five unguided agents corrupted the index and lost data; the
fifth got lucky and defensively sorted. Every library-spec-guided agent got both obligations right.
Arm B — Allium discipline *without* the library spec — scored zero: you cannot write an invariant for a
rule you have never heard of, so specifying your own design surfaces nothing. The value is the library
spec carrying the obligation from the library's authors to the consumer, not the act of specifying.

## Evaluating the ImplementFromSpec skill

The wrapper fix above was inline prompt text. It is now a shipped v4 skill
(`allium/skills-v4/implement`), and this eval tests the skill itself: three conditions implement each
domain, and the skill arm makes the agent read and follow the real `SKILL.md`.

| condition | message queue | sorted store |
|---|---|---|
| baseline, no spec | 75% | 25% |
| naive wrapper (contract, "implement it faithfully") | 81% | 100% |
| **the skill** (floor + reconcile) | **94%** | **100%** |

Two claims hold. **Never worse:** the skill sits above baseline on both, +19 and +75. **Value captured:**
the skill takes the bespoke store from a 25% baseline to 100%. The skill's edge over a plain "implement
the contract faithfully" wrapper is real but modest: +13 on the queue, where getting every operational
obligation right is fiddly, and a tie on the store, where simply being handed the obligations was enough.

The honest reading is that this run validates the skill as never-worse and value-capturing rather than
proving a naive wrapper always degrades. In this controlled comparison the naive wrapper did *not* fall
below baseline. The below-baseline degradation seen earlier came from a different, worse flow — an agent
authoring its *own* design and then hand-coding, where the spec became a ceiling and was never reconciled.
The skill's contribution is best stated as a guarantee, never worse, plus a small uplift where correctness
is easy to half-do, not as a large average lift over any sensible use of the contract.

## The law, and the honest limits

One rule explains p5 and both p6 domains: **value tracks non-obviousness.** A library spec pays off
exactly where the obligation is not already known to the implementer — writing a spec (p5, control
22.5%) or shipping code against a bespoke dependency (p6 store, 0→100%) — and adds nothing where the
implementer already knows the patterns (p6 queue). The corollary for practice: invest in a library spec
for the proprietary, non-obvious constraints of a dependency, not for its textbook behaviour.

Limits, stated plainly:

- Agents write the code, so results vary run to run; the eval is re-runnable, not deterministic. N is
  3–5 per arm, pilot scale.
- The hidden tests fix what "reliable" means — the stated obligations and nothing else; a bug outside
  them is not seen.
- The bespoke domain's effect is large enough (0–20% vs 100%) that it is not noise, but the store has
  two obligations, so coverage is coarse-grained.

## Running it

`eval.wf.js` (message queue) and `eval_store.wf.js` (sorted store) are the workflows: for each arm they
fan out N implementers, then score each `solution.py` against the hidden suite in an isolated temp dir.
Implementers get the interface (an API stub for the store) and never a path to the tests; only the
trusted scorer sees them. Run with the Workflow tool pointing at the script.
