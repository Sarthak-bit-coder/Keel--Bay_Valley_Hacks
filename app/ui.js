// Keel app UI: reads outputs/results.json through data.js and draws every view. No numbers are computed here beyond
// what data.js, benchmark.js, recovery.js and paycheck.js return (all tested in Node).
"use strict";
var DATA = null, WEEKS = 0, TAX = 0;
function findRun(driver, scenario, risk) { return KeelData.findRun(DATA, driver, scenario, risk); }
var fromRun = KeelData.fromRun;
// Opens on the most volatile driver in the storm. week = the payday shown on the Paycheck view (null = pick a default),
// ran = whether that simulated payday has been run.
var state = { driver: "C", scenario: "storm", risk: 0.05, tables: false, week: null, ran: false, view: "paycheck" };
var NAMES = { normal: "Normal weeks", storm: "Snowstorm stress test" };
var NS = "http://www.w3.org/2000/svg";
function money(n) { var r = Math.round(n); return (r < 0 ? "−$" : "$") + Math.abs(r).toLocaleString("en-US"); }
function pct(n) { return Math.round(n * 100) + "%"; }
function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

function tableView(el, cols, rows) {
  var h = "<table><thead><tr><th>Week</th>" + cols.map(function (c) { return '<th class="num">' + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>";
  rows.forEach(function (r, i) { h += "<tr><td>W" + (i + 1) + "</td>" + r.map(function (v) { return '<td class="num">' + money(v) + "</td>"; }).join("") + "</tr>"; });
  el.innerHTML = h + "</tbody></table>";
}

function pill(ok, yes, no) {
  var icon = ok
    ? '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5 5 9.5 10 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  return '<span class="pill ' + (ok ? "ok" : "bad") + '">' + icon + (ok ? yes : no) + "</span>";
}

// Paycheck view hero: next paycheck, payday, buffer, whether it fits the limit, and what to do next.
// All from KeelPaycheck.paycheckSummary (stored fields). "Run simulated payday" replays the week; no real money moves.
function goPlan(id) { showView("plan", id); }
function renderHero(run, R, storm) {
  var s = KeelPaycheck.paycheckSummary(run, state.week), el = document.getElementById("hero"), rc = document.getElementById("payday");
  if (!s) { el.innerHTML = '<p class="skeleton">This run has no weekly paychecks to show.</p>'; rc.innerHTML = ""; return; }
  var H = DATA.meta.horizon_weeks, paid = state.ran, isStorm = storm.indexOf(s.week) >= 0;
  var when = s.payday ? fmtDate(s.payday, { weekday: "short" }) : "Friday of week " + s.week;
  var buffer = paid ? s.bufferAfter : s.bufferBefore, gap = buffer - s.bufferTarget;
  var fit = {
    within: ['<span class="state ok">On track</span>', "Keel estimates about a " + pct(s.risk) + " chance the buffer runs out in the next " + H + " weeks. Your limit is " + pct(s.limit) + "."],
    over: ['<span class="state bad">Above your limit</span>', "Keel estimates about a " + pct(s.risk || 0) + " chance the buffer runs out in the next " + H + " weeks, above your " + pct(s.limit || 0) + " limit."],
    unknown: ['<span class="state warn">Not estimated</span>', "The results file has no risk estimate for this week, so we do not guess."]
  }[s.status];
  var next = {
    steady: ["Nothing needed this week", "This paycheck fits your limit and the buffer is at or above where it started.", "why", "See why Keel chose " + money(s.pay)],
    rebuilding: ["Let the buffer refill", "The buffer is " + money(s.bufferTarget - s.bufferBefore) + " under where it started, so Keel keeps the paycheck within your limit while it recovers.", "rec", "See how the buffer recovers"],
    over_limit: ["Expect smaller paychecks", "Keel could not bring the risk under your limit this week. Paychecks stay low until the buffer recovers.", "why", "See why Keel chose " + money(s.pay)],
    unknown: ["Check the details", "This week is missing its risk estimate.", "why", "See what the file has for this week"]
  }[s.next];
  var draw = -s.bufferChange, line = s.flow === "draw"
    ? "Earnings fell short this week. The buffer covered " + money(draw) + ", and the paycheck still arrived in full."
    : s.flow === "replenish" ? "Earnings beat the paycheck. The extra " + money(s.bufferChange) + " went into the buffer."
    : "Earnings matched the paycheck, so the buffer did not change.";
  el.innerHTML = '<div class="hero">' +
    '<div class="pay"><div class="eyerow"><span class="eyebrow">' + (paid ? "Simulated paycheck, paid" : "Next simulated paycheck") + '</span>' +
    '<span class="stepper"><button type="button" data-step="-1" aria-label="Previous week"' + (s.week === 1 ? " disabled" : "") + '><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M9 2 4 7l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
    "<span>Week " + s.week + " of " + s.weeks + '</span><button type="button" data-step="1" aria-label="Next week"' + (s.isLast ? " disabled" : "") + '><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="m5 2 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button></span></div>' +
    '<div class="figure">' + money(s.pay) + "</div>" +
    '<p class="when">' + (paid ? "Paid " : "Payday ") + "<strong>" + esc(when) + "</strong>" + (isStorm ? " · snowstorm stress test week" : "") + "</p>" +
    (paid ? '<p class="note"><strong>' + line + "</strong></p>" : s.lo === null || s.hi === null ? "" : '<p class="note">Keel’s forecast for this week’s earnings, after tax: ' + money(s.lo) + " to " + money(s.hi) + ".</p>") +
    '<div class="actions"><button type="button" class="btn primary" id="runpay">' + (!paid ? "Run simulated payday" : s.isLast ? "Restart the replay" : "Go to next week") + "</button>" +
    '<span class="note">Simulated driver ' + esc(state.driver) + ". No real money moves.</span></div></div>" +
    '<div class="facts3">' +
    '<div class="fact"><span class="eyebrow">' + (paid ? "In your buffer after payday" : "In your buffer") + '</span><span class="big figure">' + money(buffer) + "</span><p>" +
    (Math.abs(gap) < 1 ? "The same as when the replay started." : money(Math.abs(gap)) + (gap > 0 ? " more" : " less") + " than when the replay started.") +
    (s.pay > 0 && buffer > 0 ? " Covers about " + (buffer / s.pay).toFixed(1) + " paychecks of this size." : "") + "</p></div>" +
    '<div class="fact"><span class="eyebrow">Is this paycheck sustainable?</span><span class="big">' + fit[0] + "</span><p>" + fit[1] + "</p></div>" +
    '<div class="fact"><span class="eyebrow">What to do next</span><span class="big">' + next[0] + "</span><p>" + next[1] + ' <button type="button" class="link" data-go="' + next[2] + '">' + esc(next[3]) + "</button></p></div>" +
    "</div></div>";
  if (!paid) { rc.innerHTML = ""; return; }
  rc.innerHTML = '<div class="receipt"><h2>' + (isStorm ? "Snowstorm stress test week" : "Week " + s.week) + ": where the money went</h2><dl>" +
    "<div><dt>Earned, after tax</dt><dd>" + money(s.net) + "</dd></div>" +
    "<div><dt>Set aside for tax</dt><dd>" + (s.tax === null ? "Not in file" : money(s.tax)) + "</dd></div>" +
    "<div><dt>Paycheck paid</dt><dd>" + money(s.pay) + "</dd></div>" +
    "<div><dt>Buffer after payday</dt><dd>" + money(s.bufferAfter) + "</dd></div></dl>" +
    '<p class="note">' + esc(R.log[s.week - 1].reason || "") + ' <button type="button" class="link" data-go="bd">See where the money went</button></p></div>';
}
document.getElementById("hero").addEventListener("click", function (e) {
  var step = e.target.closest("button[data-step]"), go = e.target.closest("button[data-go]"), run = e.target.closest("#runpay");
  if (go) return jumpFromHero(go.dataset.go);
  if (step) { state.week += parseInt(step.dataset.step, 10); state.ran = false; }
  else if (run) {
    if (!state.ran) state.ran = true;
    else { state.week = state.week >= WEEKS ? 1 : state.week + 1; state.ran = false; }
  } else return;
  render();
  var again = step ? document.querySelector('#hero button[data-step="' + step.dataset.step + '"]:not(:disabled)') : null;
  (again || document.getElementById("runpay")).focus();
});
document.getElementById("payday").addEventListener("click", function (e) {
  var go = e.target.closest("button[data-go]");
  if (go) jumpFromHero(go.dataset.go);
});
// Deep links from the hero carry the selected week into the Plan tools.
function jumpFromHero(where) {
  if (where === "why") whyWeek = state.week;
  if (where === "bd") bdWeek = state.week;
  goPlan({ why: "why-h", bd: "bd-h", rec: "rec-h" }[where]);
}

function render() {
  if (!DATA) return;
  var run = findRun(state.driver, state.scenario, state.risk);
  if (!run) { document.getElementById("hero").innerHTML = '<p class="skeleton">The results file has no run for this driver, scenario and limit. Pick another combination above.</p>'; return; }
  var R = fromRun(run), M = R.m, TOY = DATA.meta.model === "toy";
  WEEKS = run.weeks.length;
  var storm = KeelData.stormWeeks(run, DATA.meta);
  var C = { keel: css("--keel"), avg4: css("--avg4"), last: css("--last"), ink2: css("--ink2") };

  // Default payday: the first marked storm week (the hardest week), else the last week.
  if (state.week === null) state.week = storm.length ? storm[0] : WEEKS;
  state.week = Math.min(Math.max(1, state.week), WEEKS);
  renderHero(run, R, storm);

  document.getElementById("tiles").innerHTML =
    '<div class="tile"><div class="label">Paycheck moved by</div><div class="value">' + money(M.keel.swing) + '</div><div class="cmp">' +
    '<span>Earnings moved by ' + money(M.earnSwing) + ' between the best and worst week.</span></div></div>' +
    '<div class="tile"><div class="label">Weeks the buffer ran out</div><div class="value">' + M.keel.overdraft + ' of ' + WEEKS + '</div><div class="cmp">' +
    '<span><i class="dot" style="background:' + C.avg4 + '"></i>Paying the 4-week average: ' + M.avg4.overdraft + '</span>' +
    '<span><i class="dot" style="background:' + C.last + '"></i>Paying last week’s earnings: ' + M.last.overdraft + '</span></div></div>' +
    '<div class="tile"><div class="label">Average weekly paycheck</div><div class="value">' + money(M.keel.avgPay) + '</div><div class="cmp">' +
    '<span><i class="dot" style="background:' + C.avg4 + '"></i>Paying the 4-week average: ' + money(M.avg4.avgPay) + '</span>' +
    '<span>Set aside for tax over ' + WEEKS + ' weeks: ' + money(M.taxTotal) + ' (illustrative ' + pct(TAX) + ')</span></div></div>';

  // Heads-up: the week after the selected payday. Stored forecast low vs this paycheck. Reads lo, pay_keel, buf_keel only.
  var cw = run.weeks[state.week - 1], nw = run.weeks[state.week], hu = '<header><h2 id="hu-h">Heads-up for next week</h2></header>';
  if (!nw) {
    hu += '<p class="msg">No forecast for the week after this replay.</p><p class="note">The results file ends at week ' + WEEKS + ".</p>";
  } else {
    var gap = cw.pay_keel - nw.lo;
    hu += '<p class="msg">' + (gap > 0 ? "Next week could come in below your paycheck. " + (cw.buf_keel >= gap ? "The buffer is larger than the gap." : "Your buffer may not cover all of it.") : "The low case for next week is at or above your paycheck.") + "</p>" +
      '<p class="note">Forecast low for week ' + nw.week + ": " + money(nw.lo) + " · this week’s paycheck: " + money(cw.pay_keel) + " · buffer after payday: " + money(cw.buf_keel) + "</p>";
  }
  hu += '<p class="note">The forecast low is calibrated to hold about 90% of the time' + (CAL && typeof CAL.calibrated_hit_rate === "number" ? " (" + pct(CAL.calibrated_hit_rate) + " on test weeks)" : "") + ", so about 1 week in 10 can come in lower. Nothing here is a promise or financial advice.</p>";
  document.getElementById("headsup").innerHTML = hu;

  // Week by week: stored values only. "Buffer empty" uses the same test as the empty-buffer figure (below zero).
  var emptyIcon = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1 11 10.5H1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 4.5v3M6 9v.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  document.getElementById("wksub").textContent = "Simulated driver " + state.driver + ", " + (state.scenario === "storm" ? "snowstorm stress test" : "normal weeks") + ", " + pct(state.risk) + " limit. Straight from the results file.";
  document.getElementById("weektable").innerHTML = '<thead><tr><th scope="col">Week</th><th scope="col" class="num">Paycheck</th><th scope="col" class="num">Earned after tax</th><th scope="col" class="num">Buffer after payday</th><th scope="col">Why</th></tr></thead><tbody>' +
    run.weeks.map(function (w) {
      return "<tr" + (w.week === state.week ? ' aria-current="true"' : "") + '><th scope="row">Week ' + w.week + (storm.indexOf(w.week) >= 0 ? " (snowstorm stress test)" : "") + '</th><td class="num">' + money(w.pay_keel) + '</td><td class="num">' + money(w.net) + '</td><td class="num">' + money(w.buf_keel) +
        (w.buf_keel < 0 ? '<br><span class="empty">' + emptyIcon + "Buffer empty</span>" : "") + "</td><td>" + esc(w.reason) + "</td></tr>";
    }).join("") + "</tbody>";

  document.getElementById("c1sub").textContent = "What the driver earned each week after the tax set-aside, next to the paycheck Keel paid. Simulated driver " + state.driver + (state.scenario !== "storm" ? ", normal weeks." : storm.length ? ", snowstorm stress test in week" + (storm.length > 1 ? "s " + storm.slice(0, -1).join(", ") + " and " + storm[storm.length - 1] : " " + storm[0]) + "." : ", snowstorm stress test (the results file does not mark which weeks).");
  var dates = run.weeks.map(function (w) { return w.week_start; });
  var s1 = [{ name: "What you earned (after tax)", short: "Earned", color: C.ink2, thin: true, values: R.net }, { name: "Keel paycheck", short: "Keel", color: C.keel, values: R.pol.keel }];
  legend(document.getElementById("c1legend"), [s1[1], s1[0]], true, true);
  lineChart(document.getElementById("c1"), { dates: dates, now: state.week, series: [s1[0], s1[1]], band: { lo: R.lo, hi: R.hi }, zero: true, stormWeeks: storm, endLabels: true, label: "Weekly take-home earnings and Keel paycheck for " + WEEKS + " weeks." });
  tableView(document.getElementById("c1table"), ["Earned after tax", "Keel paycheck", "Forecast low", "Forecast high"], R.net.map(function (v, i) { return [v, R.pol.keel[i], R.lo[i], R.hi[i]]; }));

  var s2 = [
    { name: "Keel", color: C.keel, values: R.buf.keel },
    { name: "Paying the 4-week average", short: "4-week average", color: C.avg4, dash: true, values: R.buf.avg4 },
    { name: "Paying last week’s earnings", short: "Last week’s pay", color: C.last, dash: true, values: R.buf.last }];
  legend(document.getElementById("c2legend"), s2, false, true);
  lineChart(document.getElementById("c2"), { dates: dates, now: state.week, series: s2, zero: true, stormWeeks: storm, endLabels: false, label: "Buffer balance for three pay rules over " + WEEKS + " weeks." });
  tableView(document.getElementById("c2table"), ["Keel", "4-week average", "Last week’s pay"], R.buf.keel.map(function (v, i) { return [v, R.buf.avg4[i], R.buf.last[i]]; }));
  ["c1", "c2"].forEach(function (id) {
    document.getElementById(id).classList.toggle("hidden", state.tables);
    document.getElementById(id + "table").classList.toggle("hidden", !state.tables);
  });

  var better = M.keel.overdraft < Math.min(M.avg4.overdraft, M.last.overdraft);
  var tied = M.keel.overdraft === Math.min(M.avg4.overdraft, M.last.overdraft);
  var STEADY_CUT = 0.3; // pass mark from docs/preregistration.md: paycheck swing at least 30% smaller than earnings swing
  var steadier = M.keel.swing <= (1 - STEADY_CUT) * M.earnSwing;
  var target = CAL && typeof CAL.target_low_case === "number" ? " (target " + pct(CAL.target_low_case) + ")" : "";
  document.getElementById("score").innerHTML =
    "<thead><tr><th>Question we wrote down first</th><th>" + (TOY ? "Toy sample (not our result)" : "Real model") + "</th></tr></thead><tbody>" +
    "<tr><td>Is the low-case forecast right as often as it claims" + target + "?</td><td>" + pct(M.lowHit) + " of weeks at or above the low case</td></tr>" +
    "<tr><td>Does Keel run out of buffer less often than the two simple rules?</td><td>" + pill(better, "Yes: " + M.keel.overdraft + " vs " + M.avg4.overdraft + " and " + M.last.overdraft, tied ? "Tie: " + M.keel.overdraft + " weeks each" : "No: " + M.keel.overdraft + " vs " + M.avg4.overdraft + " and " + M.last.overdraft) + "</td></tr>" +
    "<tr><td>Is the paycheck swing at least 30% smaller than the earnings swing?</td><td>" + pill(steadier, "Yes: " + money(M.keel.swing) + " vs " + money(M.earnSwing), "No: " + money(M.keel.swing) + " vs " + money(M.earnSwing) + " (" + pct(Math.abs(1 - M.keel.swing / M.earnSwing)) + (M.keel.swing <= M.earnSwing ? " smaller)" : " larger)")) + "</td></tr></tbody>";

  var cost = M.avg4.avgPay - M.keel.avgPay;
  var txt = "<strong>Where Keel pays a price.</strong> ";
  if (cost > 1) txt += "Keel pays " + money(cost) + " less per week on average than the 4-week average. That is the cost of a safer buffer. ";
  else txt += "Keel pays about the same on average as the 4-week average (" + money(M.keel.avgPay) + " vs " + money(M.avg4.avgPay) + "). ";
  if (!better) txt += "Here it did not beat the simple rules on empty-buffer weeks, and the real report will say so too.";
  else txt += "The real report will list the cases where it loses, not only the ones it wins.";
  document.getElementById("loses").innerHTML = txt;

  document.getElementById("checks").innerHTML =
    "<tbody>" +
    "<tr><td>Every week: payout = paycheck + tax set-aside + change in buffer</td><td class=\"num\">" + pill(R.checks.identity, "Passed", "Failed") + "</td></tr>" +
    "<tr><td>Keel buffer never below zero</td><td class=\"num\">" + pill(R.checks.buffer, "Passed", "Failed") + "</td></tr>" +
    "<tr><td>Paycheck never negative</td><td class=\"num\">" + pill(R.checks.pay, "Passed", "Failed") + "</td></tr></tbody>";

  if (whyWeek === null || whyWeek > R.log.length) whyWeek = R.log.length;
  var rows = R.log.map(function (r) {
    return "<tr" + (r.week === whyWeek ? ' aria-current="true"' : "") + "><td><button type=\"button\" class=\"link\" data-why=\"" + r.week + "\" aria-label=\"Explain week " + r.week + "\">Week " + r.week + "</button></td><td class=\"num\">" + money(r.lo) + "–" + money(r.hi) + "</td><td class=\"num\">" + money(r.buffer) + "</td><td class=\"num\">" + money(r.pay) + "</td><td>" + esc(r.reason) + "</td></tr>";
  }).join("");
  renderRecovery();
  renderBenchmark();
  renderWhatIf();
  renderOptimizer();
  renderBreakdown();
  renderReliability();
  renderStress();
  renderWhy(run);
  document.getElementById("log").innerHTML = "<thead><tr><th>Week</th><th class=\"num\">Forecast range</th><th class=\"num\">Buffer before</th><th class=\"num\">Paycheck</th><th>Why</th></tr></thead><tbody>" + rows + "</tbody>";
}

// Calibration panel: outputs/calibration.json if B has written it, else the low-case hit rates in the results file.
function bar(label, v, target, off) {
  return '<div class="row"><span>' + esc(label) + '</span><span class="track" role="img" aria-label="' + esc(label) + ": " + pct(v) + '">' +
    '<span class="fill' + (off ? " off" : "") + '" style="width:' + Math.max(0, Math.min(1, v)) * 100 + '%"></span>' +
    (target != null ? '<span class="target" style="left:calc(' + target * 100 + '% - 1px)" title="Target ' + pct(target) + '"></span>' : "") +
    '</span><span class="n">' + pct(v) + "</span></div>";
}
// Forecast reliability: coverage vs target, error metrics, forecast band vs actual, largest misses.
// Everything is read from results.json (stored forecasts) and calibration.json; nothing is re-estimated here.
var CAL = null;
function renderCalib(cal) { CAL = cal; render(); }
function renderReliability() {
  if (!DATA) return;
  var C = { keel: css("--keel"), avg4: css("--avg4") };
  var TOY = DATA.meta.model === "toy", rel = KeelData.reliability(DATA, CAL), o = rel.overall, T = rel.targets;
  var src = TOY ? "Toy sample, not our result: the forecast is the prototype's toy, not the real model. " : "Real evaluation on simulated drivers. ";
  document.getElementById("relsub").textContent = src + "Normal weeks only, on test weeks the model never saw. The snowstorm stress test is left out because it was added after forecasting.";
  document.getElementById("relexplain").innerHTML = "<strong>What calibration means:</strong> each week Keel forecasts a low case and a high case for take-home pay. " +
    "A low case that claims to be right 9 times in 10 should have actual pay at or above it on about 9 weeks in 10. " +
    "Calibration nudges the forecasts, using weeks held back from training, until that claim is true. If the low case is too high, Keel would pay out money that never arrives.";
  if (!o) { document.getElementById("calib").innerHTML = '<p class="note">No normal-scenario weeks in the results file, so there is nothing to score.</p>'; return; }
  var h = bar("Low case right (pay at or above it)", o.lowHit, T && T.low) + bar("High case right (pay at or below it)", o.highHit, T && T.high) + bar("Inside the band (both right)", o.bandHit, T && T.band);
  if (CAL && typeof CAL.uncalibrated_hit_rate === "number") h += bar("Low case right before calibration", CAL.uncalibrated_hit_rate, T && T.low, true);
  document.getElementById("calib").innerHTML = '<div class="bars">' + h + '</div><p class="note">' + (T
    ? "The black tick is the target (" + pct(T.low) + " for each case, so " + pct(T.band) + " for the band), from outputs/calibration.json. "
    : "<strong>outputs/calibration.json is missing</strong>, so no target is shown and the before-calibration rate is unknown. Bars are computed from the results file. ") +
    o.n + " test weeks; weekly earnings are autocorrelated, so treat these as approximate.</p>";

  var ws = rel.weeks.filter(function (w) { return w.driver === state.driver; });
  legend(document.getElementById("rellegend"), [{ name: "What was earned (after tax)", color: css("--ink2") }], true);
  if (ws.length) lineChart(document.getElementById("relchart"), {
    dates: ws.map(function (w) { return w.weekStart; }),
    series: [{ name: "Earned", color: css("--ink2"), values: ws.map(function (w) { return w.actual; }) }].concat(ws[0].mid !== null ? [{ name: "Middle case", color: C.keel, dash: true, values: ws.map(function (w) { return w.mid; }) }] : []),
    band: { lo: ws.map(function (w) { return w.lo; }), hi: ws.map(function (w) { return w.hi; }) }, zero: true, endLabels: false,
    label: "Driver " + state.driver + ": forecast low-to-high band and actual take-home pay, " + ws.length + " test weeks." });

  var row = function (name, s) {
    return "<tr><td>" + esc(name) + '</td><td class="num">' + s.n + '</td><td class="num">' + pct(s.lowHit) + '</td><td class="num">' + pct(s.highHit) + '</td><td class="num">' + pct(s.bandHit) +
      '</td><td class="num">' + money(s.meanWidth) + '</td><td class="num">' + s.missCount + (s.meanMiss === null ? "" : " (avg " + money(s.meanMiss) + ")") +
      '</td><td class="num">' + (s.maeMid === null ? "Not in file" : money(s.maeMid)) + "</td></tr>";
  };
  document.getElementById("relstats").innerHTML = '<thead><tr><th>Driver</th><th class="num">Weeks</th><th class="num">Low case right</th><th class="num">High case right</th><th class="num">Inside band</th>' +
    '<th class="num">Avg band width</th><th class="num">Weeks outside band (avg miss)</th><th class="num">Avg error vs middle case</th></tr></thead><tbody>' +
    rel.drivers.map(function (d) { return row(d.label, d.s); }).join("") + row("All drivers", o) + "</tbody>";

  document.getElementById("relworst").innerHTML = rel.worst.length
    ? '<thead><tr><th>Driver</th><th>Week</th><th class="num">Actual</th><th class="num">Forecast band</th><th>Missed by</th></tr></thead><tbody>' +
      rel.worst.map(function (w) {
        return "<tr><td>" + esc(w.driver) + "</td><td>W" + w.week + (w.weekStart ? " (" + esc(w.weekStart) + ")" : "") + '</td><td class="num">' + money(w.actual) + '</td><td class="num">' +
          money(w.lo) + "–" + money(w.hi) + "</td><td>" + money(w.miss) + (w.side === "above" ? " above the high case" : " below the low case (Keel planned on money that did not come)") + "</td></tr>";
      }).join("") + "</tbody>"
    : '<tbody><tr><td>Every test week landed inside the forecast band.</td></tr></tbody>';
  document.getElementById("relnote").textContent = "Average error against the middle case needs the middle forecast, which the results file does not store (CONTRACT.md has only the low and high case), so it is shown as not in file instead of being estimated.";
}

// Where Keel loses: scanned from every run, so it cannot be cherry-picked by the filters.
function renderLosses() {
  var name = { avg4: "4-week average", last: "last week’s pay" }, items = [], payGaps = [];
  DATA.runs.forEach(function (r) {
    var o = r.metrics.overdraft_weeks, tag = "Driver " + r.driver + ", " + (r.scenario === "storm" ? "snowstorm stress test" : "normal weeks") + ", " + pct(r.risk_limit) + " limit";
    ["avg4", "last"].forEach(function (k) {
      if (o.keel > o[k]) items.push(tag + ": Keel had " + o.keel + " empty-buffer week" + (o.keel === 1 ? "" : "s") + ", " + name[k] + " had " + o[k] + ".");
    });
    if (!r.checks.buffer_nonnegative && o.keel <= Math.min(o.avg4, o.last)) items.push(tag + ": Keel’s buffer still went below zero (" + o.keel + " week" + (o.keel === 1 ? "" : "s") + ").");
    payGaps.push(r.metrics.avg_pay.avg4 - r.metrics.avg_pay.keel);
  });
  var lower = payGaps.filter(function (g) { return g > 0; });
  if (lower.length) items.push("Keel paid less on average than the 4-week average in " + lower.length + " of " + DATA.runs.length + " runs, by " + money(Math.min.apply(null, lower)) + " to " + money(Math.max.apply(null, lower)) + " a week. That is the price of a safer buffer.");
  if (!items.length) items.push("No run in this file where Keel did worse than a simple rule on empty-buffer weeks or average pay.");
  items.push("Why each loss happened is written up in outputs/failures.md in the repo.");
  document.getElementById("losslist").innerHTML = items.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
}

// Paycheck optimizer: every option is a precomputed run; nothing is estimated in the browser.
var optWeek = 1;
function renderOptimizer() {
  var run = findRun(state.driver, state.scenario, state.risk), TOY = DATA.meta.model === "toy";
  if (!run) return;
  optWeek = Math.min(Math.max(1, optWeek), run.weeks.length);
  document.getElementById("optweek").innerHTML = run.weeks.map(function (w) {
    return '<option value="' + w.week + '"' + (w.week === optWeek ? " selected" : "") + ">Week " + w.week + (fmtDate(w.week_start) ? " · " + esc(fmtDate(w.week_start)) : "") + "</option>";
  }).join("");
  var opts = KeelData.paycheckChoices(DATA, state.driver, state.scenario, optWeek);
  function riskText(o) { return o.risk === null ? "Risk not in file" : "About " + pct(o.risk) + " chance of running dry"; }
  document.getElementById("optlist").innerHTML = '<legend class="sr-only">Paycheck and risk options for week ' + optWeek + "</legend>" +
    opts.map(function (o) {
      var on = Math.abs(o.riskLimit - state.risk) < 1e-9;
      return '<label><input type="radio" name="optpick" value="' + o.riskLimit + '"' + (on ? " checked" : "") + '><span class="limit">' + pct(o.riskLimit) + ' limit</span><span class="big">' + money(o.pay) +
        '</span><span class="sub">' + esc(riskText(o)) + "</span></label>";
    }).join("");
  var o = opts.find(function (x) { return Math.abs(x.riskLimit - state.risk) < 1e-9; });
  document.getElementById("optdetail").innerHTML = o ? "<dl>" +
    "<div><dt>Paycheck this week</dt><dd>" + money(o.pay) + "</dd></div>" +
    "<div><dt>Estimated chance the buffer runs dry (next " + DATA.meta.horizon_weeks + " weeks)</dt><dd>" + (o.risk === null ? "Not in file" : pct(o.risk)) + "</dd></div>" +
    "<div><dt>Buffer before → after</dt><dd>" + money(o.bufferBefore) + " → " + money(o.bufferAfter) + "</dd></div>" +
    "<div><dt>Average paycheck · empty-buffer weeks (whole replay)</dt><dd>" + money(o.avgPay) + " · " + o.emptyWeeks + " of " + o.weeks + "</dd></div>" +
    '</dl><p class="note"><strong>Why:</strong> ' + esc(o.reason || "No explanation in the file.") + "</p>" : "";
  document.getElementById("optsub").textContent = (TOY ? "Toy sample, not our result. " : "") +
    "Pick a week, then pick a paycheck. Each choice is one risk limit Keel was actually run with; other amounts were not evaluated, so they are not offered.";
  document.getElementById("optnote").textContent = (TOY ? "Toy data: numbers come from the prototype simulation, not the real model. " : "Simulated drivers. ") +
    "Read from the results file, not computed in the browser. Each option's buffer is the one that limit had built up by this week. Not financial or tax advice.";
}
document.getElementById("optweek").addEventListener("change", function (e) { optWeek = parseInt(e.target.value, 10); renderOptimizer(); });
document.getElementById("optlist").addEventListener("change", function (e) {
  if (e.target.name !== "optpick") return;
  state.risk = parseFloat(e.target.value);
  document.getElementById("risk").value = String(state.risk);
  render();
  var picked = document.querySelector('#optlist input[value="' + state.risk + '"]');
  if (picked) picked.focus();
});

// Paycheck breakdown: one week's money flow from stored fields (KeelData.paycheckBreakdown). Nothing is recomputed
// beyond subtraction, and values the file cannot give (week 1 opening buffer) are shown as not derivable.
var bdWeek = null;
function renderBreakdown() {
  var run = findRun(state.driver, state.scenario, state.risk), TOY = DATA.meta.model === "toy";
  if (!run) return;
  if (bdWeek === null || bdWeek > run.weeks.length) bdWeek = Math.min(2, run.weeks.length);
  document.getElementById("bdweek").innerHTML = run.weeks.map(function (w) {
    return '<option value="' + w.week + '"' + (w.week === bdWeek ? " selected" : "") + ">Week " + w.week + (fmtDate(w.week_start) ? " · " + esc(fmtDate(w.week_start)) : "") + "</option>";
  }).join("");
  var b = KeelData.paycheckBreakdown(run, bdWeek), el = document.getElementById("bdbody"), na = "Not derivable";
  document.getElementById("bdsub").textContent = (TOY ? "Toy sample, not our result. " : "Simulated driver " + state.driver + ". ") +
    "Where one week's simulated earnings went: paycheck, tax reserve and buffer. Pick a week.";
  document.getElementById("bdnote").textContent = (TOY ? "Toy data from the prototype simulation. " : "Simulated drivers, no real money. ") +
    "Read from the results file: tax reserve = gross − take-home as stored (illustrative " + pct(TAX) + " rate), beginning buffer = last week's ending buffer. Not financial or tax advice.";
  if (!b || b.gross === null) { el.innerHTML = '<p class="note">This week has no gross earnings in the file, so there is no breakdown to show.</p>'; return; }
  function seg(cls, v, total, label) {
    if (v <= 0 || total <= 0) return "";
    var w = 100 * v / total;
    return '<span class="' + cls + '" style="width:' + w + '%" title="' + esc(label + ": " + money(v)) + '">' + (w > 14 ? esc(money(v)) : "") + "</span>";
  }
  var draw = b.flow === "draw" ? -b.bufferChange : 0, toBuf = b.flow === "replenish" ? b.bufferChange : 0;
  var h = "";
  if (b.identity === false) h += '<p class="bdwarn" role="alert"><strong>Accounting check failed.</strong> Gross ' + money(b.gross) + " ≠ paycheck + tax reserve + buffer change (off by " + (Math.abs(b.gap) < 1 ? "$" + Math.abs(b.gap).toFixed(2) : money(Math.abs(b.gap))) + "). The numbers below are shown as stored; treat them with care.</p>";
  if (b.bufferChange !== null) {
    var total = b.gross + draw, legendItems = [["bd-earn", "Gross earnings"], ["bd-draw", "From buffer"], ["bd-pay", "Paycheck"], ["bd-tax", "Tax reserve"], ["bd-buf", "To buffer"]];
    h += '<div class="bdflow" role="img" aria-label="' + esc("Money in: " + money(b.gross) + " earnings" + (draw ? " plus " + money(draw) + " from the buffer" : "") + ". Money out: " + money(b.pay) + " paycheck, " + money(b.tax) + " tax reserve" + (toBuf ? ", " + money(toBuf) + " to the buffer" : "") + ".") + '">' +
      '<div class="bdrow"><span>Money in</span><div class="bdbar">' + seg("bd-earn", b.gross, total, "Gross earnings") + seg("bd-draw", draw, total, "From buffer") + "</div></div>" +
      '<div class="bdrow"><span>Money out</span><div class="bdbar">' + seg("bd-pay", b.pay, total, "Paycheck") + seg("bd-tax", b.tax, total, "Tax reserve") + seg("bd-buf", toBuf, total, "To buffer") + "</div></div></div>" +
      '<div class="legend">' + legendItems.map(function (l) { return '<span><i class="swatch ' + l[0] + '" style="opacity:1"></i>' + l[1] + "</span>"; }).join("") + "</div>";
  }
  var flowText = {
    draw: "<strong>The buffer paid in.</strong> Take-home pay (" + money(b.net) + ") fell short of the paycheck, so " + money(draw) + " came out of the buffer.",
    replenish: "<strong>Earnings refilled the buffer.</strong> Take-home pay (" + money(b.net) + ") was more than the paycheck, so the extra " + money(toBuf) + " went into the buffer.",
    none: "<strong>Even week.</strong> Take-home pay matched the paycheck; the buffer did not change.",
    unknown: "<strong>Week 1:</strong> the results file has no opening buffer balance, so the buffer change and the accounting check cannot be shown for this week. Pick week 2 or later."
  };
  h += '<p class="note">' + flowText[b.flow] + "</p><dl>" +
    "<div><dt>Gross earnings (simulated)</dt><dd>" + money(b.gross) + "</dd></div>" +
    "<div><dt>Paycheck (simulated)</dt><dd>" + money(b.pay) + "</dd></div>" +
    "<div><dt>Tax reserve</dt><dd>" + money(b.tax) + "</dd></div>" +
    "<div><dt>Buffer change</dt><dd>" + (b.bufferChange === null ? na : (b.bufferChange > 0 ? "+" : "") + money(b.bufferChange)) + "</dd></div>" +
    "<div><dt>Buffer start → end</dt><dd>" + (b.bufferStart === null ? na : money(b.bufferStart)) + " → " + money(b.bufferEnd) + "</dd></div>" +
    "<div><dt>Gross = paycheck + tax + buffer change</dt><dd>" + (b.identity === null ? na : pill(b.identity, "Balances", "Does not balance")) + "</dd></div></dl>";
  el.innerHTML = h;
}
document.getElementById("bdweek").addEventListener("change", function (e) { bdWeek = parseInt(e.target.value, 10); renderBreakdown(); });

// Stress test lab: before (normal weeks) vs after (chosen scenario) for the selected driver and risk limit.
// Only scenarios with runs in the results file are shown with numbers; the rest say "not evaluated".
var stScenario = "storm";
function renderStress() {
  if (!DATA) return;
  var TOY = DATA.meta.model === "toy", C = { keel: css("--keel"), avg4: css("--avg4"), last: css("--last"), muted: css("--muted") };
  var res = KeelData.stressTest(DATA, state.driver, state.risk, stScenario), sc = res.scenario;
  // Only scenarios that were actually evaluated get a button.
  document.getElementById("stseg").innerHTML = KeelData.STRESS_SCENARIOS.filter(function (s) {
    return KeelData.stressTest(DATA, state.driver, state.risk, s.id).available;
  }).map(function (s) {
    return '<button type="button" data-st="' + s.id + '" aria-pressed="' + (s.id === stScenario) + '">' + esc(s.name) + "</button>";
  }).join("");
  document.getElementById("stsub").textContent = (TOY ? "Toy sample, not our result. " : "Simulated drivers, real evaluation runs. ") +
    "Driver " + state.driver + " at a " + pct(state.risk) + " limit (change both above). Before = normal weeks, after = the chosen scenario.";
  document.getElementById("stnote").textContent = "Every number comes from runs in the results file; nothing is simulated in the browser. " +
    (DATA.meta.storm ? "Snowstorm stress test: " + DATA.meta.storm + ". " : "") + "Depletion risk is the policy's own estimate for the next " + DATA.meta.horizon_weeks + " weeks. Not financial or tax advice.";
  var charts = document.getElementById("stcharts"), body = document.getElementById("stbody");
  if (!res.available) {
    charts.classList.add("hidden");
    body.innerHTML = '<p class="note"><strong>' + esc(sc.name) + " was not evaluated.</strong> The results file has no runs for this scenario, so there are no numbers to show. " +
      "Adding it means running eval/run_eval.py with this scenario, not estimating it here.</p>";
    return;
  }
  charts.classList.remove("hidden");
  var A = res.after, B = res.before, D = res.delta, same = stScenario === "normal" || !B;
  function chg(v, fmt, goodUp) {
    if (same || v === null) return "<td></td>";
    var r = Math.round(v), cls = r === 0 ? "" : (r > 0) === goodUp ? "up" : "down";
    return '<td class="num ' + cls + '">' + (r > 0 ? "+" : r < 0 ? "−" : "") + fmt(Math.abs(v)) + "</td>";
  }
  var cnt = function (n) { return String(n); };
  function line(label, b, a, d, fmt, goodUp) {
    return "<tr><th scope=\"row\">" + esc(label) + "</th>" + (same ? "" : '<td class="num">' + (b === null ? "—" : fmt(b)) + "</td>") + '<td class="num">' + (a === null ? "Not in file" : fmt(a)) + "</td>" + (same ? "" : chg(d, fmt, goodUp)) + "</tr>";
  }
  var rk = function (r) { return r === null ? "Not in file" : pct(r); };
  var h = same ? "" : '<p class="note"><strong>Financial impact:</strong> ' + esc(sc.name) + " changes average take-home pay by " + (D.avgNet < 0 ? "−" : "+") + money(Math.abs(D.avgNet)) +
    " a week. Keel's paycheck moves by " + (D.avgPayKeel < 0 ? "−" : "+") + money(Math.abs(D.avgPayKeel)) + " and its lowest buffer by " + (D.minBufKeel < 0 ? "−" : "+") + money(Math.abs(D.minBufKeel)) +
    ". Empty-buffer weeks: Keel " + B.empty.keel + " → " + A.empty.keel + ", 4-week average " + B.empty.avg4 + " → " + A.empty.avg4 + ", last week's pay " + B.empty.last + " → " + A.empty.last + ".</p>";
  h += '<div class="scroll"><table id="sttable"><thead><tr><th>Average over ' + A.weeks + " weeks</th>" + (same ? "" : '<th class="num">Normal weeks</th>') + '<th class="num">' + esc(sc.name) + "</th>" + (same ? "" : '<th class="num">Change</th>') + "</tr></thead><tbody>" +
    line("Take-home pay", B && B.avgNet, A.avgNet, D && D.avgNet, money, true) +
    line("Forecast low case", B && B.avgLo, A.avgLo, D && A.avgLo - B.avgLo, money, true) +
    line("Paycheck: Keel", B && B.avgPay.keel, A.avgPay.keel, D && D.avgPayKeel, money, true) +
    line("Paycheck: 4-week average", B && B.avgPay.avg4, A.avgPay.avg4, D && A.avgPay.avg4 - B.avgPay.avg4, money, true) +
    line("Paycheck: last week's pay", B && B.avgPay.last, A.avgPay.last, D && A.avgPay.last - B.avgPay.last, money, true) +
    line("Lowest buffer: Keel", B && B.minBuf.keel, A.minBuf.keel, D && D.minBufKeel, money, true) +
    line("Lowest buffer: 4-week average", B && B.minBuf.avg4, A.minBuf.avg4, D && A.minBuf.avg4 - B.minBuf.avg4, money, true) +
    line("Lowest buffer: last week's pay", B && B.minBuf.last, A.minBuf.last, D && A.minBuf.last - B.minBuf.last, money, true) +
    line("Empty-buffer weeks: Keel", B && B.empty.keel, A.empty.keel, D && D.emptyKeel, cnt, false) +
    line("Empty-buffer weeks: 4-week average", B && B.empty.avg4, A.empty.avg4, D && D.emptyAvg4, cnt, false) +
    line("Empty-buffer weeks: last week's pay", B && B.empty.last, A.empty.last, D && D.emptyLast, cnt, false) +
    "<tr><th scope=\"row\">Highest estimated depletion risk: Keel</th>" + (same ? "" : '<td class="num">' + rk(B.maxRisk) + "</td>") + '<td class="num">' + rk(A.maxRisk) + "</td>" + (same ? "" : "<td></td>") + "</tr>" +
    "</tbody></table></div>";
  body.innerHTML = h;
  var aw = res.afterRun.weeks, bw = res.beforeRun ? res.beforeRun.weeks : null, storm = KeelData.stormWeeks(res.afterRun, DATA.meta);
  var col = function (ws, k) { return ws.map(function (x) { return x[k]; }); }, stDates = col(aw, "week_start");
  var s1 = [{ name: "Take-home, " + sc.name, short: "Take-home", color: css("--ink2"), thin: true, values: col(aw, "net") }, { name: "Keel paycheck, " + sc.name, short: "Keel", color: C.keel, values: col(aw, "pay_keel") }];
  if (!same && bw) s1 = s1.concat([{ name: "Take-home, normal weeks", color: css("--ink2"), dash: true, values: col(bw, "net") }, { name: "Keel paycheck, normal weeks", color: C.keel, dash: true, values: col(bw, "pay_keel") }]);
  legend(document.getElementById("stleg1"), s1, false);
  lineChart(document.getElementById("stc1"), { dates: stDates, series: s1, zero: true, stormWeeks: storm, endLabels: false, label: "Take-home pay and Keel paycheck, " + sc.name + (same ? "" : " vs normal weeks (dashed)") + "." });
  var s2 = [{ name: "Keel", color: C.keel, values: col(aw, "buf_keel") }, { name: "4-week average", color: C.avg4, thin: true, values: col(aw, "buf_avg4") }, { name: "Last week’s pay", color: C.last, thin: true, values: col(aw, "buf_last") }];
  if (!same && bw) s2.push({ name: "Keel, normal weeks", color: C.keel, dash: true, values: col(bw, "buf_keel") });
  legend(document.getElementById("stleg2"), s2, false);
  lineChart(document.getElementById("stc2"), { dates: stDates, series: s2, zero: true, stormWeeks: storm, endLabels: false, label: "Buffer balance under three pay rules, " + sc.name + ". Below zero means overdraft." });
}
document.getElementById("stseg").addEventListener("click", function (e) {
  var b = e.target.closest("button[data-st]");
  if (!b) return;
  stScenario = b.dataset.st;
  renderStress();
  var again = document.querySelector('#stseg button[data-st="' + stScenario + '"]');
  if (again) again.focus();
});

// "Why this paycheck?": one week explained from the stored run; the decision log picks the week.
var whyWeek = null;
function renderWhy(run) {
  var TOY = DATA.meta.model === "toy", e = KeelData.explainWeek(run, whyWeek), H = DATA.meta.horizon_weeks;
  document.getElementById("whysub").textContent = (TOY ? "Toy sample, not our result. " : "Simulated driver. ") +
    "How Keel picked one week's paycheck for driver " + state.driver + ". Pick a week in the decision log below to explain it.";
  document.getElementById("whynote").textContent = "Read from the results file, not recomputed. Not financial or tax advice.";
  var el = document.getElementById("whybody");
  if (!e) { el.innerHTML = '<p class="note">No week to explain: this run has no weekly data.</p>'; return; }
  var na = "Not in file";
  var h = '<p class="note"><strong>Week ' + e.week + (e.weekStart ? " (" + esc(e.weekStart) + ")" : "") + ":</strong> Keel paid <strong>" + money(e.pay) + "</strong>.</p><dl>" +
    "<div><dt>Forecast take-home range</dt><dd>" + (e.lo === null || e.hi === null ? na : money(e.lo) + "–" + money(e.hi)) + "</dd></div>" +
    "<div><dt>Buffer before payday</dt><dd>" + money(e.bufferBefore) + "</dd></div>" +
    "<div><dt>Your risk limit</dt><dd>" + pct(e.limit) + "</dd></div>" +
    "<div><dt>Estimated chance of running dry (next " + H + " weeks)</dt><dd>" + (e.risk === null ? na : pct(e.risk)) + "</dd></div>" +
    "<div><dt>Paycheck</dt><dd>" + money(e.pay) + "</dd></div></dl>";
  var limits = {
    limit_met: "<strong>The rule it had to meet:</strong> a chance of running dry within " + pct(e.limit) + ". Keel tried higher paychecks first and this was the first one that met it. " +
      "The file does not record whether higher amounts failed the limit or were above the starting cap, so we do not say which one stopped it.",
    floor: "<strong>The rule it had to meet:</strong> even a $0 paycheck left a " + pct(e.risk) + " chance of running dry, above your " + pct(e.limit) + " limit, so Keel paid nothing rather than risk an overdraft.",
    unknown: "<strong>The rule it had to meet:</strong> the risk estimate is not in the file, so we do not guess."
  };
  h += '<p class="note">' + limits[e.constraint] + "</p>";
  h += '<p class="note"><strong>If earnings fall unexpectedly:</strong> the paycheck for the week is already set, so the gap is drawn from the buffer. ' +
    "Next week Keel sees the smaller buffer and the weaker earnings, and may lower the paycheck to keep the risk within your limit. ";
  if (e.fellShort) h += "That happened here: take-home pay was " + money(e.net) + ", " + money(e.shortfall) + " under the low case. The buffer went from " + money(e.bufferBefore) + " to " + money(e.bufferAfter) +
    (e.nextPay === null ? "." : ", and next week's paycheck was " + money(e.nextPay) + " (" + (e.nextPay < e.pay ? "down " : e.nextPay > e.pay ? "up " : "no change") + (e.nextPay === e.pay ? "" : money(Math.abs(e.nextPay - e.pay))) + ").");
  else h += "This week take-home pay was " + money(e.net) + (e.lo === null ? "." : ", not below the low case.");
  h += "</p>";
  if (e.reason) h += '<p class="note"><strong>Keel’s note:</strong> ' + esc(e.reason) + "</p>";
  el.innerHTML = h;
}
document.getElementById("log").addEventListener("click", function (ev) {
  var b = ev.target.closest("button[data-why]");
  if (!b) return;
  whyWeek = parseInt(b.dataset.why, 10);
  render();
  jumpTo("why-h");
});

// Buffer recovery: replayed runs only (KeelRecovery). No projection beyond the replay, so no recovery dates are promised.
function renderRecovery() {
  var run = findRun(state.driver, state.scenario, state.risk), TOY = DATA.meta.model === "toy", NA = "Not in file";
  if (!run) return;
  var rec = KeelRecovery.bufferRecovery(run), rows = KeelRecovery.recoveryCompare(DATA, state.driver);
  var scen = function (id) { return NAMES[id] || id; };
  function status(r) {
    if (!r) return NA;
    if (r.status === "never_below") return "Never fell below target";
    if (r.status === "recovered") return r.weeksToRecover + " week" + (r.weeksToRecover === 1 ? "" : "s") + " (back by week " + r.recoveredWeek + ")";
    return "Not back by end of replay (" + r.weeks + " weeks)";
  }
  document.getElementById("recsub").textContent = (TOY ? "Toy sample, not our result. " : "Simulated driver " + state.driver + ", " + scen(state.scenario).toLowerCase() + ". ") +
    "How far the buffer fell and how fast it came back, in the historical replay.";
  var el = document.getElementById("recbody");
  if (!rec) { el.innerHTML = '<p class="note">This run is missing buffer data, so recovery cannot be shown.</p>'; }
  else el.innerHTML = "<dl class=\"recdl\">" +
    "<div><dt>Current buffer (end of replay)</dt><dd>" + money(rec.current) + "</dd></div>" +
    "<div><dt>Recovery target (starting buffer)</dt><dd>" + money(rec.target) + "</dd></div>" +
    "<div><dt>Lowest point</dt><dd>" + money(rec.lowest) + " · week " + rec.lowWeek + "</dd></div>" +
    "<div><dt>Time to recover</dt><dd>" + esc(status(rec)) + "</dd></div></dl>" +
    (rec.empty ? '<p class="note"><strong>The buffer ran empty</strong> in week ' + rec.lowWeek + " (" + money(rec.lowest) + "). Below zero means an overdraft in this simulation.</p>" : "");
  // Chart: the selected scenario under every risk limit, with the target as a flat line.
  var C = [css("--last"), css("--keel"), css("--avg4"), css("--crit")], same = DATA.runs.filter(function (r) { return r.driver === state.driver && r.scenario === state.scenario; })
    .sort(function (a, b) { return a.risk_limit - b.risk_limit; });
  var series = same.map(function (r, i) { return { name: "Limit " + pct(r.risk_limit), color: C[i % C.length], thin: Math.abs(r.risk_limit - state.risk) > 1e-9, values: r.weeks.map(function (w) { return w.buf_keel; }) }; });
  if (rec) series.push({ name: "Starting level", color: css("--muted"), dash: true, values: run.weeks.map(function () { return rec.target; }) });
  legend(document.getElementById("recleg"), series, false);
  lineChart(document.getElementById("recchart"), { dates: run.weeks.map(function (w) { return w.week_start; }), series: series, zero: true, stormWeeks: KeelData.stormWeeks(run, DATA.meta), endLabels: false, label: "Replayed buffer balance by week for each risk limit, with the recovery target." });
  document.getElementById("rectable").innerHTML = "<thead><tr><th>Scenario</th><th class=\"num\">Risk limit</th><th class=\"num\">Average paycheck</th><th class=\"num\">Lowest buffer</th><th>Time to recover</th></tr></thead><tbody>" +
    rows.map(function (x) {
      var cur = x.scenario === state.scenario && Math.abs(x.risk - state.risk) < 1e-9;
      return "<tr" + (cur ? ' aria-current="true"' : "") + "><td>" + esc(scen(x.scenario)) + "</td><td class=\"num\">" + pct(x.risk) + "</td><td class=\"num\">" + money(x.avgPay) +
        "</td><td class=\"num\">" + (x.rec ? money(x.rec.lowest) : NA) + "</td><td>" + esc(status(x.rec)) + "</td></tr>";
    }).join("") + "</tbody>";
  document.getElementById("recnote").innerHTML = "<strong>The tradeoff:</strong> a looser risk limit pays a higher paycheck, so less goes back into the buffer each week; it falls further in bad weeks and takes longer to refill. " +
    "<strong>What this is:</strong> historical replay of " + (TOY ? "toy" : "simulated") + " drivers on past weeks, using the paychecks Keel actually chose. It is not a forecast: no future earnings are projected and no recovery date is promised. Not financial or tax advice.";
}

// Policy benchmark (KeelBenchmark): held-out replay weeks from results.json. The only model ablation shown is the one
// calibration.json actually records (conformal calibration on vs off); nothing else is claimed.
var BM_INFO = {
  avgPay: ["Average paycheck", "What lands in the worker's account each week. Higher is better, but not at the cost of overdrafts.", true],
  paySwing: ["Paycheck swing", "Gap between the best and worst paycheck. Smaller means easier to budget rent and bills.", true],
  avgChange: ["Typical week-to-week change", "How much the paycheck usually moves from one week to the next. Smaller is steadier.", true],
  emptyWeeks: ["Weeks with an empty buffer", "Weeks the savings buffer went below zero, meaning an overdraft. Fewer is better.", false],
  lowestBuffer: ["Lowest buffer", "The worst balance the buffer reached. Higher means more cushion in a bad week.", true],
  shortfall: ["Total overdraft", "Dollars below zero, added up over all weeks. Shows how deep the shortfalls went.", true]
};
function renderBenchmark() {
  if (!DATA) return;
  var run = findRun(state.driver, state.scenario, state.risk), TOY = DATA.meta.model === "toy";
  if (!run) return;
  var rows = KeelBenchmark.benchmark(run), NA = "—";
  var fmt = function (id, v) { return v === null ? NA : id === "emptyWeeks" ? String(v) : money(v); };
  var verdict = function (r) {
    if (r.vsAvg4 === null || r.vsLast === null) return ["", "Not in file"];
    if (r.vsAvg4 === "better" && r.vsLast === "better") return ["better", "Better than both"];
    if (r.vsAvg4 === "worse" && r.vsLast === "worse") return ["worse", "Worse than both"];
    if (r.vsAvg4 === "tie" && r.vsLast === "tie") return ["", "Tie"];
    var w = r.vsAvg4 === "worse" ? "4-week average" : r.vsLast === "worse" ? "last week’s pay" : null;
    return w ? ["worse", "Worse than " + w] : ["better", "Better or tied"];
  };
  document.getElementById("bmsub").textContent = (TOY ? "Toy sample, not our result. " : "Real model, simulated driver " + state.driver + ". ") +
    "Policy benchmark on the held-out test weeks (" + run.weeks.length + " weeks, " + (NAMES[state.scenario] || state.scenario).toLowerCase() + ", " + pct(state.risk) + " limit). Same earnings, same starting buffer, three pay rules.";
  document.getElementById("bmtable").innerHTML = "<thead><tr><th>Metric</th><th class=\"num\">Keel</th><th class=\"num\">4-week average</th><th class=\"num\">Last week’s pay</th><th>Keel vs rules</th></tr></thead><tbody>" +
    rows.map(function (r) {
      var v = verdict(r), info = BM_INFO[r.id];
      return "<tr><td><strong>" + esc(info[0]) + "</strong><br><span class=\"note\">" + esc(info[1]) + "</span></td><td class=\"num\">" + fmt(r.id, r.keel) + "</td><td class=\"num\">" + fmt(r.id, r.avg4) +
        "</td><td class=\"num\">" + fmt(r.id, r.last) + '</td><td class="' + v[0] + '">' + esc(v[1]) + "</td></tr>";
    }).join("") + "</tbody>";
  var C = { keel: css("--keel"), avg4: css("--avg4"), last: css("--last") }, label = { keel: "Keel", avg4: "4-week average", last: "Last week’s pay" };
  legend(document.getElementById("bmleg"), KeelBenchmark.POLICIES.map(function (p) { return { name: label[p], color: C[p] }; }), false);
  document.getElementById("bmbars").innerHTML = rows.filter(function (r) { return r.id !== "lowestBuffer"; }).map(function (r) {
    var vals = KeelBenchmark.POLICIES.map(function (p) { return r[p]; }), max = Math.max.apply(null, vals.map(function (v) { return Math.abs(v || 0); }));
    return "<div><h4>" + esc(BM_INFO[r.id][0]) + (r.better === "higher" ? " (higher is better)" : " (lower is better)") + '</h4><div class="bars">' + KeelBenchmark.POLICIES.map(function (p) {
      var v = r[p], w = v === null || !max ? 0 : 100 * Math.abs(v) / max;
      return '<div class="row"><span>' + label[p] + '</span><span class="track" role="img" aria-label="' + esc(label[p] + ": " + fmt(r.id, v)) + '"><span class="fill" style="width:' + w + "%;background:" + C[p] + '"></span></span><span class="n">' + fmt(r.id, v) + "</span></div>";
    }).join("") + "</div></div>";
  }).join("");
  var t = KeelBenchmark.tally(DATA);
  document.getElementById("bmtally").innerHTML = KeelBenchmark.METRICS.map(function (m) {
    var x = t[m.id];
    return "<li><strong>" + esc(BM_INFO[m.id][0]) + ":</strong> Keel beat both rules in " + x.beatsBoth + " of " + x.runs + " runs and did worse than at least one in " + x.losesToOne + (x.missing ? " (" + x.missing + " runs missing this metric)" : "") + ".</li>";
  }).join("");
  var abl = document.getElementById("bmabl");
  if (CAL && typeof CAL.calibrated_hit_rate === "number" && typeof CAL.uncalibrated_hit_rate === "number")
    abl.textContent = (CAL.model === "toy" ? "Toy calibration file. " : "") + "Conformal calibration on vs off, from calibration.json: the low case was right in " + pct(CAL.calibrated_hit_rate) + " of " + (CAL.n_test_weeks || "the") + " test weeks with calibration and " + pct(CAL.uncalibrated_hit_rate) +
      " without (target " + pct(CAL.target_low_case) + "). This compares the forecast model, not the pay rule; details are in Forecast reliability. No other ablations were run, so none are shown.";
  else abl.textContent = "No ablation results in the files (calibration.json is missing or has no before/after hit rates), so none are shown.";
  document.getElementById("bmnote").textContent = (TOY ? "Toy data from the prototype simulation. " : "Simulated drivers on real NYC trip data. ") +
    "One replay per setting, so these are descriptive counts, not statistically tested differences. Average paycheck, swing and empty weeks are copied from the results file; the rest is arithmetic on its weekly values. Not financial or tax advice.";
}

// What-if: compares precomputed runs for the selected driver; the badge text says whether they are toy or real.
function renderWhatIf() {
  var rows = KeelData.whatIf(DATA, state.driver), TOY = DATA.meta.model === "toy";
  document.getElementById("whatifsub").textContent = (TOY ? "Toy sample, not our result. " : "Simulated drivers. ") +
    "Every scenario and risk limit for driver " + state.driver + ", read from the results file. Nothing is re-simulated in the browser. Pick a row to load it above.";
  var same = rows.filter(function (r) { return r.scenario === state.scenario; });
  var lo = same[0], hi = same[same.length - 1];
  document.getElementById("whatifsum").innerHTML = lo && hi && lo !== hi
    ? "<strong>" + esc(NAMES[state.scenario] || state.scenario) + ":</strong> moving the limit from " + pct(lo.risk) + " to " + pct(hi.risk) +
      " changes Keel’s average paycheck from " + money(lo.avgPay) + " to " + money(hi.avgPay) + " and its empty-buffer weeks from " + lo.emptyKeel + " to " + hi.emptyKeel + "."
    : "";
  var h = '<thead><tr><th>Scenario</th><th class="num">Risk limit</th><th class="num">Keel avg paycheck</th><th class="num">4-week avg paycheck</th>' +
    '<th class="num">Empty-buffer weeks: Keel / 4-week / last week</th><th class="num">Keel paycheck swing</th><th class="num">Earnings swing</th></tr></thead><tbody>';
  rows.forEach(function (r) {
    var cur = r.scenario === state.scenario && Math.abs(r.risk - state.risk) < 1e-9;
    h += '<tr' + (cur ? ' aria-current="true"' : "") + '><td><button type="button" class="link" data-sc="' + esc(r.scenario) + '" data-risk="' + r.risk + '">' + esc(NAMES[r.scenario] || r.scenario) + "</button></td>" +
      '<td class="num">' + pct(r.risk) + '</td><td class="num">' + money(r.avgPay) + '</td><td class="num">' + money(r.avgPayAvg4) + "</td>" +
      '<td class="num">' + r.emptyKeel + " / " + r.emptyAvg4 + " / " + r.emptyLast + " of " + r.weeks + '</td><td class="num">' + money(r.swing) + '</td><td class="num">' + money(r.earnSwing) + "</td></tr>";
  });
  document.getElementById("whatif").innerHTML = h + "</tbody>";
}
document.getElementById("whatif").addEventListener("click", function (e) {
  var b = e.target.closest("button[data-sc]");
  if (!b) return;
  state.risk = parseFloat(b.dataset.risk);
  document.getElementById("risk").value = String(state.risk);
  setScenario(b.dataset.sc);
});

// Fill the driver and risk menus from the file, so more drivers or limits need no app change.
function fillSelect(id, items, current) {
  var el = document.getElementById(id);
  el.innerHTML = items.map(function (it) { return '<option value="' + esc(it.value) + '"' + (it.value === current ? " selected" : "") + ">" + esc(it.label) + "</option>"; }).join("");
  return el.value;
}
function fillControls(d) {
  var o = KeelData.options(d);
  state.driver = fillSelect("driver", o.drivers.map(function (x) { return { value: String(x.id), label: x.label.replace(/^Driver\s+/, "") }; }),
    o.drivers.some(function (x) { return String(x.id) === state.driver; }) ? state.driver : String(o.drivers[0].id));
  var risk = o.risks.indexOf(state.risk) >= 0 ? state.risk : o.risks[0];
  state.risk = parseFloat(fillSelect("risk", o.risks.map(function (r, i) {
    return { value: String(r), label: pct(r) + (o.risks.length < 2 ? "" : i === 0 ? " · most cautious" : i === o.risks.length - 1 ? " · least cautious" : "") };
  }), String(risk)));
  if (o.scenarios.indexOf(state.scenario) < 0) state.scenario = o.scenarios[0];
  document.getElementById("sc-storm").disabled = o.scenarios.indexOf("storm") < 0;
  document.getElementById("sc-normal").disabled = o.scenarios.indexOf("normal") < 0;
}

function setScenarioButtons() {
  document.getElementById("sc-storm").setAttribute("aria-pressed", state.scenario === "storm");
  document.getElementById("sc-normal").setAttribute("aria-pressed", state.scenario === "normal");
}
function setScenario(s) {
  state.scenario = s; state.week = null; state.ran = false; // storm weeks differ by scenario, so pick the default payday again
  setScenarioButtons();
  render();
}
document.getElementById("driver").addEventListener("change", function (e) { state.driver = e.target.value; state.ran = false; render(); });
document.getElementById("risk").addEventListener("change", function (e) { state.risk = parseFloat(e.target.value); state.ran = false; render(); });
document.getElementById("tableview").addEventListener("change", function (e) { state.tables = e.target.checked; render(); });
document.getElementById("sc-storm").addEventListener("click", function () { setScenario("storm"); });
document.getElementById("sc-normal").addEventListener("click", function () { setScenario("normal"); });
// Views: Paycheck, Plan, Evidence. The hash is the source of truth so views can be linked and Back works.
var VIEWS = ["paycheck", "plan", "evidence"];
function jumpTo(id) {
  var h = document.getElementById(id);
  if (!h) return;
  h.setAttribute("tabindex", "-1");
  h.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
  h.focus({ preventScroll: true });
}
function showView(view, jumpId) {
  if (VIEWS.indexOf(view) < 0) view = VIEWS[0];
  var changed = view !== state.view;
  state.view = view;
  VIEWS.forEach(function (v) { document.getElementById("view-" + v).hidden = v !== view; });
  document.querySelectorAll(".nav a").forEach(function (a) {
    if (a.dataset.view === view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  if (location.hash.slice(1) !== view) history.pushState(null, "", "#" + view);
  if (changed) render(); // charts size themselves to the visible container
  if (jumpId) jumpTo(jumpId); else if (changed) window.scrollTo(0, 0);
}
window.addEventListener("hashchange", function () { showView(location.hash.slice(1)); });
window.addEventListener("popstate", function () { showView(location.hash.slice(1)); });
document.querySelector(".masthead").addEventListener("click", function (e) {
  var a = e.target.closest("a[data-view], a.brand");
  if (!a) return;
  e.preventDefault();
  showView(a.dataset.view || VIEWS[0]);
});
document.addEventListener("click", function (e) {
  var b = e.target.closest("button[data-jump]");
  if (b) jumpTo(b.dataset.jump);
});
var resizeTimer = null, lastWidth = window.innerWidth, RESIZE_DELAY_MS = 150;
window.addEventListener("resize", function () {
  if (window.innerWidth === lastWidth) return; // phones fire resize when the address bar hides
  lastWidth = window.innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(render, RESIZE_DELAY_MS);
});
if (window.matchMedia) { try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render); } catch (e) {} }
new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
KeelData.loadData(window.fetch.bind(window)).then(function (res) {
  var d = res.data;
  DATA = d; TAX = d.meta.tax_rate;
  fillControls(d);
  setScenarioButtons();
  // A broken real file must not hide behind the toy sample: say it was skipped.
  var broken = res.skipped.filter(function (x) { return !/HTTP 404/.test(x.reason); });
  if (broken.length) document.getElementById("loaderr").innerHTML = "<strong>Skipped:</strong> " + broken.map(function (x) { return esc(x.url + " (" + x.reason + ")"); }).join("; ") + ". Showing " + esc(res.url) + ".";
  document.getElementById("loaderr").classList.toggle("hidden", !broken.length);
  document.getElementById("badgetext").textContent = d.meta.model === "toy"
    ? "Toy data. Not our result."
    : "Simulated drivers · real NYC ride-hail data";
  document.getElementById("badge").classList.toggle("toy", d.meta.model === "toy");
  showView(location.hash.slice(1));
  render();
  renderLosses();
  fetch("../outputs/calibration.json", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; })
    .then(renderCalib);
}).catch(function (e) {
  document.getElementById("badgetext").textContent = "No results file loaded";
  document.getElementById("badge").classList.add("toy");
  var why = (e.skipped || []).map(function (x) { return "<li>" + esc(x.url + ": " + x.reason) + "</li>"; }).join("");
  document.querySelector(".controls").classList.add("hidden");
  document.getElementById("main").innerHTML = '<div class="failed" role="alert"><h2>The simulation results could not be loaded</h2>' +
    '<p class="note">Keel reads <code>outputs/results.json</code>, so the page has to be served over HTTP. From the repo root run <code>python3 -m http.server 8000</code>, then open <code>http://localhost:8000/</code>.</p>' +
    (why ? '<ul class="plain">' + why + "</ul>" : "") + "</div>";
});
