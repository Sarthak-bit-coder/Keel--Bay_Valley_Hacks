# Role B: Forecast, salary policy, evaluation

**Who:** Friend 2 (Codex subscription + Claude Max / Claude Code). **Branch:** `b/ml`. **Owns:** `src/model/`, `src/policy/`, `eval/`, `outputs/`.
**Tool plan:** Claude Code (Max) for design and the tricky parts (conformal calibration, Monte Carlo policy). Codex for writing tests, plots and repetitive code. Have one tool review the other's work on the policy code.

## Goal
Turn `data/weekly_earnings.csv` into `outputs/results.json` and `outputs/calibration.json` as defined in `CONTRACT.md`, and write `outputs/failures.md`.

## Paste this into Claude Code (or Codex)

```
[paste prompts/00_shared_context.md first]

You are Role B (ML). Work only in src/model/, src/policy/, eval/, outputs/ on branch b/ml. Read CONTRACT.md and docs/prototype.html (the "sim" script is the toy version of the salary rule).

Task:
1. src/model/train.py: for each driver-week, features = lagged net earnings (1, 2, 3, 4-week), 4-week mean, hours, weather, holiday_days. Train three LightGBM quantile models (alpha 0.1, 0.5, 0.9) on split=train. Time-ordered only; no shuffling; no leakage from the target week.
2. Conformal calibration on split=calib (conformalized quantile regression, CQR; the MAPIE library supports this). Report the low case's hit rate before and after calibration on split=test. Write outputs/calibration.json.
3. src/policy/salary.py: pure function pay_keel(history, buffer, alpha, rng_draws) that searches pay levels from high to low and returns the highest weekly pay whose simulated chance of the buffer going below zero over the next 4 weeks is <= alpha. Use the forecast distribution (low/mid/high) to sample future weeks. Use the same random draws (common random numbers) for every pay level and for every baseline.
4. Baselines in src/policy/baselines.py: last week's net earnings, and the trailing 4-week mean.
5. eval/run_eval.py: replay each driver over the test weeks for scenarios normal and storm, risk limits 0.01, 0.05, 0.10, 0.20. Track buffer balances for all three rules. Write outputs/results.json exactly as CONTRACT.md says, including a plain-English `reason` string for each week and the three hard checks (identity, buffer nonnegative, pay nonnegative).
6. Write outputs/failures.md listing where Keel does worse than a baseline and why.
7. Fill in the blanks in docs/preregistration.md BEFORE running on test data (ask me for the pass marks).

Explain each step in plain English as if for a smart high-school student. Show commands to run. Do not tune on split=test.
```

## Timeline
- **10:00 to 11:15:** agree the contract with A and C. Build `pay_keel` and the baselines against the toy sample (port the toy logic from the prototype into Python and match its output). Fill in `docs/preregistration.md` and commit it.
- **11:15 to 1:00 PM:** train quantile models on A's sample file; write `eval/run_eval.py` using stand-in forecasts.
- **1:00 to 3:30 PM:** run on A's real CSV; calibration; full `results.json`. **Commit `outputs/results.json` by 3:30 PM.**
- **3:30 to 5:00 PM:** `failures.md`, `calibration.json`, review and re-run once. Do not tune on the test weeks after seeing results; add a dated note in the pre-registration instead.
- **After 5:00 PM:** support C with numbers for the write-up and a 30-second explanation of each metric.

## Definition of done
- `python run_all.py` reproduces `outputs/` from the CSV.
- Hard checks pass on every run.
- Calibration hit rate and baseline comparisons reported honestly, including losses.

## If you fall behind
Drop LightGBM for plain empirical quantiles of the last 8 weeks plus conformal widening. Say so in the write-up. The policy and the evaluation are what matter most.
