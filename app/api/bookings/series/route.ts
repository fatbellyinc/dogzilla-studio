// Get all bookings in the same recurring series
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const seriesId = req.nextUrl.searchParams.get('series_id');
  if (!seriesId) return NextResponse.json([]);
  return NextResponse.json(db.prepare(`
    SELECT b.id, b.booking_date, b.status, b.total, b.is_pencil, c.name as client_name
    FROM bookings b JOIN clients c ON c.id = b.client_id
    WHERE b.series_id = ? OR b.id = ?
    ORDER BY b.booking_date
  `).all(seriesId, seriesId));
}
