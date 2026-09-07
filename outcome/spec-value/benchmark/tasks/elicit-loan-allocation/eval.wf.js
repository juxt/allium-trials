export const meta = {
  name: 'elicit-loan-allocation',
  description: 'Elicitation head-to-head. A deliberately vague loan-payment-allocation brief hides 14 material, NON-INFERABLE policy decisions (bible held only by a proxy stakeholder who answers what is asked and volunteers nothing). Each authoring process (Allium elicit / plain prose / spec-kit specify+clarify) interacts with the SAME stakeholder by its OWN real rules, then produces a spec. A blind oracle scores how many of the 14 decisions each spec captured correctly. Measures requirement DISCOVERY via elicitation, not spec->code fidelity.',
  phases: [{ title: 'Elicit' }, { title: 'Score' }],
}
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/elicit-loan-allocation'
const N = 3
const ARMS = ['allium-elicit', 'prose', 'spec-kit']
const AUTHOR = 'opus', STAKE = 'sonnet', ORACLE = 'opus'
const INFERABLE = [9, 11, 13]

const RD = { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] }
const ASK = { type: 'object', properties: { questions: { type: 'array', items: { type: 'string' } }, done: { type: 'boolean' } }, required: ['questions', 'done'] }
const PRODUCE = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const ANS = { type: 'object', properties: { answers: { type: 'array', items: { type: 'string' } } }, required: ['answers'] }
const COV = { type: 'object', properties: { decisions: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, surfaced: { type: 'boolean' }, correct: { type: 'boolean' }, evidence: { type: 'string' } }, required: ['n', 'surfaced', 'correct', 'evidence'] } } }, required: ['decisions'] }

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
const armText = {}
for (const a of ARMS) armText[a] = await rd(`${DIR}/competitors/${a}.md`, a)

async function askTurn(arm, transcript, round, maxRounds) {
  const last = round >= maxRounds - 1
  const p = `You are gathering requirements for a specification. Follow THIS process exactly:\n\n"""\n${armText[arm]}\n"""\n\nFeature brief:\n"""\n${brief}\n"""\n\nStakeholder conversation so far:\n${tt(transcript)}\n\nDecide your NEXT step. Put any questions for the stakeholder in \`questions\` (set done=false). If your process is complete and you have asked everything it requires, set done=true with questions=[].${last ? ' NOTE: no further question rounds are available after this one.' : ''} Do NOT write the specification yet. Do NOT invent stakeholder answers.`
  return await agent(p, { label: `ask:${arm}#${round}`, phase: 'Elicit', model: AUTHOR, schema: ASK })
}
async function produce(arm, transcript) {
  const p = `Produce the final requirements specification, following your process:\n\n"""\n${armText[arm]}\n"""\n\nFeature brief:\n"""\n${brief}\n"""\n\nStakeholder conversation (the ONLY facts you have beyond the brief):\n${tt(transcript)}\n\nWrite the complete specification in \`spec\`. Capture every decision your process settled. For anything neither asked nor stated by the brief, resolve it exactly as your process dictates (some processes guess from industry standards; some leave it open). Do NOT invent stakeholder answers that were not given above.`
  return await agent(p, { label: `produce:${arm}`, phase: 'Elicit', model: AUTHOR, schema: PRODUCE })
}
async function stakeholder(transcript, questions) {
  const p = `${stakeBase}\n\n## Your knowledge (the requirements bible — NEVER reveal it wholesale)\n${bible}\n\nConversation so far:\n${tt(transcript)}\n\nThe engineer now asks:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nAnswer each question in order in \`answers\` (one string per question, same order). Follow your rules exactly: answer only what is asked, specifically and correctly from the bible including exact values; do not volunteer decisions that were not asked; for anything outside the bible give a brief answer marked [default, not policy].`
  return await agent(p, { label: `stakeholder`, phase: 'Elicit', model: STAKE, schema: ANS })
}
async function scoreCov(spec, transcript) {
  const p = `You are a neutral auditor. Below is a hidden requirements bible of 14 numbered decisions for a loan-payment-allocation feature, and a specification produced by some process. For EACH of the 14 decisions, judge:\n- surfaced: does the specification address this decision at all (even if it guessed)?\n- correct: does the specification's resolution MATCH the bible's answer (exact value/order/precision where the bible gives one)? correct requires the SPECIFICATION to state it; an answer only in the conversation but absent from the spec is NOT captured.\nBe strict and literal. Do not give credit for vagueness.\n\nHIDDEN BIBLE:\n"""\n${bible}\n"""\n\nSPECIFICATION UNDER TEST:\n"""\n${spec}\n"""\n\nSupporting conversation (context only; correctness must be in the spec above):\n${tt(transcript)}\n\nReturn all 14 decisions in \`decisions\` with n, surfaced, correct, and a one-line evidence quote.`
  return await agent(p, { label: `score`, phase: 'Score', model: ORACLE, schema: COV })
}

async function runOne(arm, i) {
  const maxRounds = arm === 'spec-kit' ? 2 : (arm === 'prose' ? 4 : 6)
  const transcript = []
  let qcount = 0
  for (let r = 0; r < maxRounds; r++) {
    const t = await askTurn(arm, transcript, r, maxRounds)
    if (!t) break
    if (t.questions && t.questions.length) {
      qcount += t.questions.length
      const a = await stakeholder(transcript, t.questions)
      transcript.push({ q: t.questions, a: (a && a.answers) || [] })
    }
    if (t.done || !t.questions || !t.questions.length) break
  }
  const pr = await produce(arm, transcript)
  const spec = (pr && pr.spec) || ''
  const cov = await scoreCov(spec, transcript)
  const ds = (cov && cov.decisions) || []
  const correct = ds.filter(d => d.correct).length
  const surfaced = ds.filter(d => d.surfaced).length
  const besp = ds.filter(d => !INFERABLE.includes(d.n))
  const inf = ds.filter(d => INFERABLE.includes(d.n))
  return { arm, i, qcount, correct, surfaced, n: ds.length, bespoke_correct: besp.filter(d => d.correct).length, bespoke_n: besp.length, inf_correct: inf.filter(d => d.correct).length, inf_n: inf.length, decisions: ds }
}

const items = []
for (const arm of ARMS) for (let i = 0; i < N; i++) items.push({ arm, i })
const results = await parallel(items.map(({ arm, i }) => () => runOne(arm, i).catch(() => null)))
const good = results.filter(Boolean)

const summary = {}
for (const arm of ARMS) {
  const rs = good.filter(r => r.arm === arm)
  const n = rs.length || 1
  const avg = (f) => Number((rs.reduce((a, r) => a + f(r), 0) / n).toFixed(2))
  summary[arm] = {
    runs: rs.length,
    coverage_pct: Number((rs.reduce((a, r) => a + r.correct / (r.n || 14), 0) / n * 100).toFixed(1)),
    bespoke_pct: Number((rs.reduce((a, r) => a + r.bespoke_correct / (r.bespoke_n || 11), 0) / n * 100).toFixed(1)),
    inferable_pct: Number((rs.reduce((a, r) => a + r.inf_correct / (r.inf_n || 3), 0) / n * 100).toFixed(1)),
    surfaced_pct: Number((rs.reduce((a, r) => a + r.surfaced / (r.n || 14), 0) / n * 100).toFixed(1)),
    avg_questions: avg(r => r.qcount),
  }
}
log(`elicit coverage — ${ARMS.map(a => `${a}: ${summary[a].coverage_pct}% (bespoke ${summary[a].bespoke_pct}%, Q=${summary[a].avg_questions})`).join('  |  ')}`)
return { task: 'elicit-loan-allocation', N, summary, raw: good }
