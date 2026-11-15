// Pure data helpers for the Keel app: load and check outputs/results.json (CONTRACT.md), pick runs, shape them for charts.
// No DOM here, so tests can run in Node: node --test app/data.test.js
"use strict";
(function (root) {
  // Paths are relative to app/index.html, so serve the repo root (see README "Run it").
  var SOURCES = ["../outputs/results.json", "../outputs/sample/results.json"];
  var TOY_STORM_WEEKS = [12, 13]; // where the toy simulation in docs/prototype.html puts the snowstorm
  var WEEK_FIELDS = ["week", "net", "lo", "hi", "pay_keel", "pay_avg4", "pay_last", "buf_keel", "buf_avg4", "buf_last"];

  // Returns a list of problems; empty means the file is usable.
  function validate(data) {
    if (!data || typeof data !== "object") return ["file is not a JSON object"];
    var errs = [];
    if (!data.meta || typeof data.meta !== "object") errs.push("missing meta");
    if (!Array.isArray(data.runs) || !data.runs.length) return errs.concat("runs is missing or empty");
    data.runs.forEach(function (r, i) {
      var tag = "run " + i + " (" + r.driver + ", " + r.scenario + ", " + r.risk_limit + ")";
      if (r.driver == null || r.scenario == null || typeof r.risk_limit !== "number") errs.push(tag + ": needs driver, scenario and risk_limit");
      if (!Array.isArray(r.weeks) || r.weeks.length < 2) { errs.push(tag + ": needs at least 2 weeks"); return; }
      var missing = WEEK_FIELDS.filter(function (k) { return typeof r.weeks[0][k] !== "number"; });
      if (missing.length) errs.push(tag + ": weeks missing " + missing.join(", "));
      if (!r.metrics || !r.metrics.overdraft_weeks || !r.metrics.avg_pay || !r.metrics.pay_swing) errs.push(tag + ": missing metrics");
      if (!r.checks) errs.push(tag + ": missing checks");
    });
    return errs;
  }

  // Tries each source in order. Resolves {data, url, skipped:[{url, reason}]} so the UI can say why a file was passed over.
  function loadData(fetchFn, sources) {
    var list = sources || SOURCES, skipped = [], i = 0;
    function next() {
      if (i >= list.length) {
        var err = new Error("no usable results file");
        err.skipped = skipped;
        return Promise.reject(err);
      }
      var url = list[i++];
      return fetchFn(url, { cache: "no-store" })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (data) {
          var errs = validate(data);
          if (errs.length) throw new Error("invalid: " + errs.slice(0, 3).join("; "));
          return { data: data, url: url, skipped: skipped };
        })
        .catch(function (e) { skipped.push({ url: url, reason: e.message }); return next(); });
    }
    return next();
  }

  function findRun(data, driver, scenario, risk) {
    return data.runs.find(function (r) { return r.driver === driver && r.scenario === scenario && Math.abs(r.risk_limit - risk) < 1e-9; });
  }

  // Drivers (with labels), scenarios and risk limits that exist in the file, in a stable order.
  function options(data) {
    var drivers = [], seen = {}, scen = {}, risks = {};
    data.runs.forEach(function (r) {
      if (!seen[r.driver]) { seen[r.driver] = true; drivers.push({ id: r.driver, label: r.driver_label || "Driver " + r.driver }); }
      scen[r.scenario] = true;
      risks[r.risk_limit] = true;
    });
    return {
      drivers: drivers.sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); }),
      scenarios: Object.keys(scen),
      risks: Object.keys(risks).map(Number).sort(function (a, b) { return a - b; })
    };
  }

  // 1-based week numbers to shade as the snowstorm. Uses run.storm_weeks if present (proposed optional
  // CONTRACT field); toy data falls back to the toy's weeks; real data without the field gets no shading, not a guess.
  function stormWeeks(run, meta) {
    if (run.scenario !== "storm") return [];
    if (Array.isArray(run.storm_weeks)) return run.storm_weeks.filter(function (w) { return w >= 1 && w <= run.weeks.length; });
    if (meta && meta.model === "toy") return TOY_STORM_WEEKS.filter(function (w) { return w <= run.weeks.length; });
    return [];
  }

  // One row per scenario and risk limit for a driver, straight from the precomputed runs. Nothing is re-simulated.
  function whatIf(data, driver) {
    return data.runs
      .filter(function (r) { return r.driver === driver; })
      .map(function (r) {
        var m = r.metrics;
        return {
          scenario: r.scenario, risk: r.risk_limit, weeks: r.weeks.length,
          avgPay: m.avg_pay.keel, avgPayAvg4: m.avg_pay.avg4,
          emptyKeel: m.overdraft_weeks.keel, emptyAvg4: m.overdraft_weeks.avg4, emptyLast: m.overdraft_weeks.last,
          swing: m.pay_swing.keel, earnSwing: m.earnings_swing
        };
      })
      .sort(function (a, b) { return a.scenario === b.scenario ? a.risk - b.risk : a.scenario < b.scenario ? -1 : 1; });
  }

  // Paycheck optimizer: for one week, the paycheck Keel chose under each risk limit in the file, with the
  // chance of running dry the policy estimated for it. Only precomputed runs are offered; a missing risk stays
  // null (shown as "not in file"), never filled in. Each option's buffer is the one that limit built up by then.
  function paycheckChoices(data, driver, scenario, week) {
    return data.runs
      .filter(function (r) { return r.driver === driver && r.scenario === scenario && r.weeks.length >= week; })
      .map(function (r) {
        var w = r.weeks[week - 1];
        return {
          riskLimit: r.risk_limit, week: w.week, weekStart: w.week_start || null, pay: w.pay_keel,
          risk: typeof w.risk === "number" ? w.risk : null,
          bufferBefore: w.buf_keel - w.net + w.pay_keel, bufferAfter: w.buf_keel, net: w.net,
          reason: typeof w.reason === "string" ? w.reason : "",
          avgPay: r.metrics.avg_pay.keel, emptyWeeks: r.metrics.overdraft_weeks.keel, weeks: r.weeks.length
        };
      })
      .sort(function (a, b) { return a.riskLimit - b.riskLimit; });
  }

  // Turn one CONTRACT run into the shape render() uses.
  function fromRun(run) {
    var w = run.weeks, M = run.metrics;
    function col(k) { return w.map(function (x) { return x[k]; }); }
    function side(k) { return { overdraft: M.overdraft_weeks[k], avgPay: M.avg_pay[k], swing: M.pay_swing[k] }; }
    return {
      net: col("net"), gross: col("gross"), lo: col("lo"), hi: col("hi"),
      pol: { keel: col("pay_keel"), avg4: col("pay_avg4"), last: col("pay_last") },
      buf: { keel: col("buf_keel"), avg4: col("buf_avg4"), last: col("buf_last") },
      // buffer before the week = end balance - take-home + paycheck
      log: w.map(function (x) { return { week: x.week, lo: x.lo, hi: x.hi, buffer: x.buf_keel - x.net + x.pay_keel, pay: x.pay_keel, risk: x.risk, reason: x.reason }; }),
      m: { keel: side("keel"), avg4: side("avg4"), last: side("last"), earnSwing: M.earnings_swing, taxTotal: M.tax_total, lowHit: M.low_case_hit_rate },
      checks: { identity: run.checks.identity, buffer: run.checks.buffer_nonnegative, pay: run.checks.pay_nonnegative }
    };
  }

  var api = { SOURCES: SOURCES, validate: validate, loadData: loadData, findRun: findRun, options: options, stormWeeks: stormWeeks, whatIf: whatIf, paycheckChoices: paycheckChoices, fromRun: fromRun };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KeelData = api;
})(this);
