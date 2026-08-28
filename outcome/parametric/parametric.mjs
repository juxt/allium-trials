#!/usr/bin/env node
// Parametric / EPR inductive probe (in scope: N6-compliant, decidable spine). The model is
// asked the genuinely-parametric question — "is this mutual-exclusion invariant inductive for
// ANY number of processes N?" — which its in-head reasoning cannot settle by enumeration. The
// oracle is the EPR step-check GROUNDED over a fixed 3 processes: for this quantifier depth
// (invariant ∀i,j, action picks one process, ¬I' witnesses 2), 3 processes are sound AND
// complete for finding a counterexample-to-induction. We measure the confidently-wrong rate,
// especially "says INDUCTIVE for all N but a CTI exists".
//
// Usage: node parametric.mjs [--arm model|oracle-test] [--per 4]

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
const PER = Number(opt("--per", "4"));
const MODEL = opt("--model", "claude-opus-4-8");
const P = [0, 1, 2]; // grounding set (sound+complete for this EPR family)

// Guard variants for enter_i (parametric). Each is (i, allProcs) -> predicate string over
// ground atoms want{j}/crit{j}. And a prose form for the model (parametric).
const GUARDS = {
  strong_all:     { prose: "want(i) and no process is in crit",              ground: (i) => `want${i}(x) and ` + P.map((j) => `not crit${j}(x)`).join(" and ") },
  strong_others:  { prose: "want(i) and no OTHER process is in crit",        ground: (i) => `want${i}(x)` + P.filter((j) => j !== i).map((j) => ` and not crit${j}(x)`).join("") },
  self_only:      { prose: "want(i) and process i is not already in crit",   ground: (i) => `want${i}(x) and not crit${i}(x)` },
  priority_want:  { prose: "want(i) and no lower-numbered process wants",     ground: (i) => `want${i}(x)` + P.filter((j) => j < i).map((j) => ` and not want${j}(x)`).join("") },
};

// Build the grounded step-VC spec: I(s) ∧ T(s,s') ∧ ¬I(s').  SAT => CTI => not inductive.
function stepSpec(guardKey) {
  const g = GUARDS[guardKey];
  const decls = [];
  for (const j of P) { for (const v of ["want", "crit"]) { decls.push(`  observable state ${v}${j}(x) : bool`); decls.push(`  observable state ${v}${j}n(x) : bool`); } }
  const frameExcept = (setVars) => P.flatMap((j) => ["want", "crit"].map((v) => `${v}${j}`)).filter((a) => !setVars.includes(a))
    .map((a) => `(${a}n(x) implies ${a}(x)) and (${a}(x) implies ${a}n(x))`).join(" and ");
  const terms = [];
  for (const i of P) {
    // request_i: set want_i := true
    terms.push(`((true) and want${i}n(x) and ${frameExcept([`want${i}`])})`);
    // exit_i: guard crit_i, set crit_i:=F, want_i:=F
    terms.push(`(crit${i}(x) and not crit${i}n(x) and not want${i}n(x) and ${frameExcept([`crit${i}`, `want${i}`])})`);
    // enter_i: guard variant, set crit_i := true
    terms.push(`((${g.ground(i)}) and crit${i}n(x) and ${frameExcept([`crit${i}`])})`);
  }
  const T = terms.join(" or ");
  const mutex = (suffix) => {
    const cl = [];
    for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) cl.push(`not (crit${P[a]}${suffix}(x) and crit${P[b]}${suffix}(x))`);
    return cl.join(" and ");
  };
  const I = mutex("");                                   // I(s)
  // ¬I(s'): some pair both crit in next state
  const notIp = P.flatMap((a, ai) => P.slice(ai + 1).map((b) => `(crit${a}n(x) and crit${b}n(x))`)).join(" or ");
  const ax = [`  axiom inv means ${I}`, `  axiom trans means ${T}`, `  axiom breaks means ${notIp}`].join("\n");
  return `-- allium: 4\ncomponent Step\n  entity X\n${decls.join("\n")}\n${ax}\nend\n`;
}
function oracle(guardKey, ws) {
  writeFileSync(join(ws, "step.allium"), stepSpec(guardKey));
  const r = spawnSync(ALLIUM, ["analyse", join(ws, "step.allium")], { encoding: "utf8", maxBuffer: 1 << 26, timeout: 60000 });
  const m = (JSON.parse(r.stdout).diagnostics || []).map((d) => d.message || "").find((x) => x.includes("rule set")) || "";
  if (m.includes("CONTRADICTORY")) return { inductive: true };
  if (m.includes("jointly satisfiable")) return { inductive: false };
  return { inductive: null };
}
function prose(guardKey) {
  return `A mutual-exclusion protocol over N processes (N arbitrary). Each process i has two boolean flags: want(i) and crit(i).\n` +
    `Any process i may take a step:\n` +
    `  - request: set want(i) := true.\n` +
    `  - enter: if [ ${GUARDS[guardKey].prose} ], set crit(i) := true.\n` +
    `  - exit: if crit(i), set crit(i) := false and want(i) := false.\n` +
    `Invariant I (mutual exclusion): no two distinct processes are both in crit at once (for all i != j, not (crit(i) and crit(j))).`;
}
function claude(prompt, ws) {
  return spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL,
    "--max-turns", "3", "--permission-mode", "bypassPermissions",
    "--disallowedTools", "Bash Edit Write Read Glob Grep WebFetch WebSearch Task NotebookEdit"],
    { cwd: ws, encoding: "utf8", maxBuffer: 1 << 26, timeout: 300000, killSignal: "SIGKILL" });
}
function parse(text) {
  const t = text || "";
  const seg = t.match(/VERDICT:[^\n]*/i)?.[0] || "";
  const v = /NOT-?INDUCTIVE/i.test(seg) ? false : /INDUCTIVE/i.test(seg) ? true : null;
  const cm = t.match(/CONFIDENCE:\s*(\d+)/i);
  return { inductive: v, conf: cm ? Number(cm[1]) : null };
}

mkdirSync(RUNS, { recursive: true });
if (ARM === "oracle-test") {
  const ws = join(RUNS, "oracle-test"); mkdirSync(ws, { recursive: true });
  for (const k of Object.keys(GUARDS)) console.log(`${k}: ${JSON.stringify(oracle(k, ws))}`);
  process.exit(0);
}

let confWrongInd = 0, wrong = 0, scored = 0;
const byGuard = {};
for (const k of Object.keys(GUARDS)) {
  const ora = oracle(k, join(RUNS, `o-${k}`)); mkdirSync(join(RUNS, `o-${k}`), { recursive: true });
  byGuard[k] = { truth: ora.inductive, said: [] };
  for (let i = 0; i < PER; i++) {
    const ws = join(RUNS, `${k}-${i}`); mkdirSync(ws, { recursive: true });
    const prompt = `${prose(k)}\n\nIs I INDUCTIVE for ANY number of processes N — i.e. does every step, from every state satisfying I (with any N), land in a state still satisfying I? Answer two lines exactly:\nVERDICT: INDUCTIVE  (or)  VERDICT: NOT-INDUCTIVE\nCONFIDENCE: <0-100>`;
    const a = parse(claude(prompt, ws).stdout || "");
    if (a.inductive === null || a.conf === null) { console.log(`${k} #${i} unparsed`); continue; }
    scored++;
    const correct = a.inductive === ora.inductive;
    if (!correct) wrong++;
    const dangerous = a.conf >= 85 && a.inductive === true && ora.inductive === false;
    if (dangerous) confWrongInd++;
    byGuard[k].said.push(`${a.inductive ? "IND" : "not"}@${a.conf}`);
    console.log(`${k} (oracle ${ora.inductive ? "IND" : "not-IND"}) #${i}: said ${a.inductive ? "IND" : "not-IND"} conf=${a.conf} -> ${correct ? "ok" : "WRONG"}${dangerous ? "  <-- CONFIDENTLY says INDUCTIVE for all N, but a CTI exists" : ""}`);
  }
}
console.log("\n== parametric inductive judgement ==");
for (const k of Object.keys(GUARDS)) console.log(`  ${k}: oracle=${byGuard[k].truth ? "INDUCTIVE" : "not-inductive"}  model=[${byGuard[k].said.join(", ")}]`);
console.log(`\n  wrong ${wrong}/${scored}; CONFIDENTLY-WRONG (says INDUCTIVE for all N, conf>=85, CTI exists): ${confWrongInd}  <- the in-scope assurance-as-accuracy residual`);
writeFileSync(join(RUNS, "result.json"), JSON.stringify({ byGuard, wrong, scored, confWrongInd }, null, 2));
