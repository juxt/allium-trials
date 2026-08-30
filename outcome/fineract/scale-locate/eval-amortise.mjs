#!/usr/bin/env node
// AMORTISATION test: does a maintained spec pay for itself in TOKENS across repeated cold tasks?
//
// The pilot showed a single lookup saturates (model finds it cold for $0.82; spec costs more). The
// real token argument for "a spec that lives beside the code" is amortisation: one expensive
// exploration crystallised into a 30-line spec, then read cheaply by every later COLD session.
//
// Design: a SEQUENCE of related-but-distinct tasks over the loan-accounting subsystem of the full
// ~985k-LOC Fineract repo. Every task runs in a FRESH cold `claude -p` session (no memory across
// tasks — the realistic new-engineer / new-session case). Two arms:
//   - nospec: re-explores the subsystem from scratch on every task.
//   - spec:   given the distilled subsystem spec (persists across tasks; names NO code identifiers)
//             plus the same cold repo; it can orient from the map and search less.
// The spec contains NO per-task answers — each task still needs real investigation.
//
// Metrics per task: cost, tokens, turns, and a blind correctness score against that task's key.
// Headline: CUMULATIVE cost per arm across the sequence — does spec cross below nospec, and does it
// hold correctness while doing so? (A token saving bought with lower correctness is logged, not hidden.)
//
// Usage: node eval-amortise.mjs [--reps 1] [--turns 40]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "checkout");
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const REPS = Number(argv[argv.indexOf("--reps") + 1] ?? "1");
const TURNS = Number(argv[argv.indexOf("--turns") + 1] ?? "40");
const SPEC = readFileSync(join(HERE, "spec-doubleentry.allium"), "utf8");

// Related-but-distinct tasks over the loan-accounting / journal-entry subsystem. Each has a KEY of
// ground-truth points (for the blind judge). The spec is a relevant MAP for all five but answers none.
const TASKS = [
  {
    id: "T1_newtype",
    ask: `A new loan transaction type (call it a 'goodwill credit') is being added. Identify every place in the code that must emit accounting postings for it so that double-entry stays balanced, and state what, if anything, guarantees the postings balance. Cite file:line.`,
    key: `- Cash-basis loan processor (CashBasedAccountingProcessorForLoan) must gain a branch for the new type.
- Accrual-basis loan processor (AccrualBasedAccountingProcessorForLoan) likewise.
- The leg posting primitives (AccountingProcessorHelper.createDebit/CreditJournalEntryForLoan) emit each side.
- KEY: nothing enforces balance on the loan path; the new branch must be hand-written to post matching debit+credit; an omission posts unbalanced silently.`,
    points: 4,
  },
  {
    id: "T2_chargeoff",
    ask: `Assess whether the CHARGE-OFF repayment posting path can silently post an unbalanced loan transaction. Name the specific method and the exact mechanism that makes an imbalance possible. Cite file:line.`,
    key: `- createJournalEntriesForChargeOffLoanRepayments in CashBasedAccountingProcessorForLoan (~527-725).
- Credits come from a GLAccountBalanceHolder map; the debit side is a separately-accumulated total/map.
- The two accumulators are never reconciled against each other, and no debit=credit guard runs on this path.
- So adding to one side and not the other posts unbalanced silently.`,
    points: 4,
  },
  {
    id: "T3_guard",
    ask: `Is there any runtime check that rejects a LOAN-generated journal batch whose total debits do not equal total credits? If yes, name it and the path that triggers it; if no, explain what the code relies on instead. Cite file:line.`,
    key: `- checkDebitAndCreditAmounts (JournalEntryWritePlatformServiceJpaRepositoryImpl ~306-326) throws DEBIT_CREDIT_SUM_MISMATCH.
- It is invoked ONLY from the manual createJournalEntry API path (~197/217), operating on operator-submitted entries.
- The loan path (createJournalEntriesForLoan ~540) never calls it.
- So there is NO enforcement on the loan path; balance relies on each processor branch hand-posting matched amounts.`,
    points: 4,
  },
  {
    id: "T4_cashlegs",
    ask: `On CASH basis, when a normal loan repayment is posted, which leg types are journalled (principal, interest, fees, penalties) and where do the per-type general-ledger accounts come from? Name the method and the account-mapping lookups. Cite file:line.`,
    key: `- CashBasedAccountingProcessorForLoan repayment handling reads getPrincipalAmount/getInterestAmount/getFeesAmount/getPenaltyAmount (~146-149).
- Each present leg posts via createCredit/DebitJournalEntryForLoan with a per-type GL account.
- Account mappings resolved through the helper's loan-product-to-GL-account lookup (getLinkedGLAccountForLoanProduct or equivalent).`,
    points: 3,
  },
  {
    id: "T5_accrual",
    ask: `How does the ACCRUAL processor differ from the cash processor in WHEN interest reaches the ledger, and what code implements that difference? Cite file:line.`,
    key: `- AccrualBasedAccountingProcessorForLoan posts interest/fees when they ACCRUE (accrual transaction), not only when paid.
- Cash posts interest only at repayment. Accrual has dedicated branches for accruals and repayment then clears the accrued receivable.
- Cite the accrual processor's accrual-handling method(s) vs the cash processor's repayment-only handling.`,
    points: 3,
  },
];

function agent(prompt) {
  const r = spawnSync("claude", [
    "-p", prompt, "--output-format", "json", "--model", MODEL, "--max-turns", String(TURNS),
    "--dangerously-skip-permissions", "--disallowedTools", "Edit,Write,NotebookEdit,WebFetch,WebSearch",
  ], { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 29, timeout: 1200000 });
  let j = {}; try { j = JSON.parse(r.stdout || "{}"); } catch { j = { result: r.stdout || "", parse_error: true }; }
  const u = j.usage || {};
  return {
    text: j.result || "", cost: j.total_cost_usd ?? 0, turns: j.num_turns ?? 0,
    in_tok: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    out_tok: u.output_tokens ?? 0, err: j.is_error || j.parse_error || false,
  };
}
function judge(task, text) {
  const prompt = `Impartial grader. An engineer answered a question about a codebase. Using ONLY the ground-truth key, count how many DISTINCT key points they correctly hit (max ${task.points}). Partial/vague mentions do not count; they must be specifically right.

=== GROUND-TRUTH KEY ===
${task.key}

=== ENGINEER'S ANSWER ===
${text}

Output exactly one line: \`SCORE: <n>/${task.points}\` and nothing else.`;
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL, "--max-turns", "2",
    "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch"], { encoding: "utf8", maxBuffer: 1 << 27, timeout: 300000 });
  const m = (r.stdout || "").match(/SCORE:\s*(\d+)/i);
  return m ? Number(m[1]) : 0;
}

const ARMS = {
  nospec: (t) => `You are a senior engineer, new to this codebase (Apache Fineract, rooted in the current directory). It is far too large to read fully; you must search it. Do not modify files.\n\n${t.ask}`,
  spec: (t) => `You are a senior engineer working on this codebase (Apache Fineract, rooted in the current directory). Your team maintains the distilled behavioural specification below of the loan-accounting subsystem; use it as your map. It names no code identifiers, so you must still locate the code. The repo is far too large to read fully; search it. Do not modify files.\n\n=== MAINTAINED SUBSYSTEM SPEC ===\n${SPEC}\n=== END SPEC ===\n\n${t.ask}`,
};

const results = {};
for (const [arm, mk] of Object.entries(ARMS)) {
  results[arm] = [];
  for (const t of TASKS) {
    for (let r = 0; r < REPS; r++) {
      const a = agent(mk(t) + (r ? `\n(independent attempt ${r + 1})` : ""));
      writeFileSync(join(HERE, `am_${arm}_${t.id}_${r}.txt`), a.text || "(empty)");
      const sc = a.text ? judge(t, a.text) : 0;
      results[arm].push({ task: t.id, rep: r, score: sc, max: t.points, ...a, text: undefined });
      console.error(`[${arm} ${t.id} ${r}] score=${sc}/${t.points} $${a.cost.toFixed(3)} turns=${a.turns} tok=${(a.in_tok/1000).toFixed(0)}k`);
      writeFileSync(join(HERE, "amortise-result.json"), JSON.stringify(results, null, 2));
    }
  }
}

// Report: per-task and cumulative.
const byTask = (arm, tid) => results[arm].filter(x => x.task === tid);
const mean = (xs, k) => xs.length ? xs.reduce((s, x) => s + (Number(x[k]) || 0), 0) / xs.length : 0;
console.log(`\n== AMORTISATION over ~985k LOC Fineract: ${TASKS.length} cold tasks x ${REPS} rep ==\n`);
console.log(`task         nospec $  nospec score  |  spec $   spec score`);
let cumN = 0, cumS = 0;
for (const t of TASKS) {
  const n = byTask("nospec", t.id), s = byTask("spec", t.id);
  cumN += mean(n, "cost"); cumS += mean(s, "cost");
  console.log(`${t.id.padEnd(12)} $${mean(n,"cost").toFixed(3)}   ${mean(n,"score").toFixed(1)}/${t.points}        |  $${mean(s,"cost").toFixed(3)}  ${mean(s,"score").toFixed(1)}/${t.points}   | cum: nospec $${cumN.toFixed(2)} vs spec $${cumS.toFixed(2)}`);
}
const totScore = (arm) => results[arm].reduce((s, x) => s + x.score, 0);
const totMax = TASKS.reduce((s, t) => s + t.points, 0) * REPS;
console.log(`\nTOTALS: nospec $${cumN.toFixed(2)} correctness ${totScore("nospec")}/${totMax}  |  spec $${cumS.toFixed(2)} correctness ${totScore("spec")}/${totMax}`);
console.log(`=> spec amortises IFF cumulative spec $ crosses below nospec $ while holding correctness. Watch the 'cum:' column for the crossover task.`);
