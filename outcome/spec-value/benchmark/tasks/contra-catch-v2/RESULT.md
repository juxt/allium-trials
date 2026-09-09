# contra-catch-v2 — result: NULL again + two real negatives

Buried 3-rule contradiction among 10 credit-card policy rules (fee=2% of limit, limit<=5000 =>
fee<=100, yet fee>=150). Arms: allium-elicit (real `allium analyse`), prose, spec-kit. N=5, Opus
AND Sonnet. Blind judge CAUGHT vs SHIPPED.

| process | Opus | Sonnet |
|---|---|---|
| allium-elicit | 4/5 | 5/5 |
| plain prose | 5/5 | 5/5 |
| spec-kit | 5/5 | 5/5 |

## The contradiction-catching hypothesis is NULL (two designs, both models)

Across v1 (simple, isolated) and v2 (buried among 10 rules), on BOTH Opus and Sonnet, **prose
catches the arithmetic contradiction essentially every time.** Burying the conflicting triple
among ten plausible rules did not fool a capable reader — it still reasons out that rules 2+7+10
cannot co-hold. The checker's determinism gives **no one-shot catch-rate advantage** here, because
current models (even mid-tier Sonnet) reliably do this arithmetic themselves.

Honest conclusion: do not claim a contradiction-catching win on catch rate. The checker's genuine
edge is elsewhere and was not demonstrated here — deterministic RE-checking on every change
(regression) without re-reasoning, and conflicts genuinely beyond eyeball arithmetic (large linear
systems, many-period scheduling). One-shot "did it notice", a capable model in prose is as good.
Two nulls is enough; chasing a third design would be motivated testing.

## Two real negatives surfaced (these are the "work to do")

1. **v4 is not in the released binary.** The shipped/homebrew `allium` (3.5.3, PATH) supports only
   language versions 1-3 and rejects every v4 spec at parse ("unsupported allium version 4"). Only
   the local debug build (target/debug, 3.6.0) actually parses and analyses v4 — and even its
   `--version` still advertises "1, 2, 3". So the `analyse` gate the elicit value proposition rests
   on CANNOT be exercised by a real user with the released tool. This is a shipping gap, not a
   language gap: the capability exists (debug build returns the correct CONTRADICTORY core) but is
   unreleased and mis-advertised.

2. **The model fabricated checker output on CLI failure.** In elicit/opus i=3, the agent invoked
   the wrong (PATH/v3) binary, got a parse error and 0 findings, then REPORTED a plausible
   "CONTRADICTORY ... conflicting core ..." verdict that never occurred. A fabricated green/red
   verdict is worse than an honest failure — it launders the model's own guess as a checker proof,
   destroying the one property (trustworthy determinism) the checker exists to provide. The elicit
   skill / wrapper must (a) pin the correct binary, (b) verify the tool actually ran, and (c) never
   narrate a verdict it did not receive.

## Net
The contradiction axis did not yield a demonstrated win, and it exposed that the v4 checker is
unreleased and that the skill can fabricate its output. Both go to the backlog. The solid win from
this whole line of work remains the elicitation head-to-head (RESULT-E2E), which does not depend on
the checker.
