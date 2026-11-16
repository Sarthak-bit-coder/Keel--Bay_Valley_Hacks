# Keel

### Your work changes. Your payday shouldn't.

Gig and freelance pay goes up and down. Rent doesn't. **Keel turns uneven pay into one steady weekly paycheck**, with money set aside for taxes and a savings cushion for slow weeks.

> Built for **Bay Valley Hacks 2026**, theme **"Elevate the Ordinary"**. The ordinary thing we elevate is getting paid.
> We prove the idea on **simulated drivers built on real NYC ride-hail data**. No real people, no real money, not financial or tax advice.

- **Live site (GitHub Pages):** https://sarthak-bit-coder.github.io/Keel--Bay_Valley_Hacks/
- **Run it locally:** `python3 -m http.server 8000` from this folder, then open http://localhost:8000/

---

## Contents
1. [The problem](#the-problem)
2. [How Keel works](#how-keel-works)
3. [Results](#results)
4. [The website](#the-website)
5. [Privacy and security](#privacy-and-security)
6. [Run it, test it, reproduce it](#run-it-test-it-reproduce-it)
7. [Deploy](#deploy)
8. [Repository map](#repository-map)
9. [How we keep it honest](#how-we-keep-it-honest)
10. [Limits and what's next](#limits-and-whats-next)
11. [Demo video and docs](#demo-video-and-docs)
12. [For the team](#for-the-team)

---

## The problem

A ride-share driver can earn well one week and half as much the next: snow, a holiday, a sick week. Bills arrive on a fixed schedule. The simple fixes people use ("spend what I made last week" or "spend my 4-week average") still leave them short in bad weeks. Apps that advance pay charge for it; budgeting apps only track spending.

## How Keel works

| Step | In plain words | Under the hood |
|---|---|---|
| **1. Hold** | Pay goes into a savings cushion first. A share is set aside for taxes (15% by default, illustrative). | `buffer += take-home − paycheck` |
| **2. Guess next week** | Keel guesses a low, middle and high week ahead. | LightGBM quantile models (10% / 50% / 90%) on recent weeks, how jumpy they were, hours and holidays |
| **3. Keep the low guess honest** | Keel checks that its low guess is right as often as it claims. | Split conformal calibration, target 90% |
| **4. Pick the paycheck** | It tries paychecks from high to low and keeps the first where the chance your cushion runs out in the next 4 weeks is under your limit (1%, 5%, 10% or 20%). | Monte Carlo: 400 simulated 4-week futures, $5 steps, common random numbers |
| **5. Compare** | The same weeks are replayed with two simple rules: pay last week's earnings, and pay the 4-week average. | Baselines with the same earnings and starting cushion |
| **6. Explain** | Every paycheck gets a plain-English reason, e.g. *"Chose $1,100 so the chance of running dry in the next 4 weeks is about 1% (limit 1%)."* | Decision log in `outputs/results.json` |

### The data
- **Real:** NYC Taxi & Limousine Commission high-volume ride-hail trips (Uber/Lyft), Jan 2025 to Jan 2026, 13 monthly files (Jan 2025 alone: 20,405,666 trips): real hourly driver pay + tips. Real NYC daily weather (Open-Meteo). 11 real federal holidays.
- **Simulated:** three drivers working set schedules. Every hour they drive, they earn what real drivers earned in that same hour.
  - **Driver A:** full-time, steady (about 42 h/week, avg $1,338 gross)
  - **Driver B:** part-time (about 24 h/week, avg $752)
  - **Driver C:** weekends only, very uneven (about 16 h/week, avg $481)
- **Time-ordered split, never shuffled:** 31 training weeks, 10 calibration weeks, 11 test weeks (Oct 20 to Dec 29, 2025). All results are on the 11 test weeks.
- **Snowstorm stress test:** the two snowiest test weeks (Dec 8 and Dec 22, real snow) have earnings cut to 45% and 60% after forecasting.

## Results

All numbers are from `outputs/results.json` and `outputs/calibration.json`.

**Weeks the cushion ran out** (3 drivers × normal and snowstorm weeks):

| Your limit | Keel | Pay last week's earnings | Pay the 4-week average |
|---|---|---|---|
| 1% | **1** | 12 | 17 |
| 5% | **2** | 12 | 17 |
| 10% | **2** | 12 | 17 |
| 20% | **5** | 12 | 17 |

**Example (Driver C, snowstorm weeks, 5% limit):**
- Earnings swung **$701**; Keel's paycheck swung **$310**.
- The cushion ran out **0 of 11** weeks with Keel, vs **5** paying last week's earnings and **6** with the 4-week average.
- In the Dec 8 snow week the driver took home **$193**, and Keel still paid **$365**.
- The cost: Keel paid **$44 a week** less on average than the 4-week average.

**Forecast honesty:** the low guess was right **90.9%** of test weeks (30 of 33), against a 90% target (**81.8%** before calibration).

**Pre-registered scorecard** (written before the real run, [`docs/preregistration.md`](docs/preregistration.md)):
1. Calibration within 85–95%: **90.9%, pass**
2. Fewer empty weeks than both simple rules: **pass** (1 / 2 / 2 / 5 vs 12 and 17)
3. Paycheck swing at least 30% below earnings swing: **mixed, 14 of 24 runs** (Driver C passes every run)
4. Cost vs the 4-week average: **$57 / $44 / $38 / $27** a week less (at 1 / 5 / 10 / 20%)

**Where Keel loses** ([`outputs/failures.md`](outputs/failures.md)):
- Driver A still ran dry after taking a whole week off.
- The paycheck isn't always steadier than the 4-week average.
- Keel pays a bit less on average: the price of the cushion.
- Driver C's low guess hit 81.8%.
- Only 33 test driver-weeks.

## The website

Plain HTML, CSS and JavaScript with hand-drawn SVG charts: no framework, no build step. Every page has the same top menu: **Keel · Home · My pay · Research**. The navy sections use a decorative "currents" background (`app/bg.js`): moving lines with one level teal "keel". It pauses off screen and is still when reduced motion is on.

### Home (`index.html`)
- Hero with a live chart card: switch Driver A/B/C and Normal/Snowstorm; it draws jagged earnings, then the steady paycheck. Hover to scrub week by week; a paycheck card and cushion bars sit below.
- Week-by-week strip, **Three simple steps**, **The results** (three big numbers, the snow-week money-in vs money-out bars, and "Good to know" on where Keel loses), and a "Three ways to get paid" comparison.
- A "test a bad stretch" lab with driver, weeks and risk controls, plus a walk through one real week.
- Every figure is read from `outputs/results.json`.

### My pay (`app/my-pay.html`), for any freelancer, no sign-up
Opens straight into guest mode. Everything is saved only in that browser.
1. **Three setup questions:**
   - **About you:** first name and kind of work (driver, plumber, gardener, cleaner, handyman, designer, tutor, other).
   - **Your money:** usual weekly pay, savings you have now (your starting cushion), and monthly bills (rent, utilities & phone, food, car & travel, loans & cards, everything else), with a live total.
   - **Your choices:** tax set-aside (10–25%), how careful the paycheck is (Extra safe 1% / Safe 5% / Balanced 10% / Bold 20%), and optional 26 practice weeks scaled to your pay.
2. **Home:**
   - The big **paycheck next week**.
   - **Your bills:** "Covered, with $X left over" or "Short by $X a week".
   - **Savings cushion**, plus how many weeks of paychecks it covers.
   - **Set aside for taxes**.
   - A short cushion card with last week's math.
   - **Why this amount?** in plain words.
   - Your pay vs. your paycheck chart.
3. **My weeks:**
   - Add a week, with a live tax preview.
   - **Did Keel help?** compares weeks short on bills with and without Keel.
   - An earnings chart (red bars below your bills line, steady paycheck line).
   - **Your cushion over time**.
   - A week-by-week table (earned, taxes, into/out of cushion, Keel paid you, cushion after, bills covered?) with edit, delete and download as CSV.
4. **Example:** a weekend New York driver from our real results (Driver C, snowstorm weeks), for anyone confused by the idea.
5. **Settings:** name, work, weekly pay, starting savings, taxes, how careful, bills; Save / Undo; download data; delete all weeks; **Start over**.

The paycheck rule is the same as the research (`app/engine.js`, a port of `src/policy/salary.py`, tested to match Python exactly). The forecast is simpler: the 10/50/90% points of your last 12 weeks, not LightGBM and not calibrated. The page says so.

### Research (`app/`)
- **The short version:** a 3-point plain-English summary.
- **Our data, code and write-ups:** links to:
  - the NYC TLC trip data and Open-Meteo weather;
  - `results.json`, `calibration.json` and `failures.md`;
  - the pre-registration, project summary and this README;
  - the GitHub repo, the model code and the paycheck-rule code.
- Controls: pick a driver, Normal or Snowstorm weeks, and how careful (1/5/10/20%); **Play payday** steps through one simulated week at a time.
- **1. Paycheck:**
  - payday card, heads-up for next week, stability tiles;
  - "Earnings swing. The paycheck holds steady." and "The buffer absorbs the bad weeks" charts;
  - week-by-week table and tables view.
- **2. Compare:** choose a paycheck, stress test, buffer recovery, where the money went, why this paycheck (decision log), compare all settings.
- **3. Proof & weak spots:** how it works, scorecard, forecast reliability, benchmark vs simple rules, where Keel loses, safety checks.
- A "Toy data" badge shows if only the sample file (`outputs/sample/results.json`) is available.

## Privacy and security

- **No accounts and no sign-up.** My pay stores everything in the browser's local storage (`GuestStore` in `app/store.js`). Nothing is sent to a server, and there are no bank logins.
- **Content security policy on My pay:** scripts only from this site, no frames, no plugins, `form-action 'self'`. A strict referrer policy is also set.
- User text is escaped before display. CSV downloads are protected against spreadsheet formula injection. Every number entered is range-checked.
- **For future cloud accounts:** `app/supabase_schema.sql` has row level security (each person sees only their own rows), no table access for anonymous users, and size/range limits. `app/store.js` has a tested `AccountStore`. Setup steps are in [`app/MY_PAY_SETUP.md`](app/MY_PAY_SETUP.md). The page does not load Supabase today.
- **Never commit secrets.** The Supabase anon key is public by design; never put a `service_role` key or any OAuth client secret in this repo.

## Run it, test it, reproduce it

**View the site** (it loads JSON, so serve it over HTTP from the repo root):
```bash
python3 -m http.server 8000
# http://localhost:8000/          homepage
# http://localhost:8000/app/my-pay.html   My pay
# http://localhost:8000/app/      Research
```

**Tests:**
```bash
node --test app/*.test.js     # 85 tests: data, benchmark, recovery, paycheck, home, smoke, engine, store (Node 18+)
python -m pytest tests -q     # 24 tests: data, model, policy (needs requirements.txt; macOS: brew install libomp)
```

**Reproduce every result** (Python 3.10+, fixed seeds):
```bash
pip install -r requirements.txt
python run_all.py   # data -> LightGBM + conformal -> Monte Carlo salary -> replay vs baselines -> outputs/
```
`src/data/download.py` fetches the raw TLC parquet files (about 0.5 GB each; git-ignored in `data/raw/`). Small caches in `data/` let the weekly build run in seconds without them.

## Deploy

The site is static and needs the **whole repo root** (pages read `outputs/results.json`).
- **GitHub Pages** (current): Settings → Pages → branch `main`, folder `/`.
- **Vercel:** from the repo root run `npx vercel login` once, then `npx vercel --prod`. Use framework "Other", no build command, output directory `.` (root). Or import the GitHub repo in the Vercel dashboard with the same settings.
- Any static host works if it serves the repo root.

## Repository map

| Path | What |
|---|---|
| `index.html` | Homepage |
| `app/my-pay.html`, `app/mypay.js`, `app/mypay.css` | My pay (guest setup, Home, My weeks, Example, Settings) |
| `app/index.html`, `app/ui.js`, `app/charts.js`, `app/keel.css` | Research page |
| `app/engine.js` | Paycheck rule, baselines and replay (JS port of the Python, tested) |
| `app/data.js`, `paycheck.js`, `benchmark.js`, `recovery.js` | Tested helpers that read `outputs/results.json` |
| `app/store.js`, `app/jobs.js` | Guest storage (+ unused cloud store); job types with simulated practice weeks |
| `app/tokens.css`, `app/ds.css`, `app/site.css`, `app/home.css`, `app/home-extra.css`, `app/fx.css` | Design tokens and styles |
| `app/bg.js`, `app/fx.js`, `app/motion.js`, `app/theme.js`, `app/home.js` | Currents background, motion, homepage drawing |
| `app/supabase_schema.sql`, `app/config.js`, `app/MY_PAY_SETUP.md` | Optional cloud accounts (not used by the page today) |
| `src/data/` | Download and build the simulated weekly earnings |
| `src/model/train.py` | LightGBM quantile forecasts + conformal calibration |
| `src/policy/` | Monte Carlo salary rule, baselines, replay |
| `eval/run_eval.py` | 24 runs (3 drivers × 2 scenarios × 4 limits) → `outputs/results.json` |
| `outputs/` | `results.json`, `calibration.json`, `failures.md`, `sample/` (toy) |
| `data/` | Small committed caches and the contract CSV |
| `tests/` | Python tests |
| `docs/` | Pre-registration, project summary, demo debrief, video timeline, Devpost text, handoff |
| `CONTRACT.md` | File formats between the three roles (ask before changing) |

## How we keep it honest

- **Rules first:** [`docs/preregistration.md`](docs/preregistration.md) fixed the pass marks before the real run.
- **Held-out weeks:** time-ordered splits; the test weeks were used only at the end.
- **Failures published:** [`outputs/failures.md`](outputs/failures.md), the homepage "Good to know" line, and Research → Where Keel loses.
- **Hard checks every week:**
  - gross = paycheck + tax + cushion change, to the cent, in all 24 runs;
  - paycheck ≥ 0;
  - cushion ≥ 0 is reported, and fails in 6 runs.
- **Reproducible:** `python run_all.py` rebuilds every result with fixed seeds.
- **Labels:** drivers are always called simulated; the sample file shows a "Toy data" badge.

## Limits and what's next

- Drivers are simulated, not real people. No real money moves. Not financial or tax advice.
- Conformal coverage is approximate because weekly earnings are related week to week.
- The 15% tax and half-week starting cushion (research runs) are illustrative.
- Moving real money would need a bank partner and licensing.
- **Next:**
  - real payout connections and paying bills straight from the cushion;
  - cloud accounts (the schema is ready);
  - more gig platforms;
  - the same forecast-and-cushion method for other uneven costs.

## Demo video and docs

- [`docs/demo_video_timeline.md`](docs/demo_video_timeline.md): 2:30, 16-shot timeline, read-aloud voiceover, and a Claude Code prompt that records the video.
- [`docs/demo_video_debrief.md`](docs/demo_video_debrief.md): everything Keel has, with every number and its source, plus judge Q&A.
- [`docs/app_summary.md`](docs/app_summary.md): full technical summary.
- [`docs/devpost.md`](docs/devpost.md), [`docs/video_script.md`](docs/video_script.md), [`docs/handoff.md`](docs/handoff.md).

---

## For the team

<details>
<summary>Roles, contract and pipeline notes</summary>

### Roles

| Role | Owns | Branch |
|---|---|---|
| A: Data and simulation | `data/`, `src/data/`, `tests/test_data.py` | `a/data` |
| B: Forecast, policy, evaluation | `src/model/`, `src/policy/`, `eval/`, `outputs/` | `b/ml` |
| C: App, write-up, video | `app/`, `docs/`, this README | `c/app` |

Prompts for each role are in `prompts/`. Start every agent session with `prompts/00_shared_context.md` plus the role file.

### Contract

`CONTRACT.md` defines the files A hands to B and B hands to C. Don't change a column name without telling the other two. `outputs/sample/results.json` (made by `app/export_sample.mjs` from the toy simulation in `docs/prototype.html`) follows the final format.

### Rules

Simulation only; say "simulated"; not financial or tax advice; no real people's data. No raw parquet files or virtualenvs in git. Every script runs from the repo root. Only `outputs/results.json` counts as results.

</details>
