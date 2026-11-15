"""Replay Keel and the two simple rules week by week on the same earnings, and build CONTRACT.md run records."""
import math

import numpy as np

from src.policy.baselines import pay_avg4, pay_last
from src.policy.salary import pay_keel

RULES = ("keel", "avg4", "last")


def js_round(x, digits=0):
    """Round half up, like JavaScript's Math.round, so Python output matches the toy exporter."""
    f = 10 ** digits
    return math.floor(x * f + 0.5) / f if digits else math.floor(x + 0.5)


def replay(net, start, n_weeks, alpha, forecast, b0):
    """Run the three pay rules over weeks start .. start + n_weeks - 1 of `net` (take-home pay, all weeks).

    forecast(i) must use only weeks before i and return {"lo", "mid", "hi", "draws", "top"}.
    Returns per-week paychecks, end-of-week buffers, forecast bands and Keel's risk.
    """
    cur = {k: float(b0) for k in RULES}
    pay = {k: [] for k in RULES}
    buf = {k: [] for k in RULES}
    lo, hi, risk = [], [], []
    for i in range(start, start + n_weeks):
        f = forecast(i)
        keel, r = pay_keel(cur["keel"], f["draws"], alpha, f["top"])
        now = {"keel": keel, "avg4": pay_avg4(net[:i]), "last": pay_last(net[:i])}
        for k in RULES:
            cur[k] = cur[k] + net[i] - now[k]
            pay[k].append(now[k])
            buf[k].append(cur[k])
        lo.append(f["lo"])
        hi.append(f["hi"])
        risk.append(r)
    return {"pay": pay, "buf": buf, "lo": lo, "hi": hi, "risk": risk, "b0": float(b0)}


def reason(pay, risk, alpha, horizon):
    pct = lambda x: f"{js_round(x * 100)}%"
    dollars = f"${js_round(pay):,}"
    if risk <= alpha:
        return f"Chose {dollars} so the chance of running dry in the next {horizon} weeks is about {pct(risk)} (limit {pct(alpha)})."
    return (f"Paid {dollars}: even with no paycheck the chance of running dry in the next {horizon} weeks "
            f"is about {pct(risk)}, above the {pct(alpha)} limit.")


def checks(rep, gross, net):
    """The three hard checks from CONTRACT.md, on Keel's buffer."""
    prev, identity = rep["b0"], True
    for g, n, p, b in zip(gross, net, rep["pay"]["keel"], rep["buf"]["keel"]):
        if abs(g - (p + (g - n) + (b - prev))) > 0.01:
            identity = False
        prev = b
    return {
        "identity": identity,
        "buffer_nonnegative": all(b >= 0 for b in rep["buf"]["keel"]),
        "pay_nonnegative": all(p >= 0 for p in rep["pay"]["keel"]),
    }


def metrics(rep, gross, net):
    pay, buf = rep["pay"], rep["buf"]
    hits = sum(1 for n, lo in zip(net, rep["lo"]) if n >= lo)
    return {
        "overdraft_weeks": {k: sum(1 for b in buf[k] if b < 0) for k in RULES},
        "avg_pay": {k: js_round(float(np.mean(pay[k]))) for k in RULES},
        "pay_swing": {k: js_round(max(pay[k]) - min(pay[k])) for k in RULES},
        "earnings_swing": js_round(max(net) - min(net)),
        "tax_total": js_round(sum(g - n for g, n in zip(gross, net))),
        "low_case_hit_rate": js_round(hits / len(net), 2),
    }


def to_run(rep, *, driver, label, scenario, alpha, gross, net, week_starts, horizon, storm_weeks=None):
    """CONTRACT.md run record. gross, net and week_starts cover only the replayed weeks."""
    r2 = lambda x: js_round(float(x), 2)
    weeks = []
    for t in range(len(net)):
        weeks.append({
            "week": t + 1, "week_start": week_starts[t],
            "gross": r2(gross[t]), "net": r2(net[t]), "lo": r2(rep["lo"][t]), "hi": r2(rep["hi"][t]),
            **{f"pay_{k}": r2(rep["pay"][k][t]) for k in RULES},
            **{f"buf_{k}": r2(rep["buf"][k][t]) for k in RULES},
            "risk": r2(rep["risk"][t]),
            "reason": reason(rep["pay"]["keel"][t], rep["risk"][t], alpha, horizon),
        })
    run = {"driver": driver, "driver_label": label, "scenario": scenario, "risk_limit": alpha, "weeks": weeks,
           "metrics": metrics(rep, gross, net), "checks": checks(rep, gross, net)}
    if storm_weeks:
        run["storm_weeks"] = storm_weeks  # optional field proposed for CONTRACT.md; ignored by apps that do not know it
    return run
