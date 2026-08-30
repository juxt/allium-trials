import { spawnSync } from "node:child_process";
const MODEL="claude-opus-4-8", REPS=4;
const HEADER=`-- This spec is a PARTIAL FLOOR. A change that satisfies every invariant here is NOT thereby proven safe. It constrains only the behaviours listed; anything outside them (idempotency, account correctness, negative/edge inputs, concurrency, absolute values) is unconstrained and must be judged independently.\n`;
const SPEC=`component Allocation\n  -- allocation order: principal, then interest, then fees, then penalties.`;
const CASES=[
 {id:"OS1_bug", benign:false, code:`left = pay(principalDue,left); left = pay(interestDue,left); left = pay(feesDue,left); left = pay(penaltyDue,left);`,
  change:`+ if (payment.isZeroOrNegative()) return;   // before allocation; order unchanged`},
 {id:"benign_rename", benign:true, code:`Money left = payment; left = pay(principalDue,left); ...`,
  change:`// rename local 'left' to 'remaining'. no logic change.`},
];
function ask(p){const r=spawnSync("claude",["-p",p,"--output-format","text","--model",MODEL,"--max-turns","2","--disallowedTools","Bash,Read,Write,Edit,Glob,Grep,Task,Agent,WebFetch,WebSearch"],{encoding:"utf8",maxBuffer:1<<26,timeout:180000});const o=r.stdout||"";return /DECISION:\s*BLOCK/i.test(o)?"BLOCK":(/DECISION:\s*MERGE/i.test(o)?"MERGE":"?");}
// PLAIN consumer prompt (ceiling-style: "must not violate it"); vary only whether spec has the header
function prompt(c,hdr){return `You are reviewing a change. Your team maintains this behavioural spec; a change must not violate it.\n\n=== SPEC ===\n${hdr?HEADER:""}${SPEC}\n=== END ===\n\n=== CODE ===\n${c.code}\n=== CHANGE ===\n${c.change}\n\nCompiles, tests pass. Merge? End with DECISION: MERGE or DECISION: BLOCK and REASON: <one sentence>`;}
const res={};
for(const hdr of [false,true]){const key=hdr?"with_header":"no_header";res[key]={};
 for(const c of CASES){let block=0;for(let r=0;r<REPS;r++){const d=ask(prompt(c,hdr)+(r?`\n(review ${r+1})`:""));if(d==="BLOCK")block++;}res[key][c.id]=`${block}/${REPS} block`;console.error(`[${key} ${c.id}] ${block}/${REPS} block`);}}
console.log(JSON.stringify(res,null,2));
