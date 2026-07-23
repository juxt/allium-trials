#!/usr/bin/env node
// Distill token-usage harness runner.
//
// Runs the distill skill headlessly against a fixture codebase N times,
// capturing token usage / cost from `claude -p --output-format json` and
// scoring the produced spec against the fixture's golden manifest.
//
// Usage:
//   node run.mjs --label baseline --plugin-dir /path/to/plugin [--runs 3]
//                [--fixture courier] [--model claude-opus-4-8]
//
//   # interleaved A/B comparison (runs alternate baseline,candidate,baseline,…
//   # so time-of-day model drift affects both arms equally):
//   node run.mjs --arm baseline=/path/to/plugin --arm candidate=/path/to/other [--runs 3]
//
// Results land in harness/results/<label>/run-N/:
//   workspace/   copy of the fixture the session worked in (incl. the spec)
//   result.json  raw claude JSON result (usage, cost, turns, duration)
//   score.json   quality report from score.mjs
// and harness/results/<label>/summary.json aggregates all runs, with
// environment provenance (CLI versions, git SHAs, fixture hash) so results
// from different machines/checkouts are comparable.
//
// Compare two labels with: node compare.mjs <baseline-label> <candidate-label>

import { execFileSync, spawnSync } from "child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync, statSync } from "fs";
import { createHash } from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : dflt;
};
const runs = parseInt(opt("runs", "3"), 10);
const fixture = opt("fixture", "courier");
const model = opt("model", "claude-opus-4-8");
const maxTurns = opt("max-turns", "150");

// arms: either repeated --arm label=plugin-dir, or the single --label/--plugin-dir form
const arms = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] !== "--arm") continue;
  const spec = args[i + 1] ?? "";
  const eq = spec.indexOf("=");
  if (eq < 1) {
    console.error(`bad --arm '${spec}': expected label=plugin-dir`);
    process.exit(2);
  }
  arms.push({ label: spec.slice(0, eq), pluginDir: path.resolve(spec.slice(eq + 1)) });
}
if (!arms.length) {
  const label = opt("label");
  const pluginDir = opt("plugin-dir");
  if (label && pluginDir) arms.push({ label, pluginDir: path.resolve(pluginDir) });
}
if (!arms.length) {
  console.error(
    "usage: node run.mjs --label <name> --plugin-dir <path> [--runs N] [--fixture courier] [--model id]\n" +
    "       node run.mjs --arm <label>=<plugin-dir> --arm <label>=<plugin-dir> ... [--runs N]"
  );
  process.exit(2);
}
if (new Set(arms.map((a) => a.label)).size !== arms.length) {
  console.error("duplicate arm labels — each arm needs a distinct label");
  process.exit(2);
}
for (const arm of arms) {
  if (!existsSync(path.join(arm.pluginDir, ".claude-plugin", "plugin.json"))) {
    console.error(`not a plugin dir (no .claude-plugin/plugin.json): ${arm.pluginDir}`);
    process.exit(2);
  }
}

// pre-flight: both CLIs must exist BEFORE spending any API budget. A missing
// `allium` would otherwise surface only at scoring time, after a paid run
// (and historically mis-scored as check_passed=true).
const cliVersion = (bin) => {
  try {
    return execFileSync(bin, ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim().split("\n")[0];
  } catch (e) {
    console.error(`fatal: \`${bin}\` CLI not found on PATH (${e.code ?? e.message}) — required to run the harness.`);
    process.exit(2);
  }
};
const claudeVersion = cliVersion("claude");
const alliumVersion = cliVersion("allium");

const gitInfo = (dir) => {
  try {
    const run = (a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return { sha: run(["rev-parse", "HEAD"]), dirty: run(["status", "--porcelain"]) !== "" };
  } catch {
    return null;
  }
};

const fixtureDir = path.join(HARNESS_DIR, "fixtures", fixture);
const codebaseDir = path.join(fixtureDir, "codebase");
const goldenPath = path.join(fixtureDir, "golden.json");

// content hash of the fixture (codebase + manifest) so a result is tied to
// the exact fixture revision it was scored against
const hashFixture = (dir) => {
  const h = createHash("sha256");
  (function walk(d) {
    for (const entry of readdirSync(d).sort()) {
      const p = path.join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else {
        h.update(path.relative(dir, p));
        h.update("\0");
        h.update(readFileSync(p));
      }
    }
  })(dir);
  return h.digest("hex").slice(0, 16);
};

// pre-flight: a broken manifest would silently corrupt every run's score, so
// validate it before spending any API budget.
try {
  execFileSync("node", [path.join(HARNESS_DIR, "validate-manifest.mjs"), fixtureDir], { stdio: "inherit" });
} catch {
  console.error(`\nmanifest validation failed for fixture '${fixture}' — fix golden.json before running. Aborting.`);
  process.exit(2);
}

const SPEC_REL = path.join("spec", `${fixture}.allium`);
const PROMPT = [
  "Use the distill skill to extract an Allium specification from the codebase in the current directory.",
  `Write the finished specification to a single file: ${SPEC_REL}.`,
  "Work fully autonomously: do not ask questions; where the skill says to ask the user or validate with stakeholders, make the best-supported choice from the code instead and move on.",
].join(" ");

function findSpec(workspace) {
  const preferred = path.join(workspace, SPEC_REL);
  if (existsSync(preferred)) return preferred;
  const found = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const p = path.join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (entry.endsWith(".allium")) found.push(p);
    }
  })(workspace);
  // largest .allium file is the best guess at the main spec
  return found.sort((a, b) => statSync(b).size - statSync(a).size)[0] ?? null;
}

const TIMEOUT_MS = 45 * 60 * 1000;
const fixtureSha = hashFixture(fixtureDir);
const harnessGit = gitInfo(HARNESS_DIR);

const summaries = new Map();
for (const arm of arms) {
  const summary = {
    label: arm.label,
    plugin_dir: arm.pluginDir,
    fixture,
    model,
    prompt: PROMPT,
    provenance: {
      started_at: new Date().toISOString(),
      node: process.version,
      claude_version: claudeVersion,
      allium_version: alliumVersion,
      plugin_git: gitInfo(arm.pluginDir),
      harness_git: harnessGit,
      fixture_sha256: fixtureSha,
    },
    runs: [],
  };
  summaries.set(arm.label, summary);
  mkdirSync(path.join(HARNESS_DIR, "results", arm.label), { recursive: true });
}

function doRun(arm, i) {
  const summary = summaries.get(arm.label);
  const labelDir = path.join(HARNESS_DIR, "results", arm.label);
  const runDir = path.join(labelDir, `run-${i}`);
  const workspace = path.join(runDir, "workspace");
  rmSync(runDir, { recursive: true, force: true });
  mkdirSync(workspace, { recursive: true });
  cpSync(codebaseDir, workspace, { recursive: true });

  console.log(`[${arm.label} run ${i}/${runs}] starting distill session...`);
  const started = Date.now();
  const proc = spawnSync(
    "claude",
    [
      "-p", PROMPT,
      "--output-format", "json",
      "--model", model,
      "--max-turns", maxTurns,
      "--permission-mode", "bypassPermissions",
      "--plugin-dir", arm.pluginDir,
      "--setting-sources", "project",
    ],
    { cwd: workspace, encoding: "utf8", timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 }
  );

  // spawn-level failures (binary vanished mid-suite, timeout, kill signal)
  // must be reported as what they are, not recorded as an opaque bad score
  let spawnError = null;
  if (proc.error) {
    spawnError = proc.error.code === "ETIMEDOUT"
      ? `session timed out after ${TIMEOUT_MS / 60000} minutes`
      : `claude spawn failed: ${proc.error.code ?? proc.error.message}`;
  } else if (proc.signal) {
    spawnError = `claude killed by signal ${proc.signal}`;
  }
  if (spawnError) console.error(`[${arm.label} run ${i}/${runs}] ${spawnError}`);

  let result = null;
  try {
    result = JSON.parse(proc.stdout);
  } catch {
    result = { type: "result", subtype: "unparseable", raw_stdout: proc.stdout?.slice(-5000), raw_stderr: proc.stderr?.slice(-5000) };
  }
  writeFileSync(path.join(runDir, "result.json"), JSON.stringify(result, null, 2));

  const specPath = findSpec(workspace);
  let score = null;
  if (specPath) {
    const scored = execFileSync("node", [path.join(HARNESS_DIR, "score.mjs"), specPath, goldenPath], { encoding: "utf8" });
    score = JSON.parse(scored);
    writeFileSync(path.join(runDir, "score.json"), scored);
  } else {
    score = { summary: { entity_recall: 0, state_recall: 0, transition_recall: 0, rule_recall: 0, quality_pass: false } };
    writeFileSync(path.join(runDir, "score.json"), JSON.stringify(score, null, 2));
  }

  const u = result.usage ?? {};
  // the CLI can report subtype "success" even when the session died on a
  // transport error mid-run; treat those as invalid, not as quality data
  const apiError = typeof result.result === "string" && /\bAPI Error\b/i.test(result.result.slice(-2000));
  const row = {
    run: i,
    ok: result.subtype === "success" && !apiError && !spawnError,
    error: spawnError ?? (apiError ? "API error reported in session result" : null),
    wall_seconds: Math.round((Date.now() - started) / 1000),
    num_turns: result.num_turns ?? null,
    cost_usd: result.total_cost_usd ?? null,
    tokens: {
      input: u.input_tokens ?? null,
      cache_creation: u.cache_creation_input_tokens ?? null,
      cache_read: u.cache_read_input_tokens ?? null,
      output: u.output_tokens ?? null,
    },
    spec: specPath ? path.relative(runDir, specPath) : null,
    quality: score.summary,
    exclusion_violations: score.exclusions?.violations ?? [],
  };
  summary.runs.push(row);
  writeFileSync(path.join(labelDir, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`[${arm.label} run ${i}/${runs}] done: cost=$${row.cost_usd} turns=${row.num_turns} ` +
    `in=${row.tokens.input} cc=${row.tokens.cache_creation} cr=${row.tokens.cache_read} out=${row.tokens.output} ` +
    `entities=${row.quality.entity_recall} rules=${row.quality.rule_recall} pass=${row.quality.quality_pass}`);
}

// interleave arms (A,B,A,B,…) so temporal drift in model behaviour is spread
// evenly across arms instead of loading onto whichever ran second
for (let i = 1; i <= runs; i++) {
  for (const arm of arms) doRun(arm, i);
}

// aggregate per-arm stats (valid runs only). The median is the headline; the
// min is the *floor* the guardrail compares (see README / compare.mjs).
const stat = (xs) => {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return { median: null, min: null, max: null };
  const mid = v.length >> 1;
  const median = v.length % 2 ? v[mid] : +((v[mid - 1] + v[mid]) / 2).toFixed(4);
  return { median, min: v[0], max: v[v.length - 1] };
};
const METRICS = {
  cost_usd: (r) => r.cost_usd,
  num_turns: (r) => r.num_turns,
  input: (r) => r.tokens.input,
  cache_creation: (r) => r.tokens.cache_creation,
  cache_read: (r) => r.tokens.cache_read,
  output: (r) => r.tokens.output,
  entity_recall: (r) => r.quality.entity_recall,
  state_recall: (r) => r.quality.state_recall,
  transition_recall: (r) => r.quality.transition_recall,
  rule_recall: (r) => r.quality.rule_recall,
};
for (const arm of arms) {
  const summary = summaries.get(arm.label);
  const valid = summary.runs.filter((r) => r.ok);
  summary.invalid_runs = summary.runs.filter((r) => !r.ok).map((r) => ({ run: r.run, error: r.error }));
  summary.stats = {};
  summary.median = {};
  for (const [name, get] of Object.entries(METRICS)) {
    summary.stats[name] = stat(valid.map(get));
    summary.median[name] = summary.stats[name].median;
  }
  writeFileSync(path.join(HARNESS_DIR, "results", arm.label, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\n[${arm.label}] medians: ${JSON.stringify(summary.median)}`);
}
if (arms.length === 2) {
  console.log(`\ncompare with: node ${path.relative(process.cwd(), path.join(HARNESS_DIR, "compare.mjs"))} ${arms[0].label} ${arms[1].label}`);
}
