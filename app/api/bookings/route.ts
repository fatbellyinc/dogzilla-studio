import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { STUDIO_RATES, NO_DATE_SENTINEL } from '@/lib/types';
import { logActivity, ACTIONS } from '@/lib/activity';
import { calcDiscountAmount } from '@/lib/utils';
import { recomputeBookingTotals } from '@/lib/booking-calc';

export async function GET(req: NextRequest) {
  const db = getDb();
  const date = req.nextUrl.searchParams.get('date');
  const month = req.nextUrl.searchParams.get('month');
  const status = req.nextUrl.searchParams.get('status');
  const tbd = req.nextUrl.searchParams.get('tbd');

  let query = `SELECT b.*, c.name as client_name, c.phone as client_phone, c.email as client_email FROM bookings b JOIN clients c ON c.id = b.client_id`;
  const conditions: string[] = [];
  const args: unknown[] = [];

  // Inquiries with no confirmed date yet — a separate list, never mixed into calendar/month views
  if (tbd) { conditions.push(`b.date_tbd = 1`); }
  else conditions.push(`COALESCE(b.date_tbd, 0) = 0`);

  if (date) { conditions.push(`b.booking_date = ?`); args.push(date); }
  if (month) {
    // Include bookings that START in this month OR span into this month (multi-day)
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-31`;
    conditions.push(`(b.booking_date LIKE ? OR (b.end_date IS NOT NULL AND b.end_date >= ? AND b.booking_date <= ?))`);
    args.push(`${month}%`, monthStart, monthEnd);
  }
  if (status) { conditions.push(`b.status = ?`); args.push(status); }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY b.booking_date DESC, b.created_at DESC';

  const bookings = db.prepare(query).all(...args) as { id: number; booking_date: string; studio_rate: string; is_pencil: number }[];

  // Attach each booking's exact occupied dates (from booking_days, excluding equipment-only
  // days and cancelled days — neither actually occupies the studio) so calendar views don't
  // fill in gaps for non-consecutive multi-day bookings, or mark a cancelled/equipment-only
  // day as blocking the studio. Also split which of those dates are still tentative (per-day
  // is_pencil) vs confirmed, since a multi-day booking can have some days locked in and others
  // still held.
  const dayRows = bookings.length
    ? db.prepare(`SELECT booking_id, date, is_pencil FROM booking_days WHERE booking_id IN (${bookings.map(() => '?').join(',')}) AND studio_rate != 'equipment_only' AND day_type != 'cancelled' AND date != ?`)
        .all(...bookings.map(b => b.id), NO_DATE_SENTINEL) as { booking_id: number; date: string; is_pencil: number }[]
    : [];
  const daysByBooking = new Map<number, string[]>();
  const pencilDaysByBooking = new Map<number, string[]>();
  for (const row of dayRows) {
    if (!daysByBooking.has(row.booking_id)) daysByBooking.set(row.booking_id, []);
    daysByBooking.get(row.booking_id)!.push(row.date);
    if (row.is_pencil) {
      if (!pencilDaysByBooking.has(row.booking_id)) pencilDaysByBooking.set(row.booking_id, []);
      pencilDaysByBooking.get(row.booking_id)!.push(row.date);
    }
  }

  const result = bookings.map(b => {
    const occupied = b.studio_rate === 'equipment_only' ? [] : (daysByBooking.get(b.id) ?? [b.booking_date]);
    // Whole-booking pencil means every occupied date is tentative; otherwise only the
    // specific days flagged is_pencil are.
    const pencilDates = b.is_pencil ? occupied : (pencilDaysByBooking.get(b.id) ?? []);
    return { ...b, occupied_dates: occupied, pencil_dates: pencilDates };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { client_id, booking_days, equipment_items, notes, discount_type, discount_value, project_name, shoot_type, production_house, is_pencil, no_deposit, vat_exempt, recurrence, recurrence_end, date_tbd } = body;

  // Multi-day: studioSubtotal = sum of all day subtotals
  const days: { date: string; day_type: string; studio_rate: string; hours: number; subtotal: number; is_pencil?: boolean }[] = booking_days || [];
  const isDateTBD = !!date_tbd && days.length === 0;
  if (!isDateTBD && days.length === 0 && !body.booking_date) {
    return NextResponse.json({ error: 'At least one date is required (or mark this booking as date TBD)' }, { status: 400 });
  }
  const studioSubtotal = days.reduce((s, d) => s + (d.subtotal || 0), 0);
  // Booking-level date range is derived from real (non-placeholder) days only — a mixed
  // booking with e.g. two confirmed days and one "no date yet" day shouldn't have its
  // end_date corrupted by the placeholder's sentinel value.
  const realDays = days.filter(d => d.date !== NO_DATE_SENTINEL);
  const bookingDate = realDays[0]?.date || body.booking_date || NO_DATE_SENTINEL;
  const endDate = realDays.length > 1 ? realDays[realDays.length - 1].date : null;
  // For single-day backwards compat
  const studio_rate = days[0]?.studio_rate || body.studio_rate || 'fullday';
  const hours = days[0]?.hours || body.hours || 1;

  // Use first non-equipment_only, non-setup day as representative rate
  const shootDay = days.find(d => d.day_type === 'shoot') || days[0];
  const representativeRate = shootDay?.studio_rate || studio_rate;

  const eqTotal: number = (equipment_items || []).reduce((s: number, e: { rate: number; quantity: number; is_complimentary?: boolean }) =>
    s + (e.is_complimentary ? 0 : e.rate * e.quantity), 0);

  const subtotalBeforeDiscount = studioSubtotal + eqTotal;
  const discountAmount = calcDiscountAmount(subtotalBeforeDiscount, discount_type, discount_value);

  const total = subtotalBeforeDiscount - discountAmount;
  const deposit = total * 0.5;

  // Double-booking guard — reject if a CONFIRMED booking already occupies any of these exact dates.
  // Checked against individual booking_days rows (not a date range) so non-consecutive day
  // selections don't get falsely blocked by, or falsely block, gaps between someone else's days.
  // Equipment-only bookings/days don't occupy the studio, so they never conflict.
  const isEquipmentOnly = days.every(d => d.studio_rate === 'equipment_only') || representativeRate === 'equipment_only';
  // Placeholder "no date yet" days never occupy the studio and must never be checked for
  // conflicts — their sentinel date isn't a real date.
  const allDates = realDays.map(d => d.date);
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

  const result = db.prepare(`
    INSERT INTO bookings (client_id, booking_date, end_date, studio_rate, hours, subtotal, equipment_total, total, deposit_amount, discount_type, discount_value, discount_amount, status, notes, project_name, shoot_type, production_house, is_pencil, no_deposit, vat_exempt, date_tbd)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(client_id, bookingDate, endDate, representativeRate, hours, studioSubtotal, eqTotal, total, deposit,
    discount_type || null, discount_value || 0, discountAmount, notes || null,
    project_name || null, shoot_type || null, production_house || null, is_pencil ? 1 : 0, no_deposit ? 1 : 0, vat_exempt ? 1 : 0, isDateTBD ? 1 : 0);

  const bookingId = result.lastInsertRowid;

  // Save day configs
  if (days.length) {
    const insDay = db.prepare('INSERT INTO booking_days (booking_id, date, day_type, studio_rate, hours, subtotal, is_pencil) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const d of days) insDay.run(bookingId, d.date, d.day_type, d.studio_rate, d.hours || 1, d.subtotal || 0, d.is_pencil ? 1 : 0);
  }

  if (equipment_items?.length) {
    const ins = db.prepare(`INSERT INTO booking_equipment (booking_id, equipment_id, quantity, rate, name, item_type, is_complimentary, discount_pct, day_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const item of equipment_items) {
      ins.run(bookingId, item.equipment_id || null, item.quantity, item.rate, item.name,
        item.item_type || 'individual', item.is_complimentary ? 1 : 0, item.discount_pct || 0, item.day_date || null);
    }
  }

  recomputeBookingTotals(db, Number(bookingId));

  // Generate recurring future bookings
  if (recurrence && recurrence_end && bookingDate) {
    const endRecur = new Date(recurrence_end + 'T00:00');
    const nextDate = new Date(bookingDate + 'T00:00');
    const insRecur = db.prepare(`INSERT INTO bookings (client_id, booking_date, studio_rate, hours, subtotal, equipment_total, total, deposit_amount, discount_type, discount_value, discount_amount, status, notes, project_name, shoot_type, production_house, is_pencil, recurrence, series_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,?,?,?)`);
    const insEq = db.prepare(`INSERT INTO booking_equipment (booking_id, equipment_id, quantity, rate, name, item_type, is_complimentary, discount_pct) VALUES (?,?,?,?,?,?,?,?)`);

    while (true) {
      // Advance to next occurrence
      if (recurrence === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
      else if (recurrence === 'biweekly') nextDate.setDate(nextDate.getDate() + 14);
      else if (recurrence === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
      else if (recurrence === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
      else break;

      if (nextDate > endRecur) break;

      const nextDateStr = nextDate.toISOString().slice(0, 10);
      const recurResult = insRecur.run(
        client_id, nextDateStr, representativeRate, hours, studioSubtotal, eqTotal, total, deposit,
        discount_type || null, discount_value || 0, discountAmount,
        notes || null, project_name || null, shoot_type || null, production_house || null, is_pencil ? 1 : 0,
        recurrence, Number(bookingId)
      );

      if (equipment_items?.length) {
        for (const item of equipment_items) {
          insEq.run(Number(recurResult.lastInsertRowid), item.equipment_id || null, item.quantity, item.rate, item.name, item.item_type || 'individual', item.is_complimentary ? 1 : 0, item.discount_pct || 0);
        }
      }
    }

    // Update the first booking with series_id pointing to itself and recurrence info
    db.prepare('UPDATE bookings SET series_id=?, recurrence=?, recurrence_end=? WHERE id=?').run(Number(bookingId), recurrence, recurrence_end, Number(bookingId));
  }

  const booking = db.prepare(`SELECT b.*, c.name as client_name FROM bookings b JOIN clients c ON c.id = b.client_id WHERE b.id = ?`).get(bookingId);
  const b = booking as { id: number; client_name?: string; booking_date?: string; total?: number };
  const seriesCount = recurrence && recurrence_end ? ` (recurring ${recurrence})` : '';
  logActivity(Number(bookingId), ACTIONS.BOOKING_CREATED, `Booking created for ${b.client_name || ''} on ${b.booking_date || ''} — ₱${(b.total || 0).toLocaleString()}${seriesCount}`);
  return NextResponse.json(booking, { status: 201 });
}
