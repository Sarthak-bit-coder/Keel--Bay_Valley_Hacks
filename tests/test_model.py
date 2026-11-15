"""Forecast + evaluation tests on a small synthetic table. Run from the repo root: python -m pytest tests/test_model.py"""
import math

import numpy as np
import pandas as pd
import pytest

from eval.run_eval import draws_from_band, run_driver
from src.model.train import TAX, calibration_report, conformal_quantile, fit, predict


def synthetic(n_weeks=52, seed=3):
    """Stand-in weekly table in CONTRACT.md columns (fake numbers, tests only)."""
    rng = np.random.default_rng(seed)
    weeks = pd.date_range("2025-01-06", periods=n_weeks, freq="7D")
    rows = []
    for d, mean in {"A": 1300, "B": 750, "C": 420}.items():
        for i, w in enumerate(weeks):
            split = "train" if i < 0.6 * n_weeks else "calib" if i < 0.8 * n_weeks else "test"
            hours = max(1.0, rng.normal(mean / 35, 3))
            rows.append([d, w, max(0.0, rng.normal(mean, 0.25 * mean)), hours, 10, 5.0, 1.0, 0.0, 0, split, True])
    cols = "driver_id week_start gross_payout hours trips temp_c precip_mm snow_cm holiday_days split is_simulated".split()
    df = pd.DataFrame(rows, columns=cols).sort_values(["driver_id", "week_start"]).reset_index(drop=True)
    df["net"] = df["gross_payout"] * (1 - TAX)
    return df


@pytest.fixture(scope="module")
def df():
    return synthetic()


@pytest.fixture(scope="module")
def model(df):
    return fit(df)


def test_conformal_quantile():
    assert conformal_quantile(range(1, 10), 0.9) == 9           # ceil(10 * 0.9) = 9th smallest
    assert conformal_quantile([5, 1, 3, 2, 4], 0.5) == 3
    assert conformal_quantile([1, 2], 0.9) == math.inf          # too few points to promise 90%


def test_forecast_uses_only_past_weeks(df, model):
    g = df[df.driver_id == "B"]
    net, hours, hol = g["net"].to_numpy().copy(), g["hours"].to_numpy(), g["holiday_days"].to_numpy()
    before = predict(model, net, hours, hol, 40)
    net[40:] *= 10  # change the target week and everything after it
    assert predict(model, net, hours, hol, 40) == before


def test_bands_are_ordered_and_calibration_report_has_contract_keys(df, model):
    g = df[df.driver_id == "C"]
    lo, mid, hi = predict(model, g["net"].to_numpy(), g["hours"].to_numpy(), g["holiday_days"].to_numpy(), 45)
    assert 0 <= lo <= mid <= hi
    rep = calibration_report(model, df)
    assert set(rep) == {"model", "target_low_case", "calibrated_hit_rate", "uncalibrated_hit_rate", "n_test_weeks", "by_driver"}
    assert rep["n_test_weeks"] > 0 and set(rep["by_driver"]) == {"A", "B", "C"}


def test_draws_from_band_hit_the_quantiles():
    z = np.random.default_rng(0).standard_normal((20000, 1))
    d = draws_from_band(400.0, 600.0, 900.0, z)
    assert np.quantile(d, 0.1) == pytest.approx(400, rel=0.03)
    assert np.quantile(d, 0.9) == pytest.approx(900, rel=0.03)
    assert d.min() >= 0


def test_eval_runs_pass_hard_checks_and_mark_storm_weeks(df, model):
    z = np.random.default_rng(999).standard_normal((400, 4))
    g = df[df.driver_id == "A"].reset_index(drop=True)
    n_test = int((g.split == "test").sum())
    for scenario in ("normal", "storm"):
        runs = run_driver(model, g, scenario, z)
        assert [r["risk_limit"] for r in runs] == [0.01, 0.05, 0.10, 0.20]
        for r in runs:
            assert len(r["weeks"]) == n_test
            assert r["checks"]["identity"] and r["checks"]["pay_nonnegative"]
            assert ("storm_weeks" in r) == (scenario == "storm")
    storm = run_driver(model, g, "storm", z)[0]
    normal = run_driver(model, g, "normal", z)[0]
    w = storm["storm_weeks"][0] - 1
    assert storm["weeks"][w]["gross"] == pytest.approx(0.45 * normal["weeks"][w]["gross"], abs=0.02)
