import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { syncProjectBooking } from '@/lib/project-booking-sync';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const costs = db.prepare('SELECT * FROM project_costs WHERE project_id = ? ORDER BY sort_order, id').all(id);
  const payments = db.prepare('SELECT * FROM project_payments WHERE project_id = ? ORDER BY paid_at, id').all(id);
  const invoices = db.prepare('SELECT * FROM project_invoices WHERE project_id = ? ORDER BY created_at, id').all(id);
  return NextResponse.json({ project, costs, payments, invoices });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const body = await req.json();
  const {
    name, client_name, client_company, client_title, description, status,
    markup_pct_dp, markup_pct_no_dp, vat_exempt, no_markup, cost_exclusions, deliverables, payment_terms, notes,
    shoot_date, shoot_end_date, withholding_tax, withholding_rate,
  } = body;

  if (name !== undefined) db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(name, id);
  if (client_name !== undefined) db.prepare('UPDATE projects SET client_name = ? WHERE id = ?').run(client_name || null, id);
  if (client_company !== undefined) db.prepare('UPDATE projects SET client_company = ? WHERE id = ?').run(client_company || null, id);
  if (client_title !== undefined) db.prepare('UPDATE projects SET client_title = ? WHERE id = ?').run(client_title || null, id);
  if (description !== undefined) db.prepare('UPDATE projects SET description = ? WHERE id = ?').run(description || null, id);
  if (status !== undefined) db.prepare('UPDATE projects SET status = ? WHERE id = ?').run(status, id);
  if (markup_pct_dp !== undefined) db.prepare('UPDATE projects SET markup_pct_dp = ? WHERE id = ?').run(Number(markup_pct_dp) || 0, id);
  if (markup_pct_no_dp !== undefined) db.prepare('UPDATE projects SET markup_pct_no_dp = ? WHERE id = ?').run(Number(markup_pct_no_dp) || 0, id);
  if (vat_exempt !== undefined) db.prepare('UPDATE projects SET vat_exempt = ? WHERE id = ?').run(vat_exempt ? 1 : 0, id);
  if (no_markup !== undefined) db.prepare('UPDATE projects SET no_markup = ? WHERE id = ?').run(no_markup ? 1 : 0, id);
  if (cost_exclusions !== undefined) db.prepare('UPDATE projects SET cost_exclusions = ? WHERE id = ?').run(cost_exclusions || null, id);
  if (deliverables !== undefined) db.prepare('UPDATE projects SET deliverables = ? WHERE id = ?').run(deliverables || null, id);
  if (payment_terms !== undefined) db.prepare('UPDATE projects SET payment_terms = ? WHERE id = ?').run(payment_terms || null, id);
  if (notes !== undefined) db.prepare('UPDATE projects SET notes = ? WHERE id = ?').run(notes || null, id);
  if (shoot_date !== undefined) db.prepare('UPDATE projects SET shoot_date = ? WHERE id = ?').run(shoot_date || null, id);
  if (shoot_end_date !== undefined) db.prepare('UPDATE projects SET shoot_end_date = ? WHERE id = ?').run(shoot_end_date || null, id);
  if (withholding_tax !== undefined) db.prepare('UPDATE projects SET withholding_tax = ? WHERE id = ?').run(withholding_tax ? 1 : 0, id);
  if (withholding_rate !== undefined) db.prepare('UPDATE projects SET withholding_rate = ? WHERE id = ?').run(Number(withholding_rate) || 0, id);

  // A confirmed date on a Won project means the studio/equipment should actually be booked —
  // auto-sync whenever either of those two conditions could have just become true, and keep
  // re-syncing on any later edit (idempotent — updates the same linked booking in place).
  const current = db.prepare('SELECT status, shoot_date FROM projects WHERE id = ?').get(id) as { status: string; shoot_date: string | null };
  if (current.status === 'won' && current.shoot_date) {
    syncProjectBooking(db, Number(id));
  }

  return NextResponse.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
