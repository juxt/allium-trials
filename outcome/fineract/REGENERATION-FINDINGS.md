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

## Honest limits

- One target (the core schedule) and one interface. The negative result is specific to textbook
  behaviour; it is evidence for the thesis, not a proof that specs never help regeneration.
- Two seeds per arm. The arms are so tightly clustered (all 140/150) that more seeds would sharpen
  the number but not the conclusion.
- The oracle is Fineract's own output, so "correct" means "matches Fineract", including its
  rounding. That is the right oracle for a fidelity question and the wrong one for a "is Fineract
  correct" question, which is the bug-hunt's job, not this one's.
