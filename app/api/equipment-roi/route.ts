import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  // For each equipment item, calculate total revenue earned
  const items = db.prepare(`
    SELECT
      e.id, e.code, e.name, e.category, e.daily_rate, e.purchase_price,
      e.purchase_date, e.vendor, e.pre_studio, e.quantity,
      COALESCE(SUM(CASE WHEN b.status != 'cancelled' THEN be.rate * be.quantity ELSE 0 END), 0) as revenue_earned,
      COUNT(DISTINCT CASE WHEN b.status != 'cancelled' THEN b.id END) as times_rented
    FROM equipment e
    LEFT JOIN booking_equipment be ON be.equipment_id = e.id
    LEFT JOIN bookings b ON b.id = be.booking_id
    WHERE e.active = 1
    GROUP BY e.id
    ORDER BY revenue_earned DESC
  `).all() as {
    id: number; code: string; name: string; category: string; daily_rate: number;
    purchase_price: number; purchase_date: string | null; vendor: string | null;
    pre_studio: number; quantity: number; revenue_earned: number; times_rented: number;
  }[];

  const result = items.map(item => {
    const pp = item.purchase_price || 0;
    const roi_pct = pp > 0 ? (item.revenue_earned / pp * 100) : null;
    const paid_off = pp > 0 && item.revenue_earned >= pp;
    const remaining = pp > 0 ? Math.max(0, pp - item.revenue_earned) : 0;
    return { ...item, roi_pct, paid_off, remaining };
  });

  // Totals
  const totalInvestment = result.reduce((s, i) => s + (i.purchase_price || 0), 0);
  const totalRevenue = result.reduce((s, i) => s + i.revenue_earned, 0);
  const paidOff = result.filter(i => i.paid_off).length;

  return NextResponse.json({ items: result, totalInvestment, totalRevenue, paidOff });
}
