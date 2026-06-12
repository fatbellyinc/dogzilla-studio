import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logActivity, ACTIONS } from '@/lib/activity';

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { booking_id, amount, type, method, reference, notes } = body;
  const result = db.prepare(`INSERT INTO payments (booking_id, amount, type, method, reference, notes) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(booking_id, amount, type, method || null, reference || null, notes || null);

  // Auto-mark deposit_paid — ALWAYS set the flag for deposit/full payments,
  // regardless of booking status (was gated on status='pending', so deposits
  // recorded on already-confirmed bookings never set the flag)
  if (type === 'deposit' || type === 'full') {
    db.prepare('UPDATE bookings SET deposit_paid = 1 WHERE id = ?').run(booking_id);
  }
  if (type === 'deposit') {
    db.prepare(`UPDATE bookings SET status = 'confirmed' WHERE id = ? AND status = 'pending'`).run(booking_id);
  }

  // Auto-mark fully_paid / deposit_paid based on actual amounts paid
  const booking = db.prepare('SELECT total, vat_exempt, deposit_amount FROM bookings WHERE id = ?').get(booking_id) as { total: number; vat_exempt: number; deposit_amount: number } | undefined;
  if (booking) {
    const invoiceTotal = booking.vat_exempt ? booking.total : Math.round(booking.total * 1.12 * 100) / 100;
    const { paid } = db.prepare('SELECT COALESCE(SUM(amount), 0) as paid FROM payments WHERE booking_id = ?').get(booking_id) as { paid: number };
    if (paid >= invoiceTotal - 0.01) {
      db.prepare('UPDATE bookings SET fully_paid = 1, deposit_paid = 1 WHERE id = ?').run(booking_id);
    } else if (booking.deposit_amount > 0 && paid >= booking.deposit_amount - 0.01) {
      // Any payment type covering the deposit amount counts as deposit received
      db.prepare('UPDATE bookings SET deposit_paid = 1 WHERE id = ?').run(booking_id);
    }
  }

  logActivity(booking_id, ACTIONS.PAYMENT_RECORDED, `${type} payment of ₱${Number(amount).toLocaleString()} recorded${method ? ` via ${method}` : ''}${reference ? ` (ref: ${reference})` : ''}`);
  return NextResponse.json(db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
}
