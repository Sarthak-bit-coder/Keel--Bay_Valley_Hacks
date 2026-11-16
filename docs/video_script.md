# Video script: Keel (about 90 seconds)

> Record with the real `outputs/results.json` loaded (badge reads "Simulated drivers · real NYC ride-hail data"). Numbers below are filled from that file for **Driver C, Snowstorm stress test, 5% limit** (the view the app opens on); sources are listed under the table. If the app shows "Toy data", do not say any number out loud.
> Setup: serve the repo root (`python -m http.server`), open `http://localhost:8000/app/`, browser at 1280×720, zoom 110%, dark or light mode (pick one and stay).
> About 150 words per minute: each block's word count fits its time.

| Time | On screen | Voiceover |
|---|---|---|
| 0:00–0:15 | Title card "Keel", then cut straight to the app's **Paycheck** view: Driver C, **Normal** weeks, 5% limit. | "Gig workers get paid like a slot machine. One week is great, the next is half. Rent doesn't care. Keel pays them like an employer: a steady weekly paycheck." |
| 0:15–0:45 | Click **Snowstorm stress test**. On **Earnings swing. The paycheck holds steady.**, hover the two shaded snowstorm weeks so the tooltip shows. Point at the blue paycheck line and the forecast band. | "Here's a simulated driver built on real New York City ride-hail records. Two real December snowstorms hit, and take-home pay drops to $193, then $96. Keel still pays $365 and $510 those weeks, out of a buffer. The shaded band is Keel's forecast of next week, low case to high case." |
| 0:45–1:05 | Scroll to **The buffer absorbs the bad weeks**. Hover the lowest point of each line. Then the tiles at the top. | "Same earnings, three ways to pay. Paying last week's earnings ran the buffer dry in 5 of 11 weeks. The four-week average, 6. Keel, zero. The cost: Keel paid $44 less per week on average." |
| 1:05–1:20 | Click **Evidence**: **How it works**, then **Forecast reliability**. Then click **Plan** and one row of the decision log under **Why this paycheck?** | "How it works: LightGBM forecasts a low, middle and high case. Conformal calibration makes the low case right 91 percent of the time. Then a Monte Carlo test picks the highest salary that keeps the chance of running dry under your limit, and explains why in plain English." |
| 1:20–1:30 | **Evidence → Where Keel loses**, then the footer disclaimer. End card: name, repo link. | "We show where it loses, too. Drivers are simulated, no real money moves, and this isn't financial advice. We elevated the ordinary act of getting paid." |

**Where each number comes from** (`outputs/results.json`, run Driver C / storm / 0.05 unless noted):

| Spoken | Source |
|---|---|
| $193, then $96 | `weeks[7].net` (week of 2025-12-08) and `weeks[9].net` (2025-12-22); `storm_weeks: [8, 10]` |
| $365 and $510 | `weeks[7].pay_keel` and `weeks[9].pay_keel` |
| 5, 6, zero of 11 | `metrics.overdraft_weeks`: last 5, avg4 6, keel 0 |
| $44 less | `metrics.avg_pay`: avg4 $445 minus keel $401 |
| 91 percent | `outputs/calibration.json` `calibrated_hit_rate` 0.909 (30 of 33 test driver-weeks, all drivers) |

Honest context if asked: in this run Keel's paycheck still ranged $230 to $540 (swing $310), smaller than earnings ($0 to $701) but larger than the 4-week average's swing ($272). The storm weeks are a stress test (earnings cut to 45% and 60% after forecasting); the real outcome is the Normal scenario.

## Rules for recording

- The running app must appear by 0:15. No slides before it except the title card.
- Every number spoken must match `outputs/results.json` or `outputs/calibration.json`. Write the source next to each `[TBD]` when you fill it.
- If the real result is that Keel does not beat a rule, say so plainly and keep the shot. Do not cut it.
- Keep under 2:00. Aim for 1:30.
- Captions on (Devpost viewers often watch muted).

## Checklist before upload

- [ ] Badge shows real data, not "Toy data".
- [x] All `[TBD]` filled and checked against `outputs/` (Nov 15, 7:55 PM, from the committed results).
- [ ] Driver, scenario and limit in the shots match the numbers spoken.
- [ ] Audio clear, no notifications on screen.
- [ ] Uploaded (YouTube unlisted or Vimeo), link works while logged out.
