import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const month = req.nextUrl.searchParams.get('month');
  const upcoming = req.nextUrl.searchParams.get('upcoming');

  if (upcoming) {
    const today = new Date().toISOString().slice(0, 10);
    return NextResponse.json(db.prepare(`SELECT * FROM studio_visits WHERE visit_date >= ? AND status = 'scheduled' ORDER BY visit_date, visit_time`).all(today));
  }
  if (month) {
    return NextResponse.json(db.prepare(`SELECT * FROM studio_visits WHERE visit_date LIKE ? ORDER BY visit_date, visit_time`).all(`${month}%`));
  }
  return NextResponse.json(db.prepare('SELECT * FROM studio_visits ORDER BY visit_date DESC').all());
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { visit_date, visit_time, contact_name, contact_phone, contact_company, purpose, notes } = body;
  const result = db.prepare(`INSERT INTO studio_visits (visit_date, visit_time, contact_name, contact_phone, contact_company, purpose, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(visit_date, visit_time || null, contact_name, contact_phone || null, contact_company || null, purpose || 'ocular', notes || null);
  return NextResponse.json(db.prepare('SELECT * FROM studio_visits WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
}
