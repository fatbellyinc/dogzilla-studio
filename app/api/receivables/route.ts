import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  // All bookings with outstanding balance (not cancelled)
  const bookings = db.prepare(`
    SELECT
      b.id, b.booking_date, b.status, b.total, b.deposit_amount, b.deposit_paid,
      b.studio_rate, b.project_name, b.shoot_type, b.is_pencil,
      b.total * 1.12 as total_with_vat,
      c.name as client_name, c.phone as client_phone, c.email as client_email,
      COALESCE(SUM(p.amount),0) as total_paid,
      (b.total * 1.12) - COALESCE(SUM(p.amount),0) as balance_due
    FROM bookings b
    JOIN clients c ON c.id = b.client_id
    LEFT JOIN payments p ON p.booking_id = b.id
    WHERE b.status NOT IN ('cancelled')
    GROUP BY b.id
    HAVING balance_due > 0.01
    ORDER BY b.booking_date
  `).all() as {
    id: number; booking_date: string; status: string; total: number;
    deposit_amount: number; deposit_paid: number; studio_rate: string;
    project_name: string; shoot_type: string; is_pencil: number;
    total_with_vat: number; client_name: string; client_phone: string;
    client_email: string; total_paid: number; balance_due: number;
  }[];

  // Categorize each
  const result = bookings.map(b => {
    const shootDate = new Date(b.booking_date + 'T00:00');
    const now = new Date(today + 'T00:00');
    const daysToShoot = Math.ceil((shootDate.getTime() - now.getTime()) / 86400000);
    const daysSinceShoot = Math.ceil((now.getTime() - shootDate.getTime()) / 86400000);

    let urgency: 'critical' | 'overdue' | 'due_soon' | 'upcoming' | 'completed_unpaid';
    if (b.status === 'completed' && b.balance_due > 0) urgency = 'completed_unpaid';
    else if (daysToShoot < 0) urgency = 'overdue';
    else if (daysToShoot <= 3) urgency = 'critical';
    else if (daysToShoot <= 7) urgency = 'due_soon';
    else urgency = 'upcoming';

    return { ...b, daysToShoot, daysSinceShoot, urgency };
  });

  // Sort: critical first, then overdue, then due_soon, then upcoming
  const order = { critical: 0, completed_unpaid: 1, overdue: 2, due_soon: 3, upcoming: 4 };
  result.sort((a, b) => (order[a.urgency] - order[b.urgency]) || a.daysToShoot - b.daysToShoot);

  const totalOwed = result.reduce((s, r) => s + r.balance_due, 0);
  const overdueCount = result.filter(r => r.urgency === 'overdue' || r.urgency === 'completed_unpaid').length;

  return NextResponse.json({ items: result, totalOwed, overdueCount });
}
