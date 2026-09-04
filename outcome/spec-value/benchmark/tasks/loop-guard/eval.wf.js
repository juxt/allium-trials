export const meta = {
  name: 'benchmark-loop-guard',
  description: 'GATE task on real Fineract LoopGuard.java (a utility whose whole behaviour is a termination guarantee: runSafeWhileLoop throws if iterations exceed maxIterations). Each arm distils a spec (prose/V3/V4) and GENERATES a test suite from it; the suite is run against the correct port and a port with the max-iterations guard REMOVED. Does the suite CATCH the removed guard? This is the honest home for the V4 advantage: the termination property is a liveness OBJECTIVE (V4 expresses it; V3 has no construct; prose can describe it). Measures whether each spec form yields a gate that catches a load-bearing-liveness regression.',
  phases: [
    { title: 'Distil+gen', detail: 'distil a spec from real LoopGuard, then generate a pytest suite from the spec' },
    { title: 'Gate', detail: 'run the suite vs correct and vs guard-removed; does it catch the regression?' },
  ],
}

const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/loop-guard'
const JAVA = `${DIR}/original/LoopGuard.java`
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const N = 10

const IFACE = `Python port under test exposes:
  run_safe_while_loop(max_iterations, condition, body)   # condition() -> bool, body() -> None
  run_safe_do_while_loop(max_iterations, condition, body)
Tests import: from solution import run_safe_while_loop, run_safe_do_while_loop`

const DISTIL = {
  prose: `Read the real Java file at ${JAVA}. Write a PRECISE prose specification of what LoopGuard's two loop runners do, including every rule that matters for a correct reimplementation. Return it in \`spec\`.`,
  v3: `Read the real Java file at ${JAVA}. Distil an Allium v3 specification of LoopGuard's two loop runners. Return the v3 spec text in \`spec\`.`,
  v4: `Read the real Java file at ${JAVA}. Distil an Allium v4 specification of LoopGuard's two loop runners, including any liveness/termination OBJECTIVE the guard provides. You may write it to a temp file and run \`${ALLIUM} analyse <file>\`. Return the v4 spec text in \`spec\`.`,
}

const SPEC_SCHEMA = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const CODE_SCHEMA = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const GATE_SCHEMA = { type: 'object', properties: { passes_correct: { type: 'boolean' }, catches_regression: { type: 'boolean', description: 'the suite FAILS or TIMES OUT against the guard-removed port' } }, required: ['passes_correct', 'catches_regression'] }

function genPrompt(kind, spec) {
  return `Below is a ${kind} specification of a bounded-loop utility. Generate a thorough pytest suite that verifies an implementation matches it. ${IFACE}

Write tests covering everything the spec states. Return the COMPLETE test_gen.py in \`code\` (code only).

Specification:
"""
${spec}
"""`
}

function gatePrompt(code) {
  return `Score a generated pytest suite against two implementations of LoopGuard. Mechanical.
1. D=$(mktemp -d); write the suite below to "$D"/suite.py exactly as given.
2. CORRECT: python3 ${DIR}/run_suite.py "$D"/suite.py ${DIR}/port/correct.py   -> prints PASS/FAIL/TIMEOUT
3. REGRESSION (guard removed): python3 ${DIR}/run_suite.py "$D"/suite.py ${DIR}/port/broken.py
Report passes_correct = (step 2 == PASS); catches_regression = (step 3 == FAIL or TIMEOUT). If the suite does not import, passes_correct=false.

Suite:
\`\`\`python
${code}
\`\`\``
}

phase('Distil+gen')
const items = []
for (const arm of Object.keys(DISTIL)) for (let i = 0; i < N; i++) items.push({ arm, i })

const results = await pipeline(
  items,
  ({ arm, i }) => agent(DISTIL[arm], { label: `distil:${arm}#${i}`, phase: 'Distil+gen', schema: SPEC_SCHEMA }),
  (s, { arm, i }) => (s && s.spec ? agent(genPrompt(arm, s.spec), { label: `gen:${arm}#${i}`, phase: 'Distil+gen', schema: CODE_SCHEMA }) : null),
  (c, { arm, i }) => (c && c.code
    ? agent(gatePrompt(c.code), { label: `gate:${arm}#${i}`, phase: 'Gate', schema: GATE_SCHEMA }).then(r => (r ? { arm, i, ...r } : null))
    : null),
)

const summary = {}
for (const arm of Object.keys(DISTIL)) {
  const rs = results.filter(Boolean).filter(r => r.arm === arm)
  const n = rs.length || 1
  summary[arm] = {
    n: rs.length,
    catches_regression_pct: Number((rs.filter(r => r.catches_regression).length / n * 100).toFixed(1)),
    passes_correct_pct: Number((rs.filter(r => r.passes_correct).length / n * 100).toFixed(1)),
  }
}
log(`loop-guard catches-regression  prose ${summary.prose.catches_regression_pct}  v3 ${summary.v3.catches_regression_pct}  v4 ${summary.v4.catches_regression_pct}`)
return { task: 'loop-guard', N, summary, raw: results.filter(Boolean) }
