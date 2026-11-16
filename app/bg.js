// Keel "currents" background. Decorative only: it never reads or shows a number.
// Any element with data-currents="dark" or data-currents="light" gets a canvas behind its content:
// uneven current lines drifting across the area (the volatile weeks) with one level teal line (the keel)
// through the middle. The lines bend gently away from the pointer.
// The animation pauses when the area is off screen or the tab is hidden. With reduced motion, it draws one still frame.
"use strict";
(function (root) {
  var doc = root.document;
  if (!doc || !root.HTMLCanvasElement) return;
  var reduced = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function Currents(host) {
    var mode = host.getAttribute("data-currents") || "dark";
    var c = doc.createElement("canvas");
    c.className = "currents";
    c.setAttribute("aria-hidden", "true");
    host.insertBefore(c, host.firstChild);
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.style.isolation = "isolate";
    var ctx = c.getContext("2d"), w = 0, h = 0, dpr = 1, t0 = root.performance.now(), raf = null, visible = true;
    var px = -9999, py = -9999, tx = -9999, ty = -9999;
    var lines = mode === "light" ? 9 : 14;
    var line = mode === "light" ? "10,109,101" : "102,215,190";
    var base = mode === "light" ? 0.10 : 0.16;
    var seeds = [];
    for (var i = 0; i < lines; i++) seeds.push({ a: 0.6 + Math.random() * 0.8, f: 0.6 + Math.random() * 1.4, p: Math.random() * 6.28, s: 0.25 + Math.random() * 0.5 });
    var dots = [];
    for (var k = 0; k < (mode === "light" ? 18 : 36); k++) dots.push({ x: Math.random(), y: Math.random(), v: 0.004 + Math.random() * 0.01, r: 0.6 + Math.random() * 1.4 });

    function size() {
      var r = host.getBoundingClientRect();
      dpr = Math.min(2, root.devicePixelRatio || 1);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!raf) draw(root.performance.now());
    }

    function draw(now) {
      var t = (now - t0) / 1000;
      px += (tx - px) * 0.08; py += (ty - py) * 0.08;
      ctx.clearRect(0, 0, w, h);
      var mid = h * (parseFloat(host.getAttribute("data-keel")) || 0.56), step = Math.max(10, w / 90);
      for (var i = 0; i < lines; i++) {
        var sd = seeds[i], y0 = h * (0.12 + 0.8 * i / (lines - 1));
        var amp = h * 0.035 * sd.a * (1 + Math.abs(y0 - mid) / h * 2.2); // calmer near the keel line
        ctx.beginPath();
        for (var x = -step; x <= w + step; x += step) {
          var u = x / w;
          var y = y0 + amp * (Math.sin(u * 6.28 * sd.f + t * sd.s + sd.p) + 0.5 * Math.sin(u * 17 * sd.f - t * sd.s * 1.7 + sd.p * 2));
          var dx = x - px, dy = y - py, d2 = dx * dx + dy * dy, R = 140;
          if (d2 < R * R * 4) y += (dy >= 0 ? 1 : -1) * 26 * Math.exp(-d2 / (R * R));
          if (x === -step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        var fade = 1 - Math.min(1, Math.abs(y0 - mid) / (h * 0.6));
        ctx.strokeStyle = "rgba(" + line + "," + (base * (0.45 + 0.55 * fade)).toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // The keel: one level line, a soft glow traveling along it.
      var g = ctx.createLinearGradient(0, 0, w, 0), sweep = (t * 0.08) % 1.4 - 0.2;
      g.addColorStop(0, "rgba(" + line + ",0.05)");
      g.addColorStop(Math.max(0, Math.min(1, sweep)), "rgba(" + line + "," + (mode === "light" ? 0.45 : 0.7) + ")");
      g.addColorStop(1, "rgba(" + line + ",0.05)");
      ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid);
      ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.stroke();
      // Drifting particles (payouts flowing toward the buffer).
      ctx.fillStyle = "rgba(" + line + "," + (mode === "light" ? 0.25 : 0.45) + ")";
      dots.forEach(function (p) {
        var x = ((p.x + t * p.v) % 1) * w, y = p.y * h + Math.sin(t * 0.7 + p.x * 9) * 6;
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
      });
      raf = null;
      if (!reduced && visible && !doc.hidden) raf = root.requestAnimationFrame(draw);
    }
    function wake() { if (!raf && !reduced && visible && !doc.hidden) raf = root.requestAnimationFrame(draw); }

    host.addEventListener("pointermove", function (e) { var r = host.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top; });
    host.addEventListener("pointerleave", function () { tx = -9999; ty = -9999; });
    if (root.ResizeObserver) new ResizeObserver(size).observe(host); else root.addEventListener("resize", size);
    if (root.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; wake(); }).observe(host);
    doc.addEventListener("visibilitychange", wake);
    size();
    wake();
  }

  function init() { [].forEach.call(doc.querySelectorAll("[data-currents]"), function (el) { if (!el.__currents) { el.__currents = true; Currents(el); } }); }
  root.KeelCurrents = { init: init };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
})(window);
