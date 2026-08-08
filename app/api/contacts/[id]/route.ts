import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Project history — every cost line item this contact has been booked on, for a quick
  // "what have we paid this person/vendor before" reference.
  const history = db.prepare(`
    SELECT pc.id, pc.description, pc.internal_cost, pc.client_cost, p.id as project_id, p.name as project_name, p.created_at as project_date
    FROM project_costs pc JOIN projects p ON p.id = pc.project_id
    WHERE pc.contact_id = ? ORDER BY p.created_at DESC
  `).all(id);
  return NextResponse.json({ contact, history });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const body = await req.json();
  const { name, type, role, company, phone, email, default_rate, rate_unit, notes } = body;
  db.prepare(`
    UPDATE contacts SET name = ?, type = ?, role = ?, company = ?, phone = ?, email = ?, default_rate = ?, rate_unit = ?, notes = ?
    WHERE id = ?
  `).run(
    name, type || 'crew', role || null, company || null, phone || null, email || null,
    Number(default_rate) || 0, rate_unit || 'day', notes || null, id,
  );
  return NextResponse.json(db.prepare('SELECT * FROM contacts WHERE id = ?').get(id));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
