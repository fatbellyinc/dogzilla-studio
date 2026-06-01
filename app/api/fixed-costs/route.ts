import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  return NextResponse.json(db.prepare('SELECT * FROM fixed_costs WHERE active=1 ORDER BY category, name').all());
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const { name, amount, category, frequency, notes, vat_on_top } = await req.json();
  const result = db.prepare('INSERT INTO fixed_costs (name, amount, category, frequency, notes, vat_on_top) VALUES (?,?,?,?,?,?)').run(name, amount, category, frequency || 'monthly', notes || null, vat_on_top ? 1 : 0);
  return NextResponse.json(db.prepare('SELECT * FROM fixed_costs WHERE id=?').get(result.lastInsertRowid), { status: 201 });
}
