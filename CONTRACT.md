# Data contract

Three files cross role boundaries. Keep names and types exactly. If you must change one, tell the other two roles and edit this file in the same commit.

## 1. A to B: `data/weekly_earnings.csv`

One row per simulated driver per week.

| Column | Type | Meaning |
|---|---|---|
| `driver_id` | string | `A`, `B`, `C` (or more) |
| `week_start` | date (YYYY-MM-DD, Monday) | Start of the week |
| `gross_payout` | float, dollars | Money paid out by the gig apps that week, tips included |
| `hours` | float | Hours the simulated driver worked |
| `trips` | int | Trips completed |
| `temp_c` | float | Mean temperature that week (Open-Meteo) |
| `precip_mm` | float | Total precipitation |
| `snow_cm` | float | Total snowfall |
| `holiday_days` | int | Federal holidays in the week |
| `split` | string | `train`, `calib` or `test` (time-ordered: oldest train, then calib, newest test) |
| `is_simulated` | bool | Always `true` |

Also write `data/README.md` saying which TLC months were used and how drivers were built.

## 2. B to C: `outputs/results.json`

A flat list of runs. The app filters by driver, scenario and risk limit.

```json
{
  "meta": {
    "model": "real",
    "is_simulated": true,
    "generated_at": "2026-11-15T15:00:00-08:00",
    "tax_rate": 0.15,
    "start_buffer_weeks": 0.5,
    "horizon_weeks": 4
  },
  "runs": [
    {
      "driver": "A",
      "driver_label": "Driver A: full-time, steady",
      "scenario": "storm",
      "risk_limit": 0.05,
      "weeks": [
        {
          "week": 1,
          "week_start": "2026-01-05",
          "gross": 1020.0,
          "net": 867.0,
          "lo": 610.0,
          "hi": 1040.0,
          "pay_keel": 700.0,
          "pay_avg4": 760.0,
          "pay_last": 805.0,
          "buf_keel": 410.0,
          "buf_avg4": 310.0,
          "buf_last": 220.0,
          "risk": 0.04,
          "reason": "Chose $700 so the chance of running dry in the next 4 weeks is about 4% (limit 5%)."
        }
      ],
      "metrics": {
        "overdraft_weeks": {"keel": 0, "avg4": 3, "last": 2},
        "avg_pay": {"keel": 707, "avg4": 743, "last": 740},
        "pay_swing": {"keel": 500, "avg4": 450, "last": 700},
        "earnings_swing": 746,
        "tax_total": 2634,
        "low_case_hit_rate": 0.9
      },
      "checks": {"identity": true, "buffer_nonnegative": true, "pay_nonnegative": true}
    }
  ]
}
```

Definitions:
- `net` = `gross` x (1 - `tax_rate`). The tax share is set aside.
- `lo`, `hi` = Keel's calibrated low and high case for that week's `net`, made before the week.
- `buf_*` = buffer balance at the end of the week. Below zero means overdraft.
- `identity` check: `gross` = `pay_keel` + tax set-aside + change in `buf_keel`, every week.
- `scenario` is `normal` or `storm`. In `storm`, the replay window has a real or injected snowstorm. Say which in `data/README.md`.
- `risk_limit` takes 0.01, 0.05, 0.10 and 0.20.

`outputs/sample/results.json` (made by Role C from the prototype toy simulation) follows this format (`meta.model` is `"toy"`).

## 3. B to C: `outputs/calibration.json`

```json
{
  "model": "real",
  "target_low_case": 0.9,
  "calibrated_hit_rate": 0.9,
  "uncalibrated_hit_rate": 0.82,
  "n_test_weeks": 120,
  "by_driver": {"A": 0.9, "B": 0.88, "C": 0.91}
}
```

`outputs/failures.md` is a hand-written list of cases where Keel did worse than a simple rule, with the reason.
