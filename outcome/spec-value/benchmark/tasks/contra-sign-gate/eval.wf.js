export const meta = {
  name: 'benchmark-contra-sign-gate',
  description: 'DISCRIMINATING reporting gate on a NON-OBVIOUS real accounting rule: a contra account (e.g. accumulated depreciation, a credit-normal ASSET) FLIPS its normal side, so its reporting balance uses the opposite sign. A buggy balance function ignores the contra flag. The bug manifests ONLY for contra accounts — a check that does not know to test them misses it. Arms get their artifact (buggy code / prose spec / v3 spec) and must write a pre-submission check WITHOUT being told about contra or how to test. Only the SPEC arms carry the contra rule; no-spec cannot infer it. v4 runs analyse (proves the sign invariants). Designed to NOT saturate. 2 models.',
  phases: [{ title: 'Gate' }, { title: 'Score' }],
}
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/contra-sign-gate'
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const N = 6
const MODELS = ['opus', 'sonnet']
const BUGGY = `def account_balance(normal_side, is_contra, debits, credits):
    effective_debit_normal = (normal_side == 'debit')
    return (debits - credits) if effective_debit_normal else (credits - debits)`
const IFACE = `account_balance(normal_side, is_contra, debits, credits) -> int returns an account's reporting balance. normal_side is 'debit' or 'credit'; is_contra is a bool; debits and credits are amounts.`
const ARTIFACT = {
  none: `The balance function (this is all you have):\n\n\`\`\`python\n${BUGGY}\n\`\`\`\n\n${IFACE}`,
  prose: `A prose specification of correct account-balance reporting:\n"""\nAn account's reporting balance is positive on its NORMAL side: for a debit-normal account, balance = debits - credits; for a credit-normal account, balance = credits - debits. IMPORTANT: a CONTRA account (is_contra true) reverses its normal side — a contra account whose type is debit-normal is reported as if credit-normal, and vice versa. Balances must follow this for ALL accounts including contra ones.\n"""\n\n${IFACE}\n\nThe function under test:\n\`\`\`python\n${BUGGY}\n\`\`\``,
  v3: `An Allium v3 specification of correct account-balance reporting:\n\`\`\`\n-- allium: 3\nspec Account {\n  entity Account { normal_side: Side, is_contra: Boolean, debits: Integer, credits: Integer, balance: Integer }\n  -- effective side is the normal side, REVERSED when is_contra\n  invariant DebitEffective { for a in Accounts: (a.normal_side == debit) != a.is_contra implies a.balance == a.debits - a.credits }\n  invariant CreditEffective { for a in Accounts: (a.normal_side == credit) != a.is_contra implies a.balance == a.credits - a.debits }\n}\n\`\`\`\n\n${IFACE}\n\nThe function under test:\n\`\`\`python\n${BUGGY}\n\`\`\``,
}
const CODE_SCHEMA = { type:'object', properties:{ code:{type:'string'} }, required:['code'] }
const GATE_SCHEMA = { type:'object', properties:{ verdict:{type:'string'} }, required:['verdict'] }
const V4_SCHEMA = { type:'object', properties:{ flagged:{type:'boolean'} }, required:['flagged'] }
function genPrompt(arm){
  return `You are writing a PRE-SUBMISSION CHECK (a pytest suite) that verifies account balances are computed correctly before a financial report is filed. Test thoroughly across account configurations.\n\n${ARTIFACT[arm]}\n\nWrite a pytest module importing \`from solution import account_balance\` that asserts each account's balance is correct. Return the COMPLETE module in \`code\`.`
}
function scorePrompt(code){
  return `Score a pre-submission check. Mechanical.\n1. D=$(mktemp -d); write the module below to "$D"/suite.py.\n2. Run: python3 ${DIR}/run_gate.py "$D"/suite.py -> CATCH, MISS, or FALSEALARM.\nReport the verdict. (CATCH = fails on the buggy function AND passes the correct one.)\n\nSuite:\n\`\`\`python\n${code}\n\`\`\``
}
phase('Gate')
const v4runs=[]; for (const model of MODELS) for (let i=0;i<N;i++) v4runs.push({model,i})
const v4 = await parallel(v4runs.map(r => () =>
  agent(`Run this exact command and report whether analyse flagged a broken invariant:\n\n${ALLIUM} analyse ${DIR}/edited.v4.allium\n\nSet flagged=true iff the output says action \`post_contra_asset_wrong\` can break an invariant (contra_credit or contra_debit).`,
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
  summary[`${arm}/${model}`]={n:rs.length, catch_pct:Number((rs.filter(r=>r.verdict==='CATCH').length/n*100).toFixed(1)), false_alarm:rs.filter(r=>r.verdict==='FALSEALARM').length}
}
log(`contra-sign-gate CATCH%  opus[none ${summary['none/opus'].catch_pct} prose ${summary['prose/opus'].catch_pct} v3 ${summary['v3/opus'].catch_pct} v4 ${summary['v4/opus'].catch_pct}] sonnet[none ${summary['none/sonnet'].catch_pct} prose ${summary['prose/sonnet'].catch_pct} v3 ${summary['v3/sonnet'].catch_pct} v4 ${summary['v4/sonnet'].catch_pct}]`)
return { task:'contra-sign-gate', N, summary, raw: all }
