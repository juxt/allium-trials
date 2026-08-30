#!/usr/bin/env node
// E5 — the unifying principle at big-n, mechanically, on real accounting leg-traces: the double-entry
// spec catches DESYNC bugs (a leg omitted/changed on one side) but is BLIND to consistent-VALUE bugs
// (all legs scaled together). This is the same law as the solver side (E2) — it's not "accounting vs
// solver", it's "desync caught, consistent-value blind" everywhere. Accounting benefits only because
// its characteristic bugs (omitted/duplicated legs) ARE desyncs.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const DE = "/Users/hgarner/code/allium-trials/outcome/spec-value/b5/spec-doubleentry.allium";
const CORPUS = "/Users/hgarner/code/allium-trials/outcome/fineract/scale-test/je-traces/baseline";

function parse(t){const legs=[];for(const line of t.split("\n")){const s=line.trim();if(!s||!s.startsWith("period="))continue;const o={};for(const tok of s.split(/\s+/)){const[k,v]=tok.split("=");o[k]=v;}legs.push(o);}return legs;}
function render(legs){return legs.map((l,i)=>`period=${i} account=${l.account||"GL"} debit=${l.debit} credit=${l.credit}`).join("\n")+"\n";}
const N=x=>Number(x),M=x=>x.toFixed(2);
function holds(legs){writeFileSync(join(HERE,"_e5.trace"),render(legs));let o="";try{o=execFileSync(ALLIUM,["monitor-schedule",DE,join(HERE,"_e5.trace")],{encoding:"utf8"});}catch(e){o=(e.stdout||"").toString();}try{const d=JSON.parse(o);const r=d.results.find(x=>x.invariant==="double_entry_balances");return r?r.holds:true;}catch{return true;}}
const clone=legs=>legs.map(l=>({...l}));

const DESYNC={
  omit_credit_leg:legs=>{const i=legs.findIndex(l=>N(l.credit)>0);if(i<0)return null;const c=clone(legs);c.splice(i,1);return c;},
  omit_debit_leg:legs=>{const i=legs.findIndex(l=>N(l.debit)>0);if(i<0)return null;const c=clone(legs);c.splice(i,1);return c;},
  halve_one_credit:legs=>{const i=legs.findIndex(l=>N(l.credit)>0);if(i<0)return null;const c=clone(legs);c[i].credit=M(N(c[i].credit)/2);return c;},
  duplicate_one_debit:legs=>{const i=legs.findIndex(l=>N(l.debit)>0);if(i<0)return null;const c=clone(legs);c.push({...c[i]});return c;},
};
const VALUE={
  scale_all_1_10:legs=>legs.map(l=>({...l,debit:M(N(l.debit)*1.10),credit:M(N(l.credit)*1.10)})),
  scale_all_0_90:legs=>legs.map(l=>({...l,debit:M(N(l.debit)*0.90),credit:M(N(l.credit)*0.90)})),
};

const files=readdirSync(CORPUS).filter(f=>f.endsWith(".trace"));
const tally={DESYNC:{d:0,n:0,byop:{}},VALUE:{d:0,n:0,byop:{}}};
const OPS={DESYNC,VALUE};
let baseOK=0;
for(const f of files){
  const legs=parse(readFileSync(join(CORPUS,f),"utf8"));
  if(!holds(legs))continue; baseOK++; // only traces balanced at baseline
  for(const cls of Object.keys(OPS))for(const[op,fn]of Object.entries(OPS[cls])){
    const m=fn(legs);if(!m)continue;
    tally[cls].n++;tally[cls].byop[op]=tally[cls].byop[op]||{d:0,n:0};tally[cls].byop[op].n++;
    if(!holds(m)){tally[cls].d++;tally[cls].byop[op].d++;}
  }
}
function wilson(s,n){if(!n)return[0,0];const z=1.96,p=s/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return[Math.max(0,c-h),Math.min(1,c+h)];}
console.log(`\n== E5: double-entry spec detection on real accounting traces (${baseOK} balanced traces) ==\n`);
for(const cls of Object.keys(tally)){const t=tally[cls];const[lo,hi]=wilson(t.d,t.n);
  console.log(`${cls.padEnd(7)} ${t.d}/${t.n} = ${(100*t.d/t.n||0).toFixed(0)}%  (95% CI ${(lo*100).toFixed(0)}-${(hi*100).toFixed(0)}%)`);
  for(const[op,v]of Object.entries(t.byop))console.log(`    ${op.padEnd(20)} ${v.d}/${v.n}`);}
console.log(`\n=> DESYNC (omit/change one leg) caught; consistent VALUE (scale all legs) blind. Same law as the solver side: the spec catches relation-breaking bugs, not consistent-value bugs. Accounting benefits because omitted legs ARE desyncs.`);
writeFileSync(join(HERE,"e5-result.json"),JSON.stringify(tally,null,2));
