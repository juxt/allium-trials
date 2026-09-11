import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const ALLIUM="/Users/hgarner/code/allium-tools/target/debug/allium";
const REF=readFileSync("ref_complex.py","utf8");
const ORACLE="/Users/hgarner/code/allium-trials/outcome/spec-value/p4/oracle_complex";
const SCHEMA=`The execution traces have per-period fields: emi, interest, principal, outstanding_start, rate_factor (the monthly rate factor), is_last; and givens: disbursed, annual_rate_pct, months. Use exactly these names.`;
const COMMON=`\n\nOutput ONLY the v4 spec in one \`\`\`allium block, starting with -- allium: 4 and ending with end. Respond in a SINGLE message; do not use tools. v4: component/entity/given/observable state/invariant; \`given f means e\` defines a value; \`/\` division; \`min\`; \`if c then a else b\`; \`every p ::\`; \`sum p ::\`; \`follows(next,p)\`.`;
const ARMS={
  old: ()=>`Distil an Allium v4 behavioural spec from this implementation.\n\n${SCHEMA}\n\n=== REFERENCE ===\n${REF}${COMMON}`,
  new: ()=>`Distil an Allium v4 behavioural spec from this implementation.\n\n${SCHEMA}\n\nMANDATE (important): write ABSOLUTE, INPUT-ANCHORED invariants — tie each computed output to the INPUTS that produce it (e.g. interest = rate_factor * outstanding_start + a fee), NOT only relations between outputs (like principal = emi - interest). Relational-only specs are blind to wrong VALUES; absolute invariants catch them. Include the fee/rate laws explicitly.\n\n=== REFERENCE ===\n${REF}${COMMON}`,
};
function claude(p){const r=spawnSync("claude",["-p",p,"--output-format","json","--model","claude-opus-4-8","--max-turns","6","--disallowedTools","Task,Agent,Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch"],{encoding:"utf8",maxBuffer:1<<27,timeout:300000});let j={};try{j=JSON.parse(r.stdout||"{}")}catch{}return j.result||"";}
const block=t=>{const m=t.match(/```(?:allium)?\s*([\s\S]*?)```/);return (m?m[1]:t).trim();};
// value-consistent wrong-interest mutant: interest+emi +5, principal unchanged (relations hold, value wrong)
function mutate(txt){return txt.split("\n").map(ln=>{if(!ln.startsWith("period="))return ln;const d=Object.fromEntries(ln.split(/\s+/).filter(t=>t.includes("=")).map(t=>t.split("=")));try{d.interest=(parseFloat(d.interest)+5).toFixed(2);d.emi=(parseFloat(d.emi)+5).toFixed(2);}catch{}return Object.entries(d).map(([k,v])=>`${k}=${v}`).join(" ");}).join("\n");}
function catchRate(specPath){ // over a sample of oracle traces: faithful holds? value-mutant caught?
  const fs=require?null:null; // esm
  const ids=["d5000_r18_m24","d1000_r9.99_m12","d12345.67_r24_m12","d100_r5_m6"];
  let faithful=0, caught=0, n=0;
  for(const id of ids){const t=readFileSync(`${ORACLE}/${id}.trace`,"utf8");
    const h=(txt)=>{writeFileSync("/tmp/ab.trace",txt);const r=spawnSync(ALLIUM,["monitor",specPath,"/tmp/ab.trace","--tol","0.02"],{encoding:"utf8"});try{const d=JSON.parse(r.stdout);return {ok:d.ok,mon:d.monitored}}catch{return{ok:true,mon:0}}};
    const base=h(t); const mut=h(mutate(t)); n++;
    if(base.ok && base.mon>0) faithful++;
    if(!mut.ok) caught++;
  }
  return {faithful,caught,n};
}
const res={};
for(const arm of ["old","new"]){res[arm]=[];
  for(let i=0;i<3;i++){const spec=block(claude(ARMS[arm]()+(i?`\n(attempt ${i+1})`:"")));const p=`spec_${arm}_${i}.allium`;writeFileSync(p,spec);
    const chk=spawnSync(ALLIUM,["check",p],{encoding:"utf8"});let valid=false;try{valid=!JSON.parse(chk.stdout).diagnostics.some(x=>x.severity==="Error")}catch{}
    const cr=valid?catchRate(p):{faithful:0,caught:0,n:4};
    res[arm].push({valid,...cr});console.error(`[${arm} ${i}] valid=${valid} faithful=${cr.faithful}/${cr.n} value-drift-caught=${cr.caught}/${cr.n}`);}}
for(const arm in res){const a=res[arm];const c=a.reduce((s,x)=>s+x.caught,0),f=a.reduce((s,x)=>s+x.faithful,0),n=a.reduce((s,x)=>s+x.n,0);console.log(`${arm}: value-drift caught ${c}/${n}, faithful ${f}/${n} (valid specs ${a.filter(x=>x.valid).length}/${a.length})`);}
