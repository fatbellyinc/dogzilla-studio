import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const body = await req.json();
  const { category, description, note, internal_cost, client_cost } = body;
  db.prepare(`
    UPDATE project_costs SET category = ?, description = ?, note = ?, internal_cost = ?, client_cost = ? WHERE id = ?
  `).run(category, description, note || null, Number(internal_cost) || 0, Number(client_cost) || 0, id);
  return NextResponse.json(db.prepare('SELECT * FROM project_costs WHERE id = ?').get(id));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  db.prepare('DELETE FROM project_costs WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
