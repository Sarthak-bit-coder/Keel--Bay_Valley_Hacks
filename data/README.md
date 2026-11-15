# Data (Role A)

**All drivers are simulated.** The NYC TLC records have no driver ID, so no row here is a real person's earnings. The market inputs (pay per hour, trip length, weather, holidays) are real.

## Sources

| What | Source | Status |
|---|---|---|
| Trips, driver pay, tips | NYC TLC High Volume For-Hire Vehicle trip records, monthly parquet, 2025-01 to 2026-01 (`src/data/download.py`) | Downloaded and loaded (Gate 1 passed: 2025-01 has 20,405,666 trips) |
| Weather | Open-Meteo historical archive API, NYC (40.71, -74.01), daily mean temperature, precipitation, snowfall | Works (checked for 2025-01-06 to 2025-01-12) |
| Holidays | US federal holidays | To do |

Raw parquet files live in `data/raw/` and are git-ignored.

## Weeks

52 full Monday-start weeks, from Mon 2025-01-06 to Sun 2026-01-04. Only the first 4 days of the 2026-01 file are used. Split by time: oldest 31 weeks `train`, next 10 `calib`, newest 11 `test` (60/20/20).

## `sample_weekly_earnings.csv` (3 rows, for Role B to start on)

Week of 2025-01-06, drivers A (38 h), B (22 h), C (12 h). Real inputs from that week: market pay $63.81 per on-trip hour (`driver_pay` + `tips`, which TLC reports separately), mean trip 17.85 min, weather from Open-Meteo, no holidays.

Simulated parts: hours, and an **assumed utilization of 0.55** (share of logged-in hours spent on a trip). This number is our assumption, not measured, and is unverified. `gross_payout = hours x 0.55 x 63.81`, `trips = hours x 0.55 x 60 / 17.85`.

The full `weekly_earnings.csv` (`src/data/build_weekly.py`) is in progress.
