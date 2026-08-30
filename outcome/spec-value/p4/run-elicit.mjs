#!/usr/bin/env node
// ELICIT direction, executable via build-to-oracle. A VAGUE request hides an operator convention
// (add-on/flat interest). Phase 1: the arm surfaces clarifying questions. A simulated operator answers
// ONLY the decisions the arm actually raised (deterministic keyword match — inspectable, not a judge).
// Phase 2: the arm builds; graded vs the flat oracle. Surfacing the interest-basis decision -> operator
// says "flat" -> correct build; not surfacing -> the model guesses declining -> wrong build.
// Arms: nospec (no elicitation) / prose (write a spec first) / v3elicit / v4elicit.
// Usage: node run-elicit.mjs [--reps 4] [--arms nospec,prose,v3elicit,v4elicit]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const REPS = Number(argv[argv.indexOf("--reps") + 1] ?? "4");
const ARMS = (argv[argv.indexOf("--arms") + 1] ?? "nospec,prose,v3elicit,v4elicit").split(",");
const ELICIT_V4 = readFileSync("/Users/hgarner/code/allium/skills-v4/elicit/SKILL.md", "utf8");
const ELICIT_V3 = readFileSync("/Users/hgarner/code/allium/skills/elicit/SKILL.md", "utf8");

const REQUEST = "We need the repayment schedule for our consumer instalment loan product: the customer borrows an amount and repays it in equal monthly instalments over a fixed term. Implement schedule(disbursed, annual_rate_pct, months).";

// The operator's hidden intended decisions (the flat/add-on product) + detection keywords + the answer.
const DECISIONS = [
  { id: "interest_basis",
    kw: /(flat|add[- ]?on|declining|reducing|original principal|outstanding balance|interest.{0,20}(calculat|comput|basis|accru)|how.{0,20}interest)/i,
    ans: "Interest is ADD-ON (FLAT) on the ORIGINAL principal, NOT declining balance. total_interest = disbursed * (annual_rate_pct/100) * (months/12); each period's interest line = total_interest/months (equal every period)." },
  { id: "instalment",
    kw: /(instal?ment|emi|payment amount|how much.{0,20}(pay|instal)|equal payment)/i,
    ans: "The instalment = (disbursed + total_interest) / months, equal for all periods except the last." },
  { id: "residual",
    kw: /(residual|rounding.{0,20}(period|last|final)|final period|last instal|closes? to zero|remainder)/i,
    ans: "The FINAL period absorbs any rounding residual: its principal = remaining outstanding so the loan closes to exactly zero; its interest line = total_interest minus interest already charged." },
  { id: "rounding",
    kw: /(round|decimal|cents?|precision|half[- ]?up|half[- ]?even)/i,
    ans: "Round all monetary values to 2 decimals using round-half-up." },
];

function claude(prompt) {
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "json", "--model", MODEL, "--max-turns", "3",
    "--disallowedTools", "Task,Agent,Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch"],
    { encoding: "utf8", maxBuffer: 1 << 27, timeout: 300000 });
  let j = {}; try { j = JSON.parse(r.stdout || "{}"); } catch { j = { result: r.stdout || "" }; }
  const u = j.usage || {};
  return { text: j.result || "", cost: j.total_cost_usd ?? 0, tok: (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) };
}
const block = (t) => { const m = t.match(/```(?:python)?\s*([\s\S]*?)```/); return (m ? m[1] : t); };
function grade(pyPath) {
  const env = { ...process.env, ORACLE_DIR: join(HERE, "oracle_flat") };
  const r = spawnSync("python3", [join(HERE, "grade.py"), pyPath], { encoding: "utf8", maxBuffer: 1 << 25, timeout: 120000, env });
  try { return JSON.parse(r.stdout || "{}"); } catch { return { error: "grade failed" }; }
}
const BUILD_TAIL = '\n\nNow implement it in Python:\n\n    def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list\n        # list of length months; each element a dict with float keys "emi","interest","principal","outstanding_start"\n\nOutput ONLY a single ```python code block.';

const PHASE1 = {
  nospec: null, // no elicitation phase
  prose: () => `You are a senior engineer. Before implementing, write a short specification of the intended behaviour and LIST any questions or assumptions you must confirm with the product owner.\n\n=== REQUEST ===\n${REQUEST}`,
  v3elicit: () => `You are a senior engineer using the Allium elicitation process below. Apply it to turn this request into a precise spec, SURFACING every decision you need the product owner to confirm. List your questions explicitly.\n\n=== PROCESS ===\n${ELICIT_V3}\n\n=== REQUEST ===\n${REQUEST}`,
  v4elicit: () => `You are a senior engineer using the Allium v4 elicitation process below. Apply it to turn this request into a precise spec, SURFACING every decision you need the product owner to confirm. List your questions explicitly.\n\n=== PROCESS ===\n${ELICIT_V4}\n\n=== REQUEST ===\n${REQUEST}`,
};

const results = {};
for (const arm of ARMS) {
  results[arm] = [];
  for (let i = 0; i < REPS; i++) {
    let cost = 0, surfaced = [], phase1 = "";
    if (PHASE1[arm]) {
      const p1 = claude(PHASE1[arm]()); cost += p1.cost; phase1 = p1.text;
      for (const d of DECISIONS) if (d.kw.test(phase1)) surfaced.push(d.id);
    }
    // operator answers ONLY surfaced decisions
    const answers = DECISIONS.filter((d) => surfaced.includes(d.id)).map((d) => `- ${d.ans}`).join("\n");
    const opBlock = answers ? `\n\nThe product owner answered your questions:\n${answers}` : "";
    const buildPrompt = (PHASE1[arm] ? `You are a senior engineer. Request:\n${REQUEST}${opBlock}` : `You are a senior engineer. ${REQUEST}`) + BUILD_TAIL;
    const b = claude(buildPrompt); cost += b.cost;
    const pyPath = join(HERE, "arms", `elicit_${arm}_${i}.py`);
    writeFileSync(pyPath, block(b.text));
    writeFileSync(join(HERE, "arms", `elicit_${arm}_${i}.p1.txt`), phase1);
    const g = grade(pyPath);
    const row = { rep: i, cost, surfaced: surfaced.join(","), n_surfaced: surfaced.length, ...g };
    results[arm].push(row);
    console.error(`[${arm} ${i}] surfaced=[${surfaced.join(",")}] build match0.5=${g["matched_0.50"]}/150 | $${cost.toFixed(2)}`);
    writeFileSync(join(HERE, "elicit-result.json"), JSON.stringify(results, null, 2));
  }
}
const mean = (a, k) => a.length ? a.reduce((s, x) => s + (Number(x[k]) || 0), 0) / a.length : 0;
console.log(`\n== ELICIT -> BUILD-TO-ORACLE (flat product), ${REPS} reps ==\n`);
console.log(`arm         interest_basis surfaced   build-match@0.50   $cost`);
for (const arm of ARMS) {
  const a = results[arm];
  const ib = a.filter((x) => (x.surfaced || "").includes("interest_basis")).length;
  console.log(`${arm.padEnd(11)} ${ib}/${a.length}                  ${mean(a,"matched_0.50").toFixed(0).padStart(3)}/150         $${mean(a,"cost").toFixed(2)}`);
}
console.log(`\n=> clear air = elicit arms surface the interest-basis decision -> operator answers -> build matches; nospec guesses declining -> fails.`);
