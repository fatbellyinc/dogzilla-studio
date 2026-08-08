import { NextRequest, NextResponse } from 'next/server';
import { getDb, nextDocNumber } from '@/lib/db';

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { project_id, notes } = body;
  if (!project_id) return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
  const invoice_number = nextDocNumber(db, 'DZPI');
  const result = db.prepare(`INSERT INTO project_invoices (project_id, invoice_number, notes) VALUES (?, ?, ?)`)
    .run(project_id, invoice_number, notes || null);
  return NextResponse.json(db.prepare('SELECT * FROM project_invoices WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
}
