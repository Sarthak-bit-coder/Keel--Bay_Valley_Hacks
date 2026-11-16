// Run from the repo root: node --test app/store.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("./store.js");

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test("guest store saves profile and weeks, replacing a week instead of duplicating it", async () => {
  const storage = memoryStorage();
  const g = new S.GuestStore(storage);
  assert.equal(await g.getProfile(), null);
  await g.saveProfile({ display_name: "Sam", job: "gardener", tax_rate: 0.15, risk_limit: 0.05 });
  await g.upsertEntries([{ week_start: "2025-01-13", gross: "500" }, { week_start: "2025-01-06", gross: 400, note: "x" }]);
  await g.upsertEntries([{ week_start: "2025-01-13", gross: 650 }]);
  const again = new S.GuestStore(storage); // a reload
  assert.deepEqual(await again.getProfile(), { display_name: "Sam", job: "gardener", tax_rate: 0.15, risk_limit: 0.05 });
  assert.deepEqual(await again.listEntries(), [
    { week_start: "2025-01-06", gross: 400, note: "x" },
    { week_start: "2025-01-13", gross: 650, note: "" }
  ]);
  await again.deleteEntry("2025-01-06");
  assert.equal((await again.listEntries()).length, 1);
  await again.clearEntries();
  assert.deepEqual(await again.listEntries(), []);
});

test("guest store still works when the browser blocks storage", async () => {
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const g = new S.GuestStore(blocked);
  await g.upsertEntries([{ week_start: "2025-01-06", gross: 100 }]);
  assert.equal((await g.listEntries()).length, 1);
});

test("guest store ignores a corrupted saved value", async () => {
  const storage = memoryStorage();
  storage.setItem(S.GUEST_KEY, "{not json");
  const g = new S.GuestStore(storage);
  assert.equal(await g.getProfile(), null);
  assert.deepEqual(await g.listEntries(), []);
});

test("account store sends the user's id on every write and filters reads by it", async () => {
  const calls = [];
  const q = (table) => {
    const c = { table, ops: [] };
    calls.push(c);
    const chain = {
      select(x) { c.ops.push(["select", x]); return chain; },
      eq(k, v) { c.ops.push(["eq", k, v]); return chain; },
      order(k) { c.ops.push(["order", k]); return chain; },
      maybeSingle() { c.ops.push(["maybeSingle"]); return chain; },
      upsert(rows, o) { c.ops.push(["upsert", rows, o]); return chain; },
      delete() { c.ops.push(["delete"]); return chain; },
      then(res) { return Promise.resolve({ data: c.ops.some((o) => o[0] === "maybeSingle") ? null : [], error: null }).then(res); }
    };
    return chain;
  };
  const a = new S.AccountStore({ from: q }, { id: "u1" });
  await a.getProfile();
  await a.listEntries();
  await a.upsertEntries([{ week_start: "2025-01-06", gross: "12.5" }]);
  await a.deleteEntry("2025-01-06");
  await a.clearEntries();
  await a.saveProfile({ display_name: "", job: "tutor", tax_rate: 0.15, risk_limit: 0.1 });
  assert.deepEqual(calls[0].ops.find((o) => o[0] === "eq"), ["eq", "id", "u1"]);
  assert.deepEqual(calls[1].ops.find((o) => o[0] === "eq"), ["eq", "user_id", "u1"]);
  const up = calls[2].ops.find((o) => o[0] === "upsert");
  assert.deepEqual(up[1], [{ user_id: "u1", week_start: "2025-01-06", gross: 12.5, note: "" }]);
  assert.deepEqual(up[2], { onConflict: "user_id,week_start" });
  assert.ok(calls[3].ops.some((o) => o[0] === "eq" && o[1] === "user_id"));
  assert.ok(calls[4].ops.some((o) => o[0] === "eq" && o[1] === "user_id"));
  assert.equal(calls[5].ops.find((o) => o[0] === "upsert")[1].id, "u1");
});

test("account store turns a database error into a thrown Error", async () => {
  const chain = { select() { return chain; }, eq() { return chain; }, order() { return chain; },
    then(res, rej) { return Promise.resolve({ data: null, error: { message: "permission denied" } }).then(res, rej); } };
  const a = new S.AccountStore({ from: () => chain }, { id: "u1" });
  await assert.rejects(a.listEntries(), /permission denied/);
});
