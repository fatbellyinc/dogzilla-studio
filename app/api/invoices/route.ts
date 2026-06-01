import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateInvoiceNumber } from '@/lib/utils';
import { logActivity, ACTIONS } from '@/lib/activity';

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { booking_id, notes } = body;
  const invoice_number = generateInvoiceNumber();
  const result = db.prepare(`INSERT INTO invoices (booking_id, invoice_number, notes) VALUES (?, ?, ?)`)
    .run(booking_id, invoice_number, notes || null);
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(result.lastInsertRowid) as { invoice_number: string } | undefined;
  logActivity(booking_id, ACTIONS.INVOICE_GENERATED, `Invoice generated: ${inv?.invoice_number || ''}`);
  return NextResponse.json(inv, { status: 201 });
}
