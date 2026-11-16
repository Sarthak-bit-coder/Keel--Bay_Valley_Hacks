// Policy benchmark: Keel vs the two simple pay rules on the held-out replay weeks in results.json.
// Stored metrics are copied; the rest are plain arithmetic on stored weekly paychecks and buffers. Missing -> null.
"use strict";
(function (root) {
  var POLICIES = ["keel", "avg4", "last"];
  // better: which direction wins for a gig worker.
  var METRICS = [
    { id: "avgPay", better: "higher" },
    { id: "paySwing", better: "lower" },
    { id: "avgChange", better: "lower" },
    { id: "emptyWeeks", better: "lower" },
    { id: "lowestBuffer", better: "higher" },
    { id: "shortfall", better: "lower" }
  ];
  var num = function (v) { return typeof v === "number" && isFinite(v) ? v : null; };
  function col(weeks, key) {
    var xs = (weeks || []).map(function (w) { return num(w[key]); });
    return xs.length && xs.every(function (x) { return x !== null; }) ? xs : null;
  }

  function policyMetrics(run, p) {
    var m = run.metrics || {}, pick = function (k) { return m[k] ? num(m[k][p]) : null; };
    var pay = col(run.weeks, "pay_" + p), buf = col(run.weeks, "buf_" + p);
    return {
      avgPay: pick("avg_pay"),
      paySwing: pick("pay_swing"),
      // average size of the week-to-week change in the paycheck
      avgChange: pay && pay.length > 1 ? pay.slice(1).reduce(function (a, v, i) { return a + Math.abs(v - pay[i]); }, 0) / (pay.length - 1) : null,
      emptyWeeks: pick("overdraft_weeks"),
      lowestBuffer: buf ? Math.min.apply(null, buf) : null,
      // dollars below zero, summed over weeks (how deep the overdrafts went)
      shortfall: buf ? buf.reduce(function (a, v) { return a + Math.max(0, -v); }, 0) : null
    };
  }

  // Keel vs each baseline: "better" | "worse" | "tie" | null (missing).
  function compare(k, b, better) {
    if (k === null || b === null) return null;
    if (Math.abs(k - b) < 1e-9) return "tie";
    return (better === "higher" ? k > b : k < b) ? "better" : "worse";
  }

  function benchmark(run) {
    var by = {};
    POLICIES.forEach(function (p) { by[p] = policyMetrics(run, p); });
    return METRICS.map(function (m) {
      return {
        id: m.id, better: m.better, keel: by.keel[m.id], avg4: by.avg4[m.id], last: by.last[m.id],
        vsAvg4: compare(by.keel[m.id], by.avg4[m.id], m.better), vsLast: compare(by.keel[m.id], by.last[m.id], m.better)
      };
    });
  }

  // Across every run: per metric, how many runs Keel beat both rules, lost to at least one, or could not be compared.
  function tally(data) {
    var out = {};
    METRICS.forEach(function (m) { out[m.id] = { beatsBoth: 0, losesToOne: 0, missing: 0, runs: data.runs.length }; });
    data.runs.forEach(function (r) {
      benchmark(r).forEach(function (row) {
        var t = out[row.id];
        if (row.vsAvg4 === null || row.vsLast === null) t.missing++;
        else if (row.vsAvg4 === "better" && row.vsLast === "better") t.beatsBoth++;
        else if (row.vsAvg4 === "worse" || row.vsLast === "worse") t.losesToOne++;
      });
    });
    return out;
  }

  var api = { POLICIES: POLICIES, METRICS: METRICS, policyMetrics: policyMetrics, benchmark: benchmark, tally: tally };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KeelBenchmark = api;
})(this);
