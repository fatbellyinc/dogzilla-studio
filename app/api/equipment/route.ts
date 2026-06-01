import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const date = req.nextUrl.searchParams.get('date');

  if (date) {
    // Return availability for a given date
    const equipment = db.prepare(`
      SELECT e.*,
        COALESCE(SUM(CASE WHEN b.booking_date = ? AND b.status NOT IN ('cancelled') THEN be.quantity ELSE 0 END), 0) as booked_qty
      FROM equipment e
      LEFT JOIN booking_equipment be ON be.equipment_id = e.id
      LEFT JOIN bookings b ON b.id = be.booking_id
      WHERE e.active = 1
      GROUP BY e.id
      ORDER BY e.category, e.name
    `).all(date);
    return NextResponse.json(equipment);
  }

  const equipment = db.prepare(`SELECT * FROM equipment WHERE active = 1 ORDER BY category, name`).all();
  return NextResponse.json(equipment);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { name, category, daily_rate, quantity, description, wattage } = body;
  const result = db.prepare(`INSERT INTO equipment (name, category, daily_rate, quantity, description, wattage) VALUES (?, ?, ?, ?, ?, ?)`).run(name, category, daily_rate, quantity || 1, description || null, wattage || 0);
  return NextResponse.json(db.prepare('SELECT * FROM equipment WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
}
