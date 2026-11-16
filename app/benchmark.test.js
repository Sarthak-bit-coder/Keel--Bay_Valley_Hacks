// Run from the repo root: node --test app/benchmark.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const B = require("./benchmark.js");

const run = () => ({
  weeks: [
    { pay_keel: 500, pay_avg4: 600, pay_last: 400, buf_keel: 200, buf_avg4: 100, buf_last: 300 },
    { pay_keel: 520, pay_avg4: 560, pay_last: 700, buf_keel: 150, buf_avg4: -50, buf_last: -100 },
    { pay_keel: 510, pay_avg4: 580, pay_last: 300, buf_keel: 180, buf_avg4: -30, buf_last: 50 }
  ],
  metrics: { avg_pay: { keel: 510, avg4: 580, last: 467 }, pay_swing: { keel: 20, avg4: 40, last: 400 }, overdraft_weeks: { keel: 0, avg4: 2, last: 1 } }
});
const row = (rows, id) => rows.find((r) => r.id === id);

test("computes change, lowest buffer and shortfall from weekly values", () => {
  const m = B.policyMetrics(run(), "avg4");
  assert.equal(m.avgChange, 30); assert.equal(m.lowestBuffer, -50); assert.equal(m.shortfall, 80);
  assert.equal(B.policyMetrics(run(), "keel").shortfall, 0);
});

test("marks where Keel is better and where it is worse", () => {
  const rows = B.benchmark(run());
  assert.equal(row(rows, "avgPay").vsAvg4, "worse"); assert.equal(row(rows, "avgPay").vsLast, "better");
  assert.equal(row(rows, "emptyWeeks").vsAvg4, "better"); assert.equal(row(rows, "shortfall").vsLast, "better");
  assert.equal(row(rows, "paySwing").vsLast, "better");
});

test("ties are ties", () => {
  const r = run(); r.metrics.overdraft_weeks.avg4 = 0;
  assert.equal(row(B.benchmark(r), "emptyWeeks").vsAvg4, "tie");
});

test("missing metrics stay null and are not compared", () => {
  const r = run(); delete r.metrics.pay_swing; r.weeks[1].buf_last = undefined;
  const rows = B.benchmark(r);
  assert.equal(row(rows, "paySwing").keel, null); assert.equal(row(rows, "paySwing").vsAvg4, null);
  assert.equal(row(rows, "lowestBuffer").last, null); assert.equal(row(rows, "lowestBuffer").vsLast, null);
  const t = B.tally({ runs: [r] });
  assert.equal(t.paySwing.missing, 1); assert.equal(t.emptyWeeks.beatsBoth, 1);
});

for (const f of ["../outputs/sample/results.json", "../outputs/results.json"]) {
  const p = path.join(__dirname, f);
  test("data consistency: computed values agree with stored metrics in " + f, { skip: !fs.existsSync(p) }, () => {
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const r of data.runs) for (const pol of B.POLICIES) {
      const m = B.policyMetrics(r, pol), buf = r.weeks.map((w) => w["buf_" + pol]);
      assert.equal(m.lowestBuffer < 0, buf.some((b) => b < 0));
      assert.equal(m.emptyWeeks, r.metrics.overdraft_weeks[pol]);
      assert.ok(m.shortfall >= 0);
      if (m.emptyWeeks === 0) assert.equal(m.shortfall, 0, r.driver + r.scenario + pol);
    }
    const t = B.tally(data);
    for (const k in t) assert.ok(t[k].beatsBoth + t[k].losesToOne + t[k].missing <= t[k].runs);
  });
}
