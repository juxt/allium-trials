export const meta = {
  name: 'benchmark-isin-validate',
  description: 'MATRIX task on a python-stdnum ISIN validator is_valid(isin)->bool from a spec, hidden source. 4 arms x 2 models. The structure (2-letter country + 9 alnum + check digit) is inferable; the exact CHECK-DIGIT algorithm (Luhn variant over letters expanded A=10..Z=35, right-to-left doubling) is NON-INFERABLE. Graded oracle: 21 real golden vs python-stdnum.',
  phases: [
    { title: 'Distil', detail: 'author the 3 fixed specs from the real source, once' },
    { title: 'Port', detail: '4 arms x 2 models reconstruct the 5 functions from their spec (or signatures only)' },
    { title: 'Score', detail: 'graded vs 162 real golden (float tolerance)' },
  ],
}

const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/isin-validate'
const SRC = `${DIR}/original/isin.py`
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const N = 3
const MODELS = ['opus', 'sonnet']

const API = `Expose exactly: def is_valid(isin: str) -> bool  (returns True iff the string is a valid ISIN).`

const DISTIL = {
  prose: `Read the real source at ${SRC} (python-stdnum isin.py). Write a PRECISE prose spec of ISIN validation: the structure AND the exact check-digit algorithm (letter expansion, doubling rule, mod-10). A reimplementer must compute the check digit exactly right. Return it in \`spec\`.`,
  v3: `Read the real source at ${SRC} (python-stdnum isin.py). Distil an Allium v3 spec of ISIN validation capturing the structure + exact check-digit algorithm. Return the v3 spec in \`spec\`.`,
  v4: `Read the real source at ${SRC} (python-stdnum isin.py). Distil an Allium v4 spec of ISIN validation capturing the structure, check-digit algorithm, and invariants. You may run \`${ALLIUM} analyse\`. Return the v4 spec in \`spec\`.`,
}
const SPEC_SCHEMA = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const CODE_SCHEMA = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const SCORE_SCHEMA = { type: 'object', properties: { matched: { type: 'integer' }, total: { type: 'integer' } }, required: ['matched', 'total'] }

function portPrompt(arm, spec) {
  const g = arm === 'none'
    ? `You are implementing an ISIN validator in pure Python. You have ONLY the signature below — infer the full validation (structure + check-digit algorithm) as best you can.`
    : `Implement an ISIN validator in pure Python, guided by this ${arm} specification. Follow it exactly, including the check-digit algorithm.\n\nSpecification:\n"""\n${spec}\n"""`
  return `${g}\n\n${API}\n\nReturn the COMPLETE pure-Python module in \`code\`.`
}
function scorePrompt(code) {
  return `Score a Python ISIN validator against real python-stdnum golden values. Mechanical.
1. D=$(mktemp -d); cp ${DIR}/golden.json ${DIR}/score.py "$D"/
2. Write the module below to "$D"/solution.py exactly as given.
3. cd "$D" && SOLUTION=solution python3 score.py -> "matched/total". Report both. If import errors, matched=0.

Module:
\`\`\`python
${code}
\`\`\``
}

phase('Distil')
const specs = { none: '' }
const distilled = await parallel(Object.keys(DISTIL).map(arm => () =>
  agent(DISTIL[arm], { label: `distil:${arm}`, phase: 'Distil', schema: SPEC_SCHEMA }).then(s => ({ arm, spec: s && s.spec }))))
for (const d of distilled.filter(Boolean)) specs[d.arm] = d.spec || ''

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
  summary[`${arm}/${model}`] = { n: rs.length, score_pct: Number((rs.reduce((a, r) => a + (r.total ? r.matched / r.total : 0), 0) / n * 100).toFixed(1)) }
}
log(`isin-validate  opus[none ${summary['none/opus'].score_pct} prose ${summary['prose/opus'].score_pct} v3 ${summary['v3/opus'].score_pct} v4 ${summary['v4/opus'].score_pct}]  sonnet[none ${summary['none/sonnet'].score_pct} prose ${summary['prose/sonnet'].score_pct} v3 ${summary['v3/sonnet'].score_pct} v4 ${summary['v4/sonnet'].score_pct}]`)
return { task: 'isin-validate', N, summary, raw: results.filter(Boolean) }
