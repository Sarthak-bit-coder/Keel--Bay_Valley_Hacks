// "My paycheck" summary for one week of one replayed run, from stored fields only (CONTRACT.md).
// Before payday: the paycheck Keel set, the buffer going in, and whether the policy's own risk estimate fits the limit.
// After payday: what the week actually earned and where it went. Nothing is forecast or re-simulated here.
"use strict";
(function (root) {
  var PAYDAY_OFFSET_DAYS = 4; // week_start is a Monday (CONTRACT.md); the simulated payday is that week's Friday
  var RISK_TOLERANCE = 1e-9;
  var num = function (v) { return typeof v === "number" && isFinite(v) ? v : null; };

  // ISO date of the Friday in the week starting on `weekStart` (YYYY-MM-DD), or null if the date is missing or malformed.
  function paydayDate(weekStart) {
    if (typeof weekStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null;
    var d = new Date(weekStart + "T00:00:00Z");
    if (isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() + PAYDAY_OFFSET_DAYS);
    return d.toISOString().slice(0, 10);
  }

  // status: "within" (estimated risk fits the limit), "over" (it does not), "unknown" (risk not in the file).
  // next: what the worker should know to do next: "steady", "rebuilding" (buffer under its starting level),
  //       "over_limit" or "unknown". The UI turns these into words; no advice is invented beyond them.
  function paycheckSummary(run, week) {
    var ws = run && Array.isArray(run.weeks) ? run.weeks : [];
    if (!ws.length) return null;
    var i = Math.min(Math.max(1, Math.round(week) || 1), ws.length) - 1, w = ws[i];
    if ([w.pay_keel, w.net, w.buf_keel].some(function (v) { return num(v) === null; })) return null;
    var before = w.buf_keel - w.net + w.pay_keel; // buffer before the week = end balance - take-home + paycheck
    var target = ws[0].buf_keel - ws[0].net + ws[0].pay_keel; // the buffer the replay started with
    var risk = num(w.risk), limit = num(run.risk_limit), gross = num(w.gross);
    var status = risk === null || limit === null ? "unknown" : risk > limit + RISK_TOLERANCE ? "over" : "within";
    var change = w.buf_keel - before;
    return {
      week: w.week, weeks: ws.length, isLast: i === ws.length - 1,
      weekStart: w.week_start || null, payday: paydayDate(w.week_start),
      pay: w.pay_keel, lo: num(w.lo), hi: num(w.hi), risk: risk, limit: limit, status: status,
      bufferBefore: before, bufferTarget: target,
      next: status === "over" ? "over_limit" : status === "unknown" ? "unknown" : before < target ? "rebuilding" : "steady",
      // Known only after the week is replayed.
      net: w.net, gross: gross, tax: gross === null ? null : gross - w.net,
      bufferAfter: w.buf_keel, bufferChange: change, flow: change < 0 ? "draw" : change > 0 ? "replenish" : "none"
    };
  }

  var api = { paydayDate: paydayDate, paycheckSummary: paycheckSummary };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KeelPaycheck = api;
})(this);
