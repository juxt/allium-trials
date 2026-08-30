import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const MODEL="claude-opus-4-8";
const PROSE=readFileSync("prose.txt","utf8"), V4=readFileSync("v4.allium","utf8");
const TASK='\n\nImplement in Python:\n\n    def allocate(payment, penalty_due, fee_due, interest_due, principal_due) -> dict\n        # keys: "penalty","fee","interest","principal","unapplied" (floats)\n\nOutput ONLY a single ```python code block. Respond in a SINGLE message; do not use tools.';
const ARMS={
  nospec:()=>`You are a senior engineer. Implement partial-payment allocation for a loan: a payment is split across the amounts due (penalty, fee, interest, principal).${TASK}`,
  prose:()=>`You are a senior engineer implementing to a spec.\n\n=== SPEC ===\n${PROSE}${TASK}`,
  v4:()=>`You are a senior engineer implementing to an Allium v4 spec (\`given f means e\` defines a value; \`min\` is minimum).\n\n=== SPEC ===\n${V4}${TASK}`,
};
function claude(p){const r=spawnSync("claude",["-p",p,"--output-format","json","--model",MODEL,"--max-turns","6","--disallowedTools","Task,Agent,Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch"],{encoding:"utf8",maxBuffer:1<<27,timeout:300000});let j={};try{j=JSON.parse(r.stdout||"{}")}catch{}return j.result||"";}
const block=t=>{const m=t.match(/```(?:python)?\s*([\s\S]*?)```/);return m?m[1]:t;};
const res={};
for(const arm of ["nospec","prose","v4"]){res[arm]=[];
  for(let i=0;i<3;i++){const py=block(claude(ARMS[arm]()+(i?`\n(attempt ${i+1})`:"")));writeFileSync(`cand_${arm}_${i}.py`,py);
    const g=spawnSync("python3",["grade_alloc.py",`cand_${arm}_${i}.py`],{encoding:"utf8"});let m={};try{m=JSON.parse(g.stdout)}catch{}
    res[arm].push(m.matched||0);console.error(`[${arm} ${i}] matched ${m.matched}/${m.n}`);}}
for(const arm in res){const a=res[arm];console.log(`${arm}: ${(a.reduce((x,y)=>x+y,0)/a.length).toFixed(0)}/42 avg (${a.join(",")})`);}
