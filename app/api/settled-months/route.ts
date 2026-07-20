import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Purely a "closed the books" marker for a LIVE month in Financial History — no revenue figures
// change, it just swaps the green LIVE badge for a gray "Settled" one once you've confirmed
// every completed booking that month is paid up.
export async function GET(req: NextRequest) {
  const db = getDb();
  const year = req.nextUrl.searchParams.get('year');
  if (!year) return NextResponse.json({ error: 'year is required' }, { status: 400 });
  const rows = db.prepare('SELECT month FROM settled_months WHERE year = ?').all(Number(year)) as { month: number }[];
  return NextResponse.json(rows.map(r => r.month));
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const { year, month } = await req.json();
  if (!year || !month) return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
  db.prepare('INSERT INTO settled_months (year, month) VALUES (?, ?) ON CONFLICT(year, month) DO NOTHING').run(Number(year), Number(month));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const year = req.nextUrl.searchParams.get('year');
  const month = req.nextUrl.searchParams.get('month');
  if (!year || !month) return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
  db.prepare('DELETE FROM settled_months WHERE year = ? AND month = ?').run(Number(year), Number(month));
  return NextResponse.json({ ok: true });
}
