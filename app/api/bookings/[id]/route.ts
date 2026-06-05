import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logActivity, ACTIONS } from '@/lib/activity';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const booking = db.prepare(`
    SELECT b.*, c.name as client_name, c.company as client_company, c.tin as client_tin, c.phone as client_phone, c.email as client_email, c.address as client_address
    FROM bookings b JOIN clients c ON c.id = b.client_id WHERE b.id = ?
  `).get(id);
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const equipment = db.prepare('SELECT * FROM booking_equipment WHERE booking_id = ?').all(id);
  const payments = db.prepare('SELECT * FROM payments WHERE booking_id = ? ORDER BY paid_at').all(id);
  const quotation = db.prepare('SELECT * FROM quotations WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1').get(id);
  const invoice = db.prepare('SELECT * FROM invoices WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1').get(id);
  const bookingDays = db.prepare('SELECT * FROM booking_days WHERE booking_id = ? ORDER BY date').all(id);
  return NextResponse.json({ booking, equipment, payments, quotation, invoice, bookingDays });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const body = await req.json();
  const { status, notes, deposit_paid, fully_paid, discount_type, discount_value, is_pencil, vat_exempt, no_deposit, call_time, wrap_time, overtime_hours, overtime_amount } = body;

  if (status !== undefined) { db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, id); logActivity(Number(id), ACTIONS.STATUS_CHANGED, `Status changed to ${status}`); }
  if (notes !== undefined) db.prepare('UPDATE bookings SET notes = ? WHERE id = ?').run(notes, id);
  if (deposit_paid !== undefined) db.prepare('UPDATE bookings SET deposit_paid = ? WHERE id = ?').run(deposit_paid ? 1 : 0, id);
  if (fully_paid !== undefined) db.prepare('UPDATE bookings SET fully_paid = ? WHERE id = ?').run(fully_paid ? 1 : 0, id);
  if (vat_exempt !== undefined) db.prepare("UPDATE bookings SET vat_exempt = ? WHERE id = ?").run(vat_exempt ? 1 : 0, id);
  if (no_deposit !== undefined) db.prepare("UPDATE bookings SET no_deposit = ? WHERE id = ?").run(no_deposit ? 1 : 0, id);
  if (is_pencil !== undefined) { db.prepare('UPDATE bookings SET is_pencil = ? WHERE id = ?').run(is_pencil ? 1 : 0, id); logActivity(Number(id), ACTIONS.PENCIL_TOGGLED, is_pencil ? 'Marked as pencil booking' : 'Pencil removed — confirmed'); }
  if (call_time !== undefined) db.prepare('UPDATE bookings SET call_time = ? WHERE id = ?').run(call_time || null, id);
  if (wrap_time !== undefined) { db.prepare('UPDATE bookings SET wrap_time = ? WHERE id = ?').run(wrap_time || null, id); if (call_time || wrap_time) logActivity(Number(id), ACTIONS.TIMES_SET, `Shoot times set: ${call_time || '?'} → ${wrap_time || '?'}`); }
  if (overtime_hours !== undefined) { db.prepare('UPDATE bookings SET overtime_hours = ?, overtime_amount = ? WHERE id = ?').run(overtime_hours, overtime_amount || 0, id); if (overtime_hours > 0) logActivity(Number(id), ACTIONS.OT_LOGGED, `Overtime recorded: ${overtime_hours}hrs — ₱${(overtime_amount || 0).toLocaleString()}`); }

  // Recalculate totals when discount changes
  if (discount_type !== undefined || discount_value !== undefined) {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id) as { subtotal: number; equipment_total: number } | undefined;
    if (booking) {
      const base = booking.subtotal + booking.equipment_total;
      const dType = discount_type ?? null;
      const dVal = discount_value ?? 0;
      let discountAmount = 0;
      if (dType === 'percent') discountAmount = base * (dVal / 100);
      else if (dType === 'fixed') discountAmount = Math.min(dVal, base);
      const newTotal = base - discountAmount;
      const newDeposit = newTotal * 0.5;
      db.prepare('UPDATE bookings SET discount_type=?, discount_value=?, discount_amount=?, total=?, deposit_amount=? WHERE id=?')
        .run(dType, dVal, discountAmount, newTotal, newDeposit, id);
    }
  }

  return NextResponse.json(db.prepare('SELECT * FROM bookings WHERE id = ?').get(id));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
