import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { calcOT } from '@/lib/utils';

// Sets or clears call/wrap time on a single shoot day, independent of every other day in a
// multi-day booking. Work hours legitimately vary day to day (a setup day is short, a shoot
// day can run long), so times live on booking_days, not on the booking as a whole.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; dayId: string }> }) {
  const { id, dayId } = await params;
  const db = getDb();
  const body = await req.json();
  const call_time: string | null = body.call_time || null;
  const wrap_time: string | null = body.wrap_time || null;

  const day = db.prepare('SELECT * FROM booking_days WHERE id = ? AND booking_id = ?').get(dayId, id) as
    { id: number; date: string; day_type: string; studio_rate: string } | undefined;
  if (!day) return NextResponse.json({ error: 'Day not found' }, { status: 404 });

  db.prepare('UPDATE booking_days SET call_time = ?, wrap_time = ? WHERE id = ?').run(call_time, wrap_time, dayId);

  // Auto-update that day's electricity line item (if one exists) to match the new duration —
  // scoped to this exact day via day_date, so other days' electricity entries are untouched.
  let updatedElec: { rate: number; hours: number } | null = null;
  if (call_time && wrap_time) {
    const ot = calcOT(day.studio_rate, call_time, wrap_time);
    if (ot.durationHrs > 0) {
      const elecRow = db.prepare(`
        SELECT id FROM booking_equipment
        WHERE booking_id = ? AND day_date = ? AND name LIKE 'Power Consumption%'
      `).get(id, day.date) as { id: number } | undefined;
      if (elecRow) {
        const newRate = Math.round(ot.durationHrs * 850);
        db.prepare(`UPDATE booking_equipment SET rate = ?, quantity = 1 WHERE id = ?`).run(newRate, elecRow.id);
        updatedElec = { rate: newRate, hours: ot.durationHrs };
      }
    }
  }

  const updatedDay = db.prepare('SELECT * FROM booking_days WHERE id = ?').get(dayId);
  return NextResponse.json({ day: updatedDay, updatedElec });
}
