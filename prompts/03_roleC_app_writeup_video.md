# Role C: App, write-up, video, submission

**Who:** Brij. **Branch:** `c/app`. **Owns:** `app/`, `docs/`, `README.md`, and the submission.
**Tool plan (limited tiers, so be deliberate):**
- **Claude Code (Pro):** the main app work. Use it for focused tasks (wire the app to JSON, fix charts). Don't let it wander; it will run out of usage if sessions are long.
- **Antigravity (free):** UI polish and trying layout changes in the browser.
- **Codex (free):** small isolated fixes, accessibility pass, tests for the app's data loading.
- **Grok (free):** first drafts of the Devpost story and the video script. You edit them. Check every fact against `outputs/`.

## Goal
Turn `docs/prototype.html` into the real app, driven by `outputs/results.json`, and ship a polished submission with a clear pitch.

## Paste this into Claude Code

```
[paste prompts/00_shared_context.md first]

You are Role C (app). Work only in app/, docs/, README.md on branch c/app. The starting point is app/index.html (a copy of docs/prototype.html, which runs on a toy simulation).

Task:
1. Keep the one-page layout. Replace the toy simulation with a loader that fetches outputs/results.json (format in CONTRACT.md) and fills the same charts, tiles, scorecard, safety checks and decision log from the `runs` array. The filters (driver, scenario, risk limit) select the matching run.
2. Until the real file exists, use outputs/sample/results.json. Show a visible "Toy data" badge whenever meta.model is "toy", and "Simulated drivers, real NYC ride-hail data" when it is "real".
3. Add a calibration panel from outputs/calibration.json: a simple bar or dial showing the target and actual hit rate for the low case.
4. Add a short "How it works" strip (4 steps) and a "Where Keel loses" panel fed from outputs/failures.md (hard-coded text is fine).
5. Keep accessibility: keyboard focus, table view, colorblind-safe colors, light and dark mode.
6. Keep it a static site: open app/index.html or deploy the app/ folder to GitHub Pages or any static host.

Show me the changes as small diffs. Do not rewrite the file wholesale.
```

## Timeline
- **10:00 to 11:15:** agree the contract. **Generate `outputs/sample/results.json` yourself** by running the toy simulation from the prototype's `sim` block in Node and writing the CONTRACT format (ask Claude Code to do this: "export the sim results for all drivers, scenarios and risk limits into the CONTRACT.md format"). Commit it so B and you can both use it.
- **11:15 to 1:30 PM:** wire the app to the sample file. Start the Devpost draft in a doc (problem, who it helps, how it works, what we built, what we learned, what's next).
- **1:30 to 3:30 PM:** polish the UI. Take screenshots. Draft the video script (see below).
- **3:30 to 5:30 PM:** swap in the real `results.json` from B. Check every number on screen against the file. Run the safety checks and the table view.
- **5:30 to 6:30 PM:** finish the write-up. Add the honest limits (simulated drivers, approximate coverage, no real money).
- **6:30 to 7:00 PM:** record the video. Upload.
- **7:00 to 7:30 PM:** fill in the submission form. Test every link while logged out. Submit by **7:30 PM**.

## Video script (about 90 seconds)
1. **0:00 to 0:15** Hook: "Gig workers get paid like a slot machine. Keel pays them like an employer."
2. **0:15 to 0:45** Show the running app: jagged earnings line next to the flat paycheck line. Replay the snowstorm week.
3. **0:45 to 1:05** Show the buffer chart: two simple rules go into overdraft, Keel does not (say the real numbers from `results.json`).
4. **1:05 to 1:20** How it works in one breath: forecast, calibrate, pick the highest safe salary.
5. **1:20 to 1:30** Limits and ethics: drivers are simulated, no real money, not advice. Close with the theme: "We elevated the ordinary act of getting paid."

## Submission checklist
- Project name, tagline, track(s): AI/ML, Fintech, Best Overall. Confirm the form or Devpost's track rules first; read them again at the start.
- Links: repo, live demo or the app file, video.
- 3 to 5 screenshots (hero chart first).
- Team members and what each built.
- Pre-registration and failures file linked in the write-up.
- Judging rubric pass: one sentence for each of creativity, technical difficulty, functionality, UI/UX, theme, pitch.

## Definition of done
- App runs from `app/index.html` with real results.
- Every number on screen matches `outputs/results.json`.
- Video under 2 minutes. Submission confirmed.

## If you fall behind
Ship the prototype layout with the real numbers pasted from `results.json` and the "Toy data" badge removed only if the numbers are real. Never leave toy numbers on screen unlabeled.
