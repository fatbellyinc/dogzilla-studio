// Edit booking_days on an existing booking — add, remove, or change dates after creation
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logActivity, ACTIONS } from '@/lib/activity';
import { recomputeBookingTotals } from '@/lib/booking-calc';
import { NO_DATE_SENTINEL } from '@/lib/types';

interface DayInput { date: string; day_type: string; studio_rate: string; hours: number; subtotal: number; is_pencil?: boolean }

// Sort real dates chronologically but keep any "no date yet" placeholder day last, regardless
// of its sentinel value's literal (very old) date string.
function daySortKey(date: string) {
  return date === NO_DATE_SENTINEL ? '9999-99-99' : date;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const bookingId = Number(id);
  const { booking_days } = await req.json();
  const days: DayInput[] = (booking_days || []).slice().sort((a: DayInput, b: DayInput) => daySortKey(a.date).localeCompare(daySortKey(b.date)));

  if (days.length === 0) {
    return NextResponse.json({ error: 'A booking needs at least one day' }, { status: 400 });
  }

  const shootDay = days.find(d => d.day_type === 'shoot') || days[0];
  const representativeRate = shootDay.studio_rate;
  const isEquipmentOnly = days.every(d => d.studio_rate === 'equipment_only');

  // Double-booking guard — same exact-date logic as creation, excluding this booking itself.
  // Placeholder "no date yet" days never occupy the studio and must never be checked.
  const realDays = days.filter(d => d.date !== NO_DATE_SENTINEL);
  const allDates = realDays.map(d => d.date);
  if (!isEquipmentOnly && allDates.length > 0) {
    const placeholders = allDates.map(() => '?').join(',');
    const conflicts = db.prepare(`
      SELECT b.id, bd.date as conflict_date FROM bookings b
      JOIN booking_days bd ON bd.booking_id = b.id
      WHERE b.id != ? AND b.status = 'confirmed' AND b.is_pencil = 0 AND bd.studio_rate != 'equipment_only'
        AND COALESCE(bd.is_pencil, 0) = 0
        AND bd.date IN (${placeholders})
      UNION
      SELECT b.id, b.booking_date as conflict_date FROM bookings b
      WHERE b.id != ? AND b.status = 'confirmed' AND b.is_pencil = 0 AND b.studio_rate != 'equipment_only'
        AND NOT EXISTS (SELECT 1 FROM booking_days bd2 WHERE bd2.booking_id = b.id)
        AND b.booking_date IN (${placeholders})
    `).all(bookingId, ...allDates, bookingId, ...allDates) as { id: number; conflict_date: string }[];
    if (conflicts.length > 0) {
      return NextResponse.json({
        error: 'double_booking',
        message: `A confirmed booking already exists on ${conflicts.map(c => c.conflict_date).join(', ')}. Cannot double-book.`,
        conflicts,
      }, { status: 409 });
    }
  }

  // Preserve any per-day call/wrap times for dates that still exist after this edit — the
  // incoming DayInput list doesn't carry times (the date-editor UI doesn't manage them), so
  // without this, editing a booking's dates would silently wipe times set via the Shoot Times
  // panel.
  const existingTimes = new Map(
    (db.prepare('SELECT date, call_time, wrap_time FROM booking_days WHERE booking_id = ?').all(bookingId) as
      { date: string; call_time: string | null; wrap_time: string | null }[])
      .map(d => [d.date, { call_time: d.call_time, wrap_time: d.wrap_time }])
  );

  // Replace all days for this booking
  db.prepare('DELETE FROM booking_days WHERE booking_id = ?').run(bookingId);
  const insDay = db.prepare('INSERT INTO booking_days (booking_id, date, day_type, studio_rate, hours, subtotal, call_time, wrap_time, is_pencil) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const d of days) {
    const preserved = existingTimes.get(d.date);
    insDay.run(bookingId, d.date, d.day_type, d.studio_rate, d.hours || 1, d.subtotal || 0, preserved?.call_time || null, preserved?.wrap_time || null, d.is_pencil ? 1 : 0);
  }

  // Booking-level date range comes from real days only — if every day is still a "no date
  // yet" placeholder (all real dates removed), the booking itself reverts to date-TBD.
  const bookingDate = realDays[0]?.date || NO_DATE_SENTINEL;
  const endDate = realDays.length > 1 ? realDays[realDays.length - 1].date : null;
  const hours = days[0].hours || 1;

  db.prepare(`UPDATE bookings SET booking_date=?, end_date=?, studio_rate=?, hours=?, date_tbd=? WHERE id=?`)
    .run(bookingDate, endDate, representativeRate, hours, realDays.length === 0 ? 1 : 0, bookingId);
  recomputeBookingTotals(db, bookingId);

  logActivity(bookingId, ACTIONS.ITEMS_EDITED, `Booking dates updated — ${days.length} day(s)`);
  return NextResponse.json({ ok: true });
}
