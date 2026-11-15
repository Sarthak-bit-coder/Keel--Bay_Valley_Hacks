"""Tests for Role A data (run from repo root: python -m pytest tests/test_data.py -q).

They use the committed CSVs (data/hourly_market.csv, data/weather_daily.csv), so they run
without the 6 GB of raw TLC files.
"""
import re
import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src" / "data"))
import build_weekly as bw  # noqa: E402

CONTRACT_COLUMNS = ["driver_id", "week_start", "gross_payout", "hours", "trips", "temp_c",
                    "precip_mm", "snow_cm", "holiday_days", "split", "is_simulated"]


def contract_columns_from_md():
    """Read the column names straight out of CONTRACT.md section 1, so a contract edit breaks this test."""
    text = (ROOT / "CONTRACT.md").read_text()
    section = text.split("## 1.")[1].split("## 2.")[0]
    return re.findall(r"^\| `([a-z_]+)` \|", section, flags=re.M)


@pytest.fixture(scope="module")
def df():
    return pd.read_csv(ROOT / "data" / "weekly_earnings.csv", keep_default_na=False, na_values=[""])


def test_contract_columns_match_md():
    assert contract_columns_from_md() == CONTRACT_COLUMNS
    assert bw.COLUMNS == CONTRACT_COLUMNS


def test_csv_columns_and_order(df):
    assert list(df.columns) == CONTRACT_COLUMNS


def test_sample_file_is_week_one_of_full_csv(df):
    sample = pd.read_csv(ROOT / "data" / "sample_weekly_earnings.csv", keep_default_na=False, na_values=[""])
    assert list(sample.columns) == CONTRACT_COLUMNS
    assert list(sample.driver_id) == ["A", "B", "C"]
    week1 = df[df.week_start == "2025-01-06"].reset_index(drop=True)
    pd.testing.assert_frame_equal(sample, week1)


def test_no_nulls(df):
    assert not df.isna().any().any()


def test_no_negative_values(df):
    for col in ["gross_payout", "hours", "trips", "precip_mm", "snow_cm", "holiday_days"]:
        assert (df[col] >= 0).all(), col


def test_types(df):
    assert pd.api.types.is_integer_dtype(df.trips)
    assert pd.api.types.is_integer_dtype(df.holiday_days)
    assert pd.api.types.is_float_dtype(df.gross_payout)
    assert set(df.is_simulated.astype(str).str.lower()) == {"true"}


def test_weeks_are_52_consecutive_mondays_per_driver(df):
    weeks = pd.to_datetime(df.week_start)
    assert (weeks.dt.day_of_week == 0).all()
    for _, g in df.groupby("driver_id"):
        w = pd.to_datetime(g.week_start).sort_values()
        assert len(w) == 52 and w.is_unique
        assert (w.diff().dropna() == pd.Timedelta(days=7)).all()
        assert w.iloc[0] == pd.Timestamp("2025-01-06")


def test_split_is_time_ordered(df):
    for _, g in df.groupby("driver_id"):
        g = g.assign(w=pd.to_datetime(g.week_start))
        tr, ca, te = (g[g.split == s].w for s in ("train", "calib", "test"))
        assert (len(tr), len(ca), len(te)) == (31, 10, 11)
        assert tr.max() < ca.min() and ca.max() < te.min()
    assert set(df.split) == {"train", "calib", "test"}
    # every driver has the same weeks in each split
    per_split = df.groupby("split").week_start.apply(lambda s: s.value_counts().nunique())
    assert (per_split == 1).all()


def test_weather_and_holidays_same_for_all_drivers(df):
    cols = ["temp_c", "precip_mm", "snow_cm", "holiday_days"]
    assert (df.groupby("week_start")[cols].nunique() == 1).all().all()


def test_federal_holidays_are_right_weekdays():
    h = {d.strftime("%Y-%m-%d"): d.day_of_week for d in bw.FEDERAL_HOLIDAYS}
    assert len(h) == 11
    # Monday holidays
    for d in ["2025-01-20", "2025-02-17", "2025-05-26", "2025-09-01", "2025-10-13"]:
        assert h[d] == 0, d
    assert h["2025-11-27"] == 3  # Thanksgiving is a Thursday


def test_holiday_days_total(df):
    weekly = df.drop_duplicates("week_start")
    # all 11 holidays fall inside 2025-01-06 .. 2026-01-04
    assert weekly.holiday_days.sum() == 11


def test_build_is_deterministic():
    hourly, weather = bw.load_inputs()
    a = bw.build(hourly, weather)
    b = bw.build(hourly, weather)
    pd.testing.assert_frame_equal(a, b)


def test_committed_csv_matches_build(df):
    hourly, weather = bw.load_inputs()
    built = bw.build(hourly, weather)
    # compare after a CSV round trip, the same way main() writes the file
    from io import StringIO
    buf = StringIO()
    built.to_csv(buf, index=False)
    buf.seek(0)
    pd.testing.assert_frame_equal(pd.read_csv(buf, keep_default_na=False, na_values=[""]), df)


def test_mean_hours_near_targets(df):
    m = df.groupby("driver_id").hours.mean()
    assert abs(m["A"] - 38) < 3 and abs(m["B"] - 22) < 3 and abs(m["C"] - 12) < 3
