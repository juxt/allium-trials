import { spawnSync } from "node:child_process";
const MODEL="claude-opus-4-8", REPS=4;
const SPEC=`component Allocation\n  -- allocation order: principal, then interest, then fees, then penalties.`;
const CASE={code:`left = pay(principalDue,left); left = pay(interestDue,left); left = pay(feesDue,left); left = pay(penaltyDue,left);`,
  change:`+ if (payment.isZeroOrNegative()) return;   // before allocation; order unchanged`};
function ask(p){const r=spawnSync("claude",["-p",p,"--output-format","text","--model",MODEL,"--max-turns","2","--disallowedTools","Bash,Read,Write,Edit,Glob,Grep,Task,Agent,WebFetch,WebSearch"],{encoding:"utf8",maxBuffer:1<<26,timeout:180000});const o=r.stdout||"";return /DECISION:\s*BLOCK/i.test(o)?"BLOCK":(/DECISION:\s*MERGE/i.test(o)?"MERGE":"?");}
const CEIL=`You are reviewing a change. Your team maintains this behavioural spec; a change must not violate it.`;
const FLOOR=`You are reviewing a change. Your team maintains the behavioural spec below. IMPORTANT: it is PARTIAL — treat it as a FLOOR, not a checklist: a change must not violate it, AND you must independently flag ANY other correctness/safety/data-integrity risk it does not mention. "Does not violate the spec" does NOT mean "safe".`;
function prompt(instr){return `${instr}\n\n=== SPEC ===\n${SPEC}\n=== END ===\n\n=== CODE ===\n${CASE.code}\n=== CHANGE ===\n${CASE.change}\n\nCompiles, tests pass. Merge? End with DECISION: MERGE or DECISION: BLOCK and REASON: <one sentence>`;}
for(const [name,instr] of [["ceiling-consumer",CEIL],["floor-consumer",FLOOR]]){let b=0;for(let r=0;r<REPS;r++){if(ask(prompt(instr)+(r?`\n(review ${r+1})`:""))==="BLOCK")b++;}console.error(`[${name}] ${b}/${REPS} block`);}
