import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const year = req.nextUrl.searchParams.get('year');
  if (year) {
    return NextResponse.json(db.prepare('SELECT * FROM historical_sales WHERE year = ? ORDER BY month').all(year));
  }
  return NextResponse.json(db.prepare('SELECT * FROM historical_sales ORDER BY year DESC, month DESC').all());
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();

  // Bulk upsert — accepts array of { year, month, revenue, shoot_count, notes }
  const rows: { year: number; month: number; revenue: number; shoot_count?: number; notes?: string }[] = Array.isArray(body) ? body : [body];
  const upsert = db.prepare(`
    INSERT INTO historical_sales (year, month, revenue, shoot_count, notes)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(year, month) DO UPDATE SET revenue=excluded.revenue, shoot_count=excluded.shoot_count, notes=excluded.notes
  `);
  for (const r of rows) {
    upsert.run(r.year, r.month, r.revenue || 0, r.shoot_count || 0, r.notes || null);
  }
  return NextResponse.json({ ok: true, count: rows.length });
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const id = req.nextUrl.searchParams.get('id');
  if (id) db.prepare('DELETE FROM historical_sales WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
