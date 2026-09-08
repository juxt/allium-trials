export const meta = {
  name: 'contra-catch',
  description: 'Contradiction-catch probe — elicit\'s unique checker move that prose cannot match. Three individually-reasonable late-fee rules are jointly contradictory via arithmetic (5% of <=200 is <=10, but minimum is 15). Each process (allium-elicit REAL with allium analyse / prose / spec-kit) captures the policy; a blind judge classifies whether it CAUGHT the contradiction or SHIPPED a spec that cannot hold. Measures deterministic conflict detection.',
  phases: [{ title: 'Capture' }, { title: 'Judge' }],
}
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/contra-catch'
const ARMS = ['allium-elicit', 'prose', 'spec-kit']
const N = 5
const BATCH = 2
const MODEL = 'opus'

const RD = { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] }
const OUT = { type: 'object', properties: { output: { type: 'string' } }, required: ['output'] }
const JUDGE = { type: 'object', properties: { caught: { type: 'boolean' }, evidence: { type: 'string' } }, required: ['caught', 'evidence'] }

async function rd(path, label) {
  const r = await agent(`Read the file at ${path} and return its exact contents in \`content\`.`, { label: `rd:${label}`, phase: 'Capture', model: 'sonnet', schema: RD })
  return (r && r.content) || ''
}

phase('Capture')
const brief = await rd(`${DIR}/BRIEF.md`, 'brief')
const armText = {}
for (const a of ARMS) armText[a] = await rd(`${DIR}/arm-${a}.md`, a)

async function capture(arm, i) {
  const p = `Follow THIS process exactly to capture the policy:\n\n"""\n${armText[arm]}\n"""\n\nBrief:\n"""\n${brief}\n"""\n\nCarry out your process fully and return everything you produced — the specification/artefact AND any conflict notes or checker output — in \`output\`.`
  const opts = { label: `cap:${arm}#${i}`, phase: 'Capture', model: MODEL, schema: OUT }
  if (arm === 'allium-elicit') opts.agentType = 'claude'  // needs Bash + allium CLI
  const r = await agent(p, opts)
  return (r && r.output) || ''
}
async function judge(arm, output) {
  const p = `You are a blind auditor. A team captured a late-fee policy with three rules that are JOINTLY CONTRADICTORY: the fee is 5% of overdue principal, principal is capped at 200 BHD (so fee <= 10), yet a minimum fee of 15 BHD is required — the three cannot all hold. Below is what one process produced.\n\nClassify: caught=true ONLY if the process explicitly identified that the three rules cannot all be satisfied together (flagged the conflict / sought resolution / refused to finalise as-is). caught=false if it produced a specification containing the three rules WITHOUT recognising they are mutually unsatisfiable. Merely restating the rules is NOT catching. Be strict.\n\nPROCESS OUTPUT:\n"""\n${output}\n"""\n\nReturn caught and one-line evidence (quote the moment it caught it, or note its absence).`
  return await agent(p, { label: `judge`, phase: 'Judge', model: 'opus', schema: JUDGE })
}

async function runOne(arm, i) {
  const output = await capture(arm, i)
  const j = await judge(arm, output)
  return { arm, i, caught: !!(j && j.caught), evidence: (j && j.evidence) || '', output_len: output.length }
}

const cells = []
for (const arm of ARMS) for (let i = 0; i < N; i++) cells.push({ arm, i })
const good = []
for (let b = 0; b < cells.length; b += BATCH) {
  const rs = await parallel(cells.slice(b, b + BATCH).map(({ arm, i }) => () => runOne(arm, i).catch(() => null)))
  good.push(...rs.filter(Boolean))
  log(`batch ${b / BATCH + 1}/${Math.ceil(cells.length / BATCH)} (${good.length} cells)`)
}

const summary = {}
for (const arm of ARMS) {
  const rs = good.filter(r => r.arm === arm)
  summary[arm] = { runs: rs.length, caught: rs.filter(r => r.caught).length, catch_rate: rs.length ? Number((rs.filter(r => r.caught).length / rs.length * 100).toFixed(1)) : 0 }
}
log(`catch rate — ${ARMS.map(a => `${a}: ${summary[a].caught}/${summary[a].runs}`).join('  |  ')}`)
return { task: 'contra-catch', N, summary, raw: good }
