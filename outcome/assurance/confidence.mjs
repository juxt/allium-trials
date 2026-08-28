#!/usr/bin/env node
// Experiment B — the deterministic-assurance gap (value proposition #2). A capable model
// can claim a property with high confidence, but not 100%. This measures the residual that
// determinism eliminates: how often the model is CONFIDENTLY WRONG on a consistency verdict
// it asserts by reasoning (tools disabled, isolating the claim). The oracle is `allium
// analyse` (deterministic ground truth).
//
// For each instance the model answers  VERDICT: SATISFIABLE|IMPOSSIBLE  and  CONFIDENCE: 0-100.
// We bucket by confidence and report the error rate per bucket; the high-confidence error
// rate is the assurance gap.
// Usage: node confidence.mjs [--sizes 10,18,26] [--per 8]

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs");
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SIZES = opt("--sizes", "10,18,26").split(",").map(Number);
const PER = Number(opt("--per", "8"));
const MODEL = opt("--model", "claude-opus-4-8");

function rng(s) { let x = s >>> 0; return () => (x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32; }
const F = (i) => `f${i}`;
function gen(N, M, seed, forceUnsat) {
  const r = rng(seed); const pick = () => Math.floor(r() * N); const rules = [];
  for (let i = 0; i < M; i++) {
    const k = r();
    if (k < 0.5) { let a = pick(), b = pick(); if (a === b) b = (b + 1) % N; rules.push({ t: "IMPL", a, b }); }
    else if (k < 0.8) { let a = pick(), b = pick(); if (a === b) b = (b + 1) % N; rules.push({ t: "EXCL", a, b }); }
    else if (k < 0.9) rules.push({ t: "REQ", a: pick() });
    else rules.push({ t: "FORB", a: pick() });
  }
  if (forceUnsat) { for (let i = 0; i < 3; i++) rules.push({ t: "IMPL", a: i, b: i + 1 }); rules.push({ t: "EXCL", a: 3, b: 3 }); rules.push({ t: "REQ", a: 0 }); }
  return rules;
}
function prose(rules, N) {
  const L = rules.map((r, i) => {
    const n = i + 1;
    if (r.t === "IMPL") return `R${n}: if ${F(r.a)} then ${F(r.b)}`;
    if (r.t === "EXCL") return `R${n}: not both ${F(r.a)} and ${F(r.b)}`;
    if (r.t === "REQ") return `R${n}: ${F(r.a)} is true`;
    return `R${n}: ${F(r.a)} is false`;
  });
  return `Fields: ${Array.from({ length: N }, (_, i) => F(i)).join(", ")}\nRules:\n${L.join("\n")}`;
}
function v4spec(rules, N) {
  const d = Array.from({ length: N }, (_, i) => `  observable state ${F(i)}(X) : bool`).join("\n");
  const a = rules.map((r, i) => {
    const n = i + 1;
    if (r.t === "IMPL") return `  axiom r${n} means ${F(r.a)}(x) implies ${F(r.b)}(x)`;
    if (r.t === "EXCL") return `  axiom r${n} means not (${F(r.a)}(x) and ${F(r.b)}(x))`;
    if (r.t === "REQ") return `  axiom r${n} means ${F(r.a)}(x)`;
    return `  axiom r${n} means not ${F(r.a)}(x)`;
  }).join("\n");
  return `-- allium: 4\ncomponent C\n  entity X\n${d}\n${a}\nend\n`;
}
function oracle(rules, N, ws) {
  writeFileSync(join(ws, "o.allium"), v4spec(rules, N));
  const r = spawnSync(ALLIUM, ["analyse", join(ws, "o.allium")], { encoding: "utf8", maxBuffer: 1 << 26, timeout: 60000 });
  const m = (JSON.parse(r.stdout).diagnostics || []).map((d) => d.message || "").find((x) => x.includes("rule set")) || "";
  return m.includes("CONTRADICTORY") ? false : m.includes("satisfiable") ? true : null;
}
function claude(prompt, ws) {
  return spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL,
    "--max-turns", "3", "--permission-mode", "bypassPermissions",
    "--disallowedTools", "Bash Edit Write Read Glob Grep WebFetch WebSearch Task NotebookEdit"],
    { cwd: ws, encoding: "utf8", maxBuffer: 1 << 26, timeout: 300000, killSignal: "SIGKILL" });
}
function parse(text) {
  const t = text || "";
  const sat = /VERDICT:\s*SATISF/i.test(t) ? true : /VERDICT:\s*(IMPOSS|UNSAT|CONTRADICT)/i.test(t) ? false : null;
  const cm = t.match(/CONFIDENCE:\s*(\d+)/i);
  return { sat, conf: cm ? Number(cm[1]) : null };
}

mkdirSync(RUNS, { recursive: true });
const buckets = { high: { n: 0, wrong: 0 }, mid: { n: 0, wrong: 0 }, low: { n: 0, wrong: 0 } };
const rows = [];
for (const M of SIZES) {
  const N = Math.max(6, Math.round(M / 2));
  for (let i = 0; i < PER; i++) {
    const ws = join(RUNS, `M${M}-${i}`); mkdirSync(ws, { recursive: true });
    const rules = gen(N, M, M * 7919 + i, i % 2 === 1);
    const truth = oracle(rules, N, ws);
    if (truth === null) continue;
    const prompt =
      `Determine whether these rules can all hold at once (is there an assignment of every field ` +
      `to true/false satisfying every rule).\n\n${prose(rules, N)}\n\n` +
      `Answer with two lines exactly:\nVERDICT: SATISFIABLE  (or)  VERDICT: IMPOSSIBLE\nCONFIDENCE: <0-100, your honest confidence>`;
    const out = claude(prompt, ws);
    const a = parse(out.stdout || "");
    if (a.sat === null || a.conf === null) { console.log(`M=${M} #${i} -> unparsed`); continue; }
    const correct = a.sat === truth;
    const b = a.conf >= 85 ? "high" : a.conf >= 60 ? "mid" : "low";
    buckets[b].n++; if (!correct) buckets[b].wrong++;
    rows.push({ M, i, truth, said: a.sat, conf: a.conf, correct });
    console.log(`M=${M} #${i} truth=${truth ? "SAT" : "UNSAT"} said=${a.sat ? "SAT" : "UNSAT"} conf=${a.conf} -> ${correct ? "ok" : "WRONG"}${!correct && a.conf >= 85 ? "  <-- CONFIDENTLY WRONG" : ""}`);
  }
}
console.log("\n== confidence vs correctness (the assurance gap is the high-confidence error rate) ==");
for (const b of ["high", "mid", "low"]) {
  const x = buckets[b]; if (x.n) console.log(`  ${b} (conf ${b === "high" ? ">=85" : b === "mid" ? "60-84" : "<60"}): ${x.wrong}/${x.n} wrong = ${(100 * x.wrong / x.n).toFixed(0)}%`);
}
writeFileSync(join(RUNS, "confidence.json"), JSON.stringify({ buckets, rows }, null, 2));
