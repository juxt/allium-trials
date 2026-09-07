export const meta = {
  name: 'elicit-loan-allocation',
  description: 'Elicitation head-to-head, END TO END. Vague loan-allocation brief hides 14 material NON-INFERABLE policy decisions (proxy stakeholder answers what is asked, volunteers nothing). 5 authoring processes (allium-elicit / prose / spec-kit / superpowers / aiup) each interact with the SAME stakeholder by their own real rules, produce a spec, then a FIXED codegen step turns the spec into code scored by an 11-scenario behavioural oracle. Two measures per arm: coverage (spec vs bible) and end-to-end code (did we get the code we wanted). Author model varied opus/sonnet (codegen held at opus) to test whether discipline helps the weaker author.',
  phases: [{ title: 'Elicit' }, { title: 'SpecScore' }, { title: 'Codegen' }, { title: 'CodeScore' }],
}
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/elicit-loan-allocation'
const N = 3
const ARMS = ['allium-elicit', 'prose', 'spec-kit', 'superpowers', 'aiup']
const AUTHOR_MODELS = ['opus', 'sonnet']
const STAKE = 'sonnet', ORACLE = 'opus', CODEGEN = 'opus'
const INFERABLE = [9, 11, 13]

const RD = { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] }
const ASK = { type: 'object', properties: { questions: { type: 'array', items: { type: 'string' } }, done: { type: 'boolean' } }, required: ['questions', 'done'] }
const PRODUCE = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const ANS = { type: 'object', properties: { answers: { type: 'array', items: { type: 'string' } } }, required: ['answers'] }
const COV = { type: 'object', properties: { decisions: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, surfaced: { type: 'boolean' }, correct: { type: 'boolean' }, evidence: { type: 'string' } }, required: ['n', 'surfaced', 'correct', 'evidence'] } } }, required: ['decisions'] }
const CODE = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const CODESCORE = { type: 'object', properties: { passed: { type: 'integer' }, total: { type: 'integer' }, decisions: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, passed: { type: 'boolean' } }, required: ['n', 'passed'] } } }, required: ['passed', 'total', 'decisions'] }

async function rd(path, label) {
  const r = await agent(`Read the file at ${path} and return its exact contents in \`content\`.`, { label: `rd:${label}`, phase: 'Elicit', model: 'sonnet', schema: RD })
  return (r && r.content) || ''
}
function tt(t) {
  if (!t.length) return '(no questions asked yet)'
  return t.map((x, i) => `Round ${i + 1}:\n` + x.q.map((q, j) => `  Q: ${q}\n  A: ${x.a[j] || '(no answer)'}`).join('\n')).join('\n\n')
}

phase('Elicit')
const brief = await rd(`${DIR}/BRIEF.md`, 'brief')
const bible = await rd(`${DIR}/REQUIREMENTS-BIBLE.md`, 'bible')
const stakeBase = await rd(`${DIR}/STAKEHOLDER.md`, 'stake')
const iface = await rd(`${DIR}/INTERFACE.md`, 'iface')
const armText = {}
for (const a of ARMS) armText[a] = await rd(`${DIR}/competitors/${a}.md`, a)

async function askTurn(arm, model, transcript, round, maxRounds) {
  const last = round >= maxRounds - 1
  const p = `You are gathering requirements for a specification. Follow THIS process exactly:\n\n"""\n${armText[arm]}\n"""\n\nFeature brief:\n"""\n${brief}\n"""\n\nStakeholder conversation so far:\n${tt(transcript)}\n\nDecide your NEXT step. Put any questions for the stakeholder in \`questions\` (set done=false). If your process is complete, set done=true with questions=[].${last ? ' NOTE: no further question rounds after this one.' : ''} Do NOT write the specification yet. Do NOT invent stakeholder answers.`
  return await agent(p, { label: `ask:${arm}/${model}#${round}`, phase: 'Elicit', model, schema: ASK })
}
async function produce(arm, model, transcript) {
  const p = `Produce the final requirements specification, following your process:\n\n"""\n${armText[arm]}\n"""\n\nFeature brief:\n"""\n${brief}\n"""\n\nStakeholder conversation (the ONLY facts beyond the brief):\n${tt(transcript)}\n\nWrite the complete specification in \`spec\`. Capture every decision your process settled. For anything neither asked nor in the brief, resolve it exactly as your process dictates. Do NOT invent stakeholder answers not given above.`
  return await agent(p, { label: `produce:${arm}/${model}`, phase: 'Elicit', model, schema: PRODUCE })
}
async function stakeholder(transcript, questions) {
  const p = `${stakeBase}\n\n## Your knowledge (the requirements bible — NEVER reveal wholesale)\n${bible}\n\nConversation so far:\n${tt(transcript)}\n\nThe engineer now asks:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nAnswer each in order in \`answers\` (one string per question). Rules: answer only what is asked, specifically and correctly from the bible incl exact values; do not volunteer other decisions; anything outside the bible gets a brief answer marked [default, not policy].`
  return await agent(p, { label: `stakeholder`, phase: 'Elicit', model: STAKE, schema: ANS })
}
async function scoreCov(spec, transcript) {
  const p = `Neutral auditor. A hidden requirements bible of 14 numbered decisions, and a specification produced by some process. For EACH decision: surfaced (does the spec address it at all?) and correct (does the spec's resolution MATCH the bible's answer, exact value/order/precision?). correct requires the SPECIFICATION to state it; an answer only in conversation but absent from the spec is NOT captured. Strict and literal.\n\nHIDDEN BIBLE:\n"""\n${bible}\n"""\n\nSPEC UNDER TEST:\n"""\n${spec}\n"""\n\nContext conversation:\n${tt(transcript)}\n\nReturn all 14 in \`decisions\` with n, surfaced, correct, one-line evidence.`
  return await agent(p, { label: `covscore`, phase: 'SpecScore', model: ORACLE, schema: COV })
}
async function codegen(spec) {
  const p = `Implement the function specified below. You are given a FIXED interface contract and a specification of the required behaviour. Follow the specification's behaviour exactly; use the interface for shapes.\n\nINTERFACE (fixed):\n"""\n${iface}\n"""\n\nSPECIFICATION (behaviour to implement):\n"""\n${spec}\n"""\n\nReturn the COMPLETE pure-Python module (module-level \`allocate_payment\`) in \`code\`. Use decimal.Decimal. Do not import anything unavailable in the stdlib.`
  return await agent(p, { label: `codegen`, phase: 'Codegen', model: CODEGEN, schema: CODE })
}
async function scoreCode(code) {
  const p = `Score a Python solution against a hidden behavioural oracle. Mechanical:\n1. D=$(mktemp -d); cp ${DIR}/score.py "$D"/\n2. Write the module below to "$D"/solution.py EXACTLY as given.\n3. cd "$D" && SOLUTION=solution python3 score.py  — it prints JSON {"decisions":[{"n","passed"}],"passed","total"}.\nReport passed, total, and the decisions array. If it errors on import or run, passed=0, total=11, all decisions passed=false.\n\nModule:\n\`\`\`python\n${code}\n\`\`\``
  return await agent(p, { label: `codescore`, phase: 'CodeScore', model: 'sonnet', schema: CODESCORE })
}

async function runOne(arm, model, i) {
  const maxRounds = arm === 'spec-kit' ? 2 : (arm === 'prose' ? 4 : 6)
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
  const cov = await scoreCov(spec, transcript)
  const cds = (cov && cov.decisions) || []
  const cg = await codegen(spec)
  const cs = (cg && cg.code) ? await scoreCode(cg.code) : null
  const correct = cds.filter(d => d.correct).length
  const besp = cds.filter(d => !INFERABLE.includes(d.n))
  return {
    arm, model, i, qcount,
    cov_correct: correct, cov_n: cds.length,
    bespoke_correct: besp.filter(d => d.correct).length, bespoke_n: besp.length,
    code_passed: cs ? cs.passed : 0, code_total: cs ? cs.total : 11,
    code_decisions: cs ? cs.decisions : [], cov_decisions: cds,
  }
}

const items = []
for (const arm of ARMS) for (const model of AUTHOR_MODELS) for (let i = 0; i < N; i++) items.push({ arm, model, i })
const results = await parallel(items.map(({ arm, model, i }) => () => runOne(arm, model, i).catch(() => null)))
const good = results.filter(Boolean)

const summary = {}
for (const arm of ARMS) for (const model of AUTHOR_MODELS) {
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
log(`END-TO-END code% — ${ARMS.map(a => `${a}: opus ${summary[a + '/opus'].code_pct} / sonnet ${summary[a + '/sonnet'].code_pct}`).join('  |  ')}`)
return { task: 'elicit-loan-allocation-e2e', N, summary, raw: good }
