// Where "My pay" keeps a person's profile and weekly pay.
// AccountStore: Supabase (signed-in accounts, rows protected by row level security).
// GuestStore: this browser only (localStorage), nothing leaves the device.
// Both return Promises with the same shapes:
//   profile: {display_name, job, tax_rate, risk_limit} or null
//   entries: [{week_start: "YYYY-MM-DD", gross: number, note: string}] sorted by week
"use strict";
(function (root) {
  var GUEST_KEY = "keel-mypay-guest-v1";

  function sortEntries(list) {
    return list.map(function (e) { return { week_start: e.week_start, gross: Number(e.gross), note: e.note || "" }; })
      .sort(function (a, b) { return a.week_start < b.week_start ? -1 : a.week_start > b.week_start ? 1 : 0; });
  }

  function GuestStore(storage) {
    this.kind = "guest";
    this.storage = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    this.memory = { profile: null, entries: [] };  // used when the browser blocks storage
  }
  GuestStore.prototype._read = function () {
    try {
      var s = JSON.parse(this.storage.getItem(GUEST_KEY));
      if (s && typeof s === "object") return { profile: s.profile || null, entries: Array.isArray(s.entries) ? s.entries : [] };
    } catch (e) { /* blocked or empty: fall back to memory */ }
    return this.memory;
  };
  GuestStore.prototype._write = function (s) {
    this.memory = s;
    try { this.storage.setItem(GUEST_KEY, JSON.stringify(s)); } catch (e) { /* keep in memory only */ }
  };
  GuestStore.prototype.getProfile = function () { return Promise.resolve(this._read().profile); };
  GuestStore.prototype.saveProfile = function (p) {
    var s = this._read(); s.profile = p; this._write(s); return Promise.resolve(p);
  };
  GuestStore.prototype.listEntries = function () { return Promise.resolve(sortEntries(this._read().entries)); };
  GuestStore.prototype.upsertEntries = function (list) {
    var s = this._read(), byWeek = {};
    s.entries.forEach(function (e) { byWeek[e.week_start] = e; });
    list.forEach(function (e) { byWeek[e.week_start] = { week_start: e.week_start, gross: Number(e.gross), note: e.note || "" }; });
    s.entries = sortEntries(Object.keys(byWeek).map(function (k) { return byWeek[k]; }));
    this._write(s);
    return Promise.resolve();
  };
  GuestStore.prototype.deleteEntry = function (weekStart) {
    var s = this._read();
    s.entries = s.entries.filter(function (e) { return e.week_start !== weekStart; });
    this._write(s);
    return Promise.resolve();
  };
  GuestStore.prototype.clearEntries = function () {
    var s = this._read(); s.entries = []; this._write(s); return Promise.resolve();
  };

  function AccountStore(client, user) {
    this.kind = "account";
    this.client = client;
    this.user = user;
  }
  function check(res) {
    if (res.error) throw new Error(res.error.message || "Database request failed");
    return res.data;
  }
  AccountStore.prototype.getProfile = function () {
    return this.client.from("profiles").select("display_name, job, tax_rate, risk_limit")
      .eq("id", this.user.id).maybeSingle().then(check)
      .then(function (p) { return p ? { display_name: p.display_name, job: p.job, tax_rate: Number(p.tax_rate), risk_limit: Number(p.risk_limit) } : null; });
  };
  AccountStore.prototype.saveProfile = function (p) {
    var row = { id: this.user.id, display_name: p.display_name, job: p.job, tax_rate: p.tax_rate, risk_limit: p.risk_limit, updated_at: new Date().toISOString() };
    return this.client.from("profiles").upsert(row).then(check).then(function () { return p; });
  };
  AccountStore.prototype.listEntries = function () {
    return this.client.from("pay_entries").select("week_start, gross, note")
      .eq("user_id", this.user.id).order("week_start").then(check).then(sortEntries);
  };
  AccountStore.prototype.upsertEntries = function (list) {
    var uid = this.user.id;
    var rows = list.map(function (e) { return { user_id: uid, week_start: e.week_start, gross: Number(e.gross), note: e.note || "" }; });
    return this.client.from("pay_entries").upsert(rows, { onConflict: "user_id,week_start" }).then(check);
  };
  AccountStore.prototype.deleteEntry = function (weekStart) {
    return this.client.from("pay_entries").delete().eq("user_id", this.user.id).eq("week_start", weekStart).then(check);
  };
  AccountStore.prototype.clearEntries = function () {
    return this.client.from("pay_entries").delete().eq("user_id", this.user.id).then(check);
  };

  var api = { GuestStore: GuestStore, AccountStore: AccountStore, sortEntries: sortEntries, GUEST_KEY: GUEST_KEY };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KeelStore = api;
})(typeof window !== "undefined" ? window : this);
