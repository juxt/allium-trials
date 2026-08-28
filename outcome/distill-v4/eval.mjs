#!/usr/bin/env node
// Distill through the disposition lens. Distill's value is not detection (a strong model
// reads code well) but COMPLETENESS by discipline: asked to "summarise", a model gives a
// selective happy-path account; distilling into a full spec forces capturing every
// behaviour, including easy-to-miss edges. The module report_engine.py has 8 known
// behaviours (B1-B3 mainline, B4-B8 subtle). We measure capture rate per arm.
// Usage: node eval.mjs [--arm summarise|distill] [--runs 4]

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs");
const CODE = readFileSync(join(HERE, "report_engine.py"), "utf8");
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ARM = opt("--arm", "summarise");
const N = Number(opt("--runs", "4"));
const MODEL = opt("--model", "claude-opus-4-8");

const BEHAVIOURS = [
  { id: "B1", subtle: false, re: /new trade[\s\S]{0,40}(fresh|new|mint)[\s\S]{0,20}uti|mint[\s\S]{0,20}uti/i },
  { id: "B2", subtle: false, re: /amend[\s\S]{0,60}prior[\s_]?uti|prior[\s_]?uti[\s\S]{0,60}amend/i },
  { id: "B3", subtle: false, re: /cleared[\s\S]{0,60}(ccp|lei)[\s\S]{0,60}(require|reject|error|must)|(require|reject)[\s\S]{0,40}(ccp|lei)/i },
  { id: "B4", subtle: true, re: /(below|under)[\s\S]{0,40}threshold[\s\S]{0,60}(non-?reportable|flag|still submit|not drop)|non-?reportable/i },
  { id: "B5", subtle: true, re: /(amend|amendment)[\s\S]{0,60}(unacknowledg|before[\s\S]{0,20}acknowledg|not[\s\S]{0,20}acknowledg)[\s\S]{0,40}(queue)|queue[\s\S]{0,60}(acknowledg|amend)/i },
  { id: "B6", subtle: true, re: /(idempoten|re-?book|existing uti|already[\s\S]{0,20}live)/i },
  { id: "B7", subtle: true, re: /trade[\s_]?time[\s\S]{0,60}(not|instead|rather)[\s\S]{0,30}(submi)|reported[\s\S]{0,40}trade[\s_]?time|timestamp[\s\S]{0,40}trade[\s_]?time/i },
  { id: "B8", subtle: true, re: /(already[\s\S]{0,20}cancel|cancel[\s\S]{0,30}already)[\s\S]{0,30}(no-?op|nothing|ignored)|no-?op/i },
];

const SUMMARISE = `Read this Python module and describe what it does.\n\n\`\`\`python\n${CODE}\n\`\`\``;
const DISTILL =
  `Distil this Python module into a COMPLETE behavioural specification: capture EVERY behaviour ` +
  `the code exhibits, including edge cases and special cases, each as an explicit rule or invariant. ` +
  `Be exhaustive — a reader must be able to reimplement the module from your spec without the code.` +
  `\n\n\`\`\`python\n${CODE}\n\`\`\``;

function claude(prompt, ws) {
  return spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL,
    "--max-turns", ARM === "distill" ? "8" : "3", "--permission-mode", "bypassPermissions",
    "--disallowedTools", "Bash Edit Write Read Glob Grep WebFetch WebSearch Task NotebookEdit"],
    { cwd: ws, encoding: "utf8", maxBuffer: 1 << 26, timeout: 300000, killSignal: "SIGKILL" });
}

mkdirSync(RUNS, { recursive: true });
const cap = Object.fromEntries(BEHAVIOURS.map((b) => [b.id, 0]));
let runs = 0;
for (let i = 0; i < N; i++) {
  const ws = join(RUNS, `${ARM}-${i}`); mkdirSync(ws, { recursive: true });
  const out = claude(ARM === "distill" ? DISTILL : SUMMARISE, ws);
  const text = out.stdout || ""; writeFileSync(join(ws, "output.txt"), text);
  if (!text.trim()) { console.log(`${ARM} #${i}: empty`); continue; }
  runs++;
  const hits = BEHAVIOURS.filter((b) => b.re.test(text)).map((b) => b.id);
  for (const id of hits) cap[id]++;
  console.log(`${ARM} #${i}: captured ${hits.length}/8 [${hits.join(",")}]`);
}
const mainline = BEHAVIOURS.filter((b) => !b.subtle), subtle = BEHAVIOURS.filter((b) => b.subtle);
const avg = (list) => (list.reduce((a, b) => a + cap[b.id], 0) / (runs || 1) / list.length);
console.log(`\n== arm=${ARM} over ${runs} runs (avg capture) ==`);
console.log(`  mainline B1-B3: ${(100 * avg(mainline)).toFixed(0)}%   subtle B4-B8: ${(100 * avg(subtle)).toFixed(0)}%`);
console.log(`  per-behaviour (of ${runs}): ` + BEHAVIOURS.map((b) => `${b.id}${b.subtle ? "*" : ""}=${cap[b.id]}`).join(" "));
writeFileSync(join(RUNS, `result-${ARM}.json`), JSON.stringify({ arm: ARM, runs, cap }, null, 2));
