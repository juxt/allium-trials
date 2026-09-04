export const meta = {
  name: 'benchmark-acct-fee',
  description: 'Benchmark task acct-fee (feature-addition): add a fee charge to an existing Account. Authentic gotcha: a fee that skips the balance check overdraws (must preserve the existing non-negative-balance invariant). Three workflow-realistic arms — prose / V3 / V4 — from the same gotcha-free requirements. Hidden oracle scores the new feature + the preserved existing behaviour. Tests whether V4 analyse (which flags the unguarded fee at spec-time) beats V3/prose on the regression.',
  phases: [
    { title: 'Implement', detail: 'each arm adds fee via its tool workflow: prose direct, V3 spec, V4 spec+analyse' },
    { title: 'Score', detail: 'hidden oracle: fee charges + fee never overdraws + withdraw still guarded' },
  ],
}

const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/acct-fee'
const N = 4

const BASE_CODE = `class Account:
    def __init__(self, balance: int = 0):
        self.balance = balance
    def deposit(self, amount: int) -> None:
        self.balance += amount
    def withdraw(self, amount: int) -> None:
        if amount > self.balance:
            raise ValueError("insufficient funds")
        self.balance -= amount`

// The requirements — the GOAL only, never the gotcha (workflow-realistic).
const REQUIREMENTS = `Add a method \`fee(self, amount: int) -> None\` to the Account class that charges a fee of \`amount\` from the account's balance.`

const BASE_V4 = `-- allium: 4
component Account
  entity A
  observable state balance(A) : Money
  invariant nonneg means balance(a) >= 0
  action deposit
    ensures balance(a) = old(balance(a)) + 1
  action withdraw
    requires balance(a) >= 1
    ensures balance(a) = old(balance(a)) - 1
end`

const BASE_V3 = `-- allium: 3
spec Account {
  entity Account { balance: Integer }
  invariant NonNegative { for a in Accounts: a.balance >= 0 }
  rule Deposit { when: DepositRequested(account, amount) ensures: account.balance = account.balance + amount }
  rule Withdraw { when: WithdrawRequested(account, amount) requires: account.balance >= amount ensures: account.balance = account.balance - amount }
}`

const ARMS = {
  prose: `You are extending existing Python code. Here is the current Account class:

\`\`\`python
${BASE_CODE}
\`\`\`

${REQUIREMENTS}

Implement it well. Return the COMPLETE final contents of the module (the whole Account class including your new method) in the \`code\` field.`,

  v3: `You are extending an existing system that has an Allium v3 specification and its implementation.

Current Allium v3 spec:
\`\`\`
${BASE_V3}
\`\`\`

Current Python:
\`\`\`python
${BASE_CODE}
\`\`\`

${REQUIREMENTS}

Work spec-first, the way Allium v3 is used: update the spec to cover the new feature, think through the test obligations it implies, then implement. Return the COMPLETE final contents of the Python module in the \`code\` field.`,

  v4: `You are extending an existing system that has an Allium v4 specification and its implementation.

Current Allium v4 spec:
\`\`\`
${BASE_V4}
\`\`\`

Current Python:
\`\`\`python
${BASE_CODE}
\`\`\`

${REQUIREMENTS}

Work spec-first with the v4 checker in the loop. In a temp dir: write the updated spec (add an action for the new feature) to spec.allium and run \`${ALLIUM} analyse spec.allium\`. HEED its diagnostics — if it reports that your new action can break an invariant, fix the spec (add the guard/requires it needs) and re-run until clean. Then implement the Python faithfully to the checked spec. Return the COMPLETE final contents of the Python module in the \`code\` field.`,
}

const CODE_SCHEMA = {
  type: 'object',
  properties: { code: { type: 'string', description: 'Complete final contents of the Python module (the whole Account class incl. the new fee method).' } },
  required: ['code'],
}
const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    passed: { type: 'integer', description: 'number of the 3 obligation tests that passed' },
    overdraws: { type: 'boolean', description: 'did test_fee_never_overdraws FAIL (the fee overdrew the account)?' },
  },
  required: ['passed', 'overdraws'],
}

function scorePrompt(code) {
  return `Score a candidate Account implementation against a hidden test suite. Mechanical, faithful.
1. D=$(mktemp -d); cp ${DIR}/test_obligations.py "$D"/
2. Write the candidate below to "$D"/solution.py exactly as given.
3. cd "$D" && SOLUTION=solution python3 -m pytest test_obligations.py -q
4. Report passed = number of the 3 tests that passed; overdraws = did test_fee_never_overdraws FAIL. If it does not import, passed=0.

Candidate:
\`\`\`python
${code}
\`\`\``
}

phase('Implement')
const items = []
for (const arm of Object.keys(ARMS)) for (let i = 0; i < N; i++) items.push({ arm, i })

const results = await pipeline(
  items,
  ({ arm, i }) => agent(ARMS[arm], { label: `impl:${arm}#${i}`, phase: 'Implement', schema: CODE_SCHEMA }),
  (code, { arm, i }) => {
    if (!code || !code.code) return null
    return agent(scorePrompt(code.code), { label: `score:${arm}#${i}`, phase: 'Score', schema: SCORE_SCHEMA })
      .then(s => (s ? { arm, i, passed: s.passed, overdraws: s.overdraws } : null))
  },
)

const summary = {}
for (const arm of Object.keys(ARMS)) {
  const rs = results.filter(Boolean).filter(r => r.arm === arm)
  const n = rs.length || 1
  summary[arm] = {
    n: rs.length,
    coverage_pct: Number((rs.reduce((a, r) => a + r.passed, 0) / (n * 3) * 100).toFixed(1)),
    overdraw_rate_pct: Number((rs.filter(r => r.overdraws).length / n * 100).toFixed(1)),
  }
}
log(`acct-fee coverage  prose ${summary.prose.coverage_pct}%  v3 ${summary.v3.coverage_pct}%  v4 ${summary.v4.coverage_pct}%  | overdraw prose ${summary.prose.overdraw_rate_pct}% v3 ${summary.v3.overdraw_rate_pct}% v4 ${summary.v4.overdraw_rate_pct}%`)
return { task: 'acct-fee', N, summary, raw: results.filter(Boolean) }
