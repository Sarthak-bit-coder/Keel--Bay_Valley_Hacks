"""Build data/weekly_earnings.csv (CONTRACT.md section 1): SIMULATED drivers on REAL NYC market data.

Real inputs
  - NYC TLC High Volume For-Hire Vehicle trips, 2025-01-06 to 2026-01-04, aggregated to one row per
    (date, hour): trips, hours on trips, driver pay + tips. Cached in data/hourly_market.csv.
  - Open-Meteo historical weather for NYC, daily. Cached in data/weather_daily.csv.
  - US federal holidays (OPM list, hard-coded below).
Simulated
  - Drivers A, B, C: which hours they log in, days they skip, weeks off, and how busy they are
    while logged in. Every number in DRIVERS and UTIL_* is our assumption, not measured.

Usage (from repo root):
    python src/data/build_weekly.py            # uses the cached CSVs if present
    python src/data/build_weekly.py --rebuild  # re-aggregate from data/raw/*.parquet and re-fetch weather
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import requests

DATA = Path("data")
RAW = DATA / "raw"
HOURLY_CSV = DATA / "hourly_market.csv"
WEATHER_CSV = DATA / "weather_daily.csv"
OUT_CSV = DATA / "weekly_earnings.csv"

FIRST_MONDAY = pd.Timestamp("2025-01-06")
N_WEEKS = 52
LAST_DAY = FIRST_MONDAY + pd.Timedelta(days=7 * N_WEEKS - 1)  # Sun 2026-01-04
N_TRAIN, N_CALIB = 31, 10  # 60/20/20 of 52 weeks; the last 11 are test

COLUMNS = ["driver_id", "week_start", "gross_payout", "hours", "trips", "temp_c", "precip_mm",
           "snow_cm", "holiday_days", "split", "is_simulated"]

# US federal holidays in the window (OPM). Jan 9, 2025 (national day of mourning) was a one-off
# federal closure, not a federal holiday, so it is not counted.
FEDERAL_HOLIDAYS = pd.to_datetime([
    "2025-01-20",  # Martin Luther King Jr. Day (also Inauguration Day)
    "2025-02-17",  # Washington's Birthday
    "2025-05-26",  # Memorial Day
    "2025-06-19",  # Juneteenth
    "2025-07-04",  # Independence Day
    "2025-09-01",  # Labor Day
    "2025-10-13",  # Columbus Day
    "2025-11-11",  # Veterans Day
    "2025-11-27",  # Thanksgiving Day
    "2025-12-25",  # Christmas Day
    "2026-01-01",  # New Year's Day
])

# ---- Simulated drivers (assumptions) -------------------------------------------------------
# shifts: {weekday (0=Mon): (start_hour, end_hour)}; a driver logs in for those clock hours.
# skip_base: chance of skipping a scheduled day for no particular reason.
# snow_k / rain_k: extra skip chance at 10+ cm snow / 25+ mm rain that day.
# holiday_skip: extra skip chance on a federal holiday.
# day_sd: day-to-day spread in hours actually driven (lognormal sigma).
# week_off: chance of a whole week off (sick, travel, car in the shop).
DRIVERS = {
    "A": dict(label="full-time, steady", seed=101,
              shifts={**{d: (7, 15) for d in range(5)}, 5: (9, 11)},      # Mon-Fri 7am-3pm + Sat 9-11, 42 h
              skip_base=0.05, snow_k=0.35, rain_k=0.05, holiday_skip=0.6, day_sd=0.15, week_off=0.04),
    "B": dict(label="part-time", seed=202,
              shifts={0: (17, 21), 1: (17, 21), 2: (17, 21), 3: (17, 21), 5: (11, 19)},  # 24 h
              skip_base=0.06, snow_k=0.5, rain_k=0.1, holiday_skip=0.3, day_sd=0.15, week_off=0.05),
    "C": dict(label="weekend-only, volatile", seed=303,
              shifts={4: (18, 24), 5: (18, 24), 6: (12, 16)},              # Fri/Sat night + Sun, 16 h
              skip_base=0.15, snow_k=0.7, rain_k=0.2, holiday_skip=0.0, day_sd=0.30, week_off=0.10),
}
UTIL_BASE = 0.55             # share of logged-in time spent on a trip at normal demand (assumption)
UTIL_MIN, UTIL_MAX = 0.35, 0.75
WEEKLY_NOISE_SD = 0.05       # driver-level luck: trip mix, ratings (lognormal sigma)


# ---- Real inputs -----------------------------------------------------------------------------
def aggregate_hourly_from_raw() -> pd.DataFrame:
    """One row per (date, hour) from the TLC parquet files. Takes about a minute."""
    files = sorted(RAW.glob("fhvhv_tripdata_*.parquet"))
    if not files:
        raise SystemExit("No TLC parquet in data/raw/. Run: python src/data/download.py")
    parts = []
    for f in files:
        df = pd.read_parquet(f, columns=["pickup_datetime", "trip_time", "driver_pay", "tips"])
        df = df[(df.pickup_datetime >= FIRST_MONDAY) & (df.pickup_datetime < LAST_DAY + pd.Timedelta(days=1))]
        df["slot"] = df.pickup_datetime.dt.floor("h")
        g = df.groupby("slot").agg(trips=("trip_time", "size"), trip_seconds=("trip_time", "sum"),
                                   driver_pay=("driver_pay", "sum"), tips=("tips", "sum"))
        parts.append(g)
        print("  aggregated", f.name)
    h = pd.concat(parts).groupby(level=0).sum()
    out = pd.DataFrame({
        "date": h.index.strftime("%Y-%m-%d"),
        "hour": h.index.hour,
        "trips": h.trips.values,
        "trip_hours": (h.trip_seconds / 3600).round(3).values,
        "pay_incl_tips": (h.driver_pay + h.tips).round(2).values,
    })
    return out


def fetch_weather() -> pd.DataFrame:
    url = ("https://archive-api.open-meteo.com/v1/archive?latitude=40.7128&longitude=-74.0060"
           f"&start_date={FIRST_MONDAY:%Y-%m-%d}&end_date={LAST_DAY:%Y-%m-%d}"
           "&daily=temperature_2m_mean,precipitation_sum,snowfall_sum&timezone=America/New_York")
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    d = r.json()["daily"]
    return pd.DataFrame({"date": d["time"], "temp_c": d["temperature_2m_mean"],
                         "precip_mm": d["precipitation_sum"], "snow_cm": d["snowfall_sum"]})


def load_inputs(rebuild: bool = False):
    if rebuild or not HOURLY_CSV.exists():
        print("building", HOURLY_CSV)
        aggregate_hourly_from_raw().to_csv(HOURLY_CSV, index=False)
    if rebuild or not WEATHER_CSV.exists():
        print("fetching", WEATHER_CSV)
        fetch_weather().to_csv(WEATHER_CSV, index=False)
    hourly = pd.read_csv(HOURLY_CSV)
    weather = pd.read_csv(WEATHER_CSV)
    return hourly, weather


# ---- Market tables ---------------------------------------------------------------------------
def market_slots(hourly: pd.DataFrame) -> pd.DataFrame:
    """Index (date, hour) -> pay per hour on a trip, utilization while logged in, minutes per trip."""
    m = hourly.copy()
    m["date"] = pd.to_datetime(m["date"])
    m["pay_per_trip_hour"] = m.pay_incl_tips / m.trip_hours
    m["min_per_trip"] = m.trip_hours * 60 / m.trips
    # Busier than usual for this hour of the week -> less waiting between trips.
    m["how"] = m.date.dt.day_of_week * 24 + m.hour
    typical = m.groupby("how").trips.transform("mean")
    m["util"] = (UTIL_BASE * np.sqrt(m.trips / typical)).clip(UTIL_MIN, UTIL_MAX)
    return m.set_index(["date", "hour"])[["pay_per_trip_hour", "util", "min_per_trip"]]


def weekly_weather(weather: pd.DataFrame) -> pd.DataFrame:
    w = weather.copy()
    w["date"] = pd.to_datetime(w["date"])
    w["week_start"] = w.date - pd.to_timedelta(w.date.dt.day_of_week, unit="D")
    w["holiday"] = w.date.isin(FEDERAL_HOLIDAYS).astype(int)
    g = w.groupby("week_start").agg(temp_c=("temp_c", "mean"), precip_mm=("precip_mm", "sum"),
                                    snow_cm=("snow_cm", "sum"), holiday_days=("holiday", "sum"))
    return g.round({"temp_c": 1, "precip_mm": 1, "snow_cm": 1})


# ---- Simulation ------------------------------------------------------------------------------
def simulate_driver(driver_id: str, cfg: dict, slots: pd.DataFrame, weather: pd.DataFrame) -> pd.DataFrame:
    rng = np.random.default_rng(cfg["seed"])
    wx = weather.copy()
    wx["date"] = pd.to_datetime(wx["date"])
    wx = wx.set_index("date")
    rows = []
    for k in range(N_WEEKS):
        week_start = FIRST_MONDAY + pd.Timedelta(days=7 * k)
        off = rng.random() < cfg["week_off"]
        gross = hours = trips = 0.0
        for wd in range(7):
            day = week_start + pd.Timedelta(days=wd)
            # Draw every random number in a fixed order, so results do not depend on branches.
            u_skip, z = rng.random(), rng.standard_normal()
            if off or wd not in cfg["shifts"]:
                continue
            day_wx = wx.loc[day]
            p_skip = (cfg["skip_base"]
                      + cfg["snow_k"] * min(day_wx.snow_cm, 10) / 10
                      + cfg["rain_k"] * min(day_wx.precip_mm, 25) / 25
                      + (cfg["holiday_skip"] if day in FEDERAL_HOLIDAYS else 0.0))
            if u_skip < min(p_skip, 0.95):
                continue
            scale = float(np.clip(np.exp(cfg["day_sd"] * z), 0.25, 1.5))
            start, end = cfg["shifts"][wd]
            for hr in range(start, end):
                s = slots.loc[(day, hr)]
                logged = scale  # hours logged in during this clock hour
                on_trip = logged * s.util
                hours += logged
                gross += on_trip * s.pay_per_trip_hour
                trips += on_trip * 60 / s.min_per_trip
        gross *= float(np.exp(WEEKLY_NOISE_SD * rng.standard_normal()))
        rows.append(dict(driver_id=driver_id, week_start=week_start, gross_payout=round(gross, 2),
                         hours=round(hours, 1), trips=int(round(trips))))
    return pd.DataFrame(rows)


def split_for_week(k: int) -> str:
    return "train" if k < N_TRAIN else ("calib" if k < N_TRAIN + N_CALIB else "test")


def build(hourly: pd.DataFrame, weather: pd.DataFrame) -> pd.DataFrame:
    slots = market_slots(hourly)
    wk = weekly_weather(weather)
    out = []
    for driver_id, cfg in DRIVERS.items():
        d = simulate_driver(driver_id, cfg, slots, weather)
        d = d.join(wk, on="week_start")
        d["split"] = [split_for_week(k) for k in range(len(d))]
        d["is_simulated"] = "true"
        out.append(d)
    df = pd.concat(out, ignore_index=True)
    df["week_start"] = df.week_start.dt.strftime("%Y-%m-%d")
    df["holiday_days"] = df.holiday_days.astype(int)
    return df[COLUMNS]


def main(argv):
    hourly, weather = load_inputs(rebuild="--rebuild" in argv)
    df = build(hourly, weather)
    df.to_csv(OUT_CSV, index=False)
    print(f"wrote {OUT_CSV}: {len(df)} rows, {df.driver_id.nunique()} simulated drivers x {N_WEEKS} weeks")
    print(df.groupby("driver_id").agg(mean_gross=("gross_payout", "mean"), mean_hours=("hours", "mean"))
          .round(1).to_string())


if __name__ == "__main__":
    main(sys.argv[1:])
