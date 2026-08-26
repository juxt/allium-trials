#!/usr/bin/env node
// Trial C — analyse → comprehension.
//
// The primary objective is comprehension, so we measure comprehension, not analyse
// volume. Two arms answer a hidden question bank about the system:
//   - code-only:  given the codebase alone.
//   - spec-aided: given the codebase PLUS the distilled Allium spec.
// A judge scores each arm's answers against the hidden ground-truth answers.
//
// The v4-analyse-aided arm (given v4's deeper analyse output) is where v4 must beat
// v3; it is a stub until the v4 analyse layer (4c) produces insight. This run
// establishes the measure and the v3 baseline (does the spec itself aid comprehension?).

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SYS = join(HERE, "systems", "ledger");
const RUNS = join(HERE, "runs", "trial-c");
const QBANK = JSON.parse(readFileSync(join(SYS, "questions.json"), "utf8"));
const SPEC = join(HERE, "runs", "trial-b", "spec", "ledger.allium"); // distilled spec

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MODEL = opt("--model", "claude-opus-4-8");

function claude(prompt, cwd) {
  spawnSync("claude", ["-p", prompt, "--output-format", "stream-json", "--verbose",
    "--model", MODEL, "--max-turns", "40", "--permission-mode", "bypassPermissions",
    "--setting-sources", "project"],
    { cwd, encoding: "utf8", maxBuffer: 1 << 28, timeout: 900000, killSignal: "SIGKILL" });
}
const reset = (d) => { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); };

const questionsText = QBANK.questions.map((x, i) => `${i + 1}. ${x.q}`).join("\n");

function answerArm(name, withSpec) {
  const ws = join(RUNS, name);
  reset(ws);
  cpSync(join(SYS, "codebase"), ws, { recursive: true });
  writeFileSync(join(ws, "questions.txt"), questionsText);
  if (withSpec && existsSync(SPEC)) {
    mkdirSync(join(ws, "spec"), { recursive: true });
    cpSync(SPEC, join(ws, "spec", "ledger.allium"));
  }
  console.log(`• answering (${name}) …`);
  claude(
    `Answer each numbered question in questions.txt about the system in this directory. ` +
    (withSpec ? "Use the codebase AND the Allium specification in spec/ledger.allium. " : "Use the codebase. ") +
    "Write your answers to answers.md, numbered to match the questions, one short paragraph each. Do not ask questions.",
    ws);
  return existsSync(join(ws, "answers.md")) ? readFileSync(join(ws, "answers.md"), "utf8") : "";
}

const codeOnly = answerArm("code-only", false);
const specAided = answerArm("spec-aided", true);

// --- judge -------------------------------------------------------------------
const judgeWs = join(RUNS, "judge");
reset(judgeWs);
const key = QBANK.questions.map((x, i) => `${i + 1}. Q: ${x.q}\n   GROUND TRUTH: ${x.a}`).join("\n");
writeFileSync(join(judgeWs, "key.md"), key);
writeFileSync(join(judgeWs, "code-only-answers.md"), codeOnly);
writeFileSync(join(judgeWs, "spec-aided-answers.md"), specAided);
console.log("• judging …");
claude(
  "You are a strict but fair grader. key.md holds numbered questions with the ground-truth answer. " +
  "code-only-answers.md and spec-aided-answers.md hold two candidates' answers to the same questions. " +
  "For each question and each candidate, grade the answer 'correct', 'partial', or 'wrong' against the ground truth. " +
  "Write judge.json only, of the form " +
  '{"code_only":{"correct":N,"partial":N,"wrong":N},"spec_aided":{"correct":N,"partial":N,"wrong":N}}. ' +
  "Nothing else.",
  judgeWs);

let verdict = null;
try { verdict = JSON.parse(readFileSync(join(judgeWs, "judge.json"), "utf8")); } catch {}
const scoreOf = (a) => a ? Math.round(100 * (a.correct + 0.5 * a.partial) / (a.correct + a.partial + a.wrong)) : null;
const summary = { trial: "C", system: "ledger", model: MODEL, verdict,
  comprehension: verdict ? { code_only: scoreOf(verdict.code_only), spec_aided: scoreOf(verdict.spec_aided) } : null };
writeFileSync(join(RUNS, "summary.json"), JSON.stringify(summary, null, 2));
console.log("\nTrial C — comprehension (judged vs hidden ground truth):");
if (summary.comprehension) {
  console.log(`  code-only  : ${summary.comprehension.code_only}%`);
  console.log(`  spec-aided : ${summary.comprehension.spec_aided}%`);
} else console.log("  (judge did not return parseable judge.json — inspect runs/trial-c/judge)");
console.log("(v4-analyse-aided arm awaits 4c — that is where v4 must beat v3)");
