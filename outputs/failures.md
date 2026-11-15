# Where Keel loses

From the real run on 2026-11-15 on Role A's `data/weekly_earnings.csv` (3 simulated drivers on real NYC TLC hours, real weather): 11 test weeks per driver (2025-10-20 to 2025-12-29), risk limits 1/5/10/20%.

- **normal** = the real test weeks as Role A simulated them, including the real December snow.
- **storm** = stress test: the two snowiest real test weeks (Dec 8-14, 8.8 cm; Dec 22-28, 10.1 cm) cut to 45% and 60% of what the driver earned.

Pass marks are from `docs/preregistration.md`, set before the run. Nothing was tuned on test weeks.

## Scorecard

| Question | Pass mark | Result | Verdict |
|---|---|---|---|
| 1. Calibration | low case right 85-95% of test weeks | 90.9% (81.8% before calibration) | **Pass** |
| 2. Buffer safety | fewer empty-buffer weeks than both simple rules, each limit | Keel 1 / 2 / 2 / 5 vs 4-week avg 17 and last week 12, at 1 / 5 / 10 / 20% | **Pass** |
| 3. Paycheck steadiness | Keel's paycheck swing at least 30% below earnings swing | passes 14 of 24 runs | **Mixed** |
| 4. Cost (reported either way) | none | Keel pays $57 / $44 / $38 / $27 a week less than the 4-week average | Reported |

## 1. Keel still ran dry, on a week the driver earned $0

Driver A took a whole week off in Dec 15-21 (Role A's 4% "week off" chance), so take-home was $0. Keel had already set that week's paycheck ($770 to $1,105), and the buffer went below zero:

| Run | Weeks below zero | Lowest buffer |
|---|---|---|
| A normal 20% | 1 (Dec 15) | -$35 |
| A storm 1% / 5% / 10% / 20% | 1 / 2 / 2 / 2 | -$487 / -$722 / -$817 / -$942 |
| C storm 20% | 2 (both storm weeks) | -$36 |

**Why:** the forecast band does not expect a $0 week right after a normal one, and the storm cut on Dec 8 had already drained A's buffer. In the storm runs Keel paid $0 the following week to recover. The simple rules ran dry far more often (17 and 12 weeks at every limit).

## 2. Keel's paycheck is not always steadier than the earnings (question 3)

Passes 14 of 24. Fails:
- **Driver A, storm (all 4 limits):** paycheck swing $1,350-1,365 vs earnings swing $1,348. The $0 recovery week after the empty week makes the swing.
- **Driver B, normal (all 4) and storm at 1% / 5%:** B's earnings are already fairly steady ($341 swing in normal weeks), so Keel's $300-400 swing is not 30% smaller.

Driver C (the volatile one) passes in every run: $170-365 swing vs $701.

## 3. Keel pays less on average

$57 a week less than the 4-week average at 1%, $27 at 20%. The difference goes into the buffer.

## 4. The low case is too optimistic for the volatile driver

Low-case hit rate by driver: A 90.9%, B 100%, C 81.8%. C is below the 85% mark. Calibration is pooled across drivers, so the steady drivers hide C. With 11 test weeks per driver, one week moves this by 9 points.

## Limits of this run

- Drivers are simulated; schedules, skip chances and the 0.55 utilization are Role A's assumptions (data/README.md).
- The storm scenario is a stress test placed on the real snow weeks, not the real outcome; the real outcome is the normal scenario.
- 33 test driver-weeks, so every rate is noisy.

## Fixes we did not make (they would mean tuning on test weeks)

A cap on week-to-week pay changes, a larger starting buffer, allowing for $0 weeks in the forecast, per-driver calibration. Each needs new pre-registered pass marks and fresh test weeks.
