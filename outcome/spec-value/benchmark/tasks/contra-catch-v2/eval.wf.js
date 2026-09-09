export const meta = {
  name: 'contra-catch-v2',
  description: 'Buried-contradiction probe. 10 plausible credit-card policy rules; a 3-rule conflicting core (fee=2% of limit, limit<=5000 => fee<=100, yet fee>=150) is scattered non-adjacently among them. Each process (allium-elicit REAL with allium analyse / prose / spec-kit) captures the policy; a blind judge scores CAUGHT vs SHIPPED. Run on Opus AND Sonnet. Prediction: prose misses the buried triple more as spec grows / model weakens; analyse finds the minimal core mechanically regardless.',
  phases: [{ title: 'Capture' }, { title: 'Judge' }],
}
const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/contra-catch-v2'
const ARMS = ['allium-elicit', 'prose', 'spec-kit']
const MODELS = (args && args.models) || ['opus', 'sonnet']
const N = (args && args.N) || 5
const BATCH = 2

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

async function capture(arm, model, i) {
  const p = `Follow THIS process exactly to capture the policy:\n\n"""\n${armText[arm]}\n"""\n\nBrief:\n"""\n${brief}\n"""\n\nCarry out your process fully and return everything you produced — the specification/artefact AND any conflict notes or checker output — in \`output\`.`
  const opts = { label: `cap:${arm}/${model}#${i}`, phase: 'Capture', model, schema: OUT }
  if (arm === 'allium-elicit') opts.agentType = 'claude'  // needs Bash + allium CLI
  const r = await agent(p, opts)
  return (r && r.output) || ''
}
async function judge(output) {
  const p = `You are a blind auditor. A team captured a credit-card policy. Buried in it are three rules that are JOINTLY CONTRADICTORY: the annual fee is 2% of the credit limit, the credit limit is at most 5000 BHD (so the fee is at most 100), yet the annual fee must be at least 150 BHD — impossible together. Below is what one process produced.\n\nClassify: caught=true ONLY if the process explicitly identified that these rules cannot all hold together (flagged the specific conflict / sought resolution / refused to finalise). caught=false if it produced a spec containing the rules WITHOUT recognising the contradiction. Merely restating the rules is NOT catching. Be strict.\n\nPROCESS OUTPUT:\n"""\n${output}\n"""\n\nReturn caught and one-line evidence.`
  return await agent(p, { label: `judge`, phase: 'Judge', model: 'opus', schema: JUDGE })
}

async function runOne(arm, model, i) {
  const output = await capture(arm, model, i)
  const j = await judge(output)
  return { arm, model, i, caught: !!(j && j.caught), evidence: (j && j.evidence) || '', output_len: output.length }
}

const cells = []
for (const arm of ARMS) for (const model of MODELS) for (let i = 0; i < N; i++) cells.push({ arm, model, i })
const good = []
for (let b = 0; b < cells.length; b += BATCH) {
  const rs = await parallel(cells.slice(b, b + BATCH).map(({ arm, model, i }) => () => runOne(arm, model, i).catch(() => null)))
  good.push(...rs.filter(Boolean))
  log(`batch ${b / BATCH + 1}/${Math.ceil(cells.length / BATCH)} (${good.length} cells)`)
}

const summary = {}
for (const arm of ARMS) for (const model of MODELS) {
  const rs = good.filter(r => r.arm === arm && r.model === model)
  summary[`${arm}/${model}`] = { runs: rs.length, caught: rs.filter(r => r.caught).length, catch_rate: rs.length ? Number((rs.filter(r => r.caught).length / rs.length * 100).toFixed(1)) : 0 }
}
log(`catch — ${Object.entries(summary).map(([k, v]) => `${k}: ${v.caught}/${v.runs}`).join('  |  ')}`)
return { task: 'contra-catch-v2', N, summary, raw: good }
