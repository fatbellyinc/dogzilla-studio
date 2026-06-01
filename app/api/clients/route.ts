import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const search = req.nextUrl.searchParams.get('q') || '';
  let clients;
  if (search) {
    clients = db.prepare(`SELECT * FROM clients WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? ORDER BY name`).all(`%${search}%`, `%${search}%`, `%${search}%`);
  } else {
    clients = db.prepare(`SELECT c.*, COUNT(b.id) as booking_count FROM clients c LEFT JOIN bookings b ON b.client_id = c.id GROUP BY c.id ORDER BY c.name`).all();
  }
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { name, company, tin, email, phone, address, notes, special_notes } = body;
  const result = db.prepare(`INSERT INTO clients (name, company, tin, email, phone, address, notes, special_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(name, company || null, tin || null, email || null, phone || null, address || null, notes || null, special_notes || null);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(client, { status: 201 });
}
