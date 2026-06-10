// Edit equipment on an existing booking (any status)
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logActivity, ACTIONS } from '@/lib/activity';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const { equipment_items, studio_subtotal } = await req.json();

  // Optional: update the studio price (custom price override)
  if (studio_subtotal !== undefined && studio_subtotal !== null) {
    db.prepare('UPDATE bookings SET subtotal = ? WHERE id = ?').run(Number(studio_subtotal) || 0, id);
  }

  // Replace all equipment for this booking
  db.prepare('DELETE FROM booking_equipment WHERE booking_id = ?').run(id);
  const ins = db.prepare('INSERT INTO booking_equipment (booking_id, equipment_id, quantity, rate, name, item_type, is_complimentary, discount_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (const item of equipment_items || []) {
    ins.run(id, item.equipment_id || null, item.quantity, item.rate, item.name, item.item_type || 'individual', item.is_complimentary ? 1 : 0, item.discount_pct || 0);
  }

  // Recalculate totals
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id) as { subtotal: number; discount_type: string; discount_value: number } | undefined;
  if (booking) {
    const eqTotal = (equipment_items || []).reduce((s: number, e: { rate: number; quantity: number; is_complimentary?: boolean }) =>
      s + (e.is_complimentary ? 0 : e.rate * e.quantity), 0);
    const base = booking.subtotal + eqTotal;
    let discountAmount = 0;
    if (booking.discount_type === 'percent') discountAmount = base * (booking.discount_value / 100);
    else if (booking.discount_type === 'fixed') discountAmount = Math.min(booking.discount_value, base);
    const total = base - discountAmount;
    db.prepare('UPDATE bookings SET equipment_total=?, total=?, deposit_amount=?, discount_amount=? WHERE id=?')
      .run(eqTotal, total, total * 0.5, discountAmount, id);
  }

  logActivity(Number(id), ACTIONS.ITEMS_EDITED, `Equipment updated — ${(equipment_items || []).length} item(s)`);
  return NextResponse.json({ ok: true });
}
