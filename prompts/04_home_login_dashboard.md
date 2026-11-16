# Task: home page → login/sign-up page → dashboard (Keel)

Paste `prompts/00_shared_context.md` first, then this file.

You are working in the Keel repo (https://github.com/Sarthak-bit-coder/Keel--Bay_Valley_Hacks). Run `git pull origin main`, then create a branch `feature/home-login-dashboard`. Hard deadline: final submission 10:00 PM, aim for 9:00 PM. Make small diffs; do not rewrite files wholesale.

## Goal

Give new users one clear path through the app:

1. **Home page** (`index.html` at the repo root): what Keel is, and two buttons.
2. **Login / sign-up page** (new: `app/login.html`): sign in, create an account, or continue as a guest.
3. **Dashboard** (`app/my-pay.html`, after login): the person's next paycheck, pay log and charts. The simulation and evidence (`app/index.html`) stay reachable from the dashboard and the home page as "See the evidence".

## What already exists (reuse it, do not rebuild it)

- `index.html` (root) + `app/home.css` + `app/home.js`: the home page, with a data-driven hero chart. Buttons currently point to `app/` and `app/my-pay.html`.
- `app/my-pay.html`: already has sign in / sign up (`#v-signin`), a "Try it as a guest" button (`#b-guest`), a job/profile step (`#v-profile`), and the dashboard (next paycheck, charts, pay log).
- `app/store.js`: `AccountStore` (Supabase) and `GuestStore` (this browser only, localStorage). `app/config.js` holds the Supabase URL and anon key. Both are empty, so accounts are switched off and only guest mode works. Setup steps: `app/MY_PAY_SETUP.md`. Schema with row level security: `app/supabase_schema.sql`.
- `app/engine.js`: the paycheck rule (tested against the Python code). `app/keel.css`: the design tokens (`--keel`, `--surface`, `--ink`, `--border`, dark mode). Use these; do not add a new color system.

## What to build

1. **Move sign in / sign up / guest out of `my-pay.html` into `app/login.html`.**
   - Two tabs or a toggle: "Sign in" and "Create account" (email + password, plus display name on sign-up).
   - A big, always-visible **"Continue as guest (no account)"** button. Judges must reach the dashboard in one click without typing anything.
   - If `config.js` is empty, say "Accounts are off in this demo. Continue as a guest." and keep the guest button working.
   - On success, go to `app/my-pay.html`. If someone opens `my-pay.html` with no session and no guest mode, send them to `login.html`.
   - Reuse the existing code in `my-pay.html` and `store.js` for sign-in, sign-up and errors. Move it; don't write a second auth system.
2. **Home page:** change the main buttons to **"Get started"** (goes to `app/login.html`) and **"See the evidence"** (goes to `app/`). Add a small "Sign in" link in the top nav.
3. **Dashboard (`my-pay.html`) layout:**
   - Top bar: Keel logo (links home), the person's name and job, "Sign out" / "Leave guest mode", and a link "See the evidence".
   - First screen: **next paycheck** big and clear, then buffer and tax set aside, then the heads-up line. Then the earnings vs paycheck chart, then the pay log.
   - Keep the profile/job step for first-time users, shown once before the dashboard.
4. **Same look everywhere:** shared header style, same fonts (IBM Plex Sans), same tokens from `keel.css`, light and dark mode, works at 375px phone width with no sideways scroll.

## Rules (do not break these)

- **No login wall.** Guest mode must always work, and the simulation (`app/index.html`) must never require login.
- **Never** put the Supabase `service_role` key in any file. Only the anon key goes in `config.js`.
- Don't invent numbers. Anything shown from the simulation must come from `outputs/results.json`.
- Don't edit `outputs/`, `src/`, `eval/`, `data/` or `CONTRACT.md`.
- Accessibility: every input has a label; errors appear in text next to the field (not only red); keyboard focus visible; buttons are real `<button>`s.

## Done means

- `python -m http.server` from the repo root, then: `http://localhost:8000/` → "Get started" → login page → "Continue as guest" → dashboard works with no setup.
- Sign out returns to the login page. Opening `my-pay.html` directly with no session goes to login.
- All app tests still pass: `node --test app/*.test.js`.
- Add a small test for the redirect rule (no session and no guest → login).
- Open a PR into `main` with before/after screenshots of all three pages.
