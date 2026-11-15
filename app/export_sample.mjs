// Export the TOY simulation from docs/prototype.html into outputs/sample/results.json (CONTRACT.md format).
// Run from the repo root: node app/export_sample.mjs
// Every number here is from the toy model (meta.model = "toy"), not from the real LightGBM run.
// Drivers are simulated. week_start dates are placeholder Mondays: the toy has no calendar.
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("docs/prototype.html", "utf8");
const src = html.match(/<script id="sim">([\s\S]*?)<\/script>/)[1];
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src + "\n;this.api = { simulate, TAX, HORIZON, START_BUFFER, WEEKS };", ctx);
const { simulate, TAX, HORIZON, START_BUFFER, WEEKS } = ctx.api;

const LABELS = { A: "Driver A: full-time, steady", B: "Driver B: evenings, choppy", C: "Driver C: weekends, very choppy" };
const r2 = (x) => Math.round(x * 100) / 100;
const pct = (x) => Math.round(x * 100) + "%";
const monday = (w) => new Date(Date.UTC(2026, 0, 5 + 7 * (w - 1))).toISOString().slice(0, 10);

function reason(pay, risk, alpha) {
  const dollars = "$" + Math.round(pay).toLocaleString("en-US");
  if (risk <= alpha) return `Chose ${dollars} so the chance of running dry in the next ${HORIZON} weeks is about ${pct(risk)} (limit ${pct(alpha)}).`;
  return `Paid ${dollars}: even with no paycheck the chance of running dry in the next ${HORIZON} weeks is about ${pct(risk)}, above the ${pct(alpha)} limit.`;
}

const runs = [];
for (const driver of Object.keys(LABELS)) {
  for (const scenario of ["normal", "storm"]) {
    for (const alpha of [0.01, 0.05, 0.1, 0.2]) {
      const R = simulate(driver, scenario, alpha), M = R.m;
      const weeks = [];
      for (let t = 0; t < WEEKS; t++) {
        weeks.push({
          week: t + 1, week_start: monday(t + 1),
          gross: r2(R.gross[t]), net: r2(R.net[t]), lo: r2(R.lo[t]), hi: r2(R.hi[t]),
          pay_keel: r2(R.pol.keel[t]), pay_avg4: r2(R.pol.avg4[t]), pay_last: r2(R.pol.last[t]),
          buf_keel: r2(R.buf.keel[t]), buf_avg4: r2(R.buf.avg4[t]), buf_last: r2(R.buf.last[t]),
          risk: r2(R.log[t].risk), reason: reason(R.log[t].pay, R.log[t].risk, alpha)
        });
      }
      runs.push({
        driver, driver_label: LABELS[driver], scenario, risk_limit: alpha, weeks,
        metrics: {
          overdraft_weeks: { keel: M.keel.overdraft, avg4: M.avg4.overdraft, last: M.last.overdraft },
          avg_pay: { keel: Math.round(M.keel.avgPay), avg4: Math.round(M.avg4.avgPay), last: Math.round(M.last.avgPay) },
          pay_swing: { keel: Math.round(M.keel.swing), avg4: Math.round(M.avg4.swing), last: Math.round(M.last.swing) },
          earnings_swing: Math.round(M.earnSwing),
          tax_total: Math.round(M.taxTotal),
          low_case_hit_rate: r2(M.lowHit)
        },
        checks: { identity: R.checks.identity, buffer_nonnegative: R.checks.buffer, pay_nonnegative: R.checks.pay }
      });
    }
  }
}

const out = {
  meta: { model: "toy", is_simulated: true, generated_at: new Date().toISOString(), tax_rate: TAX, start_buffer_weeks: START_BUFFER, horizon_weeks: HORIZON },
  runs
};
fs.mkdirSync("outputs/sample", { recursive: true });
fs.writeFileSync("outputs/sample/results.json", JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${runs.length} runs to outputs/sample/results.json`);
