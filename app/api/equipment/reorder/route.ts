import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const db = getDb();
  const { id, direction } = await req.json();

  const item = db.prepare('SELECT id, category, sort_order FROM equipment WHERE id = ?').get(id) as
    { id: number; category: string; sort_order: number } | undefined;
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const neighbor = direction === 'up'
    ? db.prepare('SELECT id, sort_order FROM equipment WHERE category = ? AND active = 1 AND sort_order < ? ORDER BY sort_order DESC LIMIT 1').get(item.category, item.sort_order) as { id: number; sort_order: number } | undefined
    : db.prepare('SELECT id, sort_order FROM equipment WHERE category = ? AND active = 1 AND sort_order > ? ORDER BY sort_order ASC LIMIT 1').get(item.category, item.sort_order) as { id: number; sort_order: number } | undefined;

  if (!neighbor) return NextResponse.json({ ok: true });

  const tx = db.transaction(() => {
    db.prepare('UPDATE equipment SET sort_order = ? WHERE id = ?').run(neighbor.sort_order, item.id);
    db.prepare('UPDATE equipment SET sort_order = ? WHERE id = ?').run(item.sort_order, neighbor.id);
  });
  tx();

  return NextResponse.json({ ok: true });
}
