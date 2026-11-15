# Devpost draft: Keel

> Working draft. Every `[TBD]` gets filled from `outputs/results.json`, `outputs/calibration.json` or `outputs/failures.md` after the real run. Do not paste numbers from the toy sample (`outputs/sample/`).

**Name:** Keel (working name: two other Devpost projects use "Keel", rename before submitting if we can)
**Tagline:** A steady weekly paycheck for people paid by the gig.
**Tracks:** Best AI/ML, Best Fintech, Best Overall (check Devpost's track rules first)
**Links:** repo https://github.com/Sarthak-bit-coder/Keel--Bay_Valley_Hacks · live demo [TBD] · video [TBD]

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
- **Salary rule (Role B):** Monte Carlo simulation of the next [TBD: horizon_weeks] weeks. All three pay rules are tested on the same random draws, so the comparison is fair.
- **Evaluation (Role B):** Keel versus the two simple rules on test weeks the model never saw. We wrote the questions and pass marks down first (`docs/preregistration.md`).
- **App (Role C):** one static page in plain HTML, CSS and JavaScript with hand-drawn SVG charts. It reads `outputs/results.json` and works in light and dark mode, with keyboard support and a table view.

## Results

> Fill only from the real files. Each line names its source.

- Low-case forecast at or above actual pay: [TBD]% of test weeks (target 90%; before calibration [TBD]%). Source: `calibration.json`.
- Empty-buffer weeks in the snowstorm replay, [TBD] limit: Keel [TBD], 4-week average [TBD], last week's pay [TBD]. Source: `results.json`.
- Paycheck swing vs earnings swing: [TBD] vs [TBD]. Source: `results.json`.
- Cost of safety: Keel pays [TBD] less per week on average than the 4-week average.

## Where Keel loses

[TBD from `outputs/failures.md`. Include at least the worst case.] The app lists these automatically in its "Where Keel loses" panel.

## Challenges we ran into

- The TLC records have no driver ID, so we had to simulate drivers and say so everywhere.
- Weekly earnings are autocorrelated, so conformal coverage is only approximate.
- [TBD: what actually went wrong today]

## Accomplishments we're proud of

- A calibrated low case, not just a point forecast.
- An honest scoreboard: we wrote down the tests before the real run and we show where Keel loses.
- [TBD]

## What we learned

[TBD: one line from each teammate]

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
- [TBD] (Role A): data and simulation
- [TBD] (Role B): forecast, salary rule, evaluation

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

- [ ] No `[TBD]` left. No toy numbers anywhere.
- [ ] App shows the real-data badge, not "Toy data".
- [ ] Every number above matches `outputs/` (check each one).
- [ ] Links work while logged out.
- [ ] Video under 2 minutes.
