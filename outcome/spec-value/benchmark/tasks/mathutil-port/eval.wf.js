export const meta = {
  name: 'benchmark-mathutil-port',
  description: 'MATRIX port task. Reconstruct 20 numeric-utility functions (from real Fineract MathUtil) in Python from a spec, hidden source. 4 arms (none/prose/v3/v4) x 2 models (opus/sonnet). Graded oracle: 980 real golden cases. Non-obvious null/clamp semantics (negative_to_zero(None)=0, is_empty(0)=true, zero_to_null(0)=None) separate a spec-guided port from a signature-only guess. Specs distilled ONCE from the real source (fixed fair artifacts). Measures resulting CODE quality (fraction of golden matched).',
  phases: [
    { title: 'Distil', detail: 'author the 3 fixed specs (prose/v3/v4) from the real source, once' },
    { title: 'Port', detail: '4 arms x 2 models reconstruct the module from their spec (or signatures only)' },
    { title: 'Score', detail: 'graded vs 980 real golden cases' },
  ],
}

const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/mathutil-port'
const JAVA = `${DIR}/original/MathUtilPure.java`
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const N = 3
const MODELS = ['opus', 'sonnet']

const API = `Expose exactly these Python functions, operating on Python \`decimal.Decimal\` or \`None\`:
  null_to_zero(v), null_to_default(v, d), zero_to_null(v), negative_to_zero(v),
  is_empty(v), is_zero(v), is_greater_than_zero(v), is_less_than_zero(v), is_less_than_or_equal_zero(v),
  is_equal_to(a, b), is_greater_than(a, b), is_less_than(a, b), is_greater_than_or_equal_to(a, b), is_less_than_or_equal_to(a, b),
  abs_(v), min_(a, b, not_null), subtract(a, b), subtract_to_zero(a, b), negate(v), strip_trailing_zeros(v)`

const DISTIL = {
  prose: `Read the real Java at ${JAVA}. Write a PRECISE prose specification of every method's behaviour, especially the null/zero/negative edge cases (they are the subtle part). A faithful reimplementer must be able to get every edge case right from your spec alone. Return it in \`spec\`.`,
  v3: `Read the real Java at ${JAVA}. Distil an Allium v3 specification of these numeric utility functions, capturing the exact null/zero/negative semantics. Return the v3 spec in \`spec\`.`,
  v4: `Read the real Java at ${JAVA}. Distil an Allium v4 specification of these numeric utility functions, capturing the exact null/zero/negative semantics and any invariants. You may run \`${ALLIUM} analyse\`. Return the v4 spec in \`spec\`.`,
}

const SPEC_SCHEMA = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const CODE_SCHEMA = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const SCORE_SCHEMA = { type: 'object', properties: { matched: { type: 'integer' }, total: { type: 'integer' }, matched_hard: { type: 'integer' }, total_hard: { type: 'integer' } }, required: ['matched', 'total', 'matched_hard', 'total_hard'] }

function portPrompt(arm, spec) {
  const guidance = arm === 'none'
    ? `You are porting a Fineract numeric utility to Python. You have ONLY the function list below — infer the exact behaviour (including null/zero/negative edge cases) as best you can.`
    : `You are porting a Fineract numeric utility to Python, guided by this ${arm} specification. Follow it exactly, including every edge case.\n\nSpecification:\n"""\n${spec}\n"""`
  return `${guidance}\n\n${API}\n\nReturn the COMPLETE Python module in \`code\`.`
}

function scorePrompt(code) {
  return `Score a Python port against real golden values. Mechanical.
1. D=$(mktemp -d); cp ${DIR}/golden.json ${DIR}/golden_hard.json ${DIR}/score.py ${DIR}/score_hard.py "$D"/
2. Write the module below to "$D"/solution.py exactly as given.
3. cd "$D" && SOLUTION=solution python3 score.py       -> "matched/total" (full 980)
4. cd "$D" && SOLUTION=solution python3 score_hard.py  -> "matched_hard/total_hard" (287 null-handling)
Report all four numbers. If it errors on import, all zero.

Module:
\`\`\`python
${code}
\`\`\``
}

// Phase 1: distil the 3 fixed specs once.
phase('Distil')
const specs = {}
const distilled = await parallel(Object.keys(DISTIL).map(arm => () =>
  agent(DISTIL[arm], { label: `distil:${arm}`, phase: 'Distil', schema: SPEC_SCHEMA }).then(s => ({ arm, spec: s && s.spec }))))
for (const d of distilled.filter(Boolean)) specs[d.arm] = d.spec || ''
specs.none = ''

// Phase 2+3: 4 arms x 2 models x N, port then score.
phase('Port')
const items = []
for (const arm of ['none', 'prose', 'v3', 'v4']) for (const model of MODELS) for (let i = 0; i < N; i++) items.push({ arm, model, i })

const results = await pipeline(
  items,
  ({ arm, model, i }) => agent(portPrompt(arm, specs[arm]), { label: `port:${arm}/${model}#${i}`, phase: 'Port', model, schema: CODE_SCHEMA }),
  (c, { arm, model, i }) => (c && c.code
    ? agent(scorePrompt(c.code), { label: `score:${arm}/${model}#${i}`, phase: 'Score', model: 'sonnet', schema: SCORE_SCHEMA }).then(r => (r ? { arm, model, i, ...r } : null))
    : null),
)

const summary = {}
for (const arm of ['none', 'prose', 'v3', 'v4']) for (const model of MODELS) {
  const rs = results.filter(Boolean).filter(r => r.arm === arm && r.model === model)
  const n = rs.length || 1
  summary[`${arm}/${model}`] = {
    n: rs.length,
    score_pct: Number((rs.reduce((a, r) => a + (r.total ? r.matched / r.total : 0), 0) / n * 100).toFixed(1)),
    hard_pct: Number((rs.reduce((a, r) => a + (r.total_hard ? r.matched_hard / r.total_hard : 0), 0) / n * 100).toFixed(1)),
  }
}
log(`mathutil-port HARD  opus[none ${summary['none/opus'].hard_pct} prose ${summary['prose/opus'].hard_pct} v3 ${summary['v3/opus'].hard_pct} v4 ${summary['v4/opus'].hard_pct}]  sonnet[none ${summary['none/sonnet'].hard_pct} prose ${summary['prose/sonnet'].hard_pct} v3 ${summary['v3/sonnet'].hard_pct} v4 ${summary['v4/sonnet'].hard_pct}]`)
return { task: 'mathutil-port', N, summary, specs, raw: results.filter(Boolean) }
