// Line chart and legend for the Keel app. Uses money(), pct(), css(), esc() and NS from ui.js at draw time.
"use strict";
function niceTicks(min, max) {
  var span = Math.max(max - min, 1), raw = span / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
  var step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  var start = Math.floor(min / step) * step, out = [];
  for (var v = start; ; v += step) { out.push(Math.round(v * 1e6) / 1e6); if (v >= max) break; }
  return out;
}

// "2025-10-20" -> "Oct 20". Empty string if the date is missing, so callers can fall back to week numbers.
function fmtDate(iso, opts) {
  if (!iso) return "";
  var d = new Date(iso + "T00:00:00Z");
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", Object.assign({ month: "short", day: "numeric", timeZone: "UTC" }, opts));
}
function reducedMotion() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

// One chart grammar for the whole app: solid line = replayed actuals, shaded band with dashed edges = forecast made
// before the week, dashed line = a comparison (another rule or scenario). Drawn at the container's real pixel width so
// labels stay readable on phones.
// cfg: {series:[{name,short,color,values,dash,thin}], band:{lo,hi}|null, zero, stormWeeks, dates:[iso], now:week, label, endLabels}
var CHART_FALLBACK_WIDTH = 720, CHART_MAX_WIDTH = 1100, CHART_SMALL = 520;
function lineChart(el, cfg) {
  var W = Math.max(300, Math.min(el.clientWidth || CHART_FALLBACK_WIDTH, CHART_MAX_WIDTH)), small = W < CHART_SMALL, H = small ? 240 : 300;
  var ends = cfg.endLabels && !small, m = { l: 54, r: ends ? 116 : 14, t: 20, b: 30 };
  var n = cfg.series[0].values.length, all = [];
  cfg.series.forEach(function (s) { all = all.concat(s.values); });
  if (cfg.band) all = all.concat(cfg.band.lo, cfg.band.hi);
  var ticks = niceTicks(Math.min.apply(null, all.concat(cfg.zero ? [0] : [])), Math.max.apply(null, all));
  var y0 = ticks[0], y1 = ticks[ticks.length - 1], step = (W - m.l - m.r) / (n - 1);
  var X = function (i) { return m.l + i * step; };
  var Y = function (v) { return m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b); };
  var weekLabel = function (i) { return (cfg.dates && fmtDate(cfg.dates[i])) || "W" + (i + 1); };
  var surface = css("--surface"), grid = css("--grid"), axis = css("--axis"), muted = css("--muted"), ink = css("--ink"), ink2 = css("--ink2"), keel = css("--keel"), crit = css("--crit");
  var g = "";
  ticks.forEach(function (v) {
    g += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + (v === 0 && cfg.zero ? axis : grid) + '" stroke-width="1"/>';
    g += '<text x="' + (m.l - 10) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="12" fill="' + muted + '">' + money(v) + '</text>';
  });
  var every = Math.max(1, Math.ceil(n / (small ? 4 : 6)));
  for (var i = 0; i < n; i += every) {
    g += '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="' + (i === 0 ? "start" : !ends && i === n - 1 ? "end" : "middle") + '" font-size="12" fill="' + muted + '">' + esc(weekLabel(i)) + '</text>';
  }
  if (cfg.zero && y0 < 0) {
    g += '<rect x="' + m.l + '" y="' + Y(0) + '" width="' + (W - m.l - m.r) + '" height="' + (Y(y0) - Y(0)) + '" fill="' + crit + '" opacity="0.07"/>';
    g += '<text x="' + (m.l + 8) + '" y="' + (Y(y0) - 8) + '" font-size="12" fill="' + crit + '">Overdraft</text>';
  }
  (cfg.stormWeeks || []).forEach(function (w, k) {
    g += '<rect x="' + (X(w - 1) - step / 2) + '" y="' + m.t + '" width="' + step + '" height="' + (H - m.t - m.b) + '" fill="' + ink2 + '" opacity="0.08"/>';
    if (k === 0) g += '<text x="' + X(w - 1) + '" y="' + (m.t - 6) + '" text-anchor="middle" font-size="12" fill="' + ink2 + '">Snowstorm stress test</text>';
  });
  if (cfg.band) {
    var up = cfg.band.hi.map(function (v, i) { return X(i) + "," + Y(v); }), dn = cfg.band.lo.map(function (v, i) { return X(i) + "," + Y(v); });
    g += '<polygon points="' + up.join(" ") + " " + dn.slice().reverse().join(" ") + '" fill="' + keel + '" opacity="0.10"/>';
    [up, dn].forEach(function (edge) { g += '<polyline points="' + edge.join(" ") + '" fill="none" stroke="' + keel + '" stroke-width="1" stroke-dasharray="2 4" opacity="0.6"/>'; });
  }
  if (cfg.now >= 1 && cfg.now <= n) g += '<line x1="' + X(cfg.now - 1) + '" x2="' + X(cfg.now - 1) + '" y1="' + m.t + '" y2="' + (H - m.b) + '" stroke="' + ink + '" stroke-width="1" stroke-dasharray="3 3"/>';
  cfg.series.forEach(function (s) {
    var pts = s.values.map(function (v, i) { return X(i) + "," + Y(v); }).join(" ");
    g += '<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.thin || s.dash ? 1.5 : 2.5) + '"' + (s.dash ? ' stroke-dasharray="6 5"' : "") + ' stroke-linejoin="round" stroke-linecap="round"/>';
  });
  var showEnds = ends;
  if (showEnds && cfg.series.length > 1) {
    var ys = cfg.series.map(function (s) { return Y(s.values[n - 1]); }).sort(function (a, b) { return a - b; });
    for (var k = 1; k < ys.length; k++) if (ys[k] - ys[k - 1] < 16) showEnds = false;
  }
  cfg.series.forEach(function (s) {
    var yy = Y(s.values[n - 1]);
    if (!s.dash) g += '<circle cx="' + X(n - 1) + '" cy="' + yy + '" r="4" fill="' + s.color + '" stroke="' + surface + '" stroke-width="2"/>';
    if (showEnds) g += '<text x="' + (X(n - 1) + 10) + '" y="' + (yy + 4) + '" font-size="12" fill="' + ink2 + '">' + esc(s.short || s.name) + " " + money(s.values[n - 1]) + "</text>";
  });
  g += '<g class="cross" style="display:none"><line y1="' + m.t + '" y2="' + (H - m.b) + '" stroke="' + axis + '" stroke-width="1"/></g>';
  el.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" tabindex="0" role="group" aria-label="' + esc(cfg.label) + ' Use the left and right arrow keys to read each week.">' + g + '</svg><div class="tip" role="status"></div>';
  var svg = el.querySelector("svg"), tip = el.querySelector(".tip"), cross = svg.querySelector(".cross"), dots = [];
  cfg.series.forEach(function (s) {
    var c = document.createElementNS(NS, "circle");
    c.setAttribute("r", 4); c.setAttribute("fill", s.color); c.setAttribute("stroke", surface); c.setAttribute("stroke-width", 2); c.style.display = "none";
    svg.appendChild(c); dots.push(c);
  });
  var cur = n - 1;
  function show(i) {
    i = Math.max(0, Math.min(n - 1, i)); cur = i;
    var x = X(i), line = cross.firstChild, date = cfg.dates && fmtDate(cfg.dates[i]);
    line.setAttribute("x1", x); line.setAttribute("x2", x); cross.style.display = "";
    var html = "<b>Week " + (i + 1) + (date ? " · week of " + esc(date) : "") + "</b>";
    cfg.series.forEach(function (s, k) {
      dots[k].setAttribute("cx", x); dots[k].setAttribute("cy", Y(s.values[i])); dots[k].style.display = "";
      html += '<div><span><span class="dot" style="background:' + s.color + '"></span>' + esc(s.short || s.name) + '</span><span class="n">' + money(s.values[i]) + "</span></div>";
    });
    if (cfg.band) html += '<div><span>Forecast range</span><span class="n">' + money(cfg.band.lo[i]) + "–" + money(cfg.band.hi[i]) + "</span></div>";
    if ((cfg.stormWeeks || []).indexOf(i + 1) >= 0) html += "<div><span>Snowstorm stress test week</span></div>";
    tip.innerHTML = html; tip.style.display = "block";
    var pxl = x / W * 100; tip.style.left = pxl > 55 ? "auto" : "calc(" + pxl + "% + 12px)"; tip.style.right = pxl > 55 ? "calc(" + (100 - pxl) + "% + 12px)" : "auto";
  }
  function hide() { cross.style.display = "none"; tip.style.display = "none"; dots.forEach(function (d) { d.style.display = "none"; }); }
  function at(e) { var r = svg.getBoundingClientRect(); show(Math.round(((e.clientX - r.left) / r.width * W - m.l) / step)); }
  svg.addEventListener("pointermove", at);
  svg.addEventListener("pointerdown", at);
  svg.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") hide(); });
  svg.addEventListener("blur", hide);
  svg.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { show(cur + 1); e.preventDefault(); }
    if (e.key === "ArrowLeft") { show(cur - 1); e.preventDefault(); }
    if (e.key === "Escape") hide();
  });
}

// items: [{name, color, dash}]. band adds the forecast-range swatch, now adds the selected-payday marker.
function legend(el, items, band, now) {
  el.innerHTML = items.map(function (s) { return '<span><i class="key' + (s.dash ? " dash" : "") + '" style="border-color:' + s.color + '"></i>' + esc(s.name) + "</span>"; }).join("") +
    (band ? '<span><i class="swatch band"></i>' + (DATA && DATA.meta.model === "toy" ? "Forecast range (toy: mean ± 1.28 spread)" : "Forecast range, made before each week") + '</span>' : "") +
    (now ? '<span><i class="key dash" style="border-color:' + css("--ink") + '"></i>Selected payday</span>' : "");
}
