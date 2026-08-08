import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const type = req.nextUrl.searchParams.get('type');
  const contacts = type
    ? db.prepare('SELECT * FROM contacts WHERE type = ? ORDER BY name').all(type)
    : db.prepare('SELECT * FROM contacts ORDER BY name').all();
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { name, type, role, company, phone, email, default_rate, default_category, rate_unit, notes } = body;
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const result = db.prepare(`
    INSERT INTO contacts (name, type, role, company, phone, email, default_rate, default_category, rate_unit, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, type || 'crew', role || null, company || null, phone || null, email || null,
    Number(default_rate) || 0, default_category || 'others', rate_unit || 'day', notes || null,
  );
  return NextResponse.json(db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
}
