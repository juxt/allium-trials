#!/usr/bin/env node
// Calibration: find where an unaided LLM breaks on constraint-satisfaction design, so the
// three-arm benchmark (LLM alone / +v3 / +v4) has a NON-SATURATED operating point.
//
// Task: given M interacting rules over N boolean report fields, produce a valid report (an
// assignment satisfying every rule) or determine it is IMPOSSIBLE. This reduces to SAT,
// which LLMs do unreliably in-head at scale but a checker does instantly. The oracle is
// `allium analyse` (sound). We scale M and measure the unaided model's accuracy.
//
// Usage: node calibrate.mjs [--sizes 12,24,40] [--per 6] [--model ...] [--arm alone]

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs", "calibrate");
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SIZES = opt("--sizes", "12,24,40").split(",").map(Number);
const PER = Number(opt("--per", "6"));
const MODEL = opt("--model", "claude-opus-4-8");

// Deterministic-ish RNG seeded per instance for reproducibility.
function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; }

// Generate M rules over N fields. Rule kinds: IMPL a->b, EXCL not(a and b), REQ a, FORB not a.
function genInstance(N, M, seed, forceUnsat) {
  const r = rng(seed);
  const pick = () => Math.floor(r() * N);
  const rules = [];
  for (let i = 0; i < M; i++) {
    const k = r();
    if (k < 0.5) { let a = pick(), b = pick(); if (a === b) b = (b + 1) % N; rules.push({ t: "IMPL", a, b }); }
    else if (k < 0.8) { let a = pick(), b = pick(); if (a === b) b = (b + 1) % N; rules.push({ t: "EXCL", a, b }); }
    else if (k < 0.9) rules.push({ t: "REQ", a: pick() });
    else rules.push({ t: "FORB", a: pick() });
  }
  if (forceUnsat) {
    // Plant a contradiction chain over a few fields: x0->x1->..->xk, xk-> not x0, REQ x0.
    const chain = 4;
    for (let i = 0; i < chain - 1; i++) rules.push({ t: "IMPL", a: i, b: i + 1 });
    rules.push({ t: "EXCL", a: chain - 1, b: chain - 1 }); // not(x and x) = not x, forces x_{chain-1}=F
    // ensure the chain forces a contradiction: REQ x0, and x0->..->x_{chain-1}, but x_{chain-1}=F
    rules.push({ t: "REQ", a: 0 });
  }
  return rules;
}

const F = (i) => `f${i}`;
function prose(rules, N) {
  const lines = rules.map((r, i) => {
    const n = i + 1;
    if (r.t === "IMPL") return `R${n}: if ${F(r.a)} then ${F(r.b)}`;
    if (r.t === "EXCL") return `R${n}: not both ${F(r.a)} and ${F(r.b)}`;
    if (r.t === "REQ") return `R${n}: ${F(r.a)} is true`;
    return `R${n}: ${F(r.a)} is false`;
  });
  return `Fields (each true or false): ${Array.from({ length: N }, (_, i) => F(i)).join(", ")}\n\nRules:\n${lines.join("\n")}`;
}
function v4spec(rules, N) {
  const decls = Array.from({ length: N }, (_, i) => `  observable state ${F(i)}(X) : bool`).join("\n");
  const ax = rules.map((r, i) => {
    const n = i + 1;
    if (r.t === "IMPL") return `  axiom r${n} means ${F(r.a)}(x) implies ${F(r.b)}(x)`;
    if (r.t === "EXCL") return `  axiom r${n} means not (${F(r.a)}(x) and ${F(r.b)}(x))`;
    if (r.t === "REQ") return `  axiom r${n} means ${F(r.a)}(x)`;
    return `  axiom r${n} means not ${F(r.a)}(x)`;
  }).join("\n");
  return `-- allium: 4\ncomponent C\n  entity X\n${decls}\n${ax}\nend\n`;
}

function oracle(rules, N, ws) {
  const path = join(ws, "oracle.allium");
  writeFileSync(path, v4spec(rules, N));
  const r = spawnSync(ALLIUM, ["analyse", path], { encoding: "utf8", maxBuffer: 1 << 26 });
  let diags = [];
  try { diags = JSON.parse(r.stdout).diagnostics || []; } catch { return { sat: null }; }
  const msg = diags.map((d) => d.message || "").find((m) => m.includes("rule set")) || "";
  if (msg.includes("CONTRADICTORY")) return { sat: false };
  if (msg.includes("jointly satisfiable")) return { sat: true };
  return { sat: null };
}

// Verify a model assignment satisfies every rule (deterministic).
function verify(assign, rules) {
  const v = (i) => assign[`f${i}`] === true;
  for (const r of rules) {
    if (r.t === "IMPL" && v(r.a) && !v(r.b)) return false;
    if (r.t === "EXCL" && v(r.a) && v(r.b)) return false;
    if (r.t === "REQ" && !v(r.a)) return false;
    if (r.t === "FORB" && v(r.a)) return false;
  }
  return true;
}

function claudeAlone(promptText, ws) {
  return spawnSync("claude", ["-p", promptText, "--output-format", "text",
    "--model", MODEL, "--max-turns", "1", "--permission-mode", "bypassPermissions"],
    { cwd: ws, encoding: "utf8", maxBuffer: 1 << 26, timeout: 300000, killSignal: "SIGKILL" });
}

function parseAnswer(text) {
  if (/IMPOSSIBLE/i.test(text) && !/ASSIGN/i.test(text)) return { impossible: true };
  const m = text.match(/ASSIGN[:\s]*([^\n]*)/i);
  if (!m) return { impossible: /IMPOSSIBLE/i.test(text) };
  const assign = {};
  for (const tok of m[1].split(/[\s,]+/)) {
    const kv = tok.match(/(f\d+)\s*=\s*([TF])/i);
    if (kv) assign[kv[1]] = kv[2].toUpperCase() === "T";
  }
  return { assign };
}

rmSync(RUNS, { recursive: true, force: true });
mkdirSync(RUNS, { recursive: true });
const results = [];
let seed = 1;
for (const M of SIZES) {
  const N = Math.max(6, Math.round(M / 2));
  let correct = 0, scored = 0;
  const by = { SAT: { c: 0, n: 0 }, UNSAT: { c: 0, n: 0 } };
  for (let i = 0; i < PER; i++) {
    const ws = join(RUNS, `M${M}-${i}`); mkdirSync(ws, { recursive: true });
    const forceUnsat = i % 2 === 1; // half aim for UNSAT
    const rules = genInstance(N, M, seed++, forceUnsat);
    const ora = oracle(rules, N, ws);
    if (ora.sat === null) continue;
    const prompt =
      `You are validating a report against a rulebook. ${prose(rules, N)}\n\n` +
      `Find an assignment of EVERY field to true/false that satisfies EVERY rule, or determine none exists. ` +
      `Answer on one line, EXACTLY one of:\n  ASSIGN: f0=T f1=F ... (all ${N} fields)\n  IMPOSSIBLE`;
    const out = claudeAlone(prompt, ws);
    const ans = parseAnswer(out.stdout || "");
    let ok;
    if (ora.sat === false) ok = ans.impossible === true;
    else ok = ans.assign ? verify(ans.assign, rules) : false;
    scored++; if (ok) correct++;
    const lab = ora.sat ? "SAT" : "UNSAT"; by[lab].n++; if (ok) by[lab].c++;
    console.log(`M=${M} #${i} oracle=${lab} model=${ans.impossible ? "IMPOSSIBLE" : "assign"} -> ${ok ? "ok" : "WRONG"}`);
  }
  const acc = scored ? (correct / scored) : 0;
  results.push({ M, N, scored, correct, acc: +acc.toFixed(2), sat: by.SAT, unsat: by.UNSAT });
  console.log(`== M=${M}: ${correct}/${scored} (acc ${acc.toFixed(2)}) | SAT ${by.SAT.c}/${by.SAT.n} | UNSAT ${by.UNSAT.c}/${by.UNSAT.n} ==\n`);
}
console.log("SUMMARY (unaided LLM accuracy vs rule count):");
for (const r of results) console.log(`  M=${r.M} N=${r.N}: overall ${r.acc} | find-SAT ${r.sat.c}/${r.sat.n} | prove-UNSAT ${r.unsat.c}/${r.unsat.n}`);
writeFileSync(join(RUNS, "calibrate.json"), JSON.stringify(results, null, 2));
