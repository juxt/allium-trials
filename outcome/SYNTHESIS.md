# Allium v4 as an assurance layer — what the trials found and what was built

## What we set out to test, and what happened

The plan was to show that Allium v4's checker makes a strong model's work more correct:
that the analyser catches design and integration mistakes a capable model would otherwise
ship. Six independent trials tested it. On a money ledger the model built, comprehended,
and re-implemented the system at ceiling. On a message-queue integration it got idempotency
right every time. On a case-split drawn verbatim from the CPMI-IOSCO UTI table it produced
a correct, faithful partition; the one apparent exception dissolved once the task was given a
data dictionary. On a trade-repository integration it spotted an emergent two-rule
infeasibility, and then a genuine multi-hop forward chain, without a miss.

The finding is consistent and worth stating plainly: a strong model, on a well-specified
task, essentially never ships a correctness error that the checker then catches. Catch-rate
against the model saturates.

That is a fact about frontier models, not a failure of the language. And it exposed that we
were measuring the wrong thing. A sound checker was never meant to be smarter than a careful
expert. Nobody runs a type checker because it out-thinks the programmer. The value is the
guarantee: a machine-checked, reproducible verdict with an auditable artifact, that holds
regardless of whether the reviewer was sharp that day. For a bank answering to a regulator,
"a capable model reviewed it" is not a control. "Here is a machine-checked, reproducible
proof, re-verified on every build" is.

## The value that survives: assurance, and one spec across the lifecycle

So the eval was refounded on what a checker uniquely provides, and the tooling was built to
make it concrete. Four sound, dependency-free capabilities now ship in the v4 analyser, all
capped by nothing heavier than a pure-Rust SAT engine (Tseitin + DPLL), so the single static
binary is preserved:

- **Case-split coverage** — sound disjointness and exhaustiveness over guarded actions, with
  the clashing actions named.
- **Rule-set consistency** — joint satisfiability of a component's invariants and axioms,
  with a minimal conflicting core on contradiction.
- **Scenario feasibility** — each declared report shape checked against a fixed contract,
  with a minimal blocking-rule core when a shape can never be accepted.
- **Runtime monitor** — the same `invariant` items evaluated over an execution trace: point
  safety, past-temporal monotonicity via `old(...)`, and relational properties (uniqueness,
  referential integrity) quantified over the entity population, each with a focused witness.

The monitor is honest by construction: an invariant it cannot faithfully evaluate is skipped
with a reason and counted, so a green result is never a hidden gap. This is the property the
whole assurance claim rests on.

## The mission, demonstrated mechanically

`capstone-monitor/` and `systems/reporting/` show one artifact serving the whole lifecycle.
A single spec is verified at design time (feasibility flags a report shape that can never be
accepted; consistency confirms the rules cohere), is the contract a real Python build
satisfies, and is compiled into the runtime monitor that watches the build's own output. The
tie is clean: the bespoke-collateral report the design-time check rejects is the same one the
monitor catches in production. One property, both stages, no drift, because there is one
place the property lives.

Two artifacts make the assurance value tangible. The **register** consolidates the
design-time and runtime verdicts into an auditor-facing record, each property tagged with its
strength of green — proved, bounded, or monitored; closed or assumed — and its evidence. The
**regression matrix** replays a development history and runs the full gate on every commit:
every regression is caught at the commit it lands and clears when fixed, deterministically,
in milliseconds, with provenance. That is the real shape of the value. Not one clever pass,
but every property on every commit, cheap enough to always run, which a model review cannot
match on cost or determinism and need not on catch-rate.

## What this does and does not claim

It does not claim to make a strong model's output more correct on well-scoped tasks; the
evidence is against that. It claims that the same specification, once written, gives a sound
and reproducible guarantee across design, build, and production, with an artifact an auditor
can accept. In a regulated setting that guarantee is the product, not a convenience.

Two questions remain open and honest. First, whether a correctness-catching regime exists at
all is untested above the bounded fragment — dozens of interacting rules, deep quantified
state, temporal properties — where reading plausibly degrades and the earlier differential
work already showed the language winning on its diagnostic contract. Second, the monitor's
relational and temporal fragments are deliberately narrow; extending them is future work, and
the honesty discipline is what keeps that extension safe to make.
