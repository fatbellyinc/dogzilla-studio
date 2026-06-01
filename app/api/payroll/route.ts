import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const month = req.nextUrl.searchParams.get('month') || new Date().toISOString().slice(0, 7);

  const crew = db.prepare(`
    SELECT bc.name, bc.role, bc.rate, bc.phone,
      COUNT(DISTINCT b.id) as shoots,
      SUM(bc.rate) as total_pay,
      GROUP_CONCAT(b.booking_date || ' (' || COALESCE(b.project_name, c.name) || ')', ' | ') as bookings_list
    FROM booking_crew bc
    JOIN bookings b ON b.id = bc.booking_id
    JOIN clients c ON c.id = b.client_id
    WHERE b.booking_date LIKE ? AND b.status NOT IN ('cancelled')
    GROUP BY bc.name, bc.role, bc.rate
    ORDER BY bc.role, bc.name
  `).all(`${month}%`) as {
    name: string; role: string; rate: number; phone: string;
    shoots: number; total_pay: number; bookings_list: string;
  }[];

  const totalPayroll = crew.reduce((s, c) => s + c.total_pay, 0);

  // Also include fixed salary costs
  const fixedSalaries = db.prepare("SELECT * FROM fixed_costs WHERE active=1 AND category='salary'").all() as { name: string; amount: number; frequency: string }[];
  const fixedSalaryTotal = fixedSalaries.reduce((s, f) => s + (f.frequency === 'monthly' ? f.amount : f.amount / 12), 0);

  return NextResponse.json({ crew, totalPayroll, fixedSalaries, fixedSalaryTotal, totalAll: totalPayroll + fixedSalaryTotal });
}
