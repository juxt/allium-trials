// Trial definition: the Allium loop, inline vs clean-orchestrator.
//
// Runs the code-first loop (distill -> weed -> tend, to convergence) two ways
// and measures whether delegating each phase to an isolated subagent keeps the
// orchestrator context bounded WITHOUT costing more than running inline:
//
//   --mode inline  : one session runs every phase itself, no delegation
//   --mode agents  : a thin orchestrator delegates each phase to its
//                    allium:distill / allium:weed / allium:tend subagent and
//                    forwards only the spec path (the target pattern)
//
// The produced spec is scored for faithfulness with the DISTILL trial's golden
// manifest and scorer (same quality bar), so a bounded-context win is only
// valid if the spec quality holds. The headline mechanism — peak orchestrator
// context — is captured by the runner (lib/stream-metrics), not the scorer.

import { cpSync, existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const TRIAL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.dirname(path.dirname(TRIAL_DIR));
const DISTILL_DIR = path.join(REPO_DIR, "trials", "distill");

export const name = "loop";
export const defaultFixture = "courier";
// loop quality reuses the distill golden, so available fixtures = distill's
export const fixtures = () => readdirSync(path.join(DISTILL_DIR, "data")).sort();

const codebaseDir = (fixture) => path.join(REPO_DIR, "fixtures", fixture, "codebase");
const goldenPath = (fixture) => path.join(DISTILL_DIR, "data", fixture, "golden.json");
const specRel = (fixture) => path.join("spec", `${fixture}.allium`);

export const hashPaths = (fixture) => [codebaseDir(fixture), goldenPath(fixture)];

export const validateArgs = (fixture) => [
  path.join(DISTILL_DIR, "validate-manifest.mjs"), goldenPath(fixture), codebaseDir(fixture),
];

// this trial is mode-sensitive: run.mjs passes the --mode through to prompt()
//  inline        — one context does every phase (no delegation)
//  agents        — clean orchestrator, each phase cold (baseline for the cost lever)
//  agents-ledger — agents + carry a divergence ledger + a distill code-map forward,
//                  so weeds confirm-and-extend (fewer passes) and phases read narrowly
export const modes = ["inline", "agents", "agents-ledger"];
export const defaultMode = "agents";

const LOOP = (fixture) => [
  "Run the Allium loop, code-first, on the codebase in the current directory:",
  "(1) distill an Allium spec from the code; (2) weed — check the spec against the code and list divergences;",
  "(3) tend — edit the spec to resolve them; then repeat weed→tend until weed finds no divergences (at most 2 more iterations).",
  `Write the finished specification to ${specRel(fixture)}.`,
  "Work fully autonomously: never wait for a user; where the process would ask or validate with a stakeholder,",
  "make the best-supported choice from the code and record it as an `open question` in the spec.",
].join(" ");

export const prompt = (fixture, mode = defaultMode) => {
  if (mode === "inline") {
    return "Do ALL the work yourself in THIS single session — do NOT use the Task/Agent tool and do NOT spawn subagents; read, distill, weed and tend inline using the skills directly. " + LOOP(fixture);
  }
  if (mode === "agents-ledger") {
    // cost-lever: the delegation premium is EXTRA weed/tend passes — each cold weed
    // re-scrutinises from scratch and finds fresh nits (inline remembered what it
    // checked and converged in 1). Fix: carry a divergence LEDGER so each weed
    // confirms prior items and reports only genuinely NEW drift, converging in fewer
    // passes. This is the SAME clean orchestrator as `agents` — ONLY the ledger is
    // added (no code-map: that over-complicated an earlier prototype and derailed it).
    return [
      "You are a thin ORCHESTRATOR. You must NOT read the source code yourself and must NOT distill/weed/tend yourself; delegate every phase and never hold code.",
      "Run these steps in order and DO NOT STOP EARLY — a run that ends after distill without weeding and tending is a failure:",
      "STEP 1 — spawn `allium:distill` to produce the spec (spec path only, no extra artefacts).",
      "STEP 2 — initialise an EMPTY divergence LEDGER: a short text list of {id, one-line description, status: open|resolved}. It is tiny — hold it; never hold code.",
      "STEP 3 (mandatory, always runs at least once) — spawn `allium:weed` with the spec path and the current ledger, instructing it: 'the ledger lists divergences already found and their status; on the FIRST pass the ledger is empty so report every divergence you find; on later passes CONFIRM each resolved item still holds and report ONLY genuinely NEW divergences not already in the ledger — do not re-derive the whole spec from scratch.' Add any new divergences to the ledger.",
      "STEP 4 — if the last weed found open items, spawn `allium:tend` with the spec path and the OPEN ledger items; it resolves them and you mark them resolved. Then go back to STEP 3.",
      "Terminate only when a weed pass (STEP 3) reports NO new divergences and the ledger has no open items. Because weed confirms-and-extends against the ledger rather than re-scanning cold, expect convergence in fewer passes than a cold loop.",
      "Keep your own context minimal — spec path, the ledger, short phase summaries. Do not open source files.",
      LOOP(fixture),
    ].join(" ");
  }
  // agents (clean orchestrator) — each phase reads cold; baseline for the cost lever
  return [
    "You are a thin ORCHESTRATOR. You must NOT read the source code yourself and must NOT distill/weed/tend yourself.",
    "Delegate every phase to its subagent and pass forward ONLY the spec's path (never code):",
    "spawn the `allium:distill` agent to produce the spec; then the `allium:weed` agent given just the spec path (it reads spec+code itself and returns divergences);",
    "then the `allium:tend` agent given the spec path plus that divergence list; repeat weed→tend the same way until weed reports none.",
    "Keep your own context minimal — hold only the spec path, short phase summaries and the current divergence list; do not open source files.",
    LOOP(fixture),
  ].join(" ");
};

export const setup = (fixture, workspace) => {
  cpSync(codebaseDir(fixture), workspace, { recursive: true });
};

export const artifact = (workspace, fixture) => {
  const preferred = path.join(workspace, specRel(fixture));
  if (existsSync(preferred)) return preferred;
  const found = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const p = path.join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (entry.endsWith(".allium")) found.push(p);
    }
  })(workspace);
  return found.sort((a, b) => statSync(b).size - statSync(a).size)[0] ?? null;
};

// reuse the distill scorer + golden verbatim
export const scoreArgs = (artifactPath, fixture) => [
  path.join(DISTILL_DIR, "score.mjs"), artifactPath, goldenPath(fixture),
];

export const emptyQuality = () => ({
  entity_recall: 0, state_recall: 0, transition_recall: 0, rule_recall: 0, quality_pass: false,
});

export const qualityMetrics = ["entity_recall", "state_recall", "transition_recall", "rule_recall"];
export const guardrailFloors = qualityMetrics;

// The loop's whole point: bounded orchestrator context at no worse quality or
// cost. Guardrail (candidate = agents, baseline = inline): quality floors hold
// (inherited), the orchestrator context must NOT be larger than inline's, and
// cost must not regress beyond a small tolerance — otherwise it isn't a win.
export const extraGuardrails = (baselineValid, candidateValid) => {
  const problems = [];
  const worstPeak = (runs) => Math.max(...runs.map((r) => r.peak_orchestrator_ctx ?? 0), 0);
  const bPeak = worstPeak(baselineValid), cPeak = worstPeak(candidateValid);
  if (cPeak > bPeak) problems.push(`candidate peak orchestrator ctx ${cPeak} exceeds baseline ${bPeak} — bounding failed`);
  const medCost = (runs) => {
    const v = runs.map((r) => r.cost_usd).filter((x) => x != null).sort((a, b) => a - b);
    return v.length ? v[v.length >> 1] : null;
  };
  const bCost = medCost(baselineValid), cCost = medCost(candidateValid);
  if (bCost != null && cCost != null && cCost > bCost * 1.1)
    problems.push(`candidate median cost $${cCost} exceeds inline $${bCost} by >10% — not cost-competitive`);
  return problems;
};
