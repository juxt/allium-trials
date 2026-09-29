# Gauntlets

Runnable, inspectable head-to-head evaluations. Each gauntlet is a self-contained directory with
its own config, arms and tasks, and produces a neutral report you can audit end to end. They share
one runner, `run.mjs`, a small provider-agnostic CLI that talks to any OpenAI-compatible endpoint
(OpenAI, Anthropic, Google, or a litellm proxy), so a gauntlet can be driven by Claude, GPT, Gemini
or anything else.

## Running

```
export GAUNTLET_BASE_URL=http://localhost:4000/v1   # your OpenAI-compatible endpoint
export GAUNTLET_API_KEY=sk-...                       # falls back to $OPENAI_API_KEY

node gauntlets/run.mjs <name> --dry-run              # validate config + print the plan, no API calls
node gauntlets/run.mjs <name>                        # run it
node gauntlets/run.mjs <name> --mode sequential --iterations 1
```

Inside Claude Code, `/gauntlet <name>` wraps the same CLI. See each gauntlet's README for its
options and what it measures.

### Providing an endpoint

The runner needs an OpenAI-compatible endpoint; it does not care where that endpoint lives. Two
self-contained options, neither depending on anything outside this repo:

- **Point at a hosted provider.** Set `GAUNTLET_BASE_URL` and `GAUNTLET_API_KEY` for OpenAI, an
  Anthropic-compatible gateway, or similar, and set the model ids to what it serves.
- **Run the bundled proxy.** [`litellm-config.example.yaml`](litellm-config.example.yaml) serves
  `claude-sonnet` and `claude-opus` from Anthropic with one Docker command (see the file header).
  It needs only `$ANTHROPIC_API_KEY`.

## Available gauntlets

| name | question it answers |
|---|---|
| [requirements-capture](requirements-capture/) | When a stakeholder withholds requirements until asked, how many does each requirements-gathering process capture, and how many questions does it spend? |

## Layout

```
gauntlets/
  run.mjs            # the shared CLI runner
  lib/provider.mjs   # OpenAI-compatible chat client
  <name>/            # one self-contained gauntlet (config, arms/, tasks/, findings/)
```

## Adding a gauntlet

Copy an existing gauntlet directory, then edit its `gauntlet.config.json`, `arms/` and `tasks/`.
Keep the same layout so `node gauntlets/run.mjs <name>` and `/gauntlet <name>` find it. Add a row
to the table above.
