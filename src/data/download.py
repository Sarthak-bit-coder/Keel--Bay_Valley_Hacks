"""Download NYC TLC High Volume For-Hire Vehicle (HVFHV) monthly trip records.

Source: NYC TLC trip record data page,
https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page
The monthly parquet files are served from the CloudFront URL below
(checked 2026-11-15: 2025-01 to 2026-09 return HTTP 200, about 0.5 GB each).

Files go to data/raw/ (git-ignored). Existing files are skipped.

Usage (from repo root):
    python src/data/download.py                 # 2025-01 .. 2026-01
    python src/data/download.py 2025-01         # one month (Gate 1)

Why 13 files: 52 full Monday-start weeks run from Mon 2025-01-06 to Sun 2026-01-04.
Only the first 4 days of 2026-01 are used.
"""
import sys
from pathlib import Path

import requests

BASE_URL = "https://d37ci6vzurychx.cloudfront.net/trip-data/fhvhv_tripdata_{month}.parquet"
RAW_DIR = Path("data/raw")
DEFAULT_MONTHS = [f"2025-{m:02d}" for m in range(1, 13)] + ["2026-01"]


def download_month(month: str) -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    out = RAW_DIR / f"fhvhv_tripdata_{month}.parquet"
    if out.exists() and out.stat().st_size > 0:
        print(f"skip {out} (already there)")
        return out
    url = BASE_URL.format(month=month)
    tmp = out.with_suffix(".part")
    print(f"get  {url}")
    with requests.get(url, stream=True, timeout=60) as r:
        if r.status_code != 200:
            raise SystemExit(f"TLC download failed for {month}: HTTP {r.status_code}. Not making up data; stopping.")
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)
    tmp.rename(out)
    print(f"done {out} ({out.stat().st_size / 1e6:.0f} MB)")
    return out


def main(months):
    for m in months:
        download_month(m)


if __name__ == "__main__":
    main(sys.argv[1:] or DEFAULT_MONTHS)
