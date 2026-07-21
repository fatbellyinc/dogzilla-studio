import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logActivity, ACTIONS } from '@/lib/activity';
import { recomputeBookingTotals } from '@/lib/booking-calc';
import { NO_DATE_SENTINEL } from '@/lib/types';

// Duplicates an existing booking onto a new date. Every detail — equipment, add-ons,
// discounts, VAT/deposit flags, times, project info — carries over unchanged; only the
// dates shift. Multi-day bookings keep the same gaps between days (e.g. day 1, day 3
// stays a 2-day gap), just anchored to the new first day.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();
  const newFirstDate: string = body.new_date;
  if (!newFirstDate) return NextResponse.json({ error: 'new_date is required' }, { status: 400 });

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const oldDays = db.prepare('SELECT * FROM booking_days WHERE booking_id = ? ORDER BY date').all(id) as
    { date: string; day_type: string; studio_rate: string; hours: number; subtotal: number; call_time: string | null; wrap_time: string | null; is_pencil: number | null }[];
  const equipment = db.prepare('SELECT * FROM booking_equipment WHERE booking_id = ? ORDER BY id').all(id) as
    { equipment_id: number | null; quantity: number; rate: number; name: string; item_type: string; is_complimentary: number; discount_pct: number; day_date: string | null; category: string | null }[];

  // First REAL day, not literally oldDays[0] — a "no date yet" placeholder's sentinel value
  // sorts alphabetically first and would otherwise corrupt the offset calculation.
  const oldFirstDate = oldDays.find(d => d.date !== NO_DATE_SENTINEL)?.date || (booking.booking_date as string);
  const offsetMs = new Date(newFirstDate + 'T00:00').getTime() - new Date(oldFirstDate + 'T00:00').getTime();
  const offsetDays = Math.round(offsetMs / 86400000);

  function shift(dateStr: string) {
    if (dateStr === NO_DATE_SENTINEL) return dateStr; // placeholder days carry over as still-unset
    const d = new Date(dateStr + 'T00:00');
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  const newDays = oldDays.length
    ? oldDays.map(d => ({ ...d, date: shift(d.date) }))
    : [{ date: newFirstDate, day_type: 'shoot', studio_rate: booking.studio_rate as string, hours: booking.hours as number, subtotal: booking.subtotal as number, call_time: booking.call_time as string | null, wrap_time: booking.wrap_time as string | null, is_pencil: 0 }];

  const isEquipmentOnly = newDays.every(d => d.studio_rate === 'equipment_only');
  const allDates = newDays.map(d => d.date).filter(d => d !== NO_DATE_SENTINEL);

  // Same double-booking guard as normal booking creation
  if (allDates.length > 0 && !isEquipmentOnly) {
    const placeholders = allDates.map(() => '?').join(',');
    const conflicts = db.prepare(`
      SELECT b.id, bd.date as conflict_date FROM bookings b
      JOIN booking_days bd ON bd.booking_id = b.id
      WHERE b.status = 'confirmed' AND b.is_pencil = 0 AND bd.studio_rate != 'equipment_only'
        AND bd.day_type != 'cancelled'
        AND COALESCE(bd.is_pencil, 0) = 0
        AND bd.date IN (${placeholders})
      UNION
      SELECT b.id, b.booking_date as conflict_date FROM bookings b
      WHERE b.status = 'confirmed' AND b.is_pencil = 0 AND b.studio_rate != 'equipment_only'
        AND NOT EXISTS (SELECT 1 FROM booking_days bd2 WHERE bd2.booking_id = b.id)
        AND b.booking_date IN (${placeholders})
    `).all(...allDates, ...allDates) as { id: number; conflict_date: string }[];
    if (conflicts.length > 0) {
      return NextResponse.json({
        error: 'double_booking',
        message: `A confirmed booking already exists on ${conflicts.map(c => c.conflict_date).join(', ')}. Cannot double-book.`,
        conflicts,
      }, { status: 409 });
    }
  }

  const newRealDays = newDays.filter(d => d.date !== NO_DATE_SENTINEL);
  const newBookingDate = newRealDays[0]?.date || NO_DATE_SENTINEL;
  const newEndDate = newRealDays.length > 1 ? newRealDays[newRealDays.length - 1].date : null;

  const result = db.prepare(`
    INSERT INTO bookings (client_id, booking_date, end_date, studio_rate, hours, subtotal, equipment_total, total, deposit_amount, discount_type, discount_value, discount_amount, status, notes, project_name, shoot_type, production_house, is_pencil, no_deposit, vat_exempt, call_time, wrap_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    booking.client_id, newBookingDate, newEndDate, booking.studio_rate, booking.hours, booking.subtotal,
    booking.equipment_total, booking.total, booking.deposit_amount, booking.discount_type, booking.discount_value,
    booking.discount_amount, booking.notes, booking.project_name, booking.shoot_type, booking.production_house,
    booking.is_pencil, booking.no_deposit, booking.vat_exempt, booking.call_time, booking.wrap_time,
  );
  const newBookingId = result.lastInsertRowid;

  const insDay = db.prepare('INSERT INTO booking_days (booking_id, date, day_type, studio_rate, hours, subtotal, call_time, wrap_time, is_pencil) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const d of newDays) insDay.run(newBookingId, d.date, d.day_type, d.studio_rate, d.hours || 1, d.subtotal || 0, d.call_time || null, d.wrap_time || null, d.is_pencil ? 1 : 0);

  if (equipment.length) {
    const insEq = db.prepare(`INSERT INTO booking_equipment (booking_id, equipment_id, quantity, rate, name, item_type, is_complimentary, discount_pct, day_date, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const item of equipment) {
      insEq.run(newBookingId, item.equipment_id, item.quantity, item.rate, item.name, item.item_type,
        item.is_complimentary, item.discount_pct, item.day_date ? shift(item.day_date) : null, item.category || null);
    }
  }

  recomputeBookingTotals(db, Number(newBookingId));

  const newBooking = db.prepare(`SELECT b.*, c.name as client_name FROM bookings b JOIN clients c ON c.id = b.client_id WHERE b.id = ?`).get(newBookingId);
  const b = newBooking as { id: number; client_name?: string; booking_date?: string; total?: number };
  logActivity(Number(newBookingId), ACTIONS.BOOKING_CREATED, `Booking rebooked from #${id} for ${b.client_name || ''} on ${b.booking_date || ''} — ₱${(b.total || 0).toLocaleString()}`);

  return NextResponse.json(newBooking, { status: 201 });
}
