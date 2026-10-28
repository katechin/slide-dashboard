-- Tables for Neon (Postgres). Same columns the pages used on Supabase.

-- SLIDE Dashboard (slide-dashboard.html)
CREATE TABLE IF NOT EXISTS slide_staff (
  id              uuid PRIMARY KEY,
  staff_name      text,
  coach_name      text DEFAULT '',
  department      text,
  job_title       text,
  stage           text,
  tasks_completed integer DEFAULT 0,
  total_tasks     integer,
  start_date      date,
  first_day       date,
  last_day        date,
  notes           text DEFAULT '',
  is_remote       boolean DEFAULT false,
  sort_order      integer,
  saved_at        timestamptz DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Cubiko Doctor Performance Dashboard (cubiko-dashboard.html)
CREATE TABLE IF NOT EXISTS doctor_reports (
  id          text PRIMARY KEY,
  doctor_name text,
  data        jsonb,
  saved_at    timestamptz DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
