import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Compares, per month, the electricity cost logged against bookings (via the Overhead panel's
// "⚡ Power" tab — an estimate of what each shoot actually drew, based on hours/AC areas used)
// against the studio's real electricity bills (Financial History > Utility Bills, elec_studio +
// elec_aux accounts). Since electricity isn't billed to clients as its own invoice line — it's
// baked into the flat studio-rate price — "recovered" here means "the estimated electricity
// cost of shoots this month," which is the useful number to hold up against the real bill to
// see whether the flat pricing is actually covering power draw or not.
export async function GET(req: NextRequest) {
  const db = getDb();
  const year = req.nextUrl.searchParams.get('year');
  if (!year) return NextResponse.json({ error: 'year is required' }, { status: 400 });

  const recoveredRows = db.prepare(`
    SELECT CAST(strftime('%m', b.booking_date) AS INTEGER) as month,
      COALESCE(SUM(bc.total_cost), 0) as recovered,
      COUNT(DISTINCT b.id) as shoots
    FROM booking_costs bc
    JOIN bookings b ON b.id = bc.booking_id
    WHERE bc.type = 'electricity' AND b.status = 'completed' AND strftime('%Y', b.booking_date) = ?
    GROUP BY month
  `).all(year) as { month: number; recovered: number; shoots: number }[];

  const billedRows = db.prepare(`
    SELECT month, COALESCE(SUM(amount), 0) as billed
    FROM utility_bills
    WHERE year = ? AND account IN ('elec_studio', 'elec_aux')
    GROUP BY month
  `).all(Number(year)) as { month: number; billed: number }[];

  const byMonth: Record<number, { month: number; recovered: number; shoots: number; billed: number }> = {};
  for (let m = 1; m <= 12; m++) byMonth[m] = { month: m, recovered: 0, shoots: 0, billed: 0 };
  for (const r of recoveredRows) byMonth[r.month] = { ...byMonth[r.month], recovered: r.recovered, shoots: r.shoots };
  for (const r of billedRows) byMonth[r.month] = { ...byMonth[r.month], billed: r.billed };

  const months = Object.values(byMonth);
  const totals = months.reduce((acc, m) => ({
    recovered: acc.recovered + m.recovered,
    billed: acc.billed + m.billed,
    shoots: acc.shoots + m.shoots,
  }), { recovered: 0, billed: 0, shoots: 0 });

  return NextResponse.json({ months, totals });
}
