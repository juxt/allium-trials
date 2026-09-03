export const meta = {
  name: 'code-reliability-eval',
  description: 'Does the Allium way of working, and the library-spec feature, produce more reliable CODE? Three arms (no-Allium / Allium / Allium+library-spec) each write a Python consumer; a hidden executable test suite scores it per correctness obligation. Message-queue domain.',
  phases: [
    { title: 'Implement', detail: 'fresh agents write solution.py; arm A task-only, B specifies+checks an Allium design, C references the library spec and checks against it' },
    { title: 'Score', detail: 'run the hidden test suite against each solution; 0-4 obligations pass' },
  ],
}

const ALLIUM = '/Users/hgarner/code/allium-tools/target/release/allium'
const EVAL_DIR = '/Users/hgarner/code/allium-trials/outcome/spec-value/p6-code-reliability/message_queue'
const N = 3

const HARNESS = `"""Message-queue harness — the published interface (read-only). API reference only:
it documents what each operation does mechanically, not how to use the queue correctly. Time is
simulated: work() advances a logical clock, so behaviour is deterministic."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional

class Clock:
    def __init__(self): self.now = 0
    def advance(self, ms): self.now += ms

@dataclass
class Message:
    id: str                 # logical identity of the message
    payload: str
    processing_ms: int      # how long work() on this message takes
    _next_visible_at: int = 0
    delivery_count: int = 0  # how many times poll() has returned this message

@dataclass
class Receipt:
    message: Message
    deadline: int           # the time the lease expires
    delivery_count: int
    _acked: bool = False

class Sink:
    def __init__(self): self.applied = []
    def apply(self, payload): self.applied.append(payload)

class Broker:
    """A message queue with leased delivery and a visibility timeout."""
    def __init__(self, messages, clock, visibility_timeout=1000):
        self._messages = list(messages); self._clock = clock
        self.visibility_timeout = visibility_timeout; self.dead_letter_queue = []
    def poll(self) -> Optional[Receipt]:
        if not self._messages: return None
        if all(m._next_visible_at > self._clock.now for m in self._messages):
            self._clock.now = min(m._next_visible_at for m in self._messages)
        m = min(self._messages, key=lambda x: x._next_visible_at)
        m.delivery_count += 1
        m._next_visible_at = self._clock.now + self.visibility_timeout
        return Receipt(m, deadline=m._next_visible_at, delivery_count=m.delivery_count)
    def ack(self, receipt) -> bool:   # complete + remove; False if the lease expired
        if receipt._acked: return True
        if self._clock.now > receipt.deadline: return False
        if receipt.message in self._messages: self._messages.remove(receipt.message)
        receipt._acked = True; return True
    def extend_visibility(self, receipt, ms) -> bool:
        if self._clock.now > receipt.deadline: return False
        receipt.message._next_visible_at = self._clock.now + ms
        receipt.deadline = receipt.message._next_visible_at; return True
    def dead_letter(self, receipt):
        if receipt.message in self._messages:
            self._messages.remove(receipt.message); self.dead_letter_queue.append(receipt.message)
    def pending(self) -> int: return len(self._messages)

class WorkFailed(Exception):
    """Raised by work() when processing a message does not succeed."""
`

const TASK = `Implement the function \`run(broker, sink, work, clock, max_polls=1000)\` in a module solution.py.
Consume messages from the broker and apply each message's payload to the sink, RELIABLY, until the
queue is drained (broker.pending() == 0) or you reach max_polls polls. Call work(message) to process a
message: it advances the clock by the message's processing time and returns None, or raises
harness.WorkFailed if processing does not succeed. Nothing else is specified for you: decide what
"reliably" requires and implement it. solution.py must import from harness.`

const PRIMER = `Allium v4 syntax you need:
  component Name satisfies (q : ContractName)   -- omit the satisfies clause if not referencing a contract
    entity E
    observable state f(E) : bool
    invariant inv_name means <predicate>        -- holds in every reachable state; variables implicitly universally quantified
    action act_name
      requires <guard>
      ensures <postcondition>
  end
Predicates use: implies, and, or, not, =, >=, <=. A bare variable like m is implicitly quantified.`

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

// The spec is a FLOOR, never a ceiling, and every obligation it states must be reconciled into
// the code before finishing (the weed step). Without this a spec can make code WORSE than none:
// attention narrows to the abstract invariants, and stated-but-unimplemented obligations ship.
const DISCIPLINE = `

CRITICAL — how to use the spec so it never makes your code worse:
1. The spec is a FLOOR, not a ceiling. It names properties you MUST guarantee; it does not excuse you from every other thing a robust implementation needs. Do everything you would normally do to make this correct, PLUS everything the spec requires. Never let specifying narrow your implementation.
2. RECONCILE the code against the spec before you finish (this is the weed step). For EACH invariant/obligation in your Allium spec, point to the exact line(s) of solution.py that actually realise it in behaviour. If any obligation is stated in the spec but not truly implemented in the code (e.g. the spec says applied implies deduped but the code does not dedup by message id), FIX THE CODE. Do not return until every obligation is realised in the code, not merely asserted in the spec.`

const ARMS = {
  A: { label: 'no-allium', extra: '' },
  B: {
    label: 'allium',
    extra: `\n\nBEFORE writing Python, design your consumer as an Allium v4 behavioural specification and check it.
${PRIMER}
Write your design to design.allium in your working directory and run \`${ALLIUM} check design.allium\`. Fix anything it reports.
Let the discipline of specifying your consumer's behaviour and checking it inform the implementation. Then implement solution.py.${DISCIPLINE}`,
  },
  C: {
    label: 'allium+libspec',
    extra: `\n\nBEFORE writing Python, you are given the broker's LIBRARY SPEC — a contract of the obligations your consumer must satisfy:

${CONTRACT}

Design your consumer as an Allium v4 spec that references this contract.
${PRIMER}
Write the contract above to contract.allium and your design to design.allium, with \`component YourConsumer satisfies (q : QueueConsumer)\` and an invariant for each obligation. Run \`${ALLIUM} analyse contract.allium design.allium\`. It reports any obligation your design does NOT entail. Revise until it SATISFIES all four. Then implement solution.py.${DISCIPLINE}`,
  },
}

const CODE_SCHEMA = {
  type: 'object',
  properties: { code: { type: 'string', description: 'The complete final contents of solution.py (Python), implementing run(...). Imports from harness.' } },
  required: ['code'],
}

const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    idempotent: { type: 'boolean', description: 'test_idempotent_processing passed' },
    ack_after_process: { type: 'boolean', description: 'test_ack_only_after_processing passed' },
    extend_visibility: { type: 'boolean', description: 'test_extend_visibility_for_slow_job passed' },
    dead_letter: { type: 'boolean', description: 'test_dead_letter_poison_message passed' },
    passed: { type: 'integer', description: 'number of the four tests that passed (0-4)' },
    notes: { type: 'string', description: 'brief note on any crash or import failure' },
  },
  required: ['idempotent', 'ack_after_process', 'extend_visibility', 'dead_letter', 'passed'],
}

function implementPrompt(arm) {
  return `You are writing a Python module. Here is the read-only interface it must use, harness.py:

\`\`\`python
${HARNESS}
\`\`\`

${TASK}${arm.extra}

Work ONLY inside a fresh temporary directory you create (e.g. mktemp -d). Write harness.py there from the interface above so you can import and self-test if you wish. Do NOT search the wider filesystem for tests or reference solutions — there are none to find, and using them would invalidate the experiment. When done, return the COMPLETE final contents of solution.py in the \`code\` field. Return only the code, no commentary.`
}

function scorePrompt(code) {
  return `Score a candidate consumer implementation against a hidden test suite. Do this mechanically and report faithfully.

Steps:
1. Create a fresh temp dir: D=$(mktemp -d)
2. Copy the harness and hidden tests into it: cp ${EVAL_DIR}/harness.py ${EVAL_DIR}/test_obligations.py "$D"/
3. Write the candidate below to "$D"/solution.py EXACTLY as given, no edits.
4. Run: cd "$D" && SOLUTION=solution python3 -m pytest test_obligations.py -q
5. Read the pytest output. Map each test to a field: test_idempotent_processing->idempotent, test_ack_only_after_processing->ack_after_process, test_extend_visibility_for_slow_job->extend_visibility, test_dead_letter_poison_message->dead_letter. A test that passed = true, failed/errored = false. \`passed\` = count of true. If the candidate fails to import or every test errors, set all four false and note it.

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

const OBLS = ['idempotent', 'ack_after_process', 'extend_visibility', 'dead_letter']
const summary = {}
for (const key of Object.keys(ARMS)) {
  const rs = results.filter(Boolean).filter(r => r.key === key)
  const n = rs.length
  const meanPassed = n ? rs.reduce((a, r) => a + r.passed, 0) / n : 0
  const perObl = {}
  for (const o of OBLS) perObl[o] = rs.filter(r => r[o]).length
  summary[key] = { label: ARMS[key].label, n, mean_passed_of_4: Number(meanPassed.toFixed(2)), coverage_pct: Number(((meanPassed / 4) * 100).toFixed(1)), per_obligation: perObl }
}
log(`A ${summary.A.coverage_pct}%  B ${summary.B.coverage_pct}%  C ${summary.C.coverage_pct}%`)
return { N, summary, raw: results.filter(Boolean) }
