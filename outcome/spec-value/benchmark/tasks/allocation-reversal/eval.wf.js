export const meta = {
  name: 'benchmark-allocation-reversal',
  description: 'MATRIX feature-add task. Add reverse(allocations, amount) to a payment allocator. The correct unwind order (REVERSE priority order) is a DESIGN DECISION not guessable from the request — so the spec that states it should beat no-spec (which must guess; forward-order guess scores ~50% on the graded oracle). 4 arms (none/prose/v3/v4) x 2 models (opus/sonnet). Graded oracle: 49 reversal scenarios vs a reference. Measures whether a stated rule in a spec yields correct code.',
  phases: [
    { title: 'Implement', detail: '4 arms x 2 models add reverse() to the base allocator' },
    { title: 'Score', detail: 'graded vs 49 reversal scenarios' },
  ],
}

const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/allocation-reversal'
const fs = { prose: `${DIR}/specs/prose.md`, v3: `${DIR}/specs/v3.allium`, v4: `${DIR}/specs/v4.allium` }
const N = 3
const MODELS = ['opus', 'sonnet']

const BASE = `# base.py — the existing forward allocator (do not change it; import ORDER/allocate if useful)
ORDER = [
    ("PAST_DUE","PENALTY"),("PAST_DUE","FEE"),("PAST_DUE","PRINCIPAL"),("PAST_DUE","INTEREST"),
    ("DUE","PENALTY"),("DUE","FEE"),("DUE","PRINCIPAL"),("DUE","INTEREST"),
    ("IN_ADVANCE","PENALTY"),("IN_ADVANCE","FEE"),("IN_ADVANCE","PRINCIPAL"),("IN_ADVANCE","INTEREST"),
]
def allocate(payment, owed):
    remaining = payment; out = {}
    for key in ORDER:
        pay = min(remaining, owed.get(key, 0))
        if pay > 0: out[key] = pay; remaining -= pay
    return out`

const REQUEST = `Add a function \`reverse(allocations, amount)\` to this module. It refunds \`amount\` from a set of prior \`allocations\` (a dict mapping a bucket key tuple like ("DUE","PRINCIPAL") to the amount allocated), and returns a dict mapping bucket key -> amount reversed.`

const SPEC_SCHEMA = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const CODE_SCHEMA = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const SCORE_SCHEMA = { type: 'object', properties: { matched: { type: 'integer' }, total: { type: 'integer' } }, required: ['matched', 'total'] }

function implPrompt(arm, spec) {
  const extra = arm === 'none' ? '' : `\n\nYou are guided by this ${arm} specification of the reverse behaviour:\n"""\n${spec}\n"""`
  return `You are extending an existing Python module. Here is the base:

\`\`\`python
${BASE}
\`\`\`

${REQUEST}${extra}

Return the COMPLETE module (base + your reverse function) in \`code\`.`
}

function scorePrompt(code) {
  return `Score a candidate module's reverse() against a hidden reference. Mechanical.
1. D=$(mktemp -d); cp ${DIR}/golden.json ${DIR}/score.py ${DIR}/base.py "$D"/
2. Write the module below to "$D"/solution.py exactly as given.
3. cd "$D" && SOLUTION=solution python3 score.py  -> prints "matched/total".
Report matched and total. If it errors on import, matched=0.

Module:
\`\`\`python
${code}
\`\`\``
}

// Load the fixed specs (read once via a tiny agent per arm — cheap, deterministic file reads).
phase('Implement')
const specs = { none: '' }
for (const arm of ['prose', 'v3', 'v4']) {
  const r = await agent(`Read the file at ${fs[arm]} and return its exact contents in \`spec\`.`, { label: `readspec:${arm}`, phase: 'Implement', model: 'sonnet', schema: SPEC_SCHEMA })
  specs[arm] = (r && r.spec) || ''
}

const items = []
for (const arm of ['none', 'prose', 'v3', 'v4']) for (const model of MODELS) for (let i = 0; i < N; i++) items.push({ arm, model, i })

const results = await pipeline(
  items,
  ({ arm, model, i }) => agent(implPrompt(arm, specs[arm]), { label: `impl:${arm}/${model}#${i}`, phase: 'Implement', model, schema: CODE_SCHEMA }),
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
log(`allocation-reversal  opus[none ${summary['none/opus'].score_pct} prose ${summary['prose/opus'].score_pct} v3 ${summary['v3/opus'].score_pct} v4 ${summary['v4/opus'].score_pct}]  sonnet[none ${summary['none/sonnet'].score_pct} prose ${summary['prose/sonnet'].score_pct} v3 ${summary['v3/sonnet'].score_pct} v4 ${summary['v4/sonnet'].score_pct}]`)
return { task: 'allocation-reversal', N, summary, raw: results.filter(Boolean) }
