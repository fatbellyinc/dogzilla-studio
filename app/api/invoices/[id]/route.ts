import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const { or_number, notes } = await req.json();
  if (or_number !== undefined) db.prepare('UPDATE invoices SET or_number = ? WHERE id = ?').run(or_number, id);
  if (notes !== undefined) db.prepare('UPDATE invoices SET notes = ? WHERE id = ?').run(notes, id);
  return NextResponse.json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(id));
}
