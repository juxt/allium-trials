---
description: Run a gauntlet (a head-to-head eval) from gauntlets/ and summarise its report.
argument-hint: "[name=requirements-capture] [mode: parallel|sequential] [iterations]"
allowed-tools: Bash, Read
---

Run a gauntlet from the `gauntlets/` directory using its CLI, then report the result.

The runner is a provider-agnostic Node CLI: `node gauntlets/run.mjs <name> [flags]`. It calls an
OpenAI-compatible endpoint, so it can drive Claude, GPT, Gemini or anything else.

Arguments (all optional, space-separated): `$ARGUMENTS`
- First token: gauntlet name. Default `requirements-capture`.
- A token `parallel` or `sequential`: passed as `--mode`.
- A bare integer: passed as `--iterations`.

Steps:

1. Resolve the gauntlet name (default `requirements-capture`). Confirm
   `gauntlets/<name>/run` works by running `node gauntlets/run.mjs <name> --dry-run` first — this
   validates the config and prints the plan (arms, tasks, iterations, mode, endpoint, models)
   without making any API calls. Show that plan to the user.
2. Check the endpoint is configured: `$GAUNTLET_BASE_URL` (or the config default) and
   `$GAUNTLET_API_KEY` (or `$OPENAI_API_KEY`). If no key is set, tell the user what to set and
   stop rather than running against a dead endpoint.
3. Run it: `node gauntlets/run.mjs <name>` with `--mode` and/or `--iterations` if the user gave
   them, and a distinct `--run-label` if the default label's `results/` folder already exists.
   Do not pass `--code-oracle` unless asked. This can take a while and spends API tokens.
4. When it finishes, read `gauntlets/<name>/results/<run-label>/report.md` and present the per-arm
   summary table verbatim. Add no commentary or ranking spin beyond the table. Point the user at
   `results/<run-label>/` for `report.csv`, `metadata.json` and the per-cell `logs/`.

Notes:
- Suggest `sequential` with small `iterations` for a first run if the user is cost-conscious.
- Everything the gauntlet tests lives in `gauntlets/<name>/` (config, `arms/`, `tasks/`); the
  runner contains no hidden task logic. For how it works, point them at that gauntlet's README.
