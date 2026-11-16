# "My pay": accounts for any freelancer

`app/my-pay.html` lets a person sign in, pick their job (driver, plumber, gardener, cleaner, handyman, designer, tutor, other), log what they earn each week, and see the paycheck Keel would pay them next week. It uses the same salary rule as the main results (`src/policy/salary.py`), ported to `app/engine.js` and tested against the Python code.

**Without any setup it runs in guest mode**: data is saved only in that browser. Accounts need a free Supabase project (about 10 minutes).

## Turn on accounts

1. Create a project at [supabase.com](https://supabase.com) (free tier). Pick any name and a database password.
2. **SQL Editor → New query**: paste all of `app/supabase_schema.sql`, click **Run**. This creates two tables (`profiles`, `pay_entries`) with row level security, so each signed-in person can read and change only their own rows.
3. **Authentication → Sign In / Providers → Email**: for the demo, turn **off** "Confirm email" so judges can sign up and get straight in. (With it on, people must click an emailed link first; the page tells them so.)
4. **Project Settings → API** (or **Data API**): copy the **Project URL** and the **anon public** key into `app/config.js`:
   ```js
   window.KEEL_SUPABASE = { url: "https://xxxx.supabase.co", anonKey: "eyJ..." };
   ```
   The anon key is meant to be public. Never put the `service_role` key in the page.
5. Serve the repo root (`python -m http.server 8000`) and open `http://localhost:8000/app/my-pay.html`, or deploy as before.

## What is real and what is not

- **The rule is real**: same Monte Carlo paycheck rule, same baselines, same reason text as the main results.
- **The forecast is simpler**: the low, middle and high case are the 10%, 50% and 90% points of the person's last 12 weeks, not LightGBM, and are not calibrated. The page says so.
- **Example weeks are simulated** from our own assumptions per job (`app/jobs.js`), not data about real workers.
- **This is a demo.** The page asks people to use made-up numbers. No money moves. Not financial or tax advice.
- **None of this is part of the pre-registered results.** Only `outputs/results.json` counts as results.

## Tests

```bash
python tests/make_engine_fixture.py   # Python's answers (only needed if src/policy changes)
node --test app/engine.test.js app/store.test.js
```
