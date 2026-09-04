export const meta = {
  name: 'benchmark-legacy-terminate',
  description: 'Benchmark task legacy-terminate (legacy modernisation, OBJECTIVE quirk): modernise a dynamic-batching drain loop whose termination rests on a floor guard that reads like cruft. Dropping it hangs the loop when the sizer returns 0. Three arms — prose / V3 / V4 — from gotcha-free requirements. The V4 spec records termination as an objective; V3 has no construct for it. Hidden oracle: terminates on the trap input + drains all.',
  phases: [
    { title: 'Modernise', detail: 'each arm rewrites the loop via its tool: prose from code, V3 with a spec, V4 with a spec that records the termination objective' },
    { title: 'Score', detail: 'hidden oracle: terminates when the sizer returns 0 (call-capped) + drains all' },
  ],
}

const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/legacy-terminate'
const N = 4

const LEGACY = `def drain_batches(total, get_batch_size):
    # legacy drainer: process \`total\` items in dynamically-sized batches. get_batch_size(remaining)
    # is supplied by the caller and decides how many to take next.
    processed = 0
    while processed < total:
        size = get_batch_size(total - processed)
        if size < 1:
            size = 1
        processed = processed + size
    return processed`

const REQUIREMENTS = `Modernise this function: rewrite \`drain_batches\` in a cleaner, more idiomatic style, preserving its behaviour. Return the COMPLETE final contents of the module in the \`code\` field, code only.`

const BASE_V4 = `-- allium: 4
component Drainer
  entity D
  observable state remaining : Number
  observable state drained : bool
  invariant nn means remaining >= 0
  action drain
    requires remaining >= 1
    ensures remaining = old(remaining) - 1
  objective drained within done
    measure remaining decreasing
end`

const BASE_V3 = `-- allium: 3
spec Drainer {
  entity Drain { remaining: Integer }
  invariant NonNegative { for d in Drains: d.remaining >= 0 }
  rule Drain { when: DrainStep(drain, size) requires: drain.remaining >= 1 ensures: drain.remaining = drain.remaining - size }
}`

const ARMS = {
  prose: `You are modernising a piece of legacy Python. Current code:

\`\`\`python
${LEGACY}
\`\`\`

${REQUIREMENTS}`,

  v3: `You are modernising legacy Python that has an Allium v3 specification. Its spec:
\`\`\`
${BASE_V3}
\`\`\`
Current code:
\`\`\`python
${LEGACY}
\`\`\`
Work the way Allium v3 is used: keep the code conformant to the spec's stated properties. ${REQUIREMENTS}`,

  v4: `You are modernising legacy Python that has an Allium v4 specification. Its spec:
\`\`\`
${BASE_V4}
\`\`\`
Current code:
\`\`\`python
${LEGACY}
\`\`\`
The spec records the properties this code must keep, including its \`objective\` (a must-hold liveness/
termination property with a decreasing measure). Modernise the code while keeping every stated property —
especially the objective — true of the result. ${REQUIREMENTS}`,
}

const CODE_SCHEMA = {
  type: 'object',
  properties: { code: { type: 'string', description: 'Complete final contents of the modernised Python module (defines drain_batches).' } },
  required: ['code'],
}
const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    passed: { type: 'integer', description: 'number of the 2 obligation tests that passed' },
    hangs: { type: 'boolean', description: 'did test_terminates_when_sizer_returns_zero FAIL (the loop did not terminate)?' },
  },
  required: ['passed', 'hangs'],
}

function scorePrompt(code) {
  return `Score a modernised drain_batches against a hidden test suite. Mechanical, faithful.
1. D=$(mktemp -d); cp ${DIR}/test_obligations.py "$D"/
2. Write the candidate below to "$D"/solution.py exactly as given.
3. cd "$D" && SOLUTION=solution python3 -m pytest test_obligations.py -q   (the suite self-caps, so a non-terminating candidate raises NonTermination rather than hanging; if it still hangs, kill after 30s and treat the termination test as failed.)
4. Report passed = number of the 2 tests that passed; hangs = did test_terminates_when_sizer_returns_zero FAIL. If it does not import, passed=0.

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
      .then(s => (s ? { arm, i, passed: s.passed, hangs: s.hangs } : null))
  },
)

const summary = {}
for (const arm of Object.keys(ARMS)) {
  const rs = results.filter(Boolean).filter(r => r.arm === arm)
  const n = rs.length || 1
  summary[arm] = {
    n: rs.length,
    coverage_pct: Number((rs.reduce((a, r) => a + r.passed, 0) / (n * 2) * 100).toFixed(1)),
    hang_rate_pct: Number((rs.filter(r => r.hangs).length / n * 100).toFixed(1)),
  }
}
log(`legacy-terminate coverage  prose ${summary.prose.coverage_pct}%  v3 ${summary.v3.coverage_pct}%  v4 ${summary.v4.coverage_pct}%  | hang(non-termination)  prose ${summary.prose.hang_rate_pct}% v3 ${summary.v3.hang_rate_pct}% v4 ${summary.v4.hang_rate_pct}%`)
return { task: 'legacy-terminate', N, summary, raw: results.filter(Boolean) }
