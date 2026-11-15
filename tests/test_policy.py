"""Policy tests. Run from the repo root: python -m pytest tests/test_policy.py

The main test ports the toy simulation from docs/prototype.html to Python, runs it through the real
pay_keel + replay code, and checks it reproduces outputs/sample/results.json (made by app/export_sample.mjs).
"""
import json
import math
from pathlib import Path

import numpy as np
import pytest

from src.policy.baselines import pay_avg4, pay_last
from src.policy.replay import replay, to_run
from src.policy.salary import pay_keel

ROOT = Path(__file__).resolve().parents[1]
M32 = 0xFFFFFFFF


# ---------- exact port of the toy's random numbers (mulberry32 + Box-Muller) ----------
def mulberry32(seed):
    a = seed & M32

    def imul(x, y):
        return (x * y) & M32

    def rand():
        nonlocal a
        a = (a + 0x6D2B79F5) & M32
        t = imul(a ^ (a >> 15), 1 | a)
        t = ((t + imul(t ^ (t >> 7), 61 | t)) & M32) ^ t
        return ((t ^ (t >> 14)) & M32) / 4294967296

    return rand


def randn(rand):
    u = 0.0
    while u == 0:
        u = rand()
    v = 0.0
    while v == 0:
        v = rand()
    return math.sqrt(-2 * math.log(u)) * math.cos(2 * math.pi * v)


HIST, WEEKS, TAX, HORIZON, NPATH, STORM_AT = 8, 20, 0.15, 4, 400, 11
DRIVERS = {"A": (900, 0.20, 11), "B": (540, 0.30, 23), "C": (380, 0.40, 37)}
LABELS = {"A": "Driver A: full-time, steady", "B": "Driver B: evenings, choppy", "C": "Driver C: weekends, very choppy"}


def js_mean(a):
    s = 0.0
    for x in a:
        s += x
    return s / len(a)


def js_sd(a):
    m, s = js_mean(a), 0.0
    for x in a:
        s += (x - m) * (x - m)
    return math.sqrt(s / (len(a) - 1))


def toy_gross(driver, scenario):
    mean, sigma, seed = DRIVERS[driver]
    rand, out = mulberry32(seed), []
    for i in range(HIST + WEEKS):
        g = mean * math.exp(sigma * randn(rand) - sigma * sigma / 2)
        if scenario == "storm" and i == HIST + STORM_AT:
            g *= 0.45
        if scenario == "storm" and i == HIST + STORM_AT + 1:
            g *= 0.60
        out.append(g)
    return out


def toy_zmat():
    rand = mulberry32(999)
    return np.array([[randn(rand) for _ in range(HORIZON)] for _ in range(NPATH)])


def toy_run(driver, scenario, alpha, z):
    gross = toy_gross(driver, scenario)
    net = [g * (1 - TAX) for g in gross]

    def forecast(i):
        hist = net[i - HIST:i]
        mu, s = js_mean(hist), js_sd(hist)
        return {"lo": max(0.0, mu - 1.28 * s), "mid": mu, "hi": mu + 1.28 * s,
                "draws": np.maximum(0.0, mu + s * z), "top": math.ceil(mu * 1.3 / 5) * 5}

    rep = replay(net, HIST, WEEKS, alpha, forecast, 0.5 * js_mean(net[:HIST]))
    return to_run(rep, driver=driver, label=LABELS[driver], scenario=scenario, alpha=alpha,
                  gross=gross[HIST:], net=net[HIST:], week_starts=[None] * WEEKS, horizon=HORIZON)


def test_python_port_reproduces_toy_sample():
    sample = json.loads((ROOT / "outputs/sample/results.json").read_text())
    z = toy_zmat()
    for want in sample["runs"]:
        got = toy_run(want["driver"], want["scenario"], want["risk_limit"], z)
        tag = (want["driver"], want["scenario"], want["risk_limit"])
        assert got["metrics"] == want["metrics"], tag
        assert got["checks"] == want["checks"], tag
        for g, w in zip(got["weeks"], want["weeks"]):
            for k in ("pay_keel", "risk", "reason"):
                assert g[k] == w[k], (tag, g["week"], k)
            for k in ("gross", "net", "lo", "hi", "pay_avg4", "pay_last", "buf_keel", "buf_avg4", "buf_last"):
                assert g[k] == pytest.approx(w[k], abs=0.011), (tag, g["week"], k)


# ---------- small direct tests ----------
def test_pay_keel_pays_more_with_a_looser_limit_and_bigger_buffer():
    z = np.random.default_rng(0).standard_normal((400, 4))
    draws = np.maximum(0, 500 + 150 * z)
    tight, _ = pay_keel(200, draws, 0.01, 650)
    loose, risk = pay_keel(200, draws, 0.20, 650)
    rich, _ = pay_keel(2000, draws, 0.01, 650)
    assert tight <= loose <= 650 and tight <= rich
    assert risk <= 0.20
    assert loose % 5 == 0


def test_pay_keel_pays_zero_when_even_zero_is_too_risky():
    draws = np.zeros((10, 4))
    assert pay_keel(-50, draws, 0.05, 500) == (0.0, 1.0)


def test_pay_keel_rejects_bad_inputs():
    with pytest.raises(ValueError):
        pay_keel(0, np.ones((2, 2)), 1.5, 100)
    with pytest.raises(ValueError):
        pay_keel(0, np.ones(4), 0.05, 100)


def test_baselines_use_only_past_weeks():
    hist = [100.0, 200.0, 300.0, 400.0, 500.0]
    assert pay_last(hist) == 500.0
    assert pay_avg4(hist) == 350.0
