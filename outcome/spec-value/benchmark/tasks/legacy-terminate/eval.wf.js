export const meta = {
  name: 'benchmark-legacy-terminate',
  description: 'Benchmark task legacy-terminate (legacy modernisation, OBJECTIVE quirk): modernise a drain loop whose max_ops budget is a non-obvious termination guarantee (it bounds retries so a poison item cannot loop forever). A clean "drain until empty" rewrite drops the budget and loops forever. Three arms — prose / V3 / V4 — modernise from the same requirements. V4 spec carries (and analyse verifies) a termination objective; V3 has no construct for it; prose describes max_ops functionally. Hidden oracle scores happy-path + retry + terminates-on-poison.',
  phases: [
    { title: 'Modernise', detail: 'each arm rewrites the drain loop via its tool workflow' },
    { title: 'Score', detail: 'hidden oracle: drains, retries transient, and TERMINATES on a poison item' },
  ],
}

const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/legacy-terminate'
const N = 4

const LEGACY = `def drain(queue, process, max_ops):
    ops = max_ops
    result = []
    while queue and ops > 0:
        item = queue.pop(0)
        ops = ops - 1
        ok = process(item)
        if ok:
            result.append(item)
        else:
            queue.append(item)
    return queue`

const REQUIREMENTS = `Modernise this \`drain\` function to be cleaner and more maintainable, preserving its behaviour. Keep the signature \`drain(queue, process, max_ops)\` and return whatever items remain unprocessed.`

const PROSE = `\`drain(queue, process, max_ops)\` works through \`queue\`, calling \`process(item)\` on each item it removes from the front. If \`process(item)\` returns a falsy value, the item is appended back onto the queue to be retried later. The function performs at most \`max_ops\` iterations in total, then returns whatever remains in the queue.`

const BASE_V3 = `-- allium: 3
spec Drain {
  entity Drain { ops: Integer }
  invariant OpsNonNegative { for d in Drains: d.ops >= 0 }
  rule Step { when: StepRequested(drain) requires: drain.ops >= 1 ensures: drain.ops = drain.ops - 1 }
}`

const BASE_V4 = `-- allium: 4
component Drain
  observable state ops : Number
  invariant ops_nonneg means ops >= 0
  action step
    requires ops >= 1
    ensures ops = old(ops) - 1
  objective done within 1000
    measure ops decreasing
end`

const COMMON = `Here is the legacy function to modernise:

\`\`\`python
${LEGACY}
\`\`\`

${REQUIREMENTS}`

const ARMS = {
  prose: `You are modernising a piece of legacy Python. A prose description of its behaviour:

${PROSE}

${COMMON}

Return the COMPLETE modernised module (the drain function) in the \`code\` field.`,

  v3: `You are modernising a piece of legacy Python that has an Allium v3 specification.

Allium v3 spec:
\`\`\`
${BASE_V3}
\`\`\`

${COMMON}

Work spec-aware, the way Allium v3 is used: treat the spec's invariants and rules as behaviour that must be preserved. Return the COMPLETE modernised module in the \`code\` field.`,

  v4: `You are modernising a piece of legacy Python that has an Allium v4 specification.

Allium v4 spec:
\`\`\`
${BASE_V4}
\`\`\`

${COMMON}

Work spec-aware with the v4 checker. Write the spec to spec.allium in a temp dir and run \`${ALLIUM} analyse spec.allium\` — read what it certifies about the component (in particular any objective it discharges) and treat every certified property as behaviour your modernised code MUST preserve. Return the COMPLETE modernised module in the \`code\` field.`,
}

const CODE_SCHEMA = {
  type: 'object',
  properties: { code: { type: 'string', description: 'Complete modernised Python module containing the drain function.' } },
  required: ['code'],
}
const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    passed: { type: 'integer', description: 'number of the 3 obligation tests that passed' },
    terminates: { type: 'boolean', description: 'did test_terminates_on_poison PASS (the modernised drain still terminates on a poison item)?' },
  },
  required: ['passed', 'terminates'],
}

function scorePrompt(code) {
  return `Score a candidate drain implementation against a hidden test suite. Mechanical, faithful. NOTE: a wrong candidate may infinite-loop; the suite has its own 3-second alarm so pytest WILL return — do not add your own timeout wrapper, just run it.
1. D=$(mktemp -d); cp ${DIR}/test_obligations.py "$D"/
2. Write the candidate below to "$D"/solution.py exactly as given.
3. cd "$D" && SOLUTION=solution python3 -m pytest test_obligations.py -q
4. Report passed = number of the 3 tests that passed; terminates = did test_terminates_on_poison PASS. If it does not import, passed=0, terminates=false.

Candidate:
\`\`\`python
${code}
\`\`\``
}

phase('Modernise')
const items = []
for (const arm of Object.keys(ARMS)) for (let i = 0; i < N; i++) items.push({ arm, i })

const results = await pipeline(
  items,
  ({ arm, i }) => agent(ARMS[arm], { label: `impl:${arm}#${i}`, phase: 'Modernise', schema: CODE_SCHEMA }),
  (code, { arm, i }) => {
    if (!code || !code.code) return null
    return agent(scorePrompt(code.code), { label: `score:${arm}#${i}`, phase: 'Score', schema: SCORE_SCHEMA })
      .then(s => (s ? { arm, i, passed: s.passed, terminates: s.terminates } : null))
  },
)

const summary = {}
for (const arm of Object.keys(ARMS)) {
  const rs = results.filter(Boolean).filter(r => r.arm === arm)
  const n = rs.length || 1
  summary[arm] = {
    n: rs.length,
    coverage_pct: Number((rs.reduce((a, r) => a + r.passed, 0) / (n * 3) * 100).toFixed(1)),
    terminates_pct: Number((rs.filter(r => r.terminates).length / n * 100).toFixed(1)),
  }
}
log(`legacy-terminate  terminates%  prose ${summary.prose.terminates_pct}  v3 ${summary.v3.terminates_pct}  v4 ${summary.v4.terminates_pct}`)
return { task: 'legacy-terminate', N, summary, raw: results.filter(Boolean) }
