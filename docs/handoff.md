# Role C handoff (Nov 15 2026)

Paste this file into a new Claude Code session together with `prompts/00_shared_context.md` and `prompts/03_roleC_app_writeup_video.md`.

## Where things are

- Repo folder: `C:\Users\brijb\Documents\keel`
- GitHub: https://github.com/Sarthak-bit-coder/Keel--Bay_Valley_Hacks
- Your branch: `c/app` (in sync with `origin/c/app`). `main` has everything through PR #3.
- Remote branches: `main`, `c/app`, `a/data` (Role A has pushed). No `b/ml` yet.
- GitHub CLI is installed and signed in: `C:\Program Files\GitHub CLI\gh.exe` (open a new terminal so `gh` is on PATH).
- `.claude/` is a local preview config. Do not commit it.

## Done

| What | File |
|---|---|
| Toy sample in CONTRACT format (24 runs, `meta.model = "toy"`) | `outputs/sample/results.json`, made by `node app/export_sample.mjs` |
| App loads `outputs/results.json`, falls back to the sample | `app/index.html` |
| "Toy data" / "Simulated drivers, real NYC ride-hail data" badge | `app/index.html` |
| How it works strip, calibration panel, Where Keel loses panel | `app/index.html` |
| Devpost draft, numbers as `[TBD]` | `docs/devpost.md` |
| 90-second video script, numbers as `[TBD]` | `docs/video_script.md` |
| Pass marks: 85–95% calibration, fewer empty weeks than both rules, swing ≥30% smaller | `docs/preregistration.md` |
| README rewritten around the app; deadline moved to 10 PM in prompts | `README.md`, `prompts/` |

## Left to do

Blocked on Role B (real `outputs/` due 3:30 PM):
1. Pull B's `outputs/results.json` and `outputs/calibration.json`. The app picks them up automatically; check that the badge switches to real.
2. Audit every number on screen against the file.
3. Ask B which weeks the real storm falls on. Change `STORM_AT` in `app/index.html` (0-based index, currently 11 = weeks 12–13).
4. Fill `[TBD]` in `docs/devpost.md` and `docs/video_script.md`. Copy the reasons from `outputs/failures.md`.

Blocked on Role A:
5. Test-week count in `docs/preregistration.md`.
6. TLC months used (for the Devpost "How we built it").

Can do now:
7. Page title still says "Keel prototype" (`app/index.html` `<title>`).
8. Toy badge colour ignores the manual `data-theme` switch (it only follows the system dark mode).
9. Live demo: turn on GitHub Pages from the repo root so `/app/` can reach `/outputs/`. That gives the Devpost demo link.
10. `AGENTS.md` still says the deadline is 8:00 PM.
11. `docs/devpost.md` opens with "Rideshare drivers": change to "gig workers" (use "driver" only for demo data).

Only you:
12. Teammates as collaborators, names for Devpost, "what we learned" lines.
13. Record the video by 8:00 PM, submit by 9:00 PM (hard deadline 10:00 PM).
14. Decide on a rename (two other Devpost projects are called "Keel").

## Commands

```bash
cd C:\Users\brijb\Documents\keel
git checkout c/app
git pull origin main
python -m http.server
```

Open http://localhost:8000/app/ while the server runs. Do not double-click `index.html`: the JSON will not load.

```bash
node app/export_sample.mjs
```

Rebuilds the toy sample (only if `docs/prototype.html` changes).

```bash
gh pr create --base main --head c/app --fill
```

Opens a PR to merge your branch into `main`.
