"""The two simple pay rules Keel is compared with (docs/preregistration.md). Both see only weeks before this one."""
import numpy as np


def pay_last(net_history):
    """This week's paycheck = last week's take-home pay."""
    return float(net_history[-1])


def pay_avg4(net_history):
    """This week's paycheck = mean take-home pay of the last four weeks."""
    return float(np.mean(net_history[-4:]))
