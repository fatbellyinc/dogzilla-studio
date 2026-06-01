import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const body = await req.json();
  const { name, category, daily_rate, quantity, description, active, wattage, purchase_price, purchase_date, vendor, pre_studio } = body;
  db.prepare(`UPDATE equipment SET name=?, category=?, daily_rate=?, quantity=?, description=?, active=?, wattage=?, purchase_price=?, purchase_date=?, vendor=?, pre_studio=? WHERE id=?`)
    .run(name, category, daily_rate, quantity, description || null, active ?? 1, wattage ?? 0, purchase_price ?? 0, purchase_date || null, vendor || null, pre_studio ? 1 : 0, id);
  return NextResponse.json(db.prepare('SELECT * FROM equipment WHERE id = ?').get(id));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  db.prepare('UPDATE equipment SET active = 0 WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
