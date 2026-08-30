# Programme 2 — is the spec the RIGHT spec? overconfidence, completeness, and specs-as-tests

Budget: 4h. START_EPOCH 1788089451, END_EPOCH 1788112800 (19:00, extended). Autonomous; reconvene at the end
with a revised, defensible value proposition.

## Why this programme
Programme 1 left two cracks that undermine the core value:
- **Rank 3 (certifiable checking) is only as good as the spec.** Certifying a wrong/incomplete spec is
  worthless. If an LLM drafts the spec from human guidance, disagreement and omission creep in. We need
  to build user CONFIDENCE that the spec is right, complete, salient, and explainable back to them.
- **Rank 4 (overconfidence / tunnel vision) can INCREASE bugs.** A spec that narrows attention makes a
  reviewer dismiss real out-of-scope issues. If specs raise bug risk in some cases, that attacks the
  whole proposition. Same root as the completeness problem: an incomplete spec, over-trusted.
- **New pillar untested: specs -> better TESTS (PBT).** Executable property tests over real code are an
  INDEPENDENT confidence source (not model-judging-itself, not the decidable-fragment limit of analyse).
  The spec supplies the properties (oracle); the type/dimension layer supplies generators.

Unifying tool: **mutation testing as an objective, non-saturable oracle.** A mutant is a behaviour-
changing code edit I control. It grounds BOTH completeness ("does the spec detect this change?") and
test quality ("does the spec-derived test kill this mutant?") without a model judge.

## Phased plan with decision gates

### Phase 1 — Overconfidence: fixable by framing? [cheap, first, ~30-45m]
Re-run the tunnel-vision failure with out-of-scope-bug cases (change is clean w.r.t. the spec but has a
real bug the spec doesn't cover) under three framings: CEILING (spec as a constraint, baseline), FLOOR
(spec is PARTIAL; also independently flag anything it doesn't mention), and NOSPEC (control, known to
catch). Metric: out-of-scope-bug catch rate.
GATE 1: FLOOR ~= NOSPEC -> tunnel vision is a fixable PRESENTATION problem; bake the floor framing into
the skill and re-verify. FLOOR still << NOSPEC -> overconfidence is intrinsic to having a spec in
context; a serious, headline limit. Either way, decisive.

### Phase 2 — Spec completeness & faithfulness via mutation-detection [~60-90m]
Feasibility first: reuse the existing trace infra (drive a real Fineract calculator -> trace -> monitor).
LLM-distill a spec of a subsystem. (a) Faithfulness: do its invariants hold on the baseline (monitor)?
(b) Completeness: seed K behaviour-changing mutants; what fraction does the spec DETECT (an invariant
now fails on the mutant's trace)? Missed mutants = spec gaps. Detection-rate = a reportable completeness
number — the thing that could build user confidence.
GATE 2: high detection -> completeness is measurable and high; report it. Low -> distillation misses
salient behaviour; the confidence problem is real and needs a completeness step (skill change).

### Phase 3 — Specs -> better tests (PBT + mutation kill) [~60-90m]
Spec invariants = properties/oracle; types = generators. Generate property tests, run against the real
calculator over many inputs. Mutation kill-rate: spec-derived PBT vs model-freehand tests vs existing
tests. This is the objective metric and the independent confidence source.
GATE 3: spec-PBT kills mutants freehand tests miss -> specs uniquely improve tests -> new pillar. Else
PBT value is marginal here.

### Phase 4 — Explain-back / round-trip confidence [if time]
Inject a subtle error/omission into a spec; render an explanation; can a human-proxy (given the ground-
truth intent) catch the divergence from the explanation? Tests whether specs can be trusted via review.

### Phase 5 — Synthesis
Revised value proposition; skill/language changes made and verified; what builds user confidence; what
stays uncertain; recommendations.

## Loop protocol (every wake)
1. `date +%s`; if >= END_EPOCH, write `## PROGRAMME 2 SYNTHESIS` to this file and STOP (no reschedule).
2. Collect finished background experiments; READ actual outputs, verify genuineness (the recurring
   traps: sub-agent delegation confound -> disallow Task,Agent; model-judge false verdicts -> spot-read;
   leading the witness; vacuous/incomplete specs). Log to RESEARCH-LOG2.md; update this file's gate status.
3. Advance per the phase plan; honour the gates (reallocate budget on the evidence). Skills/language may
   be edited to realise a benefit, then re-verified.
4. Commit across repos. ScheduleWakeup with the same programme-2 prompt.
Discipline: honest, negatives first-class, verify before claiming, no overclaim from small n, never let
an evaluated agent see answers or peers.

## Gate status (live)
- GATE 1: CLOSED — tunnel vision FIXABLE by partial-floor framing (floor recovers OS1 catch 4/4 vs ceiling 2/4 merge; floor benign-block 11% = discriminates). Skill updated.
- GATE 2: CLOSED — spec correctness confidence BUILDABLE: monitor for faithfulness (over-claims), mutation battery for completeness (LLM 63% vs gold 88%, blind spots pinpointed).
- GATE 3: CLOSED — specs supply RELATIONAL properties over broad inputs (complementary to value oracles, which catch what specs miss e.g. wrong rate). PBT pillar = complementary, not standalone.

---

## PROGRAMME 2 SYNTHESIS (2026-08-30, 18:00)

Four phases on the full Fineract, each verified by reading raw outputs. Along the way: a sub-agent cost
confound, a session-limit contamination, a leaked-intent design flaw, and repeated model-judge false
verdicts were all caught and corrected before they became conclusions.

### The one idea that answers both of your worries
**A checkable spec's defining value is that it can be VALIDATED AGAINST THE CODE, not trusted on
faith.** Confidence comes from validation, not authorship. That single move rescues rank 3 and defuses
rank 4.

### 1. Spec-correctness confidence (rank 3) — BUILDABLE, decisively
- **Faithfulness = monitor the spec against real execution traces.** It caught the LLM spec's
  `level_payment` over-claim (residual 0.04). Phase 4 (informal intent) made this decisive: the
  over-claim is caught ONLY with the monitor report (validated 3/3) and MISSED by review or prose
  explanation (0/3), because the vague human intent ITSELF says "equal instalments" — the spec
  faithfully mirrors the human's wrong mental model, so no amount of reading reveals the divergence.
  The monitor checks the spec against what the code DOES, not what the human THINKS.
- **Completeness = a mutation battery.** LLM-from-informal-guidance spec 63% vs hand-complete 88%;
  blind spots pinpointed (roll-forward link, monotonicity). A reportable completeness number + a named
  blind-spot list — no gold spec required (the battery estimates it; the misses ARE the gaps).
- Both mechanical, need no trust in the LLM, and are uniquely enabled by a checkable spec (a prose spec
  can be neither monitored nor mutation-tested).

### 2. Overconfidence / tunnel vision (rank 4) — FIXABLE
- It is a DECISION failure, not a perception one: under ceiling framing the reviewer NOTICES the
  out-of-scope bug and merges it anyway "as out of scope" (OS1 slipped 2/4).
- Presenting the spec as a PARTIAL FLOOR in the CONSUMER'S PROMPT ("not-violating != safe; flag any
  other risk") recovers blocking (OS1 0/4 merge) without over-blocking benign changes (11% block — it
  discriminates, not timidity).
- Refinement caught by re-verification: a passive spec HEADER is insufficient; the floor instruction
  must live in the consuming agent's prompt. And the completeness blind-spot map from (1) IS the "floor
  is thin here" list — the two mitigations compose.

### 3. PBT (new pillar) — COMPLEMENTARY, not standalone
- Spec invariants are a real property-test oracle: faithful across 150 real schedules, catching
  structural corruption over the whole input space (Phase 2b) that a single-example fixed test misses.
- But they MISS value errors that keep the structure self-consistent: a wrong-rate mutant satisfied
  every structural invariant (spec-oracle 0/150) while the shipped fixed-value test caught it.
- So the strongest suite = spec invariants (relational, broad coverage) + a reference/golden oracle
  (absolute) + model-checking = three independent confidence sources, each covering the others' gaps.

### Skill / language changes (made and verified)
- `skills-v4/distill/SKILL.md`: new loop step "Validate against runtime" (monitor faithfulness +
  mutation completeness, report detection rate + blind spots); "partial floor, not a ceiling" section
  with a verbatim header; updated Done criteria.
- `skills-v4/allium/references/language-reference-v4.md`: "Consuming a spec" principle — the floor
  instruction must be in the consumer's prompt; a passive header is insufficient.

### The honed value proposition (Programmes 1 + 2 together)
Accuracy saturates everywhere, even at ~1M LOC — the spec's value is NOT catching more bugs. It is:
(a) SURFACING the human's decisions [the act of specifying; Prog-1 rank 1];
(b) a VALIDATABLE artefact whose own faithfulness and completeness are MEASURABLE against the code
    [Prog-2; the rank-3 rescue and the sharpest new finding];
(c) a deterministic, certifiable, auditable GATE [rank 3];
(d) navigation COST saving on hard-to-locate targets [rank 2];
(e) the RELATIONAL layer of a property-test suite [PBT pillar];
and its one hazard (overconfidence) is fixable by consumer-side floor framing.
The uniquely-Allium contribution is (b)+(c)+(e): mechanical checkability. Surfacing (a) is the act of
specifying (prose ~ elicit), not the notation.

### What stays uncertain (do not over-read)
- Small n throughout: one subsystem, one distilled spec, 3-4 reps. 63% completeness is one spec/battery.
- Completeness measured at TRACE level (observable-schedule behaviour); only one real-code mutant
  (wrong-rate) validated the complementarity point.
- Monitor tolerance blind spot: sub-0.005 drift is undetected by any spec.
- Phase 4's OMISSION (F2) was caught by review too — a competent reviewer anticipates roll-forward from
  vague intent. Validation's UNIQUE review-value is clearest for OVER-CLAIMS (spec matches wrong intent
  but not code); for foreseeable omissions, review suffices, though mutation still catches domain-
  specific blind spots a reviewer would not foresee.
- prose ~ elicit persists (Prog-1): surfacing is not Allium-specific.

### Recommendations
1. Adopt the VALIDATE-THE-SPEC workflow as the confidence mechanism: after distilling, monitor against
   real traces (report faithfulness + over-claims) and run a mutation battery (report completeness % +
   named blind spots). SHIP THOSE NUMBERS WITH THE SPEC. This is the concrete answer to "how does a user
   trust an LLM-drafted spec" — they don't trust it, they read its validation report.
2. Put the floor instruction in EVERY spec-consuming wrapper/agent; do not rely on headers. Build the
   missing v4 spec-consumption/review skill, carrying the floor framing + the spec's blind-spot list.
3. Treat specs + golden/reference oracles as complementary test layers; a spec-derived PBT needs both
   relational invariants and absolute anchoring.
4. Next: larger n + a second subsystem; a proper build-to-oracle test (does surfacing up front + a
   validated spec yield a measurably more correct built artefact?); a real-code mutation suite for
   completeness rather than trace-level.

END OF PROGRAMME 2.
