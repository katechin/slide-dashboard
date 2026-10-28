// ─── One-off copy: Supabase → Neon ─────────────────────
// Creates the tables in Neon (db/schema.sql) and copies every row across
// from Supabase for both dashboards: slide_staff (SLIDE) and
// doctor_reports (Cubiko). Safe to run more than once: rows already in
// Neon are left alone.
//
// Usage (PowerShell):
//   $env:DATABASE_URL = "<your Neon connection string>"
//   npm run migrate

import { neon } from '@neondatabase/serverless';
import { readFile } from 'node:fs/promises';

// Same public (anon) values the dashboards used to have in their page source.
const SUPABASE_URL = 'https://ioglucqixaviphpvampq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvZ2x1Y3FpeGF2aXBocHZhbXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NzIxMDIsImV4cCI6MjA5MTI0ODEwMn0.Bto4yf6w2FN_is61aGfSoEHY0fouPngE5CVSC9NtFJw';

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL to your Neon connection string first.');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

// Schema file holds several CREATE TABLE statements; run them one at a time
const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
for (const statement of schema.split(';').map(s => s.trim()).filter(s => s.replace(/--.*$/gm, '').trim())) {
  await sql.query(statement);
}
console.log('Tables are ready in Neon.');

async function fetchSupabase(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) {
    console.error(`Could not read ${table} from Supabase (${res.status}): ${await res.text()}`);
    process.exit(1);
  }
  return res.json();
}

// ─── SLIDE: slide_staff ────────────────────────────────
const staff = await fetchSupabase('slide_staff');
let copied = 0;
for (const r of staff) {
  const result = await sql`
    INSERT INTO slide_staff (id, staff_name, coach_name, department, job_title, stage,
                             tasks_completed, total_tasks, start_date, first_day, last_day,
                             notes, is_remote, sort_order, saved_at, created_at)
    VALUES (${r.id}, ${r.staff_name}, ${r.coach_name || ''}, ${r.department}, ${r.job_title}, ${r.stage},
            ${r.tasks_completed || 0}, ${r.total_tasks}, ${r.start_date || null}, ${r.first_day || null}, ${r.last_day || null},
            ${r.notes || ''}, ${!!r.is_remote}, ${r.sort_order ?? null}, ${r.saved_at || null}, ${r.created_at || new Date().toISOString()})
    ON CONFLICT (id) DO NOTHING
    RETURNING id`;
  copied += result.length;
}
const [{ count: staffCount }] = await sql`SELECT count(*)::int AS count FROM slide_staff`;
console.log(`SLIDE: copied ${copied} new rows. Neon now has ${staffCount} people (Supabase has ${staff.length}).`);

// ─── Cubiko: doctor_reports ────────────────────────────
const reports = await fetchSupabase('doctor_reports');
copied = 0;
for (const r of reports) {
  const result = await sql`
    INSERT INTO doctor_reports (id, doctor_name, data, saved_at, created_at)
    VALUES (${r.id}, ${r.doctor_name}, ${JSON.stringify(r.data ?? null)}::jsonb,
            ${r.saved_at || null}, ${r.created_at || new Date().toISOString()})
    ON CONFLICT (id) DO NOTHING
    RETURNING id`;
  copied += result.length;
}
const [{ count: reportCount }] = await sql`SELECT count(*)::int AS count FROM doctor_reports`;
console.log(`Cubiko: copied ${copied} new rows. Neon now has ${reportCount} reports (Supabase has ${reports.length}).`);
