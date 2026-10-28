// ─── Cubiko Dashboard API ──────────────────────────────
// The Cubiko page calls this instead of the database, so the Neon
// connection string never reaches the browser. Same access as before:
// anyone with the page can list, open, save and delete doctor reports.
//
// Environment variables (set in Netlify → Project configuration):
//   DATABASE_URL    Neon connection string

import { neon } from '@neondatabase/serverless';

export const config = { path: '/api/reports' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export default async (req) => {
  if (!process.env.DATABASE_URL) return json({ error: 'DATABASE_URL is not set' }, 500);
  const sql = neon(process.env.DATABASE_URL);

  try {
    // GET /api/reports          → list for the dropdown
    // GET /api/reports?id=...   → one report's data
    if (req.method === 'GET') {
      const id = new URL(req.url).searchParams.get('id');
      if (id) {
        const rows = await sql`SELECT data FROM doctor_reports WHERE id = ${id}`;
        return rows.length ? json(rows[0]) : json({ error: 'Report not found' }, 404);
      }
      return json(await sql`
        SELECT id, doctor_name, saved_at FROM doctor_reports ORDER BY doctor_name ASC`);
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const body = await req.json();
    switch (body.action) {
      case 'save': {
        const r = body.row || {};
        if (!r.id || !r.doctor_name) return json({ error: 'Missing id or doctor name' }, 400);
        await sql`
          INSERT INTO doctor_reports (id, doctor_name, data, saved_at)
          VALUES (${r.id}, ${r.doctor_name}, ${JSON.stringify(r.data ?? null)}::jsonb, now())
          ON CONFLICT (id) DO UPDATE SET
            doctor_name = EXCLUDED.doctor_name,
            data        = EXCLUDED.data,
            saved_at    = now()`;
        return json({ ok: true });
      }

      case 'delete':
        await sql`DELETE FROM doctor_reports WHERE id = ${body.id}`;
        return json({ ok: true });

      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (err) {
    return json({ error: err.message || 'Database error' }, 500);
  }
};
