# Inductive-invariant checker: validation on a realistic payment lifecycle

The preservation/induction capability was built and unit-tested on minimal specimens. This validates it on
a realistic state machine — a payment lifecycle with four guarded actions (authorize, capture, refund,
void) and four interacting safety invariants — the kind of spec a real integration would carry. All via
`allium analyse`, no model judge.

## The correct spec is certified fully inductive

`payment_correct.allium`: the four invariants are

- `capture_needs_auth`: `captured(p) implies authorized(p)`
- `refund_needs_capture`: `refunded(p) implies captured(p)`
- `no_capture_after_void`: `voided(p) implies not captured(p)`
- `void_needs_auth`: `voided(p) implies authorized(p)`

`allium analyse` reports all four **INDUCTIVE** — each established by `init` and preserved by every one of
the four actions, so each holds in every reachable state. No breaks, no init-violations. This is a real
inductive safety proof over the whole transition system, not a trace check: it needs no execution and holds
for all reachable states, unboundedly.

Note this exercises the conjunction-strengthening: `no_capture_after_void` is only inductive because the
other guards constrain the reachable states; checked in isolation several of these would look breakable.

## Each realistic missing-guard bug is caught, with the fix

Three independent guard omissions, the kind a developer actually ships:

| bug (a dropped guard)                          | caught? | invariant named            | suggested fix                    |
|------------------------------------------------|---------|----------------------------|----------------------------------|
| `capture` without `not voided` (capture a voided payment) | yes | `no_capture_after_void` | `requires not voided(e)` |
| `void` without `not captured` (void a captured payment)   | yes | `no_capture_after_void` | `requires not captured(e)` |
| `capture` without `authorized` (capture with no auth)     | yes | `capture_needs_auth`    | `requires authorized(e)` |

Each diagnostic names the action, the invariant it breaks, a concrete witness pre-state, and the weakest
guard that fixes it, e.g.:

```
action `capture` in `PaymentLifecycle` can break invariant `capture_needs_auth`: from a state satisfying
it (e.g. authorized(e)=F, captured(e)=F, refunded(e)=F, voided(e)=F), the action reaches a state that
violates it. To fix, guard it: `requires authorized(e)`.
```

## Why this matters

This is the "bug with no trace" class: every one of these bugs is invisible to runtime monitoring, because
a normal execution takes the happy path and never exhibits the violating transition. It is caught only by
reasoning over the transition relation, which is exactly what the field's model checkers (TLA+, Ivy, Alloy)
do and what Allium's `analyse` now does — soundly, in the boolean fragment, with a single-binary
no-external-solver implementation. On a realistic four-action machine it proves the correct spec safe and
pinpoints each design bug with an actionable fix.

## Reproduce

```
allium analyse payment_correct.allium              # 4 invariants INDUCTIVE
allium analyse payment_bug_capture_voided.allium   # breaks no_capture_after_void
allium analyse payment_bug_void_captured.allium    # breaks no_capture_after_void
allium analyse payment_bug_capture_noauth.allium   # breaks capture_needs_auth
```
