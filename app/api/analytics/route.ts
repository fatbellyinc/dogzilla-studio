import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  // Monthly revenue — last 18 months (app bookings)
  const monthlyRevenue = db.prepare(`
    SELECT strftime('%Y-%m', booking_date) as month,
      COUNT(*) as booking_count,
      SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as revenue,
      SUM(CASE WHEN status = 'completed' THEN total * 0.12 ELSE 0 END) as vat
    FROM bookings
    WHERE booking_date >= date('now', '-18 months')
    GROUP BY month ORDER BY month
  `).all();

  // Monthly costs
  const monthlyCosts = db.prepare(`
    SELECT strftime('%Y-%m', b.booking_date) as month,
      SUM(bc.total_cost) as costs
    FROM booking_costs bc
    JOIN bookings b ON b.id = bc.booking_id
    WHERE b.booking_date >= date('now', '-12 months') AND b.status = 'completed'
      AND bc.type != 'personnel'
    GROUP BY month ORDER BY month
  `).all() as { month: string; costs: number }[];

  // Studio rate breakdown
  const rateBreakdown = db.prepare(`
    SELECT studio_rate, COUNT(*) as count,
      SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) as revenue
    FROM bookings GROUP BY studio_rate ORDER BY revenue DESC
  `).all();

  // Top clients
  const topClients = db.prepare(`
    SELECT c.name, COUNT(b.id) as bookings,
      SUM(CASE WHEN b.status != 'cancelled' THEN b.total ELSE 0 END) as revenue
    FROM clients c LEFT JOIN bookings b ON b.client_id = c.id
    GROUP BY c.id ORDER BY revenue DESC LIMIT 10
  `).all();

  // Totals
  const totals = db.prepare(`
    SELECT
      COUNT(*) as total_bookings,
      COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
      SUM(CASE WHEN status NOT IN ('cancelled') THEN total ELSE 0 END) as gross_revenue,
      SUM(CASE WHEN status NOT IN ('cancelled') THEN deposit_amount ELSE 0 END) as total_deposits,
      SUM(CASE WHEN deposit_paid = 1 THEN deposit_amount ELSE 0 END) as deposits_collected
    FROM bookings
  `).get() as Record<string, number>;

  const totalCosts = (db.prepare(`SELECT COALESCE(SUM(bc.total_cost),0) as total FROM booking_costs bc JOIN bookings b ON b.id=bc.booking_id WHERE b.status != 'cancelled'`).get() as { total: number }).total;

  // Payment methods breakdown
  const paymentMethods = db.prepare(`
    SELECT method, COUNT(*) as count, SUM(amount) as total
    FROM payments WHERE method IS NOT NULL GROUP BY method ORDER BY total DESC
  `).all();

  // Upcoming bookings count
  const upcoming = (db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE booking_date >= date('now') AND status NOT IN ('cancelled','completed')`).get() as { c: number }).c;

  // Equipment most rented
  const topEquipment = db.prepare(`
    SELECT be.name, COUNT(*) as times, SUM(be.rate * be.quantity) as revenue
    FROM booking_equipment be
    JOIN bookings b ON b.id = be.booking_id
    WHERE b.status != 'cancelled' AND be.is_complimentary = 0
    GROUP BY be.name ORDER BY times DESC LIMIT 8
  `).all();

  // Historical sales summary (all-time, from pre-app records)
  const historicalSummary = db.prepare(`
    SELECT year, SUM(revenue) as revenue, SUM(shoot_count) as shoots
    FROM historical_sales GROUP BY year ORDER BY year
  `).all() as { year: number; revenue: number; shoots: number }[];

  // Utility bills totals
  const utilityTotals = db.prepare(`
    SELECT account, SUM(amount) as total FROM utility_bills GROUP BY account
  `).all() as { account: string; total: number }[];

  // Capital expenses total
  const capexTotal = (db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM capital_expenses').get() as { total: number }).total;

  return NextResponse.json({
    monthlyRevenue, monthlyCosts, rateBreakdown, topClients, totals,
    totalCosts, paymentMethods, upcoming, topEquipment,
    historicalSummary, utilityTotals, capexTotal,
  });
}
