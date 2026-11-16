// Keel homepage: draws the hero and the proof sections from outputs/results.json (CONTRACT.md) via data.js.
// Every number on the page is read from that file or is plain arithmetic on it. Nothing is simulated in the browser.
"use strict";
(function (root) {
  // The run the homepage tells its story with. Named in the caption so it is not mistaken for every driver.
  var HERO = { driver: "C", scenario: "normal", risk: 0.05 };
  var STORM = { driver: "C", scenario: "storm", risk: 0.05 };
  var SOURCES = ["outputs/results.json", "outputs/sample/results.json"]; // relative to the repo root, where this page lives
  var CALIBRATION = "outputs/calibration.json";

  // SVG path through pts ([[x, y], ...]). k = 0 gives straight segments, k = 1 a monotone cubic (Fritsch-Carlson),
  // which never overshoots the data, so the smooth paycheck line passes through every real value and invents none.
  function smoothPath(pts, k) {
    var n = pts.length;
    if (!n) return "";
    if (n < 3 || !k) return "M" + pts.map(function (p) { return p[0] + "," + p[1]; }).join("L");
    var d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
    m.push(d[0]);
    for (i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
    m.push(d[n - 2]);
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      var a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { var t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    var out = "M" + pts[0][0] + "," + pts[0][1];
    for (i = 0; i < n - 1; i++) {
      var h = (pts[i + 1][0] - pts[i][0]) / 3 * k;
      out += "C" + (pts[i][0] + h) + "," + (pts[i][1] + h * m[i]) + " " + (pts[i + 1][0] - h) + "," + (pts[i + 1][1] - h * m[i + 1]) + " " + pts[i + 1][0] + "," + pts[i + 1][1];
    }
    return out;
  }

  // How often, and by how much, Keel paid less on average than the 4-week-average rule, across every run in the file.
  function payCost(data) {
    var gaps = data.runs.map(function (r) { return r.metrics.avg_pay.avg4 - r.metrics.avg_pay.keel; });
    var lower = gaps.filter(function (g) { return g > 0; });
    return { runs: gaps.length, lower: lower.length, min: lower.length ? Math.min.apply(null, lower) : null, max: lower.length ? Math.max.apply(null, lower) : null };
  }

  var api = { smoothPath: smoothPath, payCost: payCost, HERO: HERO, STORM: STORM };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  // ---- Page ----
  var K = root.KeelData, P = root.KeelPaycheck;
  var $ = function (id) { return document.getElementById(id); };
  function money(n) { var r = Math.round(n); return (r < 0 ? "−$" : "$") + Math.abs(r).toLocaleString("en-US"); }
  function pct(n) { return Math.round(n * 100) + "%"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmtDate(iso, opts) {
    var d = iso ? new Date(iso + "T00:00:00Z") : null;
    return d && !isNaN(d.getTime()) ? d.toLocaleDateString("en-US", Object.assign({ month: "short", day: "numeric", timeZone: "UTC" }, opts)) : "";
  }
  var reduced = function () { return root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches; };
  var css = function (v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); };
  var ease = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  var DRAW_MS = 900, MORPH_MS = 1500, HOLD_MS = 250;
  var frame = null;

  // The hero chart. Motion: the earnings line draws in, then a teal copy of it settles into the Keel paycheck,
  // so the viewer watches the same weeks go from jagged to steady. Reduced motion shows the end state at once.
  function drawHero(run, animate) {
    var el = $("heroplot"), ws = run.weeks, n = ws.length;
    var W = Math.max(300, Math.min(el.clientWidth || 1000, 1112)), H = W < 560 ? 250 : 400;
    var m = { l: 50, r: 16, t: 16, b: 30 }, net = ws.map(function (w) { return w.net; }), pay = ws.map(function (w) { return w.pay_keel; });
    var top = Math.max.apply(null, net.concat(pay)), stepY = top > 1200 ? 500 : top > 500 ? 200 : 100;
    var yMax = Math.ceil(top / stepY) * stepY * 1.04;
    var X = function (i) { return m.l + i * (W - m.l - m.r) / (n - 1); }, Y = function (v) { return m.t + (1 - v / yMax) * (H - m.t - m.b); };
    var pts = function (vals) { return vals.map(function (v, i) { return [X(i), Y(v)]; }); };
    var line = css("--navy-line"), dim = css("--on-navy-3"), teal = css("--teal"), g = "";
    for (var v = 0; v <= top; v += stepY) {
      g += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + line + '"/>' +
        '<text x="' + (m.l - 10) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="12" fill="' + dim + '">' + money(v) + "</text>";
    }
    var every = Math.max(1, Math.ceil(n / (W < 560 ? 4 : 6)));
    for (var i = 0; i < n; i += every) g += '<text x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? "start" : i === n - 1 ? "end" : "middle") + '" font-size="12" fill="' + dim + '">' + esc(fmtDate(ws[i].week_start) || "W" + (i + 1)) + "</text>";
    g += '<path id="h-area" fill="' + teal + '" opacity="0"/>' +
      '<path id="h-earn" d="' + smoothPath(pts(net), 0) + '" fill="none" stroke="' + dim + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path id="h-keel" fill="none" stroke="' + teal + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle id="h-dot" r="5" fill="' + teal + '" stroke="' + css("--navy-2") + '" stroke-width="2.5" cx="' + X(n - 1) + '"/>';
    var M = run.metrics;
    el.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc("Weekly earnings after tax moved by " + money(M.earnings_swing) + " between the best and worst of " + n + " weeks; the Keel paycheck moved by " + money(M.pay_swing.keel) + ".") + '">' + g + "</svg>";
    var earn = el.querySelector("#h-earn"), keel = el.querySelector("#h-keel"), area = el.querySelector("#h-area"), dot = el.querySelector("#h-dot");
    function set(t) { // t: 0 = the teal line sits on the earnings line, 1 = it is the Keel paycheck
      var vals = net.map(function (a, i) { return a + (pay[i] - a) * t; }), d = smoothPath(pts(vals), t);
      keel.setAttribute("d", d);
      area.setAttribute("d", d + "L" + X(n - 1) + "," + Y(0) + "L" + X(0) + "," + Y(0) + "Z");
      area.setAttribute("opacity", .09 * t);
      dot.setAttribute("cy", Y(vals[n - 1]));
    }
    function cards() { ["paycard", "bufcard"].forEach(function (id) { $(id).hidden = false; $(id).classList.add("in"); }); $("replay").hidden = reduced(); }
    cancelAnimationFrame(frame);
    if (!animate || reduced()) { set(1); cards(); return; }
    ["paycard", "bufcard"].forEach(function (id) { $(id).hidden = true; $(id).classList.remove("in"); });
    var len = earn.getTotalLength(), start = null;
    earn.style.strokeDasharray = len; keel.style.opacity = 0; dot.style.opacity = 0;
    (function tick(now) {
      if (start === null) start = now;
      var e = now - start, a = Math.min(1, e / DRAW_MS), b = Math.min(1, Math.max(0, (e - DRAW_MS - HOLD_MS) / MORPH_MS));
      earn.style.strokeDashoffset = len * (1 - ease(a));
      if (e >= DRAW_MS) { keel.style.opacity = 1; dot.style.opacity = 1; set(ease(b)); }
      if (b < 1) frame = requestAnimationFrame(tick); else cards();
    })(performance.now());
  }

  function fillCards(run) {
    var s = P.paycheckSummary(run, run.weeks.length), H = run.weeks.length;
    if (!s) return;
    var fit = s.status === "within" ? ['ok', "On track. About a " + pct(s.risk) + " chance the buffer runs out; the limit is " + pct(s.limit) + "."]
      : s.status === "over" ? ["ok warn", "Above the limit: about a " + pct(s.risk) + " chance the buffer runs out; the limit is " + pct(s.limit) + "."]
      : ["ok warn", "No risk estimate in the file for this week."];
    $("paycard").innerHTML = '<div class="lab">Simulated paycheck · week ' + s.week + '</div><div class="amt">' + money(s.pay) + "</div>" +
      '<div class="when">Payday <b>' + esc(s.payday ? fmtDate(s.payday, { weekday: "short" }) : "Friday") + '</b></div><div class="' + fit[0] + '">' + fit[1] + "</div>";
    var bufs = run.weeks.map(function (w) { return w.buf_keel; }), peak = Math.max.apply(null, bufs.map(Math.abs).concat(1)), empty = run.metrics.overdraft_weeks.keel;
    $("bufcard").innerHTML = '<div class="lab"><span>Buffer after payday</span><b>' + money(s.bufferAfter) + '</b></div><div class="bufbars" role="img" aria-label="Buffer balance for each of ' + H + ' weeks">' +
      bufs.map(function (b, i) { return '<i style="--i:' + i + ";height:" + Math.max(4, Math.abs(b) / peak * 100) + '%"' + (b < 0 ? ' class="neg"' : "") + "></i>"; }).join("") +
      '</div><div class="foot2">' + (empty === 0 ? "Never ran out in " + H + " weeks" : "Ran out in " + empty + " of " + H + " weeks") + "</div>";
  }

  function fillProof(run, cal) {
    var M = run.metrics, n = run.weeks.length, cut = 1 - M.pay_swing.keel / M.earnings_swing;
    var figs = [
      [cut > 0 ? pct(cut) + "<small>less swing</small>" : money(M.pay_swing.keel), "The paycheck moved " + money(M.pay_swing.keel) + ". Earnings moved " + money(M.earnings_swing) + ".", "Best week to worst week, same " + n + " weeks."],
      [M.overdraft_weeks.keel + "<small>of " + n + " weeks</small>", "Weeks the buffer ran out", M.overdraft_weeks.avg4 + " when paying the 4-week average, " + M.overdraft_weeks.last + " when paying last week’s earnings."]
    ];
    if (cal && typeof cal.calibrated_hit_rate === "number") figs.push([pct(cal.calibrated_hit_rate), "of weeks came in at or above the forecast low",
      (typeof cal.target_low_case === "number" ? "Target " + pct(cal.target_low_case) + ". " : "") + (cal.n_test_weeks ? cal.n_test_weeks + " held-out weeks, all drivers. " : "") + (typeof cal.uncalibrated_hit_rate === "number" ? pct(cal.uncalibrated_hit_rate) + " before calibration." : "")]);
    else figs.push([money(M.avg_pay.keel) + "<small>a week</small>", "Average Keel paycheck", money(M.avg_pay.avg4) + " when paying the 4-week average."]);
    $("figures").innerHTML = figs.map(function (f) { return '<div class="fig"><div class="n">' + f[0] + '</div><p class="what">' + esc(f[1]) + '</p><p class="vs">' + esc(f[2]) + "</p></div>"; }).join("");
  }

  function fillStorm(data) {
    var run = K.findRun(data, STORM.driver, STORM.scenario, STORM.risk), sec = $("storm");
    var week = run && K.stormWeeks(run, data.meta)[0], b = week ? K.paycheckBreakdown(run, week) : null;
    if (!b || b.gross === null || b.bufferChange === null) { sec.hidden = true; return; }
    var draw = b.flow === "draw" ? -b.bufferChange : 0, save = b.flow === "replenish" ? b.bufferChange : 0, total = b.gross + draw;
    var seg = function (cls, v) { return v > 0 ? '<span class="' + cls + '" style="width:' + 100 * v / total + '%">' + (v / total > .13 ? money(v) : "") + "</span>" : ""; };
    $("stormcopy").innerHTML = draw
      ? "In week " + b.week + " of the stress test, this simulated driver took home <strong>" + money(b.net) + "</strong> after tax. Keel had already set the paycheck at <strong>" + money(b.pay) + "</strong>, and paid it. The buffer covered the <strong>" + money(draw) + "</strong> gap."
      : "In week " + b.week + " of the stress test, this simulated driver took home <strong>" + money(b.net) + "</strong> after tax and Keel paid <strong>" + money(b.pay) + "</strong>.";
    $("stormfine").textContent = "Simulated driver " + STORM.driver + ", " + pct(STORM.risk) + " risk limit." + (data.meta.storm ? " The stress test: " + data.meta.storm + "." : "");
    $("stormflow").innerHTML = '<div class="row"><span class="lab">Money in</span><div class="bar">' + seg("earn", b.gross) + seg("draw", draw) + "</div></div>" +
      '<div class="row"><span class="lab">Money out</span><div class="bar">' + seg("pay", b.pay) + seg("tax", b.tax) + seg("save", save) + "</div></div><dl>" +
      '<div><dt><i class="earn"></i>Earned, before tax</dt><dd>' + money(b.gross) + "</dd></div>" +
      (draw ? '<div><dt><i class="draw"></i>From the buffer</dt><dd>' + money(draw) + "</dd></div>" : '<div><dt><i class="save"></i>To the buffer</dt><dd>' + money(save) + "</dd></div>") +
      '<div><dt><i class="pay"></i>Paycheck paid</dt><dd>' + money(b.pay) + "</dd></div></dl>";
  }

  function fillHonest(data, run) {
    var c = payCost(data), M = run.metrics, gap = M.avg_pay.avg4 - M.avg_pay.keel, n = run.weeks.length;
    $("honestcopy").textContent = (gap > 0 ? "For this driver, Keel paid " + money(gap) + " a week less on average than simply paying the 4-week average. " : "") +
      (c.lower ? "Across all " + c.runs + " runs in the results file it paid less in " + c.lower + ", by " + money(c.min) + " to " + money(c.max) + " a week. " : "") +
      "That is the price of a buffer that ran out in " + M.overdraft_weeks.keel + " of " + n + " weeks instead of " + M.overdraft_weeks.avg4 + ". Every case where Keel did worse than a simple rule is listed in the app.";
  }

  var resizeTimer = null, lastWidth = root.innerWidth;
  K.loadData(root.fetch.bind(root), SOURCES).then(function (res) {
    var data = res.data, toy = data.meta.model === "toy";
    var run = K.findRun(data, HERO.driver, HERO.scenario, HERO.risk) || data.runs[0];
    $("datalabel").textContent = toy ? "Toy data. Not our result." : "Simulation · simulated drivers on real NYC ride-hail data";
    $("herocap").textContent = (toy ? "Toy sample, not our result. " : "") + "Simulated " + (run.driver_label || "driver " + run.driver).replace(/^Driver/, "driver") + ". " + run.weeks.length +
      " held-out weeks" + (run.weeks[0].week_start ? " from " + fmtDate(run.weeks[0].week_start, { year: "numeric" }) : "") + ", " + (run.scenario === "storm" ? "snowstorm stress test" : "normal weeks") + ", " + pct(run.risk_limit) +
      " risk limit. The smooth line passes through every weekly paycheck in the results file. No real money moved.";
    $("proofsub").textContent = "The same simulated driver and weeks as the chart above, read from the results file.";
    fillCards(run);
    drawHero(run, true);
    $("replay").addEventListener("click", function () { drawHero(run, true); });
    root.addEventListener("resize", function () {
      if (root.innerWidth === lastWidth) return;
      lastWidth = root.innerWidth; clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { drawHero(run, false); }, 150);
    });
    fillStorm(data);
    fillHonest(data, run);
    fillProof(run, null);
    document.querySelectorAll("[data-needs-data]").forEach(function (el) { el.hidden = false; });
    return root.fetch(CALIBRATION, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (cal) { fillProof(run, cal); });
  }).catch(function () {
    $("datalabel").textContent = "Simulation";
    $("herowait").innerHTML = 'The simulation results could not be loaded. Serve the repo root over HTTP (<code>python3 -m http.server</code>), or <a href="app/">open the app</a>.';
  });
})(this);
