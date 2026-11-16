# Keel demo video: 2:30 timeline + "make the video" prompt

Part 1 is the shot-by-shot timeline (what's on screen, what to click, how long, what to say).
Part 2 is one prompt you paste into Claude Code to record the whole video automatically, with voiceover and captions that match Part 1.

**Fixed numbers** (Example tab, homepage, research page) come from `outputs/results.json` and never change.
**Your own numbers** on My pay come from the practice weeks, which depend on today's date. Where the script says **[read it]**, say the number that's on screen.

Setup before recording:
- Serve the repo root (`cd ~/Keel && python3 -m http.server 8000`) or use the live site.
- Browser window 1280×720, zoom 100%, light mode, no bookmarks bar, notifications off.
- Open a **private window**, so you start logged out as a brand-new visitor.
- Start URL: `http://localhost:8000/app/my-pay.html`

---

## Part 1: Timeline (2:30)

About 150 words per minute. Each voiceover line fits its time slot.

| # | Time | Screen + actions | Voiceover |
|---|---|---|---|
| 1 | 0:00–0:08 | **Log in page.** Navy background with moving current lines. Slowly move the mouse over the card: Log in / Sign up tabs, Google button, email form. | "Gig and freelance pay goes up and down. Rent doesn't. Keel turns uneven pay into one steady weekly paycheck." |
| 2 | 0:08–0:15 | Point at **Sign up with Google**, then the email + password fields. Click **Continue as guest**. | "Sign up with Google or email. Passwords are never stored and your data is locked. Or just continue as a guest." |
| 3 | 0:15–0:24 | **Step 1 of 3, About you.** Type `Sam`. Click the **Driver** tile. Click **Next**. | "Three quick questions. First, about you: I'm Sam, and I drive for a ride-share app." |
| 4 | 0:24–0:39 | **Step 2, Your money.** Weekly pay `850`, savings `600`. Bills: Rent `1400`, Utilities `150`, Food `400`, Car & travel `200`. The total updates live (**$2,150 a month, about $496 a week**). Click **Next**. | "Next, my money: I usually earn about eight-fifty a week and have six hundred saved. My bills add up to about five hundred a week. My savings become my starting cushion." |
| 5 | 0:39–0:48 | **Step 3, Your choices.** Leave taxes at **15%**. Hover **Extra safe / Safe / Balanced / Bold**, leave **Safe**. Keep **Fill in 26 practice weeks** checked. Click **See my paycheck**. | "Then I choose how much to set aside for taxes and how careful my paycheck should be." |
| 6 | 0:48–1:00 | **Home tab.** Pause on **Your paycheck next week**, then the **Your bills** card ("Covered…" or "Short by…"), **Savings cushion**, **Set aside for taxes**. | "Here's my steady paycheck for next week: **[read it]**. It tells me if my bills are covered, how big my savings cushion is, and what's set aside for taxes." |
| 7 | 1:00–1:09 | Scroll to **Your savings cushion** (bar + last week's math), then **Why this amount?** | "Good weeks fill the cushion; slow weeks use it. And Keel explains every paycheck: it's the most it can pay with only about a five-in-a-hundred chance my cushion runs out." |
| 8 | 1:09–1:16 | Scroll to **Your pay vs. your paycheck**; hover the chart to show a week's tooltip. | "This chart says it all: my pay jumps around, my Keel paycheck stays steady." |
| 9 | 1:16–1:29 | Click **My weeks**. In **Add a week** type `300`, note `snow week`; point at the tax preview; click **Save week**. Scroll to **Did Keel help?** and the chart (red bars below the dashed bills line, flat teal paycheck line). | "In My weeks I log what I earned. A bad snow week? Keel covers it from the cushion. Here I can compare my weeks with and without Keel against my bills." |
| 10 | 1:29–1:36 | Scroll to **Your cushion over time**, then the **Week by week** table; hover **Download**. | "I can watch my cushion rise and fall, see every week in a table, and download it anytime." |
| 11 | 1:36–1:51 | Click **Example**. Point at the three boxes (**$701** pay swing, **$310** paycheck swing, **0 of 11 with Keel vs 5 of 11**), the chart, then the snow-week line (**$193** taken home, Keel paid **$365**). | "Confused? The Example tab uses our real data: a weekend driver in New York. Their pay swung seven hundred dollars; their Keel paycheck, just three-ten. In a snowstorm week they took home a hundred ninety-three, and Keel still paid three sixty-five. They never ran out of money." |
| 12 | 1:51–1:59 | Click **Settings**. Click **Bold**, then **Save**. Click **Home**: the paycheck number changes. | "Want more pay and a thinner cushion? Change it in Settings and the paycheck updates instantly." |
| 13 | 1:59–2:10 | Click **Home** in the top bar (homepage). Hero chart draws; click **Snowstorm** in the chart card. Scroll past **Three simple steps** to **The results**. | "The homepage shows the same idea on drivers built from a year of real New York ride-share trips. Paying last week's earnings ran out of money twelve times; Keel, just twice." |
| 14 | 2:10–2:18 | Footer → **How we tested Keel**. Point at **The short version**, then click **Play payday**. | "Want proof? We replayed eleven weeks the model never saw, one payday at a time." |
| 15 | 2:18–2:26 | Click **Show all the detailed numbers (for experts)**, then **3. Proof & weak spots** (Scorecard). | "Under the hood: LightGBM forecasts, calibration right ninety-one percent of the time, and a Monte Carlo paycheck rule. We show where it falls short, too." |
| 16 | 2:26–2:30 | End card: Keel logo + "Demo only. No real money moves. Not financial or tax advice." + repo link. | "Keel: elevating the ordinary act of getting paid." |

### Numbers you can say safely (checked against `outputs/results.json`)
- Example tab (Driver C, snowstorm weeks, 5%): pay swing **$701**, Keel paycheck swing **$310**, ran out **0 of 11** with Keel vs **5 of 11** paying last week's earnings (6 of 11 with the 4-week average). Snow week Dec 8: took home **$193**, Keel paid **$365**.
- Across all drivers at the 5% limit: Keel ran out **2** times vs **17** (4-week average) and **12** (last week's pay).
- Forecast low guess right **90.9%** of test weeks (target 90%; 81.8% before calibration).
- Cost: Keel pays about **$44 a week** less on average than the 4-week average (5% limit).

### Rules
- Keep it under 2:30. Captions on (judges often watch muted).
- If the paycheck says "Short by…", say so. Don't re-record to hide it.
- Don't say Keel moves money or gives financial advice.

---

## Part 2: The "make the video" prompt (paste into Claude Code, run from `~/Keel`)

```text
You are producing Keel's 2:30 hackathon demo video, fully automated, on this Mac, from the repo in the current
directory. Follow docs/demo_video_timeline.md Part 1 EXACTLY: same 16 shots, same order, same timings, same
voiceover words. Output: demo/keel_demo.mp4 (1280x720, 30 fps, H.264 + AAC, ≤ 2:30), demo/keel_demo.srt (captions),
and demo/keel_demo_captioned.mp4 (captions burned in). Do not change any app code. Do not invent numbers: every
number spoken must be either in the timeline's "Numbers you can say safely" list or read from the page at runtime.

TOOLS (install only into a local virtualenv in demo/.venv or with npx; ask before any global install):
- Playwright (Python or Node) with Chromium for scripted browsing + video recording.
- macOS `say` for the voiceover (voice "Samantha", rate ~165 wpm), or ask me for another TTS.
- ffmpeg for assembly (ask before `brew install ffmpeg` if it's missing).

STEP 1: SERVE: run `python3 -m http.server 8000` from the repo root in the background. Base URL http://localhost:8000.
Confirm http://localhost:8000/outputs/results.json returns 200 (the Example tab and homepage need it).

STEP 2: VOICEOVER FIRST (it sets the timing). For each of the 16 shots, write the exact voiceover line to
demo/vo/NN.txt, then render with `say -v Samantha -r 165 -o demo/vo/NN.aiff -f demo/vo/NN.txt`. For shots 6 and later,
replace "[read it]" with the paycheck number read from the page in step 3 (render shot 6 audio after step 3 if
needed). Measure each clip's duration with ffprobe. Each shot's on-screen time = max(timeline slot, audio length
+ 0.3 s). If the total goes over 150 s, shorten pauses first, then raise the speech rate up to 180 wpm, and never
cut words.

STEP 3: SCREEN RECORDING. Playwright, Chromium, viewport 1280x720, deviceScaleFactor 1, record_video_dir=demo/raw,
a FRESH context (empty storage = logged-out new visitor), reduced motion OFF (the moving background is part of
the look). Move the mouse visibly: before every click, glide the cursor to the element over ~400 ms (use
page.mouse.move with steps) and add a visible cursor dot (inject a small fixed-position div that follows mouse
events). Type with page.keyboard.type(..., delay=60) so typing is visible. Wait for each shot's planned duration
with page.wait_for_timeout so the video lines up with the audio. Record a timestamp log (shot number → start
second) to demo/shots.json.

Exact actions and selectors (these IDs exist in app/my-pay.html, index.html and app/index.html):
 1  goto /app/my-pay.html ; wait 1.5 s ; hover the card (#auth-h), then the Google area (#g-gis or #b-google), then #a-email.
 2  hover #g-gis (or #b-google) ; hover #a-email then #a-pass ; click #b-guest.
 3  click #p-name, type "Sam" ; click #p-jobtiles button[data-job="driver"] ; click #p-save.
 4  type "850" into #p-pay ; "600" into #p-savings ; "1400" into #x-housing ; "150" into #x-utilities ;
    "400" into #x-food ; "200" into #x-transport ; pause on #p-billtotal ; click #p-save.
 5  hover #p-taxseg button[data-t="0.15"] ; hover each #p-risktiles button ; ensure #p-example is checked ; click #p-save.
 6  wait for #ph-pay to have text ; READ #ph-pay text (use it in the shot-6 voiceover) ; hover #ph-pay, #k-bills,
    #k-buf, #k-tax in turn.
 7  scroll #cbar into view (smooth) ; pause ; scroll #ph-reason into view.
 8  scroll #c-pay into view ; move the mouse slowly across #c-pay svg so the week tooltip (.tip) shows.
 9  click a[data-sec="weeks"] ; click #e-gross, type "300" ; click #e-note, type "snow week" ; pause on #e-preview ;
    click #e-add ; scroll #w-compare into view ; pause on #c-weeks.
10  scroll #c-cushion into view ; pause ; scroll #e-table into view ; hover the [data-export] button next to it.
11  click a[data-sec="example"] ; wait for #ex-swing0 text ; hover #ex-swing0, #ex-swing1, #ex-od ; scroll #c-ex into
    view ; pause on #ex-snow. Check on screen: #ex-swing0 = "$701", #ex-swing1 = "$310", #ex-od starts "0 of 11",
    #ex-snow mentions "$193" and "$365". If they differ, STOP and tell me (results changed; script must be updated).
12  click a[data-sec="settings"] ; click #s-risk button[data-r="0.2"] ; click #s-save ; click a[data-sec="home"] ;
    pause on #ph-pay (it should change; note old → new in the log).
13  click header nav link "Home" (header .links a with text "Home") ; wait for #heroplot svg ; wait 2 s for the draw
    animation ; click the "Snowstorm" button inside #heroswitch ; wait 1.5 s ; scroll #how into view ; then scroll
    #figures into view and pause.
14  scroll to footer ; click footer link "How we tested Keel" ; wait for #hero content ; hover .simplecard ;
    click #runreplay ; pause on the payday receipt (#payday).
15  click #expert-toggle ; click .tabs a[data-view="evidence"] ; scroll #score into view.
16  render an end card: a 1280x720 HTML page (same colors: navy #0C1C2D background, teal #66D7BE accent, Inter font)
    with the Keel logo text, "Your work changes. Your payday shouldn't.", the line "Demo only. No real money moves.
    Not financial or tax advice.", and https://github.com/Sarthak-bit-coder/Keel--Bay_Valley_Hacks ; hold 4 s.

STEP 4: ASSEMBLE with ffmpeg: convert the Playwright .webm to 30 fps H.264 ; place each voiceover clip at its shot's
start time from demo/shots.json (adelay + amix) ; add a quiet, royalty-free-or-silent bed only if I provide one
(otherwise voice only) ; normalize loudness to -16 LUFS ; trim to ≤ 150 s ; write demo/keel_demo.mp4.

STEP 5: CAPTIONS: build demo/keel_demo.srt from the voiceover lines and their start/end times (max 2 lines,
≤ 42 characters per line), then burn them in (white text, dark semi-transparent box, bottom center) to
demo/keel_demo_captioned.mp4.

STEP 6: VERIFY, then report:
 - ffprobe both files: duration ≤ 150.0 s, 1280x720, audio present.
 - Extract a frame at the middle of each shot to demo/frames/NN.png and look at them: each must show the screen the
   timeline describes (login card, setup steps 1–3, Home with paycheck, Home chart, My weeks charts, cushion chart +
   table, Example tab, Settings, homepage hero + results, research Play payday, research Proof tab, end card). Fix and re-record any shot that's wrong.
 - Report: final duration, the paycheck numbers read in shots 6 and 10, any shot you had to change and why.

DON'TS: don't commit the video or demo/ folder to git (it's large) unless I ask ; don't sign in with a real
Google account ; don't type real personal or financial data ; don't speed up the app with code changes ;
don't speak any number not on screen or in the safe list.
```
