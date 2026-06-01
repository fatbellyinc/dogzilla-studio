import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const bookingId = req.nextUrl.searchParams.get('booking_id');
  if (bookingId) {
    return NextResponse.json(db.prepare('SELECT * FROM activity_log WHERE booking_id = ? ORDER BY created_at DESC').all(bookingId));
  }
  // Recent activity across all bookings
  return NextResponse.json(db.prepare(`
    SELECT al.*, b.booking_date, c.name as client_name
    FROM activity_log al
    LEFT JOIN bookings b ON b.id = al.booking_id
    LEFT JOIN clients c ON c.id = b.client_id
    ORDER BY al.created_at DESC LIMIT 50
  `).all());
}
