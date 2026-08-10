#!/usr/bin/env node
// Regression tests for the trial scorers and fixture validators —
// the load-bearing components a shared benchmark cannot afford to let drift.
//
// Hermetic and free: a stub `allium` (tests/stub-bin/) serves canned
// check/model JSON from sidecar files, so no real CLI or API calls are made.
//
// Usage: node tests/run-tests.mjs

import { spawnSync } from "child_process";
import { readdirSync, readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { streamMetrics } from "../lib/stream-metrics.mjs";
import * as loopTrial from "../trials/loop/trial.mjs";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.dirname(TESTS_DIR);
const STUB_PATH = `${path.join(TESTS_DIR, "stub-bin")}${path.delimiter}${process.env.PATH}`;

let passed = 0;
let failed = 0;
const fail = (name, msg) => {
  failed++;
  console.log(`FAIL  ${name}: ${msg}`);
};
const ok = (name) => {
  passed++;
  console.log(`ok    ${name}`);
};

const get = (obj, dotted) => dotted.split(".").reduce((o, k) => o?.[k], obj);

// runs a scorer case dir against expected.json; scorerArgs maps the case dir
// to the scorer argv
const scoreCase = (trial, name, caseDir, scorerArgs) => {
  const proc = spawnSync(process.execPath, scorerArgs(caseDir), {
    encoding: "utf8",
    env: { ...process.env, PATH: STUB_PATH },
  });
  let report;
  try {
    report = JSON.parse(proc.stdout);
  } catch {
    fail(`${trial}/${name}`, `scorer did not emit JSON (exit ${proc.status}): ${proc.stderr?.slice(0, 300)}`);
    return;
  }
  const expected = JSON.parse(readFileSync(path.join(caseDir, "expected.json"), "utf8"));
  const mismatches = Object.entries(expected)
    .filter(([k, v]) => get(report, k) !== v)
    .map(([k, v]) => `${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(get(report, k))}`);
  if (mismatches.length) fail(`${trial}/${name}`, mismatches.join("; "));
  else ok(`${trial}/${name}`);
};

const casesFor = (trial) => {
  const dir = path.join(TESTS_DIR, "cases", trial);
  return readdirSync(dir)
    .sort()
    .map((name) => [name, path.join(dir, name)])
    .filter(([, caseDir]) => existsSync(path.join(caseDir, "expected.json")));
};

// --- distill scorer ----------------------------------------------------------
const distillScore = path.join(REPO_DIR, "trials", "distill", "score.mjs");
for (const [name, caseDir] of casesFor("distill")) {
  scoreCase("distill", name, caseDir, (d) => [distillScore, path.join(d, "spec.allium"), path.join(d, "golden.json")]);
}

// --- weed scorer -------------------------------------------------------------
const weedScore = path.join(REPO_DIR, "trials", "weed", "score.mjs");
for (const [name, caseDir] of casesFor("weed")) {
  scoreCase("weed", name, caseDir, (d) => [weedScore, path.join(d, "report.md"), path.join(d, "golden.json")]);
}

// --- missing allium CLI must be fatal for the distill scorer -----------------
{
  const caseDir = path.join(TESTS_DIR, "cases", "distill", "perfect");
  const proc = spawnSync(
    process.execPath,
    [distillScore, path.join(caseDir, "spec.allium"), path.join(caseDir, "golden.json")],
    { encoding: "utf8", env: { ...process.env, PATH: "/var/empty" } }
  );
  if (proc.status !== 2) fail("distill/missing-cli", `expected exit 2, got ${proc.status}`);
  else if (!/not found/.test(proc.stderr ?? "")) fail("distill/missing-cli", `stderr does not explain the missing CLI: ${proc.stderr?.slice(0, 200)}`);
  else ok("distill/missing-cli");
}

// --- distill manifest validator ----------------------------------------------
{
  const validator = path.join(REPO_DIR, "trials", "distill", "validate-manifest.mjs");
  const run = (goldenPath) => spawnSync(process.execPath, [validator, goldenPath], { encoding: "utf8" });
  const good = run(path.join(TESTS_DIR, "cases", "distill", "perfect", "golden.json"));
  if (good.status !== 0) fail("distill/validate-good", `expected exit 0, got ${good.status}: ${good.stdout}`);
  else ok("distill/validate-good");
  const bad = run(path.join(TESTS_DIR, "cases", "distill", "bad-manifest", "golden.json"));
  if (bad.status === 0) fail("distill/validate-bad", "expected non-zero exit for a transition to an undeclared state");
  else if (!/not in states/.test(bad.stdout)) fail("distill/validate-bad", `error does not name the bad endpoint: ${bad.stdout}`);
  else ok("distill/validate-bad");
}

// --- weed fixture validator --------------------------------------------------
{
  const validator = path.join(REPO_DIR, "trials", "weed", "validate.mjs");
  // weed test case dirs carry golden.json but no spec.allium; the validator
  // must reject the missing spec (and this exercises the golden checks
  // without needing the allium CLI)
  const res = spawnSync(process.execPath, [validator, path.join(TESTS_DIR, "cases", "weed", "full-recall")], { encoding: "utf8" });
  if (res.status === 0) fail("weed/validate-missing-spec", "expected non-zero exit when spec.allium is absent");
  else if (!/missing/.test(res.stdout)) fail("weed/validate-missing-spec", `error does not mention the missing spec: ${res.stdout}`);
  else ok("weed/validate-missing-spec");
}

// --- stream-metrics: peak-context split (orchestrator vs subagent) -----------
{
  const asstMain = (ctx, extra = {}) => ({ type: "assistant", message: { usage: { cache_read_input_tokens: ctx }, content: extra.content ?? [] } });
  const asstSub = (ctx) => ({ type: "assistant", parent_tool_use_id: "t1", message: { usage: { cache_read_input_tokens: ctx }, content: [] } });
  const resultEvt = (o) => ({ type: "result", subtype: "success", num_turns: 40, total_cost_usd: 5.28, usage: { output_tokens: 100 }, ...o });

  // inline: one growing orchestrator context, no subagents
  const inlineStream = [asstMain(30000), asstMain(100000), asstMain(195889), resultEvt({})].map((e) => JSON.stringify(e)).join("\n");
  const im = streamMetrics(inlineStream);
  const inlineExpect = { peak_orchestrator_ctx: 195889, peak_subagent_ctx: 0, subagent_spawns: 0, ok: true, cost_usd: 5.28 };
  const iMis = Object.entries(inlineExpect).filter(([k, v]) => im[k] !== v).map(([k, v]) => `${k}: expected ${v}, got ${im[k]}`);
  if (iMis.length) fail("stream-metrics/inline", iMis.join("; ")); else ok("stream-metrics/inline");

  // agents: flat orchestrator, one spawn, bounded subagent context
  const spawn = asstMain(30000, { content: [{ type: "tool_use", name: "Agent", input: { subagent_type: "allium:distill", description: "distill audit-service" } }] });
  const agentsStream = [asstMain(28000), spawn, asstSub(113112), asstSub(90000), asstMain(30000), resultEvt({ num_turns: 1, total_cost_usd: 8.78 })]
    .map((e) => JSON.stringify(e)).join("\n");
  const am = streamMetrics(agentsStream);
  const agentsExpect = { peak_orchestrator_ctx: 30000, peak_subagent_ctx: 113112, subagent_spawns: 1, ok: true };
  const aMis = Object.entries(agentsExpect).filter(([k, v]) => am[k] !== v).map(([k, v]) => `${k}: expected ${v}, got ${am[k]}`);
  if (am.subagents[0]?.subagent_type !== "allium:distill") aMis.push(`subagent_type: got ${am.subagents[0]?.subagent_type}`);
  if (aMis.length) fail("stream-metrics/agents", aMis.join("; ")); else ok("stream-metrics/agents");

  // the win the loop must prove: orchestrator ctx bounded far below inline's
  if (!(am.peak_orchestrator_ctx < im.peak_orchestrator_ctx / 3)) fail("stream-metrics/bounded", "agents orchestrator ctx not <1/3 of inline");
  else ok("stream-metrics/bounded");

  // robustness: partial/garbage lines are skipped, empty stream yields zeros
  const em = streamMetrics('not json\n{"type":"assistant"}\n');
  if (em.peak_orchestrator_ctx !== 0 || em.cost_usd !== null) fail("stream-metrics/empty", `unexpected: ${JSON.stringify(em)}`);
  else ok("stream-metrics/empty");
}

// --- loop trial: modes are distinct and it reuses the distill scorer ----------
{
  const m = [];
  if (JSON.stringify(loopTrial.modes) !== JSON.stringify(["inline", "agents", "agents-ledger"])) m.push(`modes: ${JSON.stringify(loopTrial.modes)}`);
  const inline = loopTrial.prompt("courier", "inline");
  const agents = loopTrial.prompt("courier", "agents");
  const ledger = loopTrial.prompt("courier", "agents-ledger");
  if (!/single session|do NOT/.test(inline)) m.push("inline prompt does not forbid delegation");
  if (!/ORCHESTRATOR|delegate/i.test(agents)) m.push("agents prompt is not orchestrator-shaped");
  if (!/LEDGER/.test(ledger) || !/NEW divergences/.test(ledger)) m.push("agents-ledger prompt missing the ledger lever");
  if (/code.?map/i.test(ledger)) m.push("agents-ledger should be ledger-only (no map)");
  if (inline === agents || agents === ledger) m.push("mode prompts are not distinct");
  const sa = loopTrial.scoreArgs("/tmp/x.allium", "courier");
  if (!sa[0].endsWith(path.join("distill", "score.mjs"))) m.push(`scoreArgs not pointed at distill scorer: ${sa[0]}`);
  if (!loopTrial.guardrailFloors?.length) m.push("no guardrail floors");
  if (m.length) fail("loop/trial-shape", m.join("; ")); else ok("loop/trial-shape");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
