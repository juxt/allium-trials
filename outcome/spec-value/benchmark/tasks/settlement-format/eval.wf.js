export const meta = {
  name: 'benchmark-settlement-format',
  description: 'HARD multi-obligation task designed to break the 80-100% cluster. Encode a bespoke settlement-instruction wire record with ~12 independent, mostly NON-INFERABLE conventions (minor-unit amounts with signed overpunch, ISO-numeric currency codes, Julian dates, zero-padded fixed widths, arbitrary method codes, a mod-10 check). Per-field graded oracle. A no-spec arm can only guess the natural encoding and should land LOW (naive baseline 23%); a spec arm carrying every convention should reach high. 4 arms x 2 models. Measures the spec-vs-no-spec gap where it is largest — many bespoke obligations.',
  phases: [{ title: 'Implement' }, { title: 'Score' }],
}
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/settlement-format'
const fs = { prose: `${DIR}/specs/prose.md`, v3: `${DIR}/specs/v3.allium`, v4: `${DIR}/specs/v4.allium` }
const N = 4
const MODELS = ['opus', 'sonnet']
const API = `Expose exactly: def encode(rec: dict) -> dict — maps a settlement record to a dict of {field_name: encoded_string}. rec has keys: amount (float), currency (alpha ISO code e.g. 'USD'), value_date (ISO 'YYYY-MM-DD'), direction ('credit'/'debit'), account (str), priority (int or None), method ('wire'/'book'/'net'), resident (bool), purpose (str). The output fields are: record_type, amount, currency, value_date, direction, account, priority, method, resident, purpose, filler, check.`
const SPEC_SCHEMA = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const CODE_SCHEMA = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const SCORE_SCHEMA = { type: 'object', properties: { matched: { type: 'integer' }, total: { type: 'integer' } }, required: ['matched', 'total'] }

function implPrompt(arm, spec) {
  const g = arm === 'none'
    ? `You are implementing an encoder for a settlement-instruction wire record. You have ONLY the field list and record shape below — infer each field's encoding as best you can.`
    : `You are implementing an encoder for a settlement-instruction wire record, guided by this ${arm} specification. Follow EVERY field convention it states exactly.\n\nSpecification:\n"""\n${spec}\n"""`
  return `${g}\n\n${API}\n\nReturn the COMPLETE pure-Python module in \`code\`.`
}
function scorePrompt(code) {
  return `Score a settlement encoder against a hidden reference, per field. Mechanical.
1. D=$(mktemp -d); cp ${DIR}/golden.json ${DIR}/score.py "$D"/
2. Write the module below to "$D"/solution.py exactly as given.
3. cd "$D" && SOLUTION=solution python3 score.py -> "matched/total" (fields correct across all records).
Report matched and total. If it errors on import, matched=0.

Module:
\`\`\`python
${code}
\`\`\``
}

phase('Implement')
const specText = { none: '' }
for (const arm of ['prose', 'v3', 'v4']) {
  const r = await agent(`Read the file at ${fs[arm]} and return its exact contents in \`spec\`.`, { label: `readspec:${arm}`, phase: 'Implement', model: 'sonnet', schema: SPEC_SCHEMA })
  specText[arm] = (r && r.spec) || ''
}
const items = []
for (const arm of ['none', 'prose', 'v3', 'v4']) for (const model of MODELS) for (let i = 0; i < N; i++) items.push({ arm, model, i })
const results = await pipeline(
  items,
  ({ arm, model, i }) => agent(implPrompt(arm, specText[arm]), { label: `impl:${arm}/${model}#${i}`, phase: 'Implement', model, schema: CODE_SCHEMA }),
  (c, { arm, model, i }) => (c && c.code
    ? agent(scorePrompt(c.code), { label: `score:${arm}/${model}#${i}`, phase: 'Score', model: 'sonnet', schema: SCORE_SCHEMA }).then(r => (r ? { arm, model, ...r } : null))
    : null),
)
const summary = {}
for (const arm of ['none', 'prose', 'v3', 'v4']) for (const model of MODELS) {
  const rs = results.filter(Boolean).filter(r => r.arm === arm && r.model === model)
  const n = rs.length || 1
  summary[`${arm}/${model}`] = { n: rs.length, score_pct: Number((rs.reduce((a, r) => a + (r.total ? r.matched / r.total : 0), 0) / n * 100).toFixed(1)) }
}
log(`settlement-format  opus[none ${summary['none/opus'].score_pct} prose ${summary['prose/opus'].score_pct} v3 ${summary['v3/opus'].score_pct} v4 ${summary['v4/opus'].score_pct}]  sonnet[none ${summary['none/sonnet'].score_pct} prose ${summary['prose/sonnet'].score_pct} v3 ${summary['v3/sonnet'].score_pct} v4 ${summary['v4/sonnet'].score_pct}]`)
return { task: 'settlement-format', N, summary, raw: results.filter(Boolean) }
