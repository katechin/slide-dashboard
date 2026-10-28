// ─── SLIDE Dashboard API ───────────────────────────────
// The page calls this instead of the database, so the Neon connection
// string never reaches the browser. Anyone can view the dashboard and
// update tasks / notes (same as before); adding, editing, deleting,
// moving and reordering people needs the admin password.
//
// Environment variables (set in Netlify → Site configuration):
//   DATABASE_URL    Neon connection string
//   ADMIN_PASSWORD  password for the dashboard's Admin button

import { neon } from '@neondatabase/serverless';
import { createHash, timingSafeEqual } from 'node:crypto';

export const config = { path: '/api/staff' };

const STAGES        = ['Onboarding', 'Induction', 'Offboarding'];
const ADMIN_ACTIONS = new Set(['save', 'delete', 'moveToInduction', 'reorder']);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function isAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD;
  const given    = req.headers.get('x-admin-password');
  if (!expected || !given) return false;
  // Compare hashes so both sides are the same length for timingSafeEqual
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

// Dates come back as plain YYYY-MM-DD text, which is what the page expects.
function listStaff(sql) {
  return sql`
    SELECT id, staff_name, coach_name, department, job_title, stage,
           tasks_completed, total_tasks,
           start_date::text AS start_date,
           first_day::text  AS first_day,
           last_day::text   AS last_day,
           notes, is_remote, sort_order, created_at
    FROM slide_staff
    ORDER BY sort_order ASC NULLS LAST, created_at DESC`;
}

export default async (req) => {
  if (!process.env.DATABASE_URL) return json({ error: 'DATABASE_URL is not set' }, 500);
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') return json(await listStaff(sql));
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const body = await req.json();
    const { action } = body;

    if (action === 'checkAdmin') return json({ ok: isAdmin(req) });
    if (ADMIN_ACTIONS.has(action) && !isAdmin(req)) {
      return json({ error: 'Admin password required — click Admin and sign in again.' }, 401);
    }

    switch (action) {
      // Add or edit a person (insert, or overwrite the existing row)
      case 'save': {
        const r = body.row || {};
        if (!r.id || !r.staff_name || !STAGES.includes(r.stage)) {
          return json({ error: 'Missing name, id or stage' }, 400);
        }
        await sql`
          INSERT INTO slide_staff (id, staff_name, coach_name, department, job_title, stage,
                                   tasks_completed, total_tasks, start_date, first_day, last_day,
                                   notes, is_remote, sort_order, saved_at)
          VALUES (${r.id}, ${r.staff_name}, ${r.coach_name || ''}, ${r.department}, ${r.job_title}, ${r.stage},
                  ${r.tasks_completed || 0}, ${r.total_tasks}, ${r.start_date}, ${r.first_day || null}, ${r.last_day || null},
                  ${r.notes || ''}, ${!!r.is_remote}, ${r.sort_order ?? null}, now())
          ON CONFLICT (id) DO UPDATE SET
            staff_name      = EXCLUDED.staff_name,
            coach_name      = EXCLUDED.coach_name,
            department      = EXCLUDED.department,
            job_title       = EXCLUDED.job_title,
            stage           = EXCLUDED.stage,
            tasks_completed = EXCLUDED.tasks_completed,
            total_tasks     = EXCLUDED.total_tasks,
            start_date      = EXCLUDED.start_date,
            first_day       = EXCLUDED.first_day,
            last_day        = EXCLUDED.last_day,
            notes           = EXCLUDED.notes,
            is_remote       = EXCLUDED.is_remote,
            sort_order      = EXCLUDED.sort_order,
            saved_at        = now()`;
        return json({ ok: true });
      }

      case 'delete':
        await sql`DELETE FROM slide_staff WHERE id = ${body.id}`;
        return json({ ok: true });

      case 'moveToInduction':
        await sql`
          UPDATE slide_staff
          SET stage = 'Induction', first_day = ${body.firstDay}, start_date = ${body.firstDay}, saved_at = now()
          WHERE id = ${body.id}`;
        return json({ ok: true });

      // body.order = [{ id, sort_order }, ...] — saved in one statement
      case 'reorder': {
        const order = Array.isArray(body.order) ? body.order : [];
        await sql`
          UPDATE slide_staff AS s
          SET sort_order = v.ord, saved_at = now()
          FROM unnest(${order.map(o => o.id)}::uuid[], ${order.map(o => o.sort_order)}::int[]) AS v(id, ord)
          WHERE s.id = v.id`;
        return json({ ok: true });
      }

      case 'tasks':
        await sql`
          UPDATE slide_staff
          SET tasks_completed = ${body.tasks_completed}, total_tasks = ${body.total_tasks}, saved_at = now()
          WHERE id = ${body.id}`;
        return json({ ok: true });

      case 'notes':
        await sql`UPDATE slide_staff SET notes = ${body.notes || ''}, saved_at = now() WHERE id = ${body.id}`;
        return json({ ok: true });

      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (err) {
    return json({ error: err.message || 'Database error' }, 500);
  }
};
