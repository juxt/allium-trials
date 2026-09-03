# Library specs — validating the hypothesis

The vision: a versioned piece of software ships a spec that its consumers reference in their own specs,
so the tool can check that client code meets the needs of the library it depends on. Library specs
become dependencies of the application spec, just as libraries are dependencies of the code, and they
would be hosted somewhere like a package manager and pulled in when needed.

This directory validates one concrete instance of the hypothesis through the harness: **referencing a
library spec catches a real client-library mismatch that a client written without it would miss.**

## The specimen

`kafka_at_least_once.allium` is a library spec for one facet of Kafka a consumer builds on: delivery is
at-least-once, so a duplicate of any event may arrive. The obligation that places on a consumer is stated
as the contract's promise: anything a consumer `applied` must have been `deduped` first.

```
contract KafkaAtLeastOnce
  guarantee apply_needs_dedup means applied(e) implies deduped(e)
```

Two consumers reference it:

- `consumer_safe.allium` — the Achronic Warden shape. It dedups before applying (`apply requires
  deduped`), so its invariant holds and is preserved. It **SATISFIES** the contract.
- `consumer_naive.allium` — applies events with no dedup, silently assuming exactly-once delivery. It
  does **NOT satisfy** the contract: the promise `apply_needs_dedup` is not entailed by its invariants.

`verify.py` runs both against the library spec and asserts the verdicts. `ALLIUM=<allium> python3
verify.py`.

## The result

```
consumer_safe.allium   vs kafka_at_least_once.allium   -> SATISFIES
consumer_naive.allium  vs kafka_at_least_once.allium   -> does NOT satisfy
```

The naive consumer is the bug the vision is about: a client that would double-process under at-least-once
delivery. It is caught the moment the client references the library spec, and not before.

## The before/after — where the value is

`consumer_unaware.allium` is the same naive behaviour written by someone who never considered at-least-once
delivery: it applies events, references no library spec, states no obligation. Analysed on its own it is
**clean** — nothing in its own text is violated, so the tool has nothing to flag. The double-processing bug
is invisible.

```
consumer_unaware.allium  (no library spec)          -> 0 mismatches   (bug invisible)
consumer_naive.allium    (references KafkaAtLeastOnce) -> REFUSED       (bug caught)
```

That contrast is the hypothesis: the flaw is latent in the client and only becomes visible once the client
is checked against the library it depends on. The library spec carries the knowledge — "delivery is
at-least-once, so you must dedup" — that the client's author did not have.

## What this exercises, and one gap

This is the compositional side of assume-guarantee that the design pass (DECISIONS 2026-09-02, Decision 2)
deferred: a library provides a promise its consumers must honour. The satisfaction check that proves a
consumer meets an imported contract is the mechanism, and it works when the library spec and the client
are both in scope.

One piece the package-manager flow still needs: the `use "kafka_at_least_once.allium"` **directive** does
not yet resolve the imported contract into the satisfaction pass on its own — single-file `allium check` /
`analyse` reports the contract as undeclared, and the check only runs when both files are passed together.
Wiring the `use` directive through to the satisfaction pass is the next step toward referencing a hosted
library spec by name (task filed).

## A second, independent instance — Fineract's database

To show the result is not Kafka-specific, `fineract_loan_store.allium` is a second library spec for a
different dependency: the relational store behind Fineract loan accounts. It carries two obligations, one
boolean and one arithmetic, so a client can fail on either:

```
contract LoanAccountStore
  guarantee commit_checks_version  means committed(p) implies version_checked(p)
  guarantee balance_non_negative   means committed(p) implies balance_after(p) >= 0
```

- `fineract_service_safe.allium` — checks the version and guards the balance before committing. It
  **SATISFIES** both promises, and its guarded `post` action genuinely **preserves** the arithmetic bound
  (not merely restates it), so the guarantee holds in every reachable state.
- `fineract_service_lostupdate.allium` — commits without a version check. Refused on `commit_checks_version`
  (a lost update under concurrency).
- `fineract_service_overdraw.allium` — commits without guarding the balance. Refused on
  `balance_non_negative` (an overdraw the store's CHECK constraint would reject at runtime).

Each client is refused on exactly the obligation it breaks. Two independent dependencies (a message broker
and a database), three classes of client-library mismatch (double-processing, lost updates, overdraw),
caught by one mechanism spanning boolean and arithmetic reasoning. `verify.py` asserts all five verdicts.

## Where next

- **The other direction of the contract.** Here each library places an obligation on the consumer. The
  dual is the consumer *relying* on a library guarantee (Kafka's offset ordering), expressed with the rely
  role built in Decision 2. A richer specimen would show both directions across one dependency edge — and
  it needs the compositional discharge (a library guarantee discharging a consumer rely), the piece
  Decision 2 deferred.
- **Referencing by name.** Closing #79 (the `use`-resolution decision) turns "hand the checker both files"
  into "reference a dependency and it is pulled in" — the package-manager flow.
