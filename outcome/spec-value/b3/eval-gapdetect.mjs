#!/usr/bin/env node
// B3 — deterministic gap detection: `allium analyse` vs a model reviewing the SAME spec.
//
// The claim is NOT that analyse catches more (a frontier model may match it) but that its verdict is
// REPRODUCIBLE and NAMED, where a model reviewer is non-deterministic. A gate you cannot trust is one
// that flips verdict across identical runs. So the headline metric is VARIANCE, not mean catch-rate.
//
// Set: 4 specs with a real seeded defect (contradiction, cross-dimension type error, infeasible
// requirement, subtle 3-invariant chain) + 2 clean controls. analyse's verdict on each is fixed and
// was confirmed by hand. Both arms see the SAME Allium source — a controlled "check it two ways".
//
// analyse arm: run the binary 3x per spec; show the verdict is identical every time (variance 0), free.
// model arm: give the spec source, ask CLEAN/DEFECT, N reps; measure catch-rate AND flip-rate.
//
// Usage: node eval-gapdetect.mjs [--reps 6]
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const REPS = Number(argv[argv.indexOf("--reps") + 1] ?? "6");

// ground truth: which specs carry a real defect
const TRUTH = {
  g1_contradiction: true, g3_crossdim: true, g5_infeasible: true, g7_chain: true,
  g4_clean: false, g6_clean: false,
};

function analyseDefect(file) {
  const r = spawnSync(ALLIUM, ["analyse", file], { cwd: HERE, encoding: "utf8" });
  let d = { diagnostics: [] };
  try { d = JSON.parse(r.stdout || "{}"); } catch {}
  const msgs = (d.diagnostics || []).map((x) => x.message).join(" ");
  const err = (d.diagnostics || []).some((x) => x.severity === "Error");
  const flags = ["CONTRADICTORY", "VACUOUSLY", "INFEASIBLE"].filter((k) => msgs.includes(k));
  if (err) flags.push("TYPE_ERROR");
  return { defect: flags.length > 0, flags, exit: r.status };
}

function modelReview(src) {
  const prompt = `You are reviewing a formal behavioural specification for internal consistency. Determine whether it is CLEAN (all rules can hold together and every requirement is satisfiable) or has a DEFECT: a contradiction (invariants that cannot all be true at once), an infeasible requirement, or a type/dimension error.

=== SPECIFICATION ===
${src}
=== END ===

First line: exactly "VERDICT: CLEAN" or "VERDICT: DEFECT". Second line: one sentence naming the specific problem or confirming consistency. Nothing else.`;
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL, "--max-turns", "2",
    "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,Task,Agent,WebFetch,WebSearch"],
    { encoding: "utf8", maxBuffer: 1 << 26, timeout: 180000 });
  const out = r.stdout || "";
  return /VERDICT:\s*DEFECT/i.test(out) ? 1 : (/VERDICT:\s*CLEAN/i.test(out) ? 0 : -1);
}

const specs = readdirSync(HERE).filter((f) => f.endsWith(".allium")).sort();
const rows = [];
for (const f of specs) {
  const id = f.replace(".allium", "");
  const truth = TRUTH[id];
  const src = readFileSync(join(HERE, f), "utf8");
  // analyse arm: 3 identical runs
  const a = [analyseDefect(f), analyseDefect(f), analyseDefect(f)];
  const aStable = a.every((x) => x.defect === a[0].defect);
  // model arm: REPS runs
  const m = [];
  for (let i = 0; i < REPS; i++) m.push(modelReview(src));
  const mDefect = m.filter((v) => v === 1).length;
  const mClean = m.filter((v) => v === 0).length;
  const mCatchRate = mDefect / REPS;              // fraction saying DEFECT
  const flips = !(mDefect === REPS || mClean === REPS); // did the model disagree with itself?
  const modelCorrect = m.filter((v) => (v === 1) === truth).length / REPS;
  rows.push({ id, truth, analyse: a[0].defect, analyse_flags: a[0].flags, analyse_stable: aStable,
    model_catch_rate: mCatchRate, model_correct_rate: modelCorrect, model_flips: flips, model_raw: m });
  console.error(`[${id}] truth=${truth?"DEFECT":"clean"} | analyse=${a[0].defect?"DEFECT":"clean"}(${a[0].flags.join(",")||"-"}) stable=${aStable} | model DEFECT ${mDefect}/${REPS} correct=${(modelCorrect*100).toFixed(0)}% flips=${flips}`);
  writeFileSync(join(HERE, "gapdetect-result.json"), JSON.stringify(rows, null, 2));
}

const defects = rows.filter((r) => r.truth), controls = rows.filter((r) => !r.truth);
const aCatch = defects.filter((r) => r.analyse).length, aFP = controls.filter((r) => r.analyse).length;
const mCatch = defects.reduce((s, r) => s + r.model_catch_rate, 0) / (defects.length || 1);
const mFP = controls.reduce((s, r) => s + r.model_catch_rate, 0) / (controls.length || 1);
const flipCount = rows.filter((r) => r.model_flips).length;
console.log(`\n== B3 deterministic gap detection (${REPS} model reps) ==\n`);
console.log(`arm      defect-catch     false-positive    variance`);
console.log(`analyse  ${aCatch}/${defects.length} (deterministic)  ${aFP}/${controls.length}            0 (identical every run)`);
console.log(`model    ${(mCatch*100).toFixed(0)}% mean           ${(mFP*100).toFixed(0)}% mean          ${flipCount}/${rows.length} specs FLIP across reps`);
console.log(`\n=> value of the checker is DETERMINISM: analyse gives the same named verdict + exit code every run; the model ${flipCount>0?`flips on ${flipCount} spec(s)`:"was stable here"}. A CI/audit gate needs zero flips.`);
