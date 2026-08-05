import { NextRequest, NextResponse } from 'next/server';
import { getDb, nextDocNumber } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const projects = db.prepare(`
    SELECT p.*,
      COALESCE((SELECT SUM(internal_cost) FROM project_costs WHERE project_id = p.id), 0) as internal_total,
      COALESCE((SELECT SUM(client_cost) FROM project_costs WHERE project_id = p.id), 0) as client_total
    FROM projects p
    ORDER BY p.created_at DESC
  `).all();
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { name, client_name, client_company, client_title, description, markup_pct_dp, markup_pct_no_dp, vat_exempt } = body;
  if (!name) return NextResponse.json({ error: 'Project name is required' }, { status: 400 });

  const quote_number = nextDocNumber(db, 'DZCE');
  const result = db.prepare(`
    INSERT INTO projects (quote_number, name, client_name, client_company, client_title, description, markup_pct_dp, markup_pct_no_dp, vat_exempt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    quote_number, name, client_name || null, client_company || null, client_title || null, description || null,
    markup_pct_dp ?? 10, markup_pct_no_dp ?? 15, vat_exempt ? 1 : 0,
  );
  return NextResponse.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
}
