export const meta = {
  name: 'benchmark-fineract-journal-gate',
  description: 'REGULATORY REPORTING gate grounded in REAL Apache Fineract GL. Fineract rule (verbatim from its API docs): a journal entry is line items of debits/credits, and total debits must equal total credits or the entry is unbalanced. A posting splits a credit across two sub-ledger lines via integer halves, losing $1 on ODD amounts — so the entry is unbalanced for odd credit totals only. Which arm catches it before the GL is reported? v4 runs analyse (proves total_debits == total_credits over ALL amounts). v3/prose/none generate a pre-submission check. 2 models.',
  phases: [{ title: 'Gate' }, { title: 'Score' }],
}
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/fineract-journal-gate'
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const N = 6
const MODELS = ['opus', 'sonnet']
const BUGGY = `def post_entry(debit_lines, credit_amount):
    debits = list(debit_lines)
    half = credit_amount // 2
    credits = [half, half]
    return {"debits": debits, "credits": credits}`
const IFACE = `post_entry(debit_lines, credit_amount) posts a journal entry: debit_lines is a list of debit amounts, credit_amount is the total credit (split across sub-ledger credit lines). It returns {"debits": [...], "credits": [...]}. A valid entry has sum(debits) == sum(credits) (Fineract's balancing rule). Test with entries where sum(debit_lines) == credit_amount.`
const ARTIFACT = {
  none: `The posting code (this is all you have):\n\n\`\`\`python\n${BUGGY}\n\`\`\`\n\n${IFACE}`,
  prose: `A prose specification:\n"""\nA journal entry consists of debit and credit line items. Fineract's rule: the total of the debits must equal the total of the credits, or the entry is UNBALANCED and must not be posted. This must hold for ANY amount.\n"""\n\n${IFACE}\n\nThe posting code under test:\n\`\`\`python\n${BUGGY}\n\`\`\``,
  v3: `An Allium v3 specification:\n\`\`\`\n-- allium: 3\nspec JournalEntry {\n  entity Entry { total_debits: Integer, total_credits: Integer }\n  invariant Balanced { for e in Entries: e.total_debits == e.total_credits }\n}\n\`\`\`\n\n${IFACE}\n\nThe posting code under test:\n\`\`\`python\n${BUGGY}\n\`\`\``,
}
const CODE_SCHEMA = { type:'object', properties:{ code:{type:'string'} }, required:['code'] }
const GATE_SCHEMA = { type:'object', properties:{ verdict:{type:'string'} }, required:['verdict'] }
const V4_SCHEMA = { type:'object', properties:{ flagged:{type:'boolean'} }, required:['flagged'] }
function genPrompt(arm){
  return `You are writing a PRE-SUBMISSION CHECK (a pytest suite) that must confirm a journal entry balances — total debits equal total credits — before it is posted to the general ledger, for ANY amount. Test thoroughly, including odd amounts.\n\n${ARTIFACT[arm]}\n\nWrite a pytest module importing \`from solution import post_entry\` that asserts sum of debits == sum of credits across a range of entries (use entries where sum(debit_lines) == credit_amount). Return the COMPLETE module in \`code\`.`
}
function scorePrompt(code){
  return `Score a pre-submission check. Mechanical.\n1. D=$(mktemp -d); write the module below to "$D"/suite.py.\n2. Run: python3 ${DIR}/run_gate.py "$D"/suite.py -> CATCH, MISS, or FALSEALARM.\nReport the verdict. (CATCH = fails on the buggy posting AND passes the correct one.)\n\nSuite:\n\`\`\`python\n${code}\n\`\`\``
}
phase('Gate')
const v4runs=[]; for (const model of MODELS) for (let i=0;i<N;i++) v4runs.push({model,i})
const v4 = await parallel(v4runs.map(r => () =>
  agent(`Run this exact command and report whether analyse flagged a broken invariant:\n\n${ALLIUM} analyse ${DIR}/edited.v4.allium\n\nSet flagged=true iff the output says action \`post_split\` can break (arithmetic) invariant \`balanced\`.`,
    { label:`v4-gate/${r.model}#${r.i}`, phase:'Gate', model:r.model, schema:V4_SCHEMA }).then(x => ({ arm:'v4', model:r.model, verdict: x&&x.flagged?'CATCH':'MISS' }))))
const items=[]; for (const arm of ['none','prose','v3']) for (const model of MODELS) for (let i=0;i<N;i++) items.push({arm,model,i})
const gen = await pipeline(items,
  ({arm,model,i}) => agent(genPrompt(arm), { label:`gen:${arm}/${model}#${i}`, phase:'Gate', model, schema:CODE_SCHEMA }),
  (c,{arm,model,i}) => (c&&c.code ? agent(scorePrompt(c.code), { label:`score:${arm}/${model}#${i}`, phase:'Score', model:'sonnet', schema:GATE_SCHEMA }).then(r => r?{arm,model,verdict:r.verdict}:null) : null),
)
const all=[...v4.filter(Boolean), ...gen.filter(Boolean)]
const summary={}
for (const arm of ['none','prose','v3','v4']) for (const model of MODELS){
  const rs=all.filter(r=>r.arm===arm&&r.model===model); const n=rs.length||1
  summary[`${arm}/${model}`]={n:rs.length, catch_pct:Number((rs.filter(r=>r.verdict==='CATCH').length/n*100).toFixed(1))}
}
log(`fineract-journal-gate CATCH%  opus[none ${summary['none/opus'].catch_pct} prose ${summary['prose/opus'].catch_pct} v3 ${summary['v3/opus'].catch_pct} v4 ${summary['v4/opus'].catch_pct}] sonnet[none ${summary['none/sonnet'].catch_pct} prose ${summary['prose/sonnet'].catch_pct} v3 ${summary['v3/sonnet'].catch_pct} v4 ${summary['v4/sonnet'].catch_pct}]`)
return { task:'fineract-journal-gate', N, summary, raw: all }
