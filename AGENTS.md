# Instructions for AI coding agents working in this repo

Read `README.md`, `CONTRACT.md` and `docs/preregistration.md` first. This is a hackathon project with a hard deadline of 8:00 PM on Nov 15, 2026. Prefer small working steps over big plans.

## Project in two lines

Keel gives gig workers a steady weekly paycheck from volatile earnings. LightGBM low/middle/high forecasts, conformal calibration, and a Monte Carlo salary rule, shown in a one-page app. Drivers are simulated on top of real NYC TLC ride-hail data.

## Ownership (do not edit another role's folders)

- Role A (data): `data/`, `src/data/`, `tests/test_data.py`. Branch `a/data`.
- Role B (ML): `src/model/`, `src/policy/`, `eval/`, `outputs/`. Branch `b/ml`.
- Role C (app): `app/`, `docs/`, `README.md`. Branch `c/app`.

Ask the human before changing `CONTRACT.md`.

## Rules

- Everything about drivers is simulated. Label it as simulated in code, UI and docs.
- No real money, no real personal data. Not financial or tax advice.
- Do not commit large files: raw TLC parquet files, model dumps, virtualenvs. They are in `.gitignore`.
- Python 3.10+. Keep dependencies to `requirements.txt`. Set random seeds.
- Every script must run from the repo root. `python run_all.py` must keep working.
- Write a small test for any function the safety checks rely on.
- Commit often with clear messages. Do not rewrite shared history.
- If something is unverified (an API, a URL, a number), say so in a comment or the README. Do not invent results.
- Results in docs or the app must come from `outputs/results.json`, not from the toy sample, once the real file exists.

## Reference

`docs/prototype.html` has a working toy version of the salary rule (see the `sim` script block) and the app layout. Use it as the target.
