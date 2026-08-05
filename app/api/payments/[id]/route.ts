import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logActivity, ACTIONS } from '@/lib/activity';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const body = await req.json();
  const { amount, type, method, reference, paid_at } = body;

  const existing = db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as
    { booking_id: number; amount: number; type: string; method: string | null; reference: string | null } | undefined;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  db.prepare('UPDATE payments SET amount = ?, type = ?, method = ?, reference = ?, paid_at = COALESCE(?, paid_at) WHERE id = ?')
    .run(amount, type, method || null, reference || null, paid_at || null, id);

  // Re-derive deposit_paid/fully_paid from the actual ledger — an edited amount/type can push
  // a booking across (or back below) the deposit/full threshold, same logic as recording a
  // fresh payment in POST /api/payments.
  const booking = db.prepare('SELECT total, vat_exempt, deposit_amount FROM bookings WHERE id = ?').get(existing.booking_id) as
    { total: number; vat_exempt: number; deposit_amount: number } | undefined;
  if (booking) {
    const invoiceTotal = booking.vat_exempt ? booking.total : Math.round(booking.total * 1.12 * 100) / 100;
    const { paid } = db.prepare('SELECT COALESCE(SUM(amount), 0) as paid FROM payments WHERE booking_id = ?').get(existing.booking_id) as { paid: number };
    const fullyPaid = paid >= invoiceTotal - 0.01;
    const depositPaid = fullyPaid || (booking.deposit_amount > 0 && paid >= booking.deposit_amount - 0.01);
    db.prepare('UPDATE bookings SET fully_paid = ?, deposit_paid = ? WHERE id = ?').run(fullyPaid ? 1 : 0, depositPaid ? 1 : 0, existing.booking_id);
  }

  logActivity(existing.booking_id, ACTIONS.PAYMENT_RECORDED, `Payment edited — now ${type} of ₱${Number(amount).toLocaleString()}${method ? ` via ${method}` : ''}`);
  return NextResponse.json(db.prepare('SELECT * FROM payments WHERE id = ?').get(id));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  db.prepare('DELETE FROM payments WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
