// One-time repair for bookings whose equipment was added before per-day assignment existed
// (or hit the "+ Custom" tab bug fixed alongside this) — items with no day_date that were
// clearly added once per day (identical name+rate+item_type, repeated in exact multiples of
// the day count) get split back out across the actual days, in the order they were added.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logActivity, ACTIONS } from '@/lib/activity';
import { NO_DATE_SENTINEL } from '@/lib/types';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;

  const days = db.prepare(`
    SELECT date FROM booking_days WHERE booking_id = ? AND date != ? ORDER BY date
  `).all(id, NO_DATE_SENTINEL) as { date: string }[];

  if (days.length < 2) {
    return NextResponse.json({ error: 'This only applies to multi-day bookings' }, { status: 400 });
  }

  const unassigned = db.prepare(`
    SELECT * FROM booking_equipment WHERE booking_id = ? AND day_date IS NULL ORDER BY id
  `).all(id) as { id: number; name: string; rate: number; item_type: string }[];

  const groups = new Map<string, typeof unassigned>();
  for (const item of unassigned) {
    const key = `${item.name}::${item.rate}::${item.item_type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const updateDay = db.prepare('UPDATE booking_equipment SET day_date = ? WHERE id = ?');
  let splitCount = 0;
  let skippedGroups = 0;

  for (const rows of groups.values()) {
    // Only touch groups that are an exact multiple of the day count — anything else is
    // ambiguous (could genuinely mean "N units for the whole booking") and left untouched.
    if (rows.length < 2 || rows.length % days.length !== 0) {
      if (rows.length >= 2) skippedGroups++;
      continue;
    }
    const perDay = rows.length / days.length;
    let idx = 0;
    for (const day of days) {
      for (let k = 0; k < perDay; k++) {
        updateDay.run(day.date, rows[idx].id);
        idx++;
        splitCount++;
      }
    }
  }

  if (splitCount > 0) {
    logActivity(Number(id), ACTIONS.ITEMS_EDITED, `Split ${splitCount} unassigned duplicate item(s) back out across ${days.length} days`);
  }

  return NextResponse.json({ ok: true, splitCount, skippedGroups });
}
