// Keel's paycheck engine in the browser, for the "My pay" page (app/my-pay.html).
// Ports src/policy/salary.py (pay_keel), src/policy/baselines.py and src/policy/replay.py line by line,
// and eval/run_eval.py's draws_from_band. Tested against Python output: node --test app/engine.test.js
//
// One difference from the main results: the forecast. The main results use LightGBM with conformal
// calibration, trained offline in Python. Here the low / middle / high case are simply the 10% / 50% / 90%
// points of the person's own last 12 weeks, so they are uncalibrated and less reliable.
"use strict";
(function (root) {
  var HORIZON = 4, NPATH = 400, STEP = 5, WINDOW = 12, MIN_WEEKS = 4;
  var Z90 = 1.2816;           // standard-normal 90% quantile, as in eval/run_eval.py
  var START_BUFFER_WEEKS = 0.5;

  // Seeded random numbers so the same history always gives the same paycheck.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function normals(seed, n) {
    var r = rng(seed), out = [];
    while (out.length < n) {
      var u = 1 - r(), v = r();
      var m = Math.sqrt(-2 * Math.log(u));
      out.push(m * Math.cos(2 * Math.PI * v));
      if (out.length < n) out.push(m * Math.sin(2 * Math.PI * v));
    }
    return out;
  }
  function zMatrix(seed, nPaths, horizon) {
    var flat = normals(seed, nPaths * horizon), z = [];
    for (var p = 0; p < nPaths; p++) z.push(flat.slice(p * horizon, (p + 1) * horizon));
    return z;
  }

  // numpy.quantile with the default "linear" method.
  function quantile(values, q) {
    var s = values.slice().sort(function (a, b) { return a - b; });
    var pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  }
  function mean(a) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i]; return t / a.length; }

  // Low / middle / high case for next week's take-home pay, from the weeks before it.
  function forecast(netHistory) {
    if (netHistory.length < MIN_WEEKS) return null;
    var w = netHistory.slice(-WINDOW);
    return { lo: quantile(w, 0.1), mid: quantile(w, 0.5), hi: quantile(w, 0.9) };
  }

  // eval/run_eval.py draws_from_band: two-piece normal with the 10% and 90% points at lo and hi.
  function drawsFromBand(lo, mid, hi, z) {
    var down = (mid - lo) / Z90, up = (hi - mid) / Z90;
    return z.map(function (row) {
      return row.map(function (x) { return Math.max(0, mid + (x < 0 ? down : up) * x); });
    });
  }

  // src/policy/salary.py pay_keel. Returns [pay, risk].
  function payKeel(buffer, draws, alpha, top, step) {
    step = step || STEP;
    if (!(alpha >= 0 && alpha <= 1)) throw new Error("alpha must be in [0, 1], got " + alpha);
    if (!draws.length || !draws[0].length) throw new Error("draws must be a non-empty (n_paths, horizon) array");
    top = Math.max(0, Math.ceil(top / step) * step);
    var risk = 1;
    for (var pay = top; pay >= 0; pay -= step) {
      var fails = 0;
      for (var p = 0; p < draws.length; p++) {
        var b = buffer;
        for (var h = 0; h < draws[p].length; h++) {
          b = b + (draws[p][h] - pay);
          if (b < 0) { fails++; break; }
        }
      }
      risk = fails / draws.length;
      if (risk <= alpha) return [pay, risk];
    }
    return [0, risk];
  }

  function payLast(net) { return net[net.length - 1]; }
  function payAvg4(net) { return mean(net.slice(-4)); }

  function jsRound(x) { return Math.floor(x + 0.5); }
  function dollars(x) { return "$" + jsRound(x).toLocaleString("en-US"); }
  function pctText(x) { return jsRound(x * 100) + "%"; }

  // src/policy/replay.py reason, word for word.
  function reason(pay, risk, alpha, horizon) {
    if (risk <= alpha) {
      return "Chose " + dollars(pay) + " so the chance of running dry in the next " + horizon +
        " weeks is about " + pctText(risk) + " (limit " + pctText(alpha) + ").";
    }
    return "Paid " + dollars(pay) + ": even with no paycheck the chance of running dry in the next " + horizon +
      " weeks is about " + pctText(risk) + ", above the " + pctText(alpha) + " limit.";
  }

  // Dates: weeks start on Monday. Works on "YYYY-MM-DD" strings in UTC so time zones never shift a day.
  function mondayOf(dateStr) {
    var d = new Date(dateStr + "T00:00:00Z");
    if (isNaN(d)) throw new Error("not a date: " + dateStr);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }
  function addWeeks(mondayStr, n) {
    var d = new Date(mondayStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 7 * n);
    return d.toISOString().slice(0, 10);
  }

  // Replay Keel and the two simple rules over the person's own weeks, then pick next week's paycheck.
  // entries: [{week_start: "YYYY-MM-DD", gross: number}], any order. Returns null below MIN_WEEKS weeks.
  function plan(entries, opts) {
    opts = opts || {};
    var tax = opts.taxRate == null ? 0.15 : opts.taxRate;
    var alpha = opts.riskLimit == null ? 0.05 : opts.riskLimit;
    var z = opts.z || zMatrix(opts.seed == null ? 999 : opts.seed, NPATH, HORIZON);  // opts.z: tests pass Python's draws
    var rows = entries.slice().sort(function (a, b) { return a.week_start < b.week_start ? -1 : 1; });
    if (rows.length < MIN_WEEKS) return null;
    var gross = rows.map(function (r) { return Number(r.gross); });
    var net = gross.map(function (g) { return g * (1 - tax); });

    var warnings = [];
    for (var k = 1; k < rows.length; k++) {
      if (addWeeks(rows[k - 1].week_start, 1) !== rows[k].week_start) {
        warnings.push("Weeks between " + rows[k - 1].week_start + " and " + rows[k].week_start + " are missing. Add them (as $0 if you earned nothing) for a better forecast.");
      }
    }

    // opts.startBuffer: savings the person already has (from sign-up). Default: half a week of take-home pay.
    var b0 = opts.startBuffer != null && isFinite(opts.startBuffer) && opts.startBuffer >= 0 ? Number(opts.startBuffer) : START_BUFFER_WEEKS * mean(net.slice(0, MIN_WEEKS));
    var cur = { keel: b0, avg4: b0, last: b0 };
    var weeks = [];
    function decide(i, buffer) {
      var f = forecast(net.slice(0, i));
      var draws = drawsFromBand(f.lo, f.mid, f.hi, z);
      var top = Math.ceil(f.mid * 1.3 / 5) * 5;
      var pr = payKeel(buffer, draws, alpha, top);
      return { f: f, pay: pr[0], risk: pr[1] };
    }
    for (var i = MIN_WEEKS; i < rows.length; i++) {
      var d = decide(i, cur.keel);
      var now = { keel: d.pay, avg4: payAvg4(net.slice(0, i)), last: payLast(net.slice(0, i)) };
      ["keel", "avg4", "last"].forEach(function (r) { cur[r] = cur[r] + net[i] - now[r]; });
      weeks.push({
        week_start: rows[i].week_start, gross: gross[i], net: net[i], lo: d.f.lo, hi: d.f.hi,
        pay_keel: now.keel, pay_avg4: now.avg4, pay_last: now.last,
        buf_keel: cur.keel, buf_avg4: cur.avg4, buf_last: cur.last,
        risk: d.risk, reason: reason(d.pay, d.risk, alpha, HORIZON)
      });
    }
    var n = decide(rows.length, cur.keel);
    var next = {
      week_start: addWeeks(rows[rows.length - 1].week_start, 1), pay: n.pay, risk: n.risk,
      lo: n.f.lo, mid: n.f.mid, hi: n.f.hi, buffer_before: cur.keel,
      reason: reason(n.pay, n.risk, alpha, HORIZON)
    };
    return { b0: b0, weeks: weeks, next: next, warnings: warnings, metrics: metrics(weeks), checks: checks(weeks, b0, tax) };
  }

  function metrics(weeks) {
    var out = { overdraft_weeks: {}, avg_pay: {}, pay_swing: {} };
    ["keel", "avg4", "last"].forEach(function (r) {
      var pays = weeks.map(function (w) { return w["pay_" + r]; });
      out.overdraft_weeks[r] = weeks.filter(function (w) { return w["buf_" + r] < 0; }).length;
      out.avg_pay[r] = pays.length ? jsRound(mean(pays)) : 0;
      out.pay_swing[r] = pays.length ? jsRound(Math.max.apply(null, pays) - Math.min.apply(null, pays)) : 0;
    });
    var nets = weeks.map(function (w) { return w.net; });
    out.earnings_swing = nets.length ? jsRound(Math.max.apply(null, nets) - Math.min.apply(null, nets)) : 0;
    out.tax_total = jsRound(weeks.reduce(function (t, w) { return t + w.gross - w.net; }, 0));
    return out;
  }

  // Same three checks as src/policy/replay.py. An empty buffer is a risk outcome, reported, not a code error.
  function checks(weeks, b0, tax) {
    var prev = b0, identity = true;
    weeks.forEach(function (w) {
      if (Math.abs(w.gross - (w.pay_keel + (w.gross - w.net) + (w.buf_keel - prev))) > 0.01) identity = false;
      prev = w.buf_keel;
    });
    return {
      identity: identity,
      buffer_nonnegative: weeks.every(function (w) { return w.buf_keel >= 0; }),
      pay_nonnegative: weeks.every(function (w) { return w.pay_keel >= 0; })
    };
  }

  // How uneven someone's pay is, in plain words.
  function shape(grossList) {
    if (!grossList.length) return null;
    var m = mean(grossList);
    var sd = Math.sqrt(mean(grossList.map(function (g) { return (g - m) * (g - m); })));
    var cv = m > 0 ? sd / m : 0;
    var label = cv < 0.15 ? "fairly steady" : cv < 0.35 ? "uneven" : "very uneven";
    return {
      mean: m, cv: cv, label: label,
      best: Math.max.apply(null, grossList), worst: Math.min.apply(null, grossList),
      zero_weeks: grossList.filter(function (g) { return g === 0; }).length
    };
  }

  var api = {
    HORIZON: HORIZON, NPATH: NPATH, STEP: STEP, WINDOW: WINDOW, MIN_WEEKS: MIN_WEEKS, Z90: Z90,
    rng: rng, zMatrix: zMatrix, quantile: quantile, forecast: forecast, drawsFromBand: drawsFromBand,
    payKeel: payKeel, payLast: payLast, payAvg4: payAvg4, reason: reason, mondayOf: mondayOf,
    addWeeks: addWeeks, plan: plan, shape: shape
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KeelEngine = api;
})(typeof window !== "undefined" ? window : this);
