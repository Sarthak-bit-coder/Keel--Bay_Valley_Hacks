# Devpost draft: Keel

> Numbers below come from the real run (`outputs/results.json` generated 2026-11-15, `outputs/calibration.json`, `outputs/failures.md`). Only the `[team: ...]` items are left: they need a human (video link, names, personal notes).

**Name:** Keel (working name: two other Devpost projects use "Keel", rename before submitting if we can)
**Tagline:** A steady weekly paycheck for people paid by the gig.
**Tracks:** Best AI/ML, Best Fintech, Best Overall (check Devpost's track rules first)
**Links:** repo https://github.com/Sarthak-bit-coder/Keel--Bay_Valley_Hacks · live demo https://sarthak-bit-coder.github.io/Keel--Bay_Valley_Hacks/ · video [team: paste link]

## Inspiration

Rideshare drivers get paid like a slot machine: a good week, then a storm or a slow holiday cuts the next one in half. Rent and groceries come due the same amount every week. Salaried workers get a steady paycheck for free. Gig workers don't. The theme is "Elevate the Ordinary", and the most ordinary thing there is, getting paid, is exactly what gig work breaks.

## What it does

Keel sits between the gig apps and a driver's checking account:

1. **Hold:** payouts land in a buffer, and a share is set aside for tax.
2. **Forecast:** a model predicts a low, middle and high case for next week's take-home pay.
3. **Calibrate:** the low case is adjusted so it is right as often as it claims.
4. **Pay:** every week Keel picks the highest salary that keeps the chance of emptying the buffer under a limit the driver chooses (1%, 5%, 10% or 20%).

The app shows a jagged earnings line next to a flat paycheck line, the buffer under Keel versus two simple rules (pay last week's earnings, pay the 4-week average), a scorecard, safety checks, and a plain-English log of why each paycheck was chosen. It can replay a snowstorm week.

**All drivers are simulated. No real money moves. This is not financial or tax advice.**

## How we built it

- **Data (Role A):** real NYC TLC high-volume ride-hail trip records set demand and pay per hour. The records have no driver ID, so we simulate drivers on top of them, with weather (Open-Meteo) and federal holidays. TLC months used: January 2025 to January 2026, built into 52 weeks (Jan 6, 2025 to Jan 4, 2026).
- **Forecast (Role B):** LightGBM quantile models give the low, middle and high case. Split conformal prediction on a held-out, time-ordered calibration block corrects the low case.
- **Salary rule (Role B):** Monte Carlo simulation of the next 4 weeks. All three pay rules are tested on the same random draws, so the comparison is fair.
- **Evaluation (Role B):** Keel versus the two simple rules on test weeks the model never saw. We wrote the questions and pass marks down first (`docs/preregistration.md`).
- **App (Role C):** one static page in plain HTML, CSS and JavaScript with hand-drawn SVG charts. It reads `outputs/results.json` and works in light and dark mode, with keyboard support and a table view.

## Results

> Fill only from the real files. Each line names its source.

- Low-case forecast at or above actual pay: 90.9% of 33 test driver-weeks (target 90%; before calibration 81.8%). Source: `calibration.json`.
- Empty-buffer weeks, all 3 drivers and both scenarios added up, at the 1 / 5 / 10 / 20% limits: Keel 1 / 2 / 2 / 5, 4-week average 17, last week's pay 12. Source: `results.json`, `failures.md`.
- Paycheck swing vs earnings swing: Keel meets the pre-registered mark (at least 30% smaller) in 14 of 24 runs. Example, driver C in the snowstorm at a 5% limit: $310 vs $701. It misses in all of driver A's snowstorm runs and in 6 of driver B's 8 runs. Source: `results.json`.
- Cost of safety: Keel pays $57 / $44 / $38 / $27 less per week on average than the 4-week average, at the 1 / 5 / 10 / 20% limits. Source: `failures.md`.

## Where Keel loses

- **Worst case:** driver A took a whole week off (Dec 15-21, $0 take-home) right after the snowstorm cut. The paycheck was already set, so the buffer went below zero: down to -$942 in the storm replay at a 20% limit, and -$35 in normal weeks at 20%. The forecast band does not expect a $0 week after a normal one.
- **Steadiness:** Keel's paycheck is not always steadier. It meets the 30% pass mark in only 14 of 24 runs (scored "Mixed").
- **Cost:** Keel always pays less on average than the 4-week average ($27 to $57 a week). That is the price of the safer buffer.

Full write-up in `outputs/failures.md`. The app lists losses automatically in its "Where Keel loses" panel.

## Challenges we ran into

- The TLC records have no driver ID, so we had to simulate drivers and say so everywhere.
- Weekly earnings are autocorrelated, so conformal coverage is only approximate.
- [team: what actually went wrong today]

## Accomplishments we're proud of

- A calibrated low case, not just a point forecast.
- An honest scoreboard: we wrote down the tests before the real run and we show where Keel loses.
- Seven app panels (optimizer, reliability, stress test, why this paycheck, money flow, buffer recovery, benchmark), all read from one results file, nothing invented in the browser.
- `python run_all.py` rebuilds the data, model and results from scratch and reproduces the committed files exactly.

## What we learned

[team: one line from each teammate]

## What's next

- Test on real (consented) driver payout histories.
- Explain each paycheck in the driver's own language.
- Holding or moving real money would need licensing and a regulated partner. Keel is a demo only.

## Limits (keep in the final write-up)

- Drivers are simulated, not real people.
- Conformal coverage is approximate because weekly earnings are autocorrelated.
- No real money moves. Not financial or tax advice. The 15% tax set-aside is illustrative.

## Team

- Brij (Role C): app, write-up, video, submission
- [team: name] (Role A): data and simulation
- [team: name] (Role B): forecast, salary rule, evaluation

## Judging rubric, one line each

- **Creativity:** a paycheck for people who have none, built on forecast uncertainty rather than a budget app.
- **Technical difficulty:** LightGBM quantiles, conformal calibration, a Monte Carlo salary rule using the same random draws for every rule.
- **Functionality:** a working app that replays a snowstorm week end to end from the real results file.
- **UI/UX:** one page, a flat paycheck line against jagged earnings, and a plain-English reason for every paycheck.
- **Theme:** we elevate the ordinary act of getting paid.
- **Pitch:** 90-second video with the running app in the first 30 seconds.

## Screenshots to take (3 to 5, hero first)

1. Snowstorm replay: earnings line vs flat paycheck line, with the forecast band.
2. Buffer chart: the two simple rules dip below zero and Keel does not (only if the real data shows that).
3. Calibration panel with the real numbers.
4. Decision log and safety checks.
5. Where Keel loses.

## Pre-submit checklist

- [ ] No `[team: ...]` left. No toy numbers anywhere.
- [x] App shows the real-data badge, not "Toy data".
- [ ] Every number above matches `outputs/` (check each one).
- [ ] Links work while logged out.
- [ ] Video under 2 minutes.
