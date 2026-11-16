// Buffer recovery, read from replayed runs only (no forecast, no projection past the replay).
// Target = the buffer the replay started with (opening balance = week 1 end buffer - take-home + paycheck).
// Weeks to recover = weeks from the lowest point until the buffer is back at or above the target.
"use strict";
(function (root) {
  function bufferRecovery(run) {
    var w = run && Array.isArray(run.weeks) ? run.weeks : [];
    var ok = w.length && w.every(function (x) { return [x.buf_keel, x.net, x.pay_keel].every(function (v) { return typeof v === "number"; }); });
    if (!ok) return null;
    var target = w[0].buf_keel - w[0].net + w[0].pay_keel, low = 0;
    w.forEach(function (x, i) { if (x.buf_keel < w[low].buf_keel) low = i; });
    var base = { target: target, current: w[w.length - 1].buf_keel, lowest: w[low].buf_keel, lowWeek: w[low].week, weeks: w.length, empty: w[low].buf_keel <= 0 };
    if (w[low].buf_keel >= target) return Object.assign(base, { status: "never_below", recoveredWeek: null, weeksToRecover: 0 });
    for (var j = low + 1; j < w.length; j++) {
      if (w[j].buf_keel >= target) return Object.assign(base, { status: "recovered", recoveredWeek: w[j].week, weeksToRecover: j - low });
    }
    return Object.assign(base, { status: "not_recovered", recoveredWeek: null, weeksToRecover: null });
  }

  // One row per scenario and risk limit for a driver, so paycheck level and recovery can be compared side by side.
  function recoveryCompare(data, driver) {
    return data.runs
      .filter(function (r) { return r.driver === driver; })
      .map(function (r) { return { scenario: r.scenario, risk: r.risk_limit, avgPay: r.metrics.avg_pay.keel, rec: bufferRecovery(r) }; })
      .sort(function (a, b) { return a.scenario === b.scenario ? a.risk - b.risk : a.scenario < b.scenario ? -1 : 1; });
  }

  var api = { bufferRecovery: bufferRecovery, recoveryCompare: recoveryCompare };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KeelRecovery = api;
})(this);
