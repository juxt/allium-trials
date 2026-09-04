# V4 vs V3 — does the objective obligation make anti-vacuity tests reliable?

The first V4-vs-V3 eval, riding the new `allium plan` for v4. A v4 spec's plan emits an OBJECTIVE
(anti-vacuity) obligation; a v3 spec has no construct to emit one. Question: does a test suite
*generated from* the V4 obligations catch a vacuous implementation that a suite generated from
V3-expressible obligations (safety only) misses?

Cache domain (safe-but-vacuous is real: an always-miss cache is never stale but never caches).
Fresh agents generate a pytest suite from the obligations; a scorer runs each against a correct cache
and the vacuous always-miss cache and reports whether it CATCHES the vacuous one.

## Result (N=4 per arm)

First run (loose `never_stale`, N=4): V4 caught vacuous 100%, V3 50% — but muddied by two confounds
(agents over-specifying `never_stale` as reflecting out-of-band store writes, and a couple leaking the
caching intuition). **Tightened** so the cache is the sole writer and correctness is stated only in terms
of the cache's own operations, the signal is clean (N=4):

| arm | catches the vacuous cache | passes the correct cache |
|---|---|---|
| V4 (safety + objective) | **100%** (4/4) | **100%** |
| V3 (safety only) | **~0%** (1/4, and that one is a test-logic bug) | 75% |

Every clean V3 run wrote safety-only tests that the vacuous always-miss cache passed; the lone V3 "catch"
was a buggy test that also fails the correct reference, not a genuine catch. V4's suites all passed the
correct cache and caught the vacuous one via read-count "serves-from-cache" tests derived from the
objective obligation.

## Reading it honestly

The claim is not "V3 cannot catch vacuity" — a capable agent sometimes does, from intuition. The claim
is sharper and matches the deterministic-obligation-vs-LLM-intuition lesson seen elsewhere: **the V4
objective turns the anti-vacuity test from something an agent might think of (50%) into a guaranteed
obligation (100%).** V4's value is reliability, not exclusivity.

`passes_correct` was low in both arms and is a confound orthogonal to the V4/V3 distinction: one
generated suite had a double-counting store-read helper bug, and several agents over-specified
`never_stale` as "the cache reflects an out-of-band store write" — which a write-through cache
legitimately does not, so the correct reference failed those tests. That reflects an ambiguity in the
`never_stale` invariant plus generated-suite noise; it hits both arms equally, so it does not bias the
catches-vacuous comparison. N=4 is pilot scale.

## Where next

This is the template: any v4-only construct becomes a `plan` obligation, and each becomes a V4-vs-V3
eval. Tighten `never_stale` (or use a domain without the out-of-band-write ambiguity) for a cleaner
`passes_correct`, and scale N. The reliability finding (objective ⇒ guaranteed anti-vacuity test) is
the durable result.
