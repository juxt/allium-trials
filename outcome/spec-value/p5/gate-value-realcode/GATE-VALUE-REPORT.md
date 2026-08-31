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
that had been open on corpus grounds alone. **(Resolved in the follow-up below: `^` was added and closes it.)**

**The absolute invariant false-alarms at large balances.** Six of the 150 baseline schedules trip the full
spec, all of them the roughly one-million balance. An absolute tolerance of a penny cannot hold interest
equals rate times balance when the balance is that large and the rate factor is carried to six places. This
is a genuine cost of the arithmetic tier: the tolerance needs to scale with the operands, and until it
does, the value invariant trades a value blind spot for a false-alarm rate at scale. **(Reclassified in
the follow-up below: this is a trace-precision artifact, not a tolerance defect; proportional tolerance
was tried and rejected, and emitting the rate factor at full precision clears all six.)**

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

## Follow-up: closing the two honest limits, and stress-testing the finding

After the first pass, three further experiments (all on the same 150 real schedules).

**The power operator closes the emi-value hole.** The gap above, a wrong instalment slips through, is a
missing-operator gap: pinning the emi needs the annuity formula with a power term. Added `^` to v4
(right-associative, tighter than `*`; runtime-only, since it is nonlinear). The closed-form annuity
`disbursed * f * (1+f)^months / ((1+f)^months - 1)` matches Fineract's instalment on all 100 nonzero-rate
multi-period schedules within the rounding unit, so the law is faithful. As a gate, the wrong-instalment
bug goes from 6/120 caught (all scale artifacts) to **101/120**, the 19 misses being single-period loans
where the mutation is a no-op and the annuity law correctly does not constrain the sole final period. So
on every applicable schedule the power operator catches the bug that previously escaped. Found the gap,
added the operator, verified it closes on real code. (`annuity_gate.py`, test `power_operator_annuity`.)

**The scale false-alarm was a trace-precision artifact, not a tolerance defect.** The six false alarms
were driven by emitting `rate_factor` at six decimals: the rounding error times a ~1e6 balance exceeds a
penny. Two results. First, a proportional tolerance does NOT fix it, and made things worse (it did not
clear the false alarms, because the error scales with the balance not with the interest being compared,
and it loosened the structural checks from 150 to 145). Honest negative result, reverted. Second, emitting
`rate_factor` at ten decimals clears all six with every catch preserved: baseline 0/150 on both specs,
value bug still 0/120 structural and 120/120 full. The fix is trace-adapter guidance, emit derived
reference inputs at full precision, now in the language reference.

**The core finding is robust across bug morphologies.** A five-mutation battery (`consistency.py`)
confirms the pattern is not an artifact of the one wrong-rate mutation:

```
mutation          kind                  structural    full
wrong_rate        value/preserving         0/120     120/120
wrong_daycount    value/preserving         0/120     112/120
interest_only     value/breaking         116/120     120/120
shift_principal   structural/breaking    150/150     150/150
drop_middle_leg   structural/breaking    100/150     102/150
```

Every structure-preserving value bug is invisible to the structural spec and caught by the arithmetic
tier; every structure-breaking bug is caught by both. The desync law holds across the battery.

## Reproduce

```
python3 gate.py       # the 150-schedule structural-vs-full gate matrix
python3 emi_gap.py     # the wrong-instalment witness that slips through
```

Artifacts: `structural.allium`, `full.allium`, `distilled_v4_from_code.allium` (the agent's one-round
distil of the real calculator), `result.json`.

## Cross-invariant-class check: double-entry balance

To test that the gate-value finding is not specific to loan-schedule arithmetic, the same machinery was
applied to a different invariant class: double-entry balance, a cross-domain accounting law (sum of debit
legs equals sum of credit legs per transaction), which the earlier ORACLE-REPORT confirmed real Fineract
satisfies on 12/12 processor fixtures via a hand-written JUnit oracle, and which is NOT enforced on the
loan posting path. Expressed in Allium as `(sum p :: debit(p)) = (sum p :: credit(p))` over one
transaction's legs (`doubleentry.allium`). On Fineract-shaped legs (principal + interest + fee credits and
a single fund-source debit, matching the documented posting structure): the balanced transaction holds;
the exact negative control from ORACLE-REPORT (one credit leg inflated by 1.00) fires; a dropped leg fires.
So the Allium gate reproduces the hand-written oracle's behaviour on this invariant, consistent with the
spec-versus-test result (the gate ties a correct oracle) now on real Fineract's own double-entry law.
Honest bound: this uses Fineract-shaped legs and the documented negative control, not a fresh Gradle dump;
the real-balance-on-real-legs half was established separately by the JUnit oracle in ORACLE-REPORT.

**Upgraded to real dumped legs.** The DoubleEntryLegDumper had already been run and its output is in
`scale-test/je-traces/` (format `period=<row> account=<name> debit=<amt> credit=<amt>`, exactly what the
spec expects): the baseline processor plus four blind-edited versions (t3, t4, t5, t8), 15 transactions
each. Gating these genuinely-dumped legs with the Allium double-entry spec: the baseline balances 15/15,
and every one of the four edited processors balances 15/15 too, 75 real checks in total. That reproduces
the JUnit oracle's verdict exactly, including the important case: the gate correctly HOLDS on t3, which was
the oracle's earlier false positive, confirming t3 does not break balance. A negative control on a real
dumped transaction (one credit leg inflated by 1.00) fires while the original holds. So on a second
invariant class, on real processor output, the Allium sum-invariant gate reproduces the hand-written
oracle, and independently confirms the scale-test saturation: the blind edits preserved double-entry, so
there was nothing real to catch, but the gate demonstrably catches an imbalance when one exists.

## Distillation closes too: with `^`, the distiller pins the instalment

Re-running the distillation of the real calculator with `^` available, a fresh agent captured 8 of 8
invariants including the emi VALUE, `emi = round(disbursed*f*(1+f)^months/((1+f)^months-1), 2)`, pinned to
inputs, clean in one round (`distilled_v4_with_power.allium`). So the operator pays off from both
directions: the distiller can now state the instalment law it previously had to park, and the monitor
catches a wrong instalment. Honest residual gaps the agent flagged, consistent with the gate side: the
annuity is nonlinear so `analyse` checks it only at runtime not statically; the final-period instalment is
a distinct rounding-absorption value the closed form does not cover; and day-count / mid-term events stay
out of frame.

## Bottom line (updated after the follow-ups)

Where the language adds value as a gate, stated with the follow-ups folded in: the arithmetic tier
(including `^`) catches value drift against input-anchored invariants that a structural spec, a structural
property test, or the model's own edits all miss. On real Fineract this is 0/120 to 120/120 on a
consistent-value bug, and with `^` it now extends to the instalment value itself (the one class that had
escaped), pinned by a faithful annuity law and caught when wrong. The pattern is robust across five bug
morphologies and reproduces on a second invariant class (double-entry). Two of the earlier limits are
resolved: the emi hole by `^`, the scale false-alarm as a trace-precision artifact (not a tolerance
defect; proportional tolerance was rejected). The standing bounds are real and unchanged: it is a runtime
gate so it needs traces; the nonlinear laws are checked against reality, not proved statically; and the
value concentrates on the non-textbook, institution-specific behaviour a competent model would otherwise
get wrong, because that is the drift that actually occurs.

## Detection floor: the gate is penny-sensitive, not infinitely sensitive

A sensitivity sweep (wrong-rate bug at shrinking magnitudes, 100 nonzero-rate multi-period real schedules,
rate_factor emitted at full precision) maps where the gate stops catching:

```
wrong rate  +10%   caught 100/100
wrong rate  +2%    caught  97/100
wrong rate  +0.5%  caught  89/100
wrong rate  +0.1%  caught  68/100
```

Detection degrades gracefully as the monetary impact of the error shrinks toward the 2-decimal rounding
unit: a 0.1% rate error often moves the interest by less than a penny on smaller balances, so it falls
under tolerance and is invisible. This is an honest floor, and it is not a language limitation: it is the
money-rounding unit, and any penny-tolerant mechanism, including a hand-written test asserting values to
2dp, shares it. The gate catches value drift down to about the level at which the drift is financially
visible, which is the level that matters.
