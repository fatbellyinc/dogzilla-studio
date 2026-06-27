import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { STUDIO_RATES } from '@/lib/types';
import { logActivity, ACTIONS } from '@/lib/activity';

export async function GET(req: NextRequest) {
  const db = getDb();
  const date = req.nextUrl.searchParams.get('date');
  const month = req.nextUrl.searchParams.get('month');
  const status = req.nextUrl.searchParams.get('status');

  let query = `SELECT b.*, c.name as client_name, c.phone as client_phone, c.email as client_email FROM bookings b JOIN clients c ON c.id = b.client_id`;
  const conditions: string[] = [];
  const args: unknown[] = [];

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

  return NextResponse.json(db.prepare(query).all(...args));
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { client_id, booking_days, equipment_items, notes, discount_type, discount_value, project_name, shoot_type, production_house, is_pencil, no_deposit, vat_exempt, recurrence, recurrence_end } = body;

  // Multi-day: studioSubtotal = sum of all day subtotals
  const days: { date: string; day_type: string; studio_rate: string; hours: number; subtotal: number }[] = booking_days || [];
  const studioSubtotal = days.reduce((s, d) => s + (d.subtotal || 0), 0);
  const bookingDate = days[0]?.date || body.booking_date;
  const endDate = days.length > 1 ? days[days.length - 1].date : null;
  // For single-day backwards compat
  const studio_rate = days[0]?.studio_rate || body.studio_rate || 'fullday';
  const hours = days[0]?.hours || body.hours || 1;

  // Use first non-equipment_only, non-setup day as representative rate
  const shootDay = days.find(d => d.day_type === 'shoot') || days[0];
  const representativeRate = shootDay?.studio_rate || studio_rate;

  const eqTotal: number = (equipment_items || []).reduce((s: number, e: { rate: number; quantity: number; is_complimentary?: boolean }) =>
    s + (e.is_complimentary ? 0 : e.rate * e.quantity), 0);

  const subtotalBeforeDiscount = studioSubtotal + eqTotal;
  let discountAmount = 0;
  if (discount_type === 'percent' && discount_value > 0) discountAmount = subtotalBeforeDiscount * (discount_value / 100);
  else if (discount_type === 'fixed' && discount_value > 0) discountAmount = Math.min(discount_value, subtotalBeforeDiscount);

  const total = subtotalBeforeDiscount - discountAmount;
  const deposit = total * 0.5;

  // Double-booking guard — reject if a CONFIRMED booking already exists on any of these dates.
  // Equipment-only bookings don't occupy the studio, so they never conflict and never block
  // other bookings on the same date (e.g. one client rents the studio while another only rents gear).
  const isEquipmentOnly = days.every(d => d.studio_rate === 'equipment_only') || representativeRate === 'equipment_only';
  const allDates = days.map(d => d.date);
  if (allDates.length > 0 && !isEquipmentOnly) {
    const placeholders = allDates.map(() => '?').join(',');
    const conflicts = db.prepare(`
      SELECT id, booking_date, end_date FROM bookings
      WHERE status = 'confirmed' AND is_pencil = 0 AND studio_rate != 'equipment_only'
        AND (
          booking_date IN (${placeholders})
          OR (end_date IS NOT NULL AND end_date >= ? AND booking_date <= ?)
        )
    `).all(...allDates, allDates[0], allDates[allDates.length - 1]) as { id: number; booking_date: string; end_date: string }[];
    if (conflicts.length > 0) {
      return NextResponse.json({
        error: 'double_booking',
        message: `A confirmed booking already exists on ${conflicts.map(c => c.booking_date).join(', ')}. Cannot double-book.`,
        conflicts,
      }, { status: 409 });
    }
  }

  const result = db.prepare(`
    INSERT INTO bookings (client_id, booking_date, end_date, studio_rate, hours, subtotal, equipment_total, total, deposit_amount, discount_type, discount_value, discount_amount, status, notes, project_name, shoot_type, production_house, is_pencil, no_deposit, vat_exempt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
  `).run(client_id, bookingDate, endDate, representativeRate, hours, studioSubtotal, eqTotal, total, deposit,
    discount_type || null, discount_value || 0, discountAmount, notes || null,
    project_name || null, shoot_type || null, production_house || null, is_pencil ? 1 : 0, no_deposit ? 1 : 0, vat_exempt ? 1 : 0);

  const bookingId = result.lastInsertRowid;

  // Save day configs
  if (days.length) {
    const insDay = db.prepare('INSERT INTO booking_days (booking_id, date, day_type, studio_rate, hours, subtotal) VALUES (?, ?, ?, ?, ?, ?)');
    for (const d of days) insDay.run(bookingId, d.date, d.day_type, d.studio_rate, d.hours || 1, d.subtotal || 0);
  }

  if (equipment_items?.length) {
    const ins = db.prepare(`INSERT INTO booking_equipment (booking_id, equipment_id, quantity, rate, name, item_type, is_complimentary, discount_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const item of equipment_items) {
      ins.run(bookingId, item.equipment_id || null, item.quantity, item.rate, item.name,
        item.item_type || 'individual', item.is_complimentary ? 1 : 0, item.discount_pct || 0);
    }
  }

  // Generate recurring future bookings
  if (recurrence && recurrence_end && bookingDate) {
    const endRecur = new Date(recurrence_end + 'T00:00');
    let nextDate = new Date(bookingDate + 'T00:00');
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
