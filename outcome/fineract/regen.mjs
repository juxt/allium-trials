#!/usr/bin/env node
// Round-trip regeneration eval (direction 1). Distil -> regenerate from the spec in a fresh
// session that never sees the original code -> grade the regenerated code against the REAL
// Fineract schedules as oracle. Three arms into the same oracle isolate what the spec adds:
//   thin   — "implement a standard amortising loan calculator" (the model's prior alone)
//   prose  — the same invariants written in plain English (spec content, no formalism)
//   allium — the Allium spec (structured formalism)
// thin vs {prose,allium} = does a spec help at all; prose vs allium = does the formalism help.
// Grade at strict (penny) and loose (structural) tolerance; the gap localises spec silence.
//
// Usage: node regen.mjs [--seeds 2]   (writes regen-result.json; slow — model calls per arm/seed)
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "regen-runs");
mkdirSync(RUNS, { recursive: true });
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const SEEDS = Number((argv[argv.indexOf("--seeds") + 1] ?? "2"));

// ---- Oracle: the 150 real Fineract schedules ----
function parseTrace(text) {
  const periods = [];
  let disbursed = 0;
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const toks = t.split(/\s+/);
    if (toks.some((x) => x.startsWith("given"))) {
      for (const tok of toks) {
        const [k, v] = tok.split("=");
        if (k === "disbursed") disbursed = Number(v);
      }
    } else if (toks.some((x) => x.startsWith("period="))) {
      const p = {};
      for (const tok of toks) {
        const [k, v] = tok.split("=");
        if (["emi", "interest", "principal", "outstanding_start"].includes(k)) p[k] = Number(v);
      }
      periods.push(p);
    }
  }
  return { disbursed, periods };
}
const manifest = readFileSync(join(HERE, "traces", "manifest.csv"), "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((l) => {
    const [id, disbursed, rate, months] = l.split(",");
    return { id, disbursed: Number(disbursed), rate: Number(rate), months: Number(months) };
  });
const oracle = manifest.map((m) => {
  const { periods } = parseTrace(readFileSync(join(HERE, "traces", `${m.id}.trace`), "utf8"));
  return { ...m, periods };
});
const inputs = oracle.map((o) => ({ disbursed: o.disbursed, rate: o.rate, months: o.months }));

// ---- Regeneration prompt ----
const INTERFACE = `Write a single self-contained Python 3 file. Define EXACTLY this function:

    def schedule(disbursed, annual_rate_percent, months):
        # returns a list of length \`months\`, one dict per period in order (period 0 first).
        # each dict: {"emi": float, "interest": float, "principal": float, "outstanding_start": float}
        # "outstanding_start" is the loan balance at the START of the period; period 0 == disbursed.
        # round every money value to 2 decimal places.
        ...

Use only the Python standard library. Output ONLY the code in a single \`\`\`python fenced block, no prose.`;

const ALLIUM = readFileSync(join(HERE, "LoanScheduleInvariants.allium"), "utf8");
const PROSE = readFileSync(join(HERE, "regen-prose-spec.txt"), "utf8");
// Loop 1: the distilled numerical policy (rounding/day-count/EMI/final instalment), if present.
const POLICY_PATH = join(HERE, "rounding-policy.md");
const POLICY = existsSync(POLICY_PATH) ? readFileSync(POLICY_PATH, "utf8") : null;
const withPolicy = (base) =>
  `${base}\n\nThe implementation MUST also reproduce this institution's exact numerical policy (rounding mode, day-count, EMI computation, final-instalment adjustment):\n\n${POLICY}`;

const ARMS = {
  thin: () => `Implement a standard declining-balance amortising loan repayment schedule calculator.\n\n${INTERFACE}`,
  prose: () =>
    `Implement a loan repayment schedule calculator whose output satisfies this behavioural specification:\n\n${PROSE}\n\n${INTERFACE}`,
  allium: () =>
    `Implement a loan repayment schedule calculator whose output satisfies this Allium behavioural specification (a formal spec language: \`invariant\` items constrain the schedule; \`every p ::\` quantifies over periods; \`sum p ::\` aggregates; \`follows\`/\`is_last\` order the periods):\n\n${ALLIUM}\n\n${INTERFACE}`,
  // Loop 1 arms: the same specs enriched with the distilled numerical policy.
  thin_policy: () => withPolicy(`Implement a declining-balance amortising loan repayment schedule calculator.\n\n${INTERFACE}`),
  allium_policy: () =>
    withPolicy(
      `Implement a loan repayment schedule calculator whose output satisfies this Allium behavioural specification:\n\n${ALLIUM}\n\n${INTERFACE}`,
    ),
};

function regenerate(promptText, dir) {
  const r = spawnSync(
    "claude",
    ["-p", promptText, "--output-format", "text", "--model", MODEL, "--max-turns", "1",
     "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Task"],
    { encoding: "utf8", maxBuffer: 1 << 26, timeout: 180000 },
  );
  const out = r.stdout || "";
  const m = out.match(/```python\s*([\s\S]*?)```/) || out.match(/```\s*([\s\S]*?)```/);
  const code = m ? m[1] : out;
  writeFileSync(join(dir, "solution.py"), code);
  return code;
}

const RUNNER = `import json, sys, importlib.util
spec = importlib.util.spec_from_file_location('solution', sys.argv[1])
mod = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(mod)
except Exception as e:
    print(json.dumps({"load_error": str(e)})); sys.exit(0)
inputs = json.load(open(sys.argv[2]))
out = []
for inp in inputs:
    try:
        out.append(mod.schedule(inp['disbursed'], inp['rate'], inp['months']))
    except Exception as e:
        out.append(None)
print(json.dumps(out))
`;

function runSolution(dir) {
  const inPath = join(dir, "inputs.json");
  writeFileSync(inPath, JSON.stringify(inputs));
  writeFileSync(join(dir, "runner.py"), RUNNER);
  const r = spawnSync("python3", [join(dir, "runner.py"), join(dir, "solution.py"), inPath], {
    encoding: "utf8",
    maxBuffer: 1 << 27,
    timeout: 60000,
  });
  try {
    return JSON.parse(r.stdout);
  } catch {
    return { parse_error: (r.stderr || r.stdout || "").slice(0, 200) };
  }
}

const FIELDS = ["emi", "interest", "principal", "outstanding_start"];
function grade(got) {
  if (!Array.isArray(got)) return { load_error: got.load_error || got.parse_error || "no output" };
  let strict = 0,
    loose = 0;
  const fieldFail = { strict: {}, loose: {} };
  const posFail = { last: 0, interior: 0 };
  for (const f of FIELDS) (fieldFail.strict[f] = 0), (fieldFail.loose[f] = 0);
  for (let i = 0; i < oracle.length; i++) {
    const exp = oracle[i].periods;
    const g = got[i];
    let sOK = Array.isArray(g) && g.length === exp.length;
    let lOK = sOK;
    if (Array.isArray(g)) {
      for (let p = 0; p < exp.length; p++) {
        const gp = g[p] || {};
        for (const f of FIELDS) {
          const e = exp[p][f];
          const gv = Number(gp[f]);
          const sHit = Number.isFinite(gv) && Math.abs(gv - e) <= 0.005;
          const lHit = Number.isFinite(gv) && Math.abs(gv - e) <= Math.max(0.02, 0.01 * Math.abs(e));
          if (!sHit) {
            sOK = false;
            fieldFail.strict[f]++;
            if (p === exp.length - 1) posFail.last++;
            else posFail.interior++;
          }
          if (!lHit) {
            lOK = false;
            fieldFail.loose[f]++;
          }
        }
      }
    } else {
      sOK = lOK = false;
    }
    if (sOK) strict++;
    if (lOK) loose++;
  }
  return { strict, loose, total: oracle.length, fieldFail, posFail };
}

// --only arm1,arm2 restricts which arms run; results merge into the existing file so a
// follow-up (Loop 1) run does not clobber the baseline arms.
const onlyArg = argv[argv.indexOf("--only") + 1];
const only = argv.includes("--only") ? new Set(onlyArg.split(",")) : null;
const resultPath = join(HERE, "regen-result.json");
const results = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, "utf8")) : {};
for (const [arm, mk] of Object.entries(ARMS)) {
  if (only && !only.has(arm)) continue;
  if (arm.endsWith("_policy") && !POLICY) {
    console.error(`[${arm}] skipped: rounding-policy.md not present yet`);
    continue;
  }
  results[arm] = [];
  for (let s = 0; s < SEEDS; s++) {
    const dir = join(RUNS, `${arm}_${s}`);
    mkdirSync(dir, { recursive: true });
    const prompt = mk() + (s ? `\n\n(independent implementation attempt ${s + 1})` : "");
    regenerate(prompt, dir);
    const got = runSolution(dir);
    const gr = grade(got);
    results[arm].push(gr);
    const line = gr.load_error
      ? `LOAD/RUN ERROR: ${gr.load_error}`
      : `strict ${gr.strict}/${gr.total}  loose ${gr.loose}/${gr.total}  (last-period cell fails ${gr.posFail.last}, interior ${gr.posFail.interior})`;
    console.error(`[${arm} seed ${s}] ${line}`);
    writeFileSync(join(HERE, "regen-result.json"), JSON.stringify(results, null, 2));
  }
}

console.log(`\n== Round-trip regeneration: regenerated code vs ${oracle.length} real Fineract schedules ==\n`);
console.log(`arm      seed  strict(penny)  loose(structural)   dominant failure`);
for (const [arm, seeds] of Object.entries(results)) {
  seeds.forEach((g, s) => {
    if (g.load_error) return console.log(`${arm.padEnd(8)} ${s}     ERROR: ${g.load_error}`);
    const worstField = Object.entries(g.fieldFail.loose).sort((a, b) => b[1] - a[1])[0];
    console.log(
      `${arm.padEnd(8)} ${s}     ${String(g.strict + "/" + g.total).padEnd(14)} ${String(g.loose + "/" + g.total).padEnd(19)} ${worstField[0]} (${worstField[1]} cells), last-period ${g.posFail.last}`,
    );
  });
}
console.log(`\n=> strict vs loose gap = rounding/day-count silence in the spec; thin vs allium = what the spec adds over the model's prior.`);
