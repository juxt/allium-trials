export const meta = {
  name: 'benchmark-payment-allocation',
  description: 'Anti-vacuity GATE on real Fineract payment-allocation domain (the actual 12-bucket default order: PAST_DUE>DUE>IN_ADVANCE, PENALTY>FEE>PRINCIPAL>INTEREST). Replicates p7 on real domain logic. Each arm gets obligations of the SAME intent — but only V4 states the anti-vacuity OBJECTIVE (a payment must be fully applied while obligations remain); V3 gets safety only (never over-allocate); prose gets a good description. Each arm generates a test suite; does it CATCH a vacuous allocator (allocates nothing — safe but useless) and a wrong-order one? The p7 hypothesis on real code: does the objective make the anti-vacuity test reliable where V3 misses it?',
  phases: [
    { title: 'Generate', detail: 'each arm generates a pytest suite from its obligations' },
    { title: 'Gate', detail: 'run vs correct / vacuous / wrong-order; does it catch each regression?' },
  ],
}

const DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/benchmark/tasks/payment-allocation'
const N = 6

const IFACE = `The implementation under test exposes:
  allocate(payment, owed) -> dict
    payment: int (minor units)
    owed: dict mapping a bucket key (a tuple like ("PAST_DUE","PRINCIPAL")) to the amount owed (int)
    returns: dict mapping bucket key -> amount allocated to it
Tests import: from solution import allocate`

// Same INTENT, three renderings. Only V4 carries the anti-vacuity objective. (This mirrors p7 exactly.)
const SAFETY = `- never allocate more to a bucket than it owes
- never allocate more in total than the payment amount
- allocations follow Fineract's default order: PAST_DUE before DUE before IN_ADVANCE; within each, PENALTY before FEE before PRINCIPAL before INTEREST`

const OBLIGATIONS = {
  prose: `A payment is applied across a borrower's outstanding obligation buckets. Rules:
${SAFETY}
The payment should be applied to obligations, highest priority first, until either the payment or the obligations run out.`,
  v3: `Safety obligations of the allocator:
${SAFETY}`,
  v4: `Safety obligations of the allocator:
${SAFETY}

OBJECTIVE (anti-vacuity): the payment is APPLIED — while any obligation remains unpaid and payment remains, allocation must continue; the total allocated equals min(payment, total owed). An allocator that returns nothing satisfies the safety rules but fails this objective.`,
}

const CODE_SCHEMA = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const GATE_SCHEMA = { type: 'object', properties: {
  passes_correct: { type: 'boolean' },
  catches_vacuous: { type: 'boolean', description: 'suite FAILS against the allocate-nothing port' },
  catches_wrongorder: { type: 'boolean', description: 'suite FAILS against the interest-first (wrong order) port' },
}, required: ['passes_correct', 'catches_vacuous', 'catches_wrongorder'] }

function genPrompt(kind, obligations) {
  return `Generate a thorough pytest suite for a payment allocator. ${IFACE}

Obligations to verify (${kind}):
${obligations}

Return the COMPLETE test_gen.py in \`code\` (code only).`
}

function gatePrompt(code) {
  return `Score a generated pytest suite against three allocator implementations. Mechanical.
Write the suite below to a file SUITE. Then for each port run: python3 ${DIR}/run_suite.py SUITE ${DIR}/port/<p>.py  -> PASS/FAIL/TIMEOUT.
- passes_correct = (correct.py == PASS)
- catches_vacuous = (vacuous.py == FAIL or TIMEOUT)
- catches_wrongorder = (wrongorder.py == FAIL or TIMEOUT)
If the suite does not import, passes_correct=false.

Suite:
\`\`\`python
${code}
\`\`\``
}

phase('Generate')
const items = []
for (const arm of Object.keys(OBLIGATIONS)) for (let i = 0; i < N; i++) items.push({ arm, i })

const results = await pipeline(
  items,
  ({ arm, i }) => agent(genPrompt(arm, OBLIGATIONS[arm]), { label: `gen:${arm}#${i}`, phase: 'Generate', schema: CODE_SCHEMA }),
  (c, { arm, i }) => (c && c.code
    ? agent(gatePrompt(c.code), { label: `gate:${arm}#${i}`, phase: 'Gate', schema: GATE_SCHEMA }).then(r => (r ? { arm, i, ...r } : null))
    : null),
)

const summary = {}
for (const arm of Object.keys(OBLIGATIONS)) {
  const rs = results.filter(Boolean).filter(r => r.arm === arm)
  const n = rs.length || 1
  summary[arm] = {
    n: rs.length,
    catches_vacuous_pct: Number((rs.filter(r => r.catches_vacuous).length / n * 100).toFixed(1)),
    catches_wrongorder_pct: Number((rs.filter(r => r.catches_wrongorder).length / n * 100).toFixed(1)),
    passes_correct_pct: Number((rs.filter(r => r.passes_correct).length / n * 100).toFixed(1)),
  }
}
log(`payment-allocation catches-vacuous  prose ${summary.prose.catches_vacuous_pct}  v3 ${summary.v3.catches_vacuous_pct}  v4 ${summary.v4.catches_vacuous_pct}`)
return { task: 'payment-allocation', N, summary, raw: results.filter(Boolean) }
