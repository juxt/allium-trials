# allium-trials

Shared evaluation harness for the Allium plugin skills. Like a horticultural
trial garden: candidate plugin versions are grown side-by-side under identical
conditions and judged against a published standard — so efficiency and quality
changes to the skills can be proven rather than asserted.

The harness lives here, separate from the plugin, on purpose:

- **One referee, many contestants.** A comparison is only meaningful when one
  fixed harness version scores both plugin versions. Results should cite the
  harness version and fixture hash they were produced with (both are recorded
  in every `summary.json`).
- **The answer keys stay out of the system under test.** Fixtures ship with
  golden manifests; keeping them outside the plugin repo means the agent under
  test cannot stumble into them.
- **Anyone can point it at any checkout.** The plugin under test is a
  parameter (`--plugin-dir`), so any member can trial their own fork or branch.

Trials are pluggable: each lives in `trials/<name>/` with a `trial.mjs`
definition (prompt, workspace setup, artifact discovery, scorer, guardrails)
that the shared runner and comparer load via `--trial`. Two trials exist
today — **distill** (token usage and spec quality) and **weed** (divergence
detection) — and shared fixture codebases live in `fixtures/`. Trials for
tend and propagate are future work: each needs its own prompt, fixture data
and deterministic scorer. elicit is a poor fit — it is conversational, and a
deterministic trial would need a simulated stakeholder, putting an LLM back
into the judging loop.

## The distill trial (`--trial distill`, the default)

Measures the token cost **and** output quality of the `distill` skill. Any
change must show lower token usage at equal-or-better quality; a token
reduction that costs quality is a regression, not an improvement.

### How it works

1. **Fixture** (`fixtures/courier/codebase/`) — a small Flask/SQLAlchemy
   courier service, written for this harness in a domain that appears nowhere
   in the skill documentation (so the guide material cannot leak answers into
   the output). It plants specific probes:
   - explicit status enums with a defined transition graph (`Parcel`)
   - an implicit state machine derived from nullable timestamps (`PickupRequest`)
   - temporal/scheduled-job rules, webhook boundaries, an external entity
     (`Customer`, CRM-owned), cross-entity preconditions deliberately
     scattered across route/service/model
   - implementation noise a faithful spec must abstract away (Redis, Celery,
     SendGrid, token generation, JSONB columns)
   - dead-code traps that must **not** appear in the spec (a feature-flagged-off
     SMS module, an orphaned `LoyaltyPoints` model)

2. **Golden manifest** (`trials/distill/data/courier/golden.json`) — the
   expected entities, states, transitions, rules, config values and
   forbidden terms.

3. **Runner** (`run.mjs`) — copies the fixture into a clean workspace, runs
   `claude -p` headlessly with the plugin-under-test via `--plugin-dir`, and
   records token usage, cost, turn count and wall time from the JSON result.

4. **Scorer** (`trials/distill/score.mjs`) — fully deterministic, no LLM
   judging:
   - structural validity: `allium check` must pass (errors fail; warnings advisory)
   - **recall** (did the spec find the golden items?): entity/state/transition
     via `allium model` JSON; rule recall via one-to-one block matching
     (requires/ensures term matching); boundary/actor coverage fuzzily against
     surface/facing/actor declarations
   - **precision** (did the spec invent items the code doesn't support?):
     spurious states/transitions on matched entities fail the gate (the
     manifest is exhaustive per entity, so extras are confabulation); invented
     internal entities and unmatched rules are surfaced for review, not gated
   - exclusion violations: prefix search for forbidden terms in normative
     content (comments and open-questions exempt)

   The quality gate (`summary.quality_pass`) requires: check passes, entity
   recall 1.0, state/transition recall ≥0.9, rule recall ≥0.8, no exclusion
   leaks, and no confabulated states/transitions. Recall guards against the
   spec being incomplete; precision guards against the failure mode that
   aggressive token-cutting causes — an agent reading less code and guessing.

## The weed trial (`--trial weed`)

Measures how well the `weed` skill detects spec↔code divergence. The fixture
pairs the shared courier codebase with a spec
(`trials/weed/data/courier/spec.allium`) carrying six known divergences —
one of each shape weed must catch:

- **config drift** — spec says `max_delivery_attempts = 5`, code says 3
- **missing behaviour (command)** — code implements pickup cancellation; the
  spec has no cancellation concept at all
- **phantom behaviour** — the spec invents a parcel-archiving lifecycle
  (state, transition, config, rule) that exists nowhere in the code
- **guard drift** — code's dispatch requires the driver to be on shift; the
  spec's DispatchParcel rule has no driver eligibility guard
- **missing behaviour (scheduled)** — code returns exhausted parcels to the
  sender via a sweep job; the spec has no returned state or return rule
- **aspirational guard** — the spec's DispatchParcel requires
  `not attempts_exhausted`, but the code never checks attempts at dispatch;
  only the sweep job enforces the limit (inherited from the base spec and
  confirmed real — found by the first live smoke run)

The planted spec still passes `allium check` with zero errors — divergences
are semantic drift against the code, never syntax errors. The session writes
its findings to `weed-findings.md`, and the scorer
(`trials/weed/score.mjs`, pure text matching, no CLI needed) measures
**divergence recall** (planted divergences found, matched one-to-one by
fingerprint terms) and **false positives** (findings matching nothing
planted). Known judgement calls the fixture contains (dead loyalty code, the
gated SMS path) are excused, not counted as false positives. The gate:
recall ≥0.8 with at most 1 false positive. The comparison guardrail holds
the recall floor and forbids the candidate's worst run from producing more
false positives than the baseline's worst run — a weed that flags healthy
spec/code pairs is unusable even at perfect recall.

## Running

Requires the `allium` CLI on PATH and the `claude` CLI authenticated (both
are pre-flighted before any budget is spent). If the `claude` CLI is logged
in via a claude.ai subscription, runs consume subscription usage rather than
API billing; `cost_usd` is still reported as the notional API-equivalent
price, so comparisons work the same either way.

```bash
# Baseline on a plugin checkout
node run.mjs --label baseline --plugin-dir ../allium-plugin --runs 3

# Candidate from another checkout/branch
node run.mjs --label candidate --plugin-dir ../allium-candidate --runs 3

# Preferred for comparisons: both arms in one invocation, interleaved
# (baseline, candidate, baseline, …) so temporal model drift hits both equally
node run.mjs --arm baseline=../allium-plugin --arm candidate=../allium-candidate --runs 3

# Another trial and fixture
node run.mjs --trial weed --label baseline --plugin-dir ../allium-plugin --runs 3
node run.mjs --trial distill --fixture claims --label baseline --plugin-dir ../allium-plugin

# Then compare (also evaluates the trial's quality guardrail; exits 1 if broken)
node compare.mjs baseline candidate
```

Each run is a full headless session of the skill under trial (today that
means a distill session), so it consumes real usage — your
subscription's usage allowance when the `claude` CLI is logged in via
claude.ai (the common case), or API billing when an `ANTHROPIC_API_KEY` is
set. On subscription, a multi-run comparison on a large fixture can eat a
meaningful chunk of a 5-hour/weekly usage window. Results land in
`results/<label>/`, with per-run raw output, the produced spec, the quality
report, and a `summary.json` with per-metric median/min/max plus environment
provenance (claude/allium CLI versions, plugin and harness git SHAs with
dirty flags, a content hash of the fixture) — always quote the provenance
when sharing numbers, so others can tell whether their setup is comparable.
`results/` is gitignored: results are experiment data, machine- and
version-specific, and do not belong in the shared repo.

## Reading the numbers

- `tokens.input` + `tokens.cache_creation` + `tokens.cache_read` together are
  the total input volume processed; `cost_usd` weights them by price.
- Quality metrics are per-trial (each trial's `trial.mjs` declares them). For
  distill, `quality.*_recall` are against the golden manifest,
  `quality.confabulation_free` and the `precision` block flag invented
  content, and `exclusion_violations` lists forbidden terms that leaked into
  the spec. For weed, `quality.divergence_recall` and
  `quality.false_positive_count` are against the planted divergence list.
- Compare **medians across ≥3 runs** — single runs vary. The guardrail is the
  *floor*, not the median: a token win is only valid if no valid run drops
  below the baseline's quality (recall held, no new confabulation).
  `compare.mjs` prints the median (min–max) table and evaluates this floor
  rule mechanically — use it rather than eyeballing summaries.

## Golden-data authoring notes

Term matching in both scorers normalises away `_`, `-` and spaces and then
does substring matching, so short or generic terms over-match (`active`
matches `inactive`). Pick distinctive fingerprint terms — for distill's
`ensures_all` / `requires_any` and for weed's `must_all` / `must_any` alike.
Each trial validates its own data before any budget is spent:
`trials/distill/validate-manifest.mjs` warns on generic-only fingerprints
and cross-checks every manifest state against the fixture code (state
aliases are scoped per entity — two entities may map the same synonym to
different canonical states); `trials/weed/validate.mjs` checks the
fingerprints and requires the planted spec to pass `allium check` with zero
errors.

## Fixtures

Shared fixture codebases (`fixtures/<name>/codebase/`) are the trial beds;
each trial keeps its per-fixture golden data under `trials/<trial>/data/`.

- `courier/` — Python/Flask, ~1k lines. The reference fixture (distill and
  weed).
- `claims/` — Python/Flask, ~3k lines. Distill only; tests how the token
  saving scales (the token pain is worst on larger codebases).
- `ticketing/` — TypeScript, ~2k lines. Distill only; tests generalization
  beyond Python idioms.

Run a specific fixture with `--fixture <name>` (default `courier`).

## Tests

`node tests/run-tests.mjs` runs regression tests for the trial scorers and
fixture validators. They are hermetic and free: a stub `allium`
(`tests/stub-bin/`) serves canned check/model JSON, so no real CLI or API
calls are made. Run them after any change under `trials/` — a shared
benchmark whose scorer drifts silently loses its authority.
