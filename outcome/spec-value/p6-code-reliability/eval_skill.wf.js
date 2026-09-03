export const meta = {
  name: 'implement-from-spec-skill-eval',
  description: 'Evaluate the ImplementFromSpec v4 skill. Three wrapper conditions (baseline no-spec / naive read-then-code / the actual skill) implement a Python consumer against a library spec; a hidden test suite scores each. Two domains: message queue (tests never-worse) and sorted store (tests the library-spec value). The skill must be never worse than baseline AND capture the value a naive wrapper leaks.',
  phases: [
    { title: 'Implement', detail: 'fresh agents write solution.py under each wrapper, on each domain' },
    { title: 'Score', detail: 'hidden test suite scores each solution per obligation' },
  ],
}

const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const BASE = '/Users/hgarner/code/allium-trials/outcome/spec-value/p6-code-reliability'
const SKILL_PATH = '/Users/hgarner/code/allium/skills-v4/implement/SKILL.md'
const N = 4

const PRIMER = `Allium v4 syntax: \`component Name satisfies (x : ContractName)\` with \`entity E\`, \`observable state f(E) : bool\` (or \`: Number\`), and \`invariant name means <predicate>\`. Predicates use implies, and, or, not, =, >=, <=. A bare variable is implicitly quantified.`

const QUEUE_HARNESS = `# harness.py — API reference for an at-least-once message queue (read-only).
class Clock:
    def __init__(self): self.now = 0
    def advance(self, ms): self.now += ms
class Message:
    id: str; payload: str; processing_ms: int; delivery_count: int   # id, payload, processing time, times polled
class Receipt:
    message: 'Message'; deadline: int; delivery_count: int
class Sink:
    def apply(self, payload) -> None: ...        # the downstream effect
class Broker:
    def poll(self): ...                          # lease + return the next message, or None if the queue is empty
    def ack(self, receipt) -> bool: ...          # complete + remove; False if the lease expired
    def extend_visibility(self, receipt, ms) -> bool: ...   # set the lease to expire ms from now
    def dead_letter(self, receipt) -> None: ...  # move the message to the dead-letter queue
    def pending(self) -> int: ...                # messages still on the queue
class WorkFailed(Exception): ...                 # work() raises this when processing does not succeed
`

const STORE_HARNESS = `# harness.py — API reference for a sorted-segment key/value store (read-only).
class Batch: ...                                 # opaque handle from open_batch()
class Store:
    def open_batch(self) -> Batch: ...           # start a new batch to write into
    def write(self, batch, key: int, value: str) -> None: ...   # add a key/value pair to the batch
    def commit(self, batch) -> None: ...         # persist the batch as a segment
    def get(self, key: int): ...                 # value for key, or None. Searches segments newest-first
`

const METRIC_HARNESS = `# harness.py — API reference for a time-series metric store (read-only).
class Store:
    def create_series(self, name: str) -> None: ...          # register a series
    def append(self, series: str, t: int, value: float) -> None: ...  # append a (t, value) point to a series
    def read(self, series: str) -> list: ...                 # the (t, value) points stored for a series, in append order
`

const DOMAINS = [
  {
    name: 'message_queue',
    evalDir: `${BASE}/message_queue`,
    harness: QUEUE_HARNESS,
    total: 4,
    task: `Implement \`run(broker, sink, work, clock, max_polls=1000)\` in solution.py. Consume messages and apply each message's payload to the sink, RELIABLY, until broker.pending()==0 or you reach max_polls. Call work(message) to process a message; it advances the clock and returns None, or raises harness.WorkFailed. Decide what "reliably" requires. solution.py imports from harness.`,
    contract: `-- allium: 4
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
end`,
  },
  {
    name: 'sorted_store',
    evalDir: `${BASE}/sorted_store`,
    harness: STORE_HARNESS,
    total: 2,
    task: `Implement \`run(store, items)\` in solution.py. items is a list of (key, value) pairs (key int, value str; keys distinct unless noted). Persist every item so store.get(key) returns its value for each. Decide what persisting them correctly requires. solution.py imports from harness.`,
    contract: `-- allium: 4
contract SortedStore
  entity Batch
  observable state committed(Batch) : bool
  observable state keys_ascending(Batch) : bool
  observable state entry_count(Batch) : Number
  guarantee sorted_input   means committed(b) implies keys_ascending(b)
  guarantee capacity_bound means committed(b) implies entry_count(b) <= 4
end`,
  },
  {
    name: 'metric_store',
    evalDir: `${BASE}/metric_store`,
    harness: METRIC_HARNESS,
    total: 2,
    task: `Implement \`run(store, points)\` in solution.py. points is a list of (series, t, value) triples (series str, t int, value float). Persist every point so store.read(series) contains all points for that series. Decide what persisting them correctly requires. solution.py imports from harness.`,
    contract: `-- allium: 4
contract MetricStore
  entity Point
  observable state appended(Point) : bool
  observable state series_created(Point) : bool
  observable state time_monotonic(Point) : bool
  guarantee create_before_append means appended(p) implies series_created(p)
  guarantee monotonic_time       means appended(p) implies time_monotonic(p)
end`,
  },
]

const ARMS = {
  baseline: (d) => '',
  naive: (d) => `\n\nYou are given the dependency's LIBRARY SPEC — a contract of obligations your consumer must satisfy:\n\n${d.contract}\n\nImplement your solution faithfully to this contract.`,
  skill: (d) => `\n\nYou are given the dependency's LIBRARY SPEC — a contract of obligations your consumer must satisfy:\n\n${d.contract}\n\nFollow the Allium v4 ImplementFromSpec skill to implement from this contract. READ the skill file at ${SKILL_PATH} and apply its process exactly: enumerate the obligations, treat the spec as a FLOOR not a ceiling, and RECONCILE every obligation into the code (cite the line that realises each; fix any that are asserted but not implemented) before finishing. ${PRIMER} You may write the contract and a design to your temp dir and run \`${ALLIUM} analyse contract.allium design.allium\` to confirm your design SATISFIES every obligation.`,
}

const CODE_SCHEMA = {
  type: 'object',
  properties: { code: { type: 'string', description: 'The complete final contents of solution.py (Python). Imports from harness.' } },
  required: ['code'],
}
const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    passed: { type: 'integer', description: 'number of obligation tests that passed' },
    total: { type: 'integer', description: 'total obligation tests run' },
    detail: { type: 'string', description: 'per-test pass/fail, one line' },
  },
  required: ['passed', 'total'],
}

function implementPrompt(d, armKey) {
  return `You are writing a Python module against this read-only API reference, harness.py:

\`\`\`python
${d.harness}
\`\`\`

${d.task}${ARMS[armKey](d)}

Work ONLY inside a fresh temp dir you create (mktemp -d). Do NOT search the filesystem for tests or reference solutions — there are none for you to find, and using them invalidates the experiment. Return the COMPLETE final contents of solution.py in the \`code\` field, code only.`
}

function scorePrompt(d, code) {
  return `Score a candidate implementation against a hidden test suite. Mechanical, faithful reporting only.
1. D=$(mktemp -d)
2. cp ${d.evalDir}/harness.py ${d.evalDir}/test_obligations.py "$D"/
3. Write the candidate below to "$D"/solution.py exactly as given.
4. cd "$D" && SOLUTION=solution python3 -m pytest test_obligations.py -q
5. Report passed = number of tests that passed, total = number collected. Put per-test PASS/FAIL in detail. If it fails to import or all error, passed=0.
Do NOT edit the harness, tests, or candidate. Report exactly what pytest says.

Candidate solution.py:
\`\`\`python
${code}
\`\`\``
}

// args may name a subset of domains to run (string or array); default is all.
const wanted = args ? (Array.isArray(args) ? args : [args]) : null
const RUN_DOMAINS = wanted ? DOMAINS.filter(d => wanted.includes(d.name)) : DOMAINS

phase('Implement')
const items = []
for (const d of RUN_DOMAINS) for (const armKey of Object.keys(ARMS)) for (let i = 0; i < N; i++) items.push({ d, armKey, i })

const results = await pipeline(
  items,
  ({ d, armKey, i }) => agent(implementPrompt(d, armKey), { label: `impl:${d.name}:${armKey}#${i}`, phase: 'Implement', schema: CODE_SCHEMA }),
  (code, { d, armKey, i }) => {
    if (!code || !code.code) return null
    return agent(scorePrompt(d, code.code), { label: `score:${d.name}:${armKey}#${i}`, phase: 'Score', schema: SCORE_SCHEMA })
      .then(s => (s ? { domain: d.name, armKey, i, passed: s.passed, total: s.total } : null))
  },
)

const summary = {}
for (const d of RUN_DOMAINS) {
  summary[d.name] = {}
  for (const armKey of Object.keys(ARMS)) {
    const rs = results.filter(Boolean).filter(r => r.domain === d.name && r.armKey === armKey)
    const n = rs.length
    const cov = n ? rs.reduce((a, r) => a + (r.total ? r.passed / r.total : 0), 0) / n : 0
    summary[d.name][armKey] = { n, coverage_pct: Number((cov * 100).toFixed(1)) }
  }
  const s = summary[d.name]
  log(`${d.name}: base ${s.baseline.coverage_pct}  naive ${s.naive.coverage_pct}  skill ${s.skill.coverage_pct}`)
}
return { N, summary, raw: results.filter(Boolean) }
