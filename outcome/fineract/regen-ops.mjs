#!/usr/bin/env node
// Loop 2, the regeneration facet. The mid-loan rate change is NON-textbook: does Fineract keep
// the term and recompute the instalment, or keep the instalment and extend the term? A model has
// no firm prior. So this is where a spec that pins the recompute policy should finally beat the
// model's prior — the positive case the whole arc has been hunting for.
//
// Arms into the same 32 rate-change oracle schedules:
//   thin        — "rate changes mid-loan", model guesses the recompute policy
//   contract    — the distilled operation contract (keep term, re-amortise remaining balance)
//   contract+pol — the contract plus the exact numerical policy (for penny fidelity)
// Grade loose (structure = did it get the recompute policy) and strict (penny = policy + rounding).
//
// Usage: node regen-ops.mjs [--seeds 2]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "regen-ops-runs");
mkdirSync(RUNS, { recursive: true });
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const SEEDS = Number((argv[argv.indexOf("--seeds") + 1] ?? "2"));

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
const oracle = readFileSync(join(HERE, "traces-ops", "manifest.csv"), "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((l) => {
    const [id, disbursed, months, rate1, change_period, rate2] = l.split(",");
    const { periods } = parseTrace(readFileSync(join(HERE, "traces-ops", `${id}.trace`), "utf8"));
    return { id, disbursed: +disbursed, months: +months, rate1: +rate1, change_period: +change_period, rate2: +rate2, periods };
  });
const inputs = oracle.map((o) => ({ disbursed: o.disbursed, rate1: o.rate1, change_period: o.change_period, rate2: o.rate2, months: o.months }));

const INTERFACE = `Write a single self-contained Python 3 file. Define EXACTLY:

    def schedule_rate_change(disbursed, annual_rate_percent_1, change_period, annual_rate_percent_2, months):
        # A monthly amortising loan whose annual interest rate switches from _1 to _2 at the
        # START of the 0-based period index \`change_period\`.
        # returns a list of length \`months\`, one dict per period in order, each:
        #   {"emi": float, "interest": float, "principal": float, "outstanding_start": float}
        # "outstanding_start" is the balance at the START of the period; period 0 == disbursed.
        # round every money value to 2 decimal places.
        ...

Use only the standard library. Output ONLY the code in one \`\`\`python fenced block, no prose.`;

const CONTRACT = `Operation contract for a mid-loan interest-rate change:
- Before \`change_period\`, the schedule is the standard level-instalment amortisation of the
  disbursed amount over \`months\` periods at annual_rate_percent_1.
- At \`change_period\` the outstanding balance carries over unchanged. From that period to the
  end the loan is RE-AMORTISED: the instalment is recomputed as the new level annuity that pays
  off the balance outstanding at the start of \`change_period\` over the REMAINING periods
  (months - change_period) at annual_rate_percent_2. The original term \`months\` is preserved:
  the instalment changes, the number of periods does not.
- The base laws still hold: each period's interest is the period rate on the opening balance;
  principal is instalment minus interest; the balance rolls forward; it never increases; the
  principals sum to the disbursed amount; the final period closes the balance to exactly zero.`;

const POLICY = existsSync(join(HERE, "rounding-policy.md")) ? readFileSync(join(HERE, "rounding-policy.md"), "utf8") : null;
const ARMS = {
  thin: () => `Implement a monthly amortising loan calculator whose annual interest rate changes from _1 to _2 at the start of period \`change_period\`.\n\n${INTERFACE}`,
  contract: () => `Implement a loan calculator satisfying this behavioural contract:\n\n${CONTRACT}\n\n${INTERFACE}`,
  contract_pol: () =>
    POLICY
      ? `Implement a loan calculator satisfying this behavioural contract:\n\n${CONTRACT}\n\nAnd reproducing this institution's exact numerical policy (rounding, day-count, EMI, final instalment):\n\n${POLICY}\n\n${INTERFACE}`
      : null,
};

const RUNNER = `import json, sys, importlib.util
spec = importlib.util.spec_from_file_location('solution', sys.argv[1])
mod = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(mod)
except Exception as e:
    print(json.dumps({"load_error": str(e)})); sys.exit(0)
inputs = json.load(open(sys.argv[2]))
out = []
for i in inputs:
    try:
        out.append(mod.schedule_rate_change(i['disbursed'], i['rate1'], i['change_period'], i['rate2'], i['months']))
    except Exception:
        out.append(None)
print(json.dumps(out))
`;
const FIELDS = ["emi", "interest", "principal", "outstanding_start"];
function grade(got) {
  if (!Array.isArray(got)) return { load_error: (got && (got.load_error || got.parse_error)) || "no output" };
  let strict = 0, loose = 0;
  for (let i = 0; i < oracle.length; i++) {
    const exp = oracle[i].periods, g = got[i];
    let sOK = Array.isArray(g) && g.length === exp.length, lOK = sOK;
    if (Array.isArray(g)) {
      for (let p = 0; p < exp.length; p++) {
        const gp = g[p] || {};
        for (const f of FIELDS) {
          const e = exp[p][f], gv = Number(gp[f]);
          if (!(Number.isFinite(gv) && Math.abs(gv - e) <= 0.005)) sOK = false;
          if (!(Number.isFinite(gv) && Math.abs(gv - e) <= Math.max(0.02, 0.01 * Math.abs(e)))) lOK = false;
        }
      }
    } else sOK = lOK = false;
    if (sOK) strict++;
    if (lOK) loose++;
  }
  return { strict, loose, total: oracle.length };
}
function regenerate(promptText, dir) {
  const r = spawnSync("claude", ["-p", promptText, "--output-format", "text", "--model", MODEL, "--max-turns", "1",
    "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Task"],
    { encoding: "utf8", maxBuffer: 1 << 26, timeout: 180000 });
  const out = r.stdout || "";
  const m = out.match(/```python\s*([\s\S]*?)```/) || out.match(/```\s*([\s\S]*?)```/);
  writeFileSync(join(dir, "solution.py"), m ? m[1] : out);
}
function run(dir) {
  writeFileSync(join(dir, "inputs.json"), JSON.stringify(inputs));
  writeFileSync(join(dir, "runner.py"), RUNNER);
  const r = spawnSync("python3", [join(dir, "runner.py"), join(dir, "solution.py"), join(dir, "inputs.json")],
    { encoding: "utf8", maxBuffer: 1 << 27, timeout: 60000 });
  try { return JSON.parse(r.stdout); } catch { return { parse_error: (r.stderr || "").slice(0, 200) }; }
}

const results = {};
for (const [arm, mk] of Object.entries(ARMS)) {
  const base = mk();
  if (!base) continue;
  results[arm] = [];
  for (let s = 0; s < SEEDS; s++) {
    const dir = join(RUNS, `${arm}_${s}`); mkdirSync(dir, { recursive: true });
    regenerate(base + (s ? `\n\n(independent attempt ${s + 1})` : ""), dir);
    const gr = grade(run(dir));
    results[arm].push(gr);
    console.error(`[${arm} ${s}] ${gr.load_error ? "ERR " + gr.load_error : `strict ${gr.strict}/${gr.total} loose ${gr.loose}/${gr.total}`}`);
    writeFileSync(join(HERE, "regen-ops-result.json"), JSON.stringify(results, null, 2));
  }
}
console.log(`\n== Loop 2 regeneration: rate-change behaviour vs ${oracle.length} real schedules ==\n`);
console.log(`arm           strict(penny)   loose(structural = got the recompute policy)`);
for (const [arm, seeds] of Object.entries(results)) {
  seeds.forEach((g, s) => {
    if (g.load_error) return console.log(`${arm.padEnd(13)} ERROR ${g.load_error}`);
    console.log(`${arm.padEnd(13)} ${String(g.strict + "/" + g.total).padEnd(15)} ${g.loose}/${g.total}`);
  });
}
console.log(`\n=> thin loose < contract loose would be the first case where the spec beats the model's prior (non-textbook behaviour).`);
