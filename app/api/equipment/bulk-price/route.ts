import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logActivity, ACTIONS } from '@/lib/activity';

// Applies a percentage or fixed-amount price adjustment across many equipment rows at once,
// replacing the old workflow of hand-writing one-off SQL UPDATE statements against production
// every time a rate changes.
export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { ids, mode, value } = body as { ids: number[]; mode: 'percent' | 'fixed_add' | 'fixed_set'; value: number };

  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'No items selected' }, { status: 400 });
  if (!['percent', 'fixed_add', 'fixed_set'].includes(mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  if (typeof value !== 'number' || Number.isNaN(value)) return NextResponse.json({ error: 'Invalid value' }, { status: 400 });

  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT id, name, daily_rate FROM equipment WHERE id IN (${placeholders})`).all(...ids) as { id: number; name: string; daily_rate: number }[];

  const updated = db.transaction(() => {
    const upd = db.prepare('UPDATE equipment SET daily_rate = ? WHERE id = ?');
    return rows.map(r => {
      let newRate = r.daily_rate;
      if (mode === 'percent') newRate = Math.round(r.daily_rate * (1 + value / 100));
      else if (mode === 'fixed_add') newRate = Math.round(r.daily_rate + value);
      else if (mode === 'fixed_set') newRate = Math.round(value);
      newRate = Math.max(0, newRate);
      upd.run(newRate, r.id);
      return { id: r.id, name: r.name, old_rate: r.daily_rate, new_rate: newRate };
    });
  })();

  const summary = mode === 'percent' ? `${value > 0 ? '+' : ''}${value}%`
    : mode === 'fixed_add' ? `${value > 0 ? '+' : ''}₱${value}`
    : `set to ₱${value}`;
  logActivity(null, ACTIONS.PRICE_BULK_UPDATED, `Bulk price update (${summary}) applied to ${updated.length} item(s): ${updated.map(u => u.name).join(', ')}`);

  return NextResponse.json({ updated });
}
