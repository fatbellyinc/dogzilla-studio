import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Save push subscription
export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { subscription } = body;
  if (subscription) {
    db.prepare("INSERT INTO settings (key,value) VALUES ('push_subscription',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .run(JSON.stringify(subscription));
  }
  return NextResponse.json({ ok: true });
}

// Get pending notifications for this device (polling approach)
export async function GET() {
  const db = getDb();
  const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = fmtLocal(new Date());

  const alerts: { title: string; body: string; url: string; tag: string }[] = [];

  // Shoots tomorrow with no deposit — skip no-deposit-waived and fully-paid bookings
  const tomorrow = fmtLocal(new Date(Date.now() + 86400000));
  const urgentDeposits = db.prepare(`
    SELECT b.id, c.name FROM bookings b JOIN clients c ON c.id=b.client_id
    WHERE b.booking_date = ? AND b.deposit_paid = 0 AND b.status != 'cancelled'
      AND COALESCE(b.no_deposit, 0) = 0
      AND COALESCE(b.fully_paid, 0) = 0
      AND (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.booking_id = b.id) < b.deposit_amount - 0.01
  `).all(tomorrow) as { id: number; name: string }[];

  for (const b of urgentDeposits) {
    alerts.push({ title: '🚨 Deposit Missing — Tomorrow!', body: `${b.name} shoots tomorrow but no deposit received`, url: `/bookings/${b.id}`, tag: `deposit-${b.id}` });
  }

  // Overdue balances (shoot already happened, balance > 0) — skip fully-paid, respect VAT-exempt
  const overdueBookings = db.prepare(`
    SELECT b.id, c.name, b.booking_date,
      (CASE WHEN COALESCE(b.vat_exempt, 0) = 1 THEN b.total ELSE b.total * 1.12 END)
        - COALESCE(SUM(p.amount),0) as balance
    FROM bookings b JOIN clients c ON c.id=b.client_id
    LEFT JOIN payments p ON p.booking_id=b.id
    WHERE b.booking_date < ? AND b.status NOT IN ('cancelled')
      AND COALESCE(b.fully_paid, 0) = 0
    GROUP BY b.id HAVING balance > 0.01
    LIMIT 3
  `).all(today) as { id: number; name: string; balance: number }[];

  if (overdueBookings.length > 0) {
    const total = overdueBookings.reduce((s, b) => s + b.balance, 0);
    alerts.push({ title: `💸 ${overdueBookings.length} Overdue Balance${overdueBookings.length > 1 ? 's' : ''}`, body: `₱${total.toLocaleString()} still owed — ${overdueBookings.map(b => b.name).join(', ')}`, url: '/receivables', tag: 'overdue' });
  }

  // New booking requests
  const newRequests = (db.prepare("SELECT COUNT(*) as c FROM booking_requests WHERE status='new'").get() as { c: number }).c;
  if (newRequests > 0) {
    alerts.push({ title: `📬 ${newRequests} New Booking Request${newRequests > 1 ? 's' : ''}`, body: 'Someone wants to book Dogzilla Studio', url: '/requests', tag: 'requests' });
  }

  return NextResponse.json({ alerts });
}
