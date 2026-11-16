# Keel demo video: 2:30 timeline, voiceover, and the "make the video" prompt

- **Part 1:** the shot-by-shot timeline (screen, clicks, seconds, voiceover).
- **Part 2:** just the voiceover script, to read aloud.
- **Part 3:** one prompt to paste into Claude Code that records the whole video automatically, matching Parts 1 and 2.

The site has no log-in page. Everyone uses **My pay as a guest** (no sign-up; data stays in the browser). The top menu on every page is **Keel · Home · My pay · Research**.

**Fixed numbers** (Example tab, homepage, Research) come from `outputs/results.json` and never change. **Your own numbers** on My pay come from practice weeks that depend on today's date. Where it says **[read it]**, say the number on screen.

Before recording:
- Serve the repo root: `cd ~/Keel && python3 -m http.server 8000`.
- Use a **private window** (starts fresh), 1280×720, zoom 100%, notifications off.
- Start URL: `http://localhost:8000/`

---

## Part 1: Timeline (2:30, 16 shots)

| # | Time | Screen + actions | Voiceover |
|---|---|---|---|
| 1 | 0:00–0:09 | **Homepage.** Hero headline, moving current lines; the chart card draws jagged earnings, then the steady paycheck line. | "Gig and freelance pay goes up and down. Rent doesn't. Keel turns uneven pay into one steady weekly paycheck." |
| 2 | 0:09–0:15 | Click **Get my steady paycheck** (or **My pay** in the menu). | "No sign-up and no bank logins. You start as a guest, and your info stays in your browser." |
| 3 | 0:15–0:24 | **Step 1 of 3, About you.** Type `Sam`. Click **Driver**. Click **Next**. | "Three quick questions. First, about you: I'm Sam, and I drive for a ride-share app." |
| 4 | 0:24–0:39 | **Step 2, Your money.** Weekly pay `850`, savings `600`. Bills: Rent `1400`, Utilities `150`, Food `400`, Car & travel `200`. Total shows **$2,150 a month · about $496 a week**. Click **Next**. | "Next, my money: I usually earn about eight-fifty a week and have six hundred saved. My bills come to about five hundred a week. My savings become my starting cushion." |
| 5 | 0:39–0:47 | **Step 3, Your choices.** Taxes **15%**; hover the four safety choices, keep **Safe**; keep **Fill in 26 practice weeks** checked. Click **See my paycheck**. | "Then I choose how much to set aside for taxes and how careful my paycheck should be." |
| 6 | 0:47–0:58 | **Home tab.** The big **Your paycheck next week**, then **Your bills** ("Covered…" or "Short by…"), **Savings cushion**, **Set aside for taxes**. | "Here's my steady paycheck for next week: **[read it]**. It shows if my bills are covered, my savings cushion, and what's set aside for taxes." |
| 7 | 0:58–1:07 | Scroll to **Your savings cushion** (bar + last week's math), then **Why this amount?** | "Good weeks fill the cushion; slow weeks use it. Keel explains every paycheck: the most it can pay with only about a five-in-a-hundred chance the cushion runs out." |
| 8 | 1:07–1:19 | Click **My weeks**. Type `300`, note `snow week`; point at the tax preview; click **Save week**. Scroll to **Did Keel help?** and its chart. | "In My weeks I log what I earn. A bad snow week? The cushion covers it. Here I compare my weeks with and without Keel against my bills." |
| 9 | 1:19–1:26 | Scroll to **Your cushion over time**, then the **Week by week** table; hover **Download**. | "I can watch my cushion rise and fall, see every week in a table, and download it." |
| 10 | 1:26–1:40 | Click **Example**. The three boxes (**$701** pay swing, **$310** paycheck swing, **0 of 11** vs 5 of 11), the chart, then the snow-week line (**$193** taken home, Keel paid **$365**). | "Confused? The Example tab uses our real data: a weekend driver in New York. Their pay swung seven hundred dollars; their Keel paycheck, just three-ten. In a snowstorm week they took home a hundred ninety-three, and Keel still paid three sixty-five." |
| 11 | 1:40–1:47 | Click **Settings**. Click **Bold**, then **Save**. The Home paycheck number changes. | "Want more pay and a thinner cushion? Change it in Settings and the paycheck updates instantly." |
| 12 | 1:47–1:57 | Click **Research** in the top menu. Pan over **The short version**, then **Our data, code and write-ups** (NYC TLC trips, weather, results files, pre-registration, GitHub). | "Our Research tab shows how we built it: a year of real New York ride-share trips, real weather, and every file and line of code, open for anyone to check." |
| 13 | 1:57–2:06 | Choose **Snowstorm stress test**, click **Play payday**; the paycheck receipt appears. Scroll to **Earnings swing. The paycheck holds steady.** | "We replayed eleven weeks the model never saw, one payday at a time, including two real December snowstorms." |
| 14 | 2:06–2:15 | Click tab **2. Compare**: show **Choose a paycheck** and **Stress test**. | "You can compare every setting, see the stress test, and see exactly where each dollar went." |
| 15 | 2:15–2:26 | Click tab **3. Proof & weak spots**: **Scorecard**, **Forecast reliability**, then **Where Keel loses**. | "The proof: our low forecast was right ninety-one percent of the time. Paying last week's earnings ran out of money twelve times; Keel, just twice. And we list where Keel falls short." |
| 16 | 2:26–2:30 | End card: Keel logo + "Demo only. No real money moves. Not financial or tax advice." + GitHub link. | "Keel: elevating the ordinary act of getting paid." |

### Numbers you can say safely (checked against `outputs/results.json`)
- Example tab (Driver C, snowstorm weeks, 5%): pay swing **$701**, Keel paycheck swing **$310**, ran out **0 of 11** with Keel vs **5 of 11** paying last week's earnings (6 of 11 with the 4-week average). Dec 8 snow week: took home **$193**, Keel paid **$365**.
- All drivers, both scenarios, 5% limit: ran out **2** times with Keel vs **12** (last week's pay) and **17** (4-week average).
- Low forecast right **90.9%** of test weeks (target 90%; 81.8% before calibration). **11** test weeks.
- Cost: Keel pays about **$44 a week** less on average than the 4-week average (Driver C, snowstorm, 5%).

---

## Part 2: Voiceover script (read aloud, about 330 words)

1. Gig and freelance pay goes up and down. Rent doesn't. Keel turns uneven pay into one steady weekly paycheck.
2. No sign-up and no bank logins. You start as a guest, and your info stays in your browser.
3. Three quick questions. First, about you: I'm Sam, and I drive for a ride-share app.
4. Next, my money: I usually earn about eight-fifty a week and have six hundred saved. My bills come to about five hundred a week. My savings become my starting cushion.
5. Then I choose how much to set aside for taxes and how careful my paycheck should be.
6. Here's my steady paycheck for next week: [read it]. It shows if my bills are covered, my savings cushion, and what's set aside for taxes.
7. Good weeks fill the cushion; slow weeks use it. Keel explains every paycheck: the most it can pay with only about a five-in-a-hundred chance the cushion runs out.
8. In My weeks I log what I earn. A bad snow week? The cushion covers it. Here I compare my weeks with and without Keel against my bills.
9. I can watch my cushion rise and fall, see every week in a table, and download it.
10. Confused? The Example tab uses our real data: a weekend driver in New York. Their pay swung seven hundred dollars; their Keel paycheck, just three-ten. In a snowstorm week they took home a hundred ninety-three, and Keel still paid three sixty-five.
11. Want more pay and a thinner cushion? Change it in Settings and the paycheck updates instantly.
12. Our Research tab shows how we built it: a year of real New York ride-share trips, real weather, and every file and line of code, open for anyone to check.
13. We replayed eleven weeks the model never saw, one payday at a time, including two real December snowstorms.
14. You can compare every setting, see the stress test, and see exactly where each dollar went.
15. The proof: our low forecast was right ninety-one percent of the time. Paying last week's earnings ran out of money twelve times; Keel, just twice. And we list where Keel falls short.
16. Keel: elevating the ordinary act of getting paid.

Recording rules: under 2:30; captions on; if the paycheck says "Short by…", say it; never say Keel moves money or gives financial advice; never say a number that isn't on screen or in the safe list.

---

## Part 3: The "make the video" prompt (paste into Claude Code, run from `~/Keel`)

```text
You are producing Keel's 2:30 hackathon demo video, fully automated, on this Mac, from the repo in the current
directory. Follow docs/demo_video_timeline.md EXACTLY: Part 1 gives the 16 shots, their order, timings and on-screen
actions; Part 2 gives the voiceover word for word. Outputs: demo/keel_demo.mp4 (1280x720, 30 fps, H.264 + AAC,
≤ 2:30), demo/keel_demo.srt (captions), demo/keel_demo_captioned.mp4 (captions burned in), demo/frames/NN.png
(one still per shot). Do not change any app code. Every number spoken must be in the "Numbers you can say safely"
list or read from the page at runtime.

TOOLS (install only into demo/.venv or via npx; ask me before any global install):
- Playwright (Python or Node) + Chromium for scripted browsing and video recording.
- macOS `say` for voiceover (voice "Samantha", rate ~165 wpm), unless I give you another TTS.
- ffmpeg for assembly (ask before `brew install ffmpeg` if it's missing).

STEP 1, SERVE: run `python3 -m http.server 8000` from the repo root in the background. Check that
http://localhost:8000/outputs/results.json and /outputs/calibration.json return 200.

STEP 2, VOICEOVER FIRST: write each Part 2 line to demo/vo/NN.txt and render
`say -v Samantha -r 165 -o demo/vo/NN.aiff -f demo/vo/NN.txt`. Line 6 contains "[read it]": render it after step 3
reads the paycheck. Measure every clip with ffprobe. Shot length = max(Part 1 slot, clip + 0.3 s). If the total is
over 150 s, shorten pauses first, then raise the rate (max 180 wpm); never cut words.

STEP 3, SCREEN RECORDING: Playwright Chromium, viewport 1280x720, deviceScaleFactor 1, record_video_dir=demo/raw,
a FRESH browser context (empty storage), reduced motion OFF. Inject a visible cursor dot that follows the mouse.
Before every click, glide the mouse to the target over ~400 ms (page.mouse.move with steps). Type with
keyboard.type(..., delay=60). Scroll smoothly (element.scrollIntoView({behavior:"smooth", block:"center"})).
Hold each shot for its planned length with wait_for_timeout. Log each shot's start time to demo/shots.json.

Exact actions (these selectors exist in index.html, app/my-pay.html and app/index.html):
 1  goto http://localhost:8000/ ; wait until #heroplot svg exists ; hold so the chart draw animation plays.
 2  click the hero button "Get my steady paycheck" (a.btn inside .herotext .cta) ; wait for #p-name.
 3  click #p-name, type "Sam" ; click #p-jobtiles button[data-job="driver"] ; click #p-save.
 4  type "850" into #p-pay, "600" into #p-savings, "1400" into #x-housing, "150" into #x-utilities, "400" into #x-food,
    "200" into #x-transport ; hover #p-billtotal (expect "$2,150 a month") ; click #p-save.
 5  hover #p-taxseg button[data-t="0.15"] ; hover each #p-risktiles button ; make sure #p-example is checked ;
    click #p-save.
 6  wait for #ph-pay text ; READ it (for line 6) ; hover #ph-pay, #k-bills, #k-buf, #k-tax in turn.
 7  scroll to #cbar ; pause ; scroll to #ph-reason.
 8  click a[data-sec="weeks"] ; click #e-gross, type "300" ; click #e-note, type "snow week" ; hover #e-preview ;
    click #e-add ; scroll to #w-compare ; hover #c-weeks.
 9  scroll to #c-cushion ; pause ; scroll to #e-table ; hover the first [data-export] button.
10  click a[data-sec="example"] ; wait for #ex-swing0 text ; hover #ex-swing0, #ex-swing1, #ex-od ; scroll to #c-ex ;
    hover #ex-snow. VERIFY: #ex-swing0 is "$701", #ex-swing1 is "$310", #ex-od starts "0 of 11", #ex-snow contains
    "$193" and "$365". If not, STOP and tell me.
11  click a[data-sec="settings"] ; click #s-risk button[data-r="0.2"] ; click #s-save ; wait for the home view ;
    hover #ph-pay ; log old → new paycheck.
12  click the header menu link "Research" (header .links a, text "Research") ; wait for #hero content ;
    hover .simplecard ; scroll to #sources and pan the mouse across its four columns.
13  click #sc-storm ; click #runreplay ; wait for #payday content ; scroll to #c1.
14  click .tabs a[data-view="plan"] ; scroll to #opt-h ; pause ; scroll to #st-h.
15  click .tabs a[data-view="evidence"] ; scroll to #score ; pause ; scroll to #rel-h ; pause ; scroll to #lose-h.
16  open a local end-card page you create at demo/endcard.html: 1280x720, navy #0C1C2D background, teal #66D7BE accent,
    Inter font, text "Keel", "Your work changes. Your payday shouldn't.", "Demo only. No real money moves. Not
    financial or tax advice.", and https://github.com/Sarthak-bit-coder/Keel--Bay_Valley_Hacks ; hold 4 s.

STEP 4, ASSEMBLE (ffmpeg): convert the recording to 30 fps H.264 ; place each voiceover clip at its shot start from
demo/shots.json (adelay + amix) ; voice only, no music unless I provide a file ; loudness -16 LUFS ; trim to
≤ 150 s → demo/keel_demo.mp4.

STEP 5, CAPTIONS: build demo/keel_demo.srt from the Part 2 lines and their times (≤ 2 lines, ≤ 42 characters per
line) ; burn in (white text on a dark translucent box, bottom center) → demo/keel_demo_captioned.mp4.

STEP 6, VERIFY AND REPORT:
 - ffprobe both videos: ≤ 150.0 s, 1280x720, audio present.
 - Save the middle frame of each shot to demo/frames/NN.png and look at every one. Each must match Part 1
   (homepage hero, setup steps 1-3, Home paycheck, cushion/why, My weeks charts, cushion + table, Example tab,
   Settings, Research short version + links, Play payday, Compare tab, Proof tab, end card). Re-record any wrong shot.
 - Report the final length, the paycheck numbers from shots 6 and 11, and anything you changed and why.

DON'TS: don't commit demo/ or any video to git unless I ask ; don't type real personal or financial info ;
don't change app code ; don't speak any number not on screen or in the safe list.
```
