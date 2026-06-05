import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const bookingId = req.nextUrl.searchParams.get('booking_id');
  const month = req.nextUrl.searchParams.get('month'); // YYYY-MM

  if (month) {
    // Return all costs for completed bookings in this month, with client name
    return NextResponse.json(db.prepare(`
      SELECT bc.*, b.id as booking_id, c.name as client_name
      FROM booking_costs bc
      JOIN bookings b ON b.id = bc.booking_id
      JOIN clients c ON c.id = b.client_id
      WHERE strftime('%Y-%m', b.booking_date) = ?
        AND b.status = 'completed'
        AND NOT (bc.type = 'personnel' AND bc.description = 'Studio Crew')
        AND NOT (
          bc.type = 'electricity'
          AND EXISTS (
            SELECT 1 FROM booking_equipment be
            WHERE be.booking_id = bc.booking_id
              AND be.is_complimentary = 0
              AND LOWER(be.name) LIKE '%power consumption%'
          )
        )
      ORDER BY bc.type, bc.total_cost DESC
    `).all(month));
  }

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

export async function PUT(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { id, description, quantity, unit_cost } = body;
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  const total_cost = (quantity || 1) * unit_cost;
  db.prepare('UPDATE booking_costs SET description=?, quantity=?, unit_cost=?, total_cost=? WHERE id=?')
    .run(description, quantity || 1, unit_cost, total_cost, id);
  return NextResponse.json(db.prepare('SELECT * FROM booking_costs WHERE id = ?').get(id));
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const id = req.nextUrl.searchParams.get('id');
  const bookingId = req.nextUrl.searchParams.get('booking_id');
  const type = req.nextUrl.searchParams.get('type');
  // Delete by id (single row) or by booking_id+type (bulk clear)
  if (id) db.prepare('DELETE FROM booking_costs WHERE id = ?').run(id);
  else if (bookingId && type) db.prepare('DELETE FROM booking_costs WHERE booking_id = ? AND type = ?').run(bookingId, type);
  return NextResponse.json({ ok: true });
}
