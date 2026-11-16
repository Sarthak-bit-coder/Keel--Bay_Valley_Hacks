// Accounts that work with no server: sign up with email + password, or Google, saved on this device.
// Used by My pay when no Supabase project is set in app/config.js (with Supabase, accounts live in the cloud).
//
// Security:
//  - Passwords are never stored. We keep a salted PBKDF2-SHA256 hash (250,000 rounds) to check them.
//  - Each email account's data is encrypted with AES-GCM using a key made from the password, so someone
//    reading this browser's storage can't read the weeks or money details.
//  - Google sign-in uses Google Identity Services; the page reads the name and email from Google's token.
//    With no server, the token is not verified by a backend, so these are device accounts, not cloud accounts.
//  - The unlock key lives in sessionStorage only (gone when the tab closes).
"use strict";
(function (root) {
  var REG = "keel-local-accounts-v1", DATA = "keel-local-data-v1:", SESSION = "keel-local-session-v1";
  var ITER = 250000, enc = new TextEncoder(), dec = new TextDecoder();
  var subtle = root.crypto && root.crypto.subtle;

  function ls() { try { return root.localStorage; } catch (e) { return null; } }
  function ss() { try { return root.sessionStorage; } catch (e) { return null; } }
  function readJSON(store, k, dflt) { try { var v = JSON.parse(store.getItem(k)); return v == null ? dflt : v; } catch (e) { return dflt; } }
  function b64(buf) { var s = "", a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function rand(n) { var a = new Uint8Array(n); root.crypto.getRandomValues(a); return a; }
  function norm(email) { return String(email || "").trim().toLowerCase(); }
  function err(m) { return Promise.reject(new Error(m)); }

  function pbkdf2(pass, salt, iter) {
    return subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits", "deriveKey"]).then(function (base) {
      return Promise.all([
        subtle.deriveBits({ name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" }, base, 256),
        subtle.deriveKey({ name: "PBKDF2", salt: new Uint8Array([].concat(Array.from(salt), [1, 2, 3, 4])), iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
      ]);
    });
  }
  function same(a, b) { if (a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

  // One person's data. key = AES key (email accounts) or null (Google accounts).
  function LocalStore(id, email, key) {
    this.kind = "local"; this.id = id; this.email = email; this.key = key;
    this.state = { profile: null, entries: [] };
  }
  LocalStore.prototype.load = function () {
    var self = this, raw = readJSON(ls(), DATA + this.id, null);
    if (!raw) return Promise.resolve(self);
    if (!raw.iv) { self.state = raw; return Promise.resolve(self); }
    return subtle.decrypt({ name: "AES-GCM", iv: unb64(raw.iv) }, self.key, unb64(raw.ct)).then(function (pt) { self.state = JSON.parse(dec.decode(pt)); return self; });
  };
  LocalStore.prototype._save = function () {
    var self = this, body = JSON.stringify(this.state);
    if (!this.key) { ls().setItem(DATA + this.id, body); return Promise.resolve(); }
    var iv = rand(12);
    return subtle.encrypt({ name: "AES-GCM", iv: iv }, this.key, enc.encode(body)).then(function (ct) {
      ls().setItem(DATA + self.id, JSON.stringify({ iv: b64(iv), ct: b64(ct) }));
    });
  };
  LocalStore.prototype.getProfile = function () { return Promise.resolve(this.state.profile); };
  LocalStore.prototype.saveProfile = function (p) { this.state.profile = p; return this._save().then(function () { return p; }); };
  LocalStore.prototype.listEntries = function () { return Promise.resolve(root.KeelStore.sortEntries(this.state.entries)); };
  LocalStore.prototype.upsertEntries = function (list) {
    var by = {};
    this.state.entries.forEach(function (e) { by[e.week_start] = e; });
    list.forEach(function (e) { by[e.week_start] = { week_start: e.week_start, gross: Number(e.gross), note: e.note || "" }; });
    this.state.entries = Object.keys(by).map(function (k) { return by[k]; });
    return this._save();
  };
  LocalStore.prototype.deleteEntry = function (ws) { this.state.entries = this.state.entries.filter(function (e) { return e.week_start !== ws; }); return this._save(); };
  LocalStore.prototype.clearEntries = function () { this.state.entries = []; return this._save(); };

  function remember(id, email, key) {
    var put = function (jwk) { try { ss().setItem(SESSION, JSON.stringify({ id: id, email: email, jwk: jwk })); } catch (e) { /* tab-only */ } };
    return key ? subtle.exportKey("jwk", key).then(put) : Promise.resolve(put(null));
  }
  function open(id, email, key) { var s = new LocalStore(id, email, key); return remember(id, email, key).then(function () { return s.load(); }); }

  var api = {
    available: !!(subtle && ls()),
    signUp: function (email, pass) {
      email = norm(email);
      var reg = readJSON(ls(), REG, {});
      if (reg[email]) return err("User already registered");
      var salt = rand(16);
      return pbkdf2(pass, salt, ITER).then(function (r) {
        reg[email] = { salt: b64(salt), hash: b64(r[0]), iter: ITER, id: "e-" + b64(rand(9)).replace(/[^A-Za-z0-9]/g, "") };
        ls().setItem(REG, JSON.stringify(reg));
        return open(reg[email].id, email, r[1]);
      });
    },
    logIn: function (email, pass) {
      email = norm(email);
      var a = readJSON(ls(), REG, {})[email];
      if (!a) return err("Invalid login credentials");
      return pbkdf2(pass, unb64(a.salt), a.iter).then(function (r) {
        if (!same(b64(r[0]), a.hash)) throw new Error("Invalid login credentials");
        return open(a.id, email, r[1]);
      });
    },
    google: function (credential) {
      var p = JSON.parse(dec.decode(unb64(credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(credential.split(".")[1].length / 4) * 4, "="))));
      if (!p.sub) return err("Google sign-in failed");
      return open("g-" + p.sub, p.email || "", null).then(function (s) { s.googleName = p.given_name || p.name || ""; return s; });
    },
    resume: function () {
      var s = readJSON(ss(), SESSION, null);
      if (!s) return Promise.resolve(null);
      var key = s.jwk ? subtle.importKey("jwk", s.jwk, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]) : Promise.resolve(null);
      return key.then(function (k) { var st = new LocalStore(s.id, s.email, k); return st.load(); }).catch(function () { return null; });
    },
    signOut: function () { try { ss().removeItem(SESSION); } catch (e) { /* ignore */ } }
  };
  root.KeelLocalAuth = api;
})(window);
