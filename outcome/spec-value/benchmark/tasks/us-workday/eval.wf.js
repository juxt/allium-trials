export const meta = {
  name: 'benchmark-us-workday',
  description: 'MATRIX reconstruct on a FIFTH codebase (workalendar, date/holiday conventions). Reconstruct is_working_day(date) for US 2024 from a spec, hidden source. 4 arms x 2 models. Weekends are inferable; the US federal HOLIDAYS (esp. floating ones: MLK 3rd-Mon-Jan, Presidents 3rd-Mon-Feb, Memorial last-Mon-May, Labor 1st-Mon-Sep, Columbus 2nd-Mon-Oct, Thanksgiving 4th-Thu-Nov) are non-inferable / half-remembered. Graded: 366 full + a 10-holiday HARD subset.',
  phases: [{ title: 'Distil' }, { title: 'Reconstruct' }, { title: 'Score' }],
}
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/us-workday'
const SRC = `${DIR}/original/usa.py`
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const N = 3
const MODELS = ['opus', 'sonnet']
const API = `Expose exactly: def is_working_day(date: str) -> bool  where date is an ISO string "YYYY-MM-DD". Return True iff it is a US working day in 2024 (not a weekend, not a US federal holiday).`
const DISTIL = {
  prose: `Read the real source at ${SRC} (workalendar US calendar). Write a CONCISE prose spec (under ~150 lines) of which days are US working days: the weekend rule AND every US federal holiday with its exact date rule (fixed and floating). Return in \`spec\`.`,
  v3: `Read ${SRC}. Distil a CONCISE Allium v3 spec (under ~150 lines) of US working days: weekends + every federal holiday rule. Return in \`spec\`.`,
  v4: `Read ${SRC}. Distil a CONCISE Allium v4 spec (under ~150 lines) of US working days: weekends + every federal holiday rule + invariants. You may run \`${ALLIUM} analyse\`. Return in \`spec\`.`,
}
const SPEC_SCHEMA = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const CODE_SCHEMA = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const SCORE_SCHEMA = { type: 'object', properties: { matched: { type: 'integer' }, total: { type: 'integer' }, matched_hard: { type: 'integer' }, total_hard: { type: 'integer' } }, required: ['matched', 'total', 'matched_hard', 'total_hard'] }
function buildPrompt(arm, spec) {
  const g = arm === 'none'
    ? `You are implementing a US business-day calendar for 2024 in pure Python. You have ONLY the signature below — infer the weekend + US federal holiday rules as best you can.`
    : `Implement a US business-day calendar for 2024 in pure Python, guided by this ${arm} specification. Follow it exactly, including every holiday rule.\n\nSpecification:\n"""\n${spec}\n"""`
  return `${g}\n\n${API}\n\nReturn the COMPLETE pure-Python module in \`code\`.`
}
function scorePrompt(code) {
  return `Score a US working-day module. Mechanical.
1. D=$(mktemp -d); cp ${DIR}/golden.json ${DIR}/golden_hard.json ${DIR}/score.py "$D"/
2. Write the module below to "$D"/solution.py exactly as given.
3. cd "$D" && SOLUTION=solution GOLDEN=golden.json python3 score.py       -> matched/total (366)
4. cd "$D" && SOLUTION=solution GOLDEN=golden_hard.json python3 score.py  -> matched_hard/total_hard (10 holidays)
Report all four. If import errors, all 0.

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
phase('Reconstruct')
const items = []
for (const arm of ['none', 'prose', 'v3', 'v4']) for (const model of MODELS) for (let i = 0; i < N; i++) items.push({ arm, model, i })
const results = await pipeline(
  items,
  ({ arm, model, i }) => agent(buildPrompt(arm, specs[arm]), { label: `build:${arm}/${model}#${i}`, phase: 'Reconstruct', model, schema: CODE_SCHEMA }),
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
log(`us-workday HARD(holidays)  opus[none ${summary['none/opus'].hard_pct} prose ${summary['prose/opus'].hard_pct} v3 ${summary['v3/opus'].hard_pct} v4 ${summary['v4/opus'].hard_pct}]  sonnet[none ${summary['none/sonnet'].hard_pct} prose ${summary['prose/sonnet'].hard_pct} v3 ${summary['v3/sonnet'].hard_pct} v4 ${summary['v4/sonnet'].hard_pct}]`)
return { task: 'us-workday', N, summary, raw: results.filter(Boolean) }
