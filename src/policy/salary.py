"""Keel's salary rule: the highest weekly pay whose simulated chance of emptying the buffer stays within the limit."""
import math

import numpy as np

STEP = 5  # dollars between the pay levels tried, as in the toy (docs/prototype.html)


def pay_keel(buffer, draws, alpha, top, step=STEP):
    """Search pay levels from `top` down to 0 and return (pay, risk) for the first one with risk <= alpha.

    buffer: buffer balance before this week's paycheck.
    draws:  (n_paths, horizon) simulated take-home pay for the coming weeks. The same draws are used for
            every pay level tried (common random numbers), so pay levels differ only by the pay itself.
    risk:   share of paths where the buffer goes below zero at any point in the horizon.
    If even a $0 paycheck breaks the limit, returns (0.0, that risk): Keel pays nothing rather than overdraw.
    """
    if not 0 <= alpha <= 1:
        raise ValueError(f"alpha must be in [0, 1], got {alpha}")
    draws = np.asarray(draws, dtype=float)
    if draws.ndim != 2 or draws.size == 0:
        raise ValueError("draws must be a non-empty (n_paths, horizon) array")
    top = max(0, math.ceil(top / step) * step)
    start = np.full((draws.shape[0], 1), float(buffer))
    risk = 1.0
    for pay in range(top, -1, -step):
        # Buffer as the first column so the running sum adds in the same order as the toy: b += x - pay.
        balance = np.cumsum(np.hstack([start, draws - pay]), axis=1)[:, 1:]
        risk = float(np.mean((balance < 0).any(axis=1)))
        if risk <= alpha:
            return float(pay), risk
    return 0.0, risk
