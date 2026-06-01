import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import crypto from 'crypto';

// Generate or get portal token for a booking
export async function POST(req: NextRequest) {
  const db = getDb();
  const { booking_id } = await req.json();
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking_id) as { portal_token?: string } | undefined;
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (booking.portal_token) return NextResponse.json({ token: booking.portal_token });
  const token = crypto.randomBytes(16).toString('hex');
  db.prepare('UPDATE bookings SET portal_token = ? WHERE id = ?').run(token, booking_id);
  return NextResponse.json({ token });
}

// Get booking by token (public, no auth)
export async function GET(req: NextRequest) {
  const db = getDb();
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });
  const booking = db.prepare(`
    SELECT b.*, c.name as client_name, c.company as client_company, c.phone as client_phone, c.email as client_email
    FROM bookings b JOIN clients c ON c.id = b.client_id
    WHERE b.portal_token = ?
  `).get(token);
  if (!booking) return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
  const equipment = db.prepare('SELECT * FROM booking_equipment WHERE booking_id = ?').all((booking as { id: number }).id);
  const payments = db.prepare('SELECT amount, type, method, paid_at FROM payments WHERE booking_id = ? ORDER BY paid_at').all((booking as { id: number }).id);
  const quotation = db.prepare('SELECT * FROM quotations WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1').get((booking as { id: number }).id);
  const invoice = db.prepare('SELECT * FROM invoices WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1').get((booking as { id: number }).id);
  return NextResponse.json({ booking, equipment, payments, quotation, invoice });
}
