import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  return NextResponse.json(db.prepare('SELECT * FROM booking_crew WHERE booking_id = ? ORDER BY role').all(id));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const { name, role, phone, rate } = await req.json();
  const result = db.prepare('INSERT INTO booking_crew (booking_id, name, role, phone, rate) VALUES (?, ?, ?, ?, ?)').run(id, name, role, phone || null, rate || 0);
  return NextResponse.json(db.prepare('SELECT * FROM booking_crew WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const crewId = req.nextUrl.searchParams.get('crew_id');
  if (crewId) db.prepare('DELETE FROM booking_crew WHERE id = ? AND booking_id = ?').run(crewId, id);
  return NextResponse.json({ ok: true });
}
