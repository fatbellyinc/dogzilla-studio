import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(id);
  if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(quotation);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const { custom_items, removed_items, notes, valid_until } = await req.json();
  const updates: string[] = [];
  const values: unknown[] = [];
  if (custom_items !== undefined) { updates.push('custom_items=?'); values.push(JSON.stringify(custom_items)); }
  if (removed_items !== undefined) { updates.push('removed_items=?'); values.push(JSON.stringify(removed_items)); }
  if (notes !== undefined) { updates.push('notes=?'); values.push(notes); }
  if (valid_until !== undefined) { updates.push('valid_until=?'); values.push(valid_until); }
  if (updates.length) { values.push(id); db.prepare(`UPDATE quotations SET ${updates.join(',')} WHERE id=?`).run(...values); }
  return NextResponse.json(db.prepare('SELECT * FROM quotations WHERE id = ?').get(id));
}
