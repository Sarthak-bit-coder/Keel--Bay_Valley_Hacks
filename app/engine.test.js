// Run from the repo root: node --test app/engine.test.js
// app/engine.fixture.json comes from python tests/make_engine_fixture.py (the real src/policy code).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const E = require("./engine.js");
const J = require("./jobs.js");

const FX = JSON.parse(fs.readFileSync(path.join(__dirname, "engine.fixture.json"), "utf8"));
const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("payKeel matches Python pay_keel on every case", () => {
  for (const c of FX.pay_keel_cases) {
    const [pay, risk] = E.payKeel(c.buffer, E.drawsFromBand(c.lo, c.mid, c.hi, FX.z), c.alpha, c.top);
    assert.equal(pay, c.pay, JSON.stringify(c));
    close(risk, c.risk);
  }
});

test("with the same buffer, a looser risk limit never pays less", () => {
  const draws = E.drawsFromBand(300, 700, 950, FX.z);
  for (const buffer of [0, 250, 900]) {
    const pays = [0.01, 0.05, 0.1, 0.2].map((a) => E.payKeel(buffer, draws, a, 1200)[0]);
    for (let k = 1; k < pays.length; k++) assert.ok(pays[k] >= pays[k - 1], `buffer ${buffer}: ${pays}`);
  }
});

test("payKeel rejects a bad risk limit", () => {
  assert.throws(() => E.payKeel(0, [[1]], 1.5, 10));
});

test("plan() replays exactly like Python replay()", () => {
  const R = FX.replay;
  const p = E.plan(R.entries, { taxRate: R.tax, riskLimit: R.alpha, z: FX.z });
  close(p.b0, R.b0);
  assert.equal(p.weeks.length, R.pay.keel.length);
  p.weeks.forEach((w, t) => {
    for (const r of ["keel", "avg4", "last"]) {
      close(w["pay_" + r], R.pay[r][t]);
      close(w["buf_" + r], R.buf[r][t]);
    }
    close(w.risk, R.risk[t]);
    close(w.lo, R.lo[t]);
    close(w.hi, R.hi[t]);
    assert.equal(w.reason, R.reasons[t]);
  });
});

test("plan() money adds up every week and checks pass", () => {
  const R = FX.replay;
  const p = E.plan(R.entries, { taxRate: R.tax, riskLimit: R.alpha, z: FX.z });
  assert.equal(p.checks.identity, true);
  assert.equal(p.checks.pay_nonnegative, true);
  assert.ok(p.next.pay >= 0 && p.next.risk >= 0 && p.next.risk <= 1);
  assert.equal(p.next.week_start, "2025-05-26");
});

test("plan() needs 4 weeks and flags missing weeks", () => {
  assert.equal(E.plan([{ week_start: "2025-01-06", gross: 500 }]), null);
  const p = E.plan([
    { week_start: "2025-01-06", gross: 500 }, { week_start: "2025-01-13", gross: 600 },
    { week_start: "2025-01-27", gross: 700 }, { week_start: "2025-02-03", gross: 650 },
    { week_start: "2025-02-10", gross: 640 }
  ]);
  assert.equal(p.warnings.length, 1);
  assert.match(p.warnings[0], /2025-01-13 and 2025-01-27/);
});

test("plan() is the same for any entry order and seed is fixed", () => {
  const R = FX.replay;
  const a = E.plan(R.entries, { seed: 7 });
  const b = E.plan(R.entries.slice().reverse(), { seed: 7 });
  assert.deepEqual(a, b);
});

test("forecast is ordered low <= middle <= high", () => {
  const f = E.forecast([100, 900, 300, 700, 0, 500]);
  assert.ok(f.lo <= f.mid && f.mid <= f.hi);
  assert.equal(E.forecast([1, 2, 3]), null);
});

test("quantile matches numpy linear method", () => {
  close(E.quantile([1, 2, 3, 4], 0.1), 1.3);
  close(E.quantile([5], 0.9), 5);
});

test("mondayOf and addWeeks", () => {
  assert.equal(E.mondayOf("2025-11-15"), "2025-11-10"); // Saturday
  assert.equal(E.mondayOf("2025-11-10"), "2025-11-10"); // Monday
  assert.equal(E.mondayOf("2025-11-16"), "2025-11-10"); // Sunday
  assert.equal(E.addWeeks("2025-12-29", 1), "2026-01-05");
});

test("reason text matches the Python wording when over the limit", () => {
  assert.equal(E.reason(0, 0.3, 0.05, 4),
    "Paid $0: even with no paycheck the chance of running dry in the next 4 weeks is about 30%, above the 5% limit.");
});

test("every job's example history is 26 Monday weeks, non-negative, repeatable", () => {
  for (const job of J.JOBS) {
    assert.equal(job.season.length, 12, job.id);
    const h = J.exampleHistory(job.id, "2026-11-15", 26, E);
    assert.equal(h.length, 26);
    assert.equal(h[25].week_start, "2026-11-02");
    h.forEach((w, k) => {
      assert.ok(w.gross >= 0);
      assert.equal(E.mondayOf(w.week_start), w.week_start);
      if (k) assert.equal(E.addWeeks(h[k - 1].week_start, 1), w.week_start);
    });
    assert.deepEqual(h, J.exampleHistory(job.id, "2026-11-15", 26, E));
    assert.ok(E.plan(h), job.id);
  }
});

test("shape labels", () => {
  assert.equal(E.shape([500, 500, 500]).label, "fairly steady");
  assert.equal(E.shape([0, 1000, 0, 1000]).label, "very uneven");
  assert.equal(E.shape([1000, 0]).zero_weeks, 1);
});
