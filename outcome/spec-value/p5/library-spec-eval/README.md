# Library-spec eval — does a pre-existing library spec produce more correct clients?

An A/B experiment testing the thesis: *if an implementation is guided by a pre-existing library
specification, more correct behaviour is shipped and fewer bugs are written.* It is designed to be
**non-saturating** — to show a real gap rather than both conditions hitting the ceiling.

## Design

Two conditions implement the *same* client task, differing only in one input:

- **control** — the task and a minimal Allium syntax primer.
- **treatment** — the same, plus the dependency's **library spec** (a contract of obligations).

Each condition runs **N = 5** fresh implementers (independent agents with no access to the design
conversation, so they cannot know the intended answer). A **blind judge** then scores every produced
spec against a fixed list of the dependency's correctness obligations — it is told only the domain, not
which condition produced the spec, nor how it was produced. Coverage = obligations addressed / total.

Two domains, chosen because their gotchas are **not** textbook lore a strong model reproduces on its own
(the lesson from the pilot, where fencing tokens saturated because every model knows them):

- **message_queue** — at-least-once + a visibility timeout. Obligations: idempotent processing;
  acknowledge only after processing; **extend the visibility timeout for a slow job** (or it is
  redelivered and double-processed); **dead-letter a poison message** rather than retry forever.
- **event_store** — an append-only per-stream log. Obligations: optimistic concurrency on append;
  **events are immutable** (a correction is a new event, never a mutation); **no cross-stream global
  order**; **idempotent apply** on replay.

The bold obligations are the non-obvious ones — the load-bearing part of the test.

## Why this measures the thesis, and its limits

The quantity of interest is the **control's baseline miss-rate**: the obligations a competent implementer
drops when the library spec is not there to encode them. The gap between control and treatment coverage is
the library spec's measurable value. Non-saturation depends entirely on the obligations being genuinely
non-obvious; where they are textbook, both conditions cover them and the domain saturates (an honest
negative for that concern).

Limitations, stated plainly:

- The implementer and judge are LLM agents, so results vary run to run; the experiment is re-runnable, not
  deterministic. N = 5 per condition is a pilot-scale sample, not a powered study.
- The treatment is *handed* the obligations, so its coverage is close to a ceiling by construction; the
  informative number is how far below that the control sits.
- Judge-scored (an independent blind agent against a rubric), not tool-scored. A tool-scored variant
  (running `satisfies` against the obligations) would be more objective but requires a shared observable
  vocabulary, which leaks the obligations to the control — so it was rejected in favour of the neutral
  task + blind judge.

## Running it

`eval.wf.js` is the workflow (fan out 20 implementers + 20 blind judges, aggregate). Run it with the
Workflow tool: `Workflow({scriptPath: ".../eval.wf.js"})`. It returns per-domain, per-condition mean
coverage and a per-obligation breakdown showing exactly which obligations the library spec supplies.

## Results

Run of 2026-09-03 (N = 5 per condition, blind judge, workflow `wf_2f4e38be-55e`):

| domain | control coverage | treatment coverage | gap |
|---|---|---|---|
| message_queue | **5%** (1/20) | 100% (20/20) | +95 |
| event_store | **40%** (8/20) | 100% (20/20) | +60 |
| overall | **22.5%** (9/40) | 100% (40/40) | +77.5 |

Per-obligation coverage in the **control** (how often an unguided implementer addressed it, out of 5):

```
message_queue   idempotent 1/5   ack_after_process 0/5   extend_visibility 0/5   dead_letter 0/5
event_store     optimistic_concurrency 1/5   immutable 4/5   no_cross_stream_order 1/5   idempotent_apply 2/5
```

The treatment addressed every obligation in every run (5/5 across the board), so the informative signal is the
control column: **unguided implementers, given a neutral task, addressed less than a quarter of the correctness
obligations.** They almost entirely missed the queue's operational obligations (extend-visibility, dead-letter,
ack-after-process — 0/5 each) and, for the event store, dropped optimistic concurrency (1/5) and cross-stream
ordering (1/5). The one obligation the control mostly got — event immutability (4/5) — is the one the task's
word "append-only" already hints at, which is exactly the pattern the pilot predicted: coverage tracks how
obvious the obligation is, and the library spec supplies the rest.

**This did not saturate.** Unlike the distributed-lock pilot (where fencing tokens are textbook and the control
matched the treatment), these domains have obligations a strong model does not reliably produce unprompted, so
the control sits far below the ceiling and the library spec's value is large and measurable.

## Reading the result honestly

The thesis — a pre-existing library spec ships more correct behaviour and fewer bugs — is supported here through
its mechanism: a client checked against its dependency's library spec covers correctness obligations an unguided
implementer overwhelmingly misses. Caveats that keep it honest: the treatment is handed the obligations, so its
100% is near-ceiling by construction; coverage-of-obligations is a proxy for bugs-avoided, not an end-to-end bug
count; the judge is strict, which lowers absolute numbers but applies equally to both conditions (the *gap* is
what matters); and N = 5 is pilot-scale. The effect is large enough (control 22.5% vs treatment 100%) that it is
unlikely to be noise, and the per-obligation breakdown shows precisely which considerations the spec surfaced —
which is the elicitation half of the thesis made concrete.
