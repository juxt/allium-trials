# Fineract substrate — report

The scale phase runs against a pinned real codebase so the experiments stop saturating and
the ground truth is upstream-authored (no self-seeding). This report is the eyes-open map.

## Pin

- Repo: apache/fineract  ·  tag **1.15.0**  ·  sha `d5636847ac556c30b437254c353f05526d172b97`
- Reproduce: `git clone --filter=blob:none https://github.com/apache/fineract && git checkout 1.15.0`
- The checkout is gitignored (120MB); we pin by SHA, not by vendoring. See `PIN`.

## Build environment

- Requires **JDK 21** (README: "Java 21 or higher") — available locally (Oracle 21.0.10).
- Gradle wrapper 8.14.5 (auto-downloaded). Docker running (for integration/DB tests, later).
- Multi-module: ~35 `fineract-*` modules. The heavy integration tests need a database and
  Docker — a known constraint we DO NOT fight in the first cut; we use DB-free UNIT tests.

## Chosen subsystem: fineract-progressive-loan (the EMI schedule engine)

The modern, self-contained loan schedule/interest engine. 81 source files, 13 unit tests,
all DB-free (Mockito), so the ground-truth oracle runs locally without infrastructure.

Core: `ProgressiveEMICalculator` (2204 lines) + `ProgressiveEMICalculatorTest` (5414 lines).
The tests pin the schedule numerically (`checkPeriod(emi, ..., interest, principal, balance)`),
which is exactly the salient behaviour a change must preserve.

## The salient invariants (distilled -> LoanScheduleInvariants.allium)

From the code and the test's `checkPeriod` assertions, seven load-bearing invariants:
EMI-constancy, interest-on-outstanding, principal = EMI - interest, balance roll-forward,
balance monotonicity, principal conservation (sums to disbursed), and closes-to-zero. The
2204-line calculator is machinery serving these.

## What v4 supports on real logic (honest)

- **Expressibility: YES.** v4 PARSES the reference invariant spec clean, including the
  arithmetic (`rate * balance`, `emi - interest`, `sum p :: principal(p) = disbursed`). The
  language can state the salient invariants of real loan logic.
- **Checkability: PARTIAL.** Invariants 2-6 are arithmetic; the v4 analyse PROTOTYPE is
  boolean-SAT only, so it cannot yet evaluate them (it would treat `*`/`sum` as opaque). The
  language design admits linear integer arithmetic + aggregates (NON-GOALS scope line); the
  prototype has not reached that tier. This is the first concrete substrate finding: real
  financial logic needs the arithmetic tier before analyse checks it.

## Ground-truth oracle status

**WORKS.** `JAVA_HOME=<jdk21> ./gradlew :fineract-progressive-loan:test` — after a one-time
3m41s build, runs **181 DB-free unit tests, all green, in 6.1s**. That is fast enough to be a
regression oracle across many evolution runs, and it includes `ProgressiveEMICalculatorTest`,
which pins the salient schedule invariants numerically. A held-out subset of these is the
hidden regression oracle for the evolution-at-scale arms.

## Next (still autonomous)

- Have a model DISTIL the subsystem into an Allium spec and SCORE it against the reference
  above (the first distil-at-scale measurement: is the model's distil faithful/complete?).
- Then design the evolution-at-scale arms (spec-grounded vs not, held-out unit tests as the
  regression oracle) — the point to check in with the human, since the arm design is a call.
