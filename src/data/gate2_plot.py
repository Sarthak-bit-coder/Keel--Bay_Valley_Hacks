"""Gate 2: do the SIMULATED drivers' weekly earnings swing realistically?

Prints swing statistics per driver and saves data/gate2_weekly_earnings.png.
Pass rule (from prompts/01_roleA: "a bad week roughly half a good one"), written down before the
second run on 2026-11-15:
  - every driver: worst week <= 60% of best week;
  - B and C: p10 / p90 of weekly gross payout between 0.35 and 0.65;
  - A is the steady profile, so its p10 / p90 may go up to 0.80.
First run: A had p10/p90 0.80 and looked too flat, so A got more skipped days and day-to-day spread.

Needs matplotlib for the picture (not a pipeline dependency): pip install matplotlib
Usage (from repo root): python src/data/gate2_plot.py
"""
import pandas as pd

CSV = "data/weekly_earnings.csv"
PNG = "data/gate2_weekly_earnings.png"


def swing_stats(df: pd.DataFrame) -> pd.DataFrame:
    g = df.groupby("driver_id").gross_payout
    s = pd.DataFrame({
        "mean": g.mean(), "min": g.min(), "max": g.max(),
        "p10": g.quantile(0.10), "p90": g.quantile(0.90),
        "cv": g.std() / g.mean(),
    })
    s["p10_over_p90"] = s.p10 / s.p90
    s["worst_over_best"] = s["min"] / s["max"]
    return s.round(2)


def gate2_pass(s: pd.DataFrame) -> bool:
    upper = {d: (0.80 if d == "A" else 0.65) for d in s.index}
    return bool((s.worst_over_best <= 0.60).all()
                and all(0.35 <= s.loc[d, "p10_over_p90"] <= upper[d] for d in s.index))


def main():
    df = pd.read_csv(CSV, parse_dates=["week_start"])
    s = swing_stats(df)
    print(s.to_string())
    ok = gate2_pass(s)
    print("Gate 2:", "PASS" if ok else "FAIL")

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib not installed; skipped the picture")
        return
    fig, ax = plt.subplots(figsize=(11, 4.8))
    for d, g in df.groupby("driver_id"):
        ax.plot(g.week_start, g.gross_payout, marker="o", ms=3, lw=1.5, label=f"Driver {d} (simulated)")
    weeks = df.drop_duplicates("week_start")
    for _, r in weeks[weeks.snow_cm >= 5].iterrows():
        ax.axvspan(r.week_start, r.week_start + pd.Timedelta(days=7), color="tab:blue", alpha=0.12, lw=0)
    first = {sp: weeks[weeks.split == sp].week_start.min() for sp in ("calib", "test")}
    for sp, x in first.items():
        ax.axvline(x, color="grey", ls="--", lw=1)
        ax.text(x, ax.get_ylim()[1] * 0.97, f" {sp} starts", color="grey", va="top", fontsize=9)
    ax.set_title("Weekly gross payout, simulated drivers on real NYC ride-hail data (shaded: 5+ cm snow)")
    ax.set_ylabel("USD per week")
    ax.grid(alpha=0.3)
    ax.legend(loc="upper left", fontsize=9)
    fig.tight_layout()
    fig.savefig(PNG, dpi=110)
    print("wrote", PNG)


if __name__ == "__main__":
    main()
