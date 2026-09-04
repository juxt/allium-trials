# acct-fee (feature-addition) — SATURATED, needs hardening

Add a `fee(amount)` to an existing Account; authentic gotcha = the classic overdraft bug (a fee that
skips the balance check). Hidden oracle: fee charges + fee never overdraws + withdraw still guarded.

## Result (N=4 per arm)

| arm | coverage | overdraw rate |
|---|---|---|
| prose | 100% | 0% |
| V3 | 100% | 0% |
| V4 | 100% | 0% |

Saturated. Every agent — prose included — guarded the fee. Two reasons: overdraft protection is an
instinctive pattern for a strong model, and the base code shows `withdraw` with the exact balance-guard
right where `fee` is added, so the model mirrors it. V4's `analyse` does flag the unguarded fee
deterministically (verified), but the bug never occurs, so the check adds no value here.

## The finding (bank it)

The non-obviousness law applies to REGRESSIONS too: a feature-addition task discriminates V3<V4 only when
the regression is one a careful model genuinely misses. An obvious regression self-corrects in all arms.
So the design's non-obviousness rule must be read as: the *gotcha* (a new obligation, or a broken existing
one) must be non-obvious. This task's gotcha is not.

## Hardening directions (for a v2)

Make the broken invariant NON-LOCAL or domain-specific, so a model coding the feature locally misses it,
while V4's `analyse` (which holds the invariant) still flags it:
- a conservation invariant the feature breaks (set one field, forget its counterpart: `available + reserved
  = total`; `total = sum(entries)`);
- a domain rule not visible in the local base code (a minimum reserve, a capacity ceiling with no existing
  action that telegraphs the cap);
- a bespoke-store base (sorted/metric store) whose internal constraint the feature naively violates.
The base code must not demonstrate the guard pattern the feature needs, or it is trivially mirrored.
