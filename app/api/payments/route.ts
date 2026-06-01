import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logActivity, ACTIONS } from '@/lib/activity';

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { booking_id, amount, type, method, reference, notes } = body;
  const result = db.prepare(`INSERT INTO payments (booking_id, amount, type, method, reference, notes) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(booking_id, amount, type, method || null, reference || null, notes || null);

  // Auto-mark deposit_paid if deposit payment recorded
  if (type === 'deposit') {
    db.prepare('UPDATE bookings SET deposit_paid = 1, status = ? WHERE id = ? AND status = ?').run('confirmed', booking_id, 'pending');
  } else if (type === 'full') {
    db.prepare('UPDATE bookings SET deposit_paid = 1, status = ? WHERE id = ?').run('confirmed', booking_id);
  }

  logActivity(booking_id, ACTIONS.PAYMENT_RECORDED, `${type} payment of ₱${Number(amount).toLocaleString()} recorded${method ? ` via ${method}` : ''}${reference ? ` (ref: ${reference})` : ''}`);
  return NextResponse.json(db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
}
