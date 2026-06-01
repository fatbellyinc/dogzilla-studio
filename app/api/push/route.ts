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
  const today = new Date().toISOString().slice(0, 10);

  const alerts: { title: string; body: string; url: string; tag: string }[] = [];

  // Shoots tomorrow with no deposit
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const urgentDeposits = db.prepare(`
    SELECT b.id, c.name FROM bookings b JOIN clients c ON c.id=b.client_id
    WHERE b.booking_date = ? AND b.deposit_paid = 0 AND b.status != 'cancelled'
  `).all(tomorrow) as { id: number; name: string }[];

  for (const b of urgentDeposits) {
    alerts.push({ title: '🚨 Deposit Missing — Tomorrow!', body: `${b.name} shoots tomorrow but no deposit received`, url: `/bookings/${b.id}`, tag: `deposit-${b.id}` });
  }

  // Overdue balances (shoot already happened, balance > 0)
  const overdueBookings = db.prepare(`
    SELECT b.id, c.name, b.booking_date,
      (b.total * 1.12) - COALESCE(SUM(p.amount),0) as balance
    FROM bookings b JOIN clients c ON c.id=b.client_id
    LEFT JOIN payments p ON p.booking_id=b.id
    WHERE b.booking_date < ? AND b.status NOT IN ('cancelled')
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
