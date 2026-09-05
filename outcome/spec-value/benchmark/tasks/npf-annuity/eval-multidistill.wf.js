export const meta = {
  name: 'benchmark-npf-multidistill',
  description: 'Settles the v3-vs-v4 confound on npf-annuity. Specs are normally distilled ONCE, so a v3-vs-v4 difference could be single-artifact luck. Here distil K=3 INDEPENDENT specs per arm (v3, v4), port from each (2 reps), score, on sonnet (where the gap showed). If v4 still beats v3 averaged over distillations, it is a LANGUAGE effect; if they converge, the earlier gap was artifact noise. Graded oracle: 162 golden. Non-inferable pmt sign/when convention.',
  phases: [
    { title: 'Distil', detail: 'K=3 independent v3 and v4 specs from the real source' },
    { title: 'Port', detail: 'port 2x per distilled spec (sonnet)' },
    { title: 'Score', detail: 'graded vs 162 golden; reliability per arm averaged over distillations' },
  ],
}

const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/npf-annuity'
const SRC = `${DIR}/original/_financial.py`
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const K = 3          // independent distillations per arm
const REPS = 2       // ports per distilled spec
const MODEL = 'sonnet'

const API = `Expose exactly these pure-Python functions (plain floats, NO numpy):
  pmt(rate, nper, pv, fv=0, when=0)
  fv(rate, nper, pmt, pv, when=0)
  pv(rate, nper, pmt, fv=0, when=0)
  ppmt(rate, per, nper, pv, fv=0, when=0)
  ipmt(rate, per, nper, pv, fv=0, when=0)
where \`when\` is 0 or 1.`

function distilPrompt(arm, k) {
  const lens = ['Focus on completeness of every formula and edge case.', 'Focus on the conventions a reimplementer would otherwise get wrong.', 'Write it as you naturally would for a colleague porting the code.'][k % 3]
  const which = arm === 'v3' ? 'Allium v3' : 'Allium v4'
  return `Read the real source at ${SRC} (numpy-financial). Distil a ${which} specification of pmt, fv, pv, ppmt, ipmt capturing the formulas and the sign/when conventions. ${lens} Keep the spec CONCISE — under ~250 lines, no verbatim code dumps.${arm === 'v4' ? ` You may run \`${ALLIUM} analyse\`.` : ''} Return the spec in \`spec\`.`
}
function portPrompt(arm, spec) {
  return `Implement the cash-flow/annuity functions in pure Python, guided by this ${arm} specification. Follow it exactly, including the sign convention and the when flag.\n\nSpecification:\n"""\n${spec}\n"""\n\n${API}\n\nReturn the COMPLETE pure-Python module in \`code\` (no numpy).`
}
function scorePrompt(code) {
  return `Score a Python port against real numpy-financial golden. Mechanical.
1. D=$(mktemp -d); cp ${DIR}/golden.json ${DIR}/score.py "$D"/
2. Write the module below to "$D"/solution.py exactly as given.
3. cd "$D" && SOLUTION=solution python3 score.py -> "matched/total". Report both. If import errors, matched=0.

Module:
\`\`\`python
${code}
\`\`\``
}

const SPEC_SCHEMA = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const CODE_SCHEMA = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const SCORE_SCHEMA = { type: 'object', properties: { matched: { type: 'integer' }, total: { type: 'integer' } }, required: ['matched', 'total'] }

phase('Distil')
const distils = []
for (const arm of ['v3', 'v4']) for (let k = 0; k < K; k++) distils.push({ arm, k })
const specs = await parallel(distils.map(d => () =>
  agent(distilPrompt(d.arm, d.k), { label: `distil:${d.arm}#${d.k}`, phase: 'Distil', schema: SPEC_SCHEMA }).then(s => ({ ...d, spec: s && s.spec }))))

phase('Port')
const items = []
for (const d of specs.filter(x => x && x.spec)) for (let r = 0; r < REPS; r++) items.push({ ...d, r })
const results = await pipeline(
  items,
  (it) => agent(portPrompt(it.arm, it.spec), { label: `port:${it.arm}#${it.k}.${it.r}`, phase: 'Port', model: MODEL, schema: CODE_SCHEMA }),
  (c, it) => (c && c.code
    ? agent(scorePrompt(c.code), { label: `score:${it.arm}#${it.k}.${it.r}`, phase: 'Score', model: MODEL, schema: SCORE_SCHEMA }).then(r => (r ? { arm: it.arm, k: it.k, r: it.r, ...r } : null))
    : null),
)

const summary = {}
for (const arm of ['v3', 'v4']) {
  const rs = results.filter(Boolean).filter(r => r.arm === arm)
  const n = rs.length || 1
  const hits = rs.filter(r => r.total && r.matched === r.total).length
  summary[arm] = { n: rs.length, hits, reliability_pct: Number((hits / n * 100).toFixed(1)), score_pct: Number((rs.reduce((a, r) => a + (r.total ? r.matched / r.total : 0), 0) / n * 100).toFixed(1)) }
}
log(`npf multidistill (sonnet, K=${K}x${REPS})  v3 reliability ${summary.v3.reliability_pct}% (${summary.v3.hits}/${summary.v3.n})  v4 ${summary.v4.reliability_pct}% (${summary.v4.hits}/${summary.v4.n})`)
return { task: 'npf-multidistill', K, REPS, summary, raw: results.filter(Boolean) }
