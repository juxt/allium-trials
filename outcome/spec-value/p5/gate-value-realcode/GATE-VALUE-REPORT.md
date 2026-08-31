# Where the language adds value as a gate: the evidence, on real Apache Fineract

The brief was to establish a coherent, honest picture of where the Allium language, as distinct from the
skill wrapper and the act of specifying, earns its keep as a gate. Everything here runs against real
Apache Fineract, not a synthetic oracle: the source is the unmodified `ProgressiveEMICalculator`, and the
traces are 150 real schedules driven out of Fineract's own calculator over a grid of amounts, rates and
terms. No result rests on a model judge.

## What was run

1. Re-distil the real calculator into a v4 spec, using the current arithmetic-capable v4, and measure how
   many of the seven load-bearing invariants it can now express.
2. Test whether the key absolute value invariant, interest equals rate times balance, is faithful to the
   real code, taking the rate independently from the input rather than from the emitted interest.
3. Gate 150 real schedules with a structural-only spec and with the full spec, against a
   structure-preserving value bug and a structural bug, and measure what each catches.
4. Probe the boundary: find a real behaviour the full spec cannot catch.

## The strong claims, with evidence

**The language now expresses the load-bearing behaviour of real financial code.** The earlier v4 distil of
this exact calculator captured three of seven invariants and parked the four arithmetic ones as open,
because v4 had no arithmetic. Re-run with the arithmetic tier added this programme, a fresh agent distilled
all seven, including interest-on-outstanding, the principal split, the balance roll-forward and
conservation, and it checked clean in one round. The stale gap is closed: on real arithmetic-heavy loan
logic, v4 can now say what the reference requires.

**Those invariants are exact laws of the real code.** Reconstructing the monthly rate factor from the input
rate, independent of the emitted interest, the invariant interest equals rate times outstanding balance
holds on all 1200 period-checks across the 150 real schedules, worst residual 0.005, which is half a penny,
the rounding unit. This is the one invariant the earlier value work could not check because the traces
omitted the rate factor. Checked now, it holds exactly. The spec is faithful to Fineract, to the penny.

**The arithmetic tier is precisely what turns the gate from value-blind to value-catching.** Gating the 150
real schedules:

```
scenario                                  structural spec    full spec
baseline: false alarms (want 0)                0/150            6/150
value bug (wrong rate, structure-preserving)   0/120          120/120
structural bug (broken conservation)         150/150          150/150
```

The value bug is a schedule recomputed at the wrong interest rate. It is fully self-consistent, so every
structural invariant holds, and the structural-only gate catches none of the 120 cases. The full spec
catches all 120, every one through `interest_on_outstanding`. Both specs catch the structural bug on all
150. This is the desync law confirmed on real code: a relations-only spec is a bystander for a
consistent-value bug, and the single absolute invariant is what closes the blind spot. It is the clearest
demonstration in the programme that a specific language capability, not the wrapper, adds gate coverage.

## Where the claims fall apart, or cost something

**The full spec cannot pin the instalment value. Confirmed, with a witness.** A wrong emi slips straight
through. If the instalment is set five pounds too high on every period and the final period quietly absorbs
the difference, conservation still holds, the loan still closes to zero, the instalments are still constant,
the principal split still holds, and interest is still tied to the rate. Every invariant passes. A customer
overcharged on every instalment would not be caught. Pinning the instalment needs the annuity formula,
which has a power term, and v4 has no power operator, so the emi value is taken as observed rather than
derived. This is a real hole, not a modelling slip, and it is the concrete motivation for the `^` question
that had been open on corpus grounds alone.

**The absolute invariant false-alarms at large balances.** Six of the 150 baseline schedules trip the full
spec, all of them the roughly one-million balance. An absolute tolerance of a penny cannot hold interest
equals rate times balance when the balance is that large and the rate factor is carried to six places. This
is a genuine cost of the arithmetic tier: the tolerance needs to scale with the operands, and until it
does, the value invariant trades a value blind spot for a false-alarm rate at scale.

**The arithmetic gate is a runtime gate, not a static proof.** The two multiplicative invariants are
nonlinear, variable times variable, so they sit outside the decidable fragment that `analyse` checks
statically. `analyse` reports them not-checked and returns a partial verdict. The monitor evaluates them at
runtime against traces, which means this value hinges entirely on having traces, and inherits every limit
of the trace-availability question. There is no static guarantee here, only a checked-against-reality one.

**And the bugs have to actually happen.** The gate catches the value bug we injected. The earlier scale
test, eight blind agents editing real Fineract under feature tickets, found that a competent model does not
introduce these breaks on textbook behaviour: it preserved double-entry and the schedule laws on every
edit. So the gate catches value drift that occurs, and on well-known algorithms it largely does not occur.
The regeneration result points the same way from the other side: a spec is redundant with the model's prior
for the textbook schedule, and becomes non-redundant only for institution-specific behaviour the model
cannot infer, the exact rounding policy, the local conventions, the in-life operations.

## The coherent picture

The language earns its keep as a gate in one specific way, and the evidence now draws the boundary sharply.
It adds real, demonstrated value by catching value drift that a structural spec, a property test of
structure, or the model's own edits will miss: on real Fineract, the single absolute invariant took the
gate from zero of 120 to 120 of 120 on a consistent-value bug. That capability is the arithmetic tier, a
language feature, and it is not something the wrapper or a prose spec provides.

The same evidence bounds it. The gate is runtime, so it needs traces. Its absolute invariants false-alarm
at scale until the tolerance is made proportional. It cannot yet pin an instalment or any value that needs
the annuity formula, because the language has no power operator, so a whole class of value bug, a wrong
instalment amount, passes untouched. And the drift it catches has to be drift that a competent model
actually ships, which on textbook behaviour it does not, so the value concentrates on the
institution-specific behaviour where the model's prior runs out.

So the honest one-line answer to where the language adds value as a gate: it is the arithmetic tier
catching value drift against input-anchored invariants, on real code, at runtime, for the non-textbook
behaviour that a model would otherwise get wrong, and it is bounded by trace availability, a scale-tolerance
gap, and one missing operator that leaves the instalment value itself outside the gate.

## Reproduce

```
python3 gate.py       # the 150-schedule structural-vs-full gate matrix
python3 emi_gap.py     # the wrong-instalment witness that slips through
```

Artifacts: `structural.allium`, `full.allium`, `distilled_v4_from_code.allium` (the agent's one-round
distil of the real calculator), `result.json`.
