import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  return NextResponse.json(db.prepare('SELECT * FROM booking_presets ORDER BY name').all());
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { name, studio_rate, hours, items, notes } = body;
  const result = db.prepare(`INSERT INTO booking_presets (name, studio_rate, hours, items, notes) VALUES (?, ?, ?, ?, ?)`).run(name, studio_rate, hours || 1, JSON.stringify(items || []), notes || null);
  return NextResponse.json(db.prepare('SELECT * FROM booking_presets WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const id = req.nextUrl.searchParams.get('id');
  if (id) db.prepare('DELETE FROM booking_presets WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
