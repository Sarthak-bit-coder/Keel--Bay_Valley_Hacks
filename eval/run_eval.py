"""Replay Keel and the two simple rules on the test weeks; write outputs/results.json (CONTRACT.md section 2).

Run from the repo root: python eval/run_eval.py [--csv data/weekly_earnings.csv]
Every driver is simulated. The storm scenario is INJECTED: the test window has no real snowstorm big enough,
so two mid-window weeks are cut to 45% and 60% of normal (same factors as the toy in docs/prototype.html).
"""
import argparse
import datetime as dt
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402

from src.model.train import DEFAULT_CSV, TAX, fit, load, predict  # noqa: E402
from src.policy.replay import replay, to_run  # noqa: E402

RISK_LIMITS = (0.01, 0.05, 0.10, 0.20)
HORIZON, NPATH, SEED = 4, 400, 999
START_BUFFER_WEEKS = 0.5   # starting buffer = half a week of average take-home pay (docs/preregistration.md)
BUFFER_HISTORY = 8         # weeks before the test window used for that average
STORM_CUTS = (0.45, 0.60)  # injected storm: share of normal earnings kept in the two storm weeks
Z90 = 1.2816               # standard-normal 90% quantile: low/high case are the 10% / 90% quantiles
LABELS = {"A": "Driver A: full-time, steady", "B": "Driver B: part-time", "C": "Driver C: weekends, volatile"}


def draws_from_band(lo, mid, hi, z):
    """Turn a low/mid/high forecast into simulated weeks: a two-piece normal with the 10% and 90% points at lo
    and hi. The same z matrix is used everywhere (common random numbers).
    shortcut: the 4 horizon weeks are drawn independently from next week's forecast; upgrade to multi-week
    forecasts if the horizon matters more than the demo needs."""
    down, up = (mid - lo) / Z90, (hi - mid) / Z90
    return np.maximum(0.0, mid + np.where(z < 0, down, up) * z)


def driver_series(g, scenario):
    """Arrays for one driver; storm scenario cuts two mid-test weeks. Returns arrays, test start, storm weeks."""
    gross = g["gross_payout"].to_numpy(dtype=float).copy()
    hours = g["hours"].to_numpy(dtype=float).copy()
    test = np.flatnonzero(g["split"].to_numpy() == "test")
    start, n = int(test[0]), len(test)
    if not np.array_equal(test, np.arange(start, start + n)):
        raise ValueError(f"test weeks for driver {g['driver_id'].iloc[0]} are not one block at the end")
    storm = []
    if scenario == "storm":
        for k, cut in enumerate(STORM_CUTS):
            i = start + n // 2 + k
            gross[i] *= cut
            hours[i] *= cut
            storm.append(i - start + 1)
    return gross, hours, start, n, storm


def run_driver(model, g, scenario, z):
    driver = g["driver_id"].iloc[0]
    gross, hours, start, n, storm = driver_series(g, scenario)
    net = gross * (1 - TAX)
    holidays = g["holiday_days"].to_numpy()
    if start < max(BUFFER_HISTORY, 4):
        raise ValueError(f"driver {driver} needs at least {BUFFER_HISTORY} weeks before the test window")

    def forecast(i):
        lo, mid, hi = predict(model, net, hours, holidays, i)
        return {"lo": lo, "mid": mid, "hi": hi, "draws": draws_from_band(lo, mid, hi, z),
                "top": math.ceil(mid * 1.3 / 5) * 5}

    b0 = START_BUFFER_WEEKS * float(np.mean(net[start - BUFFER_HISTORY:start]))
    weeks = [d.strftime("%Y-%m-%d") for d in g["week_start"].iloc[start:start + n]]
    out = []
    for alpha in RISK_LIMITS:
        rep = replay(net, start, n, alpha, forecast, b0)
        out.append(to_run(rep, driver=driver, label=LABELS.get(driver, f"Driver {driver}"), scenario=scenario,
                          alpha=alpha, gross=gross[start:start + n], net=net[start:start + n], week_starts=weeks,
                          horizon=HORIZON, storm_weeks=storm or None))
    return out


def summarize(runs):
    """Print the pre-registered questions so failures.md can be written from the real numbers."""
    for alpha in RISK_LIMITS:
        rs = [r for r in runs if r["risk_limit"] == alpha]
        od = {k: sum(r["metrics"]["overdraft_weeks"][k] for r in rs) for k in ("keel", "avg4", "last")}
        print(f"limit {alpha:.0%}: empty-buffer weeks keel {od['keel']}, avg4 {od['avg4']}, last {od['last']}")
    for r in runs:
        if not (r["checks"]["identity"] and r["checks"]["pay_nonnegative"]):
            raise AssertionError(f"hard check failed: {r['driver']} {r['scenario']} {r['risk_limit']} {r['checks']}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--csv", default=str(DEFAULT_CSV))
    ap.add_argument("--out", default=str(ROOT / "outputs"))
    args = ap.parse_args()
    df = load(args.csv)
    model = fit(df)
    z = np.random.default_rng(SEED).standard_normal((NPATH, HORIZON))
    runs = [run for _, g in df.groupby("driver_id", sort=True) for scenario in ("normal", "storm")
            for run in run_driver(model, g.reset_index(drop=True), scenario, z)]
    summarize(runs)
    meta = {"model": "real", "is_simulated": True,
            "generated_at": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
            "tax_rate": TAX, "start_buffer_weeks": START_BUFFER_WEEKS, "horizon_weeks": HORIZON,
            "storm": "injected: two mid-test weeks cut to 45% and 60% of normal earnings"}
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "results.json").write_text(json.dumps({"meta": meta, "runs": runs}, indent=2) + "\n")
    print(f"Wrote {len(runs)} runs to {out / 'results.json'}")


if __name__ == "__main__":
    main()
