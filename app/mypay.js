// "My pay": log in (Google or email) or try it without an account, answer 3 sign-up questions,
// log weekly pay, and see a steady weekly paycheck. Every paycheck number comes from KeelEngine.plan
// (tested against src/policy/salary.py). This file only draws the page and wires the buttons.
"use strict";
(function () {
  var E = window.KeelEngine, J = window.KeelJobs, S = window.KeelStore;
  var MODE_KEY = "keel-mypay-mode";
  var IDLE_MS = 30 * 60 * 1000;   // log out accounts after 30 minutes of no activity
  var cfg = window.KEEL_SUPABASE || {};
  var client = null;
  var st = { store: null, profile: null, entries: [], plan: null, authTab: "in", editing: false, step: 1, page: 0, draft: null, fails: 0, lockUntil: 0 };
  var RISKS = [0.01, 0.05, 0.1, 0.2];
  var SAFETY = { 0.01: ["Extra safe", "Biggest cushion"], 0.05: ["Safe", "Recommended"], 0.1: ["Balanced", "A bit more pay"], 0.2: ["Bold", "Most pay, less cushion"] };
  var TAXES = [0.10, 0.15, 0.20, 0.25];
  var BILLS = ["housing", "utilities", "food", "transport", "debt", "other"];
  var JOB_ICONS = { driver: "local_taxi", plumber: "plumbing", gardener: "yard", cleaner: "cleaning_services", handyman: "handyman", designer: "design_services", tutor: "school", other: "more_horiz" };
  var JOB_SHORT = { driver: "Driver", plumber: "Plumber", gardener: "Gardener", cleaner: "Cleaner", handyman: "Handyman", designer: "Designer", tutor: "Tutor", other: "Other" };
  var PAGE = 10;

  function $(id) { return document.getElementById(id); }
  function $$(sel) { return [].slice.call(document.querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { var r = Math.round(n); return (r < 0 ? "−$" : "$") + Math.abs(r).toLocaleString("en-US"); }
  function pct(x) { return Math.round(x * 100) + "%"; }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function fmtWeek(ws, noYear) { var d = new Date(ws + "T00:00:00Z"); return d.toLocaleDateString("en-US", noYear ? { month: "short", day: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); }
  function today() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function num(v) { var n = Number(v); return v === "" || v == null || !isFinite(n) || n < 0 ? null : n; }
  function setMode(m) { try { if (m) localStorage.setItem(MODE_KEY, m); else localStorage.removeItem(MODE_KEY); } catch (e) { /* ignore */ } }
  function getMode() { try { return localStorage.getItem(MODE_KEY); } catch (e) { return null; } }
  function msg(id, text, kind) { var el = $(id); if (!el) return; el.textContent = text || ""; el.className = "msg" + (kind ? " " + kind : ""); }
  function fail(e) { msg("g-msg", "Something went wrong: " + (e && e.message ? e.message : e) + ". Please reload the page and try again.", "err"); }
  var toastTimer = null;
  function toast(text) { var t = $("toast"); t.textContent = text; t.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("on"); }, 2600); }
  function monthlyBills(p) { var x = (p && p.expenses) || {}; return BILLS.reduce(function (t, k) { return t + (Number(x[k]) || 0); }, 0); }
  function weekly(monthly) { return monthly * 12 / 52; }

  function show(view) {
    ["v-signin", "v-profile", "v-dash"].forEach(function (v) { $(v).hidden = v !== view; });
    $("tb-avatar").hidden = view !== "v-dash";
    msg("g-msg", "");
    window.scrollTo(0, 0);
    if (window.KeelCurrents) window.KeelCurrents.init();
  }

  // ---- Accounts ---------------------------------------------------------------------------------
  // Supabase handles passwords (stored hashed on their side), Google sign-in and sessions. Row level security
  // in app/supabase_schema.sql means each person can only ever read or change their own rows.
  var accountsOn = !!(cfg.url && cfg.anonKey && window.supabase && window.supabase.createClient);
  if (accountsOn) {
    try { client = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true } }); } catch (e) { accountsOn = false; }
  }

  function setAuthTab(t) {
    st.authTab = t;
    var up = t === "up";
    $("tab-in").setAttribute("aria-pressed", String(!up));
    $("tab-up").setAttribute("aria-pressed", String(up));
    $("auth-h").textContent = up ? "Create your account" : "Welcome back";
    $("auth-sub").textContent = up ? "It takes about a minute. Then we'll ask 3 quick questions." : "Turn uneven pay into one steady weekly paycheck.";
    $("g-label").textContent = up ? "Sign up with Google" : "Log in with Google";
    $("a-submit").textContent = up ? "Create account" : "Log in";
    $("a-pass").setAttribute("autocomplete", up ? "new-password" : "current-password");
    $("a-rules").hidden = !up;
    $("a-pass2-wrap").hidden = !up;
    $("a-forgot").hidden = up;
    msg("a-msg", "");
    checkRules();
  }
  $("tab-in").addEventListener("click", function () { setAuthTab("in"); });
  $("tab-up").addEventListener("click", function () { setAuthTab("up"); });
  $("a-eye").addEventListener("click", function () {
    var on = $("a-pass").type === "password";
    $("a-pass").type = on ? "text" : "password";
    $("a-pass2").type = $("a-pass").type;
    this.setAttribute("aria-pressed", String(on));
    this.setAttribute("aria-label", on ? "Hide password" : "Show password");
    this.querySelector(".ms").textContent = on ? "visibility_off" : "visibility";
  });

  // Password rules for new accounts: 8+ characters with a letter and a number.
  function rules(p) { return { len: p.length >= 8, mix: /[A-Za-z]/.test(p) && /\d/.test(p) }; }
  function checkRules() {
    var r = rules($("a-pass").value);
    $$("#a-rules li").forEach(function (li) { li.classList.toggle("ok", !!r[li.getAttribute("data-rule")]); });
  }
  $("a-pass").addEventListener("input", function () { checkRules(); this.removeAttribute("aria-invalid"); });
  $("a-email").addEventListener("input", function () { this.removeAttribute("aria-invalid"); });

  function friendlyAuthError(m) {
    m = String(m || "");
    if (/invalid login credentials/i.test(m)) return "That email and password don't match. Try again, or sign up.";
    if (/already registered|already exists/i.test(m)) return "That email already has an account. Please log in.";
    if (/email not confirmed/i.test(m)) return "Please confirm your email first. Check your inbox for our link.";
    if (/rate limit|too many/i.test(m)) return "Too many tries. Please wait a minute and try again.";
    if (/provider is not enabled|unsupported provider/i.test(m)) return "Google sign-in isn't turned on for this copy of Keel yet. Use email instead.";
    if (/fetch|network/i.test(m)) return "Can't connect right now. Check your internet, or try without an account.";
    return m;
  }

  $("b-google").addEventListener("click", function () {
    if (!accountsOn) return msg("a-msg", "Accounts aren't turned on yet. Try it without an account below.", "err");
    msg("a-msg", "Opening Google…");
    client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } })
      .then(function (res) { if (res.error) msg("a-msg", friendlyAuthError(res.error.message), "err"); })
      .catch(function (e) { msg("a-msg", friendlyAuthError(e.message), "err"); });
  });

  $("a-forgot").addEventListener("click", function () {
    var email = $("a-email").value.trim();
    if (!accountsOn) return msg("a-msg", "Accounts aren't turned on yet, so there's no password to reset.", "err");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $("a-email").focus(); return msg("a-msg", "Type your email above, then press \"Forgot it?\" again.", "err"); }
    client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }).then(function (res) {
      if (res.error) return msg("a-msg", friendlyAuthError(res.error.message), "err");
      msg("a-msg", "If that email has an account, we've sent a reset link.", "ok");
    }).catch(function (e) { msg("a-msg", friendlyAuthError(e.message), "err"); });
  });

  $("f-auth").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!accountsOn) return msg("a-msg", "Accounts aren't turned on yet. Try it without an account below.", "err");
    if (Date.now() < st.lockUntil) return msg("a-msg", "Too many tries. Please wait " + Math.ceil((st.lockUntil - Date.now()) / 1000) + " seconds.", "err");
    var up = st.authTab === "up";
    var email = $("a-email").value.trim(), pass = $("a-pass").value, r = rules(pass);
    var okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    $("a-email").setAttribute("aria-invalid", String(!okEmail));
    if (!okEmail) return msg("a-msg", "Please enter an email like name@example.com.", "err");
    if (up && !(r.len && r.mix)) { $("a-pass").setAttribute("aria-invalid", "true"); return msg("a-msg", "Your password needs 8+ characters with a letter and a number.", "err"); }
    if (!up && !pass) { $("a-pass").setAttribute("aria-invalid", "true"); return msg("a-msg", "Please enter your password.", "err"); }
    if (up && pass !== $("a-pass2").value) return msg("a-msg", "The two passwords don't match.", "err");
    $("a-submit").disabled = true;
    msg("a-msg", up ? "Creating your account…" : "Logging in…");
    var call = up
      ? client.auth.signUp({ email: email, password: pass, options: { emailRedirectTo: location.origin + location.pathname } })
      : client.auth.signInWithPassword({ email: email, password: pass });
    call.then(function (res) {
      $("a-submit").disabled = false;
      if (res.error) {
        // Slow down guessing: after 5 wrong tries, wait 30 seconds.
        if (!up && ++st.fails >= 5) { st.lockUntil = Date.now() + 30000; st.fails = 0; }
        return msg("a-msg", friendlyAuthError(res.error.message), "err");
      }
      st.fails = 0;
      $("a-pass").value = ""; $("a-pass2").value = "";
      if (!res.data.session) return msg("a-msg", "Almost done! Check your email and click the link to confirm, then log in.", "ok");
      startAccount(res.data.session.user);
    }).catch(function (e) { $("a-submit").disabled = false; msg("a-msg", friendlyAuthError(e.message), "err"); });
  });

  $("b-guest").addEventListener("click", function () {
    setMode("guest");
    begin(new S.GuestStore());
  });

  function startAccount(user) {
    setMode("account");
    begin(new S.AccountStore(client, user), user.email);
  }

  // Log accounts out after 30 minutes with no clicks or typing.
  var idleTimer = null;
  function bumpIdle() {
    clearTimeout(idleTimer);
    if (!st.store || st.store.kind !== "account") return;
    idleTimer = setTimeout(function () { signOut(); setTimeout(function () { msg("a-msg", "You were logged out after 30 minutes of no activity, to keep your info safe.", "ok"); }, 50); }, IDLE_MS);
  }
  ["click", "keydown", "pointermove", "scroll"].forEach(function (t) { document.addEventListener(t, bumpIdle, { passive: true }); });

  // ---- Load a person ----------------------------------------------------------------------------
  function begin(store, email) {
    st.store = store;
    st.email = email || null;
    bumpIdle();
    Promise.all([store.getProfile(), store.listEntries()]).then(function (r) {
      st.profile = r[0];
      st.entries = r[1];
      if (!st.profile) openProfile(false); else openDash();
    }).catch(fail);
  }

  // ---- Sign-up questions ------------------------------------------------------------------------
  J.JOBS.forEach(function (j) { var o = document.createElement("option"); o.value = j.id; o.textContent = j.label; $("s-job").appendChild(o); });
  $("p-jobtiles").innerHTML = J.JOBS.map(function (j) {
    return '<button type="button" role="radio" aria-checked="false" data-job="' + j.id + '" title="' + esc(j.label) + '"><span>' + esc(JOB_SHORT[j.id] || j.label) + '</span><span class="ms">' + (JOB_ICONS[j.id] || "work") + "</span></button>";
  }).join("");
  var wiz = { job: "driver", tax: 0.15, risk: 0.05 };
  function pickJob(id) {
    wiz.job = id;
    $$("#p-jobtiles button").forEach(function (b) { var on = b.getAttribute("data-job") === id; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; });
    var j = J.byId(id);
    $("p-jobshape").textContent = j ? j.shape : "";
  }
  $("p-jobtiles").addEventListener("click", function (ev) { var b = ev.target.closest("button[data-job]"); if (b) pickJob(b.getAttribute("data-job")); });
  $("p-jobtiles").addEventListener("keydown", function (ev) {
    if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].indexOf(ev.key) < 0) return;
    ev.preventDefault();
    var ids = J.JOBS.map(function (j) { return j.id; }), i = ids.indexOf(wiz.job);
    i = (i + (ev.key === "ArrowRight" || ev.key === "ArrowDown" ? 1 : ids.length - 1)) % ids.length;
    pickJob(ids[i]); $("p-jobtiles").querySelector('[data-job="' + ids[i] + '"]').focus();
  });

  function riskTiles(el, current) {
    el.innerHTML = RISKS.map(function (r) {
      return '<button type="button" data-r="' + r + '" aria-pressed="' + (r === current) + '"><b>' + SAFETY[r][0] + "</b><small>" + SAFETY[r][1] + "</small></button>";
    }).join("");
  }
  function taxSeg(el, current) {
    el.innerHTML = TAXES.map(function (t) { return '<button type="button" data-t="' + t + '" aria-pressed="' + (Math.abs(t - current) < 1e-9) + '">' + pct(t) + "</button>"; }).join("");
  }
  $("p-risktiles").addEventListener("click", function (ev) { var b = ev.target.closest("button[data-r]"); if (!b) return; wiz.risk = Number(b.getAttribute("data-r")); riskTiles($("p-risktiles"), wiz.risk); });
  $("p-taxseg").addEventListener("click", function (ev) { var b = ev.target.closest("button[data-t]"); if (!b) return; wiz.tax = Number(b.getAttribute("data-t")); taxSeg($("p-taxseg"), wiz.tax); });

  function billInputs() { return $$("[data-bill]"); }
  function readBills() { var o = {}; billInputs().forEach(function (i) { var v = num(i.value); if (v) o[i.getAttribute("data-bill")] = Math.round(v); }); return o; }
  function billTotal() {
    var m = monthlyBills({ expenses: readBills() });
    $("p-billtotal").innerHTML = "Total: <b>" + money(m) + " a month</b>" + (m ? " · about " + money(weekly(m)) + " a week" : "");
  }
  billInputs().forEach(function (i) { i.addEventListener("input", billTotal); });

  var STAGES = ["About you", "Your money", "Your choices"];
  function goStep(n) {
    st.step = Math.max(1, Math.min(3, n));
    $$("[data-pane]").forEach(function (p) { p.hidden = Number(p.getAttribute("data-pane")) !== st.step; });
    $$("#p-steps li").forEach(function (li) {
      var k = Number(li.getAttribute("data-step"));
      li.className = k === st.step ? "on" : k < st.step ? "done" : "";
      li.querySelector("button").setAttribute("aria-current", k === st.step ? "step" : "false");
    });
    $("p-stage").textContent = "Step " + st.step + " of 3: " + STAGES[st.step - 1];
    $("p-back").hidden = st.step === 1;
    $("p-save").innerHTML = st.step < 3 ? 'Next<span class="ms">arrow_forward</span>' : (st.editing ? 'Save<span class="ms">check</span>' : 'See my paycheck<span class="ms">check</span>');
    msg("p-msg", "");
  }
  $("p-steps").addEventListener("click", function (ev) { var li = ev.target.closest("li[data-step]"); if (li) goStep(Number(li.getAttribute("data-step"))); });
  $("p-back").addEventListener("click", function () { goStep(st.step - 1); });

  function openProfile(editing, step) {
    st.editing = editing;
    var p = st.profile || { display_name: "", job: "driver", tax_rate: 0.15, risk_limit: 0.05, expenses: {} };
    $("p-title").textContent = editing ? "Update your answers" : "Let's set up your paycheck";
    $("p-name").value = p.display_name || "";
    pickJob(J.byId(p.job) ? p.job : "other");
    wiz.tax = p.tax_rate; wiz.risk = p.risk_limit;
    taxSeg($("p-taxseg"), wiz.tax);
    riskTiles($("p-risktiles"), wiz.risk);
    $("p-pay").value = p.weekly_pay == null ? "" : p.weekly_pay;
    $("p-savings").value = p.savings == null ? "" : p.savings;
    billInputs().forEach(function (i) { var v = (p.expenses || {})[i.getAttribute("data-bill")]; i.value = v ? v : ""; });
    billTotal();
    $("p-example-wrap").hidden = st.entries.length > 0;
    $("p-example").checked = st.entries.length === 0;
    $("p-cancel").hidden = !editing;
    goStep(step || 1);
    show("v-profile");
  }
  $("p-cancel").addEventListener("click", openDash);

  // Practice weeks: the job's simulated pattern, scaled to the weekly pay the person told us.
  function practiceWeeks(job, weeklyPay) {
    var hist = J.exampleHistory(job, today(), 26, E);
    if (!weeklyPay) return hist;
    var avg = hist.reduce(function (t, e) { return t + e.gross; }, 0) / hist.length || 1, k = weeklyPay / avg;
    return hist.map(function (e) { return { week_start: e.week_start, gross: Math.round(e.gross * k * 100) / 100, note: "practice week" }; });
  }

  $("f-profile").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (st.step === 2) {
      var bad = [$("p-pay"), $("p-savings")].concat(billInputs()).filter(function (i) { return i.value !== "" && num(i.value) === null; });
      if (bad.length) { bad[0].focus(); return msg("p-msg", "Please use numbers of 0 or more.", "err"); }
    }
    if (st.step < 3) return goStep(st.step + 1);
    var p = {
      display_name: $("p-name").value.trim().slice(0, 60),
      job: wiz.job, tax_rate: wiz.tax, risk_limit: wiz.risk,
      weekly_pay: num($("p-pay").value), savings: num($("p-savings").value), expenses: readBills()
    };
    var addExample = !$("p-example-wrap").hidden && $("p-example").checked;
    $("p-save").disabled = true;
    msg("p-msg", "Saving…");
    st.store.saveProfile(p).then(function () {
      st.profile = p;
      return addExample ? st.store.upsertEntries(practiceWeeks(p.job, p.weekly_pay)) : null;
    }).then(function () { return st.store.listEntries(); })
      .then(function (list) { st.entries = list; $("p-save").disabled = false; location.hash = "home"; openDash(); })
      .catch(function (e) { $("p-save").disabled = false; msg("p-msg", "Couldn't save: " + e.message, "err"); });
  });

  // ---- Dashboard --------------------------------------------------------------------------------
  var SECS = ["home", "weeks", "settings"];
  function section() { var h = location.hash.slice(1); return SECS.indexOf(h) >= 0 ? h : "home"; }
  function showSection() {
    var s = section();
    $$(".sec").forEach(function (el) { el.hidden = el.getAttribute("data-sec") !== s; });
    $$("a[data-sec]").forEach(function (a) { if (a.getAttribute("data-sec") === s) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (st.plan && s === "home") drawChart();
  }
  window.addEventListener("hashchange", function () { if (!$("v-dash").hidden) showSection(); });

  function greeting() { var h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }

  function openDash() {
    var p = st.profile, guest = st.store.kind === "guest";
    var name = p.display_name || (st.email ? st.email.split("@")[0] : "");
    $("d-hello").textContent = greeting() + (name ? ", " + name : "");
    $("tb-avatar").textContent = (name || "K").charAt(0).toUpperCase();
    $("d-out-t").textContent = guest ? "Leave" : "Log out";
    $("s-out-label").textContent = guest ? "Stop using this browser" : "Log out";
    $("s-out-hint").textContent = guest ? "Your info stays saved in this browser until you delete it." : "For your safety, Keel logs you out after 30 minutes of no activity.";
    $("set-session").textContent = guest ? "You're trying Keel without an account. Your info is saved only in this browser." : "Logged in as " + st.email + ". Only you can see your info.";
    $("s-where").textContent = guest ? "Saved in this browser." : "Saved to your account.";
    fillSettings();
    show("v-dash");
    showSection();
    render();
  }
  $("d-edit").addEventListener("click", function () { openProfile(true, 2); });
  function signOut() {
    setMode(null);
    clearTimeout(idleTimer);
    var done = function () { st.store = null; show("v-signin"); };
    if (st.store && st.store.kind === "account") client.auth.signOut().then(done, done); else done();
  }
  $("d-out").addEventListener("click", signOut);
  document.addEventListener("click", function (ev) {
    if (ev.target.closest("[data-export]")) exportLog();
    if (ev.target.closest("[data-add]")) setTimeout(function () { $("e-gross").focus(); }, 80);
    if (ev.target.id === "k-addbills") openProfile(true, 2);
  });

  function plainReason(nx, limit) {
    var inN = Math.max(1, Math.round(nx.risk * 100)), limN = Math.round(limit * 100);
    if (nx.pay <= 0) return "Your savings cushion is too low right now, so Keel pays $0 this week to rebuild it. Your paycheck comes back as your cushion grows.";
    if (nx.risk <= limit) return "We picked " + money(nx.pay) + " because it's the most we can pay while keeping only about a " + inN + " in 100 chance your cushion runs out in the next 4 weeks. You chose " + limN + " in 100.";
    return "We picked " + money(nx.pay) + ", but your cushion is low, so there's about a " + inN + " in 100 chance it runs out in the next 4 weeks. That's more than the " + limN + " in 100 you chose. Your paycheck will stay small until the cushion grows.";
  }

  function render() {
    var p = st.profile;
    st.plan = E.plan(st.entries, { taxRate: p.tax_rate, riskLimit: p.risk_limit, startBuffer: p.savings });
    renderLog();
    preview();
    $("how-tax").textContent = pct(p.tax_rate);
    $("d-empty").hidden = !!st.plan;
    $("d-results").hidden = !st.plan;
    $("hero-cards").hidden = !st.plan;
    var bills = monthlyBills(p), wb = weekly(bills);
    if (!st.plan) {
      $("d-who").textContent = "Add a few weeks of pay and we'll work out your steady paycheck.";
      return;
    }
    var pl = st.plan, nx = pl.next;
    $("d-who").textContent = "Here's your steady paycheck for the week of " + fmtWeek(nx.week_start, true) + ".";
    $("ph-pay").textContent = money(nx.pay);
    $("ph-when").textContent = "Same amount you can plan around · " + SAFETY[p.risk_limit][0] + " setting";
    if (bills) {
      var gap = nx.pay - wb;
      $("k-bills").textContent = money(wb) + " / week";
      $("k-billsub").innerHTML = gap >= 0 ? '<span class="good">✓ Covered, with ' + money(gap) + " left over</span>" : '<span class="bad">Short by ' + money(-gap) + " a week</span>";
    } else {
      $("k-bills").textContent = "—";
      $("k-billsub").innerHTML = '<button type="button" class="linkbtn" id="k-addbills">Add your bills</button> to see if your paycheck covers them';
    }
    $("k-buf").textContent = money(nx.buffer_before);
    $("k-bufsub").textContent = nx.pay > 0 ? "Enough for about " + Math.max(0, nx.buffer_before / nx.pay).toFixed(1) + " paychecks" : "Rebuilding";
    var last = st.entries[st.entries.length - 1];
    $("k-tax").textContent = money(last.gross * p.tax_rate);
    $("k-taxsub").textContent = pct(p.tax_rate) + " of last week's pay";

    $("d-warn").innerHTML = pl.warnings.length ? '<p class="warn"><span class="ms">info</span>Some weeks are missing. Add them (even as $0) for a better paycheck.</p>' : "";
    $("ph-reason").textContent = plainReason(nx, p.risk_limit);
    $("ph-basis").textContent = "Based on your last " + Math.min(E.WINDOW, st.entries.length) + " weeks of pay." + (st.entries.length < 12 ? " Add more weeks for a better estimate." : "");
    drawChart();
  }

  // ---- Chart ---------------------------------------------------------------------------------------
  function niceTicks(min, max) {
    var span = max - min || 1, raw = span / 4, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var step = [1, 2, 2.5, 5, 10].map(function (k) { return k * mag; }).find(function (s) { return s >= raw; });
    var out = [], lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    if (hi === lo) hi = lo + step;
    for (var v = lo; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }
  function drawChart() {
    var pl = st.plan, el = $("c-pay");
    if (!pl || section() !== "home") return;
    var weeks = pl.weeks, n = weeks.length;
    if (n < 2) { el.innerHTML = '<p class="hint">The chart shows up after your 6th week.</p>'; return; }
    var series = [
      { color: "--ink2", dash: "5 4", values: weeks.map(function (w) { return w.net; }) },
      { color: "--keel", width: 3, values: weeks.map(function (w) { return w.pay_keel; }) }
    ];
    var all = series[0].values.concat(series[1].values, [0]);
    var ticks = niceTicks(Math.min.apply(null, all), Math.max.apply(null, all)), y0 = ticks[0], y1 = ticks[ticks.length - 1];
    var W = 760, H = 280, m = { l: 60, r: 14, t: 12, b: 30 };
    var X = function (i) { return m.l + i * (W - m.l - m.r) / (n - 1); };
    var Y = function (v) { return m.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - m.t - m.b); };
    var g = [];
    ticks.forEach(function (v) {
      g.push('<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + css("--grid") + '" stroke-dasharray="3 4"/>');
      g.push('<text x="' + (m.l - 10) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="12" fill="' + css("--muted") + '">' + money(v) + "</text>");
    });
    var nt = Math.min(n, 5);
    for (var t = 0; t < nt; t++) { var i = Math.round(t * (n - 1) / (nt - 1)); g.push('<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="' + (i === 0 ? "start" : i === n - 1 ? "end" : "middle") + '" font-size="12" fill="' + css("--muted") + '">' + fmtWeek(weeks[i].week_start, true) + "</text>"); }
    series.forEach(function (s) {
      var pts = s.values.map(function (v, i) { return X(i) + "," + Y(v); }).join(" ");
      g.push('<polyline class="ln" pathLength="1" points="' + pts + '" fill="none" stroke="' + css(s.color) + '" stroke-width="' + (s.width || 2) + '" stroke-linejoin="round"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : "") + "/>");
    });
    g.push('<line class="hv" x1="0" x2="0" y1="' + m.t + '" y2="' + (H - m.b) + '" stroke="' + css("--ink2") + '" stroke-dasharray="3 3" opacity="0"/>');
    el.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Your weekly pay after taxes and your steady Keel paycheck">' + g.join("") + '</svg><div class="tip" hidden></div>';
    var svg = el.querySelector("svg"), tip = el.querySelector(".tip"), hv = el.querySelector(".hv");
    svg.addEventListener("pointermove", function (e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W;
      var i = Math.max(0, Math.min(n - 1, Math.round((x - m.l) / ((W - m.l - m.r) / (n - 1))))), w = weeks[i];
      hv.setAttribute("x1", X(i)); hv.setAttribute("x2", X(i)); hv.setAttribute("opacity", ".6");
      tip.hidden = false;
      tip.innerHTML = "<b>Week of " + fmtWeek(w.week_start) + "</b><div><span>You earned</span><span>" + money(w.net) + "</span></div><div><span>Keel paid you</span><span>" + money(w.pay_keel) + "</span></div><div><span>" + (w.net >= w.pay_keel ? "Added to cushion" : "Taken from cushion") + "</span><span>" + money(Math.abs(w.net - w.pay_keel)) + "</span></div>";
      tip.style.left = Math.min(r.width - 200, Math.max(0, X(i) / W * r.width + 12)) + "px";
    });
    svg.addEventListener("pointerleave", function () { tip.hidden = true; hv.setAttribute("opacity", "0"); });
  }

  // ---- My weeks --------------------------------------------------------------------------------------
  function byWeekPlan() { var o = {}; (st.plan ? st.plan.weeks : []).forEach(function (w) { o[w.week_start] = w; }); return o; }
  function renderLog() {
    var tax = st.profile.tax_rate, pw = byWeekPlan();
    var list = st.entries.slice().reverse(), pages = Math.max(1, Math.ceil(list.length / PAGE));
    st.page = Math.min(st.page, pages - 1);
    var slice = list.slice(st.page * PAGE, st.page * PAGE + PAGE);
    if (!list.length) $("e-table").innerHTML = '<tbody><tr><td class="hint" style="padding:24px">No weeks yet. Add your first week above.</td></tr></tbody>';
    else $("e-table").innerHTML = '<thead><tr><th>Week of</th><th class="num">You earned</th><th class="num">Taxes</th><th class="num">Your paycheck</th><th class="num">Cushion</th><th>Note</th><th class="num"><span class="sr-only">Edit or delete</span></th></tr></thead><tbody>' +
      slice.map(function (e) {
        var w = pw[e.week_start];
        return "<tr><td><b>" + fmtWeek(e.week_start) + '</b></td><td class="num">' + money(e.gross) + '</td><td class="num hint">' + money(e.gross * tax) +
          '</td><td class="num">' + (w ? "<b>" + money(w.pay_keel) + "</b>" : '<span class="hint">—</span>') +
          '</td><td class="num">' + (w ? '<span class="' + (w.buf_keel < 0 ? "neg" : "") + '">' + money(w.buf_keel) + "</span>" : '<span class="hint">—</span>') +
          '</td><td class="notecell">' + esc(e.note) + '</td><td class="num"><span class="acts"><button type="button" class="iconbtn sm" data-edit="' + e.week_start + '" aria-label="Edit week of ' + fmtWeek(e.week_start) + '"><span class="ms">edit</span></button><button type="button" class="iconbtn sm del" data-del="' + e.week_start + '" aria-label="Delete week of ' + fmtWeek(e.week_start) + '"><span class="ms">delete</span></button></span></td></tr>';
      }).join("") + "</tbody>";
    $("e-foot").textContent = list.length + " week" + (list.length === 1 ? "" : "s") + " saved";
    $("e-page").textContent = pages > 1 ? "Page " + (st.page + 1) + " of " + pages : "";
    $("e-prev").hidden = $("e-next").hidden = pages <= 1;
    $("e-prev").disabled = st.page === 0;
    $("e-next").disabled = st.page >= pages - 1;
    resetClear();
  }
  $("e-prev").addEventListener("click", function () { st.page--; renderLog(); });
  $("e-next").addEventListener("click", function () { st.page++; renderLog(); });
  function reload() { return st.store.listEntries().then(function (list) { st.entries = list; render(); }); }

  function preview() {
    var g = num($("e-gross").value), tax = st.profile ? st.profile.tax_rate : 0.15;
    $("e-preview").innerHTML = g === null ? "" : "We'll set aside <b>" + money(g * tax) + "</b> for taxes. You keep <b>" + money(g * (1 - tax)) + "</b>.";
  }
  $("e-gross").addEventListener("input", function () { preview(); this.removeAttribute("aria-invalid"); msg("e-msg", ""); });

  $("e-week").value = E.addWeeks(E.mondayOf(today()), -1);
  $("f-entry").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var day = $("e-week").value, g = $("e-gross").value, n = Number(g);
    var okDay = /^\d{4}-\d{2}-\d{2}$/.test(day), okG = g !== "" && isFinite(n) && n >= 0 && n < 100000;
    if (!okDay) return msg("e-msg", "Please pick a day in that week.", "err");
    if (!okG) { $("e-gross").setAttribute("aria-invalid", "true"); return msg("e-msg", "Please enter an amount from $0 to $99,999.", "err"); }
    var ws = E.mondayOf(day);
    $("e-add").disabled = true;
    st.store.upsertEntries([{ week_start: ws, gross: Math.round(n * 100) / 100, note: $("e-note").value.trim().slice(0, 80) }])
      .then(reload).then(function () {
        $("e-add").disabled = false;
        toast("Saved the week of " + fmtWeek(ws) + ".");
        msg("e-msg", "");
        $("e-gross").value = ""; $("e-note").value = "";
        $("e-week").value = E.addWeeks(ws, 1);
        preview();
      }).catch(function (e) { $("e-add").disabled = false; msg("e-msg", "Couldn't save: " + e.message, "err"); });
  });

  $("e-table").addEventListener("click", function (ev) {
    var d = ev.target.closest("button[data-del]"), ed = ev.target.closest("button[data-edit]");
    if (d) { var ws = d.getAttribute("data-del"); st.store.deleteEntry(ws).then(reload).then(function () { toast("Deleted the week of " + fmtWeek(ws) + "."); }).catch(fail); }
    if (ed) {
      var e = st.entries.filter(function (x) { return x.week_start === ed.getAttribute("data-edit"); })[0];
      if (!e) return;
      $("e-week").value = e.week_start; $("e-gross").value = e.gross; $("e-note").value = e.note || "";
      preview();
      msg("e-msg", "Change the amount, then press Save week.");
      $("e-gross").focus();
      $("f-entry").scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });

  function addExample() {
    var hist = practiceWeeks(st.profile.job, st.profile.weekly_pay), have = {};
    st.entries.forEach(function (e) { have[e.week_start] = true; });
    var fresh = hist.filter(function (e) { return !have[e.week_start]; });
    st.store.upsertEntries(fresh).then(reload).then(function () { toast(fresh.length ? "Added " + fresh.length + " practice weeks." : "Practice weeks are already there."); }).catch(fail);
  }
  $("d-example1").addEventListener("click", addExample);
  $("d-example2").addEventListener("click", addExample);

  function resetClear() { $("clear-wrap").innerHTML = '<button type="button" class="btn danger" id="d-clear"' + (st.entries.length ? "" : " disabled") + ">Delete</button>"; }
  $("clear-wrap").addEventListener("click", function (ev) {
    var b = ev.target.closest("button"), id = b && b.id;
    if (id === "d-clear") {
      $("clear-wrap").innerHTML = '<span class="confirm"><span class="hint">Delete all ' + st.entries.length + " weeks?</span>" +
        '<button type="button" class="btn danger" id="d-clear-yes">Yes, delete</button><button type="button" class="btn quiet" id="d-clear-no">No, keep</button></span>';
      $("d-clear-no").focus();
    } else if (id === "d-clear-no") resetClear();
    else if (id === "d-clear-yes") st.store.clearEntries().then(reload).then(function () { toast("All weeks deleted."); }).catch(fail);
  });

  function exportLog() {
    if (!st.entries.length) return toast("Add a week first. There's nothing to download yet.");
    var pw = byWeekPlan(), tax = st.profile.tax_rate;
    var cols = ["week_start", "earned", "taxes_set_aside", "you_keep", "keel_paycheck", "cushion", "note"];
    var rows = st.entries.map(function (e) {
      var w = pw[e.week_start];
      return [e.week_start, e.gross, (e.gross * tax).toFixed(2), (e.gross * (1 - tax)).toFixed(2), w ? w.pay_keel.toFixed(2) : "", w ? w.buf_keel.toFixed(2) : "", e.note || ""];
    });
    var body = cols.join(",") + "\n" + rows.map(function (r) { return r.map(function (v) { v = String(v); return /^[=+\-@]/.test(v) && isNaN(Number(v)) ? "'" + v : v; }).map(function (v) { return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\n");
    var a = document.createElement("a"), name = "keel-my-weeks-" + today() + ".csv";
    a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast("Downloaded " + name);
  }

  // ---- Settings ------------------------------------------------------------------------------------
  function fillSettings() {
    var p = st.profile;
    st.draft = { tax_rate: p.tax_rate, risk_limit: p.risk_limit };
    $("s-name").value = p.display_name || "";
    $("s-job").value = J.byId(p.job) ? p.job : "other";
    $("s-pay").value = p.weekly_pay == null ? "" : p.weekly_pay;
    $("s-savings").value = p.savings == null ? "" : p.savings;
    taxSeg($("s-taxseg"), p.tax_rate);
    riskTiles($("s-risk"), p.risk_limit);
    var b = monthlyBills(p);
    $("s-bills").textContent = b ? money(b) + " a month (about " + money(weekly(b)) + " a week)" : "Not added yet.";
  }
  $("s-taxseg").addEventListener("click", function (ev) { var b = ev.target.closest("button[data-t]"); if (!b) return; st.draft.tax_rate = Number(b.getAttribute("data-t")); taxSeg($("s-taxseg"), st.draft.tax_rate); });
  $("s-risk").addEventListener("click", function (ev) { var b = ev.target.closest("button[data-r]"); if (!b) return; st.draft.risk_limit = Number(b.getAttribute("data-r")); riskTiles($("s-risk"), st.draft.risk_limit); });
  $("s-discard").addEventListener("click", function () { fillSettings(); toast("Changes undone."); });
  $("s-save").addEventListener("click", function () {
    var pay = $("s-pay").value, sav = $("s-savings").value;
    if ((pay !== "" && num(pay) === null) || (sav !== "" && num(sav) === null)) return toast("Please use numbers of 0 or more.");
    var p = Object.assign({}, st.profile, { display_name: $("s-name").value.trim().slice(0, 60), job: $("s-job").value, tax_rate: st.draft.tax_rate, risk_limit: st.draft.risk_limit, weekly_pay: num(pay), savings: num(sav) });
    $("s-save").disabled = true;
    st.store.saveProfile(p).then(function () { st.profile = p; $("s-save").disabled = false; openDash(); toast("Saved."); })
      .catch(function (e) { $("s-save").disabled = false; fail(e); });
  });

  // ---- Start -------------------------------------------------------------------------------------
  setAuthTab(/signup/.test(location.hash) ? "up" : "in");
  if (!accountsOn) $("a-off").hidden = false;  // the form stays visible; pressing it explains accounts are off
  function start() {
    if (getMode() === "guest") return begin(new S.GuestStore());
    if (!accountsOn) return show("v-signin");
    client.auth.getSession().then(function (res) {
      var s = res.data && res.data.session;
      if (s) startAccount(s.user); else show("v-signin");
    }).catch(function () { show("v-signin"); });
  }
  if (accountsOn) {
    client.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_OUT" && st.store && st.store.kind === "account") { st.store = null; show("v-signin"); }
      if (event === "SIGNED_IN" && session && !st.store) startAccount(session.user);  // back from Google
      if (event === "PASSWORD_RECOVERY") {
        var np = window.prompt("Choose a new password (8+ characters, with a letter and a number):");
        if (np && rules(np).len && rules(np).mix) client.auth.updateUser({ password: np }).then(function (r) { toast(r.error ? friendlyAuthError(r.error.message) : "Password changed."); });
        else if (np) toast("That password is too weak. Please try the reset link again.");
      }
    });
  }
  var redraw = function () { if (st.plan && !$("v-dash").hidden) drawChart(); };
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  var rt = null;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(redraw, 150); });
  start();
})();
