import { NextRequest, NextResponse } from 'next/server';
import { getDb, nextDocNumber } from '@/lib/db';
import { Project, ProjectCost } from '@/lib/types';

// Duplicates a project's budget/settings into a brand-new draft — for near-identical repeat
// jobs (same client, same production requirements) so a producer can start from a known-good
// budget and revise from there instead of rebuilding it line by line. Deliberately does NOT
// carry over the shoot date, linked studio booking, status, or payments/invoices — those are
// specific to one confirmed job, not the reusable template part.
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const costs = db.prepare('SELECT * FROM project_costs WHERE project_id = ? ORDER BY sort_order, id').all(id) as ProjectCost[];

  const quote_number = nextDocNumber(db, 'DZCE');
  const result = db.prepare(`
    INSERT INTO projects (
      quote_number, name, client_name, client_company, client_title, description, status,
      markup_pct_dp, markup_pct_no_dp, vat_exempt, no_markup, cost_exclusions, deliverables,
      payment_terms, notes, withholding_tax, withholding_rate
    ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    quote_number, `${project.name} (Copy)`, project.client_name, project.client_company, project.client_title, project.description,
    project.markup_pct_dp, project.markup_pct_no_dp, project.vat_exempt, project.no_markup, project.cost_exclusions, project.deliverables,
    project.payment_terms, project.notes, project.withholding_tax, project.withholding_rate,
  );
  const newProjectId = result.lastInsertRowid;

  const insCost = db.prepare(`
    INSERT INTO project_costs (
      project_id, category, description, note, internal_cost, client_cost, sort_order, contact_id,
      qty, discount_type, discount_value, cost_flow, days
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of costs) {
    insCost.run(newProjectId, c.category, c.description, c.note, c.internal_cost, c.client_cost, c.sort_order, c.contact_id,
      c.qty, c.discount_type, c.discount_value, c.cost_flow, c.days);
  }

  return NextResponse.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(newProjectId), { status: 201 });
}
