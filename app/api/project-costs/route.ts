import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { project_id, category, description, note, internal_cost, client_cost } = body;
  if (!project_id || !category || !description) {
    return NextResponse.json({ error: 'project_id, category and description are required' }, { status: 400 });
  }
  const { max } = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as max FROM project_costs WHERE project_id = ?').get(project_id) as { max: number };
  const result = db.prepare(`
    INSERT INTO project_costs (project_id, category, description, note, internal_cost, client_cost, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(project_id, category, description, note || null, Number(internal_cost) || 0, Number(client_cost) || 0, max + 1);
  return NextResponse.json(db.prepare('SELECT * FROM project_costs WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
}
