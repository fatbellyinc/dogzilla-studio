import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const body = await req.json();
  const { status, notes, converted_booking_id } = body;
  if (status !== undefined) db.prepare('UPDATE studio_visits SET status=? WHERE id=?').run(status, id);
  if (notes !== undefined) db.prepare('UPDATE studio_visits SET notes=? WHERE id=?').run(notes, id);
  if (converted_booking_id !== undefined) db.prepare('UPDATE studio_visits SET converted_booking_id=?, status=? WHERE id=?').run(converted_booking_id, 'converted', id);
  return NextResponse.json(db.prepare('SELECT * FROM studio_visits WHERE id=?').get(id));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  db.prepare('DELETE FROM studio_visits WHERE id=?').run(id);
  return NextResponse.json({ ok: true });
}
