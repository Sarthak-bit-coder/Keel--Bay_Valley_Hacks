// Keel motion layer, shared by the homepage, the simulation and My pay. Presentation only:
// it never computes or changes a number. Count-ups animate from the previous figure to the exact text already
// rendered from outputs/results.json, and always end on that text. Everything is skipped under reduced motion.
"use strict";
(function (root) {
  var doc = root.document, html = doc.documentElement;
  var reduced = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COUNT_MS = 700, REVEAL_MARGIN = "0px 0px -10% 0px";
  html.classList.add("js");
  if (reduced) return;
  html.classList.add("motion");

  // Splits "$1,234" / "−$56" / "75%" into prefix, number and suffix. Returns null when there is no single number.
  function parseFigure(text) {
    var m = /^([^\d]*?)([\d,]+(?:\.\d+)?)(.*)$/.exec(text.trim());
    if (!m) return null;
    var value = parseFloat(m[2].replace(/,/g, ""));
    return isNaN(value) ? null : { pre: m[1], value: value, post: m[3], decimals: (m[2].split(".")[1] || "").length };
  }
  function format(f, v) { return f.pre + v.toLocaleString("en-US", { minimumFractionDigits: f.decimals, maximumFractionDigits: f.decimals }) + f.post; }
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 4); };

  // Tweens el's first text node from `from` to its current figure. aria-hidden while moving, so screen readers
  // only ever hear the final value.
  function countUp(el, from) {
    var node = el.firstChild;
    if (!node || node.nodeType !== 3) return;
    var finalText = node.nodeValue, f = parseFigure(finalText);
    if (!f || from === f.value) return;
    var start = null;
    el.setAttribute("aria-hidden", "true");
    el.classList.add("counting");
    (function tick(now) {
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / COUNT_MS);
      node.nodeValue = t < 1 ? format(f, Math.round(from + (f.value - from) * easeOut(t))) : finalText;
      if (t < 1) root.requestAnimationFrame(tick);
      else { el.removeAttribute("aria-hidden"); el.classList.remove("counting"); }
    })(root.performance.now());
  }

  // Scroll reveals: sections fade up once. Fallback: show everything if IntersectionObserver is missing.
  function reveal(selector, onShow) {
    var els = [].slice.call(doc.querySelectorAll(selector));
    if (!("IntersectionObserver" in root)) { els.forEach(function (el) { el.classList.add("shown"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("shown");
        io.unobserve(e.target);
        if (onShow) onShow(e.target);
      });
    }, { rootMargin: REVEAL_MARGIN });
    els.forEach(function (el) { el.classList.add("reveal"); io.observe(el); }); // only observed elements start hidden
  }

  // Homepage: the Higgsfield hero clip. The poster still is always there; the clip loads only after the page is
  // up, never on Save-Data, and pauses when the hero is off screen.
  function heroVideo() {
    var v = doc.getElementById("herovideo");
    if (!v) return;
    var conn = root.navigator.connection;
    if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ""))) return;
    [["webm", "video/webm"], ["mp4", "video/mp4"]].forEach(function (s) {
      var src = doc.createElement("source");
      src.src = v.getAttribute("data-src-" + s[0]); src.type = s[1]; v.appendChild(src);
    });
    v.addEventListener("playing", function () { v.classList.add("live"); }, { once: true });
    v.load();
    var play = function () { var p = v.play(); if (p && p.catch) p.catch(function () { /* autoplay refused: the poster stays */ }); };
    if ("IntersectionObserver" in root) {
      new IntersectionObserver(function (es) { es[0].isIntersecting ? play() : v.pause(); }).observe(v);
    } else play();
  }

  // Homepage proof figures count up when they scroll into view.
  function homeFigures() {
    reveal("[data-reveal]", function (sec) {
      [].forEach.call(sec.querySelectorAll(".fig .n"), function (n) { countUp(n, 0); });
    });
  }

  // Simulation: the paycheck figure counts from the last paycheck to the new one whenever ui.js redraws the hero,
  // and the hero gives a short settle cue when a simulated payday runs.
  function simulation() {
    var hero = doc.getElementById("hero"), payday = doc.getElementById("payday");
    if (!hero) return;
    var last = null;
    new MutationObserver(function () {
      var fig = hero.querySelector(".pay .figure");
      if (!fig) return;
      var f = parseFigure(fig.textContent);
      if (f && last !== null) countUp(fig, last);
      if (f) last = f.value;
    }).observe(hero, { childList: true });
    if (payday) new MutationObserver(function () {
      if (!payday.children.length) return;
      hero.classList.remove("paid"); void hero.offsetWidth; hero.classList.add("paid"); // #hero outlives ui.js redraws
    }).observe(payday, { childList: true });
    reveal(".view .card, .view .tiles");
  }

  // Homepage: a hairline that fills as you read, and the nav link for the section in view.
  function progress() {
    var bar = doc.querySelector(".progress"), links = [].slice.call(doc.querySelectorAll(".links a[href^='#']"));
    if (!bar) return;
    var queued = false;
    function update() {
      queued = false;
      var max = html.scrollHeight - root.innerHeight, mid = root.innerHeight * 0.4;
      bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, root.scrollY / max) : 0) + ")";
      links.forEach(function (a) {
        var sec = doc.querySelector(a.getAttribute("href")), r = sec && !sec.closest("[hidden]") ? sec.getBoundingClientRect() : null;
        a.classList.toggle("here", !!r && r.top < mid && r.bottom > mid);
      });
    }
    root.addEventListener("scroll", function () { if (!queued) { queued = true; root.requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  function start() { heroVideo(); homeFigures(); simulation(); progress(); reveal(".mp-reveal"); }
  if (doc.readyState === "complete") start(); else root.addEventListener("load", start, { once: true });
})(this);
