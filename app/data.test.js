// Run from the repo root: node --test app/data.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const K = require("./data.js");

const SAMPLE = JSON.parse(fs.readFileSync(path.join(__dirname, "../outputs/sample/results.json"), "utf8"));
const clone = (x) => JSON.parse(JSON.stringify(x));

// Fake fetch: maps url -> {status, body}; unknown urls are 404.
function fakeFetch(table) {
  return (url) => {
    const hit = table[url];
    if (!hit) return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error("no body")) });
    if (hit.throws) return Promise.reject(new TypeError("Failed to fetch"));
    return Promise.resolve({ ok: hit.status === undefined || hit.status < 400, status: hit.status || 200, json: () => (hit.badJson ? Promise.reject(new SyntaxError("Unexpected token")) : Promise.resolve(hit.body)) });
  };
}
const [REAL, TOY] = K.SOURCES;

test("sample file passes validation", () => {
  assert.deepEqual(K.validate(SAMPLE), []);
});

test("loads the real file when it exists and is valid", async () => {
  const real = clone(SAMPLE); real.meta.model = "real";
  const res = await K.loadData(fakeFetch({ [REAL]: { body: real }, [TOY]: { body: SAMPLE } }));
  assert.equal(res.url, REAL);
  assert.equal(res.data.meta.model, "real");
  assert.deepEqual(res.skipped, []);
});

test("falls back to the toy sample when the real file is missing", async () => {
  const res = await K.loadData(fakeFetch({ [TOY]: { body: SAMPLE } }));
  assert.equal(res.url, TOY);
  assert.match(res.skipped[0].reason, /HTTP 404/);
});

test("a malformed real file is skipped with its reason, not silently replaced", async () => {
  const broken = clone(SAMPLE); delete broken.runs[0].weeks[0].pay_keel;
  const res = await K.loadData(fakeFetch({ [REAL]: { body: broken }, [TOY]: { body: SAMPLE } }));
  assert.equal(res.url, TOY);
  assert.match(res.skipped[0].reason, /invalid: .*pay_keel/);
});

test("bad JSON and network errors fall through; all failing rejects with reasons", async () => {
  await assert.rejects(K.loadData(fakeFetch({ [REAL]: { badJson: true }, [TOY]: { throws: true } })), (e) => {
    assert.equal(e.skipped.length, 2);
    assert.match(e.skipped[0].reason, /Unexpected token/);
    assert.match(e.skipped[1].reason, /Failed to fetch/);
    return true;
  });
});

test("validate reports missing pieces", () => {
  assert.deepEqual(K.validate(null), ["file is not a JSON object"]);
  assert.match(K.validate({ meta: {}, runs: [] })[0], /runs is missing or empty/);
  const short = clone(SAMPLE); short.runs[0].weeks = short.runs[0].weeks.slice(0, 1);
  assert.match(K.validate(short).join(), /at least 2 weeks/);
  const noMetrics = clone(SAMPLE); delete noMetrics.runs[1].metrics;
  assert.match(K.validate(noMetrics).join(), /missing metrics/);
});

test("findRun matches driver, scenario and float risk limit", () => {
  const r = K.findRun(SAMPLE, "B", "storm", 0.1);
  assert.equal(r.driver, "B"); assert.equal(r.scenario, "storm"); assert.equal(r.risk_limit, 0.1);
  assert.equal(K.findRun(SAMPLE, "Z", "storm", 0.1), undefined);
  assert.equal(K.findRun(SAMPLE, "A", "storm", 0.5), undefined);
});

test("options come from the file", () => {
  const o = K.options(SAMPLE);
  assert.deepEqual(o.drivers.map((d) => d.id), ["A", "B", "C"]);
  assert.deepEqual(o.risks, [0.01, 0.05, 0.1, 0.2]);
  assert.deepEqual(o.scenarios.sort(), ["normal", "storm"]);
});

test("storm weeks: explicit field wins, toy falls back, real without field gets none", () => {
  const storm = K.findRun(SAMPLE, "A", "storm", 0.05), normal = K.findRun(SAMPLE, "A", "normal", 0.05);
  assert.deepEqual(K.stormWeeks(storm, { model: "toy" }), [12, 13]);
  assert.deepEqual(K.stormWeeks(normal, { model: "toy" }), []);
  assert.deepEqual(K.stormWeeks(storm, { model: "real" }), []);
  assert.deepEqual(K.stormWeeks({ ...storm, storm_weeks: [3, 4, 99] }, { model: "real" }), [3, 4]);
  // A short real replay must not shade past its end.
  assert.deepEqual(K.stormWeeks({ ...storm, weeks: storm.weeks.slice(0, 10) }, { model: "toy" }), []);
});

test("whatIf lists every scenario and limit for a driver, copied from the runs", () => {
  const rows = K.whatIf(SAMPLE, "C");
  assert.equal(rows.length, 8);
  assert.deepEqual(rows.map((r) => r.scenario + r.risk), ["normal0.01", "normal0.05", "normal0.1", "normal0.2", "storm0.01", "storm0.05", "storm0.1", "storm0.2"]);
  const run = K.findRun(SAMPLE, "C", "storm", 0.05), row = rows[5];
  assert.equal(row.avgPay, run.metrics.avg_pay.keel);
  assert.equal(row.emptyAvg4, run.metrics.overdraft_weeks.avg4);
  assert.equal(row.weeks, run.weeks.length);
  assert.deepEqual(K.whatIf(SAMPLE, "Z"), []);
});

test("fromRun keeps the replay length from the data", () => {
  const run = clone(K.findRun(SAMPLE, "A", "storm", 0.05));
  run.weeks = run.weeks.slice(0, 9);
  const R = K.fromRun(run);
  assert.equal(R.net.length, 9);
  assert.equal(R.log.length, 9);
});

test("paycheckChoices: one option per risk limit, values copied from that run's week", () => {
  const d = clone(SAMPLE);
  const opts = K.paycheckChoices(d, "A", "storm", 2);
  const limits = d.runs.filter((r) => r.driver === "A" && r.scenario === "storm").map((r) => r.risk_limit).sort((a, b) => a - b);
  assert.deepEqual(opts.map((o) => o.riskLimit), limits);
  for (const o of opts) {
    const w = K.findRun(d, "A", "storm", o.riskLimit).weeks[1];
    assert.equal(o.pay, w.pay_keel);
    assert.equal(o.risk, w.risk);
    assert.equal(o.bufferAfter, w.buf_keel);
    assert.ok(Math.abs(o.bufferBefore + w.net - w.pay_keel - w.buf_keel) < 1e-9);
    assert.equal(o.reason, w.reason);
  }
});

test("paycheckChoices: a missing risk estimate stays null, never invented", () => {
  const d = clone(SAMPLE);
  delete K.findRun(d, "A", "storm", 0.05).weeks[0].risk;
  const o = K.paycheckChoices(d, "A", "storm", 1).find((x) => x.riskLimit === 0.05);
  assert.equal(o.risk, null);
});

test("paycheckChoices: weeks past the end of a run and unknown drivers give no options", () => {
  const d = clone(SAMPLE);
  assert.deepEqual(K.paycheckChoices(d, "A", "storm", 9999), []);
  assert.deepEqual(K.paycheckChoices(d, "Z", "storm", 1), []);
});

test("paycheckChoices works on the real results file when it is present", { skip: !fs.existsSync(path.join(__dirname, "../outputs/results.json")) }, () => {
  const real = JSON.parse(fs.readFileSync(path.join(__dirname, "../outputs/results.json"), "utf8"));
  assert.deepEqual(K.validate(real), []);
  const opts = K.paycheckChoices(real, "A", "storm", 1);
  assert.equal(opts.length, 4);
  assert.ok(opts.every((o) => typeof o.risk === "number" && o.risk <= o.riskLimit + 1e-9), "estimated risk stays within its limit");
});

const REAL_PATH = path.join(__dirname, "../outputs/results.json");
const CAL_PATH = path.join(__dirname, "../outputs/calibration.json");
const tiny = (weeks) => ({ meta: { model: "real" }, runs: [
  { driver: "A", scenario: "normal", risk_limit: 0.05, weeks },
  { driver: "A", scenario: "storm", risk_limit: 0.05, weeks: [{ week: 1, net: 0, lo: 100, hi: 200 }] }] });

test("reliability: counts below / inside / above and miss sizes from stored forecasts only", () => {
  const r = K.reliability(tiny([
    { week: 1, net: 50, lo: 100, hi: 200 },   // below by 50
    { week: 2, net: 150, lo: 100, hi: 200 },  // inside
    { week: 3, net: 260, lo: 100, hi: 200 },  // above by 60
    { week: 4, net: 120, lo: 100, hi: 200 }]), { target_low_case: 0.9 });
  assert.equal(r.overall.n, 4, "storm runs are excluded");
  assert.equal(r.overall.lowHit, 0.75);
  assert.equal(r.overall.highHit, 0.75);
  assert.equal(r.overall.bandHit, 0.5);
  assert.equal(r.overall.meanWidth, 100);
  assert.equal(r.overall.meanMiss, 55);
  assert.deepEqual(r.worst.map((w) => [w.week, w.side, w.miss]), [[3, "above", 60], [1, "below", 50]]);
  assert.ok(Math.abs(r.targets.band - 0.8) < 1e-9);
});

test("reliability: no calibration file means no targets, and no middle case means no MAE", () => {
  const r = K.reliability(tiny([{ week: 1, net: 150, lo: 100, hi: 200 }, { week: 2, net: 90, lo: 100, hi: 200 }]), null);
  assert.equal(r.targets, null);
  assert.equal(r.overall.maeMid, null);
});

test("reliability: MAE vs middle case only when every week has one", () => {
  const r = K.reliability(tiny([{ week: 1, net: 150, lo: 100, hi: 200, mid: 140 }, { week: 2, net: 90, lo: 100, hi: 200, mid: 120 }]), null);
  assert.equal(r.overall.maeMid, 20);
});

test("reliability on the real file matches calibration.json's low-case hit rate", { skip: !fs.existsSync(REAL_PATH) || !fs.existsSync(CAL_PATH) }, () => {
  const real = JSON.parse(fs.readFileSync(REAL_PATH, "utf8"));
  const cal = JSON.parse(fs.readFileSync(CAL_PATH, "utf8"));
  const r = K.reliability(real, cal);
  assert.equal(r.overall.n, cal.n_test_weeks);
  assert.ok(Math.abs(r.overall.lowHit - cal.calibrated_hit_rate) < 0.001, `${r.overall.lowHit} vs ${cal.calibrated_hit_rate}`);
  for (const d of r.drivers) {
    const runs = real.runs.filter((x) => x.driver === d.driver && x.scenario === "normal");
    for (const x of runs) assert.deepEqual(x.weeks.map((w) => [w.lo, w.hi]), runs[0].weeks.map((w) => [w.lo, w.hi]), "forecasts must not depend on the risk limit");
  }
});

test("stressTest: scenarios without runs are unavailable, never simulated", () => {
  for (const id of ["demand_crash", "high_earnings"]) {
    const r = K.stressTest(SAMPLE, "A", 0.05, id);
    assert.equal(r.available, false);
    assert.equal(r.after, undefined);
  }
});

test("stressTest: storm vs normal uses the two runs' own numbers", () => {
  const r = K.stressTest(SAMPLE, "A", 0.05, "storm");
  const n = K.findRun(SAMPLE, "A", "normal", 0.05), s = K.findRun(SAMPLE, "A", "storm", 0.05);
  assert.equal(r.available, true);
  assert.equal(r.after.avgPay.keel, s.metrics.avg_pay.keel);
  assert.equal(r.before.empty.avg4, n.metrics.overdraft_weeks.avg4);
  assert.equal(r.after.minBuf.last, Math.min(...s.weeks.map((w) => w.buf_last)));
  assert.equal(r.delta.avgPayKeel, s.metrics.avg_pay.keel - n.metrics.avg_pay.keel);
  assert.equal(r.after.maxRisk, Math.max(...s.weeks.map((w) => w.risk)));
});

test("stressTest: a missing risk estimate makes maxRisk null", () => {
  const d = clone(SAMPLE);
  delete K.findRun(d, "A", "storm", 0.05).weeks[3].risk;
  assert.equal(K.stressTest(d, "A", 0.05, "storm").after.maxRisk, null);
});

test("stressTest: catalog offers all four scenarios in order", () => {
  assert.deepEqual(K.STRESS_SCENARIOS.map((s) => s.id), ["normal", "storm", "demand_crash", "high_earnings"]);
});

// Paycheck breakdown
const bdWk = (o) => Object.assign({ net: 0, lo: 0, hi: 0, pay_avg4: 0, pay_last: 0, buf_avg4: 0, buf_last: 0 }, o);
const bdRun = { weeks: [
  bdWk({ week: 1, gross: 1000, net: 850, pay_keel: 700, buf_keel: 500 }),
  bdWk({ week: 2, gross: 1000, net: 850, pay_keel: 700, buf_keel: 650 }), // earnings > paycheck: +150 to buffer
  bdWk({ week: 3, gross: 400, net: 340, pay_keel: 700, buf_keel: 290 }),  // buffer covers 360
  bdWk({ week: 4, gross: 0, net: 0, pay_keel: 250, buf_keel: 40 }),       // zero earnings, buffer pays all
  bdWk({ week: 5, gross: 500, net: 425, pay_keel: 300, buf_keel: 200 })   // stored buffer off by 35
] };

test("breakdown: normal earnings replenish the buffer and the identity holds", () => {
  const b = K.paycheckBreakdown(bdRun, 2);
  assert.equal(b.tax, 150); assert.equal(b.bufferStart, 500); assert.equal(b.bufferChange, 150);
  assert.equal(b.flow, "replenish"); assert.equal(b.identity, true);
});

test("breakdown: buffer withdrawal when earnings fall short", () => {
  const b = K.paycheckBreakdown(bdRun, 3);
  assert.equal(b.flow, "draw"); assert.equal(b.bufferChange, -360); assert.equal(b.identity, true);
});

test("breakdown: zero earnings, the whole paycheck comes from the buffer", () => {
  const b = K.paycheckBreakdown(bdRun, 4);
  assert.equal(b.gross, 0); assert.equal(b.tax, 0); assert.equal(b.bufferChange, -250);
  assert.equal(b.flow, "draw"); assert.equal(b.identity, true);
});

test("breakdown: flags an accounting mismatch", () => {
  const b = K.paycheckBreakdown(bdRun, 5);
  assert.equal(b.identity, false); assert.equal(Math.round(b.gap), -35);
});

test("breakdown: week 1 has no opening balance, so nothing is invented", () => {
  const b = K.paycheckBreakdown(bdRun, 1);
  assert.equal(b.bufferStart, null); assert.equal(b.bufferChange, null);
  assert.equal(b.flow, "unknown"); assert.equal(b.identity, null);
});

test("breakdown: real sample weeks satisfy the identity", () => {
  const run = SAMPLE.runs[0];
  for (let w = 2; w <= run.weeks.length; w++) assert.notEqual(K.paycheckBreakdown(run, w).identity, false, "week " + w);
});

const mkRun = (weeks, risk_limit = 0.05) => ({ driver: "A", scenario: "normal", risk_limit, weeks });
const wk = (o) => Object.assign({ week: 1, net: 500, lo: 400, hi: 700, pay_keel: 450, buf_keel: 300, risk: 0.04, reason: "Chose $450." }, o);

test("explainWeek: copies the week's stored values and derives buffer before", () => {
  const e = K.explainWeek(mkRun([wk({}), wk({ week: 2, pay_keel: 420, risk: 0.03 })]), 1);
  assert.equal(e.pay, 450); assert.equal(e.risk, 0.04); assert.equal(e.limit, 0.05);
  assert.equal(e.bufferBefore, 250); assert.equal(e.bufferAfter, 300);
  assert.equal(e.constraint, "limit_met");
  assert.equal(e.fellShort, false);
  assert.equal(e.nextPay, 420);
});

test("explainWeek: earnings under the low case are flagged with the shortfall", () => {
  const e = K.explainWeek(mkRun([wk({ net: 250 })]), 1);
  assert.equal(e.fellShort, true); assert.equal(e.shortfall, 150); assert.equal(e.nextPay, null);
});

test("explainWeek: $0 paycheck with risk over the limit is the floor case", () => {
  assert.equal(K.explainWeek(mkRun([wk({ pay_keel: 0, risk: 0.3 })]), 1).constraint, "floor");
});

test("explainWeek: missing risk, band or reason stay null; bad week gives null", () => {
  const e = K.explainWeek(mkRun([wk({ risk: undefined, lo: undefined, reason: "" })]), 1);
  assert.equal(e.risk, null); assert.equal(e.lo, null); assert.equal(e.reason, null);
  assert.equal(e.constraint, "unknown"); assert.equal(e.fellShort, false);
  assert.equal(K.explainWeek(mkRun([wk({})]), 5), null);
});

test("explainWeek: every real-file week either meets its limit or is the $0 floor", { skip: !fs.existsSync(REAL_PATH) }, () => {
  const real = JSON.parse(fs.readFileSync(REAL_PATH, "utf8"));
  for (const r of real.runs) for (const w of r.weeks) assert.notEqual(K.explainWeek(r, w.week).constraint, "unknown");
});
