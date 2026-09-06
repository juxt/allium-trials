export const meta = {
  name: 'benchmark-mixed-threshold-gate',
  description: 'REPORTING gate on a MIXED arithmetic-threshold conditional-mandatory rule (the boundary analyse cannot check): notional > 1,000,000 REQUIRES an LEI. A buggy report builder omits the enforcement (accepts a large trade with no LEI). Which arm catches it before submission? v4 runs analyse — which MISSES this (SAT/LRA seam) and, worse, lists the rule as covered. v3/prose/none generate a check, which CAN test the large-notional case. Expected honest INVERSION: analyse ~0, test-gen catches. Maps where analyse is NOT the right tool. 2 models.',
  phases: [{ title: 'Gate' }, { title: 'Score' }],
}
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/mixed-threshold-gate'
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const N = 6
const MODELS = ['opus', 'sonnet']
const BUGGY = `def build(notional, lei_present):
    return {"notional": notional, "has_lei": lei_present}`
const ARTIFACT = {
  none: `The report builder (this is all you have):\n\n\`\`\`python\n${BUGGY}\n\`\`\``,
  prose: `A prose specification:\n"""\nA transaction report record. RULE: a notional greater than 1,000,000 REQUIRES an LEI to be present before submission. build(notional, lei_present) returns the record; a record that breaks the rule must be rejected/invalid.\n"""\n\nThe builder under test:\n\`\`\`python\n${BUGGY}\n\`\`\``,
  v3: `An Allium v3 specification:\n\`\`\`\n-- allium: 3\nspec TxnReport {\n  entity Txn { notional: Integer, has_lei: Boolean }\n  invariant LargeNeedsLei { for t in Txns: t.notional > 1000000 implies t.has_lei }\n}\n\`\`\`\n\nThe builder under test:\n\`\`\`python\n${BUGGY}\n\`\`\``,
}
const CODE_SCHEMA = { type:'object', properties:{ code:{type:'string'} }, required:['code'] }
const GATE_SCHEMA = { type:'object', properties:{ verdict:{type:'string'} }, required:['verdict'] }
const V4_SCHEMA = { type:'object', properties:{ flagged:{type:'boolean'} }, required:['flagged'] }
function genPrompt(arm){
  return `You are writing a PRE-SUBMISSION CHECK (a pytest suite) that must confirm a transaction report obeys the rule: a notional greater than 1,000,000 REQUIRES an LEI. Test thoroughly, including large-notional cases.\n\n${ARTIFACT[arm]}\n\nWrite a pytest module importing \`from solution import build\` that asserts a large-notional record without an LEI is rejected (build raises) while valid records are accepted. Return the COMPLETE module in \`code\`.`
}
function scorePrompt(code){
  return `Score a pre-submission check. Mechanical.\n1. D=$(mktemp -d); write the module below to "$D"/suite.py.\n2. Run: python3 ${DIR}/run_gate.py "$D"/suite.py -> CATCH, MISS, or FALSEALARM.\nReport the verdict. (CATCH = fails on the buggy builder AND passes the correct one.)\n\nSuite:\n\`\`\`python\n${code}\n\`\`\``
}
phase('Gate')
const v4runs=[]; for (const model of MODELS) for (let i=0;i<N;i++) v4runs.push({model,i})
const v4 = await parallel(v4runs.map(r => () =>
  agent(`Run this exact command and report whether analyse flagged a broken invariant:\n\n${ALLIUM} analyse ${DIR}/edited.v4.allium\n\nSet flagged=true iff the output says action \`book_large_no_lei\` can break invariant \`large_needs_lei\`.`,
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
log(`mixed-threshold-gate CATCH%  opus[none ${summary['none/opus'].catch_pct} prose ${summary['prose/opus'].catch_pct} v3 ${summary['v3/opus'].catch_pct} v4 ${summary['v4/opus'].catch_pct}] sonnet[none ${summary['none/sonnet'].catch_pct} prose ${summary['prose/sonnet'].catch_pct} v3 ${summary['v3/sonnet'].catch_pct} v4 ${summary['v4/sonnet'].catch_pct}]`)
return { task:'mixed-threshold-gate', N, summary, raw: all }
