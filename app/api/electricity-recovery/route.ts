import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Compares, per month, what was actually BILLED to clients for electricity — the "Power
// Consumption" add-on line item (BookingEditor's dedicated ⚡ add-on, named "Power Consumption"
// or "Power Consumption — <day>" for multi-day bookings), plus any older bookings that used the
// legacy "Electricity" naming — against the studio's real electric bills (Financial History >
// Utility Bills, elec_studio + elec_aux accounts). Only bookings marked completed count,
// matching how every other revenue figure in the app is realized.
export async function GET(req: NextRequest) {
  const db = getDb();
  const year = req.nextUrl.searchParams.get('year');
  if (!year) return NextResponse.json({ error: 'year is required' }, { status: 400 });

  const billedToClientsRows = db.prepare(`
    SELECT CAST(strftime('%m', b.booking_date) AS INTEGER) as month,
      COALESCE(SUM(CASE WHEN be.is_complimentary THEN 0 ELSE be.rate * be.quantity * (1 - COALESCE(be.discount_pct, 0) / 100.0) END), 0) as billed_to_clients,
      COUNT(DISTINCT b.id) as shoots
    FROM booking_equipment be
    JOIN bookings b ON b.id = be.booking_id
    WHERE (LOWER(be.name) LIKE '%power consumption%' OR LOWER(be.name) LIKE '%electric%')
      AND b.status = 'completed' AND strftime('%Y', b.booking_date) = ?
    GROUP BY month
  `).all(year) as { month: number; billed_to_clients: number; shoots: number }[];

  const meralcoRows = db.prepare(`
    SELECT month, COALESCE(SUM(amount), 0) as meralco
    FROM utility_bills
    WHERE year = ? AND account IN ('elec_studio', 'elec_aux')
    GROUP BY month
  `).all(Number(year)) as { month: number; meralco: number }[];

  const byMonth: Record<number, { month: number; billed_to_clients: number; shoots: number; meralco: number }> = {};
  for (let m = 1; m <= 12; m++) byMonth[m] = { month: m, billed_to_clients: 0, shoots: 0, meralco: 0 };
  for (const r of billedToClientsRows) byMonth[r.month] = { ...byMonth[r.month], billed_to_clients: r.billed_to_clients, shoots: r.shoots };
  for (const r of meralcoRows) byMonth[r.month] = { ...byMonth[r.month], meralco: r.meralco };

  const months = Object.values(byMonth);
  const totals = months.reduce((acc, m) => ({
    billed_to_clients: acc.billed_to_clients + m.billed_to_clients,
    meralco: acc.meralco + m.meralco,
    shoots: acc.shoots + m.shoots,
  }), { billed_to_clients: 0, meralco: 0, shoots: 0 });

  return NextResponse.json({ months, totals });
}
