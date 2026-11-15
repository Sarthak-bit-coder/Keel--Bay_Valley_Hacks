"""Make readable CSV views of the TLC parquet files (parquet is binary, so editors can't show it).

Writes:
  data/raw/preview_2025-01_first1000.csv  first 1,000 raw trips (git-ignored, like all raw data)
  data/daily_market.csv                   one row per day, real market aggregates (small, committed)
  data/trip_sample.csv                    100 random real trips per month of 2025 (small, committed)

Usage (from repo root): python src/data/preview.py
"""
from pathlib import Path

import pandas as pd

RAW = Path("data/raw")
COLS = ["pickup_datetime", "trip_time", "trip_miles", "driver_pay", "tips", "base_passenger_fare"]


def main():
    files = sorted(RAW.glob("fhvhv_tripdata_*.parquet"))
    if not files:
        raise SystemExit("No parquet files in data/raw/. Run python src/data/download.py first.")

    pd.read_parquet(files[0]).head(1000).to_csv(RAW / "preview_2025-01_first1000.csv", index=False)
    print("wrote", RAW / "preview_2025-01_first1000.csv")

    sample_cols = ["hvfhs_license_num", "pickup_datetime", "dropoff_datetime", "PULocationID", "DOLocationID",
                   "trip_miles", "trip_time", "base_passenger_fare", "tips", "driver_pay"]
    parts = []
    for i, f in enumerate(f for f in files if "_2025-" in f.name):
        parts.append(pd.read_parquet(f, columns=sample_cols).sample(n=100, random_state=42 + i))
    s = pd.concat(parts).sort_values("pickup_datetime")
    s["trip_minutes"] = (s.trip_time / 60).round(1)
    s.drop(columns="trip_time").to_csv("data/trip_sample.csv", index=False)
    print("wrote data/trip_sample.csv", len(s), "trips")

    days = []
    for f in files:
        df = pd.read_parquet(f, columns=COLS)
        df["date"] = df.pickup_datetime.dt.date
        g = df.groupby("date").agg(
            trips=("trip_time", "size"),
            trip_hours=("trip_time", lambda s: s.sum() / 3600),
            driver_pay=("driver_pay", "sum"),
            tips=("tips", "sum"),
            mean_trip_min=("trip_time", lambda s: s.mean() / 60),
        )
        days.append(g)
        print("read", f.name, len(df), "trips")
    d = pd.concat(days).groupby(level=0).sum(numeric_only=True)  # a day can straddle two files
    d["pay_per_trip_hour"] = (d.driver_pay + d.tips) / d.trip_hours
    d = d.round(2)
    d.to_csv("data/daily_market.csv")
    print("wrote data/daily_market.csv", len(d), "days")


if __name__ == "__main__":
    main()
