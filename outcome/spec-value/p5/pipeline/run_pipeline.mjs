// Modern distill pipeline: distil -> check(fix) -> completeness(fix) -> a COMPLETE, faithful, value-
// gating spec. Uses the session's tools (dot notation, stdlib, completeness probe) in one loop.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const ALLIUM="/Users/hgarner/code/allium-tools/target/debug/allium";
const REF=readFileSync("ref_complex.py","utf8");
const ORACLE="/Users/hgarner/code/allium-trials/outcome/spec-value/p4/oracle_complex";
const SAMPLE=["d5000_r18_m24","d1000_r9.99_m12"].map(id=>({id,txt:readFileSync(`${ORACLE}/${id}.trace`,"utf8")}));
const SCHEMA=`Trace fields per period: emi, interest, principal, outstanding_start, rate_factor, is_last; givens: disbursed, annual_rate_pct, months. Use exactly these names. You may write field access as field(p) OR p.field.`;
function claude(p){const r=spawnSync("claude",["-p",p,"--output-format","json","--model","claude-opus-4-8","--max-turns","6","--disallowedTools","Task,Agent,Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch"],{encoding:"utf8",maxBuffer:1<<27,timeout:300000});let j={};try{j=JSON.parse(r.stdout||"{}")}catch{}return j.result||"";}
const block=t=>{const m=t.match(/```(?:allium)?\s*([\s\S]*?)```/);return (m?m[1]:t).trim();};
function check(spec){writeFileSync("/tmp/pl.allium",spec);const r=spawnSync(ALLIUM,["check","/tmp/pl.allium"],{encoding:"utf8"});try{const e=JSON.parse(r.stdout).diagnostics.filter(x=>x.severity==="Error").map(x=>x.message);return e;}catch{return["parse failure"];}}
function faithful(spec){writeFileSync("/tmp/pl.allium",spec);for(const s of SAMPLE){writeFileSync("/tmp/pl.trace",s.txt);const r=spawnSync(ALLIUM,["monitor-schedule","/tmp/pl.allium","/tmp/pl.trace","--tol","0.02"],{encoding:"utf8"});try{const d=JSON.parse(r.stdout);if(!d.ok||d.monitored===0)return {ok:false,id:s.id,mon:d.monitored,fails:(d.results||[]).filter(x=>!x.holds).map(x=>x.invariant+" resid "+x.max_residual)};}catch{return{ok:false,id:s.id};}}return {ok:true};}
function blindspots(spec){writeFileSync("/tmp/pl.allium",spec);const r=spawnSync("python3",["../completeness_probe.py","/tmp/pl.allium",`${ORACLE}/d5000_r18_m24.trace`],{encoding:"utf8"});const bs=(r.stdout.match(/BLIND SPOT/g)||[]).length;const fields=[...r.stdout.matchAll(/^  (\w+)\s+BLIND SPOT/gm)].map(m=>m[1]);return {bs,fields};}
function catchesValueDrift(spec){writeFileSync("/tmp/pl.allium",spec);let caught=0,n=0;for(const s of SAMPLE){n++;const mut=s.txt.split("\n").map(l=>{if(!l.startsWith("period="))return l;const d=Object.fromEntries(l.split(/\s+/).filter(t=>t.includes("=")).map(t=>t.split("=")));try{d.interest=(parseFloat(d.interest)+5).toFixed(2);d.emi=(parseFloat(d.emi)+5).toFixed(2);}catch{}return Object.entries(d).map(([k,v])=>`${k}=${v}`).join(" ");}).join("\n");writeFileSync("/tmp/pl.trace",mut);const r=spawnSync(ALLIUM,["monitor-schedule","/tmp/pl.allium","/tmp/pl.trace","--tol","0.02"],{encoding:"utf8"});try{if(!JSON.parse(r.stdout).ok)caught++;}catch{}}return {caught,n};}

const DISTILL=`Distil an Allium v4 spec from this code. ${SCHEMA}\n\nMANDATE: write ABSOLUTE input-anchored invariants (tie each output to its inputs: interest = rate_factor*outstanding + the fee; the fee = 0.25% of disbursed) so wrong VALUES are caught, plus structural laws (principal split, conservation, closes to zero). Constrain EVERY output field. Respond in a SINGLE message; do not use tools. Output ONLY the spec in one \`\`\`allium block, -- allium: 4 ... end.\n\n=== CODE ===\n${REF}`;

for(let rep=0;rep<2;rep++){
  let cost=0, log=[];
  let spec=block((()=>{const t=claude(DISTILL);cost+= 0;return t;})());
  for(let round=0;round<3;round++){
    const errs=check(spec);
    if(errs.length){log.push(`round ${round}: INVALID (${errs.slice(0,2).join("; ").slice(0,80)})`);
      spec=block(claude(`Your v4 spec has parse/name errors: ${errs.slice(0,4).join("; ")}. Fix them. Single message, only the corrected spec in one \`\`\`allium block.\n\n${spec}`));continue;}
    const f=faithful(spec);
    if(!f.ok){log.push(`round ${round}: UNFAITHFUL on ${f.id} (${(f.fails||[]).slice(0,2).join("; ")||"monitored 0"})`);
      spec=block(claude(`Your v4 spec (below) FAILS on the reference's real trace ${f.id}: ${(f.fails||["nothing monitorable"]).slice(0,3).join("; ")}. Fix the invariants to hold on the real code. Single message, only the corrected spec in one \`\`\`allium block.\n\nTRACE:\n${SAMPLE.find(s=>s.id===f.id).txt}\n\nSPEC:\n${spec}`));continue;}
    const b=blindspots(spec);
    if(b.bs>0){log.push(`round ${round}: ${b.bs} BLIND SPOT(S): ${b.fields.join(",")}`);
      spec=block(claude(`Your v4 spec does not constrain these output fields (drift there is uncatchable): ${b.fields.join(", ")}. Add invariants pinning them. Single message, only the corrected spec in one \`\`\`allium block.\n\n${spec}`));continue;}
    log.push(`round ${round}: VALID + FAITHFUL + COMPLETE`); break;
  }
  writeFileSync(`spec_${rep}.allium`, spec);
  const finalCheck=check(spec).length===0, f=faithful(spec).ok, b=blindspots(spec), vd=catchesValueDrift(spec);
  console.error(`[rep ${rep}] valid=${finalCheck} faithful=${f} blindspots=${b.bs} value-drift-caught=${vd.caught}/${vd.n} | ${log.join(" -> ")}`);
}
