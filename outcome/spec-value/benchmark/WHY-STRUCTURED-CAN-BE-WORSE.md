# Why a structured spec can produce worse code than prose — and why that is not prose winning

The worry: on the finished-artefact code benchmark, prose ties or beats v3/v4, and sometimes structured is
clearly worse. If Allium can ever be worse than prose, why use it? This is the honest diagnosis. Every case
where structured scored below prose is one of three mechanisms, and each is the spec paying an *abstraction
tax* for checkability it is not using on that task — never prose communicating intent better.

## The three mechanisms (measured)

1. **Verbosity / port fragility.** isin: v4/sonnet 58.7 (2 of 3 runs scored 8/21); iban and bech32:
   v4/sonnet prompt-too-long. A rich structured spec is longer and more formal than the equivalent prose,
   and a mid-tier model reconstructing code from it either mis-transcribes the notation or overflows context.
   **This one should never happen.** A structured spec that carries the same obligations as a prose spec
   must not be longer or harder to read. When it is, it is a distillation defect (backlog #4), not a
   language limit. Fix: distil tighter; the structured spec must be at least as compact as the prose.

2. **Procedural / numerical loss.** fineract-amortization: prose 100, v3 97, v4 86 — monotonic in
   abstraction. `TvmFunctions.rate` is a numerical solver; its golden behaviour *is* the algorithm (exact
   convergence, last-digit rounding). Prose transcribes an algorithm in near-pseudocode; Allium abstracts to
   what-must-be-true ("rate solves the PV equation"), which any correct solver satisfies, so the
   reconstructor rebuilds a mathematically-correct but numerically-different solver that misses the
   precision cases. **This is a domain boundary, not a defect.** Allium is a behavioural spec language;
   a numerical recipe is the worst case for it — nothing to abstract but the answer. The fix is not to make
   Allium transcribe algorithms; it is to not use a behavioural spec where the behaviour *is* an algorithm.
   Keep such a recipe as a reference procedure, spec the rules *around* it.

3. **Over-specification → false alarms.** loop-guard precision (N=10): prose 80, v3 50, v4 40. A structured
   *gate* over-constrained and rejected valid code more often than the looser prose did. A gate-precision
   issue: the structured obligation said more than the property required, so correct variants tripped it.
   Partly fixable by stating the obligation at the right strength; partly the honest cost of a precise gate.

## The reconciliation with "never worse than prose"

Structured falls below prose exactly on tasks where the spec pays for checkability it cannot use:

- A pure-transcription task (an algorithm, a long flat convention list) has *nothing for a checker to
  prove that prose could not also state*. So the abstraction only loses fidelity or adds verbosity, and
  prose — a faithful transcription — wins. The tax is paid; nothing is bought.
- A task with a load-bearing invariant, a vacuity risk, or a safety property is where the tax buys a
  deterministic, machine-checkable gate that prose cannot provide at all. There, structured's cost is
  recovered many times over (see the durability-gate and report-balance-gate results: `analyse` 100/100
  deterministic; prose has no gate).

So "structured worse than prose" is a reliable *signal that you are using a checkable spec on a task whose
value is pure elicitation* — the tasks where Allium's advantage is smallest anyway. It is not evidence that
prose is a better carrier of intent. The mitigations are concrete: tighten distillation (kills mechanism 1),
respect the behavioural/algorithmic boundary (mechanism 2), state gate obligations at the right strength
(mechanism 3). With those, a structured spec should never be worse than the prose that carries the same
obligations, because it *is* that prose plus a machine-checkable skeleton.

## The deeper point — our prose arm is idealised

The benchmark hands the prose arm a *complete* spec, hand-authored to carry every bespoke obligation. Real
prose is not written that way, because prose has no checker to tell an author what they left out. The machine
assistance that drives a spec to completeness needs a command-line checker, and a checker needs structured
syntax. So the realistic comparison is not finished-prose vs finished-structured (a tie); it is *unaided
partial prose* vs *checker-completed structured*. We already have direct evidence of this authoring
asymmetry: the elicit skill surfaced 9/10 underspecified decisions from a structured spec versus ~5 from
prose (prose ≈ no-spec). Our code benchmark measured artefact→code with both artefacts pre-completed, so it
*under-counts* structured's authoring value (reaching completeness) and *over-counts* prose's (we did the
completing by hand). The next experiment tests this directly: author each arm's spec the way that arm is
really produced — prose in one unaided pass, structured through its normal distil+check loop — and measure
the code from each. Prediction: realistic prose ships the gaps its lack of a checker leaves; checker-driven
structured does not.
