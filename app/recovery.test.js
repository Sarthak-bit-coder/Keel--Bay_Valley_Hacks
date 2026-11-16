// Run from the repo root: node --test app/recovery.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = require("./recovery.js");

// Opening buffer = 300 - 500 + 500 = 300 in every run below.
const run = (bufs) => ({ weeks: bufs.map((b, i) => ({ week: i + 1, net: 500, pay_keel: 500, buf_keel: b })) });

test("dip then recovery: counts weeks from the lowest point back to the target", () => {
  const r = R.bufferRecovery(run([300, 100, 50, 200, 320]));
  assert.equal(r.target, 300); assert.equal(r.lowest, 50); assert.equal(r.lowWeek, 3);
  assert.equal(r.status, "recovered"); assert.equal(r.recoveredWeek, 5); assert.equal(r.weeksToRecover, 2);
  assert.equal(r.current, 320); assert.equal(r.empty, false);
});

test("never below the target", () => {
  const r = R.bufferRecovery(run([300, 400, 350]));
  assert.equal(r.status, "never_below"); assert.equal(r.weeksToRecover, 0);
});

test("empty / negative buffer that does not recover is unreachable, not guessed", () => {
  const r = R.bufferRecovery(run([300, -120, 0, 150]));
  assert.equal(r.empty, true); assert.equal(r.status, "not_recovered");
  assert.equal(r.weeksToRecover, null); assert.equal(r.recoveredWeek, null);
});

test("lowest point in the last week cannot have recovered", () => {
  assert.equal(R.bufferRecovery(run([300, 250, 100])).status, "not_recovered");
});

test("missing data gives null", () => {
  assert.equal(R.bufferRecovery(null), null);
  assert.equal(R.bufferRecovery({ weeks: [] }), null);
  assert.equal(R.bufferRecovery({ weeks: [{ week: 1, net: 1, pay_keel: 1 }] }), null);
});

test("recoveryCompare: one row per run of the driver, sorted by scenario then risk", () => {
  const SAMPLE = JSON.parse(fs.readFileSync(path.join(__dirname, "../outputs/sample/results.json"), "utf8"));
  const rows = R.recoveryCompare(SAMPLE, "A");
  assert.equal(rows.length, SAMPLE.runs.filter((r) => r.driver === "A").length);
  rows.forEach((x) => assert.ok(x.rec && typeof x.avgPay === "number"));
  for (let i = 1; i < rows.length; i++) if (rows[i].scenario === rows[i - 1].scenario) assert.ok(rows[i].risk > rows[i - 1].risk);
});
