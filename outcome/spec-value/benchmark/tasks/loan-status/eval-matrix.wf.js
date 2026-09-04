export const meta = {
  name: 'benchmark-loan-status-matrix',
  description: 'MATRIX reconstruct task on real Fineract LoanStatus. Reconstruct the 14 boolean predicates over 12 states from a spec (hidden source). 4 arms (none/prose/v3/v4) x 2 models. The non-inferable quirk: isClosed() EXCLUDES OVERPAID/REJECTED/WITHDRAWN (terminal but not "closed"), isActiveOrAwaitingApprovalOrDisbursal = approved|pending|active, isUnderTransfer = the two transfer states. A no-spec arm must GUESS predicate membership; the natural guess (isClosed = any terminal state) is wrong. Graded oracle: 168 real golden (state,predicate)->bool. Tests whether the spec pins non-inferable state-machine conventions.',
  phases: [
    { title: 'Distil', detail: 'author the 3 fixed specs from the real source, once' },
    { title: 'Reconstruct', detail: '4 arms x 2 models rebuild evaluate(status,predicate) from their spec (or names only)' },
    { title: 'Score', detail: 'graded vs 168 real golden' },
  ],
}

const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/loan-status'
const JAVA = `${DIR}/original/LoanStatus.java`
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const N = 3
const MODELS = ['opus', 'sonnet']
const STATES = 'INVALID, SUBMITTED_AND_PENDING_APPROVAL, APPROVED, ACTIVE, TRANSFER_IN_PROGRESS, TRANSFER_ON_HOLD, WITHDRAWN_BY_CLIENT, REJECTED, CLOSED_OBLIGATIONS_MET, CLOSED_WRITTEN_OFF, CLOSED_RESCHEDULE_OUTSTANDING_AMOUNT, OVERPAID'
const PREDS = 'isSubmittedAndPendingApproval, isApproved, isActive, isClosed, isClosedObligationsMet, isClosedWrittenOff, isClosedWithOutsandingAmountMarkedForReschedule, isWithdrawnByClient, isRejected, isActiveOrAwaitingApprovalOrDisbursal, isTransferInProgress, isTransferOnHold, isUnderTransfer, isOverpaid'
const API = `Expose exactly: def evaluate(status: str, predicate: str) -> bool\n  status is a state NAME (one of: ${STATES})\n  predicate is one of: ${PREDS}`

const DISTIL = {
  prose: `Read the real Java at ${JAVA}. Write a PRECISE prose spec of the LoanStatus state machine: for each boolean predicate, exactly which states it returns true for (capture every rule, including the surprising ones). Return it in \`spec\`.`,
  v3: `Read the real Java at ${JAVA}. Distil an Allium v3 spec of LoanStatus — the states and the exact membership of each predicate. Return the v3 spec in \`spec\`.`,
  v4: `Read the real Java at ${JAVA}. Distil an Allium v4 spec of LoanStatus — states and the exact state-set each predicate holds for. You may run \`${ALLIUM} analyse\`. Return the v4 spec in \`spec\`.`,
}
const SPEC_SCHEMA = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const CODE_SCHEMA = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const SCORE_SCHEMA = { type: 'object', properties: { matched: { type: 'integer' }, total: { type: 'integer' } }, required: ['matched', 'total'] }

function reconstructPrompt(arm, spec) {
  const g = arm === 'none'
    ? `You are reimplementing Fineract's LoanStatus predicates in Python. You have ONLY the state list and predicate names below — infer each predicate's membership as best you can.`
    : `Reimplement Fineract's LoanStatus predicates in Python, guided by this ${arm} specification. Follow it exactly.\n\nSpecification:\n"""\n${spec}\n"""`
  return `${g}\n\n${API}\n\nReturn the COMPLETE Python module in \`code\`.`
}
function scorePrompt(code) {
  return `Score a Python reconstruction of LoanStatus. Mechanical.
1. D=$(mktemp -d); cp ${DIR}/golden.json ${DIR}/score.py "$D"/
2. Write the module below to "$D"/solution.py exactly as given.
3. cd "$D" && SOLUTION=solution python3 score.py -> "matched/total". Report both. If import errors, matched=0.

Module:
\`\`\`python
${code}
\`\`\``
}

phase('Distil')
const specs = { none: '' }
const distilled = await parallel(Object.keys(DISTIL).map(arm => () =>
  agent(DISTIL[arm], { label: `distil:${arm}`, phase: 'Distil', schema: SPEC_SCHEMA }).then(s => ({ arm, spec: s && s.spec }))))
for (const d of distilled.filter(Boolean)) specs[d.arm] = d.spec || ''

phase('Reconstruct')
const items = []
for (const arm of ['none', 'prose', 'v3', 'v4']) for (const model of MODELS) for (let i = 0; i < N; i++) items.push({ arm, model, i })

const results = await pipeline(
  items,
  ({ arm, model, i }) => agent(reconstructPrompt(arm, specs[arm]), { label: `build:${arm}/${model}#${i}`, phase: 'Reconstruct', model, schema: CODE_SCHEMA }),
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
log(`loan-status-matrix  opus[none ${summary['none/opus'].score_pct} prose ${summary['prose/opus'].score_pct} v3 ${summary['v3/opus'].score_pct} v4 ${summary['v4/opus'].score_pct}]  sonnet[none ${summary['none/sonnet'].score_pct} prose ${summary['prose/sonnet'].score_pct} v3 ${summary['v3/sonnet'].score_pct} v4 ${summary['v4/sonnet'].score_pct}]`)
return { task: 'loan-status-matrix', N, summary, raw: results.filter(Boolean) }
