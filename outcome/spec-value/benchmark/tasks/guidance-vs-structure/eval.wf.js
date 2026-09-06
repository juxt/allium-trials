export const meta = {
  name: 'benchmark-guidance-vs-structure',
  description: 'Does a non-obvious load-bearing rule get followed less reliably when it lives in V3 @guidance PROSE than when it is STRUCTURED? Rule: a $5 reserve must remain, so a $15 charge requires balance>=20 (not 15). Arms: none / v3-guidance (rule only in @guidance prose) / v3-structured (rule in requires) / v4-structured (rule in requires). Isolates the guidance PLACEMENT from the v3-vs-v4 LANGUAGE. Discriminator: the [15,20) band must be rejected. 2 models. If v3-guidance < v3-structured ~ v4-structured, prose guidance is the weak carrier — the reason v4 removed the escape hatch.',
  phases: [{ title: 'Implement' }, { title: 'Score' }],
}
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/guidance-vs-structure'
const N = 6
const MODELS = ['opus', 'sonnet']
const API = `Expose exactly: def charge(balance: int) -> int | None  — returns the new balance after applying the $15 charge, or None if the charge is rejected (leaving the balance unchanged).`
const SPECS = {
  none: '',
  'v3-guidance': `${DIR}/specs/v3-guidance.allium`,
  'v3-structured': `${DIR}/specs/v3-structured.allium`,
  'v4-structured': `${DIR}/specs/v4-structured.allium`,
}
const SPEC_SCHEMA = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const CODE_SCHEMA = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const SCORE_SCHEMA = { type: 'object', properties: { matched: { type: 'integer' }, total: { type: 'integer' }, band_ok: { type: 'integer' }, band: { type: 'integer' } }, required: ['matched', 'total', 'band_ok', 'band'] }

function implPrompt(arm, spec) {
  const g = arm === 'none'
    ? `You are implementing a charge operation on an account in pure Python. You have ONLY the signature below — infer the behaviour as best you can.`
    : `You are implementing a charge operation on an account in pure Python, guided by this Allium specification. Follow it EXACTLY — implement every rule it states, wherever the rule appears in the spec.\n\nSpecification:\n"""\n${spec}\n"""`
  return `${g}\n\n${API}\n\nReturn the COMPLETE pure-Python module in \`code\`.`
}
function scorePrompt(code) {
  return `Score a charge() implementation. Mechanical.
1. D=$(mktemp -d); cp ${DIR}/golden.json ${DIR}/score.py "$D"/
2. Write the module below to "$D"/solution.py exactly as given.
3. cd "$D" && SOLUTION=solution python3 score.py   -> prints "M/T band B/N".
Report matched=M, total=T, band_ok=B, band=N. If import errors, all 0.

Module:
\`\`\`python
${code}
\`\`\``
}

phase('Implement')
// read the 3 fixed specs
const specText = { none: '' }
for (const arm of ['v3-guidance', 'v3-structured', 'v4-structured']) {
  const r = await agent(`Read the file at ${SPECS[arm]} and return its exact contents in \`spec\`.`, { label: `readspec:${arm}`, phase: 'Implement', model: 'sonnet', schema: SPEC_SCHEMA })
  specText[arm] = (r && r.spec) || ''
}
const items = []
for (const arm of Object.keys(SPECS)) for (const model of MODELS) for (let i = 0; i < N; i++) items.push({ arm, model, i })
const results = await pipeline(
  items,
  ({ arm, model, i }) => agent(implPrompt(arm, specText[arm]), { label: `impl:${arm}/${model}#${i}`, phase: 'Implement', model, schema: CODE_SCHEMA }),
  (c, { arm, model, i }) => (c && c.code
    ? agent(scorePrompt(c.code), { label: `score:${arm}/${model}#${i}`, phase: 'Score', model: 'sonnet', schema: SCORE_SCHEMA }).then(r => (r ? { arm, model, ...r } : null))
    : null),
)
const summary = {}
for (const arm of Object.keys(SPECS)) for (const model of MODELS) {
  const rs = results.filter(Boolean).filter(r => r.arm === arm && r.model === model)
  const n = rs.length || 1
  summary[`${arm}/${model}`] = {
    n: rs.length,
    band_pct: Number((rs.reduce((a, r) => a + (r.band ? r.band_ok / r.band : 0), 0) / n * 100).toFixed(1)),
    score_pct: Number((rs.reduce((a, r) => a + (r.total ? r.matched / r.total : 0), 0) / n * 100).toFixed(1)),
  }
}
log(`guidance-vs-structure BAND%  opus[none ${summary['none/opus'].band_pct} v3guid ${summary['v3-guidance/opus'].band_pct} v3struct ${summary['v3-structured/opus'].band_pct} v4 ${summary['v4-structured/opus'].band_pct}]  sonnet[none ${summary['none/sonnet'].band_pct} v3guid ${summary['v3-guidance/sonnet'].band_pct} v3struct ${summary['v3-structured/sonnet'].band_pct} v4 ${summary['v4-structured/sonnet'].band_pct}]`)
return { task: 'guidance-vs-structure', N, summary, raw: results.filter(Boolean) }
