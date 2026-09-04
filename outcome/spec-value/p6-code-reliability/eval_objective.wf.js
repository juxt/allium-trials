export const meta = {
  name: 'objective-vacuity-eval',
  description: 'Does stating an OBJECTIVE in the spec close the vacuity gap? Cache domain, where a safe-but-vacuous (always-miss) cache is a real failure mode. Two arms differ only in the contract: safety-only vs safety+objective. Fresh agents implement a Cache; the hidden suite scores SAFETY (never stale) and OBJECTIVE (actually caches). Hypothesis: the objective arm produces fewer vacuous caches.',
  phases: [
    { title: 'Implement', detail: 'fresh agents implement Cache from a contract; safety-only vs safety+objective' },
    { title: 'Score', detail: 'hidden suite: never-stale (safety) + actually-caches (objective)' },
  ],
}

const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const EVAL_DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/p6-code-reliability/cache'
const SKILL_PATH = '/Users/hgarner/code/allium/skills-v4/implement/SKILL.md'
const N = 6

const HARNESS = `# harness.py — API reference for a backing store the cache sits over (read-only).
class Store:
    def __init__(self, data=None): ...
    def read(self, key): ...       # fetch from the slow store (counts as a store read)
    def write(self, key, value): ...  # persist to the store
`

const TASK = `Implement \`class Cache\` in solution.py, over the backing store in harness.py:
  class Cache:
    def __init__(self, store): ...
    def get(self, key):          # return the current value for key
    def put(self, key, value):   # write a new value for key
Decide what a correct, useful cache requires. solution.py imports from harness.`

const CONTRACT_SAFETY = `-- allium: 4
contract CacheContract
  entity Key
  observable state served(Key) : bool
  observable state consistent_with_store(Key) : bool
  guarantee never_stale means served(k) implies consistent_with_store(k)
end`

// Same contract PLUS the objective (the anti-vacuity floor): a value that was put must actually be
// served from the cache, not fetched from the store every time.
const CONTRACT_OBJECTIVE = `-- allium: 4
contract CacheContract
  entity Key
  observable state served(Key) : bool
  observable state consistent_with_store(Key) : bool
  observable state served_from_cache(Key) : bool
  guarantee never_stale means served(k) implies consistent_with_store(k)
  objective served_from_cache(k) within one_access
end`

const DISCIPLINE = `

Use the spec so it never makes your code worse: the spec is a FLOOR not a ceiling (do everything a correct useful cache needs, plus what the spec says), and RECONCILE the code against every obligation before finishing (for each, point to the line that realises it; a contract you satisfy on paper but not in behaviour is not done).`

const ARMS = {
  safety_only: CONTRACT_SAFETY,
  with_objective: CONTRACT_OBJECTIVE,
}

const CODE_SCHEMA = {
  type: 'object',
  properties: { code: { type: 'string', description: 'The complete final contents of solution.py (a Cache class). Imports from harness.' } },
  required: ['code'],
}
const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    never_stale: { type: 'boolean', description: 'test_never_stale passed (safety)' },
    actually_caches: { type: 'boolean', description: 'test_actually_caches passed (objective)' },
  },
  required: ['never_stale', 'actually_caches'],
}

function implementPrompt(contract) {
  return `You are writing a Python module against this read-only API reference, harness.py:

\`\`\`python
${HARNESS}
\`\`\`

${TASK}

You are given the dependency's LIBRARY SPEC — a contract your implementation must satisfy:

${contract}

Follow the Allium v4 ImplementFromSpec skill: READ ${SKILL_PATH} and apply its process.${DISCIPLINE} You may write the contract and a design to a temp dir and run \`${ALLIUM} analyse contract.allium design.allium\`.

Work ONLY in a fresh temp dir (mktemp -d). Do NOT search for tests or reference solutions. Return the COMPLETE final contents of solution.py in \`code\`, code only.`
}

function scorePrompt(code) {
  return `Score a candidate Cache against a hidden test suite. Mechanical, faithful.
1. D=$(mktemp -d)
2. cp ${EVAL_DIR}/harness.py ${EVAL_DIR}/test_obligations.py "$D"/
3. Write the candidate below to "$D"/solution.py exactly as given.
4. cd "$D" && SOLUTION=solution python3 -m pytest test_obligations.py -q
5. Report never_stale = did test_never_stale pass; actually_caches = did test_actually_caches pass. If it fails to import, both false.
Do NOT edit anything.

Candidate solution.py:
\`\`\`python
${code}
\`\`\``
}

phase('Implement')
const items = []
for (const arm of Object.keys(ARMS)) for (let i = 0; i < N; i++) items.push({ arm, i })

const results = await pipeline(
  items,
  ({ arm, i }) => agent(implementPrompt(ARMS[arm]), { label: `impl:${arm}#${i}`, phase: 'Implement', schema: CODE_SCHEMA }),
  (code, { arm, i }) => {
    if (!code || !code.code) return null
    return agent(scorePrompt(code.code), { label: `score:${arm}#${i}`, phase: 'Score', schema: SCORE_SCHEMA })
      .then(s => (s ? { arm, i, ...s } : null))
  },
)

const summary = {}
for (const arm of Object.keys(ARMS)) {
  const rs = results.filter(Boolean).filter(r => r.arm === arm)
  const n = rs.length || 1
  summary[arm] = {
    n: rs.length,
    safety_pct: Number((rs.filter(r => r.never_stale).length / n * 100).toFixed(1)),
    objective_pct: Number((rs.filter(r => r.actually_caches).length / n * 100).toFixed(1)),
    both_pct: Number((rs.filter(r => r.never_stale && r.actually_caches).length / n * 100).toFixed(1)),
    vacuous_pct: Number((rs.filter(r => r.never_stale && !r.actually_caches).length / n * 100).toFixed(1)),
  }
}
for (const k of Object.keys(summary)) {
  const s = summary[k]
  log(`${k}: safety ${s.safety_pct}%  objective ${s.objective_pct}%  both ${s.both_pct}%  safe-but-vacuous ${s.vacuous_pct}%`)
}
return { N, summary, raw: results.filter(Boolean) }
