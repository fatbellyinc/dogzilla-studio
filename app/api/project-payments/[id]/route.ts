import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const payment = db.prepare('SELECT * FROM project_payments WHERE id = ?').get(id);
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get((payment as { project_id: number }).project_id);
  return NextResponse.json({ payment, project });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  db.prepare('DELETE FROM project_payments WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
