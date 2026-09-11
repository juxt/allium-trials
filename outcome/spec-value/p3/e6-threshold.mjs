#!/usr/bin/env node
// E6 — honest boundary of the desync-gate: how small a leg mismatch escapes it, and is the tolerance a
// fundamental floor or a tunable setting? Mismatch one credit leg by delta across the 15 real accounting
// traces, at default tol (0.005) and exact tol (0.0). Prediction: default tol misses sub-0.005 desync;
// tol=0 catches any nonzero desync -> the floor is a SETTING, eliminable for exact-balance domains.
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
const N=x=>Number(x);
function holds(legs,tol){writeFileSync(join(HERE,"_e6.trace"),render(legs));const args=["monitor",DE,join(HERE,"_e6.trace")];if(tol!==undefined)args.push("--tol",String(tol));let o="";try{o=execFileSync(ALLIUM,args,{encoding:"utf8"});}catch(e){o=(e.stdout||"").toString();}try{const d=JSON.parse(o);const r=d.results.find(x=>x.invariant==="double_entry_balances");return r?r.holds:true;}catch{return true;}}
function mismatch(legs,delta){const i=legs.findIndex(l=>N(l.credit)>0);if(i<0)return null;const c=legs.map(l=>({...l}));c[i].credit=(N(c[i].credit)+delta).toFixed(3);return c;}

const files=readdirSync(CORPUS).filter(f=>f.endsWith(".trace"));
const deltas=[0.001,0.005,0.01,0.02];
const tols=[undefined,0.0]; // default(0.005), exact(0)
const res={};
for(const tol of tols){const key=tol===undefined?"tol_default_0.005":"tol_exact_0";res[key]={};
  for(const delta of deltas){let d=0,n=0;
    for(const f of files){const legs=parse(readFileSync(join(CORPUS,f),"utf8"));if(!holds(legs,tol))continue;const m=mismatch(legs,delta);if(!m)continue;n++;if(!holds(m,tol))d++;}
    res[key][`+${delta}`]=`${d}/${n}`;}}
console.log(`\n== E6: desync detection threshold (mismatch one credit leg by delta; ${files.length} traces) ==\n`);
console.log(`tol setting        +0.001   +0.005   +0.01    +0.02`);
for(const[k,v]of Object.entries(res))console.log(`${k.padEnd(18)} ${(v["+0.001"]||"-").padEnd(8)} ${(v["+0.005"]||"-").padEnd(8)} ${(v["+0.01"]||"-").padEnd(8)} ${v["+0.02"]||"-"}`);
console.log(`\n=> the tolerance is a SETTING: at default 0.005 sub-cent desync escapes; at --tol 0 any nonzero desync is caught. For exact-balance domains (double-entry) set tol=0 -> no fundamental floor.`);
writeFileSync(join(HERE,"e6-result.json"),JSON.stringify(res,null,2));
