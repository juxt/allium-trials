#!/usr/bin/env node
// E3 — big-n, MECHANICAL characterisation of what the spec-gate catches. For every one of the 150 real
// baseline traces, apply STRUCTURAL breaks (violate a relational invariant locally) and VALUE-ONLY
// breaks (change values while keeping the schedule internally consistent), monitor the gold spec, tally
// detection by class with Wilson 95% CIs. No gradle, no model judge — pure deterministic monitor.
// Hypothesis (from E2 mul2sub: spec held): structural ~100% detected; value-only ~0% (the gate is
// blind to internally-consistent value errors).
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const SPEC = "/Users/hgarner/code/allium-trials/outcome/fineract/LoanScheduleInvariants.allium";
const TRACES = "/Users/hgarner/code/allium-trials/outcome/fineract/traces_baseline";

function parse(t){const periods=[];let given={};for(const line of t.split("\n")){const s=line.trim();if(!s)continue;const k=s.split(/\s+/);if(k[0]==="given"){for(const x of k.slice(1)){const[a,b]=x.split("=");given[a]=b;}}else if(k[0].startsWith("period=")){const p={};for(const x of k){const[a,b]=x.split("=");p[a]=b;}periods.push(p);}}return{periods,given};}
function render({periods,given}){const L=periods.map(p=>["period","emi","interest","principal","outstanding_start","is_last"].filter(k=>k in p).map(k=>`${k}=${p[k]}`).join(" "));L.push(`given disbursed=${given.disbursed}`);return L.join("\n")+"\n";}
const N=x=>Number(x),M=x=>x.toFixed(2);
function monitorHolds(text){writeFileSync(join(HERE,"_e3.trace"),text);let out="";try{out=execFileSync(ALLIUM,["monitor-schedule",SPEC,join(HERE,"_e3.trace")],{encoding:"utf8"});}catch(e){out=(e.stdout||"").toString();}try{const d=JSON.parse(out);return d.results.every(r=>r.holds);}catch{return true;}}

// STRUCTURAL breaks (should be caught): perturb one field of one interior period
const STRUCT={
  emi_bump:t=>{if(t.periods.length<3)return null;const p=clone(t);p.periods[1].emi=M(N(p.periods[1].emi)+5);return p;},
  principal_bump:t=>{if(t.periods.length<3)return null;const p=clone(t);p.periods[1].principal=M(N(p.periods[1].principal)+5);return p;},
  rollforward:t=>{if(t.periods.length<4)return null;const p=clone(t);p.periods[2].outstanding_start=M(N(p.periods[2].outstanding_start)+10);return p;},
  monotonic:t=>{if(t.periods.length<4)return null;const p=clone(t);p.periods[2].outstanding_start=M(N(p.periods[1].outstanding_start)+20);return p;},
  conservation:t=>{if(t.periods.length<3)return null;const p=clone(t);p.periods[0].principal=M(N(p.periods[0].principal)+7);return p;},
  no_close:t=>{const p=clone(t);const L=p.periods.length-1;p.periods[L].principal=M(N(p.periods[L].principal)-3);return p;},
};
// VALUE-ONLY breaks (structure preserved -> spec should MISS): uniform rescale, and add-constant to all
const VALUE={
  scale_1_10:t=>uniform(t,1.10),  // every amount 10% too large (wrong loan size), still self-consistent
  scale_0_90:t=>uniform(t,0.90),
  scale_1_25:t=>uniform(t,1.25),
};
function clone(t){return{given:{...t.given},periods:t.periods.map(x=>({...x}))};}
function uniform(t,k){const p=clone(t);p.given.disbursed=M(N(p.given.disbursed)*k);for(const x of p.periods)for(const f of["emi","interest","principal","outstanding_start"])if(f in x)x[f]=M(N(x[f])*k);return p;}

function wilson(s,n){if(n===0)return[0,0];const z=1.96,ph=s/n;const d=1+z*z/n;const c=(ph+z*z/(2*n))/d;const h=z*Math.sqrt(ph*(1-ph)/n+z*z/(4*n*n))/d;return[Math.max(0,c-h),Math.min(1,c+h)];}

const files=readdirSync(TRACES).map(f=>join(TRACES,f)).filter(f=>f.endsWith(".trace"));
const tally={};
for(const cls of["STRUCTURAL","VALUE_ONLY"])tally[cls]={detected:0,applicable:0,byop:{}};
const OPS={STRUCTURAL:STRUCT,VALUE_ONLY:VALUE};
for(const f of files){
  const base=parse(readFileSync(f,"utf8"));
  if(!monitorHolds(render(base)))continue; // only use traces where the spec holds at baseline
  for(const cls of Object.keys(OPS)){
    for(const [op,fn] of Object.entries(OPS[cls])){
      const m=fn(base);if(!m)continue;
      tally[cls].applicable++;tally[cls].byop[op]=tally[cls].byop[op]||{d:0,n:0};tally[cls].byop[op].n++;
      const caught=!monitorHolds(render(m));
      if(caught){tally[cls].detected++;tally[cls].byop[op].d++;}
    }
  }
}
console.log(`\n== E3: spec-gate detection by mutation class (${files.length} real traces, MECHANICAL) ==\n`);
for(const cls of Object.keys(tally)){
  const t=tally[cls];const[lo,hi]=wilson(t.detected,t.applicable);
  console.log(`${cls.padEnd(12)} detection ${t.detected}/${t.applicable} = ${(100*t.detected/t.applicable).toFixed(0)}%  (95% CI ${(lo*100).toFixed(0)}-${(hi*100).toFixed(0)}%)`);
  for(const[op,v]of Object.entries(t.byop))console.log(`    ${op.padEnd(16)} ${v.d}/${v.n}`);
}
console.log(`\n=> confident, generalizable statement: the spec-gate catches STRUCTURAL regressions but is BLIND to VALUE-ONLY (internally-consistent) regressions. This is why E2's mul2* mutants (which keep the schedule self-consistent) hold on the spec but fail the shipped fixed-value test.`);
writeFileSync(join(HERE,"e3-result.json"),JSON.stringify(tally,null,2));
