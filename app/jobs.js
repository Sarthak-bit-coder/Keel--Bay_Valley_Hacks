// Jobs a freelancer can pick on the "My pay" page, each with a SIMULATED example history.
// The example numbers are our own assumptions to show each kind of uneven pay. They are not
// data about real workers in these jobs. Test: node --test app/engine.test.js
"use strict";
(function (root) {
  // season: 12 multipliers, January to December. lumpy: chance a week has one big job, and how big.
  // weekOff: chance of a week with no pay at all.
  var JOBS = [
    { id: "driver", label: "Rideshare or delivery driver", base: 900, sd: 0.2, weekOff: 0.04,
      season: [1.05, 1, 1, 1, 1, 0.95, 0.9, 0.9, 1, 1, 1.05, 1.1], lumpy: null,
      shape: "Swings week to week with weather, holidays and hours." },
    { id: "plumber", label: "Plumber", base: 1300, sd: 0.25, weekOff: 0.03,
      season: [1.2, 1.15, 1, 0.95, 0.9, 0.9, 0.9, 0.9, 0.95, 1, 1.05, 1.2], lumpy: { p: 0.1, mult: 2.2 },
      shape: "Lumpy: a few big jobs, with more emergency calls in cold months." },
    { id: "gardener", label: "Gardener or landscaper", base: 1000, sd: 0.2, weekOff: 0.03,
      season: [0.15, 0.15, 0.5, 1.1, 1.4, 1.4, 1.35, 1.3, 1.1, 0.9, 0.5, 0.2], lumpy: null,
      shape: "Seasonal: busy spring to fall, close to nothing in winter." },
    { id: "cleaner", label: "House cleaner", base: 700, sd: 0.15, weekOff: 0.04,
      season: [0.95, 0.95, 1, 1, 1, 1, 0.95, 0.9, 1, 1, 1.05, 1.15], lumpy: null,
      shape: "Fairly regular clients, but a cancelled client or a sick week hurts." },
    { id: "handyman", label: "Handyman or electrician", base: 1100, sd: 0.3, weekOff: 0.05,
      season: [0.85, 0.85, 1, 1.05, 1.1, 1.1, 1.05, 1.05, 1.05, 1, 0.95, 0.9], lumpy: { p: 0.12, mult: 2 },
      shape: "Job-to-job: some weeks are full, some are empty." },
    { id: "designer", label: "Freelance designer or writer", base: 450, sd: 0.4, weekOff: 0.25,
      season: [0.9, 1, 1, 1, 1, 1, 0.9, 0.85, 1, 1.05, 1.05, 0.95], lumpy: { p: 0.2, mult: 3.5 },
      shape: "Paid late: invoices land in rare, big chunks." },
    { id: "tutor", label: "Tutor or coach", base: 500, sd: 0.15, weekOff: 0.05,
      season: [1.1, 1.1, 1.1, 1.15, 1.2, 0.5, 0.3, 0.4, 1, 1.1, 1.1, 0.9], lumpy: null,
      shape: "Follows the school year: summer is thin." },
    { id: "other", label: "Something else", base: 800, sd: 0.3, weekOff: 0.05,
      season: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], lumpy: null,
      shape: "Uneven in its own way." }
  ];

  function byId(id) {
    for (var i = 0; i < JOBS.length; i++) if (JOBS[i].id === id) return JOBS[i];
    return null;
  }

  // n weeks of simulated gross pay ending the week before `today` ("YYYY-MM-DD"). Same inputs, same numbers.
  function exampleHistory(jobId, today, n, engine) {
    var job = byId(jobId) || byId("other");
    n = n || 26;
    var E = engine || root.KeelEngine;
    var seed = 0;
    for (var c = 0; c < job.id.length; c++) seed = (seed * 31 + job.id.charCodeAt(c)) >>> 0;
    var r = E.rng(seed), out = [];
    var last = E.addWeeks(E.mondayOf(today), -1);
    for (var k = n - 1; k >= 0; k--) {
      var week = E.addWeeks(last, -k);
      var month = Number(week.slice(5, 7)) - 1;
      var u1 = 1 - r(), u2 = r(), uOff = r(), uLump = r();
      var zz = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      var g = job.base * job.season[month] * Math.exp(job.sd * zz - job.sd * job.sd / 2);
      if (job.lumpy && uLump < job.lumpy.p) g *= job.lumpy.mult;
      if (uOff < job.weekOff) g = 0;
      out.push({ week_start: week, gross: Math.round(Math.max(0, g) * 100) / 100, note: "example (simulated)" });
    }
    return out;
  }

  var api = { JOBS: JOBS, byId: byId, exampleHistory: exampleHistory };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KeelJobs = api;
})(typeof window !== "undefined" ? window : this);
