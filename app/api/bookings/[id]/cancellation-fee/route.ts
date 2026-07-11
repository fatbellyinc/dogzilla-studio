import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logActivity, ACTIONS } from '@/lib/activity';
import { recomputeBookingTotals } from '@/lib/booking-calc';

// Cancellation fees charged because a confirmed date was cancelled (and often turned away
// other clients who wanted that slot). `id` in the path is the ORIGINAL cancelled booking.
// Optionally attach the fee to a new booking (typically the one it got rebooked into) so it
// shows up as a billable line on that booking's total/invoice; leave new_booking_id unset to
// just log it for reporting without billing anyone.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const body = await req.json();
  const amount = Number(body.amount);
  if (!amount || amount <= 0) return NextResponse.json({ error: 'amount must be greater than 0' }, { status: 400 });
  const newBookingId = body.new_booking_id ? Number(body.new_booking_id) : null;
  const notes = body.notes || null;

  const original = db.prepare('SELECT id FROM bookings WHERE id = ?').get(id);
  if (!original) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const result = db.prepare(
    'INSERT INTO cancellation_fees (original_booking_id, new_booking_id, amount, notes) VALUES (?, ?, ?, ?)'
  ).run(Number(id), newBookingId, amount, notes);

  if (newBookingId) {
    const target = db.prepare('SELECT id FROM bookings WHERE id = ?').get(newBookingId);
    if (!target) return NextResponse.json({ error: 'new_booking_id not found' }, { status: 404 });
    recomputeBookingTotals(db, newBookingId);
    logActivity(newBookingId, ACTIONS.CANCELLATION_FEE_ADDED, `Cancellation fee ₱${amount.toLocaleString()} charged (from cancelled booking #${id})`);
  }
  logActivity(Number(id), ACTIONS.CANCELLATION_FEE_ADDED, `Cancellation fee ₱${amount.toLocaleString()} logged${newBookingId ? ` — billed to booking #${newBookingId}` : ''}`);

  const fee = db.prepare('SELECT * FROM cancellation_fees WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(fee, { status: 201 });
}

// List cancellation fees connected to this booking, either as the original cancelled booking
// or as the new booking that was billed for it.
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const fees = db.prepare(`
    SELECT cf.*, ob.booking_date as original_booking_date, nb.booking_date as new_booking_date
    FROM cancellation_fees cf
    LEFT JOIN bookings ob ON ob.id = cf.original_booking_id
    LEFT JOIN bookings nb ON nb.id = cf.new_booking_id
    WHERE cf.original_booking_id = ? OR cf.new_booking_id = ?
    ORDER BY cf.created_at DESC
  `).all(id, id);
  return NextResponse.json(fees);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  await params;
  const { searchParams } = new URL(req.url);
  const feeId = searchParams.get('fee_id');
  if (!feeId) return NextResponse.json({ error: 'fee_id is required' }, { status: 400 });
  const fee = db.prepare('SELECT * FROM cancellation_fees WHERE id = ?').get(feeId) as { new_booking_id: number | null } | undefined;
  if (!fee) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  db.prepare('DELETE FROM cancellation_fees WHERE id = ?').run(feeId);
  if (fee.new_booking_id) recomputeBookingTotals(db, fee.new_booking_id);
  return NextResponse.json({ ok: true });
}
