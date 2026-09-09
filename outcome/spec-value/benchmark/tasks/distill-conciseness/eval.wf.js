export const meta = {
  name: 'distill-conciseness',
  description: 'Controlled test of backlog #4 — does a TIGHT v4 spec port more reliably than a VERBOSE one on a mid-tier model? Same behaviour (ISIN validation), same obligations, two v4 specs differing only in verbosity (tight = factored/every-line-load-bearing; verbose = same obligations padded with restated comments, step transcription, repeated decls). Both verified with `allium check`. Port each with Opus (control) and Sonnet (where fragility showed), N=8, score vs 21 golden. Metric: fidelity + reliability (fully-correct fraction) + broken-run count. Prediction: verbose sags on Sonnet; tight holds.',
  phases: [{ title: 'Specs' }, { title: 'Port' }, { title: 'Score' }],
}
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/distill-conciseness'
const SRC = `${DIR}/original/isin.py`
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const N = 8
const MODELS = ['opus', 'sonnet']
const BATCH = 3

const SPEC = { type: 'object', properties: { spec: { type: 'string' }, checked_clean: { type: 'boolean' } }, required: ['spec', 'checked_clean'] }
const CODE = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const SCORE = { type: 'object', properties: { matched: { type: 'integer' }, total: { type: 'integer' }, broke: { type: 'boolean' } }, required: ['matched', 'total', 'broke'] }

phase('Specs')
// 1. Tight spec — real distill discipline, verified clean.
const tightR = await agent(
  `Distil a TIGHT Allium v4 specification of ISIN validation from the real source at ${SRC}. Capture the structure (2-letter country + 9 alphanumerics + check digit) AND the exact check-digit algorithm (letters expanded A=10..Z=35, right-to-left doubling, mod-10). Follow the keep-it-tight discipline: factor shared structure, declare each thing once, every line load-bearing, NO verbatim code dumps, no comment that merely restates an invariant. Write the spec to a temp file and run \`${ALLIUM} check <file>\` — fix until it is clean. Return the final spec in \`spec\` and checked_clean=true only if \`check\` passed with no errors.`,
  { label: 'distil:tight', phase: 'Specs', model: 'opus', agentType: 'claude', schema: SPEC })
const tight = (tightR && tightR.spec) || ''

// 2. Verbose spec — IDENTICAL obligations, only padded. Controlled: same behaviour, more words.
const verboseR = await agent(
  `Below is a TIGHT Allium v4 spec of ISIN validation. Produce a VERBOSE version that carries the IDENTICAL obligations — do NOT add, remove, or change any invariant, axiom, requirement or behaviour. Only pad the presentation: restate each rule in a prose comment, transcribe the check-digit algorithm step by step in comments, repeat declarations where it reads as thorough, add exposition and section headers. The goal is a spec a diligent-but-wordy author would write: same meaning, far more text. Write it to a temp file and run \`${ALLIUM} check <file>\` — fix until clean (keeping obligations identical). Return it in \`spec\`, checked_clean per the check result.\n\nTIGHT SPEC:\n"""\n${tight}\n"""`,
  { label: 'expand:verbose', phase: 'Specs', model: 'opus', agentType: 'claude', schema: SPEC })
const verbose = (verboseR && verboseR.spec) || ''

log(`spec lengths — tight ${tight.length} chars (clean=${tightR && tightR.checked_clean}); verbose ${verbose.length} chars (clean=${verboseR && verboseR.checked_clean})`)
const VARIANTS = { tight, verbose }

function portPrompt(spec) {
  return `Implement an ISIN validator in pure Python — module-level \`is_valid(isin: str) -> bool\` — guided by this Allium v4 specification. Follow it exactly, including the check-digit algorithm.\n\nSpecification:\n"""\n${spec}\n"""\n\nReturn the COMPLETE pure-Python module in \`code\`.`
}
function scorePrompt(code) {
  return `Score an ISIN validator. Mechanical:\n1. D=$(mktemp -d); cp ${DIR}/golden.json ${DIR}/score.py "$D"/\n2. Write the module below to "$D"/solution.py EXACTLY.\n3. cd "$D" && SOLUTION=solution python3 score.py -> prints "matched/total".\nReport matched, total, and broke=true if it errored on import/run (matched=0 then).\n\nModule:\n\`\`\`python\n${code}\n\`\`\``
}

phase('Port')
const cells = []
for (const variant of ['tight', 'verbose']) for (const model of MODELS) for (let i = 0; i < N; i++) cells.push({ variant, model, i })
const good = []
for (let b = 0; b < cells.length; b += BATCH) {
  const rs = await parallel(cells.slice(b, b + BATCH).map(({ variant, model, i }) => async () => {
    const cg = await agent(portPrompt(VARIANTS[variant]), { label: `port:${variant}/${model}#${i}`, phase: 'Port', model, schema: CODE })
    if (!cg || !cg.code) return { variant, model, i, matched: 0, total: 21, broke: true }
    const sc = await agent(scorePrompt(cg.code), { label: `score:${variant}/${model}#${i}`, phase: 'Score', model: 'sonnet', schema: SCORE })
    return sc ? { variant, model, i, matched: sc.matched, total: sc.total, broke: !!sc.broke } : { variant, model, i, matched: 0, total: 21, broke: true }
  }))
  good.push(...rs.filter(Boolean))
  log(`batch ${b / BATCH + 1}/${Math.ceil(cells.length / BATCH)} (${good.length} cells)`)
}

const summary = {}
for (const variant of ['tight', 'verbose']) for (const model of MODELS) {
  const rs = good.filter(r => r.variant === variant && r.model === model)
  const n = rs.length || 1
  summary[`${variant}/${model}`] = {
    runs: rs.length,
    fidelity_pct: Number((rs.reduce((a, r) => a + (r.total ? r.matched / r.total : 0), 0) / n * 100).toFixed(1)),
    reliability: `${rs.filter(r => r.total && r.matched === r.total).length}/${rs.length}`,
    broke: rs.filter(r => r.broke).length,
    worst: rs.length ? Math.min(...rs.map(r => r.total ? Math.round(r.matched / r.total * 100) : 0)) : 0,
  }
}
log(`fidelity — ${Object.entries(summary).map(([k, v]) => `${k}: ${v.fidelity_pct} (rel ${v.reliability}, broke ${v.broke})`).join('  |  ')}`)
return { task: 'distill-conciseness', N, spec_lengths: { tight: tight.length, verbose: verbose.length }, summary, raw: good }
