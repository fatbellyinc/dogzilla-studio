import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Returns actual monthly revenue from live bookings table
export async function GET(req: NextRequest) {
  const db = getDb();
  const year = req.nextUrl.searchParams.get('year');

  if (year) {
    // Monthly breakdown for a specific year
    const rows = db.prepare(`
      SELECT
        CAST(strftime('%m', booking_date) AS INTEGER) as month,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as shoot_count,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN status = 'completed' AND COALESCE(vat_exempt, 0) = 0 THEN total * 0.12 ELSE 0 END), 0) as vat,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count
      FROM bookings
      WHERE strftime('%Y', booking_date) = ?
      GROUP BY month
      ORDER BY month
    `).all(year) as { month: number; shoot_count: number; revenue: number; vat: number; cancelled_count: number }[];

    // Fill all 12 months (including zeros)
    const byMonth: Record<number, { shoot_count: number; revenue: number; vat: number; cancelled_count: number }> = {};
    for (const r of rows) byMonth[r.month] = r;

    return NextResponse.json(byMonth);
  }

  // All years with booking data
  const years = db.prepare(`
    SELECT
      CAST(strftime('%Y', booking_date) AS INTEGER) as year,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as shoot_count,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END), 0) as revenue
    FROM bookings
    GROUP BY year
    ORDER BY year DESC
  `).all() as { year: number; shoot_count: number; revenue: number }[];

  return NextResponse.json(years);
}
