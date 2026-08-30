#!/usr/bin/env node
// PHASE 2b — measure spec COMPLETENESS by mutation-DETECTION (fast, trace-level, no gradle).
//
// A mutant is a KIND of behaviour break applied to real schedule traces. A spec DETECTS a kind if,
// on the mutated trace, some invariant that HELD on the baseline now FAILS. Detection-rate across a
// diverse battery estimates completeness WITHOUT needing a gold spec (the gold here only calibrates).
// The kinds a spec MISSES are its blind spots — the reportable "here is what your spec does not cover".
//
// Compares SPEC_LLM (distilled from informal human guidance) vs SPEC_GOLD (hand-complete). Expectation
// from inspection: SPEC_LLM lacks any inter-period balance link, so it should MISS roll-forward and
// monotonicity breaks that the gold catches.
//
// Usage: node eval-completeness.mjs
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const TRACES = "/Users/hgarner/code/allium-trials/outcome/fineract/traces";
const SPECS = { llm: join(HERE, "spec_llm.allium"), gold: "/Users/hgarner/code/allium-trials/outcome/fineract/LoanScheduleInvariants.allium" };

function parse(text) {
  const periods = []; let given = {};
  for (const line of text.split("\n")) {
    const t = line.trim(); if (!t) continue;
    const toks = t.split(/\s+/);
    if (toks[0] === "given") { for (const tok of toks.slice(1)) { const [k, v] = tok.split("="); given[k] = v; } }
    else if (toks[0].startsWith("period=")) { const p = {}; for (const tok of toks) { const [k, v] = tok.split("="); p[k] = v; } periods.push(p); }
  }
  return { periods, given };
}
function render({ periods, given }) {
  const lines = periods.map((p) => ["period","emi","interest","principal","outstanding_start","is_last"].filter((k)=>k in p).map((k)=>`${k}=${p[k]}`).join(" "));
  lines.push(`given disbursed=${given.disbursed}`); return lines.join("\n") + "\n";
}
const N = (x) => Number(x), M = (x) => x.toFixed(2);

// mutation battery: each takes a parsed trace, returns a mutated copy (or null if inapplicable)
const MUT = {
  emi_perturb:      (t) => { if (t.periods.length<3) return null; const p={...t,periods:t.periods.map(x=>({...x}))}; p.periods[1].emi=M(N(p.periods[1].emi)+5); return p; },
  principal_corrupt:(t) => { if (t.periods.length<3) return null; const p={...t,periods:t.periods.map(x=>({...x}))}; p.periods[1].principal=M(N(p.periods[1].principal)+5); return p; },
  rollforward_break:(t) => { if (t.periods.length<4) return null; const p={...t,periods:t.periods.map(x=>({...x}))}; p.periods[2].outstanding_start=M(N(p.periods[2].outstanding_start)+10); return p; }, // breaks inter-period link only
  monotonic_break:  (t) => { if (t.periods.length<4) return null; const p={...t,periods:t.periods.map(x=>({...x}))}; p.periods[2].outstanding_start=M(N(p.periods[1].outstanding_start)+20); return p; }, // balance jumps UP
  conservation_break:(t)=> { if (t.periods.length<3) return null; const p={...t,periods:t.periods.map(x=>({...x}))}; p.periods[0].principal=M(N(p.periods[0].principal)+7); return p; },
  no_close:         (t) => { const p={...t,periods:t.periods.map(x=>({...x}))}; const last=p.periods.length-1; p.periods[last].principal=M(N(p.periods[last].principal)-3); return p; },
  interest_sign:    (t) => { if (t.periods.length<3) return null; const p={...t,periods:t.periods.map(x=>({...x}))}; p.periods[1].interest=M(-Math.abs(N(p.periods[1].interest))-1); return p; },
  subtle_rounding:  (t) => { const p={...t,periods:t.periods.map(x=>({...x}))}; p.periods.forEach(x=>x.principal=M(N(x.principal)+0.003)); return p; }, // within/near tol — calibration
};

function monitor(spec, traceText) {
  const tmp = join(HERE, "_m.trace"); writeFileSync(tmp, traceText);
  let out = "";
  try { out = execFileSync(ALLIUM, ["monitor-schedule", spec, tmp], { encoding: "utf8" }); }
  catch (e) { out = (e.stdout || "").toString(); } // non-zero exit when invariants fail; stdout still has JSON
  try { const d = JSON.parse(out); const m = {}; for (const r of d.results) m[r.invariant] = r.holds; return m; }
  catch { return {}; }
}

// pick multi-period traces
const files = readdirSync(TRACES).map((f)=>join(TRACES,f)).filter((f)=>{ const t=parse(readFileSync(f,"utf8")); return t.periods.length>=6; }).slice(0, 12);
console.error(`using ${files.length} multi-period traces`);

const detect = {}; // spec -> kind -> {detected, applicable}
for (const specName of Object.keys(SPECS)) {
  detect[specName] = {};
  for (const kind of Object.keys(MUT)) detect[specName][kind] = { detected: 0, applicable: 0 };
}
for (const f of files) {
  const base = parse(readFileSync(f, "utf8"));
  const baseline = {}; for (const s of Object.keys(SPECS)) baseline[s] = monitor(SPECS[s], render(base));
  for (const kind of Object.keys(MUT)) {
    const mut = MUT[kind](base); if (!mut) continue;
    const mtext = render(mut);
    for (const s of Object.keys(SPECS)) {
      detect[s][kind].applicable++;
      const after = monitor(SPECS[s], mtext);
      // detection = some invariant that HELD on baseline now FAILS
      const caught = Object.keys(after).some((inv) => baseline[s][inv] === true && after[inv] === false);
      if (caught) detect[s][kind].detected++;
    }
  }
}

console.log(`\n== PHASE 2b: spec completeness by mutation detection (${files.length} traces) ==\n`);
console.log(`mutation kind        SPEC_LLM (informal)   SPEC_GOLD (hand)`);
const kinds = Object.keys(MUT);
let llmTot=0, goldTot=0, appTot=0;
for (const k of kinds) {
  const l = detect.llm[k], g = detect.gold[k];
  const lr = l.applicable ? (l.detected/l.applicable) : 0, gr = g.applicable ? (g.detected/g.applicable) : 0;
  llmTot += l.detected; goldTot += g.detected; appTot += l.applicable;
  const flag = (gr>0.5 && lr<0.5) ? "  <-- LLM BLIND SPOT" : "";
  console.log(`${k.padEnd(20)} ${(lr*100).toFixed(0).padStart(3)}% (${l.detected}/${l.applicable})        ${(gr*100).toFixed(0).padStart(3)}% (${g.detected}/${g.applicable})${flag}`);
}
console.log(`\nOVERALL detection: SPEC_LLM ${llmTot}/${appTot} (${(100*llmTot/appTot).toFixed(0)}%)  vs  SPEC_GOLD ${goldTot}/${appTot} (${(100*goldTot/appTot).toFixed(0)}%)`);
console.log(`=> the kinds where gold detects but LLM does not are the informal-guidance spec's COMPLETENESS gaps (blind spots).`);
writeFileSync(join(HERE, "completeness-result.json"), JSON.stringify(detect, null, 2));
