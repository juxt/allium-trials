export const meta = {
  name: 'benchmark-npf-annuity',
  description: 'MATRIX port task on a SECOND codebase (numpy-financial, cash-flow/annuity math). Reconstruct 5 functions (pmt/fv/pv/ppmt/ipmt) in pure Python from a spec, hidden source. 4 arms (none/prose/v3/v4) x 2 models. Mixed inferability: the annuity FORMULA is standard (inferable, may favour prose like the amortization task), but the SIGN convention (pmt returns negative) and the when flag (0=end/ordinary vs 1=begin/annuity-due) are non-inferable conventions. Graded oracle: 162 real golden vs numpy-financial. Tests whether the Fineract recipe generalises to another codebase + a more algorithmic domain.',
  phases: [
    { title: 'Distil', detail: 'author the 3 fixed specs from the real source, once' },
    { title: 'Port', detail: '4 arms x 2 models reconstruct the 5 functions from their spec (or signatures only)' },
    { title: 'Score', detail: 'graded vs 162 real golden (float tolerance)' },
  ],
}

const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/npf-annuity'
const SRC = `${DIR}/original/_financial.py`
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const N = 8
const MODELS = ['opus', 'sonnet']

const API = `Expose exactly these pure-Python functions (plain floats, NO numpy):
  pmt(rate, nper, pv, fv=0, when=0)
  fv(rate, nper, pmt, pv, when=0)
  pv(rate, nper, pmt, fv=0, when=0)
  ppmt(rate, per, nper, pv, fv=0, when=0)
  ipmt(rate, per, nper, pv, fv=0, when=0)
where \`when\` is 0 or 1.`

const DISTIL = {
  prose: `Read the real source at ${SRC} (numpy-financial). Write a PRECISE prose spec of pmt, fv, pv, ppmt, ipmt: the exact formula each computes AND the conventions that matter for a faithful port — the SIGN convention and the meaning of the \`when\` flag (0 vs 1). A reimplementer must get sign and when right from your spec. Return it in \`spec\`.`,
  v3: `Read the real source at ${SRC} (numpy-financial). Distil an Allium v3 spec of pmt, fv, pv, ppmt, ipmt capturing the formulas and the sign/when conventions. Return the v3 spec in \`spec\`.`,
  v4: `Read the real source at ${SRC} (numpy-financial). Distil an Allium v4 spec of pmt, fv, pv, ppmt, ipmt capturing the formulas, the sign/when conventions, and any invariants. You may run \`${ALLIUM} analyse\`. Return the v4 spec in \`spec\`.`,
}
const SPEC_SCHEMA = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const CODE_SCHEMA = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const SCORE_SCHEMA = { type: 'object', properties: { matched: { type: 'integer' }, total: { type: 'integer' } }, required: ['matched', 'total'] }

function portPrompt(arm, spec) {
  const g = arm === 'none'
    ? `You are implementing the standard cash-flow/annuity functions in pure Python. You have ONLY the signatures below — infer the exact behaviour (formula, sign convention, the when flag) as best you can.`
    : `Implement the cash-flow/annuity functions in pure Python, guided by this ${arm} specification. Follow it exactly, including the sign convention and the when flag.\n\nSpecification:\n"""\n${spec}\n"""`
  return `${g}\n\n${API}\n\nReturn the COMPLETE pure-Python module in \`code\` (no numpy).`
}
function scorePrompt(code) {
  return `Score a Python port against real numpy-financial golden values. Mechanical.
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
log(`npf-annuity  opus[none ${summary['none/opus'].score_pct} prose ${summary['prose/opus'].score_pct} v3 ${summary['v3/opus'].score_pct} v4 ${summary['v4/opus'].score_pct}]  sonnet[none ${summary['none/sonnet'].score_pct} prose ${summary['prose/sonnet'].score_pct} v3 ${summary['v3/sonnet'].score_pct} v4 ${summary['v4/sonnet'].score_pct}]`)
return { task: 'npf-annuity', N, summary, raw: results.filter(Boolean) }
