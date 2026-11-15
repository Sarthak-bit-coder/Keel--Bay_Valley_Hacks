# Where Keel loses

From the real run on 2026-11-15 (`outputs/results.json`, `outputs/calibration.json`): 3 simulated drivers, 11 test weeks each, normal and injected-storm scenarios, risk limits 1/5/10/20%. Pass marks are from `docs/preregistration.md`, set before the run. Nothing was tuned on test weeks.

## Scorecard against the pre-registered questions

| Question | Pass mark | Result | Verdict |
|---|---|---|---|
| 1. Calibration | low case right 85-95% of test weeks | 90.9% overall (78.8% before calibration) | **Pass** |
| 2. Buffer safety | fewer empty-buffer weeks than both simple rules, each limit | Keel 0, 4-week avg 15, last week 4, at every limit | **Pass** |
| 3. Paycheck steadiness | Keel's paycheck swing at least 30% below earnings swing | passes 2 of 24 runs | **Fail** |
| 4. Cost (reported either way) | none | Keel pays $73 / $50 / $39 / $20 a week less than the 4-week average, at 1 / 5 / 10 / 20% | Reported |

## 1. Keel's paycheck is not steadier than the earnings (question 3 fails)

Paycheck swing (best week minus worst week) vs take-home earnings swing:

| Driver | Normal, 1% → 20% | Storm, 1% → 20% | Earnings swing (normal / storm) |
|---|---|---|---|
| A | $630, 485, 425, 340 | $905, 1070, 1080, 1180 | $382 / $848 |
| B | $610, 630, 705, 840 | $655, 690, 750, 785 | $906 / $906 |
| C | $410, 430, 450, 490 | $400, 440, 455, 510 | $569 / $569 |

For driver A, Keel's paycheck swings **more** than the earnings in both scenarios.

**Why:**
- **It ramps up from a small buffer.** The starting buffer is half a week's pay, so Keel opens low and climbs as the buffer fills. Driver A, normal, 1%: $700 in week 1, $1,330 in week 11. That climb alone is the swing.
- **It re-picks the salary from scratch every week.** The rule has no limit on how far pay can move from one week to the next, so a wide forecast band one week becomes a pay cut the next. Driver C, storm, 20%, paid $65, 280, 205, 50, 180, 120, 155, 95, 130, 290, 560.
- **It hoards.** Driver A's buffer never dropped below $1,072 at 1%, so money that could have smoothed pay sat unused.

The 4-week average rule is the steadiest of the three (e.g. driver A normal: $111 swing). It buys that steadiness with 15 empty-buffer weeks.

## 2. Keel pays less on average

At 1%, Keel pays about $73 a week less than the 4-week average rule, and $20 less at 20%. The difference goes into the buffer. This is the price of zero empty-buffer weeks.

## 3. The low case is too optimistic for the volatile driver

The overall hit rate passes (90.9%), but by driver it is A 100%, B 90.9%, C 81.8%. Driver C (weekends, weeks off) falls below the 85% mark. Calibration is pooled across drivers, so the steady driver hides the volatile one. With only 11 test weeks per driver, one week moves this by 9 points.

## Limits of this run

- Drivers are simulated. Weekly hours are random draws, and utilization is an assumed 0.55.
- The storm is injected (two weeks cut to 45% and 60%), not a real storm.
- 33 test driver-weeks in total, so every rate here is noisy.
- `data/weekly_earnings.csv` came from Role B's stand-in `src/data/build_weekly.py`, not Role A's final build.

## Fixes we did not make (they would mean tuning on test weeks)

A cap on week-to-week pay changes, a larger starting buffer, or calibration per driver. Any of these needs new pre-registered pass marks and fresh test weeks.
