# Data (Role A)

**All drivers are simulated.** The NYC TLC records have no driver ID, so no row here is a real person's earnings. The market they drive in is real: pay per hour, how busy each hour was, trip length, weather and holidays. Not financial or tax advice.

## Rebuild

```bash
python src/data/build_weekly.py              # about 5 s, uses the committed hourly_market.csv and weather_daily.csv
python src/data/download.py                  # optional: 13 TLC parquet files (6 GB) into data/raw/
python src/data/build_weekly.py --rebuild    # optional: re-aggregate from data/raw/ and re-fetch weather
python src/data/gate2_plot.py                # swing check + data/gate2_weekly_earnings.png (needs matplotlib)
python -m pytest tests/test_data.py -q
```

## Files

| File | Real or simulated | What it is |
|---|---|---|
| `weekly_earnings.csv` | **Simulated drivers** on real inputs | The CONTRACT file: 3 drivers x 52 weeks = 156 rows |
| `sample_weekly_earnings.csv` | Simulated | Week 1 (2025-01-06) rows of `weekly_earnings.csv`, identical values |
| `hourly_market.csv` | Real | One row per hour, 2025-01-06 to 2026-01-04 (8,736 rows): trips, hours on trips, driver pay + tips. Aggregated from every TLC high-volume trip |
| `weather_daily.csv` | Real | Open-Meteo daily mean temperature, precipitation, snowfall for NYC (40.71, -74.01), 364 days |
| `daily_market.csv` | Real | One row per day (396 days, Jan 2025 to Jan 2026): trips, hours on trips, pay, tips |
| `trip_sample.csv` | Real | 1,200 raw trips (100 random per month of 2025). HV0003 is Uber, HV0005 is Lyft (TLC data dictionary). `driver_pay` excludes tips |
| `gate2_weekly_earnings.png` | Simulated | Gate 2 plot of weekly earnings |
| `raw/` | Real | TLC parquet files, git-ignored (binary, about 0.5 GB each) |

## Sources

- **Trips and pay:** NYC TLC High Volume For-Hire Vehicle trip records, monthly parquet files 2025-01 to 2026-01 (`src/data/download.py`). Gate 1 passed: 2025-01 alone has 20,405,666 trips. Pay is `driver_pay + tips`, because TLC reports tips separately. Rows with negative pay (adjustments) are kept in the sums.
- **Weather:** Open-Meteo historical archive API, daily, `America/New_York` time zone.
- **Holidays:** the 11 US federal holidays (OPM) between 2025-01-06 and 2026-01-04, hard-coded in `build_weekly.py`. Jan 9, 2025 (the national day of mourning closure) is not counted.

## Weeks and split

52 full Monday-start weeks, Mon 2025-01-06 to Sun 2026-01-04 (only the first 4 days of the 2026-01 file are used). Same weeks for every driver, split by time and never shuffled:

| Split | Weeks | Dates (week starts) |
|---|---|---|
| `train` | 31 | 2025-01-06 to 2025-08-04 |
| `calib` | 10 | 2025-08-11 to 2025-10-13 |
| `test` | 11 | 2025-10-20 to 2025-12-29 |

`temp_c` is the mean of the 7 daily means; `precip_mm` and `snow_cm` are 7-day totals; `holiday_days` counts federal holidays Monday to Sunday.

## Snowstorms (for the `storm` scenario)

Real, not injected. The snowiest weeks in the data:

| Week of | Snow (cm) | Split |
|---|---|---|
| 2025-02-03 | 10.5 | train |
| 2025-12-22 | 10.1 | test (includes Dec 26 to 27 snow, 8.6 cm, and Christmas) |
| 2025-12-08 | 8.8 | test (Dec 14 snow, 8.0 cm) |
| 2025-02-10 | 6.3 | train |

Both December storms are in the test weeks, so a storm replay can use real held-out weeks. Which window the `storm` scenario replays is Role B's choice; tell Role C.

## How drivers are simulated

Each driver has a weekly schedule of clock hours. For every scheduled day, the driver may skip the day; if not, they drive that day's hours times a random spread. For every clock hour they drive, earnings come from the **real** market in that exact hour:

```
on-trip hours  = hours logged in x utilization(that hour)
gross_payout   = sum over hours of on-trip hours x real (pay + tips) per on-trip hour, x weekly noise
trips          = sum over hours of on-trip hours x 60 / real minutes per trip in that hour
utilization    = 0.55 x sqrt(trips that hour / usual trips for that hour of the week), clipped to 0.35 to 0.75
skip chance    = base + snow_k x min(snow cm, 10)/10 + rain_k x min(rain mm, 25)/25 (+ holiday_skip on a holiday)
```

| | A: full-time, steady | B: part-time | C: weekend-only, volatile |
|---|---|---|---|
| Schedule | Mon-Fri 7am-3pm, Sat 9-11am (42 h) | Mon-Thu 5-9pm, Sat 11am-7pm (24 h) | Fri and Sat 6pm-midnight, Sun noon-4pm (16 h) |
| Skip a day, base | 5% | 6% | 15% |
| Extra skip at 10+ cm snow / 25+ mm rain | +35% / +5% | +50% / +10% | +70% / +20% |
| Extra skip on a federal holiday | +60% | +30% | 0 |
| Day-to-day hours spread (lognormal sigma) | 0.15 | 0.15 | 0.30 |
| Whole week off (sick, travel, car repair) | 4% | 5% | 10% |
| Random seed | 101 | 202 | 303 |

Weekly noise (trip mix, luck) is lognormal with sigma 0.05 for everyone.

**Every number in that table, and the 0.55 utilization, is our assumption. None is measured or taken from a published source.** The square root means an hour with 20% more trips than usual gives the driver about 10% more time on trips, not 20%, because other drivers also log in when it is busy.

## Result (Gate 2)

| Driver | Mean hours/week | Mean gross/week | Gross per logged-in hour | Worst / best week | p10 / p90 week | Weeks with $0 |
|---|---|---|---|---|---|---|
| A | 38.4 | $1,338 | $34.92 | $0 / $1,685 | 0.73 | 1 |
| B | 21.1 | $752 | $35.70 | $0 / $1,019 | 0.59 | 4 |
| C | 13.3 | $481 | $36.07 | $0 / $824 | 0.42 | 1 |

Gate 2 rule, written down before the second run: every driver's worst week at most 60% of their best; B and C p10/p90 between 0.35 and 0.65; A (the steady profile) up to 0.80. **Pass.** In the first run A was too flat (p10/p90 0.80), so A got more skipped days and day-to-day spread. Both runs are recorded in `src/data/gate2_plot.py`.

$0 weeks are whole weeks off. Gross pay is before the driver's own costs (fuel, insurance, car), which are not modeled.
