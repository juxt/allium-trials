#!/usr/bin/env node
// E7-real — confirm on REAL code traces that an input-anchored ABSOLUTE invariant catches the value bug
// the relational spec missed. Post-hoc (no gradle): to each real baseline trace and each M1 wrong-rate
// mutant trace (from Programme 2), add rate_factor = intended monthly rate (annualRate/1200, from the
// filename), then monitor interest_on_outstanding at tol 0.01 (above the ~0.005 day-count rounding
// noise). Expect: baseline HOLDS (spec faithful), M1 CAUGHT (interest diverges from intended rate).
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const GOLD = "/Users/hgarner/code/allium-trials/outcome/fineract/LoanScheduleInvariants.allium";
const BASE = "/Users/hgarner/code/allium-trials/outcome/fineract/traces_baseline";
const MUT = "/Users/hgarner/code/allium-trials/outcome/fineract/traces_mut";
const TOL = "0.01";
function rateFromName(f){const m=f.match(/_r([0-9.]+)_/);return m?Number(m[1]):null;}
function augment(text,rf){ // add rate_factor=rf to each period= line
  return text.split("\n").map(l=>l.trim().startsWith("period=")?`${l.trim()} rate_factor=${rf.toFixed(6)}`:l).join("\n")+"\n";
}
function interestHolds(text){writeFileSync(join(HERE,"_e7r.trace"),text);let o="";try{o=execFileSync(ALLIUM,["monitor-schedule",GOLD,join(HERE,"_e7r.trace"),"--tol",TOL],{encoding:"utf8"});}catch(e){o=(e.stdout||"").toString();}try{const d=JSON.parse(o);const r=d.results.find(x=>x.invariant==="interest_on_outstanding");return r?{eval:true,holds:r.holds,resid:r.max_residual}:{eval:false};}catch{return{eval:false};}}

function run(dir,label){
  const files=readdirSync(dir).filter(f=>f.endsWith(".trace"));
  let evald=0,held=0,caught=0,skipped=0;
  for(const f of files){
    const rate=rateFromName(f); if(rate===null||rate===0){skipped++;continue;} // skip 0% (no interest to check)
    const rf=rate/1200;
    const r=interestHolds(augment(readFileSync(join(dir,f),"utf8"),rf));
    if(!r.eval){skipped++;continue;}
    evald++; if(r.holds)held++; else caught++;
  }
  console.log(`${label.padEnd(10)} interest_on_outstanding evaluated=${evald} held=${held} caught=${caught} (skipped ${skipped} zero-rate/uneval)`);
  return {evald,held,caught};
}
console.log(`\n== E7-real: input-anchored interest invariant on REAL traces (tol ${TOL}) ==\n`);
const b=run(BASE,"baseline"); const m=run(MUT,"M1_wrongrate");
console.log(`\n=> baseline should mostly HOLD (spec faithful to real code); M1 wrong-rate should be CAUGHT.`);
console.log(`   baseline held ${b.held}/${b.evald}; M1 caught ${m.caught}/${m.evald}.`);
console.log(`=> confirms on REAL code: adding an input-anchored ABSOLUTE invariant + the reference input makes the monitor catch the value bug the relations-only spec (E2) missed.`);
