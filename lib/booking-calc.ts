import Database from 'better-sqlite3';
import { calcOT, calcDiscountAmount } from './utils';

// Single source of truth for a booking's stored financial fields (subtotal, equipment_total,
// overtime_hours/amount, discount_amount, total, deposit_amount). Every page that reports
// revenue — Financial History, Analytics, P&L, Receivables, Reconciliation, the Calendar,
// Payroll, the Dashboard — reads booking.total directly rather than recomputing it, so this
// function must be called after ANY change that could affect the total: day times, equipment,
// day dates, or discount. Invoice/quotation documents recompute independently for live display,
// but they should always agree with this once called — if they don't, this is the bug to fix.
export function recomputeBookingTotals(db: Database.Database, bookingId: number): void {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as {
    id: number; studio_rate: string; subtotal: number; call_time: string | null; wrap_time: string | null;
    overtime_hours: number; overtime_amount: number; discount_type: string | null; discount_value: number;
    no_deposit: number;
  } | undefined;
  if (!booking) return;

  const days = db.prepare('SELECT * FROM booking_days WHERE booking_id = ? ORDER BY date').all(bookingId) as
    { date: string; day_type: string; studio_rate: string; hours: number; subtotal: number; call_time: string | null; wrap_time: string | null }[];
  const equipment = db.prepare('SELECT * FROM booking_equipment WHERE booking_id = ?').all(bookingId) as
    { rate: number; quantity: number; is_complimentary: number; discount_pct: number }[];

  const studioSubtotal = days.length ? days.reduce((s, d) => s + d.subtotal, 0) : booking.subtotal;
  const eqTotal = equipment.reduce((s, e) => s + (e.is_complimentary ? 0 : e.rate * e.quantity * (1 - (e.discount_pct || 0) / 100)), 0);

  // Overtime: per-day when there's more than one day (each day can run different hours),
  // otherwise fall back to the single booking-level call/wrap time fields.
  let otHrs = 0;
  let otAmount = 0;
  if (days.length > 1) {
    for (const d of days) {
      const ot = calcOT(d.studio_rate, d.call_time || null, d.wrap_time || null);
      otHrs += ot.otHrs;
      otAmount += ot.otAmount;
    }
  } else if (days.length === 1) {
    const ot = calcOT(days[0].studio_rate, days[0].call_time || booking.call_time, days[0].wrap_time || booking.wrap_time);
    otHrs = ot.otHrs;
    otAmount = ot.otAmount;
  } else {
    const ot = calcOT(booking.studio_rate, booking.call_time, booking.wrap_time);
    otHrs = booking.overtime_hours || ot.otHrs;
    otAmount = booking.overtime_amount || ot.otAmount;
  }

  // Discount applies to studio + equipment only, not overtime — matches how invoice/quotation
  // documents already display it (a separate, non-discountable line).
  const subtotalBeforeDiscount = studioSubtotal + eqTotal;
  const discountAmount = calcDiscountAmount(subtotalBeforeDiscount, booking.discount_type as 'percent' | 'fixed' | null, booking.discount_value);
  const total = subtotalBeforeDiscount - discountAmount + otAmount;
  const deposit = total * 0.5;

  db.prepare(`
    UPDATE bookings
    SET subtotal = ?, equipment_total = ?, overtime_hours = ?, overtime_amount = ?,
        discount_amount = ?, total = ?, deposit_amount = ?
    WHERE id = ?
  `).run(studioSubtotal, eqTotal, otHrs, otAmount, discountAmount, total, deposit, bookingId);
}
