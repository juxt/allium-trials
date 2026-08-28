#!/usr/bin/env node
// Hard-instance three-arm benchmark. Random 3-SAT at the phase-transition ratio (~4.3
// clauses/variable), where deciding SAT/UNSAT genuinely requires search — the regime where
// in-head reasoning breaks and a sound checker is decisive. Framed as a rulebook: each rule
// says at least one of three field-conditions holds. Oracle = allium analyse (DPLL, sound).
//
// Arms: alone (1 turn, no tools) | v4 (model encodes + runs `allium analyse`).
// Usage: node sat3.mjs [--arm alone|v4] [--sizes 15,25,35] [--per 8] [--ratio 4.3]

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs", "sat3");
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SIZES = opt("--sizes", "15,25,35").split(",").map(Number); // N (variables)
const PER = Number(opt("--per", "8"));
const RATIO = Number(opt("--ratio", "4.3"));
const MODEL = opt("--model", "claude-opus-4-8");
const ARM = opt("--arm", "alone");

function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; }
const F = (i) => `f${i}`;

// M random 3-clauses over N vars: each clause = 3 distinct vars, each with random polarity.
function gen(N, seed) {
  const r = rng(seed);
  const M = Math.round(RATIO * N);
  const clauses = [];
  for (let i = 0; i < M; i++) {
    const vs = new Set();
    while (vs.size < 3) vs.add(Math.floor(r() * N));
    clauses.push([...vs].map((v) => ({ v, pos: r() < 0.5 })));
  }
  return clauses;
}
function prose(clauses, N) {
  const lines = clauses.map((c, i) =>
    `R${i + 1}: at least one of { ${c.map((l) => `${F(l.v)} is ${l.pos ? "true" : "false"}`).join(", ")} }`);
  return `Fields (each true or false): ${Array.from({ length: N }, (_, i) => F(i)).join(", ")}\n\nRules:\n${lines.join("\n")}`;
}
function v4spec(clauses, N) {
  const decls = Array.from({ length: N }, (_, i) => `  observable state ${F(i)}(X) : bool`).join("\n");
  const ax = clauses.map((c, i) =>
    `  axiom r${i + 1} means ${c.map((l) => (l.pos ? `${F(l.v)}(x)` : `not ${F(l.v)}(x)`)).join(" or ")}`).join("\n");
  return `-- allium: 4\ncomponent C\n  entity X\n${decls}\n${ax}\nend\n`;
}
function oracle(clauses, N, ws) {
  writeFileSync(join(ws, "oracle.allium"), v4spec(clauses, N));
  const r = spawnSync(ALLIUM, ["analyse", join(ws, "oracle.allium")], { encoding: "utf8", maxBuffer: 1 << 26, timeout: 60000 });
  let diags = []; try { diags = JSON.parse(r.stdout).diagnostics || []; } catch { return { sat: null }; }
  const m = diags.map((d) => d.message || "").find((x) => x.includes("rule set")) || "";
  if (m.includes("CONTRADICTORY")) return { sat: false };
  if (m.includes("jointly satisfiable")) return { sat: true };
  return { sat: null };
}
function verify(assign, clauses) {
  const v = (i) => assign[`f${i}`] === true;
  return clauses.every((c) => c.some((l) => (l.pos ? v(l.v) : !v(l.v))));
}
function claude(prompt, ws, turns) {
  return spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL,
    "--max-turns", String(turns), "--permission-mode", "bypassPermissions"],
    { cwd: ws, encoding: "utf8", maxBuffer: 1 << 26, timeout: 480000, killSignal: "SIGKILL" });
}
function parseAnswer(text) {
  const lines = (text || "").trim().split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^IMPOSSIBLE\b/i.test(lines[i])) return { impossible: true };
    if (/^ASSIGN\b/i.test(lines[i])) {
      const a = {}; for (const kv of lines[i].matchAll(/(f\d+)\s*=\s*([TF])/gi)) a[kv[1]] = kv[2].toUpperCase() === "T";
      return { assign: a };
    }
  }
  if (/IMPOSSIBLE/i.test(text)) return { impossible: true };
  return { assign: {} };
}
const V4_GUIDE = (N) =>
  `You have a sound checker. Write spec.allium encoding the rules, then run it.\n` +
  `Format:\n-- allium: 4\ncomponent C\n  entity X\n  observable state f0(X) : bool  (f0..f${N - 1})\n` +
  `  axiom r1 means <clause 1>  (one axiom per rule)\nend\n` +
  `Each rule "at least one of { fa is true, fb is false, fc is true }" becomes: fa(x) or not fb(x) or fc(x).\n` +
  `Then run:  ${ALLIUM} analyse spec.allium\n` +
  `If a message says "CONTRADICTORY" the rules are unsatisfiable; if "jointly satisfiable (e.g. <witness>)" that witness satisfies them (fields not shown are free, set F).\n`;

mkdirSync(RUNS, { recursive: true });
const results = [];
for (const N of SIZES) {
  const by = { SAT: { c: 0, n: 0 }, UNSAT: { c: 0, n: 0 } };
  for (let i = 0; i < PER; i++) {
    const ws = join(RUNS, `${ARM}-N${N}-${i}`); mkdirSync(ws, { recursive: true });
    const clauses = gen(N, N * 1000 + i);
    const ora = oracle(clauses, N, ws);
    if (ora.sat === null) continue;
    const guide = ARM === "v4" ? V4_GUIDE(N) : "";
    const prompt =
      `You are validating a report against a rulebook. ${prose(clauses, N)}\n\n` +
      `Decide whether some assignment of every field satisfies EVERY rule.\n` + guide +
      `\nAnswer on the LAST line, EXACTLY: ASSIGN: f0=T f1=F ... (all ${N})  or  IMPOSSIBLE`;
    const out = claude(prompt, ws, ARM === "v4" ? 14 : 1);
    const ans = parseAnswer(out.stdout || "");
    const ok = ora.sat === false ? ans.impossible === true : (ans.assign ? verify(ans.assign, clauses) : false);
    const lab = ora.sat ? "SAT" : "UNSAT"; by[lab].n++; if (ok) by[lab].c++;
    console.log(`${ARM} N=${N} #${i} oracle=${lab} -> ${ok ? "ok" : "WRONG"}`);
  }
  const n = by.SAT.n + by.UNSAT.n, c = by.SAT.c + by.UNSAT.c;
  results.push({ N, M: Math.round(RATIO * N), acc: n ? +(c / n).toFixed(2) : 0, sat: by.SAT, unsat: by.UNSAT });
  console.log(`== ${ARM} N=${N} (M=${Math.round(RATIO * N)}): ${c}/${n} acc ${n ? (c / n).toFixed(2) : 0} | SAT ${by.SAT.c}/${by.SAT.n} | UNSAT ${by.UNSAT.c}/${by.UNSAT.n} ==\n`);
}
console.log(`SUMMARY arm=${ARM}:`);
for (const r of results) console.log(`  N=${r.N} M=${r.M}: acc ${r.acc} | find-SAT ${r.sat.c}/${r.sat.n} | prove-UNSAT ${r.unsat.c}/${r.unsat.n}`);
writeFileSync(join(RUNS, `sat3-${ARM}.json`), JSON.stringify(results, null, 2));
