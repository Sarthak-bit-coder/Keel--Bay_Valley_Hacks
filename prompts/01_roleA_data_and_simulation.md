# Role A: Data and simulation

**Who:** Friend 1 (Claude Code). **Branch:** `a/data`. **Owns:** `data/`, `src/data/`, `tests/test_data.py`.
**Tool plan:** use Claude Code for everything. Keep sessions short and file-focused. Run downloads yourself in a terminal; don't have the agent loop on large files.

## Goal
Produce `data/weekly_earnings.csv` exactly as defined in `CONTRACT.md`: simulated gig drivers whose weekly earnings are driven by real NYC ride-hail data, weather and holidays.

## Paste this into Claude Code

```
[paste prompts/00_shared_context.md first]

You are Role A (data and simulation). Work only in data/, src/data/, tests/test_data.py on branch a/data.

Task:
1. Write src/data/download.py to fetch 12 months of NYC TLC High Volume For-Hire Vehicle trip records (monthly parquet files, from the NYC TLC trip record data page) into data/raw/ (git-ignored). Use only the months needed. If the TLC site cannot be reached, say so and stop; do not make up data.
2. Write src/data/build_weekly.py that: loads the parquet with only the needed columns (pickup datetime, trip_time, driver_pay, tips, base_passenger_fare if present); aggregates demand and average pay per hour and per day; calls Open-Meteo's free historical weather API for NYC (daily temp, precipitation, snowfall) and adds US federal holidays.
3. Simulate drivers A, B, C (more if cheap): A full-time steady (about 38 hours/week), B part-time (about 22), C weekend-only and volatile (about 12). Each week a driver works a random number of hours drawn around their mean, with extra hours less likely in bad weather. Weekly gross_payout = hours x market pay per hour for the hours worked (use the real hourly pay profile) + tips, plus small noise. Fix random seeds.
4. Write data/weekly_earnings.csv with the exact columns in CONTRACT.md. Split by time: oldest 60% train, next 20% calib, newest 20% test. is_simulated is always true.
5. Write data/README.md: which months, how drivers were built, and what is real vs simulated.
6. Add tests/test_data.py: columns match CONTRACT.md, no negative payouts, split is time-ordered, no nulls.

Be ready to explain every modeling choice in plain English. After each step, show me the commands to run and what output to expect.
```

## Timeline
- **10:00 to 10:45:** download one month and load it. **Gate 1: if this fails by 10:45, tell the team and we switch to the fallback idea.**
- **10:45 to 11:15:** write down the weekly CSV columns with B and C; commit a 3-row `data/sample_weekly_earnings.csv` so B can start.
- **11:15 to 1:00 PM:** weather, holidays, driver simulation, full CSV.
- **1:00 PM Gate 2:** plot a few simulated drivers' weekly earnings. They should swing a lot (a bad week roughly half a good one). If they look flat or absurd, fix the simulation before anything else.
- **1:00 to 2:30 PM:** tests, `data/README.md`, merge to main. Then help B (feature ideas, sanity checks) and C (screenshots, copy).

## Definition of done
- `python src/data/build_weekly.py` produces the CSV from scratch.
- Tests pass. Contract matches.
- README states clearly that drivers are simulated.

## If you fall behind
Skip real weather first (use a made-up snowstorm week and say so). Keep one month of TLC data. Three drivers is enough.
