# Keel (Bay Valley Hacks)

**A steady weekly paycheck for people paid by the gig.** Gig workers get paid like a slot machine. Keel pays them like an employer: it takes in payouts from the gig apps, holds them in a buffer, and every week sets a salary, moves it to checking, and puts tax money aside.

> Working name. Two other Devpost projects are already called "Keel", so we may rename before submitting. Renaming a GitHub repo is one click.

**Theme: "Elevate the Ordinary."** The ordinary thing is getting paid. We elevate it from a lottery into a paycheck.

**Tracks:** Best AI/ML, Best Fintech, Best Overall.

## What the judges will score

| Judging criterion | What we show |
|---|---|
| Creativity and originality | A paycheck for people who have none, built on forecast uncertainty instead of a budget app |
| Technical difficulty | LightGBM low/middle/high forecasts, conformal calibration, a Monte Carlo salary rule |
| Functionality | A working app that replays a snowstorm week end to end |
| UI/UX | One page: forecast band, flat paycheck line, buffer, plain-language decision log |
| Theme relevance | Elevating the ordinary act of getting paid |
| Presentation and pitch | 90-second video with the running app in the first 30 seconds |

## How it works

1. **Data (A):** real NYC ride-hail trip records (TLC) set demand and pay per hour. Drivers are simulated on top, because the records have no driver ID. Weather and holidays are added.
2. **Forecast (B):** LightGBM predicts a low, middle and high case for next week's take-home pay. Conformal calibration makes the low case right as often as it claims.
3. **Salary rule (B):** a Monte Carlo policy picks the highest salary that keeps the chance of emptying the buffer under a set limit, using the same random draws for every rule it is compared with.
4. **Evaluation (B):** Keel versus two simple rules (last week's pay, trailing 4-week average) on weeks the model never saw. We report where Keel loses.
5. **App (C):** a single page that reads `outputs/results.json` and shows earnings vs paycheck, buffer under each rule, the scorecard, safety checks and a decision log.

`docs/prototype.html` is the first draft of the app. It runs on a toy simulation so the team can see the target. Every number in it is from the toy, not from the real model.

## Team and ownership

| Role | Owns | Works in |
|---|---|---|
| A: Data and simulation | `data/`, `src/data/`, `tests/test_data.py` | branch `a/data` |
| B: Forecast, policy, evaluation | `src/model/`, `src/policy/`, `eval/`, `outputs/` | branch `b/ml` |
| C: App, write-up, video | `app/`, `docs/`, this README | branch `c/app` |

Prompts for each role are in `prompts/`. Start every agent session with `prompts/00_shared_context.md` plus the role file.

## The contract between roles

`CONTRACT.md` defines the files A hands to B and B hands to C. Do not change a column name without telling the other two. Role C generates `outputs/sample/results.json` from the prototype toy simulation in the final format (first task, before 11:15), so C can build the app before B finishes.

## Rules we keep

- **Simulation only.** No real money moves. No real people's data. Say "simulated" wherever drivers appear.
- **Not financial or tax advice.** Put this on the app and in the write-up.
- **Write the tests down first.** `docs/preregistration.md` is committed before the real run.
- **Report failures.** `outputs/failures.md` lists where Keel loses, not only where it wins.
- **One command reproduces the results:** `python run_all.py`.

## Checkpoints (hacking 10:00 AM to 8:00 PM, submit by 8:00 PM)

| Time | Checkpoint |
|---|---|
| 10:45 | Gate 1: a TLC high-volume file downloads and loads. If not, switch to the fallback idea (Complaint Compass). |
| 11:15 | `CONTRACT.md` agreed. B and C can run on the sample files. |
| 1:00 PM | Gate 2: simulated drivers look credible next to published earnings-swing figures. If not, simplify the simulation. |
| 3:30 PM | Real `outputs/results.json` exists. |
| 5:30 PM | App wired to real outputs. Safety checks pass. |
| 6:30 PM | Write-up and gallery screenshots drafted. |
| 7:00 PM | Video recorded. |
| 7:30 PM | Submitted. Thirty-minute buffer. |

## Run it

```bash
pip install -r requirements.txt
python run_all.py          # data -> forecast -> policy -> evaluation -> outputs/
# open app/index.html in a browser (or deploy the app/ folder as a static site)
```

`run_all.py` is a skeleton. Each role fills in its step.

## Limits we state in the write-up

- Drivers are simulated, not real people.
- Weekly earnings are autocorrelated, so conformal coverage is approximate.
- Holding or moving real money would need licensing. This is a demo only.
