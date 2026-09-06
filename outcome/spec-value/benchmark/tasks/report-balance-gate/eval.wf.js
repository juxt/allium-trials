export const meta = {
  name: 'benchmark-report-balance-gate',
  description: 'REGULATORY REPORTING gate (accounting/GL balancing). Before a balance sheet is submitted, the check must confirm the fundamental identity assets == liabilities + equity. An edit posts an accrual via two half-postings, which loses $1 on ODD amounts (integer-division rounding) — so the sheet fails to balance for odd accruals only. Which arm CATCHES this before submission? v4 runs analyse (proves the identity over ALL amounts). v3/prose generate a pre-submission check. no-spec checks the code. Discriminator: the odd-amount edge an even-only check misses. 2 models.',
  phases: [{ title: 'Gate' }, { title: 'Score' }],
}
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/report-balance-gate'
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const N = 6
const MODELS = ['opus', 'sonnet']
const BUGGY = `def build(base_assets, base_liab, base_equity, accrual):
    assets = base_assets + accrual
    liabilities = base_liab
    equity = base_equity + (accrual // 2) + (accrual // 2)
    return {"assets": assets, "liabilities": liabilities, "equity": equity}`
const ARTIFACT = {
  none: `The report builder (this is all you have):\n\n\`\`\`python\n${BUGGY}\n\`\`\``,
  prose: `A prose specification:\n"""\nA balance sheet must satisfy the accounting identity assets == liabilities + equity BEFORE it is submitted to a regulator, for ANY accrual amount. build(base_assets, base_liab, base_equity, accrual) returns {assets, liabilities, equity}.\n"""\n\nThe builder under test:\n\`\`\`python\n${BUGGY}\n\`\`\``,
  v3: `An Allium v3 specification:\n\`\`\`\n-- allium: 3\nspec BalanceSheet {\n  entity Sheet { assets: Integer, liabilities: Integer, equity: Integer }\n  invariant Balanced { for s in Sheets: s.assets == s.liabilities + s.equity }\n}\n\`\`\`\n\nThe builder under test:\n\`\`\`python\n${BUGGY}\n\`\`\``,
}
const CODE_SCHEMA = { type:'object', properties:{ code:{type:'string'} }, required:['code'] }
const GATE_SCHEMA = { type:'object', properties:{ verdict:{type:'string'} }, required:['verdict'] }
const V4_SCHEMA = { type:'object', properties:{ flagged:{type:'boolean'} }, required:['flagged'] }
function genPrompt(arm){
  return `You are writing a PRE-SUBMISSION CHECK (a pytest suite) that must confirm a balance sheet satisfies the accounting identity assets == liabilities + equity before it goes to a regulator — for ANY accrual amount. Test thoroughly.\n\n${ARTIFACT[arm]}\n\nWrite a pytest module importing \`from solution import build\` that asserts the identity holds after build() across accrual amounts. Return the COMPLETE module in \`code\`.`
}
function scorePrompt(code){
  return `Score a pre-submission check. Mechanical.\n1. D=$(mktemp -d); write the module below to "$D"/suite.py.\n2. Run: python3 ${DIR}/run_gate.py "$D"/suite.py -> CATCH, MISS, or FALSEALARM.\nReport the verdict. (CATCH = fails on the buggy builder AND passes the correct one.)\n\nSuite:\n\`\`\`python\n${code}\n\`\`\``
}
phase('Gate')
const v4runs = []
for (const model of MODELS) for (let i=0;i<N;i++) v4runs.push({model,i})
const v4 = await parallel(v4runs.map(r => () =>
  agent(`Run this exact command and report whether analyse flagged a broken invariant:\n\n${ALLIUM} analyse ${DIR}/edited.v4.allium\n\nSet flagged=true iff the output says action \`accrue\` can break arithmetic invariant \`balanced\`.`,
    { label:`v4-gate/${r.model}#${r.i}`, phase:'Gate', model:r.model, schema:V4_SCHEMA }).then(x => ({ arm:'v4', model:r.model, verdict: x&&x.flagged?'CATCH':'MISS' }))))
const items = []
for (const arm of ['none','prose','v3']) for (const model of MODELS) for (let i=0;i<N;i++) items.push({arm,model,i})
const gen = await pipeline(items,
  ({arm,model,i}) => agent(genPrompt(arm), { label:`gen:${arm}/${model}#${i}`, phase:'Gate', model, schema:CODE_SCHEMA }),
  (c,{arm,model,i}) => (c&&c.code ? agent(scorePrompt(c.code), { label:`score:${arm}/${model}#${i}`, phase:'Score', model:'sonnet', schema:GATE_SCHEMA }).then(r => r?{arm,model,verdict:r.verdict}:null) : null),
)
const all = [...v4.filter(Boolean), ...gen.filter(Boolean)]
const summary = {}
for (const arm of ['none','prose','v3','v4']) for (const model of MODELS){
  const rs = all.filter(r => r.arm===arm && r.model===model); const n = rs.length||1
  summary[`${arm}/${model}`] = { n:rs.length, catch_pct: Number((rs.filter(r=>r.verdict==='CATCH').length/n*100).toFixed(1)) }
}
log(`report-balance-gate CATCH%  opus[none ${summary['none/opus'].catch_pct} prose ${summary['prose/opus'].catch_pct} v3 ${summary['v3/opus'].catch_pct} v4 ${summary['v4/opus'].catch_pct}] sonnet[none ${summary['none/sonnet'].catch_pct} prose ${summary['prose/sonnet'].catch_pct} v3 ${summary['v3/sonnet'].catch_pct} v4 ${summary['v4/sonnet'].catch_pct}]`)
return { task:'report-balance-gate', N, summary, raw: all }
