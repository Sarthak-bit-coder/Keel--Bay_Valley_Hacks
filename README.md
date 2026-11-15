# Keel

### A steady weekly paycheck for gig workers and freelancers.

Gig workers get paid like a slot machine. **Keel pays them like an employer:** a steady weekly paycheck built from their own volatile earnings.

> Theme: **"Elevate the Ordinary."** The ordinary thing we elevate is getting paid.
>
> Built for Bay Valley Hacks 2026. We prove the idea on **simulated ride-hail drivers built on real NYC ride-hail data**. No real people, no real money, not financial or tax advice.

---

## The problem

A gig worker can earn well one week and half as much the next: bad weather, a holiday, fewer hours. Rent and bills still arrive on a fixed schedule.

Today's apps either advance money against future earnings (and charge for it) or just track spending. None of them turns uncertain income into a predictable paycheck while showing how risky each choice is.

## What Keel does

1. **Holds:** payouts from the gig apps land in a buffer, not straight in checking.
2. **Pays:** every week Keel sets a salary and moves it to checking.
3. **Sets tax aside:** a share of every payout is put away for tax.
4. **Stays safe:** the salary is the highest amount that keeps the chance of running out of buffer below a limit the worker chooses (for example 5%).

In good weeks the buffer grows. In bad weeks it absorbs the dip, so the paycheck stays flat.

## How it works

| Step | What happens | Technique |
|---|---|---|
| **1. Data** | Real NYC ride-hail trip records give pay per hour and demand patterns. Weather and holidays are added. Drivers are simulated on top, because the records have no driver ID. | NYC TLC high-volume trip data, Open-Meteo weather, holiday calendar |
| **2. Forecast** | Predicts next week's take-home pay as a low, middle and high case, from recent weeks, hours, weather and holidays. | LightGBM quantile models |
| **3. Calibrate** | Adjusts the low case so it is right about as often as it claims: a "90% low case" should hold about 90% of the time on weeks the model never saw. | Conformal calibration |
| **4. Choose the salary** | Tries many possible paychecks, simulates the next 4 weeks many times using the forecast, and keeps the highest paycheck whose chance of an empty buffer stays under the limit. | Monte Carlo policy with common random numbers |
| **5. Compare** | Runs the same weeks under two simple rules, *pay last week's earnings* and *pay the 4-week average*, with the same earnings and the same starting buffer. | Baselines on held-out weeks |
| **6. Explain** | Every week gets a plain-English reason, for example: *"Chose $700 so the chance of running dry in the next 4 weeks is about 4% (limit 5%)."* | Decision log |

## The app

One page, no install. It reads `outputs/results.json` and redraws everything when you change a control.

### Controls
- **Driver:** A (full-time, steady), B (evenings, choppy) or C (weekends, very choppy). All simulated.
- **Scenario:** normal weeks or a **snowstorm replay**.
- **Allowed chance the buffer runs out:** 1%, 5%, 10% or 20%.
- **Show data as tables:** swaps every chart for a table.

### What you see
- **Headline tiles:** weeks with an empty buffer (Keel vs the two simple rules), paycheck swing vs earnings swing, and the average weekly paycheck with the tax set aside.
- **"Earnings swing, the paycheck does not":** jagged take-home earnings next to the flat Keel paycheck, with the forecast band and the snowstorm weeks shaded.
- **Buffer balance under three ways of paying:** Keel vs last week's pay vs the 4-week average. Below zero means overdraft.
- **How it works:** a four-step strip (hold, forecast, calibrate, pay).
- **Scorecard:** the three questions we wrote down before the real run, answered from the results file, plus the cost of safety (how much less Keel pays than the 4-week average).
- **Where Keel loses:** every case in the results file where Keel did worse than a simple rule, scanned across all drivers, scenarios and limits, so it can't be cherry-picked.
- **Safety checks:** every week, payout = paycheck + tax set-aside + change in buffer; the buffer and paycheck are never negative.
- **Is the low case honest?:** calibration bars showing the target vs the actual hit rate, overall and per driver.
- **Decision log:** the plain-English reason for each weekly paycheck.

### Honest labels
- A **"Toy data"** badge shows while the app runs on the sample file (`outputs/sample/results.json`, made from a toy simulation).
- It switches to **"Simulated drivers, real NYC ride-hail data"** once the real results are in.
- Charts have hover tooltips and keyboard focus. The page works in light and dark mode and at phone width.

### Run the app

The page loads JSON, so serve it over HTTP rather than double-clicking the file:

```bash
python -m http.server
```

Then open http://localhost:8000/app/. The app loads `outputs/results.json`, or falls back to the toy sample if that file doesn't exist yet.

## How we keep it honest

- **Tests written first:** [`docs/preregistration.md`](docs/preregistration.md) fixes the pass marks before the real run. Calibration must land at 85–95%. Keel must have fewer empty-buffer weeks than both simple rules. The paycheck swing must be at least 30% smaller than the earnings swing.
- **Held-out weeks:** time-ordered splits, no shuffling. The models see the test weeks only at the end.
- **Failures reported:** `outputs/failures.md` lists where Keel does worse than a simple rule, and why.
- **Reproducible:** `python run_all.py` rebuilds every result.

## Limits

- Drivers are simulated, not real people. No real money moves. Not financial or tax advice.
- Weekly earnings carry over from week to week, so conformal coverage is approximate.
- Holding or moving real money would need licensing. This is a demo of the method.
- Only numbers from `outputs/results.json` count as results. The prototype and the sample file use a toy simulation.

## What's next

Real payout connections, paying bills straight from the buffer, more gig platforms, and the same forecast-and-reserve method for other uneven costs.

---

## For the team

<details>
<summary>Roles, contract, checkpoints and the full pipeline</summary>

### Roles

| Role | Owns | Branch |
|---|---|---|
| A: Data and simulation | `data/`, `src/data/`, `tests/test_data.py` | `a/data` |
| B: Forecast, policy, evaluation | `src/model/`, `src/policy/`, `eval/`, `outputs/` | `b/ml` |
| C: App, write-up, video | `app/`, `docs/`, this README | `c/app` |

Prompts for each role are in `prompts/`. Start every agent session with `prompts/00_shared_context.md` plus the role file.

### Contract

`CONTRACT.md` defines the files A hands to B and B hands to C. Do not change a column name without telling the other two. `outputs/sample/results.json` (made by `app/export_sample.mjs` from the toy simulation in `docs/prototype.html`) follows the final format, so the app works before the real results exist.

### Checkpoints (final deadline 10:00 PM, aim to submit by 9:00 PM)

Every team must submit a video.

| Time | Checkpoint |
|---|---|
| 11:15 | Gate 1: a TLC high-volume file loads (if not, switch to the fallback idea, Complaint Compass). `CONTRACT.md` agreed. |
| 1:00 PM | Gate 2: simulated drivers look credible next to published earnings-swing figures. If not, simplify the simulation. |
| 3:30 PM | Real `outputs/results.json` exists. |
| 5:30 PM | App wired to real outputs and every number on screen audited against the file. Safety checks pass. |
| 7:00 PM | Write-up and gallery screenshots done. |
| 8:00 PM | Video recorded. |
| 9:00 PM | Submitted. One-hour buffer before the 10:00 PM deadline. |

### Full pipeline

```bash
pip install -r requirements.txt
# macOS: LightGBM also needs `brew install libomp`. Python 3.11-3.13 is safest for wheels.
python run_all.py          # data -> forecast -> policy -> evaluation -> outputs/
python3 -m http.server 8000   # from the repo root, then open http://localhost:8000/
```

The app fetches `../outputs/results.json` (falling back to `outputs/sample/results.json`), so it must be served over HTTP from the **repo root**. Opening `app/index.html` as a file, or deploying only `app/`, cannot reach `outputs/`. To deploy, publish the whole repo root as a static site (GitHub Pages: Settings → Pages → branch `main`, folder `/`); the root `index.html` forwards to `app/`.

App tests (Node 18+, no install): `node --test app/data.test.js`

`run_all.py` is a skeleton. Each role fills in its step.

</details>
