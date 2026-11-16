"""Write app/engine.fixture.json: Python's answers that app/engine.js must reproduce.

Uses the real src/policy code (pay_keel, replay, reason) and eval/run_eval.py's draws_from_band, with the
same simple forecast engine.js uses (10/50/90% points of the last 12 weeks).
Run from the repo root: python tests/make_engine_fixture.py
"""
import json
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from eval.run_eval import draws_from_band  # noqa: E402
from src.policy.replay import reason, replay  # noqa: E402
from src.policy.salary import pay_keel  # noqa: E402

TAX, ALPHA, HORIZON = 0.15, 0.05, 4
z = np.random.default_rng(1).standard_normal((400, HORIZON))

cases = []
for buffer, lo, mid, hi, alpha, top in [(400, 600, 800, 950, 0.05, 1040), (0, 300, 700, 900, 0.01, 910),
                                        (1500, 0, 400, 1200, 0.20, 520), (50, 900, 900, 900, 0.05, 1170),
                                        (-200, 100, 300, 500, 0.05, 390)]:
    pay, risk = pay_keel(buffer, draws_from_band(lo, mid, hi, z), alpha, top)
    cases.append(dict(buffer=buffer, lo=lo, mid=mid, hi=hi, alpha=alpha, top=top, pay=pay, risk=risk))

weeks = [f"2025-{m:02d}-{d:02d}" for m, d in [(1, 6), (1, 13), (1, 20), (1, 27), (2, 3), (2, 10), (2, 17), (2, 24),
                                               (3, 3), (3, 10), (3, 17), (3, 24), (3, 31), (4, 7), (4, 14),
                                               (4, 21), (4, 28), (5, 5), (5, 12), (5, 19)]]
gross = [900, 1100, 400, 1250, 0, 980, 1500, 700, 820, 1310, 260, 990, 1120, 0, 1450, 870, 640, 1010, 930, 1200]
net = [g * (1 - TAX) for g in gross]


def forecast(i):
    w = np.array(net[max(0, i - 12):i])
    lo, mid, hi = (float(np.quantile(w, q)) for q in (0.1, 0.5, 0.9))
    return {"lo": lo, "mid": mid, "hi": hi, "draws": draws_from_band(lo, mid, hi, z),
            "top": math.ceil(mid * 1.3 / 5) * 5}


b0 = 0.5 * float(np.mean(net[:4]))
rep = replay(net, 4, len(net) - 4, ALPHA, forecast, b0)
fixture = {
    "z": z.tolist(), "pay_keel_cases": cases,
    "replay": {"entries": [{"week_start": w, "gross": g} for w, g in zip(weeks, gross)], "tax": TAX, "alpha": ALPHA,
               "b0": b0, "pay": rep["pay"], "buf": rep["buf"], "risk": rep["risk"], "lo": rep["lo"], "hi": rep["hi"],
               "reasons": [reason(p, r, ALPHA, HORIZON) for p, r in zip(rep["pay"]["keel"], rep["risk"])]},
}
out = ROOT / "app" / "engine.fixture.json"
out.write_text(json.dumps(fixture))
print("wrote", out, "keel pays:", rep["pay"]["keel"])
