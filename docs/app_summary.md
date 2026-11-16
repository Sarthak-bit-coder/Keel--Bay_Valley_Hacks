# Keel: complete summary

Checked against `main` at 7:55 PM, Nov 15 2026 (after PR #29). Every number below was re-read from the repo's files and every test was re-run. An earlier version of this summary described `main` as of PR #21 (4:10 PM); what changed since is listed in section 8.

## 1. One paragraph

Keel is a demo of a paycheck for gig workers. Gig income is jagged (a good week, then a snowstorm or holiday halves it), but rent is fixed. Keel sits between the gig apps and checking: payouts land in a buffer, a share is set aside for tax, and every week Keel pays a flat salary. The salary is the highest amount whose simulated chance of emptying the buffer stays under a risk limit the worker picks (1%, 5%, 10% or 20%). A LightGBM model forecasts a low / middle / high case for next week's take-home pay, conformal calibration makes the low case honest, and a Monte Carlo test picks the salary. It is proven on three simulated ride-hail drivers built on real NYC ride-hail data, and a sign-in page lets any freelancer try the same rule on their own weekly pay. No real people, no real money, not financial or tax advice.

- **Event:** Bay Valley Hacks 2026 (online, Nov 15 2026, grades 9 to 12). Theme: "Elevate the Ordinary." Tracks: Best AI/ML, Best Fintech, Best Overall.
- **Deadline:** final submission 10:00 PM, aim for 9:00 PM. Every team submits a video.
- **Name:** two other Devpost projects are called "Keel"; the README suggests keeping the name with a subtitle or renaming.
- **Team:** A = data and simulation (branch `a/data`), B = forecast, salary rule, evaluation (`b/ml`), C = app, write-up, video, submission (Brij, `c/app`).
- **Live site:** https://sarthak-bit-coder.github.io/Keel--Bay_Valley_Hacks/ (GitHub Pages from `main`, repo root).

## 2. Pipeline

```
NYC TLC trips (13 monthly parquet files)  ─┐
Open-Meteo daily weather (NYC)             ├─> src/data/build_weekly.py ─> data/weekly_earnings.csv
US federal holidays (11, hard-coded)      ─┘      (3 SIMULATED drivers x 52 weeks)
                                                         │
                                  src/model/train.py (LightGBM quantiles + conformal) ─> outputs/calibration.json
                                                         │
                       eval/run_eval.py (forecast -> Monte Carlo salary -> replay vs 2 simple rules)
                                                         │
                                       outputs/results.json (24 runs)  +  outputs/failures.md (hand-written)
                                                         │
                       index.html (homepage) and app/index.html (Paycheck / Plan / Evidence) read the JSON
```

`python run_all.py` runs the three steps with the same Python interpreter, stops with "Step failed" if one errors, and ends with "Done. See outputs/results.json". **Checked on a fresh clone at 7:50 PM: it reproduces `outputs/results.json` and `outputs/calibration.json` exactly (only the timestamp differs).**

### 2.1 Data and simulated drivers (Role A)

Real inputs:
- NYC TLC High Volume For-Hire Vehicle trips, monthly parquet 2025-01 to 2026-01 (13 files, about 0.5 GB each, git-ignored in `data/raw/`). Gate 1 passed: January 2025 has 20,405,666 trips. `src/data/download.py` stops on anything but HTTP 200 ("Not making up data").
- Open-Meteo historical archive, daily mean temperature, precipitation, snowfall, NYC (40.7128, −74.0060), America/New_York.
- 11 US federal holidays from 2025-01-06 to 2026-01-04. Jan 9, 2025 (national day of mourning) is not counted.

Committed caches (small):

| File | Contents |
|---|---|
| `data/hourly_market.csv` | 8,736 hours: trips, hours on trips, driver pay + tips |
| `data/daily_market.csv` | 396 days: trips, trip hours, pay, tips, mean trip minutes, pay per trip-hour |
| `data/weather_daily.csv` | 364 days of weather |
| `data/trip_sample.csv` | 1,200 raw trips (100 per month of 2025). HV0003 = Uber, HV0005 = Lyft |
| `data/weekly_earnings.csv` | The contract file: 3 drivers x 52 weeks = 156 rows |
| `data/sample_weekly_earnings.csv` | Week 1 rows of the full file |
| `data/gate2_weekly_earnings.png` | Gate 2 plot |

Pay is `driver_pay + tips`. Negative-pay adjustments stay in the sums. The weekly build takes about 5 seconds from the caches; `--rebuild` re-aggregates from the raw files and re-fetches weather.

Weeks and split (time-ordered, never shuffled, same weeks for every driver):

| Split | Weeks | Week starts |
|---|---|---|
| train | 31 | 2025-01-06 to 2025-08-04 |
| calib | 10 | 2025-08-11 to 2025-10-13 |
| test | 11 | 2025-10-20 to 2025-12-29 |

How a simulated driver earns: each scheduled day may be skipped; otherwise the driver drives that day's hours times a random spread, and each clock hour earns from the real market in that exact date and hour.

```
on-trip hours  = hours logged in x utilization(that hour)
gross_payout   = sum over hours of on-trip hours x real (pay + tips) per on-trip hour, x weekly noise
trips          = sum over hours of on-trip hours x 60 / real minutes per trip in that hour
utilization    = 0.55 x sqrt(trips that hour / usual trips for that hour of the week), clipped to 0.35..0.75
skip chance    = base + snow_k x min(snow cm, 10)/10 + rain_k x min(rain mm, 25)/25 (+ holiday_skip), capped at 0.95
```

| | A: full-time, steady | B: part-time | C: weekend-only, volatile |
|---|---|---|---|
| Schedule | Mon–Fri 7am–3pm, Sat 9–11am (42 h) | Mon–Thu 5–9pm, Sat 11am–7pm (24 h) | Fri, Sat 6pm–midnight, Sun noon–4pm (16 h) |
| Base skip | 5% | 6% | 15% |
| Extra skip at 10+ cm snow / 25+ mm rain | +35% / +5% | +50% / +10% | +70% / +20% |
| Extra skip on a holiday | +60% | +30% | 0 |
| Day-to-day spread (lognormal σ) | 0.15 | 0.15 | 0.30 |
| Whole week off | 4% | 5% | 10% |
| Seed | 101 | 202 | 303 |

Every number in that table, and the 0.55 utilization, is the team's assumption, not measured. Gross pay is before the driver's own costs.

Gate 2 (rule written before the second run: worst week ≤ 60% of best; B and C p10/p90 0.35 to 0.65; A up to 0.80): **pass**.

| Driver | Mean gross/week | Mean hours/week | Worst / best week | $0 weeks |
|---|---|---|---|---|
| A | $1,338 | 38.4 | $0 / $1,685 | 1 |
| B | $752 | 21.1 | $0 / $1,019 | 4 |
| C | $481 | 13.3 | $0 / $824 | 1 |

Real snow weeks: 2025-02-03 (10.5 cm, train), 2025-12-22 (10.1 cm, test), 2025-12-08 (8.8 cm, test), 2025-02-10 (6.3 cm, train).

### 2.2 Forecaster (Role B, `src/model/train.py`)

- Target: next week's take-home `net = gross x 0.85` (15% tax is illustrative).
- Three LightGBM quantile models (10%, 50%, 90%): 150 trees, learning rate 0.05, 7 leaves, min 5 samples per leaf, deterministic, seed 0, pooled over drivers.
- 7 features: last 4 weeks' take-home as ratios to the trailing 4-week mean, their standard deviation, last week's hours relative to its trailing mean, holidays in the target week. Weather and target-week hours are left out (not known in advance).
- Rows: 27 train weeks per driver (81), 10 calib (30), 11 test (33).
- Predictions sorted low ≤ middle ≤ high, floored at $0.
- Conformal calibration (hand-written): one-sided split conformal, the ⌈(n+1) x 0.9⌉-th smallest score (28th of 30). `requirements.txt` lists `mapie`, but no script imports it.
- Coverage is approximate because weekly earnings are autocorrelated.
- **Result (`outputs/calibration.json`):** target 90%; 90.9% after calibration (30 of 33), 81.8% before; A 90.9%, B 100%, C 81.8%.

### 2.3 Salary rule (`src/policy/salary.py`)

1. Turn the calibrated low / middle / high into 400 paths x 4 weeks (two-piece normal, 10% and 90% points at low and high, z = 1.2816, floored at $0).
2. Try paychecks from `ceil(middle x 1.3 / 5) x 5` down to $0 in $5 steps.
3. For each, share of paths where the buffer goes below zero within 4 weeks.
4. Keep the highest paycheck with risk ≤ limit; if even $0 is too risky, pay $0 and report the risk.
5. Common random numbers: one fixed 400 x 4 matrix (seed 999) for every paycheck, week and driver.

Stated shortcut: the 4 horizon weeks are drawn independently from next week's forecast.

Baselines (`src/policy/baselines.py`): last week's take-home; mean of the last 4 weeks. All three rules start with the same buffer (half a week of average take-home over the 8 weeks before the test window), and `buffer += take-home − paycheck`.

### 2.4 Evaluation (`eval/run_eval.py`)

- 24 runs = 3 drivers x 2 scenarios x 4 limits, each over the 11 test weeks.
- `normal`: the real test weeks. `storm`: a stress test that cuts the two snowiest test weeks (Dec 8, Dec 22) to 45% and 60% after forecasting; `storm_weeks: [8, 10]`.
- Each week stores gross, net, low, high, the three paychecks and buffers, Keel's risk, and a plain-English reason ("Chose $1,100 so the chance of running dry in the next 4 weeks is about 1% (limit 1%).").
- Hard checks: identity (gross = paycheck + tax + buffer change, to the cent) and paycheck ≥ 0 hold in all 24 runs. Buffer ≥ 0 is reported honestly and fails in 6: A normal 20%; A storm 1%, 5%, 10%, 20%; C storm 20%.

### 2.5 Results at the 5% limit (`outputs/results.json`)

| Driver / scenario | Empty weeks Keel / 4-wk / last | Avg paycheck Keel / 4-wk / last | Paycheck swing Keel / 4-wk / last | Earnings swing | Low case right |
|---|---|---|---|---|---|
| A normal | 0 / 2 / 1 | $1,100 / $1,152 / $1,107 | $640 / $365 / $1,348 | $1,348 | 91% |
| A storm | 2 / 3 / 1 | $985 / $1,092 / $998 | $1,355 / $627 / $1,348 | $1,348 | 82% |
| B normal | 0 / 0 / 0 | $655 / $671 / $707 | $355 / $276 / $341 | $341 | 100% |
| B storm | 0 / 0 / 1 | $618 / $638 / $644 | $355 / $238 / $499 | $499 | 91% |
| C normal | 0 / 6 / 4 | $435 / $462 / $451 | $175 / $213 / $701 | $701 | 82% |
| C storm | 0 / 6 / 5 | $401 / $445 / $424 | $310 / $272 / $701 | $701 | 73% |

Totals over all drivers and scenarios:

| Limit | Keel empty weeks | 4-week avg | Last week | Keel pays less than 4-wk avg (avg per run) |
|---|---|---|---|---|
| 1% | 1 | 17 | 12 | $57 |
| 5% | 2 | 17 | 12 | $44 |
| 10% | 2 | 17 | 12 | $38 |
| 20% | 5 | 17 | 12 | $27 |

Pre-registered scorecard (`docs/preregistration.md`):
1. Calibration 85–95%: **90.9%, pass.**
2. Fewer empty weeks than both rules: 1 / 2 / 2 / 5 vs 17 and 12, **pass.**
3. Paycheck swing ≥ 30% below earnings swing: **mixed, 14 of 24 runs.** Driver C passes in every run.
4. Cost: $57 / $44 / $38 / $27 a week less than the 4-week average.

Honest losses (`outputs/failures.md`): Keel still ran dry when Driver A took a whole week off (Dec 15–21); the paycheck is not always steadier than earnings (A storm, B normal, B storm at 1% and 5%); Keel pays less on average; Driver C's low case is 81.8%, below 85%; only 33 test driver-weeks. Against the 4-week average specifically, Keel's paycheck swing is larger in several runs (e.g. A normal 5%: $640 vs $365); the benchmark panel marks those "Worse than 4-week average." Fixes not made because they would tune on test weeks: a cap on week-to-week changes, a larger starting buffer, allowing $0 weeks in the forecast, per-driver calibration.

## 3. The front end

Plain HTML, CSS and JavaScript with hand-drawn SVG charts. No framework, no build step. Must be served from the repo root (`python3 -m http.server 8000`).

### 3.1 Homepage (`index.html`)

Hero drawn from the same results file, sections How it works / Stress test / Where it loses, and links: **Open the simulation** (`app/`), **Try it with your own pay** and **Sign in** (`app/my-pay.html`).

### 3.2 The simulation app (`app/index.html`)

- **Loading:** tries `../outputs/results.json`, then the toy `../outputs/sample/results.json`; validates every file and shows a red "Skipped:" note for a bad one; fetches `calibration.json`. If nothing loads, the badge says "No results file loaded" and the page explains how to serve it.
- **Badge:** "Simulated drivers · real NYC ride-hail data", or "Toy data. Not our result." for the sample.
- **Header:** Keel, tabs **Paycheck / Plan / Evidence**, and **Sign in**. On phones the tabs become a bottom bar.
- **Controls:** Simulated driver (A, B, C), Risk limit (1, 5, 10, 20%), Weeks to replay (**Normal** / **Snowstorm stress test**). Opens on Driver C, Snowstorm stress test, 5%.

**Paycheck view:** heads-up payday card (the paycheck for that week's Friday, buffer going in, Keel's reason); three tiles (weeks the buffer ran out, paycheck swing vs earnings swing, average paycheck and tax set aside); **Earnings swing. The paycheck holds steady.** (earnings vs Keel paycheck, forecast band, snowstorm shading, overdraft zone); **The buffer absorbs the bad weeks** (three rules); **Show as tables**; **Week by week** table.

**Plan view:** **Choose a paycheck** (the paychecks Keel chose at each limit for a week; picking one sets the risk limit; nothing is estimated in the browser); **Stress test** (Normal / Snowstorm; Demand crash and High earnings are listed in code but hidden because no runs exist; before/after table with a Change column; two charts); **Buffer recovery** (lowest point, time to recover: "N weeks (back by week X)", "Never fell below target" or "Not back by end of replay"); **Where the money went** (money in vs money out, identity check; week 1 "Not derivable"; "Accounting check failed" banner if off by more than 3 cents); **Why this paycheck?** with the decision log and a collapsible "How Keel sets a paycheck"; **Compare all settings** (every scenario x limit; click a row to load it; "moving the limit from 1% to 20%" summary).

**Evidence view:** **How it works** (Hold, Forecast, Calibrate, Pay); **Scorecard** (the three pre-written questions with pills, "Tie" when equal, and "Where Keel pays a price"); **Forecast reliability** (hit-rate bars with target ticks, band-vs-actual chart, per-driver table, Largest misses, "Not in file" where the file has no middle forecast); **Benchmark** (six metrics better/worse/tie, tally over 24 runs, ablation from `calibration.json` only, "descriptive counts, not statistical tests"); **Where Keel loses** (scanned across all runs); **Safety checks** (three Passed/Failed pills).

Charts: SVG with tooltips, keyboard arrows step through weeks, overdraft zone, snowstorm shading. Light and dark mode, visible focus, aria-live panels, reduced-motion respected, no sideways scroll at phone width. Footer: simulation only, not financial or tax advice.

### 3.3 Sign in / My pay (`app/my-pay.html`)

For any freelancer, not only drivers. Sign in (Supabase email and password) or try as a guest (saved only in that browser). Pick a job: rideshare or delivery driver, plumber, gardener or landscaper, house cleaner, handyman or electrician, freelance designer or writer, tutor or coach, something else. Log weekly pay; get next week's Keel paycheck, the reason, the expected range, the buffer, how uneven the pay is, and charts against the two simple rules. Each job can start with 26 simulated example weeks.

- `app/engine.js` ports the Python salary rule, baselines and replay; `app/engine.test.js` checks it matches Python exactly.
- The forecast is simpler (10/50/90% points of the person's last 12 weeks, uncalibrated); the page says so.
- Accounts need a Supabase project (`app/MY_PAY_SETUP.md`, `app/supabase_schema.sql` with row level security). **Until `app/config.js` has a project URL and anon key, the live page runs in guest mode only.**
- Not part of the pre-registered results.

## 4. Tests (re-run at 7:50 PM)

- `python -m pytest tests -q`: **24 pass** (data 14, model and policy 10; LightGBM needs `brew install libomp` on macOS).
- `node --test app/*.test.js`: **85 pass** (data, benchmark, recovery, paycheck, home, smoke, engine, store).
- Browser run (Chromium) over every panel and control: tiles match `results.json` in all 24 runs; all three views render; table view, optimizer, stress test, money flow, recovery, decision log, what-if, scorecard, reliability, benchmark, where-Keel-loses and safety checks work; toy fallback, bad-file "Skipped:" note and "No results file loaded" all show; no sideways scroll in dark mode or at 390px; no page errors. The My pay page has its own 52-check browser run.

## 5. Toy prototype and sample

`docs/prototype.html` is the first toy draft (made-up earnings: A $900, B $540, C $380; storm in replay weeks 12–13). `app/export_sample.mjs` writes it to `outputs/sample/results.json` (24 runs, `meta.model = "toy"`), which the app shows only under the Toy badge. Only `outputs/results.json` counts as results.

## 6. Team rules

Simulation only; say "simulated"; not financial or tax advice; no real people's data (the My pay page asks for made-up numbers). "Gig worker" in general copy, "driver" for the demo data. Pre-registration before the real run; no changing pass marks after seeing test weeks; dated notes for changes. Report failures. One command reproduces everything. Fixed seeds. No raw parquet or virtualenvs in git. Folder ownership: A `data/`, `src/data/`, `tests/test_data.py`; B `src/model/`, `src/policy/`, `eval/`, `outputs/`; C `app/`, `docs/`, `README.md`. Ask before changing `CONTRACT.md`.

Limits for the write-up: drivers simulated; conformal coverage approximate; holding or moving real money would need licensing; the 15% tax and half-week starting buffer are illustrative.

## 7. Repo map

```
README.md  CONTRACT.md  AGENTS.md  CLAUDE.md  requirements.txt  run_all.py  index.html (homepage)
app/      index.html, ui.js, charts.js, data.js, benchmark.js, recovery.js, paycheck.js, motion.js, home.js,
          keel.css, home.css, tokens.css, media/, export_sample.mjs,
          my-pay.html, engine.js, jobs.js, store.js, config.js, supabase_schema.sql, MY_PAY_SETUP.md, *.test.js
data/     weekly_earnings.csv, hourly/daily_market.csv, weather_daily.csv, trip_sample.csv, sample file, Gate 2 png, README.md
src/data/ download.py, build_weekly.py, preview.py, gate2_plot.py
src/model/ train.py     src/policy/ salary.py, baselines.py, replay.py     eval/ run_eval.py
tests/    test_data.py, test_model.py, test_policy.py, make_engine_fixture.py
outputs/  results.json (24 real runs), calibration.json, failures.md, sample/results.json (toy)
docs/     devpost.md, video_script.md, preregistration.md, handoff.md, prototype.html, app_summary.md
prompts/  00_shared_context.md + role files
```

Run it: `pip install -r requirements.txt` (macOS also `brew install libomp`), `python run_all.py`, then `python3 -m http.server 8000` from the repo root and open http://localhost:8000/.

## 8. What changed since the 4:10 PM summary

| Earlier summary said | Now |
|---|---|
| One-page app | Three views: Paycheck, Plan, Evidence, plus a homepage |
| Root `index.html` forwards to `app/` | Root `index.html` is a homepage with its own hero |
| "Snowstorm replay" | "Snowstorm stress test" (it is a cut applied to real snowy weeks, not a real storm) |
| "Your paycheck this Friday" card | Heads-up payday card on the Paycheck view |
| No login or signup on main | Sign in / My pay page for any freelancer (guest mode until Supabase keys are added) |
| App tests: 46 pass; model and policy tests not run | 85 JavaScript and 24 Python tests, all run and passing |
| Video script numbers `[TBD]` | Filled from `results.json` with sources (`docs/video_script.md`) |
