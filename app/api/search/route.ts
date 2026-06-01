import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const q = req.nextUrl.searchParams.get('q') || '';
  if (!q || q.length < 2) return NextResponse.json({ clients: [], bookings: [], equipment: [] });

  const like = `%${q}%`;

  const clients = db.prepare(`SELECT id, name, company, phone, email FROM clients WHERE name LIKE ? OR company LIKE ? OR phone LIKE ? OR email LIKE ? LIMIT 5`).all(like, like, like, like);

  const bookings = db.prepare(`
    SELECT b.id, b.booking_date, b.status, b.total, b.is_pencil, c.name as client_name, b.project_name, b.shoot_type
    FROM bookings b JOIN clients c ON c.id = b.client_id
    WHERE c.name LIKE ? OR b.project_name LIKE ? OR b.shoot_type LIKE ? OR CAST(b.id AS TEXT) = ?
    ORDER BY b.booking_date DESC LIMIT 5
  `).all(like, like, like, q);

  const equipment = db.prepare(`SELECT id, code, name, category, daily_rate FROM equipment WHERE name LIKE ? OR code LIKE ? AND active=1 LIMIT 5`).all(like, like);

  const invoices = db.prepare(`
    SELECT i.id, i.invoice_number, i.or_number, b.booking_date, c.name as client_name
    FROM invoices i JOIN bookings b ON b.id = i.booking_id JOIN clients c ON c.id = b.client_id
    WHERE i.invoice_number LIKE ? OR i.or_number LIKE ? OR c.name LIKE ?
    LIMIT 3
  `).all(like, like, like);

  return NextResponse.json({ clients, bookings, equipment, invoices });
}
