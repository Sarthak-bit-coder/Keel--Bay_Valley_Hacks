# Video script: Keel (about 90 seconds)

> Record with the real `outputs/results.json` loaded (badge reads "Simulated drivers, real NYC ride-hail data"). Fill every `[TBD]` from that file. If the app still shows "Toy data", do not say any number out loud.
> Setup: serve the repo root (`python -m http.server`), open `http://localhost:8000/app/`, browser at 1280×720, zoom 110%, dark or light mode (pick one and stay).
> About 150 words per minute: each block's word count fits its time.

| Time | On screen | Voiceover |
|---|---|---|
| 0:00–0:15 | Title card "Keel", then cut straight to the app's top chart, **Normal weeks**, Driver B. | "Gig workers get paid like a slot machine. One week is great, the next is half. Rent doesn't care. Keel pays them like an employer: a steady weekly paycheck." |
| 0:15–0:45 | Click **Snowstorm replay**. Hover the storm weeks on the earnings chart so the tooltip shows. Point at the flat blue paycheck line and the forecast band. | "Here's a simulated driver built on real New York City ride-hail records. A snowstorm hits in week [TBD] and earnings drop to [TBD]. Keel's paycheck barely moves: it's paid from a buffer, and the shaded band is Keel's forecast of next week, low case to high case." |
| 0:45–1:05 | Scroll to **Buffer balance under three ways of paying**. Hover the lowest point of each line. Then the tiles. | "Same earnings, three ways to pay. Paying last week's earnings ran the buffer dry in [TBD] weeks. The four-week average, [TBD]. Keel, [TBD]. The cost: Keel paid [TBD] less per week on average." |
| 1:05–1:20 | Scroll past **How it works** to the calibration panel, then one line of the **Decision log**. | "How it works: LightGBM forecasts a low, middle and high case. Conformal calibration makes the low case right [TBD] percent of the time. Then a Monte Carlo test picks the highest salary that keeps the chance of running dry under your limit, and explains why in plain English." |
| 1:20–1:30 | **Where Keel loses** panel, then the footer disclaimer. End card: name, repo link. | "We show where it loses, too. Drivers are simulated, no real money moves, and this isn't financial advice. We elevated the ordinary act of getting paid." |

## Rules for recording

- The running app must appear by 0:15. No slides before it except the title card.
- Every number spoken must match `outputs/results.json` or `outputs/calibration.json`. Write the source next to each `[TBD]` when you fill it.
- If the real result is that Keel does not beat a rule, say so plainly and keep the shot. Do not cut it.
- Keep under 2:00. Aim for 1:30.
- Captions on (Devpost viewers often watch muted).

## Checklist before upload

- [ ] Badge shows real data, not "Toy data".
- [ ] All `[TBD]` filled and checked against `outputs/`.
- [ ] Driver, scenario and limit in the shots match the numbers spoken.
- [ ] Audio clear, no notifications on screen.
- [ ] Uploaded (YouTube unlisted or Vimeo), link works while logged out.
