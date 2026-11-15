"""Make readable CSV views of the TLC parquet files (parquet is binary, so editors can't show it).

Writes:
  data/raw/preview_2025-01_first1000.csv  first 1,000 raw trips (git-ignored, like all raw data)
  data/daily_market.csv                   one row per day, real market aggregates (small, committed)

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
