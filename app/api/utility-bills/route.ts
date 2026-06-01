import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const year = req.nextUrl.searchParams.get('year');
  const account = req.nextUrl.searchParams.get('account');
  let sql = 'SELECT * FROM utility_bills';
  const conds: string[] = [];
  const args: unknown[] = [];
  if (year) { conds.push('year = ?'); args.push(year); }
  if (account) { conds.push('account = ?'); args.push(account); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY year DESC, month DESC';
  return NextResponse.json(db.prepare(sql).all(...args));
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const rows = Array.isArray(body) ? body : [body];
  const ins = db.prepare('INSERT INTO utility_bills (year, month, account, account_label, amount, kwh, reference, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (const r of rows) ins.run(r.year, r.month, r.account, r.account_label || null, r.amount || 0, r.kwh || null, r.reference || null, r.notes || null);
  return NextResponse.json({ ok: true, count: rows.length });
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const id = req.nextUrl.searchParams.get('id');
  if (id) db.prepare('DELETE FROM utility_bills WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
