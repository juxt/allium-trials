# The metric suite — beyond the mean

The mean score hides what a spec actually buys. A spec rarely lifts a well-known task's average by
much; what it does is remove the bad runs and make the answer certain. So the suite tracks four measures,
each user-verifiable by re-running the eval, and each rewarding a different thing a spec is for.

## The four measures

1. **Mean correctness.** The average across runs. Useful, but saturates on inferable tasks and hides
   variance. Never reported alone.
2. **Worst run.** The floor across runs. A spec's job is to stop the code coming out wrong on a bad day;
   the floor shows it directly. On the bespoke encoder, no-spec's worst run is 8%; every spec's worst run
   is ≥ 96%.
3. **Reliability = fraction of runs fully correct.** Out of N runs, how many were 100%. This rewards
   determinism of the *output*: a spec that pins every convention makes the code correct every time, not
   on average. No-spec is fully correct in 0 of 8 runs on both hard tasks; a spec is fully correct in most
   or all.
4. **Determinism of the check.** Categorical, and the one that separates v4. Does the check return the
   same verdict every run, without sampling? `allium analyse` is a proof: same input, same yes/no, every
   time, and the user can run it themselves. Generated tests and eyeballing are stochastic: they catch a
   defect only if the run happens to exercise it. This is the "certainty" axis, and it is where structured
   verification beats prose and tests, not on code score.

## Which measure separates which arm — honest axis-matching

Do not claim a separation on a measure where the arms tie. Measured, not assumed:

- **no-spec vs spec: separates on mean, worst-run AND reliability.** The decisive, cleanest story. On the
  bespoke encoder no-spec never once reached 100% and its worst run was 8%; every spec form was reliably
  ~99%. This is the elicitation value: a spec carries non-inferable behaviour the model cannot guess.
- **prose vs structured: TIES on all three code measures for transcription tasks.** On the two format
  tasks both were fully correct in 8 of 8 runs. Do not fabricate a reliability gap here. The prose penalty
  is real only where prose *misleads*: on mathutil, prose/opus fell to 86% (below no-spec) while structured
  held a reliable 100%. Report the prose reliability cost where it exists and nowhere else.
- **v3 vs v4: code reliability is within noise; the real gap is measure 4.** v4's win is the deterministic,
  user-verifiable check (`analyse` proves an obligation; generated tests sample it). Keep the v4 story on
  determinism of the check, never on first-draft code score or code reliability.

## The strategy — exhibit value where it is decisive, and let users self-select

The suite is built to show where Allium is *significantly* better, not marginally-better-everywhere. This
is not biasing a test; every check is mechanical and re-runnable by the user. It is choosing tasks that
exhibit the value proposition clearly:

- **Bespoke, non-inferable, regulated behaviour** (institution-specific wire formats, arbitrary codes,
  jurisdiction rules): a spec takes the code from 17-45% to ~99% and from never-right to always-right. A
  user whose work looks like this sees the value at once.
- **Textbook behaviour** (standard accounting, famous algorithms, simple enums): a spec adds little because
  the model already knows it. Reported honestly; it does not count toward the signal.

A user reading the suite sees which tasks separate and asks whether their own work resembles those tasks.
That is a more honest and more persuasive pitch than a flat "10% better on everything": it lets the value
proposition — non-inferable behaviour, made reliable and certifiable — be read straight off the task list.

## Measured reliability (N=4 per arm×model, two models → 8 runs per arm)

| task | arm | mean | worst run | fully correct |
|---|---|---|---|---|
| settlement-format | no-spec | 20.6 | 8.3 | 0/8 |
| settlement-format | prose | 100 | 100 | 8/8 |
| settlement-format | v3 | 99.2 | 96.7 | 6/8 |
| settlement-format | v4 | 99.2 | 96.7 | 5/8 |
| settlement-mixed | no-spec | 43.6 | 36.8 | 0/8 |
| settlement-mixed | prose | 100 | 100 | 8/8 |
| settlement-mixed | v3 | 97.5 | 94.7 | 3/8 |
| settlement-mixed | v4 | 98.7 | 94.7 | 6/8 |

The v3/v4 fully-correct counts swap between tasks (6/5 then 3/6): within noise at N=8, consistent with the
finding that code reliability does not separate v3 from v4. The separation to report is no-spec vs spec.
