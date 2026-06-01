import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const cat = req.nextUrl.searchParams.get('category');
  let sql = 'SELECT * FROM capital_expenses';
  if (cat) sql += ` WHERE category = '${cat}'`;
  sql += ' ORDER BY date DESC';
  return NextResponse.json(db.prepare(sql).all());
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const rows = Array.isArray(body) ? body : [body];
  const ins = db.prepare('INSERT INTO capital_expenses (date, category, description, amount, vendor, notes) VALUES (?, ?, ?, ?, ?, ?)');
  for (const r of rows) ins.run(r.date, r.category, r.description, r.amount || 0, r.vendor || null, r.notes || null);
  return NextResponse.json({ ok: true, count: rows.length });
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const id = req.nextUrl.searchParams.get('id');
  if (id) db.prepare('DELETE FROM capital_expenses WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
