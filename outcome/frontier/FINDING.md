# The frontier experiment settles a question about where Allium's value is

## What we tested

Hard random 3-SAT at the phase-transition ratio (~4.3 clauses/variable), the canonical
regime where combinatorial reasoning breaks. Framed as a rulebook: satisfy every rule or
prove it impossible. Oracle: `allium analyse` (sound). Three conditions on the same
instances.

## What happened

- **LLM in-head (no tools).** Fails. On one N=25 instance it reasoned for the full 7-minute
  timeout and produced no answer. Across N=15/25/35 the unaided accuracy was 13% / 0% / 0%.
  A frontier model genuinely cannot solve hard 3-SAT by pure reasoning.
- **LLM + general tools (Bash).** Succeeds easily. Given a shell, the model wrote its own
  solver and returned a valid satisfying assignment in 33 seconds.
- **LLM + Allium v4.** Would also succeed (the model encodes and runs `allium analyse`).

## The conclusion this forces

The unaided model is not the realistic baseline; the realistic baseline is the model *as
deployed*, with general tools. And that baseline self-provisions the exact capability a
checker provides — it writes a solver, and it could just as well invoke Z3. So **no CLI
uniquely enables an agent to solve harder problems.** The enabling capability is general
tool use, which the model already has. Any benchmark framed as "does the tool let the model
solve what it can't" will therefore saturate against the general-tools baseline, not just
against raw reasoning. This is why every solving-framed trial has saturated.

## Where Allium's value actually is — and it is real

The value is precisely the part the model *cannot* substitute with ad-hoc code:

- **A trusted, standardised verification artifact.** A regulator or auditor cannot accept
  "our LLM wrote a script that said it is compliant." They can accept the verdict of a
  vetted tool, with a witness or a minimal core, reproducible on every build. The model's
  one-off solver is unverified and unaccountable; Allium's verdict is an artifact of record.
- **Soundness by construction.** v4's checks are sound (SAT-based); an ad-hoc solver the
  model writes under time pressure may be subtly wrong, and nothing flags it. The trust is
  the product.
- **One spec across the lifecycle.** The same artifact drives design-time verification, the
  build, and the runtime monitor. Ad-hoc scripts do not compose into a lifecycle artifact
  with provenance.

## What this means for the benchmark and for v4 vs v3

Stop benchmarking solving-power; the general-tools baseline saturates it. Benchmark the
assurance properties, where the model's ad-hoc alternative is *untrusted* rather than
*absent*: soundness (does the verdict ever lie), reproducibility, the audit artifact, and
composition. The v3-vs-v4 differential already lives here and is decisive and model-free:
v4 is sound where v3 is heuristic, and covers consistency, feasibility, coverage and runtime
monitoring that v3 has no mechanism for. That is the shape of "v4 is the better assurance
layer", which is the claim the evidence actually supports.
