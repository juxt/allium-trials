export const meta = {
  name: 'benchmark-durability-gate',
  description: 'DURABILITY / GATE benchmark — the honest instrument for V4 > V3. A realistic feature edit (a $15 fee guarded only by balance>=10) introduces a subtle regression: it breaks the balance>=0 invariant, but ONLY in the narrow band [10,15). Question: given the regression, does each arm CATCH it? V4 runs `analyse` (proves the invariant over ALL states, deterministic). v3/prose generate a regression test suite (examples — may miss the narrow band). no-spec generates tests from the buggy CODE (no intent oracle). Measures whether the arm tooling catches a non-obvious regression an example-test might miss.',
  phases: [{ title: 'Gate' }, { title: 'Score' }],
}
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/durability-gate'
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const N = 6           // test-gen arms need repetition to estimate catch-rate
const MODELS = ['opus', 'sonnet']

const BUGGY = `class Account:
    def __init__(self, balance): self.balance = balance
    def withdraw(self, amount):
        if amount > self.balance: raise ValueError("insufficient funds")
        self.balance -= amount
    def charge(self):
        if self.balance < 10: raise ValueError("insufficient for fee")
        self.balance -= 15`

// The three test-gen arms differ only in the artifact they see (code / prose spec / v3 spec).
const ARTIFACT = {
  none: `The Account implementation (this is all you have — no separate specification):\n\n\`\`\`python\n${BUGGY}\n\`\`\``,
  prose: `A prose specification of the Account:\n"""\nAn Account holds an integer balance. INVARIANT: the balance must NEVER go negative (balance >= 0) after any operation, including charge(). withdraw(amount) removes amount only if the account has at least that much; charge() applies a flat $15 service fee.\n"""\n\nThe implementation under test:\n\`\`\`python\n${BUGGY}\n\`\`\``,
  v3: `An Allium v3 specification of the Account:\n\`\`\`\n-- allium: 3\nspec Account {\n  entity Account { balance: Integer }\n  invariant NonNegative { for a in Accounts: a.balance >= 0 }\n}\n\`\`\`\n\nThe implementation under test:\n\`\`\`python\n${BUGGY}\n\`\`\``,
}

const CODE_SCHEMA = { type: 'object', properties: { code: { type: 'string', description: 'pytest module (imports Account from solution) that verifies the balance>=0 invariant holds after operations.' } }, required: ['code'] }
const GATE_SCHEMA = { type: 'object', properties: { verdict: { type: 'string', description: 'CATCH, MISS, or FALSEALARM' } }, required: ['verdict'] }
const V4_SCHEMA = { type: 'object', properties: { flagged: { type: 'boolean', description: 'did analyse report that charge can break invariant nn?' } }, required: ['flagged'] }

function genPrompt(arm) {
  return `You are writing a REGRESSION TEST SUITE to protect an Account's core invariant: the balance must never go negative (balance >= 0) after any operation, including charge(). Test thoroughly — cover boundary values.\n\n${ARTIFACT[arm]}\n\nWrite a pytest module that imports \`from solution import Account\` and asserts balance >= 0 holds after operations. Return the COMPLETE module in \`code\`.`
}
function scorePrompt(code) {
  return `Score a regression suite. Mechanical.
1. D=$(mktemp -d); write the module below to "$D"/suite.py exactly as given.
2. Run: python3 ${DIR}/run_gate.py "$D"/suite.py   -> prints CATCH, MISS, or FALSEALARM.
Report the verdict. (CATCH = suite fails on the buggy code AND passes the correct code.)

Suite:
\`\`\`python
${code}
\`\`\``
}

phase('Gate')
// V4 arm: run analyse on the edited spec (deterministic proof gate). Both models, N runs (same result).
const v4runs = []
for (const model of MODELS) for (let i = 0; i < N; i++) v4runs.push({ model, i })
const v4 = await parallel(v4runs.map(r => () =>
  agent(`Run this exact command and report whether analyse flagged a broken invariant:\n\n${ALLIUM} analyse ${DIR}/edited.v4.allium\n\nSet flagged=true iff the output says action \`charge\` can break arithmetic invariant \`nn\`.`,
    { label: `v4-gate/${r.model}#${r.i}`, phase: 'Gate', model: r.model, schema: V4_SCHEMA }).then(x => ({ arm: 'v4', model: r.model, verdict: x && x.flagged ? 'CATCH' : 'MISS' }))))

// test-gen arms
const items = []
for (const arm of ['none', 'prose', 'v3']) for (const model of MODELS) for (let i = 0; i < N; i++) items.push({ arm, model, i })
const gen = await pipeline(
  items,
  ({ arm, model, i }) => agent(genPrompt(arm), { label: `gen:${arm}/${model}#${i}`, phase: 'Gate', model, schema: CODE_SCHEMA }),
  (c, { arm, model, i }) => (c && c.code
    ? agent(scorePrompt(c.code), { label: `score:${arm}/${model}#${i}`, phase: 'Score', model: 'sonnet', schema: GATE_SCHEMA }).then(r => (r ? { arm, model, verdict: r.verdict } : null))
    : null),
)

const all = [...v4.filter(Boolean), ...gen.filter(Boolean)]
const summary = {}
for (const arm of ['none', 'prose', 'v3', 'v4']) for (const model of MODELS) {
  const rs = all.filter(r => r.arm === arm && r.model === model)
  const n = rs.length || 1
  summary[`${arm}/${model}`] = { n: rs.length, catch_pct: Number((rs.filter(r => r.verdict === 'CATCH').length / n * 100).toFixed(1)) }
}
log(`durability-gate CATCH%  opus[none ${summary['none/opus'].catch_pct} prose ${summary['prose/opus'].catch_pct} v3 ${summary['v3/opus'].catch_pct} v4 ${summary['v4/opus'].catch_pct}]  sonnet[none ${summary['none/sonnet'].catch_pct} prose ${summary['prose/sonnet'].catch_pct} v3 ${summary['v3/sonnet'].catch_pct} v4 ${summary['v4/sonnet'].catch_pct}]`)
return { task: 'durability-gate', N, summary, raw: all }
