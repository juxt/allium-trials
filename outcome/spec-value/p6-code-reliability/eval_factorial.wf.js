export const meta = {
  name: 'code-reliability-factorial',
  description: 'Decompose the library-spec uplift. Five arms — baseline / spec-only / spec+check / spec+discipline / spec+check+discipline(skill) — implement a Python consumer; a hidden test suite scores each. Splits the deterministic CLI check from the floor/reconcile discipline, over the explicit spec. Domains selectable via args.',
  phases: [
    { title: 'Implement', detail: 'fresh agents write solution.py under each of five wrapper conditions' },
    { title: 'Score', detail: 'hidden test suite scores each solution per obligation' },
  ],
}

const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const BASE = '/Users/hgarner/code/allium-trials/outcome/spec-value/p6-code-reliability'
const SKILL_PATH = '/Users/hgarner/code/allium/skills-v4/implement/SKILL.md'
const N = 4

const PRIMER = `Allium v4 syntax: \`component Name satisfies (x : ContractName)\` with \`entity E\`, \`observable state f(E) : bool\` (or \`: Number\`), and \`invariant name means <predicate>\`. Predicates use implies, and, or, not, =, >=, <=. A bare variable is implicitly quantified.`

const QUEUE_HARNESS = `# harness.py — API reference for an at-least-once message queue (read-only).
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

const READER_HARNESS = `# harness.py — API reference for a paginated record source (read-only).
class Page:
    records: list        # record ids on this page
    next_cursor: str | None   # cursor for the next page; None on the last page
class Source:
    def fetch(self, cursor): ...     # Page for this cursor; pass None for the first page
class Sink:
    def add(self, record) -> None: ...   # collect a record`

const METRIC_HARNESS = `# harness.py — API reference for a time-series metric store (read-only).
class Store:
    def create_series(self, name: str) -> None: ...
    def append(self, series: str, t: int, value: float) -> None: ...
    def read(self, series: str) -> list: ...`

const DOMAINS = [
  {
    name: 'message_queue',
    evalDir: `${BASE}/message_queue`,
    harness: QUEUE_HARNESS,
    total: 4,
    task: `Implement \`run(broker, sink, work, clock, max_polls=1000)\` in solution.py. Consume messages and apply each message's payload to the sink, RELIABLY, until broker.pending()==0 or you reach max_polls. work(message) advances the clock and returns None, or raises harness.WorkFailed. Decide what "reliably" requires. solution.py imports from harness.`,
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
    name: 'paged_reader',
    evalDir: `${BASE}/paged_reader`,
    harness: READER_HARNESS,
    total: 2,
    task: `Implement \`run(source, sink)\` in solution.py. Read every record the source holds into the sink via sink.add(record). Pass None to source.fetch for the first page. Decide what reading them correctly requires. solution.py imports from harness.`,
    contract: `-- allium: 4
contract PagedReader
  entity Record
  observable state collected(Record) : bool
  observable state from_all_pages(Record) : bool
  observable state deduped(Record) : bool
  guarantee reads_all_pages means collected(r) implies from_all_pages(r)
  guarantee dedupes means collected(r) implies deduped(r)
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

const DISCIPLINE = `

Use the spec so it never makes your code worse:
1. The spec is a FLOOR, not a ceiling. Do everything a robust implementation needs PLUS everything the spec requires; never let specifying narrow your implementation.
2. RECONCILE the code against the spec before finishing: for EACH obligation, point to the line of solution.py that realises it in behaviour, and fix any that are asserted but not truly implemented.`

const checkInstr = (d) => `

Before writing Python, capture the contract as an Allium design and check it. ${PRIMER}
Write the contract above to contract.allium and your design to design.allium (\`component YourImpl satisfies (x : ${d.contract.match(/contract (\w+)/)[1]})\`, one invariant per obligation). Run \`${ALLIUM} analyse contract.allium design.allium\` and revise your design until it SATISFIES every obligation. Then implement solution.py to match your design.`

const contractBlock = (d) => `\n\nYou are given the dependency's LIBRARY SPEC — a contract of obligations your consumer must satisfy:\n\n${d.contract}\n`

// Five conditions. baseline: no spec. spec: explicit contract only. check: contract + the deterministic
// CLI check (analyse), no discipline prose. discipline: contract + floor/reconcile prose, no CLI. skill:
// contract + read the shipped skill (which has both). check vs discipline isolates the two causes.
const ARMS = {
  baseline: (d) => '',
  spec: (d) => `${contractBlock(d)}\nImplement your solution faithfully to this contract.`,
  check: (d) => `${contractBlock(d)}${checkInstr(d)}`,
  discipline: (d) => `${contractBlock(d)}${DISCIPLINE}`,
  skill: (d) => `${contractBlock(d)}\nFollow the Allium v4 ImplementFromSpec skill to implement from this contract. READ the skill file at ${SKILL_PATH} and apply its process exactly. ${PRIMER} You may run \`${ALLIUM} analyse contract.allium design.allium\` on a design you write to your temp dir.`,
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
5. Report passed = number of tests that passed, total = number collected. If it fails to import or all error, passed=0.
Do NOT edit the harness, tests, or candidate.

Candidate solution.py:
\`\`\`python
${code}
\`\`\``
}

const wanted = args ? (Array.isArray(args) ? args : [args]) : ['message_queue', 'paged_reader']
const RUN_DOMAINS = DOMAINS.filter(d => wanted.includes(d.name))

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
  log(`${d.name}: base ${s.baseline.coverage_pct}  spec ${s.spec.coverage_pct}  check ${s.check.coverage_pct}  discipline ${s.discipline.coverage_pct}  skill ${s.skill.coverage_pct}`)
}
return { N, summary, raw: results.filter(Boolean) }
