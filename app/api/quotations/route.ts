import { NextRequest, NextResponse } from 'next/server';
import { getDb, nextDocNumber } from '@/lib/db';
import { logActivity, ACTIONS } from '@/lib/activity';

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { booking_id, valid_until, notes } = body;
  const quote_number = nextDocNumber(db, 'DZQ');
  const result = db.prepare(`INSERT INTO quotations (booking_id, quote_number, valid_until, notes) VALUES (?, ?, ?, ?)`)
    .run(booking_id, quote_number, valid_until || null, notes || null);
  const q = db.prepare('SELECT * FROM quotations WHERE id = ?').get(result.lastInsertRowid) as { quote_number: string } | undefined;
  logActivity(booking_id, ACTIONS.QUOTATION_GENERATED, `Quotation generated: ${q?.quote_number || ''}`);
  return NextResponse.json(q, { status: 201 });
}
