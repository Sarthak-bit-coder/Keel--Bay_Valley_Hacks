// Device accounts (app/localauth.js): passwords never stored, wrong passwords rejected, data encrypted at rest,
// one account can't read another's data. Run: node --test app/localauth.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), dump: () => [...m.values()].join("\n") }; }
function load() {
  const local = fakeStorage(), session = fakeStorage();
  global.window = { crypto: globalThis.crypto, localStorage: local, sessionStorage: session, KeelStore: require("./store.js") };
  delete require.cache[path.join(__dirname, "localauth.js")];
  require("./localauth.js");
  return { LA: global.window.KeelLocalAuth, local, session };
}

test("sign up stores a hash, never the password, and encrypts the person's data", async () => {
  const { LA, local } = load();
  const s = await LA.signUp("Sam@Example.com", "keelpass1");
  await s.saveProfile({ display_name: "Sam", job: "driver", tax_rate: 0.15, risk_limit: 0.05, savings: 1234 });
  await s.upsertEntries([{ week_start: "2025-01-06", gross: 987.65 }]);
  const all = local.dump();
  assert.doesNotMatch(all, /keelpass1/);
  assert.doesNotMatch(all, /987\.65|Sam"|1234/);
  assert.match(all, /"iv"/);
});

test("log in works with the right password and fails with a wrong one", async () => {
  const { LA } = load();
  const a = await LA.signUp("a@x.io", "rightpass1");
  await a.saveProfile({ display_name: "A", job: "tutor", tax_rate: 0.2, risk_limit: 0.1 });
  const again = await LA.logIn("A@x.io ", "rightpass1");
  assert.equal((await again.getProfile()).display_name, "A");
  await assert.rejects(LA.logIn("a@x.io", "wrongpass1"), /Invalid login credentials/);
  await assert.rejects(LA.logIn("nobody@x.io", "whatever1"), /Invalid login credentials/);
});

test("the same email can't sign up twice, and accounts don't share data", async () => {
  const { LA } = load();
  const a = await LA.signUp("a@x.io", "rightpass1");
  await a.upsertEntries([{ week_start: "2025-01-06", gross: 100 }]);
  await assert.rejects(LA.signUp("a@x.io", "otherpass1"), /already registered/);
  const b = await LA.signUp("b@x.io", "rightpass2");
  assert.deepEqual(await b.listEntries(), []);
});

test("sign out forgets the unlock key", async () => {
  const { LA, session } = load();
  await LA.signUp("a@x.io", "rightpass1");
  assert.ok(session.getItem("keel-local-session-v1"));
  LA.signOut();
  assert.equal(session.getItem("keel-local-session-v1"), null);
  assert.equal(await LA.resume(), null);
});
