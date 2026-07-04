import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Monthly close-the-books check: for every completed booking in the month, does an invoice
// exist, and does the payments recorded actually match the invoiced total? This is a data
// -integrity cross-check, distinct from the P&L page (which reports revenue/VAT, not whether
// individual bookings reconcile).
export async function GET(req: NextRequest) {
  const db = getDb();
  const month = req.nextUrl.searchParams.get('month');
  if (!month) return NextResponse.json({ error: 'month is required (YYYY-MM)' }, { status: 400 });

  const bookings = db.prepare(`
    SELECT
      b.id, b.booking_date, b.client_id, b.total, b.vat_exempt, b.status,
      c.name as client_name,
      CASE WHEN b.vat_exempt = 1 THEN b.total ELSE ROUND(b.total * 1.12, 2) END as total_with_vat,
      (SELECT invoice_number FROM invoices WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) as invoice_number,
      COALESCE((SELECT SUM(amount) FROM payments WHERE booking_id = b.id), 0) as total_paid
    FROM bookings b
    JOIN clients c ON c.id = b.client_id
    WHERE b.status = 'completed' AND b.booking_date LIKE ?
    ORDER BY b.booking_date
  `).all(`${month}%`) as {
    id: number; booking_date: string; client_id: number; total: number; vat_exempt: number; status: string;
    client_name: string; total_with_vat: number; invoice_number: string | null; total_paid: number;
  }[];

  const rows = bookings.map(b => {
    const noInvoice = !b.invoice_number;
    const diff = Math.round((b.total_with_vat - b.total_paid) * 100) / 100;
    const unreconciled = Math.abs(diff) > 1;
    return { ...b, no_invoice: noInvoice, diff, unreconciled };
  });

  const summary = {
    completedCount: rows.length,
    invoicedCount: rows.filter(r => !r.no_invoice).length,
    missingInvoiceCount: rows.filter(r => r.no_invoice).length,
    unreconciledCount: rows.filter(r => r.unreconciled).length,
    totalInvoiced: rows.reduce((s, r) => s + r.total_with_vat, 0),
    totalPaid: rows.reduce((s, r) => s + r.total_paid, 0),
  };

  return NextResponse.json({ rows, summary });
}
