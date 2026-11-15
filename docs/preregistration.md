# Pre-registration (commit this before the first real run)

We write the questions, the rules we compare against, and the pass marks first. After the real run starts, we do not change them. If we change something, we add a dated note below and report both versions.

## Questions

1. **Calibration.** Is Keel's low-case forecast at or above the actual take-home pay about 90% of the time on test weeks?
   - Pass mark: between ____ and ____ (decide now; for example 85% to 95%).
2. **Buffer safety.** Does Keel leave the buffer empty in fewer weeks than each simple rule, at the same risk limit?
   - Pass mark: ____ (for example, fewer empty-buffer weeks than both rules across all test weeks).
3. **Paycheck steadiness.** Is the swing between Keel's best and worst weekly paycheck smaller than the swing in take-home earnings?
   - Pass mark: ____ (for example, at least 30% smaller).
4. **Cost.** How much less does Keel pay per week on average than the 4-week-average rule? We report it either way.

## Rules we compare against

- **Last week's pay:** this week's paycheck equals last week's take-home earnings.
- **4-week average:** this week's paycheck equals the mean take-home earnings of the last four weeks.

All three rules start with the same buffer (half a week of average take-home pay) and run on the same weeks.

## Data split

- Time-ordered: oldest weeks for training, the next block for calibration, the newest ____ weeks for the test. Never shuffle.
- The test weeks are looked at once, at the end.

## What we report

- Every variant we tried, not only the best one.
- Where Keel loses (`outputs/failures.md`).
- That drivers are simulated and conformal coverage is approximate.

## Change log

(date, what changed, why)
