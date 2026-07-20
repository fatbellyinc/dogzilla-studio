import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Reports which distinct resources are occupied on a given date — the Main Studio itself, and
// the "Additional Holding Areas" addon — separately, so a second client can be booked into
// whichever resource the first client didn't take (e.g. Holding Areas only, via an Equipment
// Only booking) without having to manually cross-check every existing booking's equipment list.
export async function GET(req: NextRequest) {
  const db = getDb();
  const date = req.nextUrl.searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 });

  // Main Studio: same definition used by the double-booking guard — confirmed, non-pencil,
  // non-equipment-only, non-cancelled day occupying this exact date.
  const studioBookings = db.prepare(`
    SELECT DISTINCT b.id, c.name as client_name, b.status
    FROM bookings b
    JOIN clients c ON c.id = b.client_id
    LEFT JOIN booking_days bd ON bd.booking_id = b.id
    WHERE b.status = 'confirmed' AND b.is_pencil = 0
      AND (
        (bd.date = ? AND bd.studio_rate != 'equipment_only' AND bd.day_type != 'cancelled' AND COALESCE(bd.is_pencil, 0) = 0)
        OR (bd.id IS NULL AND b.booking_date = ? AND b.studio_rate != 'equipment_only')
      )
  `).all(date, date) as { id: number; client_name: string; status: string }[];

  // Additional Holding Areas: any non-cancelled booking with a "holding" line item scoped to
  // this date (or booking-wide, for single-day bookings that never set a day_date).
  const holdingBookings = db.prepare(`
    SELECT DISTINCT b.id, c.name as client_name, b.status
    FROM booking_equipment be
    JOIN bookings b ON b.id = be.booking_id
    JOIN clients c ON c.id = b.client_id
    WHERE b.status != 'cancelled' AND LOWER(be.name) LIKE '%holding%'
      AND (
        be.day_date = ?
        OR (be.day_date IS NULL AND ? BETWEEN b.booking_date AND COALESCE(b.end_date, b.booking_date))
      )
  `).all(date, date) as { id: number; client_name: string; status: string }[];

  return NextResponse.json({
    studio: { booked: studioBookings.length > 0, bookings: studioBookings },
    holding: { booked: holdingBookings.length > 0, bookings: holdingBookings },
  });
}
