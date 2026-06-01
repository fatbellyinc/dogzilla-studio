import { getDb } from './db';

export function logActivity(bookingId: number | null, action: string, description: string, meta?: Record<string, unknown>) {
  try {
    const db = getDb();
    db.prepare('INSERT INTO activity_log (booking_id, action, description, meta) VALUES (?, ?, ?, ?)').run(
      bookingId,
      action,
      description,
      meta ? JSON.stringify(meta) : null
    );
  } catch { /* non-critical — never throw */ }
}

export const ACTIONS = {
  BOOKING_CREATED: 'booking_created',
  STATUS_CHANGED: 'status_changed',
  PAYMENT_RECORDED: 'payment_recorded',
  PAYMENT_DELETED: 'payment_deleted',
  ITEMS_EDITED: 'items_edited',
  DISCOUNT_APPLIED: 'discount_applied',
  TIMES_SET: 'times_set',
  QUOTATION_GENERATED: 'quotation_generated',
  INVOICE_GENERATED: 'invoice_generated',
  PENCIL_TOGGLED: 'pencil_toggled',
  CREW_ADDED: 'crew_added',
  CREW_REMOVED: 'crew_removed',
  EMAIL_SENT: 'email_sent',
  OR_SET: 'or_set',
  OT_LOGGED: 'ot_logged',
} as const;
