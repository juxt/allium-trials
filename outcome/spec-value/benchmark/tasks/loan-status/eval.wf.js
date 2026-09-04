export const meta = {
  name: 'benchmark-loan-status',
  description: 'BEHAVIOURAL real-code differential task. Distil a spec from real Fineract LoanStatus.java (loan-lifecycle state machine, 14 boolean predicates over 12 states), hide it, reconstruct in Python from the spec alone, score against 168 golden (state,predicate)->bool pairs from the real enum. The non-obvious quirk: isClosed() excludes OVERPAID/REJECTED/WITHDRAWN (terminal but not "closed"). Does a structured spec preserve the quirk a prose spec might smooth over? NOTE: all-false baseline already scores 149/168 — discrimination is in the true assignments + the quirks.',
  phases: [
    { title: 'Distil', detail: 'each arm distils a spec of the state machine from the real Java' },
    { title: 'Reconstruct', detail: 'fresh agent rebuilds evaluate(status,predicate) in Python from the SPEC only' },
    { title: 'Score', detail: 'differential vs 168 real golden outcomes' },
  ],
}

const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/loan-status'
const JAVA = `${DIR}/original/LoanStatus.java`
const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const N = 3
const PREDS = 'isSubmittedAndPendingApproval, isApproved, isActive, isClosed, isClosedObligationsMet, isClosedWrittenOff, isClosedWithOutsandingAmountMarkedForReschedule, isWithdrawnByClient, isRejected, isActiveOrAwaitingApprovalOrDisbursal, isTransferInProgress, isTransferOnHold, isUnderTransfer, isOverpaid'

const DISTIL = {
  prose: `Read the real Java file at ${JAVA}. Write a PRECISE prose specification of the LoanStatus state machine: the states, and for each of the boolean query methods, exactly which states it returns true for. Capture every rule faithfully, including any that is surprising. Write a SPECIFICATION, not a verbatim code copy. Return it in \`spec\`.`,
  v3: `Read the real Java file at ${JAVA}. Distil an Allium v3 specification of the LoanStatus state machine — the states and the exact membership of each boolean predicate. Return the v3 spec text in \`spec\`.`,
  v4: `Read the real Java file at ${JAVA}. Distil an Allium v4 specification of the LoanStatus state machine — states, and the exact set of states each predicate holds for. You may write it to a temp file and run \`${ALLIUM} analyse <file>\`. Return the v4 spec text in \`spec\`.`,
}

const SPEC_SCHEMA = { type: 'object', properties: { spec: { type: 'string' } }, required: ['spec'] }
const CODE_SCHEMA = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const SCORE_SCHEMA = { type: 'object', properties: { matched: { type: 'integer' }, total: { type: 'integer' }, quirk_ok: { type: 'boolean', description: 'isClosed returns False for OVERPAID, REJECTED and WITHDRAWN_BY_CLIENT' } }, required: ['matched', 'total'] }

function reconstructPrompt(kind, spec) {
  return `Below is a ${kind} specification of the LoanStatus state machine. Reconstruct it in Python. You do NOT have the original source — work only from this spec.

Expose exactly: \`def evaluate(status: str, predicate: str) -> bool\` where status is a state NAME (e.g. "OVERPAID", "ACTIVE", "CLOSED_OBLIGATIONS_MET") and predicate is one of: ${PREDS}.

Specification:
"""
${spec}
"""

Return the COMPLETE Python module in \`code\`.`
}

function scorePrompt(code) {
  return `Score a Python reconstruction of LoanStatus against real golden values. Mechanical.
1. D=$(mktemp -d); cp ${DIR}/golden.json ${DIR}/score.py "$D"/
2. Write the module below to "$D"/solution.py exactly as given.
3. cd "$D" && SOLUTION=solution python3 score.py  -> prints "matched/total".
Also report quirk_ok = whether the module returns False for evaluate("OVERPAID","isClosed"), evaluate("REJECTED","isClosed") and evaluate("WITHDRAWN_BY_CLIENT","isClosed"). If it errors, matched=0.

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
  (s, { arm, i }) => (s && s.spec ? agent(reconstructPrompt(arm, s.spec), { label: `rebuild:${arm}#${i}`, phase: 'Reconstruct', schema: CODE_SCHEMA }) : null),
  (c, { arm, i }) => (c && c.code
    ? agent(scorePrompt(c.code), { label: `score:${arm}#${i}`, phase: 'Score', schema: SCORE_SCHEMA }).then(r => (r ? { arm, i, ...r } : null))
    : null),
)

const summary = {}
for (const arm of Object.keys(DISTIL)) {
  const rs = results.filter(Boolean).filter(r => r.arm === arm)
  const n = rs.length || 1
  summary[arm] = {
    n: rs.length,
    fidelity_pct: Number((rs.reduce((a, r) => a + (r.total ? r.matched / r.total : 0), 0) / n * 100).toFixed(1)),
    quirk_ok_pct: Number((rs.filter(r => r.quirk_ok).length / n * 100).toFixed(1)),
  }
}
log(`loan-status  fidelity  prose ${summary.prose.fidelity_pct} v3 ${summary.v3.fidelity_pct} v4 ${summary.v4.fidelity_pct} | quirk_ok prose ${summary.prose.quirk_ok_pct} v3 ${summary.v3.quirk_ok_pct} v4 ${summary.v4.quirk_ok_pct}`)
return { task: 'loan-status', N, summary, raw: results.filter(Boolean) }
