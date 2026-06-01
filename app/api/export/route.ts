import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(',')),
  ];
  return lines.join('\r\n');
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const type = req.nextUrl.searchParams.get('type') || 'bookings';
  const month = req.nextUrl.searchParams.get('month');

  let rows: Record<string, unknown>[] = [];
  let filename = 'dogzilla-export.csv';

  if (type === 'bookings') {
    let q = `SELECT b.id, b.booking_date, b.end_date, c.name as client, c.phone, b.studio_rate, b.hours,
      b.subtotal, b.equipment_total, b.discount_amount, b.total,
      b.total * 1.12 as total_with_vat,
      b.deposit_amount, b.deposit_paid, b.status, b.notes, b.created_at
      FROM bookings b JOIN clients c ON c.id = b.client_id`;
    const args: unknown[] = [];
    if (month) { q += ' WHERE b.booking_date LIKE ?'; args.push(`${month}%`); }
    q += ' ORDER BY b.booking_date DESC';
    rows = db.prepare(q).all(...args) as Record<string, unknown>[];
    filename = `dogzilla-bookings${month ? '-' + month : ''}.csv`;
  } else if (type === 'clients') {
    rows = db.prepare(`SELECT c.*, COUNT(b.id) as bookings,
      COALESCE(SUM(CASE WHEN b.status!='cancelled' THEN b.total END),0) as total_revenue
      FROM clients c LEFT JOIN bookings b ON b.client_id = c.id
      GROUP BY c.id ORDER BY c.name`).all() as Record<string, unknown>[];
    filename = 'dogzilla-clients.csv';
  } else if (type === 'revenue') {
    rows = db.prepare(`SELECT strftime('%Y-%m', booking_date) as month,
      COUNT(*) as bookings,
      SUM(CASE WHEN status!='cancelled' THEN total ELSE 0 END) as revenue_ex_vat,
      SUM(CASE WHEN status!='cancelled' THEN total * 0.12 ELSE 0 END) as vat,
      SUM(CASE WHEN status!='cancelled' THEN total * 1.12 ELSE 0 END) as revenue_inc_vat
      FROM bookings GROUP BY month ORDER BY month DESC`).all() as Record<string, unknown>[];
    filename = 'dogzilla-revenue.csv';
  } else if (type === 'costs') {
    rows = db.prepare(`SELECT b.booking_date, c.name as client, bc.type, bc.description,
      bc.quantity, bc.unit_cost, bc.total_cost
      FROM booking_costs bc JOIN bookings b ON b.id = bc.booking_id
      JOIN clients c ON c.id = b.client_id
      ORDER BY b.booking_date DESC`).all() as Record<string, unknown>[];
    filename = 'dogzilla-costs.csv';
  } else if (type === 'equipment') {
    rows = db.prepare(`SELECT * FROM equipment WHERE active = 1 ORDER BY category, name`).all() as Record<string, unknown>[];
    filename = 'dogzilla-equipment.csv';
  }

  const csv = toCSV(rows);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
