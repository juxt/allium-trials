export const meta = {
  name: 'benchmark-fineract-amortization',
  description: 'First REAL-CODE differential-fidelity task. Distil a spec from real Fineract TvmFunctions.java (rate = Newton-Raphson interest solver + discountFactor), HIDE the Java, reconstruct in Python from the spec alone, score by differential vs golden values captured from the real function. Three arms — prose / V3 / V4 — measure how much real, non-obvious behaviour each representation preserves through the round-trip. Code-level, ungameable by language features.',
  phases: [
    { title: 'Distil', detail: 'each arm distils a spec from the real Java (sees the code)' },
    { title: 'Reconstruct', detail: 'a fresh agent rebuilds the two functions in Python from the SPEC ONLY (no Java)' },
    { title: 'Score', detail: 'differential vs golden.json (real Fineract outputs); fidelity = fraction matched' },
  ],
}

const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/fineract-amortization'
const JAVA = `${DIR}/original/TvmFunctions.java`
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const N = 4

const DISTIL = {
  prose: `Read the real Java file at ${JAVA}. Write a PRECISE prose specification of its two public functions, \`rate(nper, pmt, pv, mc)\` and \`discountFactor(eir, days, mc)\`: what each computes, the method, and every edge case and numerical rule that matters for a faithful reimplementation. Write a SPECIFICATION (behaviour and rules), not a line-by-line copy of the code. Return the prose spec in \`spec\`.`,
  v3: `Read the real Java file at ${JAVA}. Distil an Allium v3 specification capturing the behaviour of its two public functions \`rate\` and \`discountFactor\` — entities, invariants, and rules for what they compute and the edge cases that govern them. Return the v3 spec text in \`spec\`.`,
  v4: `Read the real Java file at ${JAVA}. Distil an Allium v4 specification capturing the behaviour of its two public functions \`rate\` and \`discountFactor\` — states, invariants, and any objective (e.g. the solver's convergence/termination). You may write it to a temp file and run \`${ALLIUM} analyse <file>\` to check it. Return the v4 spec text in \`spec\`.`,
}

const SPEC_SCHEMA = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const CODE_SCHEMA = { type: 'object', properties: { code: { type: 'string', description: 'Python module defining rate(nper,pmt,pv) and discountFactor(eir,days).' } }, required: ['code'] }
const SCORE_SCHEMA = { type: 'object', properties: { matched: { type: 'integer' }, total: { type: 'integer' } }, required: ['matched', 'total'] }

function reconstructPrompt(kind, spec) {
  return `Below is a ${kind} specification of two numerical-finance functions. Reconstruct them in Python. You do NOT have the original source — work only from this spec.

Expose exactly these signatures (plain Python floats):
  def rate(nper: int, pmt: float, pv: float) -> float
  def discountFactor(eir: float, days: int) -> float

Specification:
"""
${spec}
"""

Return the COMPLETE Python module in \`code\`.`
}

function scorePrompt(code) {
  return `Score a Python reconstruction against real golden values. Mechanical.
1. D=$(mktemp -d); cp ${DIR}/golden.json ${DIR}/score.py "$D"/
2. Write the module below to "$D"/solution.py exactly as given.
3. cd "$D" && SOLUTION=solution python3 score.py   -> prints "matched/total".
Report matched and total. If it errors, matched=0.

Module:
\`\`\`python
${code}
\`\`\``
}

phase('Distil')
const items = []
for (const arm of Object.keys(DISTIL)) for (let i = 0; i < N; i++) items.push({ arm, i })

const results = await pipeline(
  items,
  ({ arm, i }) => agent(DISTIL[arm], { label: `distil:${arm}#${i}`, phase: 'Distil', schema: SPEC_SCHEMA }),
  (s, { arm, i }) => {
    if (!s || !s.spec) return null
    return agent(reconstructPrompt(arm, s.spec), { label: `rebuild:${arm}#${i}`, phase: 'Reconstruct', schema: CODE_SCHEMA })
  },
  (c, { arm, i }) => {
    if (!c || !c.code) return null
    return agent(scorePrompt(c.code), { label: `score:${arm}#${i}`, phase: 'Score', schema: SCORE_SCHEMA })
      .then(r => (r ? { arm, i, matched: r.matched, total: r.total } : null))
  },
)

const summary = {}
for (const arm of Object.keys(DISTIL)) {
  const rs = results.filter(Boolean).filter(r => r.arm === arm)
  const n = rs.length || 1
  summary[arm] = {
    n: rs.length,
    fidelity_pct: Number((rs.reduce((a, r) => a + (r.total ? r.matched / r.total : 0), 0) / n * 100).toFixed(1)),
  }
}
log(`fineract-amortization fidelity  prose ${summary.prose.fidelity_pct}%  v3 ${summary.v3.fidelity_pct}%  v4 ${summary.v4.fidelity_pct}%`)
return { task: 'fineract-amortization', N, summary, raw: results.filter(Boolean) }
