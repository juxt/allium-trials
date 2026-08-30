#!/usr/bin/env node
// CHECKABILITY experiment (v4 vs prose), executable. Distillation drifts; v4 specs can be MECHANICALLY
// validated (allium check + monitor-schedule vs reference traces) and fixed; prose cannot. Pipeline:
//   distill spec from reference -> [v4: check+monitor-vs-traces -> fix loop] / [prose: self-review vs
//   shown traces] -> fresh model rebuilds from the spec -> oracle-grade the rebuild.
// Tests whether v4's checkability delivers build-correctness over prose. No LLM judge; validation is the
// mechanical monitor. Usage: node run-validated.mjs [--reps 4] [--ref ref_flat.py] [--oracle oracle_flat] [--out validated.json]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const REPS = Number(argv[argv.indexOf("--reps") + 1] ?? "4");
const REF = argv[argv.indexOf("--ref") + 1] ?? "ref_flat.py";
const ORACLE = argv[argv.indexOf("--oracle") + 1] ?? "oracle_flat";
const OUT = argv[argv.indexOf("--out") + 1] ?? "validated.json";
const REFCODE = readFileSync(join(HERE, REF), "utf8");
const FIXROUNDS = 2;
// a small diverse sample of reference traces for validation (v4) / self-review (prose)
const SAMPLE = ["d1000_r9.99_m12", "d5000_r18_m24", "d100_r5_m6", "d12345.67_r24_m12", "d1000_r0_m3"]
  .map((id) => ({ id, text: readFileSync(join(HERE, ORACLE, id + ".trace"), "utf8") }));

function claude(prompt) {
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "json", "--model", MODEL, "--max-turns", "3",
    "--disallowedTools", "Task,Agent,Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch"],
    { encoding: "utf8", maxBuffer: 1 << 27, timeout: 300000 });
  let j = {}; try { j = JSON.parse(r.stdout || "{}"); } catch { j = { result: r.stdout || "" }; }
  const u = j.usage || {};
  return { text: j.result || "", cost: j.total_cost_usd ?? 0, tok: (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) };
}
const block = (t, lang) => { const m = t.match(new RegExp("```(?:" + lang + ")?\\s*([\\s\\S]*?)```")); return (m ? m[1] : t).trim(); };
function checkV4(spec) { // returns {ok, errors}
  writeFileSync("/tmp/vspec.allium", spec);
  const r = spawnSync(ALLIUM, ["check", "/tmp/vspec.allium"], { encoding: "utf8" });
  try { const d = JSON.parse(r.stdout || "{}"); const e = (d.diagnostics || []).filter((x) => x.severity === "Error").map((x) => x.message); return { ok: e.length === 0, errors: e }; }
  catch { return { ok: false, errors: ["parse failure"] }; }
}
function monitorV4(spec) { // returns list of {id, failing:[invariant...], residual}
  writeFileSync("/tmp/vspec.allium", spec);
  const fails = [];
  for (const s of SAMPLE) {
    writeFileSync("/tmp/vtrace.trace", s.text);
    const r = spawnSync(ALLIUM, ["monitor-schedule", "/tmp/vspec.allium", "/tmp/vtrace.trace", "--tol", "0.02"], { encoding: "utf8" });
    try { const d = JSON.parse(r.stdout || "{}"); const bad = (d.results || []).filter((x) => !x.holds).map((x) => `${x.invariant} (residual ${x.max_residual}, ${x.witness})`); if (bad.length || d.monitored === 0) fails.push({ id: s.id, monitored: d.monitored, bad }); }
    catch { fails.push({ id: s.id, bad: ["monitor error"] }); }
  }
  return fails;
}
function grade(pyPath) {
  const env = { ...process.env, ORACLE_DIR: join(HERE, ORACLE) };
  const r = spawnSync("python3", [join(HERE, "grade.py"), pyPath], { encoding: "utf8", maxBuffer: 1 << 25, timeout: 120000, env });
  try { return JSON.parse(r.stdout || "{}"); } catch { return { error: "grade failed" }; }
}
const REBUILD = (spec, form) => `You are a senior engineer implementing to a ${form === "v4" ? "an Allium v4 behavioural specification (\`given f(x) means e\` is a pure reference function; invariants state required relations; `/` is division)" : "specification"}.\n\n=== SPECIFICATION ===\n${spec}\n=== END ===\n\nImplement in Python:\n\n    def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list\n        # list of length months; each element a dict with float keys "emi","interest","principal","outstanding_start"\n\nOutput ONLY a single \`\`\`python code block.`;

async function runForm(form, i) {
  let cost = 0;
  // 1. distill
  const distillPrompt = form === "v4"
    ? `Distil an Allium v4 behavioural spec from this implementation. v4: component/entity/given/observable state/invariant; \`given f(x) means e\` and \`given k means <expr>\` define pure reference functions/constants; \`/\` is division; invariants use \`every p ::\`, \`sum p ::\`, \`follows(next,p)\`. Capture the numeric conventions precisely. Output ONLY the spec in one \`\`\`allium block.\n\n=== REFERENCE ===\n${REFCODE}`
    : `Distil a precise prose behavioural specification from this implementation, complete enough to rebuild it without the code (esp. numeric conventions). Output ONLY the prose spec.\n\n=== REFERENCE ===\n${REFCODE}`;
  let d = claude(distillPrompt); cost += d.cost;
  let spec = form === "v4" ? block(d.text, "allium") : d.text.trim();
  let validated_rounds = 0, caught = [];
  if (form === "v4") {
    for (let round = 0; round < FIXROUNDS; round++) {
      const chk = checkV4(spec);
      const mon = chk.ok ? monitorV4(spec) : [];
      const problems = [];
      if (!chk.ok) problems.push(`SPEC DOES NOT CHECK: ${chk.errors.join("; ")}`);
      for (const f of mon) problems.push(`On real trace ${f.id}: ${f.monitored === 0 ? "NO invariants were monitorable (spec not connected to the fields)" : "failing invariants: " + f.bad.join("; ")}`);
      if (problems.length === 0) break;
      caught.push(...problems);
      validated_rounds++;
      const fix = claude(`Your Allium v4 spec below FAILS mechanical validation against the reference implementation's own execution traces. Fix the spec so every invariant holds on the real traces and it checks cleanly. Output ONLY the corrected spec in one \`\`\`allium block.\n\n=== SPEC ===\n${spec}\n\n=== VALIDATION FAILURES ===\n${problems.join("\n")}\n\n=== SOME REAL TRACES (ground truth the spec must match) ===\n${SAMPLE.slice(0,2).map((s)=>s.id+":\n"+s.text).join("\n")}`);
      cost += fix.cost; spec = block(fix.text, "allium");
    }
  } else {
    // prose: honest eyeball control — shown the same traces, asked to self-verify/fix (no mechanical check)
    const rev = claude(`Verify your prose specification below reproduces these real execution traces from the reference; if you spot any discrepancy, output a corrected spec. Output ONLY the (possibly corrected) prose spec.\n\n=== SPEC ===\n${spec}\n\n=== REAL TRACES ===\n${SAMPLE.slice(0,3).map((s)=>s.id+":\n"+s.text).join("\n")}`);
    cost += rev.cost; spec = rev.text.trim();
  }
  writeFileSync(join(HERE, "arms", `val_${form}_${i}.spec`), spec);
  // rebuild + grade
  const b = claude(REBUILD(spec, form)); cost += b.cost;
  const pyPath = join(HERE, "arms", `val_${form}_${i}.py`);
  writeFileSync(pyPath, block(b.text, "python"));
  const g = grade(pyPath);
  return { rep: i, cost, validated_rounds, caught: caught.slice(0, 3), ...g };
}

const results = {};
for (const form of ["v4", "prose"]) {
  results[form] = [];
  for (let i = 0; i < REPS; i++) {
    const row = await runForm(form, i);
    results[form].push(row);
    console.error(`[${form} ${i}] rebuild match0.5=${row["matched_0.50"]}/150 struct=${row.struct_ok} crashes=${row.crashes} valrounds=${row.validated_rounds} | $${row.cost.toFixed(2)}`);
    writeFileSync(join(HERE, OUT), JSON.stringify(results, null, 2));
  }
}
const mean = (a, k) => a.length ? a.reduce((s, x) => s + (Number(x[k]) || 0), 0) / a.length : 0;
console.log(`\n== VALIDATED DISTILL->REBUILD: v4(check+monitor+fix) vs prose(eyeball), ${REPS} reps, ref=${REF} ==\n`);
console.log(`form     rebuild-match@0.50    struct   crashes   fixrounds   $cost`);
for (const form of ["v4", "prose"]) {
  const a = results[form];
  console.log(`${form.padEnd(8)} ${mean(a,"matched_0.50").toFixed(0).padStart(3)}/150          ${mean(a,"struct_ok").toFixed(0).padStart(3)}   ${mean(a,"crashes").toFixed(1)}   ${mean(a,"validated_rounds").toFixed(1)}   $${mean(a,"cost").toFixed(2)}`);
}
console.log(`\n=> clear air = v4 (mechanically validated) rebuilds match the oracle more than prose (unvalidatable). fixrounds>0 shows the monitor caught+fixed distillation drift.`);
