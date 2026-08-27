#!/usr/bin/env node
// Trial E — integration against a third-party library spec (design-time value of v4).
//
// A consumer must integrate correctly with a message queue whose library spec
// (QUEUE-CONTRACT.allium) states AT-LEAST-ONCE delivery. The classic pitfall is a
// non-idempotent consumer that double-credits on redelivery. Measured
// PROBABILISTICALLY over N reruns: what fraction of builds get the integration right?
//
//   baseline (this file, default): the agent builds from the queue contract as a
//     document, WITHOUT the v4 checker in the loop. Gives the non-saturated target.
//   v4 arm (later, needs 4c): the elicit process drafts the consumer spec, runs the
//     v4 checker against the library contract, the checker flags the exactly-once
//     assumption, loops with the operator, and refines — design-time guidance.
//
// Usage: node trial-e.mjs [--runs 5] [--model ...]

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SYS = join(HERE, "systems", "msgledger");
const ACCEPTANCE = join(SYS, "acceptance");
const LEDGER = join(HERE, "systems", "ledger", "codebase", "ledger.py");
const RUNS = join(HERE, "runs", "trial-e");

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MODEL = opt("--model", "claude-opus-4-8");
const N = Number(opt("--runs", "5"));

const TASK =
  "Build a message-driven credit consumer. The file ledger.py provides a `Ledger` class " +
  "(open, balance, deposit, withdraw, transfer, total, accounts). Write consumer.py with a " +
  "class `CreditConsumer(ledger)` whose method on_message(message) applies a credit message " +
  "{\"id\": str, \"account\": str, \"amount\": int} to the ledger. The messages come from the " +
  "message queue whose contract is in QUEUE-CONTRACT.allium — read it and integrate correctly " +
  "with that contract. Accounts are pre-opened. Do not ask questions.";

function claude(prompt, cwd) {
  spawnSync("claude", ["-p", prompt, "--output-format", "stream-json", "--verbose",
    "--model", MODEL, "--max-turns", "40", "--permission-mode", "bypassPermissions", "--setting-sources", "project"],
    { cwd, encoding: "utf8", maxBuffer: 1 << 28, timeout: 900000, killSignal: "SIGKILL" });
}
const reset = (d) => { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); };

function score(implDir) {
  const r = spawnSync("python3", ["-m", "unittest", "discover", "-s", ACCEPTANCE, "-p", "test_*.py"],
    { encoding: "utf8", env: { ...process.env, PYTHONPATH: implDir } });
  const out = (r.stderr || "") + (r.stdout || "");
  const total = Number((out.match(/Ran (\d+) tests/) || [])[1] || 0);
  const bad = Number((out.match(/failures=(\d+)/) || [])[1] || 0) + Number((out.match(/errors=(\d+)/) || [])[1] || 0);
  return { tests: total, passed: total > 0 ? total - bad : 0, ok: total > 0 && bad === 0 };
}

reset(RUNS);
const results = [];
for (let i = 1; i <= N; i++) {
  const ws = join(RUNS, `run-${i}`);
  reset(ws);
  cpSync(LEDGER, join(ws, "ledger.py"));
  cpSync(join(SYS, "QUEUE-CONTRACT.allium"), join(ws, "QUEUE-CONTRACT.allium"));
  console.log(`• baseline build ${i}/${N} …`);
  claude(TASK, ws);
  const built = existsSync(join(ws, "consumer.py"));
  const s = built ? score(ws) : { tests: 0, passed: 0, ok: false };
  results.push({ run: i, built, ...s });
  console.log(`    → ${!built ? "no consumer.py" : s.ok ? "CORRECT (idempotent)" : `WRONG (${s.passed}/${s.tests})`}`);
}

const correct = results.filter((r) => r.ok).length;
writeFileSync(join(RUNS, "summary.json"), JSON.stringify({ trial: "E", arm: "baseline", system: "msgledger", model: MODEL, runs: N, correct, results }, null, 2));
console.log(`\nTrial E (baseline, no checker) — correct integration in ${correct}/${N} runs (model ${MODEL})`);
console.log("(non-saturated if < N; the v4 checker-in-the-loop arm is the target to raise this — needs 4c)");
