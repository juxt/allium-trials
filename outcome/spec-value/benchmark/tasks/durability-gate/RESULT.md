# durability-gate result — the MEASURED V4 gate advantage (proof vs example-tests)

Given a subtle regression (a $15 fee guarded only by balance>=10 breaks balance>=0 in the narrow band
[10,15)), does each arm's GATE catch it — failing on the buggy code but passing the correct code? N=6.

| arm (gate) | opus | sonnet |
|---|---|---|
| v4 — `analyse` (proof) | 100 | 100 |
| prose — generated tests | 100 | 83.3 |
| v3 — generated tests | 100 | 66.7 |
| none — tests from code | 83.3 | 66.7 |

## Findings

1. **V4's `analyse` is the ONLY 100%-reliable gate, on both models.** It proves the invariant over ALL
   states, so it deterministically catches the narrow-band regression and never false-alarms on the correct
   code. Verified witness: balance=12.5 -> -2.5, inside [10,15).
2. **Test-based gates are model-dependent and imperfect.** A strong model (Opus) writes boundary-covering
   tests and mostly catches it. A mid-tier model (Sonnet) is unreliable: it MISSES the narrow edge (no-spec)
   or FALSE-ALARMS — writes a test that wrongly fails the CORRECT code (prose/v3 each had false alarms on
   Sonnet). analyse does neither: more sensitive (no misses) AND more precise (no false alarms).
3. **This is V4's CHECKER winning, not the v4 spec LANGUAGE vs v3.** v3-test-gen ≈ prose-test-gen — the
   difference is proof-gate vs example-test-gate, not v3 vs v4 spec content. The v4 advantage is `analyse`.
4. **Largest where it matters most — the weaker model.** On Opus the test gates also catch it (~100%); the
   gap opens on Sonnet (test gates 66-83%, analyse 100%). Consistent with the programme: spec/tool value
   rises as capability falls.

## Honest scope
One regression type — an ARITHMETIC invariant, which analyse's linear-arithmetic tier can prove. analyse's
advantage is exactly on properties inside its provable fragment (arithmetic/safety invariants); it would not
help on a property it cannot express or prove. Within that fragment, this is a real, deterministic edge that
example-based testing cannot match reliably. This is the honest instrument the page's "verification-time"
leg needed: V4's gate is measured, not asserted.
