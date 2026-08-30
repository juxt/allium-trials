#!/usr/bin/env node
// DISTILL direction, executable. Phase 1: a distiller model reads a REFERENCE IMPLEMENTATION and writes
// a spec (v4 or prose). Phase 2: a FRESH model rebuilds schedule() from ONLY the distilled spec. Grade
// the rebuild against the oracle. Tests whether v4 distillation preserves behaviour better than prose,
// end to end and mechanically. v4 arm may self-validate its spec (analyse) — that's the distill skill's
// checkability advantage. No judge.
// Usage: node run-distill.mjs [--reps 3] [--forms v4,prose] [--ref ref_flat.py] [--oracle oracle_flat] [--out distill-result.json]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const REPS = Number(argv[argv.indexOf("--reps") + 1] ?? "3");
const FORMS = (argv[argv.indexOf("--forms") + 1] ?? "v4,prose").split(",");
const REF = argv[argv.indexOf("--ref") + 1] ?? "ref_flat.py";
const ORACLE = argv[argv.indexOf("--oracle") + 1] ?? "oracle_flat";
const OUT = argv[argv.indexOf("--out") + 1] ?? "distill-result.json";
const REFCODE = readFileSync(join(HERE, REF), "utf8");

const DISTILL = {
  v4: () => `You are distilling a behavioural specification from an existing implementation, in Allium v4. v4 has: component/entity/given/observable state/invariant; \`given f(x) means e\` defines a pure reference function; invariants state required relations with \`every p ::\`, \`sum p ::\`, \`follows(next,p)\`. Capture the LOAD-BEARING behaviour precisely enough to rebuild it — especially the numeric conventions (how interest is computed, rounding, residual handling). Output ONLY the spec in a single \`\`\`allium code block.\n\n=== REFERENCE IMPLEMENTATION ===\n${REFCODE}\n=== END ===`,
  prose: () => `You are distilling a behavioural specification from an existing implementation, as clear prose. Capture the LOAD-BEARING behaviour precisely enough that another engineer can rebuild it without the code — especially the numeric conventions (how interest is computed, rounding, residual handling). Output ONLY the specification prose.\n\n=== REFERENCE IMPLEMENTATION ===\n${REFCODE}\n=== END ===`,
};
const REBUILD = (spec, form) => {
  const preamble = form === "v4"
    ? "You are a senior engineer implementing to an Allium v4 behavioural specification. `given f(x) means e` is a pure reference function; invariants state required relations."
    : "You are a senior engineer implementing to a specification.";
  return `${preamble}\n\n=== SPECIFICATION ===\n${spec}\n=== END ===\n\nImplement this function in Python:\n\n    def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:\n        # list of length months; each element a dict with float keys "emi","interest","principal","outstanding_start"\n\nOutput ONLY a single \`\`\`python code block. No prose.`;
};

function claude(prompt, kind) {
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "json", "--model", MODEL, "--max-turns", "6",
    "--disallowedTools", "Task,Agent,Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch"],
    { encoding: "utf8", maxBuffer: 1 << 27, timeout: 300000 });
  let j = {}; try { j = JSON.parse(r.stdout || "{}"); } catch { j = { result: r.stdout || "" }; }
  const u = j.usage || {};
  return { text: j.result || "", cost: j.total_cost_usd ?? 0,
    tok: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.output_tokens ?? 0) };
}
const extractBlock = (t, lang) => { const m = t.match(new RegExp("```(?:" + lang + ")?\\s*([\\s\\S]*?)```")); return m ? m[1] : t; };
function grade(pyPath) {
  const env = { ...process.env, ORACLE_DIR: join(HERE, ORACLE) };
  const r = spawnSync("python3", [join(HERE, "grade.py"), pyPath], { encoding: "utf8", maxBuffer: 1 << 25, timeout: 120000, env });
  try { return JSON.parse(r.stdout || "{}"); } catch { return { error: "grade failed" }; }
}

const results = {};
for (const form of FORMS) {
  results[form] = [];
  for (let i = 0; i < REPS; i++) {
    const d = claude(DISTILL[form](), "distill");
    const spec = form === "v4" ? extractBlock(d.text, "allium") : d.text;
    writeFileSync(join(HERE, "arms", `distill_${form}_${i}.spec`), spec);
    const b = claude(REBUILD(spec, form), "rebuild");
    const py = extractBlock(b.text, "python");
    const pyPath = join(HERE, "arms", `distill_${form}_${i}.py`);
    writeFileSync(pyPath, py);
    const g = grade(pyPath);
    const row = { rep: i, distill_cost: d.cost, distill_tok: d.tok, rebuild_cost: b.cost, ...g };
    results[form].push(row);
    console.error(`[distill ${form} ${i}] rebuild match0.5=${g["matched_0.50"]}/150 struct=${g.struct_ok} closes=${g.closes_to_zero} crashes=${g.crashes} medres=${g.median_residual_finite} | distill $${d.cost.toFixed(3)}`);
    writeFileSync(join(HERE, OUT), JSON.stringify(results, null, 2));
  }
}
const mean = (a, k) => a.length ? (a.reduce((s, x) => s + (Number(x[k]) || 0), 0) / a.length) : 0;
console.log(`\n== DISTILL->REBUILD: ${FORMS.join("/")}, ${REPS} reps, ref=${REF}, oracle=${ORACLE} ==\n`);
console.log(`form     rebuild-match@0.50   struct   closes   crashes   distill$`);
for (const form of FORMS) {
  const a = results[form];
  console.log(`${form.padEnd(8)} ${mean(a,"matched_0.50").toFixed(0).padStart(3)}/150         ${mean(a,"struct_ok").toFixed(0).padStart(3)}   ${mean(a,"closes_to_zero").toFixed(0).padStart(3)}   ${mean(a,"crashes").toFixed(1)}   $${mean(a,"distill_cost").toFixed(3)}`);
}
console.log(`\n=> clear air = v4-distilled spec rebuilds to match the oracle more than prose-distilled.`);
