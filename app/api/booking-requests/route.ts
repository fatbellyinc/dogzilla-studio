import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  return NextResponse.json(db.prepare('SELECT * FROM booking_requests ORDER BY created_at DESC').all());
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { name, company, phone, email, preferred_date, shoot_type, studio_rate, message } = body;
  if (!name || !phone) return NextResponse.json({ error: 'Name and phone required' }, { status: 400 });
  const result = db.prepare(`INSERT INTO booking_requests (name, company, phone, email, preferred_date, shoot_type, studio_rate, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(name, company || null, phone, email || null, preferred_date || null, shoot_type || null, studio_rate || null, message || null);
  return NextResponse.json(db.prepare('SELECT * FROM booking_requests WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
}

export async function PUT(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { id, status } = body;
  db.prepare('UPDATE booking_requests SET status = ? WHERE id = ?').run(status, id);
  return NextResponse.json({ ok: true });
}
