import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const year = req.nextUrl.searchParams.get('year');
  const q = req.nextUrl.searchParams.get('q') || '';
  let sql = 'SELECT * FROM historical_shoots';
  const args: unknown[] = [];
  const conds: string[] = [];
  if (year) { conds.push(`strftime('%Y', shoot_date) = ?`); args.push(year); }
  if (q) { conds.push(`(client_name LIKE ? OR project_name LIKE ?)`); args.push(`%${q}%`, `%${q}%`); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY shoot_date DESC';
  return NextResponse.json(db.prepare(sql).all(...args));
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const rows = Array.isArray(body) ? body : [body];
  const ins = db.prepare('INSERT INTO historical_shoots (shoot_date, client_name, project_name, shoot_type, studio_rate, revenue, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const r of rows) ins.run(r.shoot_date, r.client_name, r.project_name || null, r.shoot_type || null, r.studio_rate || null, r.revenue || 0, r.notes || null);
  return NextResponse.json({ ok: true, count: rows.length });
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const id = req.nextUrl.searchParams.get('id');
  if (id) db.prepare('DELETE FROM historical_shoots WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
