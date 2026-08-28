#!/usr/bin/env node
// Observability completeness — the distill lens applied to monitoring. Asked ad-hoc to "add
// monitoring", a model reaches for the obvious point checks and metrics; the subtle temporal
// and relational invariants (once-accepted-never-rejected, UTI uniqueness, referential
// integrity) are the ones it drops. The Allium discipline — distil the invariants that must
// always hold, which become the runtime monitors — forces the complete set. We measure
// coverage of an 8-property checklist (3 obvious point, 5 subtle temporal/relational).
//
//   adhoc  — "add production monitoring/alerting to this system"
//   distil — "distil the invariants that must always hold; these become the monitors"
// Usage: node observability.mjs [--arm adhoc|distil] [--runs 4]

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs");
const CODE = readFileSync(join(HERE, "..", "distill-v4", "report_engine.py"), "utf8");
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ARM = opt("--arm", "adhoc");
const N = Number(opt("--runs", "4"));
const MODEL = opt("--model", "claude-opus-4-8");

// 8 monitorable properties. P1-P3 obvious (point); P4-P8 subtle (temporal/relational).
const PROPS = [
  { id: "P1", subtle: false, re: /uti[\s\S]{0,40}(present|has|missing|generated|null|require)|new[\s\S]{0,20}trade[\s\S]{0,30}uti/i },
  { id: "P2", subtle: false, re: /(cleared[\s\S]{0,40}(ccp|lei))|((ccp|lei)[\s\S]{0,40}(present|missing|require|cleared))/i },
  { id: "P3", subtle: false, re: /(amend|amendment)[\s\S]{0,50}prior[\s_]?uti|prior[\s_]?uti[\s\S]{0,50}amend/i },
  { id: "P4", subtle: true, re: /cancel[\s\S]{0,60}(terminal|monoton|never[\s\S]{0,20}(revert|return|reactivat|live)|once[\s\S]{0,20}cancel)/i },
  { id: "P5", subtle: true, re: /uti[\s\S]{0,60}(never[\s\S]{0,20}(chang|reassign|reuse)|stable|immutab|reassign)/i },
  { id: "P6", subtle: true, re: /(uniqu|duplicate uti|no two[\s\S]{0,30}uti|distinct uti|uti[\s\S]{0,20}collision|same uti)/i },
  { id: "P7", subtle: true, re: /(referen|prior[\s\S]{0,20}(exist|valid|known)|orphan|dangling|prior[\s_]?uti[\s\S]{0,30}(match|exist))/i },
  { id: "P8", subtle: true, re: /(trade[\s_]?time|timestamp)[\s\S]{0,60}(not[\s\S]{0,20}submi|match|consisten|submission)/i },
];

const ADHOC = `You are adding production monitoring and alerting to this trade-reporting service. List every invariant, property, or condition you would monitor and raise an alert on. Be specific.\n\n\`\`\`python\n${CODE}\n\`\`\``;
const DISTIL = `Distil this trade-reporting service into the complete set of INVARIANTS that must always hold of it at runtime — every property, including temporal ones (things true across a report's lifecycle) and relational ones (things true across reports). These invariants become the runtime monitors. Be exhaustive; a violation of any real invariant must be catchable.\n\n\`\`\`python\n${CODE}\n\`\`\``;

function claude(prompt, ws) {
  return spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL,
    "--max-turns", ARM === "distil" ? "8" : "5", "--permission-mode", "bypassPermissions",
    "--disallowedTools", "Bash Edit Write Read Glob Grep WebFetch WebSearch Task NotebookEdit"],
    { cwd: ws, encoding: "utf8", maxBuffer: 1 << 26, timeout: 300000, killSignal: "SIGKILL" });
}

mkdirSync(RUNS, { recursive: true });
const cover = Object.fromEntries(PROPS.map((p) => [p.id, 0]));
let runs = 0;
for (let i = 0; i < N; i++) {
  const ws = join(RUNS, `${ARM}-${i}`); mkdirSync(ws, { recursive: true });
  const out = claude(ARM === "distil" ? DISTIL : ADHOC, ws);
  const text = out.stdout || ""; writeFileSync(join(ws, "output.txt"), text);
  if (!text.trim()) { console.log(`${ARM} #${i}: empty`); continue; }
  runs++;
  const hits = PROPS.filter((p) => p.re.test(text)).map((p) => p.id);
  for (const id of hits) cover[id]++;
  console.log(`${ARM} #${i}: covered ${hits.length}/8 [${hits.join(",")}]`);
}
const obvious = PROPS.filter((p) => !p.subtle), subtle = PROPS.filter((p) => p.subtle);
const avg = (list) => (list.reduce((a, p) => a + cover[p.id], 0) / (runs || 1) / list.length);
console.log(`\n== arm=${ARM} over ${runs} runs ==`);
console.log(`  obvious P1-P3: ${(100 * avg(obvious)).toFixed(0)}%   subtle P4-P8: ${(100 * avg(subtle)).toFixed(0)}%`);
console.log(`  per-property (of ${runs}): ` + PROPS.map((p) => `${p.id}${p.subtle ? "*" : ""}=${cover[p.id]}`).join(" "));
writeFileSync(join(RUNS, `result-${ARM}.json`), JSON.stringify({ arm: ARM, runs, cover }, null, 2));
