import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const bookingId = req.nextUrl.searchParams.get('booking_id');
  if (!bookingId) return NextResponse.json([]);
  return NextResponse.json(db.prepare('SELECT * FROM booking_days WHERE booking_id = ? ORDER BY date').all(bookingId));
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { booking_id, days } = body; // days: DayConfig[]

  // Delete existing days for this booking and reinsert
  db.prepare('DELETE FROM booking_days WHERE booking_id = ?').run(booking_id);
  const ins = db.prepare('INSERT INTO booking_days (booking_id, date, day_type, studio_rate, hours, subtotal) VALUES (?, ?, ?, ?, ?, ?)');
  for (const d of days || []) {
    ins.run(booking_id, d.date, d.day_type, d.studio_rate, d.hours || 1, d.subtotal || 0);
  }
  return NextResponse.json({ ok: true });
}
