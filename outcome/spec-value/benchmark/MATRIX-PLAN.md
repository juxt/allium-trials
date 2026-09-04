# The matrix benchmark — 8h autonomous build plan

## Mission

Measure how much a spec improves RESULTING CODE QUALITY, across four arms and two model tiers, on real
programmer jobs drawn from real codebases. Non-saturating, non-contrived, faithful oracles. Spec quality is
a supporting diagnostic only, never the headline.

## Arms (4)

- **none** — implementer gets requirements + interface only. Baseline.
- **prose** — + a good-faith prose specification.
- **v3** — + an idiomatic Allium v3 spec.
- **v4** — + an Allium v4 spec (may run `allium analyse`).

Specs are distilled ONCE per task, quality-controlled, fair across arms (same intent; each is what a good
author of that tool would write). For reconstruct/port tasks the real code is then hidden.

## Models (2) — matrix

- **opus** (frontier) and **sonnet** (mid-tier). Every (task × arm) runs on both. Saturation for opus but
  separation for sonnet is itself a finding: it locates where spec value lives on the capability curve.

## Oracle (both kinds)

- **real** — the project's own tests where they run, or a differential vs real behaviour on golden inputs
  captured from the compiled real module.
- **graded** — partial-credit obligation suites (pinned by correct + naive refs) with many obligations, so
  scores land at 60-90%, not 0/100. This is the main non-saturation lever: a task with 20+ obligations
  separates arms even for a strong model.

## Task types (real programmer jobs)

reconstruct · port · feature-add · bugfix · refactor-preserve. Each scored on resulting code, graded.

## Non-saturation discipline

A task earns its place only if it does NOT tie at ~100% across all arms on at least one model tier. Saturated
tasks are recorded (honest) and kept as boundary cases but do not count toward the live signal. Non-obvious
is INHERENT (real code), never obfuscated in.

## Backlog (Fineract-first, grows)

1. `mathutil-port` — reconstruct/port MathUtil's 53 boundary methods (graded, null/zero/negative semantics). RUNNING FIRST.
2. loan transaction legality (which txn types legal per status) — graded matrix of ~40 rules.
3. charge applicability/calculation rules — graded.
4. savings interest posting — differential.
5. loan schedule / EMI generation — differential (rich).
6. a feature-add on a real module (graded: feature + preserved invariants).
7. a bugfix task (planted realistic bug + failing scenario + regression guard).
Then branch: a crypto ledger (double-entry invariants), a reporting engine (regulatory calc).

## Scoreboard

`SCOREBOARD.md` gets a matrix section: task × arm × model → score. Read `CONCLUSION.md` for the running
interpretation. Prior single-model findings (9 data points: code-level V3≈V4≈prose for frontier; value is
capability not rate) are the null hypothesis this matrix tests against a weaker tier.
