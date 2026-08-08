import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { project_id, amount, type, method, reference, notes, paid_at } = body;
  if (!project_id || !amount) {
    return NextResponse.json({ error: 'project_id and amount are required' }, { status: 400 });
  }
  const result = db.prepare(`
    INSERT INTO project_payments (project_id, amount, type, method, reference, notes, paid_at)
    VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
  `).run(project_id, Number(amount), type || 'deposit', method || null, reference || null, notes || null, paid_at || null);
  return NextResponse.json(db.prepare('SELECT * FROM project_payments WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
}
