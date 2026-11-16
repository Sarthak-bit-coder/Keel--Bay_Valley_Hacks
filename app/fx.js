// Keel interaction layer, shared by the homepage, the simulation and My pay. Presentation only: it never computes
// or changes a number. Without script, or under reduced motion, every element is shown at rest.
//   [data-fx]       section whose children enter in a stagger when it scrolls into view
//   [data-fx-item]  marks the children to stagger (default: the section's direct children)
//   [data-count]    a figure that counts up to its rendered text when first seen
//   [data-tilt]     a panel that leans toward a fine pointer
//   [data-magnet]   a button that follows a fine pointer a few pixels
//   [data-shutter]  a picture that opens from the left edge once
//   .ticker         a strip whose track loops sideways (content is duplicated, the copy is aria-hidden)
"use strict";
(function (root) {
  var doc = root.document, html = doc.documentElement;
  var reduced = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = root.matchMedia && root.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var STAGGER_MS = 70, MAX_STAGGER = 8, TILT_DEG = 3.5, MAGNET_PX = 6, COUNT_MS = 900;
  var REVEAL_MARGIN = "0px 0px -12% 0px";
  if (reduced) return;
  html.classList.add("fx");

  function onSight(els, cb) {
    if (!("IntersectionObserver" in root)) { els.forEach(cb); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); cb(e.target); } });
    }, { rootMargin: REVEAL_MARGIN });
    els.forEach(function (el) { io.observe(el); });
  }
  var all = function (sel, scope) { return [].slice.call((scope || doc).querySelectorAll(sel)); };

  // Staggered entrances: the heading, then the text, then the picture.
  function reveals(scope) {
    var secs = all("[data-fx]:not(.fx-armed)", scope);
    secs.forEach(function (sec) {
      sec.classList.add("fx-armed");
      var items = all("[data-fx-item]", sec);
      if (!items.length) items = [].slice.call(sec.children);
      items.forEach(function (it, i) { it.classList.add("fx-item"); it.style.setProperty("--fx-d", Math.min(i, MAX_STAGGER) * STAGGER_MS + "ms"); });
    });
    onSight(secs, function (sec) { sec.classList.add("fx-in"); all("[data-count]", sec).forEach(countUp); });
  }

  // Count-up to the text already on the page; the final frame is always that exact text.
  function countUp(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = "1";
    var node = el.firstChild;
    if (!node || node.nodeType !== 3) return;
    var finalText = node.nodeValue, m = /^([^\d]*?)([\d,]+(?:\.\d+)?)(.*)$/.exec(finalText.trim());
    if (!m) return;
    var target = parseFloat(m[2].replace(/,/g, "")), dec = (m[2].split(".")[1] || "").length, start = null;
    el.setAttribute("aria-hidden", "true");
    (function tick(now) {
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / COUNT_MS), v = target * (1 - Math.pow(1 - t, 4));
      node.nodeValue = t < 1 ? m[1] + v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[3] : finalText;
      if (t < 1) root.requestAnimationFrame(tick); else el.removeAttribute("aria-hidden");
    })(root.performance.now());
  }

  function tilt(el) {
    if (el.dataset.tiltOn) return;
    el.dataset.tiltOn = "1";
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.setProperty("--rx", (-y * TILT_DEG).toFixed(2) + "deg");
      el.style.setProperty("--ry", (x * TILT_DEG).toFixed(2) + "deg");
    });
    el.addEventListener("pointerleave", function () { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
  }

  function magnet(el) {
    if (el.dataset.magnetOn) return;
    el.dataset.magnetOn = "1";
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (((e.clientX - r.left) / r.width - .5) * MAGNET_PX * 2).toFixed(1) + "px");
      el.style.setProperty("--my", (((e.clientY - r.top) / r.height - .5) * MAGNET_PX * 2).toFixed(1) + "px");
    });
    el.addEventListener("pointerleave", function () { el.style.setProperty("--mx", "0px"); el.style.setProperty("--my", "0px"); });
  }

  function tickers() {
    all(".ticker-track:not([data-looped])").forEach(function (track) {
      if (!track.children.length) return;
      track.dataset.looped = "1";
      var copy = track.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      copy.removeAttribute("id");
      [].forEach.call(copy.querySelectorAll("[id]"), function (n) { n.removeAttribute("id"); });
      track.parentNode.appendChild(copy);
      track.parentNode.classList.add("looping");
    });
  }

  function progress() {
    var bar = doc.querySelector(".fx-progress");
    if (!bar) return;
    var queued = false;
    function update() {
      queued = false;
      var max = html.scrollHeight - root.innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, root.scrollY / max) : 0) + ")";
    }
    root.addEventListener("scroll", function () { if (!queued) { queued = true; root.requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // Re-scan when scripts render new content (results load, view switches, My pay dashboards).
  function scan() {
    reveals();
    onSight(all("[data-shutter]:not(.shut-armed)").map(function (el) { el.classList.add("shut-armed"); return el; }), function (el) { el.classList.add("shut-open"); });
    onSight(all("[data-count]:not([data-counted])").filter(function (el) { return !el.closest("[data-fx]"); }), countUp);
    tickers();
    if (finePointer) { all("[data-tilt], .tile, .kpi").forEach(tilt); all("[data-magnet], .btn, button.primary").forEach(magnet); }
  }
  var queued = false;
  function rescan() { if (!queued) { queued = true; root.requestAnimationFrame(function () { queued = false; scan(); }); } }

  function start() {
    scan();
    progress();
    new MutationObserver(rescan).observe(doc.body, { childList: true, subtree: true });
  }
  root.KeelFx = { rescan: rescan };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})(this);
