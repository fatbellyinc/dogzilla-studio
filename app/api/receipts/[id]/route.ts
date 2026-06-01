import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const booking = db.prepare(`SELECT b.*, c.name as client_name, c.company as client_company FROM bookings b JOIN clients c ON c.id = b.client_id WHERE b.id = ?`).get((payment as { booking_id: number }).booking_id);
  return NextResponse.json({ payment, booking });
}
