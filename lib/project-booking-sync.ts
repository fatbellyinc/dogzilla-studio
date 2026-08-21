import Database from 'better-sqlite3';
import { STUDIO_RATES } from './types';
import { recomputeBookingTotals } from './booking-calc';

// Keeps a Won project's confirmed shoot date and equipment/studio cost lines in sync with a
// linked studio booking — the project stays the single source of truth for what's budgeted,
// this just mirrors it into the booking system so the studio calendar and equipment inventory
// reflect what's actually confirmed. Idempotent: safe to call repeatedly (e.g. after the
// project's costs change) — always brings the linked booking's date/studio/equipment lines up
// to date rather than creating duplicates.
export function syncProjectBooking(db: Database.Database, projectId: number): { ok: true; booking_id: number } | { ok: false; reason: string } {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as
    { id: number; name: string; client_name: string | null; client_company: string | null; status: string; shoot_date: string | null; shoot_end_date: string | null; booking_id: number | null; vat_exempt: number } | undefined;
  if (!project) return { ok: false, reason: 'Project not found' };
  if (project.status !== 'won') return { ok: false, reason: 'Project must be marked Won before it can be booked' };
  if (!project.shoot_date) return { ok: false, reason: 'Set a confirmed shoot date first' };

  const clientName = (project.client_name || project.name || '').trim();
  if (!clientName) return { ok: false, reason: 'Project needs a client name first' };

  let clientId: number;
  const existingClient = db.prepare('SELECT id FROM clients WHERE LOWER(name) = LOWER(?)').get(clientName) as { id: number } | undefined;
  if (existingClient) {
    clientId = existingClient.id;
  } else {
    const res = db.prepare('INSERT INTO clients (name, company) VALUES (?, ?)').run(clientName, project.client_company || null);
    clientId = Number(res.lastInsertRowid);
  }

  const costs = db.prepare('SELECT * FROM project_costs WHERE project_id = ?').all(projectId) as
    { category: string; description: string; client_cost: number; qty: number }[];

  // Studio rate: matched from a 'set_props_location' line whose description equals a
  // STUDIO_RATES label (how the project page's "Pick Equipment / Studio" picker names these
  // lines when added from the catalog) — falls back to Full Day Shoot if nothing matches.
  let studioRate: keyof typeof STUDIO_RATES = 'fullday';
  let studioSubtotal = 0;
  const rateEntries = Object.entries(STUDIO_RATES) as [keyof typeof STUDIO_RATES, typeof STUDIO_RATES[keyof typeof STUDIO_RATES]][];
  for (const c of costs) {
    if (c.category !== 'set_props_location') continue;
    const match = rateEntries.find(([, rate]) => rate.label === c.description);
    if (match) { studioRate = match[0]; studioSubtotal += c.client_cost; }
  }

  // Equipment lines: matched from 'equipment' category cost items against the equipment
  // catalog by name — custom (unmatched) lines still get pushed through as freeform items.
  const equipmentCatalog = db.prepare('SELECT id, name FROM equipment').all() as { id: number; name: string }[];
  const equipmentItems = costs
    .filter(c => c.category === 'equipment')
    .map(c => {
      const matched = equipmentCatalog.find(e => e.name.toLowerCase() === c.description.toLowerCase());
      const qty = Math.max(1, c.qty || 1);
      return {
        equipment_id: matched?.id || null,
        name: c.description,
        rate: qty > 0 ? c.client_cost / qty : c.client_cost,
        quantity: qty,
        item_type: 'individual',
        category: null as string | null,
      };
    });

  let bookingId = project.booking_id;
  if (bookingId) {
    const exists = db.prepare('SELECT id FROM bookings WHERE id = ?').get(bookingId);
    if (!exists) bookingId = null; // linked booking was deleted — recreate below
  }

  if (bookingId) {
    db.prepare(`
      UPDATE bookings SET client_id = ?, booking_date = ?, end_date = ?, studio_rate = ?, subtotal = ?, vat_exempt = ?, project_name = ?
      WHERE id = ?
    `).run(clientId, project.shoot_date, project.shoot_end_date || null, studioRate, studioSubtotal, project.vat_exempt ? 1 : 0, project.name, bookingId);
  } else {
    const res = db.prepare(`
      INSERT INTO bookings (client_id, booking_date, end_date, studio_rate, hours, subtotal, equipment_total, total, deposit_amount, status, project_name, vat_exempt)
      VALUES (?, ?, ?, ?, 10, ?, 0, ?, 0, 'confirmed', ?, ?)
    `).run(clientId, project.shoot_date, project.shoot_end_date || null, studioRate, studioSubtotal, studioSubtotal, project.name, project.vat_exempt ? 1 : 0);
    bookingId = Number(res.lastInsertRowid);
    db.prepare('UPDATE projects SET booking_id = ? WHERE id = ?').run(bookingId, projectId);
  }

  db.prepare('DELETE FROM booking_equipment WHERE booking_id = ?').run(bookingId);
  if (equipmentItems.length) {
    const ins = db.prepare('INSERT INTO booking_equipment (booking_id, equipment_id, quantity, rate, name, item_type, category) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const item of equipmentItems) ins.run(bookingId, item.equipment_id, item.quantity, item.rate, item.name, item.item_type, item.category);
  }

  recomputeBookingTotals(db, bookingId!);
  return { ok: true, booking_id: bookingId! };
}
