export const meta = {
  name: 'v4-vs-v3-objective-tests',
  description: 'Does a test suite generated from a V4 plan (which includes the objective / anti-vacuity obligation) catch a vacuous implementation that a suite generated from V3-expressible obligations (safety only) misses? Cache domain. Fresh agents generate pytest from the obligations; a scorer runs each suite against a correct and a vacuous cache and reports whether it discriminates.',
  phases: [
    { title: 'Generate', detail: 'agents write a pytest suite from the obligations — V4 (safety+objective) vs V3 (safety only)' },
    { title: 'Score', detail: 'run each suite against the correct and the vacuous cache; does it catch the vacuous one?' },
  ],
}

const CACHE = '/Users/hgarner/code/allium-trials/outcome/spec-value/p6-code-reliability/cache'
const N = 4

const INTERFACE = `# harness.py — the backing store the cache sits over (read-only).
class Store:
    def __init__(self, data=None): ...
    def read(self, key): ...       # fetch from the slow store (this counts as a store read)
    def write(self, key, value): ...
# The Cache OWNS the store: ALL access goes through the Cache. The store is never written out-of-band —
# only Cache.put writes it. The implementation under test exposes:
#   class Cache: __init__(self, store); get(self, key); put(self, key, value)`

// The V4 plan's obligations for the cache (from \`allium plan cache.allium\`), including the objective.
// Tightened: correctness is stated only in terms of the cache's own operations (no out-of-band store writes).
const V4_OBLIGATIONS = `- SAFETY (never_stale): after Cache.put(k, v), Cache.get(k) returns v — a get never serves a value older than the most recent put for that key. (All writes go through the cache; the store is not mutated out-of-band.)
- OBJECTIVE (anti-vacuity): served_from_cache is REACHED — a value already loaded or put is actually served FROM the cache, so a repeated get for an unchanged key does NOT read the store again. An always-miss implementation satisfies never_stale but fails this.`

// What a V3 spec of the same cache can express: the safety constraint only (V3 has no objective construct).
const V3_OBLIGATIONS = `- SAFETY (never_stale): after Cache.put(k, v), Cache.get(k) returns v — a get never serves a value older than the most recent put for that key. (All writes go through the cache; the store is not mutated out-of-band.)`

function genPrompt(obligations) {
  return `You are generating a pytest test suite for a cache implementation. Here is the interface:

\`\`\`python
${INTERFACE}
\`\`\`

Your tests import \`from harness import Store\` and \`from solution import Cache\`. Generate a thorough pytest suite that checks the following obligations, one or more tests each:

${obligations}

Write ONLY what the obligations state — do not invent obligations beyond them. Use the Store's read/write counters where useful. Return the COMPLETE contents of a test_gen.py file in the \`code\` field, code only.`
}

const CODE_SCHEMA = {
  type: 'object',
  properties: { code: { type: 'string', description: 'Complete contents of test_gen.py (pytest, imports Store from harness and Cache from solution).' } },
  required: ['code'],
}
const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    passes_correct: { type: 'boolean', description: 'the suite passes against the correct reference cache' },
    catches_vacuous: { type: 'boolean', description: 'the suite FAILS (catches) the vacuous always-miss cache — at least one test fails' },
    note: { type: 'string' },
  },
  required: ['passes_correct', 'catches_vacuous'],
}

function scorePrompt(code) {
  return `Score a generated pytest suite by running it against two cache implementations. Mechanical, faithful.
1. D=$(mktemp -d); cp ${CACHE}/harness.py "$D"/
2. Write the suite below to "$D"/test_gen.py exactly as given.
3. CORRECT: cp ${CACHE}/solution_reference.py "$D"/solution.py; cd "$D" && python3 -m pytest test_gen.py -q  -> record pass/fail.
4. VACUOUS: cp ${CACHE}/solution_vacuous.py "$D"/solution.py; cd "$D" && python3 -m pytest test_gen.py -q  -> record pass/fail.
Report: passes_correct = did every test pass against the reference; catches_vacuous = did AT LEAST ONE test FAIL against the vacuous always-miss cache. (A suite that catches the vacuous cache has caught the anti-vacuity bug.) If the suite errors/does not import, both false.

Suite:
\`\`\`python
${code}
\`\`\``
}

phase('Generate')
const ARMS = { v4: V4_OBLIGATIONS, v3: V3_OBLIGATIONS }
const items = []
for (const arm of Object.keys(ARMS)) for (let i = 0; i < N; i++) items.push({ arm, i })

const results = await pipeline(
  items,
  ({ arm, i }) => agent(genPrompt(ARMS[arm]), { label: `gen:${arm}#${i}`, phase: 'Generate', schema: CODE_SCHEMA }),
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
    passes_correct_pct: Number((rs.filter(r => r.passes_correct).length / n * 100).toFixed(1)),
    catches_vacuous_pct: Number((rs.filter(r => r.catches_vacuous).length / n * 100).toFixed(1)),
  }
}
log(`v4 catches-vacuous ${summary.v4.catches_vacuous_pct}%  |  v3 catches-vacuous ${summary.v3.catches_vacuous_pct}%`)
return { N, summary, raw: results.filter(Boolean) }
