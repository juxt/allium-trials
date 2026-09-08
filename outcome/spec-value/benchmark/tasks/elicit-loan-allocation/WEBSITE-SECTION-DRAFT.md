# DRAFT website section — the elicitation head-to-head (stage into benchmarks.md when final)

Placeholders marked {{...}} are filled once the sonnet re-run + contradiction probe land.

---

## Finding 4 — where the spec comes from: elicitation vs the tools people use

The earlier findings hand every arm a *finished* spec and ask what the code does with it. That
assumes the hard part — knowing what to build — is already done. It usually isn't. So this
section measures the step before: an authoring process interviews a stakeholder about a
deliberately underspecified feature, and we score the code that results end to end.

**The task.** A vague loan-payment-allocation brief hides 14 material policy decisions a model
cannot guess — bucket order, a 3-decimal currency, a write-off tolerance, back-dated re-accrual.
A proxy stakeholder holds the answers and gives them only when asked, volunteering nothing. Five
processes each interview that same stakeholder by their own real rules, produce a spec, and a
fixed step turns each spec into code scored by a behavioural oracle (11 per-decision scenarios).

<table class="bm-tbl">
<thead><tr><th>process</th><th>Opus author — code</th><th>Sonnet author — code</th></tr></thead>
<tbody>
<tr><td>Allium elicit</td><td class="hi">80.5</td><td>{{elicit_sonnet}}</td></tr>
<tr><td>plain prose (diligent engineer)</td><td class="hi">77.8</td><td>61.4</td></tr>
<tr><td>AIUP (use-case derivation)</td><td>71.6</td><td>—</td></tr>
<tr><td>spec-kit (/specify + /clarify)</td><td>56.6</td><td>40.9</td></tr>
<tr><td>superpowers (brainstorming)</td><td>45.5</td><td>—</td></tr>
</tbody></table>

<p class="bm-lead">Naive industry-standard guess: 27%. Two honest reads. <b>Allium elicit ties a
diligent engineer who asks freely</b> — both reach ~80% — and <b>both beat every packaged
spec-driven tool</b>. The tools lose for a structural reason we reproduced faithfully: spec-kit
caps clarification at five questions and fills the rest from "industry standards" (it defaults the
currency to 2 decimals and misses the write-off tolerance entirely); AIUP derives use-cases from a
vision rather than interviewing; superpowers under-asks. Each miss is a bespoke policy the process
never put to the stakeholder.</p>

<div class="bm-note">The honest caveat: with a capable model and a cooperative stakeholder,
structured elicitation does not beat a good engineer who simply asks a lot of questions. Its edge
appears where free-form asking breaks down — {{weaker_author_claim}} — and where a requirement is
not just missing but self-contradictory (below).</div>

## Finding 5 — the one thing prose cannot do: catch a contradiction

{{contra_intro}} Three late-fee rules, each reasonable alone: the fee is 5% of overdue principal;
principal is capped at 200 BHD; there is a 15 BHD minimum fee. Together they are impossible — 5% of
200 is 10, which can never meet a 15 minimum — but only arithmetic across all three reveals it.

<table class="bm-tbl">
<thead><tr><th>process</th><th>caught the contradiction</th></tr></thead>
<tbody>
<tr><td>Allium elicit (runs <code>allium analyse</code>)</td><td class="hi">{{contra_elicit}}</td></tr>
<tr><td>plain prose</td><td>{{contra_prose}}</td></tr>
<tr><td>spec-kit</td><td>{{contra_speckit}}</td></tr>
</tbody></table>

<p class="bm-lead">{{contra_read}} A prose spec records all three rules and reads fine; nothing in
it can tell you the policy is unbuildable. Allium's checker proves the constraints cannot hold
together and names the conflicting core, deterministically, every run. This is not a code-quality
difference — it is a capability prose does not have.</p>
