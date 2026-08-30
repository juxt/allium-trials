#!/usr/bin/env node
// Build-to-oracle: each arm's model writes a Python schedule() from its spec; graded mechanically
// against 150 real Fineract traces (grade.py). No judge. Records oracle match + tokens/cost.
// Usage: node run-build.mjs [--reps 3] [--arms nospec,prose,v4,v3]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const REPS = Number(argv[argv.indexOf("--reps") + 1] ?? "3");
const ARMS = (argv[argv.indexOf("--arms") + 1] ?? "nospec,prose,v4").split(",");
const PRODUCT = argv[argv.indexOf("--product") + 1] ?? "standard"; // standard | flat
const ORACLE = argv[argv.indexOf("--oracle") + 1] ?? ""; // dir; empty = default Fineract traces
const OUT = argv[argv.indexOf("--out") + 1] ?? "build-result.json";
const CFG = {
  standard: { req: "amortising loan repayment schedule", prose: "specs/prose.txt", v4: "specs/v4.allium" },
  flat: { req: "consumer instalment loan repayment schedule (equal monthly instalments)", prose: "specs/flat_prose.txt", v4: "specs/flat_v4.allium" },
}[PRODUCT];

const TASK = [
  "Implement this function in Python:",
  "",
  "    def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:",
  "        # returns a list of length months; each element a dict with float keys:",
  '        #   "emi", "interest", "principal", "outstanding_start"',
  "",
  `It computes a ${CFG.req}. Output ONLY a single ` + "```python code block with the complete function (and any imports/helpers). No prose.",
].join("\n");

const PROSE = readFileSync(join(HERE, CFG.prose), "utf8");
const V4 = readFileSync(join(HERE, CFG.v4), "utf8");

const PROMPTS = {
  nospec: () => `You are a senior engineer. ${TASK}`,
  prose: () => `You are a senior engineer implementing to a specification.\n\n=== SPECIFICATION ===\n${PROSE}\n=== END ===\n\n${TASK}`,
  v4: () => `You are a senior engineer implementing to an Allium v4 behavioural specification. \`given f(x) means e\` defines a pure reference function; invariants state the required relations; \`follows(next,p)\` means next is the following period; \`sum p :: e\` sums over periods.\n\n=== SPECIFICATION ===\n${V4}\n=== END ===\n\n${TASK}`,
};

function claude(prompt) {
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "json", "--model", MODEL, "--max-turns", "6",
    "--disallowedTools", "Task,Agent,Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch"],
    { encoding: "utf8", maxBuffer: 1 << 27, timeout: 300000 });
  let j = {}; try { j = JSON.parse(r.stdout || "{}"); } catch { j = { result: r.stdout || "" }; }
  const u = j.usage || {};
  return { text: j.result || "", cost: j.total_cost_usd ?? 0,
    tok: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.output_tokens ?? 0) };
}
function extractPy(text) {
  const m = text.match(/```(?:python)?\s*([\s\S]*?)```/);
  return m ? m[1] : text;
}
function grade(pyPath) {
  const env = { ...process.env };
  if (ORACLE) env.ORACLE_DIR = join(HERE, ORACLE);
  const r = spawnSync("python3", [join(HERE, "grade.py"), pyPath], { encoding: "utf8", maxBuffer: 1 << 25, timeout: 120000, env });
  try { return JSON.parse(r.stdout || "{}"); } catch { return { error: r.stderr?.slice(-200) || "grade failed" }; }
}

const results = {};
for (const arm of ARMS) {
  if (!PROMPTS[arm]) { console.error(`(skip unknown arm ${arm})`); continue; }
  results[arm] = [];
  for (let i = 0; i < REPS; i++) {
    const a = claude(PROMPTS[arm]() + (i ? `\n(attempt ${i + 1})` : ""));
    const py = extractPy(a.text);
    const pyPath = join(HERE, "arms", `${PRODUCT}_${arm}_${i}.py`);
    writeFileSync(pyPath, py);
    const g = grade(pyPath);
    const row = { rep: i, cost: a.cost, tok: a.tok, ...g };
    results[arm].push(row);
    console.error(`[${arm} ${i}] match0.5=${g["matched_0.50"]}/150 struct=${g.struct_ok} closes=${g.closes_to_zero} crashes=${g.crashes} medres=${g.median_residual_finite} | $${a.cost.toFixed(3)} ${(a.tok/1000).toFixed(0)}k`);
    writeFileSync(join(HERE, OUT), JSON.stringify(results, null, 2));
  }
}
const mean = (a, k) => a.length ? (a.reduce((s, x) => s + (Number(x[k]) || 0), 0) / a.length) : 0;
console.log(`\n== BUILD-TO-ORACLE: ${ARMS.join("/")}, ${REPS} reps, oracle=150 real Fineract schedules ==\n`);
console.log(`arm      match@0.50   struct_ok   closes   crashes   $cost   Ktok`);
for (const arm of ARMS) {
  const a = results[arm]; if (!a) continue;
  console.log(`${arm.padEnd(8)} ${mean(a,"matched_0.50").toFixed(0).padStart(3)}/150     ${mean(a,"struct_ok").toFixed(0).padStart(3)}/150   ${mean(a,"closes_to_zero").toFixed(0).padStart(3)}/150   ${mean(a,"crashes").toFixed(1).padStart(4)}    $${mean(a,"cost").toFixed(3)} ${(mean(a,"tok")/1000).toFixed(0)}`);
}
console.log(`\n=> clear air = spec arms match more real schedules than no-spec; v4 vs prose = does notation matter.`);
