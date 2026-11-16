// node --test app/
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { smoothPath, payCost } = require("./home.js");

const HOME = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const numbers = (d) => d.match(/-?\d+(\.\d+)?/g).map(Number);

test("smoothPath with k = 0 is straight segments through every point", () => {
  assert.equal(smoothPath([[0, 10], [10, 0], [20, 30]], 0), "M0,10L10,0L20,30");
});

test("smoothPath passes through every data point when smoothed", () => {
  const pts = [[0, 10], [10, 0], [20, 30], [30, 30], [40, 5]];
  const d = smoothPath(pts, 1);
  for (const p of pts) assert.ok(d.includes(p[0] + "," + p[1]), "missing " + p);
});

test("smoothPath never leaves the range of the data, so no value is invented", () => {
  const ys = [462, 510, 528, 701, 0, 400, 519, 429, 599, 159, 423];
  const d = smoothPath(ys.map((y, i) => [i * 100, y]), 1);
  const curveYs = numbers(d).filter((_, i) => i % 2 === 1);
  assert.ok(Math.min(...curveYs) >= 0 && Math.max(...curveYs) <= 701, "curve overshoots the data");
});

test("smoothPath handles empty and two-point input", () => {
  assert.equal(smoothPath([], 1), "");
  assert.equal(smoothPath([[0, 1], [5, 2]], 1), "M0,1L5,2");
});

test("payCost counts only the runs where Keel paid less than the 4-week average", () => {
  const run = (keel, avg4) => ({ metrics: { avg_pay: { keel, avg4 } } });
  assert.deepEqual(payCost({ runs: [run(400, 445), run(500, 480), run(600, 603)] }), { runs: 3, lower: 2, min: 3, max: 45 });
  assert.deepEqual(payCost({ runs: [run(500, 480)] }), { runs: 1, lower: 0, min: null, max: null });
});

test("homepage carries the headline, links to the app, and the disclaimers", () => {
  assert.match(HOME, /Your work changes\./);
  assert.match(HOME, /Your payday shouldn’t\./);
  assert.match(HOME, /href="app\/"/);
  assert.match(HOME, /No real money|no real money/);
  assert.match(HOME, /not financial or tax advice/i);
  assert.doesNotMatch(HOME, /guaranteed|rideshare drivers/i);
});
