#!/usr/bin/env node
// Distil-at-scale — the first real test of the phase. Can a model distil the SALIENT
// behavioural invariants from Fineract's 2204-line ProgressiveEMICalculator (real, messy,
// complex code) into a spec, faithfully and completely? Scored against the 7 reference
// invariants (LoanScheduleInvariants.allium), which were distilled by hand from the code +
// the numeric test oracle. The model works agentically (it Reads the large file).
//
// Usage: node distill-scale.mjs [--runs 3]

import { spawnSync } from "node:child_process";
import { mkdirSync, cpSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs-distill");
const CALC = join(HERE, "checkout", "fineract-progressive-loan", "src", "main", "java",
  "org", "apache", "fineract", "portfolio", "loanproduct", "calc", "ProgressiveEMICalculator.java");
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const N = Number(opt("--runs", "3"));
const MODEL = opt("--model", "claude-opus-4-8");

// The 7 reference invariants and detectors (loose; eyeball confirms).
const REF = [
  { id: "I1-emi-constant", re: /(emi|instal\w*)[\s\S]{0,60}(constant|same|equal|fixed|identical)|(constant|equal|same)[\s\S]{0,30}(emi|instal)/i },
  { id: "I2-interest-on-outstanding", re: /interest[\s\S]{0,60}(outstanding|opening balance|remaining (principal|balance))|rate[\s\S]{0,30}(outstanding|balance)/i },
  { id: "I3-principal-split", re: /principal[\s\S]{0,40}(=|is)[\s\S]{0,30}(emi|instal)[\s\S]{0,20}(-|minus|less)[\s\S]{0,20}interest|(emi|instal)[\s\S]{0,20}(-|minus)[\s\S]{0,20}interest[\s\S]{0,20}principal/i },
  { id: "I4-balance-rolls", re: /(outstanding|balance)[\s\S]{0,60}(next|following|reduced by|decreases by|less)[\s\S]{0,30}principal|balance[\s\S]{0,20}(-|minus)[\s\S]{0,20}principal/i },
  { id: "I5-monotonic", re: /(balance|outstanding)[\s\S]{0,50}(monoton|never increas|non-?increas|only decreas|decreas)/i },
  { id: "I6-conservation", re: /(sum|total)[\s\S]{0,40}principal[\s\S]{0,40}(disburse|loan amount|principal amount|equals)|principal[\s\S]{0,30}(sum|total)[\s\S]{0,30}disburse/i },
  { id: "I7-zero-at-end", re: /(final|last)[\s\S]{0,40}(zero|0\b|fully (repaid|paid|amortis))|(balance|outstanding)[\s\S]{0,30}zero[\s\S]{0,20}(end|final|last)|closes[\s\S]{0,20}zero/i },
];

const PROMPT =
  `Read the file ProgressiveEMICalculator.java in this directory. It is the core of a loan ` +
  `repayment-schedule / EMI calculator. Distil its SALIENT behavioural invariants — the ` +
  `load-bearing properties that must always hold of a generated schedule (the ones a change ` +
  `must never break), as opposed to incidental implementation detail. State each invariant ` +
  `precisely, in terms of the schedule's periods, EMI/instalment, interest, principal and ` +
  `outstanding balance. Be exhaustive about the load-bearing ones. Output the list of invariants.`;

function claude(prompt, ws) {
  return spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL,
    "--max-turns", "20", "--permission-mode", "bypassPermissions"],
    { cwd: ws, encoding: "utf8", maxBuffer: 1 << 28, timeout: 600000, killSignal: "SIGKILL" });
}

mkdirSync(RUNS, { recursive: true });
const cap = Object.fromEntries(REF.map((r) => [r.id, 0]));
let runs = 0;
for (let i = 0; i < N; i++) {
  const ws = join(RUNS, `${i}`); mkdirSync(ws, { recursive: true });
  cpSync(CALC, join(ws, "ProgressiveEMICalculator.java"));
  const out = claude(PROMPT, ws);
  const text = out.stdout || ""; writeFileSync(join(ws, "output.txt"), text);
  if (!text.trim()) { console.log(`#${i}: empty`); continue; }
  runs++;
  const hits = REF.filter((r) => r.re.test(text)).map((r) => r.id);
  for (const id of hits) cap[id]++;
  console.log(`#${i}: captured ${hits.length}/7 [${hits.map((h) => h.split("-")[0]).join(",")}]`);
}
console.log(`\n== distil-at-scale (EMI calculator, 2204 lines) over ${runs} runs ==`);
console.log(`  per reference invariant (of ${runs}): ` + REF.map((r) => `${r.id.split("-")[0]}=${cap[r.id]}`).join("  "));
const avg = REF.reduce((a, r) => a + cap[r.id], 0) / (runs || 1) / REF.length;
console.log(`  average reference-invariant capture: ${(100 * avg).toFixed(0)}%`);
console.log(`  (detectors are loose; read runs-distill/*/output.txt to confirm and to see invariants BEYOND the reference)`);
writeFileSync(join(RUNS, "result.json"), JSON.stringify({ runs, cap }, null, 2));
