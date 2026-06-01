import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const bookingId = req.nextUrl.searchParams.get('booking_id');
  if (!bookingId) return NextResponse.json([]);
  return NextResponse.json(db.prepare('SELECT * FROM booking_costs WHERE booking_id = ?').all(bookingId));
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { booking_id, type, description, quantity, unit_cost } = body;
  const total_cost = (quantity || 1) * unit_cost;
  const result = db.prepare(
    `INSERT INTO booking_costs (booking_id, type, description, quantity, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(booking_id, type, description, quantity || 1, unit_cost, total_cost);
  return NextResponse.json(db.prepare('SELECT * FROM booking_costs WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const id = req.nextUrl.searchParams.get('id');
  if (id) db.prepare('DELETE FROM booking_costs WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
