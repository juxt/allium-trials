#!/usr/bin/env node
// Scores a weed divergence report against a golden list of planted divergences.
//
// Usage: node score.mjs <report.md> <golden.json>
//
// Fully deterministic text matching, no LLM judging and no allium CLI needed:
// the report is split into findings (## sections, falling back to top-level
// bullets), and each planted divergence matches a finding when every must_all
// term appears and (if any are given) at least one must_any term appears.
// Matching is one-to-one, assigned most-constrained-first, so a vague finding
// cannot steal a section that uniquely fits another divergence.
//
// Recall asks "did weed find the planted divergences?". Findings matching no
// planted divergence are false positives — the failure mode to guard: a weed
// that flags healthy spec/code pairs is unusable even at perfect recall.
// Extras matching an allowed_extra_findings fingerprint (genuine judgement
// calls the fixture knowingly contains, e.g. dead loyalty code) are excused.

import { readFileSync, existsSync } from "fs";

const [reportPath, goldenPath] = process.argv.slice(2);
if (!reportPath || !goldenPath) {
  console.error("usage: node score.mjs <report.md> <golden.json>");
  process.exit(2);
}

const golden = JSON.parse(readFileSync(goldenPath, "utf8"));
const report = {
  report: reportPath,
  findings: [],
  divergences: { found: [], missed: [] },
  false_positives: [],
  excused_extras: [],
  summary: {},
};

const emit = () => {
  const s = report.summary;
  s.divergence_recall = +(report.divergences.found.length / golden.divergences.length).toFixed(3);
  s.false_positive_count = report.false_positives.length;
  s.finding_count = report.findings.length;
  s.quality_pass = s.divergence_recall >= 0.8 && s.false_positive_count <= 1;
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
};

if (!existsSync(reportPath)) {
  report.divergences.missed = golden.divergences.map((d) => d.id);
  emit();
}

const text = readFileSync(reportPath, "utf8");

// split into findings: ## sections preferred, top-level bullets as fallback,
// whole document as last resort
let findings = text
  .split(/^##\s+/m)
  .slice(1)
  .map((s) => ({ title: s.split("\n")[0].trim(), text: s }));
if (findings.length === 0) {
  findings = text
    .split(/^[-*]\s+/m)
    .slice(1)
    .map((s) => ({ title: s.split("\n")[0].trim().slice(0, 80), text: s }));
}
if (findings.length === 0 && text.trim()) {
  findings = [{ title: text.trim().split("\n")[0].slice(0, 80), text }];
}
// an explicit all-clear is zero findings, not one false positive
if (findings.length === 1 && /no\s+divergences?\s+found/i.test(findings[0].text)) {
  findings = [];
}
report.findings = findings.map((f) => f.title);

const norm = (s) => s.toLowerCase().replace(/[_\s-]/g, "");
const has = (finding, term) => norm(finding.text).includes(norm(term));
const matches = (finding, fp) =>
  fp.must_all.every((t) => has(finding, t)) &&
  (!fp.must_any?.length || fp.must_any.some((t) => has(finding, t)));

// one-to-one assignment, most-constrained divergence first
const candidates = golden.divergences.map((d) => ({
  d,
  hits: findings.filter((f) => matches(f, d)),
}));
const used = new Set();
for (const { d, hits } of [...candidates].sort((a, b) => a.hits.length - b.hits.length)) {
  const pick = hits.find((f) => !used.has(f));
  if (pick) {
    used.add(pick);
    report.divergences.found.push(d.id);
  } else {
    report.divergences.missed.push(d.id);
  }
}

// unmatched findings: excused if they hit an allowed fingerprint, else FP
for (const f of findings) {
  if (used.has(f)) continue;
  const excused = (golden.allowed_extra_findings ?? []).some((terms) =>
    terms.every((t) => has(f, t))
  );
  if (excused) report.excused_extras.push(f.title);
  else report.false_positives.push(f.title);
}

emit();
