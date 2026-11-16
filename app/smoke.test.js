// Smoke test for the one-page app. Run from the repo root: node --test app/smoke.test.js
// There is no login, signup or sign-out yet, so this covers index.html only.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const K = require("./data.js");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
// fetch over the repo on disk, resolving URLs the way the browser does from app/index.html.
const diskFetch = (skip) => (url) => {
  const file = path.join(__dirname, url);
  if (url === skip || !fs.existsSync(file)) return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error("no body")) });
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(fs.readFileSync(file, "utf8"))) });
};

test("index loads outputs/results.json when present", { skip: !fs.existsSync(path.join(ROOT, "outputs/results.json")) }, async () => {
  const res = await K.loadData(diskFetch());
  assert.equal(res.url, K.SOURCES[0]);
  assert.deepEqual(K.validate(res.data), []);
  assert.ok(res.data.meta.is_simulated, "drivers must be labelled simulated");
});

test("index still loads when results.json is missing", async () => {
  const res = await K.loadData(diskFetch(K.SOURCES[0]));
  assert.equal(res.url, K.SOURCES[1]);
  assert.equal(res.data.meta.model, "toy");
});

test("index has the controls and tabs the script wires up", () => {
  for (const id of ["driver", "risk", "sc-normal", "sc-storm", "tab-pay", "tab-more", "panel-pay", "panel-more", "tiles", "badgetext"])
    assert.match(HTML, new RegExp('id="' + id + '"'), id);
  assert.match(HTML, /role="tablist"/);
});

test("index wording and data rules", () => {
  assert.doesNotMatch(HTML, /rideshare drivers/i);
  assert.doesNotMatch(HTML, /type="(password|email)"/i);
  assert.doesNotMatch(HTML, /localStorage|sessionStorage/);
  assert.doesNotMatch(HTML, /Snowstorm replay/);
  assert.match(HTML, />Snowstorm stress test</);
  assert.match(HTML, /not financial or tax advice/i);
});
