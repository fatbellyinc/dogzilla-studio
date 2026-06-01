import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const month = req.nextUrl.searchParams.get('month');
  if (month) {
    return NextResponse.json(db.prepare(`SELECT * FROM blockout_dates WHERE date LIKE ? OR (end_date IS NOT NULL AND end_date LIKE ?) ORDER BY date`).all(`${month}%`, `${month}%`));
  }
  return NextResponse.json(db.prepare('SELECT * FROM blockout_dates ORDER BY date DESC').all());
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { date, end_date, reason, color } = body;
  const result = db.prepare(`INSERT INTO blockout_dates (date, end_date, reason, color) VALUES (?, ?, ?, ?)`).run(date, end_date || null, reason || null, color || '#E32726');
  return NextResponse.json(db.prepare('SELECT * FROM blockout_dates WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
}
