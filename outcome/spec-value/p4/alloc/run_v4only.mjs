import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const V4=readFileSync("v4.allium","utf8");
const TASK='\n\nImplement in Python:\n\n    def allocate(payment, penalty_due, fee_due, interest_due, principal_due) -> dict\n        # keys: "penalty","fee","interest","principal","unapplied" (floats)\n\nOutput ONLY a single ```python code block. Respond in a SINGLE message; do not use tools.';
function claude(p){const r=spawnSync("claude",["-p",p,"--output-format","json","--model","claude-opus-4-8","--max-turns","6","--disallowedTools","Task,Agent,Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch"],{encoding:"utf8",maxBuffer:1<<27,timeout:300000});let j={};try{j=JSON.parse(r.stdout||"{}")}catch{}return j.result||"";}
const block=t=>{const m=t.match(/```(?:python)?\s*([\s\S]*?)```/);return m?m[1]:t;};
for(let i=0;i<3;i++){const py=block(claude(`You are a senior engineer implementing to an Allium v4 spec (\`given f means e\` defines a value; \`/\` is division).\n\n=== SPEC ===\n${V4}${TASK}`+(i?`\n(attempt ${i+1})`:"")));writeFileSync(`cand_v4_${i}.py`,py);
  const g=spawnSync("python3",["grade_alloc.py",`cand_v4_${i}.py`],{encoding:"utf8"});console.error(`[v4 ${i}] ${g.stdout.trim()}`);}
