# Code-reliability eval — does Allium, and the library-spec feature, produce more reliable code?

The p5 eval showed a library spec makes an implementer write a more complete *specification*. That
is the elicitation half of the thesis. This eval tests the harder, real claim: does it make the
implementer write more reliable *code*, with fewer bugs. The oracle here is not an LLM judge, it is a
**hidden executable test suite**. Fresh agents write a real Python consumer; the tests run against it
and count how many correctness obligations survive.

## The three arms

Same task, same published interface, one variable: how much of the Allium way of working the
implementer has.

- **A, no Allium** — the task and the interface. Write code.
- **B, Allium** — the same, plus: first specify your consumer's behaviour in Allium and check it with
  `allium check`, then implement. No dependency, just the discipline of specifying and checking a design.
- **C, Allium + library spec** — the same as B, plus the broker's **library spec**: a contract of the
  four consumer obligations. Reference it, `allium analyse` your design against it until it SATISFIES
  all four, then implement.

A vs B answers *does Allium produce more reliable code*. B vs C answers *does the library-spec feature
improve on that*. The checker is machinery inside B and C, never the scorer.

## The domain and the oracle

`message_queue/` is an at-least-once broker with a visibility timeout, simulated on a logical clock so
every test is deterministic. `harness.py` is the published interface, given to every arm. It states the
broker's *mechanics* honestly (delivery is at-least-once; an unacked message is redelivered) but never
the consumer's *obligations*. Those four obligations are the hidden test suite, `test_obligations.py`:

- **idempotent** — a duplicate delivery must not apply the effect twice.
- **ack_after_process** — a message is acked only after processing, so a mid-process failure is retried,
  not lost.
- **extend_visibility** — a job longer than the visibility timeout must extend its lease, or the message
  is redelivered and processed twice.
- **dead_letter** — a message that can never succeed is dead-lettered, not retried forever.

Each obligation is a separate test with its own scenario, so a crash is contained to the obligation that
provoked it. The score for one implementation is how many of the four pass, 0 to 4.

The oracle is validated by two reference implementations, the way p5's `verify.py` pins its verdicts:

```
reference (correct)  -> 4/4
naive (no dedup, no lease extension, no dead-letter) -> 1/4  (passes ack-ordering only)
```

The library spec's obligations also gate at the design level: `queue_consumer_contract.allium` plus
`design_safe.allium` / `design_naive.allium` show the checker SATISFYING all four for the safe design
and refusing the naive one on the three it omits. So arm C's checker-gate is real for every obligation,
which is what lets B vs C isolate the library-spec feature rather than mere documentation.

## Why this measures the thesis, and its limits

The outcome variable is code reliability, measured by execution, not a judged proxy. The interface is
identical across arms, so the only thing that varies is the Allium working method and the library spec.
Honest limits:

- Agents write the code, so results vary run to run; the eval is re-runnable, not deterministic.
- The hidden tests fix what "reliable" means. They are the four obligations above and nothing else; a bug
  outside them is not seen. The obligations were chosen to be non-obvious operational concerns, the same
  ground where p5 showed unguided implementers collapse.
- Arms B and C add a within-task Allium authoring step. Its cost and variance (an agent may write a
  passing design but unfaithful code) are part of what is measured, not controlled away.

## Running it

`eval.wf.js` is the workflow: for each arm it fans out N implementers, then scores each produced
`solution.py` against the hidden suite in an isolated temp dir. Implementers get the interface inline and
never a path to the tests; only the trusted scorer sees them. Run with the Workflow tool pointing at the
script. It returns per-arm mean obligations-passed and a per-obligation breakdown.

## Results

_Pilot running (N = 3 per arm). Numbers to follow._
