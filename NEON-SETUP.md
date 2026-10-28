# Moving the dashboards to Neon + Netlify

Neither dashboard talks to Supabase any more. Each page calls a small API
hosted on Netlify, and the APIs read and write one Neon Postgres database:

| Page | API | Neon table |
| --- | --- | --- |
| `slide-dashboard.html` | `netlify/functions/staff.mjs` (`/api/staff`) | `slide_staff` |
| `cubiko-dashboard.html` | `netlify/functions/reports.mjs` (`/api/reports`) | `doctor_reports` |

Neon's free plan doesn't pause or delete your project. The database sleeps
after a few minutes with no activity and wakes on the next visit, so the
first load after a quiet spell is a little slower.

**Do the steps in order.** Copy the data (step 2) before you push (step 3).
The Supabase keep-alive workflow is removed in this change, so Supabase can
pause once this is pushed.

## 1. Create the Neon database

1. Sign up at <https://neon.tech> (free plan).
2. Create a project. Pick the **AWS Asia Pacific (Sydney)** region.
3. Click **Connect** and copy the connection string. It starts with
   `postgresql://` and contains a password, so keep it private.

## 2. Copy the data from Supabase

In a terminal in this project folder:

```powershell
npm install
$env:DATABASE_URL = "<paste your Neon connection string>"
npm run migrate
```

It should finish with:

```
SLIDE: copied 6 new rows. Neon now has 6 people (Supabase has 6).
Cubiko: copied 2 new rows. Neon now has 2 reports (Supabase has 2).
```

(The numbers will be higher if you've added people or reports since.) You
can run it again safely, because it only adds rows that aren't in Neon yet.

## 3. Put the site on Netlify

1. Push this repo to GitHub.
2. Sign up at <https://netlify.com> with your GitHub account.
3. **Add new project → Import an existing project → GitHub →
   `katechin/slide-dashboard`**. The build settings are read from
   `netlify.toml`, so leave them as they are.
4. Go to **Project configuration → Environment variables** and add:
   - `DATABASE_URL`: your Neon connection string
   - `ADMIN_PASSWORD`: a **new** admin password for the SLIDE dashboard.
     The old one was visible in the page source and is still in the git
     history, so don't reuse it.
5. Go to **Deploys → Trigger deploy**, so the new variables are used.

Then check both pages on your Netlify address:

- `/`: the SLIDE dashboard. Check that everyone appears, then click
  **Admin** and sign in with the new password.
- `/cubiko-dashboard.html`: check that both doctor reports are in the
  dropdown and open.

## 4. Afterwards

- **Share the new links.** If the old pages were on GitHub Pages, they stop
  loading data once this change is pushed, so turn GitHub Pages off or point
  people to the Netlify address.
- **Remove the old GitHub secrets.** In the GitHub repo, go to **Settings →
  Secrets and variables → Actions** and delete `SUPABASE_URL` and
  `SUPABASE_KEY`. The keep-alive workflow that used them is gone.
- **Delete the Supabase project** once you've used both dashboards on
  Netlify for a while and are happy everything is there.
