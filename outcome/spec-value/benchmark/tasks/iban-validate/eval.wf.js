export const meta = {
  name: 'benchmark-iban-validate',
  description: 'MATRIX task on a THIRD codebase (python-stdnum, regulated-finance number validation). Reconstruct an IBAN validator is_valid(iban)->bool from a spec, hidden source. 4 arms x 2 models. The mod-97 checksum is inferable; the per-country length/format rules and national check digits (e.g. Belgium) are NON-INFERABLE regulated conventions. Graded oracle: 28 real golden vs python-stdnum.',
  phases: [
    { title: 'Distil', detail: 'author the 3 fixed specs from the real source, once' },
    { title: 'Port', detail: '4 arms x 2 models reconstruct the 5 functions from their spec (or signatures only)' },
    { title: 'Score', detail: 'graded vs 162 real golden (float tolerance)' },
  ],
}

const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/iban-validate'
const SRC = `${DIR}/original/iban.py`
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const N = 3
const MODELS = ['opus', 'sonnet']

const API = `Expose exactly: def is_valid(iban: str) -> bool  (returns True iff the string is a valid IBAN).`

const DISTIL = {
  prose: `Read the real source at ${SRC} (python-stdnum iban.py). Write a PRECISE prose spec of IBAN validation: the mod-97 checksum algorithm AND the per-country length/format rules and any national check digits. A reimplementer must reject IBANs that fail country-specific rules even when the mod-97 checksum passes. Return it in \`spec\`.`,
  v3: `Read the real source at ${SRC} (python-stdnum iban.py). Distil an Allium v3 spec of IBAN validation capturing the checksum + per-country length/format rules. Return the v3 spec in \`spec\`.`,
  v4: `Read the real source at ${SRC} (python-stdnum iban.py). Distil an Allium v4 spec of IBAN validation capturing the checksum, per-country rules, and any invariants. You may run \`${ALLIUM} analyse\`. Return the v4 spec in \`spec\`.`,
}
const SPEC_SCHEMA = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const CODE_SCHEMA = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const SCORE_SCHEMA = { type: 'object', properties: { matched: { type: 'integer' }, total: { type: 'integer' } }, required: ['matched', 'total'] }

function portPrompt(arm, spec) {
  const g = arm === 'none'
    ? `You are implementing an IBAN validator in pure Python. You have ONLY the signature below — infer the full validation (checksum + per-country rules) as best you can.`
    : `Implement an IBAN validator in pure Python, guided by this ${arm} specification. Follow it exactly, including the per-country rules.\n\nSpecification:\n"""\n${spec}\n"""`
  return `${g}\n\n${API}\n\nReturn the COMPLETE pure-Python module in `code`.`
}
function scorePrompt(code) {
  return `Score a Python IBAN validator against real python-stdnum golden values. Mechanical.
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
log(`iban-validate  opus[none ${summary['none/opus'].score_pct} prose ${summary['prose/opus'].score_pct} v3 ${summary['v3/opus'].score_pct} v4 ${summary['v4/opus'].score_pct}]  sonnet[none ${summary['none/sonnet'].score_pct} prose ${summary['prose/sonnet'].score_pct} v3 ${summary['v3/sonnet'].score_pct} v4 ${summary['v4/sonnet'].score_pct}]`)
return { task: 'iban-validate', N, summary, raw: results.filter(Boolean) }
