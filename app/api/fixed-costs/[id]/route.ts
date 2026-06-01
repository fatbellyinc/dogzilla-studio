import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const { name, amount, category, frequency, notes, active, vat_on_top } = await req.json();
  db.prepare('UPDATE fixed_costs SET name=?,amount=?,category=?,frequency=?,notes=?,active=?,vat_on_top=? WHERE id=?').run(name, amount, category, frequency, notes || null, active ?? 1, vat_on_top ? 1 : 0, id);
  return NextResponse.json(db.prepare('SELECT * FROM fixed_costs WHERE id=?').get(id));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  db.prepare('UPDATE fixed_costs SET active=0 WHERE id=?').run(id);
  return NextResponse.json({ ok: true });
}
