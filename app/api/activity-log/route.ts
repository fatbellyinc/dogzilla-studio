import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logActivity } from '@/lib/activity';

// Log an activity entry from the client (e.g. message sent via WhatsApp/Viber/Messenger)
export async function POST(req: NextRequest) {
  const { booking_id, action, description } = await req.json();
  if (!action || !description) return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  logActivity(booking_id || null, action, description);
  return NextResponse.json({ ok: true });
}

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
