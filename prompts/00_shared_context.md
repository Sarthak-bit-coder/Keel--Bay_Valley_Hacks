# Shared context (paste this FIRST in every AI session, then your role prompt)

You are helping a 3-person high-school team at Bay Valley Hacks (online, Nov 15 2026). Hacking starts 10:00 AM. Final submission deadline is 10:00 PM; aim to submit by 9:00 PM. Every team must submit a video. Tracks: AI/ML, Fintech, Best Overall. Judges score: creativity and originality, technical difficulty, functionality, UI/UX, theme relevance, presentation and pitch.

The theme is **"Elevate the Ordinary."**

**Project: Keel.** A steady weekly paycheck for gig workers and freelancers, proven here on simulated ride-hail drivers built on real NYC ride-hail data. Use "gig worker" in general copy and "driver" only for the demo data. It forecasts their volatile earnings with LightGBM (low/middle/high case), calibrates the low case with conformal prediction, and uses a Monte Carlo rule to pick the highest weekly salary that keeps the chance of an empty buffer below a chosen limit. It is shown in a one-page app that replays a snowstorm week: jagged earnings line next to a flat paycheck line.

**Hard rules**
- Drivers are SIMULATED on top of real NYC TLC high-volume ride-hail records (no driver ID exists). Never claim real drivers or real money.
- Simulation only. Not financial or tax advice. Say so in the UI and write-up.
- Do not invent results, URLs or numbers. If unsure, say "unverified" and tell the human.
- Read first: `README.md`, `CONTRACT.md`, `AGENTS.md`, `docs/preregistration.md`. The toy version of the salary rule and the app is `docs/prototype.html`.
- Stay in your own folders. Ask the human before changing `CONTRACT.md`.
- Commit small and often to your own branch. Never force-push. Never commit raw data or secrets.
- Prefer the simplest thing that works by the next checkpoint. A finished simple version beats an unfinished clever one.

**Working style (saves tokens on limited plans)**
- Give the agent one file or task at a time. Paste only the relevant file, not the repo.
- Ask for a plan in 5 lines, then code. Ask for diffs, not full rewrites.
- When something fails, paste the exact error and the 20 lines around it.
- Start a fresh session per task and re-paste this file plus your role file.

**Checkpoints:** 11:15 data loads (Gate 1) and contract agreed / 1:00 PM simulated drivers credible (Gate 2) / 3:30 PM real results.json / 5:30 PM app wired and numbers audited / 7:00 PM write-up and screenshots / 8:00 PM video recorded / 9:00 PM submitted (deadline 10:00 PM).
