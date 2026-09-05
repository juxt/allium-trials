export const meta = {
  name: 'benchmark-bech32-bugfix',
  description: 'MATRIX BUGFIX (activity diversity) on bech32. A buggy segwit impl has ONE corrupted polymod generator constant, so valid addresses are rejected and encodes produce wrong checksums. Fix it. The correct constant is NON-INFERABLE — no-spec must recall it from flaky memory (bech32 showed ~82% reliable), spec arms have it exactly. 4 arms x 2 models. Graded oracle: 26 real golden. Tests whether BUGFIX separates arms when the fix is non-inferable.',
  phases: [{ title: 'Fix' }, { title: 'Score' }],
}
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/bech32-bugfix'
const SEG = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/bech32-segwit'
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const N = 3
const MODELS = ['opus', 'sonnet']
const fs = require ? null : null
// the buggy source is read by an agent from disk (kept out of the JS)
const SYMPTOM = `A bug report: the address "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4" is a valid Bitcoin SegWit address, but decode('bc', <it>) returns (None, None), and encode('bc', 0, bytes.fromhex('751e76e8199196d454941c45d1b3a323f1433bd6')) returns the wrong address (a wrong checksum). The checksum math is off.`
const DISTIL = {
  prose: `Read the bech32 reference at ${SEG}/original/segwit_addr.py. Write a CONCISE prose spec (under ~150 lines) of the polymod checksum: the exact generator constants and the algorithm. Return in \`spec\`.`,
  v3: `Read ${SEG}/original/segwit_addr.py. Distil a CONCISE Allium v3 spec (under ~150 lines) of the bech32 polymod checksum incl. the exact generator constants. Return in \`spec\`.`,
  v4: `Read ${SEG}/original/segwit_addr.py. Distil a CONCISE Allium v4 spec (under ~150 lines) of the bech32 polymod checksum incl. the exact generator constants. You may run \`${ALLIUM} analyse\`. Return in \`spec\`.`,
}
const SPEC_SCHEMA = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const CODE_SCHEMA = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const SCORE_SCHEMA = { type: 'object', properties: { matched: { type: 'integer' }, total: { type: 'integer' } }, required: ['matched', 'total'] }
function fixPrompt(arm, spec) {
  const guide = arm === 'none' ? '' : `\n\nYou have this ${arm} specification of the correct checksum:\n"""\n${spec}\n"""`
  return `The file ${DIR}/buggy.py is a bech32 SegWit implementation with a bug. ${SYMPTOM}\n\nRead ${DIR}/buggy.py, find and fix the bug so encode/decode are correct.${guide}\n\nReturn the COMPLETE corrected module (with encode(hrp,witver,witprog) and decode(hrp,addr)) in \`code\`.`
}
function scorePrompt(code) {
  return `Score a corrected bech32 module. Mechanical.
1. D=$(mktemp -d); cp ${DIR}/golden.json ${DIR}/score.py "$D"/
2. Write the module below to "$D"/solution.py exactly as given.
3. cd "$D" && SOLUTION=solution python3 score.py -> "matched/total". Report both. If import errors, matched=0.

Module:
\`\`\`python
${code}
\`\`\``
}
phase('Fix')
const specs = { none: '' }
const distilled = await parallel(Object.keys(DISTIL).map(arm => () =>
  agent(DISTIL[arm], { label: `distil:${arm}`, phase: 'Fix', schema: SPEC_SCHEMA }).then(s => ({ arm, spec: s && s.spec }))))
for (const d of distilled.filter(Boolean)) specs[d.arm] = d.spec || ''
const items = []
for (const arm of ['none', 'prose', 'v3', 'v4']) for (const model of MODELS) for (let i = 0; i < N; i++) items.push({ arm, model, i })
const results = await pipeline(
  items,
  ({ arm, model, i }) => agent(fixPrompt(arm, specs[arm]), { label: `fix:${arm}/${model}#${i}`, phase: 'Fix', model, schema: CODE_SCHEMA }),
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
log(`bech32-bugfix opus[none ${summary['none/opus'].score_pct} prose ${summary['prose/opus'].score_pct} v3 ${summary['v3/opus'].score_pct} v4 ${summary['v4/opus'].score_pct}] sonnet[none ${summary['none/sonnet'].score_pct} prose ${summary['prose/sonnet'].score_pct} v3 ${summary['v3/sonnet'].score_pct} v4 ${summary['v4/sonnet'].score_pct}]`)
return { task: 'bech32-bugfix', N, summary, raw: results.filter(Boolean) }
