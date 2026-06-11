import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const bookings = db.prepare(`SELECT b.*, c.name as client_name FROM bookings b JOIN clients c ON c.id = b.client_id WHERE b.client_id = ? ORDER BY b.booking_date DESC`).all(id);
  return NextResponse.json({ client, bookings });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const body = await req.json();
  const { name, company, tin, email, phone, address, notes, special_notes, is_vip } = body;
  // Partial update: VIP tag toggle (doesn't touch other fields)
  if (is_vip !== undefined) {
    db.prepare('UPDATE clients SET is_vip = ? WHERE id = ?').run(is_vip ? 1 : 0, id);
  }
  // Full profile update only when name is provided
  if (name !== undefined) {
    db.prepare(`UPDATE clients SET name=?, company=?, tin=?, email=?, phone=?, address=?, notes=?, special_notes=? WHERE id=?`).run(name, company || null, tin || null, email || null, phone || null, address || null, notes || null, special_notes || null, id);
  }
  return NextResponse.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(id));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
