# Round-trip regeneration: the completeness oracle, and what it found

The method (the one suggested): take code with hidden integration tests, distil it to an Allium
spec, regenerate an implementation from the spec alone in a fresh session that never sees the
original, then grade the regenerated code against the original's behaviour. Failing tests are the
completeness score; each failure localises what the spec left out.

To grade behaviour rather than Java-API reproduction, the oracle is the **150 real Fineract
schedules** and the interface is neutral: `schedule(disbursed, annual_rate_percent, months) ->
periods`. Three arms regenerate into the same oracle, to isolate what the spec adds:

- **thin** — "implement a standard amortising loan calculator" (the model's prior, no spec)
- **prose** — the same seven invariants in plain English (spec content, no formalism)
- **allium** — the distilled Allium spec (structured formalism)

## Result

    arm      strict (penny)   loose (structural)
    thin     139-140 / 150    150 / 150
    prose    140 / 150        150 / 150
    allium   140 / 150        150 / 150

Two seeds each; the arms are indistinguishable. **The spec adds nothing over the model's prior.**

- **Structural behaviour is saturated.** Every arm, including the thin prompt with no spec,
  reproduces all 150 schedules to structural tolerance (loose 150/150, zero cell failures in any
  field). A competent model already knows declining-balance amortisation cold, so distilling it
  into a spec and regenerating is redundant: the model writes the same code from the word
  "amortising loan" as it does from the full invariant set.
- **Penny-exact behaviour is unreachable from any of these specs.** All three arms miss ~10
  schedules on exact match, and the misses are accumulated rounding drift, not a single glitch.
  By period 23 of a 24-month loan the regenerated balance has drifted to 259.02 against Fineract's
  259.31; the interest and instalment drift a penny or two with it. Getting this right needs
  Fineract's exact numerical policy: the per-period rounding mode, whether the instalment is
  recomputed as the balance rounds, and the day-count convention. None of the specs carry it. The
  Allium invariants assert the ideal ("balance closes to zero", "conservation") but not the
  arithmetic realisation that produces it, so the model rounds naively and drifts.

## What this means

The round-trip works, is cheap, and would discriminate in principle. On this target it does not,
and the reason is the important part: **regeneration saturates when the behaviour is something the
model already knows.** The core loan schedule is a textbook algorithm, so the spec is redundant
with the model's prior, and the only thing that actually differs, Fineract's exact rounding, is
precisely what the distilled spec is silent on.

This is the third independent experiment to land on the same axis. The elicit counterweight found
the value in the org-specific facts the model cannot know (88% to 0%). The value-1 gate found it
in catching the specific deviation, not the textbook law. Regeneration now finds it from the
other direction: only the non-textbook, institution-specific behaviour makes a spec non-redundant.
A spec earns its keep exactly where the model's prior runs out.

So for the regeneration oracle to discriminate, it must be pointed at behaviour the model cannot
infer. Two concrete targets, both already on the map:

1. **The numerical policy** — per-period rounding, instalment recomputation, day-count. This is
   the deferred representation/rounding decoration (SD-1 §2c), and the drift here is a forcing
   case for it: distil the rounding policy, re-run this exact eval, and the strict score should
   move. That is the completeness loop working as intended.
2. **The operations** — reschedule, mid-loan rate change, partial and early repayment, capitalised
   income, re-age. These are not textbook; the model has no strong prior for how Fineract composes
   them. This is where regenerating from a spec should genuinely beat regenerating from nothing,
   and where a real interaction bug could hide.

## Loop 1: distil the missing policy, re-run (does the score move?)

The failing tests said the gap was Fineract's exact numerical policy. So we distilled it — a
subagent read the calculator and produced a 292-line policy (rounding HALF_EVEN 2dp, 30/360
day-count, iterative annuity EMI, final-instalment residual) — enriched the spec with it, and
re-ran the identical eval.

    arm             strict (penny)   loose (structural)
    thin / prose / allium   140/150          150/150
    thin_policy             143/150          150/150
    allium_policy           143/150          150/150

The score moved: 140 -> 143. The completeness loop works in direction — naming the missing
behaviour and adding it improved fidelity. But it did not reach 150. Even a detailed policy
leaves a residual, because bit-exact reproduction needs Fineract's exact iterative re-levelling
and tie-breaking, which the policy distiller itself flagged as not fully pinnable from a
description. **Some behaviour is irreducibly operational: a descriptive spec can approach but not
reach bit-exactness with a real implementation.** And `allium_policy` = `thin_policy` again: the
gain is entirely in the content (the policy), never the formalism.

## Loop 2: the non-textbook operation (mid-loan rate change)

The last hope for regeneration to show the spec beating the model's prior: a genuinely
non-textbook operation. A subagent generated 32 real rate-change schedules; Fineract keeps the
term and re-amortises the remaining balance at the new rate. Two facets:

**Interaction bug-hunt (monitor).** The five load-bearing laws (principal split, balance roll,
monotonicity, conservation, closes-to-zero) all SURVIVE the rate change exactly — 32/32, residual
0. No interaction bug, and the invariants are provably operation-stable, which is real assurance.

**Regeneration.** Regenerate the rate-change behaviour from a thin prompt vs the operation
contract vs contract+policy, graded against the 32 oracle schedules:

    arm            strict (penny)   loose (structural = got the recompute policy)
    thin           22/32            32/32
    contract       22/32            32/32
    contract+pol   23/32            32/32

The hoped-for win did not appear. `thin` already gets the recompute policy right 32/32
structurally: the model's prior includes "loan rate change keeps the term and recomputes the
instalment". The operation was not non-textbook after all. The contract adds nothing; the policy
nudges pennies 22 -> 23, the same marginal effect as Loop 1.

## What the two loops settle

Regeneration saturates completely, including for the operation we expected to be non-obvious. A
competent model reproduces the behaviour from almost nothing, so the spec's completeness cannot be
demonstrated through regeneration on this codebase. The one thing the spec could add — the exact
numerical policy — moves penny-fidelity only marginally (140->143, 22->23) and never to exactness,
because the last pennies live in the code's iterative rounding, not in any description. The spec's
value is therefore not in regeneration; it is in the standing gate, the auditable contract, and
the operation-stability the monitor proves. Those do not saturate; reproduction does.

## Honest limits

- One target (the core schedule) and one interface. The negative result is specific to textbook
  behaviour; it is evidence for the thesis, not a proof that specs never help regeneration.
- Two seeds per arm. The arms are so tightly clustered (all 140/150) that more seeds would sharpen
  the number but not the conclusion.
- The oracle is Fineract's own output, so "correct" means "matches Fineract", including its
  rounding. That is the right oracle for a fidelity question and the wrong one for a "is Fineract
  correct" question, which is the bug-hunt's job, not this one's.
