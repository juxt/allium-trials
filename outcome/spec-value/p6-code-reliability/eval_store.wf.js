export const meta = {
  name: 'code-reliability-eval-store',
  description: 'Bespoke-domain code-reliability eval. Does the library-spec feature produce more reliable code when the obligations are NON-INFERABLE from the API? Sorted-segment store: keys must be written ascending, and a batch has a hidden capacity. Three arms (no-Allium / Allium / Allium+library-spec) each write a Python consumer; a hidden test suite scores it per obligation.',
  phases: [
    { title: 'Implement', detail: 'fresh agents write solution.py against an API stub; A task-only, B specifies+checks a design, C references the library spec' },
    { title: 'Score', detail: 'run the hidden test suite against each solution; 0-2 obligations pass' },
  ],
}

const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const EVAL_DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/p6-code-reliability/sorted_store'
const N = 5

// API stub only — signatures and neutral docstrings, NO implementation bodies. The real simulator
// (with the capacity limit and the sorted-lookup) stays hidden; implementers cannot read the hidden
// behaviour out of it, nor discover it by running the real store.
const HARNESS = `# harness.py — API reference for the sorted-segment store (read-only).
# A batch collects writes; commit persists it as a segment; get looks a key up across segments.

class Batch:
    """Opaque handle returned by open_batch()."""

class Store:
    def open_batch(self) -> Batch:
        """Start a new batch to write into."""
    def write(self, batch: Batch, key: int, value: str) -> None:
        """Add a key/value pair to the batch."""
    def commit(self, batch: Batch) -> None:
        """Persist the batch as a segment."""
    def get(self, key: int):
        """Return the value for key, or None if not found. Searches segments newest-first."""
`

const TASK = `Implement the function \`run(store, items)\` in a module solution.py.
\`items\` is a list of (key, value) pairs — key is an int, value is a str; keys are distinct unless
noted. Persist every item so that after run returns, \`store.get(key)\` returns that item's value for
every item. solution.py must import from harness. Nothing else is specified for you: decide what
persisting them correctly requires.`

const PRIMER = `Allium v4 syntax you need:
  component Name satisfies (s : ContractName)   -- omit the satisfies clause if not referencing a contract
    entity E
    observable state f(E) : bool
    observable state n(E) : Number
    invariant inv_name means <predicate>        -- holds in every reachable state; variables implicitly universally quantified
  end
Predicates use: implies, and, or, not, =, >=, <=. A bare variable like b is implicitly quantified.`

const CONTRACT = `-- allium: 4
contract SortedStore
  entity Batch
  observable state committed(Batch) : bool
  observable state keys_ascending(Batch) : bool
  observable state entry_count(Batch) : Number
  guarantee sorted_input   means committed(b) implies keys_ascending(b)
  guarantee capacity_bound means committed(b) implies entry_count(b) <= 4
end`

const DISCIPLINE = `

CRITICAL — how to use the spec so it never makes your code worse:
1. The spec is a FLOOR, not a ceiling. It names properties you MUST guarantee; it does not excuse you from every other thing a robust implementation needs. Do everything you would normally do to make this correct, PLUS everything the spec requires.
2. RECONCILE the code against the spec before you finish (the weed step). For EACH invariant/obligation in your Allium spec, point to the exact line(s) of solution.py that actually realise it in behaviour. If any obligation is stated in the spec but not truly implemented, FIX THE CODE. Do not return until every obligation is realised in the code, not merely asserted in the spec.`

const ARMS = {
  A: { label: 'no-allium', extra: '' },
  B: {
    label: 'allium',
    extra: `\n\nBEFORE writing Python, design your consumer as an Allium v4 behavioural specification and check it.
${PRIMER}
Write your design to design.allium and run \`${ALLIUM} check design.allium\`. Fix anything it reports.
Let the discipline of specifying and checking your design inform the implementation. Then implement solution.py.${DISCIPLINE}`,
  },
  C: {
    label: 'allium+libspec',
    extra: `\n\nBEFORE writing Python, you are given the store's LIBRARY SPEC — a contract of the obligations your consumer must satisfy:

${CONTRACT}

Design your consumer as an Allium v4 spec that references this contract.
${PRIMER}
Write the contract above to contract.allium and your design to design.allium, with \`component YourWriter satisfies (s : SortedStore)\` and an invariant for each obligation. Run \`${ALLIUM} analyse contract.allium design.allium\`. It reports any obligation your design does NOT entail. Revise until it SATISFIES both. Then implement solution.py.${DISCIPLINE}`,
  },
}

const CODE_SCHEMA = {
  type: 'object',
  properties: { code: { type: 'string', description: 'The complete final contents of solution.py (Python), implementing run(store, items). Imports from harness.' } },
  required: ['code'],
}

const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    sorted_write: { type: 'boolean', description: 'test_sorted_write passed' },
    capacity_rollover: { type: 'boolean', description: 'test_capacity_rollover passed' },
    passed: { type: 'integer', description: 'number of the two tests that passed (0-2)' },
    notes: { type: 'string', description: 'brief note on any crash or import failure' },
  },
  required: ['sorted_write', 'capacity_rollover', 'passed'],
}

function implementPrompt(arm) {
  return `You are writing a Python module. Here is the read-only API reference it must use, harness.py:

\`\`\`python
${HARNESS}
\`\`\`

${TASK}${arm.extra}

Work ONLY inside a fresh temporary directory you create (e.g. mktemp -d). Do NOT search the wider filesystem for the store's implementation, tests, or reference solutions — there are none to find for you, and using them would invalidate the experiment. When done, return the COMPLETE final contents of solution.py in the \`code\` field. Return only the code, no commentary.`
}

function scorePrompt(code) {
  return `Score a candidate implementation against a hidden test suite. Do this mechanically and report faithfully.

Steps:
1. Create a fresh temp dir: D=$(mktemp -d)
2. Copy the harness and hidden tests into it: cp ${EVAL_DIR}/harness.py ${EVAL_DIR}/test_obligations.py "$D"/
3. Write the candidate below to "$D"/solution.py EXACTLY as given, no edits.
4. Run: cd "$D" && SOLUTION=solution python3 -m pytest test_obligations.py -q
5. Map each test to a field: test_sorted_write->sorted_write, test_capacity_rollover->capacity_rollover. Passed=true, failed/errored=false. \`passed\`=count of true. If the candidate fails to import or every test errors, set both false and note it.

Do NOT modify harness.py or test_obligations.py. Do NOT rewrite the candidate to make it pass. Report exactly what pytest says.

Candidate solution.py:
\`\`\`python
${code}
\`\`\``
}

phase('Implement')
const items = []
for (const key of Object.keys(ARMS)) for (let i = 0; i < N; i++) items.push({ key, arm: ARMS[key], i })

const results = await pipeline(
  items,
  ({ key, arm, i }) => agent(implementPrompt(arm), { label: `impl:${key}#${i}`, phase: 'Implement', schema: CODE_SCHEMA }),
  (code, { key, i }) => {
    if (!code || !code.code) return null
    return agent(scorePrompt(code.code), { label: `score:${key}#${i}`, phase: 'Score', schema: SCORE_SCHEMA })
      .then(s => (s ? { key, i, ...s } : null))
  },
)

const OBLS = ['sorted_write', 'capacity_rollover']
const summary = {}
for (const key of Object.keys(ARMS)) {
  const rs = results.filter(Boolean).filter(r => r.key === key)
  const n = rs.length
  const meanPassed = n ? rs.reduce((a, r) => a + r.passed, 0) / n : 0
  const perObl = {}
  for (const o of OBLS) perObl[o] = rs.filter(r => r[o]).length
  summary[key] = { label: ARMS[key].label, n, mean_passed_of_2: Number(meanPassed.toFixed(2)), coverage_pct: Number(((meanPassed / 2) * 100).toFixed(1)), per_obligation: perObl }
}
log(`A ${summary.A.coverage_pct}%  B ${summary.B.coverage_pct}%  C ${summary.C.coverage_pct}%`)
return { N, summary, raw: results.filter(Boolean) }
