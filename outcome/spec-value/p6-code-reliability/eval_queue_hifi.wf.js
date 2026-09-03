export const meta = {
  name: 'queue-factorial-hifi',
  description: 'High-fidelity decomposition on the fiddly message-queue domain. Five arms (baseline / spec / spec+check / spec+discipline / skill), N=10. Scoring separates CRASHED (did not run) from RAN-BUT-MISSED, and pins the test total so the scorer cannot miscount. Answers: does the deterministic CLI check add independent value on a fiddly domain, via robustness or correctness, or is the earlier hint just noise?',
  phases: [
    { title: 'Implement', detail: 'fresh agents write solution.py under each of five wrapper conditions' },
    { title: 'Score', detail: 'run the hidden suite; report ran/crashed and exact passed of a pinned total' },
  ],
}

const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const EVAL_DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/p6-code-reliability/message_queue'
const SKILL_PATH = '/Users/hgarner/code/allium/skills-v4/implement/SKILL.md'
const N = 10
const TOTAL = 4

const PRIMER = `Allium v4 syntax: \`component Name satisfies (x : ContractName)\` with \`entity E\`, \`observable state f(E) : bool\`, and \`invariant name means <predicate>\`. Predicates use implies, and, or, not, =, >=, <=. A bare variable is implicitly quantified.`

const HARNESS = `# harness.py — API reference for an at-least-once message queue (read-only).
class Message:
    id: str; payload: str; processing_ms: int; delivery_count: int
class Sink:
    def apply(self, payload) -> None: ...
class Broker:
    def poll(self): ...                          # lease + return the next message, or None if empty
    def ack(self, receipt) -> bool: ...          # complete + remove; False if the lease expired
    def extend_visibility(self, receipt, ms) -> bool: ...
    def dead_letter(self, receipt) -> None: ...
    def pending(self) -> int: ...
class WorkFailed(Exception): ...                 # work() raises this when processing does not succeed`

const TASK = `Implement \`run(broker, sink, work, clock, max_polls=1000)\` in solution.py. Consume messages and apply each message's payload to the sink, RELIABLY, until broker.pending()==0 or you reach max_polls. work(message) advances the clock and returns None, or raises harness.WorkFailed. Decide what "reliably" requires. solution.py imports from harness.`

const CONTRACT = `-- allium: 4
contract QueueConsumer
  entity Message
  observable state applied(Message) : bool
  observable state deduped(Message) : bool
  observable state acked(Message) : bool
  observable state processed(Message) : bool
  observable state lease_held(Message) : bool
  observable state exhausted(Message) : bool
  observable state dead_lettered(Message) : bool
  guarantee idempotent_apply  means applied(m) implies deduped(m)
  guarantee ack_after_process means acked(m) implies processed(m)
  guarantee apply_under_lease means applied(m) implies lease_held(m)
  guarantee dead_letter_poison means exhausted(m) implies dead_lettered(m)
end`

const DISCIPLINE = `

Use the spec so it never makes your code worse:
1. The spec is a FLOOR, not a ceiling. Do everything a robust implementation needs PLUS everything the spec requires.
2. RECONCILE the code against the spec before finishing: for EACH obligation, point to the line of solution.py that realises it, and fix any that are asserted but not truly implemented.`

const CHECK = `

Before writing Python, capture the contract as an Allium design and check it. ${PRIMER}
Write the contract to contract.allium and your design to design.allium (\`component YourImpl satisfies (x : QueueConsumer)\`, one invariant per obligation). Run \`${ALLIUM} analyse contract.allium design.allium\` and revise until it SATISFIES every obligation. Then implement solution.py to match your design.`

const CONTRACT_BLOCK = `\n\nYou are given the dependency's LIBRARY SPEC — a contract of obligations your consumer must satisfy:\n\n${CONTRACT}\n`

const ARMS = {
  baseline: '',
  spec: `${CONTRACT_BLOCK}\nImplement your solution faithfully to this contract.`,
  check: `${CONTRACT_BLOCK}${CHECK}`,
  discipline: `${CONTRACT_BLOCK}${DISCIPLINE}`,
  skill: `${CONTRACT_BLOCK}\nFollow the Allium v4 ImplementFromSpec skill. READ the skill file at ${SKILL_PATH} and apply its process exactly. ${PRIMER} You may run \`${ALLIUM} analyse contract.allium design.allium\` on a design you write to your temp dir.`,
}

const CODE_SCHEMA = {
  type: 'object',
  properties: { code: { type: 'string', description: 'The complete final contents of solution.py (Python). Imports from harness.' } },
  required: ['code'],
}
const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    ran: { type: 'boolean', description: 'true if the candidate imported and pytest collected all tests; false if an import/collection error made the tests un-runnable' },
    passed: { type: 'integer', description: `number of the ${TOTAL} tests that passed (0 if it did not run)` },
  },
  required: ['ran', 'passed'],
}

function implementPrompt(armKey) {
  return `You are writing a Python module against this read-only API reference, harness.py:

\`\`\`python
${HARNESS}
\`\`\`

${TASK}${ARMS[armKey]}

Work ONLY inside a fresh temp dir you create (mktemp -d). Do NOT search the filesystem for tests or reference solutions. Return the COMPLETE final contents of solution.py in the \`code\` field, code only.`
}

function scorePrompt(code) {
  return `Score a candidate against a hidden test suite. Mechanical, faithful reporting only.
1. D=$(mktemp -d)
2. cp ${EVAL_DIR}/harness.py ${EVAL_DIR}/test_obligations.py "$D"/
3. Write the candidate below to "$D"/solution.py exactly as given.
4. cd "$D" && SOLUTION=solution python3 -m pytest test_obligations.py -q

This suite has EXACTLY ${TOTAL} tests. Report:
- ran = true if pytest collected and executed all ${TOTAL} tests; ran = false ONLY if the candidate failed to import or a collection error stopped the tests running (then passed = 0).
- passed = the exact number of the ${TOTAL} tests that PASSED (read the pytest summary; do not guess).
Do NOT edit anything. Do NOT rewrite the candidate.

Candidate solution.py:
\`\`\`python
${code}
\`\`\``
}

phase('Implement')
const items = []
for (const armKey of Object.keys(ARMS)) for (let i = 0; i < N; i++) items.push({ armKey, i })

const results = await pipeline(
  items,
  ({ armKey, i }) => agent(implementPrompt(armKey), { label: `impl:${armKey}#${i}`, phase: 'Implement', schema: CODE_SCHEMA }),
  (code, { armKey, i }) => {
    if (!code || !code.code) return null
    return agent(scorePrompt(code.code), { label: `score:${armKey}#${i}`, phase: 'Score', schema: SCORE_SCHEMA })
      .then(s => (s ? { armKey, i, ran: !!s.ran, passed: s.passed } : null))
  },
)

const summary = {}
for (const armKey of Object.keys(ARMS)) {
  const rs = results.filter(Boolean).filter(r => r.armKey === armKey)
  const n = rs.length
  const ran = rs.filter(r => r.ran)
  const crashRate = n ? Number(((rs.length - ran.length) / n * 100).toFixed(1)) : 0
  const covAmongRan = ran.length ? Number((ran.reduce((a, r) => a + r.passed / TOTAL, 0) / ran.length * 100).toFixed(1)) : 0
  const covOverall = n ? Number((rs.reduce((a, r) => a + r.passed / TOTAL, 0) / n * 100).toFixed(1)) : 0
  summary[armKey] = { n, ran: ran.length, crash_rate_pct: crashRate, coverage_among_ran_pct: covAmongRan, coverage_overall_pct: covOverall }
}
for (const k of Object.keys(summary)) {
  const s = summary[k]
  log(`${k}: ran ${s.ran}/${s.n}  crash ${s.crash_rate_pct}%  cov(among-ran) ${s.coverage_among_ran_pct}%  cov(overall) ${s.coverage_overall_pct}%`)
}
return { N, TOTAL, summary, raw: results.filter(Boolean) }
