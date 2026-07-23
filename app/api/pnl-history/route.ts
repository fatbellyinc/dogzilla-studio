// Comprehensive P&L from 2023 to present
// Combines: historical_sales + current bookings + utility_bills + fixed_costs
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const startYear = parseInt(req.nextUrl.searchParams.get('from') || '2023');
  const endYear = parseInt(req.nextUrl.searchParams.get('to') || String(new Date().getFullYear()));

  // Monthly fixed costs (rent etc) — apply VAT if vat_on_top is set
  const fixedCosts = db.prepare('SELECT * FROM fixed_costs WHERE active=1').all() as { amount: number; frequency: string; vat_on_top?: number }[];
  const effectiveAmt = (f: { amount: number; vat_on_top?: number }) => f.vat_on_top ? f.amount * 1.12 : f.amount;
  const monthlyFixed = fixedCosts.reduce((s, f) => s + (f.frequency === 'monthly' ? effectiveAmt(f) : effectiveAmt(f) / 12), 0);

  const months = [];

  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const mStr = `${year}-${String(month).padStart(2, '0')}`;

      // Revenue from historical_sales table
      const hist = db.prepare('SELECT revenue FROM historical_sales WHERE year=? AND month=?').get(year, month) as { revenue: number } | undefined;

      // Revenue from actual COMPLETED bookings — total already includes overtime_amount
      // (folded in by recomputeBookingTotals), so don't add it again here
      const appRevRow = db.prepare(`
        SELECT COALESCE(SUM(total), 0) as rev FROM bookings
        WHERE strftime('%Y-%m', booking_date) = ? AND status = 'completed'
      `).get(mStr) as { rev: number };

      // Use completed app revenue if available; fall back to historical/manual entry
      const appRevenue = appRevRow?.rev || 0;
      const histRevenue = hist?.revenue || 0;
      const revenue = appRevenue > 0 ? appRevenue : histRevenue;

      // Utility bills this month
      const utils = db.prepare('SELECT account, SUM(amount) as total FROM utility_bills WHERE year=? AND month=? GROUP BY account').all(year, month) as { account: string; total: number }[];
      const elecStudio = utils.find(u => u.account === 'elec_studio')?.total || 0;
      const elecAux = utils.find(u => u.account === 'elec_aux')?.total || 0;
      const internet = utils.find(u => u.account === 'internet')?.total || 0;
      const water = utils.find(u => u.account === 'water')?.total || 0;
      const totalUtils = elecStudio + elecAux + internet + water;

      // Per-booking variable costs (overhead logged in the app)
      const varCosts = (db.prepare(`
        SELECT COALESCE(SUM(bc.total_cost),0) as total FROM booking_costs bc
        JOIN bookings b ON b.id=bc.booking_id
        WHERE strftime('%Y-%m', COALESCE(bc.day_date, b.booking_date)) = ? AND b.status = 'completed'
          AND NOT (
            bc.type = 'personnel' AND bc.description = 'Studio Crew'
            AND EXISTS (SELECT 1 FROM booking_crew crew WHERE crew.booking_id = bc.booking_id)
          )
          AND bc.type != 'overtime'
          AND NOT (
            bc.type = 'electricity'
            AND EXISTS (
              SELECT 1 FROM booking_equipment be
              WHERE be.booking_id = bc.booking_id
                AND be.is_complimentary = 0
                AND LOWER(be.name) LIKE '%power consumption%'
            )
          )
      `).get(mStr) as { total: number }).total;

      // Rent: ₱90,000/month starting Nov 2023
      const rentStart = new Date('2023-11-01');
      const thisDate = new Date(year, month - 1, 1);
      const rent = thisDate >= rentStart ? monthlyFixed : 0;

      const totalCosts = totalUtils + varCosts + rent;
      const grossProfit = revenue - totalUtils - varCosts;
      const netProfit = revenue - totalCosts;

      // Only include months with any data OR from start of rent
      if (revenue > 0 || totalUtils > 0 || rent > 0) {
        months.push({
          year, month, mStr,
          revenue, elecStudio, elecAux, internet, water,
          totalUtils, varCosts, rent, totalCosts,
          grossProfit, netProfit,
          is_future: thisDate > new Date(),
        });
      }
    }
  }

  // Break-even: monthly fixed + avg utilities
  const avgUtils = months.length > 0
    ? months.reduce((s, m) => s + m.totalUtils, 0) / months.filter(m => m.totalUtils > 0).length
    : 0;
  const breakEven = monthlyFixed + avgUtils;

  // Totals
  const totals = months.reduce((acc, m) => ({
    revenue: acc.revenue + m.revenue,
    totalUtils: acc.totalUtils + m.totalUtils,
    varCosts: acc.varCosts + m.varCosts,
    rent: acc.rent + m.rent,
    netProfit: acc.netProfit + m.netProfit,
  }), { revenue: 0, totalUtils: 0, varCosts: 0, rent: 0, netProfit: 0 });

  // ─── Business break-even: has cumulative profit recovered the capital invested? ───
  const capexTotal = (db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM capital_expenses').get() as { t: number }).t;
  const cumulativeNetProfit = totals.netProfit;
  const capexRemaining = capexTotal - cumulativeNetProfit;
  const businessBreakEven = {
    capexTotal,                                   // total capital invested (construction, equipment...)
    cumulativeNetProfit,                          // all-time operating profit after rent/utilities/costs
    capexRemaining: Math.max(0, capexRemaining),  // how much more profit needed to recover capital
    recoveredPct: capexTotal > 0 ? Math.min(100, (cumulativeNetProfit / capexTotal) * 100) : 0,
    isProfitable: capexRemaining <= 0,            // true once capital is fully recovered
  };

  return NextResponse.json({ months, totals, monthlyFixed, breakEven, avgUtils, businessBreakEven });
}
