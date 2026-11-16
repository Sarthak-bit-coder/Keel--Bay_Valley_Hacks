// "My pay": sign in, set up a profile, log weekly pay, and see the paycheck Keel would pay.
// Every number comes from KeelEngine.plan (tested against src/policy/salary.py). This file only draws and wires.
"use strict";
(function () {
  var E = window.KeelEngine, J = window.KeelJobs, S = window.KeelStore;
  var MODE_KEY = "keel-mypay-mode";
  var cfg = window.KEEL_SUPABASE || {};
  var client = null;
  var st = { store: null, profile: null, entries: [], plan: null, authTab: "in", editing: false, step: 1, page: 0, filter: "all", cview: "chart", draft: null };
  var RISKS = [0.01, 0.05, 0.1, 0.2];
  var RISK_NAMES = { 0.01: "Ultra safe", 0.05: "Balanced", 0.1: "Flexible", 0.2: "Aggressive" };
  var RISK_SUBS = { 0.01: "Max runway", 0.05: "Recommended", 0.1: "Higher payout", 0.2: "Minimal buffer" };
  var JOB_ICONS = { driver: "local_taxi", plumber: "plumbing", gardener: "yard", cleaner: "cleaning_services", handyman: "handyman", designer: "design_services", tutor: "school", other: "more_horiz" };
  var JOB_SHORT = { driver: "Driver", plumber: "Plumber", gardener: "Gardener", cleaner: "Cleaner", handyman: "Handyman", designer: "Designer", tutor: "Tutor", other: "Other" };
  var PAGE = 10;

  function $(id) { return document.getElementById(id); }
  function $$(sel) { return [].slice.call(document.querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { var r = Math.round(n); return (r < 0 ? "−$" : "$") + Math.abs(r).toLocaleString("en-US"); }
  function signed(n) { var r = Math.round(n); return (r > 0 ? "+" : r < 0 ? "−" : "") + "$" + Math.abs(r).toLocaleString("en-US"); }
  function pct(x) { return Math.round(x * 100) + "%"; }
  function pct1(x) { var v = x * 100; return (v < 10 ? v.toFixed(1) : Math.round(v)) + "%"; }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function fmtWeek(ws, noYear) { var d = new Date(ws + "T00:00:00Z"); return d.toLocaleDateString("en-US", noYear ? { month: "short", day: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); }
  function today() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function setMode(m) { try { if (m) localStorage.setItem(MODE_KEY, m); else localStorage.removeItem(MODE_KEY); } catch (e) { /* ignore */ } }
  function getMode() { try { return localStorage.getItem(MODE_KEY); } catch (e) { return null; } }
  function msg(id, text, kind) { var el = $(id); if (!el) return; el.textContent = text || ""; el.className = "msg" + (kind ? " " + kind : ""); }
  function fail(e) { msg("g-msg", "Something went wrong: " + (e && e.message ? e.message : e) + ". Your last change may not be saved; reload the page and try again.", "err"); }
  var toastTimer = null;
  function toast(text) { var t = $("toast"); t.textContent = text; t.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("on"); }, 2600); }

  function show(view) {
    ["v-signin", "v-profile", "v-dash"].forEach(function (v) { $(v).hidden = v !== view; });
    msg("g-msg", "");
    window.scrollTo(0, 0);
    if (window.KeelCurrents) window.KeelCurrents.init();
  }

  // ---- Sign in --------------------------------------------------------------------------------
  var accountsOn = !!(cfg.url && cfg.anonKey && window.supabase && window.supabase.createClient);
  if (accountsOn) {
    try { client = window.supabase.createClient(cfg.url, cfg.anonKey); } catch (e) { accountsOn = false; }
  }

  function setAuthTab(t) {
    st.authTab = t;
    $("tab-in").setAttribute("aria-pressed", String(t === "in"));
    $("tab-up").setAttribute("aria-pressed", String(t === "up"));
    $("auth-h").textContent = t === "in" ? "Welcome back to Keel" : "Create your Keel account";
    $("auth-sub").textContent = t === "in" ? "Plan a steadier weekly paycheck from uneven earnings." : "Keep your job and weekly pay so Keel can pick up where you left off.";
    $("a-submit").textContent = t === "in" ? "Log in" : "Create account";
    $("a-pass").setAttribute("autocomplete", t === "in" ? "current-password" : "new-password");
    $("a-pass-hint").hidden = t === "in";
    $("a-forgot").hidden = t !== "in";
    $("sw-q").textContent = t === "in" ? "Don't have an account?" : "Already have an account?";
    $("tab-toggle").textContent = t === "in" ? "Create an account →" : "Log in instead →";
    msg("a-msg", "");
  }
  $("tab-in").addEventListener("click", function () { setAuthTab("in"); });
  $("tab-up").addEventListener("click", function () { setAuthTab("up"); });
  $("tab-toggle").addEventListener("click", function () { setAuthTab(st.authTab === "in" ? "up" : "in"); $("a-email").focus(); });
  $("a-eye").addEventListener("click", function () {
    var on = $("a-pass").type === "password";
    $("a-pass").type = on ? "text" : "password";
    this.setAttribute("aria-pressed", String(on));
    this.setAttribute("aria-label", on ? "Hide password" : "Show password");
    this.querySelector(".ms").textContent = on ? "visibility_off" : "visibility";
  });
  $("a-forgot").addEventListener("click", function () {
    var email = $("a-email").value.trim();
    if (!accountsOn) return msg("a-msg", "Accounts are not switched on for this copy of Keel, so there is no password to reset. Continue as a guest instead.", "err");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $("a-email").focus(); return msg("a-msg", "Enter your email above first, then press Forgot password.", "err"); }
    client.auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] }).then(function (res) {
      if (res.error) return msg("a-msg", friendlyAuthError(res.error.message), "err");
      msg("a-msg", "If that email has an account, a reset link is on its way.", "ok");
    }).catch(function (e) { msg("a-msg", friendlyAuthError(e.message), "err"); });
  });

  function friendlyAuthError(m) {
    m = String(m || "");
    if (/invalid login credentials/i.test(m)) return "That email and password don't match an account. Check them, or create an account.";
    if (/already registered/i.test(m)) return "That email already has an account. Log in instead.";
    if (/email not confirmed/i.test(m)) return "Confirm your email first: open the link we sent you, then log in.";
    if (/password/i.test(m)) return "Use a password with at least 6 characters.";
    if (/fetch|network/i.test(m)) return "Can't reach the account service. Check your connection, or continue as a guest.";
    return m;
  }

  $("f-auth").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var email = $("a-email").value.trim(), pass = $("a-pass").value;
    var okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), okPass = pass.length >= 6;
    $("a-email").setAttribute("aria-invalid", String(!okEmail));
    $("a-pass").setAttribute("aria-invalid", String(!okPass));
    if (!okEmail) return msg("a-msg", "Enter an email address like name@example.com.", "err");
    if (!okPass) return msg("a-msg", "Use a password with at least 6 characters.", "err");
    $("a-submit").disabled = true;
    msg("a-msg", st.authTab === "in" ? "Logging in…" : "Creating your account…");
    var call = st.authTab === "in"
      ? client.auth.signInWithPassword({ email: email, password: pass })
      : client.auth.signUp({ email: email, password: pass });
    call.then(function (res) {
      $("a-submit").disabled = false;
      if (res.error) return msg("a-msg", friendlyAuthError(res.error.message), "err");
      if (!res.data.session) return msg("a-msg", "Account created. Open the link in the email we sent you, then log in here.", "ok");
      $("a-pass").value = "";
      startAccount(res.data.session.user);
    }).catch(function (e) { $("a-submit").disabled = false; msg("a-msg", friendlyAuthError(e.message), "err"); });
  });
  ["a-email", "a-pass"].forEach(function (id) { $(id).addEventListener("input", function () { $(id).removeAttribute("aria-invalid"); }); });

  $("b-guest").addEventListener("click", function () {
    setMode("guest");
    begin(new S.GuestStore());
  });

  function startAccount(user) {
    setMode("account");
    begin(new S.AccountStore(client, user), user.email);
  }

  // ---- Load a person ----------------------------------------------------------------------------
  function begin(store, email) {
    st.store = store;
    st.email = email || null;
    Promise.all([store.getProfile(), store.listEntries()]).then(function (r) {
      st.profile = r[0];
      st.entries = r[1];
      if (!st.profile) openProfile(false); else openDash();
    }).catch(fail);
  }

  // ---- Setup wizard -------------------------------------------------------------------------------
  J.JOBS.forEach(function (j) {
    [$("p-job"), $("s-job")].forEach(function (sel) {
      var o = document.createElement("option");
      o.value = j.id; o.textContent = j.label;
      sel.appendChild(o);
    });
  });
  $("p-jobtiles").innerHTML = J.JOBS.map(function (j) {
    return '<button type="button" role="radio" aria-checked="false" data-job="' + j.id + '" title="' + esc(j.label) + '"><span>' + esc(JOB_SHORT[j.id] || j.label) + '</span><span class="ms">' + (JOB_ICONS[j.id] || "work") + "</span></button>";
  }).join("");
  $("p-jobtiles").addEventListener("click", function (ev) {
    var b = ev.target.closest("button[data-job]");
    if (!b) return;
    $("p-job").value = b.getAttribute("data-job");
    jobShape();
  });
  $("p-jobtiles").addEventListener("keydown", function (ev) {
    if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].indexOf(ev.key) < 0) return;
    ev.preventDefault();
    var ids = J.JOBS.map(function (j) { return j.id; }), i = ids.indexOf($("p-job").value);
    i = (i + (ev.key === "ArrowRight" || ev.key === "ArrowDown" ? 1 : ids.length - 1)) % ids.length;
    $("p-job").value = ids[i]; jobShape();
    $("p-jobtiles").querySelector('[data-job="' + ids[i] + '"]').focus();
  });

  function sparkSVG(values, w, h) {
    if (values.length < 2) return "";
    var max = Math.max.apply(null, values) || 1, n = values.length;
    var pts = values.map(function (v, i) { return [i * w / (n - 1), h - 4 - (v / max) * (h - 8)]; });
    var d = "M" + pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join("L");
    return '<svg viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + "L" + w + "," + h + "L0," + h + 'Z" fill="' + css("--keel") + '" opacity=".12"/><path d="' + d + '" fill="none" stroke="' + css("--keel") + '" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
  }
  function jobShape() {
    var id = $("p-job").value, j = J.byId(id);
    $$("#p-jobtiles button").forEach(function (b) { var on = b.getAttribute("data-job") === id; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; });
    $("p-jobshape").textContent = j ? j.shape : "";
    $("p-jobchip").textContent = (JOB_SHORT[id] || "Other") + " example";
    var hist = J.exampleHistory(id, today(), 26, E).map(function (e) { return e.gross; });
    var sh = E.shape(hist);
    $("p-spark").innerHTML = sparkSVG(hist, 300, 90);
    $("p-cv").textContent = sh ? "Typical swing ±" + Math.round(sh.cv * 100) + "%" : "";
    summary();
  }
  function riskTiles(el, current) {
    el.innerHTML = RISKS.map(function (r) {
      return '<button type="button" data-r="' + r + '" aria-pressed="' + (r === current) + '"' + (r === 0.2 ? ' class="hot"' : "") + "><b>" + pct(r) + "</b><span>" + RISK_NAMES[r] + "</span><small>" + RISK_SUBS[r] + "</small></button>";
    }).join("");
  }
  function syncTax(prefix, v) {
    v = Number(v);
    $(prefix + "taxlabel").textContent = pct(v);
  }
  $("p-taxrange").addEventListener("input", function () { $("p-tax").value = Number(this.value).toFixed(2); syncTax("p-", this.value); summary(); });
  $("p-risktiles").addEventListener("click", function (ev) {
    var b = ev.target.closest("button[data-r]");
    if (!b) return;
    $("p-risk").value = b.getAttribute("data-r");
    riskTiles($("p-risktiles"), Number($("p-risk").value));
    summary();
  });
  function summary() {
    var j = J.byId($("p-job").value);
    $("p-summary").innerHTML = "<div><dt>Work</dt><dd>" + esc(j ? j.label : "Other") + "</dd></div><div><dt>Tax set-aside</dt><dd>" + pct(Number($("p-tax").value)) + "</dd></div><div><dt>Risk limit</dt><dd>" + pct(Number($("p-risk").value)) + "</dd></div>";
  }

  var STAGES = ["Profile & trade", "Paycheck & tax", "Starter weeks"];
  function goStep(n) {
    st.step = Math.max(1, Math.min(3, n));
    $$("[data-pane]").forEach(function (p) { p.hidden = Number(p.getAttribute("data-pane")) !== st.step; });
    $$("#p-steps li").forEach(function (li) {
      var k = Number(li.getAttribute("data-step"));
      li.className = k === st.step ? "on" : k < st.step ? "done" : "";
      li.querySelector("button").setAttribute("aria-current", k === st.step ? "step" : "false");
    });
    $("p-stage").textContent = "Step " + st.step + " of 3: " + STAGES[st.step - 1];
    $("p-back").disabled = st.step === 1;
    $("p-save").innerHTML = st.step === 1 ? 'Continue to paycheck rules<span class="ms">arrow_forward</span>'
      : st.step === 2 ? 'Continue to starter weeks<span class="ms">arrow_forward</span>'
      : (st.editing ? 'Save and return<span class="ms">check</span>' : 'Finish and see my paycheck<span class="ms">check</span>');
    msg("p-msg", "");
  }
  $("p-steps").addEventListener("click", function (ev) { var li = ev.target.closest("li[data-step]"); if (li) goStep(Number(li.getAttribute("data-step"))); });
  $("p-back").addEventListener("click", function () { goStep(st.step - 1); });

  function openProfile(editing) {
    st.editing = editing;
    var p = st.profile || { display_name: "", job: "driver", tax_rate: 0.15, risk_limit: 0.05 };
    $("p-title").textContent = editing ? "Your job and paycheck rules" : "Set up your runway";
    $("p-name").value = p.display_name || "";
    $("p-job").value = J.byId(p.job) ? p.job : "other";
    $("p-tax").value = p.tax_rate.toFixed(2);
    $("p-taxrange").value = p.tax_rate;
    syncTax("p-", p.tax_rate);
    $("p-risk").value = String(p.risk_limit);
    riskTiles($("p-risktiles"), p.risk_limit);
    $("p-example-wrap").hidden = st.entries.length > 0;
    $("p-example").checked = st.entries.length === 0;
    $("p-cancel").hidden = !editing;
    jobShape();
    goStep(1);
    show("v-profile");
  }
  $("p-cancel").addEventListener("click", openDash);

  $("f-profile").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (st.step < 3) return goStep(st.step + 1);
    var p = {
      display_name: $("p-name").value.trim().slice(0, 60),
      job: $("p-job").value,
      tax_rate: Number($("p-tax").value),
      risk_limit: Number($("p-risk").value)
    };
    var addExample = !$("p-example-wrap").hidden && $("p-example").checked;
    $("p-save").disabled = true;
    msg("p-msg", "Saving…");
    st.store.saveProfile(p).then(function () {
      st.profile = p;
      return addExample ? st.store.upsertEntries(J.exampleHistory(p.job, today(), 26, E)) : null;
    }).then(function () { return st.store.listEntries(); })
      .then(function (list) { st.entries = list; $("p-save").disabled = false; if (!location.hash) location.hash = "overview"; openDash(); })
      .catch(function (e) { $("p-save").disabled = false; msg("p-msg", "Could not save: " + e.message, "err"); });
  });

  // ---- Dashboard shell ------------------------------------------------------------------------------
  var SECS = ["overview", "log", "plan", "settings"];
  function section() { var h = location.hash.slice(1); return SECS.indexOf(h) >= 0 ? h : "overview"; }
  function showSection() {
    var s = section();
    $$(".sec").forEach(function (el) { el.hidden = el.getAttribute("data-sec") !== s; });
    $$(".sidenav a[data-sec]").forEach(function (a) { if (a.getAttribute("data-sec") === s) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (st.plan) drawCharts();
  }
  window.addEventListener("hashchange", function () { if (!$("v-dash").hidden) { showSection(); window.scrollTo(0, 0); } });

  function greeting() { var h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }

  function openDash() {
    var p = st.profile, job = J.byId(p.job) || J.byId("other"), guest = st.store.kind === "guest";
    var name = p.display_name || (st.email ? st.email.split("@")[0] : "");
    $("d-hello").textContent = greeting() + (name ? ", " + name : "");
    $("d-jobchip").innerHTML = '<span class="ms" style="font-size:16px">' + (JOB_ICONS[p.job] || "work") + "</span>" + esc(job.label);
    $("d-guestchip").hidden = !guest;
    $("s-kind").textContent = guest ? "Guest session" : "Signed in";
    $("s-sub").textContent = guest ? "Saved in this browser only" : (st.email || "Account");
    $("s-upgrade").hidden = !guest || !accountsOn;
    $("d-out-t").textContent = guest ? "Leave guest mode" : "Sign out";
    $("s-out-t").textContent = guest ? "Leave guest mode" : "Sign out";
    var initial = (name || "K").charAt(0).toUpperCase();
    $("tb-avatar").textContent = initial; $("set-avatar").textContent = initial;
    $("set-name").textContent = name || "Guest";
    $("set-email").textContent = guest ? "Guest: no email needed" : st.email;
    $("set-kind").textContent = guest ? "Guest" : "Account";
    $("set-sync").lastElementChild.textContent = guest ? "Saved in this browser" : "Synced to your account";
    $("s-where").textContent = guest ? "this browser" : "your account";
    $("set-store").innerHTML = '<span class="ms">verified_user</span> ' + (guest ? "Guest mode keeps your weeks only in this browser's storage. Clearing site data deletes them." : "Your profile and weeks are stored in your Keel account, protected so only you can read or change them.");
    $("set-session").textContent = guest ? "Guest session in this browser." : "Signed in as " + st.email + ".";
    fillSettings();
    show("v-dash");
    showSection();
    render();
  }
  $("d-edit").addEventListener("click", function () { openProfile(true); });
  function signOut() {
    setMode(null);
    var done = function () { st.store = null; show("v-signin"); };
    if (st.store.kind === "account") client.auth.signOut().then(done, done); else done();
  }
  $("d-out").addEventListener("click", signOut);
  document.addEventListener("click", function (ev) {
    if (ev.target.closest("[data-signout]")) signOut();
    if (ev.target.closest("[data-upgrade]") || ev.target.closest("#s-upgrade")) {
      if (!accountsOn) return toast("Accounts are not switched on for this copy of Keel yet.");
      signOut(); setAuthTab("up");
    }
    var ex = ev.target.closest("[data-export]");
    if (ex) exportLog(ex.getAttribute("data-export"));
    if (ev.target.closest("[data-add]")) setTimeout(function () { $("e-gross").focus(); }, 60);
  });

  // ---- Render ------------------------------------------------------------------------------------
  function render() {
    var p = st.profile;
    st.plan = E.plan(st.entries, { taxRate: p.tax_rate, riskLimit: p.risk_limit });
    $("tm-risk").textContent = pct(p.risk_limit);
    $("tm-weeks").textContent = String(st.entries.length);
    renderLog();
    preview();
    $("d-empty").hidden = !!st.plan;
    $("d-results").hidden = !st.plan;
    $("plan-empty").hidden = !!st.plan;
    $("plan-body").hidden = !st.plan;
    $("tb-buffer").hidden = !st.plan;
    if (!st.plan) return;
    var pl = st.plan, nx = pl.next, H = E.HORIZON;
    $("tb-buffer").lastElementChild.textContent = "Buffer " + money(nx.buffer_before);

    // KPIs
    $("k-week").textContent = "Week of " + fmtWeek(nx.week_start);
    $("ph-pay").innerHTML = money(nx.pay) + "<small>/ week</small>";
    $("k-payrange").textContent = "Forecast take-home " + money(nx.lo) + " to " + money(nx.hi);
    $("ph-buf").textContent = money(nx.buffer_before);
    var weeksCover = nx.pay > 0 ? nx.buffer_before / nx.pay : 0;
    $("k-bufsub").textContent = nx.pay > 0 ? "Covers about " + weeksCover.toFixed(1) + " paychecks of this size" : "No paycheck this week";
    var last = st.entries[st.entries.length - 1];
    $("ph-tax").textContent = pct(p.tax_rate) + " of what you're paid";
    $("k-tax").textContent = money(last.gross * p.tax_rate);
    $("k-taxsub").textContent = "From your last week · " + money(pl.metrics.tax_total) + " over " + pl.weeks.length + " replayed weeks";
    var ok = nx.risk <= p.risk_limit;
    $("k-risk").innerHTML = pct1(nx.risk) + ' <span class="status' + (ok ? "" : " bad") + '">' + (ok ? "Within limit" : "Above limit") + "</span>";
    $("k-risksub").textContent = "Your limit: " + pct(p.risk_limit) + " · " + RISK_NAMES[p.risk_limit];

    $("d-warn").innerHTML = pl.warnings.map(function (w) { return '<p class="warn"><span class="ms">warning</span>' + esc(w) + "</p>"; }).join("");

    // Why
    $("why-amt").textContent = money(nx.pay);
    $("ph-reason").textContent = "“" + nx.reason + "”";
    $("ph-range").textContent = money(nx.lo) + " – " + money(nx.hi);
    $("w-buf").textContent = money(nx.buffer_before);
    $("w-pay").textContent = money(nx.pay);
    var used = Math.min(E.WINDOW, st.entries.length);
    $("ph-basis").textContent = "Based on your last " + used + " week" + (used === 1 ? "" : "s") + " and the buffer you would have now if you had used Keel since week 5 at this risk limit." +
      (st.entries.length < 12 ? " With fewer than 12 weeks the forecast is rough; keep logging." : "");
    $("w-next").textContent = "Recalculates when you log the week of " + fmtWeek(nx.week_start, true) + ".";

    // Forecast bars
    var top = Math.max(nx.hi, 1);
    function bar(cls, label, v, sub) {
      return '<div class="pbar ' + cls + '"><div class="row"><span>' + label + "</span><b>" + money(v) + ' / wk</b></div><div class="trk"><i style="width:' + Math.max(2, v / top * 100) + '%"></i></div><div class="sub">' + sub + "</div></div>";
    }
    var gapLo = nx.lo - nx.pay, gapMid = nx.mid - nx.pay, gapHi = nx.hi - nx.pay;
    $("pbars").innerHTML =
      bar("lo", "Low week (10%)", nx.lo, gapLo < 0 ? "Buffer covers " + money(-gapLo) + (nx.buffer_before > 0 ? ", lasting about " + Math.max(0, nx.buffer_before / -gapLo).toFixed(1) + " weeks like this" : "") : "Still covers the paycheck, " + signed(gapLo) + " to the buffer") +
      bar("mid", "Typical week (50%)", nx.mid, gapMid >= 0 ? "Covers the " + money(nx.pay) + " paycheck with " + money(gapMid) + " to spare" : "Buffer adds " + money(-gapMid)) +
      bar("hi", "Good week (90%)", nx.hi, signed(gapHi) + " into the buffer");

    // Planning
    riskTiles($("d-risk"), p.risk_limit);
    $("pl-tax").value = p.tax_rate; syncTax("pl-", p.tax_rate);
    $("pl-pay").innerHTML = money(nx.pay) + "<small> / week</small>";
    $("pl-risk").innerHTML = '<span class="status' + (ok ? "" : " bad") + '">' + pct1(nx.risk) + "</span> <span class=\"hint\">limit " + pct(p.risk_limit) + "</span>";
    $("pl-state").textContent = ok ? "Within your limit" : "Above your limit";
    var midGross = nx.mid / (1 - p.tax_rate);
    $("eq-mid").textContent = money(midGross);
    $("eq-tax").textContent = "−" + money(midGross * p.tax_rate);
    $("eq-pay").textContent = money(nx.pay);
    $("eq-buf").textContent = signed(nx.mid - nx.pay);
    $("pl-reason").textContent = nx.reason;
    $("pl-runway").innerHTML = '<span class="ms">savings</span> Buffer before payday: <b>' + money(nx.buffer_before) + "</b>" + (nx.pay > 0 ? " · about " + weeksCover.toFixed(1) + " paychecks of runway" : "");

    var sh = E.shape(st.entries.map(function (e) { return e.gross; }));
    $("t-shape").textContent = sh.label.charAt(0).toUpperCase() + sh.label.slice(1);
    $("t-shape2").textContent = "Typical week " + money(sh.mean) + " · best " + money(sh.best) + " · worst " + money(sh.worst) +
      (sh.zero_weeks ? " · " + sh.zero_weeks + " week" + (sh.zero_weeks > 1 ? "s" : "") + " at $0" : "");
    var m = pl.metrics, nW = pl.weeks.length;
    if (nW) {
      $("t-swing").textContent = money(m.pay_swing.keel);
      $("t-swing2").textContent = "Keel paycheck, best to worst week, vs " + money(m.earnings_swing) + " for take-home pay over the same " + nW + " weeks.";
      $("t-od").textContent = m.overdraft_weeks.keel + " of " + nW;
      $("t-od2").textContent = "Keel " + m.overdraft_weeks.keel + " · 4-week average " + m.overdraft_weeks.avg4 + " · last week's pay " + m.overdraft_weeks.last +
        (m.overdraft_weeks.keel ? ". An empty buffer is a risk outcome Keel reports, not an error." : "");
    } else {
      $("t-swing").textContent = "—"; $("t-swing2").textContent = "Needs a 5th week to compare.";
      $("t-od").textContent = "—"; $("t-od2").textContent = "Needs a 5th week to compare.";
    }
    renderRecent();
    drawCharts();
  }

  function drawCharts() {
    var pl = st.plan;
    if (!pl) return;
    var labels = pl.weeks.map(function (w) { return w.week_start; });
    var s = section();
    if (s === "overview") {
      $("c-pay").hidden = st.cview !== "chart"; $("c-paytable").hidden = st.cview !== "table";
      if (st.cview === "chart") chart($("c-pay"), labels, [
        { color: "--ink2", dash: "5 4", values: pl.weeks.map(function (w) { return w.net; }), dots: true },
        { color: "--keel", width: 3, values: pl.weeks.map(function (w) { return w.pay_keel; }) }
      ], { lo: pl.weeks.map(function (w) { return w.lo; }), hi: pl.weeks.map(function (w) { return w.hi; }) }, "Take-home pay and Keel paycheck by week");
      else $("c-paytable").innerHTML = "<table><thead><tr><th>Week of</th><th class=num>Take-home</th><th class=num>Forecast low</th><th class=num>Forecast high</th><th class=num>Keel paycheck</th></tr></thead><tbody>" +
        pl.weeks.slice().reverse().map(function (w) { return "<tr><td>" + fmtWeek(w.week_start) + "</td><td class=num>" + money(w.net) + "</td><td class=num>" + money(w.lo) + "</td><td class=num>" + money(w.hi) + "</td><td class=num><b>" + money(w.pay_keel) + "</b></td></tr>"; }).join("") + "</tbody></table>";
    }
    if (s === "plan") chart($("c-buf"), labels, [
      { color: "--avg4", dash: "2 4", values: pl.weeks.map(function (w) { return w.buf_avg4; }) },
      { color: "--last", dash: "6 4", values: pl.weeks.map(function (w) { return w.buf_last; }) },
      { color: "--keel", width: 3, values: pl.weeks.map(function (w) { return w.buf_keel; }), area: true }
    ], null, "Buffer balance under each pay rule by week", true);
  }
  $$("[data-cview]").forEach(function (b) {
    b.addEventListener("click", function () {
      st.cview = b.getAttribute("data-cview");
      $$("[data-cview]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      drawCharts();
    });
  });

  // Risk limit and tax changes from Planning: re-run the plan and save.
  function setRule(key, v) {
    st.profile[key] = v;
    render();
    fillSettings();
    st.store.saveProfile(st.profile).then(function () { toast((key === "risk_limit" ? "Risk limit " : "Tax set-aside ") + pct(v) + " saved."); }).catch(fail);
  }
  $("d-risk").addEventListener("click", function (ev) { var b = ev.target.closest("button[data-r]"); if (b) setRule("risk_limit", Number(b.getAttribute("data-r"))); });
  $("pl-tax").addEventListener("input", function () { syncTax("pl-", this.value); });
  $("pl-tax").addEventListener("change", function () { setRule("tax_rate", Number(Number(this.value).toFixed(2))); });

  // ---- Chart -------------------------------------------------------------------------------------
  function niceTicks(min, max) {
    var span = max - min || 1, raw = span / 4, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var step = [1, 2, 2.5, 5, 10].map(function (k) { return k * mag; }).find(function (s) { return s >= raw; });
    var out = [], lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    if (hi === lo) hi = lo + step;
    for (var v = lo; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
    return out;  // first tick <= min and last tick >= max, so no line leaves the chart
  }
  function chart(el, labels, series, band, title, zeroLine) {
    var n = labels.length;
    if (n < 2) { el.innerHTML = '<p class="hint">The chart appears from your 6th week.</p>'; return; }
    var all = [];
    series.forEach(function (s) { all = all.concat(s.values); });
    if (band) all = all.concat(band.lo, band.hi);
    if (zeroLine) all.push(0);
    var ticks = niceTicks(Math.min.apply(null, all), Math.max.apply(null, all));
    var y0 = ticks[0], y1 = ticks[ticks.length - 1];
    var W = 760, H = 300, m = { l: 64, r: 14, t: 12, b: 30 };
    var X = function (i) { return m.l + i * (W - m.l - m.r) / (n - 1); };
    var Y = function (v) { return m.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - m.t - m.b); };
    var g = [], id = "g" + Math.random().toString(36).slice(2, 7);
    g.push('<defs><linearGradient id="' + id + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + css("--keel") + '" stop-opacity=".22"/><stop offset="1" stop-color="' + css("--keel") + '" stop-opacity="0"/></linearGradient></defs>');
    ticks.forEach(function (v) {
      g.push('<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + css(v === 0 && zeroLine ? "--crit" : "--grid") + '" stroke-width="1"' + (v === 0 && zeroLine ? "" : ' stroke-dasharray="3 4"') + "/>");
      g.push('<text x="' + (m.l - 10) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="12" fill="' + css("--muted") + '">' + money(v) + "</text>");
    });
    if (zeroLine && y0 < 0) g.push('<rect x="' + m.l + '" y="' + Y(0) + '" width="' + (W - m.l - m.r) + '" height="' + (Y(y0) - Y(0)) + '" fill="' + css("--crit") + '" opacity="0.06"/>');
    var nt = Math.min(n, 6);
    for (var t = 0; t < nt; t++) {
      var i = Math.round(t * (n - 1) / (nt - 1));
      g.push('<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="' + (i === 0 ? "start" : i === n - 1 ? "end" : "middle") + '" font-size="11" font-weight="600" letter-spacing=".04em" fill="' + css("--muted") + '">' + fmtWeek(labels[i], true).toUpperCase() + "</text>");
    }
    if (band) {
      var up = band.hi.map(function (v, i) { return X(i) + "," + Y(v); }).join(" ");
      var dn = band.lo.map(function (v, i) { return X(i) + "," + Y(v); }).reverse().join(" ");
      g.push('<polygon points="' + up + " " + dn + '" fill="' + css("--keel") + '" opacity="0.12"/>');
    }
    series.forEach(function (s) {
      var pts = s.values.map(function (v, i) { return X(i) + "," + Y(v); }).join(" ");
      if (s.area) g.push('<polygon points="' + X(0) + "," + Y(Math.max(y0, 0)) + " " + pts + " " + X(n - 1) + "," + Y(Math.max(y0, 0)) + '" fill="url(#' + id + ')"/>');
      g.push('<polyline class="ln" pathLength="1" points="' + pts + '" fill="none" stroke="' + css(s.color) + '" stroke-width="' + (s.width || 2) + '" stroke-linejoin="round"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : "") + "/>");
      if (s.dots && n <= 30) s.values.forEach(function (v, i) { g.push('<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="2.5" fill="' + css(s.color) + '"/>'); });
      g.push('<circle cx="' + X(n - 1) + '" cy="' + Y(s.values[n - 1]) + '" r="4.5" fill="' + css("--surface") + '" stroke="' + css(s.color) + '" stroke-width="2"/>');
    });
    // Hover guide: shows the week under the pointer.
    g.push('<line class="hv" x1="0" x2="0" y1="' + m.t + '" y2="' + (H - m.b) + '" stroke="' + css("--ink2") + '" stroke-dasharray="3 3" opacity="0"/>');
    el.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(title) + '">' + g.join("") + '</svg><div class="tip" hidden></div>';
    var svg = el.querySelector("svg"), tip = el.querySelector(".tip"), hv = el.querySelector(".hv");
    svg.addEventListener("pointermove", function (e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W;
      var i = Math.max(0, Math.min(n - 1, Math.round((x - m.l) / ((W - m.l - m.r) / (n - 1)))));
      hv.setAttribute("x1", X(i)); hv.setAttribute("x2", X(i)); hv.setAttribute("opacity", ".6");
      var w = st.plan.weeks[i];
      tip.hidden = false;
      tip.innerHTML = "<b>Week of " + fmtWeek(labels[i]) + "</b>" + (zeroLine
        ? "<div><span>Keel buffer</span><span>" + money(w.buf_keel) + "</span></div><div><span>4-week avg buffer</span><span>" + money(w.buf_avg4) + "</span></div><div><span>Last-week buffer</span><span>" + money(w.buf_last) + "</span></div>"
        : "<div><span>Take-home</span><span>" + money(w.net) + "</span></div><div><span>Keel paid</span><span>" + money(w.pay_keel) + "</span></div><div><span>" + (w.net >= w.pay_keel ? "Into buffer" : "From buffer") + "</span><span>" + money(Math.abs(w.net - w.pay_keel)) + "</span></div>");
      var left = X(i) / W * r.width;
      tip.style.left = Math.min(r.width - 200, Math.max(0, left + 12)) + "px";
    });
    svg.addEventListener("pointerleave", function () { tip.hidden = true; hv.setAttribute("opacity", "0"); });
  }

  // ---- Ledgers -------------------------------------------------------------------------------------
  function byWeekPlan() { var o = {}; (st.plan ? st.plan.weeks : []).forEach(function (w, i) { o[w.week_start] = { w: w, prev: i === 0 ? st.plan.b0 : st.plan.weeks[i - 1].buf_keel }; }); return o; }

  function renderRecent() {
    var pl = st.plan, rows = [];
    pl.weeks.forEach(function (w, i) { rows.push({ w: w, prev: i === 0 ? pl.b0 : pl.weeks[i - 1].buf_keel }); });
    rows.reverse();
    if (st.filter === "draw") rows = rows.filter(function (r) { return Math.round(r.w.buf_keel - r.prev) < 0; });
    if (st.filter === "save") rows = rows.filter(function (r) { return Math.round(r.w.buf_keel - r.prev) >= 0; });
    var shown = rows.slice(0, 6), notes = {};
    st.entries.forEach(function (e) { notes[e.week_start] = e.note; });
    $("r-count").textContent = pl.weeks.length + " replayed weeks";
    $("r-table").innerHTML = '<thead><tr><th>Week</th><th class="num">Paid</th><th class="num">Tax</th><th class="num">Keel paycheck</th><th class="num">Buffer change</th><th>Status</th></tr></thead><tbody>' +
      (shown.length ? shown.map(function (r, k) {
        var d = r.w.buf_keel - r.prev, used = Math.round(d) < 0;
        return "<tr" + (r.w.buf_keel < 0 ? ' class="drawn"' : "") + "><td><b>" + fmtWeek(r.w.week_start) + "</b>" + (k === 0 && st.filter === "all" ? ' <span class="status">Latest</span>' : "") + (notes[r.w.week_start] ? '<br><span class="hint">' + esc(notes[r.w.week_start]) + "</span>" : "") +
          '</td><td class="num">' + money(r.w.gross) + '</td><td class="num hint">−' + money(r.w.gross - r.w.net) + '</td><td class="num"><b class="pos">' + money(r.w.pay_keel) + '</b></td><td class="num"><span class="' + (used ? "neg" : "pos") + '">' + signed(d) + '</span><br><span class="hint">Buffer ' + money(r.w.buf_keel) + "</span></td><td>" +
          (r.w.buf_keel < 0 ? '<span class="status bad">Buffer ran out</span>' : used ? '<span class="status bad">Buffer used</span>' : '<span class="status">Surplus added</span>') + "</td></tr>";
      }).join("") : '<tr><td colspan="6" class="hint">No weeks match this filter.</td></tr>') + "</tbody>";
    $("r-foot").textContent = "Showing " + shown.length + " of " + rows.length + " weeks" + (st.filter === "all" ? " · total paid " + money(pl.weeks.reduce(function (t, w) { return t + w.gross; }, 0)) : "");
  }
  $("r-filter").addEventListener("click", function (ev) {
    var b = ev.target.closest("button[data-f]");
    if (!b) return;
    st.filter = b.getAttribute("data-f");
    $$("#r-filter button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    renderRecent();
  });

  function renderLog() {
    var tax = st.profile.tax_rate, pw = byWeekPlan();
    var list = st.entries.slice().reverse(), pages = Math.max(1, Math.ceil(list.length / PAGE));
    st.page = Math.min(st.page, pages - 1);
    var slice = list.slice(st.page * PAGE, st.page * PAGE + PAGE);
    if (!list.length) { $("e-table").innerHTML = '<tbody><tr><td class="hint" style="padding:24px">No weeks yet. Log your first week above, or load example weeks.</td></tr></tbody>'; }
    else {
      $("e-table").innerHTML = '<thead><tr><th>Week of</th><th class="num">Paid</th><th class="num">Tax (' + pct(tax) + ')</th><th class="num">Keel paycheck</th><th class="num">Buffer change</th><th class="num">Running buffer</th><th>Note</th><th class="num">Actions</th></tr></thead><tbody>' +
        slice.map(function (e) {
          var r = pw[e.week_start], d = r ? r.w.buf_keel - r.prev : null;
          return "<tr" + (r && r.w.buf_keel < r.prev ? ' class="drawn"' : "") + "><td><b>" + fmtWeek(e.week_start) + '</b></td><td class="num">' + money(e.gross) + '</td><td class="num neg">' + (e.gross > 0 ? "−" : "") + money(e.gross * tax) +
            '</td><td class="num">' + (r ? "<b>" + money(r.w.pay_keel) + "</b>" : '<span class="hint">—</span>') +
            '</td><td class="num">' + (r ? '<span class="' + (d < 0 ? "neg" : "pos") + '">' + signed(d) + "</span>" : '<span class="hint">—</span>') +
            '</td><td class="num">' + (r ? "<b>" + money(r.w.buf_keel) + "</b>" : '<span class="hint">—</span>') +
            '</td><td class="notecell">' + esc(e.note) + '</td><td class="num"><span class="acts"><button type="button" class="iconbtn sm" data-edit="' + e.week_start + '" aria-label="Edit week of ' + fmtWeek(e.week_start) + '"><span class="ms">edit</span></button><button type="button" class="iconbtn sm del" data-del="' + e.week_start + '" aria-label="Delete week of ' + fmtWeek(e.week_start) + '"><span class="ms">delete</span></button></span></td></tr>';
        }).join("") + "</tbody>";
    }
    var drawn = st.plan ? st.plan.weeks[st.plan.weeks.length - 1].buf_keel - st.plan.b0 : null;
    $("e-foot").textContent = "Showing " + slice.length + " of " + list.length + " weeks" + (drawn !== null ? " · buffer change since week 5: " + signed(drawn) : "");
    $("e-page").textContent = "Page " + (st.page + 1) + " of " + pages;
    $("e-prev").disabled = st.page === 0;
    $("e-next").disabled = st.page >= pages - 1;
    resetClear();
  }
  $("e-prev").addEventListener("click", function () { st.page--; renderLog(); });
  $("e-next").addEventListener("click", function () { st.page++; renderLog(); });
  function reload() { return st.store.listEntries().then(function (list) { st.entries = list; render(); }); }

  function preview() {
    var g = Number($("e-gross").value), tax = st.profile ? st.profile.tax_rate : 0.15;
    if (!$("e-gross").value || !isFinite(g) || g < 0) { $("e-preview").innerHTML = '<span class="hint">Type an amount to preview the tax set-aside and take-home.</span>'; return; }
    var pay = st.plan ? st.plan.next.pay : null, net = g * (1 - tax);
    $("e-preview").innerHTML = '<span class="hint">Preview:</span> <span class="neg"><span class="ms">account_balance</span>Tax (' + pct(tax) + "): −" + money(g * tax) + '</span> <span><span class="ms">payments</span>Take-home: <b>' + money(net) + "</b></span>" +
      (pay !== null ? ' <span class="' + (net - pay >= 0 ? "pos" : "neg") + '"><span class="ms">savings</span>vs next paycheck ' + money(pay) + ": " + signed(net - pay) + " buffer</span>" : "");
  }
  $("e-gross").addEventListener("input", preview);

  $("e-week").value = E.addWeeks(E.mondayOf(today()), -1);
  $("f-entry").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var day = $("e-week").value, g = $("e-gross").value;
    var okDay = /^\d{4}-\d{2}-\d{2}$/.test(day), num = Number(g), okG = g !== "" && isFinite(num) && num >= 0 && num < 100000;
    $("e-week").setAttribute("aria-invalid", String(!okDay));
    $("e-gross").setAttribute("aria-invalid", String(!okG));
    if (!okDay) return msg("e-msg", "Pick a date in the week you were paid for.", "err");
    if (!okG) return msg("e-msg", "Enter what you were paid that week, from $0 to $99,999.", "err");
    var ws = E.mondayOf(day);
    $("e-add").disabled = true;
    st.store.upsertEntries([{ week_start: ws, gross: Math.round(num * 100) / 100, note: $("e-note").value.trim().slice(0, 80) }])
      .then(reload).then(function () {
        $("e-add").disabled = false;
        msg("e-msg", "Saved the week of " + fmtWeek(ws) + ".", "ok");
        toast("Week of " + fmtWeek(ws) + " saved.");
        $("e-gross").value = ""; $("e-note").value = "";
        $("e-week").value = E.addWeeks(ws, 1);
        preview();
      }).catch(function (e) { $("e-add").disabled = false; msg("e-msg", "Could not save: " + e.message, "err"); });
  });
  ["e-week", "e-gross"].forEach(function (id) { $(id).addEventListener("input", function () { $(id).removeAttribute("aria-invalid"); msg("e-msg", ""); }); });

  $("e-table").addEventListener("click", function (ev) {
    var d = ev.target.closest("button[data-del]"), ed = ev.target.closest("button[data-edit]");
    if (d) {
      var ws = d.getAttribute("data-del");
      st.store.deleteEntry(ws).then(reload).then(function () { toast("Deleted the week of " + fmtWeek(ws) + "."); }).catch(fail);
    }
    if (ed) {
      var e = st.entries.filter(function (x) { return x.week_start === ed.getAttribute("data-edit"); })[0];
      if (!e) return;
      $("e-week").value = e.week_start; $("e-gross").value = e.gross; $("e-note").value = e.note || "";
      preview();
      msg("e-msg", "Editing the week of " + fmtWeek(e.week_start) + ". Change the amount and press Add week to replace it.");
      $("e-gross").focus();
      $("f-entry").scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });

  function addExample() {
    var hist = J.exampleHistory(st.profile.job, today(), 26, E);
    var have = {};
    st.entries.forEach(function (e) { have[e.week_start] = true; });
    var fresh = hist.filter(function (e) { return !have[e.week_start]; });  // never overwrite weeks you entered
    st.store.upsertEntries(fresh).then(reload).then(function () {
      var t = fresh.length ? "Added " + fresh.length + " example weeks (simulated). Delete them any time." : "Example weeks are already filled in.";
      msg("e-msg", t, "ok"); toast(t);
    }).catch(fail);
  }
  $("d-example1").addEventListener("click", addExample);
  $("d-example2").addEventListener("click", addExample);

  function resetClear() {
    $("clear-wrap").innerHTML = '<button type="button" class="btn danger" id="d-clear"' + (st.entries.length ? "" : " hidden") + '><span class="ms">delete_sweep</span>Delete all weeks</button>';
  }
  function confirmClear(wrap) {
    wrap.innerHTML = '<span class="hint">Delete all ' + st.entries.length + " weeks? This can't be undone.</span>" +
      '<button type="button" class="btn danger" data-clear-yes>Delete ' + st.entries.length + " weeks</button>" +
      '<button type="button" class="btn quiet" data-clear-no>Keep them</button>';
    wrap.querySelector("[data-clear-no]").focus();
  }
  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (t.closest("#d-clear")) return confirmClear($("clear-wrap"));
    if (t.closest("#s-purge")) { if (!st.entries.length) return toast("There are no weeks to delete."); var w = document.createElement("span"); w.className = "confirm"; w.id = "purge-wrap"; $("s-purge").replaceWith(w); return confirmClear(w); }
    if (t.closest("[data-clear-no]")) { resetClear(); resetPurge(); return; }
    if (t.closest("[data-clear-yes]")) st.store.clearEntries().then(reload).then(function () { resetPurge(); toast("All weeks deleted."); }).catch(fail);
  });
  function resetPurge() {
    var w = $("purge-wrap");
    if (w) { var b = document.createElement("button"); b.type = "button"; b.className = "btn danger"; b.id = "s-purge"; b.innerHTML = '<span class="ms">delete_sweep</span>Delete'; w.replaceWith(b); }
  }

  // ---- Export -----------------------------------------------------------------------------------
  function exportLog(kind) {
    if (!st.entries.length) return toast("Log a week first: there is nothing to export yet.");
    var pw = byWeekPlan(), tax = st.profile.tax_rate;
    var rows = st.entries.map(function (e) {
      var r = pw[e.week_start];
      return { week_start: e.week_start, gross: e.gross, tax_set_aside: Math.round(e.gross * tax * 100) / 100, take_home: Math.round(e.gross * (1 - tax) * 100) / 100,
        keel_paycheck: r ? Math.round(r.w.pay_keel * 100) / 100 : null, keel_buffer: r ? Math.round(r.w.buf_keel * 100) / 100 : null, note: e.note || "" };
    });
    var body, type, name = "keel-earnings-" + today();
    if (kind === "json") {
      body = JSON.stringify({ note: "Keel demo export. Not financial or tax advice.", profile: st.profile, weeks: rows }, null, 2);
      type = "application/json"; name += ".json";
    } else {
      var cols = Object.keys(rows[0]);
      body = cols.join(",") + "\n" + rows.map(function (r) { return cols.map(function (c) { var v = r[c]; v = v === null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\n");
      type = "text/csv"; name += ".csv";
    }
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast("Downloaded " + name);
  }

  // ---- Settings ---------------------------------------------------------------------------------
  function fillSettings() {
    var p = st.profile;
    st.draft = { display_name: p.display_name || "", job: p.job, tax_rate: p.tax_rate, risk_limit: p.risk_limit };
    $("s-name").value = st.draft.display_name;
    $("s-job").value = J.byId(p.job) ? p.job : "other";
    $("s-jobshape").textContent = (J.byId($("s-job").value) || {}).shape || "";
    $("s-tax").value = p.tax_rate; syncTax("s-", p.tax_rate);
    riskTiles($("s-risk"), p.risk_limit);
    $("s-risklabel").textContent = RISK_NAMES[p.risk_limit] + " (" + pct(p.risk_limit) + ")";
  }
  $("s-job").addEventListener("change", function () { st.draft.job = this.value; $("s-jobshape").textContent = (J.byId(this.value) || {}).shape || ""; });
  $("s-name").addEventListener("input", function () { st.draft.display_name = this.value; });
  $("s-tax").addEventListener("input", function () { st.draft.tax_rate = Number(Number(this.value).toFixed(2)); syncTax("s-", this.value); });
  $("s-risk").addEventListener("click", function (ev) {
    var b = ev.target.closest("button[data-r]");
    if (!b) return;
    st.draft.risk_limit = Number(b.getAttribute("data-r"));
    riskTiles($("s-risk"), st.draft.risk_limit);
    $("s-risklabel").textContent = RISK_NAMES[st.draft.risk_limit] + " (" + pct(st.draft.risk_limit) + ")";
  });
  $("s-discard").addEventListener("click", function () { fillSettings(); toast("Changes discarded."); });
  $("s-save").addEventListener("click", function () {
    var p = { display_name: st.draft.display_name.trim().slice(0, 60), job: st.draft.job, tax_rate: st.draft.tax_rate, risk_limit: st.draft.risk_limit };
    $("s-save").disabled = true;
    st.store.saveProfile(p).then(function () {
      st.profile = p; $("s-save").disabled = false;
      openDash(); toast("Settings saved.");
    }).catch(function (e) { $("s-save").disabled = false; fail(e); });
  });

  // ---- Start -------------------------------------------------------------------------------------
  setAuthTab("in");
  if (!accountsOn) {
    $("f-auth").hidden = true;
    $("auth-switch").hidden = true;
    $("a-off").hidden = false;
  }
  function start() {
    if (getMode() === "guest") return begin(new S.GuestStore());
    if (!accountsOn) return show("v-signin");
    client.auth.getSession().then(function (res) {
      var s = res.data && res.data.session;
      if (s) startAccount(s.user); else show("v-signin");
    }).catch(function () { show("v-signin"); });
  }
  if (accountsOn) {
    client.auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_OUT" && st.store && st.store.kind === "account") { st.store = null; show("v-signin"); }
    });
  }
  var redraw = function () { if (st.plan && !$("v-dash").hidden) render(); else if (!$("v-profile").hidden) jobShape(); };
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  var rt = null;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { if (st.plan) drawCharts(); }, 150); });
  start();
})();
