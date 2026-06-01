import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const year = req.nextUrl.searchParams.get('year') || String(new Date().getFullYear());

  // Monthly occupancy (unique booked days / days in month)
  const monthlyData = db.prepare(`
    SELECT
      strftime('%m', booking_date) as month,
      COUNT(DISTINCT booking_date) as booked_days,
      COUNT(*) as booking_count,
      SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) as revenue,
      AVG(CASE WHEN status != 'cancelled' THEN total END) as avg_booking_value
    FROM bookings
    WHERE strftime('%Y', booking_date) = ? AND status != 'cancelled'
    GROUP BY month ORDER BY month
  `).all(year) as { month: string; booked_days: number; booking_count: number; revenue: number; avg_booking_value: number }[];

  // Days in each month for the year
  const daysInMonth = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Number(year), i + 1, 0);
    return { month: String(i + 1).padStart(2, '0'), days: d.getDate() };
  });

  // Merge
  const monthly = daysInMonth.map(dim => {
    const data = monthlyData.find(m => m.month === dim.month);
    const occupancy = data ? (data.booked_days / dim.days * 100) : 0;
    return {
      month: dim.month,
      days_in_month: dim.days,
      booked_days: data?.booked_days || 0,
      available_days: dim.days - (data?.booked_days || 0),
      booking_count: data?.booking_count || 0,
      revenue: data?.revenue || 0,
      avg_booking_value: data?.avg_booking_value || 0,
      occupancy_pct: Math.round(occupancy),
    };
  });

  // Day of week breakdown (0=Sun, 1=Mon...6=Sat)
  const byDayOfWeek = db.prepare(`
    SELECT
      strftime('%w', booking_date) as dow,
      COUNT(*) as count,
      SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) as revenue
    FROM bookings
    WHERE strftime('%Y', booking_date) = ? AND status != 'cancelled'
    GROUP BY dow ORDER BY dow
  `).all(year) as { dow: string; count: number; revenue: number }[];

  // Studio rate breakdown for this year
  const rateBreakdown = db.prepare(`
    SELECT studio_rate, COUNT(*) as count,
      SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) as revenue
    FROM bookings WHERE strftime('%Y', booking_date) = ? AND status != 'cancelled'
    GROUP BY studio_rate ORDER BY count DESC
  `).all(year) as { studio_rate: string; count: number; revenue: number }[];

  // Totals
  const totals = monthly.reduce((acc, m) => ({
    booked_days: acc.booked_days + m.booked_days,
    total_days: acc.total_days + m.days_in_month,
    revenue: acc.revenue + m.revenue,
    booking_count: acc.booking_count + m.booking_count,
  }), { booked_days: 0, total_days: 0, revenue: 0, booking_count: 0 });

  const overall_occupancy = totals.total_days > 0 ? Math.round(totals.booked_days / totals.total_days * 100) : 0;
  const revenue_per_day = totals.booked_days > 0 ? totals.revenue / totals.booked_days : 0;

  return NextResponse.json({ monthly, byDayOfWeek, rateBreakdown, totals, overall_occupancy, revenue_per_day });
}
