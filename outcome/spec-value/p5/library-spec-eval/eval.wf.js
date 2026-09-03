export const meta = {
  name: 'library-spec-eval',
  description: 'A/B empirical eval: does referencing a library spec improve client-implementation correctness? Fresh control vs treatment implementers write a client spec; a blind judge scores obligation coverage. Two domains, N=5 per condition.',
  phases: [
    { title: 'Implement', detail: 'fresh agents write a client spec, control (task only) vs treatment (task + library spec)' },
    { title: 'Judge', detail: 'a blind judge scores each spec for obligation coverage' },
  ],
}

const PRIMER = `Write an Allium v4 behavioural specification. Syntax you need:
  component Name
    entity E
    observable state f(E) : bool          -- a state field; also : Number
    invariant inv_name means <predicate>  -- true in every reachable state; variables universally quantified
    action act_name
      requires <guard>
      ensures <postcondition>             -- e.g. ensures f(e) = true; state not mentioned is unchanged
  end
Predicates use: implies, and, or, not, =, >=, <=. An argument like m is an implicitly-quantified variable.
Write a self-contained component with the invariants and actions that make it correct. Do not add a satisfies clause.`;

const DOMAINS = [
  {
    name: 'message_queue',
    setting: 'a message queue (at-least-once delivery, a visibility timeout)',
    task: `Specify \`component Consumer\`: a consumer of a message queue. The queue delivers each message AT LEAST ONCE. When you receive a message it becomes invisible to other consumers for a limited VISIBILITY TIMEOUT, after which, if not acknowledged, it becomes visible again for redelivery. Model the consumer's behaviour and state the invariants that make it CORRECT. Declare whatever observables you need.`,
    contract: `contract MessageQueue
  entity Msg
  observable state processed(Msg) : bool
  observable state acked(Msg) : bool
  observable state idempotent(Msg) : bool
  observable state exceeded_timeout(Msg) : bool
  observable state visibility_extended(Msg) : bool
  observable state failures(Msg) : Number
  observable state dead_lettered(Msg) : bool
  guarantee idempotent_processing means processed(m) implies idempotent(m)
  guarantee ack_after_process means acked(m) implies processed(m)
  guarantee extend_slow means exceeded_timeout(m) implies visibility_extended(m)
  guarantee park_poison means failures(m) >= 5 implies dead_lettered(m)
end`,
    obligations: [
      { id: 'idempotent', desc: 'Processing is idempotent: because delivery is at-least-once, processing the same message more than once must be safe (no double effect).' },
      { id: 'ack_after_process', desc: 'A message is acknowledged/deleted only AFTER it has been fully processed, never before (else a crash mid-processing loses it).' },
      { id: 'extend_visibility', desc: 'If processing outlasts the visibility timeout, the consumer extends the timeout (heartbeat); otherwise the message reappears and is processed concurrently by another consumer.' },
      { id: 'dead_letter', desc: 'A message that fails repeatedly is eventually parked / dead-lettered rather than retried forever (poison-message handling).' },
    ],
  },
  {
    name: 'event_store',
    setting: 'an event-sourced store (append-only per-stream logs)',
    task: `Specify \`component Client\`: a client of an event-sourced store. The store holds an APPEND-ONLY log of events, grouped into per-entity streams. You append events and read them back to rebuild state. Model the client's behaviour and state the invariants that make it CORRECT. Declare whatever observables you need.`,
    contract: `contract EventStore
  entity Event
  observable state appended(Event) : bool
  observable state expected_version_checked(Event) : bool
  observable state mutates_past(Event) : bool
  observable state assumes_global_order(Event) : bool
  observable state apply_idempotent(Event) : bool
  guarantee optimistic_concurrency means appended(e) implies expected_version_checked(e)
  guarantee immutable means not mutates_past(e)
  guarantee no_cross_stream_order means not assumes_global_order(e)
  guarantee idempotent_apply means apply_idempotent(e)
end`,
    obligations: [
      { id: 'optimistic_concurrency', desc: 'Appends specify the expected current version, so a conflicting concurrent append is rejected rather than silently overwriting (no lost update).' },
      { id: 'immutable', desc: 'Events are immutable: the client never mutates or deletes a past event; a correction is a NEW compensating event appended to the log.' },
      { id: 'no_cross_stream_order', desc: 'The client does not assume a global order across different streams; only per-stream ordering is guaranteed.' },
      { id: 'idempotent_apply', desc: 'Applying an event to rebuild state is idempotent: replaying the same event twice yields the same state (rebuilds/replays are safe).' },
    ],
  },
];

const K = 5;

phase('Implement');
const jobs = [];
for (const d of DOMAINS) {
  for (const cond of ['control', 'treatment']) {
    for (let i = 0; i < K; i++) jobs.push({ d, cond, i });
  }
}
const impl = await parallel(jobs.map(j => () => {
  const base = `${PRIMER}\n\nTASK\n${j.d.task}`;
  const p = j.cond === 'treatment'
    ? `${base}\n\nYou depend on this PUBLISHED LIBRARY SPECIFICATION for the service. Honour its promises in your own component:\n\n${j.d.contract}\n\nOutput ONLY the Allium component specification.`
    : `${base}\n\nOutput ONLY the Allium component specification.`;
  return agent(p, { label: `impl:${j.d.name}:${j.cond}:${j.i}`, phase: 'Implement' })
    .then(spec => ({ domain: j.d.name, cond: j.cond, i: j.i, spec, obligations: j.d.obligations, setting: j.d.setting }));
}));

phase('Judge');
const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, addressed: { type: 'boolean' }, why: { type: 'string' } },
        required: ['id', 'addressed', 'why'],
      },
    },
  },
  required: ['results'],
};
const judged = await parallel(impl.filter(Boolean).map(s => () => {
  const obs = s.obligations.map(o => `- ${o.id}: ${o.desc}`).join('\n');
  const jp = `You are strictly and impartially scoring whether a specification addresses a set of correctness obligations. Below is a specification a developer wrote for a client of ${s.setting}. You do not know how it was produced; judge only its content.\n\n--- SPECIFICATION ---\n${s.spec}\n--- END SPECIFICATION ---\n\nFor EACH obligation below, decide whether the specification concretely ADDRESSES it — states an invariant, guard, or action that enforces or accounts for it — regardless of the exact wording or variable names used. Be STRICT: a concrete constraint is required; a vague comment, a restated goal, or an unrelated invariant does NOT count.\n\nObligations:\n${obs}\n\nReturn one result per obligation id: addressed (true/false) and a one-line justification citing the relevant part of the spec (or its absence).`;
  return agent(jp, { label: `judge:${s.domain}:${s.cond}:${s.i}`, phase: 'Judge', schema: JUDGE_SCHEMA })
    .then(v => ({ domain: s.domain, cond: s.cond, i: s.i, n: s.obligations.length, addressed: (v.results || []).filter(r => r.addressed).length, results: v.results || [] }));
}));

// Aggregate: per domain per condition mean coverage.
const agg = {};
for (const r of judged.filter(Boolean)) {
  const k = `${r.domain}:${r.cond}`;
  if (!agg[k]) agg[k] = { covered: 0, total: 0, runs: 0 };
  agg[k].covered += r.addressed;
  agg[k].total += r.n;
  agg[k].runs += 1;
}
const summary = {};
for (const k of Object.keys(agg)) {
  summary[k] = { mean_coverage: Math.round((agg[k].covered / agg[k].total) * 100) / 100, covered: agg[k].covered, total: agg[k].total, runs: agg[k].runs };
}
// Per-obligation: fraction of runs addressing it, by condition (shows which obligations the library spec adds).
const perOb = {};
for (const r of judged.filter(Boolean)) {
  for (const res of r.results) {
    const k = `${r.domain}:${res.id}:${r.cond}`;
    if (!perOb[k]) perOb[k] = { yes: 0, n: 0 };
    perOb[k].n += 1;
    if (res.addressed) perOb[k].yes += 1;
  }
}
return { summary, perObligation: perOb, n_specs: judged.filter(Boolean).length };
