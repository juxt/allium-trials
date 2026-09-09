# distill-conciseness — CONFOUNDED as a verbosity test, but a clean finding: tightening drops algorithms

Controlled attempt: same ISIN behaviour, a TIGHT v4 spec (3,053 chars) vs a VERBOSE one (16,778),
port with Opus (control) + Sonnet, N=8, score vs 21 golden.

| variant / model | fidelity | reliability | worst | broke |
|---|---|---|---|---|
| tight / opus | 39.3 | 0/8 | 38 | 0 |
| tight / sonnet | 26.8 | 0/8 | 0 | 3* |
| verbose / opus | 55.4 | 0/8 | 38 | 0 |
| verbose / sonnet | 42.9 | 0/8 | 43 | 0 |

## The test is confounded — do NOT read it as "verbose beats tight"

1. **The control breaks.** On Opus, tight 39.3 vs verbose 55.4 — a 16-point gap where the control
   should tie. So the two specs are NOT the same obligations; verbosity was not isolated.
2. **The ceilings are decisive.** Tight's best single run was **9/21**; verbose's best was **20/21**.
   9/21 is exactly the structure-only floor (country + length + alphanumerics), i.e. a validator
   with NO working check digit. So the **tight distillation dropped the check-digit algorithm
   entirely**; the verbose one — which transcribed the algorithm step by step in comments — kept it.
3. **The "prompt too long" failures are spurious.** They hit tight/sonnet (3,053 chars) 3x and
   verbose/sonnet (16,778 chars) 0x. A shorter prompt cannot be "too long" while the 5x-longer one
   is not — transient noise on those 3 cells, not spec-length-driven. Discard.

## The real finding: "keep it tight" is dangerous on ALGORITHMIC behaviour

ISIN check-digit is a *recipe* (expand letters A=10..Z=35, right-to-left doubling, mod-10), not a
declarative rule. Tightening a spec of an algorithm abstracts the steps away — and the steps ARE
the content, so the port has nothing to reconstruct and falls to the structure-only floor. This is
the SAME domain boundary as fineract-amortization (Allium abstracts a numerical solver and loses
it). Conciseness helps a spec of *invariants/obligations*; it actively harms a spec of an
*algorithm*, because there is no redundancy to cut — every step is load-bearing.

So ISIN was the wrong task to test conciseness on. The distill skill's "Concise is not incomplete —
tightening never drops a checked behaviour" rule is exactly right and was VIOLATED here by the
tight distillation; the fix is to make that caveat explicit for algorithmic content (below).

## Actions
1. Refine the distill "keep it tight" guidance: never tighten away a load-bearing ALGORITHM; a
   computational recipe must keep its steps (state them, or reference a procedure), because
   abstracting them is not compression, it is dropping the behaviour. (DONE — skill updated.)
2. A clean verbosity test needs a DECLARATIVE behaviour (rules/invariants with genuine redundancy
   to cut), not an algorithm. Deferred — the conciseness hypothesis remains untested on the case
   where it should apply; not worth another run now.
3. Backlog #4's original symptom (isin v4/sonnet 58 fragility) is now better explained: the
   fragility is not verbosity per se, it is that an algorithmic behaviour is hard to carry in v4's
   declarative form at all — the spec is either verbose (ports unreliably) or abstract (drops it).
   The lever is task-fit (don't distil algorithms), not spec length.
