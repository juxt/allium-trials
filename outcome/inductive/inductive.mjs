#!/usr/bin/env node
// Experiment: value #2 as ACCURACY, in the regime it might appear — inductive-invariant
// checking. Models conflate "true" with "inductive": they assert an invariant is preserved
// by every transition when a step from some invariant-satisfying state breaks it. The
// deterministic step-check (SAT of I(s) ∧ T(s,s') ∧ ¬I(s') — a counterexample-to-induction)
// settles it. We measure the model's CONFIDENTLY-WRONG rate against that oracle.
//
// Usage: node inductive.mjs [--arm model|oracle-test] [--sizes 6,9,12] [--per 8]

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs");
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ARM = opt("--arm", "model");
const SIZES = opt("--sizes", "6,9,12").split(",").map(Number); // K actions
const PER = Number(opt("--per", "8"));
const NV = Number(opt("--nvars", "8"));
const MODEL = opt("--model", "claude-opus-4-8");

function rng(s) { let x = s >>> 0; return () => (x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32; }
const F = (i) => `f${i}`, Fn = (i) => `f${i}n`;

// A system: N vars; mutex invariant on (a,b); K guarded actions (guard literal -> set one var).
function gen(N, K, seed) {
  const r = rng(seed);
  const a = 0, b = 1; // invariant: never (f0 and f1)
  const acts = [];
  for (let i = 0; i < K; i++) {
    const gv = Math.floor(r() * N), gp = r() < 0.5;
    let ev = Math.floor(r() * N); if (ev === gv) ev = (ev + 1) % N;
    const eval_ = r() < 0.5;
    acts.push({ gv, gp, ev, eval_ });
  }
  return { N, a, b, acts };
}
function actProse(x) {
  const g = `${F(x.gv)} is ${x.gp ? "true" : "false"}`;
  const e = `set ${F(x.ev)} := ${x.eval_ ? "true" : "false"}`;
  return `when ${g}, ${e} (all other variables unchanged)`;
}
function prose(sys) {
  const vars = Array.from({ length: sys.N }, (_, i) => F(i)).join(", ");
  const acts = sys.acts.map((x, i) => `  T${i + 1}: ${actProse(x)}`).join("\n");
  return `State variables (boolean): ${vars}\n\nTransitions (each fires nondeterministically when its guard holds):\n${acts}\n\nInvariant I: it is never the case that ${F(sys.a)} and ${F(sys.b)} are both true.`;
}
// Oracle: is I step-inductive? Build I(s) ∧ T(s,s') ∧ ¬I(s') and ask the SAT engine.
// SAT (jointly satisfiable) => a CTI exists => NOT inductive. UNSAT => inductive.
function stepSpec(sys) {
  const { N, a, b, acts } = sys;
  const decls = [];
  for (let i = 0; i < N; i++) { decls.push(`  observable state ${F(i)}(x) : bool`); decls.push(`  observable state ${Fn(i)}(x) : bool`); }
  const term = (act) => {
    const guard = act.gp ? `${F(act.gv)}(x)` : `not ${F(act.gv)}(x)`;
    const effect = act.eval_ ? `${Fn(act.ev)}(x)` : `not ${Fn(act.ev)}(x)`;
    const frame = [];
    for (let w = 0; w < N; w++) if (w !== act.ev) frame.push(`(${Fn(w)}(x) implies ${F(w)}(x)) and (${F(w)}(x) implies ${Fn(w)}(x))`);
    return `((${guard}) and (${effect}) and (${frame.join(" and ")}))`;
  };
  const T = acts.map(term).join(" or ");
  const I = `not (${F(a)}(x) and ${F(b)}(x))`;      // I(s)
  const notIp = `${Fn(a)}(x) and ${Fn(b)}(x)`;       // ¬I(s')
  const ax = [`  axiom inv means ${I}`, `  axiom trans means ${T}`, `  axiom breaks means ${notIp}`].join("\n");
  return `-- allium: 4\ncomponent Step\n  entity X\n${decls.join("\n")}\n${ax}\nend\n`;
}
function oracle(sys, ws) {
  writeFileSync(join(ws, "step.allium"), stepSpec(sys));
  const r = spawnSync(ALLIUM, ["analyse", join(ws, "step.allium")], { encoding: "utf8", maxBuffer: 1 << 26, timeout: 60000 });
  const m = (JSON.parse(r.stdout).diagnostics || []).map((d) => d.message || "").find((x) => x.includes("rule set")) || "";
  if (m.includes("CONTRADICTORY")) return { inductive: true };           // no CTI
  if (m.includes("jointly satisfiable")) return { inductive: false };    // CTI exists
  return { inductive: null };
}
function claude(prompt, ws) {
  return spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL,
    "--max-turns", "3", "--permission-mode", "bypassPermissions",
    "--disallowedTools", "Bash Edit Write Read Glob Grep WebFetch WebSearch Task NotebookEdit"],
    { cwd: ws, encoding: "utf8", maxBuffer: 1 << 26, timeout: 300000, killSignal: "SIGKILL" });
}
function parse(text) {
  const t = text || "";
  const v = /VERDICT:\s*INDUCTIVE/i.test(t) && !/NOT-?INDUCTIVE/i.test(t.match(/VERDICT:[^\n]*/i)?.[0] || "") ? true
    : /VERDICT:\s*NOT-?INDUCTIVE/i.test(t) ? false : null;
  const cm = t.match(/CONFIDENCE:\s*(\d+)/i);
  return { inductive: v, conf: cm ? Number(cm[1]) : null };
}

mkdirSync(RUNS, { recursive: true });

if (ARM === "oracle-test") {
  // Validate the oracle on a hand case: T1 "when f0, set f1:=true" makes mutex NOT inductive.
  const ws = join(RUNS, "oracle-test"); mkdirSync(ws, { recursive: true });
  const sys = { N: 3, a: 0, b: 1, acts: [{ gv: 0, gp: true, ev: 1, eval_: true }] };
  console.log("hand case (f0 -> set f1: from f0&!f1 reach f0&f1) expect NOT inductive:", oracle(sys, ws));
  const sys2 = { N: 3, a: 0, b: 1, acts: [{ gv: 2, gp: true, ev: 2, eval_: true }] };
  console.log("hand case (f2 -> set f2, never touches f0/f1) expect inductive:", oracle(sys2, ws));
  process.exit(0);
}

const buckets = { high: { n: 0, wrong: 0, cwrong_ind: 0 }, mid: { n: 0, wrong: 0 }, low: { n: 0, wrong: 0 } };
let confWrongSaysInductive = 0, indCases = 0, nonIndCases = 0;
for (const K of SIZES) {
  for (let i = 0; i < PER; i++) {
    const ws = join(RUNS, `K${K}-${i}`); mkdirSync(ws, { recursive: true });
    const sys = gen(NV, K, K * 104729 + i);
    const ora = oracle(sys, ws);
    if (ora.inductive === null) continue;
    if (ora.inductive) indCases++; else nonIndCases++;
    const prompt =
      `A transition system.\n\n${prose(sys)}\n\n` +
      `Is I INDUCTIVE — i.e. preserved by every transition from every state in which I holds? ` +
      `(Not merely reachable-true: does every guarded transition, from any state satisfying I, ` +
      `land in a state still satisfying I?)\nAnswer two lines exactly:\n` +
      `VERDICT: INDUCTIVE  (or)  VERDICT: NOT-INDUCTIVE\nCONFIDENCE: <0-100>`;
    const out = claude(prompt, ws);
    const a = parse(out.stdout || "");
    if (a.inductive === null || a.conf === null) { console.log(`K=${K} #${i} unparsed`); continue; }
    const correct = a.inductive === ora.inductive;
    const b = a.conf >= 85 ? "high" : a.conf >= 60 ? "mid" : "low";
    buckets[b].n++; if (!correct) buckets[b].wrong++;
    // the dangerous case: confidently says INDUCTIVE when it is NOT (a CTI exists)
    const dangerous = a.conf >= 85 && a.inductive === true && ora.inductive === false;
    if (dangerous) confWrongSaysInductive++;
    console.log(`K=${K} #${i} oracle=${ora.inductive ? "IND" : "not-IND"} said=${a.inductive ? "IND" : "not-IND"} conf=${a.conf} -> ${correct ? "ok" : "WRONG"}${dangerous ? "  <-- CONFIDENTLY says INDUCTIVE but a CTI exists" : ""}`);
  }
}
console.log(`\n== inductive-invariant judgement (in-head) ==`);
console.log(`  cases: ${indCases} inductive, ${nonIndCases} not-inductive`);
for (const b of ["high", "mid", "low"]) { const x = buckets[b]; if (x.n) console.log(`  ${b}: ${x.wrong}/${x.n} wrong = ${(100 * x.wrong / x.n).toFixed(0)}%`); }
console.log(`  CONFIDENTLY-WRONG (says INDUCTIVE, conf>=85, but a CTI exists): ${confWrongSaysInductive}  <- the assurance-as-accuracy residual`);
writeFileSync(join(RUNS, "result.json"), JSON.stringify({ buckets, confWrongSaysInductive, indCases, nonIndCases }, null, 2));
