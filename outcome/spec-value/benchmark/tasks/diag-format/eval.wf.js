export const meta = {
  name: 'diag-format',
  description: 'Data-driven test of which CLI diagnostic FORMAT is most actionable for an LLM fixer. Three seeded defects in a real 91-line v4 spec (undeclared name, wrong reference, contradiction). Each real diagnostic is rendered three ways: raw (message+byte span, the current output), located (message+file:line+construct name), actionable (problem/fix split + target{name,line,excerpt}). A tool-using fixer gets ONLY the rendered diagnostic + the spec path, edits its own copy, and the checker re-runs as the oracle (did the issue clear, without new errors). Opus + Sonnet, N=2. Measures fix-success per format; a null means format barely matters at this spec size.',
  phases: [{ title: 'Fix' }, { title: 'Score' }],
}
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/diag-format'
const ALLIUM = '/Users/hgarner/code/allium-tools/target/debug/allium'
const ARMS = ['raw', 'located', 'actionable']
const MODELS = ['opus', 'sonnet']
const N = 2
const BATCH = 3

const DEFECTS = {
  d1: {
    cmd: 'check', file: `${DIR}/defects/d1_undeclared.allium`,
    raw: { message: '`intrest` is not declared (name resolution, in `ProgressiveLoanSchedule`)', severity: 'warning', span: { start: 3889, end: 3970 } },
    kind: 'invariant', name: 'principal_split', line: 71,
    excerpt: '  invariant principal_split means\n    every p :: principal(p) = emi(p) - intrest(p)',
    problem: 'In invariant principal_split, `intrest` is not a declared name in component ProgressiveLoanSchedule.',
    fix: 'Reference a declared observable state instead of `intrest`, or declare the name.',
    clear_absent: 'not declared',
  },
  d2: {
    cmd: 'check', file: `${DIR}/defects/d2_wrongref.allium`,
    raw: { message: '`balance` is not declared (name resolution, in `ProgressiveLoanSchedule`)', severity: 'warning', span: { start: 4155, end: 4277 } },
    kind: 'invariant', name: 'balance_rolls', line: 77,
    excerpt: '  invariant balance_rolls means\n    every p :: every q :: follows(q, p) implies\n      balance(q) = balance(p) - principal(p)',
    problem: 'In invariant balance_rolls, `balance` is not a declared name in component ProgressiveLoanSchedule.',
    fix: 'Reference a declared observable state instead of `balance`, or declare the name.',
    clear_absent: 'not declared',
  },
  d4: {
    cmd: 'analyse', file: `${DIR}/defects/d4_contradiction.allium`,
    raw: { message: 'arithmetic invariants in `ProgressiveLoanSchedule` are CONTRADICTORY over 3 periods: no schedule satisfies them all. Conflicting core: emi_floor, emi_cap.', severity: 'warning', span: { start: 0, end: 0 } },
    kind: 'invariant', name: 'emi_floor, emi_cap', line: 93,
    excerpt: '  invariant emi_floor means every p :: emi(p) >= 1000\n  invariant emi_cap means every p :: emi(p) <= 500',
    problem: 'invariants emi_floor and emi_cap cannot both hold: one requires emi >= 1000, the other emi <= 500.',
    fix: 'Remove or reconcile one of the two conflicting invariants so a value can satisfy both.',
    clear_absent: 'CONTRADICTORY',
  },
}

function render(arm, d) {
  if (arm === 'raw') return JSON.stringify({ message: d.raw.message, severity: 'Warning', span: d.raw.span }, null, 2)
  if (arm === 'located') return JSON.stringify({ message: d.raw.message, severity: 'warning', location: { file: d.file.split('/').pop(), line: d.line, construct: `${d.kind} ${d.name}` } }, null, 2)
  // actionable
  return JSON.stringify({ code: d.cmd === 'analyse' ? 'contradictory-invariants' : 'undeclared-name', severity: 'warning', target: { kind: d.kind, name: d.name, file: d.file.split('/').pop(), line: d.line, excerpt: d.excerpt }, problem: d.problem, fix: d.fix }, null, 2)
}

const WORK = { type: 'object', properties: { workpath: { type: 'string' }, edited: { type: 'boolean' } }, required: ['workpath', 'edited'] }
const SCORE = { type: 'object', properties: { cleared: { type: 'boolean' }, errors: { type: 'integer' }, invariants: { type: 'integer' }, note: { type: 'string' } }, required: ['cleared', 'errors', 'invariants', 'note'] }

async function fix(defKey, arm, model, i) {
  const d = DEFECTS[defKey]
  const work = `/tmp/diagfmt/${defKey}_${arm}_${model}_${i}.allium`
  const diag = render(arm, d)
  const p = `You maintain an Allium v4 specification. A checker reported ONE diagnostic about it, shown below as JSON.\n\nDIAGNOSTIC:\n${diag}\n\nSteps (use your shell + editor):\n1. Run: mkdir -p /tmp/diagfmt && cp ${d.file} ${work}\n2. Fix the spec at ${work} so this diagnostic is resolved, changing as LITTLE as possible and not altering unrelated behaviour. Make one targeted edit.\n3. Do NOT run the checker yourself; make your best fix from the diagnostic and the file.\nReturn workpath=${work} and edited=true when done.`
  const r = await agent(p, { label: `fix:${defKey}/${arm}/${model}#${i}`, phase: 'Fix', model, agentType: 'claude', schema: WORK })
  return (r && r.workpath) ? r.workpath : work
}
async function score(defKey, workpath) {
  const d = DEFECTS[defKey]
  const p = `Score a fixed Allium spec, mechanically. Run exactly:\n  ${ALLIUM} ${d.cmd} ${workpath}\nParse the JSON output. Report:\n- cleared: true if NO diagnostic or finding message/summary contains the text "${d.clear_absent}".\n- errors: count of diagnostics with severity error (case-insensitive).\n- invariants: number of lines in ${workpath} that contain "invariant " (run: grep -c 'invariant ' ${workpath}).\n- note: one line on what changed or any new problem.\nReport those four fields only.`
  const r = await agent(p, { label: `score:${defKey}`, phase: 'Score', model: 'sonnet', agentType: 'claude', schema: SCORE })
  return r || { cleared: false, errors: 9, invariants: 0, note: 'score failed' }
}

const cells = []
for (const defKey of Object.keys(DEFECTS)) for (const arm of ARMS) for (const model of MODELS) for (let i = 0; i < N; i++) cells.push({ defKey, arm, model, i })
const good = []
for (let b = 0; b < cells.length; b += BATCH) {
  const rs = await parallel(cells.slice(b, b + BATCH).map(({ defKey, arm, model, i }) => async () => {
    const wp = await fix(defKey, arm, model, i)
    const s = await score(defKey, wp)
    const ok = s.cleared && s.errors === 0
    return { defKey, arm, model, i, cleared: !!s.cleared, errors: s.errors, invariants: s.invariants, ok, note: s.note }
  }))
  good.push(...rs.filter(Boolean))
  log(`batch ${b / BATCH + 1}/${Math.ceil(cells.length / BATCH)} (${good.length} cells)`)
}

const summary = {}
for (const arm of ARMS) {
  const rs = good.filter(r => r.arm === arm)
  const n = rs.length || 1
  summary[arm] = {
    runs: rs.length,
    fix_success_pct: Number((rs.filter(r => r.ok).length / n * 100).toFixed(1)),
    cleared_pct: Number((rs.filter(r => r.cleared).length / n * 100).toFixed(1)),
    by_model: Object.fromEntries(MODELS.map(m => {
      const mr = rs.filter(r => r.model === m); const mn = mr.length || 1
      return [m, `${mr.filter(r => r.ok).length}/${mr.length}`]
    })),
  }
}
log(`fix-success — ${ARMS.map(a => `${a}: ${summary[a].fix_success_pct}% (opus ${summary[a].by_model.opus}, sonnet ${summary[a].by_model.sonnet})`).join('  |  ')}`)
return { task: 'diag-format', N, summary, raw: good }
