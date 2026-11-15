"""Build data/weekly_earnings.csv (CONTRACT.md section 1) from real TLC daily totals plus simulated drivers.

Stand-in written by Role B so the pipeline runs end to end; Role A's version replaces it.
Real: weekly market pay per on-trip hour (driver_pay + tips) and mean trip length from data/daily_market.csv,
NYC weather from Open-Meteo, US federal holidays. Simulated: each driver's weekly hours.
"""
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd
from pandas.tseries.holiday import USFederalHolidayCalendar

ROOT = Path(__file__).resolve().parents[2]
UTILIZATION = 0.55  # shortcut: assumed share of logged-in hours on a trip (Role A's README), unverified
FIRST, LAST = "2025-01-06", "2026-01-04"  # 52 full Monday weeks
SPLIT = (31, 10, 11)  # train / calib / test, oldest first
# driver: (mean weekly hours, week-to-week sd of hours, chance of a week off)
DRIVERS = {"A": (38, 3, 0.02), "B": (22, 5, 0.05), "C": (12, 5, 0.12)}
SEED = 7


def weather():
    url = ("https://archive-api.open-meteo.com/v1/archive?latitude=40.71&longitude=-74.01"
           f"&start_date={FIRST}&end_date={LAST}&daily=temperature_2m_mean,precipitation_sum,snowfall_sum"
           "&timezone=America%2FNew_York")
    with urllib.request.urlopen(url, timeout=30) as r:
        d = json.load(r)["daily"]
    return pd.DataFrame({"date": pd.to_datetime(d["time"]), "temp_c": d["temperature_2m_mean"],
                         "precip_mm": d["precipitation_sum"], "snow_cm": d["snowfall_sum"]})


def main():
    m = pd.read_csv(ROOT / "data/daily_market.csv", parse_dates=["date"])
    m = m[(m.date >= FIRST) & (m.date <= LAST)].merge(weather(), on="date", how="left")
    hol = set(USFederalHolidayCalendar().holidays(FIRST, LAST))
    m["holiday"] = m.date.isin(hol).astype(int)
    m["pay"] = m.driver_pay + m.tips
    m["week_start"] = m.date - pd.to_timedelta(m.date.dt.dayofweek, unit="D")
    w = m.groupby("week_start").agg(pay=("pay", "sum"), trip_hours=("trip_hours", "sum"),
                                    trip_min=("mean_trip_min", "mean"), temp_c=("temp_c", "mean"),
                                    precip_mm=("precip_mm", "sum"), snow_cm=("snow_cm", "sum"),
                                    holiday_days=("holiday", "sum"), days=("date", "count")).reset_index()
    assert len(w) == sum(SPLIT) and (w.days == 7).all(), f"expected {sum(SPLIT)} full weeks, got {len(w)}"
    pay_per_hour = (w.pay / w.trip_hours).to_numpy()
    split = np.repeat(["train", "calib", "test"], SPLIT)
    rng = np.random.default_rng(SEED)
    rows = []
    for d, (mean_h, sd_h, p_off) in DRIVERS.items():
        hours = np.clip(rng.normal(mean_h, sd_h, len(w)), 2, 70).round(1)
        hours[rng.random(len(w)) < p_off] = 0.0
        on_trip = hours * UTILIZATION
        rows.append(pd.DataFrame({
            "driver_id": d, "week_start": w.week_start.dt.strftime("%Y-%m-%d"),
            "gross_payout": (on_trip * pay_per_hour).round(2), "hours": hours,
            "trips": (on_trip * 60 / w.trip_min).round().astype(int),
            "temp_c": w.temp_c.round(1), "precip_mm": w.precip_mm.round(1), "snow_cm": w.snow_cm.round(1),
            "holiday_days": w.holiday_days, "split": split, "is_simulated": "true"}))
    out = pd.concat(rows, ignore_index=True)
    out.to_csv(ROOT / "data/weekly_earnings.csv", index=False)
    print(f"Wrote {len(out)} rows to data/weekly_earnings.csv")


if __name__ == "__main__":
    sys.exit(main())
