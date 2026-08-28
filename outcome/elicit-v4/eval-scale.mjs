#!/usr/bin/env node
// Scale-buried elicit eval. The calibration showed a strong model's in-head consistency
// reasoning fails at scale (hard instances), while obvious contradictions it catches even
// while building. So the elicit+checker delta can only appear on a contradiction buried in
// a large rulebook. Here the "reporting rulebook" is a generated rule set that is
// UNSATISFIABLE via a multi-step chain, buried among ~30 rules — no valid report exists.
//
//   build  — "implement the validators for this rulebook"; realistic. Does it notice the
//            rulebook is self-contradictory (no report can satisfy it), or build silently?
//   elicit — capture as axioms, run `allium analyse`; the sound check reports CONTRADICTORY
//            with the minimal core.
// Usage: node eval-scale.mjs [--arm build|elicit] [--runs 4] [--nvars 18]

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs-scale");
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const LANGREF = readFileSync("/Users/hgarner/code/allium/skills-v4/allium/references/language-reference-v4.md", "utf8");
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ARM = opt("--arm", "build");
const RUNS_N = Number(opt("--runs", "4"));
const NV = Number(opt("--nvars", "18"));
const MODEL = opt("--model", "claude-opus-4-8");

// Domain-framed boolean report attributes.
const ATTR = ["cleared","has_ccp_lei","collateralised","has_code","bespoke","confirmed","has_ts",
  "allocation","has_prior_uti","new_trade","has_uti","credit","has_factor","cross_border",
  "intragroup","package","has_pkg_id","reconciled","dual_sided","amended"].slice(0, NV);
function rng(s){let x=s>>>0;return()=>(x=(x*1664525+1013904223)>>>0)/2**32;}
// Generate a rulebook that is UNSAT via a buried chain, among random fine rules.
function genRulebook(seed) {
  const r = rng(seed); const A = ATTR; const N = A.length;
  const rules = [];
  const pk = () => A[Math.floor(r() * N)];
  for (let i = 0; i < 22; i++) {
    const k = r(), a = pk(); let b = pk(); if (b === a) b = A[(A.indexOf(a) + 1) % N];
    if (k < 0.55) rules.push({ t: "IMPL", a, b });
    else if (k < 0.85) rules.push({ t: "EXCL", a, b });
    else rules.push({ t: r() < 0.5 ? "REQ" : "FORB", a });
  }
  // Buried contradiction chain over 5 attributes, interleaved by shuffling.
  const c = A.slice(0, 5);
  rules.push({ t: "REQ", a: c[0] });
  rules.push({ t: "IMPL", a: c[0], b: c[1] });
  rules.push({ t: "IMPL", a: c[1], b: c[2] });
  rules.push({ t: "IMPL", a: c[2], b: c[3] });
  rules.push({ t: "IMPL", a: c[3], b: c[4] });
  rules.push({ t: "EXCL", a: c[0], b: c[4] }); // c0 true -> ... -> c4 true, but not(c0 and c4)
  for (let i = rules.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rules[i], rules[j]] = [rules[j], rules[i]]; }
  return rules;
}
function prose(rules) {
  return rules.map((x, i) => {
    const n = i + 1;
    if (x.t === "IMPL") return `R${n}: if a report has ${x.a}, it must have ${x.b}`;
    if (x.t === "EXCL") return `R${n}: a report must not have both ${x.a} and ${x.b}`;
    if (x.t === "REQ") return `R${n}: every report has ${x.a}`;
    return `R${n}: no report has ${x.a}`;
  }).join("\n");
}
function v4spec(rules) {
  const used = [...new Set(rules.flatMap((x) => x.b ? [x.a, x.b] : [x.a]))];
  const decls = used.map((a) => `  observable state ${a}(R) : bool`).join("\n");
  const ax = rules.map((x, i) => {
    const n = i + 1;
    if (x.t === "IMPL") return `  axiom r${n} means ${x.a}(r) implies ${x.b}(r)`;
    if (x.t === "EXCL") return `  axiom r${n} means not (${x.a}(r) and ${x.b}(r))`;
    if (x.t === "REQ") return `  axiom r${n} means ${x.a}(r)`;
    return `  axiom r${n} means not ${x.a}(r)`;
  }).join("\n");
  return `-- allium: 4\ncomponent Rulebook\n  entity R\n${decls}\n${ax}\nend\n`;
}
function oracle(rules, ws) {
  writeFileSync(join(ws, "oracle.allium"), v4spec(rules));
  const r = spawnSync(ALLIUM, ["analyse", join(ws, "oracle.allium")], { encoding: "utf8", maxBuffer: 1 << 26, timeout: 60000 });
  const m = (JSON.parse(r.stdout).diagnostics || []).map((d) => d.message || "").find((x) => x.includes("rule set")) || "";
  return m.includes("CONTRADICTORY") ? false : m.includes("satisfiable") ? true : null;
}
function claude(prompt, ws) {
  return spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL,
    "--max-turns", ARM === "elicit" ? "16" : "6", "--permission-mode", "bypassPermissions"],
    { cwd: ws, encoding: "utf8", maxBuffer: 1 << 26, timeout: 480000, killSignal: "SIGKILL" });
}
function surfaced(text) {
  const t = (text || "").toLowerCase();
  if (ARM === "elicit") return /verdict:\s*conflict/.test(t) || (/contradict/.test(t) && !/no contradict/.test(t));
  return /(no valid report|no report can|unsatisfiab|self-contradict|contradict|mutually exclusiv|cannot all|impossible to satisfy|rulebook is inconsistent|no assignment)/.test(t);
}

mkdirSync(RUNS, { recursive: true });
let caught = 0, scored = 0;
for (let i = 0; i < RUNS_N; i++) {
  const ws = join(RUNS, `${ARM}-${i}`); mkdirSync(ws, { recursive: true });
  const rules = genRulebook(1000 + i);
  const sat = oracle(rules, ws);
  if (sat !== false) { console.log(`#${i} oracle not UNSAT (${sat}) - skip`); continue; }
  const brief = `A Trade Repository publishes this report validation rulebook. A report is a set of boolean attributes.\n\nRulebook:\n${prose(rules)}`;
  const prompt = ARM === "elicit"
    ? `Follow the Allium v4 elicitation discipline. ${LANGREF}\n\n${brief}\n\nEncode every rule as an axiom in rulebook.allium (entity R, one 'observable state a(R) : bool' per attribute, one 'axiom rN means ...' per rule; "if a then b" -> a(r) implies b(r); "not both a and b" -> not (a(r) and b(r)); "every report has a" -> a(r); "no report has a" -> not a(r)). Run \`${ALLIUM} analyse rulebook.allium\`. If it reports CONTRADICTORY, the rulebook admits no valid report. On the LAST line: VERDICT: CONFLICT because <core> or VERDICT: FEASIBLE`
    : `You are the engineer. Implement the report-validation logic for this rulebook: describe the validator and the checks it enforces. If you make assumptions, list them under ASSUMPTIONS.\n\n${brief}`;
  const out = claude(prompt, ws);
  const text = out.stdout || ""; writeFileSync(join(ws, "output.txt"), text);
  const s = surfaced(text); scored++; if (s) caught++;
  console.log(`${ARM} #${i} (oracle UNSAT) -> ${s ? "SURFACED self-contradiction" : "silent (MISSED)"}`);
}
console.log(`\n== arm=${ARM}: surfaced the buried self-contradiction in ${caught}/${scored} runs ==`);
writeFileSync(join(RUNS, `result-${ARM}.json`), JSON.stringify({ arm: ARM, model: MODEL, nvars: NV, caught, scored }, null, 2));
