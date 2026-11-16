// node --test app/
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { paydayDate, paycheckSummary } = require("./paycheck.js");

const week = (n, o) => Object.assign({ week: n, week_start: "2025-10-20", gross: 600, net: 510, lo: 300, hi: 700, pay_keel: 400, buf_keel: 310, risk: 0.04 }, o);
const run = (weeks, limit) => ({ risk_limit: limit === undefined ? 0.05 : limit, weeks: weeks });

test("payday is the Friday of the week that starts on week_start", () => {
  assert.strictEqual(paydayDate("2025-10-20"), "2025-10-24");
  assert.strictEqual(paydayDate("2025-12-29"), "2026-01-02");
});

test("payday is null when week_start is missing or malformed", () => {
  assert.strictEqual(paydayDate(undefined), null);
  assert.strictEqual(paydayDate("next monday"), null);
});

test("buffer before payday is the end balance minus take-home plus the paycheck", () => {
  const s = paycheckSummary(run([week(1)]), 1);
  assert.strictEqual(s.bufferBefore, 200);
  assert.strictEqual(s.bufferAfter, 310);
  assert.strictEqual(s.bufferChange, 110);
  assert.strictEqual(s.flow, "replenish");
  assert.strictEqual(s.tax, 90);
});

test("status is within when the estimated risk fits the limit, including exactly at it", () => {
  assert.strictEqual(paycheckSummary(run([week(1, { risk: 0.05 })]), 1).status, "within");
  assert.strictEqual(paycheckSummary(run([week(1)]), 1).next, "steady");
});

test("status is over when the estimated risk is above the limit", () => {
  const s = paycheckSummary(run([week(1, { risk: 0.2 })]), 1);
  assert.strictEqual(s.status, "over");
  assert.strictEqual(s.next, "over_limit");
});

test("status is unknown, not assumed safe, when the risk is not in the file", () => {
  const s = paycheckSummary(run([week(1, { risk: undefined })]), 1);
  assert.strictEqual(s.status, "unknown");
  assert.strictEqual(s.next, "unknown");
});

test("next is rebuilding when the buffer is under the level the replay started with", () => {
  // week 1 opens at 200; week 2 opens at 150 after a draw
  const s = paycheckSummary(run([week(1, { net: 350, buf_keel: 150 }), week(2, { buf_keel: 260 })]), 2);
  assert.strictEqual(s.bufferTarget, 200);
  assert.strictEqual(s.bufferBefore, 150);
  assert.strictEqual(s.next, "rebuilding");
});

test("a week that earns less than the paycheck draws from the buffer", () => {
  const s = paycheckSummary(run([week(1, { net: 250, buf_keel: 50 })]), 1);
  assert.strictEqual(s.flow, "draw");
  assert.strictEqual(s.bufferChange, -150);
});

test("week is clamped to the replay and the last week is flagged", () => {
  const r = run([week(1), week(2)]);
  assert.strictEqual(paycheckSummary(r, 99).week, 2);
  assert.strictEqual(paycheckSummary(r, 99).isLast, true);
  assert.strictEqual(paycheckSummary(r, 0).week, 1);
});

test("returns null for a run with no weeks or missing money fields", () => {
  assert.strictEqual(paycheckSummary(run([]), 1), null);
  assert.strictEqual(paycheckSummary(null, 1), null);
  assert.strictEqual(paycheckSummary(run([week(1, { buf_keel: undefined })]), 1), null);
});

test("gross missing leaves tax null instead of guessing", () => {
  assert.strictEqual(paycheckSummary(run([week(1, { gross: undefined })]), 1).tax, null);
});
