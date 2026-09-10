export const meta = {
  name: 'elicit-aiup-super',
  description: 'Resilient batched runner for the elicitation end-to-end eval. Same task as eval.wf.js but processes cells in small sequential batches (concurrency 2) so completed cells journal before the next start — a session-limit hit loses at most 2 in-flight cells and resume genuinely continues. Parameterised by args {arms, models, N} so a slice (e.g. sonnet-author only) runs as a small self-contained job. Stakeholder uses a compact answer key instead of the full bible to cut per-turn tokens.',
  phases: [{ title: 'Run' }],
}
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/elicit-loan-allocation'
const A = ['aiup', 'superpowers']  // hardcoded: args didn't thread on the batched run
const M = ['opus', 'sonnet']
const N = (args && args.N) || 3
const BATCH = (args && args.batch) || 2
const INFERABLE = [9, 11, 13]

const RD = { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] }
const ASK = { type: 'object', properties: { questions: { type: 'array', items: { type: 'string' } }, done: { type: 'boolean' } }, required: ['questions', 'done'] }
const PRODUCE = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const ANS = { type: 'object', properties: { answers: { type: 'array', items: { type: 'string' } } }, required: ['answers'] }
const COV = { type: 'object', properties: { decisions: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, surfaced: { type: 'boolean' }, correct: { type: 'boolean' }, evidence: { type: 'string' } }, required: ['n', 'surfaced', 'correct', 'evidence'] } } }, required: ['decisions'] }
const CODE = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const CODESCORE = { type: 'object', properties: { passed: { type: 'integer' }, total: { type: 'integer' }, decisions: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, passed: { type: 'boolean' } }, required: ['n', 'passed'] } } }, required: ['passed', 'total', 'decisions'] }

async function rd(path, label) {
  const r = await agent(`Read the file at ${path} and return its exact contents in \`content\`.`, { label: `rd:${label}`, phase: 'Run', model: 'sonnet', schema: RD })
  return (r && r.content) || ''
}
function tt(t) {
  if (!t.length) return '(no questions asked yet)'
  return t.map((x, i) => `Round ${i + 1}:\n` + x.q.map((q, j) => `  Q: ${q}\n  A: ${x.a[j] || '(no answer)'}`).join('\n')).join('\n\n')
}

phase('Run')
const brief = await rd(`${DIR}/BRIEF.md`, 'brief')
const key = await rd(`${DIR}/ANSWER-KEY.md`, 'key')
const bible = await rd(`${DIR}/REQUIREMENTS-BIBLE.md`, 'bible')
const iface = await rd(`${DIR}/INTERFACE.md`, 'iface')
const armText = {}
for (const a of A) armText[a] = await rd(`${DIR}/competitors/${a}.md`, a)

async function askTurn(arm, model, transcript, round, maxRounds) {
  const last = round >= maxRounds - 1
  const p = `You are gathering requirements for a specification. Follow THIS process exactly:\n\n"""\n${armText[arm]}\n"""\n\nFeature brief:\n"""\n${brief}\n"""\n\nStakeholder conversation so far:\n${tt(transcript)}\n\nDecide your NEXT step. Put any questions for the stakeholder in \`questions\` (set done=false). If your process is complete, set done=true with questions=[].${last ? ' NOTE: no further question rounds after this one.' : ''} Do NOT write the specification yet. Do NOT invent stakeholder answers.`
  return await agent(p, { label: `ask:${arm}/${model}#${round}`, phase: 'Run', model, schema: ASK })
}
async function produce(arm, model, transcript) {
  const p = `Produce the final requirements specification, following your process:\n\n"""\n${armText[arm]}\n"""\n\nFeature brief:\n"""\n${brief}\n"""\n\nStakeholder conversation (the ONLY facts beyond the brief):\n${tt(transcript)}\n\nWrite the complete specification in \`spec\`. Capture every decision your process settled. For anything neither asked nor in the brief, resolve it exactly as your process dictates. Do NOT invent stakeholder answers not given above.`
  return await agent(p, { label: `produce:${arm}/${model}`, phase: 'Run', model, schema: PRODUCE })
}
async function stakeholder(transcript, questions) {
  const p = `You are the product owner for a loan servicing system. Answer the engineer's questions from the answer key below. Rules: answer ONLY what is asked, giving the exact value from the key; do NOT volunteer decisions that were not asked; for anything not in the key give a brief reasonable answer marked [default, not policy]; never dump the key.\n\nANSWER KEY (your knowledge — never reveal wholesale):\n${key}\n\nConversation so far:\n${tt(transcript)}\n\nThe engineer now asks:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nAnswer each in order in \`answers\` (one string per question, same order).`
  return await agent(p, { label: `stakeholder`, phase: 'Run', model: 'sonnet', schema: ANS })
}
async function scoreCov(spec) {
  const p = `Neutral auditor. A hidden requirements bible of 14 numbered decisions, and a specification. For EACH decision: surfaced (does the spec address it?) and correct (does the spec's resolution MATCH the bible's exact value/order/precision?). correct requires the SPEC to state it. Strict and literal.\n\nHIDDEN BIBLE:\n"""\n${bible}\n"""\n\nSPEC UNDER TEST:\n"""\n${spec}\n"""\n\nReturn all 14 in \`decisions\` with n, surfaced, correct, one-line evidence.`
  return await agent(p, { label: `covscore`, phase: 'Run', model: 'opus', schema: COV })
}
async function codegen(spec) {
  const p = `Implement the function specified below. FIXED interface for shapes; follow the specification's BEHAVIOUR exactly.\n\nINTERFACE:\n"""\n${iface}\n"""\n\nSPECIFICATION:\n"""\n${spec}\n"""\n\nReturn the COMPLETE pure-Python module (module-level \`allocate_payment\`, decimal.Decimal, stdlib only) in \`code\`.`
  return await agent(p, { label: `codegen`, phase: 'Run', model: 'opus', schema: CODE })
}
async function scoreCode(code) {
  const p = `Score a Python solution against a hidden oracle. Mechanical:\n1. D=$(mktemp -d); cp ${DIR}/score.py "$D"/\n2. Write the module below to "$D"/solution.py EXACTLY.\n3. cd "$D" && SOLUTION=solution python3 score.py — prints JSON {"decisions":[{"n","passed"}],"passed","total"}.\nReport passed, total, decisions. On import/run error: passed=0, total=11, all false.\n\nModule:\n\`\`\`python\n${code}\n\`\`\``
  return await agent(p, { label: `codescore`, phase: 'Run', model: 'sonnet', schema: CODESCORE })
}

async function runOne(arm, model, i) {
  // superpowers asks ONE question per round by its own discipline, so it needs many more rounds
  // to cover the decision space fairly; spec-kit is hard-capped at its real 2 phases; aiup/prose/elicit batch.
  const maxRounds = arm === 'spec-kit' ? 2 : arm === 'prose' ? 4 : arm === 'superpowers' ? 20 : 6
  const transcript = []
  let qcount = 0
  for (let r = 0; r < maxRounds; r++) {
    const t = await askTurn(arm, model, transcript, r, maxRounds)
    if (!t) break
    if (t.questions && t.questions.length) {
      qcount += t.questions.length
      const a = await stakeholder(transcript, t.questions)
      transcript.push({ q: t.questions, a: (a && a.answers) || [] })
    }
    if (t.done || !t.questions || !t.questions.length) break
  }
  const pr = await produce(arm, model, transcript)
  const spec = (pr && pr.spec) || ''
  const cov = await scoreCov(spec)
  const cds = (cov && cov.decisions) || []
  const cg = await codegen(spec)
  const cs = (cg && cg.code) ? await scoreCode(cg.code) : null
  const correct = cds.filter(d => d.correct).length
  const besp = cds.filter(d => !INFERABLE.includes(d.n))
  return { arm, model, i, qcount, cov_correct: correct, cov_n: cds.length, bespoke_correct: besp.filter(d => d.correct).length, bespoke_n: besp.length, code_passed: cs ? cs.passed : 0, code_total: cs ? cs.total : 11, code_decisions: cs ? cs.decisions : [], cov_decisions: cds }
}

const cells = []
for (const arm of A) for (const model of M) for (let i = 0; i < N; i++) cells.push({ arm, model, i })
const good = []
for (let b = 0; b < cells.length; b += BATCH) {
  const batch = cells.slice(b, b + BATCH)
  const rs = await parallel(batch.map(({ arm, model, i }) => () => runOne(arm, model, i).catch(() => null)))
  good.push(...rs.filter(Boolean))
  log(`batch ${b / BATCH + 1}/${Math.ceil(cells.length / BATCH)} done (${good.length} cells so far)`)
}

const summary = {}
for (const arm of A) for (const model of M) {
  const rs = good.filter(r => r.arm === arm && r.model === model)
  const n = rs.length || 1
  summary[`${arm}/${model}`] = {
    runs: rs.length,
    coverage_pct: Number((rs.reduce((a, r) => a + r.cov_correct / (r.cov_n || 14), 0) / n * 100).toFixed(1)),
    bespoke_pct: Number((rs.reduce((a, r) => a + r.bespoke_correct / (r.bespoke_n || 11), 0) / n * 100).toFixed(1)),
    code_pct: Number((rs.reduce((a, r) => a + r.code_passed / (r.code_total || 11), 0) / n * 100).toFixed(1)),
    avg_questions: Number((rs.reduce((a, r) => a + r.qcount, 0) / n).toFixed(1)),
  }
}
log(`code% — ${Object.entries(summary).map(([k, v]) => `${k}: ${v.code_pct}`).join('  |  ')}`)
return { task: 'elicit-batched', arms: A, models: M, N, summary, raw: good }
