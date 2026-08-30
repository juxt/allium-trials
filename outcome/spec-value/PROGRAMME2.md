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
