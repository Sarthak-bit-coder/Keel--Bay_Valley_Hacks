// Light / dark theme switch shared by the app pages. Stores the choice in this browser only.
// Any button with data-theme-toggle flips it. With no choice saved, the page follows the system setting.
"use strict";
(function (root) {
  var KEY = "keel-theme", html = root.document.documentElement;
  function saved() { try { return root.localStorage.getItem(KEY); } catch (e) { return null; } }
  function current() {
    var t = html.getAttribute("data-theme");
    if (t) return t;
    return root.matchMedia && root.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function apply(t) {
    if (t) html.setAttribute("data-theme", t); else html.removeAttribute("data-theme");
    [].forEach.call(root.document.querySelectorAll("[data-theme-toggle]"), function (b) {
      var dark = current() === "dark";
      b.setAttribute("aria-pressed", String(dark));
      b.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
      b.title = dark ? "Light theme" : "Dark theme";
    });
  }
  apply(saved());
  // Phone layout: the sidebar slides in from a menu button and closes on a link, the backdrop or Escape.
  function nav(open) {
    root.document.body.classList.toggle("nav-open", open);
    [].forEach.call(root.document.querySelectorAll("[data-menu]"), function (m) { m.setAttribute("aria-expanded", String(open)); });
  }
  root.document.addEventListener("keydown", function (e) { if (e.key === "Escape") nav(false); });
  root.document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("[data-menu]")) return nav(!root.document.body.classList.contains("nav-open"));
    if (root.document.body.classList.contains("nav-open") && (!e.target.closest(".side") || e.target.closest(".side a, .side button"))) nav(false);
    var b = e.target.closest && e.target.closest("[data-theme-toggle]");
    if (!b) return;
    var next = current() === "dark" ? "light" : "dark";
    try { root.localStorage.setItem(KEY, next); } catch (err) { /* keep for this page only */ }
    apply(next);
  });
  root.document.addEventListener("DOMContentLoaded", function () { apply(html.getAttribute("data-theme")); });
})(window);
