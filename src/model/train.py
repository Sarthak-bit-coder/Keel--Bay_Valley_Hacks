"""Forecast next week's take-home pay (low / middle / high case) and calibrate the low case.

Run from the repo root: python src/model/train.py [--csv data/weekly_earnings.csv]
Writes outputs/calibration.json (CONTRACT.md section 3).

Model: three LightGBM quantile models (10%, 50%, 90%) pooled over drivers. Target and lag features are
ratios to the driver's own trailing 4-week mean, so a $900/week and a $400/week driver share one model.
Calibration: one-sided split conformal on split=calib, separately for the low and high case, so the low
case sits at or below actual take-home pay about 90% of the time. Weekly earnings are autocorrelated,
so this coverage is approximate.
"""
import argparse
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import lightgbm as lgb  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

TAX = 0.15
QUANTILES = (0.1, 0.5, 0.9)
TARGET = 0.9  # wanted share of weeks with actual take-home pay >= low case (and <= high case)
LAGS = 4
SEED = 0
COLUMNS = ["driver_id", "week_start", "gross_payout", "hours", "trips", "temp_c", "precip_mm", "snow_cm",
           "holiday_days", "split", "is_simulated"]
DEFAULT_CSV = ROOT / "data" / "weekly_earnings.csv"


def load(csv_path):
    """Read A's weekly CSV, check it against CONTRACT.md, add take-home pay `net`."""
    df = pd.read_csv(csv_path, dtype={"driver_id": str})
    missing = [c for c in COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"{csv_path} is missing columns {missing} (see CONTRACT.md)")
    if df[COLUMNS].isna().any().any():
        raise ValueError(f"{csv_path} has empty cells")
    if not set(df["split"]) <= {"train", "calib", "test"}:
        raise ValueError(f"unexpected split values {sorted(set(df['split']))}")
    df["week_start"] = pd.to_datetime(df["week_start"])
    df = df.sort_values(["driver_id", "week_start"]).reset_index(drop=True)
    df["net"] = df["gross_payout"] * (1 - TAX)
    return df


def features(net, hours, holidays, i):
    """Features for predicting week i, from weeks before i (plus holidays, which are known in advance).

    Returns (x, base): x is the feature vector, base the trailing 4-week mean used to scale the target.
    Target-week hours and weather are left out on purpose: neither is known before the week starts.
    """
    base = max(float(np.mean(net[i - LAGS:i])), 1.0)
    hours_base = max(float(np.mean(hours[i - LAGS:i])), 1.0)
    lags = [net[i - k] / base for k in range(1, LAGS + 1)]
    x = lags + [float(np.std(lags)), hours[i - 1] / hours_base, float(holidays[i])]
    return x, base


def rows(df, split):
    """Pooled feature rows for every driver-week in `split` that has LAGS weeks of history."""
    X, y, base, who = [], [], [], []
    for driver, g in df.groupby("driver_id", sort=True):
        net, hours, hol, sp = g["net"].to_numpy(), g["hours"].to_numpy(), g["holiday_days"].to_numpy(), g["split"].to_numpy()
        for i in range(LAGS, len(g)):
            if sp[i] != split:
                continue
            x, b = features(net, hours, hol, i)
            X.append(x)
            y.append(net[i] / b)
            base.append(b)
            who.append(driver)
    return np.array(X), np.array(y), np.array(base), np.array(who)


def conformal_quantile(scores, level):
    """Split-conformal quantile: the ceil((n+1) * level)-th smallest score (inf if n is too small)."""
    s = np.sort(np.asarray(scores, dtype=float))
    k = math.ceil((len(s) + 1) * level)
    return float(s[k - 1]) if k <= len(s) else math.inf


def fit(df):
    """Train on split=train, calibrate on split=calib. Returns the fitted forecaster as a dict."""
    X, y, _, _ = rows(df, "train")
    if len(y) < 20:
        raise ValueError(f"only {len(y)} training rows; need at least 20")
    models = [lgb.LGBMRegressor(objective="quantile", alpha=q, n_estimators=150, learning_rate=0.05, num_leaves=7,
                                min_child_samples=5, subsample=1.0, random_state=SEED, deterministic=True,
                                force_row_wise=True, verbose=-1).fit(X, y) for q in QUANTILES]
    model = {"models": models, "q_lo": 0.0, "q_hi": 0.0}
    Xc, yc, _, _ = rows(df, "calib")
    lo, _, hi = raw_predict(model, Xc)
    model["q_lo"] = conformal_quantile(lo - yc, TARGET)   # lower the low case by this (ratio units)
    model["q_hi"] = conformal_quantile(yc - hi, TARGET)   # raise the high case by this
    model["n_calib"] = len(yc)
    return model


def raw_predict(model, X):
    """Uncalibrated low / mid / high ratios, sorted so low <= mid <= high."""
    p = np.sort(np.column_stack([m.predict(X) for m in model["models"]]), axis=1)
    return p[:, 0], p[:, 1], p[:, 2]


def predict(model, net, hours, holidays, i, calibrated=True):
    """Low / mid / high take-home pay in dollars for week i, using only weeks before i."""
    x, base = features(net, hours, holidays, i)
    lo, mid, hi = (float(v[0]) for v in raw_predict(model, np.array([x])))
    if calibrated:
        lo, hi = lo - model["q_lo"], hi + model["q_hi"]
    return max(0.0, lo * base), max(0.0, mid * base), max(0.0, hi * base, mid * base)


def calibration_report(model, df):
    """Low-case hit rates on split=test, before and after calibration (CONTRACT.md section 3)."""
    X, y, _, who = rows(df, "test")
    lo, _, _ = raw_predict(model, X)
    hit_raw = y >= lo
    hit_cal = y >= lo - model["q_lo"]
    return {
        "model": "real",
        "target_low_case": TARGET,
        "calibrated_hit_rate": round(float(hit_cal.mean()), 3),
        "uncalibrated_hit_rate": round(float(hit_raw.mean()), 3),
        "n_test_weeks": int(len(y)),
        "by_driver": {d: round(float(hit_cal[who == d].mean()), 3) for d in sorted(set(who))},
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--csv", default=str(DEFAULT_CSV))
    ap.add_argument("--out", default=str(ROOT / "outputs"))
    args = ap.parse_args()
    df = load(args.csv)
    model = fit(df)
    report = calibration_report(model, df)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "calibration.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"calib rows {model['n_calib']}, low-case shift {model['q_lo']:+.3f}, high-case shift {model['q_hi']:+.3f} (ratio units)")
    print(f"test low-case hit rate: {report['uncalibrated_hit_rate']:.0%} before, {report['calibrated_hit_rate']:.0%} after "
          f"(target {TARGET:.0%}, {report['n_test_weeks']} driver-weeks). Wrote {out / 'calibration.json'}")


if __name__ == "__main__":
    main()
