# Keel: full debrief for the demo video

Everything Keel has, in the order you'd show it, with the exact numbers and where they come from.
Every result number below is from `outputs/results.json` or `outputs/calibration.json` (committed). Drivers are simulated; no real money moves; not financial or tax advice.

---

## 1. The idea in one breath

**Gig and freelance pay goes up and down. Rent doesn't. Keel turns uneven pay into one steady weekly paycheck.**
Your pay goes into a savings cushion. Keel sets aside a share for taxes. Every week it pays you the same amount: the most it can while keeping the chance your cushion runs out low (you choose how low). Good weeks fill the cushion; slow weeks use it.

- Event: Bay Valley Hacks 2026, theme "Elevate the Ordinary" (we elevate the ordinary act of getting paid). Tracks: Best AI/ML, Best Fintech, Best Overall.
- Live site: https://sarthak-bit-coder.github.io/Keel--Bay_Valley_Hacks/

## 2. The problem (say this in the first 10 seconds)

- A ride-share driver's week can be great, then half, then nothing (snow, holidays, a sick week).
- Bills are the same every month.
- Simple fixes people use ("spend what I made last week", "spend my 4-week average") still leave them short in bad weeks.

## 3. How Keel works (four steps, plain words, then the tech word)

| Step | Plain words | What's under the hood |
|---|---|---|
| 1. Hold | Pay goes into a cushion first; a share is set aside for taxes (15% by default, illustrative). | `buffer += take-home − paycheck` |
| 2. Guess next week | Keel guesses a low, middle and high week ahead. | LightGBM quantile models (10% / 50% / 90%), 7 features (recent weeks, how jumpy they were, hours, holidays) |
| 3. Make the low guess honest | Keel checks its low guess is right as often as it claims. | Split conformal calibration (target 90%) |
| 4. Pick the paycheck | It tries paychecks from high to low and keeps the first one where the chance your cushion runs out in the next 4 weeks is under your limit (1%, 5%, 10% or 20%). | Monte Carlo: 400 simulated 4-week futures, $5 steps |

Every week also gets a reason in plain English, e.g. "Chose $1,100 so the chance of running dry in the next 4 weeks is about 1% (limit 1%)."

## 4. The data (why judges should trust it)

- **Real:** NYC Taxi & Limousine Commission ride-hail trips (Uber/Lyft), Jan 2025 to Jan 2026, 13 monthly files (Jan 2025 alone: 20,405,666 trips). Real hourly driver pay + tips. Real NYC weather (Open-Meteo). 11 real federal holidays.
- **Made up (simulated):** three drivers. Each works a schedule; every hour they drive, they earn what real drivers earned in that exact hour.
  - Driver A: full-time, steady (about 42 h/week, avg $1,338/week gross)
  - Driver B: part-time (about 24 h/week, avg $752)
  - Driver C: weekends only, very uneven (about 16 h/week, avg $481)
- Weeks split in time order, never shuffled: 31 training weeks, 10 calibration weeks, 11 test weeks (Oct 20 to Dec 29, 2025). All results are on the 11 test weeks the model never saw.
- One command reproduces everything: `python run_all.py`.

## 5. The results (numbers to say on camera)

Headline example: **Driver C, snowstorm stress test, 5% limit** (also what the My pay "Example" tab shows):

| What | Number | Source |
|---|---|---|
| Snow week Dec 8: driver took home | **$193** | `weeks[7].net` |
| Keel still paid that week | **$365** | `weeks[7].pay_keel` |
| Snow week Dec 22: took home / Keel paid | **$96 / $510** | `weeks[9]` |
| Weeks the money ran out: paying last week's earnings | **5 of 11** | `metrics.overdraft_weeks.last` |
| ...paying the 4-week average | **6 of 11** | `.avg4` |
| ...with Keel | **0 of 11** | `.keel` |
| Cost: Keel paid less per week on average than the 4-week average | **$44** | `avg_pay`: $445 vs $401 |
| Earnings swing vs Keel paycheck swing | **$701 vs $310** | `metrics` |

Across all 3 drivers × 2 scenarios (normal, snowstorm), weeks the money ran out:

| Your limit | Keel | 4-week average | Last week's pay |
|---|---|---|---|
| 1% | **1** | 17 | 12 |
| 5% | **2** | 17 | 12 |
| 10% | **2** | 17 | 12 |
| 20% | **5** | 17 | 12 |

Forecast honesty: the low guess was right **90.9%** of test weeks (30 of 33) after calibration, vs **81.8%** before. Target 90%.

Pre-registered scorecard (written before the real run, `docs/preregistration.md`):
1. Calibration within 85–95%: **90.9%, pass**
2. Fewer empty weeks than both simple rules: **pass** (1/2/2/5 vs 17 and 12)
3. Paycheck swing at least 30% below earnings swing: **mixed, 14 of 24 runs** (Driver C passes every run)
4. Cost: Keel pays **$57 / $44 / $38 / $27** a week less than the 4-week average (at 1/5/10/20%)

**Where Keel loses (say it; judges like honesty):** Driver A still ran dry when they took a whole week off; the paycheck isn't always steadier than the 4-week average; Keel pays a bit less on average (the price of the cushion); Driver C's low guess hit 81.8%, below target; only 33 test driver-weeks.

## 6. Tour of the website (what to click, in order)

### Homepage (`/`)
- Same top bar on every page: **Keel · Home · My pay · Research**.
- Navy hero with moving "current" lines (decorative; the one flat teal line is the "keel").
- Live chart card: switch Driver A/B/C and Normal/Snowstorm; it draws jagged earnings, then the steady paycheck; hover to scrub week by week; paycheck card + cushion bars below.
- **Three simple steps:** tell us your pay → we build a cushion → you get paid the same.
- **The results:** three big numbers from the file, the snow-week example (money in vs money out bars), and a "Good to know" line on where Keel loses.
- **Get my steady paycheck** band at the bottom.

### My pay (`/app/my-pay.html`): no sign-up
- Opens straight into guest mode: no account, no bank logins; everything stays in the browser. Settings has "Start over".

### Setup questions (3 steps)
1. **About you:** first name, kind of work (driver, plumber, gardener, cleaner, handyman, designer, tutor, other).
2. **Your money:** usual weekly pay, savings you have now (becomes your starting cushion), monthly bills (rent, utilities & phone, food, car & travel, loans & cards, everything else) with a live total.
3. **Your choices:** taxes to set aside (10–25%), how careful the paycheck is (Extra safe 1% / Safe 5% / Balanced 10% / Bold 20%), and "fill in 26 practice weeks" (made-up weeks scaled to your pay so you see results instantly).

### My pay: Home tab
- Big **Your paycheck next week** number.
- **Your bills** card: "✓ Covered, with $X left over" or "Short by $X a week".
- **Savings cushion** card and **Set aside for taxes** card.
- **Your savings cushion** (short): a fill bar, "covers about N weeks of paychecks", and last week's math ("earned $723 − $109 taxes = $615 in. Paid you $615.").
- **Why this amount?** in plain words: "about a 5 in 100 chance your cushion runs out in the next 4 weeks. You chose 5 in 100."
- Chart: your pay vs your paycheck.

### My pay: My weeks tab
- Add a week (any day in the week, amount, note) with a live "we'll set aside $X for taxes, you keep $Y" preview.
- **Did Keel help?** "Without Keel" (spend what you earned) vs "With Keel" (steady paycheck): weeks short on bills, and how much each swung.
- Chart: weekly earnings bars (red when below your bills), the steady paycheck line, your bills as a dashed line.
- **Your cushion over time:** green dots when it filled up, red when it was used.
- **Week by week** table: earned, taxes, into/out of cushion, Keel paid you, cushion after, bills covered?, edit/delete. Download as a spreadsheet.

### My pay: Example tab
- "Meet a weekend ride-share driver in New York": Driver C's real-data weeks with the snowstorm, earnings swing vs paycheck swing, weeks they ran out of money (0 with Keel vs 5 paying last week's earnings), and their cushion chart. For anyone confused by the idea.

### My pay: Settings tab
- Name, kind of work, weekly pay, starting savings, taxes, how careful, bills; Save / Undo; download data; delete all weeks (asks first); log out.

### Research (`/app/`)
- Short 3-point explanation; **Our data, code and write-ups** links (NYC TLC trips, Open-Meteo weather, results.json, calibration.json, failures.md, pre-registration, summary, README, GitHub, model and paycheck-rule code); **Play payday** to step week by week.
- Full research tabs shown by default (a button can hide them): Compare (choose a paycheck, stress test, buffer recovery, where the money went, decision log, all settings) and Proof (scorecard, forecast reliability, benchmark vs simple rules, where Keel loses, safety checks).

## 7. Privacy and security (for the "is it safe?" question)

- No accounts and no sign-up: My pay runs as a guest, and everything is saved only in that browser. Nothing is sent to a server.
- Content security policy on My pay (scripts only from our own site, no frames), referrer policy, spreadsheet-safe downloads, size and range checks on every number.
- The Supabase schema (`app/supabase_schema.sql`, row level security, no access for anonymous users) is ready if cloud accounts are added later; it's not used by the page today.

## 8. Tech stack

- Data + ML: Python 3.10+, pandas, LightGBM, hand-written conformal calibration, NumPy Monte Carlo. Seeds fixed.
- Website: plain HTML/CSS/JavaScript, hand-drawn SVG charts, no framework, no build step; GitHub Pages.
- The salary rule is ported to JavaScript (`app/engine.js`) and tested to match Python exactly.
- Tests: 24 Python tests; 85 JavaScript tests (data, benchmark, recovery, paycheck, home, smoke, engine, store).

## 9. Suggested 2-minute video (for the full 2:30 version see `docs/demo_video_timeline.md`)

| Time | Show | Say |
|---|---|---|
| 0:00–0:12 | Homepage hero, chart drawing itself | "Gig pay is a slot machine. Rent isn't. Keel turns uneven pay into one steady weekly paycheck." |
| 0:12–0:30 | Hero chart: click Snowstorm; scroll to The results and the snow-week bars | "This driver is simulated, but every hour they earn what real New York ride-share drivers earned. In a snowstorm week they took home $193. Keel still paid $365, from their cushion." |
| 0:30–0:45 | Results numbers | "Paying yourself last week's earnings ran out of money 5 weeks out of 11. The 4-week average, 6. Keel, zero. The cost: about $44 a week less on average." |
| 0:45–1:05 | My pay → 3 questions (pay, savings, bills, how careful) | "Anyone can try it, no sign-up: tell us your pay, savings and bills, and pick how careful to be." |
| 1:05–1:25 | Home tab: paycheck, bills covered, cushion, Why this amount | "You get one number for next week, whether it covers your bills, and why: the most Keel can pay with only a 5 in 100 chance your cushion runs out." |
| 1:25–1:40 | My weeks: with vs without Keel + cushion chart | "My weeks shows every week with and without Keel, and how your cushion rises and falls." |
| 1:40–1:52 | How we tested Keel → experts → Proof | "Under the hood: LightGBM forecasts, conformal calibration right 91% of the time, and a Monte Carlo rule. We publish where it loses, too." |
| 1:52–2:00 | Footer disclaimer, end card | "Demo only, no real money moves. Keel: elevating the ordinary act of getting paid." |

Recording tips: serve the repo root, browser 1280×720; check the research page badge says real data (not "Toy data"); captions on; every number spoken must match the table in section 5.

## 10. Likely judge questions

- **Is the data real?** The trips, pay per hour, weather and holidays are real NYC data. The three drivers are simulated on top of it.
- **Why not just save money yourself?** Keel picks the paycheck for you each week using a forecast and a risk limit, and explains it. Simple rules ran out of money 12–17 times; Keel 1–5.
- **What's the catch?** Keel pays a bit less on average ($27–$57/week vs the 4-week average), and it still failed when a driver took a full week off.
- **Does it move money?** No. Doing that for real would need a bank partner and licensing.
- **Is My pay's forecast the same model?** No: My pay uses a simpler guess (10/50/90% points of your last 12 weeks, not calibrated). The salary rule is identical.
