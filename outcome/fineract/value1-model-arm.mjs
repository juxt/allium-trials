#!/usr/bin/env node
// Value 1, the differential arm. The deterministic gate catches the penny-leak on 125/125
// schedules. Would a capable model, reviewing the same schedule in-head (no tools, so it must
// reason not compute), catch a 0.01 discrepancy buried in a long table? This is the honest
// non-saturation test: attention/completeness, not capability.
//
// Usage: node value1-model-arm.mjs   (writes model-arm-result.json; slow — ~20 model calls)
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TRACES = join(HERE, "traces");
const MODEL = "claude-opus-4-8";

function parse(text) {
  const periods = [];
  let given = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const toks = t.split(/\s+/);
    if (toks.some((x) => x === "given" || x.startsWith("given="))) {
      for (const tok of toks) {
        const [k, v] = tok.split("=");
        if (k !== "given") given[k] = v;
      }
    } else if (toks.some((x) => x.startsWith("period="))) {
      const p = {};
      for (const tok of toks) {
        const [k, v] = tok.split("=");
        p[k] = v;
      }
      periods.push(p);
    }
  }
  return { periods, given };
}
const num = (x) => Number(x);
const money = (x) => x.toFixed(2);
function pennyLeak(m) {
  m.periods[0].principal = money(num(m.periods[0].principal) - 0.01);
  return m;
}
function table(m) {
  const rows = m.periods.map(
    (p, i) => `${i + 1}\t${p.principal}\t${p.interest}\t${p.emi}\t${p.outstanding_start}`,
  );
  return `Disbursed principal: ${m.given.disbursed}\nperiod\tprincipal\tinterest\temi\tbalance_at_start\n${rows.join("\n")}`;
}

const PROMPT = (m) =>
  `You are reviewing the repayment schedule a loan calculator produced, after an engineer changed the code. ` +
  `Check whether the schedule is internally consistent for a declining-balance amortising loan: the balance ` +
  `at the start of each period, less the principal paid, should equal the next period's starting balance; and ` +
  `the principal payments across all periods should account for exactly the disbursed amount. Reply on the FIRST ` +
  `line with exactly one word: VALID or BROKEN. If BROKEN, add one short line naming the period and the problem. ` +
  `Reason directly; do not write or run code.\n\n${table(m)}`;

function ask(m) {
  const r = spawnSync(
    "claude",
    ["-p", PROMPT(m), "--output-format", "text", "--model", MODEL, "--max-turns", "1",
     "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Task"],
    { encoding: "utf8", maxBuffer: 1 << 26, timeout: 180000 },
  );
  const out = (r.stdout || "").trim();
  const verdict = /^\s*BROKEN/i.test(out) ? "BROKEN" : /^\s*VALID/i.test(out) ? "VALID" : "?";
  return { verdict, out: out.slice(0, 200) };
}

// Sample the long schedules (hardest to eyeball): months >= 12.
const files = readdirSync(TRACES)
  .filter((f) => f.endsWith(".trace"))
  .filter((f) => /_m(12|24)\.trace$/.test(f));
const sample = files.slice(0, 12); // 12 clean + 12 mutated = 24 calls

const results = { clean: [], mutated: [] };
let i = 0;
for (const f of sample) {
  const clean = parse(readFileSync(join(TRACES, f), "utf8"));
  const rc = ask(clean);
  results.clean.push({ f, ...rc });
  const mut = pennyLeak(parse(readFileSync(join(TRACES, f), "utf8")));
  const rm = ask(mut);
  results.mutated.push({ f, ...rm });
  i++;
  console.error(`[${i}/${sample.length}] ${f}  clean=${rc.verdict} mutated=${rm.verdict}`);
  writeFileSync(join(HERE, "model-arm-result.json"), JSON.stringify(results, null, 2));
}

const cleanValid = results.clean.filter((r) => r.verdict === "VALID").length;
const mutBroken = results.mutated.filter((r) => r.verdict === "BROKEN").length;
console.log(`\n== Value 1 differential: model-alone (in-head) vs the deterministic gate ==`);
console.log(`clean schedules called VALID:   ${cleanValid}/${results.clean.length} (false-alarm on the rest)`);
console.log(`penny-leak schedules caught:    ${mutBroken}/${results.mutated.length}  (the gate caught 125/125)`);
console.log(`\n=> Gate catch rate on this break: 100%. Model in-head catch rate: ${(100 * mutBroken / results.mutated.length).toFixed(0)}%.`);
