# Requirements-capture gauntlet

A runnable, inspectable test of one question: when a stakeholder is holding requirements they
will only reveal if asked, how many does each requirements-gathering process actually capture,
and how many questions does it spend doing so?

Eight processes are put through the identical loop against the same task: Allium's `elicit` skill,
GitHub Spec Kit, Superpowers, Tessl, Kiro, BMAD-METHOD, the AI Unified Process, and plain prose as
the baseline. A hidden reference set of material, non-inferable decisions is the answer key. A proxy
stakeholder answers only what it is asked and volunteers nothing. A neutral auditor then scores
which decisions each produced spec captured, and records why for every call.

Everything that determines the result lives in files you can read. The runner contains no task
content and no per-arm special-casing beyond the limits declared in each arm's config.

## What you are looking at

```
requirements-capture/
  gauntlet.config.json     # the whole experiment at a glance: arms, tasks, iterations, models, speed
  arms/<arm>/
    arm.json               # what this arm is, where its text came from, its structural limits
    process.md             # the exact process text the author is given
  tasks/<task>/
    task.json              # decision count, which decisions are genuinely bespoke, oracle config
    brief.md               # the deliberately under-specified prompt every arm starts from
    stakeholder.md         # how the proxy stakeholder behaves
    answer-key.md          # the stakeholder's private answers (compact)
    reference.md           # the auditor's ground truth (the 14 decisions and correct answers)
  findings/                # the research record behind this task (see Provenance below)
  results/<run-label>/     # output: report.csv, report.md, metadata.json, logs/

(the runner itself lives one level up, at gauntlets/run.mjs, and is shared by all gauntlets)
```

## How to run

The runner is a small provider-agnostic CLI. It talks to any OpenAI-compatible
`/chat/completions` endpoint, so it can drive Claude, GPT, Gemini or anything else, including via a
[litellm](https://github.com/BerriAI/litellm) proxy.

Point it at an endpoint and give it a key. Either export them, or copy `.env.example` to `.env`
at the repo root and the runner loads it automatically (real shell env wins):

```
export GAUNTLET_BASE_URL=http://localhost:4000/v1     # or OpenAI / Anthropic / Google / your proxy
export GAUNTLET_API_KEY=sk-...                        # falls back to $OPENAI_API_KEY
export GAUNTLET_AUTHOR_MODEL=claude-sonnet            # also STAKEHOLDER / AUDITOR; ids your endpoint serves
export GAUNTLET_MAX_TOKENS=16384                      # raise if your endpoint reserves a thinking budget
```

Then, from the repo root:

```
node gauntlets/run.mjs requirements-capture --dry-run          # validate config + print the plan
node gauntlets/run.mjs requirements-capture                    # run it
node gauntlets/run.mjs requirements-capture --mode sequential --iterations 1
node gauntlets/run.mjs requirements-capture --model gpt-4o     # drive every arm with a different model
```

Inside Claude Code you can also use the `/gauntlet` command, which wraps the same CLI.

Options (all override the config): `--mode parallel|sequential`, `--concurrency N`,
`--iterations N`, `--arms a,b` (subset of arms), `--tasks x,y` (subset of tasks), `--run-label X`,
`--model ID` (the author model), `--stakeholder-model ID`, `--auditor-model ID`,
`--base-url URL`, `--dry-run`.

Model ids must be whatever your endpoint serves. To compare processes fairly, vary `--model` (who
drives each process) and leave the stakeholder and auditor fixed, so scoring stays constant.

### Speed versus spend

- `--mode parallel --concurrency N` runs N cells at once. Faster, heavier on rate limits and spend.
- `--mode sequential` runs one cell at a time. Slower, but gentle, and a failure loses only the one
  cell in flight.

A cell is one (arm, task, iteration). Five arms, one task and three iterations is fifteen cells.

## The output

`results/<run-label>/` holds:

- `report.csv` — one row per cell: arm, task, iteration, questions asked, requirements captured
  (and of how many), and bespoke requirements captured. No commentary.
- `report.md` — the same data as three tables: a per-arm summary, the per-cell rows, and an arm
  provenance table so the versions under test are visible in the result itself.
- `metadata.json` — machine-readable, per cell and per decision: surfaced, correct, the evidence
  quote, and the auditor's reasoning. This is where "which specific requirements were captured" lives.
- `logs/<arm>__<task>__iterN.md` — the full record for one cell: every question and answer, the
  author's step reasoning, the produced spec, and the auditor's verdict table with its justification
  for each decision. Open one to audit a scoring call you doubt.

## Adding your own task

Copy `tasks/loan-allocation` to `tasks/<your-task>`, then edit:

1. `brief.md` — the under-specified prompt. Name the domain and the interface, omit every material
   policy decision.
2. `reference.md` — your hidden decisions with their correct answers. Each should be material (it
   changes the result, not just style) and non-inferable (several answers are defensible and you
   picked one).
3. `answer-key.md` — a compact one-line-per-decision version for the stakeholder.
4. `task.json` — set `decisions_total`, and set `bespoke_decisions` to those a capable model cannot
   guess without asking. To find that set honestly, run a model against the brief with no stakeholder
   and see which it gets wrong (the method is in `findings/RESULT-BIAS-CHECK.md`).

Then add `{ "id": "<your-task>", "enabled": true }` to `tasks` in `gauntlet.config.json`.

## Adding or replacing an arm

Each arm is a folder under `arms/`. `process.md` is the exact text the author follows; `arm.json`
records where it came from and its structural limits:

- `limits.max_rounds` — how many question rounds it gets.
- `limits.max_questions` — a hard cap on total questions (Spec Kit's five), or null.
- `limits.questions_per_round` — 1 forces one-question-at-a-time (Superpowers), or null.
- `limits.finalize` — `guess-from-standards` fills unasked decisions with industry defaults (Spec
  Kit); `faithful` resolves them as the process dictates.
- `tools` — whether the arm's produced spec is also run through `allium check` (recorded in the log,
  not scored).

These knobs are how the harness reproduces a tool's real discipline rather than only its words.

## Provenance and honesty

The point of this gauntlet is that no one has to take the result on trust.

- **Allium arm.** `arms/allium-elicit/process.md` is the shipped `elicit` skill, verbatim, from
  Allium 3.16.0 (tag `v3.16.0`). Its sha256 is recorded in `arm.json`; verify it with
  `shasum -a 256 arms/allium-elicit/process.md`, or against the source with
  `git show v3.16.0:skills/elicit/SKILL.md` in the allium repo.

- **Competitor arms.** The `tessl` arm is verbatim: its `process.md` is Tessl's `requirement-gathering`
  skill and its one-question-at-a-time rule, straight from the public tile, with the source commit and
  sha256 in `arm.json`. `spec-kit`, `superpowers`, `kiro`, `bmad` and `aiup` carry faithful paraphrases
  of their real disciplines, marked `"fidelity": "paraphrase"` in each `arm.json`, because each lives
  in a form that does not vendor as a single file (an IDE workflow, a multi-agent toolchain, command
  templates). The structural caps that define each tool are enforced by the runner. For a published
  head-to-head, replace each paraphrase `process.md` with the verbatim upstream artefact where one
  exists and set `fidelity` to `verbatim`. This is the one known fidelity gap; it is flagged rather
  than hidden.

- **What the runs show.** On the neutral leaderboard this runner produces, the shipped 3.16.0
  `elicit` skill captures the most of each task's hidden, non-inferable decisions, and the logs show
  why: it asks the questions that surface them. Nothing is taken on trust.
  `findings/RESULT-BIAS-CHECK.md` documents the check that those decisions are genuinely
  non-inferable rather than guessable, and every scoring call is recorded with its evidence in
  `metadata.json` and the per-cell logs. Run it and read them yourself.
