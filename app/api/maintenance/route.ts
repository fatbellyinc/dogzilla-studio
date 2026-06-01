import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const equipmentId = req.nextUrl.searchParams.get('equipment_id');
  if (equipmentId) {
    return NextResponse.json(db.prepare('SELECT * FROM equipment_maintenance WHERE equipment_id = ? ORDER BY date DESC').all(equipmentId));
  }
  return NextResponse.json(db.prepare(`
    SELECT em.*, e.name as equipment_name_ref FROM equipment_maintenance em
    LEFT JOIN equipment e ON e.id = em.equipment_id
    ORDER BY em.date DESC LIMIT 50
  `).all());
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { equipment_id, equipment_name, type, description, cost, date, next_service } = body;
  const result = db.prepare(`INSERT INTO equipment_maintenance (equipment_id, equipment_name, type, description, cost, date, next_service) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(equipment_id || null, equipment_name, type, description || null, cost || 0, date, next_service || null);
  return NextResponse.json(db.prepare('SELECT * FROM equipment_maintenance WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const id = req.nextUrl.searchParams.get('id');
  if (id) db.prepare('DELETE FROM equipment_maintenance WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
